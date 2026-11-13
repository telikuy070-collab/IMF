/**
 * Minimal install affordance for the student UI.
 *
 * Native `beforeinstallprompt` is deferred once; everything else (iOS hint,
 * standalone state) is pure detection — no DOM, no persistent panels.
 */
export interface InstallPrompt {
  canPrompt(): boolean;
  isIos(): boolean;
  isStandalone(): boolean;
  prompt(): Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export function createInstallPrompt(): InstallPrompt {
  let deferred: Event | null = null;

  const isStandalone = () => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (window.navigator as any).standalone === true
    );
  };

  const isIos = () => {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  };

  if (typeof window !== 'undefined' && !isStandalone() && !isIos()) {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      deferred = event;
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall, { once: true });
    window.addEventListener('appinstalled', () => {
      deferred = null;
    });
  }

  return {
    canPrompt: () => deferred !== null,
    isIos,
    isStandalone,

    async prompt() {
      if (!deferred) return 'unavailable';
      try {
        (deferred as any).prompt();
        const { outcome } = await (deferred as any).userChoice;
        deferred = null;
        return outcome === 'accepted' ? 'accepted' : 'dismissed';
      } catch {
        return 'unavailable';
      }
    },
  };
}
