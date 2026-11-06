/** Extracted module: src/ui/views.js lines 1491-1818 — DO NOT rewrite business logic */
const Views = {
  APP_BUILD: 'z57',
  APP_UPDATED: '06.11.2026',
  VERSION_LETTERS: ['А', 'Б', 'В', 'Г', 'Ґ', 'Д', 'Е'],

  versionLetter(stamp) {
    const raw = String(stamp || this.APP_UPDATED || '');
    const parts = raw.split('.');
    const day = Number(parts[0]);
    const month = Number(parts[1]);
    const year = Number(parts[2]);
    const date = (parts.length === 3 && day && month && year)
      ? new Date(year, month - 1, day)
      : new Date(raw + 'T12:00:00');
    const idx = (date.getDay() + 6) % 7;
    return this.VERSION_LETTERS[idx] || 'А';
  },

  _buildLine() {
    return '<div class="app-build-tag">Оновлено ' + this.APP_UPDATED + ' · ' + this.versionLetter() + '</div>';
  },

  _gl(g) {
    try {
      if (g && typeof CoachTools !== 'undefined' && CoachTools.giftLabel) return CoachTools.giftLabel(g);
    } catch (_) {}
    return (g && g.label) || '';
  },

  _gh(g) {
    try {
      if (g && typeof CoachTools !== 'undefined' && CoachTools.giftHue) return CoachTools.giftHue(g);
    } catch (_) {}
    return (g && g.hue != null) ? g.hue : 42;
  },

  _heroPatternVars(gifts) {
    try {
      if (typeof CoachTools !== 'undefined' && CoachTools.homePatternVars) return CoachTools.homePatternVars(gifts);
    } catch (_) {}
    return '';
  },

  dashboard() {
    try {
      if (typeof AuthManager !== 'undefined') {
        try { AuthManager._resolveRole(); AuthManager._applyUiRole(); } catch (_) {}
        if (AuthManager.isPlayer()) {
          try {
            return this._playerHome();
          } catch (err) {
            console.error('[Views._playerHome]', err);
            return this._playerHomeFallback(err);
          }
        }
        if (AuthManager.isGuest()) {
          try { return this._guestHome(); } catch (e2) {
            console.error('[Views._guestHome]', e2);
          }
        }
        // тренер
        if (AuthManager.isCoach()) return this._coachHome();
      }
    } catch (e) {
      console.error('[Views.dashboard]', e);
    }
    // якщо Auth каже player, ніколи не показуємо тренерську головну
    try {
      if (typeof AuthManager !== 'undefined' && AuthManager.isPlayer()) {
        return this._playerHomeFallback();
      }
    } catch (_) {}
    return this._coachHome();
  },

  _playerHomeFallback(err) {
    const msg = err && (err.message || String(err)) ? String(err.message || err) : '';
    let me = null;
    try { me = AuthManager.getLinkedPlayer && AuthManager.getLinkedPlayer(); } catch (_) {}
    return `
      <div class="st">${t('team_title')} · МЕТАЛІСТ ШТУТТГАРТ</div>
      ${me ? this._fifaCard(me, {}) : this._noPlayerLink()}
      <div class="card glass">
        <div class="ct">${t('player_mode')}</div>
        <p class="note-sm">Картка та порівняння тимчасово обмежені.${msg ? ' (' + sanitize(msg) + ')' : ''}</p>
        <p class="note-sm">Попросіть тренера перевірити Telegram-нік у вашій анкеті та зробіть Імпорт JSON.</p>
        <button type="button" class="btn btn-s btn-sm" data-io="import" data-action="import-trigger">Імпорт JSON</button>
      </div>`;
  },


  _initials(name) {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    const letters = words.map((w) => {
      const m = w.match(/[A-Za-zА-Яа-яІіЇїЄєҐґ]/);
      return m ? m[0] : '';
    }).filter(Boolean);
    if (!letters.length) return 'МШ';
    if (letters.length === 1) return letters[0].toUpperCase();
    return (letters[0] + letters[letters.length - 1]).toUpperCase();
  },
  _cleanDisplayName(name) {
    return String(name || '')
      .replace(/[\u200B-\u200D\uFEFF\u2060\u00AD]/g, '')
      .replace(/[\uFE00-\uFE0F]/g, '')
      .replace(/[\u2600-\u27BF]/g, '')
      .replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  _posAccent(pos) {
    const p = String(pos || '').toUpperCase();
    if (p === 'GK' || p.includes('GK')) return { bg: 'linear-gradient(145deg,#f1c40f33,#f39c1222)', ring: '#f1c40f', label: 'GK' };
    if (/^CB|^LB|^RB|^LCB|^RCB|^WB|DEF/.test(p)) return { bg: 'linear-gradient(145deg,#3498db33,#2980b922)', ring: '#3498db', label: p };
    if (/^CM|^CDM|^CAM|^LM|^RM|^DM|MID/.test(p)) return { bg: 'linear-gradient(145deg,#2ecc7133,#27ae6022)', ring: '#2ecc71', label: p };
    if (/^ST|^CF|^LW|^RW|^SS|ATT|FW/.test(p)) return { bg: 'linear-gradient(145deg,#e74c3c33,#c0392b22)', ring: '#e74c3c', label: p };
    return { bg: 'linear-gradient(145deg,#9b59b633,#8e44ad22)', ring: '#e8c547', label: p || 'COACH' };
  },

  _attendanceGifts(attPct) {
    const n = Math.max(0, Math.min(12, Math.round((Number(attPct) || 0) / 100 * 12)));
    const pool = ['★','●','◆','✦','★','●','◆','✦','★','●','◆','✦'];
    return pool.slice(0, Math.max(3, n)); // мінімум 3 для естетики профілю
  },


  /** Telegram-style gifts: scatter around avatar (not on face), expand animation */

  _giftStrip(gifts) {
    const list = (gifts || []).filter(Boolean);
    if (!list.length) return '';
    const show = list.slice(0, 12);
    return '<div class="tg-gift-strip" aria-label="Подарунки">' +
      show.map(g => {
        const rar = g.rarity || 'common';
        const hue = this._gh(g);
        const title = sanitize((this._gl(g) || '') + (g.note ? (' — ' + g.note) : ''));
        const art = (typeof CoachTools !== 'undefined' && CoachTools.giftBackdropHtml)
          ? CoachTools.giftBackdropHtml(g, 'md')
          : ('<span class="nft-art-ico">' + (g.ico || '★') + '</span>');
        return '<button type="button" class="tg-gift-strip-item rarity-' + rar +
          '" style="--art-hue:' + hue + '" title="' + title +
          '" data-action="inspect-artifact" data-gift-uid="' + (g.id || '') +
          '" data-gift-id="' + (g.giftId || '') + '">' +
          art + '</button>';
      }).join('') +
      (list.length > 12 ? ('<span class="tg-gift-more">+' + (list.length - 12) + '</span>') : '') +
      '</div>';
  },

  _tgGiftCloud(gifts, radiusScale, mode) {
    // mode: 'full' | 'card' | 'right3' | 'mini3'
    // full/card: slow upright orbit. right3/mini3: fixed scatter.
    let list = (gifts || []).filter(Boolean);
    // Prefer attached; if none flagged, show all (legacy data)
    const attached = list.filter(g => g.attached !== false);
    if (attached.length) list = attached;
    if (!list.length) return '';
    const sc = radiusScale != null ? radiusScale : 1;
    const source = (gifts || []).filter(g => {
      if (!g || g.attached === false) return false;
      return String(g.ico || g.label || g.giftId || '').trim().length > 0;
    });
    if (!source.length) return '';
    let slots, take;
    if (mode === 'right3') {
      take = source.slice(0, 3);
      slots = [{ x: 52, y: -30 }, { x: 62, y: 6 }, { x: 50, y: 38 }];
    } else if (mode === 'mini3') {
      take = source.slice(0, 3);
      slots = [{ x: 36, y: -30 }, { x: 42, y: 4 }, { x: 34, y: 32 }];
    } else if (mode === 'card') {
      take = source.slice(0, 6);
      slots = [{ x: 0, y: 0 }];
    } else {
      take = source.slice(0, 8);
      slots = [
        { x: -96, y: -48 }, { x: 100, y: -44 }, { x: -92, y: 54 },
        { x: 94, y: 58 }, { x: -40, y: -92 }, { x: 44, y: -94 },
        { x: -112, y: 6 }, { x: 116, y: 10 }, { x: -72, y: -76 },
        { x: 76, y: 82 }
      ];
    }
    const items = take.map((g, i) => {
      const s = slots[i % slots.length];
      const x = (s.x * sc);
      const y = (s.y * sc);
      const rar = g.rarity || 'common';
      const hue = this._gh(g);
      const title = sanitize((this._gl(g) || '') + (g.serial ? (' · ' + g.serial) : '') + (g.note ? (' — ' + g.note) : ''));
      let special = '';
      if (g.special === 'neural-horse' || g.giftId === 'neural_horse_tester') special = ' art-neural-horse';
      else if (g.special === 'golden-ball' || g.giftId === 'tyshchenko_first_golden_ball') special = ' art-golden-ball';
      else if (g.special === 'crest-seal' || g.giftId === 'grok_crest_seal_2025') special = ' art-crest-seal';
      else if (g.special) special = ' art-' + String(g.special).replace(/[^a-z0-9-]/gi, '');
      // Inline transform as hard fallback (works even if CSS vars fail)
      const artSize = (mode === 'mini3' || mode === 'right3' || mode === 'card') ? 'sm' : 'md';
      const art = (typeof CoachTools !== 'undefined' && CoachTools.giftBackdropHtml)
        ? CoachTools.giftBackdropHtml(g, artSize)
        : ('<span class="nft-art-ico">' + (g.ico || '★') + '</span>');
      const item = '<span class="tg-gift-item nft-art rarity-' + rar + special + ' anim-' + (g.anim || 'float') +
        '" style="--gx:' + x.toFixed(1) + 'px;--gy:' + y.toFixed(1) + 'px;--gi:' + i +
        ';--art-hue:' + hue + ';--art-pattern:' + (g.pattern || 1) +
        ';transform:translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(1);opacity:1;visibility:visible"' +
        ' title="' + title +
        '" data-gift-id="' + (g.giftId || '') + '" data-action="inspect-artifact" data-gift-uid="' + (g.uid || g.id || '') + '">' +
        art + '</span>';
      if ((mode || 'full') === 'full' || mode === 'card') {
        return '<span class="tg-gift-spin" style="--i:' + i + ';--n:' + take.length + '"><span class="tg-gift-counter">' + item + '</span></span>';
      }
      return item;
    }).join('');
    return '<div class="tg-gift-cloud tg-gift-expand mode-' + (mode || 'full') +
      '" aria-hidden="false" style="opacity:1;visibility:visible;pointer-events:none">' + items + '</div>';
  },

  /** Status chip near name — featured artifact only (Telegram-style) */
  _giftStatusBadge(gifts, playerId) {
    let featured = null;
    try {
      if (typeof CoachTools !== 'undefined' && CoachTools.ensureWornGift && playerId) {
        featured = CoachTools.ensureWornGift(playerId);
      }
    } catch (_) {}
    if (!featured && gifts && gifts.length) {
      featured = gifts.find(g => g.featured) || null;
    }
    if (!featured) return '';
    const art = (typeof CoachTools !== 'undefined' && CoachTools.giftBackdropHtml)
      ? CoachTools.giftBackdropHtml(featured, 'sm')
      : ('<span class="gsb-ico">' + (featured.ico || '★') + '</span>');
    return '<span class="gift-status-badge rarity-' + (featured.rarity || 'common') +
      '" style="--art-hue:' + this._gh(featured) + '" title="' +
      sanitize(this._gl(featured) || '') + '">' + art + '</span>';
  },


  _coachSquadCard() {
    const s = Store.get();
    const set = s.settings || {};
    // Картка тренера ЗАВЖДИ з налаштувань клубу — НЕ з сесії поточного гравця
    let name = (set.coachName && String(set.coachName).trim()) || 'Artem Serdiuk';
    let photo = set.coachPhoto || set.coachPhotoUrl || '';
    try {
      // Фото з Telegram — лише якщо поточний користувач реально тренер
      const isCoachSession = typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach();
      if (!photo && isCoachSession && typeof TelegramManager !== 'undefined' && TelegramManager.getUser) {
        const u = TelegramManager.getUser();
        if (u && u.photo_url) photo = u.photo_url;
      }
    } catch (_) {}
    const ach = (typeof CoachTools !== 'undefined' && CoachTools.getCoachAchievements)
      ? CoachTools.getCoachAchievements()
      : { attendancePct: 100, appMs: 0, boardMs: 0, trainingsDone: 0, boards: 0 };
    const fmt = (ms) => {
      if (!ms) return '0хв';
      const m = Math.round(ms / 60000);
      if (m < 60) return m + 'хв';
      return (Math.round(m / 6) / 10) + 'г';
    };
    const initials = (name || 'AS').split(/\s+/).map(p => p[0] || '').join('').slice(0, 2).toUpperCase();
    const ph = photo
      ? '<img src="' + sanitize(photo) + '" alt="" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'"/>'
      : '<span class="cp-avatar-ph">' + sanitize(initials) + '</span>';
    return '<div class="pl-card glass coach-squad-card is-coach" data-action="open-coach-card" role="button" tabindex="0">' +
      '<div class="pl-card-av-wrap"><div class="pl-card-av coach-av" style="border-color:#f0c14b;background:linear-gradient(145deg,#3d2e0a,#1a1408)">' + ph + '</div></div>' +
      '<div class="pl-card-body">' +
      '<div class="pl-card-name">★ ' + sanitize(name) + '</div>' +
      '<div class="pl-card-meta">' + (typeof t==='function'?t('head_coach','Головний тренер'):'Головний тренер') + ' · METALIST</div>' +
      '<div class="pl-card-att">' + (typeof I18n!=='undefined'?I18n.t('attendance','Відвідуваність'):'Відвідуваність') + ' ' + (ach.attendancePct || 0) + '%</div>' +
      '<div class="coach-mini-stats">' +
        '<span title="У додатку">📱 ' + fmt(ach.appMs) + '</span>' +
        '<span title="На дошці">⚽ ' + fmt(ach.boardMs) + '</span>' +
        '<span title="Проведено">✓ ' + (ach.trainingsDone || 0) + '</span>' +
        '<span title="Схеми">📋 ' + (ach.boards || 0) + '</span>' +
      '</div></div></div>';
  },

  _profilePersonCard() {
    const s = Store.get();
    let person = null;
    let kind = 'coach';
    try {
      if (typeof AuthManager !== 'undefined') {
        if (AuthManager.isPlayer && AuthManager.isPlayer()) {
          person = AuthManager.getLinkedPlayer && AuthManager.getLinkedPlayer();
          kind = 'player';
        }
      }
    } catch (_) {}
    if (!person && kind === 'coach') {
      // тренер: з TG user або settings
      let photo = '';
      let name = (s.settings && s.settings.coachName && String(s.settings.coachName).trim()) || '';
      try {
        const inTelegram = typeof AuthManager !== 'undefined' && AuthManager.user;
        if (!name && inTelegram) name = AuthManager.displayName() || '';
        if (!name) name = 'Artem Serdiuk';
        if (typeof TelegramManager !== 'undefined') {
          const u = TelegramManager.getUser && TelegramManager.getUser();
          if (u && u.photo_url) photo = u.photo_url;
          if (u && (u.first_name || u.last_name)) name = [u.first_name, u.last_name].filter(Boolean).join(' ');
        }
      } catch (_) {}
      // coach photo from settings if uploaded
      try {
        if (s.settings && s.settings.coachPhoto) photo = s.settings.coachPhoto;
      } catch (_) {}
      const gifts = [];
      const acc = this._posAccent('COACH');
      return { kind: 'coach', name: this._cleanDisplayName(name), photo, pos: 'ГОЛОВНИЙ ТРЕНЕР', accent: acc, gifts, attPct: 85, initials: this._initials(name) };
    }
    if (person) {
      const photo = this._resolvePlayerAvatar(person) || person.photoUrl || '';
      const name = [person.firstName, person.lastName].filter(Boolean).join(' ') || person.name || 'Гравець';
      let attPct = 70;
      try {
        if (typeof LoadModel !== 'undefined' && LoadModel.attendanceRate) {
          attPct = LoadModel.attendanceRate(s.trainings, person.id) || 0;
        }
      } catch (_) {}
      let gifts = [];
      try {
        if (typeof CoachTools !== 'undefined' && CoachTools.playerGifts) {
          gifts = CoachTools.playerGifts(person.id) || [];
        } else {
          gifts = (s.gifts || []).filter(g => g.playerId === person.id);
        }
      } catch (_) {}
      const acc = this._posAccent(person.position);
      return { kind: 'player', name: this._cleanDisplayName(name), photo, pos: person.position || '—', accent: acc, gifts, attPct, player: person, initials: this._initials(name) };
    }
    return null;
  },


  /** SVG sparkline for dashboard / analytics */
  _sparkline(values, opts) {
    opts = opts || {};
    const w = opts.w || 120, h = opts.h || 36;
    const vals = (values || []).map(Number).filter(v => !isNaN(v));
    if (vals.length < 2) {
      return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><text x="4" y="' + (h/2+4) + '" fill="rgba(255,255,255,.35)" font-size="10">—</text></svg>';
    }
    const min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    const span = (max - min) || 1;
    const pts = vals.map(function (v, i) {
      const x = (i / (vals.length - 1)) * (w - 4) + 2;
      const y = h - 4 - ((v - min) / span) * (h - 8);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    const stroke = opts.color || '#f5c542';
    const fill = opts.fill || 'rgba(245,197,66,.15)';
    const last = pts.split(' ').pop().split(',');
    const area = '2,' + h + ' ' + pts + ' ' + (w - 2) + ',' + h;
    return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
      '<polygon points="' + area + '" fill="' + fill + '"/>' +
      '<polyline points="' + pts + '" fill="none" stroke="' + stroke + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.5" fill="' + stroke + '"/>' +
      '</svg>';
  },

  _coachHome() {
    const s = Store.get();
    const avail = s.players.filter(p => p.status === 'available' || p.status === 'healthy' || !p.status).length;
    const injured = s.players.filter(p => p.status === 'injured' || p.status === 'recovery' || p.status === 'rehab').length;
    const next = s.trainings.filter(t => t.status === 'planned' && t.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
    const weekLoad = LoadModel.weeklyLoad(s.trainings);
    const pastForStats = (typeof LoadModel !== 'undefined' && LoadModel.pastTrainings)
      ? LoadModel.pastTrainings(s.trainings) : s.trainings.filter(t => t.date && t.date <= today() && t.status !== 'cancelled');
    const totalHours = Math.round(pastForStats.reduce((a, t) => a + (t.duration || 0), 0) / 60 * 10) / 10;
    const totalMin = pastForStats.reduce((a, t) => a + (t.duration || 0), 0);
    const nextMatch = s.matches.filter(m => m.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
    const recent = s.trainings.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 6);
    const drafts = s.trainings.filter(t => t.status === 'draft' || t.status === 'pinned');
    const boardCount = (s.boards || []).length;
    // Graphs for coach home cards
    const pastSorted = pastForStats.slice().sort((a, b) => String(a.date||'').localeCompare(String(b.date||'')));
    const last14 = pastSorted.slice(-14);
    const minByDay = last14.map(t => t.duration || 0);
    const loadBySession = pastSorted.slice(-8).map(t => {
      try { return (typeof LoadModel !== 'undefined' && LoadModel.sessionLoad) ? LoadModel.sessionLoad(t.duration, t.intensity) : ((t.duration||0)*(t.intensity||0)); } catch(_) { return 0; }
    });
    const last3Load = loadBySession.slice(-3);
    const avg3 = last3Load.length ? Math.round(last3Load.reduce((a,b)=>a+b,0)/last3Load.length) : 0;
    const recentBoards = (s.boards || []).slice().sort((a,b)=>String(b.createdAt||b.updatedAt||'').localeCompare(String(a.createdAt||a.updatedAt||''))).slice(0, 3);
    const teamXpByDay = (() => {
      const map = {};
      pastSorted.slice(-14).forEach(tr => {
        const d = tr.date || '';
        if (!d) return;
        let xp = 0;
        const att = tr.attendance || {};
        Object.keys(att).forEach(pid => {
          const a = att[pid];
          if (a && a.present !== false) xp += 18; else if (a) xp += -6;
        });
        map[d] = (map[d] || 0) + Math.max(0, xp);
      });
      return Object.keys(map).sort().map(k => map[k]);
    })();
    const startersCount = (s.players||[]).filter(p => {
      const g = String(p.group||p.squadRole||'').toLowerCase();
      return !(g === 'reserve' || g === 'bench') && p.status !== 'injured' && p.status !== 'rehab';
    }).length;

    const club = (s.settings && s.settings.clubName) || 'МЕТАЛІСТ ШТУТТГАРТ';
    const short = (s.settings && s.settings.clubShort) || 'МШ';
    const logo = (s.settings && s.settings.logoData) || '';
    const coachName = (typeof AuthManager !== 'undefined' && AuthManager.displayName)
      ? AuthManager.displayName() : 'Artem Serdiuk';
    const coachRole = (typeof AuthManager !== 'undefined' && AuthManager.roleLabel)
      ? AuthManager.roleLabel() : 'Тренер';

    const matchHtml = nextMatch ? `
      <div class="cp-match">
        <div class="cp-match-teams">
          <span class="cp-match-us">${sanitize(short)}</span>
          <span class="cp-match-vs">VS</span>
          <span class="cp-match-them">${sanitize(nextMatch.opponent || t('opponent','Суперник'))}</span>
        </div>
        <div class="cp-match-meta">${sanitize(nextMatch.date || '')}${nextMatch.time ? ' · ' + sanitize(nextMatch.time) : ''}</div>
      </div>` : `<div class="cp-match is-empty">${t('next_match_none','Наступний матч не заплановано')}</div>`;

    const statusLabel = next
      ? ('Наступне: ' + (next.name || 'Тренування') + (next.date ? ' · ' + next.date : ''))
      : 'Немає запланованих тренувань';

    const coachXp = (typeof CoachTools !== 'undefined' && CoachTools.coachProgress) ? CoachTools.coachProgress() : null;
    return `
      <div class="club-profile">
        ${this._buildLine()}

        <!-- Telegram-style profile card (coach/player) -->
        ${(() => {
          const pc = this._profilePersonCard();
          if (!pc) return '';
          const avAction = pc.photo
            ? 'data-action="open-photo"'
            : (pc.kind === 'coach'
              ? 'data-action="open-default-board"'
              : (pc.player && pc.player.id ? ('data-action="open-fifa-card" data-player-id="' + pc.player.id + '"') : ''));
          const ph = pc.photo
            ? `<img src="${sanitize(pc.photo)}" alt="" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='flex')"/><span class="cp-avatar-ph" style="display:none">${sanitize(pc.initials || '??')}</span>`
            : `<span class="cp-avatar-ph">${sanitize(pc.initials || '??')}</span>`;
          return `
        <div class="cp-hero cp-person cp-clean" style="--pos-bg:${pc.accent.bg};--pos-ring:${pc.accent.ring};">
          <div class="cp-avatar-wrap">
            <button type="button" class="cp-avatar" ${avAction}
              title="${pc.photo ? 'Фото на весь екран' : (pc.kind === 'coach' ? 'Дошка' : 'FIFA-картка')}"
              style="border-color:var(--pos-ring);background:var(--pos-bg)">
              ${ph}
            </button>
            ${this._tgGiftCloud((pc.gifts || []).filter(g => g && !g.featured), 1.15, 'full')}
          </div>
          ${this._giftStrip(pc.gifts)}
          <div class="cp-role-line"><span class="cp-role-kind">${pc.kind === 'coach' ? 'Тренер' : 'Гравець'}</span></div>
          <h1 class="cp-title cp-title-name">${sanitize(pc.name)}${this._giftStatusBadge(pc.gifts)}</h1>
          <div class="cp-role-badge" ${pc.kind === 'coach' ? 'data-action="coach-easter" role="button" title="Утримуйте 1с · картка тренера"' : ''} style="border-color:var(--pos-ring);color:var(--pos-ring);cursor:${pc.kind === 'coach' ? 'pointer' : 'default'}">${sanitize(pc.pos)}</div>
          <div class="cp-club-line cp-club-brand"><span class="cp-brand-a">Металіст</span> <span class="cp-brand-b">Штуттгарт</span></div>
          <div class="cp-status">
            <span class="cp-dot"></span>
            ${pc.kind === 'player'
              ? ((typeof I18n!=='undefined'?I18n.t('attendance','Відвідуваність'):'Відвідуваність') + ' ' + Math.round(pc.attPct || 0) + '% · тап по фото → FIFA')
              : sanitize(statusLabel)}
          </div>
        </div>`;
        })()}

        ${coachXp ? `
        <section class="coach-xp glass">
          <div class="coach-xp-head"><span>Досвід тренера</span><b>LVL ${coachXp.level}</b></div>
          <div class="soc-xp-bar"><div class="soc-xp-fill" style="width:${coachXp.levelProgress}%"></div></div>
          <div class="soc-xp-sub">${coachXp.xp} XP · до LVL ${coachXp.level + 1}: ${coachXp.xpToNext}</div>
          <div class="coach-xp-meta">Рівень як середній по складу · ${coachXp.players || 0} гравців · сер. LVL ${coachXp.avgLevel || coachXp.level}</div>
          <div class="coach-grow-title">Ріст команди</div>
          <div class="coach-grow-sub">${coachXp.sessions} сесій · середня явка ${coachXp.avgAtt}% · XP гравців ${coachXp.teamXp}</div>
          <div class="cp-stat-spark">${this._sparkline(coachXp.attSeries, { color: '#e8c547', fill: 'rgba(232,197,71,.16)' })}</div>
        </section>` : ''}

        <!-- Quick pills -->
        <div class="cp-pills">
          <button type="button" class="cp-pill cp-pill-p" data-action="new-training">+ ${t('new_training')}</button>
          <button type="button" class="cp-pill" data-view="tactics">${t('schemes')}</button>
          <button type="button" class="cp-pill" data-view="players">${t('squad_title')}</button>
          <button type="button" class="cp-pill" data-view="analytics">${t('stats')}</button>
        </div>

        <!-- Stats glass grid -->
        <div class="cp-stats cp-stats-v2">
          <button type="button" class="cp-stat sc-tap cp-stat-action" data-action="open-lineup-board" title="Дошка · основа 3-1-2-2-1-1">
            <span class="cp-stat-ic">👥</span>
            <span class="cp-stat-val">${avail}</span>
            <span class="cp-stat-lb">${t('players_available')}</span>
            <span class="cp-stat-sub">${startersCount} в строю · ${injured} лазарет</span>
            <span class="cp-stat-hint">тап → дошка основи</span>
          </button>
          <div class="cp-stat cp-stat-chart">
            <span class="cp-stat-ic">⏱</span>
            <span class="cp-stat-val">${totalMin || 0}</span>
            <span class="cp-stat-lb">хв загалом</span>
            <span class="cp-stat-sub">${pastForStats.length} тренувань</span>
            <div class="cp-stat-spark">${this._sparkline(minByDay, { color: '#7cf0c0', fill: 'rgba(124,240,192,.12)' })}</div>
          </div>
          <div class="cp-stat cp-stat-chart">
            <span class="cp-stat-ic">📊</span>
            <span class="cp-stat-val">${weekLoad || 0}</span>
            <span class="cp-stat-lb">Тижневе навантаження</span>
            <span class="cp-stat-sub">сер. 3 сесії: ${avg3} · LOAD = хв × RPE</span>
            <div class="cp-stat-spark">${this._sparkline(loadBySession, { color: '#3d7eff', fill: 'rgba(61,126,255,.12)' })}</div>
          </div>
          <div class="cp-stat cp-stat-chart">
            <span class="cp-stat-ic">✨</span>
            <span class="cp-stat-val">${teamXpByDay.length ? teamXpByDay[teamXpByDay.length-1] : 0}</span>
            <span class="cp-stat-lb">XP команди</span>
            <span class="cp-stat-sub">за останні дні</span>
            <div class="cp-stat-spark">${this._sparkline(teamXpByDay, { color: '#f5c542', fill: 'rgba(245,197,66,.15)' })}</div>
          </div>
          <div class="cp-stat cp-stat-wide">
            <span class="cp-stat-ic">📅</span>
            <span class="cp-stat-lb">${t('next_match')}</span>
            ${matchHtml}
          </div>
          <button type="button" class="cp-stat sc-tap cp-stat-action" data-view="tactics">
            <span class="cp-stat-ic">🗂</span>
            <span class="cp-stat-val">${boardCount}</span>
            <span class="cp-stat-lb">${t('schemes')}</span>
            <span class="cp-stat-sub">${recentBoards.map(b => sanitize((b.name||'Схема').slice(0,18))).join(' · ') || t('saved_boards')}</span>
          </button>
        </div>

        <!-- Coach tools (collapse) -->
        <div class="coach-tools-collapse glass cp-block" id="coachToolsCollapse">
          <button type="button" class="coach-tools-handle" data-action="toggle-coach-tools" aria-expanded="false">
            <span>🛠 ${t('tools_coach')}</span>
            <span class="note-sm">${t('tools_hint')}</span>
          </button>
          <div class="coach-tools-body" hidden>
            ${typeof CoachTools !== 'undefined' && CoachTools.panelHtml ? CoachTools.panelHtml() : ''}
          </div>
        </div>

        <!-- Recent trainings -->
        <div class="cp-section">
          <div class="cp-sec-head">
            <h2>${t('recent_trainings')}</h2>
            <button type="button" class="cp-link" data-view="trainings">${t('view_all')}</button>
          </div>
          <div class="cp-list">
            ${recent.length ? recent.map(t => {
              const st = t.status || 'planned';
              const stClass = st === 'cancelled' || st === 'canceled' ? 'is-cancel' : (st === 'done' || st === 'completed' ? 'is-done' : (st === 'draft' ? 'is-draft' : ''));
              return `<div class="cp-row card-training tg-row ${stClass}" data-training-id="${t.id}">
                <div class="cp-row-main">
                  <div class="cp-row-title">${sanitize(t.name || (typeof I18n!=='undefined'?I18n.t('training_word','Тренування'):'Тренування'))}</div>
                  <div class="cp-row-meta">${sanitize(t.date || '')} · ${t.duration || 0}${(typeof I18n!=='undefined'?I18n.t('min_short','хв'):'хв')} · ${sanitize(st)}</div>
                </div>
                <button type="button" class="cp-row-btn coach-only" data-edit-training="${t.id}">${(typeof I18n!=='undefined'?I18n.t('open','Відкрити'):'Відкрити')}</button>
              </div>`;
            }).join('') : '<div class="cp-empty">' + t('no_trainings') + '</div>'}
          </div>
        </div>

        ${drafts.length ? `
        <div class="cp-section coach-only">
          <div class="cp-sec-head"><h2>${t('drafts_pinned')}</h2></div>
          <div class="cp-list">
            ${drafts.map(t => `<div class="cp-row card-training tg-row" data-training-id="${t.id}">
              <div class="cp-row-main">
                <div class="cp-row-title">${sanitize(t.name || 'Чернетка')}</div>
                <div class="cp-row-meta"><span class="badge b-i">${sanitize(t.status)}</span></div>
              </div>
              <button type="button" class="cp-row-btn" data-edit-training="${t.id}">${(typeof I18n!=='undefined'?I18n.t('open','Відкрити'):'Відкрити')}</button>
            </div>`).join('')}
          </div>
        </div>` : ''}

        ${next ? `
        <div class="cp-section">
          <div class="cp-sec-head"><h2>Наступне тренування</h2></div>
          <div class="cp-row sc-next-training" data-next-training="${next.id}" role="button">
            <div class="cp-row-main">
              <div class="cp-row-title">${sanitize(next.name)}</div>
              <div class="cp-row-meta">${sanitize(next.date || '')}${next.time ? ' · ' + sanitize(next.time) : ''} · утримайте для плану</div>
            </div>
          </div>
        </div>` : ''}
      </div>`;
  },

  /** FIFA + iOS Glass картка гравця */
  _resolvePlayerAvatar(p) {
    if (!p) return '';
    if (p.profilePhoto) return p.profilePhoto;
    if (p.telegramPhotoUrl) return p.telegramPhotoUrl;
    if (p.photoUrl) return p.photoUrl;
    try {
      if (typeof AuthManager !== 'undefined' && AuthManager.getLinkedPlayer) {
        const me = AuthManager.getLinkedPlayer();
        if (me && me.id === p.id && typeof TelegramManager !== 'undefined') {
          const url = TelegramManager.getUserPhotoUrl && TelegramManager.getUserPhotoUrl();
          if (url) return url;
        }
      }
      // якщо нік збігається з поточним TG-користувачем
      if (typeof TelegramManager !== 'undefined' && TelegramManager.getUser) {
        const u = TelegramManager.getUser();
        if (u && u.photo_url && p.telegramUsername) {
          const a = String(p.telegramUsername).replace(/^@/, '').toLowerCase();
          const b = String(u.username || '').replace(/^@/, '').toLowerCase();
          if (a && b && a === b) return u.photo_url;
        }
        if (u && u.photo_url && p.telegramId && String(p.telegramId) === String(u.id)) {
          return u.photo_url;
        }
      }
    } catch (_) {}
    return '';
  },


  /** Telegram-style gift positions: irregular slots around avatar, outside the face */
  _giftSlots(n, radius) {
    const R = radius || 52;
    // fixed aesthetic slots (not perfect circle), order fills first
    const slots = [
      { a: -70, r: 1.05 }, { a: -20, r: 1.12 }, { a: 30, r: 1.08 },
      { a: 80, r: 1.15 }, { a: 140, r: 1.06 }, { a: 190, r: 1.14 },
      { a: 230, r: 1.10 }, { a: 280, r: 1.12 }
    ];
    const out = [];
    for (let i = 0; i < Math.min(n, slots.length); i++) {
      const s = slots[i];
      const rad = (s.a * Math.PI) / 180;
      out.push({
        x: Math.cos(rad) * R * s.r,
        y: Math.sin(rad) * R * s.r,
        i
      });
    }
    return out;
  },
  _renderGiftOrbit(gifts, radius) {
    if (!gifts || !gifts.length) return '';
    const list = gifts.slice(0, 8);
    const slots = this._giftSlots(list.length, radius || 52);
    return '<div class="tg-gift-orbit" aria-hidden="true">' + list.map((g, i) => {
      const s = slots[i] || { x: 0, y: 0, i };
      return '<span class="tg-gift" style="--gx:' + s.x.toFixed(1) + 'px;--gy:' + s.y.toFixed(1) + 'px;--gi:' + i + '" title="' +
        (typeof sanitize === 'function' ? sanitize(this._gl(g) || '') : (this._gl(g) || '')) +
        (g.note ? (' — ' + (typeof sanitize === 'function' ? sanitize(g.note) : g.note)) : '') +
        '">' + (g.ico || '★') + '</span>';
    }).join('') + '</div>';
  },
  _renderGiftStatus(gifts) {
    if (!gifts || !gifts.length) return '';
    // compact status chips next to name (not on name text itself)
    return '<span class="tg-gift-status">' + gifts.slice(0, 4).map(g =>
      '<span class="tg-gift-badge" title="' + (typeof sanitize === 'function' ? sanitize(this._gl(g) || '') : (this._gl(g) || '')) + '">' + (g.ico || '★') + '</span>'
    ).join('') + '</span>';
  },


  _playerGiftStyle(playerId) {
    try {
      if (typeof CoachTools !== 'undefined' && CoachTools.ensureWornGift && CoachTools.giftAccent) {
        const g = CoachTools.ensureWornGift(playerId);
        const a = CoachTools.giftAccent(g);
        return {
          ring: a.ring || '#c8a84b',
          bg: a.bg || 'rgba(255,255,255,0.04)',
          border: a.border || a.ring || 'rgba(200,168,75,0.4)',
          hue: a.hue != null ? a.hue : 42
        };
      }
    } catch (_) {}
    return { ring: '#c8a84b', bg: 'rgba(255,255,255,0.04)', border: 'rgba(200,168,75,0.35)', hue: 42 };
  },

  _playerStoriesStrip(playerId) {
    const s = Store.get();
    let gifts = [];
    try {
      if (typeof CoachTools !== 'undefined' && CoachTools.playerGifts)
        gifts = (CoachTools.playerGifts(playerId) || []).filter(g => g.attached !== false);
    } catch (_) {}
    // moments: gifts with note / momentHint first
    const stories = gifts.slice().sort((a, b) => {
      const am = (a.note || a.momentHint) ? 0 : 1;
      const bm = (b.note || b.momentHint) ? 0 : 1;
      if (am !== bm) return am - bm;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    }).slice(0, 12);
    if (!stories.length) {
      return '<div class="stories-strip empty"><span class="note-sm">Поки немає сторіз — подарунки з’являться тут</span></div>';
    }
    return '<div class="stories-strip" role="list">' + stories.map((g, i) => {
      const rar = g.rarity || 'common';
      const label = sanitize(this._gl(g) || 'Артефакт');
      const note = sanitize((g.note || g.momentHint || '').slice(0, 80));
      const art = (typeof CoachTools !== 'undefined' && CoachTools.giftBackdropHtml)
        ? CoachTools.giftBackdropHtml(g, 'md')
        : ('<span class="story-ring-inner">' + (g.ico || '★') + '</span>');
      return '<button type="button" class="story-ring rarity-' + rar + '" data-action="inspect-artifact" data-gift-uid="' + (g.uid || g.id || '') + '" role="listitem" title="' + label + '">' +
        '<span class="story-ring-inner story-ring-art">' + art + '</span>' +
        '<span class="story-ring-label">' + label + '</span>' +
        (note ? ('<span class="story-ring-note">' + note + '</span>') : '') +
        '</button>';
    }).join('') + '</div>';
  },

  _playerProfileCard(p) {
    if (!p) return '';
    let owned = [];
    try { owned = (Store.get().gifts || []).filter(g => g && String(g.playerId) === String(p.id)); } catch (_) {}
    const featured = owned.find(g => g.featured) || owned.find(g => g.attached !== false) || null;
    const acc = (typeof CoachTools !== 'undefined' && CoachTools.giftAccent) ? CoachTools.giftAccent(featured) : { ring: '#c8a84b', bg: '#1a1408' };
    const gs = acc;
    const photo = this._resolvePlayerAvatar ? this._resolvePlayerAvatar(p) : (p.photo || p.profilePhoto || '');
    const initials = ((p.firstName||'')[0]||'') + ((p.lastName||'')[0]||'');
    const xp = (typeof CoachTools !== 'undefined' && CoachTools.playerXpTotal) ? CoachTools.playerXpTotal(p.id) : 0;
    const lvl = Math.max(1, Math.floor(xp / 100) + 1);
    const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Гравець';
    const status = (p.profile && p.profile.status) || p.statusText || '';
    const bio = (p.profile && p.profile.bio) || p.bio || '';
    const badge = this._giftStatusBadge(owned);
    const ph = photo
      ? '<img src="' + sanitize(photo) + '" alt="" referrerpolicy="no-referrer"/>'
      : '<span>' + sanitize(initials.toUpperCase()) + '</span>';
    const stories = (typeof this._playerStoriesStrip === 'function') ? this._playerStoriesStrip(p.id) : '';
    const pat = this._playerPatternStyle ? this._playerPatternStyle(p) : '';
    const bd = this._playerBackdrop ? this._playerBackdrop(p) : { className: '', style: pat };
    return '<div class="player-profile-sheet profile-tinted ' + (bd.className || '') + '" style="' + (bd.style || pat) + 'border-color:' + (gs.ring || acc.ring) + '">' +
      '<button type="button" class="pps-account" data-action="open-fifa-card" data-player-id="' + p.id + '">' +
      '<span class="pps-avatar" data-action="open-fifa-card" data-player-id="' + p.id + '" style="border-color:' + (gs.ring || acc.ring) + ';background:' + (gs.bg || acc.bg) + '">' + ph + '</span>' +
      '<span class="pps-name">#' + (p.number||'—') + ' ' + sanitize(name) + ' ' + badge + '</span>' +
      '<span class="pps-meta">' + sanitize(p.position||'') + ' · LVL ' + lvl + ' · ' + xp + ' XP</span>' +
      '<span class="pps-tap-hint">Тап — картка гравця</span>' +
      '</button>' +
      this._accountProgress(p.id) +
      (status ? ('<div class="pps-status">' + sanitize(status) + '</div>') : '') +
      (bio ? ('<div class="pps-bio">' + sanitize(bio) + '</div>') : '') +
      '<div class="pps-actions">' +
        '<button type="button" class="btn btn-s btn-sm" data-action="open-player-gifts" data-player-id="' + p.id + '">🎁 Подарунки</button>' +
      '</div>' +
      '<div class="pps-stories-title">Сторіз футболіста</div>' +
      stories +
      '</div>';
  },
  _fifaCard(p, stats) {
    if (!p) return '';
    stats = stats || {};
    const st = p.status || 'available';
    const stLabel = ({ available: 'Здоровий', healthy: 'Здоровий', injured: 'Травмований', rehab: 'Відновлення', recovery: 'Відновлення' })[st] || st;
    const pos = p.position || '—';
    const ovr = Math.round((Number(p.readiness != null ? p.readiness : p.condition) || 70) * 0.85 + (100 - Math.min(100, (p.load || 0) * 8)) * 0.15);
    const att = stats.attPct != null ? stats.attPct + '%' : '—';
    const rpe = stats.avgRpe != null ? stats.avgRpe : '—';
    const load = stats.load28 != null ? stats.load28 : '—';
    const cond = p.readiness != null ? p.readiness : (p.condition != null ? p.condition : 80);
    const initials = ((p.firstName || '')[0] || '') + ((p.lastName || '')[0] || '');
    const cap = p.isCaptain ? '<span class="fifa-cap">C</span>' : '';
    const tg = p.telegramUsername ? '@' + sanitize(p.telegramUsername) : '';
    const posColor = ({ GK: '#f1c40f', CB: '#3498db', LB: '#3498db', RB: '#3498db', DM: '#2ecc71', CM: '#2ecc71', AM: '#2ecc71', LW: '#e74c3c', RW: '#e74c3c', ST: '#e74c3c' })[pos] || '#c8a84b';
    const photo = this._resolvePlayerAvatar(p);
    const avatarInner = photo
      ? `<img class="fifa-avatar-img" src="${sanitize(photo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='flex')"/><span class="fifa-avatar-fallback" style="display:none">${sanitize(initials.toUpperCase())}</span>`
      : `<span>${sanitize(initials.toUpperCase())}</span>`;

    // Подарунки на FIFA-картці
    let gifts = [];
    try {
      if (typeof CoachTools !== 'undefined' && CoachTools.playerGifts) {
        gifts = (CoachTools.playerGifts(p.id) || []).filter(g => g.attached !== false);
      }
    } catch (_) {}
    const giftRow = gifts.length
      ? ('<div class="fifa-gifts">' + gifts.slice(0, 10).map(g => {
          const rar = g.rarity || 'common';
          const rarL = (typeof CoachTools !== 'undefined' && CoachTools.RARITY_LABEL && CoachTools.RARITY_LABEL[rar]) || rar;
          const sp = (g.special === 'neural-horse' || g.giftId === 'neural_horse_tester') ? ' art-neural-horse'
            : (g.special === 'golden-ball' || g.giftId === 'tyshchenko_first_golden_ball') ? ' art-golden-ball'
            : (g.special === 'crest-seal' || g.giftId === 'grok_crest_seal_2025') ? ' art-crest-seal'
            : (g.special ? (' art-' + String(g.special).replace(/[^a-z0-9-]/gi, '')) : '');
          const art = (typeof CoachTools !== 'undefined' && CoachTools.giftBackdropHtml)
            ? CoachTools.giftBackdropHtml(g, 'sm')
            : (g.ico || '★');
          return '<span class="fifa-gift-chip nft-chip rarity-' + rar + sp + '" style="--art-hue:' + this._gh(g) + '" title="' +
            sanitize((this._gl(g) || '') + (g.serial ? (' · ' + g.serial) : '') + (g.note ? (' — ' + g.note) : '')) +
            '" data-action="inspect-artifact" data-gift-uid="' + (g.uid || g.id || '') + '">' +
            '<span class="fifa-gift-art">' + art + '</span>' +
            '<span class="fifa-gift-txt">' + sanitize(this._gl(g) || '') +
            '<small>' + sanitize(rarL) + (g.serial ? (' · ' + sanitize(g.serial)) : '') + '</small></span></span>';
        }).join('') + '</div>')
      : '<div class="fifa-gifts fifa-gifts-empty"><span class="note-sm">Артефактів ще немає</span></div>';

    // Порівняння — ТІЛЬКИ всередині FIFA-картки
    const otherId = (typeof window !== 'undefined' && (window.__fifaCompareId || window.__coachCompareId || window.__playerCompareId)) || '';
    const compareHtml = this._compareBlock(p, otherId);

    const clubLogo = 'assets/metalist-crest.png';
    const logoTag = clubLogo
      ? ('<img class="fifa-club-logo" src="' + (typeof sanitize==='function'?sanitize(clubLogo):clubLogo) + '" alt="club" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'"/>')
      : '';
    const gs = this._playerGiftStyle ? this._playerGiftStyle(p.id) : { ring: posColor, bg: 'linear-gradient(165deg,#241c10,#12100c)' };
    const photoAction = photo ? ' data-action="open-photo" data-player-id="' + p.id + '"' : '';
    return `
      <div class="fifa-card club-player-card ${this._playerBackdrop(p).className}" style="--pos-color:${posColor};--gift-ring:${gs.ring || posColor};--acc-ring:${gs.ring || posColor};${this._playerBackdrop(p).style}" data-fifa-player="${p.id}" data-compare-host="${p.id}">
        <div class="cpc-brand">
          <div class="cpc-brand-name"><span>МЕТАЛІСТ</span> <b>ШТУТТГАРТ</b></div>
        </div>
        <div class="cpc-hero">
          <button type="button" class="cpc-photo"${photoAction} style="border-color:${gs.ring || posColor}">
            ${avatarInner}
            ${cap}
          </button>
          <div class="cpc-id">
            <div class="cpc-num">#${p.number || '—'}</div>
            <div class="cpc-pos">${sanitize(pos)}</div>
            <div class="cpc-ovr">${ovr}</div>
            <div class="cpc-ovr-label">готовність</div>
          </div>
          ${logoTag}
        </div>
        <div class="cpc-name">${sanitize(p.firstName || '')} <strong>${sanitize(p.lastName || '')}</strong> ${this._giftStatusBadge(gifts, p.id)}</div>
        <div class="cpc-meta">${sanitize(stLabel)}${tg ? ' · ' + tg : ''}</div>
        <div class="fifa-stats">
          <div class="fifa-stat"><b>${cond}%</b><span>Готовність</span></div>
          <div class="fifa-stat"><b>${att}</b><span>${typeof t==='function'?t('longpress_attendance'):'Відвідування'}</span></div>
          <div class="fifa-stat"><b>${rpe}</b><span>Сер. RPE</span></div>
          <div class="fifa-stat"><b>${load}</b><span>Load 28д</span></div>
          <div class="fifa-stat"><b>${p.load != null ? p.load : '—'}</b><span>Load</span></div>
          <div class="fifa-stat"><b>${p.age || '—'}</b><span>Вік</span></div>
        </div>
        ${(() => {
          try {
            const pr = (typeof PlayerProgress !== 'undefined') ? PlayerProgress.compute(p.id) : null;
            if (!pr || !pr.history) return '';
            const series = pr.history.slice().reverse().map(h => Math.max(0, h.delta || 0));
            return '<div class="fifa-xp-graph"><div class="fifa-gifts-title">Досвід (XP)</div>' +
              this._sparkline(series.length > 1 ? series : [0, pr.xp || 0], { w: 200, h: 44, color: '#f5c542', fill: 'rgba(245,197,66,.15)' }) +
              '<div class="note-sm">LVL ' + (pr.level||1) + ' · ' + (pr.xp||0) + ' XP</div></div>';
          } catch(_) { return ''; }
        })()}
        <div class="fifa-gifts-block">
          <div class="fifa-gifts-title">Подарунки</div>
          ${giftRow}
          
        </div>
        ${compareHtml}
      </div>`;
  },

  _statBar(label, value, max, color) {
    const v = Math.max(0, Math.min(max, Number(value) || 0));
    const pct = max > 0 ? Math.round((v / max) * 100) : 0;
    return `<div class="stat-bar-row">
      <div class="stat-bar-label">${sanitize(label)}</div>
      <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%;background:${color || 'var(--club-secondary)'}"></div></div>
      <div class="stat-bar-val">${Number.isFinite(v) ? (Number.isInteger(v) ? v : v.toFixed(1)) : '—'}</div>
    </div>`;
  },

  _compareBlock(me, otherId) {
    const s = Store.get();
    if (!me) return '';
    const others = (s.players || []).filter(p => p.id !== me.id).sort((a, b) => (a.number || 0) - (b.number || 0));
    const opts = '<option value="">— оберіть гравця —</option>' +
      '<option value="__team__"' + (otherId === '__team__' ? ' selected' : '') + '>Середнє по команді</option>' +
      others.map(p =>
        '<option value="' + p.id + '"' + (otherId === p.id ? ' selected' : '') + '>#' + (p.number || '—') + ' ' + sanitize(p.lastName || p.firstName || '') + '</option>'
      ).join('');
    return `
      <div class="compare-card compare-collapsed" data-compare-root="${me.id}">
        <button type="button" class="compare-toggle btn btn-s btn-sm" data-action="toggle-compare">📊 Порівняння</button>
        <div class="compare-body" hidden>
          <div class="compare-title">Порівняння зі складом</div>
          <label class="compare-label">Порівняти з</label>
          <select id="playerCompareSel" class="compare-select" data-action="player-compare" data-compare-me="${me.id}">
            ${opts}
          </select>
          <p class="note-sm">Гравець або середнє по команді</p>
          <div id="compareResultHost" class="compare-result-host">
            ${this._compareResultHtml(me, otherId)}
          </div>
        </div>
      </div>`;
  },

  _compareResultHtml(me, otherId) {
    if (!me || !otherId) {
      return '<div class="compare-empty">Оберіть гравця або середнє по команді</div>';
    }
    const s = Store.get();
    const a = this._playerStats(me.id);
    const condA = me.readiness != null ? me.readiness : (me.condition != null ? me.condition : 80);
    const nameA = '#' + (me.number || '') + ' ' + sanitize(me.lastName || me.firstName || 'Ви');
    let condB = 0, b = { attPct: 0, avgRpe: 0, load28: 0 }, nameB = '', loadB = 0;
    if (otherId === '__team__') {
      const pls = s.players || [];
      if (!pls.length) return '<div class="compare-empty">Немає гравців</div>';
      let sumCond = 0, sumAtt = 0, sumRpe = 0, sumL28 = 0, sumLoad = 0, n = 0;
      pls.forEach(p => {
        n++;
        sumCond += (p.readiness != null ? p.readiness : (p.condition != null ? p.condition : 80));
        const st = this._playerStats(p.id);
        sumAtt += st.attPct || 0;
        sumRpe += st.avgRpe || 0;
        sumL28 += st.load28 || 0;
        sumLoad += (p.load != null ? p.load : 0);
      });
      condB = Math.round(sumCond / n);
      b = { attPct: Math.round(sumAtt / n), avgRpe: +(sumRpe / n).toFixed(1), load28: Math.round(sumL28 / n) };
      loadB = +(sumLoad / n).toFixed(1);
      nameB = 'Середнє · команда (' + n + ')';
    } else {
      const other = (s.players || []).find(p => p.id === otherId);
      if (!other) return '<div class="compare-empty">Гравець не знайдений</div>';
      b = this._playerStats(other.id);
      condB = other.readiness != null ? other.readiness : (other.condition != null ? other.condition : 80);
      nameB = '#' + (other.number || '') + ' ' + sanitize(other.lastName || other.firstName || '');
      loadB = other.load != null ? other.load : 0;
    }
    const maxLoad = Math.max(200, (a.load28 || 0) * 1.2, (b.load28 || 0) * 1.2);
    const fakeOther = { load: loadB };
    const chart = this._compareSvg(me, fakeOther, a, b, condA, condB);
    return `
      <div class="compare-grid">
        <div class="compare-col">
          <div class="compare-name">${nameA}</div>
          ${this._statBar('Готовність %', condA, 100, '#2ecc71')}
          ${this._statBar('Відвідування %', a.attPct || 0, 100, '#3498db')}
          ${this._statBar('Сер. RPE', a.avgRpe || 0, 10, '#f1c40f')}
          ${this._statBar('Load 28д', a.load28 || 0, maxLoad, '#e67e22')}
          ${this._statBar('Load', me.load != null ? me.load : 0, 10, '#9b59b6')}
        </div>
        <div class="compare-col">
          <div class="compare-name">${nameB}</div>
          ${this._statBar('Готовність %', condB, 100, '#2ecc71')}
          ${this._statBar('Відвідування %', b.attPct || 0, 100, '#3498db')}
          ${this._statBar('Сер. RPE', b.avgRpe || 0, 10, '#f1c40f')}
          ${this._statBar('Load 28д', b.load28 || 0, maxLoad, '#e67e22')}
          ${this._statBar('Load', loadB, 10, '#9b59b6')}
        </div>
      </div>
      <div class="compare-chart-wrap">${chart}</div>`;
  },

  _compareSvg(me, other, a, b, condA, condB) {
    // простий SVG bar chart 5 метрик
    const metrics = [
      { label: 'Готовн.', va: condA, vb: condB, max: 100 },
      { label: 'Відвід.%', va: a.attPct || 0, vb: b.attPct || 0, max: 100 },
      { label: 'RPE', va: a.avgRpe || 0, vb: b.avgRpe || 0, max: 10 },
      { label: 'Load28', va: a.load28 || 0, vb: b.load28 || 0, max: Math.max(1, a.load28 || 0, b.load28 || 0, 50) },
      { label: 'Load', va: me.load || 0, vb: other.load || 0, max: 10 }
    ];
    const W = 320, H = 140, pad = 28, gap = 12;
    const barW = (W - pad * 2 - gap * (metrics.length - 1)) / metrics.length;
    let bars = '';
    metrics.forEach((m, i) => {
      const x = pad + i * (barW + gap);
      const ha = Math.round((m.va / m.max) * (H - 40));
      const hb = Math.round((m.vb / m.max) * (H - 40));
      const bw = barW / 2 - 2;
      bars += `<rect x="${x}" y="${H - 20 - ha}" width="${bw}" height="${ha}" rx="3" fill="#3498db"/>`;
      bars += `<rect x="${x + bw + 2}" y="${H - 20 - hb}" width="${bw}" height="${hb}" rx="3" fill="#e74c3c"/>`;
      bars += `<text x="${x + barW / 2}" y="${H - 4}" text-anchor="middle" fill="#9aa4b2" font-size="9">${m.label}</text>`;
    });
    return `<svg class="compare-svg" viewBox="0 0 ${W} ${H}" width="100%" height="140" aria-label="Порівняння">
      <text x="8" y="14" fill="#3498db" font-size="10">■ Ви</text>
      <text x="50" y="14" fill="#e74c3c" font-size="10">■ Партнер</text>
      ${bars}
    </svg>`;
  },



  _myStatsCharts(me, stats) {
    if (!me) return '';
    const s = Store.get();
    const past = (s.trainings || []).filter(t => {
      if (typeof LoadModel !== 'undefined' && LoadModel.isCancelled && LoadModel.isCancelled(t)) return false;
      if (t.status === 'cancelled' || t.status === 'canceled') return false;
      return t.status === 'done';
    }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const last12 = past.slice(-12);
    const attSeries = last12.map(t => {
      const a = t.attendance && t.attendance[me.id];
      if (!a) return null;
      return a.present === false ? 0 : 1;
    });
    const rpeSeries = last12.map(t => {
      const a = t.attendance && t.attendance[me.id];
      return a && a.rpe != null ? Number(a.rpe) : null;
    });
    const W = 280, H = 72, pad = 4;
    const n = Math.max(1, attSeries.length);
    const barW = (W - pad * 2) / n;
    const bars = attSeries.map((v, i) => {
      const x = pad + i * barW;
      const h = v ? (H - pad * 2) * 0.85 : 4;
      const y = H - pad - h;
      const fill = v == null ? '#ffffff22' : (v ? '#2ecc71' : '#e74c3c');
      return `<rect x="${x + 1}" y="${y}" width="${Math.max(2, barW - 2)}" height="${h}" rx="2" fill="${fill}"/>`;
    }).join('');
    const rpePts = rpeSeries.map((v, i) => {
      if (v == null || isNaN(v)) return null;
      const x = pad + i * barW + barW / 2;
      const y = H - pad - ((Math.min(10, Math.max(0, v)) / 10) * (H - pad * 2));
      return `${x},${y}`;
    }).filter(Boolean);
    const poly = rpePts.length > 1
      ? `<polyline fill="none" stroke="#e8c547" stroke-width="2" points="${rpePts.join(' ')}"/>`
      : '';
    const marked = attSeries.filter(v => v != null);
    const presentCnt = marked.filter(Boolean).length;
    const totalCnt = marked.length;
    const attPct = totalCnt ? Math.round(presentCnt / totalCnt * 100) : (stats && stats.attPct) || 0;

    return `
      <div class="card glass player-stats-card">
        <div class="ct">${t('my_stats_training')}</div>
        <div class="dg" style="margin-bottom:10px">
          <div class="sc"><div class="lb">${(typeof I18n!=='undefined'?I18n.t('attendance','Відвідуваність'):'Відвідуваність')}</div><div class="vl">${attPct}%</div><div class="sb">${presentCnt}/${totalCnt || '—'} останніх</div></div>
          <div class="sc"><div class="lb">Сер. RPE</div><div class="vl">${stats && stats.avgRpe != null ? stats.avgRpe : '—'}</div></div>
          <div class="sc"><div class="lb">Load 28д</div><div class="vl">${stats && stats.load28 != null ? stats.load28 : '—'}</div></div>
        </div>
        <div class="chart-label">Відвідування (зелене = був, червоне = відсутній)</div>
        <svg class="att-chart" viewBox="0 0 ${W} ${H}" width="100%" height="72" aria-label="Графік відвідування">${bars}${poly}</svg>
        <div class="chart-label" style="margin-top:6px">Жовта лінія — RPE на тренуваннях</div>
      </div>`;
  },

  _noPlayerLink() {
    return '<div class="card"><div class="ct">Профіль не прив\u2019язано</div>'
      + '<p class="note-sm">Попросіть тренера вказати ваш Telegram-нік в анкеті гравця.</p></div>';
  },

  _playerStats(playerId) {
    try {
      const s = Store.get();
      const LM = (typeof LoadModel !== 'undefined') ? LoadModel : null;
      let cancelled = 0, present = 0, absent = 0;
      (s.trainings || []).forEach(t => {
        const off = (typeof LoadModel !== 'undefined' && LoadModel.isCancelled && LoadModel.isCancelled(t))
          || t.status === 'cancelled' || t.status === 'canceled';
        if (off) { cancelled++; return; }
        if (t.status !== 'done') return;
        const a = t.attendance && t.attendance[playerId];
        if (!a) return;
        if (a.present === false) absent++; else present++;
      });
      return {
        attPct: LM && LM.attendanceRate ? LM.attendanceRate(s.trainings, playerId) : null,
        avgRpe: LM && LM.avgPlayerRpe ? LM.avgPlayerRpe(s.trainings, playerId) : null,
        load28: LM && LM.playerLoad ? LM.playerLoad(s.trainings, playerId, 28) : null,
        cancelled, present, absent
      };
    } catch (e) {
      console.warn('[playerStats]', e);
      return { attPct: 0, avgRpe: 0, load28: 0, cancelled: 0, present: 0, absent: 0 };
    }
  },

  _playerHome() {
    const s = Store.get();
    let me = null;
    try { me = AuthManager.getLinkedPlayer(); } catch (_) { me = null; }
    if (!me && AuthManager.user) {
      try { AuthManager._resolveRole(); me = AuthManager.getLinkedPlayer(); } catch (_) {}
    }
    const stats = me ? this._playerStats(me.id) : { attPct: 0, avgRpe: 0, load28: 0, cancelled: 0 };
    const next = s.trainings.filter(t => t.status === 'planned' && t.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
    const todayStr = today();
    const monthPrefix = todayStr.slice(0, 7);
    const nextMatch = s.matches.filter(m => m.date >= todayStr && String(m.date).slice(0, 7) === monthPrefix)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    const pastTr = (s.trainings || []).filter(t => t.status === 'done' || t.status === 'cancelled' || t.status === 'canceled' || (t.date && t.date < todayStr))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 10);
    const fullName = me ? this._cleanDisplayName([me.firstName, me.lastName].filter(Boolean).join(' ') || me.name || 'Гравець') : '';
    let meGifts = [];
    try {
      if (me && typeof CoachTools !== 'undefined' && CoachTools.playerGifts)
        meGifts = CoachTools.playerGifts(me.id) || [];
      else if (me) meGifts = (s.gifts || []).filter(g => g.playerId === me.id);
    } catch (_) {}
    const worn = meGifts.filter(g => g && g.attached !== false && String(g.ico || g.label || g.giftId || '').trim()).slice(0, 8);
    const featured = meGifts.find(g => g.featured) || null;
    const prog = (me && typeof PlayerProgress !== 'undefined') ? PlayerProgress.compute(me.id) : { level: 1, levelProgress: 0, xp: 0, xpToNext: 0 };
    const profile = (me && me.profile) || {};
    const statusText = profile.status || me?.statusText || '';
    const bio = profile.bio || me?.bio || '';
    const themeHue = featured ? this._gh(featured) : (profile.themeHue != null ? profile.themeHue : null);
    const themeStyle = themeHue != null
      ? ('--gift-hue:' + themeHue + ';--pos-ring:hsl(' + themeHue + ' 70% 55%);--pos-bg:hsl(' + themeHue + ' 40% 18%)')
      : (() => { const acc = this._posAccent(me && me.position); return '--pos-bg:' + acc.bg + ';--pos-ring:' + acc.ring; })();
    const photo = me ? (this._resolvePlayerAvatar(me) || me.photoUrl || me.profilePhoto || '') : '';
    const initials = this._initials(fullName);
    const photoHtml = photo
      ? '<img src="' + sanitize(photo) + '" alt="" referrerpolicy="no-referrer" onerror="this.style.display=\'none\';this.nextElementSibling&&(this.nextElementSibling.style.display=\'flex\')"/><span class="cp-avatar-ph" style="display:none">' + sanitize(initials) + '</span>'
      : '<span class="cp-avatar-ph">' + sanitize(initials) + '</span>';
    const featBadge = me ? this._giftStatusBadge(meGifts, me.id) : '';
    const nextLoad = next && typeof LoadModel !== 'undefined' && LoadModel.sessionLoad
      ? LoadModel.sessionLoad(next.duration, next.intensity) : (next ? (next.duration || 0) * (next.intensity || 0) : 0);
    const nextXp = 18;

    return `
      <div class="player-home">
      ${this._buildLine()}
      <div class="st player-cab-head">${t('my_cabinet')} · <span class="cp-brand-a">МЕТАЛІСТ</span> <span class="cp-brand-b">ШТУТТГАРТ</span>
        <button type="button" class="btn btn-s btn-sm" data-io="import" data-action="import-trigger">Імпорт JSON</button>
        <button type="button" class="btn btn-s btn-sm" data-action="edit-self-player">Профіль</button>
      </div>
      ${me ? `
        <div class="cp-hero cp-person cp-clean player-profile-hero ${this._playerBackdrop(me).className}" style="${themeStyle};${this._playerBackdrop(me).style}">
          <div class="cp-avatar-wrap" data-stop-nav="1">
            <button type="button" class="cp-avatar" data-action="${photo ? 'open-photo' : 'open-fifa-card'}" data-player-id="${me.id}"
              title="${photo ? 'Фото на весь екран' : 'FIFA-картка'}" style="border-color:var(--pos-ring);background:var(--pos-bg)">
              ${photoHtml}
            </button>
            ${this._tgGiftCloud(worn.filter(g => g && !g.featured), 1.2, 'full')}
          </div>
          <div class="cp-role-line"><span class="cp-role-kind">Гравець</span></div>
          <h1 class="cp-title cp-title-name">${sanitize(fullName)} ${featBadge}</h1>
          ${this._giftStrip(worn)}
          ${statusText ? '<div class="player-status-line">' + sanitize(statusText) + '</div>' : ''}
          <div class="cp-role-badge" style="border-color:var(--pos-ring);color:var(--pos-ring)">${sanitize(me.position || '—')}</div>
          <div class="soc-xp-block player-home-xp">
            <div class="soc-xp-head"><span>LVL ${prog.level}</span><span>${prog.xp || 0} XP</span></div>
            <div class="soc-xp-bar"><div class="soc-xp-fill" style="width:${prog.levelProgress || 0}%"></div></div>
            <div class="soc-xp-sub">До LVL ${(prog.level || 1) + 1}: ${prog.xpToNext || 0} XP</div>
          </div>
          ${this._accountProgress(me.id)}
          ${bio ? '<p class="player-bio-home">' + sanitize(bio) + '</p>' : ''}
          <div class="cp-status"><span class="cp-dot"></span>${(typeof I18n!=='undefined'?I18n.t('attendance','Відвідуваність'):'Відвідуваність')} ${Math.round(stats.attPct || 0)}% · тап по фото — на весь екран</div>
        </div>` : this._noPlayerLink()}

      <div class="cp-pills player-quick">
        <button type="button" class="cp-pill" data-view="trainings">📅 ${t('nav_trainings')}</button>
        <button type="button" class="cp-pill" data-view="players">👥 ${t('nav_squad')}</button>
        <button type="button" class="cp-pill" data-view="analytics">📊 ${t('analytics')}</button>
      </div>

      ${nextMatch ? `
      <div class="card glass next-match-card">
        <div class="ct">⚽ Наступний матч</div>
        <div class="vl">${sanitize(nextMatch.opponent || nextMatch.title || 'Матч')}</div>
        <div class="sb">${sanitize(nextMatch.date || '')}${nextMatch.time ? ' · ' + sanitize(nextMatch.time) : ''}${nextMatch.competition ? ' · ' + sanitize(nextMatch.competition) : ''}</div>
      </div>` : ''}

      ${next
        ? ('<button type="button" class="card glass next-tr-card" data-action="preview-next-training" data-training-id="' + next.id + '">' +
          '<div class="ct">Наступне тренування</div>' +
          '<div class="vl">' + sanitize(next.name) + '</div>' +
          '<div class="next-tr-metrics">' +
            '<span>' + sanitize(next.date || '') + (next.time ? ' · ' + sanitize(next.time) : '') + '</span>' +
            '<span>' + (next.duration || 0) + ' хв</span>' +
            '<span>Load ' + (nextLoad || '—') + '</span>' +
            '<span>~+' + nextXp + ' XP</span>' +
          '</div></button>')
        : '<div class="card glass next-tr-card"><div class="ct">Наступне тренування</div><div class="note-sm">Немає запланованого тренування</div></div>'}

      ${me ? this._myStatsCharts(me, Object.assign({}, stats, { xp: prog.xp, level: prog.level })) : ''}

      <div class="card glass">
        <div class="ct">${t('recent_trainings')}</div>
        <div class="player-tr-list">${pastTr.length ? pastTr.map(tr => {
          const a = me && tr.attendance && tr.attendance[me.id];
          const cancelled = (typeof LoadModel !== 'undefined' && LoadModel.isCancelled && LoadModel.isCancelled(tr))
            || tr.status === 'cancelled' || tr.status === 'canceled';
          const held = !cancelled && tr.status === 'done';
          const present = (held && a) ? (a.present !== false) : null;
          const cls = cancelled ? 'ptr-cancel' : (present === true ? 'ptr-ok' : (present === false ? 'ptr-miss' : 'ptr-na'));
          const badge = cancelled ? 'скас.' : (present === true ? '✓' : (present === false ? '✗' : '—'));
          const rpe = held && a && a.rpe != null ? ('RPE ' + a.rpe) : '';
          const note = cancelled ? ' · скасовано, не пропуск' : (!held ? ' · не відбулось' : '');
          return '<div class="player-tr-row ' + cls + '">' +
            '<span class="ptr-badge">' + badge + '</span>' +
            '<span class="ptr-name">' + sanitize(tr.name || 'Тренування') + '</span>' +
            '<span class="ptr-meta">' + sanitize(tr.date || '') + ' ' + rpe + note + '</span></div>';
        }).join('') : '<p class="note-sm">Немає даних. Імпортуйте JSON від тренера.</p>'}</div>
      </div>
      ${this._coachPublicCard()}
      </div>
      `;
  },

  /** Публічна картка тренера — бачать усі (гравці/гості) */
  _coachPublicCard() {
    const s = Store.get();
    const set = s.settings || {};
    const name = set.coachName || 'Artem Serdiuk';
    const photo = set.coachPhoto || '';
    const cs = set.coachStats || { appMs: 0, boardMs: 0 };
    const todayStr = (typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10));
    const past = (s.trainings || []).filter(t => t.status === 'done' || ((t.date || '') < todayStr && t.status !== 'draft' && t.status !== 'cancelled'));
    let attP = 0, attT = 0;
    past.forEach(t => {
      Object.values(t.attendance || {}).forEach(a => {
        attT++;
        if (a && a.present !== false) attP++;
      });
    });
    const attPct = attT ? Math.round(attP / attT * 100) : 0;
    const appT = (typeof App !== 'undefined' && App.formatDurationMs) ? App.formatDurationMs(cs.appMs || 0) : '—';
    const boardT = (typeof App !== 'undefined' && App.formatDurationMs) ? App.formatDurationMs(cs.boardMs || 0) : '—';
    const ph = photo
      ? '<button type="button" class="coach-pub-av" data-action="open-photo" data-photo="' + sanitize(photo) + '" title="Фото на весь екран"><img src="' + sanitize(photo) + '" alt="" referrerpolicy="no-referrer"/></button>'
      : '<span class="coach-pub-av"><span class="cp-avatar-ph">AS</span></span>';
    return `
      <div class="card glass coach-public-card" data-action="open-coach-card" data-coach-card="1" data-stop-nav="1" role="button" tabindex="0">
        <div class="ct">${t('head_coach')}</div>
        <div class="coach-pub-row coach-card-btn" data-action="open-coach-card" data-coach-card="1" data-stop-nav="1" role="button" tabindex="0">
          ${ph}
          <div class="coach-pub-body">
            <div class="coach-pub-name">${sanitize(name)}</div>
            <div class="coach-pub-meta">Тренувань: ${past.length} · ${(typeof I18n!=='undefined'?I18n.t('attendance','Відвідуваність'):'Відвідуваність')} команди ${attPct}%</div>
            <div class="coach-pub-meta">У додатку: ${appT} · На дошці: ${boardT}</div>
          </div>
          <span class="tg-row-chevron">›</span>
        </div>
        <p class="note-sm">Тап — золота картка тренера зі статистикою</p>
      </div>`;
  },

  _rankTitle(level) {
    const n = Number(level) || 1;
    if (n >= 12) return 'Капітан ритму';
    if (n >= 8) return 'Провідник';
    if (n >= 4) return 'Основа ритму';
    return 'Старт';
  },

  _accountProgress(playerId) {
    let pr = null;
    try { pr = (typeof PlayerProgress !== 'undefined') ? PlayerProgress.compute(playerId) : null; } catch (_) { pr = null; }
    if (!pr) return '';
    const rank = this._rankTitle(pr.level);
    const bar = (label, value, max) => {
      const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
      return '<div class="prog-row"><span>' + label + '</span><b>' + value + '</b>' +
        '<div class="prog-track"><div class="prog-fill" style="width:' + Math.min(100, pct) + '%"></div></div></div>';
    };
    const maxPart = Math.max(pr.xpAttend || 0, pr.xpIntensity || 0, pr.xpGifts || 0, 1);
    const events = (pr.history || []).slice(0, 5).map(h => {
      const sign = (h.delta || 0) >= 0 ? '+' : '';
      return '<li><span>' + sanitize(h.date || '') + ' · ' + sanitize(h.name || '') + '</span><b>' + sign + (h.delta || 0) + ' XP</b></li>';
    }).join('');
    return '<div class="prog-panel">' +
      '<div class="prog-rank">' + sanitize(rank) + ' · серія ' + (pr.streak || 0) + '</div>' +
      bar('Відвідування', pr.xpAttend || 0, maxPart) +
      bar('Інтенсивність', pr.xpIntensity || 0, maxPart) +
      bar('Подарунки', pr.xpGifts || 0, maxPart) +
      (events ? ('<ul class="prog-events">' + events + '</ul>') : '') +
      '</div>';
  },

  _guestHome() {
    const s = Store.get();
    const set = s.settings || {};
    const social = set.social || {};
    const players = (s.players || []).slice();
    const done = (s.trainings || []).filter(t => t && t.status === 'done')
      .slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const sessionAtt = done.map(t => {
      const att = t.attendance || {};
      const ids = Object.keys(att);
      let present = 0;
      ids.forEach(k => { if (att[k] && att[k].present !== false) present++; });
      return { date: t.date || '', name: t.name || 'Тренування', pct: ids.length ? Math.round(present / ids.length * 100) : 0, n: ids.length };
    });
    const avg = sessionAtt.length ? Math.round(sessionAtt.reduce((a, x) => a + x.pct, 0) / sessionAtt.length) : 0;
    const spark = this._sparkline(sessionAtt.slice().reverse().map(x => x.pct), { w: 280, h: 56, color: '#e8c547', fill: 'rgba(232,197,71,.16)' });
    const nameOf = (id) => {
      const p = players.find(x => String(x.id) === String(id));
      if (!p) return 'Гравець';
      return [p.firstName, p.lastName].filter(Boolean).join(' ') || p.name || ('#' + (p.number || ''));
    };
    const activity = [];
    sessionAtt.slice(0, 6).forEach(t => {
      activity.push('<li class="club-act"><span class="club-act-k">Тренування</span><b>' + sanitize(t.name) + '</b><span>' + sanitize(t.date) + ' · явка ' + t.pct + '%</span></li>');
    });
    (s.gifts || []).slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 6).forEach(g => {
      const when = String(g.createdAt || '').slice(0, 10);
      activity.push('<li class="club-act"><span class="club-act-k">Момент</span><b>' + sanitize(nameOf(g.playerId)) + '</b><span>' + sanitize(this._gl(g) || 'Подарунок') + (when ? (' · ' + when) : '') + '</span></li>');
    });
    const ranked = players.map(p => {
      let pr = { level: 1, xp: 0, attPct: 0, streak: 0 };
      try { pr = PlayerProgress.compute(p.id); } catch (_) {}
      return { p, pr };
    }).sort((a, b) => (b.pr.xp || 0) - (a.pr.xp || 0));
    const growth = ranked.slice(0, 6).map(({ p, pr }) => {
      const nm = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.name || '';
      return '<button type="button" class="club-grow" data-action="open-player-card" data-player-id="' + p.id + '">' +
        '<span class="club-grow-lv">LVL ' + (pr.level || 1) + '</span>' +
        '<span class="club-grow-name">#' + (p.number || '—') + ' ' + sanitize(nm) + '</span>' +
        '<span class="club-grow-meta">' + sanitize(this._rankTitle(pr.level)) + ' · ' + (pr.attPct || 0) + '% · серія ' + (pr.streak || 0) + '</span></button>';
    }).join('');
    const photos = players.filter(p => this._resolvePlayerAvatar && this._resolvePlayerAvatar(p)).slice(0, 12).map(p => {
      const src = this._resolvePlayerAvatar(p);
      const nm = [p.firstName, p.lastName].filter(Boolean).join(' ') || '';
      return '<button type="button" class="club-photo" data-action="open-photo" data-player-id="' + p.id + '">' +
        '<img src="' + sanitize(src) + '" alt="" loading="lazy" referrerpolicy="no-referrer"/>' +
        '<span>#' + (p.number || '—') + ' ' + sanitize(nm) + '</span></button>';
    }).join('');
    const links = [
      social.telegram || set.telegramChannel,
      social.instagram || set.instagram,
      social.youtube || set.youtube
    ].filter(Boolean);
    const media = Array.isArray(set.guestMedia) ? set.guestMedia : [];
    const mediaHtml = media.map(m => {
      const url = typeof m === 'string' ? m : (m && (m.url || m.src)) || '';
      const title = typeof m === 'object' && m ? (m.title || url) : url;
      if (!url) return '';
      return '<a class="club-media-link" href="' + sanitize(url) + '" target="_blank" rel="noopener">' + sanitize(title) + '</a>';
    }).join('') + links.map(url => '<a class="club-media-link" href="' + sanitize(url) + '" target="_blank" rel="noopener">' + sanitize(url) + '</a>').join('');
    const next = (s.trainings || []).filter(t => t.status === 'planned' && t.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];

    return '<div class="club-public">' +
      this._buildLine() +
      '<div class="club-hero">' +
        '<button type="button" class="club-crest-btn" data-action="open-photo" data-photo="assets/metalist-crest.png" data-photo-save="1" data-photo-name="Metalist-Shtuttgart.png" title="Емблема на весь екран">' +
        '<img class="club-crest" src="assets/metalist-crest.png" alt="Емблема Металіст Штуттгарт"/></button>' +
        '<div class="club-hero-copy"><div class="club-kicker">Одна команда</div><h1>Металіст Штуттгарт</h1>' +
        '<p>Гість бачить активність, ріст акаунтів і медіа клубу. Тап по емблемі відкриває її на весь екран — її можна зберегти.</p>' +
        '<button type="button" class="btn btn-s btn-sm" data-io="import" data-action="import-trigger">Імпорт JSON</button></div></div>' +
      '<div class="club-kpis">' +
        '<div><b>' + players.length + '</b><span>гравців</span></div>' +
        '<div><b>' + done.length + '</b><span>сесій</span></div>' +
        '<div><b>' + avg + '%</b><span>явка</span></div>' +
        '<div><b>' + (next ? sanitize(next.date || '') : '—') + '</b><span>наступне</span></div>' +
      '</div>' +
      '<section class="club-block"><h2>Активність</h2><ul class="club-feed">' +
        (activity.join('') || '<li class="club-act"><span>Поки немає відмічених сесій.</span></li>') +
      '</ul></section>' +
      '<section class="club-block"><h2>Ріст команди</h2>' + spark +
        '<div class="club-grow-list">' + growth + '</div></section>' +
      '<section class="club-block"><h2>Медіа</h2>' +
        '<div class="club-photos">' + (photos || '<p class="note-sm">Фото гравців з’являться тут.</p>') + '</div>' +
        (mediaHtml ? ('<div class="club-links">' + mediaHtml + '</div>') : '<p class="note-sm">Посилання на клубні матеріали тренер додає в налаштуваннях.</p>') +
      '</section></div>';
  },


  /** Мініатюра схеми (SVG) з усіх об'єктів дошки, включно зі стрілками і суперником. */
  _schemeThumbSvg(board) {
    try {
      const objs = (board && board.objects) || [];
      const W = 100, H = 160;
      const paths = { arrow: 1, arrowDash: 1, pass: 1, run: 1, dribble: 1, press: 1, shot: 1, movement: 1 };
      const norm = (v) => {
        let n = +v;
        if (!isFinite(n)) return 0.5;
        if (n > 1.5) n = n > 100 ? n / 800 : n / 100;
        return Math.max(0.02, Math.min(0.98, n));
      };
      const hex = (c, fb) => (/^#[0-9a-fA-F]{3,8}$/.test(String(c || '')) ? String(c) : fb);
      const isOpp = (o) => o && (o.type === 'opponent' || o.team === 'opp' || o.isOpponent);
      let svg = '<svg class="scheme-thumb-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">';
      svg += '<rect width="' + W + '" height="' + H + '" rx="10" fill="#166534"/>';
      svg += '<rect x="5" y="5" width="' + (W - 10) + '" height="' + (H - 10) + '" rx="4" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.2"/>';
      svg += '<line x1="5" y1="' + (H / 2) + '" x2="' + (W - 5) + '" y2="' + (H / 2) + '" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>';
      svg += '<circle cx="' + (W / 2) + '" cy="' + (H / 2) + '" r="14" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>';
      svg += '<rect x="' + (W * 0.2) + '" y="5" width="' + (W * 0.6) + '" height="22" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1"/>';
      svg += '<rect x="' + (W * 0.2) + '" y="' + (H - 27) + '" width="' + (W * 0.6) + '" height="22" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1"/>';
      const draw = objs.filter(o => o && o.visible !== false);
      draw.forEach(o => {
        const typ = String(o.type || o.kind || '');
        if (typ !== 'zone') return;
        const x = norm(o.nx != null ? o.nx : o.x) * W;
        const y = norm(o.ny != null ? o.ny : o.y) * H;
        const w = Math.max(2, norm(o.w || 0.08) * W);
        const h = Math.max(2, norm(o.h || 0.08) * H);
        svg += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" fill="rgba(200,168,75,0.28)" stroke="#e8c547" stroke-width="0.6"/>';
      });
      draw.forEach(o => {
        const typ = String(o.type || o.kind || '');
        if (!paths[typ] || o.x2 == null && o.nx2 == null) return;
        const x1 = norm(o.nx != null ? o.nx : o.x) * W;
        const y1 = norm(o.ny != null ? o.ny : o.y) * H;
        const x2 = norm(o.nx2 != null ? o.nx2 : o.x2) * W;
        const y2 = norm(o.ny2 != null ? o.ny2 : o.y2) * H;
        const col = hex(o.color, typ === 'shot' ? '#e67e22' : (typ === 'press' ? '#e74c3c' : '#f5c542'));
        const dash = (typ === 'run' || typ === 'arrowDash' || typ === 'dribble') ? ' stroke-dasharray="2.2 1.4"' : '';
        svg += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="' + col + '" stroke-width="1.35"' + dash + '/>';
        const ang = Math.atan2(y2 - y1, x2 - x1);
        const ah = 3.2;
        const ax = x2 - Math.cos(ang) * 0.4;
        const ay = y2 - Math.sin(ang) * 0.4;
        const p1 = (ax - Math.cos(ang - 0.45) * ah).toFixed(1) + ',' + (ay - Math.sin(ang - 0.45) * ah).toFixed(1);
        const p2 = (ax - Math.cos(ang + 0.45) * ah).toFixed(1) + ',' + (ay - Math.sin(ang + 0.45) * ah).toFixed(1);
        svg += '<polygon points="' + ax.toFixed(1) + ',' + ay.toFixed(1) + ' ' + p1 + ' ' + p2 + '" fill="' + col + '"/>';
      });
      let chips = 0;
      draw.forEach(o => {
        const typ = String(o.type || o.kind || 'player');
        if (paths[typ] || typ === 'zone' || typ === 'text') return;
        if (o.x == null && o.nx == null) return;
        const px = norm(o.nx != null ? o.nx : o.x) * W;
        const py = norm(o.ny != null ? o.ny : o.y) * H;
        chips++;
        if (typ === 'ball') {
          svg += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="2.6" fill="#fff"/>';
          return;
        }
        const opp = isOpp(o);
        const col = opp ? '#e74c3c' : hex(o.chipColor || o.color, '#3d7eff');
        const r = (typ === 'chipLarge' || typ === 'opponent') ? 4.4 : 3.6;
        svg += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="' + r + '" fill="' + col + '" stroke="' + (opp ? '#fff' : 'rgba(255,255,255,0.75)') + '" stroke-width="0.7"/>';
        if (o.number != null && typ !== 'cone' && typ !== 'wall') {
          svg += '<text x="' + px.toFixed(1) + '" y="' + (py + 1.5).toFixed(1) + '" text-anchor="middle" fill="#fff" font-size="4.6" font-weight="700">' + String(o.number).replace(/[^\d]/g, '').slice(0, 2) + '</text>';
        }
      });
      if (!draw.length) {
        svg += '<text x="' + (W / 2) + '" y="' + (H / 2 + 3) + '" text-anchor="middle" fill="rgba(255,255,255,0.45)" font-size="9">порожня</text>';
      }
      svg += '</svg>';
      return svg;
    } catch (_) {
      return '<div class="scheme-thumb-ph">📐</div>';
    }
  },

  _isTacticalBoard(b) {
    if (!b) return false;
    if (b.trainingId) return false;
    const typ = String(b.type || b.kind || b.schemeType || b.category || '').toLowerCase().trim();
    if (['training', 'train', 'drill', 'exercise', 'session', 'plan', 'workout', 'тренування', 'вправа'].includes(typ)) return false;
    const name = String(b.name || b.title || '').toLowerCase();
    if (/(^|\s)(тренування|training|drill|вправа|session)(\s|$)/i.test(name) && !/тактик|formation|розстанов|схем/i.test(name)) {
      return false;
    }
    return true;
  },

  _playerVisibleBoards() {
    const s = Store.get();
    const list = (s.boards || []).filter(b => b && b.id && this._isTacticalBoard(b));
    return list.slice().sort((a, b) =>
      String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''))
    );
  },
trainings() {
    const s = Store.get();
    const canEdit = typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach();
    const todayStr = (typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10));
    let list = (s.trainings || []).slice();
    if (!canEdit) {
      list = list.filter(t => {
        const st = t.status || 'planned';
        return st !== 'draft' && st !== 'pinned';
      });
    }
    list.sort((a, b) => {
      const ad = a.date || '';
      const bd = b.date || '';
      const aFut = ad >= todayStr ? 0 : 1;
      const bFut = bd >= todayStr ? 0 : 1;
      if (aFut !== bFut) return aFut - bFut;
      return bFut === 0 ? ad.localeCompare(bd) : bd.localeCompare(ad);
    });

    const _isPlayerRole = typeof AuthManager !== 'undefined' && AuthManager.isPlayer && AuthManager.isPlayer();
    let _schemesBlock = '';
    if (_isPlayerRole) {
      const boards = (typeof this._playerVisibleBoards === 'function')
        ? this._playerVisibleBoards()
        : (s.boards || []).filter(b => b && this._isTacticalBoard && this._isTacticalBoard(b));
      const schemesHtml = boards.length
        ? boards.slice(0, 60).map(b => {
            return this._schemeCard(b, { editable: false });
          }).join('')
        : '<div class="es note-sm">Немає тактичних схем. Тренер збереже схему на дошці.</div>';
      _schemesBlock = '<div class="player-schemes-block"><div class="scheme-cards">' + schemesHtml + '</div></div>';
    }
    const _tab = (s.ui && s.ui.playerTrainTab) || 'trainings';
    const _tabsHtml = _isPlayerRole ? (
      '<div class="pt-tabs glass">' +
        '<button type="button" class="pt-tab' + (_tab === 'trainings' ? ' on' : '') + '" data-action="player-train-tab" data-tab="trainings">📅 Тренування</button>' +
        '<button type="button" class="pt-tab' + (_tab === 'schemes' ? ' on' : '') + '" data-action="player-train-tab" data-tab="schemes">📐 Схеми</button>' +
      '</div>'
    ) : '';
    if (_isPlayerRole && _tab === 'schemes') {
      return '<div class="st">Тренування · Схеми</div>' + _tabsHtml +
        '<p class="note-sm">Утримуйте мініатюру, щоб прочитати повний опис.</p>' +
        (_schemesBlock || '<div class="es">Немає схем</div>');
    }

    const statusLabel = (st) => {
      if (st === 'done') return 'Проведено';
      if (st === 'cancelled') return 'Скасовано';
      if (st === 'draft') return 'Чернетка';
      if (st === 'pinned') return 'Закріплене';
      return 'Заплановане';
    };
    const statusCls = (st) => {
      if (st === 'done') return 'tr-done';
      if (st === 'cancelled') return 'tr-cancelled';
      if (st === 'draft') return 'tr-draft';
      return 'tr-planned';
    };

    const cards = list.map(tr => {
      const st = tr.status || 'planned';
      const load = tr.load != null ? tr.load : (tr.rpe != null ? tr.rpe : '—');
      const dur = tr.duration != null ? (tr.duration + ' хв') : '';
      const title = sanitize(tr.name || 'Тренування');
      const date = sanitize(tr.date || '');
      return '<div class="card glass card-training tg-row ' + statusCls(st) + '" data-training-id="' + (tr.id || '') + '" data-action="open-training">' +
        '<div class="tr-top"><div class="tr-title">' + title + '</div><span class="tr-badge ' + statusCls(st) + '">' + statusLabel(st) + '</span></div>' +
        '<div class="tr-meta"><span>' + date + '</span>' + (dur ? '<span class="tr-dot">·</span><span>' + dur + '</span>' : '') +
        (load !== '—' ? '<span class="tr-dot">·</span><span>навантаження ' + load + '</span>' : '') + '</div>' +
        '</div>';
    }).join('');

    return `
      <div class="st">${typeof t==='function'?t('trainings_title','Тренування'):'Тренування'} ${canEdit ? '<button class="btn btn-p btn-sm" data-action="new-training">+ Нове</button>' : '<span class="note-sm">планові та минулі</span>'}</div>
      ${_tabsHtml}
      <div class="fb">
        <input type="search" id="trSearch" placeholder="Пошук..." data-filter="trainings">
        <select id="trStatus" data-filter="trainings">
          <option value="">Всі статуси</option>
          ${canEdit ? '<option value="draft">Чернетка</option>' : ''}
          <option value="planned">Заплановане</option>
          <option value="done">Проведено</option>
          <option value="cancelled">Скасовано</option>
        </select>
      </div>
      <div class="tr-list">${cards || '<div class="es">Немає тренувань</div>'}</div>
    `;
  },

  _accountAccent(p) {
    const fallback = { ring: '#c8a84b', bg: 'linear-gradient(160deg,#2a2410,#12100a)' };
    if (!p) return fallback;
    let hue = null;
    try {
      const gifts = (Store.get().gifts || []).filter(g => g && String(g.playerId) === String(p.id));
      const featured = gifts.find(g => g.featured) || null;
      if (featured) hue = this._gh(featured);
    } catch (_) {}
    if (hue == null) {
      const profile = p.profile || {};
      const stored = profile.themeHue != null ? profile.themeHue : p.themeHue;
      if (stored != null && stored !== '' && isFinite(Number(stored))) hue = Number(stored);
    }
    if (hue != null) {
      return {
        ring: 'hsl(' + hue + ' 72% 58%)',
        bg: 'linear-gradient(165deg, hsl(' + hue + ' 46% 24%) 0%, hsl(' + hue + ' 38% 11%) 100%)'
      };
    }
    const pos = this._posAccent(p.position);
    return { ring: pos.ring, bg: pos.bg };
  },

  _accAttr(p) {
    const a = this._accountAccent(p);
    return '--acc-ring:' + a.ring + ';--acc-bg:' + a.bg;
  },

  _playerBackdrop(p) {
    try {
      if (typeof CoachTools !== 'undefined' && CoachTools.playerBackdrop) return CoachTools.playerBackdrop(p || {});
    } catch (_) {}
    return { className: '', style: '' };
  },

  _playerPatternStyle(p) {
    return (this._playerBackdrop(p).style) || '';
  },

  _squadPlaque(p, att, roleText) {
    const photo = this._resolvePlayerAvatar ? this._resolvePlayerAvatar(p) : (p.photoUrl || '');
    const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.name || ('#' + (p.number || ''));
    const initials = this._initials ? this._initials(name) : '??';
    const ph = photo
      ? '<img src="' + sanitize(photo) + '" alt="" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'"/>'
      : '<span class="cp-avatar-ph">' + sanitize(initials) + '</span>';
    let mine = [];
    try {
      mine = (Store.get().gifts || []).filter(g => g && p && String(g.playerId) === String(p.id));
    } catch (_) {}
    const featured = mine.find(g => g && g.featured) || null;
    const orbit = featured ? mine.filter(g => g !== featured) : mine;
    const cloud = this._tgGiftCloud(orbit, 1, 'card');
    const badge = this._giftStatusBadge(mine);
    const bd = this._playerBackdrop(p);
    return '<div class="pl-card glass pl-card-tint pl-acc ' + bd.className + '" data-player-id="' + p.id + '" data-action="open-player-card" role="button" tabindex="0" style="' + this._accAttr(p) + ';' + bd.style + '">' +
      '<div class="pl-card-av-wrap">' + (photo
        ? ('<button type="button" class="pl-card-av" data-action="open-fifa-card" data-player-id="' + p.id + '">' + ph + '</button>')
        : ('<div class="pl-card-av">' + ph + '</div>')) +
      cloud + '</div>' +
      '<div class="pl-card-body"><div class="pl-card-name"><span class="pl-card-name-txt">#' + (p.number || '—') + ' ' + sanitize(name) + '</span>' + badge + '</div>' +
      '<div class="pl-card-meta">' + sanitize(p.position || '') + (roleText ? (' · ' + roleText) : '') + '</div>' +
      '<div class="pl-card-att">Відвідуваність ' + att + '%</div></div></div>';
  },

  _teamChat() {
    const s = Store.get();
    const list = (s.chat || []).slice().sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || ''))).slice(-80);
    let meKey = 'guest';
    try {
      if (typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach()) meKey = 'coach';
      else {
        const me = AuthManager.getLinkedPlayer && AuthManager.getLinkedPlayer();
        meKey = me ? ('p:' + me.id) : ('g:' + ((AuthManager.displayName && AuthManager.displayName()) || ''));
      }
    } catch (_) {}
    const chatHue = (key) => {
      const slots = [205, 152, 18, 278, 332, 118, 8, 235, 88, 312];
      let h = 2166136261;
      const str = String(key || 'x');
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return slots[(h >>> 0) % slots.length];
    };
    const rows = list.map(m => {
      const key = m.authorRole === 'coach' ? 'coach' : (m.playerId ? ('p:' + m.playerId) : ('g:' + (m.authorName || '')));
      const mine = key === meKey;
      let accent = { ring: '#9aa4b2', bg: 'rgba(255,255,255,0.06)' };
      if (m.authorRole === 'coach') accent = { ring: '#e8c547', bg: 'linear-gradient(165deg,#3a3010,#161208)' };
      else if (m.playerId) {
        const person = (s.players || []).find(p => p && String(p.id) === String(m.playerId));
        if (person) accent = this._accountAccent(person);
        else {
          const hue = chatHue(m.playerId || key);
          accent = {
            ring: 'hsl(' + hue + ' 78% 64%)',
            bg: 'linear-gradient(165deg, hsl(' + hue + ' 46% 28%) 0%, hsl(' + hue + ' 40% 12%) 100%)'
          };
        }
      } else {
        const hue = chatHue(m.authorName || key);
        accent = {
          ring: 'hsl(' + hue + ' 78% 64%)',
          bg: 'linear-gradient(165deg, hsl(' + hue + ' 46% 28%) 0%, hsl(' + hue + ' 40% 12%) 100%)'
        };
      }
      let time = '';
      try {
        const d = new Date(m.createdAt);
        if (!isNaN(d.getTime())) time = d.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      } catch (_) {}
      const role = m.authorRole === 'coach' ? 'Тренер' : (m.authorRole === 'player' ? 'Гравець' : 'Гість');
      let badge = '';
      if (m.playerId) {
        const owned = (s.gifts || []).filter(g => g && String(g.playerId) === String(m.playerId));
        const featured = owned.find(g => g.featured) || null;
        if (featured) {
          const art = (typeof CoachTools !== 'undefined' && CoachTools.giftBackdropHtml)
            ? CoachTools.giftBackdropHtml(featured, 'sm')
            : (featured.ico || '');
          badge = '<span class="gift-status-badge rarity-' + (featured.rarity || 'common') + '" title="' + sanitize(this._gl(featured) || '') + '">' + art + '</span>';
        }
      }
      return '<div class="team-chat-msg' + (mine ? ' mine' : '') + '" style="--acc-ring:' + accent.ring + ';--acc-bg:' + accent.bg + '">' +
        '<div class="team-chat-meta"><b>' + sanitize(m.authorName || role) + '</b>' + badge + ' <span>' + sanitize(role) + (time ? (' · ' + time) : '') + '</span></div>' +
        '<div class="team-chat-text">' + sanitize(m.text || '') + '</div></div>';
    }).join('');
    return '<section class="team-chat" id="teamChat">' +
      '<div class="ct">Чат команди</div>' +
      '<p class="note-sm">Пишуть тренер і гравці. Повідомлення з’являються в усіх, хто відкрив додаток.</p>' +
      '<div class="team-chat-log" id="teamChatLog">' + (rows || '<div class="team-chat-empty">Напишіть перше повідомлення команді.</div>') + '</div>' +
      '<div class="team-chat-form" id="teamChatForm">' +
        '<input id="teamChatInput" type="text" maxlength="500" placeholder="Повідомлення команді…" autocomplete="off" enterkeyhint="send">' +
        '<button type="button" class="btn btn-p" data-action="team-chat-send">Надіслати</button>' +
      '</div></section>';
  },

  coachPlayerDetail(playerId) {
    const s = Store.get();
    const p = (s.players || []).find(x => x && String(x.id) === String(playerId));
    if (!p) return '<div class="es">Гравця не знайдено</div>';
    const st = this._playerStats ? this._playerStats(p.id) : {};
    const fifa = this._fifaCard ? this._fifaCard(p, st) : '';
    const gifts = (typeof CoachTools !== 'undefined' && CoachTools.playerGifts) ? (CoachTools.playerGifts(p.id) || []) : [];
    const worn = gifts.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 8);
    const wornHtml = worn.length
      ? ('<div class="coach-gift-worn">' + worn.map(g => {
          const art = (typeof CoachTools !== 'undefined' && CoachTools.giftBackdropHtml)
            ? CoachTools.giftBackdropHtml(g, 'sm')
            : (g.ico || '★');
          return '<span class="coach-gift-chip" title="' + sanitize(this._gl(g) || '') + '">' + art + '<span>' + sanitize(this._gl(g) || '') + '</span></span>';
        }).join('') + '</div>')
      : '<p class="note-sm">Ще немає подарунків.</p>';
    const catalog = (typeof CoachTools !== 'undefined' && CoachTools.GIFT_CATALOG ? CoachTools.GIFT_CATALOG : []).map(g => {
      return '<button type="button" class="gift-award-btn rarity-' + (g.rarity || 'common') + '" data-action="award-gift" data-player-id="' + p.id + '" data-gift-id="' + g.id + '" style="--art-hue:' + (g.hue != null ? g.hue : 42) + '">' +
        '<span class="gab-ico">' + (g.ico || '🎁') + '</span>' +
        '<span class="gab-label">' + sanitize(g.label || g.id) + '</span>' +
        '</button>';
    }).join('');
    return fifa +
      '<div class="coach-gift-panel card glass" style="' + this._accAttr(p) + '">' +
      '<div class="ct">Подарувати</div>' +
      '<p class="note-sm">Артефакт від тренера стає кольором картки цього гравця.</p>' +
      wornHtml +
      '<label class="note-sm" for="giftMomentNote">Підпис до подарунка</label>' +
      '<input id="giftMomentNote" type="text" maxlength="160" placeholder="Памʼятний момент, необовʼязково">' +
      '<div class="gift-award-grid">' + catalog + '</div></div>';
  },

  players() {
    const s = Store.get();
    const sortKey = (s.ui && s.ui.playerSort) || 'role';
    const sortDir = (s.ui && s.ui.playerSortDir) === 'desc' ? -1 : 1;

    const attPct = (pid) => {
      try {
        if (typeof Views._playerStats === 'function') {
          const st = Views._playerStats(pid);
          return st && st.attPct != null ? st.attPct : 0;
        }
      } catch (_) {}
      try {
        if (typeof LoadModel !== 'undefined' && LoadModel.attendanceRate)
          return Math.round((LoadModel.attendanceRate(pid) || 0) * (LoadModel.attendanceRate(pid) <= 1 ? 100 : 1));
      } catch (_) {}
      return 0;
    };
    const isStarter = (p) => {
      const g = String(p.group || p.squadRole || p.role || '').toLowerCase();
      if (g === 'reserve' || g === 'bench' || g === 'reserves') return false;
      if (g === 'main' || g === 'starter' || g === 'first' || g === 'basis') return true;
      if (p.isStarter === true) return true;
      if (p.isStarter === false || p.onBench) return false;
      if (p.status === 'injured' || p.status === 'rehab' || p.status === 'recovery') return false;
      return true;
    };
    const roleLabel = (p) => isStarter(p) ? 'Основа' : 'Резерв';

    let list = (s.players || []).slice();
    const isCoach = typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach();
    const isPlayerRole = typeof AuthManager !== 'undefined' && AuthManager.isPlayer && AuthManager.isPlayer();
    const mePlayer = (typeof AuthManager !== 'undefined' && AuthManager.getLinkedPlayer)
      ? AuthManager.getLinkedPlayer() : null;

    try {
      if (isPlayerRole && typeof CoachTools !== 'undefined' && CoachTools.playerXpTotal) {
        list = list.slice().sort((a, b) => (CoachTools.playerXpTotal(b.id) || 0) - (CoachTools.playerXpTotal(a.id) || 0));
      } else {
        list.sort((a, b) => {
          const ra = isStarter(a) ? 0 : 1;
          const rb = isStarter(b) ? 0 : 1;
          if (ra !== rb) return ra - rb;
          let cmp = 0;
          if (sortKey === 'number') cmp = (a.number || 0) - (b.number || 0);
          else if (sortKey === 'name') cmp = String(a.lastName || '').localeCompare(String(b.lastName || ''), 'uk');
          else if (sortKey === 'pos') cmp = String(a.position || '').localeCompare(String(b.position || ''), 'uk');
          else if (sortKey === 'att') cmp = attPct(a.id) - attPct(b.id);
          else cmp = (a.number || 0) - (b.number || 0);
          return cmp * sortDir || ((a.number || 0) - (b.number || 0));
        });
      }
    } catch (_) {}

    if (isPlayerRole && mePlayer && typeof this._playerSocialHub === 'function') {
      return this._playerSocialHub(mePlayer, list, attPct) + this._teamChat();
    }
    if (isPlayerRole) {
      const cards = list.map(p => this._squadPlaque(p, attPct(p.id), roleLabel(p))).join('');
      return '<div class="st">Команда</div><div class="pl-cards">' + (cards || '<div class="es">Немає гравців</div>') + '</div>' + this._teamChat();
    }

    if (typeof AuthManager !== 'undefined' && AuthManager.isGuest && AuthManager.isGuest()) {
      const cards = list.map(p => {
        let lv = 1;
        try { lv = PlayerProgress.compute(p.id).level; } catch (_) {}
        return this._squadPlaque(p, attPct(p.id), roleLabel(p) + ' · LVL ' + lv);
      }).join('');
      return '<div class="st">Склад Металіст Штуттгарт</div>' +
        '<p class="note-sm">Тап по картці — акаунт. З акаунта відкривається картка гравця.</p>' +
        '<div class="pl-cards">' + (cards || '<div class="es">Немає гравців</div>') + '</div>';
    }

    if (!isCoach) {
      const cards = list.map(p => this._squadPlaque(p, attPct(p.id), roleLabel(p))).join('');
      return '<div class="st">Склад <span class="note-sm">перегляд</span></div><div class="pl-cards">' +
        (typeof this._coachSquadCard === 'function' ? this._coachSquadCard() : '') +
        (cards || '<div class="es">Немає гравців</div>') + '</div>' + this._teamChat();
    }

    // ── Coach: list / cards ──
    let viewMode = 'list';
    try {
      const u = s.ui || {};
      viewMode = u.squadViewMode || (typeof window !== 'undefined' && window.__squadViewMode) ||
        (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('ms_squad_view')) || 'list';
    } catch (_) {}
    viewMode = viewMode === 'cards' ? 'cards' : 'list';

    const th = (key, label) => {
      const active = sortKey === key ? (sortDir < 0 ? ' ↓' : ' ↑') : '';
      return '<button type="button" class="pl-th' + (sortKey === key ? ' on' : '') + '" data-player-sort="' + key + '">' + label + active + '</button>';
    };

    const starters = list.filter(p => isStarter(p) && !['injured','rehab','recovery'].includes(p.status));
    const reserves = list.filter(p => !isStarter(p) && !['injured','rehab','recovery'].includes(p.status));
    const infirmary = list.filter(p => ['injured','rehab','recovery'].includes(p.status));

    const sectionList = (title, arr, cls) => {
      if (!arr.length) return '';
      const rows = arr.map(p => {
        const att = attPct(p.id);
        return '<div class="pl-row tg-row ' + cls + '" data-player-id="' + p.id + '" data-action="open-player-card" role="button">' +
          '<span class="pl-num">#' + (p.number || '—') + '</span>' +
          '<span class="pl-name">' + sanitize(p.lastName || '') + ' ' + sanitize((p.firstName || '')[0] || '') + '.</span>' +
          '<span class="pl-pos">' + sanitize(p.position || '') + '</span>' +
          '<span class="pl-att">' + att + '%</span></div>';
      }).join('');
      return '<div class="pl-section ' + cls + '"><div class="pl-section-h">' + title + ' · ' + arr.length + '</div>' + rows + '</div>';
    };

    const cardsCoach = list.map(p => this._squadPlaque(p, attPct(p.id), roleLabel(p))).join('');

    const coachStats = (s.coachStats || {});
    const trN = (s.trainings || []).length;
    const doneN = (s.trainings || []).filter(t => t.status === 'done').length;

    const header = '<div class="st">Склад' +
      '<span class="squad-view-toggle" role="group" aria-label="Вигляд складу">' +
        '<button type="button" class="btn-s squad-mode-btn' + (viewMode === 'list' ? ' on' : '') + '" data-action="squad-list" data-mode="list" data-squad-mode="list">Список</button>' +
        '<button type="button" class="btn-s squad-mode-btn' + (viewMode === 'cards' ? ' on' : '') + '" data-action="squad-cards" data-mode="cards" data-squad-mode="cards">Картки</button>' +
      '</span>' +
      '<button class="btn btn-p btn-sm" data-action="new-player">+ Гравець</button></div>';

    const strip = '<div class="coach-stats-strip glass">' +
      '<div class="css-item"><b>' + trN + '</b><span>Тренувань</span></div>' +
      '<div class="css-item"><b>' + doneN + '</b><span>Проведено</span></div>' +
      '</div>';

    if (viewMode === 'cards') {
      return header + strip +
        '<p class="note-sm">Тап — акаунт. З акаунта — картка гравця. Перемикач Список / Картки зверху.</p>' +
        '<div class="pl-cards">' +
        (typeof this._coachSquadCard === 'function' ? this._coachSquadCard() : '') +
        (cardsCoach || '<div class="es">Немає гравців</div>') +
        '</div>' + this._teamChat();
    }

    return header + strip +
      '<p class="note-sm">Тап — акаунт. З акаунта — картка гравця. Колір і візерунок подарунка лише в режимі карток.</p>' +
      sectionList('Основа', starters, 'pl-starters') +
      sectionList('Резерв', reserves, 'pl-reserve') +
      sectionList('Лазарет', infirmary, 'pl-infirmary') +
      (!starters.length && !reserves.length && !infirmary.length ? '<div class="es">Немає гравців</div>' : '') +
      this._teamChat();
  },

  _schemeCard(b, opts) {
    const editable = !!(opts && opts.editable);
    const title = sanitize((b && (b.name || b.title)) || 'Схема');
    const typ = sanitize((b && (b.type || b.kind || b.schemeType)) || 'тактика');
    const desc = String((b && (b.description || b.notes || b.text)) || '').trim();
    const id = sanitize(String((b && b.id) || ''));
    const thumb = (typeof this._schemeThumbSvg === 'function') ? this._schemeThumbSvg(b) : '📐';
    const actions = editable
      ? '<div class="scheme-card-actions">' +
          '<button type="button" class="btn btn-s btn-sm" data-action="edit-scheme" data-board-id="' + id + '">Редагувати</button>' +
          '<button type="button" class="btn btn-s btn-sm scheme-card-del" data-action="delete-scheme" data-board-id="' + id + '">Видалити</button>' +
        '</div>'
      : '';
    return '<article class="scheme-card glass" data-board-id="' + id + '">' +
      '<button type="button" class="scheme-card-openbtn" data-action="load-scheme-board" data-board-id="' + id + '">' +
        '<div class="scheme-card-thumb">' + thumb + '</div>' +
        '<div class="scheme-card-body">' +
          '<div class="scheme-card-title">' + title + '</div>' +
          '<div class="scheme-card-meta">' + typ + (desc ? ' · є опис' : '') + '</div>' +
        '</div></button>' +
      '<div class="scheme-card-detail">' +
        '<p class="scheme-card-desc">' + (desc ? sanitize(desc) : 'Опису ще немає.') + '</p>' +
        actions +
      '</div></article>';
  },

  tactics() {
    const s = Store.get();
    const boards = (s.boards || []).slice().sort((a, b) =>
      String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''))
    );
    const canEdit = typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach();
    const cards = boards.map(b => this._schemeCard(b, { editable: canEdit })).join('');
    const hint = canEdit
      ? '<p class="note-sm">Утримуйте мініатюру — повний опис, редагування і видалення. Короткий тап відкриває схему на дошці.</p>'
      : '<p class="note-sm">Утримуйте мініатюру, щоб прочитати повний опис. Короткий тап відкриває схему на дошці.</p>';
    return '<div class="st">Схеми' + (canEdit ? ' <button class="btn btn-p btn-sm" data-action="new-board">+ Схема</button>' : '') + '</div>' +
      hint +
      '<div class="scheme-cards">' + (cards || '<div class="es">Немає збережених схем</div>') + '</div>';
  },

  calendar() {
    const s = Store.get();
    const ui = s.ui || {};
    const anchor = ui.calDate ? new Date(ui.calDate + 'T12:00:00') : new Date();
    if (isNaN(anchor.getTime())) anchor.setTime(Date.now());
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    const first = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const startPad = (first.getDay() + 6) % 7; // Mon=0
    const todayStr = (typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10));
    const monthName = first.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
    const normTitle = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const normType = (v) => {
      const x = String(v || 'event').toLowerCase();
      if (x === 'training' || x === 'train') return 'training';
      if (x === 'match') return 'match';
      return x;
    };
    const isCancel = (st) => st === 'cancelled' || st === 'canceled';

    const events = [];
    const seen = new Set();
    const pushEvent = (e) => {
      const key = e.date + '|' + normType(e.type) + '|' + normTitle(e.title);
      if (seen.has(key)) return;
      seen.add(key);
      events.push(e);
    };
    (s.trainings || []).forEach(tr => {
      if (!tr || !tr.date || tr.deleted || tr.removed) return;
      pushEvent({ date: tr.date, type: 'training', status: tr.status || 'planned', title: tr.name || 'Тренування', id: tr.id });
    });
    (s.calendar || []).forEach(ev => {
      if (!ev || !ev.date || ev.deleted || ev.removed) return;
      if (ev.trainingId && (s.trainings || []).some(t => t && t.id === ev.trainingId)) return;
      pushEvent({ date: ev.date, type: normType(ev.type || 'event'), status: ev.status || '', title: ev.title || 'Подія', id: ev.id });
    });
    (s.matches || []).forEach(mt => {
      if (!mt || !mt.date) return;
      pushEvent({ date: mt.date, type: 'match', status: '', title: mt.opponent ? ('vs ' + mt.opponent) : 'Матч', id: mt.id });
    });

    const byDate = {};
    events.forEach(e => {
      if (!byDate[e.date]) byDate[e.date] = [];
      byDate[e.date].push(e);
    });

    const selDay = (s.ui && s.ui.selectedDay) || '';
    let cells = '';
    for (let i = 0; i < startPad; i++) cells += '<div class="cal-cell cd cal-empty om"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const dayEv = byDate[ds] || [];
      const isToday = ds === todayStr;
      const isSel = ds === selDay;
      let dots = '';
      dayEv.forEach(e => {
        let cls = 'cal-dot';
        if (e.type === 'training' && e.status === 'done') cls += ' cal-dot-done';
        else if (e.type === 'training' && isCancel(e.status)) cls += ' cal-dot-cancel';
        else if (e.type === 'training') cls += ' cal-dot-plan';
        else if (e.type === 'match') cls += ' cal-dot-match';
        else cls += ' cal-dot-ev';
        dots += '<span class="' + cls + '"></span>';
      });
      cells += '<button type="button" class="cal-cell cd' + (isToday ? ' cal-today today' : '') + (isSel ? ' cal-selected' : '') + (dayEv.length ? ' has-ev has' : '') + '" data-day="' + ds + '">' +
        '<span class="cal-d">' + d + '</span><span class="cal-dots">' + dots + '</span></button>';
    }

    let dayDetail = '';
    if (selDay) {
      const dayEv = byDate[selDay] || [];
      if (dayEv.length) {
        dayDetail = '<div class="card glass cal-day-detail"><div class="ct">' + sanitize(selDay) + '</div>' +
          dayEv.map(e => {
            let extra = '';
            if (e.type === 'training') {
              const tr = (s.trainings || []).find(t => t.id === e.id);
              if (tr) {
                const att = tr.attendance || {};
                const keys = Object.keys(att);
                let present = 0;
                keys.forEach(k => { if (att[k] && att[k].present !== false) present++; });
                const loads = keys.map(k => (att[k] && att[k].intensity) || 0).filter(Boolean);
                const avgLoad = loads.length ? (loads.reduce((a,b)=>a+b,0)/loads.length).toFixed(1) : '—';
                extra = ' · відв. ' + present + '/' + (keys.length || '—') + ' · навантаження ' + avgLoad;
              }
            }
            return '<div class="cal-ev-row">' + sanitize(e.title) +
              ' <span class="note-sm">(' + sanitize(e.type) + (e.status ? ', ' + e.status : '') + extra + ')</span></div>';
          }).join('') + '</div>';
      } else {
        dayDetail = '<div class="card glass cal-day-detail"><div class="ct">' + sanitize(selDay) + '</div><p class="note-sm">Немає подій</p></div>';
      }
    }

    return '<div class="st">Календар</div>' +
      '<div class="card glass cal-card"><div class="cal-nav">' +
      '<button type="button" class="btn btn-s btn-sm cal-nav-btn" data-action="cal-prev" aria-label="Попередній місяць">‹</button>' +
      '<div class="cal-month">' + sanitize(monthName) + '</div>' +
      '<button type="button" class="btn btn-s btn-sm cal-nav-btn" data-action="cal-next" aria-label="Наступний місяць">›</button>' +
      '</div>' +
      '<div class="cal-weekdays cg">' +
      '<span class="cdn" title="Понеділок">Пн</span>' +
      '<span class="cdn" title="Вівторок">Вт</span>' +
      '<span class="cdn" title="Середа">Ср</span>' +
      '<span class="cdn" title="Четвер">Чт</span>' +
      '<span class="cdn" title="П\'ятниця">Пт</span>' +
      '<span class="cdn" title="Субота">Сб</span>' +
      '<span class="cdn" title="Неділя">Нд</span></div>' +
      '<div class="cal-grid cg">' + cells + '</div></div>' +
      dayDetail +
      '<p class="note-sm">● заплановане · ✓ проведено · ✕ скасовано</p>';
  },

  matches() {
    const s = Store.get();
    const list = (s.matches || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const canEdit = typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach();
    const rows = list.map(m => {
      return '<div class="card glass" data-view-match="' + (m.id || '') + '">' +
        '<div class="ct">' + sanitize(m.date || '') + ' · ' + sanitize(m.opponent || 'Суперник') + '</div>' +
        '<div class="note-sm">' + sanitize(m.competition || '') + (m.score ? (' · ' + sanitize(m.score)) : '') + '</div></div>';
    }).join('');
    return '<div class="st">Матчі' + (canEdit ? ' <button class="btn btn-p btn-sm" data-action="new-match">+ Матч</button>' : '') + '</div>' +
      (rows || '<div class="es">Немає матчів</div>');
  },

  _analyticsCharts(players, getSt) {
    const s = Store.get();
    const all = s.trainings || [];
    const isCancel = (t) => t && (t.status === 'cancelled' || t.status === 'canceled');
    const done = all.filter(t => t && t.status === 'done');
    const planned = all.filter(t => t && (t.status === 'planned' || t.status === 'draft' || !t.status) && !isCancel(t) && t.status !== 'done');
    const cancelled = all.filter(isCancel);
    const sessions = done.slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))).slice(-12);

    const sessionStats = sessions.map(t => {
      const att = t.attendance || {};
      const ids = Object.keys(att);
      let present = 0;
      const rpes = [];
      ids.forEach(k => {
        const a = att[k];
        if (!a) return;
        if (a.present !== false) present++;
        const r = a.rpe != null ? Number(a.rpe) : (a.intensity != null ? Number(a.intensity) : NaN);
        if (isFinite(r)) rpes.push(r);
      });
      const attPct = ids.length ? Math.round(present / ids.length * 100) : 0;
      const avgRpe = rpes.length ? rpes.reduce((x, y) => x + y, 0) / rpes.length : (Number(t.intensity) || 0);
      let load = 0;
      try {
        load = (typeof LoadModel !== 'undefined' && LoadModel.sessionLoad)
          ? LoadModel.sessionLoad(t.duration, avgRpe || t.intensity)
          : ((Number(t.duration) || 0) * (Number(avgRpe || t.intensity) || 0));
      } catch (_) { load = 0; }
      const label = String(t.date || '').slice(5);
      return { label, attPct, avgRpe: Math.round(avgRpe * 10) / 10, load };
    });

    const line = (values, color, id, maxHint) => {
      const w = 320, h = 120;
      const nums = values.map(v => Number(v) || 0);
      if (!nums.length) return '<div class="an-empty">Немає точок</div>';
      const max = Math.max(maxHint || 0, ...nums, 1);
      const step = nums.length > 1 ? (w - 28) / (nums.length - 1) : 0;
      const pts = nums.map((v, i) => {
        const x = 14 + i * step;
        const y = h - 22 - (v / max) * (h - 36);
        return [x, y, v];
      });
      const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
      const area = d + ' L' + pts[pts.length - 1][0].toFixed(1) + ',' + (h - 22) + ' L' + pts[0][0].toFixed(1) + ',' + (h - 22) + ' Z';
      const dots = pts.map(p => '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" fill="' + color + '"><title>' + p[2] + '</title></circle>').join('');
      const labels = pts.map((p, i) => '<text x="' + p[0].toFixed(1) + '" y="' + (h - 6) + '" text-anchor="middle" fill="#9aa4b2" font-size="9">' + sanitize(sessionStats[i].label) + '</text>').join('');
      return '<svg class="an-svg" viewBox="0 0 ' + w + ' ' + h + '" role="img">' +
        '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.45"/>' +
        '<stop offset="100%" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
        '<path d="' + area + '" fill="url(#' + id + ')"/>' +
        '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
        dots + labels + '</svg>';
    };

    const bars = (values, color) => {
      const w = 320, h = 120;
      if (!values.length) return '<div class="an-empty">Немає точок</div>';
      const max = Math.max(...values.map(v => Number(v) || 0), 1);
      const gap = 6;
      const bw = Math.max(8, (w - 20 - gap * values.length) / values.length);
      const rects = values.map((v, i) => {
        const val = Number(v) || 0;
        const bh = Math.max(2, (val / max) * (h - 36));
        const x = 10 + i * (bw + gap);
        const y = h - 22 - bh;
        return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="4" fill="' + color + '"><title>' + val + '</title></rect>' +
          '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (h - 6) + '" text-anchor="middle" fill="#9aa4b2" font-size="9">' + sanitize(sessionStats[i].label) + '</text>';
      }).join('');
      return '<svg class="an-svg" viewBox="0 0 ' + w + ' ' + h + '" role="img">' + rects + '</svg>';
    };

    const hbars = (rows, colorOf) => {
      if (!rows.length) return '<div class="an-empty">Немає даних</div>';
      const ordered = rows.slice().sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
      const max = Math.max(...ordered.map(r => Number(r.value) || 0), 1);
      return '<div class="an-hbars">' + ordered.map(r => {
        const pct = Math.max(0, Math.min(100, ((Number(r.value) || 0) / max) * 100));
        const color = colorOf ? colorOf(r) : '#c8a84b';
        return '<div class="an-hbar-row"><span class="an-hbar-name">' + sanitize(r.label) + '</span>' +
          '<span class="an-hbar-track"><span class="an-hbar-fill" style="width:' + pct.toFixed(1) + '%;background:' + color + '"></span></span>' +
          '<span class="an-hbar-val">' + sanitize(String(r.text != null ? r.text : r.value)) + '</span></div>';
      }).join('') + '</div>';
    };

    const donut = (slices) => {
      const total = slices.reduce((a, sl) => a + sl.value, 0);
      if (!total) return '<div class="an-empty">Немає даних</div>';
      const r = 42, c = 2 * Math.PI * r;
      let off = 0;
      const arcs = slices.filter(sl => sl.value > 0).map(sl => {
        const len = (sl.value / total) * c;
        const el = '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="' + sl.color + '" stroke-width="14" stroke-dasharray="' + len.toFixed(2) + ' ' + (c - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 60 60)"/>';
        off += len;
        return el;
      }).join('');
      const legend = slices.map(sl => '<div><i style="background:' + sl.color + '"></i>' + sanitize(sl.label) + ' · ' + sl.value + '</div>').join('');
      return '<div class="an-donut-wrap"><svg class="an-donut" viewBox="0 0 120 120" role="img">' + arcs +
        '<text x="60" y="64" text-anchor="middle" fill="#fff" font-size="16" font-weight="700">' + total + '</text></svg>' +
        '<div class="an-legend">' + legend + '</div></div>';
    };

    const names = players.map(p => {
      const st = getSt(p.id);
      const label = [p.lastName, (p.firstName || '')[0]].filter(Boolean).join(' ') || p.name || ('#' + (p.number || ''));
      const acc = this._accountAccent(p);
      return { p, st, label, color: acc.ring };
    });

    const posMap = {};
    const posColor = { GK: '#f1c40f', DEF: '#3498db', MID: '#2ecc71', ATT: '#e74c3c', IN: '#9b59b6' };
    players.forEach(p => {
      const pos = String(p.position || '').toUpperCase();
      let key = 'IN';
      if (pos.includes('GK')) key = 'GK';
      else if (/CB|LB|RB|WB|DEF/.test(pos)) key = 'DEF';
      else if (/CM|DM|AM|LM|RM|MID/.test(pos)) key = 'MID';
      else if (/ST|CF|LW|RW|SS|FW|ATT/.test(pos)) key = 'ATT';
      posMap[key] = (posMap[key] || 0) + 1;
    });
    const posLabels = { GK: 'Воротарі', DEF: 'Захист', MID: 'Півзахист', ATT: 'Атака', IN: 'Інші' };

    const readyRows = names.map(n => ({
      label: n.label,
      value: Number(n.p.readiness != null ? n.p.readiness : (n.p.condition != null ? n.p.condition : 0)) || 0,
      color: n.color
    })).filter(r => r.value > 0);

    const card = (title, sub, body, wide) =>
      '<div class="card glass an-chart' + (wide ? ' an-chart-wide' : '') + '"><div class="ct">' + title + '</div>' +
      (sub ? ('<p class="note-sm">' + sub + '</p>') : '') + body + '</div>';

    const presentSum = names.reduce((a, n) => a + (n.st.present || 0), 0);
    const absentSum = names.reduce((a, n) => a + (n.st.absent || 0), 0);

    return '<div class="an-charts">' +
      card('Відвідуваність команди', 'Частка присутніх на останніх сесіях, %', line(sessionStats.map(x => x.attPct), '#2ecc71', 'anAtt', 100), true) +
      card('RPE сесій', 'Середня інтенсивність на тренуванні', line(sessionStats.map(x => x.avgRpe), '#e8c547', 'anRpe', 10)) +
      card('Навантаження сесій', 'Тривалість × RPE', bars(sessionStats.map(x => x.load), '#3b82f6')) +
      card('Відвідуваність гравців', 'Хто тримає ритм сезону', hbars(names.map(n => ({ label: n.label, value: n.st.attPct || 0, text: (n.st.attPct != null ? n.st.attPct + '%' : '—'), color: n.color })), r => r.color)) +
      card('RPE гравців', 'Середнє відчуття навантаження', hbars(names.map(n => ({ label: n.label, value: n.st.avgRpe || 0, text: n.st.avgRpe != null ? n.st.avgRpe : '—', color: n.color })), r => r.color)) +
      card('Навантаження 28 днів', 'Сумарний load', hbars(names.map(n => ({ label: n.label, value: n.st.load28 || 0, color: n.color })), r => r.color)) +
      card('Подарунки', 'Скільки артефактів у кожного', hbars(names.map(n => ({ label: n.label, value: (s.gifts || []).filter(g => g && g.playerId === n.p.id).length, color: n.color })), r => r.color)) +
      card('Готовність', 'Стан з анкети гравця', readyRows.length ? hbars(readyRows, r => r.color) : '<div class="an-empty">Готовність ще не заповнена</div>') +
      card('Амплуа', 'Розподіл складу', donut(['GK', 'DEF', 'MID', 'ATT', 'IN'].filter(k => posMap[k]).map(k => ({ label: posLabels[k], value: posMap[k], color: posColor[k] })))) +
      card('Статус тренувань', 'План, факт і скасовані', donut([
        { label: 'Проведено', value: done.length, color: '#2ecc71' },
        { label: 'Заплановано', value: planned.length, color: '#f5c542' },
        { label: 'Скасовано', value: cancelled.length, color: '#e74c3c' }
      ])) +
      card('Присутні та пропуски', 'Сума відміток по всьому складу', donut([
        { label: 'Присутні', value: presentSum, color: '#2ecc71' },
        { label: 'Відсутні', value: absentSum, color: '#e74c3c' }
      ])) +
      '</div>';
  },

  analytics() {
    const s = Store.get();
    let players = (s.players || []).slice();
    const trainings = (s.trainings || []).filter(t => t.status === 'done');
    const sortKey = (s.ui && s.ui.playerSort) || 'name';
    const sortDir = (s.ui && s.ui.playerSortDir) === 'desc' ? -1 : 1;
    const statsCache = {};
    const getSt = (pid) => {
      if (!statsCache[pid]) {
        try { statsCache[pid] = (typeof Views._playerStats === 'function' ? Views._playerStats(pid) : {}) || {}; }
        catch (_) { statsCache[pid] = {}; }
      }
      return statsCache[pid];
    };
    const giftCount = (pid) => (s.gifts || []).filter(g => g && g.playerId === pid).length;
    players.sort((a, b) => {
      const sa = getSt(a.id), sb = getSt(b.id);
      let va, vb;
      if (sortKey === 'att') { va = sa.attPct ?? -1; vb = sb.attPct ?? -1; }
      else if (sortKey === 'visits') { va = sa.present || 0; vb = sb.present || 0; }
      else if (sortKey === 'rpe') { va = sa.avgRpe ?? -1; vb = sb.avgRpe ?? -1; }
      else if (sortKey === 'load') { va = sa.load28 ?? -1; vb = sb.load28 ?? -1; }
      else if (sortKey === 'gifts') { va = giftCount(a.id); vb = giftCount(b.id); }
      else {
        va = [a.lastName, a.firstName, a.name].filter(Boolean).join(' ').toLowerCase();
        vb = [b.lastName, b.firstName, b.name].filter(Boolean).join(' ').toLowerCase();
        return String(va).localeCompare(String(vb), 'uk') * sortDir;
      }
      if (va === vb) return 0;
      return (va > vb ? 1 : -1) * sortDir;
    });
    let attSum = 0, attN = 0, presentSum = 0;
    players.forEach(p => {
      const st = getSt(p.id);
      if (st.attPct != null && isFinite(st.attPct)) { attSum += Number(st.attPct); attN++; }
      presentSum += st.present || 0;
    });
    const avgAtt = attN ? Math.round(attSum / attN) : 0;
    const rows = players.map(p => {
      const st = getSt(p.id);
      const name = [p.lastName, p.firstName].filter(Boolean).join(' ') || p.name || ('#' + p.number);
      const gifts = giftCount(p.id);
      return '<div class="an-row" data-player-id="' + p.id + '" data-action="open-player-card">' +
        '<span class="an-name">' + sanitize(name) + '</span>' +
        '<span class="an-att">' + (st.attPct != null ? st.attPct + '%' : '—') + '</span>' +
        '<span class="an-visits">' + (st.present || 0) + '/' + ((st.present || 0) + (st.absent || 0)) + '</span>' +
        '<span class="an-rpe">' + (st.avgRpe != null ? st.avgRpe : '—') + '</span>' +
        '<span class="an-load">' + (st.load28 != null ? st.load28 : '—') + '</span>' +
        '<span class="an-gifts">' + gifts + '</span></div>';
    }).join('');
    const guest = typeof AuthManager !== 'undefined' && AuthManager.isGuest && AuthManager.isGuest();
    return '<div class="st">' + (guest ? 'Статистика' : 'Аналітика') + '</div>' +
      '<div class="card glass an-summary"><div class="ct">Проведені тренування: <b>' + trainings.length + '</b></div>' +
      '<div class="an-summary-line">Середня відвідуваність <b>' + avgAtt + '%</b> · візити <b>' + presentSum + '</b></div></div>' +
      this._analyticsCharts(players, getSt) +
      '<div class="card glass an-table">' +
      '<div class="an-head">' +
        '<span class="an-name">Гравець</span>' +
        '<button type="button" class="an-th" data-player-sort="att">Відв.%</button>' +
        '<button type="button" class="an-th" data-player-sort="visits">Візити</button>' +
        '<button type="button" class="an-th" data-player-sort="rpe">RPE</button>' +
        '<button type="button" class="an-th" data-player-sort="load">Load</button>' +
        '<button type="button" class="an-th" data-player-sort="gifts">Подарунки</button>' +
      '</div>' +
      '<div class="an-body">' + (rows || '<div class="es">Немає даних</div>') + '</div></div>';
  },

  settings() {
    const s = Store.get();
    const set = s.settings || {};
    const social = set.social || {};
    const canEdit = typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach();
    const ro = canEdit ? '' : 'readonly';
    const dis = canEdit ? '' : 'disabled';
    const photoUrl = (set.coachPhoto && /^https?:\/\//i.test(set.coachPhoto)) ? set.coachPhoto : '';
    const mediaLines = (Array.isArray(set.guestMedia) ? set.guestMedia : []).map(m => {
      if (typeof m === 'string') return m;
      return (m && (m.url || m.src)) || '';
    }).filter(Boolean).join('\n');
    const checked = (on) => on ? 'checked' : '';
    return `
      <div class="st">Налаштування</div>
      <div class="card glass settings-card">
        <div class="ct">Клуб</div>
        <div class="settings-form">
          <label class="fl"><span class="fl-label">Назва</span>
            <input type="text" id="setClubName" class="fl-input" value="${sanitize(set.clubName || 'МЕТАЛІСТ ШТУТТГАРТ')}" ${ro}>
          </label>
          <label class="fl"><span class="fl-label">Коротко</span>
            <input type="text" id="setClubShort" class="fl-input" value="${sanitize(set.clubShort || 'МШ')}" ${ro}>
          </label>
          <div class="settings-colors">
            <label class="fl"><span class="fl-label">Основний колір</span>
              <input type="color" id="setPrimary" value="${sanitize(set.primary || '#1a3a5c')}" ${dis}>
            </label>
            <label class="fl"><span class="fl-label">Акцент</span>
              <input type="color" id="setAccent" value="${sanitize(set.accent || '#c8a84b')}" ${dis}>
            </label>
          </div>
          <label class="fl"><span class="fl-label">Логотип</span>
            <input type="file" id="setLogo" accept="image/*" ${dis}>
          </label>
        </div>
      </div>
      <div class="card glass settings-card">
        <div class="ct">Тренер</div>
        <div class="settings-form">
          <label class="fl"><span class="fl-label">Ім’я</span>
            <input type="text" id="setCoachName" class="fl-input" value="${sanitize(set.coachName || 'Artem Serdiuk')}" ${ro}>
          </label>
          <label class="fl"><span class="fl-label">Фото (посилання https)</span>
            <input type="url" id="setCoachPhoto" class="fl-input" placeholder="https://" value="${sanitize(photoUrl)}" ${ro}>
          </label>
          <label class="fl"><span class="fl-label">Або файл фото</span>
            <input type="file" id="setCoachPhotoFile" accept="image/*" ${dis}>
          </label>
        </div>
      </div>
      <div class="card glass settings-card">
        <div class="ct">Тренування</div>
        <div class="settings-form">
          <label class="fl"><span class="fl-label">Тривалість, хв</span>
            <input type="number" id="setDur" class="fl-input" min="15" max="240" value="${Number(set.defaultDuration) || 90}" ${dis}>
          </label>
          <label class="fl"><span class="fl-label">Інтенсивність 1–10</span>
            <input type="number" id="setInt" class="fl-input" min="1" max="10" value="${Number(set.defaultIntensity) || 6}" ${dis}>
          </label>
          <label class="fl fl-check"><input type="checkbox" id="setAuto" ${checked(set.autosave !== false)} ${dis}> Автозбереження</label>
          <label class="fl fl-check"><input type="checkbox" id="setSound" ${checked(set.sound !== false)} ${dis}> Звук</label>
          ${canEdit ? '<button type="button" class="btn btn-p" data-action="save-settings">Зберегти</button>' : '<p class="note-sm">Змінює лише тренер. Ваш екран підхопить їх сам.</p>'}
        </div>
      </div>
      <div class="card glass settings-card">
        <div class="ct">Гості: соцмережі і медіа</div>
        <div class="settings-form">
          <label class="fl"><span class="fl-label">Telegram</span>
            <input type="url" id="setTgChannel" class="fl-input" value="${sanitize(social.telegram || set.telegramChannel || '')}" ${ro}>
          </label>
          <label class="fl"><span class="fl-label">Instagram</span>
            <input type="url" id="setIg" class="fl-input" value="${sanitize(social.instagram || set.instagram || '')}" ${ro}>
          </label>
          <label class="fl"><span class="fl-label">YouTube</span>
            <input type="url" id="setYt" class="fl-input" value="${sanitize(social.youtube || set.youtube || '')}" ${ro}>
          </label>
          <label class="fl"><span class="fl-label">Медіа для гостей, одне посилання на рядок</span>
            <textarea id="setGuestMedia" class="fl-input" rows="4" ${ro}>${sanitize(mediaLines)}</textarea>
          </label>
          ${canEdit ? '<button type="button" class="btn btn-p" data-action="save-settings">Зберегти</button>' : ''}
        </div>
      </div>
      <div class="card glass settings-card">
        <div class="ct">Дані клубу</div>
        <p class="note-sm">Спільні дані — файл club.json. Експортуйте JSON, замініть ним club.json у репозиторії й запуште. Усі в Telegram отримають цей файл.</p>
        <p class="note-sm" id="clubSyncLine">${sanitize((typeof StorageManager !== 'undefined' && StorageManager._clubSyncText) || 'Клубний обмін: підключення…')}</p>
        <div class="settings-actions">
          <button type="button" class="btn btn-s" data-action="export-json">Експорт JSON</button>
          <button type="button" class="btn btn-s" data-action="import-trigger" id="btnImportJson">Імпорт JSON</button>
        </div>
        <p class="note-sm" id="tgStatusLine">—</p>
        <p class="note-sm" id="rbacMe">—</p>
      </div>
      <div class="card glass settings-card">
        <div class="ct">Мова</div>
        <div class="settings-actions">
          <button type="button" class="btn btn-s" data-action="lang-uk">Українська</button>
          <button type="button" class="btn btn-s" data-action="lang-de">Deutsch</button>
        </div>
      </div>
      <p class="note-sm">Оновлено ${this.APP_UPDATED} · збірка ${this.APP_BUILD}</p>
    `;
  },

  diary() {
    const s = Store.get();
    const canEdit = typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach();
    const list = (s.diary || []).slice().sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')));
    const rows = list.map(d => {
      return '<div class="card glass" data-edit-diary="' + (d.id || '') + '">' +
        '<div class="ct">' + sanitize(d.title || 'Запис') + '</div>' +
        '<div class="note-sm">' + sanitize(d.date || '') + '</div>' +
        '<p>' + sanitize((d.text || d.body || '').slice(0, 160)) + '</p></div>';
    }).join('');
    return '<div class="st">Щоденник' + (canEdit ? ' <button class="btn btn-p btn-sm" data-action="new-diary">+ Запис</button>' : '') + '</div>' +
      (rows || '<div class="es">Щоденник порожній</div>');
  },
};

