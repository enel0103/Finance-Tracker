create table if not exists loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  borrower text not null,
  amount numeric not null,
  date_lent date not null,
  remind_every_days integer not null default 7,
  notes text,
  is_settled boolean not null default false,
  settled_at date,
  created_at timestamptz default now()
);

alter table loans enable row level security;

create policy "Users manage own loans"
  on loans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
