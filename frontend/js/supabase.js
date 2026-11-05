// ====================================================================
// CLIENTE SUPABASE OFICIAL (FRONTEND WEB BROWSER)
// ====================================================================

const SUPABASE_PROJECT_URL = 'https://kxsyygajkghokcyxavhe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gz3oSIkDrPk07nVYV9dvBA_ACKfEQ5B';

window.StadiumSupabase = {
  url: SUPABASE_PROJECT_URL,
  key: SUPABASE_ANON_KEY,

  async request(endpoint, options = {}) {
    const url = `${this.url}/rest/v1/${endpoint}`;
    const headers = {
      'apikey': this.key,
      'Authorization': `Bearer ${this.key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    try {
      const resp = await fetch(url, { ...options, headers });
      if (!resp.ok) {
        let errBody = null;
        try { errBody = await resp.json(); } catch(e) {}
        return { ok: false, status: resp.status, error: errBody };
      }
      if (resp.status === 204) {
        return { ok: true, data: null };
      }
      const data = await resp.json();
      return { ok: true, data };
    } catch (err) {
      console.error('Supabase fetch error:', err);
      return { ok: false, error: err.message };
    }
  }
};
