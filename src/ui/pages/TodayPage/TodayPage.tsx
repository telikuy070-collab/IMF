/* TodayPage — présentational компонент сегодняшнего дня.
   Получает всё состояние через props, все действия — через колбэки.
   Никаких сигналов, только чистый UI. */

import { h, type HTMLAttributes } from 'preact';

import type { Lesson, LessonType } from '@core/domain/entities/types';

export interface LessonCardProps {
  id: string;
  time: string;
  subject: string;
  teacher?: string;
  room?: string;
  group?: string;
  subgroup?: string;
  type?: LessonType | 'other';
  isPast: boolean;
  isNow: boolean;
  isNext: boolean;
  isAdded: boolean;
  isReminded: boolean;
  showGroup: boolean;
  showSubgroup: boolean;
  onRemind: (id: string) => void;
}

export function LessonCard({
  id,
  time,
  subject,
  teacher,
  room,
  group,
  subgroup,
  type = 'other' as LessonType | 'other',
  isPast,
  isNow,
  isNext,
  isAdded,
  isReminded,
  showGroup,
  showSubgroup,
  onRemind,
}: LessonCardProps): import('preact').JSX.Element {
  const [start, end] = time.split(/[-–—]/).map((s) => s.trim()).filter(Boolean);
  const typeDotClass = `type-dot tp-${type}`;
  const tags: string[] = [];
  if (isAdded) tags.push('tag tag-new');
  if (isNext) tags.push('tag tag-next');

  const metaParts: string[] = [];
  if (showGroup && group) metaParts.push(`группа ${group}`);
  if (teacher) metaParts.push(teacher);
  if (room) metaParts.push(`ауд. ${room}`);
  if (showSubgroup && subgroup) metaParts.push(`подгр. ${subgroup}`);

  const showBell = isNext || (!isNow && start && start > '');
  const remindedCls = isReminded ? 'bell is-set' : 'bell';
  const iconPath = isReminded
    ? 'M17 22v-2a5 5 0 00-2.24-4.56l-.46-.47a2 2 0 00-.62-.88l-.2-.23a2 2 0 000-.72V3a2 2 0 012-2h2.18a2 2 0 011.61.79l.63.62a2 2 0 01.37.96l.05.32a2 2 0 01-.18.68l-.02.16a2 2 0 01-.54.93l-.31.32a5 5 0 00-3.44 1.18l-.5.49a2 2 0 00-.29.58l-.01.14a2 2 0 000 .32l.01.14a2 2 0 00.29.58l.31.31a5 5 0 001.18 3.44l.49.5a2 2 0 00.58.29l.14.01a2 2 0 00.32 0l.14-.01a2 2 0 00.58-.29l.5-.5a5 5 0 001.18-3.44l.05-.32a2 2 0 00-.18-.68l-.02-.16a2 2 0 00-.54-.93l-.31-.32a5 5 0 00-3.44-1.18l-.5-.49a2 2 0 00-.29-.58l-.01-.14a2 2 0 00-.32-.19l-.14-.01a2 2 0 00-.32-.19V18a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2h3.18a2 2 0 011.61.79l.63.62a2 2 0 01.37.96l.05.32a2 2 0 01-.18.68l-.02.16a2 2 0 01-.54.93l-.31.32a5 5 0 00-3.44 1.18l-.5.49a2 2 0 00-.29.58l-.01.14a2 2 0 000 .32l.01.14a2 2 0 00.29.58l.31.31a5 5 0 001.18 3.44l.49.5a2 2 0 00.58.29l.14.01a2 2 0 00.32 0'
    : 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2';

  return (
    <article
      class={`lesson-card ${isPast ? 'is-past' : ''} ${isNow ? 'is-now' : ''} ${isNext ? 'is-next' : ''} ${isAdded ? 'is-added' : ''}`}
      data-id={id}
      data-state={isNow ? 'now' : isNext ? 'next' : isPast ? 'past' : 'idle'}
    >
      <div class="lesson-card-time">
        <span class="lesson-card-start">{start}</span>
        {end ? <span class="lesson-card-end">{end}</span> : null}
      </div>
      <div class="lesson-card-body">
        <div class="lesson-card-subject-row">
          <span class={typeDotClass} aria-hidden="true"></span>
          <span class="lesson-card-subject">{subject}</span>
          {tags.map((tagCls, i) => (
            <span key={i} class={tagCls}>{tagCls === 'tag tag-new' ? 'новое' : 'Дальше'}</span>
          ))}
        </div>
        <div class="lesson-card-meta">{metaParts.join(' · ')}</div>
      </div>
      {showBell ? (
        <div className="lesson-card-bell">
          <button
            type="button"
            class={remindedCls}
            data-remind={id}
            aria-label="Напомнить"
            onClick={() => onRemind(id)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d={iconPath} />
            </svg>
          </button>
        </div>
      ) : null}
    </article>
  );
}

export interface DayCellProps {
  day: string;
  short: string;
  count: number;
  isToday: boolean;
  active: boolean;
  hasChanges: boolean;
  onSelect: (day: string) => void;
}

export function DayCell({
  day,
  short,
  count,
  isToday,
  active,
  hasChanges,
  onSelect,
}: DayCellProps): import('preact').JSX.Element {
  const lessonWord = (n: number) => {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return 'пара';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'пары';
    return 'пар';
  };

  return (
    <button
      type="button"
      role="tab"
      class={`day-cell ${active ? 'is-active' : ''} ${isToday ? 'is-today' : ''}`}
      aria-selected={active}
      aria-label={`${short}${count ? `, ${count} ${lessonWord(count)}` : ''}`}
      data-day={day}
      onClick={() => onSelect(day)}
    >
      <div class="day-cell-name">{short}</div>
      {count ? <div class="day-cell-count">{count}</div> : null}
      <div class="day-cell-dots">
        {isToday ? <span class="day-cell-dot"></span> : null}
        {hasChanges ? <span class="day-cell-dot is-changes"></span> : null}
      </div>
    </button>
  );
}

export interface EmptyStateProps {
  reason: 'no-schedule' | 'no-group' | 'no-group-lessons' | 'no-lessons-today' | 'load-failed';
  nextUp: { day: string; short: string; time: string; subject: string } | null;
  onRetry: () => void;
  onChooseGroup: () => void;
}

export function EmptyState({
  reason,
  nextUp,
  onRetry,
  onChooseGroup,
}: EmptyStateProps): import('preact').JSX.Element {
  let title = '';
  let sub = '';
  let actionLabel: string | null = null;
  let actionHandler: (() => void) | null = null;
  let iconName = 'book';

  if (reason === 'no-schedule') {
    title = 'Расписание ещё не опубликовано';
    sub = 'Как только преподаватель загрузит новый Excel-файл, занятия появятся здесь сами.';
    actionLabel = 'Повторить';
    actionHandler = onRetry;
    iconName = 'book';
  } else if (reason === 'no-group') {
    title = 'Выбери свою группу';
    sub = 'Один раз — дальше запомним и сразу покажем твои пары.';
    actionLabel = 'Выбрать группу';
    actionHandler = onChooseGroup;
    iconName = 'users';
  } else if (reason === 'no-group-lessons') {
    title = 'У этой группы нет пар';
    sub = 'Проверь выбор группы в настройках или открой другую.';
    actionLabel = 'Выбрать группу';
    actionHandler = onChooseGroup;
    iconName = 'users';
  } else if (reason === 'no-lessons-today') {
    title = 'Сегодня пар нет';
    if (nextUp) {
      sub = `Ближайшая: <b>${nextUp.day}</b> · ${nextUp.subject} в <b>${nextUp.time}</b>`;
    } else {
      sub = 'Занятий в эту неделю не запланировано.';
    }
    iconName = 'sun';
  } else {
    title = 'Не удалось загрузить расписание';
    sub = 'Проверь соединение и попробуй ещё раз.';
    actionLabel = 'Повторить';
    actionHandler = onRetry;
    iconName = 'alert';
  }

  return (
    <div class="empty">
      <div class="empty-icon" aria-hidden="true">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {iconName === 'book' ? <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" /> : null}
          {iconName === 'users' ? (
            <>
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </>
          ) : null}
          {iconName === 'sun' ? (
            <>
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </>
          ) : null}
          {iconName === 'alert' ? (
            <path d="M10 29h4l-2-3" />
          ) : null}
        </svg>
      </div>
      <div class="empty-title" dangerouslySetInnerHTML={{ __html: title }} />
      <div class="empty-sub" dangerouslySetInnerHTML={{ __html: sub }} />
      {actionLabel && actionHandler ? (
        <button type="button" class="btn btn-primary btn-block" onClick={actionHandler}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export interface TodayPageProps extends HTMLAttributes<HTMLDivElement> {
  days: Array<{ day: string; short: string; count: number; isToday: boolean; active: boolean; hasChanges: boolean }>;
  lessons: Array<Lesson>;
  loading: boolean;
  error: string | null;
  emptyReason: 'no-schedule' | 'no-group' | 'no-group-lessons' | 'no-lessons-today' | 'load-failed' | null;
  nowIdx: number;
  nextIdx: number;
  nowMinutes: number;
  isToday: boolean;
  day: string;
  showGroup: boolean;
  showSubgroup: boolean;
  changeOf: (lesson: Lesson) => 'added' | null;
  isReminded: (lesson: Lesson) => boolean;
  nextUp: { day: string; short: string; time: string; subject: string } | null;
  onRetry: () => void;
  onSelectDay: (day: string) => void;
  onRemind: (lessonId: string) => void;
  onChooseGroup: () => void;
}

export function TodayPage({
  days,
  lessons,
  loading,
  error,
  emptyReason,
  nowIdx,
  nextIdx,
  nowMinutes,
  isToday,
  day,
  showGroup,
  showSubgroup,
  changeOf,
  isReminded,
  nextUp,
  onRetry,
  onSelectDay,
  onRemind,
  onChooseGroup,
  ...rest
}: TodayPageProps): import('preact').JSX.Element {
  const dayLessons = lessons.filter((l) => l.time && true);
  const nowLesson = nowIdx >= 0 ? dayLessons[nowIdx] : null;
  const nextLesson = nowIdx >= 0 ? dayLessons[nowIdx + 1] : null;

  if ((error || emptyReason) && dayLessons.length === 0) {
    return (
      <EmptyState
        reason={error ? 'load-failed' : emptyReason!}
        nextUp={nextUp}
        onRetry={onRetry}
        onChooseGroup={onChooseGroup}
      />
    );
  }

  if (loading && dayLessons.length === 0) {
    return (
      <div class="skeleton">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} class="sk-row" style={{ height: '52px' }} />
        ))}
      </div>
    );
  }

  return (
    <div {...rest} class="today-page">
      <div class="day-header">
        <div class="day-title">{isToday ? 'Сегодня' : day}</div>
        <div class="day-count">{dayLessons.length} пара{dayLessons.length === 1 ? '' : dayLessons.length >= 2 && dayLessons.length <= 4 ? 'ы' : 'ов'}</div>
      </div>

      {nowLesson ? (
        <div class="now-card">
          <div class="now-card-time">
            <span class="now-card-start">{nowLesson.time.split(/[-–—]/)[0].trim()}</span>
            <span class="now-card-end">– {nowLesson.time.split(/[-–—]/)[1]?.trim()}</span>
            <span class="now-card-state">Идёт сейчас</span>
          </div>
          <div class="now-card-subject">{nowLesson.subject}</div>
          <div class="now-card-meta">
            {[nowLesson.teacher, nowLesson.room, showGroup && nowLesson.group, showSubgroup && nowLesson.subgroup]
              .filter(Boolean)
              .join(' · ')}
          </div>
          {nextLesson ? (
            <div class="now-card-next">
              Дальше: <b>{nextLesson.subject}</b> в <b>{nextLesson.time.split(/[-–—]/)[0].trim()}</b>
            </div>
          ) : null}
        </div>
      ) : null}

      <div class="lesson-list">
        {dayLessons
          .filter((_, i) => nowIdx < 0 || i !== nowIdx)
          .map((lesson) => (
            <LessonCard
              key={lesson.id}
              id={lesson.id}
              time={lesson.time}
              subject={lesson.subject}
              teacher={lesson.teacher}
              room={lesson.room}
              group={lesson.group}
              subgroup={lesson.subgroup}
              type={lesson.type}
              isPast={nowIdx >= 0 && dayLessons.indexOf(lesson) < nowIdx}
              isNow={nowIdx >= 0 && dayLessons.indexOf(lesson) === nowIdx}
              isNext={nowIdx >= 0 && dayLessons.indexOf(lesson) === nowIdx + 1}
              isAdded={changeOf(lesson) === 'added'}
              isReminded={isReminded(lesson)}
              showGroup={showGroup}
              showSubgroup={showSubgroup}
              onRemind={onRemind}
            />
          ))}
      </div>
    </div>
  );
}

export default TodayPage;