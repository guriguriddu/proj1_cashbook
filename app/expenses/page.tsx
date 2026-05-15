'use client'

import { useState, useEffect } from 'react'
import { getExpensesByMonth, deleteExpense, getCurrentMonth, updateExpense } from '@/lib/storage'
import { formatMonth, formatCurrency, groupByDate, formatDateShort, getDayOfWeek, getPreviousMonth, getNextMonth } from '@/lib/utils'
import { DEFAULT_CATEGORIES, getCategoryById } from '@/constants/categories'
import type { Expense } from '@/types'

export default function ExpensesPage() {
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth())
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

  useEffect(() => {
    loadExpenses()
  }, [currentMonth])

  const loadExpenses = () => {
    const data = getExpensesByMonth(currentMonth)
    data.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    setExpenses(data)
  }

  const handleDelete = (id: string) => {
    if (confirm('이 지출 내역을 삭제하시겠습니까?')) {
      deleteExpense(id)
      loadExpenses()
    }
  }

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense)
  }

  const handleSaveEdit = (updated: Expense) => {
    updateExpense(updated.id, updated)
    setEditingExpense(null)
    loadExpenses()
  }

  const goToPreviousMonth = () => {
    setCurrentMonth(getPreviousMonth(currentMonth))
  }

  const goToNextMonth = () => {
    setCurrentMonth(getNextMonth(currentMonth))
  }

  // 날짜별 그룹핑
  const groupedExpenses = groupByDate(expenses)
  const sortedDates = Object.keys(groupedExpenses).sort((a, b) => b.localeCompare(a))

  // 총 합계
  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 헤더 */}
      <div className="bg-white sticky top-0 z-10 border-b">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={goToPreviousMonth}
            className="p-2 text-gray-500"
          >
            ←
          </button>
          <h1 className="text-lg font-bold text-gray-900">
            {formatMonth(currentMonth)}
          </h1>
          <button
            onClick={goToNextMonth}
            className="p-2 text-gray-500"
          >
            →
          </button>
        </div>

        {/* 총 합계 */}
        <div className="px-4 pb-4 flex justify-between items-center">
          <span className="text-gray-500">총 지출</span>
          <span className="text-xl font-bold text-gray-900">
            {formatCurrency(totalAmount)}
          </span>
        </div>
      </div>

      {/* 지출 내역 리스트 */}
      <div className="p-4">
        {sortedDates.length > 0 ? (
          <div className="space-y-6">
            {sortedDates.map((date) => {
              const dayExpenses = groupedExpenses[date]
              const dayTotal = dayExpenses.reduce((sum, e) => sum + e.amount, 0)

              return (
                <div key={date}>
                  {/* 날짜 헤더 */}
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-gray-500">
                      {formatDateShort(date)} {getDayOfWeek(date)}요일
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(dayTotal)}
                    </span>
                  </div>

                  {/* 해당 날짜 지출 목록 */}
                  <div className="space-y-2">
                    {dayExpenses.map((expense) => {
                      const category = getCategoryById(expense.category)
                      return (
                        <div
                          key={expense.id}
                          className="card p-4 flex items-center gap-3"
                          onClick={() => handleEdit(expense)}
                        >
                          {/* 카테고리 아이콘 */}
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${category?.color || 'bg-gray-500'} bg-opacity-20`}>
                            <span className="text-lg">{category?.icon || '📦'}</span>
                          </div>

                          {/* 내용 */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {expense.merchant}
                            </p>
                            <p className="text-xs text-gray-500">
                              {category?.name || '기타'}
                            </p>
                          </div>

                          {/* 금액 */}
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(expense.amount)}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">📝</p>
            <p className="text-gray-500 font-medium">이 달에 기록된 지출이 없습니다</p>
            <p className="text-sm text-gray-400 mt-2">
              하단의 입력 버튼으로 지출을 추가해보세요
            </p>
          </div>
        )}
      </div>

      {/* 수정 모달 */}
      {editingExpense && (
        <EditExpenseModal
          expense={editingExpense}
          onSave={handleSaveEdit}
          onDelete={handleDelete}
          onClose={() => setEditingExpense(null)}
        />
      )}
    </div>
  )
}

// 수정 모달 컴포넌트
function EditExpenseModal({
  expense,
  onSave,
  onDelete,
  onClose,
}: {
  expense: Expense
  onSave: (expense: Expense) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const [date, setDate] = useState(expense.date)
  const [amount, setAmount] = useState(String(expense.amount))
  const [merchant, setMerchant] = useState(expense.merchant)
  const [category, setCategory] = useState(expense.category)
  const [memo, setMemo] = useState(expense.memo)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...expense,
      date,
      amount: parseInt(amount) || 0,
      merchant,
      category,
      memo,
    })
  }

  const handleDelete = () => {
    onDelete(expense.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 pb-8 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">지출 수정</h2>
          <button onClick={onClose} className="text-2xl text-gray-400">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">금액</label>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full p-3 border border-gray-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">사용처</label>
            <input
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">카테고리</label>
            <div className="grid grid-cols-4 gap-2">
              {DEFAULT_CATEGORIES.filter(c => c.id !== 'other').map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`p-2 rounded-xl border-2 transition-all ${
                    category === cat.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-100 bg-white'
                  }`}
                >
                  <span className="text-lg block">{cat.icon}</span>
                  <span className={`text-xs mt-0.5 block ${
                    category === cat.id ? 'text-blue-700 font-semibold' : 'text-gray-600'
                  }`}>
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="메모 (선택)"
              className="w-full p-3 border border-gray-200 rounded-lg"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleDelete}
              className="py-3 px-4 border border-red-200 rounded-xl text-red-600"
            >
              삭제
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold"
            >
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
