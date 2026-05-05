-- Required for budget upsert (onConflict: 'user_id,category') to work correctly.
-- Run this in Supabase SQL Editor if budget editing returns duplicate-key errors.
create unique index if not exists budget_user_category
  on budget (user_id, category);
