/** Session load & attendance analytics */
const LoadModel = {
  /** Матч важчий за тренування тієї ж довжини: ті самі хвилини й оцінка важать у 1.7 раза більше. */
  MATCH_WEIGHT: 1.7,

  sessionLoad(duration, intensity) {
    return Math.round((+duration || 0) * (+intensity || 0));
  },

  /** ISO date сьогодні (локальна) */
  todayStr(refDate) {
    const d = refDate ? new Date(refDate) : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  },

  /**
   * Лише тренування, які вже відбулися (дата ≤ сьогодні)
   * і не скасовані. Майбутні planned/draft не враховуються.
   */
  /** Скасоване не є пропуском, навіть якщо в журналі лишився present:false. */
  isCancelled(t) {
    if (!t) return false;
    const st = String(t.status || '').toLowerCase();
    if (st === 'done' || st === 'completed' || st === 'проведено') return false;
    if (st === 'draft' || st === 'planned' || st === 'pinned') return false;
    if (st === 'cancelled' || st === 'canceled' || st === 'скасовано') return true;
    if (t.cancelledAt) return true;
    return false;
  },

  pastTrainings(trainings, refDate) {
    const today = this.todayStr(refDate);
    return (trainings || []).filter(t => {
      if (!t || !t.date) return false;
      if (this.isCancelled(t)) return false;
      return String(t.date) <= today;
    });
  },

  /** Проведені (done) або з відмітками відвідування, у минулому */
  completedTrainings(trainings, refDate) {
    return this.pastTrainings(trainings, refDate).filter(t =>
      t.status === 'done' || (t.attendance && Object.keys(t.attendance).length)
    );
  },

  playedMatches(matches, refDate) {
    const today = this.todayStr(refDate);
    return (matches || []).filter(function (m) {
      if (!m || !m.date || String(m.date) > today) return false;
      const st = String(m.status || '').toLowerCase();
      if (st === 'cancelled' || st === 'canceled' || st === 'скасовано') return false;
      return !!(m.attendance && Object.keys(m.attendance).length);
    });
  },

  _matches(matches) {
    if (Array.isArray(matches)) return matches;
    try {
      const s = (typeof Store !== 'undefined' && Store.get) ? Store.get() : null;
      return (s && s.matches) || [];
    } catch (_) { return []; }
  },

  /** Хвилини гравця: своє поле, інакше заміна, інакше повний матч для основи. */
  playerMinutes(match, playerId) {
    if (!match || playerId == null) return 0;
    const cell = match.attendance && (match.attendance[playerId] != null ? match.attendance[playerId] : match.attendance[String(playerId)]);
    if (cell && cell.minutes != null && cell.minutes !== '' && !isNaN(Number(cell.minutes))) {
      return Math.max(0, Math.round(Number(cell.minutes)));
    }
    if (cell && (cell.present === false || cell.present === 0 || cell.present === '0')) return 0;
    const id = String(playerId);
    const full = Math.max(1, Number(match.minutes) || 90);
    const subs = Array.isArray(match.subs) ? match.subs : [];
    let came = null;
    let left = null;
    subs.forEach(function (sub) {
      if (!sub) return;
      if (String(sub.onId) === id) came = Number(sub.minute) || 0;
      if (String(sub.offId) === id) left = Number(sub.minute) || full;
    });
    if (came != null || left != null) {
      const start = came == null ? 0 : came;
      const end = left == null ? full : left;
      return Math.max(0, end - start);
    }
    const inXi = (match.xi || []).some(function (x) { return x != null && String(x) === id; });
    const present = cell && (cell.present === true || cell.present === 1 || cell.present === '1');
    if (inXi || present) return full;
    return 0;
  },

  matchPlayerLoad(match, playerId) {
    if (!match || !match.attendance || playerId == null) return 0;
    const cell = match.attendance[playerId] != null ? match.attendance[playerId] : match.attendance[String(playerId)];
    if (!cell || cell.present === false || cell.present === 0 || cell.present === '0') return 0;
    if (cell.present !== true && cell.present !== 1 && cell.present !== '1') return 0;
    const intensity = cell.rating != null && cell.rating !== '' ? Number(cell.rating) : 6;
    const minutes = this.playerMinutes(match, playerId);
    if (!minutes) return 0;
    return Math.round(this.sessionLoad(minutes, intensity) * (this.MATCH_WEIGHT || 1));
  },

  _trainings(trainings) {
    if (Array.isArray(trainings)) return trainings;
    try {
      const s = (typeof Store !== 'undefined' && Store.get) ? Store.get() : null;
      return (s && s.trainings) || [];
    } catch (_) { return []; }
  },

  _inWindow(date, days) {
    const today = this.todayStr();
    const fromD = new Date();
    fromD.setDate(fromD.getDate() - ((days || 28) - 1));
    const from = this.todayStr(fromD);
    const day = String(date || '');
    return !!day && day >= from && day <= today;
  },

  _clampRating(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(10, n));
  },

  /**
   * Місце гравця за 28 днів, від 0 до 10.
   * Явка, навантаження, матчі, голи й оцінка. Одне тренування саме по собі місце не піднімає.
   * quality лишається середньою оцінкою, де матч важить більше за ті самі хвилини.
   */
  formLoad(playerId, days, trainings, matches) {
    days = days || 28;
    const events = [];
    const self = this;
    let goals = 0;
    this.pastTrainings(this._trainings(trainings)).forEach(function (t) {
      if (!self._inWindow(t.date, days)) return;
      const mark = self._attEntry(null, playerId, t);
      const present = self._isPresent(mark);
      if (present === false) return;
      if (present == null && !(mark && typeof mark === 'object')) return;
      const rating = self._clampRating(self._entryRpe(mark, t));
      if (rating == null) return;
      const minutes = Math.max(1, Number(t.duration) || 75);
      events.push({
        kind: 'train',
        id: t.id,
        date: String(t.date || ''),
        name: t.name || 'Тренування',
        rating: rating,
        minutes: minutes,
        weight: minutes,
        units: self.sessionLoad(minutes, rating)
      });
    });
    this.playedMatches(this._matches(matches)).forEach(function (m) {
      if (!self._inWindow(m.date, days)) return;
      const cell = m.attendance[playerId] != null ? m.attendance[playerId] : m.attendance[String(playerId)];
      if (!cell || cell.present === false || cell.present === 0 || cell.present === '0') return;
      if (cell.present !== true && cell.present !== 1 && cell.present !== '1') return;
      const rating = self._clampRating(cell.rating != null && cell.rating !== '' ? cell.rating : 6);
      if (rating == null) return;
      const minutes = self.playerMinutes(m, playerId);
      if (!minutes) return;
      const scored = Number(cell.goals);
      if (Number.isFinite(scored) && scored > 0) goals += scored;
      const weight = minutes * (self.MATCH_WEIGHT || 1);
      events.push({
        kind: 'match',
        id: m.id,
        date: String(m.date || ''),
        name: m.opponent ? ('Матч · ' + m.opponent) : 'Матч',
        rating: rating,
        minutes: minutes,
        weight: weight,
        units: Math.round(self.sessionLoad(minutes, rating) * (self.MATCH_WEIGHT || 1))
      });
    });
    events.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    let weightSum = 0;
    let rated = 0;
    let trainUnits = 0;
    let matchUnits = 0;
    let trainN = 0;
    let matchN = 0;
    let trainRated = 0;
    let matchRated = 0;
    events.forEach(function (ev) {
      weightSum += ev.weight;
      rated += ev.rating * ev.weight;
      if (ev.kind === 'match') {
        matchUnits += ev.units;
        matchN += 1;
        matchRated += ev.rating;
      } else {
        trainUnits += ev.units;
        trainN += 1;
        trainRated += ev.rating;
      }
    });
    const round1 = function (n) { return Math.round(n * 10) / 10; };
    const teamTrains = this.completedTrainings(this._trainings(trainings)).filter(function (t) {
      return self._inWindow(t.date, days);
    });
    const teamMatches = this.playedMatches(this._matches(matches)).filter(function (m) {
      return self._inWindow(m.date, days);
    });
    let came = 0;
    teamTrains.forEach(function (t) {
      if (self._isPresent(self._attEntry(null, playerId, t)) === true) came += 1;
    });
    let expected = 0;
    teamTrains.forEach(function (t) {
      expected += Math.max(1, Number(t.duration) || 75) * 7;
    });
    teamMatches.forEach(function (m) {
      expected += Math.max(1, Number(m.minutes) || 90) * 7 * (self.MATCH_WEIGHT || 1);
    });
    const att = teamTrains.length ? (came / teamTrains.length) : 0;
    const play = teamMatches.length ? (matchN / teamMatches.length) : 0;
    const quality = weightSum ? (rated / weightSum) : 0;
    const loadN = expected ? Math.min(1, (trainUnits + matchUnits) / expected) : 0;
    const goalsN = Math.min(1, goals / 2);
    const parts = [
      { w: 3, v: att },
      { w: 2, v: loadN },
      { w: teamMatches.length ? 2.5 : 0, v: play },
      { w: 1, v: goalsN },
      { w: 1.5, v: quality / 10 }
    ];
    const wsum = parts.reduce(function (sum, part) { return sum + part.w; }, 0);
    const hasTeam = teamTrains.length + teamMatches.length > 0;
    return {
      score: hasTeam ? round1(parts.reduce(function (sum, part) { return sum + part.w * part.v; }, 0) / wsum * 10) : null,
      quality: weightSum ? round1(quality) : null,
      trainAvg: trainN ? round1(trainRated / trainN) : null,
      matchAvg: matchN ? round1(matchRated / matchN) : null,
      trainN: trainN,
      matchN: matchN,
      goals: goals,
      came: came,
      teamTrains: teamTrains.length,
      teamMatches: teamMatches.length,
      trainUnits: trainUnits,
      matchUnits: matchUnits,
      weight: this.MATCH_WEIGHT || 1,
      days: days,
      events: events
    };
  },

  /**
   * День = усі тренування цього дня плюс зіграний матч.
   * Матч додає хвилини × MATCH_WEIGHT, тож розминка в день гри не робить графік нижчим.
   */
  dayActivity(trainings, matches) {
    const days = {};
    const self = this;
    const touch = function (date) {
      const key = String(date || '').slice(0, 10);
      if (!key) return null;
      if (!days[key]) days[key] = { date: key, minutes: 0, load: 0, trainings: 0, matches: 0 };
      return days[key];
    };
    this.pastTrainings(trainings).forEach(function (t) {
      const row = touch(t.date);
      if (!row) return;
      const minutes = Math.max(0, Number(t.duration) || 0);
      let intensity = Number(t.intensity) || 0;
      if (!intensity) {
        const att = t.attendance || {};
        const rpes = Object.keys(att).map(function (id) {
          const mark = att[id];
          if (!mark || typeof mark !== 'object') return null;
          if (mark.rpe != null && mark.rpe !== '') return Number(mark.rpe);
          if (mark.intensity != null && mark.intensity !== '') return Number(mark.intensity);
          return null;
        }).filter(function (v) { return v != null && !isNaN(v); });
        intensity = rpes.length ? (rpes.reduce(function (a, v) { return a + v; }, 0) / rpes.length) : 0;
      }
      row.minutes += minutes;
      row.load += self.sessionLoad(minutes, intensity);
      row.trainings += 1;
    });
    const today = this.todayStr();
    (this._matches(matches) || []).forEach(function (m) {
      if (!m || !m.date || String(m.date) > today) return;
      const st = String(m.status || '').toLowerCase();
      if (st === 'cancelled' || st === 'canceled' || st === 'скасовано') return;
      const hasAtt = !!(m.attendance && Object.keys(m.attendance).length);
      if (st !== 'played' && st !== 'done' && st !== 'completed' && st !== 'зіграно' && !hasAtt) return;
      const row = touch(m.date);
      if (!row) return;
      const minutes = Math.max(1, Number(m.minutes) || 90);
      const att = m.attendance || {};
      const ratings = Object.keys(att).map(function (id) {
        const cell = att[id];
        if (!cell || cell.present === false || cell.present === 0 || cell.present === '0') return null;
        if (cell.present !== true && cell.present !== 1 && cell.present !== '1') return null;
        return cell.rating != null && cell.rating !== '' ? Number(cell.rating) : 6;
      }).filter(function (v) { return v != null && !isNaN(v); });
      const avg = ratings.length ? (ratings.reduce(function (a, v) { return a + v; }, 0) / ratings.length) : 6;
      const weight = self.MATCH_WEIGHT || 1;
      row.minutes += Math.round(minutes * weight);
      row.load += Math.round(self.sessionLoad(minutes, avg) * weight);
      row.matches += 1;
    });
    return Object.keys(days).sort().map(function (key) { return days[key]; });
  },

  shownScore(player, days) {
    if (!player || player.id == null) return null;
    const form = this.formLoad(player.id, days);
    return form && form.score != null ? form.score : null;
  },

  matchLoadFor(playerId, days, matches) {
    days = days || 28;
    const today = this.todayStr();
    const fromD = new Date();
    fromD.setDate(fromD.getDate() - (days - 1));
    const from = this.todayStr(fromD);
    let sum = 0;
    this.playedMatches(this._matches(matches)).forEach((m) => {
      if (String(m.date) < from || String(m.date) > today) return;
      sum += this.matchPlayerLoad(m, playerId);
    });
    return sum;
  },

  weeklyLoad(trainings, refDate) {
    const d = refDate ? new Date(refDate) : new Date();
    const to = this.todayStr(d);
    const fromD = new Date(d);
    fromD.setDate(fromD.getDate() - 6);
    const from = this.todayStr(fromD);
    // тільки минулі/сьогоднішні, не майбутні
    return this.pastTrainings(trainings, d)
      .filter(t => t.date >= from && t.date <= to)
      .reduce((a, t) => {
        let intensity = t.intensity;
        if (intensity == null || intensity === 0) {
          // fallback: середній RPE з attendance, інакше 5
          const att = t.attendance || {};
          const rpes = Object.keys(att).map(k => {
            const e = att[k];
            if (e == null) return null;
            if (typeof e === 'number') return e;
            return e.intensity != null ? e.intensity : (e.rpe != null ? e.rpe : null);
          }).filter(v => v != null && !isNaN(+v)).map(Number);
          intensity = rpes.length ? (rpes.reduce((s, v) => s + v, 0) / rpes.length) : 5;
        }
        return a + this.sessionLoad(t.duration, intensity);
      }, 0) + this.playedMatches(this._matches(), refDate).filter(m => m.date >= from && m.date <= to).reduce((a, m) => {
        const att = m.attendance || {};
        return a + Object.keys(att).reduce((s, id) => s + this.matchPlayerLoad(m, id), 0);
      }, 0);
  },

  /** % відвідувань серед проведених у минулому */
  _attEntry(trainings, playerId, t) {
    if (!t || !t.attendance) return null;
    const a = t.attendance[playerId] != null ? t.attendance[playerId]
      : (t.attendance[String(playerId)] != null ? t.attendance[String(playerId)] : null);
    return a;
  },
  _isPresent(a) {
    if (a == null) return null; // no mark
    if (a === true || a === 1 || a === '1' || a === 'yes') return true;
    if (a === false || a === 0 || a === '0' || a === 'no') return false;
    if (typeof a === 'object') {
      if (a.present === false || a.attended === false || a.status === 'absent' || a.status === 'missed') return false;
      if (a.present === true || a.present === 1 || a.attended === true || a.status === 'present' || a.status === 'ok') return true;
      // object exists but no explicit flag — treat as present if rpe/intensity set
      if (a.intensity != null || a.rpe != null || a.load != null) return true;
    }
    return null;
  },
  _entryRpe(a, training) {
    if (a == null || typeof a !== 'object') return (training && training.intensity != null ? +training.intensity : null);
    if (a.intensity != null && a.intensity !== '') return +a.intensity;
    if (a.rpe != null && a.rpe !== '') return +a.rpe;
    if (a.load != null && a.load !== '' && +a.load <= 10) return +a.load;
    if (training && training.intensity != null) return +training.intensity;
    return null;
  },
  attendanceRate(trainings, playerId) {
    const done = this.completedTrainings(trainings);
    if (!done.length) return null;
    let present = 0, total = 0;
    done.forEach(t => {
      const a = this._attEntry(trainings, playerId, t);
      const p = this._isPresent(a);
      if (p == null) return; // не відмічено
      total++;
      if (p) present++;
    });
    if (!total) return null;
    return Math.round((present / total) * 100);
  },

  avgPlayerRpe(trainings, playerId) {
    const vals = [];
    this.pastTrainings(trainings).forEach(t => {
      const a = this._attEntry(trainings, playerId, t);
      const p = this._isPresent(a);
      if (p === false) return;
      if (p == null && !(a && typeof a === 'object')) return;
      const r = this._entryRpe(a, t);
      if (r != null && !isNaN(r)) vals.push(r);
    });
    if (!vals.length) return null;
    return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
  },

  playerLoad(trainings, playerId, days) {
    days = days || 28;
    const today = this.todayStr();
    const fromD = new Date();
    fromD.setDate(fromD.getDate() - (days - 1));
    const from = this.todayStr(fromD);
    let sum = 0;
    this.pastTrainings(trainings).forEach(t => {
      if (t.date < from || t.date > today) return;
      const a = this._attEntry(trainings, playerId, t);
      const p = this._isPresent(a);
      if (p === false) return;
      if (p == null && !(a && typeof a === 'object')) return;
      const rpe = this._entryRpe(a, t);
      sum += this.sessionLoad(t.duration, rpe != null ? rpe : (t.intensity || 0));
    });
    sum += this.matchLoadFor(playerId, days);
    return sum;
  },

  recomputePlayerLoads(players, trainings) {
    (players || []).forEach(p => {
      const load = this.playerLoad(trainings, p.id, 28);
      p.load28 = load;
    });
  },

  /** Дані для графіка: відвідуваність по кожному минулому тренуванню */
  attendanceBySession(trainings, refDate) {
    return this.pastTrainings(trainings, refDate)
      .filter(t => t.attendance && Object.keys(t.attendance).length)
      .slice()
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .map(t => {
        const vals = Object.values(t.attendance || {});
        const pr = vals.filter(a => a && a.present).length;
        const total = vals.length || 1;
        return {
          id: t.id,
          name: t.name || 'Тренування',
          date: t.date,
          present: pr,
          total,
          pct: Math.round((pr / total) * 100)
        };
      });
  },

  /** Підсумок: кількість минулих, години, сер. RPE, загальна відвідуваність */
  teamSummary(trainings, players, refDate) {
    const past = this.pastTrainings(trainings, refDate);
    const totalMin = past.reduce((a, t) => a + (+t.duration || 0), 0);
    const withRpe = past.filter(t => t.intensity != null);
    const avgInt = withRpe.length
      ? Math.round((withRpe.reduce((a, t) => a + (+t.intensity || 0), 0) / withRpe.length) * 10) / 10
      : 0;
    const sessions = this.attendanceBySession(trainings, refDate);
    const overallAtt = sessions.length
      ? Math.round(sessions.reduce((a, s) => a + s.pct, 0) / sessions.length)
      : null;
    return {
      count: past.length,
      totalMin,
      avgInt,
      weekLoad: this.weeklyLoad(trainings, refDate),
      overallAtt,
      sessionsWithAtt: sessions.length
    };
  }
};

if (typeof window !== 'undefined') window.LoadModel = LoadModel;
