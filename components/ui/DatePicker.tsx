'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { T } from './theme';

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  label?: string;
}

export function DatePicker({ value, onChange, label }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'calendar' | 'year' | 'month'>('calendar');
  const [mounted, setMounted] = useState(false);

  const date = new Date(value);
  const [viewYear, setViewYear] = useState(date.getFullYear());
  const [viewMonth, setViewMonth] = useState(date.getMonth());

  const selectedYear = date.getFullYear();
  const selectedMonth = date.getMonth();
  const selectedDay = date.getDate();

  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  // 달력 날짜 계산
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  // 이전달 마지막 날짜들
  const prevMonthDays = Array.from({ length: firstDayOfMonth }, (_, i) => ({
    day: daysInPrevMonth - firstDayOfMonth + i + 1,
    current: false,
    date: new Date(viewYear, viewMonth - 1, daysInPrevMonth - firstDayOfMonth + i + 1),
  }));

  // 현재 달 날짜들
  const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    current: true,
    date: new Date(viewYear, viewMonth, i + 1),
  }));

  // 다음달 시작 날짜들 (6주 채우기)
  const totalDays = prevMonthDays.length + currentMonthDays.length;
  const nextMonthDays = Array.from({ length: 42 - totalDays }, (_, i) => ({
    day: i + 1,
    current: false,
    date: new Date(viewYear, viewMonth + 1, i + 1),
  }));

  const allDays = [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];

  // 년도 목록 (현재 년도 기준 ±10년)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);

  const selectDate = (d: Date) => {
    const formatted = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    onChange(formatted);
    setIsOpen(false);
    setMode('calendar');
  };

  const selectYear = (year: number) => {
    setViewYear(year);
    setMode('month');
  };

  const selectMonth = (month: number) => {
    setViewMonth(month);
    setMode('calendar');
  };

  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
  };

  const yearScrollRef = useRef<HTMLDivElement>(null);
  const monthScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 년도 선택시 현재 선택된 년도로 스크롤
  useEffect(() => {
    if (mode === 'year' && yearScrollRef.current) {
      const selectedEl = yearScrollRef.current.querySelector('[data-selected="true"]');
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
    }
  }, [mode]);

  // 월 선택시 현재 선택된 월로 스크롤
  useEffect(() => {
    if (mode === 'month' && monthScrollRef.current) {
      const selectedEl = monthScrollRef.current.querySelector('[data-selected="true"]');
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
    }
  }, [mode]);

  const calendarContent = isOpen ? (
    <>
      {/* 배경 오버레이 */}
      <div
        onClick={() => {
          setIsOpen(false);
          setMode('calendar');
        }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.3)',
          zIndex: 300,
        }}
      />

      {/* 달력 - 화면 중앙에 모달로 표시 */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'calc(100% - 40px)',
          maxWidth: 340,
          background: T.bg,
          borderRadius: 20,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          zIndex: 301,
          overflow: 'hidden',
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: `1px solid ${T.divider}`,
          }}
        >
          {mode === 'calendar' && (
            <>
              <button
                onClick={() => {
                  if (viewMonth === 0) {
                    setViewYear(viewYear - 1);
                    setViewMonth(11);
                  } else {
                    setViewMonth(viewMonth - 1);
                  }
                }}
                style={{
                  width: 32,
                  height: 32,
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M10 4l-4 4 4 4" stroke={T.text} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </button>

              <button
                onClick={() => setMode('year')}
                style={{
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 16,
                  fontWeight: 700,
                  color: T.text,
                  padding: '4px 12px',
                  borderRadius: 8,
                }}
              >
                {viewYear}년 {viewMonth + 1}월
              </button>

              <button
                onClick={() => {
                  if (viewMonth === 11) {
                    setViewYear(viewYear + 1);
                    setViewMonth(0);
                  } else {
                    setViewMonth(viewMonth + 1);
                  }
                }}
                style={{
                  width: 32,
                  height: 32,
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M6 4l4 4-4 4" stroke={T.text} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </button>
            </>
          )}

          {mode === 'year' && (
            <div style={{ width: '100%', textAlign: 'center', fontSize: 16, fontWeight: 700, color: T.text }}>
              년도 선택
            </div>
          )}

          {mode === 'month' && (
            <>
              <button
                onClick={() => setMode('year')}
                style={{
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 16,
                  fontWeight: 700,
                  color: T.text,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M10 4l-4 4 4 4" stroke={T.text} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
                {viewYear}년
              </button>
              <div style={{ fontSize: 14, color: T.textSec }}>월 선택</div>
            </>
          )}
        </div>

        {/* 달력 본문 */}
        {mode === 'calendar' && (
          <div style={{ padding: '8px 12px 12px' }}>
            {/* 요일 헤더 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
              {days.map((day, i) => (
                <div
                  key={day}
                  style={{
                    textAlign: 'center',
                    fontSize: 12,
                    fontWeight: 600,
                    color: i === 0 ? '#EF4444' : i === 6 ? '#3B82F6' : T.textTer,
                    padding: '6px 0',
                  }}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {allDays.map((d, i) => {
                const isSelected =
                  d.current &&
                  d.day === selectedDay &&
                  viewMonth === selectedMonth &&
                  viewYear === selectedYear;
                const isToday =
                  d.current &&
                  d.day === new Date().getDate() &&
                  viewMonth === new Date().getMonth() &&
                  viewYear === new Date().getFullYear();
                const dayOfWeek = i % 7;

                return (
                  <button
                    key={i}
                    onClick={() => selectDate(d.date)}
                    style={{
                      aspectRatio: '1',
                      border: 0,
                      borderRadius: 8,
                      background: isSelected ? T.accent : 'transparent',
                      color: isSelected
                        ? '#fff'
                        : !d.current
                        ? T.textMuted
                        : dayOfWeek === 0
                        ? '#EF4444'
                        : dayOfWeek === 6
                        ? '#3B82F6'
                        : T.text,
                      fontSize: 14,
                      fontWeight: isSelected || isToday ? 700 : 500,
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    {d.day}
                    {isToday && !isSelected && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 4,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: 4,
                          height: 4,
                          borderRadius: 2,
                          background: T.accent,
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 년도 선택 */}
        {mode === 'year' && (
          <div
            ref={yearScrollRef}
            style={{
              maxHeight: 280,
              overflowY: 'auto',
              padding: '8px 12px',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {years.map((year) => (
                <button
                  key={year}
                  data-selected={year === viewYear}
                  onClick={() => selectYear(year)}
                  style={{
                    padding: '14px 8px',
                    border: 0,
                    borderRadius: 10,
                    background: year === viewYear ? T.accent : T.bgSoft,
                    color: year === viewYear ? '#fff' : T.text,
                    fontSize: 15,
                    fontWeight: year === viewYear ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {year}년
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 월 선택 */}
        {mode === 'month' && (
          <div
            ref={monthScrollRef}
            style={{
              maxHeight: 280,
              overflowY: 'auto',
              padding: '8px 12px',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {months.map((month, i) => (
                <button
                  key={i}
                  data-selected={i === viewMonth}
                  onClick={() => selectMonth(i)}
                  style={{
                    padding: '14px 8px',
                    border: 0,
                    borderRadius: 10,
                    background: i === viewMonth ? T.accent : T.bgSoft,
                    color: i === viewMonth ? '#fff' : T.text,
                    fontSize: 15,
                    fontWeight: i === viewMonth ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {month}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  ) : null;

  return (
    <div style={{ position: 'relative' }}>
      {/* 날짜 표시 버튼 */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setMode('calendar');
          setViewYear(selectedYear);
          setViewMonth(selectedMonth);
        }}
        style={{
          width: '100%',
          border: `1px solid ${T.divider}`,
          background: T.bg,
          borderRadius: 10,
          padding: '12px 14px',
          fontSize: 16,
          fontWeight: 600,
          color: T.text,
          fontFamily: 'Pretendard, system-ui, sans-serif',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>{formatDisplayDate(value)}</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="3" width="12" height="11" rx="2" stroke={T.textSec} strokeWidth="1.4" />
          <path d="M2 6h12M5 1v3M11 1v3" stroke={T.textSec} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>

      {/* 달력을 Portal로 body에 렌더링 */}
      {mounted && createPortal(calendarContent, document.body)}
    </div>
  );
}
