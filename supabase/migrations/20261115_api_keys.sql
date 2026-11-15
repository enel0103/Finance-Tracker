-- Personal API keys, used by the `api` edge function so an outside tool
-- (e.g. a chat bot) can read and write one user's data.
-- Only the SHA-256 hash of a key is stored; the key itself is shown once
-- in Settings when it is created.
create table if not exists api_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  key_hash     text not null unique,
  key_prefix   text not null,
  last_used_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists api_keys_user on api_keys (user_id);

alter table api_keys enable row level security;

create policy "Users manage own api keys"
  on api_keys for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
