'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Screen,
  ScreenBody,
  AppHeader,
  T,
  Badge,
} from '@/components/ui';
import { getImportLogs, clearImportLogs, type ImportLog } from '@/lib/import-log';

function formatWon(n: number) {
  return n >= 10000 ? Math.floor(n / 10000) + '만원' : n.toLocaleString() + '원';
}
function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function formatRange(start: string, end: string) {
  if (start === end) return start.slice(5).replace('-', '/');
  return start.slice(5).replace('-', '/') + ' ~ ' + end.slice(5).replace('-', '/');
}

export default function AddPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setLogs(getImportLogs());
  }, []);

  return (
    <Screen>
      <AppHeader title="지출 추가" onBack={() => router.push('/')} />
      <ScreenBody>
        <div style={{ padding: '24px 20px 8px' }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: T.text,
              marginBottom: 6,
              lineHeight: 1.3,
            }}
          >
            어떻게 추가할까요?
          </div>
          <div style={{ fontSize: 14, color: T.textSec, lineHeight: 1.5 }}>
            토스·카드·영수증 캡쳐를 올리면 자동으로 거래 내역을 추출해드려요.
          </div>
        </div>

        <div
          style={{
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* 사진으로 추가 */}
          <ChoiceCard
            onClick={() => router.push('/add/photo')}
            accent
            iconBg={T.accentSoft}
            iconColor={T.accent}
            icon={
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect
                  x="3"
                  y="6"
                  width="22"
                  height="17"
                  rx="2.5"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle
                  cx="10"
                  cy="13"
                  r="2.2"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M3 19l6-5 5 4 4-3 7 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
            title="사진으로 추가"
            desc="토스 / 카드 / 영수증 캡쳐 OCR"
            badge={<Badge tone="accent" size="md">추천</Badge>}
          />

          {/* 영상으로 추가 */}
          <ChoiceCard
            onClick={() => router.push('/add/video')}
            iconBg="#EDE9FE"
            iconColor="#7C3AED"
            icon={
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="3" y="6" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="2" />
                <path d="M19 11l6-3v12l-6-3v-6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            }
            title="영상으로 추가"
            desc="스크롤 녹화 영상 한 개 → AI가 전체 추출"
            badge={<Badge tone="purple" size="md">NEW</Badge>}
          />

          {/* 엑셀(뱅크샐러드) — 무료 로컬 분석 */}
          <ChoiceCard
            onClick={() => router.push('/add/excel')}
            iconBg="#E8F5E9"
            iconColor="#16A34A"
            icon={
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="3" y="5" width="22" height="18" rx="2.5" stroke="currentColor" strokeWidth="2" />
                <path d="M3 11h22M3 17h22M11 5v18M19 5v18" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            }
            title="엑셀 (뱅크샐러드)"
            desc="뱅크샐러드 .xlsx → 바로 무료로 불러오기"
            badge={<Badge tone="accent" size="md">무료</Badge>}
          />

          {/* 파일 가져오기 — AI 분석 (엑셀·PDF) */}
          <ChoiceCard
            onClick={() => router.push('/add/import')}
            iconBg="#EFF6FF"
            iconColor="#2563EB"
            icon={
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="3" width="14" height="22" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M4 3l14 0 6 6v16a2 2 0 01-2 2H6a2 2 0 01-2-2V3z" stroke="currentColor" strokeWidth="2" fill="none" />
                <path d="M18 3v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M8 14l3 3 3-3M11 17v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            title="파일 가져오기 (AI)"
            desc="PDF 명세서·복잡한 엑셀 → AI가 자동 분석 (.xlsx / .pdf)"
            badge={<Badge tone="blue" size="md">AI</Badge>}
          />

          {/* 직접 입력 */}
          <ChoiceCard
            onClick={() => router.push('/add/manual')}
            iconBg={T.bgMuted}
            iconColor={T.text}
            icon={
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path
                  d="M14 4v20M4 14h20"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </svg>
            }
            title="직접 입력"
            desc="금액과 사용처를 직접 입력"
          />
        </div>

        <div style={{ padding: '0 20px 8px', fontSize: 12, color: T.textTer, lineHeight: 1.6 }}>
          여러 장의 영수증을 한 번에 올려도 괜찮아요. 추출 후 검수 단계에서 자유롭게 수정·제외할 수 있어요.
        </div>

        {/* import 히스토리 */}
        {logs.length > 0 && (
          <div style={{ padding: '8px 20px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <button
                onClick={() => setShowHistory(v => !v)}
                style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: T.textSec, letterSpacing: '-0.01em' }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6" stroke={T.textSec} strokeWidth="1.4" />
                  <path d="M7 4v3.5l2 1.5" stroke={T.textSec} strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                가져오기 기록 ({logs.length}건)
                <svg width="12" height="12" viewBox="0 0 12 12" style={{ transform: showHistory ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                  <path d="M2 4l4 4 4-4" stroke={T.textSec} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {showHistory && (
                <button
                  onClick={() => { clearImportLogs(); setLogs([]); setShowHistory(false); }}
                  style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontSize: 12, color: T.textTer }}
                >
                  전체 삭제
                </button>
              )}
            </div>
            {showHistory && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {logs.map(log => (
                  <div key={log.id} style={{ background: T.bgSoft, borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: log.source === 'ocr' ? T.accentSoft : '#E8F5E9', color: log.source === 'ocr' ? T.accent : '#16A34A' }}>
                          {log.source === 'ocr' ? '사진' : '파일'}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{formatRange(log.dateRangeStart, log.dateRangeEnd)}</span>
                      </div>
                      <span style={{ fontSize: 11, color: T.textTer }}>{formatDate(log.importedAt)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: T.textSec }}>
                      {log.count}건 · {formatWon(log.totalAmount)}
                    </div>
                    <div style={{ fontSize: 11, color: T.textTer, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.merchants.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </ScreenBody>
    </Screen>
  );
}

function ChoiceCard({
  onClick,
  icon,
  iconBg,
  iconColor,
  title,
  desc,
  badge,
  accent,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  desc: string;
  badge?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        border: 0,
        padding: 20,
        borderRadius: 18,
        background: accent ? T.accentSoft + '80' : T.bgSoft,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'transform .12s',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: iconBg,
          color: iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
          }}
        >
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </div>
          {badge}
        </div>
        <div
          style={{
            fontSize: 13,
            color: T.textSec,
            letterSpacing: '-0.01em',
          }}
        >
          {desc}
        </div>
      </div>
      <svg
        width="9"
        height="16"
        viewBox="0 0 9 16"
        style={{ flexShrink: 0 }}
      >
        <path
          d="M1.5 1.5l6 6.5-6 6.5"
          stroke={T.textTer}
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
