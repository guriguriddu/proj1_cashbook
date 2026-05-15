'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  getMonthlySummary,
  getCurrentMonth,
  getHomeCategoryOrder,
  saveHomeCategoryOrder,
  getBudget
} from '@/lib/storage'
import { formatCurrency } from '@/lib/utils'
import { DEFAULT_CATEGORIES, getCategoryById } from '@/constants/categories'
import BudgetProgress from '@/components/BudgetProgress'

export default function CategoriesPage() {
  const router = useRouter()
  const [summary, setSummary] = useState<ReturnType<typeof getMonthlySummary> | null>(null)
  const [isEditingOrder, setIsEditingOrder] = useState(false)
  const [homeOrder, setHomeOrder] = useState<string[]>([])
  const [draggedItem, setDraggedItem] = useState<string | null>(null)

  const currentMonth = getCurrentMonth()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    const summaryData = getMonthlySummary(currentMonth)
    setSummary(summaryData)

    const savedOrder = getHomeCategoryOrder()
    if (savedOrder.length > 0) {
      setHomeOrder(savedOrder)
    } else {
      // 기본값: 상위 5개 카테고리
      setHomeOrder(DEFAULT_CATEGORIES.filter(c => c.id !== 'other').slice(0, 5).map(c => c.id))
    }
  }

  const handleSaveOrder = () => {
    saveHomeCategoryOrder(homeOrder)
    setIsEditingOrder(false)
    alert('홈 화면 카테고리 순서가 저장되었습니다.')
  }

  const handleToggleCategory = (categoryId: string) => {
    if (homeOrder.includes(categoryId)) {
      setHomeOrder(homeOrder.filter(id => id !== categoryId))
    } else {
      setHomeOrder([...homeOrder, categoryId])
    }
  }

  const handleMoveUp = (categoryId: string) => {
    const index = homeOrder.indexOf(categoryId)
    if (index > 0) {
      const newOrder = [...homeOrder]
      ;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
      setHomeOrder(newOrder)
    }
  }

  const handleMoveDown = (categoryId: string) => {
    const index = homeOrder.indexOf(categoryId)
    if (index < homeOrder.length - 1) {
      const newOrder = [...homeOrder]
      ;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
      setHomeOrder(newOrder)
    }
  }

  if (!summary) {
    return <div className="p-4 text-gray-500">로딩 중...</div>
  }

  // 카테고리별 데이터 (사용금액 많은 순 정렬)
  const categoryData = DEFAULT_CATEGORIES
    .filter(cat => cat.id !== 'other')
    .map(cat => ({
      ...cat,
      spent: summary.categoryBreakdown[cat.id]?.spent || 0,
      budget: summary.categoryBreakdown[cat.id]?.budget || 0,
    }))
    .sort((a, b) => b.spent - a.spent)

  return (
    <div className="p-4">
      {/* 헤더 */}
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">카테고리</h1>
          <p className="text-sm text-gray-500">전체 카테고리 현황</p>
        </div>
        <button
          onClick={() => router.back()}
          className="text-gray-500"
        >
          ✕
        </button>
      </header>

      {/* 홈 화면 카테고리 순서 설정 */}
      <div className="card p-4 mb-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-gray-900">홈 화면 표시 설정</h2>
          {!isEditingOrder ? (
            <button
              onClick={() => setIsEditingOrder(true)}
              className="text-sm text-blue-600 font-medium"
            >
              편집
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsEditingOrder(false)
                  loadData() // 원래 값으로 복원
                }}
                className="text-sm text-gray-500"
              >
                취소
              </button>
              <button
                onClick={handleSaveOrder}
                className="text-sm text-blue-600 font-medium"
              >
                저장
              </button>
            </div>
          )}
        </div>

        {isEditingOrder ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 mb-3">
              홈 화면에 표시할 카테고리를 선택하고 순서를 조정하세요
            </p>

            {/* 선택된 카테고리 (순서 조정 가능) */}
            {homeOrder.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-600 mb-2">표시할 카테고리 (순서대로)</p>
                <div className="space-y-1">
                  {homeOrder.map((catId, index) => {
                    const cat = getCategoryById(catId)
                    if (!cat) return null
                    return (
                      <div
                        key={catId}
                        className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-200"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 text-xs w-4">{index + 1}</span>
                          <span>{cat.icon}</span>
                          <span className="text-sm font-medium">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleMoveUp(catId)}
                            disabled={index === 0}
                            className={`p-1 ${index === 0 ? 'text-gray-300' : 'text-gray-500'}`}
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => handleMoveDown(catId)}
                            disabled={index === homeOrder.length - 1}
                            className={`p-1 ${index === homeOrder.length - 1 ? 'text-gray-300' : 'text-gray-500'}`}
                          >
                            ▼
                          </button>
                          <button
                            onClick={() => handleToggleCategory(catId)}
                            className="p-1 text-red-500 ml-2"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 선택되지 않은 카테고리 */}
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">추가 가능한 카테고리</p>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_CATEGORIES
                  .filter(cat => cat.id !== 'other' && !homeOrder.includes(cat.id))
                  .map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => handleToggleCategory(cat.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-full text-sm"
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                      <span className="text-blue-500 ml-1">+</span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {homeOrder.map((catId, index) => {
              const cat = getCategoryById(catId)
              if (!cat) return null
              return (
                <span
                  key={catId}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 rounded-full text-sm border border-blue-200"
                >
                  <span className="text-xs text-gray-400">{index + 1}</span>
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* 전체 카테고리 현황 (사용금액 순) */}
      <div className="card p-4">
        <h2 className="font-bold text-gray-900 mb-4">이번 달 카테고리별 현황</h2>
        <p className="text-xs text-gray-500 mb-4">사용금액이 많은 순서로 정렬됩니다</p>

        <div className="space-y-4">
          {categoryData.map((cat) => (
            <div key={cat.id}>
              <BudgetProgress
                label={cat.name}
                icon={cat.icon}
                spent={cat.spent}
                budget={cat.budget}
                color={cat.color}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 기타 카테고리 */}
      <div className="card p-4 mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📦</span>
            <span className="font-medium text-gray-900">기타</span>
          </div>
          <span className="font-semibold">
            {formatCurrency(summary.categoryBreakdown['other']?.spent || 0)}
          </span>
        </div>
      </div>
    </div>
  )
}
