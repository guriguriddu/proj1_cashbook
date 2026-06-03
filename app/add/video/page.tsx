'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Screen,
  AppHeader,
  ScreenBody,
  T,
  PrimaryButton,
  ProgressBar,
  Badge,
} from '@/components/ui';
import { performVideoOcr, performVideoOcrByUrl, parseGeminiResponse, parseOcrText, OcrProgressCallback } from '@/lib/ocr';
import { uploadReceiptImage, getReceiptImageUrl, deleteReceiptImage } from '@/lib/supabase-storage';
import type { ExtractedTransaction } from '@/types';

// 업로드 가능한 클립당 최대 용량.
const MAX_UPLOAD_MB = 50;
// 이 크기 이하는 서버로 직접 전송(빠름). 초과분은 Vercel 본문 4.5MB 한도 때문에
// 스토리지에 올린 뒤 서명 URL 만 서버로 전달한다.
const DIRECT_MAX_MB = 4.5;
// 클립이 길면 Gemini 처리시간이 60초(Vercel 함수 한도)를 넘겨 504 가 난다.
// 측정: 처리시간 ≈ 13 + 1.9 × 영상초. 20초(~51s)부터 위험 → 경고.
const WARN_DURATION_SEC = 20;
const MAX_VIDEOS = 8;

interface Clip {
  id: string;
  file: File;
  url: string;
  durationSec: number | null;
}

// 브라우저에서 영상 길이(초) 읽기
function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      const d = v.duration;
      URL.revokeObjectURL(v.src);
      resolve(Number.isFinite(d) ? d : 0);
    };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });
}

