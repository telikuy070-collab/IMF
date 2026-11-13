export function createStatusBanner(host) {
  let element = null;
  let onRetry = null;
  let visible = false;
  let retryFired = false;

  const ensure = () => {
    if (element && element.isConnected) return element;
    element = document.createElement('div');
    element.id = 'statusBannerInner';
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', 'polite');
    element.className = 'status-banner';
    element.hidden = true;
    const icon = document.createElement('span');
    icon.className = 'status-banner-icon';
    const text = document.createElement('span');
    text.className = 'status-banner-text';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'status-banner-retry';
    retry.textContent = 'Повторить';
    retry.addEventListener('click', () => {
      if (retryFired) return;
      retryFired = true;
      element.hidden = true;
      visible = false;
      onRetry?.();
    });
    element.append(icon, text, retry);
    host?.appendChild(element);
    return element;
  };

  const show = (kind, message, options = {}) => {
    const el = ensure();
    onRetry = options.onRetry || null;
    retryFired = false;
    el.className = 'status-banner status-banner-' + kind;
    el.querySelector('.status-banner-icon').textContent = kind === 'error' ? '!' : '⚠';
    el.querySelector('.status-banner-text').textContent = message;
    const btn = el.querySelector('.status-banner-retry');
    btn.hidden = !options.onRetry;
    btn.textContent = options.retryLabel || 'Повторить';
    el.hidden = false;
    visible = true;
  };

  const hide = () => {
    const el = ensure();
    el.hidden = true;
    visible = false;
    onRetry = null;
  };

  const isVisible = () => visible;

  return { show, hide, isVisible };
}
