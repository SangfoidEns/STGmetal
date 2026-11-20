/**
 * Club snapshot via Supabase RPCs. The anon key only opens PostgREST.
 * Reads and writes are rejected unless Telegram initData (or the coach
 * club key, which this browser never stores) passes the SQL gate.
 */
const SupabaseClub = {
  URL: 'https://zloluzqzswdwaimlqlqx.supabase.co',

  url() {
    try {
      const custom = window.METALIST_SUPABASE_URL;
      if (custom) return String(custom).replace(/\/+$/, '');
    } catch (_) {}
    return this.URL;
  },

  key() {
    try {
      const inline = window.METALIST_SUPABASE_KEY;
      if (inline && String(inline).trim().length >= 20) return String(inline).trim();
      return String(localStorage.getItem('metalist_supabase_key') || '').trim();
    } catch (_) { return ''; }
  },

  enabled() {
    return this.key().length >= 20;
  },

  saveKey(value) {
    const key = String(value || '').trim();
    localStorage.setItem('metalist_supabase_key', key);
    return key.length >= 20;
  },

  initData() {
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      return tg && tg.initData ? String(tg.initData) : '';
    } catch (_) { return ''; }
  },

  async rpc(name, args) {
    return fetch(this.url() + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: {
        apikey: this.key(),
        Authorization: 'Bearer ' + this.key(),
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(args)
    });
  },

  async fetchClub() {
    if (!this.enabled()) return { empty: true };
    try {
      const res = await this.rpc('club_pull', { init_data: this.initData(), club_key: null });
      if (!res.ok) return { error: true };
      const row = await res.json();
      if (!row || row.empty || !row.payload) return { empty: true };
      return {
        updatedAt: row.updatedAt || row.updated_at,
        updatedBy: row.updatedBy || row.updated_by || 'supabase',
        payload: row.payload
      };
    } catch (_) {
      return { error: true };
    }
  },

  async pushRecord(record) {
    return this.rpc('club_push', {
      payload: record.payload,
      updated_at: record.updatedAt,
      updated_by: record.updatedBy || 'mini-app',
      init_data: record.initData || this.initData(),
      club_key: null
    });
  }
};
