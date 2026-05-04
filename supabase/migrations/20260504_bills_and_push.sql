-- ─────────────────────────────────────────────────
-- Bills table
-- ─────────────────────────────────────────────────
create table if not exists bills (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  amount           numeric(12, 2),
  due_day          int  not null check (due_day between 1 and 31),
  remind_days_before int not null default 3 check (remind_days_before >= 1),
  notes            text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

alter table bills enable row level security;

create policy "Users manage own bills"
  on bills for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────
-- Push subscriptions table
-- ─────────────────────────────────────────────────
create table if not exists push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references auth.users(id) on delete cascade,
  subscription jsonb not null,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "Users manage own push subscriptions"
  on push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────
-- Daily cron: call the edge function every day at 8 AM UTC
-- Requires pg_cron + pg_net extensions (both available on Supabase)
-- Run this block in the Supabase SQL Editor after enabling pg_cron.
-- ─────────────────────────────────────────────────
-- select cron.schedule(
--   'daily-bill-reminders',
--   '0 8 * * *',   -- every day at 8:00 AM UTC
--   $$
--   select net.http_post(
--     url    := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/send-bill-reminders',
--     headers := '{"Authorization": "Bearer <YOUR_SERVICE_ROLE_KEY>"}'::jsonb
--   );
--   $$
-- );
