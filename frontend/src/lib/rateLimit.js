// lib/rateLimit.js
//
// Thin wrapper around the check_rate_limit / reset_rate_limit Postgres
// functions (see supabase/schema/07_notifications_and_rate_limiting.sql).
// No CAPTCHA — just attempt-count + cooldown, enforced in the database
// so it can't be bypassed by calling supabase.auth directly.
import { supabase } from './supabase';

// Defaults — tune here without touching auth.js.
const LIMITS = {
  otp_request: { maxAttempts: 5, windowMinutes: 15, blockMinutes: 15 },
  otp_verify: { maxAttempts: 8, windowMinutes: 15, blockMinutes: 15 },
  reauth_request: { maxAttempts: 5, windowMinutes: 15, blockMinutes: 15 },
  reauth_verify: { maxAttempts: 8, windowMinutes: 15, blockMinutes: 15 },
};

function formatWait(seconds) {
  if (seconds < 90) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

// Throws a user-facing Error if the identifier is currently blocked.
// Returns silently (and records the attempt) if allowed.
export async function enforceRateLimit(identifier, action) {
  const cfg = LIMITS[action];
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_identifier: identifier,
    p_action: action,
    p_max_attempts: cfg.maxAttempts,
    p_window_minutes: cfg.windowMinutes,
    p_block_minutes: cfg.blockMinutes,
  });

  if (error) {
    // Fail OPEN: if the rate-limit check itself breaks (e.g. migration not
    // applied yet), don't lock everyone out of login/signup over it.
    console.warn(`enforceRateLimit(${action}) check failed, allowing through:`, error.message);
    return;
  }

  if (!data?.allowed) {
    const noun = action === 'otp_verify' ? 'code attempts' : 'requests';
    throw new Error(`Too many ${noun}. Please try again in ${formatWait(data.retry_after_seconds)}.`);
  }
}

// Call after a SUCCESSFUL login so earlier mistakes don't keep counting.
export async function clearRateLimit(identifier, action) {
  try {
    await supabase.rpc('reset_rate_limit', { p_identifier: identifier, p_action: action });
  } catch (e) {
    console.warn(`clearRateLimit(${action}) failed (non-critical):`, e.message);
  }
}