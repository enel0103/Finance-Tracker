// Yutori personal API — request handling.
//
// Kept free of Deno/URL imports so it can be exercised under Node with a fake
// client. `db` is a Supabase client created with the SERVICE ROLE key, which
// bypasses row level security: every query below MUST filter by user_id.

// Keep in sync with src/lib/constants.js.
const INCOME_CATEGORIES = ['Salary', 'Freelance']
const EXPENSE_CATEGORIES = [
  'Food', 'Bills', 'Subscriptions', 'Gym', 'Investments', 'Savings',
  'Emergency Fund', 'Future Wants', 'Misc'
]
const CARRYOVER_INCOME_CATEGORIES = ['Buffer Carryover', 'Cash on Hand']
const SYSTEM_CATEGORIES = [...CARRYOVER_INCOME_CATEGORIES, 'Loan']

const TIME_ZONE = 'Asia/Manila'
const MAX_BATCH = 50
const MAX_NOTES = 200

const ENDPOINTS = [
  'GET  /categories                      -> income and expense category names',
  'POST /categories   {name, type}       -> add a category; type is "income" or "expense"',
  'GET  /transactions ?month=YYYY-MM | ?from=YYYY-MM-DD&to=YYYY-MM-DD, optional &category= &limit=',
  'POST /transactions {category, amount, date?, notes?}  or  {items: [ ...same fields ]} (max 50)',
  'GET  /summary      ?month=YYYY-MM     -> income, carried over, available, expenses, left, per category',
  'GET  /report       ?month=YYYY-MM     -> every category with its individual entries',
  'GET  /history                         -> totals for every month on record',
  'GET  /budget       ?month=YYYY-MM     -> budgeted vs actual per category',
  'PUT  /budget       {category, amount}  or  {items: [ ... ]}',
  'GET  /bills                           -> recurring bills and days until due',
  'GET  /loans                           -> money lent out and whether it is settled'
]

class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  })

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100
const pad = (n: number) => String(n).padStart(2, '0')

function todayISO(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date())
}

function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

