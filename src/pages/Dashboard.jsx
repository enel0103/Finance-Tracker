import { useEffect, useMemo, useRef, useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Target,
  Pencil,
  Check,
  X,
  PiggyBank,
  PlusCircle,
  Layers
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatPeso, monthRange, todayISO } from '../lib/utils'
import {
  BUFFER_CARRYOVER_CATEGORY,
  CARRYOVER_INCOME_CATEGORIES,
  CATEGORY_BG,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES
} from '../lib/constants'
import MonthSelector from '../components/MonthSelector.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useCategories } from '../contexts/CategoriesContext.jsx'
import { useConfirm } from '../contexts/ConfirmContext.jsx'

// Single source of truth for the carryover/buffer math.
//
// "Wallet" model: the amount you can carry into a new month is simply how much
// money was physically left at the end of your most recent month with activity
// — that month's (all income, including money carried in) minus its expenses.
// You can't carry more than that, and you can't double-pull what you've already
// claimed into the selected month. Money carried forward but left unspent stays
// preserved (it becomes income that's still sitting there), so it never
// multiplies and never silently shrinks.
function computeBufferSummary(allTxs, year, month) {
  const selectedIndex = year * 12 + month
  const map = new Map()

  allTxs.forEach((t) => {
    const d = new Date(`${t.date}T00:00:00`)
    const idx = d.getFullYear() * 12 + d.getMonth()
    if (!map.has(idx)) map.set(idx, { index: idx, income: 0, expense: 0, claimedIn: 0 })
    const stat = map.get(idx)
    const income = Number(t.income) || 0
    const expense = Number(t.expense) || 0
    stat.income += income
    stat.expense += expense
    if (income > 0 && CARRYOVER_INCOME_CATEGORIES.includes(t.category)) {
      stat.claimedIn += income
    }
  })

  const selected = map.get(selectedIndex)
  const selectedClaimed = selected ? selected.claimedIn : 0
  // Newly generated buffer this month = regular income (excluding carried-in) − expenses.
  const selectedGenerated = selected
    ? (selected.income - selected.claimedIn) - selected.expense
    : 0

  // The most recent past month that actually had transactions.
  const pastMonths = [...map.values()]
    .filter((s) => s.index < selectedIndex)
    .sort((a, b) => b.index - a.index)
  const lastPast = pastMonths[0]
  // What was physically left at the end of that month.
  const lastRemaining = lastPast ? lastPast.income - lastPast.expense : 0
  // Can't pull more than what's left, minus whatever was already pulled in here.
  const availableFromPast = Math.max(0, lastRemaining - selectedClaimed)

  return {
    availableFromPast,
    // Your real current leftover = the latest month's remaining money. If the
    // selected month already has activity, use its own remaining; otherwise the
    // last active month's.
    allTimeAvailable: selected
      ? selected.income - selected.expense
      : Math.max(0, lastRemaining),
    selectedGenerated,
    selectedClaimed
  }
}

