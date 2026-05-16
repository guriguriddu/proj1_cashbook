'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import * as storage from '@/lib/supabase-storage';
import { Expense, Budget, Category } from '@/types';
import { GoalSettings } from '@/lib/supabase-storage';

// ==================== 지출 내역 ====================

export function useExpenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await storage.getExpenses();
      setExpenses(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async (expense: Expense) => {
    await storage.saveExpense(expense);
    await refresh();
  };

  const saveMultiple = async (newExpenses: Expense[]) => {
    await storage.saveExpenses(newExpenses);
    await refresh();
  };

  const update = async (id: string, updates: Partial<Expense>) => {
    await storage.updateExpense(id, updates);
    await refresh();
  };

  const remove = async (id: string) => {
    await storage.deleteExpense(id);
    await refresh();
  };

  return {
    expenses,
    loading,
    error,
    refresh,
    save,
    saveMultiple,
    update,
    remove,
  };
}

export function useExpensesByMonth(month: string) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await storage.getExpensesByMonth(month);
      setExpenses(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, month]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { expenses, loading, refresh };
}

// ==================== 예산 ====================

export function useBudget() {
  const { user } = useAuth();
  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await storage.getBudget();
      setBudget(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async (newBudget: Budget) => {
    await storage.saveBudget(newBudget);
    await refresh();
  };

  return { budget, loading, refresh, save };
}

// ==================== 카테고리 ====================

export function useCategories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await storage.getCategories();
      setCategories(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async (newCategories: Category[]) => {
    await storage.saveCategories(newCategories);
    await refresh();
  };

  return { categories, loading, refresh, save };
}

// ==================== 목표 설정 ====================

export function useGoalSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<GoalSettings>({
    monthlyIncome: 0,
    monthlyFixedExpense: 0,
    currentAssets: 0,
    goalAmount: 100000000,
    goalMonths: 60,
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await storage.getGoalSettings();
      setSettings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async (newSettings: GoalSettings) => {
    await storage.saveGoalSettings(newSettings);
    await refresh();
  };

  return { settings, loading, refresh, save };
}

// ==================== 월별 요약 ====================

export function useMonthlySummary(month: string) {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Awaited<
    ReturnType<typeof storage.getMonthlySummary>
  > | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await storage.getMonthlySummary(month);
      setSummary(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, month]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { summary, loading, refresh };
}

// ==================== 통계 ====================

export function useMonthlyTotal(month: string) {
  const { user } = useAuth();
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    storage
      .getMonthlyTotal(month)
      .then(setTotal)
      .finally(() => setLoading(false));
  }, [user, month]);

  return { total, loading };
}

export function useYearlyTotal(year: number) {
  const { user } = useAuth();
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    storage
      .getYearlyTotal(year)
      .then(setTotal)
      .finally(() => setLoading(false));
  }, [user, year]);

  return { total, loading };
}

// ==================== 홈 카테고리 순서 ====================

export function useHomeCategoryOrder() {
  const { user } = useAuth();
  const [order, setOrder] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await storage.getHomeCategoryOrder();
      setOrder(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async (newOrder: string[]) => {
    await storage.saveHomeCategoryOrder(newOrder);
    setOrder(newOrder);
  };

  return { order, loading, refresh, save };
}
