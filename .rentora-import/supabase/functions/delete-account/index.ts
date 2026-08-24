// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { senderFor, replyToFor } from "../_shared/email-config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

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

async function sendAccountDeletedEmail(to: string, name: string) {
  if (!RESEND_API_KEY || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: senderFor("account_deleted"),
        to: [to],
        reply_to: replyToFor("account_deleted"),
        subject: "Your Rentora account has been deleted",
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#153E75;">
            <h2 style="margin:0 0 12px;">Hi ${name || 'there'},</h2>
            <p style="color:#5b6b7d;font-size:14px;line-height:1.6;">
              This confirms that your Rentora account has been permanently deleted, as you requested.
              Your login and personal details have been removed and can no longer be accessed.
            </p>
            <p style="color:#5b6b7d;font-size:14px;line-height:1.6;">
              If you didn't request this, or believe this was done in error, please contact us immediately at
              <a href="mailto:support@rentora.com.ng" style="color:#2E86D8;">support@rentora.com.ng</a>.
            </p>
            <p style="color:#8a97a6;font-size:12px;margin-top:24px;">— The Rentora Team</p>
          </div>
        `,
      }),
    });
  } catch (_e) {
    // Non-critical — a failed confirmation email should never block
    // the deletion itself, since the account is already gone by the
    // time this runs.
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace("Bearer ", "").trim();
  if (!jwt) return json({ success: false, message: "Missing authorization token" }, 401);

  // Service-role client: bypasses RLS, can call auth.admin.*
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Identify the caller from their own access token — this is what
  // proves the request is really coming from the logged-in user.
  const { data: authData, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !authData?.user) {
    return json({ success: false, message: "Invalid or expired session. Please log in again." }, 401);
  }
  const userId = authData.user.id;

  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("id, role, avatar_url, email, full_name")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return json({ success: false, message: "Could not find your profile." }, 404);
  }

  // ── Safety checks: don't let anyone delete their account while
  // money or open obligations are still unresolved ──
  if (profile.role === "agent") {
    const [{ count: pendingWithdrawals }, { count: activeListings }, { data: balanceRow }] = await Promise.all([
      admin.from("withdrawal_requests").select("id", { count: "exact", head: true }).eq("agent_id", userId).eq("status", "pending"),
      admin.from("properties").select("id", { count: "exact", head: true }).eq("uploaded_by_agent_id", userId).eq("availability", "available"),
      admin.from("agent_balances").select("balance").eq("agent_id", userId).maybeSingle(),
    ]);

    const issues: string[] = [];
    if (pendingWithdrawals && pendingWithdrawals > 0) issues.push(`${pendingWithdrawals} pending withdrawal request(s)`);
    if (activeListings && activeListings > 0) issues.push(`${activeListings} active listing(s)`);
    if (balanceRow?.balance && Number(balanceRow.balance) > 0) issues.push("a remaining wallet balance");

    if (issues.length > 0) {
      return json({
        success: false,
        message: `You still have ${issues.join(", ")}. Please withdraw your balance and take down any active listings before deleting your account, or contact support@rentora.com.ng for help.`,
      }, 400);
    }
  } else {
    const { count: activeRentPayments } = await admin
      .from("property_rent_payments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("status", "in", "(released,refunded,failed)"); // covers pending, held, move_in_reported, and refund_processing too

    if (activeRentPayments && activeRentPayments > 0) {
      return json({
        success: false,
        message: "You have an active or pending rent payment. Please contact support@rentora.com.ng to resolve it before deleting your account.",
      }, 400);
    }
  }

  // ── Clear to delete: remove the account's PUBLIC presence and its
  // ability to log in — but deliberately KEEP the real name, phone number,
  // and verification documents in place.
  //
  // Why: if this account was used for fraud, and a school or a law
  // enforcement agency (e.g. EFCC) later asks who was behind it, Rentora
  // needs to still be able to answer that. Wiping full_name/phone here
  // would have destroyed exactly the details anyone investigating would
  // need, right at the moment the account holder chose to disappear.
  //
  // What actually makes the account "gone" for everyone else:
  //   - deleted_at is set, and the RLS policy on public.users (see
  //     migration 09_refund_and_delete_fixes.sql) hides any row with
  //     deleted_at set from every user except admins. The person's real
  //     name/phone are still IN the database, just invisible to anyone
  //     who isn't an admin.
  //   - suspended = true blocks any in-app privileges tied to the account.
  //   - the Supabase auth user is deleted below, so they can never log
  //     back in with these credentials again.
  //   - the avatar image is removed since it has no compliance value and
  //     was only ever cosmetic.
  //
  // Financial/transaction records were already kept as-is (not deleted)
  // for legal and accounting reasons — this just stops disconnecting them
  // from who the person actually was.
  if (profile.avatar_url) {
    try {
      const marker = "/avatars/";
      const idx = profile.avatar_url.indexOf(marker);
      if (idx !== -1) {
        const path = profile.avatar_url.substring(idx + marker.length);
        await admin.storage.from("avatars").remove([path]);
      }
    } catch (_e) {
      // non-critical — continue even if this fails
    }
  }

  const { error: anonError } = await admin
    .from("users")
    .update({
      avatar_url: null,
      suspended: true,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (anonError) {
    return json({ success: false, message: "Failed to delete account: " + anonError.message }, 500);
  }

  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);
  if (deleteAuthError) {
    return json({ success: false, message: "Your data was cleared but sign-in removal failed: " + deleteAuthError.message }, 500);
  }

  await sendAccountDeletedEmail(profile.email, profile.full_name);

  return json({ success: true, message: "Account deleted." });
});
