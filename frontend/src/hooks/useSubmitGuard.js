import { useCallback, useRef, useState } from 'react';

/**
 * Double-submit guard for async handlers.
 *
 * The bug this fixes: clicking "Create Property" (or any other async submit
 * button) twice fired the handler twice, so the row was INSERTed twice in
 * Supabase and showed up twice on the admin dashboard. React state updates
 * are async, so `disabled={submitting}` alone still loses the race on a fast
 * double-tap — the second click lands before the re-render. A ref is
 * synchronous, so it can never lose that race.
 *
 * Usage:
 *   const { guard, busy } = useSubmitGuard();
 *   <Button onClick={guard(handleSubmitProperty)} disabled={busy}>Create</Button>
 *   <form onSubmit={guard(handleSubmit)}>   // also covers Enter-key submits
 */
export function useSubmitGuard() {
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (fn, ...args) => {
    if (busyRef.current) return undefined; // ignore the duplicate click
    busyRef.current = true;
    setBusy(true);
    try {
      return await fn(...args);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const guard = useCallback((fn) => (...args) => run(fn, ...args), [run]);

  return { guard, run, busy, isBusy: () => busyRef.current };
}

export default useSubmitGuard;
