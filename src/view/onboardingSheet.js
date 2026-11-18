export function createOnboardingSheet({ onSelect, onSkip }) {
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', 'onboarding-title');

  const handle = document.createElement('div');
  handle.className = 'sheet-handle';
  const header = document.createElement('div');
  header.className = 'sheet-header';
  const heading = document.createElement('h2');
  heading.className = 'sheet-title';
  heading.textContent = 'Выбери свою группу';
  heading.id = 'onboarding-title';
  heading.tabIndex = -1;
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'icon-btn';
  closeBtn.setAttribute('aria-label', 'Закрыть');
  closeBtn.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  const body = document.createElement('div');
  body.className = 'sheet-body';

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const footer = document.createElement('div');
  footer.className = 'sheet-footer';
  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'sheet-back';
  skipBtn.innerHTML = '<span>Посмотреть всё расписание</span>';
  footer.append(skipBtn);

  header.append(heading, closeBtn);
  sheet.append(handle, header, body, footer);

  let data = null;
  let stage = 'sheet';
  let sheetId = '';
  let groupId = '';
  let open = false;
  let removeTimer = null;

  const close = () => {
    if (!open) return;
    open = false;
    sheet.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    window.clearTimeout(removeTimer);
    removeTimer = window.setTimeout(() => {
      backdrop.remove();
      sheet.remove();
    }, 300);
  };

  const hintText = 'Один раз — дальше запомним и сразу покажем твои пары.';

  const lessonWord = (n) => {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return 'пара';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'пары';
    return 'пар';
  };

  /** Department lessons; `sheetsMeta` carries no groups, so derive them here. */
  const lessonsOf = (id) => {
    const map = data && data.sheets;
    if (!map || typeof map.get !== 'function') return [];
    return map.get(id) || [];
  };

  const render = () => {
    while (body.firstChild) body.removeChild(body.firstChild);

    const hint = document.createElement('p');
    hint.className = 'sheet-hint';
    hint.textContent = hintText;
    body.append(hint);

    const stepLabel = document.createElement('div');
    stepLabel.className = 'sheet-section';
    stepLabel.textContent = stage === 'sheet' ? 'Шаг 1 из 2 · отделение' : 'Шаг 2 из 2 · группа';
    body.append(stepLabel);

    if (stage === 'group') {
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'sheet-back';
      back.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span>Другое отделение</span>';
      back.addEventListener('click', () => {
        stage = 'sheet';
        render();
      });
      body.append(back);
    }

    if (stage === 'sheet') {
      const sheets = (data && data.sheetsMeta) || [];
      for (const s of sheets) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sheet-item';
        const label = document.createElement('span');
        label.className = 'sheet-item-label';
        label.textContent = s.name;
        const meta = document.createElement('span');
        meta.className = 'sheet-item-meta';
        const count = lessonsOf(s.id).length || Number(s.lessonCount || 0);
        meta.textContent = count ? count + ' ' + lessonWord(count) : '';
        btn.append(label, meta);
        btn.dataset.id = s.id;
        btn.addEventListener('click', () => {
          sheetId = s.id;
          stage = 'group';
          render();
        });
        body.append(btn);
      }
    } else if (stage === 'group') {
      const lessons = lessonsOf(sheetId);
      const counts = new Map();
      for (const lesson of lessons) {
        counts.set(lesson.group, (counts.get(lesson.group) || 0) + 1);
      }
      const codes = Array.from(counts.keys()).sort((a, b) =>
        String(a).localeCompare(String(b), 'ru')
      );
      for (const code of codes) {
        const count = counts.get(code) || 0;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sheet-item' + (code === groupId ? ' is-active' : '');
        const label = document.createElement('span');
        label.className = 'sheet-item-label';
        label.textContent = code;
        const meta = document.createElement('span');
        meta.className = 'sheet-item-meta';
        meta.textContent = count ? count + ' ' + lessonWord(count) : '';
        btn.append(label, meta);
        btn.dataset.id = code;
        btn.addEventListener('click', () => {
          groupId = code;
          onSelect?.({ sheetId, group: groupId });
        });
        body.append(btn);
      }
      if (!codes.length) {
        const empty = document.createElement('p');
        empty.className = 'sheet-hint';
        empty.textContent = 'В этом отделении пока нет групп. Попробуй другое.';
        body.append(empty);
      }
    }
  };

  const show = (scheduleData) => {
    data = scheduleData;
    // Re-renders triggered by the app must not throw the student back to step 1.
    if (!open) {
      stage = 'sheet';
      sheetId = '';
      groupId = '';
    }
    render();
    window.clearTimeout(removeTimer);
    if (!sheet.parentElement) {
      document.getElementById('sheetRoot').appendChild(backdrop);
      document.getElementById('sheetRoot').appendChild(sheet);
    }
    sheet.classList.add('is-open');
    backdrop.classList.add('is-open');
    if (!open) heading.focus();
    open = true;
  };

  backdrop.addEventListener('click', close);
  skipBtn.addEventListener('click', onSkip);
  closeBtn.addEventListener('click', close);

  return {
    show,
    hide: close,
    get isOpen() {
      return open;
    },
  };
}