export default function Dashboard() {
  const { user } = useAuth()
  const { notify } = useConfirm()
  const { allIncome, allExpense } = useCategories()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [txs, setTxs] = useState([])
  const [allTxs, setAllTxs] = useState([])
  const [loading, setLoading] = useState(true)
  const [carryDraft, setCarryDraft] = useState('')
  const [savingCarry, setSavingCarry] = useState(false)
  const claimingRef = useRef(false)

  const [efBase, setEfBase] = useState(0)
  const [efTarget, setEfTarget] = useState(0)
  const [efDeposits, setEfDeposits] = useState(0)
  const [editingEf, setEditingEf] = useState(false)
  const [efDraft, setEfDraft] = useState({ base: '', target: '' })

  const loadTxs = async () => {
    setLoading(true)
    const { start, end } = monthRange(year, month)
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .gte('date', start)
      .lt('date', end)
      .order('date', { ascending: false })
    if (!error) setTxs(data || [])
    setLoading(false)
  }

  const loadAllTxs = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
    if (!error) setAllTxs(data || [])
  }

  const loadEfDeposits = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('expense')
      .eq('category', 'Emergency Fund')
    if (!error) {
      const sum = (data || []).reduce((s, t) => s + (Number(t.expense) || 0), 0)
      setEfDeposits(sum)
    }
  }

  const loadSettings = async () => {
    const { data } = await supabase
      .from('settings')
      .select('*')
      .in('key', ['emergency_fund_current', 'emergency_fund_target'])
    if (data) {
      const cur = data.find((d) => d.key === 'emergency_fund_current')
      const tgt = data.find((d) => d.key === 'emergency_fund_target')
      setEfBase(Number(cur?.value || 0))
      setEfTarget(Number(tgt?.value || 0))
    }
  }

  useEffect(() => {
    loadTxs()
    loadEfDeposits()
  }, [year, month])

  useEffect(() => {
    loadAllTxs()
    loadSettings()
  }, [])

  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    const byCategory = {}
    txs.forEach((t) => {
      const inc = Number(t.income) || 0
      const exp = Number(t.expense) || 0
      income += inc
      expense += exp
      const cat = t.category || 'Misc'
      if (!byCategory[cat]) byCategory[cat] = { income: 0, expense: 0 }
      byCategory[cat].income += inc
      byCategory[cat].expense += exp
    })
    const carryoverIncome = CARRYOVER_INCOME_CATEGORIES.reduce(
      (sum, cat) => sum + (byCategory[cat]?.income || 0),
      0
    )
    const regularIncome = income - carryoverIncome
    const availableMoney = regularIncome + carryoverIncome
    const newBuffer = regularIncome - expense
    return {
      income,
      regularIncome,
      carryoverIncome,
      availableMoney,
      expense,
      net: availableMoney - expense,
      newBuffer,
      byCategory
    }
  }, [txs])

  const bufferSummary = useMemo(
    () => computeBufferSummary(allTxs, year, month),
    [allTxs, year, month]
  )

  useEffect(() => {
    const amount = Math.max(0, bufferSummary.availableFromPast)
    setCarryDraft(amount > 0 ? amount.toFixed(2) : '')
  }, [bufferSummary.availableFromPast, year, month])

  // Include carryover/system categories so claimed-buffer income still shows up.
  const incomeCategoriesForDisplay = [
    ...allIncome,
    ...CARRYOVER_INCOME_CATEGORIES.filter((c) => !allIncome.includes(c))
  ]
  const incomeRows = incomeCategoriesForDisplay.map((c) => ({
    cat: c,
    amount: totals.byCategory[c]?.income || 0
  })).filter((r) => r.amount > 0)

  const expenseRows = allExpense.map((c) => ({
    cat: c,
    amount: totals.byCategory[c]?.expense || 0
  })).filter((r) => r.amount > 0)

  const efCurrent = efBase + efDeposits
  const efPercent = efTarget > 0 ? Math.min(100, (efCurrent / efTarget) * 100) : 0
  const efThisMonth = totals.byCategory['Emergency Fund']?.expense || 0

  const saveCarryover = async (e) => {
    e.preventDefault()
    // Hard lock: ignore rapid repeat clicks while a claim is already running.
    if (claimingRef.current) return

    const amount = Number(carryDraft)
    if (!amount || amount <= 0) return

    claimingRef.current = true
    setSavingCarry(true)
    try {
      // Re-validate against FRESH data, not the (possibly stale) in-memory
      // summary — this is what makes spamming the button safe. We recompute
      // the true unclaimed leftover from the latest transactions right now.
      const { data: fresh, error: fetchErr } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
      if (fetchErr) { await notify({ title: 'Something went wrong', message: 'Could not verify buffer: ' + fetchErr.message, tone: 'danger' }); return }

      const available = computeBufferSummary(fresh || [], year, month).availableFromPast
      if (amount > available + 0.009) {
        await notify({
          title: 'Amount too high',
          message: `You can only add up to ${formatPeso(available)} from your past buffer.`,
        })
        setCarryDraft(available > 0 ? available.toFixed(2) : '')
        await Promise.all([loadTxs(), loadAllTxs()])
        return
      }

      const current = new Date()
      const date = current.getFullYear() === year && current.getMonth() === month
        ? todayISO()
        : `${year}-${String(month + 1).padStart(2, '0')}-01`

      const { error } = await supabase.from('transactions').insert({
        date,
        category: BUFFER_CARRYOVER_CATEGORY,
        income: amount,
        expense: 0,
        notes: 'Added from previous month buffers',
        user_id: user.id
      })
      if (error) {
        await notify({ title: 'Something went wrong', message: 'Failed to add buffer: ' + error.message, tone: 'danger' })
        return
      }
    } finally {
      setSavingCarry(false)
      claimingRef.current = false
    }

    await Promise.all([loadTxs(), loadAllTxs()])
  }

  const startEditEf = () => {
    setEfDraft({ base: String(efBase), target: String(efTarget) })
    setEditingEf(true)
  }
  const saveEf = async () => {
    const base = Number(efDraft.base) || 0
    const tgt = Number(efDraft.target) || 0
    await Promise.all([
      supabase.from('settings').upsert(
        { key: 'emergency_fund_current', value: String(base), user_id: user.id },
        { onConflict: 'user_id,key' }
      ),
      supabase.from('settings').upsert(
        { key: 'emergency_fund_target', value: String(tgt), user_id: user.id },
        { onConflict: 'user_id,key' }
      )
    ])
    setEfBase(base)
    setEfTarget(tgt)
    setEditingEf(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500">Monthly overview of your finances</p>
        </div>
        <MonthSelector
          year={year}
          month={month}
          onChange={(y, m) => { setYear(y); setMonth(m) }}
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Income"
          sublabel="New money earned"
          value={totals.regularIncome}
          icon={<TrendingUp className="w-5 h-5" />}
          accent="text-income bg-income/10"
        />
        <SummaryCard
          label="Available"
          sublabel="Income + carried-over buffer"
          value={totals.availableMoney}
          icon={<Wallet className="w-5 h-5" />}
          accent="text-savings bg-savings/10"
        />
        <SummaryCard
          label="Expenses"
          sublabel="Total spent this month"
          value={totals.expense}
          icon={<TrendingDown className="w-5 h-5" />}
          accent="text-expense bg-expense/10"
        />
        <SummaryCard
          label="Buffer"
          sublabel="Available − Expenses (remaining)"
          value={totals.net}
          icon={<PiggyBank className="w-5 h-5" />}
          accent={totals.net >= 0 ? 'text-emerald-500 bg-emerald-500/10' : 'text-expense bg-expense/10'}
          highlight
        />
      </div>

      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold">Overall Buffer</h2>
              <p className="text-sm text-slate-500">
                Past leftover money that has not been added into a later month yet.
              </p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                <BufferStat
                  label="Available from past"
                  value={bufferSummary.availableFromPast}
                  strong
                />
                <BufferStat
                  label="Last month's leftover"
                  value={bufferSummary.allTimeAvailable}
                />
                <BufferStat
                  label="Added this month"
                  value={bufferSummary.selectedClaimed}
                />
                <BufferStat
                  label="Usable this month"
                  value={totals.availableMoney}
                />
              </div>
            </div>
          </div>

          <form onSubmit={saveCarryover} className="w-full lg:w-auto">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
              <div>
                <label className="label">Add past buffer</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  value={carryDraft}
                  onChange={(e) => setCarryDraft(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={savingCarry || bufferSummary.availableFromPast <= 0}
                  className="btn-primary w-full sm:w-auto"
                >
                  <PlusCircle className="w-4 h-4" />
                  {savingCarry ? 'Adding...' : 'Add to month'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* By category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryList title="Income by Category" rows={incomeRows} loading={loading} type="income" />
        <CategoryList title="Expenses by Category" rows={expenseRows} loading={loading} type="expense" />
      </div>

      {/* Emergency Fund */}
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold">Emergency Fund</h2>
              <p className="text-xs text-slate-500">
                Add money via the <span className="font-medium">Emergency Fund</span> category in Transactions
              </p>
            </div>
          </div>
          {!editingEf ? (
            <button onClick={startEditEf} className="btn-ghost !p-2" aria-label="Edit base & target">
              <Pencil className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={saveEf} className="btn-ghost !p-2 text-emerald-500" aria-label="Save">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => setEditingEf(false)} className="btn-ghost !p-2 text-slate-500" aria-label="Cancel">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {editingEf ? (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="label">Starting balance</label>
              <input
                type="number"
                className="input"
                value={efDraft.base}
                onChange={(e) => setEfDraft({ ...efDraft, base: e.target.value })}
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Money already in EF before you started tracking
              </p>
            </div>
            <div>
              <label className="label">Target</label>
              <input
                type="number"
                className="input"
                value={efDraft.target}
                onChange={(e) => setEfDraft({ ...efDraft, target: e.target.value })}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-2xl font-bold text-emerald-500">{formatPeso(efCurrent)}</span>
            <span className="text-sm text-slate-500">of {formatPeso(efTarget)}</span>
          </div>
        )}

        <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
            style={{ width: `${efPercent}%` }}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            {efPercent.toFixed(1)}% complete
            {efCurrent < efTarget && ` · ${formatPeso(efTarget - efCurrent)} to go`}
            {efCurrent >= efTarget && efTarget > 0 && ' · Goal reached! 🎉'}
          </span>
          <span className="flex items-center gap-3">
            <span>
              Starting: <span className="font-medium text-slate-700 dark:text-slate-300">{formatPeso(efBase)}</span>
            </span>
            <span>
              Deposits: <span className="font-medium text-emerald-500">+{formatPeso(efDeposits)}</span>
            </span>
            {efThisMonth > 0 && (
              <span>
                This month: <span className="font-medium text-emerald-500">+{formatPeso(efThisMonth)}</span>
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, sublabel, value, icon, accent, highlight }) {
  return (
    <div className={`card ${highlight ? 'ring-1 ring-emerald-500/20' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
          {sublabel && <div className="text-[10px] text-slate-400 mt-0.5">{sublabel}</div>}
        </div>
        <div className={`p-2 rounded-lg ${accent}`}>{icon}</div>
      </div>
      <div className={`text-2xl font-bold ${value < 0 ? 'text-expense' : ''}`}>
        {formatPeso(value)}
      </div>
    </div>
  )
}

function BufferStat({ label, value, strong }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`${strong ? 'text-xl' : 'text-base'} font-bold ${value < 0 ? 'text-expense' : 'text-emerald-500'}`}>
        {formatPeso(value)}
      </div>
    </div>
  )
}

function CategoryList({ title, rows, loading, type }) {
  const total = rows.reduce((s, r) => s + r.amount, 0)
  return (
    <div className="card">
      <h2 className="font-semibold mb-4">{title}</h2>
      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-slate-500 py-8 text-center">
          No {type} recorded for this month yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const pct = total > 0 ? (r.amount / total) * 100 : 0
            return (
              <li key={r.cat}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`pill ${CATEGORY_BG[r.cat] || 'bg-slate-200 text-slate-700'}`}>
                    {r.cat}
                  </span>
                  <span className="font-semibold text-sm">{formatPeso(r.amount)}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full ${type === 'income' ? 'bg-income' : 'bg-expense'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
