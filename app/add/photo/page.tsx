'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { parseGeminiResponse, performOcr, parseOcrText, OcrProgressCallback } from '@/lib/ocr'
import { saveExpenses, generateId } from '@/lib/storage'
import { formatCurrency, formatDateShort, getDayOfWeek } from '@/lib/utils'
import { DEFAULT_CATEGORIES, getCategoryById } from '@/constants/categories'
import type { ExtractedTransaction, Expense } from '@/types'

type Step = 'select' | 'preview' | 'processing' | 'review'

interface ImagePreview {
  id: string
  file: File
  url: string
}

export default function PhotoAddPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('select')
  const [images, setImages] = useState<ImagePreview[]>([])
  const [transactions, setTransactions] = useState<ExtractedTransaction[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrStatus, setOcrStatus] = useState('')
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  // 이미지 선택
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const newImages: ImagePreview[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      newImages.push({
        id: generateId(),
        file,
        url: URL.createObjectURL(file),
      })
    }

    setImages(prev => [...prev, ...newImages])
    setStep('preview')
  }

  // 이미지 삭제
  const handleRemoveImage = (id: string) => {
    setImages(prev => {
      const updated = prev.filter(img => img.id !== id)
      if (updated.length === 0) {
        setStep('select')
      }
      return updated
    })
  }

  // OCR 처리 시작
  const handleStartOcr = async () => {
    if (images.length === 0) return

    setStep('processing')
    setOcrProgress(0)
    setCurrentImageIndex(0)

    const allTransactions: ExtractedTransaction[] = []

    for (let i = 0; i < images.length; i++) {
      setCurrentImageIndex(i)
      setOcrStatus(`이미지 ${i + 1}/${images.length} 분석 중...`)

      try {
        const handleProgress: OcrProgressCallback = (progress, status) => {
          const baseProgress = (i / images.length) * 100
          const imageProgress = (progress / 100) * (100 / images.length)
          setOcrProgress(Math.round(baseProgress + imageProgress))
          setOcrStatus(`이미지 ${i + 1}/${images.length}: ${status}`)
        }

        const ocrText = await performOcr(images[i].file, handleProgress)

        let extracted = parseGeminiResponse(ocrText)
        if (extracted.length === 0) {
          extracted = parseOcrText(ocrText)
        }

        allTransactions.push(...extracted)
      } catch (error) {
        console.error(`이미지 ${i + 1} OCR 실패:`, error)
      }
    }

    setTransactions(allTransactions)
    setOcrProgress(100)
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

  // 이미지 선택 단계
  if (step === 'select') {
    return (
      <div className="p-4 min-h-screen bg-gray-50">
        <header className="mb-6">
          <button onClick={() => router.back()} className="text-gray-500 mb-2">
            ← 뒤로
          </button>
          <h1 className="text-xl font-bold text-gray-900">사진으로 추가</h1>
          <p className="text-sm text-gray-500 mt-1">
            결제 내역 캡쳐를 선택하세요
          </p>
        </header>

        <div
          onClick={() => fileInputRef.current?.click()}
          className="card p-8 flex flex-col items-center justify-center min-h-[250px] border-2 border-dashed border-gray-300 cursor-pointer hover:border-blue-400 transition-colors"
        >
          <span className="text-6xl mb-4">📷</span>
          <p className="font-medium text-gray-900">이미지 선택</p>
          <p className="text-sm text-gray-500 mt-1">여러 장을 선택할 수 있어요</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

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
      </div>
    )
  }

  // 미리보기 단계
  if (step === 'preview') {
    return (
      <div className="p-4 min-h-screen bg-gray-50">
        <header className="mb-6">
          <button onClick={() => setStep('select')} className="text-gray-500 mb-2">
            ← 뒤로
          </button>
          <h1 className="text-xl font-bold text-gray-900">선택한 이미지</h1>
          <p className="text-sm text-gray-500 mt-1">
            {images.length}장 선택됨
          </p>
        </header>

        {/* 이미지 미리보기 그리드 */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {images.map((img) => (
            <div key={img.id} className="relative">
              <img
                src={img.url}
                alt="미리보기"
                className="w-full h-40 object-cover rounded-xl"
              />
              <button
                onClick={() => handleRemoveImage(img.id)}
                className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg"
              >
                ✕
              </button>
            </div>
          ))}

          {/* 이미지 추가 버튼 */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="h-40 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-colors"
          >
            <span className="text-2xl mb-1">➕</span>
            <span className="text-sm text-gray-500">추가</span>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* 분석 시작 버튼 */}
        <button
          onClick={handleStartOcr}
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold"
        >
          {images.length}장 분석하기
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

        <div className="w-full max-w-xs mt-6">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${ocrProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 text-center mt-2">{ocrProgress}%</p>
        </div>

        {images.length > 1 && (
          <p className="text-xs text-gray-400 mt-4">
            이미지 {currentImageIndex + 1} / {images.length}
          </p>
        )}
      </div>
    )
  }

  // 검수 단계
  const includedCount = transactions.filter(t => !t.isExcluded).length
  const totalAmount = transactions
    .filter(t => !t.isExcluded)
    .reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="p-4 min-h-screen bg-gray-50 pb-32">
      <header className="mb-4">
        <button onClick={() => setStep('preview')} className="text-gray-500 mb-2">
          ← 뒤로
        </button>
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
        {transactions.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-gray-500">추출된 내역이 없습니다</p>
            <button
              onClick={() => setStep('select')}
              className="mt-4 text-blue-600 font-medium"
            >
              다시 시도하기
            </button>
          </div>
        ) : (
          transactions.map((t) => (
            <TransactionCard
              key={t.id}
              transaction={t}
              isEditing={editingId === t.id}
              onEdit={() => setEditingId(t.id)}
              onUpdate={(updates) => handleUpdateTransaction(t.id, updates)}
              onToggleExclude={() => handleToggleExclude(t.id)}
              onCancelEdit={() => setEditingId(null)}
            />
          ))
        )}
      </div>

      {/* 액션 버튼 */}
      {transactions.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 bg-white border-t p-4">
          <div className="flex gap-3 max-w-lg mx-auto">
            <button
              onClick={() => setStep('select')}
              className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700"
            >
              다시 촬영
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
              {includedCount}건 저장
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// 거래 카드 컴포넌트
function TransactionCard({
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

        <div className="flex-1 min-w-0" onClick={onEdit}>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 truncate">
              {transaction.merchant}
            </span>
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

        <div className="text-right" onClick={onEdit}>
          <span className={`font-semibold ${transaction.isExcluded ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
            {formatCurrency(transaction.amount)}
          </span>
        </div>
      </div>

      {!transaction.isExcluded && (
        <p className="text-xs text-gray-400 mt-2 text-right">
          탭하여 수정
        </p>
      )}
    </div>
  )
}
