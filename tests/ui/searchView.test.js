// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSearchView } from '../../src/view/searchView.js';

const lesson = (over = {}) => ({
  id: '1',
  sheetId: 'ЛД',
  day: 'Понедельник',
  time: '08:00-09:20',
  group: 'ЛД-11',
  subgroup: '',
  subject: 'Анатомия человека',
  type: 'lecture',
  teacher: 'Иванов И.И.',
  room: '225',
  isExam: false,
  ...over,
});

function mount() {
  const overlay = document.createElement('div');
  overlay.id = 'searchOverlay';
  const input = document.createElement('input');
  input.id = 'searchInput';
  const results = document.createElement('div');
  results.id = 'searchResults';
  const closeBtn = document.createElement('button');
  closeBtn.id = 'searchClose';
  overlay.append(input, results, closeBtn);
  document.body.append(overlay);
  return { overlay, input, results, closeBtn };
}

describe('search view', () => {
  let overlay, input, results, closeBtn;

  beforeEach(() => {
    document.body.innerHTML = '';
    ({ overlay, input, results, closeBtn } = mount());
  });

  it('shows a hint until there is a query', () => {
    const view = createSearchView({ overlay, input, results, closeBtn });
    view.open();
    expect(overlay.hidden).toBe(false);
    expect(results.querySelector('.search-hint').textContent).toContain('Начни вводить');
    view.close();
    expect(overlay.hidden).toBe(true);
  });

  it('renders results and jumps to the day of the tapped row', () => {
    const onJump = vi.fn();
    const onClose = vi.fn();
    const view = createSearchView({ overlay, input, results, closeBtn, onJump, onClose });
    view.open();
    input.value = '225';
    view.render([lesson()], input.value);
    expect(results.querySelectorAll('.search-row').length).toBe(1);
    expect(results.querySelector('.search-subject').textContent).toBe('Анатомия человека');
    results.querySelector('.search-row').click();
    expect(onJump).toHaveBeenCalledWith('Понедельник');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows a not-found hint for an empty result set', () => {
    const view = createSearchView({ overlay, input, results, closeBtn });
    view.render([], ' xx ');
    expect(results.querySelector('.search-hint').textContent).toContain('Ничего не найдено');
  });

  it('closes on Escape and on the close button', () => {
    const onClose = vi.fn();
    const view = createSearchView({ overlay, input, results, closeBtn, onClose });
    view.open();
    closeBtn.click();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(overlay.hidden).toBe(true);
    onClose.mockClear();

    view.open();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
