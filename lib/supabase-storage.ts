import { createClient } from '@/lib/supabase/client';
import { Expense, Budget, Category, AppSettings } from '@/types';
import { DEFAULT_CATEGORIES } from '@/constants/categories';

// Supabase 클라이언트 (타입 추론 문제 해결을 위해 any 사용)
// 실제 Supabase 프로젝트 설정 후 타입이 제대로 작동합니다
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSupabase = () => createClient() as any;

// DB Row 타입 (수동 정의 - Supabase 타입 추론이 안될 때 사용)
interface ExpenseRow {
  id: string;
  user_id: string;
  date: string;
  amount: number;
  merchant: string;
  category_id: string;
  memo: string;
  source: string;
  created_at: string;
  image_url?: string;
}

interface CategoryRow {
  id: string;
  user_id: string;
  category_id: string;
  name: string;
  icon: string;
  color: string;
  keywords: string[];
  sort_order: number;
  is_default: boolean;
  created_at: string;
}

interface BudgetRow {
  id: string;
  user_id: string;
  year: number;
  annual: number;
  created_at: string;
}

interface MonthlyBudgetRow {
  id: string;
  budget_id: string;
  month: string;
  amount: number;
}

interface CategoryBudgetRow {
  id: string;
  budget_id: string;
  category_id: string;
  amount: number;
}

interface UserSettingsRow {
  user_id: string;
  home_category_order: string[];
  monthly_income: number;
  monthly_fixed_expense: number;
  current_assets: number;
  goal_amount: number;
  goal_months: number;
  updated_at: string;
}

// ==================== 유틸리티 ====================

export function generateId(): string {
  return crypto.randomUUID();
}

export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function getCurrentYear(): number {
  return new Date().getFullYear();
}

// ==================== 지출 내역 ====================

export async function getExpenses(): Promise<Expense[]> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching expenses:', error);
    return [];
  }

  return ((data || []) as ExpenseRow[]).map((e) => ({
    id: e.id,
    date: e.date,
    amount: e.amount,
    merchant: e.merchant,
    category: e.category_id,
    memo: e.memo || '',
    source: e.source as 'ocr' | 'manual',
    createdAt: e.created_at,
    imageUrl: e.image_url,
  }));
}

export async function saveExpense(expense: Expense): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('expenses').insert({
    id: expense.id,
    user_id: user.id,
    date: expense.date,
    amount: expense.amount,
    merchant: expense.merchant,
    category_id: expense.category,
    memo: expense.memo || '',
    source: expense.source || 'manual',
    image_url: expense.imageUrl || null,
  });

  if (error) {
    console.error('Error saving expense:', error);
    throw error;
  }
}

export async function saveExpenses(newExpenses: Expense[]): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const inserts = newExpenses.map((e) => ({
    id: e.id,
    user_id: user.id,
    date: e.date,
    amount: e.amount,
    merchant: e.merchant,
    category_id: e.category,
    memo: e.memo || '',
    source: e.source || 'manual',
    image_url: e.imageUrl || null,
  }));

  const { error } = await supabase.from('expenses').insert(inserts);

  if (error) {
    console.error('Error saving expenses:', error);
    throw error;
  }
}

export async function updateExpense(
  id: string,
  updates: Partial<Expense>
): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const updateData: Record<string, unknown> = {};
  if (updates.date !== undefined) updateData.date = updates.date;
  if (updates.amount !== undefined) updateData.amount = updates.amount;
  if (updates.merchant !== undefined) updateData.merchant = updates.merchant;
  if (updates.category !== undefined) updateData.category_id = updates.category;
  if (updates.memo !== undefined) updateData.memo = updates.memo;

  const { error } = await supabase
    .from('expenses')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error updating expense:', error);
    throw error;
  }
}

export async function deleteExpense(id: string): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error deleting expense:', error);
    throw error;
  }
}

export async function getExpensesByMonth(month: string): Promise<Expense[]> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const startDate = `${month}-01`;
  const endDate = `${month}-31`;

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching expenses by month:', error);
    return [];
  }

  return ((data || []) as ExpenseRow[]).map((e) => ({
    id: e.id,
    date: e.date,
    amount: e.amount,
    merchant: e.merchant,
    category: e.category_id,
    memo: e.memo || '',
    source: e.source as 'ocr' | 'manual',
    createdAt: e.created_at,
    imageUrl: e.image_url,
  }));
}

