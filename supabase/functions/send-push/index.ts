// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore
import webpush from "npm:web-push@3.6.7";

// =========================================================
// Rentora — send-push
//
// Delivers a real OS/browser push notification (the kind that shows up
// even when the site isn't open) to every device a user has subscribed
// on. This does NOT create the in-app bell notification — that already
// happens via notifyUser() -> create_notification() in lib/notifications.js.
// This function is meant to be triggered automatically by a Database
// Webhook on INSERT to user_notifications (see SETUP.md §11 for the exact
// dashboard steps) — same event, so every place that already calls
// notifyUser() gets push "for free" without editing each call site.
//
// SECRETS THIS FUNCTION NEEDS (set via `supabase secrets set`, see SETUP.md):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  — the key pair identifying Rentora
//     to push services (generate once with `npx web-push generate-vapid-keys`,
//     never regenerate carelessly — every existing subscriber's browser has
//     the OLD public key baked in and would silently stop receiving pushes).
//   VAPID_SUBJECT — a mailto: or https: URL push services can use to
//     contact you if something's wrong (their requirement, not Rentora's).
//   SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL — already used by other
//     functions in this repo.
// =========================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@rentora.com.ng";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // This function should only ever be called by the Database Webhook (which
  // authenticates with the service role key) — never directly by a logged-in
  // user's browser. Without this check, anyone with any valid login could
  // call this endpoint with an arbitrary user_id and spam push notifications
  // to a stranger. Reject anything that isn't the real service role key.
  const authHeader = req.headers.get("authorization") || "";
  const providedKey = authHeader.replace(/^Bearer\s+/i, "");
  if (!SERVICE_ROLE_KEY || providedKey !== SERVICE_ROLE_KEY) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("[send-push] VAPID keys not configured — see SETUP.md §11");
    return json({ error: "Push not configured" }, 500);
  }

  let body: { record?: { user_id?: string; title?: string; body?: string; link?: string | null } };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // Database Webhooks wrap the inserted row in a "record" field — supporting
  // both that shape and a flat body keeps this function testable by hand too
  // (e.g. curl'ing it directly with { "user_id": ..., "title": ... }).
  const record = body.record || (body as any);
  const { user_id, title, body: notifBody, link } = record;

  if (!user_id || !title) {
    return json({ error: "user_id and title are required" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", user_id);

  if (error) {
    console.error("[send-push] failed to load subscriptions:", error.message);
    return json({ error: error.message }, 500);
  }

  if (!subs || subs.length === 0) {
    // Not an error — most users haven't turned push on. Nothing to do.
    return json({ sent: 0, reason: "no subscriptions" });
  }

  const payload = JSON.stringify({
    title,
    body: notifBody || "",
    link: link || "/notifications",
  });

  let sent = 0;
  const staleIds: string[] = [];

  await Promise.all(
    subs.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err: any) {
        // 404/410 = the browser unsubscribed or the subscription expired on
        // the push service's side — clean it up so we stop wasting calls on
        // it. Anything else, just log and move on: push is best-effort and
        // should never be the thing that breaks a request.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          staleIds.push(sub.id);
        } else {
          console.warn(`[send-push] failed for subscription ${sub.id}:`, err?.message || err);
        }
      }
    })
  );

  if (staleIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", staleIds);
  }

  return json({ sent, stale_removed: staleIds.length });
});
