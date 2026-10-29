/** Інструменти тренера + швидкі дії з Telegram */
const CoachTools = {
  /** Текст наступного тренування для шерингу в чат */
  formatNextTrainingMessage() {
    const s = Store.get();
    const today = (typeof LoadModel !== 'undefined' && LoadModel.todayStr)
      ? LoadModel.todayStr()
      : new Date().toISOString().slice(0, 10);
    const next = (s.trainings || [])
      .filter(t => t.status === 'planned' && t.date >= today)
      .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0];
    if (!next) return (typeof t==='function'?t('no_planned'):'Немає запланованих тренувань.');
    const blocks = (next.structure || [])
      .map(b => '• ' + (b.title || b.name || 'Блок') + ' — ' + (b.duration || 0) + ' хв')
      .join('\n');
    const club = (s.settings && s.settings.clubName) || 'МЕТАЛІСТ ШТУТГАРТ';
    return (
      '⚽ ' + club + '\n' +
      '📋 ' + (next.name || 'Тренування') + '\n' +
      '📅 ' + next.date + (next.time ? ' · ' + next.time : '') + '\n' +
      '⏱ ' + (next.duration || 0) + ' хв · RPE ' + (next.intensity || '—') + '\n' +
      (next.mainGoal ? '🎯 ' + next.mainGoal + '\n' : '') +
      (blocks ? '\nСтруктура:\n' + blocks : '')
    );
  },

  formatRosterSummary() {
    const s = Store.get();
    const avail = (s.players || []).filter(p => !p.status || p.status === 'available' || p.status === 'healthy');
    const inj = (s.players || []).filter(p => p.status === 'injured' || p.status === 'rehab' || p.status === 'recovery');
    const lines = avail
      .slice()
      .sort((a, b) => (a.number || 0) - (b.number || 0))
      .map(p => '#' + (p.number || '—') + ' ' + (p.lastName || p.firstName || '') + ' (' + (p.position || '') + ')')
      .join('\n');
    return (
      '👥 Склад у строю: ' + avail.length + '\n' +
      '🩹 Травма/відновлення: ' + inj.length + '\n\n' +
      (lines || (typeof t==='function'?t('toast_no_players'):'Немає гравців'))
    );
  },

  async shareNextTraining() {
    const text = this.formatNextTrainingMessage();
    const ok = await TelegramManager.shareText('План тренування · МЕТАЛІСТ ШТУТГАРТ', text);
    if (!ok && typeof Toast !== 'undefined') Toast.show(typeof t==='function'?t('toast_share_fail'):'Не вдалося поділитися — скопіюйте з буфера', 'warn');
    return ok;
  },

  async shareRoster() {
    const text = this.formatRosterSummary();
    return TelegramManager.shareText('Склад · МЕТАЛІСТ ШТУТГАРТ', text);
  },

  async syncCloudNow() {
    try {
      if (typeof StorageManager === 'undefined') return false;
      await TelegramManager.requestWriteAccess();
      if (StorageManager.pushToCloud) {
        StorageManager.pushToCloud();
        try { TelegramManager.hapticSuccess(); } catch (_) {}
        if (typeof Toast !== 'undefined') Toast.show(typeof t==='function'?t('toast_sync'):'Синхронізація з Telegram Cloud…', 'ok');
        return true;
      }
    } catch (e) {
      console.warn('[CoachTools] sync', e);
      try { TelegramManager.hapticError(); } catch (_) {}
      if (typeof Toast !== 'undefined') Toast.show(typeof t==='function'?t('toast_sync_err'):'Помилка синхронізації', 'error');
    }
    return false;
  },

  async migrateRoster() {
    try {
      if (typeof StorageManager === 'undefined' || !StorageManager.migrateRegisteredPlayers) {
        if (typeof Toast !== 'undefined') Toast.show('Міграція недоступна', 'warn');
        return;
      }
      const res = await StorageManager.migrateRegisteredPlayers();
      const msg = 'Міграція: ' + (res.linked || 0) + '/' + (res.total || 0) + ' з @ніком · збережено';
      if (typeof Toast !== 'undefined') Toast.show(msg, 'ok');
      if (!res.pack) return;
      const text = JSON.stringify(res.pack, null, 2);
      const blob = new Blob([text], { type: 'application/json' });
      const file = new File([blob], 'metalist-full-migration.json', { type: 'application/json' });
      // 1) Telegram / native share
      try {
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ title: 'Metalist Roster', text: 'Склад МЕТАЛІСТ ШТУТГАРТ', files: [file] });
          return;
        }
      } catch (_) {}
      try {
        if (navigator.share) {
          await navigator.share({ title: 'Metalist Roster', text: text.slice(0, 3500) });
        }
      } catch (_) {}
      // 2) Download fallback
      try {
        if (typeof StorageManager.downloadText === 'function') {
          StorageManager.downloadText(text, 'metalist-full-migration.json');
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'metalist-full-migration.json';
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        }
      } catch (_) {}
      // 3) Clipboard backup
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          if (typeof Toast !== 'undefined') Toast.show('JSON також у буфері обміну', 'ok');
        }
      } catch (_) {}
    } catch (e) {
      console.warn('[migrateRoster]', e);
      if (typeof Toast !== 'undefined') Toast.show('Помилка міграції', 'error');
    }
  },

  async pullCloudNow() {
    try {
      if (!StorageManager.pullFromCloud) return null;
      const data = await StorageManager.pullFromCloud();
      if (data) {
        try { TelegramManager.hapticSuccess(); } catch (_) {}
        if (typeof Toast !== 'undefined') Toast.show(typeof t==='function'?t('toast_cloud_ok'):'Дані з хмари завантажено', 'ok');
        if (typeof App !== 'undefined' && App.renderCurrent) App.renderCurrent();
      } else if (typeof Toast !== 'undefined') {
        Toast.show(typeof t==='function'?t('toast_cloud_empty'):'У хмарі немає новіших даних', 'warn');
      }
      return data;
    } catch (e) {
      console.warn('[CoachTools] pull', e);
      return null;
    }
  },

  /** Швидкий старт сесії: відкрити відвідування найближчого planned на сьогодні/майбутнє */
  openTodayAttendance() {
    const s = Store.get();
    const today = (typeof LoadModel !== 'undefined' && LoadModel.todayStr)
      ? LoadModel.todayStr()
      : new Date().toISOString().slice(0, 10);
    let t = (s.trainings || []).find(x => x.date === today && (x.status === 'planned' || x.status === 'done'));
    if (!t) {
      t = (s.trainings || [])
        .filter(x => x.status === 'planned' && x.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))[0];
    }
    if (!t) {
      if (typeof Toast !== 'undefined') Toast.show(typeof t==='function'?t('toast_no_training_att'):'Немає тренування для відміток', 'warn');
      return;
    }
    if (typeof Actions !== 'undefined' && Actions.openAttendance) {
      Actions.openAttendance(t.id);
      try { TelegramManager.haptic('medium'); } catch (_) {}
    }
  },

  startSessionTimers() {
    try {
      if (typeof TimerEngine !== 'undefined' && TimerEngine.startSession) {
        TimerEngine.startSession();
      } else {
        // fallback: клік по play у шапці
        document.querySelector('[data-action="timer-play"], [data-timer="play"]')?.click();
      }
      try { TelegramManager.haptic('medium'); } catch (_) {}
      if (typeof Toast !== 'undefined') Toast.show(typeof t==='function'?t('toast_session_start'):'Сесію запущено', 'ok');
    } catch (e) {
      console.warn(e);
    }
  },

  async exportAndShare() {
    try {
      if (typeof StorageManager !== 'undefined' && StorageManager.exportJSON) {
        await StorageManager.exportJSON();
        try { TelegramManager.hapticSuccess(); } catch (_) {}
      }
    } catch (e) {
      console.warn('[CoachTools] export', e);
    }
  },

  /** Панель інструментів тренера (HTML) */
  panelHtml() {
    const tg = typeof TelegramManager !== 'undefined' && TelegramManager.isTelegram;
    const platform = tg ? TelegramManager.platform() : 'browser';
    return `
      <div class="card glass coach-tools-panel">
        <div class="ct">Інструменти тренера</div>
        <p class="note-sm">Швидкі дії для сесії, складу та Telegram (${sanitize(platform)}).</p>
        <div class="coach-tools-grid">
          <button type="button" class="btn btn-p coach-tool" data-coach-tool="attendance">✓ Відвідування сьогодні</button>
          <button type="button" class="btn btn-s coach-tool" data-coach-tool="share-training">📤 План тренування в чат</button>
          <button type="button" class="btn btn-s coach-tool" data-coach-tool="share-roster">👥 Склад у чат</button>
          <button type="button" class="btn btn-s coach-tool" data-coach-tool="timer">▶ Старт сесії</button>
          <button type="button" class="btn btn-s coach-tool" data-coach-tool="sync-push">☁ ${typeof t==='function'?t('cloud_save_btn'):'Зберегти в Telegram Cloud'}</button>
          <button type="button" class="btn btn-s coach-tool" data-coach-tool="sync-pull">☁ Завантажити з Cloud</button>
          <button type="button" class="btn btn-s coach-tool" data-coach-tool="migrate-roster">🔄 Міграція ВСІХ даних (Telegram)</button>
          <button type="button" class="btn btn-s coach-tool" data-coach-tool="export">📦 Експорт / Share JSON</button>
          <button type="button" class="btn btn-s coach-tool" data-coach-tool="board">⛶ Тактична дошка</button>
        </div>
      </div>
      `;
  },

  handleAction(tool) {
    switch (tool) {
      case 'attendance': return this.openTodayAttendance();
      case 'share-training': return this.shareNextTraining();
      case 'share-roster': return this.shareRoster();
      case 'timer': return this.startSessionTimers();
      case 'sync-push': return this.syncCloudNow();
      case 'sync-pull': return this.pullCloudNow();
      case 'migrate-roster': return this.migrateRoster();
      case 'export': return this.exportAndShare();
      case 'board':
        try {
          if (typeof App !== 'undefined') {
            App.allowBoardOnce && App.allowBoardOnce('coach-tools');
            App.navigate('board');
          }
        } catch (_) {}
        return;
      default:
        return;
    }
  }
};

