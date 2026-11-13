import { escapeHtml } from '../text.ts';
import { formatCountdown, getNowMinutes, lessonState } from '../timing.ts';
import { icon } from './icons.js';
import { haptics } from '../ui/theme/haptics';

const plural = (n, one, few, many) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};
const lessonWord = (n) => plural(n, 'пара', 'пары', 'пар');

const splitTime = (time) => {
  const parts = String(time || '')
    .split(/[-–—]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return { start: parts[0] || '', end: parts[1] || '' };
};

export function createTodayView({
  strip,
  body,
  feed,
  onRefresh,
  onRemind,
  onChooseGroup,
  onSelectDay,
  onMinute,
}) {
  let timer = null;
  let minute = -1;

  const indicator = document.createElement('div');
  indicator.className = 'pull-indicator';
  indicator.innerHTML = '<div class="pull-spinner"></div>';
  let ptrStartY = 0;
  let ptrPulling = false;
  let ptrArmed = false;

  let state = null;

  function updateStats() {
    const now = getNowMinutes();
    const m = Math.floor(now / 60);
    if (m !== minute) {
      minute = m;
      onMinute?.();
    }

    const nowMs = Date.now();
    body.querySelectorAll('[data-countdown]').forEach((el) => {
      const target = el.dataset.countdown;
      const [hh, mm] = String(target || '')
        .split(':')
        .map(Number);
      const end = new Date();
      end.setHours(hh || 0, mm || 0, 0, 0);
      const left = end.getTime() - nowMs;
      if (left <= 0) el.textContent = 'пара закончилась';
      else el.textContent = 'осталось ' + formatCountdown(left);
    });

    body.querySelectorAll('[data-progress]').forEach((el) => {
      const start = Number(el.dataset.startMin || 0);
      const end = Number(el.dataset.endMin || 0);
      if (!end) return;
      let w = (now - start) / (end - start);
      if (w < 0) w = 0;
      if (w > 1) w = 1;
      el.style.width = Math.round(w * 100) + '%';
    });
  }

  function render(next) {
    state = next;

    while (strip.firstChild) strip.removeChild(strip.firstChild);

    const frag = document.createDocumentFragment();
    for (const d of state.days) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.role = 'tab';
      cell.className = 'day-cell' + (d.active ? ' is-active' : '') + (d.isToday ? ' is-today' : '');
      cell.setAttribute('aria-selected', d.active ? 'true' : 'false');
      cell.setAttribute(
        'aria-label',
        d.short + (d.count ? ', ' + d.count + ' ' + lessonWord(d.count) : '')
      );
      cell.dataset.day = d.day;
      const dotToday = d.isToday ? '<span class="day-cell-dot"></span>' : '';
      const dotChanges = d.hasChanges ? '<span class="day-cell-dot is-changes"></span>' : '';
      cell.innerHTML = `
        <div class="day-cell-name">${escapeHtml(d.short)}</div>
        ${d.count ? `<div class="day-cell-count">${d.count}</div>` : ''}
        <div class="day-cell-dots">${dotToday}${dotChanges}</div>
      `;
      frag.appendChild(cell);
    }
    strip.appendChild(frag);
    strip.querySelectorAll('.day-cell').forEach((cell) => {
      cell.addEventListener('click', () => {
        haptics('tap');
        onSelectDay(cell.dataset.day);
      });
    });

    if (state.activeCell && state.activeCell.scrollIntoView)
      state.activeCell.scrollIntoView({ inline: 'center', block: 'nearest' });

    while (body.firstChild) body.removeChild(body.firstChild);

    if ((state.error || state.emptyReason) && !state.lessons.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      const reason = state.error ? 'load-failed' : state.emptyReason;
      let title = '';
      let sub = '';
      let action = null;

      if (reason === 'no-schedule') {
        title = 'Расписание ещё не опубликовано';
        sub = 'Как только преподаватель загрузит новый Excel-файл, занятия появятся здесь сами.';
        action = { label: 'Повторить', handler: state.onRetry };
      } else if (reason === 'no-group') {
        title = 'Выбери свою группу';
        sub = 'Один раз — дальше запомним и сразу покажем твои пары.';
        action = { label: 'Выбрать группу', handler: onChooseGroup };
      } else if (reason === 'no-group-lessons') {
        title = 'У этой группы нет пар';
        sub = 'Проверь выбор группы в настройках или открой другую.';
        action = { label: 'Выбрать группу', handler: onChooseGroup };
      } else if (reason === 'no-lessons-today') {
        title = 'Сегодня пар нет';
        if (state.nextUp) {
          sub = `Ближайшая: <b>${escapeHtml(state.nextUp.day)}</b> · ${escapeHtml(state.nextUp.subject)} в <b>${escapeHtml(state.nextUp.time)}</b>`;
        } else {
          sub = 'Занятий в эту неделю не запланировано.';
        }
      } else {
        title = 'Не удалось загрузить расписание';
        sub = 'Проверь соединение и попробуй ещё раз.';
        action = { label: 'Повторить', handler: state.onRetry };
      }

      const iconName =
        reason === 'no-group' || reason === 'no-group-lessons'
          ? 'users'
          : reason === 'no-lessons-today'
            ? 'sun'
            : reason === 'load-failed'
              ? 'alert'
              : 'book';
      empty.innerHTML = `
        <div class="empty-icon">${icon(iconName, 44)}</div>
        <div class="empty-title">${escapeHtml(title)}</div>
        <div class="empty-sub">${sub}</div>
      `;
      body.appendChild(empty);
      if (action && action.handler) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-primary btn-block';
        btn.textContent = action.label;
        btn.addEventListener('click', action.handler);
        empty.appendChild(btn);
      }
      return;
    }

    if (state.loading && !state.lessons.length) {
      const skeleton = document.createElement('div');
      skeleton.className = 'skeleton';
      for (let i = 0; i < 5; i++)
        skeleton.appendChild(document.createElement('div')).className = 'sk-row';
      body.appendChild(skeleton);
      return;
    }

    const dayHeader = document.createElement('div');
    dayHeader.className = 'day-header';
    dayHeader.innerHTML = `
      <div class="day-title">${state.isToday ? 'Сегодня' : escapeHtml(state.day)}</div>
      <div class="day-count">${state.lessons.length} ${lessonWord(state.lessons.length)}</div>
    `;
    body.appendChild(dayHeader);

    if (state.nowIdx >= 0) {
      const nowLesson = state.lessons[state.nowIdx];
      const times = splitTime(nowLesson.time);
      const nowCard = document.createElement('div');
      nowCard.className = 'now-card';
      const endMin = times.end ? startMin(times.end) : null;
      const nextLesson = state.lessons[state.nowIdx + 1] || null;
      nowCard.innerHTML = `
        <div class="now-card-time">
          <span class="now-card-start">${escapeHtml(times.start)}</span>
          <span class="now-card-end">– ${escapeHtml(times.end)}</span>
          <span class="now-card-state">Идёт сейчас</span>
        </div>
        <div class="now-card-subject">${escapeHtml(nowLesson.subject)}</div>
        <div class="now-card-meta">${metaOf(nowLesson)}</div>
        ${nextLesson ? `<div class="now-card-next">Дальше: <b>${escapeHtml(nextLesson.subject)}</b> в <b>${escapeHtml(splitTime(nextLesson.time).start)}</b></div>` : ''}
        <div class="now-card-foot">
          ${endMin !== null ? `<div class="now-progress"><div class="now-progress-fill" data-progress data-start-min="${startMin(times.start)}" data-end-min="${endMin}"></div></div>` : ''}
          <span class="now-countdown" data-countdown="${times.end}">осталось …</span>
        </div>
      `;
      body.appendChild(nowCard);
    }

    const list = document.createElement('div');
    list.className = 'lesson-list';
    const rows = state.lessons.filter((_, i) => state.nowIdx < 0 || i !== state.nowIdx);
    for (const lesson of rows) {
      list.appendChild(rowOf(lesson));
    }
    body.appendChild(list);
  }

  function rowOf(lesson) {
    const el = document.createElement('div');
    const times = splitTime(lesson.time);
    const currentTime = state.isToday ? minutesToTime(state.nowMinutes) : undefined;
    const st = lessonState(lesson, currentTime);
    const isPast = st === 'past';
    const isNow = st === 'now';
    const isNext = st === 'next';
    const change = state.changeOf(lesson);
    el.className =
      'lesson-card' +
      (isPast ? ' is-past' : '') +
      (isNow ? ' is-now' : '') +
      (isNext ? ' is-next' : '') +
      (change === 'added' ? ' is-added' : '');
    el.dataset.id = lesson.id;
    el.dataset.state = st;

    const tags = [];
    if (lesson.isExam) tags.push('<span class="tag tag-exam">Экзамен</span>');
    if (change === 'added') tags.push('<span class="tag tag-new">новое</span>');
    if (isNext && state.nowIdx < 0) tags.push('<span class="tag tag-next">Дальше</span>');

    const metaParts = [];
    if (state.showGroup && lesson.group) metaParts.push('группа ' + escapeHtml(lesson.group));
    if (lesson.teacher) metaParts.push(escapeHtml(lesson.teacher));
    if (lesson.room) metaParts.push('ауд. ' + escapeHtml(lesson.room));
    if (state.showSubgroup && lesson.subgroup)
      metaParts.push('подгр. ' + escapeHtml(lesson.subgroup));

    const reminded = state.isReminded(lesson);
    let showBell = false;
    if (
      st === 'next' ||
      (st === 'idle' && times.start && startMin(times.start) > state.nowMinutes)
    ) {
      showBell = true;
    } else if (!state.isToday && !!times.start) {
      showBell = true;
    }

    el.innerHTML = `
      <div class="lesson-card-time">
        <span class="lesson-card-start">${escapeHtml(times.start)}</span>
        ${times.end ? `<span class="lesson-card-end">${escapeHtml(times.end)}</span>` : ''}
      </div>
      <div class="lesson-card-body">
        <div class="lesson-card-subject-row">
          <span class="type-dot tp-${lesson.type || 'other'}"></span>
          <span class="lesson-card-subject">${escapeHtml(lesson.subject)}</span>
          ${tags.join('')}
        </div>
        <div class="lesson-card-meta">${metaParts.join(' · ')}</div>
      </div>
      ${showBell ? `<div class="lesson-card-bell"><button type="button" class="bell ${reminded ? 'is-set' : ''}" data-remind="${escapeHtml(lesson.id)}" aria-label="Напомнить">${icon(reminded ? 'bellOn' : 'bell', 22)}</button></div>` : ''}
    `;
    return el;
  }

  function startMin(t) {
    if (!t) return 0;
    const [hh, mm] = String(t).split(':').map(Number);
    return (hh || 0) * 60 + (mm || 0);
  }

  function minutesToTime(m) {
    const h = Math.floor(m / 60);
    const mm = Math.floor(m % 60);
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  function metaOf(lesson) {
    const parts = [];
    if (lesson.teacher) parts.push(escapeHtml(lesson.teacher));
    if (lesson.room) parts.push('ауд. ' + escapeHtml(lesson.room));
    if (state.showGroup && lesson.group) parts.push('группа ' + escapeHtml(lesson.group));
    if (state.showSubgroup && lesson.subgroup) parts.push('подгр. ' + escapeHtml(lesson.subgroup));
    return parts.join(' · ');
  }

  function onClick(event) {
    const bell = event.target.closest('[data-remind]');
    if (bell) {
      haptics('tap');
      onRemind(bell.dataset.remind);
      return;
    }
    const act = event.target.closest('[data-action]');
    if (act) {
      const action = act.dataset.action;
      if (action === 'choose-group') onChooseGroup();
      else if (action === 'retry' && state.onRetry) state.onRetry();
    }
  }

  body.addEventListener('click', onClick);

  function ptrStart(event) {
    const scroller = document.scrollingElement || document.documentElement;
    if (scroller.scrollTop > 0) return;
    const touch = event.touches ? event.touches[0] : event;
    ptrStartY = touch.clientY;
    ptrPulling = true;
    ptrArmed = false;
  }

  function ptrMove(event) {
    if (!ptrPulling) return;
    const touch = event.touches ? event.touches[0] : event;
    const dy = touch.clientY - ptrStartY;
    if (dy <= 0) return ptrReset();
    const scroller = document.scrollingElement || document.documentElement;
    if (scroller.scrollTop > 0) return ptrReset();
    event.preventDefault();
    const h = Math.min(dy / 2.5, 72);
    if (!indicator.parentNode) body.prepend(indicator);
    indicator.style.height = h + 'px';
    indicator.classList.add('is-visible');
    ptrArmed = dy > 72;
  }

  function ptrEnd() {
    if (!ptrPulling) return;
    ptrPulling = false;
    if (ptrArmed && onRefresh) {
      indicator.classList.add('is-loading');
      Promise.resolve(onRefresh()).then(ptrReset, ptrReset);
    } else {
      ptrReset();
    }
  }

  function ptrReset() {
    ptrPulling = false;
    ptrArmed = false;
    indicator.style.height = '';
    indicator.classList.remove('is-visible', 'is-loading');
  }

  function tick() {
    updateStats();
  }

  function start() {
    if (timer) return;
    feed.addEventListener('touchstart', ptrStart, { passive: false });
    feed.addEventListener('touchmove', ptrMove, { passive: false });
    feed.addEventListener('touchend', ptrEnd);
    feed.addEventListener('touchcancel', ptrReset);
    timer = window.setInterval(tick, 1000);
    tick();
  }

  function destroy() {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
    feed.removeEventListener('touchstart', ptrStart);
    feed.removeEventListener('touchmove', ptrMove);
    feed.removeEventListener('touchend', ptrEnd);
    feed.removeEventListener('touchcancel', ptrReset);
    ptrReset();
    body.removeEventListener('click', onClick);
    state = null;
  }

  return { render, start, destroy };
}
