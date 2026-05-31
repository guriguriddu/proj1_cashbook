import { ExtractedTransaction } from '@/types'
import { suggestCategory, EXCLUDE_KEYWORDS, isPaymentService } from '@/constants/categories'
import { generateId, getTodayDate } from '@/lib/storage'

// OCR 결과에서 거래 내역 파싱
export interface ParsedTransaction {
  date: string
  amount: number
  merchant: string
  rawText: string
}

// 금액 패턴 (숫자+원 또는 숫자+,+숫자)
const AMOUNT_PATTERN = /[\d,]+원|[\d,]+\s*원/g
const AMOUNT_NUMBER_PATTERN = /[\d,]+/

// 날짜 패턴
const DATE_PATTERNS = [
  /(\d{4})[./-](\d{1,2})[./-](\d{1,2})/, // 2025.05.14, 2025-05-14
  /(\d{1,2})[./-](\d{1,2})/, // 05.14, 5/14
  /(\d{1,2})월\s*(\d{1,2})일/, // 5월 14일
]

// 텍스트에서 날짜 추출
function extractDate(text: string, fallbackDate: string): string {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      if (match.length === 4) {
        // YYYY-MM-DD
        const year = match[1]
        const month = match[2].padStart(2, '0')
        const day = match[3].padStart(2, '0')
        return `${year}-${month}-${day}`
      } else if (match.length === 3) {
        // MM-DD (올해로 가정)
        const year = new Date().getFullYear()
        const month = match[1].padStart(2, '0')
        const day = match[2].padStart(2, '0')
        return `${year}-${month}-${day}`
      }
    }
  }
  return fallbackDate
}

// 텍스트에서 금액 추출
function extractAmount(text: string): number {
  const matches = text.match(AMOUNT_PATTERN)
  if (matches && matches.length > 0) {
    // 가장 큰 금액을 선택 (보통 총액)
    let maxAmount = 0
    for (const match of matches) {
      const numMatch = match.match(AMOUNT_NUMBER_PATTERN)
      if (numMatch) {
        const amount = parseInt(numMatch[0].replace(/,/g, ''))
        if (amount > maxAmount) {
          maxAmount = amount
        }
      }
    }
    return maxAmount
  }
  return 0
}

// 제외 대상인지 확인 (간편결제 서비스는 실제 소비이므로 제외하지 않음)
function isExcludedTransaction(text: string): { excluded: boolean; reason?: string } {
  if (isPaymentService(text)) return { excluded: false }
  const lowerText = text.toLowerCase()
  for (const keyword of EXCLUDE_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      return { excluded: true, reason: keyword }
    }
  }
  return { excluded: false }
}

// OCR 텍스트를 거래 내역으로 파싱
export function parseOcrText(ocrText: string): ExtractedTransaction[] {
  const lines = ocrText.split('\n').filter(line => line.trim())
  const transactions: ExtractedTransaction[] = []
  const today = getTodayDate()

  // 금액이 포함된 라인 찾기
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const amount = extractAmount(line)

    if (amount > 0) {
      // 금액이 있는 라인 발견
      // 주변 라인에서 날짜와 사용처 찾기
      const contextLines = [
        lines[i - 2] || '',
        lines[i - 1] || '',
        line,
        lines[i + 1] || '',
      ].join(' ')

      const date = extractDate(contextLines, today)

      // 사용처는 금액을 제외한 텍스트
      let merchant = line.replace(AMOUNT_PATTERN, '').trim()
      if (!merchant && lines[i - 1]) {
        merchant = lines[i - 1].trim()
      }
      if (!merchant) {
        merchant = '알 수 없음'
      }

      // 제외 대상 확인
      const { excluded, reason } = isExcludedTransaction(contextLines)

      // 카테고리 추천
      const { categoryId, confidence } = suggestCategory(merchant + ' ' + contextLines)

      transactions.push({
        id: generateId(),
        date,
        amount,
        merchant,
        suggestedCategory: excluded ? 'exclude' : categoryId,
        confidence,
        isExcluded: excluded,
        excludeReason: reason,
        rawText: line,
      })
    }
  }

  // 중복 제거 (같은 금액 + 비슷한 사용처)
  const uniqueTransactions = transactions.filter((t, index, self) => {
    return !self.slice(0, index).some(
      other => other.amount === t.amount && other.merchant === t.merchant
    )
  })

  return uniqueTransactions
}

