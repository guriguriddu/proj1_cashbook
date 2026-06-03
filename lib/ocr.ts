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
    let txType = '지출' // 지출 | 입금

    for (const line of lines) {
      const trimmedLine = line.trim()

      if (trimmedLine.startsWith('날짜:')) {
        const dateStr = trimmedLine.replace('날짜:', '').trim()
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
      } else if (trimmedLine.startsWith('유형:')) {
        txType = trimmedLine.replace('유형:', '').trim()
      } else if (trimmedLine.startsWith('카테고리:')) {
        const catStr = trimmedLine.replace('카테고리:', '').trim().toLowerCase()
        if (validCategories.includes(catStr)) {
          category = catStr
        }
      }
    }

    if (amount !== 0 && merchant) {
      // 안전망: 화살표 오른쪽이 "내 ○○"(내 카카오페이/내 계좌 등)이면 = 내게 들어온 입금.
      // Gemini 가 유형을 '지출'로 잘못 단 경우라도 입금으로 교정한다.
      // (왼쪽이 내 계좌인 "내 KB → 카카오페이"(충전/출금)는 매칭되지 않음 — '내'가 → 앞이라서)
      const arrowIncoming = /→\s*내\s*\S/.test(merchant) || /→\s*내\s*\S/.test(block)
      const isIncoming = txType === '입금' || arrowIncoming
      const isRefund = amount < 0
      const absAmount = Math.abs(amount)
      const { excluded, reason } = isExcludedTransaction(merchant)

      const suggestion = suggestCategory(merchant)
      const finalCategory = (suggestion.categoryId !== 'other' && suggestion.categoryId !== 'exclude')
        ? suggestion.categoryId
        : (category || 'other')
      const confidence = suggestion.categoryId !== 'other' ? suggestion.confidence : 0.9

      transactions.push({
        id: generateId(),
        date,
        amount: absAmount,
        merchant,
        suggestedCategory: (excluded || isRefund || isIncoming) ? 'exclude' : finalCategory,
        confidence,
        isExcluded: excluded || isRefund || isIncoming,
        excludeReason: isIncoming ? 'n빵 입금' : isRefund ? '환불/취소 항목' : reason,
        rawText: block.trim(),
      })
    }
  }

  return transactions
}

// OCR 진행 상태 콜백 타입
export type OcrProgressCallback = (progress: number, status: string) => void

// 응답 실패를 사람이 읽을 수 있는 에러로 변환.
// 504 등에서 서버가 JSON 이 아닌 텍스트(HTML)를 돌려줄 때 .json() 이 터지는 걸 막는다.
async function toFriendlyError(response: Response, fallback: string): Promise<Error> {
  if (response.status === 504 || response.status === 408) {
    return new Error('영상이 길어 처리 시간(60초)을 초과했어요. 더 짧게(1분 이내) 나눠서 올려주세요.')
  }
  const raw = await response.text()
  try {
    const parsed = JSON.parse(raw)
    return new Error(parsed.error || fallback)
  } catch {
    return new Error(`${fallback} (HTTP ${response.status})`)
  }
}

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

// Gemini 2.5 Flash 영상 인식 — 스크롤 녹화 영상 한 개에서 거래내역 추출
export async function performVideoOcr(
  videoFile: File,
  onProgress?: OcrProgressCallback
): Promise<string> {
  console.log('영상 인식 시작:', videoFile.name, videoFile.size)

  try {
    if (onProgress) {
      onProgress(10, 'Gemini에 영상 업로드 중...')
    }

    const formData = new FormData()
    formData.append('video', videoFile)

    const response = await fetch('/api/ocr-video', {
      method: 'POST',
      body: formData,
    })

    if (onProgress) {
      onProgress(80, '응답 처리 중...')
    }

    if (!response.ok) {
      throw await toFriendlyError(response, '영상 인식 실패')
    }

    const data = await response.json()

    if (onProgress) {
      onProgress(100, '완료!')
    }

    console.log('영상 인식 완료:', data.text?.substring(0, 200))
    return data.text || ''
  } catch (error) {
    console.error('영상 인식 에러:', error)
    const message = error instanceof Error ? error.message : '영상에서 거래 내역을 추출하는데 실패했습니다.'
    throw new Error(message)
  }
}

// 대용량 영상용 — 스토리지 서명 URL 을 서버에 전달해 Gemini Files API 로 처리.
// (Vercel 서버리스 본문 4.5MB 한도를 우회)
export async function performVideoOcrByUrl(
  videoUrl: string,
  onProgress?: OcrProgressCallback
): Promise<string> {
  try {
    if (onProgress) {
      onProgress(10, 'Gemini에 영상 전달 중...')
    }

    const response = await fetch('/api/ocr-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl }),
    })

    if (onProgress) {
      onProgress(80, '응답 처리 중...')
    }

    if (!response.ok) {
      throw await toFriendlyError(response, '영상 인식 실패')
    }

    const data = await response.json()

    if (onProgress) {
      onProgress(100, '완료!')
    }

    return data.text || ''
  } catch (error) {
    console.error('영상 인식(URL) 에러:', error)
    const message = error instanceof Error ? error.message : '영상에서 거래 내역을 추출하는데 실패했습니다.'
    throw new Error(message)
  }
}
