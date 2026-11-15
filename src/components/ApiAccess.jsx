import { useEffect, useState } from 'react'
import { KeyRound, Plus, Trash2, Copy, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useConfirm } from '../contexts/ConfirmContext.jsx'

const API_URL = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/api`

// "ytr_" + 32 random URL-safe characters.
function generateKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  return `ytr_${b64}`
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Everything a bot needs in one message. The API describes its own endpoints
// at GET <url>, so this only has to carry the address, the key and the rules.
function setupMessage(key) {
  return [
    'You can read and write my Yutori finance tracker through this API.',
    '',
    `Base URL: ${API_URL}`,
    `API key: ${key}`,
    'Send the key on every request as the header:  Authorization: Bearer <API key>',
    'Requests and responses are JSON. Amounts are in Philippine pesos.',
    '',
    `Start with GET ${API_URL} to get the full list of endpoints. The main ones:`,
    '- GET /categories — my income and expense categories',
    '- POST /transactions {category, amount, date?, notes?} or {items:[...]} — add entries (date defaults to today, YYYY-MM-DD)',
    '- GET /summary?month=YYYY-MM — income, available, expenses and what is left',
    '- GET /report?month=YYYY-MM — spending per category with each entry',
    '- GET /transactions?month=YYYY-MM — list entries',
    '- GET /budget and PUT /budget {category, amount} — read and change my budget',
    '- POST /categories {name, type} — add a category (type: income or expense)',
    '- GET /bills, GET /loans, GET /history',
    '',
    'Rules: only use categories from GET /categories (add a new one first if I ask).',
    'Before saving, repeat the entries back to me and wait for my OK.',
    'Keep this key secret and never show it in a reply.'
  ].join('\n')
}

export default function ApiAccess() {
  const { user } = useAuth()
  const { confirm, notify } = useConfirm()
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState(null)
  const [copied, setCopied] = useState('')

  const load = async () => {
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, last_used_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (!error) setKeys(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const createKey = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setCreating(true)
    const key = generateKey()
    const { error } = await supabase.from('api_keys').insert({
      user_id: user.id,
      name: trimmed,
      key_hash: await sha256Hex(key),
      key_prefix: key.slice(0, 8)
    })
    setCreating(false)
    if (error) {
      await notify({ title: 'Something went wrong', message: 'Could not create the key: ' + error.message, tone: 'danger' })
      return
    }
    setNewKey(key)
    setName('')
    load()
  }

  const revoke = async (k) => {
    const ok = await confirm({
      title: `Revoke "${k.name}"?`,
      message: 'Anything using this key will stop working right away. This cannot be undone.',
      confirmText: 'Revoke',
      tone: 'danger'
    })
    if (!ok) return
    const { error } = await supabase.from('api_keys').delete().eq('id', k.id).eq('user_id', user.id)
    if (error) {
      await notify({ title: 'Something went wrong', message: 'Could not revoke the key: ' + error.message, tone: 'danger' })
      return
    }
    load()
  }

  const copy = async (what, text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(''), 2000)
    } catch {
      await notify({ title: 'Could not copy', message: 'Select the text and copy it manually.' })
    }
  }

  const fmt = (iso) =>
    iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'never'

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="font-semibold flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-slate-400" />
          API access
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Let a bot or another app read and add to your data. A key gives full read access to your
          finances, so only give it to tools you trust. It can add entries and change budgets, but
          it cannot delete anything.
        </p>
      </div>

      {newKey && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-3">
          <p className="text-sm font-medium">Copy your new key now. It won't be shown again.</p>
          <code className="block text-xs break-all rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2">
            {newKey}
          </code>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => copy('msg', setupMessage(newKey))} className="btn-primary text-sm">
              {copied === 'msg' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied === 'msg' ? 'Copied' : 'Copy setup message for bot'}
            </button>
            <button type="button" onClick={() => copy('key', newKey)} className="btn-ghost text-sm">
              {copied === 'key' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied === 'key' ? 'Copied' : 'Copy key only'}
            </button>
            <button type="button" onClick={() => setNewKey(null)} className="btn-ghost text-sm">
              Done
            </button>
          </div>
        </div>
      )}

      <form onSubmit={createKey} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
        <input
          type="text"
          required
          maxLength={24}
          className="input"
          placeholder="Name it after what will use it, e.g. GrokBot"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" disabled={creating} className="btn-primary">
          <Plus className="w-4 h-4" />
          {creating ? 'Creating…' : 'Create key'}
        </button>
      </form>

      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : keys.length === 0 ? (
        <div className="text-sm text-slate-500">No keys yet.</div>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {keys.map((k) => (
            <li key={k.id} className="py-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{k.name}</div>
                <div className="text-xs text-slate-500">
                  {k.key_prefix}… · created {fmt(k.created_at)} · last used {fmt(k.last_used_at)}
                </div>
              </div>
              <button
                onClick={() => revoke(k)}
                className="icon-btn text-slate-400 hover:text-expense flex-shrink-0"
                aria-label={`Revoke ${k.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="text-xs text-slate-500 break-all">
        API address: <span className="font-medium text-slate-700 dark:text-slate-300">{API_URL}</span>
      </div>
    </div>
  )
}
