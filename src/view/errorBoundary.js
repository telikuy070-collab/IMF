/**
 * Error Boundary Web Component.
 *
 * Catches render-time errors in the schedule view and displays a friendly
 * fallback UI instead of a crashed app. Usage:
 *
 *   <error-boundary id="scheduleError" message="Не удалось загрузить расписание">
 *     <!-- child content rendered by app -->
 *   </error-boundary>
 *
 * The boundary listens for a custom `error` event (bubbles from anywhere)
 * or you can call `boundary.reportError(err)` imperatively.
 */

/** CSS injected into shadow DOM — light theme, minimal. */
const styles = `
  :host {
    display: block;
    padding: 24px 16px;
    text-align: center;
  }
  .error-boundary {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  h2 {
    font-size: 16px;
    font-weight: 700;
    margin: 0;
    color: var(--ink);
  }
  p {
    margin: 0;
    color: var(--ink-2);
    font-size: 13px;
  }
  button {
    margin-top: 10px;
    padding: 10px 16px;
    border-radius: 12px;
    border: 1px solid var(--line-2);
    background: var(--bg-elev);
    color: var(--ink);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  button:hover { background: var(--line); }
`;

/** Escape HTML to prevent XSS in fallback rendering. */
function escapeHtml(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (ch) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[ch]
  );
}

/**
 * @typedef {Object} ErrorBoundaryDetail
 * @property {string} message - user-facing message
 * @property {Error} [originalError] - the underlying error
 * @property {number} [timestamp] - when the error occurred
 */

const TEMPLATE_ID = 'template-error-boundary';

/** Ensure the HTML template element exists in the document. */
function ensureTemplate() {
  if (typeof document === 'undefined') return null;
  let t = document.getElementById(TEMPLATE_ID);
  if (!t) {
    t = document.createElement('template');
    t.id = TEMPLATE_ID;
    t.innerHTML = `
      <style>${styles}</style>
      <div class="error-boundary" role="alert" aria-live="polite" hidden>
        <h2>⚠️ Что-то пошло не так</h2>
        <p class="error-message"></p>
        <button type="button" class="error-reload">Перезагрузить</button>
      </div>
      <slot></slot>
    `;
    document.body.appendChild(t);
  }
  return t;
}

export class ErrorBoundary extends HTMLElement {
  static get observedAttributes() {
    return ['message', 'title'];
  }

  constructor() {
    super();
    /** @type {ErrorBoundaryDetail | null} */
    this._detail = null;
  }

  connectedCallback() {
    // Don't render error UI initially - show light DOM children (slot) until handleError() is called
    this.render();
    // Listen for custom error events dispatched on document
    if (!this._boundHandleError) {
      this._boundHandleError = this.handleError.bind(this);
      document.addEventListener('IMF-error', this._boundHandleError);
    }
  }

  disconnectedCallback() {
    if (this._boundHandleError) {
      document.removeEventListener('IMF-error', this._boundHandleError);
      this._boundHandleError = null;
    }
  }

  attributeChangedCallback(name, _oldVal, _newVal) {
    if (name === 'message' || name === 'title') this.render();
  }

  /**
   * Imperative API: report an error programmatically.
   * @param {Error|string|unknown} err
   */
  reportError(err) {
    this.handleError({ detail: { originalError: err } });
  }

  /**
   * Imperative API: clear the shown error and return to showing light-DOM children.
   */
  clear() {
    this._detail = null;
    this.render();
  }

  /**
   * @param {CustomEvent<ErrorBoundaryDetail>} e
   */
  handleError(e) {
    const detail = e?.detail || { originalError: e };
    this._detail = detail;
    this.render();
  }

  render() {
    const tmpl = ensureTemplate();
    const message = this.getAttribute('message') || 'Что-то пошло не так';
    const title = this.getAttribute('title') || 'Ошибка';
    const hasError = !!this._detail;

    // If shadow DOM is supported, use it for style isolation
    if (this.attachShadow) {
      if (!this.shadowRoot) {
        const shadow = this.attachShadow({ mode: 'open' });
        const clone = tmpl.content.cloneNode(true);
        shadow.appendChild(clone);
        this._wireEvents(shadow);
      }
      // Toggle error UI vs slot based on error state
      const errorDiv = this.shadowRoot.querySelector('.error-boundary');
      const slot = this.shadowRoot.querySelector('slot');
      if (errorDiv) errorDiv.hidden = !hasError;
      if (slot) slot.hidden = hasError;
      // Update text content when showing error
      if (hasError) {
        const msgEl = this.shadowRoot.querySelector('.error-message');
        if (msgEl) msgEl.textContent = this._detail?.originalError?.message || message;
        const titleEl = this.shadowRoot.querySelector('h2');
        if (titleEl) titleEl.textContent = title;
        const btn = this.shadowRoot.querySelector('.error-reload');
        if (btn) btn.addEventListener('click', () => this.clear());
      }
    } else {
      // Fallback: render directly (no style isolation)
      if (hasError) {
        const errMsg = escapeHtml(this._detail?.originalError?.message || message);
        const safeTitle = escapeHtml(title);
        this.innerHTML = `
          <style>${styles}</style>
          <div class="error-boundary" role="alert" aria-live="polite">
            <h2>${safeTitle}</h2>
            <p>${errMsg}</p>
            <button type="button" class="error-reload">Повторить</button>
          </div>
        `;
        this.querySelector('.error-reload')?.addEventListener('click', () => this.clear());
      } else {
        // No error: show light DOM children (slot equivalent)
        // Keep existing light DOM content - don't overwrite it
        // Just ensure no error UI is present
        const existingError = this.querySelector('.error-boundary');
        if (existingError) existingError.remove();
      }
    }
  }

  _wireEvents(root) {
    root.querySelector('.error-reload')?.addEventListener('click', () => {
      location.reload();
    });
  }
}

// Register the custom element (idempotent)
if (typeof customElements !== 'undefined' && !customElements.get('error-boundary')) {
  customElements.define('error-boundary', ErrorBoundary);
}

/**
 * Dispatch a global error event that any ErrorBoundary in the DOM can catch.
 * Use this in catch blocks to surface errors to the UI.
 *
 * @param {Error|string|unknown} err
 * @param {string} [message] - optional override message
 */
export function reportError(err, message) {
  if (typeof document === 'undefined') {
    console.error(err);
    return;
  }
  document.dispatchEvent(
    new CustomEvent('IMF-error', {
      detail: { originalError: err, message },
    })
  );
}

export default ErrorBoundary;
