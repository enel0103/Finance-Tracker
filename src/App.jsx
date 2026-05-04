import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Transactions from './pages/Transactions.jsx'
import BudgetPlan from './pages/BudgetPlan.jsx'
import MonthlyHistory from './pages/MonthlyHistory.jsx'
import Login from './pages/Login.jsx'
import { ensureSeed } from './lib/seed.js'
import { useAuth } from './contexts/AuthContext.jsx'
import { CategoriesProvider } from './contexts/CategoriesContext.jsx'

export default function App() {
  const { user, loading } = useAuth()
  const [seeded, setSeeded] = useState(false)

  useEffect(() => {
    if (user) {
      setSeeded(false)
      ensureSeed(user.id).finally(() => setSeeded(true))
    }
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Loading…
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  if (!seeded) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Setting up your account…
      </div>
    )
  }

  return (
    <CategoriesProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/budget" element={<BudgetPlan />} />
          <Route path="/history" element={<MonthlyHistory />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </CategoriesProvider>
  )
}
