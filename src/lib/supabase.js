import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase env vars missing!');
}

let instance = null;

export const supabase = (() => {
  if (instance) return instance;
  instance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // We handle the reset token manually in ResetPassword.jsx
    }
  });
  return instance;
})();

export default supabase;
