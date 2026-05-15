import { Category } from '@/types'

// 기본 카테고리 목록
export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'food',
    name: '식비',
    icon: '🍽️',
    color: 'bg-orange-500',
    keywords: [
      '편의점', 'CU', 'GS25', 'GS 25', '세븐일레븐', '이마트24', '미니스톱',
      '배달의민족', '배민', '요기요', '쿠팡이츠', '땡겨요',
      '맥도날드', '버거킹', '롯데리아', 'KFC', '맘스터치', '노브랜드버거',
      '김밥', '분식', '식당', '밥', '치킨', '피자', '족발', '보쌈',
      '이마트', '홈플러스', '롯데마트', '하나로마트', '농협',
    ],
    order: 1,
  },
  {
    id: 'cafe',
    name: '카페',
    icon: '☕',
    color: 'bg-amber-600',
    keywords: [
      '스타벅스', '투썸', '투썸플레이스', '메가커피', '메가MGC', '이디야',
      '할리스', '빽다방', '커피빈', '폴바셋', '블루보틀', '카페',
      '아메리카노', '라떼', '커피', '베이커리', '파리바게뜨', '뚜레쥬르',
    ],
    order: 2,
  },
  {
    id: 'shopping',
    name: '쇼핑',
    icon: '🛍️',
    color: 'bg-pink-500',
    keywords: [
      '쿠팡', '네이버쇼핑', '네이버페이', '무신사', '올리브영', '다이소',
      'SSG', '11번가', 'G마켓', '옥션', '위메프', '티몬',
      '백화점', '롯데백화점', '현대백화점', '신세계', '갤러리아',
      '아울렛', '이케아', 'IKEA', '자라', 'ZARA', 'H&M', '유니클로',
    ],
    order: 3,
  },
  {
    id: 'transport',
    name: '교통비',
    icon: '🚗',
    color: 'bg-blue-500',
    keywords: [
      '카카오T', '카카오택시', '택시', 'TAXI',
      '지하철', '버스', '교통카드', '티머니', '캐시비',
      '주유소', 'SK에너지', 'GS칼텍스', 'S-OIL', '현대오일뱅크',
      '고속버스', 'KTX', 'SRT', '기차', '열차',
      '주차', '주차장', '톨게이트', '하이패스',
      '따릉이', '킥보드', '라임', '씽씽', '빔',
    ],
    order: 4,
  },
  {
    id: 'fixed',
    name: '고정비',
    icon: '📋',
    color: 'bg-slate-600',
    keywords: [
      '월세', '관리비', '공과금', '전기세', '가스비', '수도세',
      '넷플릭스', '유튜브프리미엄', '스포티파이', '애플뮤직',
      '구독', '멤버십', '정기결제', '자동결제',
      '헬스장', '피트니스', '필라테스', '요가',
      '학원비', '수강료', '교육비',
    ],
    order: 5,
  },
  {
    id: 'telecom',
    name: '통신',
    icon: '📱',
    color: 'bg-indigo-500',
    keywords: [
      'SKT', 'SK텔레콤', 'KT', 'LG U+', 'LG유플러스',
      '통신료', '핸드폰', '휴대폰', '인터넷', 'IPTV',
      '알뜰폰', '헬로모바일', '프리텔',
    ],
    order: 6,
  },
  {
    id: 'insurance',
    name: '보험',
    icon: '🛡️',
    color: 'bg-green-600',
    keywords: [
      '삼성생명', '삼성화재', '한화생명', '한화손해보험',
      '현대해상', '메리츠', 'KB손해보험', 'DB손해보험',
      '교보생명', '신한생명', 'NH농협생명',
      '보험료', '보험', '생명보험', '손해보험',
    ],
    order: 7,
  },
  {
    id: 'education',
    name: '자기계발',
    icon: '📚',
    color: 'bg-purple-500',
    keywords: [
      '교보문고', '예스24', '알라딘', '반디앤루니스', '영풍문고',
      '클래스101', '인프런', '패스트캠퍼스', '노마드코더', '코드잇',
      '강의', '수업', '레슨', '교육',
      '수영장',
    ],
    order: 8,
  },
  {
    id: 'travel',
    name: '여행',
    icon: '✈️',
    color: 'bg-cyan-500',
    keywords: [
      '대한항공', '아시아나', '제주항공', '진에어', '티웨이', '에어부산',
      '야놀자', '여기어때', '에어비앤비', 'airbnb', '호텔', '숙소', '펜션', '모텔',
      '트립닷컴', '아고다', '부킹닷컴', '익스피디아', '호텔스컴바인',
      '여행', '항공', '비행기', '렌터카', '렌트카',
    ],
    order: 9,
  },
  {
    id: 'cash',
    name: '현금',
    icon: '💵',
    color: 'bg-emerald-500',
    keywords: [
      'ATM', '현금', '출금', '인출',
    ],
    order: 10,
  },
  {
    id: 'other',
    name: '기타',
    icon: '📦',
    color: 'bg-gray-500',
    keywords: [], // 기본 카테고리
    order: 99,
  },
]

// 제외 대상 키워드 (지출이 아닌 항목)
export const EXCLUDE_KEYWORDS: string[] = [
  '계좌이체', '이체', '송금',
  '카드값', '카드대금', '결제대금',
  '내 계좌', '본인계좌', '내계좌',
  '환불', '취소', '반품',
  '투자', '주식', '펀드', '예금', '적금',
  '저축', '입금', '월급', '급여',
  '이자', '배당',
  '대출', '상환',
]

// 카테고리 ID로 카테고리 찾기
export function getCategoryById(id: string): Category | undefined {
  return DEFAULT_CATEGORIES.find(cat => cat.id === id)
}

// 사용처 텍스트로 카테고리 추천
export function suggestCategory(merchantText: string): { categoryId: string; confidence: number } {
  const text = merchantText.toLowerCase()

  // 제외 대상인지 먼저 확인
  for (const keyword of EXCLUDE_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      return { categoryId: 'exclude', confidence: 0.9 }
    }
  }

  // 카테고리 매칭
  for (const category of DEFAULT_CATEGORIES) {
    for (const keyword of category.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return { categoryId: category.id, confidence: 0.8 }
      }
    }
  }

  // 매칭 없으면 기타
  return { categoryId: 'other', confidence: 0.3 }
}

// 카테고리 색상 가져오기
export function getCategoryColor(categoryId: string): string {
  const category = getCategoryById(categoryId)
  return category?.color || 'bg-gray-500'
}

// 카테고리 아이콘 가져오기
export function getCategoryIcon(categoryId: string): string {
  const category = getCategoryById(categoryId)
  return category?.icon || '📦'
}