if (typeof window !== 'undefined') window.CoachTools = CoachTools;


/** ── Telegram-style gifts & memorable moments ── */
/** NFT-артефакти клубу (як Telegram Gifts) — унікальні серійні екземпляри */
CoachTools.GIFT_CATALOG = [
  /* ── Telegram-style animated emoji artifacts ── */
  { id: 'star_gold',   ico: '⭐', label: 'Золота зірка',     rarity: 'legendary', hue: 42,  pattern: 1, anim: 'sparkle' },
  { id: 'cup_silver',  ico: '🏆', label: 'Срібний кубок',    rarity: 'epic',      hue: 210, pattern: 2, anim: 'bounce' },
  { id: 'fire_core',   ico: '🔥', label: 'Ядро вогню',       rarity: 'rare',      hue: 14,  pattern: 3, anim: 'pulse' },
  { id: 'bolt_neon',   ico: '⚡', label: 'Неонова енергія',  rarity: 'rare',      hue: 55,  pattern: 4, anim: 'flash' },
  { id: 'heart_club',  ico: '❤️', label: 'Серце Металіста',  rarity: 'common',    hue: 350, pattern: 5, anim: 'heartbeat' },
  { id: 'medal_train', ico: '🏅', label: 'Медаль тренування',rarity: 'common',    hue: 38,  pattern: 6, anim: 'sway' },
  { id: 'ball_pro',    ico: '⚽', label: 'Pro-мʼяч',         rarity: 'epic',      hue: 120, pattern: 7, anim: 'spin' },
  { id: 'crown_coach', ico: '👑', label: 'Корона тренера',   rarity: 'legendary', hue: 48,  pattern: 8, anim: 'sparkle' },
  { id: 'boot_speed',  ico: '👟', label: 'Швидкі бутси',     rarity: 'rare',      hue: 280, pattern: 9, anim: 'bounce' },
  { id: 'glove_gk',    ico: '🧤', label: 'Рукавиці GK',      rarity: 'epic',      hue: 160, pattern: 10, anim: 'wiggle' },
  { id: 'whistle',     ico: '📢', label: 'Свисток лідера',   rarity: 'common',    hue: 200, pattern: 11, anim: 'pulse' },
  { id: 'shield',      ico: '🛡️', label: 'Щит оборони',      rarity: 'rare',      hue: 195, pattern: 12, anim: 'sway' },
  /* сучасні emoji-набори клубу */
  { id: 'rocket_form', ico: '🚀', label: 'Форма ракети',     rarity: 'epic',      hue: 200, pattern: 3, anim: 'launch',
    description: 'За вибуховий прогрес у сезоні.', momentHint: 'Вгору тільки вгору!' },
  { id: 'target_focus', ico: '🎯', label: 'Точний удар',      rarity: 'rare',      hue: 0,   pattern: 5, anim: 'pulse',
    description: 'За концентрацію і виконання завдань на тренуванні.' },
  { id: 'gem_metality', ico: '💎', label: 'Діамант Металіста', rarity: 'legendary', hue: 190, pattern: 8, anim: 'sparkle',
    description: 'Рідкісний артефакт за видатний внесок у клуб.' },
  { id: 'fox_smart',   ico: '🦊', label: 'Хитрий лис',       rarity: 'rare',      hue: 25,  pattern: 4, anim: 'wiggle',
    description: 'За розумну гру і тактичну кмітливість.' },
  { id: 'lion_heart',  ico: '🦁', label: 'Лев Штутгарта',    rarity: 'epic',      hue: 40,  pattern: 6, anim: 'roar',
    description: 'За лідерство і характер на полі.' },
  { id: 'dragon_power', ico: '🐉', label: 'Дракон сили',     rarity: 'legendary', hue: 320, pattern: 9, anim: 'pulse',
    description: 'Максимальна інтенсивність і бойовий дух.' },
  { id: 'sparkles_mvp', ico: '✨', label: 'MVP-іскра',        rarity: 'epic',      hue: 50,  pattern: 2, anim: 'sparkle',
    description: 'Гравець матчу / тренування.' },
  { id: 'camera_moment', ico: '📸', label: 'Кадр сезону',    rarity: 'rare',      hue: 210, pattern: 7, anim: 'flash',
    description: 'Пам\'ятний момент з фото або відео тренування.', momentHint: 'Збережи цей кадр назавжди.' },
  { id: 'idea_light',  ico: '💡', label: 'Ідея тренера',     rarity: 'rare',      hue: 50,  pattern: 3, anim: 'flash',
    description: 'За ідею, пропозицію або креативне рішення для клубу.' },
  { id: 'clutch_100',  ico: '💯', label: 'На всі 100',       rarity: 'epic',      hue: 140, pattern: 1, anim: 'bounce',
    description: 'Повне виконання плану тренування.' },
  { id: 'welcome_club_badge', ico: '🔰', label: 'Священна Гільза Клубу', rarity: 'common', hue: 200, pattern: 1, anim: 'sway',
    description: 'Тренер дарує цей артефакт кожному новобранцю як знак офіційного приєднання до нашої футбольної родини.',
    momentHint: 'Вітаємо в клубі! Перший крок у великій історії Metalist Stuttgart!' },
  { id: 'neural_horse_tester', ico: '🧠', label: 'Нейронний Ударник Штутгарта',
    rarity: 'legendary', hue: 280, pattern: 11, anim: 'neural', special: 'neural-horse',
    exclusive: 'grok', series: 'Architects',
    description: 'Цей артефакт вручається за глибоке занурення в архітектуру додатку, виявлення критичних багів та візіонерські пропозиції, що формують майбутнє Metalist Stuttgart.',
    momentHint: 'Творець майбутнього: твій код — фундамент нашої перемоги!' },
  { id: 'tyshchenko_first_golden_ball', ico: '⚽', label: 'Золотий М’яч Засновника',
    rarity: 'legendary', hue: 42, pattern: 12, anim: 'sparkle', exclusive: 'club',
    description: 'Тренер та команда дарує цей артефакт президенту клубу та головному організатору за візіонерство, створення фундаменту та запуск історичного сезону Metalist Stuttgart.',
    momentHint: 'Перший Золотий М’яч клубу 2025/2026: легендарний старт великої історії!' }
];