export async function getExpensesByDateRange(
  startDate: string,
  endDate: string
): Promise<Expense[]> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching expenses by date range:', error);
    return [];
  }

  return ((data || []) as ExpenseRow[]).map((e) => ({
    id: e.id,
    date: e.date,
    amount: e.amount,
    merchant: e.merchant,
    category: e.category_id,
    memo: e.memo || '',
    source: e.source as 'ocr' | 'manual',
    createdAt: e.created_at,
    imageUrl: e.image_url,
  }));
}

// ==================== 예산 ====================

export async function getBudget(): Promise<Budget> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return createDefaultBudget();

  const year = getCurrentYear();

  const { data: budgetData, error: budgetError } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', user.id)
    .eq('year', year)
    .single();

  if (budgetError || !budgetData) {
    return createDefaultBudget();
  }

  // 월별 예산 가져오기
  const { data: monthlyData } = await supabase
    .from('monthly_budgets')
    .select('*')
    .eq('budget_id', budgetData.id);

  // 카테고리별 예산 가져오기
  const { data: categoryData } = await supabase
    .from('category_budgets')
    .select('*')
    .eq('budget_id', budgetData.id);

  const monthlyBudgets: { [key: string]: number } = {};
  ((monthlyData || []) as MonthlyBudgetRow[]).forEach((m) => {
    monthlyBudgets[m.month] = m.amount;
  });

  const categoryBudgets: { [key: string]: number } = {};
  ((categoryData || []) as CategoryBudgetRow[]).forEach((c) => {
    categoryBudgets[c.category_id] = c.amount;
  });

  return {
    year: budgetData.year,
    annual: budgetData.annual,
    monthlyBudgets,
    categoryBudgets,
  };
}

export async function saveBudget(budget: Budget): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  // Upsert budget
  const { data: budgetData, error: budgetError } = await supabase
    .from('budgets')
    .upsert(
      {
        user_id: user.id,
        year: budget.year,
        annual: budget.annual,
      },
      { onConflict: 'user_id,year' }
    )
    .select()
    .single();

  if (budgetError || !budgetData) {
    console.error('Error saving budget:', budgetError);
    throw budgetError;
  }

  // 월별 예산 저장
  const monthlyInserts = Object.entries(budget.monthlyBudgets).map(
    ([month, amount]) => ({
      budget_id: budgetData.id,
      month,
      amount,
    })
  );

  if (monthlyInserts.length > 0) {
    // 기존 삭제 후 재삽입
    await supabase
      .from('monthly_budgets')
      .delete()
      .eq('budget_id', budgetData.id);

    await supabase.from('monthly_budgets').insert(monthlyInserts);
  }

  // 카테고리별 예산 저장
  const categoryInserts = Object.entries(budget.categoryBudgets).map(
    ([categoryId, amount]) => ({
      budget_id: budgetData.id,
      category_id: categoryId,
      amount,
    })
  );

  if (categoryInserts.length > 0) {
    await supabase
      .from('category_budgets')
      .delete()
      .eq('budget_id', budgetData.id);

    await supabase.from('category_budgets').insert(categoryInserts);
  }
}

export function createDefaultBudget(): Budget {
  const year = getCurrentYear();
  const monthlyBudgets: { [key: string]: number } = {};
  const categoryBudgets: { [key: string]: number } = {};

  for (let m = 1; m <= 12; m++) {
    const monthKey = `${year}-${String(m).padStart(2, '0')}`;
    monthlyBudgets[monthKey] = 1000000;
  }

  DEFAULT_CATEGORIES.forEach((cat) => {
    if (cat.id !== 'other') {
      categoryBudgets[cat.id] = 100000;
    }
  });
  categoryBudgets['other'] = 200000;

  return {
    year,
    annual: 12000000,
    monthlyBudgets,
    categoryBudgets,
  };
}

export async function getMonthlyBudget(month: string): Promise<number> {
  const budget = await getBudget();
  return budget.monthlyBudgets[month] || 0;
}

export async function getCategoryBudget(categoryId: string): Promise<number> {
  const budget = await getBudget();
  return budget.categoryBudgets[categoryId] || 0;
}

// ==================== 카테고리 ====================

