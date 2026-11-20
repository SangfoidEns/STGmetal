/** Клуб на Supabase: один рядок стану і файли в сховищі, без JSON між телефонами. */
const SupabaseClub = {
  URL: 'https://zloluzqzswdwaimlqlqx.supabase.co',
  KEY: '',
  KEY_RUNTIME: '',

  enabled() {
    return !!(this.URL && this._key());
  },

  _key() {
    if (this.KEY) return this.KEY;
    if (this.KEY_RUNTIME) return this.KEY_RUNTIME;
    try { return String(localStorage.getItem('ms_sb_anon') || '').trim(); } catch (_) { return ''; }
  },

  rememberKey(key) {
    const clean = String(key || '').trim();
    this.KEY_RUNTIME = clean;
    try {
      if (clean) localStorage.setItem('ms_sb_anon', clean);
      else localStorage.removeItem('ms_sb_anon');
    } catch (_) {}
    return clean;
  },

  headers(extra) {
    const key = this._key();
    return Object.assign({
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    }, extra || {});
  },

  _canWrite(sm) {
    const host = sm || this._sm;
    try {
      if (host && host._canSyncWrite) return !!host._canSyncWrite();
    } catch (_) {}
    return false;
  },

  _who() {
    try {
      if (typeof AuthManager !== 'undefined' && AuthManager.displayName) return AuthManager.displayName() || 'клуб';
    } catch (_) {}
    return 'клуб';
  },

  _line(text) {
    try { if (this._sm && this._sm._setClubSyncLine) this._sm._setClubSyncLine(text); } catch (_) {}
  },

  async start(sm) {
    this._sm = sm;
    if (!this.enabled()) return false;
    if (this._starting) return false;
    this._starting = true;
    this._ready = false;
    try {
      await this.pull({ quiet: true });
      this._ready = true;
      if (this._canWrite(sm)) await this.push();
      this._armPoll();
      return true;
    } catch (err) {
      console.warn('[supabase]', err);
      this._line('Немає зв’язку з сервером');
      return false;
    } finally {
      this._starting = false;
    }
  },

  _armPoll() {
    clearInterval(this._poll);
    this._poll = setInterval(() => {
      try { if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return; } catch (_) {}
      this.pull({ quiet: true }).catch(() => {});
    }, 15000);
    if (!this._focusBound && typeof window !== 'undefined') {
      this._focusBound = true;
      window.addEventListener('focus', () => { this.pull({ quiet: true }).catch(() => {}); });
    }
  },

  schedulePush(sm) {
    if (sm) this._sm = sm;
    if (!this.enabled() || !this._ready || !this._canWrite(this._sm)) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => { this.push().catch(() => {}); }, 900);
  },

  async fetchRemote() {
    const res = await fetch(this.URL + '/rest/v1/club_state?id=eq.metalist&select=id,updated_at,updated_by,rev,path,payload', {
      headers: this.headers(),
      cache: 'no-store'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const missing = res.status === 404 || err.code === 'PGRST205' || /club_state/.test(String(err.message || ''));
      return missing ? { missing: true } : { error: true, status: res.status };
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return { empty: true, rev: 0 };
    const row = rows[0];
    let payload = row.payload && typeof row.payload === 'object' ? row.payload : null;
    if (row.path) {
      const file = await this.download(row.path);
      if (file) payload = file;
    }
    return {
      empty: !payload,
      rev: Number(row.rev) || 0,
      updated_at: row.updated_at || '',
      path: row.path || '',
      payload: payload
    };
  },

  async download(path) {
    const safe = String(path || '').replace(/^\/+/, '');
    if (!safe) return null;
    let res = await fetch(this.URL + '/storage/v1/object/public/club-media/' + safe, { cache: 'no-store' });
    if (!res.ok) {
      res = await fetch(this.URL + '/storage/v1/object/club-media/' + safe, {
        headers: this.headers(),
        cache: 'no-store'
      });
    }
    if (!res.ok) return null;
    return res.json().catch(() => null);
  },

  async upload(path, body, type) {
    const res = await fetch(this.URL + '/storage/v1/object/club-media/' + path, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': type || 'application/octet-stream', 'x-upsert': 'true' }),
      body: body
    });
    return res.ok;
  },

  async pull(opts) {
    if (!this.enabled() || !this._sm) return false;
    const remote = await this.fetchRemote();
    if (!remote || remote.error) {
      this._line('Немає зв’язку з сервером');
      return false;
    }
    if (remote.missing) {
      this._line('Сервер відповідає. У Supabase ще немає таблиці клубу.');
      return false;
    }
    if (remote.empty || !remote.payload) {
      this._line('Сервер порожній. Цей телефон викладе клуб, щойно є ключ і зміни тренера.');
      this._rev = 0;
      return false;
    }
    this._rev = remote.rev;
    if (this._sm._clubUpdatedAt && remote.updated_at && remote.updated_at === this._sm._clubUpdatedAt && !(opts && opts.force)) {
      this._line('Клуб на сервері');
      return false;
    }
    const applied = this._sm.applyClubPayload({
      updatedAt: remote.updated_at || new Date().toISOString(),
      updatedBy: 'supabase',
      payload: remote.payload
    }, { quiet: true });
    if (applied) this._line('Клуб оновлено з сервера');
    return applied;
  },

  async push() {
    if (!this.enabled() || !this._sm || !this._canWrite(this._sm)) return false;
    if (this._pushing) {
      this._again = true;
      return false;
    }
    this._pushing = true;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const remote = await this.fetchRemote();
        if (!remote || remote.error) {
          this._line('Немає зв’язку з сервером');
          return false;
        }
        if (remote.missing) {
          this._line('Сервер відповідає. У Supabase ще немає таблиці клубу.');
          return false;
        }
        let local = this._sm.buildExportPayload();
        if (remote.payload && typeof ClubMerge !== 'undefined' && ClubMerge.mergePayload) {
          local = ClubMerge.mergePayload(remote.payload, local);
        }
        const off = await this.offload(local);
        if (remote.payload && this.same(remote.payload, off.payload)) {
          this.paintUrls(off.map);
          this._line('Клуб на сервері');
          this._sm._clubDirty = false;
          return true;
        }
        const rev = remote.empty ? 0 : (remote.rev || 0);
        const wrote = await this.commit(off.payload, rev, !remote.empty);
        if (wrote === 'conflict') continue;
        if (wrote !== true) {
          this._line('Не вдалося викласти клуб на сервер');
          return false;
        }
        this.paintUrls(off.map);
        this.releaseLocalBlobs();
        this._sm._clubDirty = false;
        this._line('Клуб на сервері. Фото лежать не в телефоні.');
        return true;
      }
      this._line('Сервер зайнятий іншим телефоном. Спроба ще буде.');
      return false;
    } finally {
      this._pushing = false;
      if (this._again) {
        this._again = false;
        this.schedulePush(this._sm);
      }
    }
  },

  async commit(payload, rev, exists) {
    const next = (Number(rev) || 0) + 1;
    const path = 'state/' + next + '-' + Date.now().toString(36) + '.json';
    const text = JSON.stringify(payload);
    const fileOk = await this.upload(path, text, 'application/json');
    const body = {
      id: 'metalist',
      rev: next,
      updated_at: new Date().toISOString(),
      updated_by: this._who(),
      path: fileOk ? path : null,
      payload: fileOk ? null : (text.length < 700000 ? payload : null)
    };
    if (!fileOk && body.payload == null) return false;
    if (!exists) {
      const res = await fetch(this.URL + '/rest/v1/club_state', {
        method: 'POST',
        headers: this.headers({ Prefer: 'return=representation' }),
        body: JSON.stringify(body)
      });
      if (res.status === 409) return 'conflict';
      if (!res.ok) return false;
      const rows = await res.json().catch(() => []);
      return Array.isArray(rows) && rows.length ? true : 'conflict';
    }
    const res = await fetch(this.URL + '/rest/v1/club_state?id=eq.metalist&rev=eq.' + (Number(rev) || 0), {
      method: 'PATCH',
      headers: this.headers({ Prefer: 'return=representation' }),
      body: JSON.stringify({
        rev: body.rev,
        updated_at: body.updated_at,
        updated_by: body.updated_by,
        path: body.path,
        payload: body.payload
      })
    });
    if (!res.ok) return false;
    const rows = await res.json().catch(() => []);
    if (!Array.isArray(rows) || !rows.length) return 'conflict';
    return true;
  },

  async offload(payload) {
    const copy = JSON.parse(JSON.stringify(payload || {}));
    const jobs = [];
    this._walk(copy, (value, set) => {
      if (typeof value === 'string' && value.indexOf('data:') === 0 && value.length > 80) jobs.push({ value: value, set: set });
    });
    const map = new Map();
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      if (map.has(job.value)) {
        job.set(map.get(job.value));
        continue;
      }
      const url = await this.uploadData(job.value);
      if (url) {
        map.set(job.value, url);
        job.set(url);
      } else {
        job.set('');
      }
    }
    return { payload: copy, map: map };
  },

  async uploadData(dataUrl) {
    const blob = this._blob(dataUrl);
    if (!blob) return '';
    const path = 'media/' + this._hash(dataUrl) + '.' + this._ext(blob.type);
    const ok = await this.upload(path, blob, blob.type || 'application/octet-stream');
    if (!ok) return '';
    return this.URL + '/storage/v1/object/public/club-media/' + path;
  },

  paintUrls(map) {
    if (!map || !map.size) return;
    const live = (typeof Store !== 'undefined' && Store.get) ? Store.get() : null;
    if (!live) return;
    this._walk(live, (value, set) => {
      if (typeof value === 'string' && map.has(value)) set(map.get(value));
    });
    try { if (this._sm && this._sm.save) this._sm.save({ localOnly: true }); } catch (_) {}
  },

  releaseLocalBlobs() {
    const live = (typeof Store !== 'undefined' && Store.get) ? Store.get() : null;
    if (!live || typeof localStorage === 'undefined') return;
    (live.players || []).forEach(p => {
      if (!p || p.id == null) return;
      const url = String(p.profilePhoto || p.photoUrl || '');
      if (url && url.indexOf('data:') !== 0) {
        try { localStorage.removeItem('metalist_pphoto_' + p.id); } catch (_) {}
      }
    });
    const coach = live.settings && String(live.settings.coachPhoto || live.settings.coachPhotoUrl || '');
    if (coach && coach.indexOf('data:') !== 0) {
      try { localStorage.removeItem('metalist_coach_photo'); } catch (_) {}
    }
  },

  _walk(value, visit, seen) {
    if (!value || typeof value !== 'object') return;
    const bag = seen || new Set();
    if (bag.has(value)) return;
    bag.add(value);
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === 'object') this._walk(item, visit, bag);
        else visit(item, (next) => { value[index] = next; });
      });
      return;
    }
    Object.keys(value).forEach((key) => {
      const item = value[key];
      if (item && typeof item === 'object') this._walk(item, visit, bag);
      else visit(item, (next) => { value[key] = next; });
    });
  },

  _blob(dataUrl) {
    const match = String(dataUrl || '').match(/^data:([^;,]+)?(;base64)?,(.*)$/);
    if (!match) return null;
    const type = match[1] || 'application/octet-stream';
    try {
      if (match[2]) {
        const bin = atob(match[3]);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new Blob([arr], { type: type });
      }
      return new Blob([decodeURIComponent(match[3])], { type: type });
    } catch (_) { return null; }
  },

  _ext(type) {
    const kind = String(type || '');
    if (kind.indexOf('png') >= 0) return 'png';
    if (kind.indexOf('webp') >= 0) return 'webp';
    if (kind.indexOf('gif') >= 0) return 'gif';
    if (kind.indexOf('jpeg') >= 0 || kind.indexOf('jpg') >= 0) return 'jpg';
    if (kind.indexOf('json') >= 0) return 'json';
    return 'bin';
  },

  _hash(text) {
    let h = 2166136261;
    const n = text.length;
    const step = Math.max(1, Math.floor(n / 4000));
    for (let i = 0; i < n; i += step) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16) + n.toString(16);
  },

  same(a, b) {
    return JSON.stringify(this.canon(a)) === JSON.stringify(this.canon(b));
  },

  canon(value) {
    if (Array.isArray(value)) return value.map(item => this.canon(item));
    if (!value || typeof value !== 'object') return value;
    const out = {};
    Object.keys(value).sort().forEach(key => {
      if (key === 'exportedAt' || key === 'updatedAt') return;
      out[key] = this.canon(value[key]);
    });
    return out;
  }
};

if (typeof window !== 'undefined') window.SupabaseClub = SupabaseClub;
