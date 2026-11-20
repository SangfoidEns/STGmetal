/**
 * Shared club snapshot on Supabase (replaces passing a JSON file).
 * Key is stored only in this browser: localStorage metalist_supabase_key.
 */
const SupabaseClub = {
  URL: 'https://zloluzqzswdwaimlqlqx.supabase.co',
  ROW: 'metalist',

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

  async fetchClub() {
    if (!this.enabled()) return { empty: true };
    try {
      const res = await fetch(
        this.url() + '/rest/v1/club_state?id=eq.' + encodeURIComponent(this.ROW) + '&select=updated_at,updated_by,payload',
        { headers: { apikey: this.key(), Authorization: 'Bearer ' + this.key() }, cache: 'no-store' }
      );
      if (!res.ok) return { error: true };
      const rows = await res.json();
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row || !row.payload) return { empty: true };
      return {
        updatedAt: row.updated_at,
        updatedBy: row.updated_by || 'supabase',
        payload: row.payload
      };
    } catch (_) {
      return { error: true };
    }
  },

  async pushRecord(record) {
    const res = await fetch(this.url() + '/rest/v1/club_state?on_conflict=id', {
      method: 'POST',
      headers: {
        apikey: this.key(),
        Authorization: 'Bearer ' + this.key(),
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify({
        id: this.ROW,
        updated_at: record.updatedAt,
        updated_by: record.updatedBy || 'mini-app',
        payload: record.payload
      })
    });
    return res;
  }
};
