export function createSheet({ title = '', onClose = null } = {}) {
  const host = document.getElementById('sheetRoot');

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');

  const handle = document.createElement('div');
  handle.className = 'sheet-handle';

  const header = document.createElement('div');
  header.className = 'sheet-header';
  const heading = document.createElement('h2');
  heading.className = 'sheet-title';
  heading.textContent = title;
  heading.id = `sheet-title-${Math.random().toString(36).slice(2, 8)}`;
  heading.tabIndex = -1;
  sheet.setAttribute('aria-labelledby', heading.id);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'icon-btn';
  closeBtn.setAttribute('aria-label', 'Закрыть');
  closeBtn.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  const body = document.createElement('div');
  body.className = 'sheet-body';

  header.append(heading, closeBtn);
  sheet.append(handle, header, body);

  let open = false;
  let removeTimer = null;

  function closeSheet() {
    if (!open) return;
    open = false;
    backdrop.classList.remove('is-open');
    sheet.classList.remove('is-open');
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('sheet-open');
    window.clearTimeout(removeTimer);
    removeTimer = window.setTimeout(() => {
      backdrop.remove();
      sheet.remove();
    }, 300);
    onClose?.();
  }

  function onKey(event) {
    if (event.key === 'Escape') closeSheet();
  }

  function onBackdrop() {
    closeSheet();
  }

  // A bare `close` resolves to `window.close`, which is why the header cross
  // used to do nothing ("Illegal invocation"). Bind the sheet's own closer.
  backdrop.addEventListener('click', onBackdrop);
  closeBtn.addEventListener('click', closeSheet);

  function openSheet() {
    if (open) return;
    open = true;
    window.clearTimeout(removeTimer);
    host.append(backdrop, sheet);
    document.addEventListener('keydown', onKey);
    document.body.classList.add('sheet-open');
    requestAnimationFrame(() => {
      backdrop.classList.add('is-open');
      sheet.classList.add('is-open');
    });
    closeBtn.focus();
  }

  function setTitle(next) {
    heading.textContent = next;
  }

  return {
    open: openSheet,
    close: closeSheet,
    setTitle,
    body,
    get isOpen() {
      return open;
    },
    destroy() {
      closeSheet();
      backdrop.removeEventListener('click', onBackdrop);
      closeBtn.removeEventListener('click', closeSheet);
    },
  };
}
