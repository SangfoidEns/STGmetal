/**
 * Злиття двох знімків клубу без дублів.
 * Однаковий id лишається один раз. Новіший updatedAt перемагає.
 * Відвідуваність зливається по гравцю. Час тренера і гравця береться більший.
 * Онлайн береться за свіжішою позначкою.
 */
(function (root) {
  const LISTS = ['players', 'trainings', 'exercises', 'boards', 'schemeAlbums', 'schemeSections', 'schemeOpens', 'calendar', 'matches', 'tournaments', 'diary', 'myExercises', 'animations', 'gifts', 'moments', 'chat', 'feed'];

  function stamp(value) {
    const n = Date.parse(value || '');
    return Number.isFinite(n) ? n : 0;
  }

function recordStamp(obj) {
  if (!obj || typeof obj !== 'object') return 0;
  let best = stamp(obj.updatedAt || obj.createdAt || obj.exportedAt);
  const att = obj.attendance;
  if (att && typeof att === 'object') {
    Object.keys(att).forEach(function (key) {
      const cell = att[key];
      if (cell && typeof cell === 'object') best = Math.max(best, stamp(cell.updatedAt));
    });
  }
  return best;
}

/** Дата тренування не залежить від печатки відвідування. */
function scheduleStamp(obj) {
  if (!obj || typeof obj !== 'object') return 0;
  if (obj.stamps && obj.stamps.schedule) return stamp(obj.stamps.schedule);
  const rec = stamp(obj.updatedAt || obj.createdAt || obj.exportedAt);
  let att = obj.stamps ? stamp(obj.stamps.attendance) : 0;
  const attendance = obj.attendance;
  if (attendance && typeof attendance === 'object') {
    Object.keys(attendance).forEach(function (key) {
      const cell = attendance[key];
      if (cell && typeof cell === 'object') att = Math.max(att, stamp(cell.updatedAt));
    });
  }
  if (att && obj.createdAt && Math.abs(att - rec) <= 2000) return stamp(obj.createdAt);
  return rec;
}

function statusTime(obj) {
  if (!obj || typeof obj !== 'object') return 0;
  if (obj.stamps && obj.stamps.status) return stamp(obj.stamps.status);
  const st = String(obj.status || '').toLowerCase();
  if ((st === 'cancelled' || st === 'canceled') && obj.cancelledAt) return stamp(obj.cancelledAt);
  return scheduleStamp(obj);
}

function fieldTime(obj, field) {
  if (!obj || !obj.stamps) return 0;
  const stamps = obj.stamps;
  if (field === 'photo' || field === 'photoUrl' || field === 'profilePhoto') {
    return Math.max(stamp(stamps.photo), stamp(stamps.photoUrl), stamp(stamps.profilePhoto));
  }
  if (field === 'birthDate' || field === 'birthday') {
    return Math.max(stamp(stamps.birthDate), stamp(stamps.birthday));
  }
  return stamp(stamps[field]);
}

function mergeStampMap(a, b) {
  const out = Object.assign({}, a || {}, b || {});
  Object.keys(out).forEach(function (key) {
    const left = a && a[key];
    const right = b && b[key];
    if (stamp(right) >= stamp(left)) out[key] = right || left || out[key];
    else out[key] = left || right || out[key];
  });
  return out;
}

function isoDay(value) {
  const s = String(value || '').trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];
  const euro = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (euro) return euro[3] + '-' + euro[2].padStart(2, '0') + '-' + euro[1].padStart(2, '0');
  return '';
}

function isTraining(item) {
  if (!item || typeof item !== 'object') return false;
  return !!(item.attendance || item.structure || (item.date && (item.status || item.name)));
}

function planRank(item) {
  const st = String((item && item.status) || '').toLowerCase();
  if (st === 'planned' || st === 'pinned') return 4;
  if (st === 'done' || st === 'completed' || st === 'проведено') return 3;
  if (st === 'draft') return 2;
  if (st === 'cancelled' || st === 'canceled') return 0;
  return 1;
}

/** Розклад береться з новішого запису тренування. Печатка «Я тут» не відкочує дату. */
function applyTrainingSchedule(merged, winner, loser) {
  if (!merged) return;
  const wAt = scheduleStamp(winner);
  const lAt = scheduleStamp(loser);
  let from = winner;
  if (lAt > wAt) from = loser;
  else if (lAt === wAt && loser) {
    const lRank = planRank(loser);
    const wRank = planRank(winner);
    const lDate = isoDay(loser.date);
    const wDate = isoDay(winner && winner.date);
    if (lRank > wRank) from = loser;
    else if (lRank === wRank && lDate && wDate && lDate > wDate) from = loser;
  }
  ['name', 'date', 'time', 'duration', 'place', 'surface', 'intensity', 'mainGoal', 'comment', 'structure', 'playersCount', 'physGoal', 'tactGoal', 'techGoal', 'psychGoal'].forEach(function (key) {
    if (from && filled(from[key])) merged[key] = from[key];
  });
  let statusFrom = winner;
  const wStatus = statusTime(winner);
  const lStatus = statusTime(loser);
  if (lStatus > wStatus) statusFrom = loser;
  else if (lStatus === wStatus && loser) {
    const loserCancelled = planRank(loser) === 0;
    const winnerCancelled = planRank(winner) === 0;
    if (loserCancelled && !winnerCancelled) statusFrom = loser;
    else if (!loserCancelled && !winnerCancelled && planRank(loser) > planRank(winner)) statusFrom = loser;
  }
  if (statusFrom && statusFrom.status) merged.status = statusFrom.status;
  if (String((merged && merged.status) || '').toLowerCase() === 'cancelled' || String((merged && merged.status) || '').toLowerCase() === 'canceled') {
    merged.cancelledAt = (statusFrom && statusFrom.cancelledAt) || merged.cancelledAt;
  }
  const day = isoDay(merged.date);
  if (day) merged.date = day;
}

  function keyOf(item) {
    if (!item || typeof item !== 'object') return '';
    if (item.uid) return String(item.uid);
    if (item.id) return String(item.id);
    return '';
  }

  function mergeAttendance(baseAtt, extraAtt) {
    const out = Object.assign({}, baseAtt || {});
    Object.keys(extraAtt || {}).forEach(function (pid) {
      const extra = extraAtt[pid];
      const base = out[pid];
      if (extra == null) return;
      if (base == null) {
        out[pid] = extra;
        return;
      }
      const baseAt = base && typeof base === 'object' ? stamp(base.updatedAt) : 0;
      const extraAt = extra && typeof extra === 'object' ? stamp(extra.updatedAt) : 0;
      if (extraAt >= baseAt) out[pid] = extra;
    });
    return out;
  }

  function keepStampedList(merged, a, b, key) {
    const ta = fieldTime(a, key);
    const tb = fieldTime(b, key);
    if (!ta && !tb) return;
    const src = tb >= ta ? b : a;
    if (Array.isArray(src && src[key])) merged[key] = src[key].slice();
  }

function mergeRecord(baseItem, extraItem) {
  const training = isTraining(baseItem) || isTraining(extraItem);
  const baseAt = training ? scheduleStamp(baseItem) : recordStamp(baseItem);
  const extraAt = training ? scheduleStamp(extraItem) : recordStamp(extraItem);
  const extraWins = extraAt > baseAt;
  const winner = extraWins ? extraItem : baseItem;
  const loser = extraWins ? baseItem : extraItem;
  const merged = Object.assign({}, loser, winner);
  if ((baseItem && baseItem.attendance) || (extraItem && extraItem.attendance)) {
    merged.attendance = mergeAttendance(baseItem && baseItem.attendance, extraItem && extraItem.attendance);
  }
  if (extraWins && extraItem && extraItem.coachPresent != null) merged.coachPresent = extraItem.coachPresent;
  else if (!extraWins && baseItem && baseItem.coachPresent != null) merged.coachPresent = baseItem.coachPresent;
  if (training) applyTrainingSchedule(merged, winner, loser);
  keepFilled(merged, loser, winner);
  keepStampedList(merged, baseItem, extraItem, 'boardIds');
  keepMatchPlan(merged, loser, winner);
  keepPlayerChoice(merged, loser, winner);
  applyStampedFields(merged, baseItem, extraItem);
  releaseWorkingSession(merged);
  return merged;
}

function applyStampedFields(merged, a, b) {
  if (!merged) return;
  ['birthDate', 'phone', 'bio', 'statusText', 'status', 'notes', 'firstName', 'lastName', 'position', 'telegramUsername', 'name'].forEach(function (field) {
    const ta = fieldTime(a, field);
    const tb = fieldTime(b, field);
    if (!ta && !tb) return;
    const src = tb > ta ? b : a;
    if (filled(src && src[field])) merged[field] = src[field];
  });
  const photoAtA = fieldTime(a, 'photo');
  const photoAtB = fieldTime(b, 'photo');
  if (photoAtA || photoAtB) {
    const src = photoAtB > photoAtA ? b : a;
    if (filled(src && (src.photoUrl || src.profilePhoto))) {
      merged.photoUrl = src.photoUrl || src.profilePhoto || merged.photoUrl;
      merged.profilePhoto = src.profilePhoto || src.photoUrl || merged.profilePhoto;
    }
  }
  if (merged.birthDate) {
    merged.profile = Object.assign({}, merged.profile || {});
    merged.profile.birthDate = String(merged.birthDate).slice(0, 10);
  }
  const stamps = mergeStampMap(a && a.stamps, b && b.stamps);
  if (Object.keys(stamps).length) merged.stamps = stamps;
}

  function filled(value) {
    if (value == null) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  function firstFilled() {
    for (let i = 0; i < arguments.length; i++) {
      if (filled(arguments[i])) return arguments[i];
    }
    return '';
  }

  /** Новіший знімок із порожнім полем не стирає день народження, фото, телефон і складену схему. */
  function keepFilled(merged, loser, winner) {
    if (!merged) return;
    ['birthDate', 'birthday', 'photoUrl', 'photo', 'avatar', 'profilePhoto', 'phone', 'bio', 'statusText', 'telegramUsername', 'telegramId', 'firstName', 'lastName', 'notes', 'position', 'schemeAlbumId'].forEach(function (key) {
      if (!filled(winner && winner[key]) && filled(loser && loser[key])) merged[key] = loser[key];
    });
    if ((!winner || winner.number == null || winner.number === '' || winner.number === 0) && loser && loser.number) {
      merged.number = loser.number;
    }
    ['structure', 'slides', 'objects', 'tags', 'secondaryPositions', 'boardIds', 'sections', 'albumIds', 'groups', 'bracket', 'teams'].forEach(function (key) {
      const older = loser && loser[key];
      const newer = winner && winner[key];
      if (Array.isArray(older) && older.length && (!Array.isArray(newer) || !newer.length)) merged[key] = older;
    });
    const olderBoard = loser && loser.board;
    const newerBoard = winner && winner.board;
    if (olderBoard && olderBoard.objects && olderBoard.objects.length && (!newerBoard || !newerBoard.objects || !newerBoard.objects.length)) {
      merged.board = olderBoard;
    }
    const birth = firstFilled(
      winner && winner.birthDate,
      winner && winner.birthday,
      winner && winner.profile && winner.profile.birthDate,
      loser && loser.birthDate,
      loser && loser.birthday,
      loser && loser.profile && loser.profile.birthDate
    );
    const profile = Object.assign({}, (loser && loser.profile) || {}, (winner && winner.profile) || {});
    ['phone', 'social', 'status', 'bio', 'birthDate'].forEach(function (key) {
      if (!filled(winner && winner.profile && winner.profile[key]) && filled(loser && loser.profile && loser.profile[key])) {
        profile[key] = loser.profile[key];
      }
    });
    if (birth) {
      merged.birthDate = String(birth).slice(0, 10);
      profile.birthDate = merged.birthDate;
    }
    if (Object.keys(profile).length) merged.profile = profile;
  }

  /** Новіший порожній знімок не стирає план матчу, розминку і логотип суперника. */
  function keepMatchPlan(merged, loser, winner) {
    if (!merged) return;
    const looks = function (item) {
      return !!(item && (item.opponent || item.xi || item.plan != null || item.warmup != null || item.opponentLogo));
    };
    if (!looks(loser) && !looks(winner)) return;
    const squad = function (list) {
      return Array.isArray(list) && list.some(function (id) { return id != null && id !== ''; });
    };
    const keys = ['plan', 'plan1', 'plan2', 'tactics', 'preNotes', 'postNotes', 'warmup', 'warmupAt', 'warmupPlace', 'opponentLogo', 'meetTime', 'gatherPlace', 'kickoff', 'competition', 'scheme', 'schemeAlbumId'];
    const loserAt = fieldTime(loser, 'plan');
    const winnerAt = fieldTime(winner, 'plan');
    if (loserAt || winnerAt) {
      const src = winnerAt > loserAt ? winner : (loserAt > winnerAt ? loser : winner);
      keys.forEach(function (key) {
        if (src && Object.prototype.hasOwnProperty.call(src, key)) merged[key] = src[key];
      });
      keys.forEach(function (key) {
        if (!filled(merged[key]) && filled(loser && loser[key])) merged[key] = loser[key];
      });
      if ((merged.warmupMin == null || merged.warmupMin === '') && loser && loser.warmupMin != null && loser.warmupMin !== '') {
        merged.warmupMin = loser.warmupMin;
      }
    }
    if (winner && Array.isArray(winner.xi)) merged.xi = winner.xi;
    else if (squad(loser && loser.xi)) merged.xi = loser.xi;
    if (winner && Array.isArray(winner.bench)) merged.bench = winner.bench;
    else if (squad(loser && loser.bench)) merged.bench = loser.bench;
    if (loserAt || winnerAt) return;
    keys.forEach(function (key) {
      if (!filled(winner && winner[key]) && filled(loser && loser[key])) merged[key] = loser[key];
    });
    if ((winner == null || winner.warmupMin == null || winner.warmupMin === '') && loser && loser.warmupMin != null && loser.warmupMin !== '') {
      merged.warmupMin = loser.warmupMin;
    }
    if (!squad(winner && winner.xi) && squad(loser && loser.xi)) merged.xi = loser.xi;
    if (!squad(winner && winner.bench) && squad(loser && loser.bench)) merged.bench = loser.bench;
  }

  function isPerson(item) {
    return !!(item && (item.firstName || item.lastName || item.telegramUsername || item.wornGift || item.loadLog));
  }

  /** Вибір гравця біля імені сильніший за пізніший вибір тренера. Лоад береться з новішої позначки. */
  function keepPlayerChoice(merged, loser, winner) {
    if (!merged || (!isPerson(loser) && !isPerson(winner))) return;
    const score = function (item) {
      const worn = item && item.wornGift;
      if (!worn || (!worn.key && !worn.giftId)) return null;
      return { worn: worn, player: worn.by === 'player' ? 2 : 1, at: stamp(worn.at) };
    };
    const left = score(loser);
    const right = score(winner);
    let worn = null;
    if (left && right) {
      if (left.player !== right.player) worn = left.player > right.player ? left.worn : right.worn;
      else worn = right.at >= left.at ? right.worn : left.worn;
    } else worn = (left && left.worn) || (right && right.worn) || null;
    if (worn) merged.wornGift = worn;
    const log = {};
    [loser && loser.loadLog, winner && winner.loadLog].forEach(function (list) {
      (Array.isArray(list) ? list : []).forEach(function (row) {
        if (!row || !row.at) return;
        log[String(row.at)] = row;
      });
    });
    const history = Object.keys(log).sort().map(function (key) { return log[key]; });
    if (history.length) merged.loadLog = history.slice(-40);
    const leftLoad = fieldTime(loser, 'load');
    const rightLoad = fieldTime(winner, 'load');
    if (leftLoad || rightLoad) {
      const src = rightLoad >= leftLoad ? winner : loser;
      if (src && src.load != null && src.load !== '') merged.load = src.load;
    }
  }

  function applyWornGifts(payload) {
    if (!payload) return;
    (payload.players || []).forEach(function (player) {
      const worn = player && player.wornGift;
      if (!worn || (!worn.key && !worn.giftId)) return;
      const mine = (payload.gifts || []).filter(function (gift) {
        return gift && String(gift.playerId) === String(player.id);
      });
      let chosen = mine.find(function (gift) {
        return String(gift.uid || '') === String(worn.key) || String(gift.id || '') === String(worn.key);
      });
      if (!chosen && worn.giftId) {
        chosen = mine.find(function (gift) { return String(gift.giftId || '') === String(worn.giftId); });
      }
      if (!chosen) return;
      mine.forEach(function (gift) { gift.featured = gift === chosen; });
    });
  }

  /** Чернетка, план і проведене не стають скасованими через стару мітку cancelledAt. */
  function releaseWorkingSession(item) {
    if (!item || !item.cancelledAt) return;
    const st = String(item.status || '').toLowerCase();
    if (st === 'draft' || st === 'planned' || st === 'pinned' || st === 'done' || st === 'completed' || st === 'проведено') {
      delete item.cancelledAt;
    }
  }

  function mergeList(baseList, extraList) {
    const map = new Map();
    (baseList || []).forEach(function (item) {
      const key = keyOf(item);
      if (key) map.set(key, item);
    });
    (extraList || []).forEach(function (item) {
      const key = keyOf(item);
      if (!key) return;
      if (!map.has(key)) map.set(key, item);
      else map.set(key, mergeRecord(map.get(key), item));
    });
    return Array.from(map.values());
  }

  function mergeCoachStats(baseStats, extraStats) {
    const base = baseStats || {};
    const extra = extraStats || {};
    const appMs = Math.max(Number(base.appMs) || 0, Number(extra.appMs) || 0);
    const boardMs = Math.max(Number(base.boardMs) || 0, Number(extra.boardMs) || 0);
    const updatedAt = stamp(extra.updatedAt) >= stamp(base.updatedAt)
      ? (extra.updatedAt || base.updatedAt || null)
      : (base.updatedAt || extra.updatedAt || null);
    return { appMs: appMs, boardMs: boardMs, updatedAt: updatedAt };
  }

  function mergePlayerUsage(baseMap, extraMap) {
    const out = {};
    [baseMap, extraMap].forEach(function (map) {
      if (!map || typeof map !== 'object') return;
      Object.keys(map).forEach(function (key) {
        const row = map[key];
        if (!row || typeof row !== 'object') return;
        const prev = out[key] || { appMs: 0, boardMs: 0, updatedAt: null };
        out[key] = {
          appMs: Math.max(Number(prev.appMs) || 0, Number(row.appMs) || 0),
          boardMs: Math.max(Number(prev.boardMs) || 0, Number(row.boardMs) || 0),
          updatedAt: stamp(row.updatedAt) >= stamp(prev.updatedAt)
            ? (row.updatedAt || prev.updatedAt || null)
            : (prev.updatedAt || null)
        };
      });
    });
    return out;
  }

  function mergePresence(baseMap, extraMap) {
    const out = {};
    [baseMap, extraMap].forEach(function (map) {
      if (!map || typeof map !== 'object') return;
      Object.keys(map).forEach(function (key) {
        const row = map[key];
        if (!row || typeof row !== 'object') return;
        const prev = out[key];
        if (prev && stamp(prev.at) > stamp(row.at)) return;
        out[key] = {
          at: row.at || '',
          name: row.name || (prev && prev.name) || '',
          role: row.role || (prev && prev.role) || '',
          playerId: row.playerId != null && row.playerId !== ''
            ? String(row.playerId)
            : ((prev && prev.playerId) || '')
        };
      });
    });
    let newest = Date.now();
    Object.keys(out).forEach(function (key) { newest = Math.max(newest, stamp(out[key].at)); });
    const cutoff = newest - 36 * 3600 * 1000;
    Object.keys(out).forEach(function (key) {
      if (stamp(out[key].at) < cutoff) delete out[key];
    });
    const keys = Object.keys(out).sort(function (a, b) { return stamp(out[b].at) - stamp(out[a].at); });
    keys.slice(48).forEach(function (key) { delete out[key]; });
    return out;
  }

  function mergeSettings(baseSettings, extraSettings) {
    const base = baseSettings || {};
    const extra = extraSettings || {};
    const baseAt = stamp((base.coachStats && base.coachStats.updatedAt) || base.updatedAt);
    const extraAt = stamp((extra.coachStats && extra.coachStats.updatedAt) || extra.updatedAt);
    const extraWins = extraAt > baseAt;
    const winner = extraWins ? extra : base;
    const loser = extraWins ? base : extra;
    const out = Object.assign({}, loser, winner);
    out.coachStats = mergeCoachStats(base.coachStats, extra.coachStats);
    out.playerUsage = mergePlayerUsage(base.playerUsage, extra.playerUsage);
    out.presence = mergePresence(base.presence, extra.presence);
    if (!out.coachPhoto) out.coachPhoto = (loser.coachPhoto || winner.coachPhoto || '');
    if (!out.logoData) out.logoData = (loser.logoData || winner.logoData || '');
    if (!out.coachName) out.coachName = (loser.coachName || winner.coachName || '');
    [
      'removedGiftIds', 'removedBoardIds', 'removedAlbumIds', 'removedTrainingIds',
      'removedMatchIds', 'removedPlayerIds', 'removedSectionIds', 'removedDiaryIds',
      'removedExerciseIds', 'removedMyExerciseIds', 'removedCalendarIds'
    ].forEach(function (key) { unionIds(base, extra, key, out); });
    return out;
  }

  function unionIds(base, extra, key, out) {
    const gone = [];
    [base && base[key], extra && extra[key]].forEach(function (list) {
      (Array.isArray(list) ? list : []).forEach(function (id) {
        const token = String(id || '');
        if (token && gone.indexOf(token) < 0) gone.push(token);
      });
    });
    if (gone.length) out[key] = gone.slice(-800);
  }

  function mergeFeedMeta(base, extra) {
    const out = {};
    ['status', 'photo', 'photoAt', 'level', 'streak', 'load', 'loadAt'].forEach(function (key) {
      const a = (base && base[key]) || {};
      const b = (extra && extra[key]) || {};
      const merged = Object.assign({}, a, b);
      if (key === 'level' || key === 'streak' || key === 'load') {
        Object.keys(merged).forEach(function (id) {
          const av = Number(a[id]);
          const bv = Number(b[id]);
          if (Number.isFinite(av) || Number.isFinite(bv)) {
            merged[id] = Math.max(Number.isFinite(av) ? av : 0, Number.isFinite(bv) ? bv : 0);
          }
        });
      }
      if (key === 'photoAt' || key === 'loadAt') {
        Object.keys(merged).forEach(function (id) {
          merged[id] = stamp(b[id]) >= stamp(a[id]) ? (b[id] || a[id]) : (a[id] || b[id]);
        });
      }
      out[key] = merged;
    });
    return out;
  }

  const SEED_NAMES = {
    p01: 'олександр коваль', p02: 'ігор бондар', p03: 'андрій мельник', p04: 'сергій шевченко',
    p05: 'максим ткаченко', p06: 'дмитро кравченко', p07: 'віктор лисенко', p08: 'роман петренко',
    p09: 'юрій гончаренко', p10: 'тарас савченко', p11: 'богдан морозенко', p12: 'олег василенко',
    p13: 'назар коваленко', p14: 'артем білий', p15: 'денис сидоренко', p16: 'євген поліщук',
    p17: 'михайло захарченко', p18: 'вадим романенко', p19: 'павло гриценко', p20: 'кирило данилюк'
  };

  function personName(item) {
    return (String((item && item.firstName) || '') + ' ' + String((item && item.lastName) || '') + ' ' + String((item && item.name) || ''))
      .trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /** Демо-склад і явні тестові картки. Їх не змішуємо з живим складом. */
  function isSeedPlayer(item) {
    if (!item) return false;
    if (item.test === true || item.isTest === true || item.demo === true || item.seed === true || item.hiddenStats === true) return true;
    const id = String(item.id || '');
    const name = personName(item);
    if (SEED_NAMES[id] && name === SEED_NAMES[id]) return true;
    const handle = String(item.telegramUsername || item.telegram || '').replace(/^@/, '').trim().toLowerCase();
    const compact = (handle + ' ' + name).trim();
    if (/^(slop|test|тест|тестовий|test player|тестовий гравець)$/.test(handle)) return true;
    if (/^(slop|test|тест|тестовий|test player|тестовий гравець)$/.test(name)) return true;
    if (/(^|\s)(slop|тестовий гравець|test player)(\s|$)/.test(compact)) return true;
    return false;
  }

  /** Якщо в файлі вже є живі гравці, демо і тестові картки прибираємо. */
  function dropSeedPlayers(payload) {
    if (!payload || !Array.isArray(payload.players)) return { removed: 0 };
    const seeds = payload.players.filter(isSeedPlayer);
    const live = payload.players.filter(function (p) { return p && !isSeedPlayer(p); });
    if (!seeds.length || !live.length) return { removed: 0 };
    const gone = {};
    seeds.forEach(function (p) { if (p && p.id != null) gone[String(p.id)] = true; });
    payload.players = live;
    const dropId = function (id) { return id != null && gone[String(id)]; };
    (payload.matches || []).forEach(function (match) {
      if (!match) return;
      if (Array.isArray(match.xi)) match.xi = match.xi.map(function (id) { return dropId(id) ? null : id; });
      if (Array.isArray(match.bench)) match.bench = match.bench.filter(function (id) { return !dropId(id); });
      if (match.attendance) {
        Object.keys(match.attendance).forEach(function (id) { if (gone[String(id)]) delete match.attendance[id]; });
      }
    });
    (payload.trainings || []).forEach(function (training) {
      if (!training || !training.attendance) return;
      Object.keys(training.attendance).forEach(function (id) { if (gone[String(id)]) delete training.attendance[id]; });
    });
    ['gifts', 'moments', 'chat', 'feed'].forEach(function (list) {
      if (!Array.isArray(payload[list])) return;
      payload[list] = payload[list].filter(function (item) { return !(item && dropId(item.playerId)); });
    });
    return { removed: seeds.length };
  }

  function playerAlias(item) {
    if (!item) return '';
    if (isSeedPlayer(item)) return 'seed:' + String(item.id || personName(item));
    const tg = String(item.telegramUsername || item.telegram || '').replace(/^@/, '').trim().toLowerCase();
    if (tg) return 'tg:' + tg;
    const name = (String(item.firstName || '') + ' ' + String(item.lastName || '')).trim().toLowerCase().replace(/\s+/g, ' ');
    const num = Number(item.number) || 0;
    if (name && num) return 'nm:' + name + '#' + num;
    if (name && name.indexOf(' ') > 0) return 'nm:' + name + '#0';
    return '';
  }

  function fullName(item) {
    return (String((item && item.firstName) || '') + ' ' + String((item && item.lastName) || '')).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function retargetId(value, idMap) {
    if (value == null) return value;
    const next = idMap[String(value)];
    return next || value;
  }

  function collapsePlayers(payload) {
    if (!payload || !Array.isArray(payload.players)) return { removed: 0, idMap: {} };
    const groups = new Map();
    payload.players.forEach(function (item) {
      if (!item) return;
      const alias = playerAlias(item) || ('id:' + (item.id || ''));
      if (!groups.has(alias)) groups.set(alias, []);
      groups.get(alias).push(item);
    });
    const kept = [];
    const idMap = {};
    groups.forEach(function (items) {
      if (!items.length) return;
      if (items.length === 1) {
        kept.push(items[0]);
        return;
      }
      let winner = items[0];
      items.slice(1).forEach(function (loser) {
        const merged = mergeRecord(winner, loser);
        merged.id = winner.id;
        if (loser && loser.id && loser.id !== winner.id) idMap[String(loser.id)] = winner.id;
        winner = merged;
      });
      kept.push(winner);
    });
    const folded = [];
    kept.forEach(function (item) {
      const name = fullName(item);
      const num = Number(item && item.number) || 0;
      const mate = (name && name.indexOf(' ') > 0) ? folded.find(function (other) {
        if (fullName(other) !== name) return false;
        const otherNum = Number(other && other.number) || 0;
        return !num || !otherNum || num === otherNum;
      }) : null;
      if (!mate) {
        folded.push(item);
        return;
      }
      const merged = mergeRecord(mate, item);
      merged.id = mate.id;
      if (item && item.id && item.id !== mate.id) idMap[String(item.id)] = mate.id;
      folded[folded.indexOf(mate)] = merged;
    });
    kept.length = 0;
    folded.forEach(function (item) { kept.push(item); });
    payload.players = kept;
    if (!Object.keys(idMap).length) return { removed: 0, idMap: idMap };
    (payload.trainings || []).forEach(function (training) {
      if (!training || !training.attendance) return;
      const next = {};
      Object.keys(training.attendance).forEach(function (pid) {
        const id = retargetId(pid, idMap);
        const cell = training.attendance[pid];
        if (!next[id]) next[id] = cell;
        else {
          const pack = {};
          pack[id] = next[id];
          const extra = {};
          extra[id] = cell;
          next[id] = mergeAttendance(pack, extra)[id];
        }
      });
      training.attendance = next;
    });
    ['gifts', 'moments', 'chat', 'feed', 'calendar', 'diary'].forEach(function (list) {
      (payload[list] || []).forEach(function (item) {
        if (item && item.playerId) item.playerId = retargetId(item.playerId, idMap);
      });
    });
    (payload.matches || []).forEach(function (match) {
      if (!match) return;
      if (Array.isArray(match.xi)) match.xi = match.xi.map(function (id) { return retargetId(id, idMap); });
      if (Array.isArray(match.bench)) match.bench = match.bench.map(function (id) { return retargetId(id, idMap); });
    });
    return { removed: Object.keys(idMap).length, idMap: idMap };
  }

  function trainingNameKey(name) {
    return String(name || '')
      .replace(/\s*\(копія\)/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/\d+/g, function (n) { return String(parseInt(n, 10)); });
  }

  function trainingRank(item) {
    const name = String((item && item.name) || '');
    const copy = /\(копія\)/i.test(name) ? 0 : 80;
    const st = String((item && item.status) || '');
    const statusScore = st === 'done' ? 50 : (st === 'planned' || st === 'pinned' ? 30 : (st === 'cancelled' || st === 'canceled' ? 20 : 10));
    const att = item && item.attendance ? Object.keys(item.attendance).length : 0;
    return copy + statusScore + att * 4;
  }

/** Копія і «05/11» поруч із «5/11» того ж дня зливаються. Інша дата з тією ж назвою лишається окремим тренуванням. */
function collapseTrainings(payload) {
  if (!payload || !Array.isArray(payload.trainings)) return { removed: 0, idMap: {} };
  const groups = new Map();
  const originals = [];
  payload.trainings.forEach(function (item) {
    if (!item) return;
    const nameKey = trainingNameKey(item.name) || ('id:' + (item.id || ''));
    const copy = /\(копія\)/i.test(String(item.name || ''));
    if (copy) {
      if (!groups.has(nameKey)) groups.set(nameKey, []);
      groups.get(nameKey).push(item);
      return;
    }
    const key = nameKey + '|' + (isoDay(item.date) || String(item.date || ''));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
    originals.push({ nameKey: nameKey, key: key, item: item });
  });
  groups.forEach(function (items, key) {
    if (key.indexOf('|') >= 0) return;
    const mates = originals.filter(function (row) { return row.nameKey === key; });
    if (!mates.length) return;
    const host = mates.slice().sort(function (a, b) { return trainingRank(b.item) - trainingRank(a.item); })[0];
    items.splice(0, items.length).forEach(function (copy) {
      groups.get(host.key).push(copy);
    });
    groups.delete(key);
  });
  const idMap = {};
  const kept = [];
  groups.forEach(function (items) {
    if (!items.length) return;
    if (items.length === 1) {
      const day = isoDay(items[0].date);
      if (day) items[0].date = day;
      releaseWorkingSession(items[0]);
      kept.push(items[0]);
      return;
    }
    const ranked = items.slice().sort(function (a, b) { return trainingRank(b) - trainingRank(a); });
    const winner = Object.assign({}, ranked[0]);
    const day = isoDay(winner.date);
    if (day) winner.date = day;
    ranked.slice(1).forEach(function (loser) {
      if (loser && loser.id && loser.id !== winner.id) idMap[loser.id] = winner.id;
      winner.attendance = mergeAttendance(winner.attendance, loser && loser.attendance);
      if (statusTime(loser) > statusTime(winner)) {
        winner.status = loser.status;
        if (loser.cancelledAt) winner.cancelledAt = loser.cancelledAt;
        winner.stamps = mergeStampMap(winner.stamps, loser.stamps);
      }
    });
    releaseWorkingSession(winner);
    kept.push(winner);
  });
    payload.trainings = kept;
    if (Array.isArray(payload.calendar)) {
      payload.calendar = payload.calendar.map(function (ev) {
        if (!ev || !ev.trainingId || !idMap[ev.trainingId]) return ev;
        return Object.assign({}, ev, { trainingId: idMap[ev.trainingId] });
      });
    }
    if (Array.isArray(payload.boards)) {
      payload.boards.forEach(function (board) {
        if (board && board.trainingId && idMap[board.trainingId]) board.trainingId = idMap[board.trainingId];
      });
    }
    return { removed: Object.keys(idMap).length, idMap: idMap };
  }

  function mergePayload(base, extra) {
    const out = Object.assign({}, base || {});
    LISTS.forEach(function (key) {
      out[key] = mergeList(base && base[key], extra && extra[key]);
    });
    out.settings = mergeSettings(base && base.settings, extra && extra.settings);
    out.feedMeta = mergeFeedMeta(base && base.feedMeta, extra && extra.feedMeta);
    const gone = new Set((out.settings && out.settings.removedGiftIds) || []);
    if (gone.size && Array.isArray(out.gifts)) {
      out.gifts = out.gifts.filter(function (item) {
        if (!item) return false;
        const keys = [item.uid, item.id].map(function (k) { return String(k || ''); }).filter(Boolean);
        return !keys.some(function (k) { return gone.has(k); });
      });
    }
    const droppedBoards = new Set(((out.settings && out.settings.removedBoardIds) || []).map(function (id) { return String(id || ''); }));
    if (droppedBoards.size) {
      if (Array.isArray(out.boards)) {
        out.boards = out.boards.filter(function (board) {
          return !(board && droppedBoards.has(String(board.id || '')));
        });
      }
      if (Array.isArray(out.schemeAlbums)) {
        out.schemeAlbums.forEach(function (album) {
          if (!album || !Array.isArray(album.boardIds)) return;
          album.boardIds = album.boardIds.filter(function (id) { return !droppedBoards.has(String(id || '')); });
        });
      }
    }
    const droppedAlbums = new Set(((out.settings && out.settings.removedAlbumIds) || []).map(function (id) { return String(id || ''); }));
    if (droppedAlbums.size) {
      if (Array.isArray(out.schemeAlbums)) {
        out.schemeAlbums = out.schemeAlbums.filter(function (album) {
          return !(album && droppedAlbums.has(String(album.id || '')));
        });
      }
      if (Array.isArray(out.schemeSections)) {
        out.schemeSections.forEach(function (section) {
          if (!section || !Array.isArray(section.albumIds)) return;
          section.albumIds = section.albumIds.filter(function (id) { return !droppedAlbums.has(String(id || '')); });
        });
      }
    }
    const goneIds = function (key) {
      return new Set(((out.settings && out.settings[key]) || []).map(function (id) { return String(id || ''); }));
    };
    const dropList = function (listName, set) {
      if (!set.size || !Array.isArray(out[listName])) return;
      out[listName] = out[listName].filter(function (item) {
        return !(item && set.has(String(item.id || '')));
      });
    };
    const goneTrain = goneIds('removedTrainingIds');
    const goneMatch = goneIds('removedMatchIds');
    const goneCal = goneIds('removedCalendarIds');
    dropList('trainings', goneTrain);
    dropList('matches', goneMatch);
    dropList('players', goneIds('removedPlayerIds'));
    dropList('schemeSections', goneIds('removedSectionIds'));
    dropList('diary', goneIds('removedDiaryIds'));
    dropList('exercises', goneIds('removedExerciseIds'));
    dropList('myExercises', goneIds('removedMyExerciseIds'));
    dropList('calendar', goneCal);
    if (Array.isArray(out.calendar) && (goneTrain.size || goneMatch.size)) {
      out.calendar = out.calendar.filter(function (ev) {
        if (!ev) return false;
        if (ev.trainingId && goneTrain.has(String(ev.trainingId))) return false;
        if (ev.matchId && goneMatch.has(String(ev.matchId))) return false;
        return true;
      });
    }
    collapseTrainings(out);
    collapsePlayers(out);
    dropSeedPlayers(out);
    applyWornGifts(out);
    keepActiveBoard(out, base, extra);
    return out;
  }

  function boardObjectCount(board) {
    return board && Array.isArray(board.objects) ? board.objects.length : 0;
  }

  /** Порожня дошка в новішому файлі не стирає вже намальовану. */
  function boardStamp(board) {
    if (!board) return 0;
    const raw = board.updatedAt || board.movedAt || board.capturedAt || '';
    const n = Date.parse(raw);
    return isNaN(n) ? 0 : n;
  }

  /** Порожня дошка не стирає намальовану. Якщо фішки на місці, бере новіший зсув. */
  function keepActiveBoard(out, base, extra) {
    const baseBoard = base && base.activeBoard;
    const extraBoard = extra && extra.activeBoard;
    const baseN = boardObjectCount(baseBoard);
    const extraN = boardObjectCount(extraBoard);
    if (!baseN && !extraN) {
      if (extraBoard) out.activeBoard = extraBoard;
      else if (baseBoard) out.activeBoard = baseBoard;
      return;
    }
    if (baseN && !extraN) { out.activeBoard = baseBoard; return; }
    if (extraN && !baseN) { out.activeBoard = extraBoard; return; }
    const baseAt = boardStamp(baseBoard);
    const extraAt = boardStamp(extraBoard);
    if (extraAt > baseAt) out.activeBoard = extraBoard;
    else if (baseAt > extraAt) out.activeBoard = baseBoard;
    else out.activeBoard = extraBoard || baseBoard;
  }

  root.ClubMerge = {
    mergePayload: mergePayload,
    mergeAttendance: mergeAttendance,
    mergeCoachStats: mergeCoachStats,
    mergePlayerUsage: mergePlayerUsage,
    mergePresence: mergePresence,
    recordStamp: recordStamp,
    collapseTrainings: collapseTrainings,
    collapsePlayers: collapsePlayers,
    isSeedPlayer: isSeedPlayer,
    dropSeedPlayers: dropSeedPlayers,
    trainingNameKey: trainingNameKey
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
