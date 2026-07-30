// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    .select("id, role, avatar_url")
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
      .not("status", "in", "(released,refunded,failed)");

    if (activeRentPayments && activeRentPayments > 0) {
      return json({
        success: false,
        message: "You have an active or pending rent payment. Please contact support@rentora.com.ng to resolve it before deleting your account.",
      }, 400);
    }
  }

  // ── Clear to delete: remove avatar file, anonymize the profile,
  // then remove the auth user entirely so they can no longer sign in.
  // Financial/transaction records are kept (not deleted) for legal and
  // accounting reasons, but are no longer linked to identifying info. ──
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
      full_name: "Deleted User",
      phone: null,
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

  return json({ success: true, message: "Account deleted." });
});
