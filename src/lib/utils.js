export function formatPeso(n) {
  const num = Number(n) || 0
  return '₱' + num.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

export function formatPesoShort(n) {
  const num = Number(n) || 0
  return '₱' + num.toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
}

export function monthRange(year, month) {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 1)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  }
}

export function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric'
  })
}

export function shortMonthLabel(year, month) {
  return new Date(year, month, 1).toLocaleString('en-US', {
    month: 'short',
    year: 'numeric'
  })
}

export function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function classNames(...arr) {
  return arr.filter(Boolean).join(' ')
}
