'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  getCurrentMonth,
  getMonthlySummary,
  getBudget,
  getSpendingStatus,
} from '@/lib/storage'
import { formatCurrency, formatMonth, getDaysRemaining } from '@/lib/utils'
import { getCategoryById } from '@/constants/categories'

export default function HomePage() {
  const [currentMonth] = useState(getCurrentMonth())
  const [summary, setSummary] = useState<ReturnType<typeof getMonthlySummary> | null>(null)
  const [budget, setBudget] = useState<ReturnType<typeof getBudget> | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [currentMonth])

  const loadData = () => {
    const summaryData = getMonthlySummary(currentMonth)
    const budgetData = getBudget()
    setSummary(summaryData)
    setBudget(budgetData)
    setIsLoading(false)
  }

  if (isLoading || !summary || !budget) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    )
  }

  const spendingStatus = getSpendingStatus(currentMonth)
  const daysRemaining = getDaysRemaining()
  const dailyBudget = daysRemaining > 0 ? Math.floor(summary.remaining / daysRemaining) : 0
  const percentUsed = summary.totalBudget > 0 ? (summary.totalSpent / summary.totalBudget) * 100 : 0

  // 상위 3개 카테고리
  const topCategories = Object.entries(summary.categoryBreakdown)
    .filter(([_, data]) => data.spent > 0)
    .sort((a, b) => b[1].spent - a[1].spent)
    .slice(0, 3)
    .map(([id, data]) => ({
      ...getCategoryById(id),
      spent: data.spent,
    }))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 영역 */}
      <div className="bg-blue-600 text-white px-4 pt-6 pb-20">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-lg font-medium">{formatMonth(currentMonth)}</h1>
          <Link href="/budget" className="text-white/80 text-sm">
            예산 설정 →
          </Link>
        </div>

        {/* 메인 금액 */}
        <div className="text-center">
          <p className="text-white/70 text-sm mb-1">이번 달 지출</p>
          <p className="text-4xl font-bold">{formatCurrency(summary.totalSpent)}</p>
          <p className="text-white/70 text-sm mt-2">
            예산 {formatCurrency(summary.totalBudget)} 중 {Math.round(percentUsed)}% 사용
          </p>
        </div>
      </div>

      {/* 카드 영역 - 겹치는 디자인 */}
      <div className="px-4 -mt-12 space-y-4 pb-24">
        {/* 남은 예산 카드 */}
        <div className="card p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm">남은 예산</p>
              <p className={`text-2xl font-bold mt-1 ${summary.remaining < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {formatCurrency(summary.remaining)}
              </p>
            </div>
            <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              spendingStatus === 'under' ? 'bg-green-100 text-green-700' :
              spendingStatus === 'normal' ? 'bg-blue-100 text-blue-700' :
              'bg-red-100 text-red-700'
            }`}>
              {spendingStatus === 'under' ? '절약 중' :
               spendingStatus === 'normal' ? '적정' : '초과'}
            </div>
          </div>

          {/* 진행 바 */}
          <div className="mt-4">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  percentUsed > 100 ? 'bg-red-500' :
                  percentUsed > 80 ? 'bg-yellow-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(percentUsed, 100)}%` }}
              />
            </div>
          </div>

          {/* 하루 사용 가능 금액 */}
          {daysRemaining > 0 && summary.remaining > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
              <span className="text-gray-500 text-sm">하루 사용 가능</span>
              <span className="font-semibold text-blue-600">{formatCurrency(dailyBudget)}</span>
            </div>
          )}
        </div>

        {/* 카테고리별 지출 요약 */}
        {topCategories.length > 0 && (
          <div className="card p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-900">카테고리별 지출</h2>
              <Link href="/expenses" className="text-blue-600 text-sm">
                전체보기
              </Link>
            </div>
            <div className="space-y-3">
              {topCategories.map((cat) => (
                <div key={cat?.id} className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cat?.color || 'bg-gray-500'} bg-opacity-20`}>
                    <span>{cat?.icon}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{cat?.name}</p>
                  </div>
                  <p className="font-semibold text-gray-900">{formatCurrency(cat?.spent || 0)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 빠른 입력 버튼 */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/add/photo" className="card p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-2xl">📷</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">사진 입력</p>
              <p className="text-xs text-gray-500">캡쳐로 빠르게</p>
            </div>
          </Link>
          <Link href="/add/manual" className="card p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-2xl">✏️</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">직접 입력</p>
              <p className="text-xs text-gray-500">금액 입력</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
