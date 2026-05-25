import { Expense, Budget, Category, AppSettings } from '@/types'
import { DEFAULT_CATEGORIES } from '@/constants/categories'

// 저장소 키
const STORAGE_KEYS = {
  EXPENSES: 'cashbook_expenses',
  BUDGET: 'cashbook_budget',
  CATEGORIES: 'cashbook_categories',
  SETTINGS: 'cashbook_settings',
} as const

// UUID 생성
export function generateId(): string {
  return crypto.randomUUID()
}

// 오늘 날짜 (YYYY-MM-DD)
export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

// 현재 월 (YYYY-MM)
export function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

// 현재 연도
export function getCurrentYear(): number {
  return new Date().getFullYear()
}

// ==================== 지출 내역 ====================

export function getExpenses(): Expense[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(STORAGE_KEYS.EXPENSES)
  return data ? JSON.parse(data) : []
}

export function saveExpense(expense: Expense): void {
  const expenses = getExpenses()
  expenses.push(expense)
  localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses))
}

export function saveExpenses(newExpenses: Expense[]): void {
  const expenses = getExpenses()
  expenses.push(...newExpenses)
  localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses))
}

export function updateExpense(id: string, updates: Partial<Expense>): void {
  const expenses = getExpenses()
  const index = expenses.findIndex(e => e.id === id)
  if (index !== -1) {
    expenses[index] = { ...expenses[index], ...updates }
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses))
  }
}

export function deleteExpense(id: string): void {
  const expenses = getExpenses().filter(e => e.id !== id)
  localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses))
}

export function getExpensesByMonth(month: string): Expense[] {
  return getExpenses().filter(e => e.date.startsWith(month))
}

export function getExpensesByDateRange(startDate: string, endDate: string): Expense[] {
  return getExpenses().filter(e => e.date >= startDate && e.date <= endDate)
}

// ==================== 예산 ====================

export function getBudget(): Budget {
  if (typeof window === 'undefined') {
    return createDefaultBudget()
  }
  const data = localStorage.getItem(STORAGE_KEYS.BUDGET)
  return data ? JSON.parse(data) : createDefaultBudget()
}

export function saveBudget(budget: Budget): void {
  localStorage.setItem(STORAGE_KEYS.BUDGET, JSON.stringify(budget))
}

export function createDefaultBudget(): Budget {
  const year = getCurrentYear()
  const monthlyBudgets: { [key: string]: number } = {}
  const categoryBudgets: { [key: string]: number } = {}

  // 12개월 기본 예산
  for (let m = 1; m <= 12; m++) {
    const monthKey = `${year}-${String(m).padStart(2, '0')}`
    monthlyBudgets[monthKey] = 1000000 // 기본 100만원
  }

  // 카테고리별 기본 예산
  DEFAULT_CATEGORIES.forEach(cat => {
    if (cat.id !== 'other') {
      categoryBudgets[cat.id] = 100000 // 기본 10만원
    }
  })
  categoryBudgets['other'] = 200000 // 기타 20만원

  return {
    year,
    annual: 12000000, // 연 1200만원
    monthlyBudgets,
    categoryBudgets,
    monthlyCategoryBudgets: {},
  }
}

export function getMonthlyBudget(month: string): number {
  const budget = getBudget()
  return budget.monthlyBudgets[month] || 0
}

export function getCategoryBudget(categoryId: string): number {
  const budget = getBudget()
  return budget.categoryBudgets[categoryId] || 0
}

// ==================== 카테고리 ====================

export function getCategories(): Category[] {
  if (typeof window === 'undefined') return DEFAULT_CATEGORIES
  const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES)
  return data ? JSON.parse(data) : DEFAULT_CATEGORIES
}

export function saveCategories(categories: Category[]): void {
  localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories))
}

// ==================== 설정 ====================

export function getSettings(): AppSettings {
  if (typeof window === 'undefined') {
    return { defaultCategories: [], homeCategoryOrder: [], lastUpdated: '' }
  }
  const data = localStorage.getItem(STORAGE_KEYS.SETTINGS)
  if (data) {
    const parsed = JSON.parse(data)
    // 기존 설정에 homeCategoryOrder가 없으면 추가
    if (!parsed.homeCategoryOrder) {
      parsed.homeCategoryOrder = []
    }
    return parsed
  }
  return { defaultCategories: [], homeCategoryOrder: [], lastUpdated: '' }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
}

