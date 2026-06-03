import { NextRequest, NextResponse } from 'next/server'
import { buildExtractionPrompt } from '@/lib/ocr-prompt'

const MODEL = 'gemini-2.5-flash'
const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

// inline_data 로 보낼 수 있는 최대 원본 크기 (base64 인플레이션 + 요청 한도 고려).
// 이보다 크면 Files API 로 업로드한다.
const INLINE_MAX_BYTES = 15 * 1024 * 1024

const GEMINI_BASE = 'https://generativelanguage.googleapis.com'

async function callGeminiWithRetry(apiKey: string, body: string): Promise<Response> {
  let lastResponse: Response | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(
      `${GEMINI_BASE}/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
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

// Gemini Files API 로 큰 영상 업로드 (resumable). 업로드 후 ACTIVE 상태가 될 때까지 폴링.
async function uploadVideoToFilesApi(
  apiKey: string,
  bytes: ArrayBuffer,
  mimeType: string,
  displayName: string
): Promise<{ uri: string; mimeType: string }> {
  const numBytes = bytes.byteLength

  // 1. 업로드 세션 시작
  const startRes = await fetch(`${GEMINI_BASE}/upload/v1beta/files?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(numBytes),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  })

  if (!startRes.ok) {
    throw new Error(`Files API 업로드 시작 실패: ${startRes.status}`)
  }

  const uploadUrl = startRes.headers.get('X-Goog-Upload-URL')
  if (!uploadUrl) {
    throw new Error('Files API 업로드 URL 없음')
  }

  // 2. 바이트 업로드 + finalize
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(numBytes),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: bytes,
  })

  if (!uploadRes.ok) {
    throw new Error(`Files API 업로드 실패: ${uploadRes.status}`)
  }

  const uploaded = await uploadRes.json()
  let file = uploaded.file as { name: string; uri: string; state: string; mimeType: string }

  // 3. 영상은 서버에서 처리(PROCESSING) → ACTIVE 가 될 때까지 폴링
  const deadline = Date.now() + 60_000
  while (file.state === 'PROCESSING') {
    if (Date.now() > deadline) {
      throw new Error('영상 처리 시간 초과 (Gemini Files API)')
    }
    await new Promise(r => setTimeout(r, 2000))
    const pollRes = await fetch(`${GEMINI_BASE}/v1beta/${file.name}?key=${apiKey}`)
    if (!pollRes.ok) {
      throw new Error(`Files API 상태 조회 실패: ${pollRes.status}`)
    }
    file = await pollRes.json()
  }

  if (file.state !== 'ACTIVE') {
    throw new Error(`영상 처리 실패 상태: ${file.state}`)
  }

  return { uri: file.uri, mimeType: file.mimeType || mimeType }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('video') as File

    if (!file) {
      return NextResponse.json({ error: '영상이 없습니다' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다' }, { status: 500 })
    }

    const bytes = await file.arrayBuffer()
    const mimeType = file.type || 'video/mp4'

    // 영상은 항목이 많을 수 있어 출력 토큰을 넉넉히
    const generationConfig = { temperature: 0.1, maxOutputTokens: 16384 }
    const promptText = buildExtractionPrompt({ isVideo: true })

    // 크기에 따라 inline / Files API 선택
    let mediaPart: Record<string, unknown>
    if (bytes.byteLength <= INLINE_MAX_BYTES) {
      const base64 = Buffer.from(bytes).toString('base64')
      mediaPart = { inline_data: { mime_type: mimeType, data: base64 } }
    } else {
      const uploaded = await uploadVideoToFilesApi(apiKey, bytes, mimeType, file.name || 'recording')
      mediaPart = { file_data: { mime_type: uploaded.mimeType, file_uri: uploaded.uri } }
    }

    const requestBody = JSON.stringify({
      contents: [{ parts: [{ text: promptText }, mediaPart] }],
      generationConfig,
    })

    const response = await callGeminiWithRetry(apiKey, requestBody)

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Gemini 영상 API 에러:', errorData)

      let errorMessage = '영상 인식 실패'
      const errCode = errorData.error?.code
      if (errCode === 429) {
        errorMessage = 'API 요청 한도 초과 - 잠시 후 다시 시도해주세요'
      } else if (errCode === 503) {
        errorMessage = '서버가 바쁩니다 - 잠시 후 다시 시도해주세요'
      } else if (errCode === 404) {
        errorMessage = '인식 모델을 찾을 수 없습니다 - 관리자에게 문의해주세요'
      }

      return NextResponse.json(
        { error: errorMessage, details: errorData },
        { status: response.status }
      )
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    console.log('[OCR-VIDEO] Gemini 원본 응답:\n' + text)
    console.log('[OCR-VIDEO] 파일명:', file.name, '크기:', file.size)

    return NextResponse.json({ text, _debug: text })
  } catch (error) {
    console.error('영상 OCR API 에러:', error)
    const message = error instanceof Error ? error.message : '서버 오류가 발생했습니다'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
