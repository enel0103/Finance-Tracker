import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES
} from '../lib/constants'
import { useAuth } from './AuthContext.jsx'

const CategoriesContext = createContext(null)
const SETTINGS_KEY = 'custom_categories'

export function CategoriesProvider({ children }) {
  const { user } = useAuth()
  const [custom, setCustom] = useState([]) // [{ name, type }]
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle()
    if (!error && data?.value) {
      try {
        const parsed = JSON.parse(data.value)
        if (Array.isArray(parsed)) setCustom(parsed)
      } catch {
        setCustom([])
      }
    } else {
      setCustom([])
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const persist = async (next) => {
    setCustom(next)
    await supabase.from('settings').upsert(
      {
        key: SETTINGS_KEY,
        value: JSON.stringify(next),
        user_id: user.id
      },
      { onConflict: 'user_id,key' }
    )
  }

  const addCategory = async (name, type) => {
    const trimmed = name.trim()
    if (!trimmed) return { ok: false, error: 'Name is required.' }
    if (type !== 'income' && type !== 'expense') {
      return { ok: false, error: 'Invalid type.' }
    }
    const all = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES, ...custom.map((c) => c.name)]
    if (all.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      return { ok: false, error: 'A category with that name already exists.' }
    }
    await persist([...custom, { name: trimmed, type }])
    return { ok: true }
  }

  const removeCategory = async (name) => {
    await persist(custom.filter((c) => c.name !== name))
  }

  const value = useMemo(() => {
    const customIncome = custom.filter((c) => c.type === 'income').map((c) => c.name)
    const customExpense = custom.filter((c) => c.type === 'expense').map((c) => c.name)
    return {
      loading,
      custom,
      customIncome,
      customExpense,
      allIncome: [...INCOME_CATEGORIES, ...customIncome],
      allExpense: [...EXPENSE_CATEGORIES, ...customExpense],
      addCategory,
      removeCategory,
      refresh: load
    }
  }, [custom, loading, load])

  return (
    <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>
  )
}

export function useCategories() {
  const ctx = useContext(CategoriesContext)
  if (!ctx) throw new Error('useCategories must be used within CategoriesProvider')
  return ctx
}