CoachTools.giftById = function (id) {
  return (CoachTools.GIFT_CATALOG || []).find(g => g.id === id) || null;
};

CoachTools.coachAttendanceRate = function () {
  try {
    const s = Store.get();
    const trainings = (s.trainings || []).filter(t => t.status === 'done');
    if (!trainings.length) return 100;
    let present = 0;
    trainings.forEach(t => { if (t.coachPresent !== false) present++; });
    return Math.round((present / trainings.length) * 100);
  } catch (_) { return 100; }
};

CoachTools.getCoachAchievements = function () {
  const s = Store.get();
  const set = s.settings || {};
  const cs = set.coachStats || s.coachStats || { appMs: 0, boardMs: 0 };
  const past = (s.trainings || []).filter(t => t.status === 'done');
  const planned = (s.trainings || []).filter(t => t.status === 'planned');
  const totalMin = past.reduce((a, t) => a + (t.duration || 0), 0);
  return {
    appMs: cs.appMs || 0,
    boardMs: cs.boardMs || 0,
    trainingsDone: past.length,
    trainingsPlanned: planned.length,
    sessionMinutes: totalMin,
    boards: (s.boards || []).length,
    players: (s.players || []).length,
    giftsGiven: (s.gifts || []).length,
    moments: (s.moments || []).length,
    attendancePct: CoachTools.coachAttendanceRate()
  };
};

