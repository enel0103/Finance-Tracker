import { supabase } from './supabase'
import { DEFAULT_BUDGETS, DEFAULT_SETTINGS } from './constants'

let seeded = false

export async function ensureSeed() {
  if (seeded) return
  seeded = true

  try {
    const { data: budgets, error: bErr } = await supabase
      .from('budget')
      .select('id')
      .limit(1)

    if (!bErr && (!budgets || budgets.length === 0)) {
      await supabase.from('budget').insert(DEFAULT_BUDGETS)
    }

    const { data: settings, error: sErr } = await supabase
      .from('settings')
      .select('id')
      .limit(1)

    if (!sErr && (!settings || settings.length === 0)) {
      await supabase.from('settings').insert(DEFAULT_SETTINGS)
    }
  } catch (e) {
    console.error('Seed error:', e)
  }
}
