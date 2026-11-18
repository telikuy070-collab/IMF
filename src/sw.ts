/* Service Worker жизненный цикл: регистрация, проверка обновлений, слушатели сообщений. */

import { logger } from '@shared/logger';

export function registerServiceWorker(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
        // Never let the HTTP cache hide a freshly deployed worker.
        updateViaCache: 'none',
      })
      .then((reg) => {
        if (!reg) return;
        if (import.meta.env.DEV) {
          logger.debug('[SW] Registered', { scope: reg.scope });
        }
        // A long-lived installed app would otherwise keep an old build until
        // the browser decides to look for a new worker.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState !== 'visible') return;
          void reg.update().catch(() => {});
        });
      })
      .catch((err) => {
        logger.error('[SW] Registration failed', { context: 'service_worker' }, err as Error);
      });
  }
}

export function requestServiceWorkerCheck(): void {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
  navigator.serviceWorker.controller.postMessage({ type: 'check-schedule' });
}

export function listenForServiceWorkerUpdates(onUpdate: (version: string) => void): void {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as { type?: string; version?: string } | null;
    if (!data || data.type !== 'schedule-updated') return;
    logger.debug('[SW] schedule-updated received', { version: data.version ?? '' });
    onUpdate(data.version ?? '');
  });
}
