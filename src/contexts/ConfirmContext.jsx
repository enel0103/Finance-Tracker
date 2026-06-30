import { createContext, useContext, useCallback, useRef, useState } from 'react'
import { AlertTriangle, Info, X } from 'lucide-react'

const ConfirmContext = createContext(null)

const DEFAULTS = {
  title: '',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  tone: 'default', // 'default' | 'danger'
  alertOnly: false,
}

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null) // null when closed, else options
  const resolverRef = useRef(null)

  const close = useCallback((result) => {
    setState(null)
    if (resolverRef.current) {
      resolverRef.current(result)
      resolverRef.current = null
    }
  }, [])

  // Promise-based confirm. Returns true/false.
  const confirm = useCallback((opts) => {
    const options = typeof opts === 'string' ? { message: opts } : opts
    setState({ ...DEFAULTS, ...options })
    return new Promise((resolve) => { resolverRef.current = resolve })
  }, [])

  // Promise-based alert (single OK button). Resolves when dismissed.
  const notify = useCallback((opts) => {
    const options = typeof opts === 'string' ? { message: opts } : opts
    setState({ ...DEFAULTS, alertOnly: true, confirmText: 'OK', ...options })
    return new Promise((resolve) => { resolverRef.current = resolve })
  }, [])

  return (
    <ConfirmContext.Provider value={{ confirm, notify }}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => close(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg flex-shrink-0 ${
                  state.tone === 'danger'
                    ? 'bg-expense/10 text-expense'
                    : 'bg-emerald-500/10 text-emerald-500'
                }`}>
                  {state.tone === 'danger'
                    ? <AlertTriangle className="w-5 h-5" />
                    : <Info className="w-5 h-5" />}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  {state.title && (
                    <h3 className="font-semibold text-slate-900 dark:text-white">{state.title}</h3>
                  )}
                  <p className={`text-sm text-slate-600 dark:text-slate-300 ${state.title ? 'mt-1' : ''}`}>
                    {state.message}
                  </p>
                </div>
                <button
                  onClick={() => close(false)}
                  className="p-1 -m-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex-shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800">
              {!state.alertOnly && (
                <button onClick={() => close(false)} className="btn-ghost text-sm">
                  {state.cancelText}
                </button>
              )}
              <button
                onClick={() => close(true)}
                autoFocus
                className={`btn text-sm text-white ${
                  state.tone === 'danger'
                    ? 'bg-expense hover:bg-expense/90'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
