/** Профіль: світло і м’яч лишаються на картці, вібрація в такт удару. */
const ProfileFx = {
  BEATS: [
    [0, 'light'],
    [160, 'light'],
    [420, 'medium'],
    [700, 'success']
  ],
  _timers: [],
  _root: null,

  stop() {
    this._timers.forEach(id => clearTimeout(id));
    this._timers = [];
    this._clear(this._root);
    this._root = null;
    this._sweep();
  },

  play(root) {
    this.stop();
    if (!root || !root.classList) return 0;
    this._root = root;
    this._mount(root);
    root.classList.remove('pf3-on');
    try { void root.offsetWidth; } catch (_) {}
    root.classList.add('pf3');
    root.classList.add('pf3-on');
    const beats = this._reduced() ? [[0, 'light']] : this.BEATS;
    beats.forEach(beat => {
      const id = setTimeout(() => this._hit(beat[1]), beat[0]);
      this._timers.push(id);
    });
    return this._timers.length;
  },

  _reduced() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (_) { return false; }
  },

  _mount(root) {
    if (!root.querySelector) return;
    if (!root.querySelector('.pf3-stage')) {
      const stage = document.createElement('div');
      stage.className = 'pf3-stage';
      stage.setAttribute('aria-hidden', 'true');
      stage.innerHTML = '<div class="pf3-lamp pf3-lamp-l"></div><div class="pf3-lamp pf3-lamp-r"></div>';
      if (root.prepend) root.prepend(stage);
      else if (root.insertBefore && root.firstChild) root.insertBefore(stage, root.firstChild);
      else if (root.appendChild) root.appendChild(stage);
    }
    const faces = root.querySelectorAll ? root.querySelectorAll('.cc-photo, .cpc-photo') : [];
    Array.prototype.forEach.call(faces, face => this._dress(face));
  },

  _dress(face) {
    if (!face) return;
    if (face.parentNode && String(face.parentNode.className || '').indexOf('pf3-orbit') !== -1) return;
    if (!face.querySelector || !face.querySelector('.pf3-ring')) {
      const ring = document.createElement('span');
      ring.className = 'pf3-ring';
      ring.setAttribute('aria-hidden', 'true');
      if (face.appendChild) face.appendChild(ring);
    }
    const parent = face.parentNode;
    if (!parent || !parent.insertBefore) return;
    const orbit = document.createElement('span');
    orbit.className = 'pf3-orbit';
    parent.insertBefore(orbit, face);
    orbit.appendChild(face);
    const ball = document.createElement('span');
    ball.className = 'pf3-ball';
    ball.setAttribute('aria-hidden', 'true');
    ball.innerHTML = '<svg viewBox="0 0 64 64" width="36" height="36"><circle cx="32" cy="32" r="30" fill="#f7f7f7" stroke="#161616" stroke-width="2"/><path fill="#161616" d="M32 16.5l7.6 5.5-2.9 8.9H27.3l-2.9-8.9z"/><path fill="none" stroke="#161616" stroke-width="2" stroke-linejoin="round" d="M32 16.5l-4.6 2L23.2 12M32 16.5l4.6 2L40.8 12M24.4 22l-3.6 3.8-7.4-1M39.6 22l3.6 3.8 7.4-1M27.3 30.9L25 40.5l-7.6 1.2M36.7 30.9L39 40.5l7.6 1.2M25 40.5L32 48l7-7.5"/></svg>';
    orbit.appendChild(ball);
  },

  _clear(root) {
    if (!root || !root.querySelectorAll) return;
    root.classList.remove('pf3-on');
    root.classList.remove('pf3');
    Array.prototype.forEach.call(root.querySelectorAll('.pf3-stage'), node => {
      if (node.parentNode) node.parentNode.removeChild(node);
    });
    Array.prototype.forEach.call(root.querySelectorAll('.pf3-orbit'), orbit => {
      const face = orbit.querySelector && orbit.querySelector('.cc-photo, .cpc-photo');
      if (face && orbit.parentNode) orbit.parentNode.insertBefore(face, orbit);
      if (orbit.parentNode) orbit.parentNode.removeChild(orbit);
    });
    Array.prototype.forEach.call(root.querySelectorAll('.pf3-ring'), node => {
      if (node.parentNode) node.parentNode.removeChild(node);
    });
  },

  _sweep() {
    try {
      if (typeof document === 'undefined' || !document.querySelectorAll) return;
      Array.prototype.forEach.call(document.querySelectorAll('#modal > .pf3-stage, .coach-card-overlay > .pf3-stage, .pf3-pitch'), node => {
        if (node.parentNode) node.parentNode.removeChild(node);
      });
    } catch (_) {}
  },

  _hit(type) {
    try {
      const tg = typeof TelegramManager !== 'undefined' && TelegramManager.isTelegram && TelegramManager.tg && TelegramManager.tg.HapticFeedback;
      if (tg) {
        if (type === 'success' && TelegramManager.hapticSuccess) TelegramManager.hapticSuccess();
        else if (TelegramManager.haptic) TelegramManager.haptic(type);
        return;
      }
    } catch (_) {}
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        const ms = type === 'success' ? 28 : type === 'medium' ? 16 : 10;
        navigator.vibrate(ms);
      }
    } catch (_) {}
  }
};

if (typeof window !== 'undefined') window.ProfileFx = ProfileFx;
