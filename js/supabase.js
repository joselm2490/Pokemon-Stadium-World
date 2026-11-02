// ====================================================================
// CLIENTE SUPABASE OFICIAL (FRONTEND WEB BROWSER)
// ====================================================================

const SUPABASE_PROJECT_URL = 'https://kxsyygajkghokcyxavhe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gz3oSIkDrPk07nVYV9dvBA_ACKfEQ5B';

// Cliente global accesible en window.StadiumSupabase
let stadiumSupabaseClient = null;

if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
  stadiumSupabaseClient = window.supabase.createClient(SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY);
}

window.StadiumSupabase = {
  url: SUPABASE_PROJECT_URL,
  key: SUPABASE_ANON_KEY,
  client: stadiumSupabaseClient,
  getClient() {
    if (!this.client && window.supabase && typeof window.supabase.createClient === 'function') {
      this.client = window.supabase.createClient(this.url, this.key);
    }
    return this.client;
  }
};
