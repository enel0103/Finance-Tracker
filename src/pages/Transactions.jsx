import { useEffect, useState } from 'react'
import { Plus, Trash2, Receipt, Pencil, Check, X, Tags, Settings2, RotateCcw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatPeso, monthRange, todayISO } from '../lib/utils'
import {
  CATEGORY_BG,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PROTECTED_CATEGORIES
} from '../lib/constants'
import MonthSelector from '../components/MonthSelector.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useCategories } from '../contexts/CategoriesContext.jsx'

export default function Transactions() {
  const { user } = useAuth()
  const { allIncome, allExpense, custom, deleted, addCategory, removeCategory, deleteDefault, restoreDefault } = useCategories()
  const isIncomeCat = (cat) => allIncome.includes(cat)
  const now = new Date()
  const [showManage, setShowManage] = useState(false)
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [txs, setTxs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    date: todayISO(),
    category: 'Salary',
    amount: '',
    notes: ''
  })
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState({
    date: '',
    category: '',
    amount: '',
    notes: ''
  })
  const [savingEdit, setSavingEdit] = useState(false)

  const defaultDateForSelectedMonth = (selectedYear = year, selectedMonth = month) => {
    const current = new Date()
    if (
      selectedYear === current.getFullYear() &&
      selectedMonth === current.getMonth()
    ) {
      return todayISO()
    }
    return `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
  }

  const load = async () => {
    setLoading(true)
    const { start, end } = monthRange(year, month)
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .gte('date', start)
      .lt('date', end)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    if (!error) setTxs(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [year, month])

  useEffect(() => {
    if (!showForm) return
    setForm((prev) => ({
      ...prev,
      date: defaultDateForSelectedMonth()
    }))
  }, [year, month, showForm])

  const handleAdd = async (e) => {
    e.preventDefault()
    const amt = Number(form.amount)
    if (!amt || amt <= 0 || !form.category || !form.date) return

    setSaving(true)
    const isIncome = isIncomeCat(form.category)
    const row = {
      date: form.date,
      category: form.category,
      income: isIncome ? amt : 0,
      expense: isIncome ? 0 : amt,
      notes: form.notes || null,
      user_id: user.id
    }
    const { error } = await supabase.from('transactions').insert(row)
    setSaving(false)

    if (error) {
      alert('Failed to add: ' + error.message)
      return
    }

    setForm({
      date: defaultDateForSelectedMonth(),
      category: form.category,
      amount: '',
      notes: ''
    })
    setShowForm(false)
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this transaction?')) return
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) {
      alert('Failed to delete: ' + error.message)
      return
    }
    load()
  }

  const startEdit = (t) => {
    const isIncome = Number(t.income) > 0
    setEditingId(t.id)
    setEditDraft({
      date: t.date,
      category: t.category || 'Misc',
      amount: String(isIncome ? t.income : t.expense),
      notes: t.notes || ''
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveEdit = async (id) => {
    const amt = Number(editDraft.amount)
    if (!amt || amt <= 0 || !editDraft.category || !editDraft.date) return

    setSavingEdit(true)
    const isIncome = isIncomeCat(editDraft.category)
    const update = {
      date: editDraft.date,
      category: editDraft.category,
      income: isIncome ? amt : 0,
      expense: isIncome ? 0 : amt,
      notes: editDraft.notes || null
    }
    const { error } = await supabase.from('transactions').update(update).eq('id', id)
    setSavingEdit(false)

    if (error) {
      alert('Failed to update: ' + error.message)
      return
    }
    setEditingId(null)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-slate-500">All income and expenses for the selected month</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthSelector
            year={year}
            month={month}
            onChange={(y, m) => { setYear(y); setMonth(m) }}
          />
          <button
            onClick={() => setShowManage((v) => !v)}
            className="btn-ghost"
            title="Manage categories"
          >
            <Tags className="w-4 h-4" />
            <span className="hidden sm:inline">Categories</span>
          </button>
          <button
            onClick={() => {
              setForm((prev) => ({
                ...prev,
                date: defaultDateForSelectedMonth()
              }))
              setShowForm((v) => !v)
            }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>
      </div>

      {showManage && (
        <ManageCategories
          custom={custom}
          deleted={deleted}
          addCategory={addCategory}
          removeCategory={removeCategory}
          deleteDefault={deleteDefault}
          restoreDefault={restoreDefault}
          onClose={() => setShowManage(false)}
        />
      )}

      {showForm && (
        <form onSubmit={handleAdd} className="card space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                required
                className="input"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Category</label>
              <CategorySelect
                value={form.category}
                onChange={(v) => setForm({ ...form, category: v })}
                incomeList={allIncome}
                expenseList={allExpense}
              />
            </div>
            <div>
              <label className="label">Amount (₱)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                className="input"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Notes</label>
              <input
                type="text"
                placeholder="Optional"
                className="input"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save Transaction'}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading…</div>
        ) : txs.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-10 h-10 mx-auto text-slate-400 mb-3" />
            <p className="font-medium">No transactions for this month</p>
            <p className="text-sm text-slate-500 mt-1">Click "Add" above to record your first one.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Category</th>
                    <th className="text-right px-4 py-3 font-medium">Income</th>
                    <th className="text-right px-4 py-3 font-medium">Expense</th>
                    <th className="text-left px-4 py-3 font-medium">Notes</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {txs.map((t) => {
                    if (editingId === t.id) {
                      const draftIsIncome = isIncomeCat(editDraft.category)
                      return (
                        <tr key={t.id} className="bg-emerald-50/40 dark:bg-emerald-500/5">
                          <td className="px-4 py-2">
                            <input
                              type="date"
                              className="input !py-1 !text-sm"
                              value={editDraft.date}
                              onChange={(e) => setEditDraft({ ...editDraft, date: e.target.value })}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <CategorySelect
                              value={editDraft.category}
                              onChange={(v) => setEditDraft({ ...editDraft, category: v })}
                              compact
                              incomeList={allIncome}
                              expenseList={allExpense}
                            />
                          </td>
                          <td className="px-4 py-2" colSpan={2}>
                            <div className="flex items-center gap-2 justify-end">
                              <span className={`text-xs ${draftIsIncome ? 'text-income' : 'text-expense'}`}>
                                {draftIsIncome ? 'Income' : 'Expense'}
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="input !py-1 !text-sm w-32 text-right"
                                value={editDraft.amount}
                                onChange={(e) => setEditDraft({ ...editDraft, amount: e.target.value })}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              placeholder="Notes"
                              className="input !py-1 !text-sm"
                              value={editDraft.notes}
                              onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })}
                            />
                          </td>
                          <td className="px-4 py-2 text-right whitespace-nowrap">
                            <button
                              onClick={() => saveEdit(t.id)}
                              disabled={savingEdit}
                              className="p-1.5 rounded text-emerald-500 hover:bg-emerald-500/10"
                              aria-label="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1.5 rounded text-slate-400 hover:bg-slate-500/10"
                              aria-label="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    }
                    return (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {new Date(t.date).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric'
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`pill ${CATEGORY_BG[t.category] || 'bg-slate-200 text-slate-700'}`}>
                            {t.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-income font-medium">
                          {Number(t.income) > 0 ? formatPeso(t.income) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-expense font-medium">
                          {Number(t.expense) > 0 ? formatPeso(t.expense) : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                          {t.notes || '—'}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => startEdit(t)}
                            className="p-1.5 rounded text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10"
                            aria-label="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="p-1.5 rounded text-slate-400 hover:text-expense hover:bg-expense/10"
                            aria-label="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <ul className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
              {txs.map((t) => {
                if (editingId === t.id) {
                  return (
                    <li key={t.id} className="p-4 space-y-3 bg-emerald-50/40 dark:bg-emerald-500/5">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="label">Date</label>
                          <input
                            type="date"
                            className="input"
                            value={editDraft.date}
                            onChange={(e) => setEditDraft({ ...editDraft, date: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="label">Amount</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="input"
                            value={editDraft.amount}
                            onChange={(e) => setEditDraft({ ...editDraft, amount: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="label">Category</label>
                        <CategorySelect
                          value={editDraft.category}
                          onChange={(v) => setEditDraft({ ...editDraft, category: v })}
                          incomeList={allIncome}
                          expenseList={allExpense}
                        />
                      </div>
                      <div>
                        <label className="label">Notes</label>
                        <input
                          type="text"
                          className="input"
                          value={editDraft.notes}
                          onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })}
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button onClick={cancelEdit} className="btn-ghost">Cancel</button>
                        <button
                          onClick={() => saveEdit(t.id)}
                          disabled={savingEdit}
                          className="btn-primary"
                        >
                          {savingEdit ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </li>
                  )
                }
                const isIncome = Number(t.income) > 0
                return (
                  <li key={t.id} className="p-4 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`pill ${CATEGORY_BG[t.category] || 'bg-slate-200 text-slate-700'}`}>
                          {t.category}
                        </span>
                        <span className={`font-semibold text-sm ${isIncome ? 'text-income' : 'text-expense'}`}>
                          {isIncome ? '+' : '-'}{formatPeso(isIncome ? t.income : t.expense)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-500">
                        <span>
                          {new Date(t.date).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric'
                          })}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEdit(t)}
                            className="p-1 rounded text-slate-400 hover:text-emerald-500"
                            aria-label="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="p-1 rounded text-slate-400 hover:text-expense"
                            aria-label="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {t.notes && (
                        <div className="text-xs text-slate-500 mt-1 truncate">{t.notes}</div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

function ManageCategories({ custom, deleted, addCategory, removeCategory, deleteDefault, restoreDefault, onClose }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('expense')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    const res = await addCategory(name, type)
    setSaving(false)
    if (!res.ok) { setError(res.error); return }
    setName('')
  }

  // Build full lists: defaults (active + hidden) + custom
  const defaultIncome = INCOME_CATEGORIES.map((n) => ({ name: n, type: 'income', isDefault: true, hidden: deleted.includes(n) }))
  const defaultExpense = EXPENSE_CATEGORIES.map((n) => ({ name: n, type: 'expense', isDefault: true, hidden: deleted.includes(n) }))
  const customIncome = custom.filter((c) => c.type === 'income').map((c) => ({ ...c, isDefault: false, hidden: false }))
  const customExpense = custom.filter((c) => c.type === 'expense').map((c) => ({ ...c, isDefault: false, hidden: false }))

  const incomeItems = [...defaultIncome, ...customIncome]
  const expenseItems = [...defaultExpense, ...customExpense]

  const handleRemove = (item) => {
    const msg = item.isDefault
      ? `Hide "${item.name}"? It won't appear in dropdowns anymore. You can restore it later.`
      : `Remove "${item.name}"? Existing transactions keep the label but it won't appear in the dropdown.`
    if (!confirm(msg)) return
    item.isDefault ? deleteDefault(item.name) : removeCategory(item.name)
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-slate-400" />
          <h2 className="font-semibold">Manage categories</h2>
        </div>
        <button onClick={onClose} className="btn-ghost !p-2" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Protected categories (Salary, Food, Bills, etc.) can't be removed. Others can be hidden or deleted.
        Hidden defaults can be restored with the <RotateCcw className="inline w-3 h-3" /> button.
      </p>

      <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
        <input
          type="text"
          required
          maxLength={32}
          placeholder="New category name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select className="input sm:w-36" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <button type="submit" disabled={saving} className="btn-primary">
          <Plus className="w-4 h-4" /> Add
        </button>
      </form>

      {error && <div className="text-sm text-expense bg-expense/10 px-3 py-2 rounded-lg">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CategoryColumn title="Income" items={incomeItems} onRemove={handleRemove} onRestore={restoreDefault} tone="income" />
        <CategoryColumn title="Expenses" items={expenseItems} onRemove={handleRemove} onRestore={restoreDefault} tone="expense" />
      </div>
    </div>
  )
}