// 홈 카테고리 표시 순서 가져오기
export function getHomeCategoryOrder(): string[] {
  const settings = getSettings()
  return settings.homeCategoryOrder || []
}

// 홈 카테고리 표시 순서 저장
export function saveHomeCategoryOrder(order: string[]): void {
  const settings = getSettings()
  settings.homeCategoryOrder = order
  settings.lastUpdated = new Date().toISOString()
  saveSettings(settings)
}

// ==================== 통계 계산 ====================

export function getMonthlyTotal(month: string): number {
  const expenses = getExpensesByMonth(month)
  return expenses.reduce((sum, e) => sum + e.amount, 0)
}

export function getCategoryTotal(month: string, categoryId: string): number {
  const expenses = getExpensesByMonth(month)
  return expenses
    .filter(e => e.category === categoryId)
    .reduce((sum, e) => sum + e.amount, 0)
}

export function getMonthlySummary(month: string) {
  const budget = getBudget()
  const monthlyBudget = budget.monthlyBudgets[month] || 0
  const totalSpent = getMonthlyTotal(month)
  const remaining = monthlyBudget - totalSpent
  const usageRate = monthlyBudget > 0 ? (totalSpent / monthlyBudget) * 100 : 0

  const categoryBreakdown: { [key: string]: { budget: number; spent: number; remaining: number; usageRate: number } } = {}

  const categories = getCategories()
  categories.forEach(cat => {
    const catBudget = budget.categoryBudgets[cat.id] || 0
    const catSpent = getCategoryTotal(month, cat.id)
    categoryBreakdown[cat.id] = {
      budget: catBudget,
      spent: catSpent,
      remaining: catBudget - catSpent,
      usageRate: catBudget > 0 ? (catSpent / catBudget) * 100 : 0,
    }
  })

  return {
    month,
    totalBudget: monthlyBudget,
    totalSpent,
    remaining,
    usageRate,
    categoryBreakdown,
  }
}

// 분기 합계 (1분기: 1-3월, 2분기: 4-6월, ...)
export function getQuarterlyTotal(year: number, quarter: 1 | 2 | 3 | 4): number {
  const startMonth = (quarter - 1) * 3 + 1
  const months = [startMonth, startMonth + 1, startMonth + 2]

  return months.reduce((sum, m) => {
    const monthKey = `${year}-${String(m).padStart(2, '0')}`
    return sum + getMonthlyTotal(monthKey)
  }, 0)
}

// 반기 합계
export function getHalfYearTotal(year: number, half: 1 | 2): number {
  const startMonth = half === 1 ? 1 : 7
  let total = 0
  for (let m = startMonth; m < startMonth + 6; m++) {
    const monthKey = `${year}-${String(m).padStart(2, '0')}`
    total += getMonthlyTotal(monthKey)
  }
  return total
}

// 연간 합계
export function getYearlyTotal(year: number): number {
  let total = 0
  for (let m = 1; m <= 12; m++) {
    const monthKey = `${year}-${String(m).padStart(2, '0')}`
    total += getMonthlyTotal(monthKey)
  }
  return total
}

// 적정 소비 범위 계산 (현재 날짜 기준)
export function getExpectedSpendingRange(month: string): { min: number; max: number; current: number } {
  const budget = getMonthlyBudget(month)
  const today = new Date()
  const currentMonth = month === getCurrentMonth()

  if (!currentMonth) {
    // 과거 또는 미래 월은 전체 예산 기준
    return { min: 0, max: budget, current: budget }
  }

  // 이번 달: 경과 일수 비율로 계산
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const dayOfMonth = today.getDate()
  const progressRate = dayOfMonth / daysInMonth

  const expected = budget * progressRate
  const margin = budget * 0.1 // 10% 마진

  return {
    min: Math.max(0, expected - margin),
    max: expected + margin,
    current: expected,
  }
}

// 초과/절약 상태 확인
export function getSpendingStatus(month: string): 'under' | 'normal' | 'over' {
  const { max } = getExpectedSpendingRange(month)
  const spent = getMonthlyTotal(month)

  if (spent < max * 0.9) return 'under' // 절약
  if (spent > max * 1.1) return 'over' // 초과
  return 'normal' // 정상
}