CoachTools.giveGift = function (playerId, giftId, momentText) {
  const s = Store.get();
  if (!s.gifts) s.gifts = [];
  const def = CoachTools.giftById(giftId) || { id: giftId, ico: '🎁', label: giftId };
  const uid = 'g_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const entry = {
    uid,
    giftId: def.id,
    playerId,
    ico: def.ico,
    label: def.label,
    rarity: def.rarity || 'common',
    moment: momentText || def.momentHint || '',
    createdAt: new Date().toISOString()
  };
  s.gifts.push(entry);
  try { StorageManager.save(); } catch (_) {}
  try {
    if (typeof CoachTools.GiftFX === 'function') CoachTools.GiftFX(entry);
    else if (typeof Toast !== 'undefined') Toast.show('🎁 ' + (entry.label || 'Подарунок'), 'ok');
  } catch (_) {}
  return entry;
};

CoachTools.deleteGift = function (uid) {
  const s = Store.get();
  s.gifts = (s.gifts || []).filter(g => g.uid !== uid);
  try { StorageManager.save(); } catch (_) {}
  return true;
};

CoachTools.attachGift = function (uid) {
  // mark gift as pinned/status for player profile
  const s = Store.get();
  const g = (s.gifts || []).find(x => x.uid === uid);
  if (!g) return false;
  g.pinned = true;
  try { StorageManager.save(); } catch (_) {}
  return true;
};

