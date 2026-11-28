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
    ball.innerHTML = '<svg viewBox="0 0 64 64" width="36" height="36"><circle cx="32" cy="32" r="30" fill="#ffffff"/><polygon fill="#161616" points="32,21 38.6,25.8 36.1,34.2 27.9,34.2 25.4,25.8"/><polygon fill="#161616" points="32,7.5 37.4,12.2 34.6,18.8 29.4,18.8 26.6,12.2"/><polygon fill="#161616" points="54,22.4 50.2,28.8 43.2,27.4 41.6,21.2 47.2,16.4"/><polygon fill="#161616" points="47.6,49.2 40.6,46.6 38.8,39.8 44.4,35.2 51,39.4"/><polygon fill="#161616" points="16.4,49.2 13,39.4 19.6,35.2 25.2,39.8 23.4,46.6"/><polygon fill="#161616" points="10,22.4 16.8,16.4 22.4,21.2 20.8,27.4 13.8,28.8"/><circle cx="32" cy="32" r="30" fill="none" stroke="#161616" stroke-width="2.5"/></svg>';
    const bubble = document.createElement('span');
    bubble.className = 'pf3-bubble';
    bubble.setAttribute('aria-hidden', 'true');
    bubble.appendChild(ball);
    const spin = document.createElement('span');
    spin.className = 'pf3-spin';
    spin.setAttribute('aria-hidden', 'true');
    spin.appendChild(bubble);
    orbit.appendChild(spin);
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
