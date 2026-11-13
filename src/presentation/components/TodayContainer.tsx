/* TodayContainer — соединяет сигналы appStore с TodayPage.
   Читает состояние из сторов, вызывает экшены при действиях пользователя. */

import { h } from 'preact';
import { effect } from '@preact/signals';
import { render } from 'preact';
import {
  schedule,
  filteredLessons,
  ui,
  currentFilters,
  preferences,
  scopedChanges,
  weekPlan,
  todayName,
  actions,
} from '@presentation/stores/appStore';
import { createReminderStore } from '@presentation/reminders';
import type { Lesson } from '@core/domain/entities/types';
import { lessonKey, snapshotKey } from '@core/domain/scheduleDiff';
import { TodayPage } from '@ui/pages/TodayPage/TodayPage';
import { DAY_ORDER } from '../../constants.ts';

export function TodayContainer({
  rootEl,
}: {
  rootEl: HTMLElement;
}): { destroy(): void } {
  const reminders = createReminderStore();

  const buildFeedState = () => {
    const data = schedule.value;
    const today = todayName.value;
    const selectedDay = currentFilters.value.day || today;
    const isToday = selectedDay === today;
    const prefs = preferences.value;
    const showGroup = Boolean(prefs.currentGroup);
    const showSubgroup = !prefs.activeSubgroup;

    const week = weekPlan.value;
    const daysWithLessons = new Set(week.map((p) => p.day));
    const stripDays = [...new Set([today, ...daysWithLessons])].sort(
      (a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)
    );

    const changes = scopedChanges.value;
    const addedKeys = new Set((changes?.added || []).map((s) => snapshotKey(s)));

    const changeOf = (lesson: Lesson): 'added' | null =>
      addedKeys.has(lessonKey(lesson)) ? 'added' : null;

    const dayLessons = filteredLessons.value
      .filter((l) => l.day === selectedDay)
      .sort((a, b) => startMin(a.time) - startMin(b.time) || a.time.localeCompare(b.time));

    let nowIdx = -1;
    if (isToday) {
      const now = Math.floor(Date.now() / 60000) % 1440;
      nowIdx = dayLessons.findIndex((l) => {
        const [hh, mm] = l.time.split(':').map(Number);
        return (hh || 0) * 60 + (mm || 0) >= now;
      });
    }

    let emptyReasonLocal: 'no-schedule' | 'no-group' | 'no-group-lessons' | 'no-lessons-today' | 'load-failed' | null = null;
    if (!data || !data.sheetsMeta.length) emptyReasonLocal = 'no-schedule';
    else if (!prefs.currentGroup) emptyReasonLocal = 'no-group';
    else if (!filteredLessons.value.length) emptyReasonLocal = 'no-group-lessons';
    else if (!dayLessons.length) emptyReasonLocal = 'no-lessons-today';

    let nextUp = null;
    if (emptyReasonLocal === 'no-lessons-today' && week.length) {
      const todayIdx = DAY_ORDER.indexOf(today);
      for (let i = todayIdx; i < DAY_ORDER.length; i++) {
        const plan = week.find((p) => p.day === DAY_ORDER[i]);
        if (plan && plan.items.length) {
          const first = plan.items[0];
          nextUp = {
            day: first.day,
            short: first.day.slice(0, 2),
            time: first.time,
            subject: first.subject,
          };
          break;
        }
      }
    }

    return {
      days: stripDays.map((d) => {
        const plan = week.find((p) => p.day === d);
        return {
          day: d,
          short: d.slice(0, 2),
          count: plan ? plan.items.length : 0,
          isToday: d === today,
          hasChanges: changes ? [...(changes.added || []), ...(changes.removed || [])].some((c) => c.day === d) : false,
          active: d === selectedDay,
        };
      }),
      lessons: dayLessons,
      loading: ui.value.loading && !schedule.value,
      error: ui.value.error || null,
      emptyReason: emptyReasonLocal,
      nowIdx,
      nextIdx: nowIdx >= 0 ? nowIdx + 1 : -1,
      nowMinutes: Math.floor(Date.now() / 60000) % 1440,
      isToday,
      day: selectedDay,
      showGroup,
      showSubgroup,
      changeOf,
      isReminded: (lesson: Lesson) => reminders.keys().has(lessonKey(lesson)),
      nextUp,
      onRetry: () => {
        // handled by parent via reloadAuthoritative
      },
      onSelectDay: (day: string) => actions.showDayOf(day),
      onRemind: (lessonId: string) => {
        const lesson = dayLessons.find((l) => l.id === lessonId);
        if (lesson) {
          reminders.add(lesson);
        }
      },
      onChooseGroup: () => {
        // handled by parent via openBrowse callback
      },
    };
  };

  const renderPage = () => {
    const state = buildFeedState();
    render(
      <TodayPage
        days={state.days}
        lessons={state.lessons}
        loading={state.loading}
        error={state.error}
        emptyReason={state.emptyReason}
        nowIdx={state.nowIdx}
        nextIdx={state.nextIdx}
        nowMinutes={state.nowMinutes}
        isToday={state.isToday}
        day={state.day}
        showGroup={state.showGroup}
        showSubgroup={state.showSubgroup}
        changeOf={state.changeOf}
        isReminded={state.isReminded}
        nextUp={state.nextUp}
        onRetry={state.onRetry}
        onSelectDay={state.onSelectDay}
        onRemind={state.onRemind}
        onChooseGroup={state.onChooseGroup}
      />,
      rootEl
    );
  };

  const subscriptions = [
    schedule,
    filteredLessons,
    ui,
    currentFilters,
    preferences,
    scopedChanges,
    weekPlan,
    todayName,
  ];

  subscriptions.forEach((sub) => {
    effect(() => {
      void sub.value;
      renderPage();
    });
  });

  renderPage();

  return {
    destroy() {
      render(null, rootEl);
    },
  };
}

function startMin(t: string): number {
  if (!t) return 0;
  const [hh, mm] = String(t).split(':').map(Number);
  return (hh || 0) * 60 + (mm || 0);
}

export default TodayContainer;