CoachTools.GiftFX = function (entry) {
  try {
    document.getElementById('giftFxOverlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'giftFxOverlay';
    ov.className = 'gift-fx-overlay';
    const parts = [];
    for (let i = 0; i < 18; i++) {
      const ang = (Math.PI * 2 * i) / 18;
      const dist = 60 + Math.random() * 90;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;
      const colors = ['#f5c542', '#7cf0c0', '#3d7eff', '#ff8fbf', '#fff'];
      const c = colors[i % colors.length];
      parts.push('<span class="gift-fx-p" style="left:50%;top:50%;--dx:' + dx.toFixed(1) + 'px;--dy:' + dy.toFixed(1) + 'px;background:' + c + ';animation-delay:' + (i * 0.03).toFixed(2) + 's"></span>');
    }
    ov.innerHTML = '<div class="gift-fx-burst">' +
      '<div class="gift-fx-particles">' + parts.join('') + '</div>' +
      '<div class="gift-fx-ico">' + (entry.ico || '🎁') + '</div>' +
      '<div class="gift-fx-label">' + (entry.label || '') + '</div>' +
      (entry.moment ? ('<div class="gift-fx-moment">' + entry.moment + '</div>') : '') +
      '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('show'); });
    ov.addEventListener('click', function () {
      ov.classList.remove('show');
      setTimeout(function () { ov.remove(); }, 350);
    });
    setTimeout(function () {
      if (!ov.parentNode) return;
      ov.classList.remove('show');
      setTimeout(function () { ov.remove(); }, 400);
    }, 3200);
    try { TelegramManager.hapticSuccess && TelegramManager.hapticSuccess(); } catch (_) {}
  } catch (e) { console.warn('[GiftFX]', e); }
};

/** Анімація відкриття подарунка (коробка → спалах → артефакт) */
CoachTools.openGiftAnimation = function (entry, onDone) {
  try {
    document.getElementById('giftOpenOverlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'giftOpenOverlay';
    ov.className = 'gift-open-overlay';
    const ico = (entry && entry.ico) || '🎁';
    const label = (entry && entry.label) || 'Подарунок';
    const rar = (entry && entry.rarity) || 'common';
    const parts = [];
    for (let i = 0; i < 24; i++) {
      const ang = (Math.PI * 2 * i) / 24;
      const dist = 70 + Math.random() * 100;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist - 20;
      const colors = ['#f5c542', '#7cf0c0', '#3d7eff', '#ff8fbf', '#fff', '#c9a0ff'];
      parts.push('<span class="gift-open-p" style="--dx:' + dx.toFixed(1) + 'px;--dy:' + dy.toFixed(1) + 'px;background:' +
        colors[i % colors.length] + ';animation-delay:' + (0.55 + i * 0.02).toFixed(2) + 's"></span>');
    }
    ov.innerHTML =
      '<div class="gift-open-stage rarity-' + rar + '">' +
        '<div class="gift-open-particles">' + parts.join('') + '</div>' +
        '<div class="gift-open-box" aria-hidden="true">' +
          '<div class="gift-open-lid"></div>' +
          '<div class="gift-open-body"></div>' +
          '<div class="gift-open-bow"></div>' +
        '</div>' +
        '<div class="gift-open-reveal">' +
          '<div class="gift-open-ico">' + ico + '</div>' +
          '<div class="gift-open-label">' + (typeof sanitize === 'function' ? sanitize(label) : label) + '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('show'); });
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { ov.classList.add('opening'); });
    });
    try { TelegramManager.haptic && TelegramManager.haptic('medium'); } catch (_) {}
    const finish = function () {
      ov.classList.add('done');
      setTimeout(function () {
        ov.classList.remove('show');
        setTimeout(function () {
          ov.remove();
          if (typeof onDone === 'function') onDone();
        }, 320);
      }, 420);
    };
    setTimeout(finish, 1650);
    ov.addEventListener('click', function () {
      finish();
    }, { once: true });
  } catch (e) {
    console.warn('[openGift]', e);
    if (typeof onDone === 'function') onDone();
  }
};



