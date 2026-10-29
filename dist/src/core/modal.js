/** Extracted module: src/core/modal.js lines 1438-1476 — DO NOT rewrite business logic */
const Modal = {
  _onConfirm: null,
  _resolve: null,
  open(title, body, buttons) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modalFooter').innerHTML = (buttons || []).map(b =>
      `<button class="btn ${b.cls || 'btn-s'}" data-modal-action="${b.action || ''}">${b.label}</button>`
    ).join('');
    document.getElementById('modal').classList.add('show');
    setTimeout(() => {
      const inp = document.querySelector('#modalBody input, #modalBody textarea, #modalBody select');
      if (inp) inp.focus();
    }, 50);
    // Promise API for callers that use .then()
    return new Promise((resolve) => {
      this._resolve = resolve;
    });
  },
  close(result) {
    document.getElementById('modal').classList.remove('show');
    const res = result != null ? result : { action: 'cancel' };
    if (typeof this._resolve === 'function') {
      try { this._resolve(res); } catch (_) {}
    }
    this._resolve = null;
    this._onConfirm = null;
  },
  confirm(msg, onYes) {
    this._onConfirm = onYes;
    this.open((typeof t==='function'?t('confirm_title'):'Підтвердження'), `<p style="font-size:14px">${sanitize(msg)}</p>`, [
      { label: (typeof t==='function'?t('cancel'):'Скасувати'), cls: 'btn-s', action: 'cancel' },
      { label: (typeof t==='function'?t('confirm_ok'):'Підтвердити'), cls: 'btn-d', action: 'confirm' }
    ]);
  },
  prompt(title, def, onOk) {
    this._onConfirm = () => {
      const v = document.getElementById('promptInput')?.value;
      onOk(v);
    };
    this.open(title, `<div class="fgr full"><input id="promptInput" value="${sanitize(def || '')}"></div>`, [
      { label: (typeof t==='function'?t('cancel'):'Скасувати'), cls: 'btn-s', action: 'cancel' },
      { label: 'OK', cls: 'btn-p', action: 'confirm' }
    ]);
  }
};

/* ─── DOMAIN: LOAD ──────────────────────────────────────── */
