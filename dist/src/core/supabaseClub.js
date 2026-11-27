/** Клуб на Supabase: один рядок стану і файли в сховищі, без JSON між телефонами. */
const SupabaseClub = {
  URL: 'https://zloluzqzswdwaimlqlqx.supabase.co',
  KEY: '',
  KEY_RUNTIME: '',
  ROW_LIMIT: 1500000,
  POLL_MS: 60000,
  PUSH_MS: 60000,

  enabled() {
    return !!(this.URL && this._key());
  },

  _key() {
    if (this.KEY) return this.KEY;
    if (this.KEY_RUNTIME) return this.KEY_RUNTIME;
    try { return String(localStorage.getItem('ms_sb_anon') || '').trim(); } catch (_) { return ''; }
  },

  cleanKey(raw) {
    const text = String(raw || '').trim();
    const jwt = text.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
    if (jwt) return jwt[0];
    const pub = text.match(/sb_(?:publishable|secret)_[A-Za-z0-9_-]+/);
    if (pub) return pub[0];
    const one = text.replace(/^bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();
    if (/^https?:\/\//i.test(one)) return '';
    return (one.split(/\s+/)[0] || '');
  },

  rememberKey(key) {
    const raw = String(key || '').trim();
    if (/^https?:\/\//i.test(raw) && raw.indexOf('eyJ') < 0 && raw.indexOf('sb_') < 0) {
      this._line('Це адреса сервера, а не код. Потрібен anon public.');
      return '';
    }
    const clean = this.cleanKey(raw);
    this.KEY_RUNTIME = clean;
    try {
      if (clean) localStorage.setItem('ms_sb_anon', clean);
      else localStorage.removeItem('ms_sb_anon');
    } catch (_) {}
    return clean;
  },

  headers(extra, opts) {
    const key = this._key();
    const base = {
      apikey: key,
      Authorization: 'Bearer ' + key,
      Accept: 'application/json'
    };
    if (!opts || opts.json !== false) base['Content-Type'] = 'application/json';
    return Object.assign(base, extra || {});
  },

  _fail(remote) {
    const status = remote && remote.status;
    const code = String((remote && remote.code) || '');
    const message = String((remote && remote.message) || '');
    if (code === 'PGRST205' || (remote && remote.missing)) return 'Сервер відповідає. У Supabase ще немає таблиці клубу. Виконай SQL ще раз.';
    if (code === '42501' || /permission denied/i.test(message)) return 'Ключ є, але таблиця не пускає. Виконай SQL клубу ще раз.';
    if (status === 401 || status === 403 || /Invalid API key|JWT/i.test(message)) return 'Ключ не підходить. Потрібен anon public, не адреса сайту і не service_role.';
    if (status) return 'Немає зв’язку з сервером (' + status + ').';
    return 'Немає зв’язку з сервером. Перевір інтернет.';
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
      const remote = await this.fetchRemote();
      if (!remote || remote.error) {
        this._line(this._fail(remote));
        return false;
      }
      if (remote.missing) {
        this._line(this._fail({ missing: true }));
        return false;
      }
      this._ready = true;
      if (!this._rebuilding && remote.payload) {
        try { await this.sweep(remote.path || '', remote.payload); } catch (_) {}
      }
      await this.pull({ quiet: true, known: remote });
      let sent = true;
      const needSend = !!(remote.empty || !remote.payload || (sm && sm._clubDirty));
      if (this._canWrite(sm) && !this._rebuilding && needSend) sent = await this.push();
      this._armPoll();
      return sent !== false;
    } catch (err) {
      console.warn('[supabase]', err);
      this._line(this._fail(null));
      return false;
    } finally {
      this._starting = false;
    }
  },

  editorOpen() {
    try {
      if (this._sm && this._sm._editorOpen) return !!this._sm._editorOpen();
    } catch (_) {}
    return false;
  },

  _armPoll() {
    clearInterval(this._poll);
    const tick = () => {
      try { if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return; } catch (_) {}
      try { if (typeof navigator !== 'undefined' && navigator.onLine === false) return; } catch (_) {}
      if (this.editorOpen()) return;
      this.pull({ quiet: true }).catch(() => {});
    };
    this._poll = setInterval(tick, this.POLL_MS);
    if (!this._netBound && typeof window !== 'undefined') {
      this._netBound = true;
      window.addEventListener('online', () => {
        this._line('Зв’язок є');
        tick();
      });
      window.addEventListener('offline', () => {
        this._line('Немає зв’язку');
        this.flush().catch(() => {});
      });
      document.addEventListener('visibilitychange', () => {
        try {
          if (document.visibilityState === 'hidden') this.flush().catch(() => {});
          else tick();
        } catch (_) {}
      });
    }
  },

  schedulePush(sm) {
    if (sm) this._sm = sm;
    if (!this.enabled() || !this._ready || !this._canWrite(this._sm)) return;
    if (this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = null;
      if (this.editorOpen()) {
        this.schedulePush(this._sm);
        return;
      }
      this.push().catch(() => {});
    }, this.PUSH_MS);
  },

  flush() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    if (!this.enabled() || !this._ready || !this._canWrite(this._sm)) return Promise.resolve(false);
    if (!(this._sm && this._sm._clubDirty)) return Promise.resolve(false);
    return this.push();
  },

  async fetchRemote(opts) {
    const light = !!(opts && opts.light);
    const select = light ? 'id,updated_at,updated_by,rev,path' : 'id,updated_at,updated_by,rev,path,payload';
    const res = await fetch(this.URL + '/rest/v1/club_state?id=eq.metalist&select=' + select, {
      headers: this.headers(null, { json: false }),
      cache: 'no-store'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const missing = res.status === 404 || err.code === 'PGRST205';
      return {
        missing: missing,
        error: !missing,
        status: res.status,
        code: err.code || '',
        message: err.message || err.hint || ''
      };
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return { empty: true, rev: 0 };
    const row = rows[0];
    const inline = !light && row.payload && typeof row.payload === 'object' ? row.payload : null;
    let payload = inline;
    let path = row.path || '';
    if (!light && !payload && path) {
      const file = await this.download(path, row.updated_at);
      if (file) payload = file;
    }
    if (inline) path = '';
    return {
      empty: !payload,
      rev: Number(row.rev) || 0,
      updated_at: row.updated_at || '',
      path: path,
      payload: payload
    };
  },

  async download(path, stamp) {
    const safe = String(path || '').replace(/^\/+/, '');
    if (!safe) return null;
    const q = stamp ? ('?v=' + encodeURIComponent(String(stamp))) : '';
    let res = await fetch(this.URL + '/storage/v1/object/public/club-media/' + safe + q);
    if (!res.ok) {
      res = await fetch(this.URL + '/storage/v1/object/club-media/' + safe + q, {
        headers: this.headers()
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
    this._lastUploadStatus = res.status;
    if (res.ok) {
      this._fresh = this._fresh || new Set();
      this._fresh.add(String(path || ''));
    }
    return res.ok;
  },

  async pull(opts) {
    if (!this.enabled() || !this._sm) return false;
    if (this.editorOpen() && !(opts && opts.force)) return false;
    if (typeof BoardEngine !== 'undefined' && BoardEngine.dragObj) return false;
    let remote = opts && opts.known;
    if (!remote) {
      const head = await this.fetchRemote({ light: true });
      if (!head || head.error || head.missing || head.empty) remote = head;
      else if (this._sm._clubUpdatedAt && head.updated_at && head.updated_at === this._sm._clubUpdatedAt && !(opts && opts.force)) {
        this._rev = head.rev;
        this._line('Клуб на сервері');
        return false;
      } else remote = await this.fetchRemote();
    }
    if (!remote || remote.error) {
      this._line(this._fail(remote));
      return false;
    }
    if (remote.missing) {
      this._line(this._fail({ missing: true }));
      return false;
    }
    if (remote.empty || !remote.payload) {
      const writer = this._canWrite(this._sm);
      this._line(writer
        ? 'Код прийнято. Сервер порожній — цей телефон зараз викладе клуб.'
        : 'Код прийнято. Сервер ще порожній, клуб з’явиться після тренера.');
      this._rev = 0;
      return false;
    }
    this._rev = remote.rev;
    if (this._sm._clubDirty && this._canWrite(this._sm) && !(opts && opts.force)) {
      this.schedulePush(this._sm);
      return false;
    }
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
    if (this._rebuilding && !this._allowPush) return false;
    if (!this.enabled() || !this._sm || !this._canWrite(this._sm)) return false;
    if (this._pushing) {
      this._again = true;
      return false;
    }
    this._pushing = true;
    const rev = this._sm._clubRev || 0;
    const stillMine = () => (this._sm._clubRev || 0) === rev;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const remote = await this.fetchRemote();
        if (!remote || remote.error) {
          this._line(this._fail(remote));
          return false;
        }
        if (remote.missing) {
          this._line(this._fail({ missing: true }));
          return false;
        }
        const live = this._sm.buildExportPayload();
        let local = live;
        if (remote.payload && typeof ClubMerge !== 'undefined' && ClubMerge.mergePayload) {
          local = ClubMerge.mergePayload(remote.payload, local);
        }
        const off = await this.offload(local);
        const slim = this.withoutInline(off.payload);
        const remember = (updatedAt) => {
          if (!stillMine()) return;
          if (updatedAt) this._sm._clubUpdatedAt = updatedAt;
          if (this.editorOpen() || !this._sm.applyClubPayload) {
            this._sm._clubDirty = false;
            return;
          }
          try {
            const now = this._sm.buildExportPayload ? this._sm.buildExportPayload() : null;
            if (now && this.same(now, slim)) return;
            this._sm.applyClubPayload({
              updatedAt: updatedAt || new Date().toISOString(),
              updatedBy: 'supabase',
              payload: slim
            }, { force: true, quiet: true, replace: true });
            this._sm._clubDirty = false;
          } catch (_) {}
        };
        const fits = JSON.stringify(slim).length <= this.ROW_LIMIT;
        const placed = fits ? !remote.path : remote.path === 'state/current.json';
        if (remote.payload && this.same(remote.payload, slim) && placed) {
          this.paintUrls(off.map);
          remember(remote.updated_at);
          this._line('Клуб на сервері');
          if (stillMine()) this._sm._clubDirty = false;
          else this._again = true;
          if (remote.updated_at) this._sm._clubUpdatedAt = remote.updated_at;
          return true;
        }
        const rev = remote.empty ? 0 : (remote.rev || 0);
        const wrote = await this.commit(slim, rev, !remote.empty);
        if (wrote === 'conflict') continue;
        if (wrote !== true) {
          this._line('Не вдалося викласти клуб на сервер');
          return false;
        }
        this.paintUrls(off.map);
        this.releaseLocalBlobs();
        remember(this._pendingAt);
        if (stillMine()) this._sm._clubDirty = false;
        else this._again = true;
        if (this._pendingAt) this._sm._clubUpdatedAt = this._pendingAt;
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

  async submitApproval(approval) {
    if (!this.enabled() || !approval || !approval.id) return false;
    if (this._pushing) {
      setTimeout(() => { this.submitApproval(approval).catch(() => {}); }, 800);
      return false;
    }
    this._pushing = true;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const remote = await this.fetchRemote();
        if (!remote || remote.error || remote.missing) return false;
        const payload = remote.payload ? JSON.parse(JSON.stringify(remote.payload)) : {};
        if (!payload.settings || typeof payload.settings !== 'object') payload.settings = {};
        const gone = new Set((payload.settings.removedApprovalIds || []).map(id => String(id || '')));
        if (gone.has(String(approval.id))) return true;
        const list = Array.isArray(payload.settings.approvals) ? payload.settings.approvals.slice() : [];
        const at = list.findIndex(item => item && String(item.id) === String(approval.id));
        if (at >= 0) list[at] = approval;
        else list.push(approval);
        payload.settings.approvals = list.slice(-40);
        const wrote = await this.commit(payload, remote.empty ? 0 : (remote.rev || 0), !remote.empty);
        if (wrote === 'conflict') continue;
        if (wrote === true && this._pendingAt && this._sm) this._sm._clubUpdatedAt = this._pendingAt;
        return wrote === true;
      }
      return false;
    } catch (_) {
      return false;
    } finally {
      this._pushing = false;
    }
  },

  async commit(payload, rev, exists) {
    const next = (Number(rev) || 0) + 1;
    const text = JSON.stringify(payload);
    const fits = text.length <= this.ROW_LIMIT;
    const path = fits ? null : 'state/current.json';
    const fileOk = path ? await this.upload(path, text, 'application/json') : true;
    const body = {
      id: 'metalist',
      rev: next,
      updated_at: new Date().toISOString(),
      updated_by: this._who(),
      path: path,
      payload: fits ? payload : null
    };
    if (!fileOk) return false;
    this._pendingAt = body.updated_at;
    if (!exists) {
      const res = await fetch(this.URL + '/rest/v1/club_state', {
        method: 'POST',
        headers: this.headers({ Prefer: 'return=representation' }),
        body: JSON.stringify(body)
      });
      if (res.status === 409) return 'conflict';
      if (!res.ok) return false;
      const rows = await res.json().catch(() => []);
      if (!Array.isArray(rows) || !rows.length) return 'conflict';
      return true;
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

  async listFolder(folder) {
    const names = [];
    for (let offset = 0; offset < 20000; offset += 100) {
      const res = await fetch(this.URL + '/storage/v1/object/list/club-media', {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ prefix: folder, limit: 100, offset: offset, sortBy: { column: 'name', order: 'asc' } })
      });
      if (!res.ok) return null;
      const rows = await res.json().catch(() => null);
      if (!Array.isArray(rows)) return null;
      let fresh = 0;
      rows.forEach(row => {
        if (!row || row.id == null || !row.name || String(row.name).indexOf('.') < 0) return;
        const raw = String(row.name).replace(/^\/+/, '');
        const path = raw.indexOf(folder + '/') === 0 ? raw : (folder + '/' + raw);
        if (names.indexOf(path) >= 0) return;
        names.push(path);
        fresh++;
      });
      if (!fresh || rows.length < 100) break;
    }
    return names;
  },

  async removePaths(paths) {
    const todo = (paths || []).filter(Boolean);
    for (let i = 0; i < todo.length; i += 100) {
      const chunk = todo.slice(i, i + 100);
      const res = await fetch(this.URL + '/storage/v1/object/club-media', {
        method: 'DELETE',
        headers: this.headers(),
        body: JSON.stringify({ prefixes: chunk })
      });
      if (!res.ok) return false;
    }
    return true;
  },

  usedMedia(payload) {
    const keep = new Set();
    this._walk(payload, (value) => {
      const text = String(value || '');
      const mark = '/club-media/';
      const at = text.indexOf(mark);
      if (at < 0) return;
      let name = text.slice(at + mark.length).split('?')[0].split('#')[0];
      try { name = decodeURIComponent(name); } catch (_) {}
      if (name && name.indexOf('..') < 0) keep.add(name);
    });
    return keep;
  },

  _sizeText(bytes) {
    const value = Math.max(0, Number(bytes) || 0);
    const num = (n, digits) => {
      const p = Math.pow(10, digits);
      return String(Math.round(n * p) / p).replace('.', ',');
    };
    if (value < 1000) return value + ' Б';
    if (value < 1000000) return num(value / 1000, 0) + ' КБ';
    if (value < 1000000000) return num(value / 1000000, 1) + ' МБ';
    return num(value / 1000000000, 2) + ' ГБ';
  },

  async serverStats() {
    if (!this.enabled()) return null;
    try {
      const res = await fetch(this.URL + '/rest/v1/rpc/club_server_stats', {
        method: 'POST',
        headers: this.headers(),
        body: '{}'
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && typeof data === 'object' && !Array.isArray(data) && data.files != null) {
          return {
            source: 'database',
            files: Number(data.files) || 0,
            bytes: Number(data.bytes) || 0,
            dbBytes: data.db_bytes == null ? null : (Number(data.db_bytes) || 0)
          };
        }
      }
    } catch (_) {}
    const files = await this.inventory();
    if (!files) return null;
    return {
      source: 'list',
      files: files.length,
      bytes: files.reduce((sum, file) => sum + (Number(file.size) || 0), 0),
      dbBytes: null
    };
  },

  async _fetchObject(path) {
    const safe = String(path || '').replace(/^\/+/, '').split('/').map(part => {
      try { return encodeURIComponent(decodeURIComponent(part)); } catch (_) { return encodeURIComponent(part); }
    }).join('/');
    if (!safe) return null;
    const urls = [
      this.URL + '/storage/v1/object/public/club-media/' + safe,
      this.URL + '/storage/v1/object/club-media/' + safe
    ];
    for (let i = 0; i < urls.length; i++) {
      try {
        const res = await fetch(urls[i], i === 0 ? undefined : {
          headers: this.headers({ Accept: '*/*' }, { json: false })
        });
        if (res && res.ok) return res;
      } catch (_) {}
    }
    return null;
  },

  async _dataUrl(blob) {
    if (!blob || typeof FileReader === 'undefined') return '';
    try {
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => resolve('');
        try { reader.readAsDataURL(blob); } catch (_) { resolve(''); }
      });
    } catch (_) {
      return '';
    }
  },

  /** Копія клубу з фото всередині і файли, які треба повернути після очищення. */
  async collectRestore(payload) {
    let backup = payload || {};
    try { backup = JSON.parse(JSON.stringify(payload || {})); } catch (_) {}
    const jobs = [];
    this._walk(backup, (value) => {
      const path = this._mediaPath(value);
      if (path && jobs.indexOf(path) < 0) jobs.push(path);
    });
    const files = [];
    const missing = [];
    const inline = new Map();
    for (let i = 0; i < jobs.length; i++) {
      const path = jobs[i];
      let res = null;
      try { res = await this._fetchObject(path); } catch (_) { res = null; }
      if (!res || !res.ok || typeof res.blob !== 'function') {
        missing.push(path);
        continue;
      }
      let blob = null;
      try { blob = await res.blob(); } catch (_) { blob = null; }
      if (!blob) {
        missing.push(path);
        continue;
      }
      if (blob.size > 180 * 1024) {
        const small = await this._shrinkBlob(blob, 960, 0.66);
        if (small && small.size < blob.size) blob = small;
      }
      files.push({ path: path, body: blob, type: blob.type || 'application/octet-stream' });
      if (blob.size <= 2500000 && String(blob.type || '').indexOf('image/') === 0) {
        const data = await this._dataUrl(blob);
        if (data) inline.set(path, data);
      }
    }
    if (inline.size) {
      this._walk(backup, (value, set) => {
        const path = this._mediaPath(value);
        if (path && inline.has(path)) set(inline.get(path));
      });
    }
    return { backup: backup, files: files, missing: missing };
  },

  async wipeAndRestore(files, keepPaths) {
    if (this._wiping) return false;
    this._wiping = true;
    const hold = new Set((keepPaths || []).filter(Boolean));
    try {
      for (let pass = 0; pass < 8; pass++) {
        const listed = await this.inventory();
        if (!listed) return false;
        const drop = listed.map(file => file && file.path).filter(path => path && !hold.has(path));
        if (!drop.length) break;
        const ok = await this.removePaths(drop);
        if (!ok) return false;
        if (drop.length < 20000) break;
      }
      const back = files || [];
      for (let i = 0; i < back.length; i++) {
        const file = back[i];
        if (!file || !file.path) continue;
        const ok = await this.upload(file.path, file.body, file.type || 'application/octet-stream');
        if (!ok) return false;
      }
      return true;
    } finally {
      this._wiping = false;
    }
  },

  async sweep(keepPath, payload) {
    try {
      if (this._rebuilding && !this._allowPush) return 0;
      if (!payload) return 0;
      const keep = this.usedMedia(payload);
      if (keepPath) keep.add(String(keepPath));
      const files = await this.inventory();
      if (!files) {
        this._line('Не вдалося прочитати сховище.');
        return 0;
      }
      const drop = [];
      let bytes = 0;
      files.forEach(file => {
        if (!file || !file.path || keep.has(file.path)) return;
        drop.push(file.path);
        bytes += Number(file.size) || 0;
      });
      if (!drop.length) {
        this._line('Зайвих файлів немає.');
        return 0;
      }
      const ok = await this.removePaths(drop);
      if (!ok) return 0;
      const mb = bytes ? (' (' + Math.max(1, Math.round(bytes / 1048576)) + ' МБ)') : '';
      const text = 'Прибрав ' + drop.length + ' зайвих файлів зі сховища' + mb + '.';
      this._line(text);
      try { if (typeof Toast !== 'undefined' && Toast.show) Toast.show(text, 'ok'); } catch (_) {}
      return drop.length;
    } catch (_) { return 0; }
  },

  async inventory() {
    const files = [];
    const seenFolders = new Set();
    const walk = async (folder) => {
      const mark = folder || '';
      if (seenFolders.has(mark)) return true;
      seenFolders.add(mark);
      const rows = await this.listRaw(folder);
      if (!rows) return false;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row.name) continue;
        const raw = String(row.name).replace(/^\/+/, '');
        const path = !folder ? raw : (raw.indexOf(folder + '/') === 0 ? raw : (folder + '/' + raw));
        if (row.id == null) {
          await walk(path);
          continue;
        }
        if (path.indexOf('.') < 0) continue;
        const meta = row.metadata || {};
        files.push({
          path: path,
          size: Number(meta.size || meta.contentLength || 0) || 0,
          type: String(meta.mimetype || '')
        });
      }
      return true;
    };
    const ok = await walk('');
    return ok ? files : null;
  },

  async sweepRest(keepPath, keep) {
    const rows = await this.listRaw('');
    if (!rows) return 0;
    const extra = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row.name) continue;
      const name = String(row.name).replace(/^\/+/, '');
      if (row.id == null) {
        if (name === 'media' || name === 'state') continue;
        const nested = await this.listFolder(name);
        if (nested) nested.forEach(path => {
          if (path !== keepPath && !keep.has(path)) extra.push(path);
        });
      } else if (name.indexOf('.') >= 0 && name !== keepPath && !keep.has(name)) {
        extra.push(name);
      }
    }
    if (!extra.length) return 0;
    const ok = await this.removePaths(extra);
    return ok ? extra.length : 0;
  },

  async listRaw(folder) {
    const rows = [];
    const seen = new Set();
    for (let offset = 0; offset < 20000; offset += 100) {
      const res = await fetch(this.URL + '/storage/v1/object/list/club-media', {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ prefix: folder, limit: 100, offset: offset, sortBy: { column: 'name', order: 'asc' } })
      });
      if (!res.ok) return null;
      const page = await res.json().catch(() => null);
      if (!Array.isArray(page)) return null;
      let fresh = 0;
      page.forEach(row => {
        if (!row) return;
        const key = String(row.id || '') + '|' + String(row.name || '');
        if (seen.has(key)) return;
        seen.add(key);
        rows.push(row);
        fresh++;
      });
      if (!fresh || page.length < 100) break;
    }
    return rows;
  },

  withoutInline(payload) {
    const copy = JSON.parse(JSON.stringify(payload || {}));
    this._walk(copy, (value, set) => {
      if (typeof value === 'string' && value.indexOf('data:') === 0 && value.length > 200) set('');
    });
    return copy;
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
      }
    }
    return { payload: copy, map: map };
  },

  async uploadData(dataUrl) {
    let blob = this._blob(dataUrl);
    if (!blob) return '';
    if (blob.size > 180 * 1024) {
      const small = await this._shrinkBlob(blob, 960, 0.66);
      if (small && small.size < blob.size) blob = small;
    }
    const path = 'media/' + this._hash(dataUrl) + '.' + this._ext(blob.type);
    const ok = await this.upload(path, blob, blob.type || 'application/octet-stream');
    if (!ok) return '';
    return this.URL + '/storage/v1/object/public/club-media/' + path;
  },

  _mediaPath(url) {
    const text = String(url || '');
    const mark = '/club-media/';
    const at = text.indexOf(mark);
    if (at < 0) return '';
    let name = text.slice(at + mark.length).split('?')[0].split('#')[0];
    try { name = decodeURIComponent(name); } catch (_) {}
    if (!name || name.indexOf('..') >= 0) return '';
    return name;
  },

  /** Важкі фото на сервері замінюються легшою копією. Старий файл потім зникає як зайвий. */
  async slimStored(payload) {
    if (!payload || typeof document === 'undefined') return 0;
    const found = [];
    this._walk(payload, (value) => {
      const text = String(value || '').split('#')[0];
      if (text.indexOf('/club-media/') >= 0 && found.indexOf(text) < 0) found.push(text);
    });
    const replace = new Map();
    let done = 0;
    for (let i = 0; i < found.length && done < 40; i++) {
      const url = found[i];
      const path = this._mediaPath(url);
      if (!path || path.indexOf('media/') !== 0) continue;
      if (this._fresh && this._fresh.has(path)) continue;
      if (this._slimDone && this._slimDone.has(path)) continue;
      this._slimDone = this._slimDone || new Set();
      let size = 0;
      let kind = '';
      try {
        const head = await fetch(url, { method: 'HEAD' });
        if (head.ok) {
          size = Number(head.headers.get('content-length') || 0);
          kind = String(head.headers.get('content-type') || '');
        }
      } catch (_) {}
      if (!size || size < 160 * 1024 || kind.indexOf('image/') !== 0 || kind.indexOf('gif') >= 0) {
        if (size || kind) this._slimDone.add(path);
        continue;
      }
      let blob = null;
      try {
        const res = await fetch(url);
        if (res.ok) blob = await res.blob();
      } catch (_) {}
      const small = blob ? await this._shrinkBlob(blob, 960, 0.66) : null;
      if (!small || small.size >= size * 0.85) {
        this._slimDone.add(path);
        continue;
      }
      const nextPath = 'media/s' + this._hash(path + '|' + String(small.size)) + '.jpg';
      let storedPath = nextPath;
      let ok = await this.upload(nextPath, small, 'image/jpeg');
      if (!ok && this._lastUploadStatus === 413 && /\.jpe?g$/i.test(path)) {
        ok = await this.upload(path, small, 'image/jpeg');
        storedPath = path;
      }
      if (!ok) continue;
      if (storedPath !== path) replace.set(url, this.URL + '/storage/v1/object/public/club-media/' + storedPath);
      this._slimDone.add(path);
      done++;
    }
    if (!replace.size) return 0;
    this._walk(payload, (value, set) => {
      const text = String(value || '').split('#')[0];
      if (replace.has(text)) set(replace.get(text));
    });
    this._line('Важкі фото стиснуті. Зайве зі сховища прибирається.');
    try { if (typeof Toast !== 'undefined' && Toast.show) Toast.show('Важкі фото стиснуті', 'ok'); } catch (_) {}
    return done;
  },

  async _shrinkBlob(blob, maxSide, quality) {
    if (!blob || typeof document === 'undefined' || typeof createImageBitmap !== 'function') return null;
    const type = String(blob.type || '');
    if (type.indexOf('image/') !== 0 || type.indexOf('gif') >= 0) return null;
    let bmp = null;
    try {
      bmp = await createImageBitmap(blob);
      const longest = Math.max(bmp.width || 1, bmp.height || 1);
      const scale = Math.min(1, maxSide / longest);
      const w = Math.max(1, Math.round((bmp.width || 1) * scale));
      const h = Math.max(1, Math.round((bmp.height || 1) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(bmp, 0, 0, w, h);
      const out = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      return out || null;
    } catch (_) {
      return null;
    } finally {
      try { if (bmp && bmp.close) bmp.close(); } catch (_) {}
    }
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