/* ── Player account progression (FIFA-like XP) ── */
const PlayerProgress = {
  /** XP rules — attendance builds account, miss is mild penalty */
  RULES: {
    present: 18,
    absent: -6,
    intensityBonusMax: 12, // from RPE 1..10
    giftBonus: 25,
    levelBase: 100,
    levelGrowth: 1.35
  },

  compute(playerId) {
    const s = Store.get();
    const p = (s.players || []).find(x => x.id === playerId) || {};
    const trainings = (s.trainings || []).filter(t => t.status === 'done');
    let xp = 0;
    let present = 0, absent = 0, sessions = 0;
    const history = [];
    trainings.forEach(t => {
      const att = (t.attendance || {})[playerId];
      if (!att) return;
      sessions++;
      const was = att.present !== false && att.present !== 0;
      if (was) {
        present++;
        let gain = this.RULES.present;
        const rpe = att.rpe != null ? +att.rpe : (att.intensity != null ? +att.intensity : 0);
        if (rpe > 0) gain += Math.min(this.RULES.intensityBonusMax, Math.round(rpe * 1.2));
        xp += gain;
        history.push({ date: t.date, name: t.name, delta: gain, kind: 'present' });
      } else {
        absent++;
        xp += this.RULES.absent;
        history.push({ date: t.date, name: t.name, delta: this.RULES.absent, kind: 'absent' });
      }
    });
    const gifts = (s.gifts || []).filter(g => g.playerId === playerId);
    xp += gifts.length * this.RULES.giftBonus;
    gifts.forEach(g => history.push({ date: (g.createdAt || '').slice(0, 10), name: g.label || 'Подарунок', delta: this.RULES.giftBonus, kind: 'gift' }));
    if (xp < 0) xp = 0;
    // level curve
    let level = 1, need = this.RULES.levelBase, remain = xp;
    while (remain >= need && level < 99) {
      remain -= need;
      level++;
      need = Math.round(this.RULES.levelBase * Math.pow(this.RULES.levelGrowth, level - 1));
    }
    const pct = need ? Math.min(100, Math.round((remain / need) * 100)) : 100;
    const attPct = sessions ? Math.round((present / sessions) * 100) : 0;
    return {
      xp, level, levelProgress: pct, xpIntoLevel: remain, xpToNext: need - remain, need,
      present, absent, sessions, attPct,
      form: level >= 80 ? '99' : level >= 50 ? 'elite' : level >= 25 ? 'pro' : 'rising',
      history: history.slice(-12).reverse()
    };
  }
};
if (typeof window !== 'undefined') window.PlayerProgress = PlayerProgress;
CoachTools.playerGifts = function (playerId) {
  try { return (Store.get().gifts || []).filter(g => g.playerId === playerId); } catch (_) { return []; }
};
