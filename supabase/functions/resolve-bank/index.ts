// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Flutterwave-backed bank list + account name resolution.
// Set the secret with:  supabase secrets set FLW_SECRET_KEY=FLWSECK-...
const FLW_SECRET_KEY = Deno.env.get("FLW_SECRET_KEY") || Deno.env.get("FLUTTERWAVE_SECRET_KEY") || "";
const FLW_BASE_URL = "https://api.flutterwave.com/v3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // GET /resolve-bank?list=true  → return Flutterwave's NG bank list,
  // normalised to the { status, data: [{ name, code }] } shape the
  // BecomeAgent page already expects.
  if (req.method === "GET" && url.searchParams.get("list") === "true") {
    try {
      const res = await fetch(`${FLW_BASE_URL}/banks/NG`, {
        headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` },
      });
      const data = await res.json();
      const banks = Array.isArray(data?.data)
        ? data.data.map((b: any) => ({ name: b.name, code: b.code }))
        : [];
      return new Response(
        JSON.stringify({ status: data?.status === "success", data: banks, message: data?.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (err: any) {
      return new Response(JSON.stringify({ status: false, message: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // POST → resolve account name
  try {
    const { account_number, bank_code } = await req.json();

    if (!account_number || !bank_code) {
      return new Response(
        JSON.stringify({ success: false, message: "account_number and bank_code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Basic input validation — Nigerian NUBAN account numbers are exactly
    // 10 digits, bank codes are short numeric strings. Rejecting anything
    // else here means malformed/oversized input never reaches Flutterwave's
    // API (which we're paying per-call for) or gets logged verbatim below.
    if (!/^\d{10}$/.test(String(account_number))) {
      return new Response(
        JSON.stringify({ success: false, message: "account_number must be exactly 10 digits" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!/^\d{1,10}$/.test(String(bank_code))) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid bank_code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const res = await fetch(`${FLW_BASE_URL}/accounts/resolve`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ account_number, account_bank: bank_code }),
    });

    const data = await res.json();

    if (data?.status === "success" && data?.data?.account_name) {
      return new Response(
        JSON.stringify({ success: true, account_name: data.data.account_name }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: false, message: data?.message || "Could not resolve account" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("resolve-bank error:", err.message);
    return new Response(
      JSON.stringify({ success: false, message: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
