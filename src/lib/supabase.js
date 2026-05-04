import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_KEY

if (!url || !key) {
  console.error('Missing Supabase env vars. Check your .env file.')
}

export const supabase = createClient(url, key)
