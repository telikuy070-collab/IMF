/* Чистые функции форматирования и утилиты времени.
   Нет зависимостей от приложения — легко тестируются изолированно. */

import type { ConnectivityResult } from '@core/domain/connectivity';

export function lessonWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'пара';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'пары';
  return 'пар';
}

export function formatStamp(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function hoursSince(iso?: string): number {
  if (!iso) return Number.NaN;
  const at = new Date(iso).getTime();
  return Number.isNaN(at) ? Number.NaN : (Date.now() - at) / 3_600_000;
}

export function offlineNoticeText(notice: ConnectivityResult, updatedAt?: string): string {
  if (!notice.offline) return '';
  const hours = hoursSince(updatedAt);
  if (!Number.isFinite(hours) || hours <= 12) return notice.text;
  const stamp = formatStamp(updatedAt);
  return stamp
    ? `${notice.text} · копия от ${stamp}, может быть неактуально`
    : `${notice.text} · копия может быть неактуальна`;
}

export function readableErrorMessage(error: { userMessage?: unknown }): string {
  const text = typeof error?.userMessage === 'string' ? error.userMessage.trim() : '';
  if (text && text !== '[object Object]') return text;
  return 'Не удалось обновить расписание. Показываем сохранённое.';
}
