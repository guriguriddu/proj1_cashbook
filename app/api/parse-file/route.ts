import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

async function callGeminiWithRetry(apiKey: string, body: string): Promise<Response> {
  let lastResponse: Response | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
    )
    if (response.status !== 429 && response.status !== 503) return response
    lastResponse = response
    if (attempt < MAX_RETRIES) {
      const retryAfter = response.headers.get('Retry-After')
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : BASE_DELAY_MS * Math.pow(2, attempt)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  return lastResponse!
}

const PROMPT = `당신은 금융 거래 내역 파서입니다.

## 1단계: 문서 유형 판단
파일 헤더·제목을 보고 판단:
- 은행/카드 명세서 → [A] 처리
- 증권사 거래내역서 (토스증권, 키움증권, 한국투자, 미래에셋, NH투자 등) → [B] 처리

## 카테고리 ID (반드시 아래 중 하나만 사용)
- food: 식비, 음식점, 배달, 마트, 편의점
- cafe: 카페, 커피숍, 음료, 디저트, 베이커리
- shopping: 쇼핑, 온라인몰, 의류, 뷰티, 잡화
- transport: 교통, 택시, 버스, 지하철, KTX, 주유, 주차
- fixed: 고정비, 월세, 관리비, 공과금
- telecom: 통신비, 인터넷, 휴대폰 요금
- insurance: 보험료
- education: 교육, 학원비, 도서, 강의
- travel: 여행, 숙박, 항공, 관광
- saving: 투자·저축 목적 이체, 증권계좌 입금
- other: 기타, 분류불가, 간편결제이체, 개인이체

## [A] 은행 / 카드 명세서
포함: 카드결제, ATM출금, 간편결제, 개인에게 보내는 이체(지출), 구독/정기결제, 지출(-)
제외: 입금/수입, 내 계좌끼리 이체, 투자·저축 이체, 환불/취소

## [B] 증권사 거래내역서
포함할 항목:
- "이체입금" 중 외부 은행(실명 또는 은행명 표기)에서 들어온 건 → category=saving, merchant="[증권사명] 투자입금", amount=원화금액
제외할 항목: 환전원화출금, 환전외화입금/출금, 주식·ETF 매수/매도, 이자입금, 배당금입금, 세금출금, 수수료, 내부 이체

날짜에 년도가 없으면 ${new Date().getFullYear()}년으로 처리.
금액은 양수(원 단위 숫자)로.

JSON 배열만 반환 (다른 텍스트 없이):
[{"date":"YYYY-MM-DD","merchant":"상호명","amount":숫자,"category":"ID","originalCategory":"원본거래구분"}]`

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'API 키가 설정되지 않았습니다' }, { status: 500 })

    const bytes = await file.arrayBuffer()
    const isXlsx = /\.(xlsx|xls)$/i.test(file.name)
    const isPdf = /\.pdf$/i.test(file.name)

    let parts: object[]

    if (isXlsx) {
      const wb = XLSX.read(bytes, { type: 'array' })
      const sheetName = wb.SheetNames.find(n => n === '가계부 내역') || wb.SheetNames[0]
      const ws = wb.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][]
      // 최대 3000행 (토큰 제한 대비)
      const tableText = rows.slice(0, 3000).map(row => (row as unknown[]).join('\t')).join('\n')
      parts = [{ text: PROMPT + '\n\n[엑셀 내용]\n' + tableText }]
    } else if (isPdf) {
      const base64 = Buffer.from(bytes).toString('base64')
      parts = [
        { text: PROMPT },
        { inline_data: { mime_type: 'application/pdf', data: base64 } },
      ]
    } else {
      return NextResponse.json({ error: 'xlsx, xls, pdf 파일만 지원합니다' }, { status: 400 })
    }

    const requestBody = JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 16384 },
    })

    const response = await callGeminiWithRetry(apiKey, requestBody)

    if (!response.ok) {
      const err = await response.json()
      console.error('[parse-file] Gemini 오류:', err)
      const code = err.error?.code
      const msg = code === 429 ? 'API 요청 한도 초과 - 잠시 후 다시 시도해주세요'
        : code === 503 ? '서버가 바쁩니다 - 잠시 후 다시 시도해주세요'
        : 'AI 파싱 실패'
      return NextResponse.json({ error: msg }, { status: response.status })
    }

    const data = await response.json()
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    console.log('[parse-file] Gemini 원본 응답 일부:', text.slice(0, 500))

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AI 응답에서 거래 내역을 찾지 못했습니다', raw: text }, { status: 500 })
    }

    const transactions = JSON.parse(jsonMatch[0])
    return NextResponse.json({ transactions })
  } catch (error) {
    console.error('[parse-file] 서버 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