// "YYYY-MM" -> { start: first day, end: first day of the next month }
function monthBounds(month: string | null) {
  const m = month || todayISO().slice(0, 7)
  const match = /^(\d{4})-(\d{2})$/.exec(m)
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) {
    throw new ApiError(400, 'month must look like YYYY-MM, e.g. 2026-11')
  }
  const y = Number(match[1])
  const mo = Number(match[2])
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${pad(mo + 1)}`
  return { month: m, start: `${m}-01`, end: `${next}-01` }
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function unwrap(res: { data: any; error: any }) {
  if (res.error) throw new ApiError(500, 'Database error: ' + res.error.message)
  return res.data
}

async function authenticate(req: Request, db: any) {
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const key = req.headers.get('x-api-key')?.trim() || bearer
  if (!key || !key.startsWith('ytr_')) {
    throw new ApiError(401, 'Missing API key. Send it as "Authorization: Bearer <key>" or "x-api-key: <key>".')
  }
  const row = unwrap(
    await db.from('api_keys').select('id, user_id, name').eq('key_hash', await sha256Hex(key)).maybeSingle()
  )
  if (!row) throw new ApiError(401, 'Invalid or revoked API key.')
  await db.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', row.id)
  return { userId: row.user_id as string, keyName: row.name as string }
}

async function loadCategories(db: any, userId: string) {
  const rows = unwrap(
    await db.from('settings').select('key, value').eq('user_id', userId)
      .in('key', ['custom_categories', 'deleted_default_categories'])
  ) as { key: string; value: string }[]
  let custom: { name: string; type: string }[] = []
  let deleted: string[] = []
  for (const r of rows || []) {
    try {
      const parsed = JSON.parse(r.value)
      if (!Array.isArray(parsed)) continue
      if (r.key === 'custom_categories') custom = parsed
      else deleted = parsed
    } catch { /* ignore malformed setting */ }
  }
  const income = [
    ...INCOME_CATEGORIES.filter((c) => !deleted.includes(c)),
    ...custom.filter((c) => c.type === 'income').map((c) => c.name)
  ]
  const expense = [
    ...EXPENSE_CATEGORIES.filter((c) => !deleted.includes(c)),
    ...custom.filter((c) => c.type === 'expense').map((c) => c.name)
  ]
  return { income, expense, custom }
}

type Cats = { income: string[]; expense: string[] }

// Case-insensitive lookup that returns the category's real spelling.
function resolveCategory(cats: Cats, name: unknown) {
  const wanted = String(name ?? '').trim().toLowerCase()
  const inc = cats.income.find((c) => c.toLowerCase() === wanted)
  if (inc) return { name: inc, isIncome: true }
  const exp = cats.expense.find((c) => c.toLowerCase() === wanted)
  if (exp) return { name: exp, isIncome: false }
  throw new ApiError(
    400,
    `Unknown category "${name}". Income: ${cats.income.join(', ')}. Expense: ${cats.expense.join(', ')}. ` +
      'Add a new one with POST /categories first.'
  )
}

function parseAmount(v: unknown, allowZero = false): number {
  const n = typeof v === 'string' ? Number(v.replace(/,/g, '')) : Number(v)
  if (!isFinite(n) || n < 0 || (!allowZero && n === 0) || n > 1e11) {
    throw new ApiError(400, `amount must be a ${allowZero ? 'non-negative' : 'positive'} number, got "${v}"`)
  }
  return round2(n)
}

async function readBody(req: Request): Promise<any> {
  try {
    const body = await req.json()
    if (body && typeof body === 'object') return body
  } catch { /* fall through */ }
  throw new ApiError(400, 'Request body must be JSON.')
}

function itemsOf(body: any): any[] {
  const items = Array.isArray(body) ? body : Array.isArray(body.items) ? body.items : [body]
  if (items.length === 0) throw new ApiError(400, 'Nothing to save.')
  if (items.length > MAX_BATCH) throw new ApiError(400, `At most ${MAX_BATCH} items per request.`)
  return items
}

async function monthTransactions(db: any, userId: string, start: string, end: string) {
  return unwrap(
    await db.from('transactions').select('*').eq('user_id', userId)
      .gte('date', start).lt('date', end)
      .order('date', { ascending: false })
  ) as any[]
}

const publicTx = (t: any) => ({
  id: t.id,
  date: t.date,
  category: t.category,
  type: Number(t.income) > 0 ? 'income' : 'expense',
  amount: round2(Number(t.income) > 0 ? t.income : t.expense),
  notes: t.notes || null
})

// Same math as the Dashboard's summary cards.
function totalsOf(txs: any[]) {
  let income = 0
  let expense = 0
  let carried = 0
  const byCat: Record<string, { income: number; expense: number; entries: any[] }> = {}
  for (const t of txs) {
    const inc = Number(t.income) || 0
    const exp = Number(t.expense) || 0
    income += inc
    expense += exp
    if (inc > 0 && CARRYOVER_INCOME_CATEGORIES.includes(t.category)) carried += inc
    const cat = t.category || 'Misc'
    byCat[cat] ??= { income: 0, expense: 0, entries: [] }
    byCat[cat].income += inc
    byCat[cat].expense += exp
    byCat[cat].entries.push(t)
  }
  return { income, expense, carried, byCat }
}

function categoryRows(byCat: ReturnType<typeof totalsOf>['byCat'], kind: 'income' | 'expense', withEntries: boolean) {
  const total = Object.values(byCat).reduce((s, c) => s + c[kind], 0)
  return Object.entries(byCat)
    .filter(([, c]) => c[kind] > 0)
    .sort((a, b) => b[1][kind] - a[1][kind])
    .map(([category, c]) => ({
      category,
      amount: round2(c[kind]),
      percent: total > 0 ? Math.round((c[kind] / total) * 1000) / 10 : 0,
      ...(withEntries
        ? { entries: c.entries.filter((e) => Number(e[kind]) > 0).map(publicTx) }
        : {})
    }))
}

// ── Routes ─────────────────────────────────────────────────────────────────

async function getCategories(db: any, userId: string) {
  const cats = await loadCategories(db, userId)
  return { income: cats.income, expense: cats.expense }
}

async function postCategory(db: any, userId: string, body: any) {
  const name = String(body.name ?? '').trim()
  const type = String(body.type ?? '').trim().toLowerCase()
  if (!name || name.length > 32) throw new ApiError(400, 'name is required (max 32 characters).')
  if (type !== 'income' && type !== 'expense') throw new ApiError(400, 'type must be "income" or "expense".')
  const cats = await loadCategories(db, userId)
  const taken = [
    ...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES, ...SYSTEM_CATEGORIES,
    ...cats.custom.map((c) => c.name)
  ]
  if (taken.some((c) => c.toLowerCase() === name.toLowerCase())) {
    throw new ApiError(409, `A category named "${name}" already exists.`)
  }
  const next = [...cats.custom, { name, type }]
  unwrap(
    await db.from('settings').upsert(
      { key: 'custom_categories', value: JSON.stringify(next), user_id: userId },
      { onConflict: 'user_id,key' }
    )
  )
  return { added: { name, type } }
}

async function getTransactions(db: any, userId: string, q: URLSearchParams) {
  let start: string
  let end: string | null = null
  if (q.get('from') || q.get('to')) {
    const from = q.get('from') || '0001-01-01'
    const to = q.get('to') || todayISO()
    if (!isValidDate(from) || !isValidDate(to)) throw new ApiError(400, 'from and to must look like YYYY-MM-DD.')
    start = from
    // `to` is inclusive: query up to (but not including) the next day.
    const next = new Date(`${to}T00:00:00Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    end = next.toISOString().slice(0, 10)
  } else {
    ({ start, end } = monthBounds(q.get('month')))
  }
  const limit = Math.min(1000, Math.max(1, Number(q.get('limit')) || 200))
  let query = db.from('transactions').select('*').eq('user_id', userId).gte('date', start).lt('date', end)
  const category = q.get('category')
  if (category) {
    const cats = await loadCategories(db, userId)
    const all = [...cats.income, ...cats.expense, ...SYSTEM_CATEGORIES]
    const real = all.find((c) => c.toLowerCase() === category.trim().toLowerCase()) || category
    query = query.eq('category', real)
  }
  const rows = unwrap(await query.order('date', { ascending: false }).limit(limit)) as any[]
  return { count: rows.length, transactions: rows.map(publicTx) }
}

