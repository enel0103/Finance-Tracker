import { useState, useEffect, useCallback } from 'react'
import {
  Bell, Plus, Pencil, Trash2, Check, X, BellOff, BellRing,
  CalendarDays, AlarmClock, ChevronDown, ChevronUp
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext.jsx'
import { isPushSupported, getSubscriptionStatus, enablePush, disablePush } from '../lib/push.js'
import { formatPeso } from '../lib/utils.js'

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)
const REMIND_OPTIONS = [1, 2, 3, 5, 7, 10, 14]

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function daysUntilDue(dueDay) {
  const today = new Date()
  const currentDay = today.getDate()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()

  let next = new Date(currentYear, currentMonth, dueDay)
  if (dueDay <= currentDay) {
    next = new Date(currentYear, currentMonth + 1, dueDay)
  }
  const diff = Math.ceil((next - today) / (1000 * 60 * 60 * 24))
  return diff
}

function BillStatusBadge({ dueDay, remindDaysBefore }) {
  const days = daysUntilDue(dueDay)
  if (days === 0) return <span className="pill bg-expense/10 text-expense">Due today</span>
  if (days <= remindDaysBefore) return <span className="pill bg-amber-500/10 text-amber-500">Due in {days}d</span>
  return <span className="pill bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Due in {days}d</span>
}

function BillForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || '')
  const [amount, setAmount] = useState(initial?.amount ?? '')
  const [dueDay, setDueDay] = useState(initial?.due_day || 1)
  const [remindDays, setRemindDays] = useState(initial?.remind_days_before || 3)
  const [notes, setNotes] = useState(initial?.notes || '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    await onSave({ name: name.trim(), amount: amount === '' ? null : Number(amount), due_day: dueDay, remind_days_before: remindDays, notes: notes.trim() || null })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Bill name *</label>
          <input
            type="text"
            required
            maxLength={60}
            className="input"
            placeholder="e.g. Netflix, Meralco, Rent"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Amount (optional)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input"
            placeholder="₱0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Due day of month</label>
          <select
            className="input"
            value={dueDay}
            onChange={(e) => setDueDay(Number(e.target.value))}
          >
            {DAYS.map((d) => (
              <option key={d} value={d}>{ordinal(d)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Remind me</label>
          <select
            className="input"
            value={remindDays}
            onChange={(e) => setRemindDays(Number(e.target.value))}
          >
            {REMIND_OPTIONS.map((d) => (
              <option key={d} value={d}>{d} day{d > 1 ? 's' : ''} before</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Notes (optional)</label>
          <input
            type="text"
            maxLength={120}
            className="input"
            placeholder="Any extra info"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="btn-ghost">
          <X className="w-4 h-4" /> Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary">
          <Check className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

export default function Bills() {
  const { user } = useAuth()
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [pushStatus, setPushStatus] = useState({ supported: false, subscribed: false, permission: 'default' })
  const [pushLoading, setPushLoading] = useState(false)
  const [pushMsg, setPushMsg] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const loadBills = useCallback(async () => {
    const { data } = await supabase
      .from('bills')
      .select('*')
      .eq('user_id', user.id)
      .order('due_day', { ascending: true })
    setBills(data || [])
    setLoading(false)
  }, [user.id])

  const checkPushStatus = useCallback(async () => {
    const status = await getSubscriptionStatus(user.id)
    setPushStatus(status)
  }, [user.id])

  useEffect(() => {
    loadBills()
    checkPushStatus()
  }, [loadBills, checkPushStatus])

  const addBill = async (fields) => {
    const { error } = await supabase.from('bills').insert({ ...fields, user_id: user.id, is_active: true })
    if (!error) { setShowAdd(false); loadBills() }
  }

  const updateBill = async (id, fields) => {
    const { error } = await supabase.from('bills').update(fields).eq('id', id).eq('user_id', user.id)
    if (!error) { setEditingId(null); loadBills() }
  }

  const deleteBill = async (id) => {
    if (!confirm('Delete this bill?')) return
    await supabase.from('bills').delete().eq('id', id).eq('user_id', user.id)
    loadBills()
  }

  const toggleActive = async (bill) => {
    await supabase.from('bills').update({ is_active: !bill.is_active }).eq('id', bill.id).eq('user_id', user.id)
    loadBills()
  }

  const handlePushToggle = async () => {
    setPushLoading(true)
    setPushMsg('')
    try {
      if (pushStatus.subscribed) {
        await disablePush(user.id)
        setPushMsg('Notifications disabled.')
      } else {
        await enablePush(user.id)
        setPushMsg('Notifications enabled! You\'ll be reminded before bills are due.')
      }
      await checkPushStatus()
    } catch (err) {
      setPushMsg(err.message)
    }
    setPushLoading(false)
  }

  const activeBills = bills.filter((b) => b.is_active)
  const inactiveBills = bills.filter((b) => !b.is_active)

  const upcomingBills = activeBills.filter((b) => daysUntilDue(b.due_day) <= b.remind_days_before)

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bills</h1>
          <p className="text-sm text-slate-500">Track recurring bills and get reminded before they're due</p>
        </div>
        <button onClick={() => { setShowAdd(true); setEditingId(null) }} className="btn-primary">
          <Plus className="w-4 h-4" /> Add bill
        </button>
      </div>

      {/* Notification toggle */}
      <div className="card flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {pushStatus.subscribed
            ? <BellRing className="w-5 h-5 text-emerald-500" />
            : <BellOff className="w-5 h-5 text-slate-400" />}
          <div>
            <div className="text-sm font-medium">
              {pushStatus.subscribed ? 'Notifications on' : 'Notifications off'}
            </div>
            <div className="text-xs text-slate-500">
              {!pushStatus.supported
                ? 'Not supported in this browser'
                : pushStatus.subscribed
                  ? 'You\'ll receive reminders before bills are due'
                  : 'Enable to get bill reminders on this device'}
            </div>
            {pushMsg && (
              <div className="text-xs mt-1 text-emerald-600 dark:text-emerald-400">{pushMsg}</div>
            )}
          </div>
        </div>
        {pushStatus.supported && (
          <button
            onClick={handlePushToggle}
            disabled={pushLoading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              pushStatus.subscribed ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
            }`}
            aria-label="Toggle notifications"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                pushStatus.subscribed ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        )}
      </div>

      {/* Upcoming alert */}
      {upcomingBills.length > 0 && (
        <div className="card border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 space-y-2">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-sm">
            <AlarmClock className="w-4 h-4" />
            {upcomingBills.length} bill{upcomingBills.length > 1 ? 's' : ''} coming up soon
          </div>
          {upcomingBills.map((b) => (
            <div key={b.id} className="flex justify-between text-sm">
              <span className="text-slate-700 dark:text-slate-300">{b.name}</span>
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                {b.amount ? formatPeso(b.amount) : ''} · Due {ordinal(b.due_day)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Plus className="w-4 h-4 text-slate-400" /> New bill
          </h2>
          <BillForm onSave={addBill} onCancel={() => setShowAdd(false)} />
        </div>
      )}

      {/* Bills list */}
      {loading ? (
        <div className="text-sm text-slate-400 text-center py-8">Loading…</div>
      ) : activeBills.length === 0 && !showAdd ? (
        <div className="card text-center py-10 space-y-2">
          <CalendarDays className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-slate-500 text-sm">No bills yet. Add one to start tracking.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeBills.map((bill) => (
            <div key={bill.id} className="card p-4 space-y-3">
              {editingId === bill.id ? (
                <>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Editing</p>
                  <BillForm
                    initial={bill}
                    onSave={(fields) => updateBill(bill.id, fields)}
                    onCancel={() => setEditingId(null)}
                  />
                </>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{bill.name}</span>
                      <BillStatusBadge dueDay={bill.due_day} remindDaysBefore={bill.remind_days_before} />
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>Due {ordinal(bill.due_day)} of every month</span>
                      {bill.amount && <span className="font-medium text-slate-700 dark:text-slate-300">{formatPeso(bill.amount)}</span>}
                      <span>Remind {bill.remind_days_before}d before</span>
                    </div>
                    {bill.notes && (
                      <div className="text-xs text-slate-400">{bill.notes}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => { setEditingId(bill.id); setShowAdd(false) }}
                      className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                      aria-label="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => toggleActive(bill)}
                      className="p-1.5 rounded text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                      aria-label="Pause"
                      title="Pause bill"
                    >
                      <BellOff className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteBill(bill.id)}
                      className="p-1.5 rounded text-slate-400 hover:text-expense hover:bg-expense/10"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Inactive/paused bills */}
      {inactiveBills.length > 0 && (
        <div>
          <button
            onClick={() => setShowInactive((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 mb-2"
          >
            {showInactive ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {inactiveBills.length} paused bill{inactiveBills.length > 1 ? 's' : ''}
          </button>
          {showInactive && (
            <div className="space-y-2 opacity-60">
              {inactiveBills.map((bill) => (
                <div key={bill.id} className="card p-4 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-sm font-medium line-through text-slate-400">{bill.name}</span>
                    <div className="text-xs text-slate-400">Due {ordinal(bill.due_day)}{bill.amount ? ` · ${formatPeso(bill.amount)}` : ''}</div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => toggleActive(bill)}
                      className="p-1.5 rounded text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                      aria-label="Re-enable"
                      title="Re-enable"
                    >
                      <Bell className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteBill(bill.id)}
                      className="p-1.5 rounded text-slate-400 hover:text-expense hover:bg-expense/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
