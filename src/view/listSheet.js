import { icon } from './icons.js';
import { createSheet } from './bottomSheet.js';

export function createListSheet({ onSelect } = {}) {
  const sheet = createSheet();

  /**
   * @param {object} [options]
   * @param {string} [options.title]
   * @param {string} [options.hint]
   * @param {Array<{ id: string; label: string; meta?: string; active?: boolean }>} [options.items]
   * @param {string} [options.activeId]
   * @param {string} [options.backLabel]
   * @param {() => void} [options.onBack]
   * @param {HTMLElement | null} [options.footer]
   */
  function open({
    title,
    hint = '',
    items = [],
    activeId = '',
    backLabel = '',
    onBack = null,
    footer = null,
  } = {}) {
    sheet.setTitle(title);
    const body = sheet.body;
    body.innerHTML = '';

    if (hint) {
      const p = document.createElement('p');
      p.className = 'sheet-hint';
      p.textContent = hint;
      body.append(p);
    }

    if (onBack) {
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'sheet-back';
      back.innerHTML = icon('back', 16);
      const label = document.createElement('span');
      label.textContent = backLabel;
      back.append(label);
      back.addEventListener('click', onBack);
      body.append(back);
    }

    for (const item of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isActive = item.id === activeId;
      btn.className = 'sheet-item' + (isActive ? ' is-active' : '');
      btn.dataset.id = item.id;

      const label = document.createElement('span');
      label.className = 'sheet-item-label';
      label.textContent = item.label;
      btn.append(label);

      if (item.meta) {
        const meta = document.createElement('span');
        meta.className = 'sheet-item-meta';
        meta.textContent = item.meta;
        btn.append(meta);
      }

      if (isActive) {
        const check = document.createElement('span');
        check.className = 'sheet-item-check';
        check.innerHTML = icon('check', 18);
        btn.append(check);
      }

      btn.addEventListener('click', () => onSelect?.(item.id));
      body.append(btn);
    }

    if (footer) body.append(footer);

    sheet.open();
  }

  return {
    open,
    close: () => sheet.close(),
    get isOpen() {
      return sheet.isOpen;
    },
  };
}
