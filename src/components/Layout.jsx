import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Receipt, Wallet, History, Wallet2, LogOut, Settings as SettingsIcon, Bell } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: Receipt },
  { to: '/budget', label: 'Budget', icon: Wallet },
  { to: '/bills', label: 'Bills', icon: Bell },
  { to: '/history', label: 'History', icon: History }
]

export default function Layout() {
  const location = useLocation()
  const title = NAV.find((n) => n.to === location.pathname)?.label || 'Dashboard'
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:w-64 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="px-6 py-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
            <Wallet2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white leading-tight">
              Yutori
            </div>
            <div className="text-xs text-slate-500">Finance Tracker</div>
          </div>
        </div>
        <nav className="px-3 py-2 flex-1 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          {user && (
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `block rounded-lg px-2 py-1.5 -mx-2 transition-colors ${
                  isActive
                    ? 'bg-slate-100 dark:bg-slate-800'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                    {user.user_metadata?.username || user.email?.split('@')[0]}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate" title={user.email}>
                    {user.email}
                  </div>
                </div>
                <SettingsIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </div>
            </NavLink>
          )}
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
          <div className="text-[10px] text-slate-400 text-center">
            Built by ENERU
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
              <Wallet2 className="w-4 h-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold text-sm">Yutori</div>
              <div className="text-[10px] text-slate-500">Finance Tracker</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{title}</span>
            <NavLink
              to="/settings"
              className="p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Settings"
            >
              <SettingsIcon className="w-4 h-4" />
            </NavLink>
            <button
              onClick={signOut}
              className="p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 px-4 md:px-8 py-6 pb-24 md:pb-8 max-w-6xl w-full mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Bottom nav (mobile) — shows first 5 nav items */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-2 text-[10px] font-medium ${
                  isActive
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`
              }
            >
              <Icon className="w-5 h-5 mb-0.5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
