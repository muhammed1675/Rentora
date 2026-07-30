import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);

const parseAuthError = (error) => {
  if (!error) return 'Something went wrong. Please try again.';
  const msg = (error.message || error.toString()).toLowerCase();
  if (msg.includes('body stream') || msg.includes('json') || msg.includes('already read'))
    return 'Wrong email or password. Please try again.';
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch'))
    return 'Network error. Please check your connection and try again.';
  if (msg.includes('invalid login credentials') || msg.includes('invalid email or password'))
    return 'Wrong email or password. Please try again.';
  if (msg.includes('user not found') || msg.includes('no user found'))
    return 'No account found with this email. Please register first.';
  if (msg.includes('email not confirmed'))
    return 'Please confirm your email first. Check your inbox.';
  if (msg.includes('email already') || msg.includes('already registered'))
    return 'An account with this email already exists. Please login instead.';
  if (msg.includes('password') && msg.includes('short'))
    return 'Password must be at least 6 characters.';
  if (msg.includes('too many requests') || msg.includes('rate limit'))
    return 'Too many attempts. Please wait a moment and try again.';
  if (msg.includes('signup is disabled'))
    return 'New registrations are currently disabled. Contact support.';
  if (error.message && error.message.length < 100 && !error.message.includes('fetch'))
    return error.message;
  return 'Something went wrong. Please try again.';
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUserProfile = useCallback(async (authUser, retries = 3) => {
    if (!authUser?.id) return null;

    for (let i = 0; i < retries; i++) {
      try {
        if (i > 0) await new Promise(r => setTimeout(r, 1000 * i));

        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (error && error.code === 'PGRST116') {
          const { data: created } = await supabase
            .from('users')
            .insert({
              id: authUser.id,
              email: authUser.email,
              full_name: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
              avatar_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null,
              role: 'user',
              suspended: false
            })
            .select()
            .single();

          await supabase.from('wallets').insert({ user_id: authUser.id, token_balance: 0 });
          return created ? { ...created, token_balance: 0 } : null;
        }

        if (error) {
          console.warn(`Profile load attempt ${i + 1} failed:`, error.message);
          continue;
        }

        const { data: wallet } = await supabase
          .from('wallets')
          .select('token_balance')
          .eq('user_id', authUser.id)
          .single();

        return { ...data, token_balance: wallet?.token_balance || 0 };

      } catch (err) {
        console.warn(`Profile load attempt ${i + 1} exception:`, err.message);
      }
    }

    return null;
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
        const profile = await loadUserProfile(s.user);
        if (mounted && profile) {
          if (profile.suspended) {
            await supabase.auth.signOut();
            setUser(null);
            setSession(null);
          } else {
            setUser(profile);
          }
        }
      }
      if (mounted) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      if (!s) { setUser(null); setLoading(false); }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [loadUserProfile]);

  // ── Login ────────────────────────────────────────────────────
  const login = async (email, password) => {
    setLoading(true);
    try {
      let data, error;

      try {
        const result = await supabase.auth.signInWithPassword({ email, password });
        data = result.data;
        error = result.error;
      } catch (fetchErr) {
        throw new Error(parseAuthError(fetchErr));
      }

      if (error) {
        throw new Error(parseAuthError(error));
      }

      await new Promise(r => setTimeout(r, 800));

      const profile = await loadUserProfile(data.user);

      if (!profile) {
        const { data: found } = await supabase
          .from('users')
          .select('*')
          .eq('email', data.user.email)
          .single();

        if (found) {
          if (found.suspended) {
            await supabase.auth.signOut();
            throw new Error('Your account has been suspended. Please contact support for assistance.');
          }
          const { data: wallet } = await supabase
            .from('wallets')
            .select('token_balance')
            .eq('user_id', found.id)
            .single();
          const fullProfile = { ...found, token_balance: wallet?.token_balance || 0 };
          setUser(fullProfile);
          setSession(data.session);
          return fullProfile;
        }

        throw new Error('Could not load your profile. Please try again in a moment.');
      }

      if (profile.suspended) {
        await supabase.auth.signOut();
        throw new Error('Your account has been suspended. Please contact support for assistance.');
      }

      setUser(profile);
      setSession(data.session);

      // Send sign-in notification email (non-blocking)
      try {
        const ip = await fetch('https://api.ipify.org?format=json')
          .then(r => r.json()).then(d => d.ip).catch(() => 'Unknown');
        const geo = await fetch(`https://ipapi.co/${ip}/json/`)
          .then(r => r.json()).catch(() => ({}));
        const location = geo.city && geo.country_name
          ? `${geo.city}, ${geo.country_name}`
          : geo.country_name || 'Unknown';
        const device = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent)
          ? 'Mobile Device' : 'Desktop / Laptop';
        const time = new Date().toLocaleString('en-NG', {
          dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos'
        });
        const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || '';
        const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
        await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            type: 'sign_in',
            to: profile.email,
            data: { name: profile.full_name, ip, location, device, time }
          }),
        });
      } catch (e) {
        console.warn('Sign-in email failed (non-critical):', e.message);
      }

      return profile;
    } finally {
      setLoading(false);
    }
  };

  // ── Register ─────────────────────────────────────────────────
  const register = async (email, password, fullName, phone = '') => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName, phone } }
      });

      if (error) throw new Error(parseAuthError(error));
      if (!data.session) return { requiresConfirmation: true };

      await new Promise(r => setTimeout(r, 1000));
      const profile = await loadUserProfile(data.user);

      // Save phone to users table
      if (phone && data.user) {
        await supabase
          .from('users')
          .update({ phone })
          .eq('id', data.user.id);
      }

      setUser(profile);
      setSession(data.session);

      // Send welcome email (non-blocking)
      try {
        const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || '';
        const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
        await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            type: 'welcome',
            to: email,
            data: { name: profile?.full_name || fullName }
          }),
        });
      } catch (e) {
        console.warn('Welcome email failed (non-critical):', e.message);
      }

      return profile;
    } catch (err) {
      if (err.message && err.message.length < 120) throw err;
      throw new Error(parseAuthError(err));
    }
  };

  // ── Google OAuth: kick off redirect to Google ───────────────
  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) throw new Error(parseAuthError(error));
  };

  // ── Google OAuth: finish sign-in after redirect back from Google ──
  // Called from the /auth/callback page. This project uses Supabase's
  // implicit flow (same as the password-reset link in ResetPassword.jsx),
  // so Google/Supabase send the user back with tokens in the URL HASH
  // (e.g. #access_token=...&refresh_token=...), not a `?code=` query param.
  const completeOAuthSignIn = async () => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace('#', ''));

    const errorDescription = params.get('error_description') || params.get('error');
    if (errorDescription) {
      throw new Error(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
    }

    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken) {
      throw new Error('No sign-in credentials found in the URL.');
    }

    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || '',
    });
    if (error) throw new Error(parseAuthError(error));

    window.history.replaceState(null, '', window.location.pathname);

    const authUser = data?.session?.user;
    if (!authUser) throw new Error('Could not complete sign-in. Please try again.');

    const isBrandNewUser = authUser.created_at &&
      (Date.now() - new Date(authUser.created_at).getTime()) < 60000;

    const profile = await loadUserProfile(authUser);
    if (!profile) throw new Error('Could not load your profile. Please try again.');

    if (profile.suspended) {
      await supabase.auth.signOut();
      throw new Error('Your account has been suspended. Please contact support for assistance.');
    }

    setUser(profile);
    setSession(data.session);

    // Send a welcome email for genuinely new sign-ups (non-blocking)
    if (isBrandNewUser) {
      try {
        const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || '';
        const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
        await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            type: 'welcome',
            to: profile.email,
            data: { name: profile.full_name },
          }),
        });
      } catch (e) {
        console.warn('Welcome email failed (non-critical):', e.message);
      }
    }

    return profile;
  };

  // ── Delete account ───────────────────────────────────────────
  // Calls the delete-account edge function with the user's own access
  // token. The function blocks deletion if money/obligations are still
  // unresolved (see supabase/functions/delete-account for the checks).
  const deleteAccount = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const accessToken = currentSession?.access_token;
    if (!accessToken) throw new Error('Your session has expired. Please log in again.');

    const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || '';
    const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.success) {
      throw new Error(result.message || 'Failed to delete account. Please try again or contact support.');
    }

    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    return true;
  };

  // ── Logout ───────────────────────────────────────────────────
  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  // ── Request password reset email ────────────────────────────
  // Sends a recovery email containing BOTH a link (to /reset-password,
  // handled by ResetPassword.jsx) AND a 6-digit code the user can paste
  // into the "forgot password" dialog instead (see confirmPasswordResetWithCode).
  // Requires the Supabase "Reset Password" email template to include
  // {{ .Token }} alongside {{ .ConfirmationURL }}.
  const requestPasswordReset = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw new Error(parseAuthError(error));
  };

  // ── Change password (already logged in) ─────────────────────
  const changePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(parseAuthError(error));
  };

  // ── Confirm password reset using a 6-digit code (alternative to the
  // email link — same recovery email, user pastes the code instead) ──
  const confirmPasswordResetWithCode = async (email, code, newPassword) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'recovery',
    });
    if (error) throw new Error(parseAuthError(error));

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) throw new Error(parseAuthError(updateError));

    // verifyOtp logs the user in — reflect that in app state right away.
    const authUser = data?.session?.user;
    if (authUser) {
      const profile = await loadUserProfile(authUser);
      if (profile) {
        setUser(profile);
        setSession(data.session);
      }
    }
  };

  // ── Refresh user ─────────────────────────────────────────────
  const refreshUser = async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (s?.user) {
      const profile = await loadUserProfile(s.user);
      if (profile) {
        if (profile.suspended) {
          await supabase.auth.signOut();
          setUser(null);
          setSession(null);
        } else {
          setUser(profile);
        }
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      user, session, loading,
      login, register, logout, refreshUser, requestPasswordReset, changePassword,
      loginWithGoogle, completeOAuthSignIn, confirmPasswordResetWithCode, deleteAccount,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      isAgent: user?.role === 'agent',
      isUser: user?.role === 'user',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export default AuthContext;