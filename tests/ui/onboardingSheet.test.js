// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOnboardingSheet } from '../../src/view/onboardingSheet.js';

const schedule = {
  sheetsMeta: [
    {
      id: 'ЛД',
      name: 'Лечебное дело',
      order: 0,
      lessonCount: 5,
      groups: [
        { code: 'ЛД-11', lessonCount: 3 },
        { code: 'ЛД-12', lessonCount: 2 },
      ],
    },
    {
      id: 'СЖ',
      name: 'Сестринское дело',
      order: 1,
      lessonCount: 4,
      groups: [{ code: 'СЖ-21', lessonCount: 4 }],
    },
  ],
};

function mount() {
  const root = document.createElement('div');
  root.id = 'sheetRoot';
  document.body.append(root);
}

describe('onboarding sheet', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    mount();
  });

  it('opens on the sheet step', () => {
    const onSelect = vi.fn();
    const view = createOnboardingSheet({ onSelect, onSkip: vi.fn() });
    view.show(schedule);
    expect(document.querySelector('.sheet-title').textContent).toBe('Выбери свою группу');
    expect(document.querySelectorAll('.sheet-item').length).toBe(2);
    expect(document.querySelector('.sheet-item-label').textContent).toBe('Лечебное дело');
  });

  it('advances to the group step after an отделение is chosen', () => {
    const onSelect = vi.fn();
    const view = createOnboardingSheet({ onSelect, onSkip: vi.fn() });
    view.show(schedule);
    document.querySelectorAll('.sheet-item')[0].click();
    expect(document.querySelectorAll('.sheet-item-label')[0].textContent).toBe('ЛД-11');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('reports the chosen group on the second step', () => {
    const onSelect = vi.fn();
    const view = createOnboardingSheet({ onSelect, onSkip: vi.fn() });
    view.show(schedule);
    document.querySelectorAll('.sheet-item')[0].click();
    document.querySelectorAll('.sheet-item')[0].click();
    expect(onSelect).toHaveBeenCalledWith({ sheetId: 'ЛД', group: 'ЛД-11' });
  });

  it('skips the chooser without choosing anything', () => {
    const onSkip = vi.fn();
    const view = createOnboardingSheet({ onSelect: vi.fn(), onSkip });
    view.show(schedule);
    document.querySelector('.sheet-footer button').click();
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
