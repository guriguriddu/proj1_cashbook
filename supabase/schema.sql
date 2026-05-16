-- =============================================
-- Cashbook App Database Schema
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1. expenses 테이블: 지출 내역
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  amount INTEGER NOT NULL,
  merchant TEXT NOT NULL,
  category_id TEXT NOT NULL,
  memo TEXT DEFAULT '',
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. categories 테이블: 사용자 카테고리
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category_id)
);

-- 3. budgets 테이블: 연간 예산
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  year INTEGER NOT NULL,
  annual INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, year)
);

-- 4. monthly_budgets 테이블: 월별 예산
CREATE TABLE IF NOT EXISTS monthly_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE NOT NULL,
  month TEXT NOT NULL,
  amount INTEGER NOT NULL,
  UNIQUE(budget_id, month)
);

-- 5. category_budgets 테이블: 카테고리별 예산
CREATE TABLE IF NOT EXISTS category_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE NOT NULL,
  category_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  UNIQUE(budget_id, category_id)
);

-- 6. user_settings 테이블: 사용자 설정 (목표 포함)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  home_category_order TEXT[] DEFAULT '{}',
  monthly_income INTEGER DEFAULT 0,
  monthly_fixed_expense INTEGER DEFAULT 0,
  current_assets INTEGER DEFAULT 0,
  goal_amount INTEGER DEFAULT 100000000,
  goal_months INTEGER DEFAULT 60,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Row Level Security (RLS) 정책
-- =============================================

-- expenses RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own expenses"
  ON expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses"
  ON expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses"
  ON expenses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses"
  ON expenses FOR DELETE
  USING (auth.uid() = user_id);

-- categories RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own categories"
  ON categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
  ON categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
  ON categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
  ON categories FOR DELETE
  USING (auth.uid() = user_id);

-- budgets RLS
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own budgets"
  ON budgets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budgets"
  ON budgets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budgets"
  ON budgets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own budgets"
  ON budgets FOR DELETE
  USING (auth.uid() = user_id);

-- monthly_budgets RLS (budgets를 통해 간접 체크)
ALTER TABLE monthly_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own monthly_budgets"
  ON monthly_budgets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = monthly_budgets.budget_id
      AND budgets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own monthly_budgets"
  ON monthly_budgets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = monthly_budgets.budget_id
      AND budgets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own monthly_budgets"
  ON monthly_budgets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = monthly_budgets.budget_id
      AND budgets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own monthly_budgets"
  ON monthly_budgets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = monthly_budgets.budget_id
      AND budgets.user_id = auth.uid()
    )
  );

-- category_budgets RLS
ALTER TABLE category_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own category_budgets"
  ON category_budgets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = category_budgets.budget_id
      AND budgets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own category_budgets"
  ON category_budgets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = category_budgets.budget_id
      AND budgets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own category_budgets"
  ON category_budgets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = category_budgets.budget_id
      AND budgets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own category_budgets"
  ON category_budgets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = category_budgets.budget_id
      AND budgets.user_id = auth.uid()
    )
  );

-- user_settings RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- =============================================
-- 인덱스 (성능 최적화)
-- =============================================

CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_category ON expenses(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_year ON budgets(user_id, year);

-- =============================================
-- 신규 사용자 초기화 함수
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 기본 설정 생성
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);

  -- 기본 카테고리 생성
  INSERT INTO public.categories (user_id, category_id, name, icon, color, keywords, sort_order, is_default)
  VALUES
    (NEW.id, 'food', '식비', '🍽️', 'emerald', ARRAY['식당', '카페', '배달', '마트', '편의점', '스타벅스', '맥도날드', 'CU', 'GS25', '이마트', '쿠팡이츠', '배달의민족', '요기요'], 0, true),
    (NEW.id, 'transport', '교통', '🚌', 'blue', ARRAY['택시', '버스', '지하철', '주유', '카카오택시', 'T머니', '주차'], 1, true),
    (NEW.id, 'shopping', '쇼핑', '🛍️', 'pink', ARRAY['쇼핑', '의류', '잡화', '쿠팡', '네이버', '무신사', '올리브영'], 2, true),
    (NEW.id, 'entertainment', '여가', '🎬', 'purple', ARRAY['영화', '게임', 'CGV', '메가박스', '넷플릭스', '스포티파이'], 3, true),
    (NEW.id, 'health', '건강', '💊', 'red', ARRAY['병원', '약국', '헬스', '의료', '치과', '안과'], 4, true),
    (NEW.id, 'education', '교육', '📚', 'amber', ARRAY['학원', '교육', '강의', '도서', '클래스101'], 5, true),
    (NEW.id, 'living', '생활', '🏠', 'teal', ARRAY['통신', '공과금', '보험', 'SKT', 'KT', 'LG'], 6, true),
    (NEW.id, 'other', '기타', '📦', 'gray', ARRAY[]::TEXT[], 7, true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거: 새 사용자 가입 시 자동 초기화
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
