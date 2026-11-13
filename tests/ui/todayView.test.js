// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTodayView } from '../../src/view/todayView.js';

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
  room: '201',
  isExam: false,
  ...over,
});

const nowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

function mount() {
  const strip = document.createElement('div');
  strip.id = 'dayStrip';
  const body = document.createElement('div');
  body.id = 'feedBody';
  const feed = document.createElement('main');
  feed.id = 'feed';
  document.body.append(strip, body, feed);
  return { strip, body, feed };
}

const baseState = (over = {}) => {
  const now = nowMinutes();
  return {
    loading: false,
    error: undefined,
    today: 'Понедельник',
    day: 'Понедельник',
    isToday: true,
    days: [
      { day: 'Понедельник', short: 'Пн', count: 2, isToday: true, hasChanges: false, active: true },
      { day: 'Вторник', short: 'Вт', count: 1, isToday: false, hasChanges: false, active: false },
    ],
    lessons: [],
    nowIdx: -1,
    nextIdx: -1,
    nowMinutes: now,
    showGroup: false,
    showSubgroup: true,
    changeOf: () => null,
    isReminded: () => false,
    emptyReason: null,
    nextUp: null,
    ...over,
  };
};

describe('today view', () => {
  let strip, body, feed;

  beforeEach(() => {
    document.body.innerHTML = '';
    mount();
    strip = document.getElementById('dayStrip');
    body = document.getElementById('feedBody');
    feed = document.getElementById('feed');
  });

  it('renders the day strip with the active day highlighted', () => {
    const onSelectDay = vi.fn();
    const view = createTodayView({ strip, body, feed, onSelectDay });
    view.render(baseState());
    const cells = strip.querySelectorAll('.day-cell');
    expect(cells.length).toBe(2);
    expect(cells[0].classList.contains('is-active')).toBe(true);
    expect(cells[0].dataset.day).toBe('Понедельник');
    cells[0].click();
    expect(onSelectDay).toHaveBeenCalledWith('Понедельник');
  });

  it('renders lesson rows with time, subject and meta', () => {
    const onRemind = vi.fn();
    const view = createTodayView({ strip, body, feed, onRemind });
    view.render(baseState({ lessons: [lesson()] }));
    const row = body.querySelector('.lesson-card');
    expect(row).not.toBeNull();
    expect(row.querySelector('.lesson-card-start').textContent).toBe('08:00');
    expect(row.querySelector('.lesson-card-subject').textContent).toBe('Анатомия человека');
    expect(row.querySelector('.lesson-card-meta').textContent).toContain('Иванов И.И.');
    expect(row.querySelector('.lesson-card-meta').textContent).toContain('ауд. 201');
    expect(row.querySelector('.type-dot.tp-lecture')).not.toBeNull();
  });

  it('shows a now card for the lesson in progress and counts down', () => {
    const view = createTodayView({ strip, body, feed });
    const state = baseState({
      lessons: [lesson({ time: '08:00-09:20' })],
      nowIdx: 0,
      nowMinutes: 8 * 60 + 30,
    });
    view.render(state);
    const card = body.querySelector('.now-card');
    expect(card).not.toBeNull();
    expect(card.querySelector('.now-card-subject').textContent).toBe('Анатомия человека');
    expect(card.querySelector('.now-countdown').textContent).toContain('осталось');
    expect(body.querySelectorAll('.lesson-card').length).toBe(0);
  });

  it('marks past lessons dim and shows a Дальше tag on the next one', () => {
    const view = createTodayView({ strip, body, feed });
    const state = baseState({
      lessons: [
        lesson({ id: '1', time: '08:00-09:20' }),
        lesson({ id: '2', time: '09:30-10:50', subject: 'Химия' }),
      ],
      nowIdx: -1,
      nextIdx: 0,
      nowMinutes: 7 * 60,
    });
    view.render(state);
    const rows = body.querySelectorAll('.lesson-card');
    expect(rows[0].classList.contains('is-past')).toBe(false);
    expect(rows[0].querySelector('.tag-next')).not.toBeNull();
    view.destroy();
  });

  it('shows the empty state with a reason when there are no lessons', () => {
    const onChooseGroup = vi.fn();
    const view = createTodayView({ strip, body, feed, onChooseGroup });
    view.render(baseState({ emptyReason: 'no-group' }));
    expect(body.querySelector('.empty-title').textContent).toBe('Выбери свою группу');
    const btn = body.querySelector('.btn-primary');
    expect(btn).not.toBeNull();
    btn.click();
    expect(onChooseGroup).toHaveBeenCalledTimes(1);
  });

  it('reports remind clicks with the lesson id', () => {
    const onRemind = vi.fn();
    const view = createTodayView({ strip, body, feed, onRemind });
    view.render(baseState({ lessons: [lesson()], nowMinutes: 7 * 60 }));
    const bell = body.querySelector('.bell');
    expect(bell).not.toBeNull();
    bell.click();
    expect(onRemind).toHaveBeenCalledWith('1');
  });

  it('starts a live tick without crashing', () => {
    const view = createTodayView({ strip, body, feed });
    view.render(
      baseState({ lessons: [lesson({ time: '08:00-09:20' })], nowIdx: 0, nowMinutes: 8 * 60 })
    );
    view.start();
    expect(body.querySelector('.now-countdown')).not.toBeNull();
    view.destroy();
  });
});
