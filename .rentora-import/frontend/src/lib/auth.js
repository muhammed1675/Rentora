import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { enforceRateLimit, clearRateLimit } from './rateLimit';
import { notifyUser } from './notifications';

const AuthContext = createContext(null);

// Calls the send-email edge function with a real user access token (not the
// public anon key) so the function can verify a genuine account is behind
// the request — see supabase/functions/send-email/index.ts.
const sendTransactionalEmail = async (accessToken, payload) => {
  const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
  const token = accessToken || SUPABASE_ANON_KEY;
  return fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
};

const parseAuthError = (error) => {
  if (!error) return 'Something went wrong. Please try again.';
  const msg = (error.message || error.toString()).toLowerCase();
  if (msg.includes('body stream') || msg.includes('json') || msg.includes('already read'))
    return 'Something went wrong. Please try again.';
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch'))
    return 'Network error. Please check your connection and try again.';
  if (msg.includes('token has expired') || msg.includes('otp_expired') || msg.includes('token is invalid'))
    return 'That code is incorrect or has expired. Please request a new one.';
  if (msg.includes('user not found') || msg.includes('no user found') || msg.includes('signups not allowed'))
    return 'No account found with this email. Please create an account first.';
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
              phone: authUser.user_metadata?.phone || null,
              avatar_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null,
              role: 'user',
              suspended: false
            })
            .select()
            .single();

          return created || null;
        }

        if (error) {
          console.warn(`Profile load attempt ${i + 1} failed:`, error.message);
          continue;
        }

        return data;

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

  // ── OTP: request a 6-digit code ─────────────────────────────
  // isNewAccount=true (signup): creates the auth user if it doesn't
  //   exist yet; if the email is already registered, Supabase just
  //   sends a login code for the existing account instead — no error,
  //   no enumeration signal either way.
  // isNewAccount=false (login): does NOT create an account. If the
  //   email isn't registered, Supabase returns an error and we surface
  //   "No account found" — this is an intentional product decision
  //   (so people know to sign up instead of guessing forever), not an
  //   accidental leak, and it no longer involves a separate query
  //   against the world-readable users table to determine it.
  const requestOtpCode = async (email, { isNewAccount = false, fullName, phone } = {}) => {
    await enforceRateLimit(email, 'otp_request');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: isNewAccount,
        ...(isNewAccount ? { data: { full_name: fullName, phone } } : {}),
      },
    });
    if (error) throw new Error(parseAuthError(error));
  };

  // ── OTP: verify the 6-digit code and complete sign-in ──────
  const verifyOtpCode = async (email, code) => {
    setLoading(true);
    try {
      await enforceRateLimit(email, 'otp_verify');

      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: 'email',
      });
      if (error) throw new Error(parseAuthError(error));

      const authUser = data?.user;
      if (!authUser) throw new Error('Could not complete sign-in. Please try again.');

      const isBrandNewUser = authUser.created_at &&
        (Date.now() - new Date(authUser.created_at).getTime()) < 60000;

      const profile = await loadUserProfile(authUser);
      if (!profile) throw new Error('Could not load your profile. Please try again in a moment.');

      if (profile.suspended) {
        await supabase.auth.signOut();
        throw new Error('Your account has been suspended. Please contact support for assistance.');
      }

      setUser(profile);
      setSession(data.session);

      // Successful verification — clear rate-limit counters for this email.
      clearRateLimit(email, 'otp_verify');
      clearRateLimit(email, 'otp_request');

      const accessToken = data.session?.access_token;

      if (isBrandNewUser) {
        // Send welcome email (non-blocking)
        try {
          await sendTransactionalEmail(accessToken, {
            type: 'welcome',
            to: profile.email,
            data: { name: profile.full_name },
          });
        } catch (e) {
          console.warn('Welcome email failed (non-critical):', e.message);
        }

        notifyUser(profile.id, 'welcome', 'Welcome to Rentora!', 'Your account is ready — start browsing verified listings.', '/browse');
      } else {
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
          await sendTransactionalEmail(accessToken, {
            type: 'sign_in',
            to: profile.email,
            data: { name: profile.full_name, ip, location, device, time }
          });
        } catch (e) {
          console.warn('Sign-in email failed (non-critical):', e.message);
        }
      }

      return { ...profile, _isNewUser: isBrandNewUser };
    } finally {
      setLoading(false);
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
  // implicit flow, so Google/Supabase send the user back with tokens in
  // the URL HASH (e.g. #access_token=...&refresh_token=...), not a
  // `?code=` query param.
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
        await sendTransactionalEmail(data.session?.access_token, {
          type: 'welcome',
          to: profile.email,
          data: { name: profile.full_name },
        });
      } catch (e) {
        console.warn('Welcome email failed (non-critical):', e.message);
      }

      notifyUser(profile.id, 'welcome', 'Welcome to Rentora!', 'Your account is ready — start browsing verified listings.', '/browse');
    }

    return { ...profile, _isNewUser: isBrandNewUser };
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
      requestOtpCode, verifyOtpCode, logout, refreshUser,
      loginWithGoogle, completeOAuthSignIn, deleteAccount,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      isAgent: user?.role === 'agent',
      isUser: user?.role === 'user',
      // Student verification (school document + selfie). Agents and admins
      // use the separate agent verification flow, so they are never gated.
      verificationStatus: user?.verification_status || 'none',
      isVerifiedStudent: user?.role !== 'user' || user?.verification_status === 'approved',
      isVerifiedAgent: user?.role === 'agent' || user?.role === 'admin',
      needsVerification: !!user && user?.role === 'user' && user?.verification_status !== 'approved',
      // Action-time gates (see components/VerifyGateDialog.jsx). Reads and
      // browsing are never gated — only these specific actions are.
      canPay: user?.role !== 'user' || user?.verification_status === 'approved',
      canUnlock: user?.role !== 'user' || ['approved', 'pending'].includes(user?.verification_status),

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
