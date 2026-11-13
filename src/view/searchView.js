import { escapeHtml } from '../text.ts';
import { DAY_SHORT } from '../constants.ts';
import { resultsNeedSubgroup } from '@core/domain/search';

export function createSearchView({ overlay, input, results, closeBtn, onJump, onClose, onQuery }) {
  function open() {
    overlay.hidden = false;
    input.value = '';
    render([], '');
    input.focus();
  }

  function close() {
    overlay.hidden = true;
    input.value = '';
    input.blur();
    onClose?.();
  }

  overlay.addEventListener('mousedown', (event) => {
    if (event.target === overlay) close();
  });

  function render(list, query) {
    const q = String(query || '').trim();
    while (results.firstChild) results.removeChild(results.firstChild);

    if (!q) {
      const hint = document.createElement('div');
      hint.className = 'search-hint';
      hint.textContent = 'Начни вводить: предмет, преподаватель или аудитория';
      results.appendChild(hint);
      return;
    }

    if (!list.length) {
      const hint = document.createElement('div');
      hint.className = 'search-hint';
      hint.textContent = 'Ничего не найдено. Проверь написание или попробуй часть слова.';
      results.appendChild(hint);
      return;
    }

    const showSubgroup = resultsNeedSubgroup(list);
    for (const lesson of list) {
      const metaParts = [lesson.time];
      if (showSubgroup && lesson.subgroup) metaParts.push('подгр. ' + escapeHtml(lesson.subgroup));
      if (lesson.room) metaParts.push('ауд. ' + escapeHtml(lesson.room));
      if (lesson.teacher) metaParts.push(escapeHtml(lesson.teacher));

      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'search-row';
      row.dataset.day = lesson.day;
      row.innerHTML = `
        <span class="search-day">${escapeHtml(DAY_SHORT[lesson.day] || lesson.day)}</span>
        <div>
          <span class="search-subject">${escapeHtml(lesson.subject)}</span>
          <span class="search-meta">${metaParts.join(' · ')}</span>
        </div>
      `;
      row.addEventListener('click', () => {
        onJump(lesson.day);
        close();
      });
      results.appendChild(row);
    }
  }

  input.addEventListener('input', () => onQuery?.(input.value));
  closeBtn.addEventListener('click', close);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  return { open, close, render };
}
