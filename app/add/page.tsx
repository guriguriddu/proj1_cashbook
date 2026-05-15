'use client'

import Link from 'next/link'

export default function AddPage() {
  return (
    <div className="p-4 min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">지출 추가</h1>
        <p className="text-sm text-gray-500 mt-1">
          지출을 추가할 방법을 선택하세요
        </p>
      </header>

      {/* 선택 카드들 */}
      <div className="space-y-4">
        {/* 사진으로 추가 */}
        <Link href="/add/photo">
          <div className="card p-6 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-3xl">📷</span>
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900 text-lg">사진으로 추가</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                토스, 카드내역 캡쳐를 업로드하면 자동으로 인식해요
              </p>
            </div>
            <span className="text-gray-400">›</span>
          </div>
        </Link>

        {/* 직접 입력 */}
        <Link href="/add/manual">
          <div className="card p-6 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-3xl">✏️</span>
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900 text-lg">직접 입력</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                금액과 내용을 직접 입력해요
              </p>
            </div>
            <span className="text-gray-400">›</span>
          </div>
        </Link>
      </div>

      {/* 안내 문구 */}
      <div className="mt-8 p-4 bg-blue-50 rounded-xl">
        <p className="text-sm text-blue-700">
          💡 <strong>팁:</strong> 토스나 카드 앱에서 결제 내역을 캡쳐하면 더 빠르게 입력할 수 있어요!
        </p>
      </div>
    </div>
  )
}
