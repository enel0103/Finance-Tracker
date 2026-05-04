// Supabase Edge Function: send-bill-reminders
// Triggered daily via Supabase Cron (pg_cron) or manually.
// Checks which bills are due within their remind_days_before window and sends push notifications.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@yutori.app'

// ──────────────────────────────────────────────────
// Minimal Web Push / VAPID implementation using Deno's built-in crypto
// ──────────────────────────────────────────────────

function base64UrlDecode(str: string): Uint8Array {
  const padding = '='.repeat((4 - (str.length % 4)) % 4)
  const b64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

function base64UrlEncode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function makeVapidToken(audience: string): Promise<string> {
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const now = Math.floor(Date.now() / 1000)
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: now + 12 * 3600,
    sub: VAPID_SUBJECT
  })))

  const signingInput = `${header}.${payload}`
  const keyData = base64UrlDecode(VAPID_PRIVATE_KEY)

  const key = await crypto.subtle.importKey(
    'pkcs8',
    // Wrap raw EC private key bytes in PKCS8 DER envelope for prime256v1
    buildPkcs8(keyData),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput)
  )

  return `${signingInput}.${base64UrlEncode(sig)}`
}

// Build a minimal PKCS#8 DER wrapper around a raw 32-byte EC private key
function buildPkcs8(rawKey: Uint8Array): ArrayBuffer {
  // ASN.1 DER for EC private key in PKCS#8 format (prime256v1)
  const oidEcPublicKey = new Uint8Array([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01])
  const oidPrime256v1 = new Uint8Array([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07])

  // ECPrivateKey ::= SEQUENCE { version INTEGER (1), privateKey OCTET STRING }
  const ecKey = concat([
    new Uint8Array([0x30]), derLen(3 + 2 + rawKey.length),
    new Uint8Array([0x02, 0x01, 0x01]), // version = 1
    new Uint8Array([0x04, rawKey.length]), rawKey
  ])

  // AlgorithmIdentifier
  const algId = concat([
    new Uint8Array([0x30]), derLen(2 + oidEcPublicKey.length + 2 + oidPrime256v1.length),
    new Uint8Array([0x06, oidEcPublicKey.length]), oidEcPublicKey,
    new Uint8Array([0x06, oidPrime256v1.length]), oidPrime256v1
  ])

  // PrivateKeyInfo ::= SEQUENCE { version, algorithm, privateKey OCTET STRING }
  const pkcs8 = concat([
    new Uint8Array([0x30]), derLen(3 + algId.length + 2 + ecKey.length),
    new Uint8Array([0x02, 0x01, 0x00]), // version = 0
    algId,
    new Uint8Array([0x04, ecKey.length]), ecKey
  ])

  return pkcs8.buffer
}

function derLen(n: number): Uint8Array {
  if (n < 128) return new Uint8Array([n])
  if (n < 256) return new Uint8Array([0x81, n])
  return new Uint8Array([0x82, (n >> 8) & 0xff, n & 0xff])
}

function concat(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) { out.set(a, offset); offset += a.length }
  return out
}

async function sendPushNotification(subscription: {
  endpoint: string
  keys: { p256dh: string; auth: string }
}, payload: string): Promise<boolean> {
  const url = new URL(subscription.endpoint)
  const audience = `${url.protocol}//${url.host}`
  const vapidToken = await makeVapidToken(audience)

  const authKey = base64UrlDecode(subscription.keys.auth)
  const p256dhKey = base64UrlDecode(subscription.keys.p256dh)

  // Generate sender key pair
  const senderKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']
  )
  const senderPublicKey = await crypto.subtle.exportKey('raw', senderKeyPair.publicKey)

  // Import receiver's public key
  const receiverPublicKey = await crypto.subtle.importKey(
    'raw', p256dhKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  )

  // ECDH shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: receiverPublicKey }, senderKeyPair.privateKey, 256
  )

  // HKDF to derive content encryption key and nonce
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const prk = await hkdf(new Uint8Array(sharedBits), authKey,
    concat([new TextEncoder().encode('Content-Encoding: auth\0'), new Uint8Array([1])]), 32)
  const contentKey = await hkdf(prk, salt,
    buildInfo('aesgcm', new Uint8Array(senderPublicKey), p256dhKey), 16)
  const nonce = await hkdf(prk, salt,
    buildInfo('nonce', new Uint8Array(senderPublicKey), p256dhKey), 12)

  // Encrypt payload
  const key = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt'])
  const payloadBytes = new TextEncoder().encode(payload)
  const paddedPayload = concat([new Uint8Array(2), payloadBytes]) // 2-byte padding length prefix
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, paddedPayload)

  const body = concat([new Uint8Array(encrypted)])

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${vapidToken}, k=${VAPID_PUBLIC_KEY}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aesgcm',
      Encryption: `salt=${base64UrlEncode(salt)}`,
      'Crypto-Key': `dh=${base64UrlEncode(senderPublicKey)}`,
      TTL: '86400'
    },
    body
  })

  return response.ok || response.status === 201
}

async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey', 'deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    keyMaterial, length * 8
  )
  return new Uint8Array(bits)
}

function buildInfo(type: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
  const enc = new TextEncoder()
  const typeBytes = enc.encode(`Content-Encoding: ${type}\0P-256\0`)
  const clientLen = new Uint8Array([(clientPublicKey.length >> 8) & 0xff, clientPublicKey.length & 0xff])
  const serverLen = new Uint8Array([(serverPublicKey.length >> 8) & 0xff, serverPublicKey.length & 0xff])
  return concat([typeBytes, clientLen, clientPublicKey, serverLen, serverPublicKey, new Uint8Array([1])])
}

// ──────────────────────────────────────────────────
// Main handler
// ──────────────────────────────────────────────────

Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const today = new Date()
  const currentDay = today.getDate()

  // Fetch all active bills
  const { data: bills, error: billsErr } = await supabase
    .from('bills')
    .select('id, user_id, name, amount, due_day, remind_days_before')
    .eq('is_active', true)

  if (billsErr) return new Response(JSON.stringify({ error: billsErr.message }), { status: 500 })

  // Fetch all push subscriptions
  const { data: subs, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('user_id, subscription')

  if (subsErr) return new Response(JSON.stringify({ error: subsErr.message }), { status: 500 })

  const subsByUser = Object.fromEntries((subs || []).map((s: { user_id: string; subscription: unknown }) => [s.user_id, s.subscription]))

  let sent = 0
  let failed = 0

  for (const bill of bills || []) {
    const sub = subsByUser[bill.user_id]
    if (!sub) continue

    // Calculate days until due this month or next
    let daysUntil = bill.due_day - currentDay
    if (daysUntil < 0) {
      // Already passed this month — next month
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
      daysUntil = daysInMonth - currentDay + bill.due_day
    }

    if (daysUntil > bill.remind_days_before || daysUntil < 0) continue

    const amountStr = bill.amount ? ` (₱${Number(bill.amount).toLocaleString('en-PH')})` : ''
    const dueStr = daysUntil === 0 ? 'today' : `in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`

    const payload = JSON.stringify({
      title: `Bill reminder: ${bill.name}`,
      body: `${bill.name}${amountStr} is due ${dueStr}.`,
      tag: `bill-${bill.id}`,
      url: '/bills'
    })

    try {
      const ok = await sendPushNotification(sub as { endpoint: string; keys: { p256dh: string; auth: string } }, payload)
      if (ok) sent++ else failed++
    } catch {
      failed++
    }
  }

  return new Response(JSON.stringify({ sent, failed, checked: (bills || []).length }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
