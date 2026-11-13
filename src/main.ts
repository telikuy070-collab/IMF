/**
 * Application Composition Root - Wires all layers together
 * Single entry point, sets up DI, starts the app
 */
import { h } from 'preact';
import { render } from 'preact';
import { ScheduleService } from '@core/application/services';
import { AuthService } from '@core/application/services';
import { AdminService } from '@core/application/services';
import {
  actions,
  groupLessons,
  searchResults,
  weekPlan,
  schedule,
  preferences,
  ui,
  currentFilters,
  netStatus,
  offlineNotice,
  startScreen,
  browsingOtherGroup,
  scopedChanges,
  todayName,
} from '@presentation/stores/appStore';
import { createToast } from './view/toast.js';
import { createTodayView } from './view/todayView.js';
import { createSearchView } from './view/searchView.js';
import { createOnboardingSheet } from './view/onboardingSheet.js';
import { createSettingsSheet } from './view/settingsView.js';
import { createStatusBanner } from './view/statusBanner.js';
import { createListSheet } from './view/listSheet.js';
import { createReminderStore } from '@presentation/reminders';
import { InstallBanner } from '@ui/molecules/InstallBanner/InstallBanner';
import { lessonKey, snapshotKey } from '@core/domain/scheduleDiff';
import { migrateMySelectionPrefs } from '@core/domain/onboarding';
import { createAdminView } from './view/adminView.js';
import { createSnapshotStore, createIndexedDbSnapshotBackend } from './admin/snapshots.ts';
import { initBrandGesture } from '@presentation/gestures/brandGesture';
import { createInstallPrompt } from '@presentation/pwa/install';
import {
  clearSharedLaunchFlag,
  isSharedLaunch,
  takeSharedWorkbook,
} from '@presentation/pwa/sharedFile';
import { escapeHtml } from './text.ts';
import { DAY_ORDER, DAY_SHORT } from './constants.ts';
import { getCurrentTime, getNowMinutes, highlightIndex } from './timing.ts';
import type { PreferencesService as PrefsServiceType } from '@core/application/services';
import { reportError } from './view/errorBoundary.js';
import { toAppError } from '@core/domain/errors';
import { logger } from '@shared/logger';
import { getBuildDiagnostics } from '@shared/diagnostics';
import { initTheme, applyTheme, isDark } from './ui/theme/themeStore';
import type { ScheduleData } from '@core/domain/entities/types';
import type { Lesson } from '@core/domain/entities/types';
import { createContainer } from './container.ts';
import { formatStamp, offlineNoticeText, readableErrorMessage, lessonWord } from './format.ts';
import {
  registerServiceWorker,
  requestServiceWorkerCheck,
  listenForServiceWorkerUpdates,
} from './sw.ts';
// Force Supabase bundle inclusion
import '@supabase/supabase-js';

// Toast instance - declared at module level so it's accessible before bootstrap completes
let toast: ReturnType<typeof createToast>;

// Install prompt must be wired at module scope: beforeinstallprompt is only
// observable if a listener is present before the browser decides to fire it,
// which can happen before the first render finishes.
const install = createInstallPrompt();

/** Where the currently rendered schedule came from. */
type ScheduleSource = 'cache' | 'fresh' | 'realtime';

