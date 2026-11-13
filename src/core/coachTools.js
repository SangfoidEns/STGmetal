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
    const club = (s.settings && s.settings.clubName) || 'МЕТАЛІСТ ШТУТТГАРТ';
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
    const ok = await TelegramManager.shareText('План тренування · МЕТАЛІСТ ШТУТТГАРТ', text);
    if (!ok && typeof Toast !== 'undefined') Toast.show(typeof t==='function'?t('toast_share_fail'):'Не вдалося поділитися — скопіюйте з буфера', 'warn');
    return ok;
  },

  async shareRoster() {
    const text = this.formatRosterSummary();
    return TelegramManager.shareText('Склад · МЕТАЛІСТ ШТУТТГАРТ', text);
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
          await navigator.share({ title: 'Metalist Roster', text: 'Склад МЕТАЛІСТ ШТУТТГАРТ', files: [file] });
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
  /* Футбольні колекційні Металіста — як подарунки Telegram: фон, символ, рідкість, серійний номер */
  { id: 'crest_edition', ico: '🛡️', label: 'Щит Штуттгарта', rarity: 'legendary', hue: 45, pattern: 12, anim: 'sparkle',
    description: 'Клубний щит сезону. Кожен екземпляр має свій візерунок.', momentHint: 'За клуб. За Штуттгарт.' },
  { id: 'golden_boot', ico: '👟', label: 'Золота бутса', rarity: 'legendary', hue: 42, pattern: 8, anim: 'bounce',
    description: 'За голи і удари, від яких тримається рахунок.' },
  { id: 'clean_sheet', ico: '🧤', label: 'Суха сітка', rarity: 'epic', hue: 168, pattern: 10, anim: 'sway',
    description: 'Ворота лишились зачиненими.' },
  { id: 'hat_trick', ico: '⚽', label: 'Хет-трик', rarity: 'epic', hue: 28, pattern: 7, anim: 'spin',
    description: 'Три голи в одному матчі або три точні виконання на тренуванні.' },
  { id: 'captain_band', ico: '🎗️', label: 'Пов’язка капітана', rarity: 'epic', hue: 48, pattern: 1, anim: 'pulse',
    description: 'За голос у роздягальні і рішення на полі.' },
  { id: 'last_minute', ico: '⏱️', label: 'Остання хвилина', rarity: 'rare', hue: 12, pattern: 4, anim: 'flash',
    description: 'За характер, коли час уже спливає.' },
  { id: 'derby_night', ico: '🏟️', label: 'Ніч дербі', rarity: 'rare', hue: 220, pattern: 3, anim: 'pulse',
    description: 'За гру, яку пам’ятає трибуна.' },
  { id: 'first_touch', ico: '✨', label: 'Перший дотик', rarity: 'common', hue: 50, pattern: 2, anim: 'sparkle',
    description: 'За чистий перший дотик і включення в епізод.' },
  /* ── Класичні артефакти клубу ── */
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
  { id: 'lion_heart',  ico: '🦁', label: 'Лев Штуттгарта',    rarity: 'epic',      hue: 40,  pattern: 6, anim: 'roar',
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
  { id: 'neural_horse_tester', ico: '🧠', label: 'Нейронний Ударник Штуттгарта',
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

/** Унікальні фонові символи подарунка (як у Telegram Gifts) */
CoachTools.GIFT_PATTERN_SYMBOLS = {
  1:  ['⚽', '✦', '★', '·', '🛡️'],
  2:  ['🥅', '·', '✦', '○', '⚽'],
  3:  ['👟', '·', '✧', '▲', '·'],
  4:  ['⏱️', '·', '✦', '⚡', '·'],
  5:  ['💛', '·', '★', '💙', '·'],
  6:  ['🐴', '·', '✦', '★', '·'],
  7:  ['●', '○', '⚽', '◎', '·'],
  8:  ['👑', '·', '✦', '★', '·'],
  9:  ['▶', '·', '⚽', '✦', '·'],
  10: ['🧤', '·', '✦', '🥅', '·'],
  11: ['◎', '·', '⬡', '✦', '·'],
  12: ['🛡️', '·', '★', '⚽', '·']
};
CoachTools.giftSeed = function (g) {
  const raw = [
    g && (g.seed != null ? String(g.seed) : ''),
    g && (g.patternSeed || g.uid || g.id || ''),
    g && (g.serial || ''),
    g && (g.giftId || ''),
    g && (g.playerId || ''),
    g && (g.createdAt || '')
  ].join('|') || 'metalist-stuttgart';
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
CoachTools.mintSerial = function (key) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let h = 2166136261;
  const s = String(key || 'metalist');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h = h >>> 0;
  let code = '';
  let x = h;
  for (let i = 0; i < 4; i++) {
    code += alphabet[x % alphabet.length];
    x = Math.imul(x, 16777619) >>> 0;
  }
  return 'MS-' + code + '-' + String(1000 + (h % 9000));
};
CoachTools.giftHue = function (g) {
  if (!g) return 42;
  // Старі екземпляри вже мають власний seed і свій відтінок.
  if (g.seed != null && g.seed !== '' && g.hue != null && isFinite(Number(g.hue))) {
    return (Number(g.hue) % 360 + 360) % 360;
  }
  let base = 42;
  try {
    const def = g.giftId && CoachTools.giftById(g.giftId);
    if (def && def.hue != null && isFinite(Number(def.hue))) base = Number(def.hue);
    else if (g.hue != null && isFinite(Number(g.hue))) base = Number(g.hue);
  } catch (_) {}
  const shift = (CoachTools.giftSeed(g) >>> 4) % 16;
  return (base + shift * 19) % 360;
};
CoachTools.giftLabel = function (g) {
  if (!g) return '';
  const def = g.giftId && CoachTools.giftById(g.giftId);
  return (def && def.label) || g.label || '';
};
CoachTools.giftSerial = function (g) {
  if (!g) return '';
  const cur = g.serial ? String(g.serial) : '';
  if (/^MS-[A-Z0-9]{4}-\d{4}$/.test(cur)) return cur;
  return CoachTools.mintSerial(g.uid || g.id || g.patternSeed || ((g.giftId || '') + '|' + (g.createdAt || '') + '|' + (g.playerId || '')));
};
CoachTools.giftPatternSymbols = function (g) {
  try {
    const def = (g && g.giftId && CoachTools.giftById(g.giftId)) || g || {};
    const pid = def.pattern != null ? def.pattern : (g && g.pattern != null ? g.pattern : 1);
    const base = CoachTools.GIFT_PATTERN_SYMBOLS[pid] || CoachTools.GIFT_PATTERN_SYMBOLS[1];
    const ico = (g && g.ico) || def.ico || '★';
    const seed = CoachTools.giftSeed(g);
    const shift = seed % base.length;
    const spun = base.slice(shift).concat(base.slice(0, shift));
    return [ico, spun[0], spun[1], ico, spun[2], spun[3 % spun.length], spun[0], spun[4] || spun[1]];
  } catch (_) {
    return ['★', '✦', '·', '✧', '★', '·'];
  }
};
/** Футбольні символи фону. Екземпляр подарунка бере один знак і повторює його сіткою, як у Telegram. */
CoachTools.FOOTBALL_PATTERNS = [
  { id: 'ball', label: 'М’яч' },
  { id: 'goal', label: 'Ворота' },
  { id: 'boot', label: 'Бутса' },
  { id: 'whistle', label: 'Свисток' },
  { id: 'jersey', label: 'Майка' },
  { id: 'captain', label: 'Капітан' },
  { id: 'flag', label: 'Прапорець' },
  { id: 'cup', label: 'Кубок' },
  { id: 'glove', label: 'Рукавиця' },
  { id: 'scarf', label: 'Шарф' },
  { id: 'medal', label: 'Медаль' },
  { id: 'horse', label: 'Кінь' },
  { id: 'shield', label: 'Герб' },
  { id: 'timer', label: 'Секундомір' },
  { id: 'cone', label: 'Фішка' },
  { id: 'studs', label: 'Шипи' }
];
CoachTools.FOOTBALL_SYMBOLS = CoachTools.FOOTBALL_PATTERNS;
CoachTools._patternBase = function (g) {
  const n = (CoachTools.FOOTBALL_PATTERNS || []).length || 1;
  let x = g ? CoachTools.giftSeed(g) : 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x % n;
};
CoachTools.footballPatternIndex = function (g) {
  const n = (CoachTools.FOOTBALL_PATTERNS || []).length || 1;
  const base = CoachTools._patternBase(g);
  try {
    if (!g || !g.giftId || typeof Store === 'undefined' || !Store.get) return base;
    const sibs = (Store.get().gifts || []).filter(s => s && s.giftId === g.giftId)
      .slice()
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || String(a.id || a.uid || '').localeCompare(String(b.id || b.uid || '')));
    const used = new Set();
    let mine = base;
    const key = String(g.uid || g.id || '');
    sibs.forEach(s => {
      let i = CoachTools._patternBase(s);
      let guard = 0;
      while (used.has(i) && guard < n) { i = (i + 1) % n; guard += 1; }
      used.add(i);
      if (String(s.uid || s.id || '') === key) mine = i;
    });
    return mine;
  } catch (_) {}
  return base;
};
CoachTools._footballSymbol = function (id, ink, opacity) {
  const op = opacity == null ? 0.26 : opacity;
  const g = '<g fill="' + ink + '" stroke="none" opacity="' + op + '">';
  const z = '</g>';
  const e = ' fill-rule="evenodd"';
  if (id === 'ball') {
    return g + '<path' + e + ' d="M6.5,0 A6.5,6.5 0 1 1 -6.5,0 A6.5,6.5 0 1 1 6.5,0 Z M0,-2.7 L2.55,-0.85 L1.58,2.15 L-1.58,2.15 L-2.55,-0.85 Z"/>' + z;
  }
  if (id === 'goal') {
    return g + '<path d="M-6.2,5.4 V-4.4 H6.2 V5.4 H4.5 V-2.7 H-4.5 V5.4 Z"/>' + z;
  }
  if (id === 'boot') {
    return g + '<path d="M-5.4,1.2 C-5.8,-0.6 -4.4,-2.2 -2.4,-2.5 L-3.5,-5.2 L-1.1,-4.4 L-0.3,-2.3 L2.2,-2 C4.6,-1.5 6.3,0 6.4,1.5 C6.5,2.7 5.2,3.4 3.8,3.4 L3.8,4.3 A0.65,0.65 0 1 1 2.5,4.3 L2.5,3.4 L1.1,3.4 L1.1,4.4 A0.65,0.65 0 1 1 -0.2,4.4 L-0.2,3.4 L-1.8,3.4 L-1.8,4.3 A0.65,0.65 0 1 1 -3.1,4.3 L-3.1,3.4 H-4.2 C-5.5,3.4 -5.8,2.2 -5.4,1.2 Z"/>' + z;
  }
  if (id === 'whistle') {
    return g + '<path' + e + ' d="M-7,-0.7 H-3.4 V-2.2 H2.4 C5,-2.2 6.4,-0.7 6.4,0.9 C6.4,2.6 4.8,3.7 2.4,3.7 H-3.4 V1.5 H-7 Z M-1.7,-2.2 H-0.5 V-3.4 H-1.7 Z M-2.15,-4.85 A1.15,1.15 0 1 0 0.15,-4.85 A1.15,1.15 0 1 0 -2.15,-4.85 Z M-1.48,-4.85 A0.48,0.48 0 1 0 -0.52,-4.85 A0.48,0.48 0 1 0 -1.48,-4.85 Z M3.15,0.75 A0.75,0.75 0 1 0 4.65,0.75 A0.75,0.75 0 1 0 3.15,0.75 Z"/>' + z;
  }
  if (id === 'jersey') {
    return g + '<path d="M-6,-2 L-3.6,-5 L-1.8,-5.8 L0,-3.6 L1.8,-5.8 L3.6,-5 L6,-2 L4.5,-0.5 V5.4 H-4.5 V-0.5 Z"/>' + z;
  }
  if (id === 'captain') {
    return g + '<path' + e + ' d="M-6.6,-2.6 H6.6 C7.3,-2.6 7.5,-1.2 6.8,-0.5 V0.5 C7.5,1.2 7.3,2.6 6.6,2.6 H-6.6 C-7.3,2.6 -7.5,1.2 -6.8,0.5 V-0.5 C-7.5,-1.2 -7.3,-2.6 -6.6,-2.6 Z M3.1,-1.7 C0.2,-3.5 -2.8,-1.8 -2.8,0 C-2.8,1.8 0.2,3.5 3.1,1.7 L1.9,0.45 C0.4,1.4 -1.2,0.7 -1.2,0 C-1.2,-0.7 0.4,-1.4 1.9,-0.45 Z"/>' + z;
  }
  if (id === 'flag') {
    return g + '<path d="M-1.5,6.2 V-5.6 A0.9,0.9 0 1 1 0.3,-5.6 V-5.4 L6.2,-2.8 L0.3,-0.2 V6.2 Z"/>' + z;
  }
  if (id === 'cup') {
    return g + '<path d="M-4.2,-4.4 H4.2 L3,1.1 C2.4,3 1.4,4 0,4 C-1.4,4 -2.4,3 -3,1.1 Z M-0.65,4 H0.65 V5.5 H2.5 V6.6 H-2.5 V5.5 H-0.65 Z M-4.2,-3.4 C-6.8,-3.4 -6.8,0.2 -4.2,0.5 V-0.6 C-5.4,-0.5 -5.4,-2.2 -4.2,-2.3 Z M4.2,-3.4 C6.8,-3.4 6.8,0.2 4.2,0.5 V-0.6 C5.4,-0.5 5.4,-2.2 4.2,-2.3 Z"/>' + z;
  }
  if (id === 'glove') {
    return g + '<g transform="scale(0.68)"><path' + e + ' d="M-8.6,4.4 C-9.6,6 -7.4,8 -5.2,8.4 L-3.8,9.2 H4.4 C6.8,8.6 7.2,4.6 6,1.8 L5.2,-0.2 L5.2,-5.6 C5.3,-7.6 2.7,-8 2.5,-6 L2.4,-0.4 L1.3,-0.8 L1.2,-7.8 C1.1,-9.8 -1.5,-10 -1.6,-8 L-1.5,-1 L-2.6,-0.6 L-2.8,-6 C-2.9,-8 -5.5,-8 -5.4,-6 L-5.1,0.4 C-6.6,1 -8.2,2.4 -8.6,4.4 Z M-4.2,4.2 H3.6 V5.6 H-4.2 Z"/></g>' + z;
  }
  if (id === 'scarf') {
    return g + '<path d="M-5.8,-2.2 C-2.4,-4.6 2.4,-4.6 5.8,-2.2 L5,-1.1 C2.2,-2.8 -2.2,-2.8 -5,-1.1 Z M-4.8,-1.4 L-5.6,4.8 H-3.2 L-2.6,-0.8 Z M2.2,-1 L3.2,5.6 H5.6 L4.4,-1.4 Z M-5.7,4.8 H-5.1 V6.3 H-5.7 Z M-4.6,4.8 H-4 V6.6 H-4.6 Z M-3.5,4.8 H-2.9 V6.3 H-3.5 Z M3.3,5.6 H3.9 V7.1 H3.3 Z M4.3,5.6 H4.9 V7.4 H4.3 Z M5.3,5.6 H5.9 V7.1 H5.3 Z"/>' + z;
  }
  if (id === 'medal') {
    return g + '<path' + e + ' d="M-2.6,-6.4 L-0.75,-1.8 H0.75 L2.6,-6.4 L1.3,-6.4 L0,-3.6 L-1.3,-6.4 Z M0,1.8 m-4,0 a4,4 0 1 0 8,0 a4,4 0 1 0 -8,0 Z M0,1.8 m-1.55,0 a1.55,1.55 0 1 0 3.1,0 a1.55,1.55 0 1 0 -3.1,0 Z"/>' + z;
  }
  if (id === 'horse') {
    return g + '<path' + e + ' d="M0.2,-6.6 L1.9,-4.2 L0.8,-3.2 C3,-3.6 5.4,-1.8 6,0.1 C6.4,1.4 5.4,2.3 4.6,2.1 L5,3.1 C3.8,4.5 1.8,4.1 1,3.1 L-0.2,4.6 C-1.6,6.2 -4.2,5.8 -5.1,4.2 L-5.6,2.2 L-4.1,1.6 L-5.2,0.2 L-3.6,-0.9 L-4.6,-2.1 L-2.2,-2.7 L-1.4,-4.2 Z M2.5,-0.5 m-0.5,0 a0.5,0.5 0 1 0 1,0 a0.5,0.5 0 1 0 -1,0 Z"/>' + z;
  }
  if (id === 'shield') {
    return g + '<path' + e + ' d="M-5.4,-5.6 H5.4 V-0.8 C5.4,2.2 2.8,4.6 0,6.2 C-2.8,4.6 -5.4,2.2 -5.4,-0.8 Z M-3.2,-3.4 H3.2 V-2.1 H-3.2 Z M-3.2,-1 H3.2 V0.3 H-3.2 Z"/>' + z;
  }
  if (id === 'timer') {
    return g + '<path d="M-1.05,-6.3 H1.05 V-3.7 H-1.05 Z M1.2,-5.5 H2.9 V-4.6 H1.2 Z"/>' +
      '<path' + e + ' d="M0,1.3 m-5,0 a5,5 0 1 0 10,0 a5,5 0 1 0 -10,0 Z M-0.38,1.35 L-0.02,-1.9 L0.42,-1.75 L0.12,1.5 Z M-0.12,1.15 L2.25,2.5 L1.95,3.15 L-0.38,1.65 Z"/>' + z;
  }
  if (id === 'cone') {
    return g + '<path' + e + ' d="M0,-6.4 L4.6,3.8 H-4.6 Z M-2.2,0.4 H2.2 L2.6,1.6 H-2.6 Z"/>' +
      '<path d="M-5,4.2 H5 A5,1.15 0 1 1 -5,4.2 Z"/>' + z;
  }
  return g + '<path d="M-5.2,-1 H5.2 V0.5 H-5.2 Z M-4.2,0.5 L-2.7,5 H-5.6 Z M-0.8,0.5 L0.8,5.2 H-2.3 Z M2.6,0.5 L4.2,5 H1.2 Z"/>' + z;
};
CoachTools._footballSymbolTile = function (id, ink) {
  const glyph = CoachTools._footballSymbol(id, ink);
  const gap = 42;
  const parts = [];
  for (let row = 0; row <= 4; row++) {
    const y = row * gap;
    const odd = row % 2 === 1;
    for (let i = -1; i <= 5; i++) {
      const x = (odd ? gap / 2 : 0) + i * gap;
      if (x < -9 || x > 177) continue;
      parts.push('<g transform="translate(' + x + ' ' + y + ')">' + glyph + '</g>');
    }
  }
  return parts.join('');
};
CoachTools.giftPatternSvg = function (g) {
  const seed = g ? CoachTools.giftSeed(g) : 0x4d4554;
  const hue = g ? CoachTools.giftHue(g) : 42;
  const idx = CoachTools.footballPatternIndex(g);
  const def = CoachTools.FOOTBALL_PATTERNS[idx] || CoachTools.FOOTBALL_PATTERNS[0];
  const ink = 'hsl(' + hue + ' 22% 96%)';
  const body = CoachTools._footballSymbolTile(def.id, ink);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="168" height="168" viewBox="0 0 168 168">' + body + '</svg>';
  return { svg: svg, hue: hue, seed: seed, patternId: def.id, patternLabel: def.label };
};
/** Колір картки футболіста — як раніше, від головного подарунка. */
CoachTools.playerFieldAccent = function (player) {
  const byPos = function (pos) {
    const p = String(pos || '').toUpperCase();
    if (p === 'GK' || p.includes('GK')) return { hue: 48, ring: '#f1c40f', bg: 'linear-gradient(145deg,#f1c40f33,#f39c1222)' };
    if (/^CB|^LB|^RB|^LCB|^RCB|^WB|DEF/.test(p)) return { hue: 204, ring: '#3498db', bg: 'linear-gradient(145deg,#3498db33,#2980b922)' };
    if (/^CM|^CDM|^CAM|^LM|^RM|^DM|MID/.test(p)) return { hue: 145, ring: '#2ecc71', bg: 'linear-gradient(145deg,#2ecc7133,#27ae6022)' };
    if (/^ST|^CF|^LW|^RW|^SS|ATT|FW/.test(p)) return { hue: 6, ring: '#e74c3c', bg: 'linear-gradient(145deg,#e74c3c33,#c0392b22)' };
    return { hue: 42, ring: '#e8c547', bg: 'linear-gradient(145deg,#9b59b633,#8e44ad22)' };
  };
  if (!player) return { hue: 42, ring: '#c8a84b', bg: 'linear-gradient(160deg,#2a2410,#12100a)' };
  let hue = null;
  try {
    const gifts = ((typeof Store !== 'undefined' && Store.get && Store.get().gifts) || [])
      .filter(function (g) { return g && String(g.playerId) === String(player.id); });
    const featured = gifts.find(function (g) { return g.featured; }) || null;
    if (featured) hue = CoachTools.giftHue(featured);
  } catch (_) {}
  if (hue == null) {
    const profile = player.profile || {};
    const stored = profile.themeHue != null ? profile.themeHue : player.themeHue;
    if (stored != null && stored !== '' && isFinite(Number(stored))) hue = Number(stored);
  }
  if (hue != null) {
    hue = (Number(hue) % 360 + 360) % 360;
    return {
      hue: hue,
      ring: 'hsl(' + hue + ' 72% 58%)',
      bg: 'linear-gradient(165deg, hsl(' + hue + ' 46% 24%) 0%, hsl(' + hue + ' 38% 11%) 100%)'
    };
  }
  return byPos(player.position);
};
/** Колекційний візерунок картки. Якщо є подарунок — його унікальний фон. Інакше футбольний. */
CoachTools.PLAYER_BACKDROPS = [
  { id: 'pistachio', name: 'Фісташка', center: '#91AE7C', edge: '#668653', ink: '#58794D', symbol: 'ball', tone: 'light' },
  { id: 'metalist', name: 'Металіст', center: '#E4D09A', edge: '#C4A86A', ink: '#7A6234', symbol: 'shield', tone: 'light' },
  { id: 'shtuttgart', name: 'Штуттгарт', center: '#5E7EA6', edge: '#314E70', ink: '#243C58', symbol: 'jersey', tone: 'dark' },
  { id: 'pitch', name: 'Газон', center: '#7EAE78', edge: '#4E7A52', ink: '#3E6244', symbol: 'boot', tone: 'light' },
  { id: 'cup', name: 'Кубок', center: '#E6C98A', edge: '#B8924C', ink: '#7A5E2C', symbol: 'cup', tone: 'light' },
  { id: 'captain', name: 'Капітан', center: '#D9C48A', edge: '#8A7344', ink: '#5C4A28', symbol: 'captain', tone: 'light' }
];
CoachTools.playerBackdrop = function (player) {
  try {
    const gifts = (typeof Store !== 'undefined' && Store.get) ? ((Store.get() || {}).gifts || []) : [];
    const mine = gifts.filter(function (g) {
      return g && player && String(g.playerId) === String(player.id) && g.attached !== false;
    });
    const gift = mine.find(function (g) { return g.featured; }) || mine[0] || null;
    if (gift && CoachTools.giftPatternSvg && CoachTools.giftHue) {
      const hue = CoachTools.giftHue(gift);
      const drawn = CoachTools.giftPatternSvg(gift);
      const pat = 'url(\'data:image/svg+xml,' + encodeURIComponent(drawn.svg) + '\')';
      const ring = 'hsl(' + hue + ' 72% 58%)';
      const bg = 'linear-gradient(165deg, hsl(' + hue + ' 52% 32%) 0%, hsl(' + hue + ' 46% 15%) 100%)';
      return {
        id: drawn.patternId,
        name: drawn.patternLabel,
        tone: 'dark',
        hue: hue,
        className: 'player-collectible gift-field',
        style: '--acc-ring:' + ring + ';--acc-bg:' + bg + ';--pb-pat:' + pat + ';'
      };
    }
  } catch (_) {}
  const list = CoachTools.PLAYER_BACKDROPS;
  const key = String((player && (player.id || player.number)) || 'club');
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 33) + key.charCodeAt(i)) >>> 0;
  const def = list[h % list.length];
  const accent = CoachTools.playerFieldAccent(player);
  const ink = 'hsl(' + accent.hue + ' 22% 94%)';
  const main = CoachTools._footballSymbol(def.symbol, ink, 0.22);
  const club = CoachTools._footballSymbol('shield', ink, 0.22);
  const gap = 30;
  const parts = [];
  for (let row = 0; row <= 6; row++) {
    const y = 6 + row * gap;
    const odd = row % 2 === 1;
    for (let col = -1; col <= 6; col++) {
      const x = (odd ? gap / 2 : 0) + col * gap;
      if (x < -8 || x > 158 || y > 158) continue;
      const rot = ((row + col) % 2 === 0) ? -7 : 6;
      const mark = ((row + col) % 4 === 0) ? club : main;
      parts.push('<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ') scale(0.52)">' + mark + '</g>');
    }
  }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">' +
    '<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/></filter>' +
    '<rect width="150" height="150" filter="url(#grain)" opacity="0.045"/>' +
    parts.join('') + '</svg>';
  const pat = 'url(\'data:image/svg+xml,' + encodeURIComponent(svg) + '\')';
  return {
    id: def.id,
    name: def.name,
    tone: 'gift',
    hue: accent.hue,
    className: 'player-collectible',
    style: '--acc-ring:' + accent.ring + ';--acc-bg:' + accent.bg + ';--pb-pat:' + pat + ';'
  };
};
CoachTools.homePatternVars = function (gifts) {
  const list = (gifts || []).filter(Boolean).slice()
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const featured = list.find(g => g && g.featured) || list[0] || null;
  const pat = CoachTools.giftPatternSvg(featured);
  const ox = pat.seed % 70;
  const oy = (pat.seed >>> 5) % 70;
  const glow = 16 + (pat.seed % 68);
  return '--home-pat:url(\'data:image/svg+xml,' + encodeURIComponent(pat.svg) + '\');--pat-x:' + ox + 'px;--pat-y:' + oy + 'px;--pat-hue:' + pat.hue + ';--pat-glow:' + glow + '%;';
};
CoachTools.coachProgress = function () {
  const s = Store.get();
  const done = (s.trainings || []).filter(t => t && t.status === 'done' && !(typeof LoadModel !== 'undefined' && LoadModel.isCancelled && LoadModel.isCancelled(t)))
    .slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  const attSeries = [];
  done.forEach(t => {
    const att = t.attendance || {};
    const ids = Object.keys(att);
    let pct = 0;
    if (ids.length) {
      let present = 0;
      ids.forEach(k => { if (att[k] && att[k].present !== false && att[k].present !== 0) present++; });
      pct = Math.round(present / ids.length * 100);
    }
    attSeries.push(pct);
  });
  const rows = [];
  (s.players || []).forEach(p => {
    if (!p || !p.id) return;
    try { rows.push(PlayerProgress.compute(p.id)); } catch (_) {}
  });
  const n = rows.length || 1;
  const teamXp = rows.reduce((a, r) => a + (r.xp || 0), 0);
  const avgLevel = rows.length ? rows.reduce((a, r) => a + (r.level || 1), 0) / rows.length : 1;
  const level = Math.max(1, Math.round(avgLevel));
  const levelProgress = rows.length ? Math.round(rows.reduce((a, r) => a + (r.levelProgress || 0), 0) / rows.length) : 0;
  const xp = rows.length ? Math.round(teamXp / rows.length) : 0;
  const xpToNext = rows.length ? Math.max(0, Math.round(rows.reduce((a, r) => a + (r.xpToNext || 0), 0) / n)) : 100;
  const avgAtt = attSeries.length ? Math.round(attSeries.reduce((a, v) => a + v, 0) / attSeries.length) : 0;
  return {
    xp, level, levelProgress, xpToNext,
    xpTrain: 0, xpTeam: xp, xpGifts: 0, teamXp,
    players: rows.length,
    avgLevel: Math.round(avgLevel * 10) / 10,
    sessions: done.length,
    avgAtt,
    attSeries: attSeries.slice(-8)
  };
};
/** Прокачка самого Металіста: явка, серії, навантаження, додаток, дошка, тренер і подарунки. */
CoachTools.clubProgress = function () {
  const s = Store.get() || {};
  const players = (s.players || []).filter(function (p) { return p && p.id; });
  let attend = 0, intensity = 0, giftsXp = 0, streaks = 0;
  let present = 0, absent = 0, bestStreak = 0;
  players.forEach(function (p) {
    let pr = null;
    try { pr = PlayerProgress.compute(p.id); } catch (_) {}
    if (!pr) return;
    attend += pr.xpAttend || 0;
    attend += (pr.absent || 0) * ((PlayerProgress.RULES && PlayerProgress.RULES.absent) || 0);
    intensity += pr.xpIntensity || 0;
    giftsXp += pr.xpGifts || 0;
    streaks += pr.xpStreak || 0;
    present += pr.present || 0;
    absent += pr.absent || 0;
    if ((pr.streak || 0) > bestStreak) bestStreak = pr.streak || 0;
  });
  const done = (s.trainings || []).filter(function (t) {
    if (!t) return false;
    const st = String(t.status || '').toLowerCase();
    if (st !== 'done' && st !== 'completed' && st !== 'проведено') return false;
    try {
      if (typeof LoadModel !== 'undefined' && LoadModel.isCancelled && LoadModel.isCancelled(t)) return false;
    } catch (_) {}
    return true;
  }).slice().sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); });
  let totalLoad = 0;
  let coachHere = 0;
  const rates = [];
  done.forEach(function (t) {
    totalLoad += (Number(t.duration) || 0) * (Number(t.intensity) || 0);
    if (t.coachPresent !== false) coachHere++;
    const att = t.attendance || {};
    const ids = Object.keys(att);
    if (!ids.length) { rates.push(0); return; }
    let here = 0;
    ids.forEach(function (id) {
      try {
        if (PlayerProgress.attendanceMark(att[id]) === true) here++;
      } catch (_) {}
    });
    rates.push(here / ids.length);
  });
  let teamStreak = 0;
  for (let i = rates.length - 1; i >= 0; i--) {
    if (rates[i] >= 0.6) teamStreak++;
    else break;
  }
  const teamTable = { 3: 60, 5: 120, 8: 200, 12: 320 };
  let teamBonus = 0;
  Object.keys(teamTable).forEach(function (step) {
    if (teamStreak >= Number(step)) teamBonus = Math.max(teamBonus, teamTable[step]);
  });
  streaks += teamBonus;
  const cs = (s.settings && s.settings.coachStats) || s.coachStats || {};
  const appMs = Number(cs.appMs) || 0;
  const boardMs = Number(cs.boardMs) || 0;
  const boards = (s.boards || []).length;
  const parts = {
    attend: Math.max(0, attend),
    streaks: streaks,
    load: Math.round(totalLoad / 10),
    intensity: intensity,
    app: Math.round(appMs / 60000 * 0.4),
    board: Math.round(boardMs / 60000),
    coach: coachHere * 20 + boards * 8,
    gifts: giftsXp
  };
  let xp = 0;
  Object.keys(parts).forEach(function (key) { xp += Math.max(0, parts[key] || 0); });
  const base = 480;
  const growth = 1.22;
  let level = 1;
  let need = base;
  let remain = xp;
  while (remain >= need && level < 99) {
    remain -= need;
    level++;
    need = Math.round(base * Math.pow(growth, level - 1));
  }
  const avgAtt = rates.length ? Math.round(rates.reduce(function (a, v) { return a + v; }, 0) / rates.length * 100) : 0;
  return {
    xp: xp,
    level: level,
    levelProgress: need ? Math.min(100, Math.round(remain / need * 100)) : 0,
    xpToNext: Math.max(0, need - remain),
    parts: parts,
    present: present,
    absent: absent,
    bestStreak: bestStreak,
    teamStreak: teamStreak,
    teamBonus: teamBonus,
    totalLoad: totalLoad,
    sessions: done.length,
    coachHere: coachHere,
    avgAtt: avgAtt,
    appMs: appMs,
    boardMs: boardMs,
    boards: boards,
    gifts: (s.gifts || []).length,
    players: players.length
  };
};
CoachTools.GIFT_BACKDROPS = [
  { id: 'night_pitch', name: 'Нічний газон', base_color: '#07140f', ink: 'light', glow: '#3dcca0', hero: 'football', heroColor: '#e7fff4' },
  { id: 'navy_kit', name: 'Темно-синя форма', base_color: '#070e22', ink: 'light', glow: '#4c7dff', hero: 'jersey', heroColor: '#f6e3a6' },
  { id: 'gold_crest', name: 'Золотий герб', base_color: '#120e08', ink: 'light', glow: '#e8c547', hero: 'shield', heroColor: '#f6e3a6' },
  { id: 'goal_night', name: 'Нічні ворота', base_color: '#07140f', ink: 'light', glow: '#7dffc3', hero: 'goal_net', heroColor: '#e7fff4' },
  { id: 'captain_band', name: 'Капітан', base_color: '#10160c', ink: 'light', glow: '#c6e27a', hero: 'captain_armband', heroColor: '#f6e3a6' },
  { id: 'trophy_night', name: 'Нічний кубок', base_color: '#100e0a', ink: 'light', glow: '#e0b15a', hero: 'trophy', heroColor: '#f8e7b8' },
  { id: 'gold_boot', name: 'Золотий удар', base_color: '#120e08', ink: 'light', glow: '#ffb703', hero: 'football_boot', heroColor: '#ffe7a8' },
  { id: 'whistle_arc', name: 'Свисток', base_color: '#090f22', ink: 'light', glow: '#8eb4ff', hero: 'whistle', heroColor: '#e4edff' },
  { id: 'tactics_board', name: 'Тактична дошка', base_color: '#07140f', ink: 'light', glow: '#5ee0a0', hero: 'corner_flag', heroColor: '#e7fff4' },
  { id: 'medal_night', name: 'Медаль', base_color: '#100c08', ink: 'light', glow: '#d4a574', hero: 'medal', heroColor: '#f8e7c8' },
  { id: 'keeper_night', name: 'Воротар', base_color: '#071412', ink: 'light', glow: '#3ddec8', hero: 'goalkeeper_glove', heroColor: '#e5fff8' },
  { id: 'star_gold', name: 'Золота зірка', base_color: '#120e08', ink: 'light', glow: '#f0d078', hero: 'star', heroColor: '#fff1c4' }
];
CoachTools._backdropGlyph = function (type, color, opacity) {
  const op = opacity == null ? 0.7 : opacity;
  const known = {
    horse_silhouette: 'horse',
    football: 'ball',
    football_boot: 'boot',
    whistle: 'whistle',
    trophy: 'cup',
    captain_armband: 'captain',
    corner_flag: 'flag',
    jersey: 'jersey',
    medal: 'medal',
    goalkeeper_glove: 'glove',
    shield: 'shield'
  };
  if (known[type]) return CoachTools._footballSymbol(known[type], color, op);
  const g = '<g fill="' + color + '" opacity="' + op + '">';
  const z = '</g>';
  if (type === 'triangle') return g + '<path d="M0,-7.2 L6.4,5.4 H-6.4 Z"/>' + z;
  if (type === 'crown') return g + '<path d="M-6.4,3.4 L-6.4,-0.4 L-3.2,-4.8 L0,0 L3.2,-4.8 L6.4,-0.4 L6.4,3.4 Z"/>' + z;
  if (type === 'stylized_m') return g + '<path d="M-6,5 L-6,-4.6 L-4.1,-4.6 L0,1.4 L4.1,-4.6 L6,-4.6 L6,5 L4.1,5 L4.1,-1.2 L1,3.2 H-1 L-4.1,-1.2 L-4.1,5 Z"/>' + z;
  if (type === 'star') return g + '<path d="M0,-7.4 L1.8,-2.4 L7,-2.2 L2.9,1.1 L4.4,6.6 L0,3.6 L-4.4,6.6 L-2.9,1.1 L-7,-2.2 L-1.8,-2.4 Z"/>' + z;
  if (type === 'goal_net') {
    return '<g fill="none" stroke="' + color + '" stroke-width="1.15" opacity="' + op + '">' +
      '<path d="M-6.2,-5.4 H6.2 V6.2 H-6.2 Z M-6.2,-1.6 H6.2 M-6.2,2.2 H6.2 M-2.1,-5.4 V6.2 M2.1,-5.4 V6.2"/>' + z;
  }
  if (type === 'number') return g + '<path d="M-3.4,-6.4 H4.4 V-4.3 L0.4,6.4 H-2.2 L1.4,-4.3 H-3.4 Z"/>' + z;
  return CoachTools._footballSymbol('shield', color, op);
};
CoachTools._backdropSvg = function (def) {
  const key = String((def && def.id) || 'night_pitch');
  const gid = 'ms' + key.replace(/[^a-z0-9]/gi, '');
  const glow = (def && def.glow) || '#3dcca0';
  const base = (def && def.base_color) || '#07140f';
  const hero = CoachTools._backdropGlyph(def.hero || 'football', def.heroColor || '#f6e3a6', 1);
  const kit = key === 'navy_kit'
    ? '<rect x="348" y="0" width="12" height="460" fill="#e8c547"/>'
    : '';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="460" viewBox="0 0 360 460">' +
    '<defs>' +
    '<radialGradient id="' + gid + '" cx="50%" cy="0%" r="62%">' +
    '<stop offset="0%" stop-color="' + glow + '" stop-opacity="0.9"/>' +
    '<stop offset="42%" stop-color="' + glow + '" stop-opacity="0.22"/>' +
    '<stop offset="100%" stop-color="' + base + '" stop-opacity="0"/>' +
    '</radialGradient>' +
    '<linearGradient id="' + gid + 'b" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="' + base + '" stop-opacity="0"/>' +
    '<stop offset="55%" stop-color="' + base + '" stop-opacity="0.2"/>' +
    '<stop offset="100%" stop-color="#050605"/>' +
    '</linearGradient></defs>' +
    '<rect width="360" height="460" fill="' + base + '"/>' +
    '<circle cx="48" cy="36" r="110" fill="' + glow + '" opacity="0.16"/>' +
    '<rect width="360" height="460" fill="url(#' + gid + ')"/>' +
    '<ellipse cx="180" cy="-36" rx="260" ry="132" fill="none" stroke="#e8c547" stroke-opacity="0.7" stroke-width="1.6"/>' +
    kit +
    '<g transform="translate(308 46) scale(1.55)" opacity="0.72">' + hero + '</g>' +
    '<rect width="360" height="460" fill="url(#' + gid + 'b)"/>' +
    '<rect x="8" y="8" width="344" height="444" rx="26" fill="none" stroke="#e8c547" stroke-opacity="0.28" stroke-width="1.2"/>' +
    '</svg>';
};
CoachTools.uniqueBackdropIndex = function (g) {
  const n = (CoachTools.GIFT_BACKDROPS || []).length || 1;
  const base = (g ? CoachTools.giftSeed(g) : 0) % n;
  try {
    if (!g || typeof Store === 'undefined' || !Store.get) return base;
    const mineId = String(g.playerId || '');
    const sibs = (Store.get().gifts || []).filter(function (s) { return s && String(s.playerId || '') === mineId; })
      .slice()
      .sort(function (a, b) {
        return String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
          || String(a.uid || a.id || '').localeCompare(String(b.uid || b.id || ''));
      });
    if (sibs.length < 2) return base;
    const used = new Set();
    let mine = base;
    const key = String(g.uid || g.id || '');
    sibs.forEach(function (s) {
      let i = CoachTools.giftSeed(s) % n;
      let guard = 0;
      while (used.has(i) && guard < n) { i = (i + 1) % n; guard += 1; }
      used.add(i);
      if (String(s.uid || s.id || '') === key) mine = i;
    });
    return mine;
  } catch (_) {}
  return base;
};
CoachTools.giftClubBackdrop = function (g) {
  const list = CoachTools.GIFT_BACKDROPS;
  const def = list[CoachTools.uniqueBackdropIndex(g)];
  return { svg: CoachTools._backdropSvg(def), base: def.base_color, id: def.id, name: def.name };
};
CoachTools.giftBackdropHtml = function (g, size) {
  const pat = CoachTools.giftPatternSvg(g || {});
  const rar = (g && g.rarity) || 'common';
  const ico = (g && g.ico) || '★';
  const media = (g && g.mediaUrl)
    ? ('<img class="tg-emoji-media" src="' + String(g.mediaUrl).replace(/"/g, '') + '" alt="">')
    : ico;
  return '<span class="tg-gift-art size-' + (size || 'md') + ' rarity-' + rar +
    '" style="--art-hue:' + pat.hue + ';--home-pat:url(\'data:image/svg+xml,' + encodeURIComponent(pat.svg) + '\')">' +
    '<span class="tg-gift-art-ico">' + media + '</span>' +
    '</span>';
};


CoachTools.coachAttendanceRate = function () {
  try {
    const s = Store.get();
    const todayStr = (typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10));
    const trainings = (s.trainings || []).filter(t => {
      if (t.status === 'cancelled' || t.status === 'canceled' || t.status === 'draft') return false;
      if (t.status === 'done') return true;
      // past sessions treated as eligible for coach attendance
      return (t.date || '') < todayStr;
    });
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
  const def = CoachTools.giftById(giftId) || { id: giftId, ico: '🎁', label: giftId, hue: 42 };
  const uid = 'g_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const seed = (Math.floor(Math.random() * 0x7fffffff) ^ Date.now()) >>> 0;
  const baseHue = def.hue != null ? Number(def.hue) : 42;
  const hue = (baseHue + ((seed >>> 4) % 16) * 19) % 360;
  const pattern = seed % ((CoachTools.FOOTBALL_PATTERNS && CoachTools.FOOTBALL_PATTERNS.length) || 16);
  let serial = CoachTools.mintSerial(uid);
  const taken = new Set((s.gifts || []).map(x => x && x.serial).filter(Boolean));
  let guard = 0;
  while (taken.has(serial) && guard < 8) {
    serial = CoachTools.mintSerial(uid + ':' + guard);
    guard += 1;
  }
  const entry = {
    uid,
    id: uid,
    giftId: def.id,
    playerId,
    ico: def.ico,
    label: def.label,
    rarity: def.rarity || 'common',
    seed,
    hue,
    pattern,
    patternSeed: uid,
    serial,
    anim: def.anim || 'sparkle',
    moment: momentText || def.momentHint || '',
    note: momentText || '',
    featured: true,
    attached: true,
    createdAt: new Date().toISOString()
  };
  const player = (s.players || []).find(x => x && String(x.id) === String(playerId));
  const keepWorn = player && player.wornGift && player.wornGift.by === 'player';
  if (keepWorn) entry.featured = false;
  else s.gifts.forEach(g => { if (g && String(g.playerId) === String(playerId)) g.featured = false; });
  s.gifts.push(entry);
  if (player) {
    if (!player.profile) player.profile = {};
    if (!keepWorn) {
      player.profile.themeHue = entry.hue;
      player.profile.featuredGiftId = entry.uid;
      player.wornGift = { key: entry.uid, giftId: entry.giftId || '', at: entry.createdAt, by: 'coach' };
      player.stamps = Object.assign({}, player.stamps || {}, { wornGift: entry.createdAt });
    }
  }
  try { StorageManager.save(); } catch (_) {}
  try {
    if (typeof CoachTools.GiftFX === 'function') CoachTools.GiftFX(entry);
    else if (typeof Toast !== 'undefined') Toast.show('🎁 ' + (entry.label || 'Подарунок'), 'ok');
  } catch (_) {}
  return entry;
};

CoachTools.awardGift = function (playerId, giftId, momentText) {
  return CoachTools.giveGift(playerId, giftId, momentText);
};

CoachTools.deleteGift = function (uid) {
  const s = Store.get();
  const key = String(uid || '');
  if (!key || !s) return false;
  if (!s.settings) s.settings = {};
  if (!Array.isArray(s.settings.removedGiftIds)) s.settings.removedGiftIds = [];
  const remember = function (id) {
    const k = String(id || '');
    if (!k || s.settings.removedGiftIds.indexOf(k) >= 0) return;
    s.settings.removedGiftIds.push(k);
  };
  const doomed = (s.gifts || []).filter(g => g && (String(g.uid || '') === key || String(g.id || '') === key));
  doomed.forEach(g => { remember(g.uid); remember(g.id); });
  remember(key);
  if (s.settings.removedGiftIds.length > 800) s.settings.removedGiftIds = s.settings.removedGiftIds.slice(-800);
  const before = (s.gifts || []).length;
  s.gifts = (s.gifts || []).filter(g => {
    if (!g) return false;
    return String(g.uid || '') !== key && String(g.id || '') !== key;
  });
  if (Array.isArray(s.feed)) {
    const drop = {};
    doomed.forEach(function (g) {
      if (g.uid) drop['gift:' + g.uid] = true;
      if (g.id) drop['gift:' + g.id] = true;
    });
    drop['gift:' + key] = true;
    s.feed = s.feed.filter(function (item) { return item && !drop[item.id]; });
  }
  (s.players || []).forEach(p => {
    if (!p || !p.profile) return;
    if (String(p.profile.featuredGiftId || '') !== key) return;
    const next = (s.gifts || []).find(g => g && String(g.playerId) === String(p.id) && g.attached !== false && g.featured)
      || (s.gifts || []).find(g => g && String(g.playerId) === String(p.id) && g.attached !== false);
    p.profile.featuredGiftId = next ? (next.uid || next.id || '') : '';
    if (next && next.hue != null) p.profile.themeHue = next.hue;
  });
  try { StorageManager.save(); } catch (_) {}
  try {
    if (typeof Toast !== 'undefined') Toast.show((s.gifts || []).length !== before ? 'Подарунок видалено' : 'Подарунок уже прибрано', 'ok');
  } catch (_) {}
  return true;
};

CoachTools.attachGift = function (uid) {
  const s = Store.get();
  const g = (s.gifts || []).find(x => x && (String(x.uid || '') === String(uid) || String(x.id || '') === String(uid)));
  if (!g) return false;
  g.pinned = true;
  g.attached = true;
  try { StorageManager.save(); } catch (_) {}
  return true;
};

CoachTools.toggleAttachGift = function (uid) {
  const s = Store.get();
  const key = String(uid || '');
  const g = (s.gifts || []).find(x => x && (String(x.uid || '') === key || String(x.id || '') === key));
  if (!g) return false;
  g.attached = g.attached === false;
  if (g.attached === false && g.featured) g.featured = false;
  try { StorageManager.save(); } catch (_) {}
  try { if (typeof Toast !== 'undefined') Toast.show(g.attached === false ? 'Знято з профілю' : 'Знову на профілі', 'ok'); } catch (_) {}
  return true;
};

CoachTools.canFeatureGift = function (g) {
  try {
    if (!g || typeof AuthManager === 'undefined') return false;
    if (AuthManager.isCoach && AuthManager.isCoach()) return true;
    if (!(AuthManager.isPlayer && AuthManager.isPlayer())) return false;
    const me = AuthManager.getLinkedPlayer && AuthManager.getLinkedPlayer();
    if (!me || g.playerId == null || g.playerId === '') return false;
    return String(me.id) === String(g.playerId);
  } catch (_) { return false; }
};

CoachTools.setFeaturedGift = function (playerId, uid) {
  const s = Store.get();
  const key = String(uid || '');
  const g = (s.gifts || []).find(x => x && (String(x.uid || '') === key || String(x.id || '') === key));
  if (!g) return false;
  if (playerId && String(g.playerId) !== String(playerId)) return false;
  if (!CoachTools.canFeatureGift(g)) return false;
  const p = (s.players || []).find(x => x && String(x.id) === String(g.playerId));
  let by = 'coach';
  try {
    if (typeof AuthManager !== 'undefined' && AuthManager.isPlayer && AuthManager.isPlayer()) by = 'player';
  } catch (_) {}
  if (p && p.wornGift && p.wornGift.by === 'player' && by !== 'player') {
    try { if (typeof Toast !== 'undefined') Toast.show('Подарунок біля імені обрав гравець', 'warn'); } catch (_) {}
    return false;
  }
  (s.gifts || []).forEach(x => { if (x && String(x.playerId) === String(g.playerId)) x.featured = false; });
  g.featured = true;
  if (!g.id) g.id = g.uid || ('g_' + Date.now());
  if (!g.uid) g.uid = g.id;
  const now = new Date().toISOString();
  if (p) {
    if (!p.profile) p.profile = {};
    const hue = CoachTools.giftHue ? CoachTools.giftHue(g) : g.hue;
    if (hue != null && isFinite(Number(hue))) {
      p.profile.themeHue = Number(hue);
      p.themeHue = Number(hue);
    }
    p.profile.featuredGiftId = g.uid || g.id;
    p.wornGift = { key: g.uid || g.id, giftId: g.giftId || '', at: now, by: by };
    p.stamps = Object.assign({}, p.stamps || {}, { wornGift: now });
  }
  try { StorageManager.save(); } catch (_) {}
  return true;
};

CoachTools._giftKey = function (g) {
  return String((g && (g.uid || g.id)) || '');
};
CoachTools._seenGiftIds = function () {
  try {
    const raw = localStorage.getItem('ms_seen_gift_ids');
    const arr = raw ? JSON.parse(raw) : [];
    return new Set((Array.isArray(arr) ? arr : []).map(String));
  } catch (_) { return new Set(); }
};
CoachTools._rememberGiftKeys = function (keys) {
  try {
    const set = CoachTools._seenGiftIds();
    (keys || []).forEach(k => { if (k) set.add(String(k)); });
    localStorage.setItem('ms_seen_gift_ids', JSON.stringify(Array.from(set).slice(-600)));
  } catch (_) {}
};
CoachTools._giftAudience = function (g, live) {
  if (!g) return false;
  if (live) return true;
  try {
    if (typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach()) return true;
    const me = AuthManager.getLinkedPlayer && AuthManager.getLinkedPlayer();
    if (me && String(me.id) === String(g.playerId)) return true;
  } catch (_) {}
  return false;
};
CoachTools.noticeNewGifts = function (gifts) {
  gifts = gifts || [];
  const seen = CoachTools._seenGiftIds();
  const boot = !CoachTools._giftsBooted;
  CoachTools._giftsBooted = true;
  const cutoff = Date.now() - 30 * 60 * 1000;
  const fresh = [];
  const historical = [];
  gifts.forEach(g => {
    const k = CoachTools._giftKey(g);
    if (!k || seen.has(k)) return;
    const t = Date.parse((g && g.createdAt) || '');
    const recent = isFinite(t) && t >= cutoff;
    if (boot && !recent) historical.push(k);
    else fresh.push(g);
  });
  if (historical.length) CoachTools._rememberGiftKeys(historical);
  if (!fresh.length) return;
  fresh.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const newest = fresh[0];
  const rest = fresh.slice(1).map(CoachTools._giftKey);
  if (rest.length) CoachTools._rememberGiftKeys(rest);
  const show = function () {
    if (!CoachTools._giftAudience(newest, !boot)) {
      CoachTools._rememberGiftKeys([CoachTools._giftKey(newest)]);
      return;
    }
    CoachTools.GiftFX(newest);
  };
  if (!boot) { show(); return; }
  let tries = 0;
  const tick = function () {
    tries += 1;
    let ready = true;
    try {
      const local = AuthManager._isLocalCoachHost && AuthManager._isLocalCoachHost();
      ready = !!(AuthManager.user || local);
      if (!ready && tries >= 6) ready = true;
    } catch (_) { ready = true; }
    if (!ready) { setTimeout(tick, 700); return; }
    show();
  };
  setTimeout(tick, 500);
};

CoachTools.GiftFX = function (entry) {
  try {
    if (!entry) return;
    const key = CoachTools._giftKey(entry);
    if (!CoachTools._fxShown) CoachTools._fxShown = {};
    if (key && CoachTools._fxShown[key]) return;
    if (key) {
      CoachTools._fxShown[key] = true;
      CoachTools._rememberGiftKeys([key]);
    }
    const esc = function (v) {
      const s = String(v == null ? '' : v);
      if (typeof sanitize === 'function') return sanitize(s);
      return s.replace(/[&<>"']/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
      });
    };
    let who = '';
    try {
      const p = (Store.get().players || []).find(x => x && String(x.id) === String(entry.playerId));
      if (p) who = [p.firstName, p.lastName].filter(Boolean).join(' ');
    } catch (_) {}
    let kicker = 'Новий подарунок клубу';
    try {
      const me = (typeof AuthManager !== 'undefined' && AuthManager.getLinkedPlayer) ? AuthManager.getLinkedPlayer() : null;
      if (me && String(me.id) === String(entry.playerId)) kicker = 'Тобі подарунок';
      else if (typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach()) kicker = 'Подарунок надіслано';
    } catch (_) {}
    const rarMap = { common: 'звичайний', rare: 'рідкісний', epic: 'епічний', legendary: 'легендарний' };
    const rar = rarMap[entry.rarity] || entry.rarity || '';
    const label = (CoachTools.giftLabel && CoachTools.giftLabel(entry)) || entry.label || 'Подарунок';
    const serial = (CoachTools.giftSerial && CoachTools.giftSerial(entry)) || entry.serial || '';
    const note = entry.note || entry.moment || '';
    const hue = CoachTools.giftHue ? CoachTools.giftHue(entry) : (entry.hue || 42);
    const patStyle = CoachTools.homePatternVars ? CoachTools.homePatternVars([entry]) : '';
    const art = CoachTools.giftBackdropHtml ? CoachTools.giftBackdropHtml(entry, 'lg') : esc(entry.ico || '🎁');
    document.getElementById('giftFxOverlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'giftFxOverlay';
    ov.className = 'gift-fx-overlay rarity-' + (entry.rarity || 'common');
    ov.style.setProperty('--gift-hue', String(hue));
    ov.innerHTML =
      '<div class="gift-fx-card home-pattern" style="--gift-hue:' + hue + ';' + patStyle + '">' +
        '<div class="gift-fx-title">' + esc(kicker) + '</div>' +
        '<div class="gift-fx-art">' + art + '</div>' +
        (rar ? ('<div class="gift-fx-badge">' + esc(rar) + '</div>') : '') +
        '<div class="gift-fx-label">' + esc(label) + '</div>' +
        (who ? ('<div class="gift-fx-to">для ' + esc(who) + '</div>') : '') +
        (serial ? ('<div class="gift-fx-serial">' + esc(serial) + '</div>') : '') +
        (note ? ('<div class="gift-fx-note">«' + esc(note) + '»</div>') : '') +
        '<button type="button" class="gift-fx-ok">Чудово</button>' +
      '</div>';
    const close = function () {
      ov.classList.remove('show');
      setTimeout(function () { try { ov.remove(); } catch (_) {} }, 320);
    };
    ov.addEventListener('click', function (ev) {
      if (ev.target === ov || (ev.target && ev.target.classList && ev.target.classList.contains('gift-fx-ok'))) close();
    });
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('show'); });
    setTimeout(close, 6400);
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
    const label = CoachTools.giftLabel(entry) || 'Подарунок';
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
          '<div class="gift-open-ico">' + (CoachTools.giftBackdropHtml ? CoachTools.giftBackdropHtml(entry, 'lg') : ico) + '</div>' +
          '<div class="gift-open-label">' + (typeof sanitize === 'function' ? sanitize(label) : label) +
            (CoachTools.giftSerial(entry) ? (' · ' + CoachTools.giftSerial(entry)) : '') + '</div>' +
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
    levelGrowth: 1.35,
    streakBonus: { 3: 30, 5: 50, 8: 80 }
  },

  /** true / false / null. Пропуск тренера сюди не входить. Печатка «Я тут» сама не є явкою. */
  attendanceMark(att) {
    if (att === true || att === 1 || att === '1' || att === 'yes') return true;
    if (att === false || att === 0 || att === '0' || att === 'no') return false;
    if (!att || typeof att !== 'object') return null;
    if (att.present === true || att.present === 1 || att.attended === true || att.status === 'present' || att.status === 'ok') return true;
    if (att.present === false || att.present === 0 || att.attended === false || att.status === 'absent' || att.status === 'missed') return false;
    if (att.claimed && att.present == null && att.rpe == null && att.intensity == null && att.attended == null) return null;
    if (att.present === 'true' || att.present === 'yes' || att.present === '1') return true;
    if (att.rpe != null || att.intensity != null) return true;
    return true;
  },

  /** Проведена сесія, або минула, де тренер уже поставив явку. Чернетка теж рахується. */
  sessionCounts(t) {
    if (!t) return false;
    const st = String(t.status || '').toLowerCase();
    if (st === 'done' || st === 'completed' || st === 'проведено') return true;
    if (st === 'cancelled' || st === 'canceled' || st === 'скасовано') return false;
    try {
      if (typeof LoadModel !== 'undefined' && LoadModel.isCancelled && LoadModel.isCancelled(t)) return false;
    } catch (_) {}
    let todayStr = '';
    try {
      todayStr = (typeof LoadModel !== 'undefined' && LoadModel.todayStr) ? LoadModel.todayStr() : '';
    } catch (_) {}
    if (!t.date || (todayStr && String(t.date) > todayStr)) return false;
    const att = t.attendance || {};
    return Object.keys(att).some(function (id) {
      const cell = att[id];
      return cell && (cell.present === true || cell.present === false || cell.present === 0);
    });
  },

  streakBonusXp(streak) {
    const n = Number(streak) || 0;
    const table = this.RULES.streakBonus || {};
    let bonus = 0;
    Object.keys(table).forEach(function (step) {
      if (n >= Number(step)) bonus = Math.max(bonus, table[step]);
    });
    return bonus;
  },

  compute(playerId) {
    const s = Store.get();
    const p = (s.players || []).find(x => x.id === playerId) || {};
    const trainings = (s.trainings || []).filter(t => this.sessionCounts(t));
    let xp = 0;
    let present = 0, absent = 0, sessions = 0;
    const history = [];
    trainings.forEach(t => {
      const att = (t.attendance || {})[playerId];
      const mark = this.attendanceMark(att);
      if (mark == null) return;
      sessions++;
      const withoutCoach = t.coachPresent === false;
      if (mark === true) {
        present++;
        let gain = this.RULES.present;
        const rpe = att && att.rpe != null ? +att.rpe : (att && att.intensity != null ? +att.intensity : 0);
        if (rpe > 0) gain += Math.min(this.RULES.intensityBonusMax, Math.round(rpe * 1.2));
        xp += gain;
        history.push({ date: t.date, name: t.name, delta: gain, kind: 'present', withoutCoach: withoutCoach });
      } else {
        absent++;
        xp += this.RULES.absent;
        history.push({ date: t.date, name: t.name, delta: this.RULES.absent, kind: 'absent', withoutCoach: withoutCoach });
      }
    });
    let xpAttend = 0;
    let xpIntensity = 0;
    trainings.forEach(t => {
      const att = (t.attendance || {})[playerId];
      if (this.attendanceMark(att) !== true) return;
      xpAttend += this.RULES.present;
      const rpe = att.rpe != null ? +att.rpe : (att.intensity != null ? +att.intensity : 0);
      if (rpe > 0) xpIntensity += Math.min(this.RULES.intensityBonusMax, Math.round(rpe * 1.2));
    });
    const gifts = (s.gifts || []).filter(g => g.playerId === playerId);
    const xpGifts = gifts.length * this.RULES.giftBonus;
    xp += xpGifts;
    gifts.forEach(g => history.push({ date: (g.createdAt || '').slice(0, 10), name: g.label || 'Подарунок', delta: this.RULES.giftBonus, kind: 'gift' }));
    if (xp < 0) xp = 0;
    const doneDesc = trainings.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    let streak = 0;
    for (let i = 0; i < doneDesc.length; i++) {
      const mark = this.attendanceMark((doneDesc[i].attendance || {})[playerId]);
      if (mark == null) continue;
      if (mark === false) break;
      streak++;
    }
    const xpStreak = this.streakBonusXp(streak);
    if (xpStreak) {
      xp += xpStreak;
      history.push({ date: '', name: 'Серія ' + streak, delta: xpStreak, kind: 'streak' });
    }
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
      xpAttend, xpIntensity, xpGifts, xpStreak, streak,
      form: level >= 80 ? '99' : level >= 50 ? 'elite' : level >= 25 ? 'pro' : 'rising',
      history: history.slice(-12).reverse()
    };
  }
};
if (typeof window !== 'undefined') window.PlayerProgress = PlayerProgress;
CoachTools.playerGifts = function (playerId) {
  try { return (Store.get().gifts || []).filter(g => g.playerId === playerId); } catch (_) { return []; }
};


