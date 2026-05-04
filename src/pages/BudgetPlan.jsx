import { useEffect, useMemo, useState } from 'react'
import { Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatPeso, monthRange } from '../lib/utils'
import {
  ALL_CATEGORIES,
  CATEGORY_BG,
  isIncomeCategory
} from '../lib/constants'
import MonthSelector from '../components/MonthSelector.jsx'

export default function BudgetPlan() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [budgets, setBudgets] = useState([])
  const [actuals, setActuals] = useState({})
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const { start, end } = monthRange(year, month)
    const [bRes, tRes] = await Promise.all([
      supabase.from('budget').select('*'),
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

  useEffect(() => {
    load()
  }, [year, month])

  const rows = useMemo(() => {
    return ALL_CATEGORIES.map((cat) => {
      const b = budgets.find((x) => x.category === cat)
      const isIncome = isIncomeCategory(cat)
      const actual = isIncome
        ? actuals[cat]?.income || 0
        : actuals[cat]?.expense || 0
      const budgeted = Number(b?.amount) || 0
      const pct = budgeted > 0 ? (actual / budgeted) * 100 : 0
      return { cat, isIncome, budgeted, actual, pct }
    })
  }, [budgets, actuals])

  const incomeRows = rows.filter((r) => r.isIncome)
  const expenseRows = rows.filter((r) => !r.isIncome)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budget Plan</h1>
          <p className="text-sm text-slate-500">Monthly limits and how you're tracking against them</p>
        </div>
        <MonthSelector
          year={year}
          month={month}
          onChange={(y, m) => { setYear(y); setMonth(m) }}
        />
      </div>

      {loading ? (
        <div className="card text-sm text-slate-500">Loading…</div>
      ) : (
        <>
          <BudgetSection title="Income Targets" rows={incomeRows} />
          <BudgetSection title="Expense Budgets" rows={expenseRows} />
        </>
      )}
    </div>
  )
}

function BudgetSection({ title, rows }) {
  return (
    <div className="card">
      <h2 className="font-semibold mb-4 flex items-center gap-2">
        <Wallet className="w-4 h-4 text-slate-400" />
        {title}
      </h2>
      <ul className="space-y-4">
        {rows.map((r) => {
          const over = !r.isIncome && r.budgeted > 0 && r.actual > r.budgeted
          const under = !r.isIncome && r.budgeted > 0 && r.actual <= r.budgeted
          const incomeOver = r.isIncome && r.actual >= r.budgeted && r.budgeted > 0
          const remaining = r.budgeted - r.actual
          const barPct = Math.min(100, r.pct)

          let barColor = 'bg-slate-400'
          if (r.isIncome) barColor = 'bg-income'
          else if (over) barColor = 'bg-expense'
          else if (r.pct > 80) barColor = 'bg-savings'
          else barColor = 'bg-emerald-500'

          return (
            <li key={r.cat}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`pill ${CATEGORY_BG[r.cat] || 'bg-slate-200 text-slate-700'}`}>
                    {r.cat}
                  </span>
                  {r.budgeted > 0 && (
                    <span
                      className={`pill text-[10px] ${
                        over
                          ? 'bg-expense/15 text-expense'
                          : incomeOver
                          ? 'bg-income/15 text-income'
                          : under
                          ? 'bg-emerald-500/15 text-emerald-500'
                          : 'bg-slate-500/15 text-slate-500'
                      }`}
                    >
                      {r.isIncome
                        ? incomeOver
                          ? 'Goal hit'
                          : `${r.pct.toFixed(0)}%`
                        : over
                        ? `Over ${formatPeso(r.actual - r.budgeted)}`
                        : `${r.pct.toFixed(0)}% used`}
                    </span>
                  )}
                </div>
                <span className="text-sm">
                  <span className="font-semibold">{formatPeso(r.actual)}</span>
                  <span className="text-slate-400"> / {formatPeso(r.budgeted)}</span>
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div className={`h-full ${barColor} transition-all`} style={{ width: `${barPct}%` }} />
              </div>
              {r.budgeted > 0 && !r.isIncome && (
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
