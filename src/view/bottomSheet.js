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

  const onKey = (event) => {
    if (event.key === 'Escape') close();
  };
  const onBackdrop = () => close();

  backdrop.addEventListener('click', onBackdrop);
  closeBtn.addEventListener('click', close);

  function openSheet() {
    if (open) return;
    open = true;
    host.append(backdrop, sheet);
    document.addEventListener('keydown', onKey);
    document.body.classList.add('sheet-open');
    requestAnimationFrame(() => {
      backdrop.classList.add('is-open');
      sheet.classList.add('is-open');
    });
    closeBtn.focus();
  }

  function closeSheet() {
    if (!open) return;
    open = false;
    backdrop.classList.remove('is-open');
    sheet.classList.remove('is-open');
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('sheet-open');
    window.setTimeout(() => {
      backdrop.remove();
      sheet.remove();
    }, 300);
    onClose?.();
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
    },
  };
}