export default function VideoUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [clips, setClips] = useState<Clip[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);

    const incoming = Array.from(files).slice(0, MAX_VIDEOS - clips.length);
    for (const file of incoming) {
      if (!file.type.startsWith('video/')) {
        setError('영상 파일만 올려주세요 (.mp4, .mov 등)');
        continue;
      }
      const sizeMb = file.size / (1024 * 1024);
      if (sizeMb > MAX_UPLOAD_MB) {
        setError(`"${file.name}" 이(가) 너무 커요 (${sizeMb.toFixed(1)}MB). ${MAX_UPLOAD_MB}MB 이하로 올려주세요.`);
        continue;
      }
      const id = 'v' + Date.now() + Math.random();
      const clip: Clip = { id, file, url: URL.createObjectURL(file), durationSec: null };
      setClips((prev) => (prev.length >= MAX_VIDEOS ? prev : [...prev, clip]));
      // 길이는 비동기로 채움
      readDuration(file).then((d) => {
        setClips((prev) => prev.map((c) => (c.id === id ? { ...c, durationSec: d } : c)));
      });
    }
  };

  const removeClip = (id: string) => setClips((prev) => prev.filter((c) => c.id !== id));

  const smoothProgress = (from: number, to: number, duration: number) => {
    const startTime = Date.now();
    const step = () => {
      const elapsed = Date.now() - startTime;
      const ratio = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - ratio) * (1 - ratio);
      setProgress(Math.round(from + (to - from) * eased));
      if (ratio < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const startExtract = async () => {
    if (clips.length === 0) return;

    setExtracting(true);
    setProgress(0);
    setError(null);

    const allTx: ExtractedTransaction[] = [];
    const failures: string[] = [];
    const band = 90 / clips.length; // 클립당 진행률 구간

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const base = i * band;
      setStatusText(clips.length > 1 ? `영상 ${i + 1}/${clips.length} 분석 중…` : '영상 분석 중…');
      // 이 클립 처리 동안 천천히 차오름
      smoothProgress(base, base + band * 0.9, 30000);

      const handleProgress: OcrProgressCallback = () => {};
      const sizeMb = clip.file.size / (1024 * 1024);
      let storagePath: string | null = null;

      try {
        let ocrText: string;
        if (sizeMb <= DIRECT_MAX_MB) {
          ocrText = await performVideoOcr(clip.file, handleProgress);
        } else {
          storagePath = await uploadReceiptImage(clip.file);
          const signedUrl = await getReceiptImageUrl(storagePath);
          if (!signedUrl) throw new Error('업로드한 영상 URL을 만들지 못했습니다.');
          ocrText = await performVideoOcrByUrl(signedUrl, handleProgress);
        }

        let extracted = parseGeminiResponse(ocrText);
        if (extracted.length === 0) extracted = parseOcrText(ocrText);
        allTx.push(...extracted);
      } catch (err) {
        console.error(`영상 ${i + 1} 처리 실패:`, err);
        const msg = err instanceof Error ? err.message : '실패';
        failures.push(`영상 ${i + 1}: ${msg}`);
      } finally {
        if (storagePath) deleteReceiptImage(storagePath).catch(() => {});
      }

      setProgress(Math.round(base + band));
    }

    // 결과 처리
    if (allTx.length === 0) {
      setError(failures.length ? failures.join('\n') : '추출된 거래가 없습니다.');
      setExtracting(false);
      return;
    }

    smoothProgress(90, 100, 250);

    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ocrTransactions', JSON.stringify(allTx));
      sessionStorage.setItem('uploadedImagePaths', JSON.stringify([]));
    }

    if (failures.length > 0) {
      alert(`일부 영상은 처리하지 못했어요 (성공 ${clips.length - failures.length}/${clips.length}):\n\n${failures.join('\n')}\n\n성공한 ${allTx.length}건으로 검수를 이어갑니다.`);
    }

    setTimeout(() => router.push('/add/photo/review'), 350);
  };

  const tooLongCount = clips.filter((c) => c.durationSec != null && c.durationSec > WARN_DURATION_SEC).length;

  return (
    <Screen>
      <AppHeader title="영상으로 추가" onBack={() => router.push('/add')} />

      <ScreenBody padBottom={120}>
        {/* 안내 */}
        <div style={{ padding: '16px 20px 4px' }}>
          <div style={{ fontSize: 14, color: T.textSec, lineHeight: 1.6 }}>
            토스·뱅크 거래내역을 <strong>천천히 스크롤하며 화면 녹화</strong>한 영상을 올리면 거래를 자동 추출해요.
            <br />
            <span style={{ color: T.textTer, fontSize: 13 }}>
              한 클립은 <strong>15초 이내</strong>로 짧게 — 길면 처리 시간 초과(504)가 나요.
              내역이 길면 <strong>여러 클립으로 나눠 한 번에</strong> 올리세요 (최대 {MAX_VIDEOS}개).
            </span>
          </div>
        </div>

        {/* 드롭 영역 */}
        <div style={{ padding: '12px 20px' }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files);
            }}
            style={{
              padding: '28px 20px',
              borderRadius: 18,
              border: `2px dashed ${dragOver ? T.accent : T.divider}`,
              background: dragOver ? T.accentSoft + '60' : T.bgSoft,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all .15s',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                background: T.bg,
                color: T.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
                boxShadow: '0 2px 6px rgba(10,13,20,0.06)',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 30 30" fill="none">
                <rect x="3" y="7" width="17" height="16" rx="2.5" stroke="currentColor" strokeWidth="2" />
                <path d="M20 12l7-3v12l-7-3v-6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>
              영상 끌어다 놓기 (여러 개 가능)
            </div>
            <div style={{ fontSize: 13, color: T.textSec, lineHeight: 1.5 }}>
              또는 탭해서 선택 · .mp4 / .mov · 클립당 최대 {MAX_UPLOAD_MB}MB
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              multiple
              onChange={(e) => onFiles(e.target.files)}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {/* 선택된 클립 목록 */}
        {clips.length > 0 && (
          <div style={{ padding: '0 20px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {clips.map((clip, idx) => {
              const sizeMb = clip.file.size / (1024 * 1024);
              const tooLong = clip.durationSec != null && clip.durationSec > WARN_DURATION_SEC;
              return (
                <div
                  key={clip.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 10,
                    borderRadius: 12,
                    background: T.bgSoft,
                    border: `1px solid ${tooLong ? '#F59E0B' : T.divider}`,
                  }}
                >
                  <video
                    src={clip.url}
                    style={{ width: 54, height: 54, borderRadius: 8, objectFit: 'cover', background: '#000', flexShrink: 0 }}
                    muted
                    playsInline
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>영상 {idx + 1}</span>
                      {tooLong && <Badge tone="warn" size="sm">길어요 · 504 위험</Badge>}
                    </div>
                    <div style={{ fontSize: 12, color: T.textTer, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {clip.durationSec != null ? `${clip.durationSec.toFixed(0)}초` : '…'} · {sizeMb.toFixed(1)}MB
                    </div>
                  </div>
                  <button
                    onClick={() => removeClip(clip.id)}
                    aria-label="삭제"
                    style={{ width: 30, height: 30, borderRadius: 15, border: 0, background: T.bgMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12">
                      <path d="M1 1l10 10M11 1L1 11" stroke={T.textSec} strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 길이 경고 */}
        {tooLongCount > 0 && (
          <div style={{ padding: '4px 20px' }}>
            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.14)', fontSize: 12, fontWeight: 600, color: '#92400E', lineHeight: 1.5 }}>
              {tooLongCount}개 클립이 {WARN_DURATION_SEC}초를 넘어요. 처리 중 시간 초과될 수 있으니 15초 이내로 잘라 다시 올리는 걸 권장해요.
            </div>
          </div>
        )}

        {/* 팁 */}
        <div style={{ padding: '8px 20px', fontSize: 12, color: T.textTer, lineHeight: 1.6 }}>
          ※ 각 거래가 잘 보이도록 천천히 스크롤하세요. 여러 클립을 올리면 자동으로 합치고 <strong>중복은 검수 단계에서 제거</strong>돼요.
        </div>

        {/* 에러 */}
        {error && (
          <div style={{ margin: '8px 20px', padding: '14px 16px', background: T.dangerSoft, borderRadius: 12, border: `1px solid ${T.danger}20` }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.danger, marginBottom: 4 }}>처리 실패</div>
            <div style={{ fontSize: 13, color: T.danger, opacity: 0.85, whiteSpace: 'pre-line' }}>{error}</div>
          </div>
        )}
      </ScreenBody>

      {/* 하단 버튼 */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 84,
          padding: '12px 20px 16px',
          background: 'linear-gradient(to top, rgba(255,255,255,1) 60%, rgba(255,255,255,0))',
          maxWidth: 512,
          margin: '0 auto',
          zIndex: 100,
        }}
      >
        <PrimaryButton onClick={startExtract} disabled={clips.length === 0}>
          소비 내역 추출 {clips.length > 0 && `(${clips.length}개)`}
        </PrimaryButton>
      </div>

      {/* 추출 중 오버레이 */}
      {extracting && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255,255,255,0.96)',
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 40,
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              background: T.accentSoft,
              color: T.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
              animation: 'pulse 1.6s infinite',
            }}
          >
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect x="5" y="10" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2.2" />
              <path d="M25 15l7-3v12l-7-3v-6z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.02em' }}>
            {statusText || '영상을 분석하고 있어요'}
          </div>
          <div style={{ fontSize: 14, color: T.textSec, marginBottom: 28, textAlign: 'center', lineHeight: 1.5 }}>
            거래의 날짜·금액·사용처를 인식하는 중입니다…
          </div>
          <div style={{ width: '100%', maxWidth: 260, marginBottom: 8 }}>
            <ProgressBar value={progress} height={8} />
          </div>
          <div style={{ fontSize: 13, color: T.textTer, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
            {Math.round(progress)}%
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.85; }
        }
      `}</style>
    </Screen>
  );
}
