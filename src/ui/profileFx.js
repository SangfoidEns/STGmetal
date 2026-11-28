/** Стадіонне відкриття профілю: прожектори, кільце, м’яч і вібрація в такт. */
const ProfileFx = {
  BEATS: [
    [0, 'light'],
    [150, 'light'],
    [300, 'medium'],
    [560, 'light'],
    [820, 'rigid'],
    [1080, 'heavy'],
    [1280, 'success']
  ],
  _timers: [],

  stop() {
    this._timers.forEach(id => clearTimeout(id));
    this._timers = [];
  },

  play(root) {
    this.stop();
    if (!root || !root.classList) return 0;
    this._mount(root);
    const reduce = this._reduced();
    root.classList.remove('pf3-on');
    try { void root.offsetWidth; } catch (_) {}
    root.classList.add('pf3');
    root.classList.add('pf3-on');
    const beats = reduce ? [[0, 'light']] : this.BEATS;
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
      stage.innerHTML = '<div class="pf3-lamp pf3-lamp-l"></div><div class="pf3-lamp pf3-lamp-r"></div><div class="pf3-pitch"></div><div class="pf3-ball"></div>';
      if (root.prepend) root.prepend(stage);
      else if (root.insertBefore && root.firstChild) root.insertBefore(stage, root.firstChild);
      else if (root.appendChild) root.appendChild(stage);
    }
    const faces = root.querySelectorAll ? root.querySelectorAll('.cc-photo, .cpc-photo') : [];
    Array.prototype.forEach.call(faces, face => {
      if (!face || face.querySelector('.pf3-ring')) return;
      const ring = document.createElement('span');
      ring.className = 'pf3-ring';
      ring.setAttribute('aria-hidden', 'true');
      if (face.appendChild) face.appendChild(ring);
    });
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
        const ms = (type === 'heavy' || type === 'success') ? 32 : (type === 'medium' || type === 'rigid') ? 18 : 10;
        navigator.vibrate(ms);
      }
    } catch (_) {}
  }
};

if (typeof window !== 'undefined') window.ProfileFx = ProfileFx;
