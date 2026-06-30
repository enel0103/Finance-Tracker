import { useState, useEffect, useCallback } from 'react'
import {
  HandCoins, Plus, Pencil, Trash2, Check, X,
  BellOff, BellRing, ChevronDown, ChevronUp, CalendarDays
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext.jsx'
import { formatPeso, todayISO } from '../lib/utils.js'
import { isPushSupported, getSubscriptionStatus, enablePush, disablePush } from '../lib/push.js'

const REMIND_PRESETS = [3, 7, 10, 14, 30]
const LOAN_CATEGORY = 'Loan'

function daysSince(dateStr) {
  const lent = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((today - lent) / (1000 * 60 * 60 * 24))
}

function LoanStatusBadge({ dateLent, remindEveryDays }) {
  const days = daysSince(dateLent)
  const cycle = days % remindEveryDays
  const daysLeft = remindEveryDays - cycle

  if (days === 0) return <span className="pill bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Lent today</span>
  if (daysLeft <= 1) return <span className="pill bg-amber-500/10 text-amber-500">Reminder due</span>
  return <span className="pill bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">{days}d ago</span>
}

function LoanForm({ initial, onSave, onCancel }) {
  const [borrower, setBorrower] = useState(initial?.borrower || '')
  const [amount, setAmount] = useState(initial?.amount ?? '')
  const [dateLent, setDateLent] = useState(initial?.date_lent || todayISO())
  const [remindDays, setRemindDays] = useState(initial?.remind_every_days || 7)
  const [customDays, setCustomDays] = useState('')
  const [useCustom, setUseCustom] = useState(
    initial ? !REMIND_PRESETS.includes(initial.remind_every_days) : false
  )
  const [notes, setNotes] = useState(initial?.notes || '')
  const [deduct, setDeduct] = useState(initial?.deduct ?? true)
  const [saving, setSaving] = useState(false)
  const isEditing = !!initial

  const effectiveDays = useCustom ? (Number(customDays) || remindDays) : remindDays

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (useCustom && (!Number(customDays) || Number(customDays) < 1)) return
    setSaving(true)
    await onSave({
      borrower: borrower.trim(),
      amount: Number(amount),
      date_lent: dateLent,
      remind_every_days: effectiveDays,
      notes: notes.trim() || null,
      deduct,
    })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Borrower name *</label>
          <input
            type="text"
            required
            maxLength={60}
            className="input"
            placeholder="e.g. Juan dela Cruz"
            value={borrower}
            onChange={(e) => setBorrower(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Amount (₱) *</label>
          <input
            type="number"
            required
            min="1"
            step="0.01"
            className="input"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Date lent</label>
          <input
            type="date"
            required
            className="input"
            value={dateLent}
            onChange={(e) => setDateLent(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Remind me every</label>
          <select
            className="input"
            value={useCustom ? 'custom' : remindDays}
            onChange={(e) => {
              if (e.target.value === 'custom') {
                setUseCustom(true)
              } else {
                setUseCustom(false)
                setRemindDays(Number(e.target.value))
              }
            }}
          >
            {REMIND_PRESETS.map((d) => (
              <option key={d} value={d}>{d} days</option>
            ))}
            <option value="custom">Custom…</option>
          </select>
        </div>
        {useCustom && (
          <div>
            <label className="label">Custom interval (days)</label>
            <input
              type="number"
              required
              min="1"
              max="365"
              className="input"
              placeholder="e.g. 21"
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
            />
          </div>
        )}
        <div className={useCustom ? 'col-span-2' : ''}>
          <label className="label">Notes (optional)</label>
          <input
            type="text"
            maxLength={120}
            className="input"
            placeholder="What for, any context…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      {/* Deduct from money toggle — only on new loans (linked transactions
          make changing this after the fact ambiguous). */}
      {!isEditing ? (
        <label className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-emerald-500"
            checked={deduct}
            onChange={(e) => setDeduct(e.target.checked)}
          />
          <span className="text-sm">
            <span className="font-medium">Deduct from my money</span>
            <span className="block text-xs text-slate-500 mt-0.5">
              Records a <span className="font-medium">Loan</span> expense on the date lent so it lowers your
              available money. When marked paid, the amount is added back as income.
              Uncheck to just track it here without touching your transactions.
            </span>
          </span>
        </label>
      ) : (
        <p className="text-xs text-slate-500">
          {initial.deduct
            ? 'This loan is linked to your money — a Loan expense was recorded when lent.'
            : 'This loan is tracked here only and not part of your transactions.'}
        </p>
      )}

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

export default function Loans() {
  const { user } = useAuth()
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showSettled, setShowSettled] = useState(false)
  const [pushStatus, setPushStatus] = useState({ supported: false, subscribed: false })
  const [pushLoading, setPushLoading] = useState(false)
  const [pushMsg, setPushMsg] = useState('')

  const loadLoans = useCallback(async () => {
    const { data } = await supabase
      .from('loans')
      .select('*')
      .eq('user_id', user.id)
      .order('date_lent', { ascending: false })
    setLoans(data || [])
    setLoading(false)
  }, [user.id])

  const checkPushStatus = useCallback(async () => {
    const status = await getSubscriptionStatus(user.id)
    setPushStatus(status)
  }, [user.id])

  useEffect(() => {
    loadLoans()
    checkPushStatus()
  }, [loadLoans, checkPushStatus])

  const addLoan = async (fields) => {
    let lend_tx_id = null
    // If deducting, record a Loan expense on the date lent first.
    if (fields.deduct) {
      const { data: tx, error: txErr } = await supabase
        .from('transactions')
        .insert({
          date: fields.date_lent,
          category: LOAN_CATEGORY,
          income: 0,
          expense: fields.amount,
          notes: `Lent to ${fields.borrower}${fields.notes ? ` — ${fields.notes}` : ''}`,
          user_id: user.id,
        })
        .select('id')
        .single()
      if (txErr) { alert('Failed to record loan expense: ' + txErr.message); return }
      lend_tx_id = tx.id
    }

    const { error } = await supabase
      .from('loans')
      .insert({ ...fields, user_id: user.id, is_settled: false, lend_tx_id })
    if (error) {
      // Roll back the transaction we just created so we don't orphan it.
      if (lend_tx_id) await supabase.from('transactions').delete().eq('id', lend_tx_id)
      alert('Failed to save loan: ' + error.message)
      return
    }
    setShowAdd(false)
    loadLoans()
  }

  const updateLoan = async (id, fields) => {
    // `deduct` and the linked transactions are managed by add/settle/delete,
    // so don't let an edit silently change them — strip deduct from the update.
    const { deduct, ...safe } = fields
    const { error } = await supabase.from('loans').update(safe).eq('id', id).eq('user_id', user.id)
    if (!error) { setEditingId(null); loadLoans() }
  }

  const deleteLoan = async (loan) => {
    if (!confirm('Delete this loan record?')) return
    // Clean up any linked transactions (the money-out and any repayment).
    const txIds = [loan.lend_tx_id, loan.repay_tx_id].filter(Boolean)
    if (txIds.length) {
      await supabase.from('transactions').delete().in('id', txIds).eq('user_id', user.id)
    }
    await supabase.from('loans').delete().eq('id', loan.id).eq('user_id', user.id)
    loadLoans()
  }

  const settleLoan = async (loan) => {
    if (!confirm(`Mark loan to ${loan.borrower} as settled (paid back)?`)) return
    const settledAt = todayISO()
    let repay_tx_id = null
    // If this loan was deducted, add the money back as Loan income on settle date.
    if (loan.deduct) {
      const { data: tx, error: txErr } = await supabase
        .from('transactions')
        .insert({
          date: settledAt,
          category: LOAN_CATEGORY,
          income: loan.amount,
          expense: 0,
          notes: `Repaid by ${loan.borrower}`,
          user_id: user.id,
        })
        .select('id')
        .single()
      if (txErr) { alert('Failed to record repayment: ' + txErr.message); return }
      repay_tx_id = tx.id
    }
    const { error } = await supabase
      .from('loans')
      .update({ is_settled: true, settled_at: settledAt, repay_tx_id })
      .eq('id', loan.id).eq('user_id', user.id)
    if (error && repay_tx_id) {
      await supabase.from('transactions').delete().eq('id', repay_tx_id)
    }
    loadLoans()
  }

  const unsettleLoan = async (loan) => {
    // Remove the repayment income transaction if there was one.
    if (loan.repay_tx_id) {
      await supabase.from('transactions').delete().eq('id', loan.repay_tx_id).eq('user_id', user.id)
    }
    await supabase.from('loans')
      .update({ is_settled: false, settled_at: null, repay_tx_id: null })
      .eq('id', loan.id).eq('user_id', user.id)
    loadLoans()
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
        setPushMsg('Notifications enabled! You\'ll be reminded about outstanding loans.')
      }
      await checkPushStatus()
    } catch (err) {
      setPushMsg(err.message)
    }
    setPushLoading(false)
  }

  const activeLoans = loans.filter((l) => !l.is_settled)
  const settledLoans = loans.filter((l) => l.is_settled)
  const totalLent = activeLoans.reduce((s, l) => s + Number(l.amount), 0)

  const dueTodayLoans = activeLoans.filter((l) => {
    const days = daysSince(l.date_lent)
    return days > 0 && days % l.remind_every_days === 0
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loans</h1>
          <p className="text-sm text-slate-500">Track money you've lent out and get periodic reminders</p>
        </div>
        <button onClick={() => { setShowAdd(true); setEditingId(null) }} className="btn-primary">
          <Plus className="w-4 h-4" /> Add loan
        </button>
      </div>

      {/* Summary */}
      {activeLoans.length > 0 && (
        <div className="card flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
            <HandCoins className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Total outstanding</div>
            <div className="text-xl font-bold text-amber-500">{formatPeso(totalLent)}</div>
          </div>
          <div className="ml-auto text-xs text-slate-400">{activeLoans.length} active loan{activeLoans.length > 1 ? 's' : ''}</div>
        </div>
      )}

      {/* Push notification toggle */}
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
                  ? 'You\'ll receive periodic loan reminders'
                  : 'Enable to get reminders for outstanding loans'}
            </div>
            {pushMsg && <div className="text-xs mt-1 text-emerald-600 dark:text-emerald-400">{pushMsg}</div>}
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
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              pushStatus.subscribed ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        )}
      </div>

      {/* Reminder due alert */}
      {dueTodayLoans.length > 0 && (
        <div className="card border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 space-y-2">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-sm">
            <BellRing className="w-4 h-4" />
            {dueTodayLoans.length} loan reminder{dueTodayLoans.length > 1 ? 's' : ''} due today
          </div>
          {dueTodayLoans.map((l) => (
            <div key={l.id} className="flex justify-between text-sm">
              <span className="text-slate-700 dark:text-slate-300">{l.borrower}</span>
              <span className="text-amber-600 dark:text-amber-400 font-medium">{formatPeso(l.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Plus className="w-4 h-4 text-slate-400" /> New loan
          </h2>
          <LoanForm onSave={addLoan} onCancel={() => setShowAdd(false)} />
        </div>
      )}

      {/* Active loans */}
      {loading ? (
        <div className="text-sm text-slate-400 text-center py-8">Loading…</div>
      ) : activeLoans.length === 0 && !showAdd ? (
        <div className="card text-center py-10 space-y-2">
          <CalendarDays className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-slate-500 text-sm">No active loans. Add one to start tracking.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeLoans.map((loan) => (
            <div key={loan.id} className="card p-4 space-y-3">
              {editingId === loan.id ? (
                <>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Editing</p>
                  <LoanForm
                    initial={loan}
                    onSave={(fields) => updateLoan(loan.id, fields)}
                    onCancel={() => setEditingId(null)}
                  />
                </>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{loan.borrower}</span>
                      <LoanStatusBadge dateLent={loan.date_lent} remindEveryDays={loan.remind_every_days} />
                      {loan.deduct && (
                        <span className="pill bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 text-[10px]" title="Deducted from your money">
                          From wallet
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span className="font-semibold text-amber-500">{formatPeso(loan.amount)}</span>
                      <span>Lent {new Date(loan.date_lent + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span>Remind every {loan.remind_every_days}d</span>
                    </div>
                    {loan.notes && <div className="text-xs text-slate-400">{loan.notes}</div>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => settleLoan(loan)}
                      className="p-1.5 rounded text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10"
                      aria-label="Mark settled"
                      title="Mark as settled (paid back)"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { setEditingId(loan.id); setShowAdd(false) }}
                      className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                      aria-label="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteLoan(loan)}
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

      {/* Settled loans */}
      {settledLoans.length > 0 && (
        <div>
          <button
            onClick={() => setShowSettled((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 mb-2"
          >
            {showSettled ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {settledLoans.length} settled loan{settledLoans.length > 1 ? 's' : ''}
          </button>
          {showSettled && (
            <div className="space-y-2 opacity-60">
              {settledLoans.map((loan) => (
                <div key={loan.id} className="card p-4 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-sm font-medium line-through text-slate-400">{loan.borrower}</span>
                    <div className="text-xs text-slate-400">
                      {formatPeso(loan.amount)}
                      {loan.settled_at && ` · Settled ${new Date(loan.settled_at + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => unsettleLoan(loan)}
                      className="p-1.5 rounded text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                      aria-label="Mark unsettled"
                      title="Mark as unsettled"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteLoan(loan)}
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
