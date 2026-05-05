import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  PROTECTED_CATEGORIES
} from '../lib/constants'
import { useAuth } from './AuthContext.jsx'

const CategoriesContext = createContext(null)
const CUSTOM_KEY = 'custom_categories'
const DELETED_KEY = 'deleted_default_categories'

export function CategoriesProvider({ children }) {
  const { user } = useAuth()
  const [custom, setCustom] = useState([])       // [{ name, type }] — user-added
  const [deleted, setDeleted] = useState([])     // string[] — hidden default names
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', [CUSTOM_KEY, DELETED_KEY])
      .eq('user_id', user.id)

    for (const row of data || []) {
      try {
        const parsed = JSON.parse(row.value)
        if (row.key === CUSTOM_KEY && Array.isArray(parsed)) setCustom(parsed)
        if (row.key === DELETED_KEY && Array.isArray(parsed)) setDeleted(parsed)
      } catch { /* ignore */ }
    }
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const persistCustom = async (next) => {
    setCustom(next)
    await supabase.from('settings').upsert(
      { key: CUSTOM_KEY, value: JSON.stringify(next), user_id: user.id },
      { onConflict: 'user_id,key' }
    )
  }

  const persistDeleted = async (next) => {
    setDeleted(next)
    await supabase.from('settings').upsert(
      { key: DELETED_KEY, value: JSON.stringify(next), user_id: user.id },
      { onConflict: 'user_id,key' }
    )
  }

  const addCategory = async (name, type) => {
    const trimmed = name.trim()
    if (!trimmed) return { ok: false, error: 'Name is required.' }
    if (type !== 'income' && type !== 'expense') return { ok: false, error: 'Invalid type.' }
    const all = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES, ...custom.map((c) => c.name)]
    if (all.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      return { ok: false, error: 'A category with that name already exists.' }
    }
    await persistCustom([...custom, { name: trimmed, type }])
    return { ok: true }
  }

  const removeCategory = async (name) => {
    await persistCustom(custom.filter((c) => c.name !== name))
  }

  // Hide a default (non-protected) category
  const deleteDefault = async (name) => {
    if (PROTECTED_CATEGORIES.has(name)) return
    await persistDeleted([...deleted.filter((d) => d !== name), name])
  }

  // Bring a hidden default back
  const restoreDefault = async (name) => {
    await persistDeleted(deleted.filter((d) => d !== name))
  }

  const value = useMemo(() => {
    const activeIncome = INCOME_CATEGORIES.filter((c) => !deleted.includes(c))
    const activeExpense = EXPENSE_CATEGORIES.filter((c) => !deleted.includes(c))
    const customIncome = custom.filter((c) => c.type === 'income').map((c) => c.name)
    const customExpense = custom.filter((c) => c.type === 'expense').map((c) => c.name)

    return {
      loading,
      custom,
      deleted,
      allIncome: [...activeIncome, ...customIncome],
      allExpense: [...activeExpense, ...customExpense],
      addCategory,
      removeCategory,
      deleteDefault,
      restoreDefault,
      refresh: load
    }
  }, [custom, deleted, loading, load])

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>
}

export function useCategories() {
  const ctx = useContext(CategoriesContext)
  if (!ctx) throw new Error('useCategories must be used within CategoriesProvider')
  return ctx
}
