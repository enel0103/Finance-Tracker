# Yutori API Setup

The API lets an outside tool (for example a chat bot) read your data, add
transactions and categories, and change budgets. It cannot delete anything.

## 1. Create the keys table

In **Supabase Dashboard → SQL Editor**, paste and run the contents of
`supabase/migrations/20261115_api_keys.sql`.

## 2. Deploy the function

With the Supabase CLI installed, logged in and linked to the project
(see `SETUP_PUSH_NOTIFICATIONS.md`, step 3):

```bash
supabase functions deploy api --no-verify-jwt
```

`--no-verify-jwt` is required: callers send their own API key, not a Supabase
login token. The function checks the key itself on every request.

## 3. Create a key

In the app: **Settings → API access → Create key**. The key is shown once.
"Copy setup message for bot" copies the address, the key and usage rules in
one message you can paste to the bot.

To cut a tool off, revoke its key in the same place.

## 4. Try it

```bash
curl -H "Authorization: Bearer <your key>" https://<project-ref>.supabase.co/functions/v1/api/summary
```

`GET /functions/v1/api` returns the list of endpoints.

## Endpoints

| Method | Path | What it does |
|---|---|---|
| GET | `/categories` | Income and expense category names |
| POST | `/categories` | Add a category: `{name, type}`, type is `income` or `expense` |
| GET | `/transactions` | `?month=YYYY-MM` or `?from=&to=`; optional `&category=` `&limit=` |
| POST | `/transactions` | `{category, amount, date?, notes?}` or `{items: [...]}` (max 50) |
| GET | `/summary` | `?month=YYYY-MM`: income, carried over, available, expenses, left |
| GET | `/report` | `?month=YYYY-MM`: every category with its entries |
| GET | `/history` | Totals for every month on record |
| GET | `/budget` | `?month=YYYY-MM`: budgeted vs actual per category |
| PUT | `/budget` | `{category, amount}` or `{items: [...]}` |
| GET | `/bills` | Recurring bills and days until due |
| GET | `/loans` | Money lent out and whether it is settled |

Notes:

- `month` defaults to the current month and `date` to today, both in
  Asia/Manila time.
- A transaction's type comes from its category: income categories are saved
  as income, the rest as expenses.
- Entries added through the API get `(via <key name>)` at the end of their
  notes so they are easy to spot in the app.
- A batch is all-or-nothing: if one item is invalid, none are saved.

## Bill reminder function

`send-bill-reminders` now rejects calls that do not carry the service role key
as their bearer token. The scheduled job in `SETUP_PUSH_NOTIFICATIONS.md`
already sends it. Redeploy for the check to take effect:

```bash
supabase functions deploy send-bill-reminders
```
