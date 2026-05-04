import { useState, useEffect } from 'react'
import { User, Mail, Check, Lock, Eye, EyeOff, Download, Smartphone } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { supabase } from '../lib/supabase'

export default function Settings() {
  const { user, updateUsername } = useAuth()
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    const handler = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setIsInstalled(true))
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setIsInstalled(true)
    setInstallPrompt(null)
  }

  const [username, setUsername] = useState(user?.user_metadata?.username || '')
  const [savingName, setSavingName] = useState(false)
  const [nameMsg, setNameMsg] = useState({ type: '', text: '' })

  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' })

  const saveName = async (e) => {
    e.preventDefault()
    setNameMsg({ type: '', text: '' })
    const trimmed = username.trim()
    if (trimmed.length < 2) {
      setNameMsg({ type: 'error', text: 'Username must be at least 2 characters.' })
      return
    }
    if (trimmed.length > 24) {
      setNameMsg({ type: 'error', text: 'Username must be 24 characters or fewer.' })
      return
    }

    setSavingName(true)
    const { error } = await updateUsername(trimmed)
    setSavingName(false)
    if (error) {
      setNameMsg({ type: 'error', text: error.message })
      return
    }
    setNameMsg({ type: 'success', text: 'Username updated.' })
  }

  const savePassword = async (e) => {
    e.preventDefault()
    setPwMsg({ type: '', text: '' })
    if (pw1.length < 6) {
      setPwMsg({ type: 'error', text: 'Password must be at least 6 characters.' })
      return
    }
    if (pw1 !== pw2) {
      setPwMsg({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: pw1 })
    setSavingPw(false)
    if (error) {
      setPwMsg({ type: 'error', text: error.message })
      return
    }
    setPw1('')
    setPw2('')
    setPwMsg({ type: 'success', text: 'Password updated.' })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-sm text-slate-500">Manage your profile and password</p>
      </div>

      {/* Install app */}
      {!isInstalled && (
        <div className="card flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium">Install Yutori</div>
              <div className="text-xs text-slate-500">
                {installPrompt
                  ? 'Add to your home screen for a better experience'
                  : 'Open this page in Chrome, then tap ⋮ → "Add to Home Screen"'}
              </div>
            </div>
          </div>
          {installPrompt && (
            <button onClick={handleInstall} className="btn-primary flex-shrink-0">
              <Download className="w-4 h-4" /> Install
            </button>
          )}
        </div>
      )}

      {/* Profile */}
      <form onSubmit={saveName} className="card space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <User className="w-4 h-4 text-slate-400" />
          Profile
        </h2>

        <div>
          <label className="label">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="email"
              disabled
              className="input pl-9 opacity-60 cursor-not-allowed"
              value={user?.email || ''}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Email cannot be changed here.</p>
        </div>

        <div>
          <label className="label">Username</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              minLength={2}
              maxLength={24}
              required
              className="input pl-9"
              placeholder="What should we call you?"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
        </div>

        {nameMsg.text && (
          <div
            className={`text-sm px-3 py-2 rounded-lg ${
              nameMsg.type === 'error'
                ? 'text-expense bg-expense/10'
                : 'text-emerald-500 bg-emerald-500/10'
            }`}
          >
            {nameMsg.text}
          </div>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={savingName} className="btn-primary">
            <Check className="w-4 h-4" />
            {savingName ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      {/* Password */}
      <form onSubmit={savePassword} className="card space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Lock className="w-4 h-4 text-slate-400" />
          Change password
        </h2>

        <div>
          <label className="label">New password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type={showPw ? 'text' : 'password'}
              minLength={6}
              required
              className="input pl-9 pr-10"
              placeholder="••••••••"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label={showPw ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="label">Confirm new password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type={showPw ? 'text' : 'password'}
              minLength={6}
              required
              className="input pl-9"
              placeholder="••••••••"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>

        {pwMsg.text && (
          <div
            className={`text-sm px-3 py-2 rounded-lg ${
              pwMsg.type === 'error'
                ? 'text-expense bg-expense/10'
                : 'text-emerald-500 bg-emerald-500/10'
            }`}
          >
            {pwMsg.text}
          </div>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={savingPw} className="btn-primary">
            <Check className="w-4 h-4" />
            {savingPw ? 'Saving…' : 'Update password'}
          </button>
        </div>
      </form>
    </div>
  )
}
