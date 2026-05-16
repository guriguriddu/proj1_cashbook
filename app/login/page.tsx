'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Screen, ScreenBody, PrimaryButton, T } from '@/components/ui';

type Mode = 'login' | 'signup';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const { signIn, signUp, signInWithGoogle } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (mode === 'signup' && password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      setLoading(false);
      return;
    }

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setError('이메일 또는 비밀번호가 올바르지 않습니다.');
          } else {
            setError(error.message);
          }
        } else {
          router.push('/');
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          if (error.message.includes('already registered')) {
            setError('이미 가입된 이메일입니다.');
          } else {
            setError(error.message);
          }
        } else {
          setSuccess('가입 완료! 이메일을 확인해주세요.');
        }
      }
    } catch {
      setError('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ScreenBody>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 24px',
          }}
        >
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>💰</div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: T.text,
                letterSpacing: '-0.02em',
              }}
            >
              가계부
            </h1>
            <p
              style={{
                fontSize: 15,
                color: T.textSec,
                marginTop: 8,
              }}
            >
              {mode === 'login' ? '로그인하고 시작하세요' : '새 계정 만들기'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <input
                type="email"
                placeholder="이메일"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: 16,
                  border: `1px solid ${T.divider}`,
                  borderRadius: 12,
                  outline: 'none',
                  background: T.bgMuted,
                }}
              />
              <input
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: 16,
                  border: `1px solid ${T.divider}`,
                  borderRadius: 12,
                  outline: 'none',
                  background: T.bgMuted,
                }}
              />
              {mode === 'signup' && (
                <input
                  type="password"
                  placeholder="비밀번호 확인"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: 16,
                    border: `1px solid ${T.divider}`,
                    borderRadius: 12,
                    outline: 'none',
                    background: T.bgMuted,
                  }}
                />
              )}
            </div>

            {error && (
              <p
                style={{
                  color: T.danger,
                  fontSize: 14,
                  marginTop: 16,
                  textAlign: 'center',
                }}
              >
                {error}
              </p>
            )}

            {success && (
              <p
                style={{
                  color: T.accent,
                  fontSize: 14,
                  marginTop: 16,
                  textAlign: 'center',
                }}
              >
                {success}
              </p>
            )}

            <div style={{ marginTop: 24 }}>
              <PrimaryButton
                type="submit"
                disabled={loading}
                style={{ width: '100%' }}
              >
                {loading
                  ? '처리 중...'
                  : mode === 'login'
                  ? '로그인'
                  : '회원가입'}
              </PrimaryButton>
            </div>
          </form>

          {/* Divider */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            margin: '24px 0',
            gap: 16,
          }}>
            <div style={{ flex: 1, height: 1, background: T.divider }} />
            <span style={{ color: T.textSec, fontSize: 14 }}>또는</span>
            <div style={{ flex: 1, height: 1, background: T.divider }} />
          </div>

          {/* Google Login */}
          <button
            type="button"
            onClick={async () => {
              setError('');
              const { error } = await signInWithGoogle();
              if (error) {
                setError('Google 로그인에 실패했습니다.');
              }
            }}
            style={{
              width: '100%',
              padding: '14px 16px',
              fontSize: 16,
              fontWeight: 600,
              border: `1px solid ${T.divider}`,
              borderRadius: 12,
              background: T.bg,
              color: T.text,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google로 계속하기
          </button>

          {/* Toggle Mode */}
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError('');
                setSuccess('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: T.accent,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {mode === 'login'
                ? '계정이 없으신가요? 회원가입'
                : '이미 계정이 있으신가요? 로그인'}
            </button>
          </div>
        </div>
      </ScreenBody>
    </Screen>
  );
}
