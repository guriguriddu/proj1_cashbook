// 금액 포맷 (1,234,567원)
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원'
}

// 금액 포맷 (간단: 123.4만원)
export function formatCurrencyShort(amount: number): string {
  if (amount >= 100000000) {
    return (amount / 100000000).toFixed(1) + '억원'
  }
  if (amount >= 10000) {
    return (amount / 10000).toFixed(1) + '만원'
  }
  return amount.toLocaleString('ko-KR') + '원'
}

// 날짜 포맷 (5월 14일)
export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}월 ${date.getDate()}일`
}

// 날짜 포맷 (2025년 5월 14일)
export function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr)
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`
}

// 날짜 포맷 (5/14)
export function formatDateCompact(dateStr: string): string {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

// 월 포맷 (2025년 5월)
export function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-')
  return `${year}년 ${parseInt(month)}월`
}

// 월 포맷 (5월)
export function formatMonthShort(monthStr: string): string {
  const month = monthStr.split('-')[1]
  return `${parseInt(month)}월`
}

// 퍼센트 포맷 (45.2%)
export function formatPercent(rate: number): string {
  return rate.toFixed(1) + '%'
}

// 요일 반환
export function getDayOfWeek(dateStr: string): string {
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const date = new Date(dateStr)
  return days[date.getDay()]
}

// 월의 시작일과 마지막일
export function getMonthRange(monthStr: string): { start: string; end: string } {
  const [year, month] = monthStr.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  return {
    start: `${monthStr}-01`,
    end: `${monthStr}-${String(lastDay).padStart(2, '0')}`,
  }
}

// 분기 계산 (1-4)
export function getQuarter(monthStr: string): 1 | 2 | 3 | 4 {
  const month = parseInt(monthStr.split('-')[1])
  return Math.ceil(month / 3) as 1 | 2 | 3 | 4
}

// 반기 계산 (1-2)
export function getHalf(monthStr: string): 1 | 2 {
  const month = parseInt(monthStr.split('-')[1])
  return month <= 6 ? 1 : 2
}

// 이전 월
export function getPreviousMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number)
  if (month === 1) {
    return `${year - 1}-12`
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`
}

// 다음 월
export function getNextMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number)
  if (month === 12) {
    return `${year + 1}-01`
  }
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

// 날짜별로 그룹핑
export function groupByDate<T extends { date: string }>(items: T[]): { [date: string]: T[] } {
  return items.reduce((acc, item) => {
    if (!acc[item.date]) {
      acc[item.date] = []
    }
    acc[item.date].push(item)
    return acc
  }, {} as { [date: string]: T[] })
}

// 숫자 문자열에서 숫자만 추출
export function extractNumber(str: string): number {
  const cleaned = str.replace(/[^0-9]/g, '')
  return parseInt(cleaned) || 0
}

// 클래스 병합
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

// 이번 달 남은 일수
export function getDaysRemaining(): number {
  const today = new Date()
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  return lastDay - today.getDate()
}
