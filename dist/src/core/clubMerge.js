/**
 * Злиття двох знімків клубу без дублів.
 * Однаковий id лишається один раз. Новіший updatedAt перемагає.
 * Відвідуваність зливається по гравцю. Час тренера береться більший.
 */
(function (root) {
  const LISTS = ['players', 'trainings', 'exercises', 'boards', 'calendar', 'matches', 'diary', 'myExercises', 'animations', 'gifts', 'moments', 'chat'];

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
    const baseAt = recordStamp(baseItem);
    const extraAt = recordStamp(extraItem);
    const extraWins = extraAt > baseAt;
    const winner = extraWins ? extraItem : baseItem;
    const loser = extraWins ? baseItem : extraItem;
    const merged = Object.assign({}, loser, winner);
    if ((baseItem && baseItem.attendance) || (extraItem && extraItem.attendance)) {
      merged.attendance = mergeAttendance(baseItem && baseItem.attendance, extraItem && extraItem.attendance);
    }
    if (extraWins && extraItem && extraItem.coachPresent != null) merged.coachPresent = extraItem.coachPresent;
    else if (!extraWins && baseItem && baseItem.coachPresent != null) merged.coachPresent = baseItem.coachPresent;
    return merged;
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

  /** Одна назва — одне тренування. «(копія)» і «05/11» поруч із «5/11» зливаються в оригінал. */
  function collapseTrainings(payload) {
    if (!payload || !Array.isArray(payload.trainings)) return { removed: 0, idMap: {} };
    const groups = new Map();
    payload.trainings.forEach(function (item) {
      if (!item) return;
      const key = trainingNameKey(item.name) || ('id:' + (item.id || ''));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    const idMap = {};
    const kept = [];
    groups.forEach(function (items) {
      if (items.length === 1) {
        kept.push(items[0]);
        return;
      }
      const ranked = items.slice().sort(function (a, b) { return trainingRank(b) - trainingRank(a); });
      const winner = Object.assign({}, ranked[0]);
      ranked.slice(1).forEach(function (loser) {
        if (loser && loser.id) idMap[loser.id] = winner.id;
        winner.attendance = mergeAttendance(winner.attendance, loser && loser.attendance);
      });
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