async function postTransactions(db: any, userId: string, keyName: string, body: any) {
  const items = itemsOf(body)
  const cats = await loadCategories(db, userId)
  const today = todayISO()
  // Validate everything first so a bad item never leaves a half-saved batch.
  const rows = items.map((item, i) => {
    try {
      if (!item || typeof item !== 'object') throw new ApiError(400, 'each item must be an object.')
      const cat = resolveCategory(cats, item.category)
      const amount = parseAmount(item.amount)
      const date = item.date ?? today
      if (!isValidDate(date)) throw new ApiError(400, `date must look like YYYY-MM-DD, got "${item.date}"`)
      const notes = String(item.notes ?? '').trim().slice(0, MAX_NOTES)
      const tag = `(via ${keyName})`
      return {
        date,
        category: cat.name,
        income: cat.isIncome ? amount : 0,
        expense: cat.isIncome ? 0 : amount,
        notes: notes ? `${notes} ${tag}` : tag,
        user_id: userId
      }
    } catch (e) {
      if (e instanceof ApiError && items.length > 1) throw new ApiError(e.status, `Item ${i + 1}: ${e.message}`)
      throw e
    }
  })
  const saved = unwrap(await db.from('transactions').insert(rows).select()) as any[]
  return { saved: saved.length, transactions: saved.map(publicTx) }
}

async function getSummary(db: any, userId: string, q: URLSearchParams) {
  const { month, start, end } = monthBounds(q.get('month'))
  const t = totalsOf(await monthTransactions(db, userId, start, end))
  const regular = t.income - t.carried
  return {
    month,
    income: round2(regular),
    carried_over: round2(t.carried),
    available: round2(t.income),
    expenses: round2(t.expense),
    left: round2(t.income - t.expense),
    income_by_category: categoryRows(t.byCat, 'income', false),
    expenses_by_category: categoryRows(t.byCat, 'expense', false)
  }
}

async function getReport(db: any, userId: string, q: URLSearchParams) {
  const { month, start, end } = monthBounds(q.get('month'))
  const t = totalsOf(await monthTransactions(db, userId, start, end))
  return {
    month,
    total_income: round2(t.income),
    total_expenses: round2(t.expense),
    left: round2(t.income - t.expense),
    income: categoryRows(t.byCat, 'income', true),
    expenses: categoryRows(t.byCat, 'expense', true)
  }
}

async function getHistory(db: any, userId: string) {
  const rows = unwrap(
    await db.from('transactions').select('date, category, income, expense').eq('user_id', userId)
      .order('date', { ascending: false })
  ) as any[]
  const months = new Map<string, { income: number; expense: number; carried: number }>()
  for (const r of rows) {
    const key = String(r.date).slice(0, 7)
    if (!months.has(key)) months.set(key, { income: 0, expense: 0, carried: 0 })
    const m = months.get(key)!
    const inc = Number(r.income) || 0
    m.income += inc
    m.expense += Number(r.expense) || 0
    if (inc > 0 && CARRYOVER_INCOME_CATEGORIES.includes(r.category)) m.carried += inc
  }
  return {
    months: [...months.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([month, m]) => ({
        month,
        income: round2(m.income - m.carried),
        carried_over: round2(m.carried),
        available: round2(m.income),
        expenses: round2(m.expense),
        left: round2(m.income - m.expense)
      }))
  }
}

