// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const KORAPAY_SECRET_KEY = Deno.env.get("KORAPAY_SECRET_KEY") || "";

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

  // GET /resolve-bank?list=true  → return Korapay's bank list
  if (req.method === "GET" && url.searchParams.get("list") === "true") {
    try {
      const res = await fetch("https://api.korapay.com/merchant/api/v1/misc/banks?country=NG", {
        headers: { Authorization: `Bearer ${KORAPAY_SECRET_KEY}` },
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const res = await fetch(
      `https://api.korapay.com/merchant/api/v1/misc/banks/resolve?account=${account_number}&bank_code=${bank_code}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await res.json();
    console.log("Korapay resolve response:", JSON.stringify(data));

    if (data.status && data.data?.account_name) {
      return new Response(
        JSON.stringify({ success: true, account_name: data.data.account_name }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, message: data.message || "Could not resolve account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err: any) {
    console.error("resolve-bank error:", err.message);
    return new Response(
      JSON.stringify({ success: false, message: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});