export async function getCategories(): Promise<Category[]> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return DEFAULT_CATEGORIES;

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true });

  if (error || !data || data.length === 0) {
    return DEFAULT_CATEGORIES;
  }

  return (data as CategoryRow[]).map((c) => ({
    id: c.category_id,
    name: c.name,
    icon: c.icon,
    color: c.color,
    keywords: c.keywords || [],
    order: c.sort_order,
  }));
}

export async function saveCategories(categories: Category[]): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  // 기존 카테고리 삭제 후 재삽입
  await supabase.from('categories').delete().eq('user_id', user.id);

  const inserts = categories.map((c) => ({
    user_id: user.id,
    category_id: c.id,
    name: c.name,
    icon: c.icon,
    color: c.color,
    keywords: c.keywords || [],
    sort_order: c.order || 0,
    is_default: false,
  }));

  const { error } = await supabase.from('categories').insert(inserts);

  if (error) {
    console.error('Error saving categories:', error);
    throw error;
  }
}

// ==================== 설정 ====================

export async function getSettings(): Promise<AppSettings> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { defaultCategories: [], homeCategoryOrder: [], lastUpdated: '' };
  }

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    return { defaultCategories: [], homeCategoryOrder: [], lastUpdated: '' };
  }

  return {
    defaultCategories: [],
    homeCategoryOrder: data.home_category_order || [],
    lastUpdated: data.updated_at,
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('user_settings').upsert({
    user_id: user.id,
    home_category_order: settings.homeCategoryOrder,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
}

export async function getHomeCategoryOrder(): Promise<string[]> {
  const settings = await getSettings();
  return settings.homeCategoryOrder || [];
}

export async function saveHomeCategoryOrder(order: string[]): Promise<void> {
  const settings = await getSettings();
  settings.homeCategoryOrder = order;
  settings.lastUpdated = new Date().toISOString();
  await saveSettings(settings);
}

// ==================== 목표 설정 ====================

export interface GoalSettings {
  monthlyIncome: number;
  monthlyFixedExpense: number;
  currentAssets: number;
  goalAmount: number;
  goalMonths: number;
}

export async function getGoalSettings(): Promise<GoalSettings> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      monthlyIncome: 0,
      monthlyFixedExpense: 0,
      currentAssets: 0,
      goalAmount: 100000000,
      goalMonths: 60,
    };
  }

  const { data, error } = await supabase
    .from('user_settings')
    .select('monthly_income, monthly_fixed_expense, current_assets, goal_amount, goal_months')
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    return {
      monthlyIncome: 0,
      monthlyFixedExpense: 0,
      currentAssets: 0,
      goalAmount: 100000000,
      goalMonths: 60,
    };
  }

  return {
    monthlyIncome: data.monthly_income || 0,
    monthlyFixedExpense: data.monthly_fixed_expense || 0,
    currentAssets: data.current_assets || 0,
    goalAmount: data.goal_amount || 100000000,
    goalMonths: data.goal_months || 60,
  };
}

export async function saveGoalSettings(goal: GoalSettings): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('user_settings').upsert({
    user_id: user.id,
    monthly_income: goal.monthlyIncome,
    monthly_fixed_expense: goal.monthlyFixedExpense,
    current_assets: goal.currentAssets,
    goal_amount: goal.goalAmount,
    goal_months: goal.goalMonths,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Error saving goal settings:', error);
    throw error;
  }
}

// ==================== 통계 계산 ====================

