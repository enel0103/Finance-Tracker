import { ChevronLeft, ChevronRight } from 'lucide-react'
import { monthLabel } from '../lib/utils'

export default function MonthSelector({ year, month, onChange }) {
  const prev = () => {
    const d = new Date(year, month - 1, 1)
    onChange(d.getFullYear(), d.getMonth())
  }
  const next = () => {
    const d = new Date(year, month + 1, 1)
    onChange(d.getFullYear(), d.getMonth())
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1">
      <button
        onClick={prev}
        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label="Previous month"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="px-3 text-sm font-medium min-w-[140px] text-center">
        {monthLabel(year, month)}
      </div>
      <button
        onClick={next}
        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label="Next month"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
