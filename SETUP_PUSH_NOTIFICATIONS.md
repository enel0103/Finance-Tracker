# Push Notification Setup Guide

## 1. Run the SQL migration in Supabase

Go to **Supabase Dashboard → SQL Editor** and paste + run the contents of:
`supabase/migrations/20260504_bills_and_push.sql`

This creates the `bills` and `push_subscriptions` tables with RLS.

---

## 2. Add environment variable to Vercel

In **Vercel → Your Project → Settings → Environment Variables**, add:

| Key | Value |
|-----|-------|
| `VITE_VAPID_PUBLIC_KEY` | `BDwzzUWt80P3pePSA-19cFcDbSv-vKj1JC0fJybNYlsrt2Pt-LBicCdVxCpaSDTFgoO8jOlBVM7V-6i17CMcx6c` |

Then redeploy (push to git or click "Redeploy" in Vercel).

---

## 3. Deploy the Edge Function to Supabase

Install the Supabase CLI if you haven't:
```bash
npm install -g supabase
```

Login and link your project:
```bash
supabase login
supabase link --project-ref qdkslxpaiuzfydsmuoru
```

Deploy the function:
```bash
supabase functions deploy send-bill-reminders
```

Set the function's secrets in Supabase:
```bash
supabase secrets set VAPID_PUBLIC_KEY="BDwzzUWt80P3pePSA-19cFcDbSv-vKj1JC0fJybNYlsrt2Pt-LBicCdVxCpaSDTFgoO8jOlBVM7V-6i17CMcx6c"
supabase secrets set VAPID_PRIVATE_KEY="T9Nn9uvz6bb4TUXHKUrqnnMK--RWz7SkYeDCbeqYlgM"
supabase secrets set VAPID_SUBJECT="mailto:enelbryan@gmail.com"
```

---

## 4. Schedule daily reminders (optional but recommended)

In **Supabase → SQL Editor**, enable pg_cron then run:

```sql
select cron.schedule(
  'daily-bill-reminders',
  '0 8 * * *',
  $$
  select net.http_post(
    url    := 'https://qdkslxpaiuzfydsmuoru.supabase.co/functions/v1/send-bill-reminders',
    headers := '{"Authorization": "Bearer <YOUR_SERVICE_ROLE_KEY>"}'::jsonb
  );
  $$
);
```

Replace `<YOUR_SERVICE_ROLE_KEY>` with the service role key from Supabase → Settings → API.

---

## 5. Install on your phone (PWA)

**Android (Chrome):**
- Visit the app in Chrome
- Tap the ⋮ menu → "Add to Home Screen" (or a banner will appear automatically)

**iOS (Safari):**
- Visit the app in Safari
- Tap the Share button → "Add to Home Screen"

> Note: Push notifications on iOS require iOS 16.4+ with the app installed as a PWA.
