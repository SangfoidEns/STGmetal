/**
 * Злиття двох знімків клубу без дублів.
 * Однаковий id лишається один раз. Новіший updatedAt перемагає.
 * Відвідуваність зливається по гравцю. Час тренера береться більший.
 */
(function (root) {
  const LISTS = ['players', 'trainings', 'exercises', 'boards', 'calendar', 'matches', 'diary', 'myExercises', 'animations', 'gifts', 'moments', 'chat', 'feed'];

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

/** Дата і статус тренування не залежать від печатки відвідування. */
function scheduleStamp(obj) {
  if (!obj || typeof obj !== 'object') return 0;
  return stamp(obj.updatedAt || obj.createdAt || obj.exportedAt);
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
  ['name', 'date', 'time', 'status', 'duration', 'place', 'surface', 'intensity', 'mainGoal', 'comment', 'structure', 'playersCount', 'physGoal', 'tactGoal', 'techGoal', 'psychGoal'].forEach(function (key) {
    if (from && filled(from[key])) merged[key] = from[key];
  });
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
  releaseWorkingSession(merged);
  return merged;
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
    ['birthDate', 'birthday', 'photoUrl', 'photo', 'avatar', 'profilePhoto', 'phone', 'bio', 'statusText', 'telegramUsername', 'telegramId', 'firstName', 'lastName', 'notes', 'position'].forEach(function (key) {
      if (!filled(winner && winner[key]) && filled(loser && loser[key])) merged[key] = loser[key];
    });
    if ((!winner || winner.number == null || winner.number === '' || winner.number === 0) && loser && loser.number) {
      merged.number = loser.number;
    }
    ['structure', 'slides', 'objects', 'tags', 'secondaryPositions'].forEach(function (key) {
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
    if (!out.coachPhoto) out.coachPhoto = (loser.coachPhoto || winner.coachPhoto || '');
    if (!out.coachName) out.coachName = (loser.coachName || winner.coachName || '');
    const gone = [];
    [base.removedGiftIds, extra.removedGiftIds].forEach(function (list) {
      (Array.isArray(list) ? list : []).forEach(function (id) {
        const key = String(id || '');
        if (key && gone.indexOf(key) < 0) gone.push(key);
      });
    });
    if (gone.length) out.removedGiftIds = gone.slice(-800);
    return out;
  }

  function mergeFeedMeta(base, extra) {
    const out = {};
    ['status', 'photo', 'level', 'streak'].forEach(function (key) {
      const a = (base && base[key]) || {};
      const b = (extra && extra[key]) || {};
      const merged = Object.assign({}, a, b);
      if (key === 'level' || key === 'streak') {
        Object.keys(merged).forEach(function (id) {
          merged[id] = Math.max(Number(a[id]) || 0, Number(b[id]) || 0);
        });
      }
      out[key] = merged;
    });
    return out;
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
      if (loser && loser.id) idMap[loser.id] = winner.id;
      winner.attendance = mergeAttendance(winner.attendance, loser && loser.attendance);
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
    collapseTrainings(out);
    return out;
  }

  root.ClubMerge = {
    mergePayload: mergePayload,
    mergeAttendance: mergeAttendance,
    mergeCoachStats: mergeCoachStats,
    recordStamp: recordStamp,
    collapseTrainings: collapseTrainings,
    trainingNameKey: trainingNameKey
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
