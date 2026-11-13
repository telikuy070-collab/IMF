/* Toast — неинтрузивное уведомление снизу экрана. Варианты: ok, bad, warn, info. Автоскрытие через timeout. */

import { h, type HTMLAttributes } from 'preact';
import { useState, useEffect } from 'preact/hooks';

export type ToastType = 'ok' | 'bad' | 'warn' | 'info';

export interface ToastProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
  message: string;
  type?: ToastType;
  timeout?: number;
  onClose?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

const typeStyles: Record<ToastType, string> = {
  ok: 'background: var(--color-success-soft); color: var(--color-success);',
  bad: 'background: var(--color-error-soft); color: var(--color-error);',
  warn: 'background: var(--color-warning-soft); color: var(--color-warning);',
  info: 'background: var(--color-line); color: var(--color-ink);',
};

export function Toast({
  message,
  type = 'ok',
  timeout = 4000,
  onClose,
  actionLabel,
  onAction,
  ...rest
}: ToastProps): import('preact').JSX.Element {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    if (timeout > 0) {
      const t = setTimeout(() => setVisible(false), timeout);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [timeout]);

  return (
    <div
      class={`toast ${visible ? 'show' : ''}`}
      role="status"
      aria-live="polite"
      style={typeStyles[type]}
      {...rest}
    >
      <span class="toast-message">{message}</span>
      {actionLabel && onAction ? (
        <button class="toast-btn" onClick={() => { onAction(); setVisible(false); }}>
          {actionLabel}
        </button>
      ) : null}
      <button class="toast-close" onClick={() => { onClose?.(); setVisible(false); }} aria-label="Закрыть">
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

export default Toast;