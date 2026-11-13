/* Хэптическая обратная связь через Vibration API.
   Деликатные вибрации для подтверждения действий: тап, уведомление, ошибка. */

export type HapticsPattern = 'tap' | 'success' | 'warning' | 'error';

const patterns: Record<HapticsPattern, number[]> = {
  tap: [10],
  success: [10, 50, 10],
  warning: [20, 50, 20],
  error: [50, 50, 50],
};

let enabled = true;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

export function haptics(pattern: HapticsPattern = 'tap'): void {
  if (!enabled) return;
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(patterns[pattern]);
  } catch {
    // ignore
  }
}

export function impactLight(): void {
  haptics('tap');
}

export function impactMedium(): void {
  haptics('warning');
}

export function impactHeavy(): void {
  haptics('error');
}

export function notificationSuccess(): void {
  haptics('success');
}

export function notificationWarning(): void {
  haptics('warning');
}

export function notificationError(): void {
  haptics('error');
}