CoachTools.RARITY_RANK = { common: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
CoachTools.rarityRank = function (r) {
  return CoachTools.RARITY_RANK[String(r || 'common').toLowerCase()] || 1;
};
CoachTools.playerGiftsSorted = function (playerId) {
  const list = (CoachTools.playerGifts && CoachTools.playerGifts(playerId)) || [];
  return list.slice().sort(function (a, b) {
    const rd = CoachTools.rarityRank(b.rarity) - CoachTools.rarityRank(a.rarity);
    if (rd) return rd;
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
};
/** Подарунок біля імені. Знятий з профілю не повертаємо самі. */
CoachTools.ensureWornGift = function (playerId) {
  try {
    const s = Store.get();
    if (!s.gifts) return null;
    const mine = s.gifts.filter(g => g && String(g.playerId) === String(playerId) && g.attached !== false);
    if (!mine.length) return null;
    const person = (s.players || []).find(p => p && String(p.id) === String(playerId));
    const worn = person && person.wornGift;
    if (worn && (worn.key || worn.giftId)) {
      const chosen = mine.find(g => String(g.uid || '') === String(worn.key) || String(g.id || '') === String(worn.key))
        || (worn.giftId ? mine.find(g => String(g.giftId || '') === String(worn.giftId)) : null);
      if (!chosen) return null;
      if (!chosen.featured) {
        mine.forEach(x => { x.featured = x === chosen; });
        try { StorageManager.save(); } catch (_) {}
      }
      return chosen;
    }
    let featured = mine.find(g => g.featured);
    if (!featured) {
      featured = mine.slice().sort((a, b) => CoachTools.rarityRank(b.rarity) - CoachTools.rarityRank(a.rarity))[0];
      if (featured) {
        mine.forEach(x => { x.featured = false; });
        featured.featured = true;
        try { StorageManager.save(); } catch (_) {}
      }
    }
    return featured || mine[0] || null;
  } catch (_) { return null; }
};
CoachTools.giftAccent = function (g) {
  if (!g) return { hue: 42, ring: 'rgba(232,197,71,0.55)', bg: 'linear-gradient(145deg,#2a2410,#12100a)' };
  const hue = CoachTools.giftHue ? CoachTools.giftHue(g) : (g.hue != null ? g.hue : 42);
  return {
    hue: hue,
    ring: 'hsla(' + hue + ',75%,55%,0.85)',
    bg: 'linear-gradient(145deg,hsla(' + hue + ',40%,18%,1),hsla(' + hue + ',30%,8%,1))',
    border: 'hsla(' + hue + ',70%,50%,0.45)'
  };
};
CoachTools.playerXpTotal = function (playerId) {
  try {
    if (typeof Views !== 'undefined' && Views._playerXp) return Views._playerXp(playerId).total || 0;
  } catch (_) {}
  // fallback: gifts * 25 + attendance rough
  try {
    const s = Store.get();
    const gifts = (s.gifts || []).filter(g => g.playerId === playerId).length;
    let xp = gifts * 25;
    (s.trainings || []).forEach(t => {
      if (t.status === 'cancelled' || t.status === 'canceled' || t.status === 'draft') return;
      const a = (t.attendance || {})[playerId];
      if (!a) return;
      if (a.present === false) xp -= 6;
      else xp += 18 + Math.round((a.intensity || 0) * 0.5);
    });
    return Math.max(0, xp);
  } catch (_) { return 0; }
};

/** Роль фішки для розстановки основи. */
CoachTools.lineupRole = function (player) {
  const pos = String((player && player.position) || '').toUpperCase();
  if (pos === 'GK' || pos.indexOf('GK') === 0) return 'GK';
  if (['CB', 'LB', 'RB', 'LCB', 'RCB', 'LWB', 'RWB', 'WB', 'SW', 'DEF'].indexOf(pos) >= 0) return 'DEF';
  if (['ST', 'CF', 'LW', 'RW', 'SS', 'LF', 'RF', 'ATT', 'FW'].indexOf(pos) >= 0) return 'ATT';
  return 'MID';
};
/** Одинадцять із найбільшим лоадом, який тренер ставить в анкеті. Решта йде на лавку. */
CoachTools.pickLineup = function (players) {
  const list = (players || []).filter(function (p) { return p && p.id != null; });
  const hurt = function (p) {
    const st = String(p.status || '').toLowerCase();
    return st === 'injured' || st === 'rehab' || st === 'recovery' || st === 'suspended' || st === 'unavailable';
  };
  const loadOf = function (p) {
    const n = Number(p && p.load);
    return Number.isFinite(n) ? n : 0;
  };
  const ready = function (p) {
    const n = Number(p && (p.readiness != null ? p.readiness : p.condition));
    return Number.isFinite(n) ? n : 0;
  };
  const available = list.filter(function (p) { return !hurt(p); }).slice().sort(function (a, b) {
    const diff = loadOf(b) - loadOf(a);
    if (diff) return diff;
    const rd = ready(b) - ready(a);
    if (rd) return rd;
    return (Number(a.number) || 99) - (Number(b.number) || 99);
  });
  const xi = available.slice(0, 11);
  const on = {};
  xi.forEach(function (p) { on[String(p.id)] = true; });
  return {
    xi: xi,
    bench: list.filter(function (p) { return !on[String(p.id)]; })
  };
};
/** Серед обраних одинадцяти спочатку сідає своя роль, потім будь-хто з тих, хто лишився. */
CoachTools.assignFormation = function (xi, roles) {
  const pool = (xi || []).slice();
  const used = {};
  return (roles || []).map(function (role) {
    let pick = pool.find(function (p) { return !used[String(p.id)] && CoachTools.lineupRole(p) === role; });
    if (!pick) pick = pool.find(function (p) { return !used[String(p.id)]; });
    if (pick) used[String(pick.id)] = true;
    return pick || null;
  });
};

/** Ролі слотів схеми. Для 3-1-2-2-1-1 атакувальний півзахисник лишається півзахистом. */
CoachTools.schemeRoles = function (schemeName) {
  if (schemeName === '3-1-2-2-1-1') return ['GK', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'ATT', 'ATT', 'MID', 'ATT'];
  const scheme = (typeof SCHEMES !== 'undefined' && SCHEMES[schemeName]) || [];
  return scheme.slice(0, 11).map(function (slot) {
    const y = Number(slot && slot[2]) || 0;
    if (y >= 0.88) return 'GK';
    if (y >= 0.68) return 'DEF';
    if (y >= 0.38) return 'MID';
    return 'ATT';
  });
};

/** Одинадцять за лоадом з анкети в порядку слотів і решта заявки на лавці. */
CoachTools.buildMatchSquad = function (players, schemeName) {
  const roles = CoachTools.schemeRoles(schemeName);
  const picked = CoachTools.pickLineup(players);
  const assigned = CoachTools.assignFormation(picked.xi, roles);
  const xiIds = {};
  const xi = assigned.map(function (p) {
    if (!p) return null;
    xiIds[String(p.id)] = true;
    return p.id;
  });
  while (xi.length < 11) xi.push(null);
  return {
    xi: xi.slice(0, 11),
    bench: (picked.bench || []).filter(function (p) { return p && !xiIds[String(p.id)]; }).map(function (p) { return p.id; })
  };
};

/** П'ять днів навколо матчу: MD-3 … MD+1. */
CoachTools.matchWeekDays = function (isoDate) {
  const base = new Date(String(isoDate || '') + 'T12:00:00');
  if (isNaN(base.getTime())) return [];
  const items = [
    { offset: -3, md: 'MD-3', title: 'MD-3 Тактика', type: 'TRAINING', time: '19:00', goal: 'План на суперника, формація і пресинг', intensity: 6 },
    { offset: -2, md: 'MD-2', title: 'MD-2 Стандарти', type: 'TRAINING', time: '19:00', goal: 'Інтенсивність і стандарти', intensity: 8 },
    { offset: -1, md: 'MD-1', title: 'MD-1 Активація', type: 'TRAINING', time: '18:00', goal: 'Коротке включення і склад', intensity: 4 },
    { offset: 0, md: 'MD', title: 'Матч', type: 'MATCH', time: '', goal: '', intensity: 0 },
    { offset: 1, md: 'MD+1', title: 'MD+1 Відновлення', type: 'TRAINING', time: '11:00', goal: 'Відновлення після матчу', intensity: 2 }
  ];
  return items.map(function (item) {
    const day = new Date(base.getTime());
    day.setDate(base.getDate() + item.offset);
    const ds = day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' + String(day.getDate()).padStart(2, '0');
    return {
      offset: item.offset, md: item.md, title: item.title, type: item.type,
      time: item.time, goal: item.goal, intensity: item.intensity, date: ds
    };
  });
};

/** Додає тренування тижня і подію матчу. Повторний виклик не дублює ті самі дні. */
CoachTools.applyMatchWeek = function (state, match) {
  if (!state || !match || !match.id || !match.date) return { added: 0 };
  const days = CoachTools.matchWeekDays(match.date);
  state.trainings = state.trainings || [];
  state.calendar = state.calendar || [];
  const opponent = match.opponent || 'суперник';
  const now = new Date().toISOString();
  let added = 0;
  days.forEach(function (day) {
    if (day.type === 'MATCH') {
      const has = state.calendar.some(function (event) {
        return event && event.matchId === match.id && event.type === 'MATCH';
      });
      if (!has) {
        state.calendar.push({
          id: 'cal-' + match.id + '-MD',
          type: 'MATCH',
          title: 'vs ' + opponent,
          date: match.date,
          time: match.time || '15:00',
          matchId: match.id,
          md: 'MD'
        });
        added += 1;
      }
      return;
    }
    const exists = state.trainings.some(function (training) {
      return training && training.matchId === match.id && training.md === day.md;
    });
    if (exists) return;
    const id = 'tr-' + match.id + '-' + day.md;
    const main = day.md === 'MD-2' ? 40 : 25;
    state.trainings.push({
      id: id,
      name: day.title + ' · vs ' + opponent,
      date: day.date,
      time: day.time,
      duration: 10 + main + 10,
      place: match.stadium || 'Тренувальна база',
      surface: 'Газон',
      intensity: day.intensity,
      mainGoal: day.goal,
      status: 'planned',
      matchId: match.id,
      md: day.md,
      structure: [
        { id: id + '-w', title: 'Розминка', type: 'warmup', duration: 10, intensity: 3 },
        { id: id + '-m', title: day.goal, type: 'tactical', duration: main, intensity: day.intensity },
        { id: id + '-c', title: 'Заминка', type: 'cooldown', duration: 10, intensity: 2 }
      ],
      createdAt: now,
      updatedAt: now
    });
    state.calendar.push({
      id: 'cal-' + match.id + '-' + day.md,
      type: 'TRAINING',
      title: day.title + ' · vs ' + opponent,
      date: day.date,
      time: day.time,
      trainingId: id,
      matchId: match.id,
      md: day.md
    });
    added += 1;
  });
  return { added: added };
};

/** Одна розминка в день матчу. Повторний виклик оновлює той самий запис. */
CoachTools.applyMatchWarmup = function (state, match) {
  if (!state || !match || !match.id || !match.date) return { added: 0 };
  state.trainings = state.trainings || [];
  state.calendar = state.calendar || [];
  const id = 'tr-' + match.id + '-WU';
  const now = new Date().toISOString();
  const minutes = Math.max(10, Number(match.warmupMin) || 20);
  const time = match.warmupAt || '';
  const place = match.warmupPlace || match.stadium || 'Поле';
  const text = String(match.warmup || '').trim();
  const lines = text.split(/\n+/).map(function (line) { return line.trim(); }).filter(Boolean);
  const blocks = (lines.length ? lines : ['Розминка перед матчем']).map(function (line, index, all) {
    return {
      id: id + '-w' + index,
      title: line,
      type: 'warmup',
      duration: Math.max(3, Math.round(minutes / all.length)),
      intensity: 3
    };
  });
  const name = 'Розминка · vs ' + (match.opponent || 'суперник');
  let training = state.trainings.find(function (item) {
    return item && (item.id === id || (item.matchId === match.id && item.md === 'WU'));
  });
  let added = 0;
  if (!training) {
    training = { id: id, createdAt: now, matchId: match.id, md: 'WU' };
    state.trainings.push(training);
    added += 1;
  }
  const keepStatus = training.status === 'done' || training.status === 'cancelled' || training.status === 'canceled';
  training.name = name;
  training.date = match.date;
  training.time = time || training.time || '';
  training.duration = minutes;
  training.place = place;
  training.surface = training.surface || 'Газон';
  training.intensity = 3;
  training.mainGoal = text || 'Розминка перед матчем';
  training.status = keepStatus ? training.status : 'planned';
  training.matchId = match.id;
  training.md = 'WU';
  training.structure = blocks;
  training.updatedAt = now;
  training.stamps = Object.assign({}, training.stamps || {}, { schedule: now, status: training.stamps && training.stamps.status || now });
  const calId = 'cal-' + match.id + '-WU';
  let event = state.calendar.find(function (item) {
    return item && (item.id === calId || (item.matchId === match.id && item.md === 'WU'));
  });
  if (!event) {
    event = { id: calId, type: 'TRAINING', matchId: match.id, md: 'WU', trainingId: training.id };
    state.calendar.push(event);
    added += 1;
  }
  event.type = 'TRAINING';
  event.title = name;
  event.date = match.date;
  event.time = time || '';
  event.trainingId = training.id;
  event.matchId = match.id;
  event.md = 'WU';
  return { added: added, training: training };
};

/** Стрічка клубу: подарунки, серії, дні народження, статус, фото, рейтинг. */
const ClubFeed = {
  MILESTONES: [3, 5, 8, 12, 16, 20, 24, 30],
  _busy: false,
  _name(p) {
    return [p && p.firstName, p && p.lastName].filter(Boolean).join(' ').trim() || (p && p.name) || 'Гравець';
  },
  _meta(s) {
    if (!s.feedMeta || typeof s.feedMeta !== 'object') s.feedMeta = {};
    ['status', 'photo', 'photoAt', 'level', 'streak', 'load', 'loadAt'].forEach(function (key) {
      if (!s.feedMeta[key] || typeof s.feedMeta[key] !== 'object') s.feedMeta[key] = {};
    });
    return s.feedMeta;
  },
  _push(s, entry) {
    if (!Array.isArray(s.feed)) s.feed = [];
    if (s.feed.some(function (x) { return x && x.id === entry.id; })) return false;
    s.feed.push({
      id: entry.id,
      kind: entry.kind,
      playerId: entry.playerId || null,
      title: String(entry.title || '').slice(0, 80),
      text: String(entry.text || '').slice(0, 200),
      createdAt: entry.createdAt || new Date().toISOString()
    });
    if (s.feed.length > 240) s.feed = s.feed.slice(-240);
    return true;
  },
  _day(iso) {
    const when = iso ? new Date(iso) : new Date();
    if (isNaN(when.getTime())) return '';
    const b = this._berlin(when);
    const pad = function (n) { return String(n).padStart(2, '0'); };
    return b.y + '-' + pad(b.m) + '-' + pad(b.d);
  },
  /** Стабільний відбиток знімка: без довжини файлу і без токена в посиланні. */
  _photoSig(photo) {
    const raw = String(photo || '').trim();
    if (!raw) return '';
    let body = raw;
    const marker = raw.indexOf('base64,');
    if (marker >= 0) body = raw.slice(marker + 7);
    else if (/^https?:/i.test(raw)) body = raw.split('?')[0];
    if (body.length > 80) {
      const mid = Math.floor(body.length / 2);
      return body.slice(0, 48) + ':' + body.slice(mid, mid + 24) + ':' + body.slice(-32);
    }
    return body;
  },
  _photoBody(p) {
    if (!p) return '';
    const fields = [p.profilePhoto, p.photoUrl, p.profile && p.profile.photo];
    let i;
    for (i = 0; i < fields.length; i++) {
      if (typeof fields[i] === 'string' && fields[i].indexOf('data:image/') === 0) return fields[i];
    }
    for (i = 0; i < fields.length; i++) {
      if (typeof fields[i] === 'string' && /^https?:/i.test(fields[i])) return fields[i];
    }
    for (i = 0; i < fields.length; i++) {
      if (typeof fields[i] === 'string' && fields[i].trim()) return fields[i];
    }
    return '';
  },
  /** Прибирає видалений подарунок і згортає повтор тієї самої події за день. */
  prune(s) {
    if (!s || !Array.isArray(s.feed)) return false;
    const live = {};
    (s.gifts || []).forEach(function (g) {
      if (!g) return;
      if (g.uid) live['gift:' + g.uid] = true;
      if (g.id) live['gift:' + g.id] = true;
    });
    const before = s.feed.length;
    const minutes = {};
    s.feed.forEach(function (item) {
      if (!item || item.kind !== 'photo') return;
      const minute = String(item.createdAt || '').slice(0, 16);
      const who = String(item.playerId || '');
      if (!minute || !who) return;
      if (!minutes[minute]) minutes[minute] = {};
      minutes[minute][who] = true;
    });
    const burst = {};
    Object.keys(minutes).forEach(function (minute) {
      if (Object.keys(minutes[minute]).length >= 3) burst[minute] = true;
    });
    const sorted = s.feed.filter(Boolean).slice().sort(function (a, b) {
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    const seen = {};
    const next = [];
    sorted.forEach(function (item) {
      if (item.kind === 'gift' && !live[item.id]) return;
      if (item.kind === 'photo' && burst[String(item.createdAt || '').slice(0, 16)]) return;
      const stampedPhoto = (item.kind === 'photo' || item.kind === 'load') && /:\d{4}-/.test(String(item.id || ''));
      const bucket = stampedPhoto
        ? item.id
        : ((item.kind === 'photo' || item.kind === 'status' || item.kind === 'rating')
          ? (item.kind + ':' + (item.playerId || '') + ':' + ClubFeed._day(item.createdAt) + ':' + (item.title || ''))
          : item.id);
      if (seen[bucket]) return;
      seen[bucket] = true;
      next.push(item);
    });
    next.sort(function (a, b) { return String(a.createdAt || '').localeCompare(String(b.createdAt || '')); });
    s.feed = next.slice(-240);
    return s.feed.length !== before;
  },
  _berlin(now) {
    try {
      const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' });
      const parts = fmt.formatToParts(now || new Date());
      const pick = function (type) { return (parts.find(function (p) { return p.type === type; }) || {}).value; };
      return { y: Number(pick('year')), m: Number(pick('month')), d: Number(pick('day')) };
    } catch (_) {
      const n = now || new Date();
      return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
    }
  },
  _daysUntil(iso, today) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return null;
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const t0 = Date.UTC(today.y, today.m - 1, today.d);
    let next = Date.UTC(today.y, month - 1, day);
    if (next < t0) next = Date.UTC(today.y + 1, month - 1, day);
    const year = new Date(next).getUTCFullYear();
    return { days: Math.round((next - t0) / 86400000), year: year, age: year - Number(m[1]) };
  },
  sync() {
    if (this._busy) return;
    this._busy = true;
    try {
      const s = Store.get();
      if (!s) return;
      const meta = this._meta(s);
      let dirty = this.prune(s);
      const today = this._berlin(new Date());
      (s.gifts || []).forEach(function (g) {
        if (!g) return;
        const id = String(g.uid || g.id || '');
        if (!id) return;
        const player = (s.players || []).find(function (p) { return p && String(p.id) === String(g.playerId); });
        const who = player ? ClubFeed._name(player) : 'Гравець';
        const label = (CoachTools.giftLabel && CoachTools.giftLabel(g)) || g.label || 'подарунок';
        if (ClubFeed._push(s, {
          id: 'gift:' + id,
          kind: 'gift',
          playerId: g.playerId || null,
          title: 'Подарунок',
          text: who + ' отримав «' + label + '»',
          createdAt: g.createdAt || new Date().toISOString()
        })) dirty = true;
      });
      const photoNews = [];
      (s.players || []).forEach(function (p) {
        if (!p || p.id == null) return;
        const pid = String(p.id);
        const who = ClubFeed._name(p);
        const status = String((p.profile && p.profile.status) || p.statusText || '').trim();
        if (status) {
          if (meta.status[pid] == null) {
            meta.status[pid] = status;
            dirty = true;
          } else if (meta.status[pid] !== status) {
            if (ClubFeed._push(s, {
              id: 'status:' + pid + ':' + status,
              kind: 'status',
              playerId: p.id,
              title: 'Статус біля імені',
              text: who + ' змінив статус на «' + status + '»'
            })) dirty = true;
            meta.status[pid] = status;
          }
        }
        const photo = ClubFeed._photoBody(p);
        const sig = ClubFeed._photoSig(photo);
        if (sig) {
          const photoAt = (p.stamps && p.stamps.photo) || '';
          const knownAt = Date.parse(meta.photoAt[pid] || '') || 0;
          const nextAt = Date.parse(photoAt) || 0;
          const changed = meta.photo[pid] != null && meta.photo[pid] !== sig;
          if (meta.photo[pid] == null) {
            meta.photo[pid] = sig;
            if (photoAt) meta.photoAt[pid] = photoAt;
            dirty = true;
          } else if (changed && photoAt && nextAt > knownAt) {
            meta.photo[pid] = sig;
            meta.photoAt[pid] = photoAt;
            photoNews.push({ pid: pid, playerId: p.id, who: who, photoAt: photoAt });
            dirty = true;
          } else if (changed || (photoAt && nextAt > knownAt)) {
            meta.photo[pid] = sig;
            if (photoAt) meta.photoAt[pid] = photoAt;
            dirty = true;
          }
        }
        let level = 1;
        let streak = 0;
        try {
          const prog = (typeof PlayerProgress !== 'undefined' && PlayerProgress.compute) ? (PlayerProgress.compute(p.id) || {}) : {};
          level = Number(prog.level) || 1;
          streak = Number(prog.streak) || 0;
        } catch (_) {}
        if (meta.level[pid] == null) {
          meta.level[pid] = level;
          dirty = true;
        } else if (level > Number(meta.level[pid] || 0)) {
          if (ClubFeed._push(s, {
            id: 'level:' + pid + ':' + level,
            kind: 'rating',
            playerId: p.id,
            title: 'Рейтинг',
            text: who + ' підняв рейтинг до рівня ' + level
          })) dirty = true;
          meta.level[pid] = level;
        }
        let hit = 0;
        ClubFeed.MILESTONES.forEach(function (n) { if (streak >= n) hit = n; });
        if (hit && Number(meta.streak[pid] || 0) < hit) {
          if (ClubFeed._push(s, {
            id: 'streak:' + pid + ':' + hit,
            kind: 'streak',
            playerId: p.id,
            title: 'Серія відвідувань',
            text: who + ' тримає серію ' + hit + ' тренувань поспіль'
          })) dirty = true;
          meta.streak[pid] = hit;
        }
        const loadAt = (p.stamps && p.stamps.load) || '';
        if (loadAt) {
          if (meta.loadAt[pid] == null) {
            meta.loadAt[pid] = loadAt;
            meta.load[pid] = p.load;
            dirty = true;
          } else if (String(meta.loadAt[pid]) !== String(loadAt)) {
            const prev = meta.load[pid];
            const text = who + ': лоад ' + (prev != null && prev !== '' ? (prev + ' → ' + p.load) : p.load);
            if (ClubFeed._push(s, {
              id: 'load:' + pid + ':' + loadAt,
              kind: 'load',
              playerId: p.id,
              title: 'Лоад',
              text: text,
              createdAt: loadAt
            })) dirty = true;
            meta.loadAt[pid] = loadAt;
            meta.load[pid] = p.load;
          }
        }
        const birth = p.birthDate || (p.profile && p.profile.birthDate) || p.birthday || '';
        const when = ClubFeed._daysUntil(birth, today);
        if (when && when.days <= 14) {
          const ageBit = (when.age >= 1 && when.age <= 99) ? (' · ' + when.age + ' р.') : '';
          const text = when.days === 0
            ? (who + ' сьогодні святкує день народження' + ageBit)
            : (who + ' · день народження через ' + when.days + ' дн.' + ageBit);
          if (ClubFeed._push(s, {
            id: 'bday:' + pid + ':' + when.year,
            kind: 'birthday',
            playerId: p.id,
            title: 'День народження',
            text: text
          })) dirty = true;
        }
      });
      if (photoNews.length === 1) {
        const row = photoNews[0];
        if (ClubFeed._push(s, {
          id: 'photo:' + row.pid + ':' + row.photoAt,
          kind: 'photo',
          playerId: row.playerId,
          title: 'Нове фото',
          text: row.who + ' додав нове фото',
          createdAt: row.photoAt
        })) dirty = true;
      }
      if (this.prune(s)) dirty = true;
      if (dirty) {
        try { if (typeof StorageManager !== 'undefined' && StorageManager.save) StorageManager.save(); } catch (_) {}
      }
    } finally {
      this._busy = false;
    }
  }
};
if (typeof window !== 'undefined') window.ClubFeed = ClubFeed;
