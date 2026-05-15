'use client'

import { getCategoryById } from '@/constants/categories'
import { formatCurrency, formatDateCompact, getDayOfWeek } from '@/lib/utils'
import type { Expense } from '@/types'

interface ExpenseCardProps {
  expense: Expense
  onEdit?: (expense: Expense) => void
  onDelete?: (id: string) => void
}

export default function ExpenseCard({ expense, onEdit, onDelete }: ExpenseCardProps) {
  const category = getCategoryById(expense.category)

  return (
    <div className="card p-4 flex items-center gap-3">
      {/* 카테고리 아이콘 */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${category?.color || 'bg-gray-500'} bg-opacity-20`}>
        <span className="text-lg">{category?.icon || '📦'}</span>
      </div>

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 truncate">
            {expense.merchant}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
          <span>{formatDateCompact(expense.date)} ({getDayOfWeek(expense.date)})</span>
          <span>·</span>
          <span>{category?.name || '기타'}</span>
          {expense.memo && (
            <>
              <span>·</span>
              <span className="truncate">{expense.memo}</span>
            </>
          )}
        </div>
      </div>

      {/* 금액 */}
      <div className="text-right">
        <span className="font-semibold text-gray-900">
          {formatCurrency(expense.amount)}
        </span>
      </div>

      {/* 액션 버튼 (옵션) */}
      {(onEdit || onDelete) && (
        <div className="flex gap-1 ml-2">
          {onEdit && (
            <button
              onClick={() => onEdit(expense)}
              className="p-2 text-gray-400 hover:text-blue-500"
            >
              ✏️
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(expense.id)}
              className="p-2 text-gray-400 hover:text-red-500"
            >
              🗑️
            </button>
          )}
        </div>
      )}
    </div>
  )
}
