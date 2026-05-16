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

  const { signIn, signUp } = useAuth();
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
