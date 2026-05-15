'use client'

import { useState, useEffect } from 'react'
import { getBudget, saveBudget, getCurrentMonth, getMonthlySummary } from '@/lib/storage'
import { formatCurrency, formatMonth } from '@/lib/utils'
import { DEFAULT_CATEGORIES } from '@/constants/categories'
import type { Budget } from '@/types'

export default function BudgetPage() {
  const [budget, setBudgetState] = useState<Budget | null>(null)
  const [editingMonthly, setEditingMonthly] = useState('')
  const [editingCategories, setEditingCategories] = useState<{ [key: string]: string }>({})
  const [isEditing, setIsEditing] = useState(false)

  const currentMonth = getCurrentMonth()

  useEffect(() => {
    loadBudget()
  }, [])

  const loadBudget = () => {
    const data = getBudget()
    setBudgetState(data)
    setEditingMonthly(String(data.monthlyBudgets[currentMonth] || 0))

    const catBudgets: { [key: string]: string } = {}
    DEFAULT_CATEGORIES.forEach(cat => {
      catBudgets[cat.id] = String(data.categoryBudgets[cat.id] || 0)
    })
    setEditingCategories(catBudgets)
  }

  const handleSave = () => {
    if (!budget) return

    const monthlyAmount = parseInt(editingMonthly) || 0

    const newBudget: Budget = {
      ...budget,
      annual: monthlyAmount * 12,
      monthlyBudgets: {
        ...budget.monthlyBudgets,
        [currentMonth]: monthlyAmount,
      },
      categoryBudgets: Object.fromEntries(
        Object.entries(editingCategories).map(([key, value]) => [key, parseInt(value) || 0])
      ),
    }

    saveBudget(newBudget)
    setBudgetState(newBudget)
    setIsEditing(false)
  }

  if (!budget) {
    return <div className="p-4 text-gray-500">로딩 중...</div>
  }

  const summary = getMonthlySummary(currentMonth)
  const percentUsed = summary.totalBudget > 0 ? (summary.totalSpent / summary.totalBudget) * 100 : 0

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 헤더 */}
      <div className="bg-white p-4 border-b">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">예산 설정</h1>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
            >
              수정
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsEditing(false)
                  loadBudget()
                }}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
              >
                저장
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 이번 달 예산 요약 */}
        <div className="card p-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-500 text-sm">{formatMonth(currentMonth)}</p>
              {isEditing ? (
                <div className="relative inline-block mt-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editingMonthly}
                    onChange={(e) => setEditingMonthly(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-40 text-2xl font-bold text-right pr-8 py-1 border-b-2 border-blue-500 focus:outline-none"
                  />
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 text-lg text-gray-400">원</span>
                </div>
              ) : (
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(summary.totalBudget)}
                </p>
              )}
            </div>
          </div>

          {!isEditing && (
            <>
              {/* 진행 바 */}
              <div className="mb-3">
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      percentUsed > 100 ? 'bg-red-500' :
                      percentUsed > 80 ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(percentUsed, 100)}%` }}
                  />
                </div>
              </div>

              {/* 사용/남은 금액 */}
              <div className="flex justify-between text-sm">
                <div>
                  <span className="text-gray-500">사용</span>
                  <span className="font-semibold ml-2">{formatCurrency(summary.totalSpent)}</span>
                </div>
                <div>
                  <span className="text-gray-500">남음</span>
                  <span className={`font-semibold ml-2 ${summary.remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(summary.remaining)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 카테고리별 예산 */}
        <div className="card p-5">
          <h2 className="font-bold text-gray-900 mb-4">카테고리별 예산</h2>
          <div className="space-y-4">
            {DEFAULT_CATEGORIES.filter(c => c.id !== 'other').map((cat) => {
              const catBudget = budget.categoryBudgets[cat.id] || 0
              const catSpent = summary.categoryBreakdown[cat.id]?.spent || 0
              const catPercent = catBudget > 0 ? (catSpent / catBudget) * 100 : 0

              return (
                <div key={cat.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{cat.icon}</span>
                      <span className="font-medium text-gray-900">{cat.name}</span>
                    </div>
                    {isEditing ? (
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={editingCategories[cat.id] || ''}
                          onChange={(e) => setEditingCategories({
                            ...editingCategories,
                            [cat.id]: e.target.value.replace(/[^0-9]/g, ''),
                          })}
                          className="w-28 text-right pr-6 py-1 text-sm border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">
                        {formatCurrency(catSpent)} / {formatCurrency(catBudget)}
                      </span>
                    )}
                  </div>

                  {!isEditing && catBudget > 0 && (
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${cat.color}`}
                        style={{ width: `${Math.min(catPercent, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 예산 팁 */}
        {!isEditing && (
          <div className="p-4 bg-blue-50 rounded-xl">
            <p className="text-sm text-blue-700">
              💡 <strong>팁:</strong> 카테고리별 예산을 설정하면 지출 패턴을 더 잘 관리할 수 있어요!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
