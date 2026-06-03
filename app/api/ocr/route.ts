import { NextRequest, NextResponse } from 'next/server'
import { buildExtractionPrompt } from '@/lib/ocr-prompt'

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
              text: buildExtractionPrompt(),
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
