// 지출 내역 타입
export interface Expense {
  id: string
  date: string // "2025-05-14" 형식
  amount: number // 원 단위
  merchant: string // 사용처 (스타벅스 강남점)
  category: string // 카테고리 ID
  memo: string // 메모
  createdAt: string // ISO timestamp
  source: 'ocr' | 'manual' // 입력 방식
  imageUrl?: string // 영수증/캡쳐 이미지 URL
  payMethod?: string // 결제수단 (뱅크샐러드 엑셀의 카드/계좌명) — 연말정산 소득공제 집계용
}

// 카테고리 타입
export interface Category {
  id: string
  name: string // "식비"
  icon: string // 이모지 "🍽️"
  color: string // tailwind color class
  keywords: string[] // 자동분류용 키워드
  order: number // 정렬 순서
  isCustom?: boolean // 사용자가 직접 추가한 카테고리
}

// 예산 설정 타입
export interface Budget {
  year: number // 2025
  annual: number // 연간 목표
  monthlyBudgets: {
    [month: string]: number // "2025-01": 1000000
  }
  categoryBudgets: {
    [categoryId: string]: number // 기본 예산 (월별 오버라이드 없을 때 적용)
  }
  monthlyCategoryBudgets: {
    [month: string]: { [categoryId: string]: number } // 월별 카테고리 예산 오버라이드
  }
}

// 카테고리 예산 적용 범위
export type BudgetScope = 'this_month' | 'this_and_forward'

// OCR 추출 결과 (검수 전)
export interface ExtractedTransaction {
  id: string
  date: string
  amount: number
  merchant: string
  suggestedCategory: string // 추천 카테고리
  confidence: number // 0-1 신뢰도
  isExcluded: boolean // 제외 여부 (계좌이체 등)
  excludeReason?: string // 제외 사유
  rawText: string // 원본 텍스트
}

// 앱 설정
export interface AppSettings {
  defaultCategories: string[] // 기본 표시할 카테고리 순서
  homeCategoryOrder: string[] // 홈 화면에 표시할 카테고리 ID 순서
  defaultTransferCategory?: string // 타인 이체 기본 카테고리
  lastUpdated: string
}

// 월별 요약 (계산용)
export interface MonthlySummary {
  month: string // "2025-05"
  totalBudget: number
  totalSpent: number
  remaining: number
  usageRate: number // 0-100
  categoryBreakdown: {
    [categoryId: string]: {
      budget: number
      spent: number
      remaining: number
      usageRate: number
    }
  }
}

// 기간별 요약
export interface PeriodSummary {
  period: 'quarter' | 'half' | 'year'
  startMonth: string
  endMonth: string
  totalBudget: number
  totalSpent: number
  remaining: number
  usageRate: number
  monthlyBreakdown: MonthlySummary[]
}
