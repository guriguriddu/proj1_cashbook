'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { parseOcrText, performOcr, mockOcrExtraction, parseGeminiResponse, OcrProgressCallback } from '@/lib/ocr'
import { saveExpenses, generateId } from '@/lib/storage'
import { formatCurrency, formatDateShort, getDayOfWeek } from '@/lib/utils'
import { DEFAULT_CATEGORIES, getCategoryById } from '@/constants/categories'
import type { ExtractedTransaction, Expense } from '@/types'

type Step = 'upload' | 'processing' | 'review'

export default function UploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [transactions, setTransactions] = useState<ExtractedTransaction[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrStatus, setOcrStatus] = useState('이미지 분석 중...')

  // 이미지 업로드 처리
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setStep('processing')
    setOcrProgress(0)
    setOcrStatus('이미지 분석 준비 중...')

    try {
      // OCR 처리 (진행 상태 콜백 포함)
      const handleProgress: OcrProgressCallback = (progress, status) => {
        setOcrProgress(progress)
        setOcrStatus(status)
      }

      const ocrText = await performOcr(file, handleProgress)
      setOcrStatus('텍스트 파싱 중...')

      // Gemini 응답 형식으로 파싱 시도, 실패하면 기존 방식 시도
      let extracted = parseGeminiResponse(ocrText)
      if (extracted.length === 0) {
        extracted = parseOcrText(ocrText)
      }

      // 그래도 없으면 데모 데이터 사용 (개발 중)
      if (extracted.length === 0) {
        setTransactions(mockOcrExtraction())
      } else {
        setTransactions(extracted)
      }

      setStep('review')
    } catch (error) {
      console.error('OCR 처리 실패:', error)
      alert('이미지 처리에 실패했습니다. 다시 시도해주세요.')
      setStep('upload')
    }
  }

  // 데모 데이터 사용
  const handleUseDemoData = () => {
    setTransactions(mockOcrExtraction())
    setStep('review')
  }

  // 거래 내역 수정
  const handleUpdateTransaction = (id: string, updates: Partial<ExtractedTransaction>) => {
    setTransactions(prev =>
      prev.map(t => (t.id === id ? { ...t, ...updates } : t))
    )
    setEditingId(null)
  }

  // 제외 토글
  const handleToggleExclude = (id: string) => {
    setTransactions(prev =>
      prev.map(t => (t.id === id ? { ...t, isExcluded: !t.isExcluded } : t))
    )
  }

  // 저장
  const handleSave = () => {
    const expensesToSave: Expense[] = transactions
      .filter(t => !t.isExcluded)
      .map(t => ({
        id: generateId(),
        date: t.date,
        amount: t.amount,
        merchant: t.merchant,
        category: t.suggestedCategory === 'exclude' ? 'other' : t.suggestedCategory,
        memo: '',
        createdAt: new Date().toISOString(),
        source: 'ocr' as const,
      }))

    if (expensesToSave.length === 0) {
      alert('저장할 지출 내역이 없습니다.')
      return
    }

    saveExpenses(expensesToSave)
    alert(`${expensesToSave.length}건의 지출이 저장되었습니다.`)
    router.push('/expenses')
  }

  // 업로드 단계
  if (step === 'upload') {
    return (
      <div className="p-4">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">캡쳐 업로드</h1>
          <p className="text-sm text-gray-500 mt-1">
            토스, 카드 내역, 영수증 이미지를 업로드하세요
          </p>
        </header>

        {/* 업로드 영역 */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="card p-8 flex flex-col items-center justify-center min-h-[200px] border-2 border-dashed border-gray-300 cursor-pointer hover:border-blue-400 transition-colors"
        >
          <span className="text-5xl mb-4">📷</span>
          <p className="font-medium text-gray-900">이미지 선택</p>
          <p className="text-sm text-gray-500 mt-1">카메라 또는 갤러리에서 선택</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* 안내 */}
        <div className="mt-6 space-y-3">
          <h2 className="font-medium text-gray-900">지원하는 이미지</h2>
          <ul className="text-sm text-gray-600 space-y-2">
            <li className="flex items-center gap-2">
              <span>✅</span> 토스 사용내역 캡쳐
            </li>
            <li className="flex items-center gap-2">
              <span>✅</span> 카드 결제 내역 캡쳐
            </li>
            <li className="flex items-center gap-2">
              <span>✅</span> 영수증 사진
            </li>
          </ul>
        </div>

        {/* 데모 버튼 (개발 중) */}
        <button
          onClick={handleUseDemoData}
          className="w-full mt-6 py-3 border border-gray-200 rounded-xl text-gray-700 text-sm"
        >
          데모 데이터로 테스트해보기
        </button>
      </div>
    )
  }

  // 처리 중
  if (step === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-medium text-gray-900">{ocrStatus}</p>
        <p className="text-sm text-gray-500 mt-1">잠시만 기다려주세요</p>

        {/* 진행 상태 바 */}
        <div className="w-full max-w-xs mt-6">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${ocrProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 text-center mt-2">{ocrProgress}%</p>
        </div>

        <p className="text-xs text-gray-400 mt-4 text-center">
          처음 실행 시 언어 데이터를 다운로드하므로<br />
          시간이 조금 걸릴 수 있습니다
        </p>
      </div>
    )
  }

  // 검수 단계
  const includedCount = transactions.filter(t => !t.isExcluded).length
  const totalAmount = transactions
    .filter(t => !t.isExcluded)
    .reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="p-4">
      <header className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">내역 확인</h1>
        <p className="text-sm text-gray-500 mt-1">
          추출된 내역을 확인하고 수정하세요
        </p>
      </header>

      {/* 요약 */}
      <div className="card p-4 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">저장할 항목</span>
          <span className="font-bold text-lg">{includedCount}건</span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-gray-600">총 금액</span>
          <span className="font-bold text-lg text-blue-600">
            {formatCurrency(totalAmount)}
          </span>
        </div>
      </div>

      {/* 거래 목록 */}
      <div className="space-y-3 mb-4">
        {transactions.map((t) => (
          <TransactionReviewCard
            key={t.id}
            transaction={t}
            isEditing={editingId === t.id}
            onEdit={() => setEditingId(t.id)}
            onUpdate={(updates) => handleUpdateTransaction(t.id, updates)}
            onToggleExclude={() => handleToggleExclude(t.id)}
            onCancelEdit={() => setEditingId(null)}
          />
        ))}
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-3 sticky bottom-20 bg-gray-50 py-3 -mx-4 px-4">
        <button
          onClick={() => setStep('upload')}
          className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700"
        >
          다시 업로드
        </button>
        <button
          onClick={handleSave}
          disabled={includedCount === 0}
          className={`flex-1 py-3 rounded-xl font-semibold text-white ${
            includedCount === 0
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-600'
          }`}
        >
          {includedCount}건 저장하기
        </button>
      </div>
    </div>
  )
}

