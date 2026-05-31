import { NextRequest, NextResponse } from 'next/server'

const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

async function callGeminiWithRetry(apiKey: string, body: string): Promise<Response> {
  let lastResponse: Response | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }
    )

    if (response.status !== 429 && response.status !== 503) {
      return response
    }

    lastResponse = response

    if (attempt < MAX_RETRIES) {
      // Retry-After 헤더 우선, 없으면 exponential backoff
      const retryAfter = response.headers.get('Retry-After')
      const delayMs = retryAfter
        ? parseInt(retryAfter) * 1000
        : BASE_DELAY_MS * Math.pow(2, attempt)
      console.log(`Gemini API ${response.status} — ${attempt + 1}번째 재시도, ${delayMs}ms 대기`)
      await new Promise(r => setTimeout(r, delayMs))
    }
  }

  return lastResponse!
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('image') as File

    if (!file) {
      return NextResponse.json({ error: '이미지가 없습니다' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const base64Image = Buffer.from(bytes).toString('base64')

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다' }, { status: 500 })
    }

    const requestBody = JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `이 이미지는 은행 계좌 거래 내역, 카드 결제 내역, 또는 간편결제 앱 소비 내역 캡쳐입니다.
이미지에 보이는 모든 "출금/지출" 항목을 빠짐없이 추출해주세요.

★ 절대 제외하지 말 것: PAYCO결제, 카카오페이, 네이버페이, 토스, 삼성페이, 애플페이로 나가는 금액.
  "내 하나계좌 → PAYCO결제 -70,000원" 같은 항목은 반드시 포함. 사용처는 "PAYCO결제"로 기재.

포함 대상: 카드결제, ATM출금, 간편결제 이체, 구독/정기결제, 모든 출금(-) 항목, 개인에게 보내는 이체(예: 입주청소, 과외비 등)
제외 대상: 내 계좌끼리 단순 이동(예: 하나→KB국민 내 계좌), 입금(+)/월급/이자/환급, 주식/적금 이체
취소(strikethrough) 표시된 항목은 제외

★ 날짜 구분값 해석 규칙 (토스·뱅크샐러드·카카오뱅크 등 앱 공통):
  거래 목록은 최신순(위→아래)으로 표시됩니다.
  "5월 10일 일요일"처럼 날짜만 단독으로 적힌 텍스트가 날짜 구분값이며, 그 아래에 오는 거래들이 해당 날짜의 거래입니다.
  각 거래의 날짜 = 해당 항목 바로 위에 있는(가장 가까운 위쪽) 날짜 구분값의 날짜.
  화면 최상단 항목들 위에 날짜 구분값이 보이지 않는 경우: 화면에서 첫 번째(가장 위쪽) 날짜 구분값의 날짜에 1일을 더한 날짜를 사용하세요.
  예) LGU+ 항목이 "5월 10일 일요일" 구분값보다 위에 있고 더 위쪽에 다른 구분값이 없으면 → 5월 11일.
  날짜 구분값이 화면에 전혀 없을 때만 상단 캘린더 하이라이트를 폴백으로 사용하세요.

날짜에 년도가 없으면 ${new Date().getFullYear()}년으로 가정.

카테고리 (반드시 아래 ID 중 하나만 사용):
food, cafe, shopping, transport, fixed, telecom, insurance, education, travel, cash, other

간편결제(PAYCO·카카오페이·네이버페이 등) 이체는 카테고리 other 사용.

출력 형식 (항목마다 반복):
날짜: YYYY-MM-DD
금액: 숫자만 (항상 양수, 절대값으로 출력)
사용처: 상호명
카테고리: other
---

예시:
날짜: ${new Date().getFullYear()}-05-20
금액: 70000
사용처: PAYCO결제
카테고리: other
---`,
            },
            {
              inline_data: {
                mime_type: file.type || 'image/jpeg',
                data: base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
    })

    const response = await callGeminiWithRetry(apiKey, requestBody)

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Gemini API 에러:', errorData)

      let errorMessage = 'OCR 처리 실패'
      const errCode = errorData.error?.code
      if (errCode === 429) {
        errorMessage = 'API 요청 한도 초과 - 잠시 후 다시 시도해주세요'
      } else if (errCode === 503) {
        errorMessage = '서버가 바쁩니다 - 잠시 후 다시 시도해주세요'
      } else if (errCode === 404) {
        errorMessage = 'OCR 모델을 찾을 수 없습니다 - 관리자에게 문의해주세요'
      }

      return NextResponse.json(
        { error: errorMessage, details: errorData },
        { status: response.status }
      )
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    console.log('[OCR] Gemini 원본 응답:\n' + text)
    console.log('[OCR] 파일명:', file.name, '크기:', file.size)

    return NextResponse.json({ text, _debug: text })
  } catch (error) {
    console.error('OCR API 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
