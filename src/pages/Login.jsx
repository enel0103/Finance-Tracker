import { useState } from 'react'
import { Wallet2, Mail, Lock, Eye, EyeOff, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!email || !password) return
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (mode === 'signup') {
      const trimmed = username.trim()
      if (trimmed.length < 2) {
        setError('Username must be at least 2 characters.')
        return
      }
      if (trimmed.length > 24) {
        setError('Username must be 24 characters or fewer.')
        return
      }
    }

    setSubmitting(true)
    const { data, error } =
      mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password, username.trim())
    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }

    if (mode === 'signup' && !data.session) {
      setInfo('Check your email to confirm your account, then sign in.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
            <Wallet2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold leading-tight">Yutori</div>
            <div className="text-xs text-slate-500">
              A personal finance tracker
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {mode === 'signin' ? 'Sign in to continue' : 'Create your account'}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="label">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={24}
                  className="input pl-9"
                  placeholder="What should we call you?"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="nickname"
                />
              </div>
            </div>
          )}

          <div>
            <label className="label">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                className="input pl-9"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="label">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                className="input pl-9 pr-10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-expense bg-expense/10 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
          {info && (
            <div className="text-sm text-emerald-500 bg-emerald-500/10 px-3 py-2 rounded-lg">
              {info}
            </div>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>

          <p className="text-center text-sm text-slate-500">
            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin')
                setError('')
                setInfo('')
              }}
              className="text-emerald-500 font-medium hover:underline"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