/** Initialize all services and start the app */
export async function bootstrap(): Promise<void> {
  // Version bookkeeping: exactly one "Расписание обновлено" toast per applied
  // version, no matter whether the version arrived through realtime, a manual
  // refresh or a Service Worker message.
  let lastAnnouncedVersion = '';
  let cacheWarningShown = false;

  // DI container
  const container = createContainer();
  const {
    storage,
    deviceId,
    presence,
    visits,
    scheduleService,
    prefsService,
    authService,
    adminService,
  } = container;

  // Initialize UI FIRST (so toast exists before any async callbacks).
  // The render effect it installs runs synchronously, so every piece of state
  // it can reach must already be initialized above.
  const banner = initializeUI(scheduleService, prefsService, authService, adminService);

  // Load initial data
  actions.setLoading(true);

  /** Applies a schedule and announces a new version at most once. */
  const applySchedule = (data: ScheduleData, source: ScheduleSource): void => {
    actions.setSchedule(data);

    const version = data.version || '';
    if (source !== 'cache' && version && version !== lastAnnouncedVersion) {
      lastAnnouncedVersion = version;
      toast?.show('Расписание обновлено', 'ok');
    }
  };

  /** "Мои пары сегодня" по умолчанию: день переключается на сегодняшний. */
  function applyInitialDay(): void {
    if (currentFilters.value.day) return;
    if (!preferences.value.currentGroup) return;
    actions.setFilter('day', todayName.value);
  }

  /**
   * Compares the applied version with the one stored in the offline cache and
   * keeps the result for the "Что изменилось" section of settings.
   */
  const rememberVersion = (data: ScheduleData): void => {
    void scheduleService
      .recordChanges(data)
      .then((next) => {
        if (next) actions.setChanges(next);
      })
      .catch((err) => {
        logger.warn('[App] Change detection failed', { error: toAppError(err).code });
      });
  };

  /** Retryable warning: the offline copy is stale, the applied data is fine. */
  const warnCacheWrite = (): void => {
    if (cacheWarningShown) return;
    cacheWarningShown = true;
    banner.show('warn', 'Не удалось обновить офлайн-копию расписания.', {
      onRetry: () => {
        cacheWarningShown = false;
        void reloadAuthoritative('cache-retry');
      },
      retryLabel: 'Повторить',
    });
  };

  /**
   * Authoritative load: apply immediately, then refresh the offline cache.
   * A failed load keeps whatever is already on screen and shows a retry.
   */
  async function reloadAuthoritative(reason: string): Promise<void> {
    actions.setLoading(true);
    try {
      const { data, cacheUpdated } = await scheduleService.refresh(reason);
      applySchedule(data, reason === 'realtime' ? 'realtime' : 'fresh');
      setNetStatus({ loadFailed: false });
      if (cacheUpdated) {
        cacheWarningShown = false;
        banner.hide();
      } else {
        warnCacheWrite();
      }
    } catch (err) {
      const appError = toAppError(err);
      logger.error('[App] Schedule load failed', { reason }, appError);
      setNetStatus({ loadFailed: true });
      // Показываем тревожный баннер только если расписание уже было — иначе
      // чистое пустое состояние с кнопкой «Повторить» в ленте достаточно.
      if (schedule.value) {
        banner.show('error', readableErrorMessage(appError), {
          onRetry: () => void reloadAuthoritative(reason),
          retryLabel: 'Повторить',
        });
      }
      if (!schedule.value) {
        actions.setError('Не удалось загрузить расписание');
        reportError(appError, 'Не удалось загрузить расписание');
      }
    } finally {
      actions.setLoading(false);
    }
  }

  function setNetStatus(patch: { browserOnline?: boolean; loadFailed?: boolean }): void {
    const current = netStatus.value;
    actions.setNetStatus({
      browserOnline: patch.browserOnline ?? current.browserOnline,
      loadFailed: patch.loadFailed ?? current.loadFailed,
    });
  }

  function startMinutes(t: string | null): number {
    if (!t) return 0;
    const [hh, mm] = String(t).split(':').map(Number);
    return (hh || 0) * 60 + (mm || 0);
  }

  try {
    syncInitialNetworkState();

    // Load preferences first
    let prefs = await prefsService.load();
    const migration = migrateMySelectionPrefs(prefs);
    if (migration) {
      prefs = { ...prefs, ...migration };
      try {
        await prefsService.save(migration);
        logger.info('[prefs] promoted current selection to "my schedule"', { ...migration });
      } catch (err) {
        logger.warn('[prefs] "my schedule" migration was not saved', { error: err as Error });
      }
    }
    actions.setPreference('currentSheetId', prefs.currentSheetId);
    actions.setPreference('currentGroup', prefs.currentGroup);
    actions.setPreference('activeSubgroup', prefs.activeSubgroup);
    actions.setPreference('mySheetId', prefs.mySheetId || '');
    actions.setPreference('myGroup', prefs.myGroup || '');
    actions.setPreference('mySubgroup', prefs.mySubgroup || '');
    if (prefs.onboardingSkipped) actions.skipOnboarding();

    // PWA shortcut / start_url: open straight on today's weekday.
    applyLaunchFilters();

    // Non-blocking first render: the cached snapshot paints immediately while
    // the authoritative load runs. The heavy XLS parser is not part of this path.
    const cached = await scheduleService.loadCached();
    if (cached) {
      applySchedule(cached, 'cache');
      lastAnnouncedVersion = cached.version || '';
      rememberVersion(cached);
    }

    await reloadAuthoritative('bootstrap');
    if (schedule.value) rememberVersion(schedule.value);
    applyInitialDay();

    // Subscribe to realtime updates.
    try {
      const unsubscribe = scheduleService.subscribe((data) => {
        applySchedule(data, 'realtime');
        setNetStatus({ loadFailed: false });
        rememberVersion(data);
        applyInitialDay();
        void storage.set('schedule_cache', data).then((cacheUpdated) => {
          if (cacheUpdated) {
            cacheWarningShown = false;
            banner.hide();
          } else {
            warnCacheWrite();
          }
        });
      });
      (window as { __unsubscribeSchedule?: () => void }).__unsubscribeSchedule = unsubscribe;
    } catch (err) {
      logger.warn('[App] Realtime unavailable, falling back to periodic checks', {
        error: toAppError(err).code,
      });
    }

    startUpdateChecker(scheduleService);
    listenForNetworkChanges(() => void reloadAuthoritative('online'));
    listenForServiceWorkerUpdates(() => reloadAuthoritative('service-worker'));
    logger.debug('[App] Build', { ...getBuildDiagnostics() });
  } catch (err) {
    logger.error('[App] Bootstrap failed', { context: 'bootstrap' }, err as Error);
    actions.setError('Не удалось загрузить расписание');
    reportError(err, 'Не удалось загрузить расписание');
  } finally {
    actions.setLoading(false);
    if (visits) visits.recordVisit(deviceId);
  }

  function initializeUI(
    scheduleService: ScheduleService,
    prefsService: PrefsServiceType,
    authService: AuthService,
    adminService: AdminService
  ): ReturnType<typeof createStatusBanner> {
    const toastEl = document.getElementById('toast');
    toast = createToast(toastEl);
    (window as { toast?: { show(message: string, type?: string): void } }).toast = toast;

    // Initialize theme (light/dark/system) — applies class to <html> and theme-color meta
    initTheme();

    const reminders = createReminderStore();
    reminders.start();

    const todayView = createTodayView({
      strip: document.getElementById('dayStrip'),
      body: document.getElementById('feedBody'),
      feed: document.getElementById('feed'),
      onRefresh: () => handlePullRefresh(scheduleService),
      onRemind: scheduleReminderFor,
      onChooseGroup: () => {
        if (schedule.value) onboarding.show(schedule.value);
        else {
          toast?.show('Загружаю расписание…', 'ok');
          void reloadAuthoritative('bootstrap');
        }
      },
      onSelectDay: jumpToDay,
      onMinute: renderAll,
    });

    const searchView = createSearchView({
      overlay: document.getElementById('searchOverlay'),
      input: document.getElementById('searchInput'),
      results: document.getElementById('searchResults'),
      closeBtn: document.getElementById('searchClose'),
      onJump: (day: string) => {
        jumpToDay(day);
        closeSearch();
      },
      onClose: closeSearch,
      onQuery: (q: string) => actions.setFilter('search', q),
    });

    const onboarding = createOnboardingSheet({
      onSelect: async (selection: { sheetId: string; group: string }) => {
        await prefsService.save({
          currentSheetId: selection.sheetId,
          currentGroup: selection.group,
          activeSubgroup: '',
          mySheetId: selection.sheetId,
          myGroup: selection.group,
          mySubgroup: '',
        });
        actions.setPreference('currentSheetId', selection.sheetId);
        actions.setPreference('currentGroup', selection.group);
        actions.setPreference('activeSubgroup', '');
        actions.setPreference('mySheetId', selection.sheetId);
        actions.setPreference('myGroup', selection.group);
        actions.setPreference('mySubgroup', '');
        onboarding.hide();
        applyInitialDay();
        renderAll();
      },
      onSkip: () => {
        actions.skipOnboarding();
        void prefsService.save({ onboardingSkipped: true });
        onboarding.hide();
        renderAll();
      },
    });

    const settingsSheet = createSettingsSheet({
      reminders,
      install,
      onBrowse: openBrowse,
      onGoMySchedule: () => {
        const patch = actions.goToMySchedule();
        if (!patch.currentGroup) return;
        void prefsService.save(patch);
        jumpToDay(currentFilters.value.day || todayName.value);
        settingsSheet.close();
        toast?.show('Вернулись к своей группе', 'ok');
      },
      onForget: async () => {
        actions.forgetSelection();
        await prefsService.save({
          currentSheetId: '',
          currentGroup: '',
          activeSubgroup: '',
          mySheetId: '',
          myGroup: '',
          mySubgroup: '',
          onboardingSkipped: false,
        });
        settingsSheet.close();
        toast?.show('Забыл выбор группы — выберешь заново', 'ok');
      },
      onRequestNotifications: () => {
        void reminders.request().then((state) => {
          if (state === 'granted') toast?.show('Напоминания включены', 'ok');
          else if (state === 'denied') toast?.show('Уведомления запрещены в браузере', 'bad');
          else toast?.show('Браузер не разрешил уведомления', 'bad');
          renderAll();
        });
      },
      onSetLead: (m: number) => reminders.setLead(m),
      onCancelReminder: (id: string) => {
        reminders.cancel(id);
        renderAll();
      },
      onJumpDay: (day: string) => {
        jumpToDay(day);
        settingsSheet.close();
      },
      onInstall: async () => {
        const outcome = await install.prompt();
        if (outcome === 'accepted') toast?.show('Установили', 'ok');
      },
    });

    // Browse flow: отделение → группа → подгруппа
    const listSheet = createListSheet({
      onSelect: browseSelect,
    });
    let browseStep: 'sheet' | 'group' | 'subgroup' = 'sheet';

    function renderBrowse(): void {
      const data = schedule.value;
      if (!data) {
        listSheet.open({
          title: 'Отделение',
          hint: 'Загрузка…',
          items: [],
          backLabel: 'Назад',
          onBack: () => listSheet.close(),
        });
        return;
      }
      if (browseStep === 'sheet') {
        const sheets = data.sheetsMeta;
        listSheet.open({
          title: 'Отделение',
          hint: 'Выбери отделение',
          items: sheets.map((s) => {
            const count = data.sheets.get(s.id)?.length || 0;
            return {
              id: s.id,
              label: escapeHtml(s.name),
              meta: count ? count + ' ' + lessonWord(count) : '',
              active: s.id === preferences.value.currentSheetId,
            };
          }),
          footer: makeBrowseFooter(),
        });
        return;
      }

      const sheetId = preferences.value.currentSheetId;
      const lessons = data.sheets.get(sheetId) || [];

      if (browseStep === 'group') {
        const groups = Array.from(
          new Map(
            lessons.map((l) => [l.group, { code: l.group, count: 0, subgroups: new Set<string>() }])
          ).values()
        );
        groups.forEach((g) => {
          g.count = lessons.filter((l) => l.group === g.code).length;
          lessons
            .filter((l) => l.group === g.code)
            .forEach((l) => l.subgroup && g.subgroups.add(l.subgroup));
        });
        groups.sort((a, b) => String(a.code).localeCompare(String(b.code), 'ru'));
        listSheet.open({
          title: 'Группа',
          hint: 'Выбери группу',
          backLabel: 'Другое отделение',
          onBack: () => {
            browseStep = 'sheet';
            renderBrowse();
          },
          items: groups.map((g) => ({
            id: g.code,
            label: escapeHtml(g.code),
            meta: g.count ? g.count + ' ' + lessonWord(g.count) : '',
            active: g.code === preferences.value.currentGroup,
          })),
          footer: makeBrowseFooter(),
        });
        return;
      }

      // subgroup
      const groupCode = preferences.value.currentGroup;
      const groupLessonsList = lessons.filter((l) => l.group === groupCode);
      const subgroups = Array.from(
        new Set(groupLessonsList.map((l) => l.subgroup).filter(Boolean))
      ).sort((a, b) => {
        const na = Number(a),
          nb = Number(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return String(a).localeCompare(String(b), 'ru');
      });
      listSheet.open({
        title: 'Подгруппа',
        hint: 'Выбери подгруппу',
        backLabel: 'Другая группа',
        onBack: () => {
          browseStep = 'group';
          renderBrowse();
        },
        items: [
          { id: '', label: 'Все подгруппы', meta: '', active: !preferences.value.activeSubgroup },
          ...subgroups.map((sg) => ({
            id: sg,
            label: escapeHtml(sg),
            meta:
              groupLessonsList.filter((l) => l.subgroup === sg).length +
              ' ' +
              lessonWord(groupLessonsList.filter((l) => l.subgroup === sg).length),
            active: sg === preferences.value.activeSubgroup,
          })),
        ],
        footer: makeBrowseFooter(),
      });
    }

    function makeBrowseFooter() {
      if (browseStep !== 'group' || !browsingOtherGroup.value) return null;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-primary btn-block';
      btn.textContent = 'Сделать моей группой';
      btn.addEventListener('click', () => {
        void prefsService.save(actions.rememberCurrentAsMySchedule());
        listSheet.close();
        toast?.show('Запомнил: это твоя группа', 'ok');
      });
      return btn;
    }

    function browseSelect(id: string): void {
      const data = schedule.value;
      if (!data) return;
      if (browseStep === 'sheet') {
        actions.setPreference('currentSheetId', id);
        actions.setPreference('currentGroup', '');
        actions.setPreference('activeSubgroup', '');
        void prefsService.save({ currentSheetId: id, currentGroup: '', activeSubgroup: '' });
        browseStep = 'group';
        renderBrowse();
        return;
      }
      if (browseStep === 'group') {
        const firstChoice = !preferences.value.myGroup && !preferences.value.mySheetId;
        actions.setPreference('currentGroup', id);
        actions.setPreference('activeSubgroup', '');
        const patch: Record<string, string> = { currentGroup: id, activeSubgroup: '' };
        if (firstChoice) Object.assign(patch, actions.rememberCurrentAsMySchedule());
        void prefsService.save(patch);
        const lessons = data.sheets.get(preferences.value.currentSheetId!) || [];
        const hasSubgroups = lessons.some((l) => l.group === id && l.subgroup);
        if (hasSubgroups) {
          browseStep = 'subgroup';
          renderBrowse();
        } else {
          listSheet.close();
          if (firstChoice) toast?.show('Запомнил: это твоя группа', 'ok');
        }
        return;
      }
      actions.setPreference('activeSubgroup', id);
      void prefsService.save({ activeSubgroup: id });
      listSheet.close();
    }

    function openBrowse(): void {
      browseStep = 'sheet';
      renderBrowse();
    }

    const adminView = createAdminView(
      authService,
      adminService,
      toast,
      () => reloadAuthoritative('publish'),
      {
        getCurrentSchedule: () => schedule.value,
        snapshots: createSnapshotStore(createIndexedDbSnapshotBackend()),
        presence: presence || {
          start() {},
          stop() {},
          subscribe() {
            return () => {};
          },
          getSnapshot() {
            return { status: 'idle', online: null };
          },
          isRunning() {
            return false;
          },
        },
        visits: visits || {
          load: async () => ({
            available: false,
            devices7d: null,
            devices30d: null,
            devicesTotal: null,
            reason: 'local',
          }),
          recordVisit() {},
        },
      }
    );

    const statusBanner = createStatusBanner(document.getElementById('statusBanner'));

    // ---------- PWA install banner ----------

    const bannerContainer = document.createElement('div');
    bannerContainer.id = 'install-banner-root';
    document.getElementById('app')?.appendChild(bannerContainer);

    let installDismissed = false;
    let updatePending = false;
    let updateVersion = '';

    function renderInstallBanner(): void {
      if (installDismissed && !updatePending) {
        render(null, bannerContainer);
        return;
      }

      const isStandalone = install.isStandalone();
      const isIos = install.isIos();
      const canPrompt = install.canPrompt();

      if (isStandalone) {
        render(null, bannerContainer);
        return;
      }

      if (updatePending) {
        render(
          h(InstallBanner, {
            kind: 'update',
            canPrompt: false,
            onInstall: async () => {},
            onDismiss: () => {
              updatePending = false;
              renderInstallBanner();
            },
            onUpdate: () => {
              updatePending = false;
              renderInstallBanner();
            },
            updateVersion,
          }),
          bannerContainer
        );
        return;
      }

      if (isIos) {
        render(
          h(InstallBanner, {
            kind: 'ios',
            canPrompt: false,
            onInstall: async () => {},
            onDismiss: () => {
              installDismissed = true;
              renderInstallBanner();
            },
          }),
          bannerContainer
        );
        return;
      }

      if (canPrompt && !installDismissed) {
        render(
          h(InstallBanner, {
            kind: 'android',
            canPrompt,
            onInstall: async () => {
              const outcome = await install.prompt();
              if (outcome === 'accepted') {
                toast?.show('Установили', 'ok');
              }
              installDismissed = true;
              renderInstallBanner();
            },
            onDismiss: () => {
              installDismissed = true;
              renderInstallBanner();
            },
          }),
          bannerContainer
        );
        return;
      }

      render(null, bannerContainer);
    }

    // SW update messages
    navigator.serviceWorker?.addEventListener('message', (event: MessageEvent) => {
      const data = event.data as { type?: string; version?: string } | null;
      if (data?.type === 'schedule-updated') {
        updatePending = true;
        updateVersion = data.version ?? '';
        renderInstallBanner();
      }
    });

    renderInstallBanner();

    // ---------- render loop ----------

    function buildFeedState() {
      const data = schedule.value;
      const today = todayName.value;
      const selectedDay = currentFilters.value.day || today;
      const isToday = selectedDay === today;
      const prefs = preferences.value;
      const showGroup = browsingOtherGroup.value;
      const showSubgroup = !prefs.activeSubgroup;

      const week = weekPlan.value;
      const daysWithLessons = new Set(week.map((p) => p.day));
      const stripDays = [...new Set([today, ...daysWithLessons])].sort(
        (a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)
      );

      const changes = scopedChanges.value;
      const addedKeys = new Set((changes?.added || []).map((item) => snapshotKey(item)));

      const changeOf = (lesson: Lesson): 'added' | null =>
        addedKeys.has(lessonKey(lesson)) ? 'added' : null;

      const dayLessons = groupLessons.value
        .filter((l) => l.day === selectedDay)
        .sort(
          (a, b) => startMinutes(a.time) - startMinutes(b.time) || a.time.localeCompare(b.time)
        );

      let nowIdx = -1;
      let nextIdx = -1;
      if (isToday) {
        const hl = highlightIndex(dayLessons, getCurrentTime());
        nowIdx = hl.now;
        nextIdx = hl.next;
      }

      let emptyReasonLocal = null;
      if (!data || !data.sheetsMeta.length) emptyReasonLocal = 'no-schedule';
      else if (!prefs.currentGroup) emptyReasonLocal = 'no-group';
      else if (!groupLessons.value.length) emptyReasonLocal = 'no-group-lessons';
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
              short: DAY_SHORT[first.day as keyof typeof DAY_SHORT],
              time: first.time,
              subject: first.subject,
            };
            break;
          }
        }
      }

      return {
        loading: ui.value.loading && !schedule.value,
        error: ui.value.error || undefined,
        today,
        day: selectedDay,
        isToday,
        days: stripDays.map((d) => {
          const plan = week.find((p) => p.day === d);
          return {
            day: d,
            short: DAY_SHORT[d as keyof typeof DAY_SHORT],
            count: plan ? plan.items.length : 0,
            isToday: d === today,
            hasChanges: changes
              ? [...(changes.added || []), ...(changes.removed || [])].some((c) => c.day === d)
              : false,
            active: d === selectedDay,
          };
        }),
        lessons: dayLessons,
        nowIdx,
        nextIdx,
        nowMinutes: getNowMinutes(),
        showGroup,
        showSubgroup,
        changeOf,
        isReminded: (lesson: Lesson) => reminders.keys().has(lessonKey(lesson)),
        emptyReason: emptyReasonLocal,
        nextUp,
        onRetry: () => void reloadAuthoritative('pull-refresh'),
      };
    }

    function buildSettingsState() {
      const data = schedule.value;
      const prefs = preferences.value;
      const myLabel = prefs.myGroup || '';
      const currentLabel = prefs.currentGroup || '';
      return {
        browsing: browsingOtherGroup.value,
        myLabel,
        currentLabel,
        permission: reminders.permission(),
        lead: reminders.lead(),
        leadOptions: reminders.leadOptions(),
        remindersList: reminders.list(),
        changes: scopedChanges.value,
        version: data ? data.version : '',
        updatedAt: data && data.updatedAt ? formatStamp(data.updatedAt) : '',
        canPrompt: install.canPrompt(),
        isIos: install.isIos(),
        standalone: install.isStandalone(),
      };
    }

    function updateChrome() {
      const chip = document.getElementById('groupChip');
      const chipLabel = document.getElementById('groupChipLabel');
      const netDot = document.getElementById('netDot');
      const changesDot = document.getElementById('changesDot');
      const prefs = preferences.value;

      if (chip) {
        chipLabel!.textContent = prefs.currentGroup || 'Группа';
        chip.classList.toggle('is-empty', !prefs.currentGroup);
        chip.classList.toggle('is-browsing', browsingOtherGroup.value);
      }
      if (netDot) {
        const notice = offlineNotice.value;
        netDot.hidden = !notice.offline;
        netDot.title = offlineNoticeText(notice, schedule.value?.updatedAt);
      }
      if (changesDot) changesDot.hidden = !scopedChanges.value;
    }

    function renderAll(): void {
      const sched = schedule.value;
      const screen = startScreen.value;

      if (screen === 'onboarding' && sched) {
        onboarding.show(sched);
      } else {
        onboarding.hide();
      }

      todayView.render(buildFeedState());
      searchView.render(searchResults.value, currentFilters.value.search);
      settingsSheet.render(buildSettingsState());
      updateChrome();
    }

    reminders.onChange(renderAll);

    // ---------- bindings ----------

    function closeSearch() {
      actions.clearSearch();
      searchView.close();
    }

    document.getElementById('searchBtn')?.addEventListener('click', () => searchView.open());
    document.getElementById('searchClose')?.addEventListener('click', closeSearch);
    const searchInput = document.getElementById('searchInput') as HTMLInputElement | null;
    const onSearchInput = (e: Event) =>
      actions.setFilter('search', (e.target as HTMLInputElement).value);
    searchInput?.addEventListener('input', onSearchInput);
    searchInput?.addEventListener('search', onSearchInput);

    document.getElementById('groupChip')?.addEventListener('click', openBrowse);
    document.getElementById('settingsBtn')?.addEventListener('click', () => settingsSheet.open());

    // Theme toggle
    const themeBtn = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    function updateThemeIcon(): void {
      if (!themeBtn || !themeIcon) return;
      const dark = isDark.value;
      themeBtn.setAttribute('aria-pressed', String(dark));
      themeBtn.setAttribute('aria-label', dark ? 'Светлая тема' : 'Тёмная тема');
      // Sun icon = light mode active (switch to light), Moon icon = dark mode active (switch to dark)
      themeIcon.innerHTML = dark
        ? '<circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />'
        : '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />';
    }
    themeBtn?.addEventListener('click', () => {
      const next = isDark.value ? 'light' : 'dark';
      applyTheme(next);
      updateThemeIcon();
    });
    updateThemeIcon();

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const overlay = document.getElementById('searchOverlay');
      if (overlay && !overlay.hidden) {
        closeSearch();
        return;
      }
    });

    initBrandGesture({ authService, adminView, toast });

    void adoptSharedWorkbook(adminView, toast);

    /** Navigate to a weekday without losing the search query. */
    function jumpToDay(day: string): void {
      if (!day) return;
      actions.showDayOf(day);
      document.scrollingElement?.scrollTo({ top: 0 });
      renderAll();
    }

    /** Reminder for one lesson, with an honest message for every refusal. */
    function scheduleReminderFor(lesson: Lesson): void {
      const ensureGranted = async (): Promise<boolean> => {
        const state = reminders.permission();
        if (state === 'granted') return true;
        if (state === 'denied') {
          toast?.show('Уведомления запрещены в настройках браузера', 'bad');
          return false;
        }
        const next = await reminders.request();
        if (next !== 'granted') {
          toast?.show(
            next === 'denied'
              ? 'Уведомления запрещены в браузере'
              : 'Браузер не разрешил уведомления',
            'bad'
          );
          return false;
        }
        return true;
      };

      void ensureGranted().then((ok) => {
        if (!ok) return;
        const result = reminders.add(lesson);
        if (result.ok) {
          toast?.show(`Напомним за ${result.reminder.leadMinutes} мин — пока IMF открыт`, 'ok');
          return;
        }
        const messages: Record<string, string> = {
          passed: 'Пара уже началась — напоминать поздно',
          'too-soon': 'До начала меньше, чем выбранное напоминание',
          'no-time': 'У этой пары не указано время',
        };
        toast?.show(messages[result.reason] || 'Напоминание невозможно', 'bad');
      });
    }

    todayView.start();

    return statusBanner;
  }

  /**
   * Launch deep links.
   *
   * `?day=today` is carried by the manifest `start_url` and by the "Сегодня"
   * app shortcut, so a long press on the home-screen icon lands on today's
   * weekday without the user picking anything first.
   */
  function applyLaunchFilters(): void {
    const params = new URLSearchParams(window.location.search);
    if (params.get('day') !== 'today') return;
    actions.setFilter('day', todayName.value);
  }

  async function handlePullRefresh(scheduleService: ScheduleService): Promise<void> {
    toast?.show('Проверяю обновления...', 'ok');
    const currentVersion = schedule.value?.version || '';
    const { hasUpdate } = await scheduleService.checkUpdates(currentVersion);

    if (hasUpdate) {
      await reloadAuthoritative('pull-refresh');
    } else {
      toast?.show('Обновлений нет', 'ok');
    }
  }

  function startUpdateChecker(scheduleService: ScheduleService): void {
    const check = async (reason: string): Promise<void> => {
      try {
        const currentVersion = schedule.value?.version || '';
        const { hasUpdate, version, updatedAt } =
          await scheduleService.checkUpdates(currentVersion);
        if (hasUpdate) {
          actions.setUpdateAvailable({ version, updatedAt });
          await reloadAuthoritative(reason);
        }
      } catch (err) {
        logger.warn('[App] Update check failed', { reason, error: toAppError(err).code });
      }
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void check('visibility');
        requestServiceWorkerCheck();
      }
    });

    setInterval(() => void check('interval'), 20 * 1000);
  }

  function syncInitialNetworkState(): void {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      actions.setNetStatus({ browserOnline: false, loadFailed: true });
    }
  }

  function listenForNetworkChanges(onOnline?: () => void): void {
    window.addEventListener('offline', () => {
      actions.setNetStatus({ browserOnline: false, loadFailed: true });
    });
    window.addEventListener('online', () => {
      actions.setNetStatus({ browserOnline: true });
      onOnline?.();
    });
  }

  async function adoptSharedWorkbook(
    adminView: { show(): void; stageFile(file: File): void },
    toast: { show(message: string, type?: string): void } | undefined
  ): Promise<void> {
    if (!isSharedLaunch()) return;
    const shared = await takeSharedWorkbook();
    clearSharedLaunchFlag();
    if (!shared) {
      logger.warn('[share] no workbook found in the handoff cache');
      return;
    }
    adminView.stageFile(shared.file);
    adminView.show();
    toast?.show('Файл «' + shared.name + '» готов к публикации', 'ok');
  }
}

// Start the app - register SW independently (runs even if bootstrap fails)
registerServiceWorker();
bootstrap().catch((err) => {
  logger.error('[App] Fatal error', { context: 'bootstrap' }, err as Error);
  document.body.innerHTML =
    '<div style="padding:2rem;text-align:center">Ошибка инициализации приложения</div>';
});
