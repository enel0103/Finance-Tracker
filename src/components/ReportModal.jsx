import { Fragment, useMemo } from 'react'
import { FileText, X } from 'lucide-react'
import { formatPeso, monthLabel } from '../lib/utils'
import { categoryBg } from '../lib/constants'

// view="expenses" shows only spending, biggest category first with its share
// of the total. The default "full" view is the original income + expense report.
export default function ReportModal({ txs, year, month, allIncome, allExpense, onClose, view = 'full' }) {
  const label = monthLabel(year, month)
  const expensesOnly = view === 'expenses'

  const { incomeRows, expenseRows, totalIncome, totalExpense } = useMemo(() => {
    const byCategory = {}
    txs.forEach((t) => {
      const cat = t.category || 'Misc'
      if (!byCategory[cat]) byCategory[cat] = { income: 0, expense: 0, entries: [] }
      byCategory[cat].income += Number(t.income) || 0
      byCategory[cat].expense += Number(t.expense) || 0
      byCategory[cat].entries.push(t)
    })

    // Order: active list categories first, then any others that appear in the
    // data (e.g. a "Loan" repayment income, or a category later deleted). This
    // guarantees every peso in the month shows up somewhere in the report.
    const orderedCats = (preferred) => {
      const seen = new Set(preferred)
      const extras = Object.keys(byCategory).filter((c) => !seen.has(c))
      return [...preferred, ...extras]
    }

    const incomeRows = orderedCats(allIncome)
      .map((cat) => ({ cat, amount: byCategory[cat]?.income || 0, entries: byCategory[cat]?.entries || [] }))
      .filter((r) => r.amount > 0)

    const expenseRows = orderedCats(allExpense)
      .map((cat) => ({ cat, amount: byCategory[cat]?.expense || 0, entries: byCategory[cat]?.entries || [] }))
      .filter((r) => r.amount > 0)
    if (expensesOnly) expenseRows.sort((a, b) => b.amount - a.amount)

    const totalIncome = incomeRows.reduce((s, r) => s + r.amount, 0)
    const totalExpense = expenseRows.reduce((s, r) => s + r.amount, 0)

    return { incomeRows, expenseRows, totalIncome, totalExpense }
  }, [txs, allIncome, allExpense, expensesOnly])

  const pctOf = (amount) => (totalExpense > 0 ? `${((amount / totalExpense) * 100).toFixed(1)}%` : '')
  const summary = expensesOnly
    ? [
        { label: 'Total Spent', value: totalExpense, cls: 'text-expense' },
        { label: 'Categories', text: String(expenseRows.length), cls: '' },
        {
          label: 'Biggest',
          text: expenseRows[0] ? `${expenseRows[0].cat} · ${pctOf(expenseRows[0].amount)}` : '—',
          cls: ''
        },
      ]
    : [
        { label: 'Total Income', value: totalIncome, cls: 'text-income' },
        { label: 'Total Expenses', value: totalExpense, cls: 'text-expense' },
        { label: 'Buffer', value: totalIncome - totalExpense, cls: totalIncome - totalExpense >= 0 ? 'text-emerald-500' : 'text-expense' },
      ]
  const title = expensesOnly ? 'Spending Report' : 'Finance Report'

  const handlePrint = () => {
    const printContent = document.getElementById('report-print-area').innerHTML
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head>
      <title>${title} – ${label}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: system-ui, sans-serif; font-size: 13px; color: #1e293b; padding: 32px; }
        h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
        .subtitle { color: #64748b; font-size: 12px; margin-bottom: 24px; }
        .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
        .summary-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
        .summary-card .slabel { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: 600; }
        .summary-card .sval { font-size: 18px; font-weight: 700; margin-top: 4px; }
        .income-val { color: #16a34a; }
        .expense-val { color: #dc2626; }
        .section { margin-bottom: 24px; }
        .section h2 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 11px; color: #94a3b8; font-weight: 600; padding: 4px 8px; }
        th.right, td.right { text-align: right; }
        td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
        tr.cat-row td { font-weight: 600; background: #f8fafc; }
        tr.entry-row td { color: #475569; padding-left: 20px; }
        .total-row td { font-weight: 700; border-top: 2px solid #e2e8f0; padding-top: 8px; }
        .footer { margin-top: 32px; font-size: 10px; color: #94a3b8; text-align: center; }
      </style>
    </head><body>${printContent}</body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 300)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-500" />
            <h2 className="font-semibold">{expensesOnly ? 'Spending' : 'Monthly Report'} — {label}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="btn bg-emerald-600 text-white hover:bg-emerald-700 text-sm">
              <FileText className="w-3.5 h-3.5" />
              Download PDF
            </button>
            <button onClick={onClose} className="btn-ghost !p-2" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto max-h-[75vh]">
          <div id="report-print-area">
            <h1 style={{ fontSize: '20px', fontWeight: 700 }}>{title}</h1>
            <div className="subtitle" style={{ color: '#64748b', fontSize: '12px', marginBottom: '16px' }}>{label}</div>

            {/* One row per total on phones; three columns don't fit six-digit amounts. */}
            <div className="summary grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-6">
              {summary.map(({ label: l, value, text, cls }) => (
                <div key={l} className="card !p-3 flex items-baseline justify-between gap-2 sm:block min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{l}</div>
                  <div className={`text-lg font-bold sm:mt-1 tabular-nums truncate ${cls}`}>{text ?? formatPeso(value)}</div>
                </div>
              ))}
            </div>

            {!expensesOnly && incomeRows.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2 pb-1 border-b border-slate-200 dark:border-slate-700">Income</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400">
                      <th className="text-left py-1 px-2 font-medium">Category / Date</th>
                      <th className="text-left py-1 px-2 font-medium">Notes</th>
                      <th className="text-right py-1 px-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeRows.map((r) => (
                      <Fragment key={r.cat}>
                        <tr className="bg-slate-50 dark:bg-slate-800/40">
                          <td className="py-1.5 px-2 font-semibold" colSpan={2}>
                            <span className={`pill text-xs ${categoryBg(r.cat)}`}>{r.cat}</span>
                          </td>
                          <td className="py-1.5 px-2 text-right font-semibold text-income">{formatPeso(r.amount)}</td>
                        </tr>
                        {r.entries.filter((e) => Number(e.income) > 0).map((e) => (
                          <tr key={e.id} className="text-slate-500 dark:text-slate-400">
                            <td className="py-1 px-2 pl-5 text-xs">
                              {new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </td>
                            <td className="py-1 px-2 text-xs">{e.notes || '—'}</td>
                            <td className="py-1 px-2 text-right text-xs">{formatPeso(e.income)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                    <tr className="border-t-2 border-slate-200 dark:border-slate-700 font-bold">
                      <td className="py-2 px-2" colSpan={2}>Total Income</td>
                      <td className="py-2 px-2 text-right text-income">{formatPeso(totalIncome)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {expenseRows.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2 pb-1 border-b border-slate-200 dark:border-slate-700">Expenses</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400">
                      <th className="text-left py-1 px-2 font-medium">Category / Date</th>
                      <th className="text-left py-1 px-2 font-medium">Notes</th>
                      <th className="text-right py-1 px-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseRows.map((r) => (
                      <Fragment key={r.cat}>
                        <tr className="bg-slate-50 dark:bg-slate-800/40">
                          <td className="py-1.5 px-2 font-semibold" colSpan={2}>
                            <span className={`pill text-xs ${categoryBg(r.cat)}`}>{r.cat}</span>
                            {expensesOnly && (
                              <span className="ml-2 text-xs font-medium text-slate-400 tabular-nums">{pctOf(r.amount)}</span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-right font-semibold text-expense">{formatPeso(r.amount)}</td>
                        </tr>
                        {r.entries.filter((e) => Number(e.expense) > 0).map((e) => (
                          <tr key={e.id} className="text-slate-500 dark:text-slate-400">
                            <td className="py-1 px-2 pl-5 text-xs">
                              {new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </td>
                            <td className="py-1 px-2 text-xs">{e.notes || '—'}</td>
                            <td className="py-1 px-2 text-right text-xs">{formatPeso(e.expense)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                    <tr className="border-t-2 border-slate-200 dark:border-slate-700 font-bold">
                      <td className="py-2 px-2" colSpan={2}>Total Expenses</td>
                      <td className="py-2 px-2 text-right text-expense">{formatPeso(totalExpense)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {(expensesOnly ? expenseRows.length === 0 : txs.length === 0) && (
              <div className="text-sm text-slate-500 text-center py-8">
                {expensesOnly ? 'No expenses for this month.' : 'No transactions for this month.'}
              </div>
            )}

            <div className="footer text-xs text-slate-400 text-center mt-6">
              Generated by Yutori Finance Tracker · {label}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