function CategoryColumn({ title, items, onRemove, onRestore, tone }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((c) => {
          const isProtected = PROTECTED_CATEGORIES.has(c.name)
          return (
            <li
              key={c.name}
              className={`flex items-center justify-between rounded-lg px-3 py-1.5 ${
                c.hidden
                  ? 'bg-slate-50 dark:bg-slate-800/30 opacity-50'
                  : 'bg-slate-100 dark:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`text-sm truncate ${c.hidden ? 'line-through text-slate-400' : tone === 'income' ? 'text-income' : 'text-expense'}`}>
                  {c.name}
                </span>
                {isProtected && (
                  <span className="text-[9px] text-slate-400 border border-slate-300 dark:border-slate-600 rounded px-1">lock</span>
                )}
                {!c.isDefault && (
                  <span className="text-[9px] text-slate-400 border border-slate-300 dark:border-slate-600 rounded px-1">custom</span>
                )}
              </div>
              {c.hidden ? (
                <button
                  onClick={() => onRestore(c.name)}
                  className="p-1 rounded text-slate-400 hover:text-emerald-500"
                  aria-label={`Restore ${c.name}`}
                  title="Restore"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              ) : !isProtected ? (
                <button
                  onClick={() => onRemove(c)}
                  className="p-1 rounded text-slate-400 hover:text-expense"
                  aria-label={`Remove ${c.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              ) : (
                <div className="w-6" />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function CategorySelect({ value, onChange, compact, incomeList, expenseList }) {
  const income = incomeList || INCOME_CATEGORIES
  const expense = expenseList || EXPENSE_CATEGORIES
  return (
    <select
      className={`input ${compact ? '!py-1 !text-sm' : ''}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <optgroup label="Income">
        {income.map((c) => <option key={c}>{c}</option>)}
      </optgroup>
      <optgroup label="Expenses">
        {expense.map((c) => <option key={c}>{c}</option>)}
      </optgroup>
    </select>
  )
}
