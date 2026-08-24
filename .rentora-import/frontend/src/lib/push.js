// lib/push.js
//
// Real OS/browser push notifications — the "even if the app is closed"
// layer on top of the in-app bell (lib/notifications.js). A user has to
// explicitly opt in (browsers require a user gesture for the permission
// prompt, so this can't run automatically on page load).
import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY || '';

// Browsers want the VAPID key as a raw Uint8Array, not the base64url
// string it's distributed as.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Whether this browser/device could support push at all. Notably false on
// iOS Safari unless the site has been added to the home screen first —
// that's an Apple restriction, not something we can detect a workaround for
// beyond checking (which this does, via the standard PushManager check).
export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY;
}

// Current permission state: 'granted' | 'denied' | 'default' (not yet asked).
export function getPushPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// Call this from a click handler (a real user gesture — browsers reject
// the permission prompt otherwise). Resolves true if the user is now
// subscribed, false if they declined or it's unsupported.
export async function enablePush(userId) {
  if (!isPushSupported() || !userId) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: 'endpoint' }
  );
  if (error) {
    console.warn('Saving push subscription failed:', error.message);
    return false;
  }
  return true;
}

// Turns push off for this device: unsubscribes the browser AND removes the
// saved row, so send-push stops trying to reach it.
export async function disablePush() {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) console.warn('Removing push subscription failed:', error.message);
}

// Whether THIS device currently has an active push subscription — used to
// show "on"/"off" state for the toggle correctly on load.
export async function isPushEnabledOnThisDevice() {
  if (!isPushSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return !!subscription;
}