// Type declarations for existing view modules (JS files)
export function createToast(container: HTMLElement | null): {
  show(
    message: string,
    type?: 'ok' | 'bad' | 'info',
    options?: { label: string; onClick: () => void }
  ): void;
};

export function createTodayView(deps: {
  strip: HTMLElement | null;
  body: HTMLElement | null;
  feed: HTMLElement | null;
  onRefresh: () => Promise<void>;
  onRemind: (lessonId: string) => void;
  onChooseGroup: () => void;
  onSelectDay: (day: string) => void;
  onMinute: () => void;
}): {
  render(state: any): void;
  start(): void;
  destroy(): void;
};

export function createSearchView(deps: {
  overlay: HTMLElement | null;
  input: HTMLInputElement | null;
  results: HTMLElement | null;
  closeBtn: HTMLElement | null;
  onJump: (day: string) => void;
  onClose: () => void;
  onQuery: (query: string) => void;
}): { open(): void; close(): void; render(results: any[], query: string): void };

export function createOnboardingSheet(deps: {
  onSelect: (selection: { sheetId: string; group: string }) => void;
  onSkip: () => void;
}): { show(scheduleData: any): void; hide(): void };

export function createSettingsSheet(deps: any): {
  open(): void;
  close(): void;
  render(state: any): void;
  destroy(): void;
};

export function createStatusBanner(host: HTMLElement | null): {
  show(
    kind: 'error' | 'warn',
    message: string,
    options?: { onRetry?: () => void; retryLabel?: string }
  ): void;
  hide(): void;
  isVisible(): boolean;
};

export function createListSheet(deps: { onSelect?: (id: string) => void }): {
  open(options?: {
    title?: string;
    hint?: string;
    items?: any[];
    activeId?: string;
    backLabel?: string;
    onBack?: () => void;
    footer?: HTMLElement | null;
  }): void;
  close(): void;
};

export function createSheet(deps?: { title?: string; onClose?: () => void }): {
  open(): void;
  close(): void;
  setTitle(title: string): void;
  body: HTMLElement;
  isOpen: boolean;
  destroy(): void;
};

export function createAdminView(
  authService: { verifyPin(pin: string): Promise<boolean> },
  adminService: { publishFromExcel(file: File): Promise<{ version: string; count: number }> },
  toast?: { show(msg: string, type?: string): void },
  onPublished?: () => void
): {
  show(): void;
  hide(): void;
  isOpen(): boolean;
};

export function initBrandGesture(
  authService: { isAdmin(): boolean; verifyPin(pin: string): Promise<boolean> },
  adminService: { publishFromExcel(file: File): Promise<{ version: string; count: number }> },
  toast: ReturnType<typeof createToast>
): void;

// Text utilities
export function escapeHtml(s: any): string;
export function debounce<T extends (...args: any[]) => any>(fn: T, ms?: number): T;
export function norm(v: any): string;
export function lower(v: any): string;
export function noSpace(v: any): string;
export function uniqueSorted(arr: any[], locale?: string): any[];
