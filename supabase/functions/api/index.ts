// Supabase Edge Function: api
// Personal REST API for outside tools (e.g. a chat bot). Requests carry a
// personal API key created in the app's Settings page; see handler.ts.
//
// Deploy with JWT verification off, since callers send their own key and
// not a Supabase login token:
//   supabase functions deploy api --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handle } from './handler.ts'

const url = Deno.env.get('SUPABASE_URL')
// Older projects expose the service role key; newer ones may only have a
// secret key. Either one gives the server-side access this function needs.
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY')
const db = url && serviceKey
  ? createClient(url, serviceKey, { auth: { persistSession: false } })
  : null

Deno.serve((req) => {
  if (!db) {
    return new Response(
      JSON.stringify({ error: 'Server is missing its Supabase URL or service key.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
  return handle(req, db)
})
