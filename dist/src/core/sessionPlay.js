/** Серія, смуга складу і кадри пояснення. Явку ставить лише тренер. */
const SessionPlay = {
  SEALS: [3, 5, 8],

  todayKey() {
    try { if (typeof today === 'function') return today(); } catch (_) {}
    return new Date().toISOString().slice(0, 10);
  },

  cancelled(t) {
    if (!t) return true;
    if (t.status === 'cancelled' || t.status === 'canceled') return true;
    try {
      if (typeof LoadModel !== 'undefined' && LoadModel.isCancelled && LoadModel.isCancelled(t)) return true;
    } catch (_) {}
    return false;
  },

  sessionToday(state) {
    const s = state || (typeof Store !== 'undefined' && Store.get && Store.get()) || { trainings: [] };
    const day = this.todayKey();
    const list = (s.trainings || []).filter(t => t && t.date === day && !this.cancelled(t));
    return list.find(t => t.status === 'planned' || t.status === 'done') || list[0] || null;
  },

  me() {
    try {
      if (typeof AuthManager !== 'undefined' && AuthManager.getLinkedPlayer) return AuthManager.getLinkedPlayer();
    } catch (_) {}
    return null;
  },

  claim() {
    return { ok: false, reason: 'coach' };
  },

  meter(training, players) {
    const roster = (players || []).filter(p => p && p.status !== 'injured' && p.status !== 'rehab' && p.status !== 'recovery');
    const att = (training && training.attendance) || {};
    let here = 0;
    let stamps = 0;
    roster.forEach(p => {
      const cell = att[p.id];
      if (cell && cell.present === true) here++;
      if (cell && cell.claimed && cell.present !== true) stamps++;
    });
    return { here: here, total: roster.length, stamps: stamps, full: roster.length > 0 && here === roster.length };
  },

  seals(streak) {
    const n = Number(streak) || 0;
    return this.SEALS.filter(step => n >= step);
  },

  weekMarks(trainings, playerId) {
    const done = (trainings || []).filter(t => {
      if (typeof PlayerProgress !== 'undefined' && PlayerProgress.sessionCounts) return PlayerProgress.sessionCounts(t);
      return t && t.status === 'done' && !this.cancelled(t);
    });
    done.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    return done.slice(-7).map(t => {
      const cell = t.attendance && t.attendance[playerId];
      let mark = 'empty';
      if (cell && cell.present === true) mark = 'in';
      else if (cell && (cell.present === false || cell.present === 0)) mark = 'out';
      return { id: t.id, date: t.date || '', mark: mark };
    });
  },

  beatHtml(tr) {
    const beats = (tr && tr.beats) || [];
    if (!beats.length) {
      const coach = typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach();
      if (!coach || !tr || !tr.id) return '';
      return '<div class="beat-row"><button type="button" class="btn btn-s btn-sm" data-action="edit-beats" data-training-id="' + tr.id + '">Кадр пояснення</button></div>';
    }
    const idx = Math.max(0, Math.min(beats.length - 1, Number(tr.beatIndex) || 0));
    const b = beats[idx] || {};
    const esc = (v) => (typeof sanitize === 'function' ? sanitize(v || '') : String(v || ''));
    const coach = typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach();
    const controls = coach
      ? ('<div class="beat-controls">' +
        '<button type="button" class="btn btn-s btn-sm" data-action="session-beat-next" data-training-id="' + tr.id + '">Далі</button>' +
        '<button type="button" class="btn btn-s btn-sm" data-action="edit-beats" data-training-id="' + tr.id + '">Кадри</button></div>')
      : '';
    return '<div class="beat-card">' +
      '<div class="beat-kicker"><span class="beat-pulse" aria-hidden="true"></span>Кадр ' + (idx + 1) + ' / ' + beats.length + '</div>' +
      '<div class="beat-phrase">' + esc(b.phrase || 'Без фрази') + '</div>' +
      '<div class="beat-lines"><span>Мета: ' + esc(b.goal || '—') + '</span>' +
      '<span>Помилка: ' + esc(b.mistake || '—') + '</span>' +
      '<span>Сигнал: ' + esc(b.signal || '—') + '</span></div>' +
      controls + '</div>';
  },

  claimHtml() {
    return '';
  },

  meterHtml(state) {
    const s = state || (typeof Store !== 'undefined' && Store.get && Store.get()) || {};
    const tr = this.sessionToday(s);
    if (!tr) return '';
    const m = this.meter(tr, s.players || []);
    const full = m.full ? ' is-full' : '';
    return '<div class="pitch-meter' + full + '" data-training-id="' + tr.id + '">' +
      '<div class="pitch-meter-label">На полі ' + m.here + ' з ' + m.total + '</div>' +
      '<div class="pitch-meter-track"><i style="width:' + (m.total ? Math.round(m.here / m.total * 100) : 0) + '%"></i></div></div>';
  },

  sealHtml(playerId) {
    let streak = 0;
    try {
      if (typeof PlayerProgress !== 'undefined') streak = PlayerProgress.compute(playerId).streak || 0;
    } catch (_) {}
    const got = this.seals(streak);
    if (!got.length && streak < 1) return '';
    const marks = this.SEALS.map(step => {
      const on = got.indexOf(step) >= 0;
      return '<span class="seal-pip' + (on ? ' on' : '') + '">' + step + '</span>';
    }).join('');
    let bonus = '';
    try {
      if (typeof PlayerProgress !== 'undefined' && PlayerProgress.streakBonusXp) {
        const xp = PlayerProgress.streakBonusXp(streak);
        if (xp) bonus = '<span class="seal-bonus">+' + xp + ' XP</span>';
      }
    } catch (_) {}
    return '<div class="seal-row" title="Серія відвідувань, які позначив тренер"><span>Серія ' + streak + '</span>' + marks + bonus + '</div>';
  },

  slidesHtml(tr) {
    if (!tr || !tr.id) return '';
    const s = (typeof Store !== 'undefined' && Store.get && Store.get()) || { boards: [] };
    const boards = s.boards || [];
    const ids = Array.isArray(tr.slides) ? tr.slides : [];
    const esc = (v) => (typeof sanitize === 'function' ? sanitize(v || '') : String(v || ''));
    const coach = typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach();
    const slides = ids.map(id => {
      const board = boards.find(b => b && String(b.id) === String(id));
      if (!board) return '';
      const thumb = (typeof Views !== 'undefined' && Views._schemeThumbSvg) ? Views._schemeThumbSvg(board) : '📐';
      const title = esc(board.name || board.title || 'Схема');
      return '<button type="button" class="tr-slide" data-action="open-training-slide" data-training-id="' + tr.id + '" data-board-id="' + esc(board.id) + '">' +
        '<span class="tr-slide-thumb">' + thumb + '</span><span class="tr-slide-name">' + title + '</span></button>';
    }).join('');
    const add = coach
      ? '<button type="button" class="btn btn-s btn-sm tr-slide-add" data-action="edit-slides" data-training-id="' + tr.id + '">+ Схема</button>'
      : '';
    if (!slides && !add) return '';
    return '<div class="tr-slides"><div class="tr-slides-label">Слайди схем</div><div class="tr-slides-row">' + slides + add + '</div></div>';
  },

  weekHtml(playerId) {
    const s = (typeof Store !== 'undefined' && Store.get && Store.get()) || { trainings: [] };
    const marks = this.weekMarks(s.trainings, playerId);
    if (!marks.length) return '';
    const cells = marks.map(m => '<i class="week-cell week-' + m.mark + '" title="' + (m.date || '') + '"></i>').join('');
    return '<div class="week-strip" aria-label="Останні тренування">' + cells + '</div>';
  },

  nextBeat(training) {
    const beats = (training && training.beats) || [];
    if (!beats.length) return 0;
    const idx = Math.max(0, Number(training.beatIndex) || 0);
    training.beatIndex = (idx + 1) % beats.length;
    return training.beatIndex;
  },

  maybePack() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('sessionPack')) return;
    const me = this.me();
    if (!me) return;
    const s = (typeof Store !== 'undefined' && Store.get && Store.get()) || { trainings: [] };
    const done = (s.trainings || []).filter(t => {
      if (typeof PlayerProgress !== 'undefined' && PlayerProgress.sessionCounts) return PlayerProgress.sessionCounts(t);
      return t && t.status === 'done' && !this.cancelled(t);
    });
    done.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const tr = done.find(t => t.attendance && t.attendance[me.id] && t.attendance[me.id].present === true);
    if (!tr) return;
    let seen = '';
    try { seen = localStorage.getItem('ms_pack_seen') || ''; } catch (_) {}
    if (seen.split(',').indexOf(String(tr.id)) >= 0) return;
    const cell = tr.attendance[me.id];
    let streak = 0;
    try { streak = PlayerProgress.compute(me.id).streak || 0; } catch (_) {}
    const rpe = cell.rpe != null ? cell.rpe : (cell.intensity != null ? cell.intensity : '—');
    const role = me.position || 'гравець';
    const esc = (v) => (typeof sanitize === 'function' ? sanitize(v) : String(v));
    const ov = document.createElement('div');
    ov.id = 'sessionPack';
    ov.className = 'session-pack';
    ov.innerHTML = '<div class="session-pack-card" role="dialog" aria-label="Пак сесії">' +
      '<div class="beat-kicker">Пак сесії</div>' +
      '<div class="beat-phrase">' + esc(tr.name || 'Тренування') + '</div>' +
      '<div class="pack-stats"><span>Серія ' + streak + '</span><span>RPE ' + esc(rpe) + '</span><span>' + esc(role) + '</span></div>' +
      '<button type="button" class="btn btn-p" data-action="close-session-pack" data-training-id="' + esc(tr.id) + '">Забрати</button></div>';
    document.body.appendChild(ov);
  },

  closePack(trainingId) {
    let seen = '';
    try { seen = localStorage.getItem('ms_pack_seen') || ''; } catch (_) {}
    const ids = seen ? seen.split(',') : [];
    if (trainingId && ids.indexOf(String(trainingId)) < 0) ids.push(String(trainingId));
    try { localStorage.setItem('ms_pack_seen', ids.slice(-40).join(',')); } catch (_) {}
    const ov = typeof document !== 'undefined' && document.getElementById('sessionPack');
    if (ov) ov.remove();
  }
};
