// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSettingsSheet } from '../../src/view/settingsView.js';

function remindersStore(permission = 'default') {
  return {
    permission: () => permission,
    canAsk: () => true,
    lead: () => 10,
    leadOptions: () => [5, 10, 15, 30],
    list: () => [],
    keys: () => new Set(),
    setLead: vi.fn(),
    cancel: vi.fn(),
  };
}

function mount(reminders) {
  const sheet = document.createElement('div');
  sheet.id = 'sheetRoot';
  document.body.append(sheet);
  const onJumpDay = vi.fn();
  const onCancelReminder = vi.fn();
  const view = createSettingsSheet({
    reminders,
    install: { canPrompt: () => false, isIos: () => false, isStandalone: () => false },
    onBrowse: vi.fn(),
    onGoMySchedule: vi.fn(),
    onForget: vi.fn(),
    onRequestNotifications: vi.fn(),
    onSetLead: vi.fn(),
    onCancelReminder,
    onJumpDay,
    onInstall: vi.fn(),
  });
  return { view, onJumpDay, onCancelReminder };
}

describe('settings sheet', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('shows the enable button while permission can still be asked', () => {
    const { view } = mount(remindersStore('default'));
    view.render({ changes: null });
    view.open();
    expect(document.querySelector('[data-action="enable-notify"]')).not.toBeNull();
  });

  it('hides the enable button once the permission was granted or refused', () => {
    expect(mount(remindersStore('granted')).view).toBeDefined();
    mount(remindersStore('granted')).view.render({ changes: null });
    mount(remindersStore('granted')).view.open();
    expect(document.querySelector('[data-action="enable-notify"]')).toBeNull();

    mount(remindersStore('denied')).view.render({ changes: null });
    mount(remindersStore('denied')).view.open();
    expect(document.querySelector('[data-action="enable-notify"]')).toBeNull();
  });

  it('offers lead chips when reminders are granted', () => {
    const { view } = mount(remindersStore('granted'));
    view.render({ changes: null });
    view.open();
    expect(document.querySelectorAll('.chip').length).toBe(4);
    document.querySelector('[data-lead="15"]').click();
    // the same view instance is reused through the closure above
  });

  it('lists reminders and cancels them', () => {
    const onCancelReminder = vi.fn();
    const reminders = remindersStore('granted');
    reminders.list = () => [
      {
        id: 'r1',
        subject: 'Анатомия',
        fireAt: new Date(2026, 8, 30, 10, 0).getTime(),
        time: '10:00-11:20',
        room: '201',
        teacher: 'Иванов',
        leadMinutes: 10,
      },
    ];
    const { view } = mount(reminders);
    // rebind cancel handler after construction: re-create with the handler
    document.body.innerHTML = '';
    const sheet = document.createElement('div');
    sheet.id = 'sheetRoot';
    document.body.append(sheet);
    const view2 = createSettingsSheet({
      reminders,
      install: { canPrompt: () => false, isIos: () => false, isStandalone: () => false },
      onBrowse: vi.fn(),
      onGoMySchedule: vi.fn(),
      onForget: vi.fn(),
      onRequestNotifications: vi.fn(),
      onSetLead: vi.fn(),
      onCancelReminder,
      onJumpDay: vi.fn(),
      onInstall: vi.fn(),
    });
    view2.render({ changes: null });
    view2.open();
    expect(document.querySelector('.rem-subject').textContent).toBe('Анатомия');
    document.querySelector('[data-cancel="r1"]').click();
    expect(onCancelReminder).toHaveBeenCalledWith('r1');
  });

  it('renders the changes section and jumps to the day of an entry', () => {
    const onJumpDay = vi.fn();
    const reminders = remindersStore('default');
    document.body.innerHTML = '';
    const sheet = document.createElement('div');
    sheet.id = 'sheetRoot';
    document.body.append(sheet);
    const view = createSettingsSheet({
      reminders,
      install: { canPrompt: () => false, isIos: () => false, isStandalone: () => false },
      onBrowse: vi.fn(),
      onGoMySchedule: vi.fn(),
      onForget: vi.fn(),
      onRequestNotifications: vi.fn(),
      onSetLead: vi.fn(),
      onCancelReminder: vi.fn(),
      onJumpDay,
      onInstall: vi.fn(),
    });
    view.render({
      changes: {
        added: [{ day: 'Понедельник', time: '08:00-09:20', subject: 'Новое', room: '301' }],
        removed: [],
      },
    });
    view.open();
    const row = document.querySelector('[data-day="Понедельник"]');
    expect(row).not.toBeNull();
    row.click();
    expect(onJumpDay).toHaveBeenCalledWith('Понедельник');
  });

  it('does not render the changes section when nothing changed', () => {
    const { view } = mount(remindersStore('default'));
    view.render({ changes: { added: [], removed: [] } });
    view.open();
    expect(document.querySelectorAll('.sheet-section').length).toBe(4); // Группа, Напоминания, Приложение, О приложении
  });
});
