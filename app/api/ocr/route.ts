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
              text: `이 이미지는 카드 결제 내역 또는 토스 사용 내역 캡쳐입니다.
이미지에서 모든 거래 내역을 추출하고 카테고리를 분류해주세요.

중요: 날짜에 년도가 표시되어 있지 않으면 현재 년도인 ${new Date().getFullYear()}년으로 가정해주세요.

카테고리 목록 (반드시 이 중에서 선택):
- food: 식비 (음식점, 배달, 편의점, 마트 식품)
- cafe: 카페 (커피, 디저트, 베이커리)
- shopping: 쇼핑 (의류, 전자제품, 온라인쇼핑, 생활용품)
- transport: 교통비 (택시, 버스, 지하철, 주유, 주차)
- fixed: 고정비 (월세, 관리비, 공과금, 구독서비스, 헬스장)
- telecom: 통신 (휴대폰, 인터넷)
- insurance: 보험 (보험료, 연금)
- education: 자기계발 (교육, 도서, 강의)
- travel: 여행 (숙박, 항공, 여행사)
- cash: 현금 (ATM 출금)
- other: 기타

각 거래마다 다음 형식으로 출력해주세요:
날짜: YYYY-MM-DD
금액: 숫자만 (원 단위)
사용처: 상호명
카테고리: 카테고리ID
---

예시:
날짜: ${new Date().getFullYear()}-05-15
금액: 4500
사용처: 스타벅스 강남역점
카테고리: cafe
---

모든 거래 내역을 빠짐없이 추출해주세요. (계좌이체, 송금, 입금, 환불, 충전 등도 포함)`,
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
        maxOutputTokens: 2048,
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

    console.log('Gemini OCR 결과:', text)

    return NextResponse.json({ text })
  } catch (error) {
    console.error('OCR API 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
