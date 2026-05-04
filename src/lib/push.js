import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function getSubscriptionStatus(userId) {
  if (!isPushSupported()) return { supported: false, subscribed: false, permission: 'denied' }

  const permission = Notification.permission
  if (permission !== 'granted') {
    return { supported: true, subscribed: false, permission }
  }

  const registration = await navigator.serviceWorker.ready
  const sub = await registration.pushManager.getSubscription()
  if (!sub) return { supported: true, subscribed: false, permission }

  const { data } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  return { supported: true, subscribed: !!data, permission }
}

export async function enablePush(userId) {
  if (!isPushSupported()) throw new Error('Push notifications not supported in this browser.')
  if (!VAPID_PUBLIC_KEY) throw new Error('VAPID public key not configured.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was denied.')

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      subscription: subscription.toJSON(),
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id' }
  )
  if (error) throw error

  return subscription
}

export async function disablePush(userId) {
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) await subscription.unsubscribe()
  await supabase.from('push_subscriptions').delete().eq('user_id', userId)
}