export async function getMonthlyTotal(month: string): Promise<number> {
  const expenses = await getExpensesByMonth(month);
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

export async function getCategoryTotal(
  month: string,
  categoryId: string
): Promise<number> {
  const expenses = await getExpensesByMonth(month);
  return expenses
    .filter((e) => e.category === categoryId)
    .reduce((sum, e) => sum + e.amount, 0);
}

export async function getMonthlySummary(month: string) {
  const budget = await getBudget();
  const monthlyBudget = budget.monthlyBudgets[month] || 0;
  const totalSpent = await getMonthlyTotal(month);
  const remaining = monthlyBudget - totalSpent;
  const usageRate = monthlyBudget > 0 ? (totalSpent / monthlyBudget) * 100 : 0;

  const categoryBreakdown: {
    [key: string]: {
      budget: number;
      spent: number;
      remaining: number;
      usageRate: number;
    };
  } = {};

  const categories = await getCategories();
  for (const cat of categories) {
    const catBudget = budget.categoryBudgets[cat.id] || 0;
    const catSpent = await getCategoryTotal(month, cat.id);
    categoryBreakdown[cat.id] = {
      budget: catBudget,
      spent: catSpent,
      remaining: catBudget - catSpent,
      usageRate: catBudget > 0 ? (catSpent / catBudget) * 100 : 0,
    };
  }

  return {
    month,
    totalBudget: monthlyBudget,
    totalSpent,
    remaining,
    usageRate,
    categoryBreakdown,
  };
}

export async function getQuarterlyTotal(
  year: number,
  quarter: 1 | 2 | 3 | 4
): Promise<number> {
  const startMonth = (quarter - 1) * 3 + 1;
  const months = [startMonth, startMonth + 1, startMonth + 2];

  let total = 0;
  for (const m of months) {
    const monthKey = `${year}-${String(m).padStart(2, '0')}`;
    total += await getMonthlyTotal(monthKey);
  }
  return total;
}

export async function getHalfYearTotal(
  year: number,
  half: 1 | 2
): Promise<number> {
  const startMonth = half === 1 ? 1 : 7;
  let total = 0;
  for (let m = startMonth; m < startMonth + 6; m++) {
    const monthKey = `${year}-${String(m).padStart(2, '0')}`;
    total += await getMonthlyTotal(monthKey);
  }
  return total;
}

export async function getYearlyTotal(year: number): Promise<number> {
  let total = 0;
  for (let m = 1; m <= 12; m++) {
    const monthKey = `${year}-${String(m).padStart(2, '0')}`;
    total += await getMonthlyTotal(monthKey);
  }
  return total;
}

export async function getExpectedSpendingRange(
  month: string
): Promise<{ min: number; max: number; current: number }> {
  const budget = await getMonthlyBudget(month);
  const today = new Date();
  const currentMonth = month === getCurrentMonth();

  if (!currentMonth) {
    return { min: 0, max: budget, current: budget };
  }

  const daysInMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0
  ).getDate();
  const dayOfMonth = today.getDate();
  const progressRate = dayOfMonth / daysInMonth;

  const expected = budget * progressRate;
  const margin = budget * 0.1;

  return {
    min: Math.max(0, expected - margin),
    max: expected + margin,
    current: expected,
  };
}

export async function getSpendingStatus(
  month: string
): Promise<'under' | 'normal' | 'over'> {
  const { max } = await getExpectedSpendingRange(month);
  const spent = await getMonthlyTotal(month);

  if (spent < max * 0.9) return 'under';
  if (spent > max * 1.1) return 'over';
  return 'normal';
}

// ==================== 이미지 Storage ====================

const RECEIPT_BUCKET = 'receipt-images';

/**
 * 영수증/캡쳐 이미지를 Supabase Storage에 업로드
 * @param file - 업로드할 파일 (File 또는 Blob)
 * @param fileName - 파일명 (선택, 기본값은 timestamp 기반)
 * @returns 업로드된 이미지의 Storage 경로 (user_id/filename)
 */
export async function uploadReceiptImage(
  file: File | Blob,
  fileName?: string
): Promise<string> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  // 파일명 생성: user_id/timestamp_random.확장자
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = file.type.split('/')[1] || 'jpg';
  const finalFileName = fileName || `${timestamp}_${random}.${extension}`;
  const filePath = `${user.id}/${finalFileName}`;

  const { error } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error('Error uploading image:', error);
    throw error;
  }

  return filePath;
}

/**
 * Storage 경로로부터 서명된 URL 생성 (1시간 유효)
 * @param filePath - Storage 경로 (user_id/filename)
 * @returns 서명된 URL
 */
export async function getReceiptImageUrl(filePath: string): Promise<string | null> {
  if (!filePath) return null;

  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // 보안: 자신의 이미지만 접근 가능
  if (!filePath.startsWith(user.id)) {
    console.error('Unauthorized access to image');
    return null;
  }

  const { data, error } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrl(filePath, 3600); // 1시간

  if (error) {
    console.error('Error getting signed URL:', error);
    return null;
  }

  return data?.signedUrl || null;
}

/**
 * Storage에서 이미지 삭제
 * @param filePath - Storage 경로 (user_id/filename)
 */
export async function deleteReceiptImage(filePath: string): Promise<void> {
  if (!filePath) return;

  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  // 보안: 자신의 이미지만 삭제 가능
  if (!filePath.startsWith(user.id)) {
    throw new Error('Unauthorized');
  }

  const { error } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .remove([filePath]);

  if (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
}
