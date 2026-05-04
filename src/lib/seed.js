import { supabase } from './supabase'
import { DEFAULT_BUDGETS, DEFAULT_SETTINGS } from './constants'

const seededUsers = new Set()

export async function ensureSeed(userId) {
  if (!userId || seededUsers.has(userId)) return
  seededUsers.add(userId)

  try {
    const { data: budgets, error: bErr } = await supabase
      .from('budget')
      .select('id')
      .limit(1)

    if (!bErr && (!budgets || budgets.length === 0)) {
      await supabase
        .from('budget')
        .insert(DEFAULT_BUDGETS.map((b) => ({ ...b, user_id: userId })))
    }

    const { data: settings, error: sErr } = await supabase
      .from('settings')
      .select('id')
      .limit(1)

    if (!sErr && (!settings || settings.length === 0)) {
      await supabase
        .from('settings')
        .insert(DEFAULT_SETTINGS.map((s) => ({ ...s, user_id: userId })))
    }
  } catch (e) {
    console.error('Seed error:', e)
  }
}