async function getBudget(db: any, userId: string, q: URLSearchParams) {
  const { month, start, end } = monthBounds(q.get('month'))
  const [cats, budgets, txs] = await Promise.all([
    loadCategories(db, userId),
    db.from('budget').select('category, amount').eq('user_id', userId).then(unwrap),
    monthTransactions(db, userId, start, end)
  ])
  const t = totalsOf(txs)
  const row = (category: string, kind: 'income' | 'expense') => {
    const budgeted = round2(Number((budgets as any[]).find((b) => b.category === category)?.amount) || 0)
    const actual = round2(t.byCat[category]?.[kind] || 0)
    return { category, budgeted, actual, remaining: round2(budgeted - actual) }
  }
  return {
    month,
    income: cats.income.map((c) => row(c, 'income')),
    expenses: cats.expense.map((c) => row(c, 'expense'))
  }
}

async function putBudget(db: any, userId: string, body: any) {
  const items = itemsOf(body)
  const cats = await loadCategories(db, userId)
  const rows = items.map((item) => ({
    category: resolveCategory(cats, item?.category).name,
    amount: parseAmount(item?.amount, true),
    user_id: userId
  }))
  unwrap(await db.from('budget').upsert(rows, { onConflict: 'user_id,category' }))
  return { updated: rows.map((r) => ({ category: r.category, amount: r.amount })) }
}

async function getBills(db: any, userId: string) {
  const rows = unwrap(await db.from('bills').select('*').eq('user_id', userId).order('due_day', { ascending: true })) as any[]
  const [y, m, d] = todayISO().split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return {
    bills: rows.map((b) => {
      // A due day past the end of a short month falls on its last day.
      const due = Math.min(b.due_day, daysInMonth)
      return {
        id: b.id,
        name: b.name,
        amount: b.amount == null ? null : round2(b.amount),
        due_day: b.due_day,
        days_until_due: due >= d ? due - d : daysInMonth - d + b.due_day,
        is_active: b.is_active,
        notes: b.notes || null
      }
    })
  }
}

async function getLoans(db: any, userId: string) {
  const rows = unwrap(await db.from('loans').select('*').eq('user_id', userId).order('date_lent', { ascending: false })) as any[]
  const loans = rows.map((l) => ({
    id: l.id,
    borrower: l.borrower,
    amount: round2(l.amount),
    date_lent: l.date_lent,
    is_settled: !!l.is_settled,
    settled_at: l.settled_at || null,
    notes: l.notes || null
  }))
  return {
    total_outstanding: round2(loans.filter((l) => !l.is_settled).reduce((s, l) => s + l.amount, 0)),
    loans
  }
}

// ── Entry point ────────────────────────────────────────────────────────────

export async function handle(req: Request, db: any): Promise<Response> {
  try {
    const url = new URL(req.url)
    // Deployed, the path is /api/<route>; locally it is /functions/v1/api/<route>.
    const route = url.pathname.replace(/^.*?\/api(?=\/|$)/, '').replace(/\/+$/, '') || '/'
    const method = req.method.toUpperCase()

    const { userId, keyName } = await authenticate(req, db)
    const q = url.searchParams

    const key = `${method} ${route}`
    switch (key) {
      case 'GET /': return json({ name: 'Yutori API', today: todayISO(), endpoints: ENDPOINTS })
      case 'GET /categories': return json(await getCategories(db, userId))
      case 'POST /categories': return json(await postCategory(db, userId, await readBody(req)), 201)
      case 'GET /transactions': return json(await getTransactions(db, userId, q))
      case 'POST /transactions': return json(await postTransactions(db, userId, keyName, await readBody(req)), 201)
      case 'GET /summary': return json(await getSummary(db, userId, q))
      case 'GET /report': return json(await getReport(db, userId, q))
      case 'GET /history': return json(await getHistory(db, userId))
      case 'GET /budget': return json(await getBudget(db, userId, q))
      case 'PUT /budget': return json(await putBudget(db, userId, await readBody(req)))
      case 'GET /bills': return json(await getBills(db, userId))
      case 'GET /loans': return json(await getLoans(db, userId))
    }
    throw new ApiError(404, `No such endpoint: ${key}. Call GET / for the list.`)
  } catch (e) {
    if (e instanceof ApiError) return json({ error: e.message }, e.status)
    console.error(e)
    return json({ error: 'Unexpected server error.' }, 500)
  }
}
