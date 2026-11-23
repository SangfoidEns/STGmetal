/** Extracted module: src/ui/views.js lines 1491-1818 — DO NOT rewrite business logic */
const Views = {
  APP_BUILD: 'z127',
  APP_UPDATED: '14.11.2026',
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

  versionLabel() {
    return String(this.APP_BUILD || '').replace(/^z/i, '');
  },

  _isSeed(player) {
    try {
      return !!(player && typeof ClubMerge !== 'undefined' && ClubMerge.isSeedPlayer && ClubMerge.isSeedPlayer(player));
    } catch (_) { return false; }
  },

  _livePlayers(list) {
    return (list || []).filter(p => p && p.id != null && !this._isSeed(p));
  },

  _pitchBar() {
    try { return (typeof SessionPlay !== 'undefined' && SessionPlay.meterHtml) ? SessionPlay.meterHtml() : ''; }
    catch (_) { return ''; }
  },

  isHeadCoach() {
    return typeof AuthManager !== 'undefined' && AuthManager._canWriteClub && AuthManager._canWriteClub();
  },

  /** Нова емблема лише в головного тренера. У решти лишається основний герб. */
  clubMark() {
    return this.isHeadCoach() ? 'assets/coach-crest.png' : 'assets/metalist-crest.png';
  },

  _crestHtml(src, letters) {
    if (src) return '<img src="' + sanitize(src) + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block">';
    return '<span>' + sanitize(letters || '—') + '</span>';
  },

  _matchPlaque(m, opts) {
    if (!m) return '';
    const o = opts || {};
    const s = Store.get();
    const short = o.clubShort || (s.settings && s.settings.clubShort) || 'МШ';
    const clubLogo = o.clubLogo || (s.settings && s.settings.logoData) || this.clubMark();
    const opp = m.opponent || 'Суперник';
    const letters = String(opp).replace(/[^A-Za-zА-Яа-яІіЇїЄєҐґ0-9]/g, '').slice(0, 3).toUpperCase() || 'VS';
    const dateBits = String(m.date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const dateLabel = dateBits ? (dateBits[3] + '.' + dateBits[2] + '.' + dateBits[1]) : (m.date || '');
    const when = [dateLabel, m.time].filter(Boolean).join(' · ');
    const where = m.home === false ? 'Виїзд' : 'Дім';
    const comp = [m.competition, where].filter(Boolean).join(' · ') || where;
    const score = (m.scoreUs != null && m.scoreUs !== '' && m.scoreThem != null && m.scoreThem !== '')
      ? (m.scoreUs + ' : ' + m.scoreThem) : '';
    const kicker = o.kicker || (score ? 'Рахунок' : 'Наступний матч');
    const open = o.plain
      ? '<div class="match-plaque">'
      : ('<button type="button" class="match-plaque" data-action="open-match" data-match-id="' + sanitize(m.id || '') + '">');
    return open +
      '<span class="match-plaque-side">' +
        '<span class="match-plaque-crest">' + this._crestHtml(clubLogo, short) + '</span>' +
        '<span class="match-plaque-name">' + sanitize(short) + '</span>' +
      '</span>' +
      '<span class="match-plaque-mid">' +
        '<span class="match-plaque-kicker">' + sanitize(kicker) + '</span>' +
        '<span class="match-plaque-vs">' + (score ? sanitize(score) : 'VS') + '</span>' +
        '<span class="match-plaque-when">' + sanitize(when || 'дата уточнюється') + '</span>' +
        '<span class="match-plaque-comp">' + sanitize(comp) + '</span>' +
      '</span>' +
      '<span class="match-plaque-side is-opp">' +
        '<span class="match-plaque-crest is-opp">' + this._crestHtml(m.opponentLogo, letters) + '</span>' +
        '<span class="match-plaque-name">' + sanitize(opp) + '</span>' +
      '</span>' +
    (o.plain ? '</div>' : '</button>');
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
        <p class="note-sm">Попросіть тренера перевірити Telegram-нік. Клуб прийде із сервера, коли є код.</p>
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
      take = source.slice(0, 3);
      slots = [{ x: -22, y: -16 }, { x: 22, y: -16 }, { x: 0, y: -24 }];
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
        '" data-gift-id="' + (g.giftId || '') + '" data-action="inspect-artifact" data-gift-uid="' + (g.uid || g.id || '') + '" role="button" tabindex="0">' +
        art + '</span>';
      if ((mode || 'full') === 'full') {
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
    const hue = this._gh(featured);
    return '<span class="gift-status-badge" style="--art-hue:' + hue + '" title="' +
      sanitize(this._gl(featured) || '') + '"><span class="gsb-ico">' + (featured.ico || '★') + '</span></span>';
  },


  _coachPhotoSources() {
    const set = (Store.get() && Store.get().settings) || {};
    const list = [];
    const push = (url) => {
      const value = String(url || '').trim();
      if (!value || list.indexOf(value) >= 0) return;
      list.push(value);
    };
    push(set.coachPhoto);
    push(set.coachPhotoUrl);
    try {
      const coach = typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach();
      if (!coach) return list;
      if (typeof TelegramManager !== 'undefined' && TelegramManager.getUser) {
        const u = TelegramManager.getUser();
        if (u) push(u.photo_url || u.photoUrl);
      }
      if (typeof AuthManager !== 'undefined' && AuthManager.user) {
        const u = AuthManager.user;
        push(u.photo_url || u.photoUrl);
      }
    } catch (_) {}
    return list;
  },

  _photoTag(sources, initials) {
    const list = sources || [];
    const letters = sanitize(initials || 'AS');
    if (!list.length) return '<span class="cp-avatar-ph">' + letters + '</span>';
    const rest = list.slice(1).map(encodeURIComponent).join('|');
    return '<img src="' + sanitize(list[0]) + '" alt="" referrerpolicy="no-referrer" data-fallback="' + sanitize(rest) + '" onerror="App.photoFallback(this)"/><span class="cp-avatar-ph" style="display:none">' + letters + '</span>';
  },

  _coachSquadCard() {
    const s = Store.get();
    const set = s.settings || {};
    // Картка тренера ЗАВЖДИ з налаштувань клубу — НЕ з сесії поточного гравця
    let name = (set.coachName && String(set.coachName).trim()) || 'Artem Serdiuk';
    const sources = this._coachPhotoSources();
    const photo = sources[0] || '';
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
    const ph = this._photoTag(sources, initials);
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
      let name = (s.settings && s.settings.coachName && String(s.settings.coachName).trim()) || '';
      try {
        const inTelegram = typeof AuthManager !== 'undefined' && AuthManager.user;
        if (!name && inTelegram) name = AuthManager.displayName() || '';
        if (!name) name = 'Artem Serdiuk';
        if (typeof TelegramManager !== 'undefined') {
          const u = TelegramManager.getUser && TelegramManager.getUser();
          if (u && (u.first_name || u.last_name)) name = [u.first_name, u.last_name].filter(Boolean).join(' ');
        }
      } catch (_) {}
      const photo = (this._coachPhotoSources()[0]) || '';
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
    const next = this._nextPlanned(s.trainings);
    const weekLoad = LoadModel.weeklyLoad(s.trainings);
    const pastForStats = (typeof LoadModel !== 'undefined' && LoadModel.pastTrainings)
      ? LoadModel.pastTrainings(s.trainings) : s.trainings.filter(t => t.date && t.date <= today() && t.status !== 'cancelled');
    const activity = (typeof LoadModel !== 'undefined' && LoadModel.dayActivity)
      ? LoadModel.dayActivity(s.trainings, s.matches) : [];
    const totalMin = activity.reduce((a, d) => a + (d.minutes || 0), 0);
    const totalHours = Math.round(totalMin / 60 * 10) / 10;
    const matchDays = activity.reduce((a, d) => a + (d.matches || 0), 0);
    const todayStr = (typeof CoachTools !== 'undefined' && CoachTools.berlinToday) ? CoachTools.berlinToday() : today();
    const nextMatch = (typeof CoachTools !== 'undefined' && CoachTools.nextMatch)
      ? CoachTools.nextMatch(s.matches)
      : (s.matches || []).filter(m => m && m.date >= todayStr && m.status !== 'played' && m.status !== 'cancelled' && m.status !== 'canceled').sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
    const pastMatch = (typeof CoachTools !== 'undefined' && CoachTools.latestResult)
      ? CoachTools.latestResult(s.matches, nextMatch)
      : (s.matches || []).filter(m => m && m.date && m.date < todayStr && (!nextMatch || String(m.id) !== String(nextMatch.id)))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.time || '').localeCompare(String(a.time || '')))[0];
    const recent = s.trainings.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 6);
    const drafts = s.trainings.filter(t => t.status === 'draft' || t.status === 'pinned');
    const boardCount = (s.boards || []).length;
    // Graphs for coach home cards
    const recentDays = activity.slice(-14);
    const minByDay = recentDays.map(d => d.minutes || 0);
    const loadBySession = recentDays.map(d => d.load || 0);
    const last3Load = loadBySession.slice(-3);
    const avg3 = last3Load.length ? Math.round(last3Load.reduce((a,b)=>a+b,0)/last3Load.length) : 0;
    const recentBoards = (s.boards || []).slice().sort((a,b)=>String(b.createdAt||b.updatedAt||'').localeCompare(String(a.createdAt||a.updatedAt||''))).slice(0, 3);
    const teamXpPack = (() => {
      const map = {};
      let total = 0;
      this._livePlayers(s.players).forEach(p => {
        if (!p || p.id == null || typeof PlayerProgress === 'undefined' || !PlayerProgress.compute) return;
        let pr = null;
        try { pr = PlayerProgress.compute(p.id); } catch (_) { pr = null; }
        if (!pr) return;
        total += Number(pr.xp) || 0;
        (pr.history || []).forEach(h => {
          if (!h || !h.date) return;
          map[h.date] = (map[h.date] || 0) + (Number(h.delta) || 0);
        });
      });
      const series = Object.keys(map).sort().slice(-14).map(k => Math.max(0, map[k]));
      return { total, series };
    })();
    const teamXpByDay = teamXpPack.series;
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

    const matchHtml = nextMatch
      ? this._matchPlaque(nextMatch, { clubShort: short, clubLogo: logo || this.clubMark() })
      : `<div class="cp-match is-empty">${t('next_match_none','Наступний матч не заплановано')}</div>`;

    const statusLabel = next
      ? ('Наступне: ' + (next.name || 'Тренування') + (next.date ? ' · ' + next.date : ''))
      : 'Немає запланованих тренувань';

    const coachXp = (typeof CoachTools !== 'undefined' && CoachTools.coachProgress) ? CoachTools.coachProgress() : null;
    return `
      <div class="club-profile">
        ${this._approvalsBanner()}
        ${this._pitchBar()}

        ${(() => {
          const pc = this._profilePersonCard();
          if (!pc) return '';
          const avAction = pc.photo
            ? 'data-action="open-photo"'
            : (pc.kind === 'coach'
              ? 'data-action="open-default-board"'
              : (pc.player && pc.player.id ? ('data-action="open-fifa-card" data-player-id="' + pc.player.id + '"') : ''));
          const ph = pc.kind === 'coach'
            ? this._photoTag(this._coachPhotoSources(), pc.initials)
            : (pc.photo
              ? this._photoTag([pc.photo], pc.initials)
              : `<span class="cp-avatar-ph">${sanitize(pc.initials || '??')}</span>`);
          return `
        <div class="cp-hero cp-person cp-clean" style="--pos-bg:${pc.accent.bg};--pos-ring:${pc.accent.ring};">
          <div class="cp-avatar-wrap">
            <button type="button" class="cp-avatar" ${avAction}
              title="${pc.photo ? 'Фото на весь екран' : (pc.kind === 'coach' ? 'Дошка' : 'FIFA-картка')}"
              style="border-color:var(--pos-ring);background:var(--pos-bg)">
              ${ph}
            </button>
          </div>
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
        ${this._clubForgeHtml()}

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
            <span class="cp-stat-sub">${pastForStats.length} тренувань · ${matchDays} матчів</span>
            <div class="cp-stat-spark">${this._sparkline(minByDay, { color: '#7cf0c0', fill: 'rgba(124,240,192,.12)' })}</div>
          </div>
          <div class="cp-stat cp-stat-chart">
            <span class="cp-stat-ic">📊</span>
            <span class="cp-stat-val">${weekLoad || 0}</span>
            <span class="cp-stat-lb">Тижневе навантаження</span>
            <span class="cp-stat-sub">сер. 3 дні: ${avg3} · матч разом із розминкою</span>
            <div class="cp-stat-spark">${this._sparkline(loadBySession, { color: '#3d7eff', fill: 'rgba(61,126,255,.12)' })}</div>
          </div>
          <div class="cp-stat cp-stat-chart">
            <span class="cp-stat-ic">✨</span>
            <span class="cp-stat-val">${teamXpPack.total || 0}</span>
            <span class="cp-stat-lb">XP команди</span>
            <span class="cp-stat-sub">у гравців, разом із матчами</span>
            <div class="cp-stat-spark">${this._sparkline(teamXpByDay, { color: '#f5c542', fill: 'rgba(245,197,66,.15)' })}</div>
          </div>
          <div class="cp-stat cp-stat-wide cp-stat-match">
            ${matchHtml}
          </div>
          ${pastMatch
            ? ('<div class="cp-stat cp-stat-wide cp-stat-match cp-stat-past">' + this._matchPlaque(pastMatch, { clubShort: short, clubLogo: logo || this.clubMark(), kicker: ((typeof CoachTools !== 'undefined' && CoachTools.isoDay && CoachTools.isoDay(pastMatch.date) === todayStr) ? 'Матч сьогодні' : 'Минулий матч') }) + '</div>')
            : '<button type="button" class="cp-stat cp-stat-wide sc-tap cp-stat-action" data-view="matches"><span class="cp-stat-ic">🏟</span><span class="cp-stat-val">—</span><span class="cp-stat-lb">Минулий матч</span><span class="cp-stat-sub">Ще не зіграний</span></button>'}
          <button type="button" class="cp-stat cp-stat-wide sc-tap cp-stat-action" data-view="tactics">
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
      '</div>';
  },
  _fifaCard(p, stats) {
    if (!p) return '';
    stats = stats || {};
    const st = p.status || 'available';
    const stLabel = ({ available: 'Здоровий', healthy: 'Здоровий', injured: 'Травмований', rehab: 'Відновлення', recovery: 'Відновлення' })[st] || st;
    const pos = p.position || '—';
    const loadNow = this._loadScore(p);
    const ovr = Math.round((Number(p.readiness != null ? p.readiness : p.condition) || 70) * 0.85 + (100 - Math.min(100, (loadNow != null ? loadNow : (p.load || 0)) * 8)) * 0.15);
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

    const clubLogo = this.clubMark();
    const logoTag = clubLogo
      ? ('<img class="fifa-club-logo" src="' + (typeof sanitize==='function'?sanitize(clubLogo):clubLogo) + '" alt="club" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'"/>')
      : '';
    const gs = this._playerGiftStyle ? this._playerGiftStyle(p.id) : { ring: posColor, bg: 'linear-gradient(165deg,#241c10,#12100c)' };
    const photoAction = photo ? ' data-action="open-photo" data-player-id="' + p.id + '"' : '';
    return `
      <div class="fifa-card club-player-card fifa-classic" style="--pos-color:${posColor};--gift-ring:#e8c547;--acc-ring:#e8c547" data-fifa-player="${p.id}" data-compare-host="${p.id}">
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
        <div class="cpc-name"><span class="cpc-name-txt">${sanitize(p.firstName || '')} <strong>${sanitize(p.lastName || '')}</strong></span>${this.appointmentHtml(p)}${this._giftStatusBadge(gifts, p.id)}</div>
        <div class="cpc-meta">${sanitize(stLabel)}${tg ? ' · ' + tg : ''}</div>
        ${(typeof SessionPlay !== 'undefined') ? SessionPlay.sealHtml(p.id) : ''}
        <div class="fifa-stats">
          <div class="fifa-stat"><b>${cond}%</b><span>Готовність</span></div>
          <div class="fifa-stat"><b>${att}</b><span>${typeof t==='function'?t('longpress_attendance'):'Відвідування'}</span></div>
          <div class="fifa-stat"><b>${rpe}</b><span>Сер. RPE</span></div>
          <div class="fifa-stat"><b>${load}</b><span>Load 28д</span></div>
          <div class="fifa-stat"><b>${loadNow != null ? this._fmtLoad(loadNow) : '—'}</b><span>Лоад</span></div>
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
    const others = this._livePlayers(s.players).filter(p => String(p.id) !== String(me.id)).sort((a, b) => (a.number || 0) - (b.number || 0));
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
      const pls = this._livePlayers(s.players);
      if (!pls.length) return '<div class="compare-empty">Немає гравців</div>';
      let sumCond = 0, sumAtt = 0, sumRpe = 0, sumL28 = 0, sumLoad = 0, n = 0;
      pls.forEach(p => {
        n++;
        sumCond += (p.readiness != null ? p.readiness : (p.condition != null ? p.condition : 80));
        const st = this._playerStats(p.id);
        sumAtt += st.attPct || 0;
        sumRpe += st.avgRpe || 0;
        sumL28 += st.load28 || 0;
        sumLoad += (this._loadScore(p) || 0);
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
      loadB = this._loadScore(other) || 0;
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
          ${this._statBar('Лоад', this._loadScore(me) || 0, 10, '#9b59b6')}
        </div>
        <div class="compare-col">
          <div class="compare-name">${nameB}</div>
          ${this._statBar('Готовність %', condB, 100, '#2ecc71')}
          ${this._statBar('Відвідування %', b.attPct || 0, 100, '#3498db')}
          ${this._statBar('Сер. RPE', b.avgRpe || 0, 10, '#f1c40f')}
          ${this._statBar('Load 28д', b.load28 || 0, maxLoad, '#e67e22')}
          ${this._statBar('Лоад', loadB, 10, '#9b59b6')}
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
      { label: 'Лоад', va: this._loadScore(me) || 0, vb: other.load || 0, max: 10 }
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
        const counts = (typeof PlayerProgress !== 'undefined' && PlayerProgress.sessionCounts)
          ? PlayerProgress.sessionCounts(t)
          : t.status === 'done';
        if (!counts) return;
        const a = (typeof PlayerProgress !== 'undefined' && PlayerProgress._cell)
          ? PlayerProgress._cell(t.attendance, playerId)
          : (t.attendance && (t.attendance[playerId] != null ? t.attendance[playerId] : t.attendance[String(playerId)]));
        const mark = (typeof PlayerProgress !== 'undefined' && PlayerProgress.attendanceMark)
          ? PlayerProgress.attendanceMark(a)
          : (a && a.present === true ? true : (a && a.present === false ? false : null));
        if (mark == null) return;
        if (mark === false) absent++;
        else present++;
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
    const mineUsage = me ? this._playerUsage(me.id) : { appMs: 0, boardMs: 0 };
    const next = this._nextPlanned(s.trainings);
    const todayStr = (typeof CoachTools !== 'undefined' && CoachTools.berlinToday) ? CoachTools.berlinToday() : today();
    const monthPrefix = todayStr.slice(0, 7);
    const nextMatch = (typeof CoachTools !== 'undefined' && CoachTools.nextMatch)
      ? CoachTools.nextMatch(s.matches)
      : s.matches.filter(m => m.date >= todayStr && String(m.date).slice(0, 7) === monthPrefix)
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
      ${this._pitchBar()}
      <div class="st player-cab-head">${t('my_cabinet')} · <span class="cp-brand-a">МЕТАЛІСТ</span> <span class="cp-brand-b">ШТУТТГАРТ</span>
        <button type="button" class="btn btn-s btn-sm" data-action="edit-self-player">Профіль</button>
      </div>
      ${me ? `
        <div class="cp-hero cp-person cp-clean player-profile-hero ${this._playerBackdrop(me).className}" style="${themeStyle};${this._playerBackdrop(me).style}">
          <div class="cp-avatar-wrap" data-stop-nav="1">
            <button type="button" class="cp-avatar" data-action="${photo ? 'open-photo' : 'open-fifa-card'}" data-player-id="${me.id}"
              title="${photo ? 'Фото на весь екран' : 'FIFA-картка'}" style="border-color:var(--pos-ring);background:var(--pos-bg)">
              ${photoHtml}
            </button>
          </div>
          <div class="cp-role-line"><span class="cp-role-kind">Гравець</span></div>
          <h1 class="cp-title cp-title-name">${sanitize(fullName)} ${featBadge}</h1>
          ${statusText ? '<div class="player-status-line">' + sanitize(statusText) + '</div>' : ''}
          <div class="cp-role-badge" style="border-color:var(--pos-ring);color:var(--pos-ring)">${sanitize(me.position || '—')}</div>
          <div class="soc-xp-block player-home-xp">
            <div class="soc-xp-head"><span>LVL ${prog.level}</span><span>${prog.xp || 0} XP</span></div>
            <div class="soc-xp-bar"><div class="soc-xp-fill" style="width:${prog.levelProgress || 0}%"></div></div>
            <div class="soc-xp-sub">До LVL ${(prog.level || 1) + 1}: ${prog.xpToNext || 0} XP</div>
          </div>
          ${(typeof SessionPlay !== 'undefined') ? SessionPlay.weekHtml(me.id) + SessionPlay.sealHtml(me.id) : ''}
          ${this._accountProgress(me.id)}
          ${bio ? '<p class="player-bio-home">' + sanitize(bio) + '</p>' : ''}
          <div class="cp-status"><span class="cp-dot"></span>${(typeof I18n!=='undefined'?I18n.t('attendance','Відвідуваність'):'Відвідуваність')} ${Math.round(stats.attPct || 0)}% · тап по фото — на весь екран</div>
          ${this._timeChips(mineUsage.appMs, mineUsage.boardMs)}
          ${this._loadPanel(me, true)}
        </div>` : this._noPlayerLink()}

      ${this._liveClub()}
      ${this._clubForgeHtml()}

      <div class="cp-pills player-quick">
        <button type="button" class="cp-pill" data-view="trainings">📅 ${t('nav_trainings')}</button>
        <button type="button" class="cp-pill" data-view="players">👥 ${t('nav_squad')}</button>
        <button type="button" class="cp-pill" data-view="analytics">📊 ${t('analytics')}</button>
      </div>

      ${nextMatch ? ('<div class="cp-stat cp-stat-wide cp-stat-match">' + this._matchPlaque(nextMatch) + '</div>') : ''}
      ${(() => {
        const past = (typeof CoachTools !== 'undefined' && CoachTools.latestResult)
          ? CoachTools.latestResult(s.matches, nextMatch)
          : (s.matches || []).filter(m => m && m.date && m.date < todayStr && (!nextMatch || String(m.id) !== String(nextMatch.id)))
            .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.time || '').localeCompare(String(a.time || '')))[0];
        const kicker = past && typeof CoachTools !== 'undefined' && CoachTools.isoDay && CoachTools.isoDay(past.date) === todayStr ? 'Матч сьогодні' : 'Минулий матч';
        return past ? ('<div class="cp-stat cp-stat-wide cp-stat-match cp-stat-past">' + this._matchPlaque(past, { kicker: kicker }) + '</div>') : '';
      })()}

      ${next
        ? ('<div class="next-tr-wrap"><button type="button" class="card glass next-tr-card" data-action="preview-next-training" data-training-id="' + next.id + '">' +
          '<div class="ct">Наступне тренування</div>' +
          '<div class="vl">' + sanitize(next.name) + '</div>' +
          '<div class="next-tr-metrics">' +
            '<span>' + sanitize(next.date || '') + (next.time ? ' · ' + sanitize(next.time) : '') + '</span>' +
            '<span>' + (next.duration || 0) + ' хв</span>' +
            '<span>Load ' + (nextLoad || '—') + '</span>' +
            '<span>~+' + nextXp + ' XP</span>' +
          '</div></button>' +
          ((typeof SessionPlay !== 'undefined') ? (SessionPlay.claimHtml(next) + SessionPlay.slidesHtml(next)) : '') +
          '</div>')
        : '<div class="card glass next-tr-card"><div class="ct">Наступне тренування</div><div class="note-sm">Немає запланованого тренування</div></div>'}

      ${me ? this._myStatsCharts(me, Object.assign({}, stats, { xp: prog.xp, level: prog.level })) : ''}

      <div class="card glass">
        <div class="ct">${t('recent_trainings')}</div>
        <div class="player-tr-list">${pastTr.length ? pastTr.map(tr => {
          const a = me && tr.attendance && tr.attendance[me.id];
          const cancelled = (typeof LoadModel !== 'undefined' && LoadModel.isCancelled && LoadModel.isCancelled(tr))
            || tr.status === 'cancelled' || tr.status === 'canceled';
          const held = !cancelled && ((typeof PlayerProgress !== 'undefined' && PlayerProgress.sessionCounts)
            ? PlayerProgress.sessionCounts(tr)
            : tr.status === 'done');
          const mark = (held && typeof PlayerProgress !== 'undefined' && PlayerProgress.attendanceMark)
            ? PlayerProgress.attendanceMark(a)
            : ((held && a && a.present === true) ? true : ((held && a && a.present === false) ? false : null));
          const present = mark;
          const cls = cancelled ? 'ptr-cancel' : (present === true ? 'ptr-ok' : (present === false ? 'ptr-miss' : 'ptr-na'));
          const badge = cancelled ? 'скас.' : (present === true ? '✓' : (present === false ? '✗' : '—'));
          const rpe = held && a && a.rpe != null ? ('RPE ' + a.rpe) : '';
          const note = cancelled ? ' · скасовано, не пропуск' : (!held ? ' · не відбулось' : (tr.coachPresent === false ? ' · без тренера' : ''));
          return '<div class="player-tr-row ' + cls + '">' +
            '<span class="ptr-badge">' + badge + '</span>' +
            '<span class="ptr-name">' + sanitize(tr.name || 'Тренування') + '</span>' +
            '<span class="ptr-meta">' + sanitize(tr.date || '') + ' ' + rpe + note + '</span></div>';
        }).join('') : '<p class="note-sm">Тренувань ще немає. Вони прийдуть із сервера.</p>'}</div>
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
    const sources = this._coachPhotoSources();
    const photo = sources[0] || '';
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
      ? '<button type="button" class="coach-pub-av" data-action="open-photo" data-photo="' + sanitize(photo) + '" title="Фото на весь екран">' + this._photoTag(sources, 'AS') + '</button>'
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

  appointments(p) {
    if (!p) return [];
    const staff = ((Store.get().settings || {}).staff) || {};
    const id = String(p.id);
    const out = [];
    if (p.isCaptain || String(staff.captainId || '') === id) out.push({ short: 'C', label: 'Капітан', cls: 'role-captain' });
    if ((staff.assistants || []).map(String).indexOf(id) >= 0) out.push({ short: 'П', label: 'Помічник', cls: 'role-assistant' });
    if (String(staff.presidentId || '') === id) out.push({ short: 'ПР', label: 'Президент', cls: 'role-president' });
    return out;
  },

  appointmentHtml(p) {
    return this.appointments(p).map(a =>
      '<span class="role-mark ' + a.cls + '" title="' + a.label + '">' + a.short + '</span>'
    ).join('');
  },

  _rankTitle(level) {
    const n = Number(level) || 1;
    if (n >= 12) return 'Капітан ритму';
    if (n >= 8) return 'Провідник';
    if (n >= 4) return 'Основа ритму';
    return 'Старт';
  },

  _clubForgeHtml() {
    let c = null;
    try { c = (typeof CoachTools !== 'undefined' && CoachTools.clubProgress) ? CoachTools.clubProgress() : null; } catch (_) { c = null; }
    if (!c || !c.parts) return '';
    const clock = (ms) => {
      const min = Math.round((Number(ms) || 0) / 60000);
      if (min < 60) return min + ' хв';
      return Math.floor(min / 60) + ' год ' + (min % 60) + ' хв';
    };
    const row = (label, xp, hint) =>
      '<div class="forge-row"><span>' + label + '</span><b>' + xp + ' XP</b><small>' + hint + '</small></div>';
    const p = c.parts;
    return '<section class="club-forge glass">' +
      '<div class="club-forge-head"><span>Прокачка Металіста</span><b>LVL ' + c.level + '</b></div>' +
      '<div class="soc-xp-bar" aria-hidden="true"><div class="soc-xp-fill" style="width:' + c.levelProgress + '%"></div></div>' +
      '<div class="soc-xp-sub">' + c.xp + ' XP · до LVL ' + (c.level + 1) + ': ' + c.xpToNext +
      ' · явка команди ' + c.avgAtt + '% · сесій ' + c.sessions + '</div>' +
      '<div class="forge-grid">' +
        row('Явка', p.attend, c.present + ' був · ' + c.absent + ' пропуск') +
        row('Серії', p.streaks, 'гравець ' + c.bestStreak + ' · команда ' + c.teamStreak) +
        row('Навантаження', p.load, 'сума ' + c.totalLoad) +
        row('Інтенсивність', p.intensity, 'RPE на явці') +
        row('Додаток', p.app, clock(c.appMs)) +
        row('Дошка', p.board, clock(c.boardMs) + ' · схем ' + c.boards) +
        row('Тренер', p.coach, 'був на ' + c.coachHere + ' з ' + c.sessions) +
        row('Подарунки', p.gifts, c.gifts + ' артефактів') +
      '</div></section>';
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
    const all = pr.history || [];
    const sessions = all.filter(h => h.kind === 'present' || h.kind === 'absent')
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const streakLine = all.filter(h => h.kind === 'streak');
    const events = sessions.slice(0, 4).concat(streakLine).slice(0, 5).map(h => {
      const sign = (h.delta || 0) >= 0 ? '+' : '';
      const note = h.withoutCoach ? ' · без тренера' : '';
      return '<li><span>' + sanitize(h.date || '') + ' · ' + sanitize(h.name || '') + note + '</span><b>' + sign + (h.delta || 0) + ' XP</b></li>';
    }).join('');
    return '<div class="prog-panel">' +
      '<div class="prog-rank">' + sanitize(rank) + ' · серія ' + (pr.streak || 0) +
        (this.appointmentHtml ? this.appointmentHtml((Store.get().players || []).find(x => String(x.id) === String(playerId))) : '') +
      '</div>' +
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
    const players = this._livePlayers(s.players);
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
    }).sort((a, b) => (b.pr.xp || 0) - (a.pr.xp || 0) || (Number(a.p.number) || 99) - (Number(b.p.number) || 99));
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
    const next = this._nextPlanned(s.trainings);

    return '<div class="club-public">' +
      '<div class="club-hero">' +
        '<button type="button" class="club-crest-btn" data-action="open-photo" data-photo="' + this.clubMark() + '" data-photo-save="1" data-photo-name="Metalist-Shtuttgart.png" title="Емблема на весь екран">' +
        '<img class="club-crest" src="' + this.clubMark() + '" alt="Емблема Металіст Штуттгарт"/></button>' +
        '<div class="club-hero-copy"><div class="club-kicker">Одна команда</div><h1>Металіст Штуттгарт</h1>' +
        '<p>Гість бачить активність, ріст акаунтів і медіа клубу. Тап по емблемі відкриває її на весь екран — її можна зберегти.</p>' +
        '<button type="button" class="btn btn-s btn-sm" data-action="enter-server-code">Код клубу</button></div></div>' +
      '<div class="club-kpis">' +
        '<div><b>' + players.length + '</b><span>гравців</span></div>' +
        '<div><b>' + done.length + '</b><span>сесій</span></div>' +
        '<div><b>' + avg + '%</b><span>явка</span></div>' +
        '<div><b>' + (next ? sanitize(next.date || '') : '—') + '</b><span>наступне</span></div>' +
      '</div>' +
      this._matchHub({ role: 'guest' }) +
      this._clubForgeHtml() +
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
        if (typ === 'text') {
          const px = norm(o.nx != null ? o.nx : o.x) * W;
          const py = norm(o.ny != null ? o.ny : o.y) * H;
          const label = String(o.label || o.text || '').replace(/[<>&"]/g, '').slice(0, 16);
          if (label) svg += '<text x="' + px.toFixed(1) + '" y="' + py.toFixed(1) + '" text-anchor="middle" fill="#fff" font-size="5" font-weight="700">' + label + '</text>';
          return;
        }
        if (paths[typ] || typ === 'zone') return;
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
    const list = (s.boards || []).filter(b => b && b.id && !b.coachOnly && this._isTacticalBoard(b));
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
        if (this._trainingCancelled(t)) return true;
        const st = String(t.status || 'planned').toLowerCase();
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
    const _tab = (s.ui && s.ui.playerTrainTab) || 'trainings';
    const _tabsHtml = _isPlayerRole ? (
      '<div class="pt-tabs glass">' +
        '<button type="button" class="pt-tab' + (_tab === 'trainings' ? ' on' : '') + '" data-action="player-train-tab" data-tab="trainings">📅 Тренування</button>' +
        '<button type="button" class="pt-tab' + (_tab === 'matches' ? ' on' : '') + '" data-action="player-train-tab" data-tab="matches">⚽ Матчі</button>' +
        '<button type="button" class="pt-tab' + (_tab === 'schemes' ? ' on' : '') + '" data-action="player-train-tab" data-tab="schemes">📐 Схеми</button>' +
        '<button type="button" class="pt-tab' + (_tab === 'calendar' ? ' on' : '') + '" data-action="player-train-tab" data-tab="calendar">🗓️ Календар</button>' +
        '<button type="button" class="pt-tab' + (_tab === 'stats' ? ' on' : '') + '" data-action="player-train-tab" data-tab="stats">📊 Статистика</button>' +
      '</div>'
    ) : '';
    if (_isPlayerRole && _tab === 'schemes') {
      return _tabsHtml + this.tactics();
    }
    if (_isPlayerRole && _tab === 'matches') {
      return _tabsHtml + this._matchHub({ role: 'player' });
    }
    if (_isPlayerRole && _tab === 'calendar') {
      return _tabsHtml + this.calendar();
    }
    if (_isPlayerRole && _tab === 'stats') {
      return _tabsHtml + this._playerTrainStats();
    }

    const statusLabel = (tr) => {
      if (this._trainingCancelled(tr)) return 'Скасовано';
      const st = tr.status || 'planned';
      if (st === 'done') return 'Проведено';
      if (st === 'draft') return 'Чернетка';
      if (st === 'pinned') return 'Закріплене';
      return 'Заплановане';
    };
    const statusCls = (tr) => {
      if (this._trainingCancelled(tr)) return 'tr-cancelled is-cancelled';
      const st = tr.status || 'planned';
      if (st === 'done') return 'tr-done';
      if (st === 'draft') return 'tr-draft';
      return 'tr-planned';
    };

    const cardOf = (tr) => {
      const st = tr.status || 'planned';
      const off = this._trainingCancelled(tr);
      const load = tr.load != null ? tr.load : (tr.rpe != null ? tr.rpe : '—');
      const dur = tr.duration != null ? (tr.duration + ' хв') : '';
      const title = sanitize(tr.name || 'Тренування');
      const date = sanitize(tr.date || '');
      const bits = off ? '' : ((typeof SessionPlay !== 'undefined') ? (SessionPlay.slidesHtml(tr) + SessionPlay.claimHtml(tr)) : '');
      const note = off ? '<div class="tr-cancel-note">Скасовано · не пропуск</div>' : '';
      return '<div class="card glass card-training tg-row ' + statusCls(tr) + '" data-training-id="' + (tr.id || '') + '" data-status="' + sanitize(st) + '" data-action="open-training">' +
        '<div class="tr-top"><div class="tr-title">' + title + '</div><span class="tr-badge ' + statusCls(tr) + '">' + statusLabel(tr) + '</span></div>' +
        '<div class="tr-meta"><span>' + date + '</span>' + (tr.time ? '<span class="tr-dot">·</span><span>' + sanitize(tr.time) + '</span>' : '') + (dur ? '<span class="tr-dot">·</span><span>' + dur + '</span>' : '') +
        (!off && load !== '—' ? '<span class="tr-dot">·</span><span>навантаження ' + load + '</span>' : '') + '</div>' +
        note + bits +
        '</div>';
    };
    const monthNames = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
    const monthKey = (tr) => {
      const iso = this._isoDay(tr && tr.date);
      return iso ? iso.slice(0, 7) : '0000-00';
    };
    const monthLabel = (key) => {
      const month = Number(String(key).slice(5, 7));
      const year = String(key).slice(0, 4);
      if (!month) return 'Без дати';
      return monthNames[month - 1] + ' ' + year;
    };
    const groups = {};
    list.forEach(tr => {
      const key = monthKey(tr);
      if (!groups[key]) groups[key] = [];
      groups[key].push(tr);
    });
    const monthKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    const currentKey = String(todayStr || '').slice(0, 7);
    const openKey = (s.ui && s.ui.trainMonth) || (groups[currentKey] ? currentKey : (monthKeys[0] || currentKey));
    const tiles = monthKeys.map(key => '<button type="button" class="ym-tile train-month-tile' + (key === openKey ? ' on' : '') + '" data-action="toggle-train-month" data-month="' + key + '" style="--ym:#86efac">' +
      '<span class="ym-tile-art"><b>' + groups[key].length + '</b></span><span class="ym-tile-name">' + sanitize(monthLabel(key)) + '</span></button>').join('');
    const openCards = (groups[openKey] || []).map(cardOf).join('');
    const cards = '<div class="ym-row train-months">' + tiles + '</div>' +
      '<div class="ym-shelf-h">' + sanitize(monthLabel(openKey)) + '</div>' +
      '<div class="tr-list" id="trList">' + (openCards || '<div class="es">У цьому місяці немає тренувань</div>') + '</div>';

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
      ${cards || '<div class="es">Немає тренувань</div>'}
    `;
  },

  _feedHue(p) {
    if (!p) return 42;
    const profile = p.profile || {};
    const stored = profile.themeHue != null ? profile.themeHue : p.themeHue;
    if (stored != null && stored !== '' && isFinite(Number(stored))) return Number(stored);
    const pos = String(p.position || '').toUpperCase();
    if (pos.indexOf('GK') >= 0) return 48;
    if (/CB|LB|RB|WB|DEF/.test(pos)) return 210;
    if (/CM|DM|AM|LM|RM|MID/.test(pos)) return 140;
    if (/ST|CF|LW|RW|ATT/.test(pos)) return 4;
    return 42;
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

  _isoDay(value) {
    const s = String(value || '').trim();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];
    const euro = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
    if (euro) return euro[3] + '-' + euro[2].padStart(2, '0') + '-' + euro[1].padStart(2, '0');
    return '';
  },

  /** Найближче заплановане тренування. Чернетка лишається лише в тренера. */
  _nextPlanned(list) {
    const todayStr = (typeof today === 'function') ? today() : '';
    return (list || []).filter(t => {
      if (!t) return false;
      const date = this._isoDay(t.date);
      if (!date || (todayStr && date < todayStr)) return false;
      if (this._trainingCancelled && this._trainingCancelled(t)) return false;
      if (t.md === 'WU' || t.kind === 'warmup') return false;
      const st = String(t.status || '').toLowerCase();
      return st === 'planned' || st === 'pinned';
    }).sort((a, b) => this._isoDay(a.date).localeCompare(this._isoDay(b.date)) || String(a.time || '').localeCompare(String(b.time || '')))[0] || null;
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
    const badge = this._giftStatusBadge(mine, p.id);
    const bd = this._playerBackdrop(p);
    let xp = 0;
    try { xp = (PlayerProgress.compute(p.id) || {}).xp || 0; } catch (_) {}
    let mineId = '';
    try {
      const me = (typeof AuthManager !== 'undefined' && AuthManager.getLinkedPlayer) ? AuthManager.getLinkedPlayer() : null;
      mineId = me ? String(me.id) : '';
    } catch (_) {}
    const meCls = mineId && String(p.id) === mineId ? ' is-me' : '';
    const num = (p.number != null && String(p.number) !== '') ? ('#' + p.number + ' · ') : '';
    const usage = this._playerUsage(p.id);
    return '<div class="pl-card glass pl-card-tint pl-acc ' + bd.className + meCls + '" data-player-id="' + p.id + '" data-action="open-player-card" role="button" tabindex="0" style="' + this._accAttr(p) + ';' + bd.style + '">' +
      '<div class="pl-card-av-wrap">' + this._onlinePip('p:' + p.id) + (photo
        ? ('<button type="button" class="pl-card-av" data-action="open-fifa-card" data-player-id="' + p.id + '">' + ph + '</button>')
        : ('<div class="pl-card-av">' + ph + '</div>')) +
      '</div>' +
      '<div class="pl-card-body"><div class="pl-card-name"><span class="pl-card-name-txt">' + sanitize(name) + '</span>' + (badge || '') + '</div>' +
      (this.appointmentHtml(p) ? ('<div class="pl-card-marks">' + this.appointmentHtml(p) + '</div>') : '') +
      '<div class="pl-card-meta">' + num + sanitize(p.position || '') + (roleText ? (' · ' + roleText) : '') + '</div>' +
      '<div class="pl-card-att">Відвідуваність ' + att + '% · ' + xp + ' XP' +
      (this._loadScore(p) != null ? (' · лоад ' + this._fmtLoad(this._loadScore(p))) : '') +
      '</div>' + this._timeChips(usage.appMs, usage.boardMs) + '</div></div>';
  },

  _fmtShort(ms) {
    const m = Math.round((Number(ms) || 0) / 60000);
    if (m < 60) return m + 'хв';
    return (Math.round(m / 6) / 10) + 'г';
  },

  _playerUsage(id) {
    const s = Store.get() || {};
    const bag = (s.settings && s.settings.playerUsage) || {};
    const row = bag[String(id)] || {};
    return { appMs: Number(row.appMs) || 0, boardMs: Number(row.boardMs) || 0 };
  },

  _timeChips(appMs, boardMs) {
    return '<div class="coach-mini-stats player-time-line">' +
      '<span title="У додатку">📱 ' + this._fmtShort(appMs) + '</span>' +
      '<span title="На дошці">⚽ ' + this._fmtShort(boardMs) + '</span></div>';
  },

  _personFace(p, cls) {
    const name = p ? ([p.firstName, p.lastName].filter(Boolean).join(' ') || p.name || '') : '';
    const initials = this._initials(name || '?');
    const photo = (p && p.id != null && this._resolvePlayerAvatar) ? this._resolvePlayerAvatar(p) : '';
    const inner = photo
      ? this._photoTag([photo], initials)
      : '<span class="cp-avatar-ph">' + sanitize(initials) + '</span>';
    const ring = (p && p.position) ? this._accountAccent(p).ring : '#c8a84b';
    return '<span class="' + (cls || 'mini-face') + '" style="--acc-ring:' + ring + '">' + inner + '</span>';
  },

  _coachFace(cls) {
    const sources = this._coachPhotoSources ? this._coachPhotoSources() : [];
    const set = (Store.get() && Store.get().settings) || {};
    const initials = this._initials(set.coachName || 'Тренер');
    return '<span class="' + (cls || 'mini-face') + ' is-coach" style="--acc-ring:#f0c14b">' + this._photoTag(sources, initials) + '</span>';
  },

  _presenceRows() {
    const s = Store.get() || {};
    const map = (s.settings && s.settings.presence) || {};
    const now = Date.now();
    return Object.keys(map).map(key => {
      const row = map[key] || {};
      const at = Date.parse(row.at || '');
      if (!at) return null;
      const age = now - at;
      if (age > 20 * 60 * 1000 || age < -60000) return null;
      return {
        key: key,
        name: row.name || 'Учасник',
        role: row.role || '',
        playerId: row.playerId || '',
        at: at,
        online: age < 90000
      };
    }).filter(Boolean).sort((a, b) => Number(b.online) - Number(a.online) || b.at - a.at);
  },

  _onlinePip(key) {
    const hit = this._presenceRows().find(r => r.key === key && r.online);
    return hit ? '<span class="live-pip" title="Зараз у додатку"></span>' : '';
  },

  _teamAttPct() {
    const s = Store.get() || {};
    const todayStr = (typeof today === 'function') ? today() : new Date().toISOString().slice(0, 10);
    const past = (s.trainings || []).filter(t => t && (t.status === 'done' || ((t.date || '') < todayStr && t.status !== 'draft' && t.status !== 'cancelled' && t.status !== 'canceled')));
    let yes = 0;
    let total = 0;
    past.forEach(t => {
      Object.values(t.attendance || {}).forEach(a => {
        total++;
        if (a && a.present !== false) yes++;
      });
    });
    return total ? Math.round(yes / total * 100) : 0;
  },

  _liveClub() {
    const rows = this._presenceRows();
    const online = rows.filter(r => r.online);
    const players = ((Store.get() || {}).players) || [];
    const faces = rows.slice(0, 12).map(r => {
      let face = '';
      if (r.role === 'coach' || r.key === 'coach') face = this._coachFace('live-av');
      else {
        const p = r.playerId ? players.find(x => x && String(x.id) === String(r.playerId)) : null;
        face = this._personFace(p || { name: r.name }, 'live-av');
      }
      const short = String(r.name || '').trim().split(/\s+/)[0] || r.name;
      return '<span class="live-person' + (r.online ? ' is-on' : '') + '" title="' + sanitize(r.name) + '">' +
        face + '<span class="live-name">' + sanitize(short) + '</span></span>';
    }).join('');
    return '<section class="live-club glass" id="liveClub">' +
      '<div class="live-club-head"><span class="live-dot' + (online.length ? '' : ' off') + '"></span>' +
      '<b>Зараз у клубі</b><span class="live-count">' + online.length + ' онлайн</span></div>' +
      '<div class="live-faces">' + (faces || '<span class="live-empty">Нікого немає. Відкрий додаток — і ти з’явишся тут.</span>') + '</div>' +
      '<div class="live-att">Відвідуваність команди ' + this._teamAttPct() + '%</div>' +
      '</section>';
  },

  _playerTrainStats() {
    let me = null;
    try {
      me = (typeof AuthManager !== 'undefined' && AuthManager.getLinkedPlayer) ? AuthManager.getLinkedPlayer() : null;
    } catch (_) { me = null; }
    if (!me) {
      return '<div class="card glass"><div class="ct">Статистика</div><p class="note-sm">Профіль ще не прив’язано. Попроси тренера вказати Telegram-нік.</p></div>';
    }
    const stats = this._playerStats(me.id) || {};
    const usage = this._playerUsage(me.id);
    const appT = (typeof App !== 'undefined' && App.formatDurationMs) ? App.formatDurationMs(usage.appMs) : this._fmtShort(usage.appMs);
    const boardT = (typeof App !== 'undefined' && App.formatDurationMs) ? App.formatDurationMs(usage.boardMs) : this._fmtShort(usage.boardMs);
    const att = stats.attPct != null ? Math.round(Number(stats.attPct) || 0) : 0;
    return '<div class="card glass player-time-card" style="' + this._accAttr(me) + '">' +
      '<div class="ct">Мій час</div>' +
      '<div class="player-time-grid">' +
        '<div class="sc"><div class="lb">У додатку</div><div class="vl">' + sanitize(appT) + '</div></div>' +
        '<div class="sc"><div class="lb">На дошці</div><div class="vl">' + sanitize(boardT) + '</div></div>' +
      '</div>' +
      '<p class="note-sm">Рахунок іде, поки додаток відкритий. На дошці — окремо, як у тренера.</p>' +
      '</div>' +
      this._myStatsCharts(me, stats) +
      '<div class="card glass">' +
        '<div class="ct">Відвідування</div>' +
        '<div class="dg">' +
          '<div class="sc"><div class="lb">Був</div><div class="vl">' + (stats.present || 0) + '</div></div>' +
          '<div class="sc"><div class="lb">Не був</div><div class="vl">' + (stats.absent || 0) + '</div></div>' +
          '<div class="sc"><div class="lb">Скасовано</div><div class="vl">' + (stats.cancelled || 0) + '</div></div>' +
          '<div class="sc"><div class="lb">Відвідуваність</div><div class="vl">' + att + '%</div></div>' +
        '</div></div>';
  },

  _clubFeed() {
    try { if (typeof ClubFeed !== 'undefined' && ClubFeed.sync) ClubFeed.sync(); } catch (_) {}
    const s = Store.get();
    const list = (s.feed || []).slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 40);
    const icons = { gift: '🎁', streak: '🔥', birthday: '🎂', status: '✨', photo: '📷', rating: '⭐', load: '📈' };
    const kinds = ['gift', 'streak', 'birthday', 'status', 'photo', 'rating', 'load'];
    const players = s.players || [];
    const frames = { gift: '#e8c547', photo: '#60a5fa', rating: '#f5c542', streak: '#fb923c', birthday: '#f472b6', status: '#c084fc', load: '#34d399' };
    const rows = list.map(item => {
      if (!item) return '';
      let time = '';
      try {
        const d = new Date(item.createdAt);
        if (!isNaN(d.getTime())) {
          time = new Intl.DateTimeFormat('uk-UA', {
            timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
          }).format(d);
        }
      } catch (_) {}
      const kind = kinds.indexOf(item.kind) >= 0 ? item.kind : 'news';
      const pid = item.playerId != null && item.playerId !== '' ? String(item.playerId) : '';
      const player = pid ? players.find(p => p && String(p.id) === pid) : null;
      const hue = player ? this._feedHue(player) : 42;
      const frame = frames[kind] || '#9aa4b2';
      const open = pid ? (' data-action="open-player-card" data-player-id="' + pid + '"') : '';
      const who = player
        ? ([player.firstName, player.lastName].filter(Boolean).join(' ') || player.name || 'Гравець')
        : ((s.settings && s.settings.coachName) || 'Клуб');
      const face = player ? this._personFace(player, 'club-feed-face') : this._coachFace('club-feed-face');
      return '<div role="button" tabindex="0" class="club-feed-row kind-' + kind + '" style="--feed-hue:' + hue + ';--feed-frame:' + frame + '"' + open + '>' +
        '<span class="club-feed-top">' +
          face +
          '<span class="club-feed-ico" aria-hidden="true">' + (icons[kind] || '•') + '</span>' +
          '<span class="club-feed-body"><b>' + sanitize(who) + '</b><span class="club-feed-kind">' + sanitize(item.title || 'Новина') + '</span></span>' +
          (time ? ('<span class="club-feed-time">' + sanitize(time) + '</span>') : '') +
        '</span>' +
        '<span class="club-feed-text">' + sanitize(item.text || '') + '</span>' +
        '</div>';
    }).join('');
    return '<section class="team-chat club-feed" id="clubFeed">' +
      '<div class="ct">Стрічка клубу</div>' +
      '<p class="note-sm">Подарунки, серії 3 · 5 · 8 · 12, дні народження, статус біля імені, нове фото і рейтинг.</p>' +
      '<div class="team-chat-log" id="clubFeedLog">' +
      (rows || '<div class="team-chat-empty">Поки тихо. Щойно хтось отримає подарунок, змінить статус чи збереже серію — це з’явиться тут.</div>') +
      '</div></section>';
  },

  _teamChat() {
    const s = Store.get() || {};
    let mineRole = '';
    let mineId = '';
    let guest = false;
    try {
      if (typeof AuthManager !== 'undefined' && AuthManager.isGuest && AuthManager.isGuest()) guest = true;
      if (typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach()) mineRole = 'coach';
      else if (typeof AuthManager !== 'undefined' && AuthManager.isPlayer && AuthManager.isPlayer()) {
        mineRole = 'player';
        const me = AuthManager.getLinkedPlayer && AuthManager.getLinkedPlayer();
        if (me && me.id != null) mineId = String(me.id);
      }
    } catch (_) {}
    const msgs = ((s.chat) || []).slice(-80);
    const players = s.players || [];
    const rows = msgs.map(m => {
      if (!m) return '';
      let time = '';
      try {
        const d = new Date(m.createdAt);
        if (!isNaN(d.getTime())) {
          time = new Intl.DateTimeFormat('uk-UA', {
            timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'
          }).format(d);
        }
      } catch (_) {}
      const role = m.authorRole === 'coach' ? 'тренер' : (m.authorRole === 'player' ? 'гравець' : '');
      const mine = (mineRole === 'coach' && m.authorRole === 'coach') || (mineId && String(m.playerId || '') === mineId);
      const author = (m.playerId != null && m.playerId !== '')
        ? players.find(p => p && String(p.id) === String(m.playerId))
        : null;
      const named = !author && m.authorName
        ? players.find(p => p && ([p.firstName, p.lastName].filter(Boolean).join(' ') === m.authorName || p.name === m.authorName))
        : author;
      const person = author || named;
      const coachMsg = m.authorRole === 'coach';
      const face = coachMsg ? this._coachFace('team-chat-face') : this._personFace(person || { name: m.authorName || 'Гравець' }, 'team-chat-face');
      const accent = coachMsg
        ? '--acc-ring:#f0c14b;--acc-bg:linear-gradient(165deg,#3d2e0a,#14110a)'
        : (person ? this._accAttr(person) : '--acc-ring:#c8a84b;--acc-bg:linear-gradient(165deg,#2a2416,#12100a)');
      return '<div class="team-chat-msg' + (mine ? ' mine' : '') + '" style="' + accent + '">' +
        face +
        '<div class="team-chat-main"><div class="team-chat-meta"><b>' + sanitize(m.authorName || (person && ([person.firstName, person.lastName].filter(Boolean).join(' '))) || 'Учасник') + '</b>' +
        (role ? ('<span>' + role + '</span>') : '') +
        (time ? ('<span>' + sanitize(time) + '</span>') : '') +
        '</div><div class="team-chat-text">' + sanitize(m.text || '') + '</div></div></div>';
    }).join('');
    const form = guest
      ? '<p class="note-sm">Писати можуть гравці і тренер.</p>'
      : '<form class="team-chat-form" id="teamChatForm" action="#" onsubmit="return false">' +
          '<input id="teamChatInput" type="text" maxlength="500" placeholder="Повідомлення команді" autocomplete="off">' +
          '<button type="button" class="btn btn-p btn-sm" data-action="team-chat-send">Надіслати</button></form>';
    return '<section class="team-chat" id="teamChat">' +
      '<div class="ct">Чат команди</div>' +
      '<p class="note-sm">Його бачать усі: тренер, гравці і гості.</p>' +
      '<div class="team-chat-log" id="teamChatLog">' +
      (rows || '<div class="team-chat-empty">Поки тихо. Напиши першим.</div>') +
      '</div>' + form + '</section>';
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
          const uid = g.uid || g.id || '';
          return '<span class="coach-gift-chip">' +
            '<button type="button" class="coach-gift-open" data-action="inspect-artifact" data-gift-uid="' + uid + '" title="' + sanitize(this._gl(g) || '') + '">' +
            art + '<span>' + sanitize(this._gl(g) || '') + '</span></button>' +
            '<button type="button" class="coach-gift-del" data-action="delete-gift" data-gift-uid="' + uid + '" aria-label="Видалити подарунок">×</button>' +
            '</span>';
        }).join('') + '</div>')
      : '<p class="note-sm">Ще немає подарунків.</p>';
    const catalog = (typeof CoachTools !== 'undefined' && CoachTools.GIFT_CATALOG ? CoachTools.GIFT_CATALOG : []).map(g => {
      return '<button type="button" class="gift-award-btn rarity-' + (g.rarity || 'common') + '" data-action="award-gift" data-player-id="' + p.id + '" data-gift-id="' + g.id + '" style="--art-hue:' + (g.hue != null ? g.hue : 42) + '">' +
        '<span class="gab-ico">' + (g.ico || '🎁') + '</span>' +
        '<span class="gab-label">' + sanitize(g.label || g.id) + '</span>' +
        '</button>';
    }).join('');
    const usage = this._playerUsage(p.id);
    return fifa +
      '<div class="card glass player-time-card" style="' + this._accAttr(p) + '">' + this._timeChips(usage.appMs, usage.boardMs) + '</div>' +
      '<div class="coach-gift-panel card glass" style="' + this._accAttr(p) + '">' +
      '<div class="ct">Подарувати</div>' +
      '<p class="note-sm">Артефакт від тренера стає кольором картки цього гравця.</p>' +
      wornHtml +
      '<label class="note-sm" for="giftMomentNote">Підпис до подарунка</label>' +
      '<input id="giftMomentNote" type="text" maxlength="160" placeholder="Памʼятний момент, необовʼязково">' +
      '<div class="gift-award-grid">' + catalog + '</div></div>';
  },

  _focusMatch(s) {
    const list = (s && s.matches) || [];
    const picked = (s && s.ui && s.ui.squadMatchId) || (s && s.settings && s.settings.defaultSquadMatchId);
    if (picked) {
      const chosen = list.find(m => m && String(m.id) === String(picked) && m.status !== 'cancelled' && m.status !== 'canceled');
      if (chosen) return chosen;
    }
    if (typeof CoachTools !== 'undefined' && CoachTools.nextMatch) {
      const next = CoachTools.nextMatch(list);
      if (next) return next;
    }
    const todayStr = (typeof CoachTools !== 'undefined' && CoachTools.berlinToday) ? CoachTools.berlinToday() : ((typeof today === 'function') ? today() : '');
    const open = list.filter(m => m && m.status !== 'cancelled' && m.status !== 'canceled' && m.status !== 'played' && m.status !== 'done');
    const byStart = (a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.time || '').localeCompare(String(b.time || ''));
    const upcoming = open.filter(m => !todayStr || String(m.date || '') >= todayStr).sort(byStart);
    if (upcoming.length) return upcoming[0];
    const past = list.filter(m => m && m.date && (!todayStr || String(m.date) < todayStr) && m.status !== 'cancelled' && m.status !== 'canceled').sort((a, b) => byStart(b, a));
    return past[0] || null;
  },

  _squadMatch(s) {
    const m = this._focusMatch(s);
    if (!m) {
      return '<div class="card glass"><div class="ct">Матч</div><p class="note-sm">Немає матчу. Додай його в розділі матчів, і склад з’явиться тут.</p></div>';
    }
    const todayStr = (typeof today === 'function') ? today() : '';
    const phase = m.date === todayStr ? 'Матч сьогодні' : (String(m.date || '') > todayStr ? 'Перед матчем' : 'Останній матч');
    const players = (s.players || []).slice().sort((a, b) => (Number(a.number) || 99) - (Number(b.number) || 99));
    const byId = {};
    players.forEach(p => { if (p && p.id != null) byId[String(p.id)] = p; });
    const xi = (m.xi || []).filter(id => id != null && byId[String(id)]);
    const bench = (m.bench || []).filter(id => id != null && byId[String(id)] && !xi.some(x => String(x) === String(id)));
    const used = {};
    xi.concat(bench).forEach(id => { used[String(id)] = true; });
    const out = players.filter(p => !used[String(p.id)]);
    const row = (p, bucket, role) => this._squadSwipeRow(p, {
      matchId: m.id, bucket: bucket, role: role,
      face: 'match-chip squad-match-row'
    });
    const block = (title, arr, bucket, role) => '<div class="match-block-label">' + title + ' · ' + arr.length + '</div><div class="match-chips sq-list" data-bucket="' + bucket + '">' +
      (arr.length ? arr.map(p => row(p, bucket, role)).join('') : '<span class="note-sm">Порожньо</span>') + '</div>';
    const picks = ((s.matches) || []).filter(item => item && item.status !== 'cancelled' && item.status !== 'canceled')
      .slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 8);
    const rail = picks.length > 1
      ? '<div class="pm-rail sq-matches">' + picks.map(item => {
        const on = String(item.id) === String(m.id) ? ' on' : '';
        return '<button type="button" class="pm-chip' + on + '" data-action="squad-pick-match" data-match-id="' + sanitize(item.id || '') + '">' +
          sanitize((item.date || '').slice(5) + ' vs ' + (item.opponent || 'матч')) + '</button>';
      }).join('') + '</div>'
      : '';
    return rail +
      '<p class="note-sm">' + sanitize(phase) + '. Цей склад стає основним, а порядок основи — розстановка цього матчу. Свайп вправо: у резерв, довгий — два вибори. Вліво: меню, довгий — вгору, вниз, редагувати. Довгий тап чіпляє гравця і тягне по списку.</p>' +
      '<div class="cp-stat cp-stat-wide cp-stat-match">' + this._matchPlaque(m, { kicker: phase }) + '</div>' +
      '<div class="match-actions">' +
        '<button type="button" class="btn btn-s btn-sm" data-action="squad-board" data-match-id="' + sanitize(m.id || '') + '">На дошку</button>' +
        '<button type="button" class="btn btn-s btn-sm" data-action="match-attendance" data-match-id="' + sanitize(m.id || '') + '">Явка, голи, картки</button>' +
        '<button type="button" class="btn btn-p btn-sm" data-action="open-match" data-match-id="' + sanitize(m.id || '') + '">План матчу</button>' +
      '</div>' +
      block('Основа', xi.map(id => byId[String(id)]), 'xi', 'ОС') +
      block('Лавка', bench.map(id => byId[String(id)]), 'bench', 'Л') +
      block('Поза заявкою', out, 'out', '•');
  },

  _squadUnder(bucket) {
    const nudge = bucket === 'bench' ? 'Поза заявкою' : 'У резерв';
    return '<div class="sq-under sq-under-right">' +
      '<button type="button" class="sq-act sq-act-main" data-sq="nudge">' + nudge + '</button>' +
      '<button type="button" class="sq-act sq-act-xi" data-sq="xi-bench"><b>Основа</b><small>запас</small></button>' +
      '<button type="button" class="sq-act sq-act-out" data-sq="bench-out"><b>Резерв</b><small>поза заявкою</small></button>' +
      '</div><div class="sq-under sq-under-left">' +
      '<button type="button" class="sq-act sq-act-menu" data-sq="menu">Меню</button>' +
      '<button type="button" class="sq-act sq-act-up" data-sq="up">Вгору</button>' +
      '<button type="button" class="sq-act sq-act-down" data-sq="down">Вниз</button>' +
      '<button type="button" class="sq-act sq-act-edit" data-sq="edit">Змінити</button>' +
      '</div>';
  },

  _squadSwipeRow(p, opts) {
    const o = opts || {};
    const id = sanitize(p && p.id != null ? p.id : '');
    const match = o.matchId ? (' data-match-id="' + sanitize(o.matchId) + '"') : '';
    const bucket = sanitize(o.bucket || '');
    const role = o.role ? ('<span class="match-chip-role">' + sanitize(o.role) + '</span>') : '';
    const name = sanitize((p.lastName || '') + ' ' + ((p.firstName || '')[0] ? ((p.firstName || '')[0] + '.') : (p.firstName || '')) || 'Гравець');
    const meta = '#' + sanitize(p.number || '—') + (p.position ? (' · ' + sanitize(p.position)) : '');
    const faceCls = o.face || 'pl-row tg-row';
    const inner = o.inner || (role +
      '<span class="match-chip-name">' + name.trim() + '</span>' +
      '<span class="match-chip-meta">' + meta + '</span>');
    return '<div class="sq-row" data-player-id="' + id + '"' + match + ' data-bucket="' + bucket + '">' +
      this._squadUnder(bucket) +
      '<div class="sq-face ' + faceCls + '" data-player-id="' + id + '" data-action="open-player-card" role="button">' +
      inner + '</div></div>';
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
    if (!isCoach) list = list.filter(p => !this._isSeed(p));
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
      return this._liveClub() + this._playerSocialHub(mePlayer, list, attPct) + this._teamChat();
    }
    if (isPlayerRole) {
      const meId = mePlayer ? String(mePlayer.id) : '';
      const xpOf = (p) => {
        try { return (PlayerProgress.compute(p.id) || {}).xp || 0; } catch (_) { return 0; }
      };
      list = list.slice().sort((a, b) => {
        const aMe = meId && String(a.id) === meId ? 0 : 1;
        const bMe = meId && String(b.id) === meId ? 0 : 1;
        if (aMe !== bMe) return aMe - bMe;
        return xpOf(b) - xpOf(a) || ((a.number || 0) - (b.number || 0));
      });
      const cards = list.map(p => this._squadPlaque(p, attPct(p.id), roleLabel(p))).join('');
      return this._liveClub() + '<div class="st">Команда</div><div class="pl-cards">' + (cards || '<div class="es">Немає гравців</div>') + '</div>' + this._teamChat();
    }

    if (typeof AuthManager !== 'undefined' && AuthManager.isGuest && AuthManager.isGuest()) {
      const cards = list.map(p => {
        let lv = 1;
        try { lv = PlayerProgress.compute(p.id).level; } catch (_) {}
        return this._squadPlaque(p, attPct(p.id), roleLabel(p) + ' · LVL ' + lv);
      }).join('');
      return this._liveClub() + '<div class="st">Склад Металіст Штуттгарт</div>' +
        '<p class="note-sm">Тап по картці — акаунт. З акаунта відкривається картка гравця.</p>' +
        '<div class="pl-cards">' + (cards || '<div class="es">Немає гравців</div>') + '</div>' + this._teamChat();
    }

    if (!isCoach) {
      const cards = list.map(p => this._squadPlaque(p, attPct(p.id), roleLabel(p))).join('');
      return this._liveClub() + '<div class="st">Склад <span class="note-sm">перегляд</span></div><div class="pl-cards">' +
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
    viewMode = (viewMode === 'cards' || viewMode === 'match') ? viewMode : 'list';

    const th = (key, label) => {
      const active = sortKey === key ? (sortDir < 0 ? ' ↓' : ' ↑') : '';
      return '<button type="button" class="pl-th' + (sortKey === key ? ' on' : '') + '" data-player-sort="' + key + '">' + label + active + '</button>';
    };

    const focus = this._focusMatch ? this._focusMatch(s) : null;
    const byPlayer = {};
    list.forEach(p => { if (p && p.id != null) byPlayer[String(p.id)] = p; });
    const xiPeople = focus ? (focus.xi || []).map(id => byPlayer[String(id)]).filter(Boolean) : [];
    const benchPeople = focus ? (focus.bench || []).map(id => byPlayer[String(id)]).filter(p => p && !xiPeople.some(x => String(x.id) === String(p.id))) : [];
    const usedMatch = {};
    xiPeople.concat(benchPeople).forEach(p => { usedMatch[String(p.id)] = true; });
    const restPeople = list.filter(p => !usedMatch[String(p.id)]);
    const matchOrder = !!(focus && (xiPeople.length || benchPeople.length || (focus.lineupManual && (focus.xi || focus.bench))));
    const outGroup = (p) => String((p && (p.group || p.squadRole)) || '').toLowerCase() === 'out';
    const starters = matchOrder ? xiPeople : list.filter(p => isStarter(p) && !['injured','rehab','recovery'].includes(p.status) && !outGroup(p));
    const reserves = matchOrder ? benchPeople : list.filter(p => !isStarter(p) && !['injured','rehab','recovery'].includes(p.status) && !outGroup(p));
    const infirmary = matchOrder ? restPeople : list.filter(p => ['injured','rehab','recovery'].includes(p.status) || outGroup(p));
    const starterTitle = matchOrder ? 'Основа матчу' : 'Основа';
    const reserveTitle = matchOrder ? 'Лавка матчу' : 'Резерв';
    const otherTitle = matchOrder ? 'Поза заявкою' : 'Лазарет';

    const sectionList = (title, arr, cls, bucket) => {
      if (!arr.length) return '';
      const rows = arr.map(p => {
        const att = attPct(p.id);
        const usage = this._playerUsage(p.id);
        return this._squadSwipeRow(p, {
          matchId: focus && focus.id,
          bucket: bucket,
          face: 'pl-row tg-row ' + cls,
          inner: '<span class="pl-num">#' + (p.number || '—') + '</span>' +
            '<span class="pl-name">' + this._onlinePip('p:' + p.id) + sanitize(p.lastName || '') + ' ' + sanitize((p.firstName || '')[0] || '') + '.' + this.appointmentHtml(p) + '</span>' +
            '<span class="pl-pos">' + sanitize(p.position || '') + '</span>' +
            '<span class="pl-att">' + att + '%<small>' + this._fmtShort(usage.appMs) + '</small></span>'
        });
      }).join('');
      return '<div class="pl-section sq-list ' + cls + '" data-bucket="' + bucket + '"><div class="pl-section-h">' + title + ' · ' + arr.length + '</div>' + rows + '</div>';
    };

    const meIdCards = mePlayer ? String(mePlayer.id) : '';
    const xpOfCard = (p) => {
      try { return (PlayerProgress.compute(p.id) || {}).xp || 0; } catch (_) { return 0; }
    };
    const cardsCoach = list.slice().sort((a, b) => {
      const aMe = meIdCards && String(a.id) === meIdCards ? 0 : 1;
      const bMe = meIdCards && String(b.id) === meIdCards ? 0 : 1;
      if (aMe !== bMe) return aMe - bMe;
      return xpOfCard(b) - xpOfCard(a) || ((Number(a.number) || 0) - (Number(b.number) || 0));
    }).map(p => this._squadPlaque(p, attPct(p.id), roleLabel(p))).join('');

    const coachStats = (s.coachStats || {});
    const trN = (s.trainings || []).length;
    const doneN = (s.trainings || []).filter(t => t.status === 'done').length;

    const header = '<div class="st">Склад' +
      '<span class="squad-view-toggle" role="group" aria-label="Вигляд складу">' +
        '<button type="button" class="btn-s squad-mode-btn' + (viewMode === 'list' ? ' on' : '') + '" data-action="squad-list" data-mode="list" data-squad-mode="list">Список</button>' +
        '<button type="button" class="btn-s squad-mode-btn' + (viewMode === 'cards' ? ' on' : '') + '" data-action="squad-cards" data-mode="cards" data-squad-mode="cards">Картки</button>' +
        '<button type="button" class="btn-s squad-mode-btn' + (viewMode === 'match' ? ' on' : '') + '" data-action="squad-match" data-mode="match" data-squad-mode="match">Матч</button>' +
      '</span>' +
      '<button class="btn btn-p btn-sm" data-action="new-player">+ Гравець</button></div>';

    const strip = '<div class="coach-stats-strip glass">' +
      '<div class="css-item"><b>' + trN + '</b><span>Тренувань</span></div>' +
      '<div class="css-item"><b>' + doneN + '</b><span>Проведено</span></div>' +
      '</div>';

    if (viewMode === 'match') {
      return this._liveClub() + header + this._squadMatch(s);
    }

    if (viewMode === 'cards') {
      return this._liveClub() + header + strip +
        '<p class="note-sm">Тап — акаунт. З акаунта — картка гравця. Перемикач Список / Картки зверху.</p>' +
        '<div class="pl-cards">' +
        (typeof this._coachSquadCard === 'function' ? this._coachSquadCard() : '') +
        (cardsCoach || '<div class="es">Немає гравців</div>') +
        '</div>' + this._teamChat();
    }

    return this._liveClub() + header + strip +
      '<p class="note-sm">' + (matchOrder
        ? 'Список цього матчу: основа, резерв, поза заявкою. Свайп вправо переводить з основи в резерв, довгий вправо дає два вибори. Вліво — меню, довгий вліво — вгору, вниз і редагувати. Довгий тап чіпляє гравця.'
        : 'Тап — акаунт. Свайп вправо переводить між основою і резервом.') + '</p>' +
      sectionList(starterTitle, starters, 'pl-starters', 'xi') +
      sectionList(reserveTitle, reserves, 'pl-reserve', 'bench') +
      sectionList(otherTitle, infirmary, 'pl-infirmary', 'out') +
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
    const hidden = !!(b && b.coachOnly);
    const actions = editable
      ? '<div class="scheme-card-actions">' +
          '<button type="button" class="btn btn-s btn-sm" data-action="edit-scheme" data-board-id="' + id + '">Редагувати</button>' +
          '<button type="button" class="btn btn-s btn-sm" data-action="toggle-scheme-coach" data-board-id="' + id + '">' + (hidden ? 'Показати гравцям' : 'Сховати від гравців') + '</button>' +
          '<button type="button" class="btn btn-s btn-sm scheme-card-del" data-action="delete-scheme" data-board-id="' + id + '">Видалити</button>' +
        '</div>'
      : '';
    return '<article class="scheme-card glass" data-board-id="' + id + '">' +
      '<button type="button" class="scheme-card-openbtn" data-action="load-scheme-board" data-board-id="' + id + '">' +
        '<div class="scheme-card-thumb">' + thumb + '</div>' +
        '<div class="scheme-card-body">' +
          '<div class="scheme-card-title">' + title + '</div>' +
          '<div class="scheme-card-meta">' + typ + (hidden ? ' · тільки тренер' : '') + (desc ? ' · є опис' : '') + '</div>' +
        '</div></button>' +
      '<div class="scheme-card-detail">' +
        '<p class="scheme-card-desc">' + (desc ? this._richText(desc) : 'Опису ще немає.') + '</p>' +
        actions +
      '</div></article>';
  },

  _albumHue(album) {
    const hues = ['#e8c547', '#7dd3fc', '#86efac', '#c4b5fd', '#fb7185', '#fdba74', '#f9a8d4', '#5eead4'];
    const albums = ((Store.get() && Store.get().schemeAlbums) || []).slice().sort((a, b) =>
      String((a && (a.createdAt || a.id)) || '').localeCompare(String((b && (b.createdAt || b.id)) || ''))
    );
    let index = albums.findIndex(a => a && album && String(a.id) === String(album.id));
    if (index < 0) {
      const text = String((album && album.id) || album || '');
      index = 0;
      for (let i = 0; i < text.length; i++) index = (index + text.charCodeAt(i)) % hues.length;
    }
    return hues[index % hues.length];
  },

  _schemePickButton(board, albumId) {
    const id = sanitize(String((board && board.id) || ''));
    const name = sanitize((board && (board.name || board.title)) || 'Схема');
    const thumb = (typeof this._schemeThumbSvg === 'function') ? this._schemeThumbSvg(board) : '';
    return '<button type="button" class="ym-pick" data-action="album-add-board" data-album-id="' + sanitize(albumId || '') + '" data-board-id="' + id + '">' +
      '<span class="ym-pick-art">' + thumb + '</span>' +
      '<span class="ym-pick-name">' + name + '</span></button>';
  },

  _albumCover(album) {
    const s = Store.get() || {};
    const byId = {};
    (s.boards || []).forEach(b => { if (b && b.id != null) byId[String(b.id)] = b; });
    const firstId = ((album && album.boardIds) || []).find(id => byId[String(id)]);
    const board = firstId != null ? byId[String(firstId)] : null;
    if (!board || typeof this._schemeThumbSvg !== 'function') return '';
    return this._schemeThumbSvg(board);
  },

  _richText(raw) {
    let text = sanitize(raw || '');
    text = text.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
    text = text.replace(/(^|[\s>])\*([^*\n]+)\*/g, '$1<i>$2</i>');
    text = text.replace(/__([^_\n]+)__/g, '<u>$1</u>');
    text = text.replace(/~~([^~\n]+)~~/g, '<s>$1</s>');
    return text.replace(/\n/g, '<br>');
  },

  _fmtBar() {
    return '<div class="fmt-bar" role="toolbar" aria-label="Форматування">' +
      '<button type="button" data-fmt="bold" title="Жирний"><b>Ж</b></button>' +
      '<button type="button" data-fmt="italic" title="Курсив"><i>К</i></button>' +
      '<button type="button" data-fmt="underline" title="Підкреслення"><u>П</u></button>' +
      '<button type="button" data-fmt="strike" title="Закреслений"><s>З</s></button>' +
      '</div>';
  },

  _albumPickRow(current, fieldId) {
    const albums = ((Store.get() && Store.get().schemeAlbums) || []);
    const cur = String(current || '');
    const none = '<button type="button" class="ym-pick' + (cur ? '' : ' on') + '" data-action="pick-album-field" data-album-field="' + sanitize(fieldId) + '" data-album-id="">' +
      '<span class="ym-pick-art"><b>—</b></span><span class="ym-pick-name">Без альбому</span></button>';
    const tiles = albums.map(a => {
      const on = String(a.id) === cur ? ' on' : '';
      const cover = this._albumCover(a);
      const letter = sanitize(String(a.name || 'А').replace(/[^A-Za-zА-Яа-яІіЇїЄєҐґ0-9]/g, '').slice(0, 1).toUpperCase() || 'А');
      const art = cover
        ? '<span class="ym-pick-art ym-tile-cover">' + cover + '</span>'
        : '<span class="ym-pick-art"><b>' + letter + '</b></span>';
      return '<button type="button" class="ym-pick' + on + '" data-action="pick-album-field" data-album-field="' + sanitize(fieldId) + '" data-album-id="' + sanitize(a.id || '') + '" style="--ym:' + this._albumHue(a) + '">' +
        art + '<span class="ym-pick-name">' + sanitize(a.name || 'Альбом') + '</span></button>';
    }).join('');
    return '<div class="ym-picks ym-album-picks">' + none + tiles + '</div>' +
      '<input type="hidden" id="' + sanitize(fieldId) + '" value="' + sanitize(cur) + '">';
  },

  _albumOptions(current) {
    const albums = ((Store.get() && Store.get().schemeAlbums) || []);
    return '<option value="">Без альбому</option>' + albums.map(a =>
      '<option value="' + sanitize(a.id || '') + '"' + (String(current || '') === String(a.id) ? ' selected' : '') + '>' +
      sanitize(a.name || 'Альбом') + '</option>'
    ).join('');
  },

  _schemeTrack(b, opts) {
    const o = opts || {};
    const id = sanitize(String((b && b.id) || ''));
    const title = sanitize((b && (b.name || b.title)) || 'Схема');
    const typ = sanitize((b && (b.type || b.kind || b.schemeType)) || 'тактика');
    const desc = String((b && (b.description || b.notes || b.text)) || '').trim();
    const thumb = (typeof this._schemeThumbSvg === 'function') ? this._schemeThumbSvg(b) : '📐';
    const hidden = !!(b && b.coachOnly);
    const menu = o.editable
      ? '<button type="button" class="ym-dots" data-action="scheme-menu" data-board-id="' + id + '" aria-label="Меню схеми">⋯</button>' +
        '<div class="ym-menu">' +
          '<button type="button" data-action="edit-scheme" data-board-id="' + id + '">Редагувати</button>' +
          '<button type="button" data-action="toggle-scheme-coach" data-board-id="' + id + '">' + (hidden ? 'Показати гравцям' : 'Сховати від гравців') + '</button>' +
          '<button type="button" data-action="delete-scheme" data-board-id="' + id + '">Видалити</button>' +
          (o.albumId
            ? '<button type="button" data-action="album-move-board" data-album-id="' + sanitize(o.albumId) + '" data-board-id="' + id + '" data-dir="-1">Вище</button>' +
              '<button type="button" data-action="album-move-board" data-album-id="' + sanitize(o.albumId) + '" data-board-id="' + id + '" data-dir="1">Нижче</button>' +
              '<button type="button" data-action="album-remove-board" data-album-id="' + sanitize(o.albumId) + '" data-board-id="' + id + '">З альбому</button>'
            : '') +
          '<button type="button" data-action="load-scheme-board" data-board-id="' + id + '">На дошку</button>' +
        '</div>'
      : '';
    const albumAttr = (o.editable && o.albumId) ? ' data-album-id="' + sanitize(o.albumId) + '"' : '';
    return '<div class="ym-track"' + albumAttr + ' data-name="' + title + '" data-board-id="' + id + '">' +
      '<button type="button" class="ym-play" data-action="load-scheme-board" data-board-id="' + id + '">' +
        '<span class="ym-thumb">' + thumb + '</span>' +
        '<span class="ym-track-copy"><b>' + title + '</b><small>' + typ + (hidden ? ' · тільки тренер' : '') + '</small></span>' +
      '</button>' +
      '<div class="ym-expand">' +
        '<div class="ym-expand-copy">' +
          '<b class="ym-expand-title">' + title + '</b>' +
          '<p class="ym-desc">' + (desc ? this._richText(desc) : 'Опису ще немає.') + '</p>' +
          menu +
        '</div>' +
        '<div class="ym-art" aria-hidden="true">' + thumb + '</div>' +
      '</div></div>';
  },

  _albumTile(album) {
    const s = Store.get();
    const ids = (album && album.boardIds) || [];
    const coach = typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach();
    const count = ids.filter(id => (s.boards || []).some(b => b && String(b.id) === String(id) && (coach || !b.coachOnly))).length;
    const hidden = !!(album && album.coachOnly);
    const name = sanitize((album && album.name) || 'Альбом') + (hidden && coach ? ' · лише тренер' : '');
    const letter = name.replace(/[^A-Za-zА-Яа-яІіЇїЄєҐґ0-9]/g, '').slice(0, 1).toUpperCase() || 'А';
    const cover = this._albumCover(album);
    const art = cover
      ? '<span class="ym-tile-art ym-tile-cover">' + cover + '<small class="ym-tile-count">' + count + '</small></span>'
      : '<span class="ym-tile-art"><b>' + letter + '</b><small>' + count + '</small></span>';
    return '<button type="button" class="ym-tile" data-action="open-scheme-album" data-album-id="' + sanitize(album.id || '') + '" style="--ym:' + this._albumHue(album) + '">' +
      art +
      '<span class="ym-tile-name">' + name + '</span></button>';
  },

  _viewerKey() {
    try {
      if (typeof AuthManager !== 'undefined' && AuthManager.isPlayer && AuthManager.isPlayer()) {
        const me = AuthManager.getLinkedPlayer && AuthManager.getLinkedPlayer();
        if (me && me.id != null && me.id !== '') return 'p:' + me.id;
      }
    } catch (_) {}
    try {
      if (typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach()) return 'coach';
    } catch (_) {}
    try {
      const user = (typeof AuthManager !== 'undefined' && AuthManager.user) ? AuthManager.user() : null;
      if (user && user.id != null && user.id !== '') return 'tg:' + user.id;
    } catch (_) {}
    return 'guest';
  },

  _archiveTile(count) {
    return '<button type="button" class="ym-tile" data-action="open-scheme-archive" style="--ym:#94a3b8">' +
      '<span class="ym-tile-art"><b>А</b><small class="ym-tile-count">' + count + '</small></span>' +
      '<span class="ym-tile-name">Архів</span></button>';
  },

  _albumVisits(s) {
    const heat = {};
    ((s && s.schemeOpens) || []).forEach(o => {
      if (!o || !o.albumId) return;
      const id = String(o.albumId);
      heat[id] = (heat[id] || 0) + 1;
    });
    return heat;
  },

  _byAlbumVisits(heat) {
    const visits = heat || {};
    return (a, b) => {
      const diff = (visits[String(b && b.id)] || 0) - (visits[String(a && a.id)] || 0);
      if (diff) return diff;
      return String((b && (b.updatedAt || b.createdAt)) || '').localeCompare(String((a && (a.updatedAt || a.createdAt)) || ''));
    };
  },

  _recommendedAlbums(s) {
    const albums = (s.schemeAlbums || []).filter(a => a && a.id != null);
    const byId = {};
    albums.forEach(a => { byId[String(a.id)] = a; });
    const who = this._viewerKey();
    const opens = (s.schemeOpens || []).filter(o => o && o.who === who);
    const openedAlbums = {};
    const openedBoards = {};
    opens.forEach(o => {
      if (o.albumId) openedAlbums[String(o.albumId)] = (openedAlbums[String(o.albumId)] || 0) + 1;
      if (o.boardId) openedBoards[String(o.boardId)] = (openedBoards[String(o.boardId)] || 0) + 1;
    });
    const score = {};
    albums.forEach(a => { score[String(a.id)] = 0; });
    albums.forEach(a => {
      const hits = (a.boardIds || []).reduce((n, id) => n + (openedBoards[String(id)] || 0), 0);
      if (hits && !openedAlbums[String(a.id)]) score[String(a.id)] += hits * 5;
    });
    (s.schemeSections || []).forEach(sec => {
      const ids = ((sec && sec.albumIds) || []).map(String).filter(id => byId[id]);
      const heat = ids.reduce((n, id) => n + (openedAlbums[id] || 0), 0);
      if (!heat) return;
      ids.forEach(id => {
        if (!openedAlbums[id]) score[id] += heat * 4;
      });
    });
    const ranked = albums
      .map(a => ({ album: a, score: score[String(a.id)] || 0 }))
      .filter(row => row.score > 0)
      .sort((a, b) => b.score - a.score || String(b.album.updatedAt || b.album.createdAt || '').localeCompare(String(a.album.updatedAt || a.album.createdAt || '')))
      .slice(0, 8)
      .map(row => row.album);
    return { albums: ranked, personal: opens.length > 0 };
  },

  _schemeAlbumPage(album, canEdit) {
    const s = Store.get();
    const byId = {};
    (s.boards || []).forEach(b => { if (b && b.id != null) byId[String(b.id)] = b; });
    const trackOf = (b) => this._schemeTrack(b, { editable: canEdit, albumId: album.id });
    const visible = (album.boardIds || []).map(id => byId[String(id)]).filter(b => b && (canEdit || !b.coachOnly));
    const tracks = visible.map(trackOf).join('');
    const trains = (s.trainings || []).filter(t => t && String(t.schemeAlbumId || '') === String(album.id));
    const games = (s.matches || []).filter(m => m && String(m.schemeAlbumId || '') === String(album.id));
    const people = (s.players || []).filter(p => p && String(p.schemeAlbumId || '') === String(album.id));
    const attached = []
      .concat(trains.map(t => 'тренування · ' + (t.name || t.date || '')))
      .concat(games.map(m => 'матч · vs ' + (m.opponent || '')))
      .concat(people.map(p => 'гравець · ' + ((p.lastName || p.firstName || '') )));
    const tools = canEdit
      ? '<div class="ym-actions">' +
          '<button type="button" class="btn btn-s btn-sm" data-action="rename-scheme-album" data-album-id="' + sanitize(album.id) + '">Назва</button>' +
          '<button type="button" class="btn btn-p btn-sm" data-action="album-pick-board" data-album-id="' + sanitize(album.id) + '">+ Схема</button>' +
          '<button type="button" class="btn btn-s btn-sm" data-action="move-album-section" data-album-id="' + sanitize(album.id) + '">У розділ</button>' +
          '<button type="button" class="btn btn-s btn-sm" data-action="toggle-album-coach" data-album-id="' + sanitize(album.id) + '">' + (album.coachOnly ? 'Показати гравцям' : 'Сховати від гравців') + '</button>' +
          '<button type="button" class="btn btn-s btn-sm" data-action="delete-scheme-album" data-album-id="' + sanitize(album.id) + '">Видалити альбом</button>' +
        '</div>'
      : '';
    const cover = this._albumCover(album);
    const heroArt = cover
      ? '<div class="ym-hero-art ym-tile-cover">' + cover + '</div>'
      : '<div class="ym-hero-art">' + sanitize(String(album.name || 'А').replace(/[^A-Za-zА-Яа-яІіЇїЄєҐґ0-9]/g, '').slice(0, 1).toUpperCase() || 'А') + '</div>';
    return '<div class="ym">' +
      '<button type="button" class="btn btn-s btn-sm" data-action="schemes-home">‹ Усі альбоми</button>' +
      '<div class="ym-hero" style="--ym:' + this._albumHue(album) + '">' +
        heroArt +
        '<div><div class="ym-kicker">Альбом схем' + (album.coachOnly ? ' · лише тренер' : '') + '</div><h1>' + sanitize(album.name || 'Альбом') + '</h1>' +
        '<p>' + visible.length + ' схем</p></div></div>' +
      tools +
      '<p class="note-sm">' + (attached.length ? ('Прикріплено: ' + sanitize(attached.join(' · '))) : 'Ще не прикріплено. Альбом можна додати до тренування, матчу або гравця.') +
        (canEdit ? ' Свайп відкриває меню схеми: порядок, сховати, прибрати.' : ' Довгий тап розгортає опис.') + '</p>' +
      '<div class="ym-list">' + (tracks || '<div class="es">В альбомі ще немає схем</div>') + '</div></div>';
  },

  _schemeShelf(opts) {
    const o = opts || {};
    const list = (o.albums || []).filter(Boolean);
    const key = String(o.key || 'all');
    const ui = (Store.get() && Store.get().ui) || {};
    const open = !!(ui.schemeShelves && ui.schemeShelves[key]);
    const shown = open ? list : list.slice(0, 6);
    const hidden = list.length - shown.length;
    const toggle = hidden > 0
      ? '<button type="button" class="btn btn-s btn-sm" data-action="toggle-scheme-shelf" data-shelf="' + sanitize(key) + '">Ще ' + hidden + '</button>'
      : (open && list.length > 6
        ? '<button type="button" class="btn btn-s btn-sm" data-action="toggle-scheme-shelf" data-shelf="' + sanitize(key) + '">Згорнути</button>'
        : '');
    const tools = (o.tools || '') + toggle;
    const tiles = shown.map(a => this._albumTile(a)).join('');
    const row = (o.lead || '') + tiles + (o.tail || '');
    return '<section class="ym-section">' +
      '<div class="ym-shelf-head"><div class="ym-shelf-h">' + sanitize(o.title || 'Альбоми') + '</div>' +
        (tools ? '<span class="ym-sec-tools">' + tools + '</span>' : '') +
      '</div>' +
      '<div class="ym-row">' + (row || '<div class="es">' + (o.empty || 'Поки порожньо') + '</div>') + '</div></section>';
  },

  tactics() {
    const s = Store.get();
    const canEdit = typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach();
    const albums = (s.schemeAlbums || []).slice().sort((a, b) =>
      String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''))
    );
    const openId = s.ui && s.ui.schemeAlbumId;
    const open = albums.find(a => a && String(a.id) === String(openId));
    if (open && (canEdit || !open.coachOnly)) return this._schemeAlbumPage(open, canEdit);
    const boards = (s.boards || []).filter(b => canEdit || !(b && b.coachOnly)).slice().sort((a, b) =>
      String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''))
    );
    const tracks = boards.map(b => this._schemeTrack(b, { editable: canEdit })).join('');
    if (s.ui && s.ui.schemeArchive) {
      return '<div class="ym">' +
        '<button type="button" class="btn btn-s btn-sm" data-action="schemes-home">‹ Альбоми</button>' +
        '<div class="ym-head"><h1>Архів схем</h1>' +
          (canEdit ? '<button type="button" class="btn btn-p btn-sm" data-action="new-board">+ Схема</button>' : '') +
        '</div>' +
        '<p class="note-sm">Тут усі ' + boards.length + ' схем.' + (canEdit ? ' Сховану схему бачать лише тренер.' : '') + ' Довгий тап розгортає опис.</p>' +
        '<input id="schemeSearch" class="ym-search" type="search" placeholder="Пошук схеми" autocomplete="off">' +
        '<div class="ym-list">' + (tracks || '<div class="es">Архів порожній</div>') + '</div></div>';
    }
    const byId = {};
    albums.forEach(a => { if (a && a.id != null) byId[String(a.id)] = a; });
    const sections = (s.schemeSections || []).slice().sort((a, b) =>
      String(a.createdAt || a.id || '').localeCompare(String(b.createdAt || b.id || ''))
    );
    const newAlbum = canEdit
      ? '<button type="button" class="ym-tile ym-tile-new" data-action="new-scheme-album"><span class="ym-tile-art">+</span><span class="ym-tile-name">Новий альбом</span></button>'
      : '';
    const heat = this._albumVisits(s);
    const byVisits = this._byAlbumVisits(heat);
    albums.sort(byVisits);
    const sectionHtml = sections.map(sec => {
      const own = ((sec && sec.albumIds) || []).map(id => byId[String(id)]).filter(a => a && (canEdit || !a.coachOnly)).sort(byVisits);
      const tools = canEdit
        ? '<button type="button" class="btn btn-s btn-sm" data-action="rename-scheme-section" data-section-id="' + sanitize(sec.id || '') + '">Назва</button>' +
            '<button type="button" class="btn btn-s btn-sm" data-action="delete-scheme-section" data-section-id="' + sanitize(sec.id || '') + '">Видалити</button>'
        : '';
      const add = canEdit
        ? '<button type="button" class="ym-tile ym-tile-new" data-action="new-album-in-section" data-section-id="' + sanitize(sec.id || '') + '"><span class="ym-tile-art">+</span><span class="ym-tile-name">Альбом сюди</span></button>'
        : '';
      return this._schemeShelf({
        key: String(sec.id || ''),
        title: (sec && sec.name) || 'Розділ',
        albums: own,
        tools: tools,
        tail: add,
        empty: canEdit ? '' : 'У розділі ще немає альбомів'
      });
    }).join('');
    const rec = this._recommendedAlbums(s);
    const recShown = canEdit ? rec.albums : rec.albums.filter(a => a && !a.coachOnly);
    const recTiles = recShown.map(a => this._albumTile(a)).join('');
    const recNote = rec.personal
      ? (recTiles ? 'Підібрано з того, що відкриваєш саме ти. В іншого гравця список інший.' : 'Ти вже відкрив альбоми поруч. Новий з’явиться тут, щойно відкриєш щось інше.')
      : 'Відкрий альбом або схему. Тут з’являться альбоми саме для тебе.';
    return '<div class="ym">' +
      '<div class="ym-head"><h1>Схеми</h1>' +
        (canEdit
          ? '<span><button type="button" class="btn btn-s btn-sm" data-action="new-scheme-section">+ Розділ</button> <button type="button" class="btn btn-s btn-sm" data-action="new-scheme-album">+ Альбом</button> <button type="button" class="btn btn-p btn-sm" data-action="new-board">+ Схема</button></span>'
          : '') +
      '</div>' +
      '<p class="note-sm">Гортай розділ вліво і вправо. У рядку шість альбомів, які відкривають найчастіше. Решту відкриває «Ще». Довгий тап по іконці — меню.</p>' +
      this._schemeShelf({
        key: 'all',
        title: 'Всі альбоми',
        albums: canEdit ? albums : albums.filter(a => a && !a.coachOnly),
        lead: this._archiveTile(boards.length),
        tail: newAlbum
      }) +
      sectionHtml +
      '<p class="note-sm">' + recNote + '</p>' +
      this._schemeShelf({
        key: 'rec',
        title: 'Рекомендовані альбоми',
        albums: recShown,
        empty: 'Поки порожньо'
      }) +
      '</div>';
  },

  _trainingCancelled(tr) {
    if (!tr) return false;
    if (typeof LoadModel !== 'undefined' && LoadModel.isCancelled) return !!LoadModel.isCancelled(tr);
    const st = String(tr.status || '').toLowerCase();
    if (st === 'done' || st === 'completed' || st === 'проведено') return false;
    if (st === 'draft' || st === 'planned' || st === 'pinned') return false;
    if (st === 'cancelled' || st === 'canceled' || st === 'скасовано') return true;
    return !!tr.cancelledAt;
  },

  _playerBirth(p) {
    if (!p) return '';
    const raw = String(p.birthDate || (p.profile && p.profile.birthDate) || p.birthday || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
  },

  syncBirthdays() {
    const s = Store.get();
    if (!s) return;
    const keep = (s.calendar || []).filter(ev => !(ev && (ev.source === 'birthday' || ev.type === 'birthday')));
    const added = [];
    (s.players || []).forEach(p => {
      const raw = this._playerBirth(p);
      if (!raw) return;
      const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.name || ('#' + (p.number || ''));
      added.push({
        id: 'bday-' + p.id,
        source: 'birthday',
        type: 'birthday',
        date: raw,
        playerId: p.id,
        title: 'День народження · ' + name
      });
    });
    s.calendar = keep.concat(added);
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
    (s.matches || []).forEach(mt => {
      if (!mt || !mt.date) return;
      pushEvent({ date: mt.date, type: 'match', status: mt.status || '', title: mt.opponent ? ('vs ' + mt.opponent) : 'Матч', id: mt.id });
    });
    (s.calendar || []).forEach(ev => {
      if (!ev || !ev.date || ev.deleted || ev.removed) return;
      if (ev.trainingId && (s.trainings || []).some(t => t && t.id === ev.trainingId)) return;
      if (ev.matchId && (s.matches || []).some(mt => mt && mt.id === ev.matchId)) return;
      pushEvent({ date: ev.date, type: normType(ev.type || 'event'), status: ev.status || '', title: ev.title || 'Подія', id: ev.matchId || ev.id });
    });
    (s.players || []).forEach(p => {
      const raw = this._playerBirth(p);
      if (!raw) return;
      const parts = raw.split('-');
      if (Number(parts[1]) !== m + 1) return;
      const ds = y + '-' + parts[1] + '-' + parts[2];
      const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.name || ('#' + (p.number || ''));
      const age = y - Number(parts[0]);
      pushEvent({
        date: ds, type: 'birthday', status: '', title: name, id: 'bday-' + p.id, playerId: p.id,
        age: (age > 0 && age < 100) ? age : 0
      });
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
        if (e.type === 'birthday') cls += ' cal-dot-bday';
        else if (e.type === 'training') {
          const tr = (s.trainings || []).find(t => t && t.id === e.id);
          const off = tr ? this._trainingCancelled(tr) : isCancel(e.status);
          if (tr && tr.status === 'done') cls += ' cal-dot-done';
          else if (off) cls += ' cal-dot-cancel';
          else cls += ' cal-dot-plan';
        }
        else if (e.type === 'match') cls += ' cal-dot-match';
        else cls += ' cal-dot-ev';
        dots += '<span class="' + cls + '"></span>';
      });
      const hasMatch = dayEv.some(e => e.type === 'match');
      cells += '<button type="button" class="cal-cell cd' + (isToday ? ' cal-today today' : '') + (isSel ? ' cal-selected' : '') + (hasMatch ? ' has-match' : '') + (dayEv.length ? ' has-ev has' : '') + '" data-day="' + ds + '">' +
        '<span class="cal-d">' + d + '</span><span class="cal-dots">' + dots + '</span></button>';
    }

    let dayDetail = '';
    if (selDay) {
      const dayEv = byDate[selDay] || [];
      if (dayEv.length) {
        dayDetail = '<div class="card glass cal-day-detail"><div class="ct">' + sanitize(selDay) + '</div>' +
          dayEv.map(e => {
            if (e.type === 'birthday') {
              const years = e.age ? (' · ' + e.age + ' р.') : '';
              return '<button type="button" class="cal-ev-row cal-bday" data-action="open-player-card" data-player-id="' + sanitize(e.playerId || '') + '">🎂 ' +
                sanitize(e.title) + years + '</button>';
            }
            let extra = '';
            let kind = e.type === 'match' ? 'матч' : (e.type === 'training' ? 'тренування' : 'подія');
            let state = '';
            if (e.type === 'training') {
              const tr = (s.trainings || []).find(t => t.id === e.id);
              const off = tr ? this._trainingCancelled(tr) : isCancel(e.status);
              if (off) state = 'скасовано, не пропуск';
              else if ((tr && tr.status === 'done') || e.status === 'done') state = 'проведено';
              else if ((tr && tr.status === 'planned') || e.status === 'planned') state = 'заплановане';
              if (tr && !off) {
                const att = tr.attendance || {};
                const keys = Object.keys(att);
                let present = 0;
                keys.forEach(k => { if (att[k] && att[k].present !== false) present++; });
                extra = ' · відв. ' + present + '/' + (keys.length || '—');
              }
            }
            if (e.type === 'match' && e.id) {
              const mt = (s.matches || []).find(item => item && String(item.id) === String(e.id));
              const bits = [];
              if (mt && mt.time) bits.push(mt.time);
              if (mt) bits.push(mt.home === false ? 'виїзд' : 'дім');
              if (mt && mt.competition) bits.push(mt.competition);
              if (mt) bits.push('основа ' + (mt.xi || []).filter(Boolean).length + ' · лавка ' + (mt.bench || []).length);
              return '<div class="cal-ev-card">' + (mt ? this._matchPlaque(mt, { kicker: 'Матч', plain: true }) : '') +
                '<button type="button" class="cal-ev-row is-match" data-action="open-match" data-match-id="' + sanitize(e.id) + '">' +
                '<b>' + sanitize(mt && mt.opponent ? mt.opponent : e.title) + '</b>' +
                '<span class="note-sm">' + sanitize(bits.join(' · ')) + '</span></button></div>';
            }
            if (e.type === 'training') {
              const tr = (s.trainings || []).find(t => t && String(t.id) === String(e.id));
              const when = [tr && tr.date, tr && tr.time, tr && tr.duration ? (tr.duration + ' хв') : ''].filter(Boolean).join(' · ');
              return '<button type="button" class="cal-ev-row cal-ev-card" data-action="open-training" data-training-id="' + sanitize(e.id || '') + '">' +
                '<span class="cal-ev-kicker">Тренування' + (state ? (' · ' + state) : '') + '</span>' +
                '<b>' + sanitize(e.title) + '</b>' +
                '<span class="note-sm">' + sanitize(when) + extra + '</span></button>';
            }
            return '<div class="cal-ev-row">' + sanitize(e.title) +
              ' <span class="note-sm">(' + kind + (state ? ', ' + state : '') + extra + ')</span></div>';
          }).join('') + '</div>';
      } else {
        dayDetail = '<div class="card glass cal-day-detail"><div class="ct">' + sanitize(selDay) + '</div><p class="note-sm">Немає подій</p></div>';
      }
    }

    const canEditCal = typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach();
    return '<div class="st">Календар' +
      (canEditCal ? ' <button type="button" class="btn btn-p btn-sm" data-action="new-event">+ Подія</button>' : '') +
      '</div>' +
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
      '<p class="note-sm">Золота клітинка — матч. ● заплановане · ✓ проведено · ✕ скасовано · 🎂 день народження</p>' +
      this._liveClub() +
      this._clubFeed();
  },

  matches() {
    const s = Store.get();
    const openId = s.ui && s.ui.matchId;
    if (openId) {
      const match = (s.matches || []).find(m => m && String(m.id) === String(openId));
      if (match) return this._matchPlan(match);
    }
    const todayStr = (typeof today === 'function') ? today() : '';
    const canEdit = typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach();
    const list = (s.matches || []).slice().sort((a, b) => {
      const aUp = String(a.date || '') >= todayStr && a.status !== 'played' && a.status !== 'cancelled';
      const bUp = String(b.date || '') >= todayStr && b.status !== 'played' && b.status !== 'cancelled';
      if (aUp !== bUp) return aUp ? -1 : 1;
      const dir = aUp ? 1 : -1;
      return String(a.date || '').localeCompare(String(b.date || '')) * dir;
    });
    const rows = list.map(m => {
      const xiN = (m.xi || []).filter(Boolean).length;
      const benchN = (m.bench || []).length;
      const where = m.home === false ? 'виїзд' : 'дім';
      const state = m.status === 'played' ? 'зіграний' : (m.status === 'cancelled' ? 'скасований' : 'план');
      const score = (m.scoreUs != null && m.scoreUs !== '' && m.scoreThem != null && m.scoreThem !== '')
        ? (m.scoreUs + ':' + m.scoreThem) : '';
      return '<button type="button" class="card glass match-list-card" data-action="open-match" data-match-id="' + sanitize(m.id || '') + '" data-match-peek="1">' +
        '<div class="ct">' + sanitize(m.date || '') + (m.time ? (' · ' + sanitize(m.time)) : '') + ' · vs ' + sanitize(m.opponent || 'Суперник') + '</div>' +
        '<div class="note-sm">' + where + ' · ' + sanitize(m.scheme || '3-1-2-2-1-1') + ' · основа ' + xiN + ' · лавка ' + benchN +
        (m.competition ? (' · ' + sanitize(m.competition)) : '') + ' · ' + state + (score ? (' · ' + sanitize(score)) : '') + '</div></button>';
    }).join('');
    return '<div class="st">Матчі' + (canEdit ? ' <button class="btn btn-p btn-sm" data-action="new-match">+ Матч</button>' : '') + '</div>' +
      this._matchHub({ role: canEdit ? 'coach' : 'guest' }) +
      '<p class="note-sm">Тап відкриває план. Довгий тап показує основу і опис.</p>' +
      (rows || '<div class="es">Немає матчів. Тренер додає суперника, склад і підготовку.</div>');
  },

  _clubNames() {
    const s = Store.get();
    const set = (s && s.settings) || {};
    return [set.clubName, set.clubShort, 'Металіст Штуттгарт', 'МЕТАЛІСТ ШТУТТГАРТ', 'Metalist Stuttgart', 'Металіст', 'МШ']
      .map(name => String(name || '').trim()).filter(Boolean);
  },

  _matchStory(m) {
    const blocks = [
      ['План', m.plan],
      ['1-й тайм', m.plan1],
      ['2-й тайм', m.plan2],
      ['Стандарти', m.tactics],
      ['Перед матчем', m.preNotes],
      ['Після матчу', m.postNotes]
    ];
    const html = blocks.map(pair => {
      const text = String(pair[1] || '').trim();
      if (!text) return '';
      return '<div class="pm-note"><span>' + pair[0] + '</span><p>' + sanitize(text).replace(/\n/g, '<br>') + '</p></div>';
    }).join('');
    return html || '<p class="note-sm">Тренер ще не написав розбір цього матчу.</p>';
  },

  _groupTable(group, matches) {
    const names = this._clubNames();
    const isUs = (team) => names.some(name => name.toLowerCase() === String(team || '').trim().toLowerCase());
    const rows = (group.teams || []).map(team => ({ team: String(team), p: 0, gf: 0, ga: 0, pts: 0 }));
    const findRow = (team) => rows.find(row => row.team.toLowerCase() === String(team || '').trim().toLowerCase());
    (matches || []).forEach(m => {
      if (!m || m.scoreUs == null || m.scoreUs === '' || m.scoreThem == null || m.scoreThem === '') return;
      if (m.status === 'cancelled' || m.status === 'canceled') return;
      const us = rows.find(row => isUs(row.team));
      const opp = findRow(m.opponent);
      if (!us || !opp || us === opp) return;
      const gf = Number(m.scoreUs) || 0;
      const ga = Number(m.scoreThem) || 0;
      us.p += 1; opp.p += 1;
      us.gf += gf; us.ga += ga;
      opp.gf += ga; opp.ga += gf;
      if (gf > ga) us.pts += 3;
      else if (gf < ga) opp.pts += 3;
      else { us.pts += 1; opp.pts += 1; }
    });
    rows.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || a.team.localeCompare(b.team));
    if (!rows.length) return '';
    const body = rows.map(row => '<div class="pm-table-row' + (isUs(row.team) ? ' is-us' : '') + '"><b>' + sanitize(row.team) + '</b><span>' + row.p + '</span><span>' + row.gf + ':' + row.ga + '</span><strong>' + row.pts + '</strong></div>').join('');
    return '<div class="pm-table"><div class="pm-table-row pm-table-head"><b>' + sanitize(group.name || 'Група') + '</b><span>І</span><span>М</span><strong>О</strong></div>' + body + '</div>';
  },

  _bracketHtml(ties, canEdit, tournamentId) {
    const names = this._clubNames();
    const isUs = (team) => names.some(name => name.toLowerCase() === String(team || '').trim().toLowerCase());
    const rounds = [];
    (ties || []).forEach(tie => {
      const round = tie && tie.round ? String(tie.round) : 'Сітка';
      let bucket = rounds.find(item => item.name === round);
      if (!bucket) {
        bucket = { name: round, ties: [] };
        rounds.push(bucket);
      }
      bucket.ties.push(tie);
    });
    if (!rounds.length) {
      return '<p class="note-sm">Сітка з’явиться, коли тренер розставить пари цього турніру.</p>' +
        (canEdit && tournamentId ? '<button type="button" class="btn btn-s btn-sm" data-action="tournament-tie" data-tournament-id="' + sanitize(tournamentId) + '">Додати пару</button>' : '');
    }
    const html = rounds.map(round => '<div class="brk-round"><div class="brk-round-name">' + sanitize(round.name) + '</div>' +
      round.ties.map(tie => {
        const home = tie.home || '—';
        const away = tie.away || '—';
        const hs = tie.scoreHome != null && tie.scoreHome !== '' ? tie.scoreHome : '';
        const as = tie.scoreAway != null && tie.scoreAway !== '' ? tie.scoreAway : '';
        const open = tie.matchId ? ' data-action="open-match" data-match-id="' + sanitize(tie.matchId) + '"' : '';
        return '<button type="button" class="brk-tie"' + open + '>' +
          '<span class="' + (isUs(home) ? 'is-us' : '') + '"><b>' + sanitize(home) + '</b><i>' + sanitize(String(hs)) + '</i></span>' +
          '<span class="' + (isUs(away) ? 'is-us' : '') + '"><b>' + sanitize(away) + '</b><i>' + sanitize(String(as)) + '</i></span>' +
          '</button>';
      }).join('') + '</div>').join('');
    return '<div class="brk">' + html + '</div>' +
      (canEdit && tournamentId ? '<button type="button" class="btn btn-s btn-sm" data-action="tournament-tie" data-tournament-id="' + sanitize(tournamentId) + '">Додати пару</button>' : '');
  },

  _matchTimeline(list) {
    const todayStr = (typeof today === 'function') ? today() : new Date().toISOString().slice(0, 10);
    const future = [];
    const past = [];
    (list || []).forEach(m => {
      if (!m) return;
      if (String(m.date || '') >= todayStr) future.push(m);
      else past.push(m);
    });
    const bySoon = (a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.time || '').localeCompare(String(b.time || ''));
    const byLate = (a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.time || '').localeCompare(String(a.time || ''));
    future.sort(bySoon);
    past.sort(byLate);
    return future.concat(past);
  },

  _matchFold(player, match) {
    const s = Store.get() || {};
    const byId = {};
    (s.players || []).forEach(p => { if (p && p.id != null) byId[String(p.id)] = p; });
    const nameOf = (id) => {
      const p = id != null ? byId[String(id)] : null;
      if (!p) return '';
      return '#' + (p.number || '—') + ' ' + (p.lastName || p.firstName || '');
    };
    const line = (ids) => (ids || []).map(nameOf).filter(Boolean).join(', ') || '—';
    const subs = (Array.isArray(match.subs) ? match.subs : []).map(sub => {
      if (!sub) return '';
      return '<div class="pm-fold-row"><b>' + sanitize(String(sub.minute || '—')) + '′</b><span>' +
        sanitize(nameOf(sub.offId) || 'гравець') + ' → ' + sanitize(nameOf(sub.onId) || 'гравець') + '</span></div>';
    }).join('');
    const cards = [];
    Object.keys(match.attendance || {}).forEach(pid => {
      const cell = match.attendance[pid] || {};
      const yellow = Number(cell.yellow) || 0;
      const red = Number(cell.red) || 0;
      if (!yellow && !red) return;
      const bits = [];
      if (yellow) bits.push(yellow + ' жовті');
      if (red) bits.push(red + ' червоні');
      cards.push('<div class="pm-fold-row"><b>' + sanitize(nameOf(pid) || 'Гравець') + '</b><span>' + sanitize(bits.join(' · ')) + '</span></div>');
    });
    const squadIds = (match.xi || []).concat(match.bench || []);
    const hurt = [];
    const seenHurt = {};
    squadIds.forEach(id => {
      const p = id != null ? byId[String(id)] : null;
      if (!p || seenHurt[String(p.id)]) return;
      const st = String(p.status || '');
      if (st !== 'injured' && st !== 'rehab' && st !== 'recovery') return;
      seenHurt[String(p.id)] = true;
      const label = st === 'injured' ? 'травма' : 'відновлення';
      hurt.push('<div class="pm-fold-row"><b>' + sanitize(nameOf(p.id)) + '</b><span>' + label + '</span></div>');
    });
    const mine = player ? ((match.attendance || {})[player.id] || (match.attendance || {})[String(player.id)] || {}) : {};
    const mineBits = [];
    if (Number(mine.goals)) mineBits.push(mine.goals + ' гол');
    if (Number(mine.yellow)) mineBits.push(mine.yellow + ' жовті');
    if (Number(mine.red)) mineBits.push(mine.red + ' червоні');
    return '<div class="pm-fold">' +
      (mineBits.length ? '<p class="pm-fold-mine">' + sanitize(mineBits.join(' · ')) + '</p>' : '') +
      '<div class="pm-fold-block"><span>Склад</span><p>' + sanitize(line(match.xi)) + '</p></div>' +
      '<div class="pm-fold-block"><span>Лавка</span><p>' + sanitize(line(match.bench)) + '</p></div>' +
      '<div class="pm-fold-block"><span>Заміни</span>' + (subs || '<p class="note-sm">Замін не було.</p>') + '</div>' +
      '<div class="pm-fold-block"><span>Картки</span>' + (cards.join('') || '<p class="note-sm">Карток немає.</p>') + '</div>' +
      '<div class="pm-fold-block"><span>Травми</span>' + (hurt.join('') || '<p class="note-sm">Травмованих у заявці немає.</p>') + '</div>' +
      this._matchStory(match) +
      '<button type="button" class="btn btn-s btn-sm" data-action="open-match" data-match-id="' + sanitize(match.id || '') + '">Повний план</button>' +
      '</div>';
  },

  _playerMatchCard(player, match, role, opts) {
    const id = player && player.id;
    const cell = (match.attendance || {})[id] != null ? match.attendance[id] : ((match.attendance || {})[String(id)] || {});
    const present = cell.present === true || cell.present === 1 || cell.present === '1';
    const absent = cell.present === false || cell.present === 0 || cell.present === '0';
    const xi = (match.xi || []).some(x => x != null && String(x) === String(id));
    const bench = (match.bench || []).some(x => x != null && String(x) === String(id));
    let place = 'поза заявкою';
    if (xi) place = 'основа';
    else if (bench) place = 'лавка';
    const subs = Array.isArray(match.subs) ? match.subs : [];
    if (subs.some(sub => sub && String(sub.onId) === String(id))) place = 'вийшов на заміну';
    if (subs.some(sub => sub && String(sub.offId) === String(id))) place = 'замінений';
    if (absent) place = 'не грав';
    const minutes = (typeof LoadModel !== 'undefined' && LoadModel.playerMinutes) ? LoadModel.playerMinutes(match, id) : 0;
    const load = (present && typeof LoadModel !== 'undefined' && LoadModel.matchPlayerLoad) ? LoadModel.matchPlayerLoad(match, id) : 0;
    const goals = Number(cell.goals) || 0;
    const yellow = Number(cell.yellow) || 0;
    const red = Number(cell.red) || 0;
    const rating = cell.rating != null && cell.rating !== '' ? cell.rating : '';
    const score = (match.scoreUs != null && match.scoreUs !== '' && match.scoreThem != null && match.scoreThem !== '')
      ? (match.scoreUs + ' : ' + match.scoreThem) : '—';
    const when = [match.date, match.time].filter(Boolean).join(' · ');
    const showRating = role !== 'guest' && present && rating !== '';
    let ban = '';
    try {
      if (match.competition && typeof CoachTools !== 'undefined' && CoachTools.discipline) {
        const row = CoachTools.discipline(id, match.competition);
        if (row && row.sitNext) ban = '<span class="pm-ban">дискваліфікація</span>';
      }
    } catch (_) {}
    const fold = !!(opts && opts.fold);
    const stats = '<div class="pm-stats">' +
      '<span><b>' + (present || minutes ? minutes : '—') + '</b><small>хв</small></span>' +
      '<span><b>' + (present ? load : '—') + '</b><small>лоад</small></span>' +
      '<span><b>' + (present ? goals : '—') + '</b><small>голи</small></span>' +
      '<span><b>' + (present ? yellow : '—') + '</b><small>жовті</small></span>' +
      '<span><b>' + (present ? red : '—') + '</b><small>червоні</small></span>' +
      (showRating ? '<span><b>' + sanitize(String(rating)) + '</b><small>оцінка</small></span>' : '') +
      '</div>';
    if (fold) {
      return '<article class="pm-card glass" data-match-id="' + sanitize(match.id || '') + '">' +
        '<div class="pm-open">' +
          '<div class="pm-top"><b>vs ' + sanitize(match.opponent || 'Суперник') + '</b><span>' + sanitize(score) + '</span></div>' +
          '<div class="pm-meta">' + sanitize(when) + ' · ' + sanitize(place) + (ban ? (' · ' + ban) : '') + '</div>' +
        '</div>' +
        this._matchFold(player, match) +
      '</article>';
    }
    return '<article class="pm-card glass">' +
      '<button type="button" class="pm-open" data-action="open-match" data-match-id="' + sanitize(match.id || '') + '">' +
        '<div class="pm-top"><b>vs ' + sanitize(match.opponent || 'Суперник') + '</b><span>' + sanitize(score) + '</span></div>' +
        '<div class="pm-meta">' + sanitize(when) + ' · ' + sanitize(place) + (ban ? (' · ' + ban) : '') + '</div>' +
        stats +
      '</button>' +
      '<div class="pm-story">' + this._matchStory(match) + '</div>' +
    '</article>';
  },

  _matchHub(opts) {
    opts = opts || {};
    const role = opts.role || 'player';
    const s = Store.get() || {};
    const players = this._livePlayers(s.players);
    let focus = null;
    const picked = s.ui && s.ui.matchFocusId;
    if (role === 'player') {
      try { focus = (typeof AuthManager !== 'undefined' && AuthManager.getLinkedPlayer) ? AuthManager.getLinkedPlayer() : null; } catch (_) { focus = null; }
      focus = players.find(p => String(p.id) === String(picked)) || focus || players[0] || null;
    } else {
      focus = players.find(p => String(p.id) === String(picked)) || players[0] || null;
    }
    const canEdit = role === 'coach';
    const rail = '<div class="pm-rail">' + players.map(p => {
      const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.name || ('#' + (p.number || ''));
      const on = focus && String(focus.id) === String(p.id) ? ' on' : '';
      return '<button type="button" class="pm-chip' + on + '" data-action="match-focus-player" data-player-id="' + sanitize(p.id) + '">' +
        '<b>#' + sanitize(p.number || '—') + '</b><span>' + sanitize(name) + '</span></button>';
    }).join('') + '</div>';
    if (role === 'player' && !focus) {
      return '<div class="pm-hub"><div class="es">Тебе ще не прив’язали до картки гравця.</div></div>';
    }
    const matches = (s.matches || []).filter(m => m && m.status !== 'cancelled' && m.status !== 'canceled')
      .slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.time || '').localeCompare(String(a.time || '')));
    const mine = focus ? matches.filter(m => {
      const id = String(focus.id);
      const cell = (m.attendance || {})[focus.id] != null ? (m.attendance || {})[focus.id] : (m.attendance || {})[id];
      const called = (m.xi || []).concat(m.bench || []).some(x => x != null && String(x) === id);
      return called || (cell && cell.present != null);
    }) : matches;
    const bucketOf = (m) => String(m.competition || '').trim() || 'Товариські';
    const catalog = role === 'player' ? matches : (focus ? mine : matches);
    const bucketKeys = [];
    const seenBucket = {};
    catalog.forEach(m => {
      const key = bucketOf(m);
      if (!seenBucket[key]) { seenBucket[key] = true; bucketKeys.push(key); }
    });
    const pickedBucket = (s.ui && s.ui.matchBucket) || 'all';
    const activeBucket = (pickedBucket === 'all' || seenBucket[pickedBucket]) ? pickedBucket : 'all';
    const shown = activeBucket === 'all' ? catalog : catalog.filter(m => bucketOf(m) === activeBucket);
    let minutes = 0, load = 0, goals = 0, yellow = 0, red = 0, played = 0;
    if (focus) {
      matches.forEach(m => {
        const cell = (m.attendance || {})[focus.id] != null ? m.attendance[focus.id] : ((m.attendance || {})[String(focus.id)] || {});
        const present = cell.present === true || cell.present === 1 || cell.present === '1';
        if (!present) return;
        played += 1;
        minutes += (typeof LoadModel !== 'undefined' && LoadModel.playerMinutes) ? LoadModel.playerMinutes(m, focus.id) : 0;
        load += (typeof LoadModel !== 'undefined' && LoadModel.matchPlayerLoad) ? LoadModel.matchPlayerLoad(m, focus.id) : 0;
        goals += Number(cell.goals) || 0;
        yellow += Number(cell.yellow) || 0;
        red += Number(cell.red) || 0;
      });
    }
    const bucketChip = (key, label) => '<button type="button" class="pm-chip pm-bucket' + ((key === 'all' ? activeBucket === 'all' : activeBucket === key) ? ' on' : '') + '" data-action="match-bucket" data-bucket="' + sanitize(key) + '">' + sanitize(label) + '</button>';
    const filters = role === 'player' ? '' : ('<div class="pm-rail pm-buckets">' + bucketChip('all', 'Усі') + bucketKeys.map(key => bucketChip(key, key)).join('') + '</div>');
    const name = focus ? ([focus.firstName, focus.lastName].filter(Boolean).join(' ') || focus.name || 'Гравець') : 'Команда';
    const intro = role === 'guest'
      ? 'Лоад рахується з оцінки тренера, зіграних хвилин і ваги матчу ×' + ((typeof LoadModel !== 'undefined' && LoadModel.MATCH_WEIGHT) || 1.7) + '. Саму оцінку бачать гравець і тренер.'
      : 'Лоад цього матчу — оцінка тренера × хвилини × ' + ((typeof LoadModel !== 'undefined' && LoadModel.MATCH_WEIGHT) || 1.7) + '.';
    const buckets = {};
    const order = [];
    shown.forEach(m => {
      const key = String(m.competition || '').trim() || 'Товариські';
      if (!buckets[key]) { buckets[key] = []; order.push(key); }
      buckets[key].push(m);
    });
    const tournaments = s.tournaments || [];
    const shelves = order.map(key => {
      const tour = tournaments.find(item => item && String(item.name || '').trim().toLowerCase() === key.toLowerCase());
      const games = buckets[key].map(m => focus ? this._playerMatchCard(focus, m, role) : '').join('');
      const groups = tour ? (tour.groups || []).map(group => this._groupTable(group, buckets[key])).join('') : '';
      const bracket = (tour || key !== 'Товариські')
        ? ('<div class="pm-bracket"><div class="pm-kicker">Сітка</div>' + this._bracketHtml(tour && tour.bracket, canEdit, tour && tour.id) + '</div>')
        : '';
      const tools = canEdit && tour
        ? '<button type="button" class="btn btn-s btn-sm" data-action="tournament-group" data-tournament-id="' + sanitize(tour.id) + '">Додати групу</button>'
        : '';
      return '<section class="pm-shelf">' +
        '<div class="pm-shelf-h"><b>' + sanitize(key) + '</b><span>' + buckets[key].length + '</span></div>' +
        groups + bracket + tools + games +
      '</section>';
    }).join('');
    const known = {};
    order.forEach(key => { known[key.toLowerCase()] = true; });
    const waiting = canEdit ? tournaments.filter(item => item && !known[String(item.name || '').trim().toLowerCase()]).map(tour => {
      return '<section class="pm-shelf"><div class="pm-shelf-h"><b>' + sanitize(tour.name || 'Турнір') + '</b></div>' +
        '<p class="note-sm">Постав цю назву в полі «Турнір» у матчі, і гра з’явиться тут.</p>' +
        '<button type="button" class="btn btn-s btn-sm" data-action="tournament-group" data-tournament-id="' + sanitize(tour.id) + '">Додати групу</button>' +
        this._bracketHtml(tour.bracket, true, tour.id) +
      '</section>';
    }).join('') : '';
    if (role === 'player') {
      const timeline = this._matchTimeline(mine);
      const cards = timeline.map(m => this._playerMatchCard(focus, m, role, { fold: true })).join('');
      return '<div class="pm-hub">' +
        '<div class="pm-head"><div><div class="pm-kicker">Матчі гравця</div><h2>' + sanitize(name) + '</h2></div></div>' +
        '<p class="note-sm">Зверху обери гравця. Зверху списку найближчий матч, далі минулі. Довгий тап розгортає склад, заміни, картки і травми. Свайп відкриває план.</p>' +
        rail +
        (focus ? ('<div class="pm-season">' +
          '<span><b>' + played + '</b><small>ігор</small></span>' +
          '<span><b>' + minutes + '</b><small>хв</small></span>' +
          '<span><b>' + load + '</b><small>лоад</small></span>' +
          '<span><b>' + goals + '</b><small>голи</small></span>' +
          '<span><b>' + yellow + '</b><small>жовті</small></span>' +
          '<span><b>' + red + '</b><small>червоні</small></span>' +
        '</div>') : '') +
        (cards || '<div class="es">У цього гравця ще немає матчів.</div>') +
      '</div>';
    }
    return '<div class="pm-hub">' +
      '<div class="pm-head"><div><div class="pm-kicker">Матчі гравця</div><h2>' + sanitize(name) + '</h2></div>' +
        (canEdit ? '<button type="button" class="btn btn-p btn-sm" data-action="new-tournament">+ Турнір</button>' : '') +
      '</div>' +
      '<p class="note-sm">' + intro + '</p>' +
      rail +
      filters +
      (focus ? ('<div class="pm-season">' +
        '<span><b>' + played + '</b><small>ігор</small></span>' +
        '<span><b>' + minutes + '</b><small>хв</small></span>' +
        '<span><b>' + load + '</b><small>лоад</small></span>' +
        '<span><b>' + goals + '</b><small>голи</small></span>' +
        '<span><b>' + yellow + '</b><small>жовті</small></span>' +
        '<span><b>' + red + '</b><small>червоні</small></span>' +
      '</div>') : '') +
      (shelves || '<div class="es">Матчів ще немає.</div>') +
      waiting +
    '</div>';
  },

  _matchSubsHtml(m, players, byId, canEdit) {
    const subs = Array.isArray(m.subs) ? m.subs : [];
    const nameOf = (id) => {
      const p = id != null ? byId[String(id)] : null;
      return p ? (p.lastName || p.firstName || ('#' + (p.number || ''))) : 'гравець';
    };
    const rows = subs.map(sub => {
      if (!sub) return '';
      return '<div class="match-sub-row"><b>' + sanitize(String(sub.minute || '—')) + '′</b><span>' +
        sanitize(nameOf(sub.offId)) + ' → ' + sanitize(nameOf(sub.onId)) + '</span>' +
        (canEdit ? '<button type="button" class="btn btn-s btn-sm" data-action="match-sub-remove" data-sub-id="' + sanitize(sub.id || '') + '">Прибрати</button>' : '') +
        '</div>';
    }).join('');
    const xiIds = (m.xi || []).filter(id => id != null && id !== '' && byId[String(id)]);
    const onIds = (players || []).filter(p => p && !xiIds.some(id => String(id) === String(p.id)));
    const opt = (p) => '<option value="' + sanitize(p.id) + '">#' + sanitize(p.number || '—') + ' ' + sanitize(p.lastName || p.firstName || '') + '</option>';
    const form = canEdit
      ? '<div class="match-sub-add">' +
          '<input id="mpSubMin" type="number" min="1" max="120" value="60" aria-label="Хвилина">' +
          '<select id="mpSubOff" aria-label="Кого зняти">' + xiIds.map(id => opt(byId[String(id)])).join('') + '</select>' +
          '<select id="mpSubOn" aria-label="Кого випустити">' + onIds.map(opt).join('') + '</select>' +
          '<button type="button" class="btn btn-p btn-sm" data-action="match-sub-add">Заміна</button>' +
        '</div>'
      : '';
    return '<div class="match-block-label">Заміни</div>' +
      (rows || '<p class="note-sm">Замін ще немає. Хвилина, кого зняти з основи і кого випустити.</p>') +
      form;
  },

  _matchPlan(m) {
    const s = Store.get();
    const canEdit = typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach();
    const roles = (typeof CoachTools !== 'undefined' && CoachTools.schemeRoles)
      ? CoachTools.schemeRoles(m.scheme || '3-1-2-2-1-1')
      : [];
    const roleUa = { GK: 'ВР', DEF: 'ЗХ', MID: 'ПЗ', ATT: 'НАП' };
    const players = (s.players || []).slice().sort((a, b) => (Number(a.number) || 99) - (Number(b.number) || 99));
    const byId = {};
    players.forEach(p => { if (p && p.id != null) byId[String(p.id)] = p; });
    const surnameOf = (p) => (p && (p.lastName || p.firstName)) || 'Гравець';
    const metaOf = (p) => p
      ? ('#' + (p.number || '—') + (this._loadScore(p) != null ? (' · L' + this._fmtLoad(this._loadScore(p))) : ''))
      : '';
    const xi = (m.xi || []).slice(0, 11);
    while (xi.length < 11) xi.push(null);
    const bench = (m.bench || []).slice();
    const used = {};
    xi.forEach(id => { if (id != null && id !== '') used[String(id)] = true; });
    bench.forEach(id => { if (id != null && id !== '') used[String(id)] = true; });
    const compName = m.competition || '';
    const banOf = (p) => {
      try {
        if (!p || !compName || typeof CoachTools === 'undefined' || !CoachTools.discipline) return null;
        const row = CoachTools.discipline(p.id, compName);
        return row && row.sitNext ? row : null;
      } catch (_) { return null; }
    };
    const chip = (id, cls, role, name, meta) => {
      const body = '<span class="match-chip-role">' + sanitize(role || '•') + '</span>' +
        '<span class="match-chip-name">' + sanitize(name) + '</span>' +
        '<span class="match-chip-meta">' + sanitize(meta || '') + '</span>';
      return canEdit
        ? ('<button type="button" class="match-chip ' + cls + '" data-action="match-toggle" data-player-id="' + sanitize(String(id)) + '">' + body + '</button>')
        : ('<span class="match-chip ' + cls + '">' + body + '</span>');
    };
    const xiHtml = xi.map((id, i) => {
      const p = id != null ? byId[String(id)] : null;
      const role = roleUa[roles[i]] || roles[i] || (i + 1);
      if (!p) return '<span class="match-chip is-empty"><span class="match-chip-role">' + sanitize(String(role)) + '</span><span class="match-chip-name">вільно</span></span>';
      const banned = banOf(p);
      return chip(p.id, 'is-xi' + (banned ? ' is-banned' : ''), role, surnameOf(p), metaOf(p) + (banned ? ' · дискваліфікація' : ''));
    }).join('');
    const benchHtml = bench.map(id => {
      const p = byId[String(id)];
      if (!p) return '';
      const banned = banOf(p);
      return chip(p.id, 'is-bench' + (banned ? ' is-banned' : ''), p.position || 'Л', surnameOf(p), metaOf(p) + (banned ? ' · дискваліфікація' : ''));
    }).join('') || '<span class="note-sm">Лавка порожня</span>';
    const outHtml = players.filter(p => !used[String(p.id)]).map(p => {
      const banned = banOf(p);
      return chip(p.id, 'is-out' + (banned ? ' is-banned' : ''), p.position || '•', surnameOf(p), metaOf(p) + (banned ? ' · дискваліфікація' : ''));
    }).join('') ||
      '<span class="note-sm">Усі в заявці</span>';
    let call = '';
    try {
      const me = (typeof AuthManager !== 'undefined' && AuthManager.getLinkedPlayer) ? AuthManager.getLinkedPlayer() : null;
      if (me && me.id != null) {
        const mine = String(me.id);
        if (xi.some(id => id != null && String(id) === mine)) call = 'Ти в основі';
        else if (bench.some(id => String(id) === mine)) call = 'Ти на лавці';
        else if (xi.some(Boolean) || bench.length) call = 'Тебе немає в заявці';
      }
    } catch (_) {}
    const days = (typeof CoachTools !== 'undefined' && CoachTools.matchWeekDays) ? CoachTools.matchWeekDays(m.date) : [];
    const have = {};
    (s.trainings || []).forEach(t => { if (t && t.matchId === m.id && t.md) have[t.md] = true; });
    (s.calendar || []).forEach(e => { if (e && e.matchId === m.id && e.md === 'MD') have.MD = true; });
    const pickedDay = (s.ui && s.ui.matchDay) || '';
    const weekHtml = days.map(day => {
      const on = pickedDay === day.md ? ' is-on' : (have[day.md] ? ' is-have' : '');
      const tag = canEdit ? 'button' : 'span';
      const act = canEdit ? (' type="button" data-action="match-day" data-md="' + sanitize(day.md) + '"') : '';
      return '<' + tag + ' class="match-day' + on + '"' + act + '>' +
        sanitize(day.md) + '<small>' + sanitize(String(day.date || '').slice(5)) + '</small></' + tag + '>';
    }).join('');
    const picked = days.find(day => day.md === pickedDay);
    const dayTraining = picked ? (s.trainings || []).find(t => t && String(t.matchId) === String(m.id) && t.md === picked.md) : null;
    const dayNote = picked
      ? (picked.md + ' · ' + (picked.date || '') + (dayTraining ? (' · ' + (dayTraining.name || 'тренування')) : ' · тренування ще не складене'))
      : 'Обери день тижня. Склад від цього не змінюється.';
    const schemes = (typeof SCHEMES !== 'undefined') ? Object.keys(SCHEMES) : ['3-1-2-2-1-1'];
    if (schemes.indexOf(m.scheme) < 0 && m.scheme) schemes.unshift(m.scheme);
    const scheme = m.scheme || schemes[0] || '3-1-2-2-1-1';
    const status = m.status || 'planned';
    const field = (id, label, value, type) => '<label class="fl"><span class="fl-label">' + label + '</span>' +
      '<input class="fl-input" id="' + id + '" type="' + (type || 'text') + '" value="' + sanitize(value == null ? '' : String(value)) + '"' +
      (canEdit ? '' : ' readonly') + '></label>';
    const area = (id, label, value) => '<label class="fl"><span class="fl-label">' + label + '</span>' +
      (canEdit
        ? ('<textarea class="fl-input" id="' + id + '">' + sanitize(value || '') + '</textarea>')
        : ('<p class="note-sm">' + sanitize(value || '—') + '</p>')) + '</label>';
    const score = (m.scoreUs != null && m.scoreUs !== '' && m.scoreThem != null && m.scoreThem !== '')
      ? (m.scoreUs + ':' + m.scoreThem) : '';
    const clubLogo = (s.settings && s.settings.logoData) || this.clubMark();
    const warmOn = !!(have.WU || (m.warmup && String(m.warmup).trim()) || m.warmupAt);
    return '<div class="match-plan" data-match-id="' + sanitize(m.id || '') + '">' +
      '<div class="match-top"><button type="button" class="btn btn-s btn-sm" data-action="match-back">‹ Матчі</button><div class="st">План матчу</div></div>' +
      '<section class="card glass match-hero">' +
        this._matchPlaque(m, { plain: true, clubLogo: clubLogo, clubShort: (s.settings && s.settings.clubShort) || 'МШ', kicker: score ? 'Рахунок' : 'Матч' }) +
        (m.stadium ? ('<p class="note-sm match-stadium">' + sanitize(m.stadium) + '</p>') : '') +
        (call ? ('<p class="match-call">' + call + '</p>') : '') +
      '</section>' +
      (canEdit ? (
        '<div class="match-toolbar">' +
          '<button type="button" class="btn btn-p" data-action="match-save">Зберегти план</button>' +
          '<button type="button" class="btn btn-s" data-action="match-warmup">Розминка в день матчу</button>' +
          '<button type="button" class="btn btn-s" data-action="match-logo">Логотип суперника</button>' +
          (m.opponentLogo ? '<button type="button" class="btn btn-s" data-action="match-logo-clear">Прибрати логотип</button>' : '') +
          '<button type="button" class="btn btn-s" data-action="match-attendance">Явка, голи, картки</button>' +
        '</div>'
      ) : '') +
      '<section class="card glass"><div class="ct">Збір</div><div class="match-grid">' +
        field('mpMeet', 'Збір', m.meetTime, 'time') +
        field('mpGather', 'Місце збору', m.gatherPlace || '') +
        field('mpKick', 'Вихід на поле', m.kickoff || m.time, 'time') +
        field('mpComp', 'Турнір', m.competition || '') +
      '</div></section>' +
      '<section class="card glass"><div class="ct">Розминка перед матчем</div>' +
        '<div class="match-grid">' +
          field('mpWarmAt', 'Початок', m.warmupAt || '', 'time') +
          field('mpWarmMin', 'Хвилини', m.warmupMin != null && m.warmupMin !== '' ? m.warmupMin : 20, 'number') +
          field('mpWarmPlace', 'Місце', m.warmupPlace || '') +
        '</div>' +
        area('mpWarm', 'Що робимо', m.warmup) +
        '<p class="note-sm">Кожен рядок стає окремим блоком. Назва: ' +
          sanitize((typeof CoachTools !== 'undefined' && CoachTools.warmupTitle) ? CoachTools.warmupTitle(m, s) : ('Розминка • Металіст vs ' + (m.opponent || 'суперник'))) +
          '</p>' +
      '</section>' +
      '<section class="card glass"><div class="ct">Тиждень матчу</div>' +
        '<div class="match-week">' + weekHtml +
          '<span class="match-day' + (warmOn ? ' is-have' : '') + '">WU<small>розминка</small></span>' +
        '</div>' +
        '<p class="note-sm" id="mpDayNote">' + sanitize(dayNote) + '</p>' +
        '<p class="note-sm">MD-3 тактика, MD-2 стандарти, MD-1 активація, розминка в день матчу і відновлення.</p>' +
        (canEdit ? '<button type="button" class="btn btn-s btn-sm" data-action="match-week">Скласти тиждень</button>' : '') +
      '</section>' +
      '<section class="card glass"><div class="ct" id="mpSchemeTitle">Заявка · ' + sanitize(scheme) + '</div>' +
        (canEdit ? (
          '<label class="fl"><span class="fl-label">Схема</span><select class="fl-input" id="mpScheme">' +
            schemes.map(name => '<option value="' + sanitize(name) + '"' + (name === scheme ? ' selected' : '') + '>' + sanitize(name) + '</option>').join('') +
          '</select></label>' +
          '<div class="fl"><span class="fl-label">Альбом схем</span>' + this._albumPickRow(m.schemeAlbumId, 'mpAlbum') + '</div>' +
          '<div class="match-actions">' +
            '<button type="button" class="btn btn-s btn-sm" data-action="match-xi">За лоадом</button>' +
            '<button type="button" class="btn btn-p btn-sm" data-action="match-board">На дошку</button>' +
          '</div><p class="note-sm">Основа — 11 гравців із найбільшим лоадом з анкети. Решта на лавці. Травмовані не виходять в основу. Тап міняє місце гравця.</p>'
        ) : '<p class="note-sm">Склад зібрав тренер.</p>') +
        (function () {
          return players.map(p => {
            const row = banOf(p);
            if (!row) return '';
            return '<p class="note-sm match-ban">' + sanitize(surnameOf(p)) + ' · дискваліфікація в цьому турнірі</p>';
          }).filter(Boolean).join('');
        })() +
        '<div class="match-block-label">Основа</div><div class="match-chips">' + xiHtml + '</div>' +
        '<div class="match-block-label">Лавка</div><div class="match-chips">' + benchHtml + '</div>' +
        this._matchSubsHtml(m, players, byId, canEdit) +
        '<div class="match-block-label">Поза заявкою</div><div class="match-chips">' + outHtml + '</div>' +
      '</section>' +
      '<section class="card glass"><div class="ct">План</div>' +
        (canEdit ? (
          '<div class="match-grid">' +
            '<label class="fl"><span class="fl-label">Статус</span><select class="fl-input" id="mpStatus">' +
              '<option value="planned"' + (status === 'planned' ? ' selected' : '') + '>Запланований</option>' +
              '<option value="played"' + (status === 'played' ? ' selected' : '') + '>Зіграний</option>' +
              '<option value="cancelled"' + (status === 'cancelled' ? ' selected' : '') + '>Скасований</option>' +
            '</select></label>' +
            '<label class="fl"><span class="fl-label">Дім / виїзд</span><select class="fl-input" id="mpHome">' +
              '<option value="true"' + (m.home === false ? '' : ' selected') + '>Дім</option>' +
              '<option value="false"' + (m.home === false ? ' selected' : '') + '>Виїзд</option>' +
            '</select></label>' +
            field('mpScoreUs', 'Наші голи', m.scoreUs != null ? String(m.scoreUs) : '', 'number') +
            field('mpScoreThem', 'Голи суперника', m.scoreThem != null ? String(m.scoreThem) : '', 'number') +
          '</div>'
        ) : ('<p class="note-sm">' + (status === 'played' ? 'Зіграний' : (status === 'cancelled' ? 'Скасований' : 'Запланований')) +
          (score ? (' · ' + sanitize(score)) : '') + '</p>')) +
        area('mpPlan', 'Загальний план', m.plan) +
        area('mpP1', '1-й тайм', m.plan1) +
        area('mpP2', '2-й тайм', m.plan2) +
        area('mpTac', 'Стандарти, пресинг, переходи', m.tactics) +
        area('mpPre', 'Перед матчем', m.preNotes) +
        area('mpPost', 'Після матчу', m.postNotes) +
        (canEdit ? '<button type="button" class="btn btn-d btn-sm" data-action="match-delete">Видалити матч</button>' : '') +
      '</section>' +
      '</div>';
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
      const ordered = rows.slice().sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0) || String(a.label || '').localeCompare(String(b.label || ''), 'uk'));
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
      card('Навантаження 28 днів', 'Тренування: хв × RPE. Матч: 90 хв × оцінка × ' + ((typeof LoadModel !== 'undefined' && LoadModel.MATCH_WEIGHT) || 1.7), hbars(names.map(n => ({ label: n.label, value: n.st.load28 || 0, color: n.color })), r => r.color)) +
      card('XP гравців', 'Тренування, матчі, голи й оцінка', hbars(names.map(n => {
        let xp = 0;
        try { xp = (typeof PlayerProgress !== 'undefined' && PlayerProgress.compute) ? ((PlayerProgress.compute(n.p.id) || {}).xp || 0) : 0; } catch (_) {}
        return { label: n.label, value: xp, color: n.color };
      }), r => r.color)) +
      card('Навантаження матчів', 'Хто виходив: 90 хв × оцінка × ' + ((typeof LoadModel !== 'undefined' && LoadModel.MATCH_WEIGHT) || 1.7), hbars(names.map(n => {
        let load = 0;
        try { load = (typeof LoadModel !== 'undefined' && LoadModel.matchLoadFor) ? LoadModel.matchLoadFor(n.p.id, 365) : 0; } catch (_) {}
        return { label: n.label, value: load, text: load ? String(load) : '—', color: n.color };
      }), r => r.color)) +
      card('Подарунки', 'Скільки артефактів у кожного', hbars(names.map(n => ({ label: n.label, value: (s.gifts || []).filter(g => g && String(g.playerId) === String(n.p.id)).length, color: n.color })), r => r.color)) +
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
    let players = this._livePlayers(s.players);
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
    const giftCount = (pid) => (s.gifts || []).filter(g => g && String(g.playerId) === String(pid)).length;
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
        '<span class="an-visits">' + (st.present || 0) + '/' + ((st.present || 0) + (st.absent || 0)) + '</span>' +
        '<span class="an-rpe">' + (st.avgRpe != null ? st.avgRpe : '—') + '</span>' +
        '<span class="an-load">' + (st.load28 != null ? st.load28 : '—') + '</span>' +
        '<span class="an-gifts">' + gifts + '</span></div>';
    }).join('');
    const guest = typeof AuthManager !== 'undefined' && AuthManager.isGuest && AuthManager.isGuest();
    return '<div class="st">' + (guest ? 'Статистика' : 'Аналітика') + '</div>' +
      this._clubForgeHtml() +
      '<div class="card glass an-summary"><div class="ct">Проведені тренування: <b>' + trainings.length + '</b></div>' +
      '<div class="an-summary-line">Середня відвідуваність <b>' + avgAtt + '%</b> · візити <b>' + presentSum + '</b></div></div>' +
      this._loadHistoryCard() +
      this._analyticsCharts(players, getSt) +
      '<div class="card glass an-table">' +
      '<div class="an-head">' +
        '<span class="an-name">Гравець</span>' +
        '<button type="button" class="an-th" data-player-sort="visits">Візити</button>' +
        '<button type="button" class="an-th" data-player-sort="rpe">RPE</button>' +
        '<button type="button" class="an-th" data-player-sort="load">Load</button>' +
        '<button type="button" class="an-th" data-player-sort="gifts">Подарунки</button>' +
      '</div>' +
      '<div class="an-body">' + (rows || '<div class="es">Немає даних</div>') + '</div></div>';
  },

  _fmtLoad(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    const rounded = Math.round(n * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  },

  _loadForm(playerId) {
    try {
      if (typeof LoadModel !== 'undefined' && LoadModel.formLoad) return LoadModel.formLoad(playerId) || {};
    } catch (_) {}
    return {};
  },

  _loadScore(p) {
    if (!p) return null;
    const form = this._loadForm(p.id);
    return form && form.score != null ? form.score : null;
  },

  _loadRole() {
    try {
      if (typeof AuthManager !== 'undefined' && AuthManager.isGuest && AuthManager.isGuest()) return 'guest';
      if (typeof AuthManager !== 'undefined' && AuthManager.isPlayer && AuthManager.isPlayer()) return 'player';
    } catch (_) {}
    return 'coach';
  },

  _loadWeightText() {
    const w = (typeof LoadModel !== 'undefined' && LoadModel.MATCH_WEIGHT) || 1.7;
    return String(w).replace('.', ',');
  },

  _loadSplit(form) {
    const total = (form.trainUnits || 0) + (form.matchUnits || 0);
    const matchPct = total ? Math.round((form.matchUnits / total) * 100) : 0;
    const trainPct = total ? (100 - matchPct) : 0;
    return '<div class="load-split" aria-hidden="true"><i class="is-train" style="width:' + trainPct + '%"></i><i class="is-match" style="width:' + matchPct + '%"></i></div>';
  },

  _loadPanel(p, interactive) {
    if (!p) return '';
    const form = this._loadForm(p.id);
    const role = this._loadRole();
    const score = form.score != null ? this._fmtLoad(form.score) : '—';
    const blurb = role === 'guest'
      ? ('Число від 0 до 10 за 28 днів: явка, навантаження, матчі, голи й оцінка. Синя смуга — тренування, жовта — матчі.')
      : (role === 'player'
        ? ('Число вище, коли ти ходиш на тренування, граєш, забиваєш і маєш високу оцінку. Натисни рядок — відкриється гра або тренування.')
        : ('Від 0 до 10. Сюди входять явка, навантаження, матчі, голи й оцінка тренера. Одне тренування більше не ставить гравця першим.'));
    const events = (form.events || []).slice().reverse().slice(0, 5);
    const rows = events.map(ev => {
      const label = String(ev.date || '').slice(5) + ' · ' + (ev.name || '');
      const meta = 'оцінка ' + this._fmtLoad(ev.rating) + ' · ' + ev.units;
      if (interactive && role !== 'guest' && ev.id) {
        const action = ev.kind === 'match' ? 'open-match' : 'open-training';
        const attr = ev.kind === 'match'
          ? (' data-match-id="' + sanitize(String(ev.id)) + '"')
          : (' data-training-id="' + sanitize(String(ev.id)) + '"');
        return '<button type="button" class="load-event" data-action="' + action + '"' + attr + '><span>' + sanitize(label) + '</span><b>' + sanitize(meta) + '</b></button>';
      }
      return '<div class="load-event"><span>' + sanitize(label) + '</span><b>' + sanitize(meta) + '</b></div>';
    }).join('');
    const bits = 'Тренування ' + (form.trainN || 0) +
      (form.trainAvg != null ? (' · сер. ' + this._fmtLoad(form.trainAvg)) : '') +
      ' · матчі ' + (form.matchN || 0) +
      (form.matchAvg != null ? (' · сер. ' + this._fmtLoad(form.matchAvg)) : '') +
      (form.goals ? (' · голи ' + form.goals) : '');
    return '<div class="load-panel">' +
      '<div class="load-panel-top"><b class="load-panel-score">' + score + '</b><span>лоад · 28 днів</span></div>' +
      this._loadSplit(form) +
      '<p class="note-sm">' + blurb + '</p>' +
      '<p class="note-sm">' + bits + '</p>' +
      rows +
      '</div>';
  },

  playerMiniStats(p) {
    if (!p) return '';
    let st = { attPct: null, avgRpe: null, load28: null, present: 0, absent: 0 };
    try { st = this._playerStats(p.id) || st; } catch (_) {}
    const cond = p.readiness != null ? p.readiness : (p.condition != null ? p.condition : '—');
    const cell = (value, label) => '<div class="sms-cell"><b>' + value + '</b><span>' + label + '</span></div>';
    const score = this._loadScore(p);
    return '<div class="sheet-mini-stats" aria-label="Статистика гравця">' +
      cell((cond === '—' ? cond : cond + '%'), 'Готовність') +
      cell(st.attPct != null ? (st.attPct + '%') : '—', 'Відвідування') +
      cell(st.avgRpe != null ? st.avgRpe : '—', 'RPE') +
      cell(score != null ? this._fmtLoad(score) : '—', 'Лоад') +
      '</div><p class="sheet-mini-note">Був ' + (st.present || 0) + ' · пропуск ' + (st.absent || 0) +
      ' · load 28д ' + (st.load28 != null ? st.load28 : '—') + '</p>' +
      this._loadPanel(p, true);
  },

  _loadChangeNote(p) {
    const log = p && Array.isArray(p.loadLog) ? p.loadLog : [];
    const last = log.length ? log[log.length - 1] : null;
    if (!last || last.prev == null || last.prev === '' || String(last.prev) === String(p.load)) return '';
    const when = String(last.at || '').slice(0, 16).replace('T', ' ');
    return 'лоад ' + last.prev + ' → ' + p.load + (when ? (' · ' + when) : '');
  },

  _loadHistoryCard() {
    const s = Store.get();
    const role = this._loadRole();
    let meId = '';
    try {
      const me = (typeof AuthManager !== 'undefined' && AuthManager.getLinkedPlayer) ? AuthManager.getLinkedPlayer() : null;
      meId = me ? String(me.id) : '';
    } catch (_) {}
    const rows = this._livePlayers(s.players).slice().sort((a, b) => (this._loadScore(b) || 0) - (this._loadScore(a) || 0) || (Number(a.number) || 99) - (Number(b.number) || 99));
    if (!rows.length) return '';
    const intro = role === 'guest'
      ? ('Число від 0 до 10. Вище ті, хто ходить, грає і забиває. Синя частина смуги — тренування, жовта — матчі.')
      : (role === 'player'
        ? ('Твій рядок підсвічений. Натисни гравця, щоб відкрити картку. Вище ті, хто ходить на тренування, грає, забиває і має високу оцінку.')
        : ('Від 0 до 10: явка, навантаження, матчі, голи й оцінка. Хто був лише на одному тренуванні, попереду не стоїть.'));
    const line = rows.map(p => {
      const name = [p.lastName, p.firstName].filter(Boolean).join(' ') || p.name || ('#' + (p.number || '—'));
      const form = this._loadForm(p.id);
      const value = form.score != null ? this._fmtLoad(form.score) : '—';
      const mine = meId && String(p.id) === meId ? ' is-me' : '';
      const note = 'тренування ' + (form.trainN || 0) +
        (form.trainAvg != null ? (' · ' + this._fmtLoad(form.trainAvg)) : '') +
        ' · матчі ' + (form.matchN || 0) +
        (form.matchAvg != null ? (' · ' + this._fmtLoad(form.matchAvg)) : '') +
        (form.goals ? (' · голи ' + form.goals) : '');
      return '<button type="button" class="load-hist-row' + mine + '" data-action="open-player-card" data-player-id="' + sanitize(String(p.id)) + '">' +
        '<span>' + sanitize(name) + '</span><b>' + value + '</b>' +
        this._loadSplit(form) +
        '<small>' + sanitize(note) + '</small></button>';
    }).join('');
    return '<div class="card glass load-hist"><div class="ct">Лоад з оцінок</div>' +
      '<p class="note-sm">' + intro + '</p>' + line + '</div>';
  },

  _staffCard() {
    const s = Store.get();
    const set = s.settings || {};
    const staff = set.staff || {};
    const players = (s.players || []).slice().sort((a, b) => (a.number || 0) - (b.number || 0));
    const head = typeof AuthManager !== 'undefined' && AuthManager._canWriteClub && AuthManager._canWriteClub();
    const nameOf = (p) => '#' + (p.number || '—') + ' ' + sanitize(p.lastName || p.firstName || 'Гравець');
    const cap = players.find(p => p && p.isCaptain) || null;
    const assistants = Array.isArray(staff.assistants) ? staff.assistants.map(String) : [];
    const crest = head
      ? '<img class="settings-crest" src="assets/coach-crest.png" alt="Емблема Металіст Штуттгарт">'
      : '';
    if (!head) {
      const pres = players.find(p => p && String(p.id) === String(staff.presidentId || ''));
      const asst = assistants.map(id => players.find(p => p && String(p.id) === id)).filter(Boolean).map(nameOf);
      const assistant = typeof AuthManager !== 'undefined' && AuthManager.isAssistant && AuthManager.isAssistant();
      return '<div class="card glass settings-card"><div class="ct">Склад тренерів</div>' + crest +
        '<p class="note-sm">' + (assistant
          ? 'Ти помічник. Бачиш додаток як тренер. Зміни чекають підтвердження головного тренера.'
          : 'Помічників, президента і капітана призначає головний тренер.') + '</p>' +
        '<p>Президент: ' + sanitize(staff.presidentName || (pres ? nameOf(pres) : '—')) + '</p>' +
        '<p>Помічники: ' + sanitize(asst.join(', ') || '—') + '</p>' +
        '<p>Капітан: ' + sanitize(cap ? nameOf(cap) : '—') + '</p></div>';
    }
    const pres = players.find(p => p && String(p.id) === String(staff.presidentId || '')) || null;
    const chip = (role, id, label) => '<span class="staff-chip">' + sanitize(label) +
      '<button type="button" data-action="staff-remove" data-staff-role="' + role + '" data-player-id="' + sanitize(String(id)) + '" aria-label="Прибрати">×</button></span>';
    const plus = (role) => '<button type="button" class="staff-plus" data-action="staff-add" data-staff-role="' + role + '" aria-label="Додати">+</button>';
    const cat = (title, role, body) => '<section class="staff-cat"><div class="staff-cat-head"><span>' + title + '</span>' + plus(role) + '</div><div class="staff-chips">' + (body || '<span class="note-sm">Нікого</span>') + '</div></section>';
    const asstChips = assistants.map(id => {
      const p = players.find(x => x && String(x.id) === String(id));
      return p ? chip('assistant', p.id, nameOf(p)) : '';
    }).join('');
    return '<div class="card glass settings-card"><div class="ct">Склад тренерів</div>' + crest +
      '<p class="note-sm">Головний тренер — Artem Serdiuk. Помічник бачить додаток як тренер, а зміна чекає твого підтвердження.</p>' +
      cat('Помічники', 'assistant', asstChips) +
      cat('Президент', 'president', pres ? chip('president', pres.id, nameOf(pres)) : '') +
      '<label class="fl"><span class="fl-label">Президент не зі складу</span>' +
        '<input type="text" id="setPresidentName" class="fl-input" value="' + sanitize(staff.presidentName || '') + '" placeholder="Ім’я, якщо це не гравець">' +
      '</label>' +
      cat('Капітан', 'captain', cap ? chip('captain', cap.id, nameOf(cap)) : '') +
      '</div>';
  },

  _approvalsBanner() {
    const s = Store.get();
    const pending = ((s.settings && s.settings.approvals) || []).filter(item => item && item.status !== 'approved' && item.status !== 'rejected');
    const head = this.isHeadCoach();
    const assistant = typeof AuthManager !== 'undefined' && AuthManager.isAssistant && AuthManager.isAssistant();
    let html = '';
    if (assistant) {
      html += '<div class="card glass approval-note"><p class="note-sm">Ти помічник. Екран тренера відкритий. Будь-яка зміна піде головному тренеру і з’явиться після підтвердження.</p></div>';
    }
    if (!pending.length) return html;
    if (head) {
      html += pending.map(item => '<div class="card glass approval-card"><div class="ct">Підтвердження</div><p>' +
        sanitize((item.by || 'Помічник') + ': ' + (item.summary || 'зміна')) + '</p><div class="settings-actions">' +
        '<button type="button" class="btn btn-p btn-sm" data-action="approve-change" data-approval-id="' + sanitize(item.id) + '">Підтвердити</button>' +
        '<button type="button" class="btn btn-s btn-sm" data-action="reject-change" data-approval-id="' + sanitize(item.id) + '">Відхилити</button>' +
        '</div></div>').join('');
    } else if (assistant) {
      html += '<div class="card glass approval-card"><p class="note-sm">Чекає підтвердження: ' +
        sanitize(pending.map(item => item.summary || 'зміна').join(', ')) + '</p></div>';
    }
    return html;
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
      ${this._staffCard()}
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
          ${canEdit ? '' : '<p class="note-sm">Змінює лише тренер. Ваш екран підхопить їх сам.</p>'}
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
        </div>
      </div>
      ${canEdit ? '<div class="settings-savebar"><button type="button" class="btn btn-p" data-action="save-settings">Зберегти</button><p class="note-sm">Одна кнопка записує назву, коротку назву, кольори, логотип, тренера, президента, тренування, посилання і код сервера.</p></div>' : ''}
      ${this._approvalsBanner()}
      <div class="card glass settings-card">
        <div class="ct">Дані клубу</div>
        <p class="note-sm">Клуб ходить тільки через сервер. Гравець і гість файл не пересилають.</p>
        <p class="note-sm">Анкета гравця приносить його вибір подарунка біля імені і подарунки, яких ще немає у тренера. Явку лишає тренер.</p>
        <label class="fl"><span class="fl-label">Код клубу (anon public)</span>
          <input id="setSbKey" class="fl-input" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off" placeholder="eyJ… або sb_publishable…" value="${sanitize((typeof SupabaseClub !== 'undefined' && SupabaseClub._key) ? SupabaseClub._key() : '')}">
        </label>
        <button type="button" class="btn btn-p btn-sm" data-action="save-supabase-key">Підключити сервер</button>
        <p class="note-sm" id="clubSyncLine">${sanitize((typeof StorageManager !== 'undefined' && StorageManager._clubSyncText) || 'Клубний обмін: підключення…')}</p>
        ${canEdit ? '<p class="note-sm">Резервна копія лише для тренера. Нею клуб не передають.</p><div class="settings-actions"><button type="button" class="btn btn-s" data-action="export-json">Зберегти копію</button><button type="button" class="btn btn-s" data-action="import-trigger" id="btnImportJson">Відновити з копії</button></div>' : ''}
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
      <p class="note-sm">Версія ${this.versionLabel()}</p>
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