// 데모용: 가짜 OCR 결과 생성 (실제 OCR API 연동 전)
export function mockOcrExtraction(): ExtractedTransaction[] {
  const today = getTodayDate()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  return [
    {
      id: generateId(),
      date: today,
      amount: 4500,
      merchant: '스타벅스 강남역점',
      suggestedCategory: 'food',
      confidence: 0.9,
      isExcluded: false,
      rawText: '스타벅스 강남역점 4,500원',
    },
    {
      id: generateId(),
      date: today,
      amount: 12300,
      merchant: '카카오T 택시',
      suggestedCategory: 'transport',
      confidence: 0.85,
      isExcluded: false,
      rawText: '카카오T 택시 12,300원',
    },
    {
      id: generateId(),
      date: yesterdayStr,
      amount: 23400,
      merchant: '쿠팡',
      suggestedCategory: 'shopping',
      confidence: 0.8,
      isExcluded: false,
      rawText: '쿠팡 23,400원',
    },
    {
      id: generateId(),
      date: yesterdayStr,
      amount: 500000,
      merchant: '내 계좌 이동',
      suggestedCategory: 'exclude',
      confidence: 0.95,
      isExcluded: true,
      excludeReason: '내 계좌',
      rawText: '내 계좌 이동 500,000원',
    },
  ]
}

// Gemini API 응답 파싱 (구조화된 형식)
export function parseGeminiResponse(text: string): ExtractedTransaction[] {
  const transactions: ExtractedTransaction[] = []
  const blocks = text.split('---').filter(block => block.trim())

  const validCategories = ['food', 'cafe', 'shopping', 'transport', 'fixed', 'telecom', 'insurance', 'education', 'travel', 'cash', 'other']

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    let date = getTodayDate()
    let amount = 0
    let merchant = ''
    let category = ''

    for (const line of lines) {
      const trimmedLine = line.trim()

      if (trimmedLine.startsWith('날짜:')) {
        const dateStr = trimmedLine.replace('날짜:', '').trim()
        // YYYY-MM-DD 형식 확인
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          date = dateStr
        }
      } else if (trimmedLine.startsWith('금액:')) {
        const amountStr = trimmedLine.replace('금액:', '').trim()
        const isNeg = amountStr.startsWith('-')
        const absVal = parseInt(amountStr.replace(/[^0-9]/g, '')) || 0
        amount = isNeg ? -absVal : absVal
      } else if (trimmedLine.startsWith('사용처:')) {
        merchant = trimmedLine.replace('사용처:', '').trim()
      } else if (trimmedLine.startsWith('카테고리:')) {
        const catStr = trimmedLine.replace('카테고리:', '').trim().toLowerCase()
        if (validCategories.includes(catStr)) {
          category = catStr
        }
      }
    }

    if (amount !== 0 && merchant) {
      const absAmount = Math.abs(amount)
      const isNegative = amount < 0
      const { excluded, reason } = isExcludedTransaction(merchant)

      let finalCategory = category
      let confidence = 0.9
      if (!finalCategory) {
        const suggestion = suggestCategory(merchant)
        finalCategory = suggestion.categoryId
        confidence = suggestion.confidence
      }

      transactions.push({
        id: generateId(),
        date,
        amount: absAmount,
        merchant,
        suggestedCategory: (excluded || isNegative) ? 'exclude' : finalCategory,
        confidence,
        isExcluded: excluded || isNegative,
        excludeReason: isNegative ? '결제 취소됨' : reason,
        rawText: block.trim(),
      })
    }
  }

  return transactions
}

// OCR 진행 상태 콜백 타입
export type OcrProgressCallback = (progress: number, status: string) => void

// Gemini API를 사용한 OCR
export async function performOcr(
  imageFile: File,
  onProgress?: OcrProgressCallback
): Promise<string> {
  console.log('OCR 시작:', imageFile.name, imageFile.size)

  try {
    if (onProgress) {
      onProgress(10, 'Gemini API 호출 중...')
    }

    const formData = new FormData()
    formData.append('image', imageFile)

    const response = await fetch('/api/ocr', {
      method: 'POST',
      body: formData,
    })

    if (onProgress) {
      onProgress(80, '응답 처리 중...')
    }

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'OCR 처리 실패')
    }

    const data = await response.json()

    if (onProgress) {
      onProgress(100, '완료!')
    }

    console.log('OCR 완료:', data.text?.substring(0, 200))
    return data.text || ''
  } catch (error) {
    console.error('OCR 에러:', error)
    throw new Error('이미지에서 텍스트를 추출하는데 실패했습니다.')
  }
}
