'use client'

import { cn } from '@/lib/utils'

interface BudgetProgressProps {
  label: string
  spent: number
  budget: number
  icon?: string
  color?: string
  showAmount?: boolean
}

export default function BudgetProgress({
  label,
  spent,
  budget,
  icon,
  color = 'bg-blue-500',
  showAmount = true,
}: BudgetProgressProps) {
  const rate = budget > 0 ? (spent / budget) * 100 : 0
  const remaining = budget - spent
  const isOver = spent > budget

  // 진행률 바 색상
  const barColor = isOver ? 'bg-red-500' : rate > 80 ? 'bg-yellow-500' : color

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          {icon && <span className="text-lg">{icon}</span>}
          <span className="font-medium text-gray-900">{label}</span>
        </div>
        <span className={cn(
          'text-sm font-medium',
          isOver ? 'text-red-600' : 'text-gray-600'
        )}>
          {rate.toFixed(0)}%
        </span>
      </div>

      {/* 진행률 바 */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full progress-bar', barColor)}
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>

      {showAmount && (
        <div className="flex justify-between text-xs text-gray-500">
          <span>
            {spent.toLocaleString()}원 사용
          </span>
          <span className={isOver ? 'text-red-600 font-medium' : ''}>
            {isOver
              ? `${Math.abs(remaining).toLocaleString()}원 초과`
              : `${remaining.toLocaleString()}원 남음`
            }
          </span>
        </div>
      )}
    </div>
  )
}
