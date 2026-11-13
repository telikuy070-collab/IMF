/* InstallBanner — неинтрузивный баннер установки PWA.
   Показывается один раз, когда beforeinstallprompt доступен и приложение не установлено.
   Для iOS показывает хинт «Поделиться → На экран Домой». */

import { h, type HTMLAttributes } from 'preact';
import { useState, useEffect } from 'preact/hooks';

export type InstallBannerKind = 'android' | 'ios' | 'update';

export interface InstallBannerProps extends HTMLAttributes<HTMLDivElement> {
  kind: InstallBannerKind;
  canPrompt: boolean;
  onInstall: () => Promise<void>;
  onDismiss: () => void;
  onUpdate?: () => void;
  updateVersion?: string;
}

export function InstallBanner({
  kind,
  canPrompt,
  onInstall,
  onDismiss,
  onUpdate,
  updateVersion,
  className,
  ...rest
}: InstallBannerProps): import('preact').JSX.Element | null {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (kind === 'update' && !onUpdate) setVisible(false);
  }, [kind, onUpdate]);

  const dismiss = () => {
    setVisible(false);
    onDismiss();
  };

  const isIos = kind === 'ios';

  return (
    visible ? (
      <div
        class={`install-banner install-banner-${kind} ${className ?? ''}`}
        role="status"
        aria-live="polite"
        {...rest}
      >
        <div class="install-banner-body">
          {kind === 'update' ? (
            <>
              <span class="install-banner-message">
                Доступна новая версия расписания ({updateVersion ?? ''})
              </span>
              <button
                type="button"
                class="install-banner-btn install-banner-btn-update"
                onClick={() => { onUpdate?.(); dismiss(); }}
              >
                Обновить
              </button>
            </>
          ) : isIos ? (
            <>
              <span class="install-banner-message">
                Установите приложение: «Поделиться» → «На экран Домой»
              </span>
              <button
                type="button"
                class="install-banner-btn install-banner-btn-install"
                onClick={dismiss}
              >
                Понятно
              </button>
            </>
          ) : (
            <>
              <span class="install-banner-message">
                Установить IMF как приложение?
              </span>
              {canPrompt ? (
                <button
                  type="button"
                  class="install-banner-btn install-banner-btn-install"
                  onClick={() => { onInstall().then(dismiss); }}
                >
                  Установить
                </button>
              ) : null}
              <button type="button" class="install-banner-btn install-banner-btn-dismiss" onClick={dismiss}>
                Не сейчас
              </button>
            </>
          )}
        </div>
        <button
          type="button"
          class="install-banner-close"
          onClick={dismiss}
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>
    ) : null
  );
}

export default InstallBanner;