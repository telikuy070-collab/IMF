import { DAY_SHORT, JS_DAY_TO_NAME } from '../constants.ts';
import { escapeHtml } from '../text.ts';
import { icon } from './icons.js';

const CLOCK = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

export function createSettingsSheet({
  reminders,
  install,
  onBrowse,
  onGoMySchedule,
  onForget,
  onRequestNotifications,
  onSetLead,
  onCancelReminder,
  onJumpDay,
  onInstall,
}) {
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');

  const handle = document.createElement('div');
  handle.className = 'sheet-handle';
  const header = document.createElement('div');
  header.className = 'sheet-header';
  const heading = document.createElement('h2');
  heading.className = 'sheet-title';
  heading.textContent = 'Настройки';
  heading.id = 'settings-title';
  sheet.setAttribute('aria-labelledby', heading.id);
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'icon-btn';
  closeBtn.setAttribute('aria-label', 'Закрыть');
  closeBtn.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  const body = document.createElement('div');
  body.className = 'sheet-body';

  header.append(heading, closeBtn);
  sheet.append(handle, header, body);

  let current = null;

  const close = () => {
    sheet.classList.remove('is-open');
    window.setTimeout(() => sheet.remove(), 300);
  };

  const stateOf = (perm) => {
    if (!perm) return 'Браузер не умеет показывать уведомления.';
    if (perm === 'denied')
      return 'Уведомления запрещены в настройках браузера — включить можно только там.';
    if (perm === 'default')
      return 'Разрешение не запрошено — нажми «Включить», браузер спросит один раз.';
    return 'Уведомления включены. Напомним за выбранное время до пары, пока IMF открыт.';
  };

  const renderReminders = () => {
    const permission = reminders.permission?.();
    const canAsk = reminders.canAsk?.() ?? false;
    const granted = permission === 'granted';

    const block = document.createElement('div');
    block.className = 'sheet-section';
    block.textContent = 'Напоминания';
    body.append(block);

    const status = document.createElement('p');
    status.className = 'sheet-hint';
    status.textContent = stateOf(permission);
    body.append(status);

    if (canAsk && permission === 'default') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'set-row';
      btn.dataset.action = 'enable-notify';
      const iconSpan = document.createElement('span');
      iconSpan.className = 'set-row-icon';
      iconSpan.innerHTML = icon('bell', 18);
      const bodyRow = document.createElement('div');
      bodyRow.className = 'set-row-body';
      const label = document.createElement('div');
      label.className = 'set-row-label';
      label.textContent = 'Включить напоминания';
      bodyRow.append(label);
      btn.append(iconSpan, bodyRow);
      btn.addEventListener('click', () => onRequestNotifications?.());
      body.append(btn);
    }

    if (granted) {
      const lead = reminders.lead?.() ?? 10;
      const options = reminders.leadOptions?.() ?? [5, 10, 15, 30];

      const labelBlock = document.createElement('div');
      labelBlock.className = 'sheet-section';
      labelBlock.textContent = 'Напоминать за';
      body.append(labelBlock);

      const chips = document.createElement('div');
      chips.className = 'chips';
      for (const m of options) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip' + (m === lead ? ' is-active' : '');
        chip.dataset.lead = m;
        chip.textContent = m + ' мин';
        chip.addEventListener('click', () => onSetLead(m));
        chips.appendChild(chip);
      }
      body.append(chips);

      const listHead = document.createElement('div');
      listHead.className = 'sheet-section';
      listHead.textContent = 'Запланировано';
      body.append(listHead);

      const remindersList = reminders.list?.() ?? [];
      if (remindersList.length > 0) {
        const list = document.createElement('div');
        for (const rem of remindersList) {
          const row = document.createElement('div');
          row.className = 'rem-row';
          const d = new Date(rem.fireAt);
          const name =
            JS_DAY_TO_NAME[d.getDay()] || d.toLocaleDateString('ru-RU', { weekday: 'long' });
          const metaParts = [escapeHtml(rem.subject || 'Занятие'), name + ' в ' + CLOCK.format(d)];
          const rowBody = document.createElement('div');
          rowBody.className = 'rem-body';
          const subject = document.createElement('div');
          subject.className = 'rem-subject';
          subject.textContent = escapeHtml(rem.subject || 'Занятие');
          const meta = document.createElement('div');
          meta.className = 'rem-meta';
          meta.textContent = metaParts.join(' · ') + ' · за ' + rem.leadMinutes + ' мин';
          rowBody.append(subject, meta);
          const cancel = document.createElement('button');
          cancel.type = 'button';
          cancel.className = 'rem-cancel';
          cancel.dataset.cancel = rem.id;
          cancel.textContent = 'Убрать';
          cancel.addEventListener('click', () => onCancelReminder(rem.id));
          row.append(rowBody, cancel);
          list.appendChild(row);
        }
        body.append(list);

        const note = document.createElement('p');
        note.className = 'sheet-hint';
        note.textContent = 'Напоминание сработает, пока IMF открыт в браузере.';
        body.append(note);
      }
    }
  };

  const renderChanges = (changes) => {
    if (!changes) return;
    const added = changes.added || [];
    const removed = changes.removed || [];
    if (!added.length && !removed.length) return;

    const block = document.createElement('div');
    block.className = 'sheet-section';
    block.textContent = 'Что изменилось';
    body.append(block);

    const rows = [];
    for (const rem of added) rows.push({ sign: '+', lesson: rem });
    for (const rem of removed) rows.push({ sign: '-', lesson: rem });

    for (const item of rows) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'set-row';
      row.dataset.day = item.lesson.day;
      const iconSpan = document.createElement('span');
      iconSpan.className = 'set-row-icon';
      iconSpan.style.color = item.sign === '+' ? 'var(--ok)' : 'var(--bad)';
      iconSpan.textContent = item.sign === '+' ? '+' : '–';
      const bodyRow = document.createElement('div');
      bodyRow.className = 'set-row-body';
      const label = document.createElement('div');
      label.className = 'set-row-label';
      label.textContent = escapeHtml(item.lesson.subject);
      const sub = document.createElement('div');
      sub.className = 'set-row-sub';
      sub.textContent =
        (DAY_SHORT[item.lesson.day] || item.lesson.day) +
        ' · ' +
        escapeHtml(item.lesson.time) +
        (item.lesson.room ? ' · ауд. ' + escapeHtml(item.lesson.room) : '');
      bodyRow.append(label, sub);
      row.append(iconSpan, bodyRow);
      row.addEventListener('click', () => onJumpDay(item.lesson.day));
      body.append(row);
    }
  };

  const renderApp = () => {
    if (install.isStandalone?.()) {
      const row = document.createElement('div');
      row.className = 'set-row set-row is-disabled';
      const iconSpan = document.createElement('span');
      iconSpan.className = 'set-row-icon';
      iconSpan.innerHTML = icon('download', 18);
      const bodyRow = document.createElement('div');
      bodyRow.className = 'set-row-body';
      const label = document.createElement('div');
      label.className = 'set-row-label';
      label.textContent = 'Приложение установлено';
      bodyRow.append(label);
      row.append(iconSpan, bodyRow);
      body.append(row);
      return;
    }

    if (install.canPrompt?.()) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'set-row';
      const iconSpan = document.createElement('span');
      iconSpan.className = 'set-row-icon';
      iconSpan.innerHTML = icon('download', 18);
      const bodyRow = document.createElement('div');
      bodyRow.className = 'set-row-body';
      const label = document.createElement('div');
      label.className = 'set-row-label';
      label.textContent = 'Установить на телефон';
      const sub = document.createElement('div');
      sub.className = 'set-row-sub';
      sub.textContent = 'Быстрый запуск и работа без интернета';
      bodyRow.append(label, sub);
      btn.append(iconSpan, bodyRow);
      btn.addEventListener('click', async () => {
        const outcome = await onInstall?.();
        if (outcome === 'accepted') {
          const toast = window.toast;
          if (toast) toast.show('Установили', 'ok');
        }
      });
      body.append(btn);
    } else if (install.isIos?.()) {
      const row = document.createElement('div');
      row.className = 'set-row set-row is-disabled';
      const iconSpan = document.createElement('span');
      iconSpan.className = 'set-row-icon';
      iconSpan.innerHTML = icon('external', 18);
      const bodyRow = document.createElement('div');
      bodyRow.className = 'set-row-body';
      const label = document.createElement('div');
      label.className = 'set-row-label';
      label.textContent = 'Установить';
      const sub = document.createElement('div');
      sub.className = 'set-row-sub';
      sub.textContent = 'Safari: «Поделиться» → «На экран «Домой»»';
      bodyRow.append(label, sub);
      row.append(iconSpan, bodyRow);
      body.append(row);
    }
  };

  const externalLink = (label, sub, href) => {
    const row = document.createElement('a');
    row.className = 'set-row chevron';
    row.href = href;
    row.target = '_blank';
    row.rel = 'noopener';
    const iconSpan = document.createElement('span');
    iconSpan.className = 'set-row-icon';
    iconSpan.innerHTML = icon('external', 18);
    const bodyRow = document.createElement('div');
    bodyRow.className = 'set-row-body';
    const labelEl = document.createElement('div');
    labelEl.className = 'set-row-label';
    labelEl.textContent = label;
    bodyRow.append(labelEl);
    const subEl = document.createElement('div');
    subEl.className = 'set-row-sub';
    subEl.textContent = sub;
    bodyRow.append(subEl);
    const chev = document.createElement('span');
    chev.className = 'chevron';
    chev.innerHTML = icon('chevron', 16);
    row.append(iconSpan, bodyRow, chev);
    return row;
  };

  const render = (s) => {
    current = s;
    while (body.firstChild) body.removeChild(body.firstChild);

    const groupBlock = document.createElement('div');
    groupBlock.className = 'sheet-section';
    groupBlock.textContent = 'Группа';
    body.append(groupBlock);

    const infoRow = document.createElement('div');
    infoRow.className = 'set-row';
    const infoIcon = document.createElement('span');
    infoIcon.className = 'set-row-icon';
    infoIcon.innerHTML = icon('users', 18);
    const infoBody = document.createElement('div');
    infoBody.className = 'set-row-body';
    const infoLabel = document.createElement('div');
    infoLabel.className = 'set-row-label';
    infoLabel.textContent = s.myLabel || 'Не выбрана';
    const infoSub = document.createElement('div');
    infoSub.className = 'set-row-sub';
    infoSub.textContent = s.currentLabel ? 'Расписание: ' + escapeHtml(s.currentLabel) : '';
    infoBody.append(infoLabel);
    if (infoSub.textContent) infoBody.append(infoSub);
    infoRow.append(infoIcon, infoBody);
    body.append(infoRow);

    if (s.browsing) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'set-row';
      btn.dataset.action = 'my';
      const iconSpan = document.createElement('span');
      iconSpan.className = 'set-row-icon';
      iconSpan.innerHTML = icon('pin', 18);
      const bodyRow = document.createElement('div');
      bodyRow.className = 'set-row-body';
      const label = document.createElement('div');
      label.className = 'set-row-label';
      label.textContent = 'Вернуться к моей группе';
      const sub = document.createElement('div');
      sub.className = 'set-row-sub';
      sub.textContent = s.myLabel ? 'Твоя: ' + escapeHtml(s.myLabel) : '';
      bodyRow.append(label, sub);
      btn.append(iconSpan, bodyRow);
      btn.addEventListener('click', () => onGoMySchedule?.());
      body.append(btn);
    }

    const browseRow = document.createElement('button');
    browseRow.type = 'button';
    browseRow.className = 'set-row';
    const browseIcon = document.createElement('span');
    browseIcon.className = 'set-row-icon';
    browseIcon.innerHTML = icon('users', 18);
    const browseBody = document.createElement('div');
    browseBody.className = 'set-row-body';
    const browseLabel = document.createElement('div');
    browseLabel.className = 'set-row-label';
    browseLabel.textContent = 'Сменить группу…';
    const browseChev = document.createElement('span');
    browseChev.className = 'chevron';
    browseChev.innerHTML = icon('chevron', 16);
    browseBody.append(browseLabel);
    browseRow.append(browseIcon, browseBody, browseChev);
    browseRow.addEventListener('click', () => onBrowse?.());
    body.append(browseRow);

    renderReminders();

    if (s.changes) renderChanges(s.changes);

    const appBlock = document.createElement('div');
    appBlock.className = 'sheet-section';
    appBlock.textContent = 'Приложение';
    body.append(appBlock);
    renderApp();

    const avn = externalLink('Перейти в АВН', 'avn.kumu.kg/lms', 'https://avn.kumu.kg/lms');
    body.append(avn);

    const aboutBlock = document.createElement('div');
    aboutBlock.className = 'sheet-section';
    aboutBlock.textContent = 'О приложении';
    body.append(aboutBlock);

    const verRow = document.createElement('div');
    verRow.className = 'set-row set-row is-disabled';
    const verIcon = document.createElement('span');
    verIcon.className = 'set-row-icon';
    verIcon.innerHTML = icon('info', 18);
    const verBody = document.createElement('div');
    verBody.className = 'set-row-body';
    const verLabel = document.createElement('div');
    verLabel.className = 'set-row-label';
    verLabel.textContent = 'Версия приложения';
    const verVal = document.createElement('div');
    verVal.className = 'set-row-value';
    verVal.textContent = s.version || '—';
    verBody.append(verLabel);
    verBody.append(verVal);
    verRow.append(verIcon, verBody);
    body.append(verRow);

    const updRow = document.createElement('div');
    updRow.className = 'set-row set-row is-disabled';
    const updIcon = document.createElement('span');
    updIcon.className = 'set-row-icon';
    updIcon.innerHTML = icon('clock', 18);
    const updBody = document.createElement('div');
    updBody.className = 'set-row-body';
    const updLabel = document.createElement('div');
    updLabel.className = 'set-row-label';
    updLabel.textContent = 'Расписание';
    const updVal = document.createElement('div');
    updVal.className = 'set-row-value';
    updVal.textContent = s.updatedAt ? 'обновлено ' + s.updatedAt : '—';
    updBody.append(updLabel);
    updBody.append(updVal);
    updRow.append(updIcon, updBody);
    body.append(updRow);

    const danger = document.createElement('button');
    danger.type = 'button';
    danger.className = 'set-row is-danger';
    danger.dataset.action = 'forget';
    const dangerIcon = document.createElement('span');
    dangerIcon.className = 'set-row-icon';
    dangerIcon.innerHTML = icon('alert', 18);
    const dangerBody = document.createElement('div');
    dangerBody.className = 'set-row-body';
    const dangerLabel = document.createElement('div');
    dangerLabel.className = 'set-row-label';
    dangerLabel.textContent = 'Забыть мою группу';
    dangerBody.append(dangerLabel);
    danger.append(dangerIcon, dangerBody);
    danger.addEventListener('click', () => onForget?.());
    body.append(danger);
  };

  const onBodyClick = (event) => {
    const act = event.target.closest('[data-action]');
    if (!act) return;
    const action = act.dataset.action;
    if (action === 'browse') onBrowse?.();
    else if (action === 'my') onGoMySchedule?.();
    else if (action === 'enable-notify') onRequestNotifications?.();
    else if (action === 'install') onInstall?.();
    else if (action === 'forget') onForget?.();
    const lead = event.target.closest('[data-lead]');
    if (lead) onSetLead(Number(lead.dataset.lead));
    const cancel = event.target.closest('[data-cancel]');
    if (cancel) onCancelReminder(cancel.dataset.cancel);
  };
  body.addEventListener('click', onBodyClick);

  const openFn = function () {
    render(current ?? {});
    if (!sheet.parentElement) document.getElementById('sheetRoot').appendChild(sheet);
    sheet.classList.add('is-open');
    heading.focus();
  };

  return {
    open: openFn,
    close,
    render,
    destroy() {
      close();
      body.removeEventListener('click', onBodyClick);
      closeBtn.removeEventListener('click', close);
    },
  };
}
