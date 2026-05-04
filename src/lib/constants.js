export const BUFFER_CARRYOVER_CATEGORY = 'Buffer Carryover'
export const LEGACY_CASH_ON_HAND_CATEGORY = 'Cash on Hand'
export const CARRYOVER_INCOME_CATEGORIES = [
  BUFFER_CARRYOVER_CATEGORY,
  LEGACY_CASH_ON_HAND_CATEGORY
]

// User-selectable income categories (shown in the dropdown).
// System categories like BUFFER_CARRYOVER_CATEGORY are intentionally excluded —
// they're created only by app logic (e.g. the "claim past buffer" button).
export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance'
]

export const EXPENSE_CATEGORIES = [
  'Food',
  'Bills',
  'Subscriptions',
  'Gym',
  'Investments',
  'Savings',
  'Emergency Fund',
  'Future Wants',
  'Misc'
]

export const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES]

export const DEFAULT_BUDGETS = [
  { category: 'Salary', amount: 0 },
  { category: 'Freelance', amount: 0 },
  { category: 'Food', amount: 0 },
  { category: 'Bills', amount: 0 },
  { category: 'Subscriptions', amount: 0 },
  { category: 'Gym', amount: 0 },
  { category: 'Investments', amount: 0 },
  { category: 'Savings', amount: 0 },
  { category: 'Emergency Fund', amount: 0 },
  { category: 'Future Wants', amount: 0 },
  { category: 'Misc', amount: 0 }
]

export const DEFAULT_SETTINGS = [
  { key: 'emergency_fund_current', value: '0' },
  { key: 'emergency_fund_target', value: '0' }
]

export const CATEGORY_COLORS = {
  Salary: 'text-income',
  Freelance: 'text-income',
  [BUFFER_CARRYOVER_CATEGORY]: 'text-emerald-500',
  [LEGACY_CASH_ON_HAND_CATEGORY]: 'text-savings',
  Food: 'text-expense',
  Bills: 'text-expense',
  Subscriptions: 'text-expense',
  Gym: 'text-expense',
  Investments: 'text-invest',
  Savings: 'text-savings',
  'Emergency Fund': 'text-emerald-500',
  'Future Wants': 'text-expense',
  Misc: 'text-expense'
}

export const CATEGORY_BG = {
  Salary: 'bg-income/10 text-income',
  Freelance: 'bg-income/10 text-income',
  [BUFFER_CARRYOVER_CATEGORY]: 'bg-emerald-500/10 text-emerald-500',
  [LEGACY_CASH_ON_HAND_CATEGORY]: 'bg-savings/10 text-savings',
  Food: 'bg-expense/10 text-expense',
  Bills: 'bg-expense/10 text-expense',
  Subscriptions: 'bg-expense/10 text-expense',
  Gym: 'bg-expense/10 text-expense',
  Investments: 'bg-invest/10 text-invest',
  Savings: 'bg-savings/10 text-savings',
  'Emergency Fund': 'bg-emerald-500/10 text-emerald-500',
  'Future Wants': 'bg-expense/10 text-expense',
  Misc: 'bg-expense/10 text-expense'
}

export function isIncomeCategory(cat) {
  return INCOME_CATEGORIES.includes(cat) || CARRYOVER_INCOME_CATEGORIES.includes(cat)
}
