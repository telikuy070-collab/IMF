export const norm = (v: unknown): string => (v == null ? '' : String(v).trim());
export const lower = (v: unknown): string => norm(v).toLowerCase();
export const noSpace = (v: unknown): string => lower(v).replace(/\s+/g, '');

export const uniqueSorted = (arr: unknown[], locale = 'ru'): string[] =>
  Array.from(new Set(arr.filter(Boolean))).sort((a, b) =>
    String(a).localeCompare(String(b), locale)
  ) as string[];

export const escapeHtml = (s: unknown): string =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (ch) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[ch as keyof { '&': string; '<': string; '>': string; '"': string; "'": string }]
  );

export const debounce = <T extends (...args: unknown[]) => unknown>(fn: T, ms = 150): T => {
  let t: ReturnType<typeof setTimeout> | undefined;
  return ((...args: unknown[]) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  }) as T;
};
