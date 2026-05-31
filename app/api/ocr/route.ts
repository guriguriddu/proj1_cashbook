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
  "내 하나계좌 → PAYCO결제 -70,000원" 같은 항목은 반드시 포함.
  ★ 중요: 은행계좌 → 간편결제 충전 항목은 사용처에 화살표(→)를 반드시 보존해서 기재.
    예) "내 하나계좌 → 카카오페이 -287,412원" → 사용처: "하나→카카오페이"
    예) "내 KB국민 → 네이버페이 머니 -50,000원" → 사용처: "KB→네이버페이"
    예) "내 하나계좌 → PAYCO결제 -70,000원" → 사용처: "하나→PAYCO결제"

포함 대상: 카드결제, ATM출금, 간편결제 이체, 구독/정기결제, 모든 출금(-) 항목, 개인에게 보내는 이체(예: 입주청소, 과외비 등)
제외 대상: 내 계좌끼리 단순 이동(예: 하나→KB국민 내 계좌), 입금(+)/월급/이자/환급, 주식/적금 이체
취소(strikethrough) 표시된 항목은 제외

★ 날짜 구분값 해석 규칙 (토스·뱅크샐러드·카카오뱅크 등 앱 공통):
  거래 목록은 최신순(위→아래)으로 표시됩니다.
  날짜 구분값 = 거래 목록 안에 "5월 10일 일요일"처럼 날짜만 단독으로 적힌 텍스트 줄.
  ※ 달력 위젯(캘린더)의 숫자(10, 11, 12...)는 날짜 구분값이 아닙니다. 달력 숫자를 구분값으로 착각하지 마세요.
  각 거래의 날짜 = 해당 항목 바로 위에 있는(가장 가까운 위쪽) 날짜 구분값의 날짜.
  화면 최상단 항목들 위에 날짜 구분값이 보이지 않는 경우: 화면에서 첫 번째(가장 위쪽) 날짜 구분값의 날짜에 1일을 더한 날짜를 사용하세요.
  예) LGU+ 항목이 "5월 10일 일요일" 구분값보다 위에 있고 더 위쪽에 다른 구분값이 없으면 → 5월 11일.
  거래 목록에 날짜 구분값이 전혀 없을 때만: 상단 달력에서 진하게 표시(하이라이트/선택)된 날짜를 그대로 사용하세요 (+1일 없이).

★ 금액 출력 규칙:
  실제 지출 항목은 항상 양수로 출력. 앱 UI에서 음수로 표시돼도 지출이면 양수로.
  단, 카드 명세서에서 빨간색이거나 "환불"·"취소"가 명시된 항목은 음수(-)로 출력 → 시스템이 자동 제외 처리.
  예) 삼성카드 환불 -72,969원(빨간) → 금액: -72969
  예) 토스은행 출금 -30,000원(일반 지출) → 금액: 30000
  한 항목에 취소선 금액과 최종 금액이 함께 있으면 → 취소선 없는 최종 금액만 사용.
  예) "-4,000  -735원"에서 4,000에 취소선 있으면 → 금액: 735

★ 포함/제외 기준:
  포함: 카카오페이·네이버페이·토스페이·무신사머니·쇼핑몰페이 등 소비 목적 이동
    예) "하나 → 네이버페이 머니 -30,000원" → 포함 (쇼핑에 쓸 돈)
    예) "내 KB국민계좌 → 무신사 머니 -20,000원" → 포함 (쇼핑에 쓸 돈)
    예) "내 하나계좌 → PAYCO결제 -70,000원" → 포함
  제외: 내 계좌끼리 단순 이동, 투자·증권 이체
    예) "KB국민 → 카카오페이증권" → 제외 (투자)
    예) "하나 → 내 KB국민" → 제외 (내 계좌 이동)
  제외: 입금(+)/월급/이자/환급, 주식·적금 이체

날짜에 년도가 없으면 ${new Date().getFullYear()}년으로 가정.

카테고리 (반드시 아래 ID 중 하나만 사용):
food, cafe, shopping, transport, fixed, telecom, insurance, education, travel, cash, other

간편결제(PAYCO·카카오페이·네이버페이 등) 이체는 카테고리 other 사용.

★ n빵 감지용 입금 캡처:
  타인(개인)이 보내온 입금 이체도 추출하세요. 예) "배*현 → 내 카카오페이", "김*준 → 내 계좌"
  이런 항목은 유형: 입금 으로 표시.
  은행 자동이체, 월급, 이자, 환급은 유형: 입금으로도 추출하지 마세요.

출력 형식 (항목마다 반복):
날짜: YYYY-MM-DD
금액: 숫자만 (항상 양수, 절대값으로 출력)
사용처: 상호명
유형: 지출
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
