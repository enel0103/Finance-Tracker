import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signUp = (email, password, username) =>
    supabase.auth.signUp({
      email,
      password,
      options: {
        data: username ? { username } : undefined
      }
    })

  const updateUsername = async (username) => {
    const { data, error } = await supabase.auth.updateUser({
      data: { username }
    })
    if (!error && data?.user) {
      setSession((s) => (s ? { ...s, user: data.user } : s))
    }
    return { data, error }
  }

  const signOut = () => supabase.auth.signOut()

  const value = {
    session,
    user: session?.user || null,
    loading,
    signIn,
    signUp,
    signOut,
    updateUsername
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
