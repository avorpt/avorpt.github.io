(function () {
  const STORAGE_KEY = 'cookie-consent';

  /* ── styles ──
     AVOR-only banner: styled with AVOR design tokens from stylesavor.css,
     which every host page loads. Literals are kept only where AVOR has no
     matching token (overlay backdrop, button gap). */
  const style = document.createElement('style');
  style.textContent = `
    /* overlay */
    #ck-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(0, 0, 0, 0.18);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s var(--ease);
    }

    #ck-overlay.is-open {
      opacity: 1;
      pointer-events: auto;
    }

    /* modal */
    #ck-modal {
      position: relative;
      background: var(--bg-raised);
      border: 1px solid var(--border-active);
      width: min(1260px, calc(100vw - 48px));
      font-family: var(--font);
      transform: translateY(12px);
      transition: transform 0.3s var(--ease);
    }

    #ck-overlay.is-open #ck-modal {
      transform: translateY(0);
    }

    #ck-modal-inner {
      padding: var(--space-xl);
      display: flex;
      flex-direction: column;
      gap: var(--space-lg);
    }

    /* content */
    .ck-content {
      flex: 1;
      min-width: 0;
    }

    .ck-close {
      position: absolute;
      top: var(--space-md);
      right: var(--space-md);
      background: none;
      border: none;
      color: var(--text-dim);
      font-size: var(--text-base);
      line-height: 1;
      cursor: pointer;
      padding: 0;
      transition: color 0.2s var(--ease);
    }

    .ck-close:hover { color: var(--text); }

    .ck-title {
      display: block;
      color: var(--text);
      font-size: var(--text-base);
      font-weight: 400;
      letter-spacing: var(--tracking-wide);
      margin-bottom: var(--space-sm);
    }

    .ck-body {
      color: var(--text-dim);
      font-size: var(--text-sm);
      font-weight: 400;
      line-height: var(--leading-body);
      letter-spacing: var(--tracking-tight);
    }

    .ck-body a {
      color: var(--text-dim);
      text-decoration: underline;
      text-underline-offset: 3px;
      transition: color 0.2s var(--ease);
    }

    .ck-body a:hover { color: var(--text); }

    /* actions */
    .ck-actions {
      display: flex;
      flex-direction: row;
      gap: var(--space-md);
    }

    .ck-btn {
      background: none;
      border: 1px solid var(--border);
      color: var(--text-dim);
      font-family: var(--font);
      font-size: var(--text-xs);
      font-weight: 400;
      letter-spacing: var(--tracking-ui);
      text-transform: uppercase;
      padding: 10px var(--space-md);
      cursor: pointer;
      transition: border-color 0.2s var(--ease), color 0.2s var(--ease), background 0.2s var(--ease);
      white-space: nowrap;
    }

    .ck-btn:hover {
      border-color: var(--border-active);
      color: var(--text);
    }

    .ck-btn-primary {
      border-color: var(--border-active);
      color: var(--text);
    }

    .ck-btn-primary:hover {
      background: var(--text);
      color: var(--bg);
    }

    @media (max-width: 500px) {
      .ck-actions { flex-direction: column; }
      .ck-btn { text-align: center; }
    }

    @media (prefers-reduced-motion: reduce) {
      #ck-overlay,
      #ck-modal { transition: none; }
      #ck-modal { transform: none; }
    }
  `;
  document.head.appendChild(style);

  /* ── markup ── */
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="ck-overlay">
      <div id="ck-modal" role="dialog" aria-modal="true" aria-label="Cookie Preferences">
        <button class="ck-close" aria-label="Close">&#x2715;</button>
        <div id="ck-modal-inner">
          <div class="ck-content">
            <span class="ck-title">Personalized experiences with full control.</span>
            <p class="ck-body">
              We use cookies and similar technologies on this site. With your consent, we can track
              content that interests you (analytics and performance) and show advertising tailored
              to your browsing habits (marketing), including building a profile from your usage
              (personalized marketing). You can withdraw your consent at any time with effect for
              the future. For more on data processing and your options, see our
              <a href="cookiepolicy.html" target="_blank"
                        rel="noopener noreferrer">Cookie Policy</a>.
            </p>
          </div>
          <div class="ck-actions">
            <button class="ck-btn ck-btn-primary" id="ck-accept">Accept All</button>
            <button class="ck-btn" id="ck-necessary">Only Necessary Cookies</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  /* ── refs ── */
  const overlay = document.getElementById('ck-overlay');
  const modal = document.getElementById('ck-modal');

  /* ── open / close ── */
  let lastFocused = null;
  const isOpen = () => overlay.classList.contains('is-open');
  const focusables = () =>
    [...modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.disabled && el.offsetParent !== null);

  function open(e) {
    lastFocused = (e && e.currentTarget) || document.activeElement;
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    wrap.querySelector('.ck-close').focus();
  }

  function close() {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  /* footer link(s) open the modal; the link is permanent so consent can be reviewed anytime */
  document.querySelectorAll('.footer-cookie').forEach(btn => btn.addEventListener('click', open));

  overlay.addEventListener('click', e => { if (!modal.contains(e.target)) close(); });
  wrap.querySelector('.ck-close').addEventListener('click', close);

  document.addEventListener('keydown', e => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'Tab') {
      /* focus trap: keep Tab cycling within the modal */
      const items = focusables();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ── consent ── */
  function save(prefs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    close();
  }

  wrap.querySelector('#ck-accept').addEventListener('click', () =>
    save({ necessary: true, functional: true, analytics: true, performance: true, advertisement: true })
  );

  wrap.querySelector('#ck-necessary').addEventListener('click', () =>
    save({ necessary: true, functional: false, analytics: false, performance: false, advertisement: false })
  );
})();
