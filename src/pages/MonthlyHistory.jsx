import { useEffect, useMemo, useState } from 'react'
import { History, TrendingUp, TrendingDown, Wallet, PiggyBank, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatPeso, monthLabel, monthRange } from '../lib/utils'
import { CARRYOVER_INCOME_CATEGORIES } from '../lib/constants'
import ReportModal from '../components/ReportModal.jsx'
import { useCategories } from '../contexts/CategoriesContext.jsx'

export default function MonthlyHistory() {
  const [txs, setTxs] = useState([])
  const [loading, setLoading] = useState(true)
  const { allIncome, allExpense } = useCategories()

  const [report, setReport] = useState(null) // { year, month, txs }
  const [reportLoading, setReportLoading] = useState(false)

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('date, category, income, expense')
        .order('date', { ascending: false })
      if (!error) setTxs(data || [])
      setLoading(false)
    })()
  }, [])

  const openReport = async (year, month) => {
    setReportLoading(true)
    const { start, end } = monthRange(year, month)
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .gte('date', start)
      .lt('date', end)
      .order('date', { ascending: false })
    setReportLoading(false)
    if (!error) setReport({ year, month, txs: data || [] })
  }

  const months = useMemo(() => {
    const map = new Map()
    txs.forEach((t) => {
      const d = new Date(t.date)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!map.has(key)) {
        map.set(key, {
          year: d.getFullYear(),
          month: d.getMonth(),
          income: 0,
          expense: 0,
          generatedBuffer: 0,
          claimedBuffer: 0
        })
      }
      const m = map.get(key)
      const income = Number(t.income) || 0
      const expense = Number(t.expense) || 0
      const isCarryover = income > 0 && CARRYOVER_INCOME_CATEGORIES.includes(t.category)
      m.income += income
      m.expense += expense
      if (isCarryover) {
        m.claimedBuffer += income
      } else {
        m.generatedBuffer += income - expense
      }
    })
    return Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year
      return b.month - a.month
    })
  }, [txs])

  if (loading) {
    return <div className="card text-sm text-slate-500">Loading…</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Monthly History</h1>
        <p className="text-sm text-slate-500">Income, expenses, and savings rate by month</p>
      </div>

      {months.length === 0 ? (
        <div className="card text-center py-12">
          <History className="w-10 h-10 mx-auto text-slate-400 mb-3" />
          <p className="font-medium">No history yet</p>
          <p className="text-sm text-slate-500 mt-1">
            Add transactions to start building your monthly history.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {months.map((m) => {
            const net = m.generatedBuffer
            const baseIncome = m.income - m.claimedBuffer
            const available = baseIncome + m.claimedBuffer
            const savingsRate = baseIncome > 0 ? (net / baseIncome) * 100 : 0
            return (
              <div key={`${m.year}-${m.month}`} className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">{monthLabel(m.year, m.month)}</h3>
                  <span
                    className={`pill text-xs ${
                      net >= 0
                        ? 'bg-income/15 text-income'
                        : 'bg-expense/15 text-expense'
                    }`}
                  >
                    {savingsRate >= 0 ? '+' : ''}{savingsRate.toFixed(1)}%
                  </span>
                </div>

                <div className="space-y-2.5 text-sm">
                  <Row
                    icon={<TrendingUp className="w-3.5 h-3.5 text-income" />}
                    label="Income"
                    value={baseIncome}
                    color="text-income"
                  />
                  {m.claimedBuffer > 0 && (
                    <Row
                      icon={<Wallet className="w-3.5 h-3.5 text-savings" />}
                      label="Available"
                      value={available}
                      color="text-savings"
                    />
                  )}
                  <Row
                    icon={<TrendingDown className="w-3.5 h-3.5 text-expense" />}
                    label="Expenses"
                    value={m.expense}
                    color="text-expense"
                  />
                  <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-800">
                    <Row
                      icon={<PiggyBank className="w-3.5 h-3.5" />}
                      label="Buffer"
                      value={net}
                      color={net >= 0 ? 'text-emerald-500' : 'text-expense'}
                      bold
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      New leftover, excluding carried-in money
                    </p>
                    {m.claimedBuffer > 0 && (
                      <p className="text-[10px] text-emerald-500 mt-1">
                        Includes past buffer: {formatPeso(m.claimedBuffer)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs text-slate-500 mb-1.5 flex justify-between">
                    <span>Savings rate</span>
                    <span>{savingsRate.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${savingsRate >= 0 ? 'bg-income' : 'bg-expense'}`}
                      style={{ width: `${Math.min(100, Math.abs(savingsRate))}%` }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => openReport(m.year, m.month)}
                  disabled={reportLoading}
                  className="btn-ghost w-full mt-4 text-sm justify-center"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {reportLoading ? 'Loading…' : 'View Report'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {report && (
        <ReportModal
          txs={report.txs}
          year={report.year}
          month={report.month}
          allIncome={allIncome}
          allExpense={allExpense}
          onClose={() => setReport(null)}
        />
      )}
    </div>
  )
}

function Row({ icon, label, value, color, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-slate-500">
        {icon}
        {label}
      </span>
      <span className={`${bold ? 'font-bold' : 'font-medium'} ${color}`}>
        {formatPeso(value)}
      </span>
    </div>
  )
}
