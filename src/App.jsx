import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Transactions from './pages/Transactions.jsx'
import BudgetPlan from './pages/BudgetPlan.jsx'
import MonthlyHistory from './pages/MonthlyHistory.jsx'
import { ensureSeed } from './lib/seed.js'

export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    ensureSeed().finally(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Loading…
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/budget" element={<BudgetPlan />} />
        <Route path="/history" element={<MonthlyHistory />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
