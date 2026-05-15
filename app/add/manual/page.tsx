'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveExpense, generateId, getTodayDate } from '@/lib/storage'
import { DEFAULT_CATEGORIES } from '@/constants/categories'
import { formatCurrency } from '@/lib/utils'
import type { Expense } from '@/types'

type Step = 'amount' | 'details'

export default function ManualAddPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('amount')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(getTodayDate())
  const [merchant, setMerchant] = useState('')
  const [category, setCategory] = useState('food')
  const [memo, setMemo] = useState('')

  // 숫자 키패드 입력
  const handleKeyPress = (key: string) => {
    if (key === 'backspace') {
      setAmount(prev => prev.slice(0, -1))
    } else if (key === 'clear') {
      setAmount('')
    } else if (key === '00') {
      if (amount.length > 0 && amount.length <= 8) {
        setAmount(prev => prev + '00')
      }
    } else {
      if (amount.length < 10) {
        setAmount(prev => prev + key)
      }
    }
  }

  // 다음 단계로
  const handleNext = () => {
    if (!amount || parseInt(amount) <= 0) {
      return
    }
    setStep('details')
  }

  // 저장
  const handleSubmit = () => {
    if (!merchant.trim()) {
      alert('사용처를 입력해주세요')
      return
    }

    const expense: Expense = {
      id: generateId(),
      date,
      amount: parseInt(amount),
      merchant: merchant.trim(),
      category,
      memo: memo.trim(),
      createdAt: new Date().toISOString(),
      source: 'manual',
    }

    saveExpense(expense)
    router.push('/expenses')
  }

  const displayAmount = amount ? parseInt(amount) : 0

  // 금액 입력 단계
  if (step === 'amount') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* 헤더 */}
        <header className="p-4">
          <button onClick={() => router.back()} className="text-gray-500">
            ← 뒤로
          </button>
        </header>

        {/* 금액 표시 */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <p className="text-gray-500 mb-2">얼마를 썼나요?</p>
          <div className="text-4xl font-bold text-gray-900">
            {formatCurrency(displayAmount)}
          </div>
        </div>

        {/* 숫자 키패드 */}
        <div className="bg-white border-t p-4 pb-8">
          <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'backspace'].map((key) => (
              <button
                key={key}
                onClick={() => handleKeyPress(key)}
                className={`h-14 rounded-xl text-xl font-medium transition-colors ${
                  key === 'backspace'
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-gray-50 text-gray-900 active:bg-gray-200'
                }`}
              >
                {key === 'backspace' ? '⌫' : key}
              </button>
            ))}
          </div>

          {/* 다음 버튼 */}
          <button
            onClick={handleNext}
            disabled={!amount || parseInt(amount) <= 0}
            className={`w-full mt-4 py-4 rounded-xl font-semibold text-white ${
              !amount || parseInt(amount) <= 0
                ? 'bg-gray-300'
                : 'bg-blue-600'
            }`}
          >
            다음
          </button>
        </div>
      </div>
    )
  }

  // 상세 정보 입력 단계
  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* 헤더 */}
      <header className="p-4 bg-white border-b">
        <button onClick={() => setStep('amount')} className="text-gray-500">
          ← 뒤로
        </button>
        <div className="mt-2">
          <p className="text-sm text-gray-500">지출 금액</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(displayAmount)}</p>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* 날짜 */}
        <div className="card p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            날짜
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-lg"
          />
        </div>

        {/* 사용처 */}
        <div className="card p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            사용처
          </label>
          <input
            type="text"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="어디서 썼나요?"
            className="w-full p-3 border border-gray-200 rounded-lg"
          />
        </div>

        {/* 카테고리 */}
        <div className="card p-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            카테고리
          </label>
          <div className="grid grid-cols-4 gap-2">
            {DEFAULT_CATEGORIES.filter(c => c.id !== 'other').map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`p-3 rounded-xl border-2 transition-all ${
                  category === cat.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-100 bg-white'
                }`}
              >
                <span className="text-xl block">{cat.icon}</span>
                <span className={`text-xs mt-1 block ${
                  category === cat.id ? 'text-blue-700 font-semibold' : 'text-gray-600'
                }`}>
                  {cat.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 메모 */}
        <div className="card p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            메모 <span className="text-gray-400 font-normal">(선택)</span>
          </label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="메모를 입력하세요"
            className="w-full p-3 border border-gray-200 rounded-lg"
          />
        </div>
      </div>

      {/* 저장 버튼 */}
      <div className="fixed bottom-20 left-0 right-0 bg-white border-t p-4">
        <button
          onClick={handleSubmit}
          disabled={!merchant.trim()}
          className={`w-full py-4 rounded-xl font-semibold text-white ${
            !merchant.trim()
              ? 'bg-gray-300'
              : 'bg-blue-600'
          }`}
        >
          저장하기
        </button>
      </div>
    </div>
  )
}
