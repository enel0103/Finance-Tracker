import { useEffect, useMemo, useState, useRef } from 'react'
import { Wallet, Pencil, Check, X, Sparkles, RotateCcw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatPeso, monthRange } from '../lib/utils'
import { CATEGORY_BG, isIncomeCategory } from '../lib/constants'
import MonthSelector from '../components/MonthSelector.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useCategories } from '../contexts/CategoriesContext.jsx'
import { useConfirm } from '../contexts/ConfirmContext.jsx'

// Suggested allocation ratios (of total monthly income)
const SUGGESTIONS = {
  Food:           0.15,
  Bills:          0.20,
  Subscriptions:  0.03,
  Gym:            0.02,
  Investments:    0.10,
  Savings:        0.10,
  'Emergency Fund': 0.05,
  'Future Wants': 0.10,
  Misc:           0.05,
}

export default function BudgetPlan() {
  const { user } = useAuth()
  const { allIncome, allExpense } = useCategories()
  const { confirm, notify } = useConfirm()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [budgets, setBudgets] = useState([])
  const [actuals, setActuals] = useState({})
  const [loading, setLoading] = useState(true)
  const [editingCat, setEditingCat] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const inputRef = useRef(null)

  const load = async () => {
    setLoading(true)
    const { start, end } = monthRange(year, month)
    const [bRes, tRes] = await Promise.all([
      supabase.from('budget').select('*').eq('user_id', user.id),
      supabase.from('transactions').select('*').gte('date', start).lt('date', end)
    ])
    if (!bRes.error) setBudgets(bRes.data || [])
    if (!tRes.error) {
      const map = {}
      ;(tRes.data || []).forEach((t) => {
        const cat = t.category || 'Misc'
        if (!map[cat]) map[cat] = { income: 0, expense: 0 }
        map[cat].income += Number(t.income) || 0
        map[cat].expense += Number(t.expense) || 0
      })
      setActuals(map)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [year, month])

  const getBudgeted = (cat) => Number(budgets.find((b) => b.category === cat)?.amount) || 0

  const startEdit = (cat) => {
    setEditingCat(cat)
    setEditValue(String(getBudgeted(cat) || ''))
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const cancelEdit = () => { setEditingCat(null); setEditValue('') }

  const saveEdit = async (cat) => {
    const amt = Number(editValue) || 0
    setSaving(true)
    const { error } = await supabase
      .from('budget')
      .upsert({ category: cat, amount: amt, user_id: user.id }, { onConflict: 'user_id,category' })
    setSaving(false)
    if (!error) {
      setBudgets((prev) => {
        const exists = prev.some((b) => b.category === cat)
        if (exists) return prev.map((b) => b.category === cat ? { ...b, amount: amt } : b)
        return [...prev, { category: cat, amount: amt, user_id: user.id }]
      })
    }
    setEditingCat(null)
  }

  const handleKeyDown = (e, cat) => {
    if (e.key === 'Enter') saveEdit(cat)
    if (e.key === 'Escape') cancelEdit()
  }

  // Apply suggested distribution based on total income budget
  const applySuggestions = async () => {
    const totalIncome = allIncome.reduce((sum, cat) => sum + getBudgeted(cat), 0)
    if (!totalIncome) {
      await notify({
        title: 'Set income first',
        message: 'Set your income target first (e.g. Salary), then tap Suggest.',
      })
      return
    }
    setSuggesting(true)

    for (const cat of allExpense.filter((c) => SUGGESTIONS[c] !== undefined)) {
      const amt = Math.round(totalIncome * SUGGESTIONS[cat])
      await supabase
        .from('budget')
        .upsert({ category: cat, amount: amt, user_id: user.id }, { onConflict: 'user_id,category' })
    }
    await load()
    setSuggesting(false)
  }

  const clearAll = async () => {
    const ok = await confirm({
      title: 'Reset budget?',
      message: 'This will set all budget amounts back to zero.',
      confirmText: 'Reset',
      tone: 'danger',
    })
    if (!ok) return
    await supabase.from('budget').delete().eq('user_id', user.id)
    setBudgets([])
  }

  const allCategories = useMemo(() => {
    return [...allIncome, ...allExpense].map((cat) => {
      const isIncome = isIncomeCategory(cat) || allIncome.includes(cat)
      const actual = isIncome
        ? actuals[cat]?.income || 0
        : actuals[cat]?.expense || 0
      const budgeted = getBudgeted(cat)
      const pct = budgeted > 0 ? (actual / budgeted) * 100 : 0
      return { cat, isIncome, budgeted, actual, pct }
    })
  }, [budgets, actuals, allIncome, allExpense])

  const incomeRows = allCategories.filter((r) => r.isIncome)
  const expenseRows = allCategories.filter((r) => !r.isIncome)

  const totalIncomeBudget = incomeRows.reduce((s, r) => s + r.budgeted, 0)
  const totalExpenseBudget = expenseRows.reduce((s, r) => s + r.budgeted, 0)
  const allocatedPct = totalIncomeBudget > 0
    ? Math.min(100, (totalExpenseBudget / totalIncomeBudget) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budget Plan</h1>
          <p className="text-sm text-slate-500">Set monthly targets and track how you're doing</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
        </div>
      </div>

      {/* Suggestion banner */}
      <div className="card flex flex-wrap items-center justify-between gap-3 bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-800">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Smart budget suggestions</div>
            <div className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
              Set your income target first, then tap Suggest — we'll fill in a sensible split
              (50% needs · 20% savings/invest · 30% wants).
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={applySuggestions}
            disabled={suggesting}
            className="btn bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {suggesting ? 'Applying…' : 'Suggest'}
          </button>
          <button onClick={clearAll} className="btn-ghost text-sm" title="Reset all to zero">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Allocation summary */}
      {totalIncomeBudget > 0 && (
        <div className="card space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Budget allocated</span>
            <span className="font-medium">
              {formatPeso(totalExpenseBudget)}
              <span className="text-slate-400"> / {formatPeso(totalIncomeBudget)}</span>
              <span className={`ml-2 text-xs ${allocatedPct > 100 ? 'text-expense' : 'text-slate-400'}`}>
                ({allocatedPct.toFixed(0)}%)
              </span>
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all ${allocatedPct > 100 ? 'bg-expense' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, allocatedPct)}%` }}
            />
          </div>
          {allocatedPct > 100 && (
            <p className="text-xs text-expense">Your expense budgets exceed your income target.</p>
          )}
        </div>
      )}

      {loading ? (
        <div className="card text-sm text-slate-500">Loading…</div>
      ) : (
        <>
          <BudgetSection
            title="Income Targets"
            rows={incomeRows}
            editingCat={editingCat}
            editValue={editValue}
            saving={saving}
            inputRef={inputRef}
            onEdit={startEdit}
            onCancel={cancelEdit}
            onSave={saveEdit}
            onKeyDown={handleKeyDown}
            onEditValue={setEditValue}
          />
          <BudgetSection
            title="Expense Budgets"
            rows={expenseRows}
            editingCat={editingCat}
            editValue={editValue}
            saving={saving}
            inputRef={inputRef}
            onEdit={startEdit}
            onCancel={cancelEdit}
            onSave={saveEdit}
            onKeyDown={handleKeyDown}
            onEditValue={setEditValue}
          />
        </>
      )}
      <p className="text-xs text-slate-400 text-center">
        Click the pencil icon on any row to set a budget amount.
      </p>
    </div>
  )
}

function BudgetSection({ title, rows, editingCat, editValue, saving, inputRef,
  onEdit, onCancel, onSave, onKeyDown, onEditValue }) {
  return (
    <div className="card">
      <h2 className="font-semibold mb-4 flex items-center gap-2">
        <Wallet className="w-4 h-4 text-slate-400" />
        {title}
      </h2>
      <ul className="space-y-4">
        {rows.map((r) => {
          const isEditing = editingCat === r.cat
          const over = !r.isIncome && r.budgeted > 0 && r.actual > r.budgeted
          const incomeOver = r.isIncome && r.actual >= r.budgeted && r.budgeted > 0
          const remaining = r.budgeted - r.actual
          const barPct = Math.min(100, r.pct)

          let barColor = 'bg-slate-300 dark:bg-slate-700'
          if (r.budgeted > 0) {
            if (r.isIncome) barColor = 'bg-income'
            else if (over) barColor = 'bg-expense'
            else if (r.pct > 80) barColor = 'bg-amber-400'
            else barColor = 'bg-emerald-500'
          }

          return (
            <li key={r.cat}>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`pill flex-shrink-0 ${CATEGORY_BG[r.cat] || 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>
                    {r.cat}
                  </span>
                  {r.budgeted > 0 && !isEditing && (
                    <span className={`pill text-[10px] flex-shrink-0 ${
                      over ? 'bg-expense/15 text-expense'
                      : incomeOver ? 'bg-income/15 text-income'
                      : r.budgeted > 0 ? 'bg-emerald-500/15 text-emerald-500'
                      : 'bg-slate-500/15 text-slate-500'
                    }`}>
                      {r.isIncome
                        ? incomeOver ? 'Goal hit' : `${r.pct.toFixed(0)}%`
                        : over ? `Over ${formatPeso(r.actual - r.budgeted)}`
                        : `${r.pct.toFixed(0)}% used`}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isEditing ? (
                    <>
                      <span className="text-xs text-slate-400">₱</span>
                      <input
                        ref={inputRef}
                        type="number"
                        min="0"
                        step="1"
                        className="input !py-1 !text-sm w-32 text-right"
                        value={editValue}
                        onChange={(e) => onEditValue(e.target.value)}
                        onKeyDown={(e) => onKeyDown(e, r.cat)}
                        autoFocus
                      />
                      <button
                        onClick={() => onSave(r.cat)}
                        disabled={saving}
                        className="p-1.5 rounded text-emerald-500 hover:bg-emerald-500/10"
                        aria-label="Save"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={onCancel}
                        className="p-1.5 rounded text-slate-400 hover:bg-slate-500/10"
                        aria-label="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm">
                        <span className="font-semibold">{formatPeso(r.actual)}</span>
                        <span className="text-slate-400"> / {r.budgeted > 0 ? formatPeso(r.budgeted) : <span className="italic text-slate-400 text-xs">not set</span>}</span>
                      </span>
                      <button
                        onClick={() => onEdit(r.cat)}
                        className="p-1.5 rounded text-slate-300 hover:text-emerald-500 hover:bg-emerald-500/10 dark:text-slate-600"
                        aria-label={`Edit ${r.cat} budget`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div className={`h-full ${barColor} transition-all`} style={{ width: `${barPct}%` }} />
              </div>

              {r.budgeted > 0 && !r.isIncome && !isEditing && (
                <div className={`text-xs mt-1 ${over ? 'text-expense' : 'text-slate-500'}`}>
                  {over
                    ? `Over budget by ${formatPeso(r.actual - r.budgeted)}`
                    : `${formatPeso(remaining)} remaining`}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