// 거래 검수 카드 컴포넌트
function TransactionReviewCard({
  transaction,
  isEditing,
  onEdit,
  onUpdate,
  onToggleExclude,
  onCancelEdit,
}: {
  transaction: ExtractedTransaction
  isEditing: boolean
  onEdit: () => void
  onUpdate: (updates: Partial<ExtractedTransaction>) => void
  onToggleExclude: () => void
  onCancelEdit: () => void
}) {
  const [editDate, setEditDate] = useState(transaction.date)
  const [editAmount, setEditAmount] = useState(String(transaction.amount))
  const [editMerchant, setEditMerchant] = useState(transaction.merchant)
  const [editCategory, setEditCategory] = useState(transaction.suggestedCategory)

  const category = getCategoryById(transaction.suggestedCategory)

  if (isEditing) {
    return (
      <div className="card p-4 border-2 border-blue-500">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">날짜</label>
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">금액</label>
            <input
              type="text"
              inputMode="numeric"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full p-2 border border-gray-200 rounded-lg mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">사용처</label>
            <input
              type="text"
              value={editMerchant}
              onChange={(e) => setEditMerchant(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">카테고리</label>
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg mt-1"
            >
              {DEFAULT_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={onCancelEdit}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm"
            >
              취소
            </button>
            <button
              onClick={() => onUpdate({
                date: editDate,
                amount: parseInt(editAmount) || 0,
                merchant: editMerchant,
                suggestedCategory: editCategory,
              })}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
            >
              적용
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`card p-4 ${
        transaction.isExcluded ? 'opacity-50 bg-gray-50' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* 체크박스 */}
        <button
          onClick={onToggleExclude}
          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
            transaction.isExcluded
              ? 'border-gray-300 bg-gray-100'
              : 'border-blue-500 bg-blue-500 text-white'
          }`}
        >
          {!transaction.isExcluded && <span className="text-sm">✓</span>}
        </button>

        {/* 내용 */}
        <div className="flex-1 min-w-0" onClick={onEdit}>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 truncate">
              {transaction.merchant}
            </span>
            {transaction.isExcluded && transaction.excludeReason && (
              <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                {transaction.excludeReason}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
            <span>
              {formatDateShort(transaction.date)} ({getDayOfWeek(transaction.date)})
            </span>
            <span>·</span>
            <span className={`px-1.5 py-0.5 rounded ${category?.color || 'bg-gray-500'} bg-opacity-20`}>
              {category?.icon} {category?.name || '기타'}
            </span>
          </div>
        </div>

        {/* 금액 */}
        <div className="text-right" onClick={onEdit}>
          <span className={`font-semibold ${transaction.isExcluded ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
            {formatCurrency(transaction.amount)}
          </span>
        </div>
      </div>

      {/* 수정 힌트 */}
      {!transaction.isExcluded && (
        <p className="text-xs text-gray-400 mt-2 text-right">
          탭하여 수정
        </p>
      )}
    </div>
  )
}
