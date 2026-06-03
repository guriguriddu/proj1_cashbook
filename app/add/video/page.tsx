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
} from '@/components/ui';
import { performVideoOcr, performVideoOcrByUrl, parseGeminiResponse, parseOcrText, OcrProgressCallback } from '@/lib/ocr';
import { uploadReceiptImage, getReceiptImageUrl, deleteReceiptImage } from '@/lib/supabase-storage';
import type { ExtractedTransaction } from '@/types';

// 업로드 가능한 최대 용량.
const MAX_UPLOAD_MB = 50;
// 이 크기 이하는 서버로 직접 전송(빠름). 초과분은 Vercel 본문 4.5MB 한도 때문에
// 스토리지에 올린 뒤 서명 URL 만 서버로 전달한다.
const DIRECT_MAX_MB = 4.5;

export default function VideoUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [video, setVideo] = useState<{ file: File; url: string } | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('video/')) {
      setError('영상 파일을 선택해주세요 (.mp4, .mov 등)');
      return;
    }
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_UPLOAD_MB) {
      setError(
        `영상이 너무 커요 (${sizeMb.toFixed(1)}MB). ${MAX_UPLOAD_MB}MB 이하로 올려주세요.\n` +
        `· 화면 녹화 화질을 낮추거나 · 기간을 나눠 짧게 녹화하면 용량이 줄어요.`
      );
      return;
    }
    setError(null);
    setVideo({ file, url: URL.createObjectURL(file) });
  };

  // 부드러운 프로그레스
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
    if (!video) return;

    setExtracting(true);
    setProgress(0);
    setError(null);

    // 업로드/처리 동안 천천히 차오르는 가짜 진행률 (Gemini 응답까지 시간이 걸림)
    smoothProgress(0, 85, 25000);

    const handleProgress: OcrProgressCallback = (prog) => {
      if (prog >= 100) smoothProgress(85, 95, 300);
    };

    const sizeMb = video.file.size / (1024 * 1024);
    let storagePath: string | null = null;

    try {
      let ocrText: string;

      if (sizeMb <= DIRECT_MAX_MB) {
        // 작은 영상 — 서버로 직접 전송
        ocrText = await performVideoOcr(video.file, handleProgress);
      } else {
        // 대용량 — 스토리지 업로드 → 서명 URL → 서버가 Gemini Files API 로 처리
        storagePath = await uploadReceiptImage(video.file);
        const signedUrl = await getReceiptImageUrl(storagePath);
        if (!signedUrl) throw new Error('업로드한 영상 URL을 만들지 못했습니다.');
        ocrText = await performVideoOcrByUrl(signedUrl, handleProgress);
      }

      let extracted: ExtractedTransaction[] = parseGeminiResponse(ocrText);
      if (extracted.length === 0) {
        extracted = parseOcrText(ocrText);
      }

      smoothProgress(95, 100, 250);

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('ocrTransactions', JSON.stringify(extracted));
        sessionStorage.setItem('uploadedImagePaths', JSON.stringify([]));
      }

      setTimeout(() => router.push('/add/photo/review'), 350);
    } catch (err) {
      console.error('영상 추출 실패:', err);
      setError(err instanceof Error ? err.message : '영상 인식 실패');
      setExtracting(false);
    } finally {
      // 추출에 쓴 임시 영상은 스토리지에서 정리 (실패해도 무시)
      if (storagePath) {
        deleteReceiptImage(storagePath).catch(() => {});
      }
    }
  };

  return (
    <Screen>
      <AppHeader title="영상으로 추가" onBack={() => router.push('/add')} />

      <ScreenBody padBottom={120}>
        {/* 안내 */}
        <div style={{ padding: '16px 20px 4px' }}>
          <div style={{ fontSize: 14, color: T.textSec, lineHeight: 1.6 }}>
            토스·뱅크 거래내역을 <strong>위에서 아래로 천천히 스크롤하며 화면 녹화</strong>한 영상을
            올리면, 영상 전체에서 거래를 한 번에 추출해드려요.
            <br />
            <span style={{ color: T.textTer, fontSize: 13 }}>
              영상 용량은 <strong>{MAX_UPLOAD_MB}MB 이하</strong> · 인식 정확도·속도를 위해 <strong>2~3분 이내</strong>를 권장해요
            </span>
          </div>
        </div>

        {/* 드롭 영역 / 미리보기 */}
        <div style={{ padding: '12px 20px' }}>
          {!video ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer?.files?.length) onFile(e.dataTransfer.files);
              }}
              style={{
                padding: '40px 20px',
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
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  background: T.bg,
                  color: T.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                  boxShadow: '0 2px 6px rgba(10,13,20,0.06)',
                }}
              >
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                  <rect x="3" y="7" width="17" height="16" rx="2.5" stroke="currentColor" strokeWidth="2" />
                  <path d="M20 12l7-3v12l-7-3v-6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>
                영상 끌어다 놓기
              </div>
              <div style={{ fontSize: 13, color: T.textSec, lineHeight: 1.5 }}>
                또는 탭해서 영상 선택 (.mp4 / .mov · 최대 {MAX_UPLOAD_MB}MB)
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={(e) => onFile(e.target.files)}
                style={{ display: 'none' }}
              />
            </div>
          ) : (
            <div
              style={{
                borderRadius: 18,
                overflow: 'hidden',
                background: '#000',
                position: 'relative',
              }}
            >
              <video
                src={video.url}
                controls
                playsInline
                style={{ width: '100%', maxHeight: 420, display: 'block' }}
              />
              <button
                onClick={() => { setVideo(null); setError(null); }}
                aria-label="삭제"
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  border: 0,
                  background: 'rgba(10,13,20,0.7)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <path d="M1 1l10 10M11 1L1 11" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {video && (
          <div style={{ padding: '0 20px', fontSize: 13, color: T.textSec, fontWeight: 600 }}>
            {video.file.name} · {(video.file.size / (1024 * 1024)).toFixed(1)}MB
          </div>
        )}

        {/* 팁 */}
        <div style={{ padding: '12px 20px', fontSize: 12, color: T.textTer, lineHeight: 1.6 }}>
          ※ 각 거래가 잘 보이도록 너무 빠르지 않게 스크롤하면 인식률이 올라가요. 추출 후 검수 단계에서 자유롭게 수정·제외할 수 있어요.
        </div>

        {/* 에러 */}
        {error && (
          <div
            style={{
              margin: '8px 20px',
              padding: '14px 16px',
              background: T.dangerSoft,
              borderRadius: 12,
              border: `1px solid ${T.danger}20`,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: T.danger, marginBottom: 4 }}>
              영상 인식 실패
            </div>
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
        <PrimaryButton onClick={startExtract} disabled={!video}>
          소비 내역 추출
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
            영상에서 거래를 추출하고 있어요
          </div>
          <div style={{ fontSize: 14, color: T.textSec, marginBottom: 28, textAlign: 'center', lineHeight: 1.5 }}>
            영상 전체를 분석하는 중입니다…
            <br />
            길이에 따라 20~40초 정도 걸릴 수 있어요.
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
