/* Тема приложения: light / dark / system. Сигнал + сохранение в localStorage + динамический мета-тег theme-color. */

import { signal, computed, effect } from '@preact/signals';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'imf.theme';

const readStored = (): Theme => {
  if (typeof localStorage === 'undefined') return 'system';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // ignore
  }
  return 'system';
};

export const theme = signal<Theme>(readStored());

export const isDark = computed(() => {
  if (theme.value === 'system') {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return theme.value === 'dark';
});

let mediaListener: (() => void) | null = null;

export function applyTheme(next: Theme): void {
  theme.value = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore
  }
  updateHtmlClass();
  updateThemeColor();
}

export function updateHtmlClass(): void {
  if (typeof document === 'undefined') return;
  const dark = isDark.value;
  document.documentElement.classList.toggle('theme-dark', dark);
  document.documentElement.classList.toggle('theme-light', !dark);
}

export function updateThemeColor(): void {
  if (typeof document === 'undefined') return;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const color = isDark.value ? '#0b0b0d' : '#f6f6f8';
  meta.setAttribute('content', color);
}

export function initTheme(): void {
  if (typeof document === 'undefined') return;
  updateHtmlClass();
  updateThemeColor();

  if (typeof matchMedia !== 'undefined' && theme.value === 'system') {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      updateHtmlClass();
      updateThemeColor();
    };
    mq.addEventListener?.('change', handler);
    mediaListener = () => mq.removeEventListener?.('change', handler);
  }
}

export function destroyTheme(): void {
  if (mediaListener) mediaListener();
  mediaListener = null;
}
