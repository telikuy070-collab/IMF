// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStatusBanner } from '../../src/view/statusBanner.js';

describe('status banner', () => {
  let host;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    host.id = 'statusBanner';
    document.body.append(host);
  });

  it('is hidden until an error or warning is shown', () => {
    const banner = createStatusBanner(host);
    expect(banner.isVisible()).toBe(false);
    expect(document.getElementById('statusBannerInner')).toBeNull();
  });

  it('shows a retryable error while keeping whatever is on screen untouched', () => {
    const onRetry = vi.fn();
    const banner = createStatusBanner(host);
    banner.show('error', 'Проблема с сетью', { onRetry });

    const element = document.getElementById('statusBannerInner');
    expect(banner.isVisible()).toBe(true);
    expect(element.hidden).toBe(false);
    expect(element.className).toMatch(/status-banner-error/);
    expect(element.textContent).toContain('Проблема с сетью');

    element.querySelector('button').click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('retries only once per shown banner', () => {
    const onRetry = vi.fn();
    const banner = createStatusBanner(host);
    banner.show('warn', 'Не удалось обновить офлайн-копию', { onRetry });
    const button = document.querySelector('.status-banner-retry');
    button.click();
    button.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows a warning with the retry button hidden when none is supplied', () => {
    const banner = createStatusBanner(host);
    banner.show('warn', 'Офлайн-копия устарела');
    const element = document.getElementById('statusBannerInner');
    expect(element.className).toMatch(/status-banner-warn/);
    expect(element.querySelector('.status-banner-retry').hidden).toBe(true);
  });

  it('hides the banner on success', () => {
    const banner = createStatusBanner(host);
    banner.show('error', 'Ошибка', { onRetry: () => {} });
    banner.hide();
    expect(banner.isVisible()).toBe(false);
    expect(document.getElementById('statusBannerInner').hidden).toBe(true);
  });

  it('escapes message content instead of injecting markup', () => {
    const banner = createStatusBanner(host);
    banner.show('error', '<img src=x onerror=alert(1)>');
    const element = document.getElementById('statusBannerInner');
    expect(element.querySelector('img')).toBeNull();
    expect(element.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
