import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const ALLOWED_ORIGINS = new Set([
  "https://deepjthacker.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_TYPES = new Set(["profile_view", "call_click", "whatsapp_click", "maps_click", "email_click"]);

function json(data: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin"
    }
  });
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function cleanUuid(value: unknown): string | null {
  return typeof value === "string" && UUID_RE.test(value) ? value : null;
}

function cleanPage(value: unknown): string {
  const page = cleanText(value, 500);
  return page && page.startsWith("/") ? page : "/";
}

function cleanReferrer(value: unknown): string | null {
  const raw = cleanText(value, 1000);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.origin + url.pathname;
  } catch {
    return null;
  }
}

async function makeRateKey(req: Request, action: string): Promise<string> {
  const ip = req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") || "unknown";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SERVICE_ROLE_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(action + "|" + ip)
  );
  return Array.from(new Uint8Array(signature))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function allowRate(req: Request, action: string, maxHits: number, windowMs: number): Promise<boolean> {
  const rate_key = await makeRateKey(req, action);
  const bucket = Math.floor(Date.now() / windowMs) * windowMs;
  const { data, error } = await supabase.rpc("consume_distributor_activity_rate_limit", {
    p_rate_key: rate_key,
    p_window_start: new Date(bucket).toISOString(),
    p_max_hits: maxHits
  });
  if (error) throw error;
  return data === true;
}

async function activeDistributor(id: string) {
  const { data, error } = await supabase
    .from("distributors")
    .select("id")
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}


async function verifyEnquiryRelationship(input: {
  distributor_id: string | null;
  company_id: string | null;
  division_id: string | null;
  brand_id: string | null;
  product_id: string | null;
  distributorship_id: string | null;
  product_distributor_id: string | null;
}): Promise<boolean> {
  if (!input.distributor_id) return false;
  if (input.distributorship_id && input.product_distributor_id) return false;

  if (input.product_distributor_id) {
    const { data, error } = await supabase
      .from("product_distributors")
      .select("id,distributor_id,product_id,status,verification_status")
      .eq("id", input.product_distributor_id)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data &&
      data.distributor_id === input.distributor_id &&
      data.product_id === input.product_id &&
      data.status === "active" &&
      data.verification_status === "verified");
  }

  if (input.distributorship_id) {
    const { data, error } = await supabase
      .from("distributorships")
      .select("id,distributor_id,company_id,division_id,brand_id,status,verification_status")
      .eq("id", input.distributorship_id)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.distributor_id !== input.distributor_id ||
        data.status !== "active" || data.verification_status !== "verified") return false;
    if (input.company_id && data.company_id !== input.company_id) return false;
    if (data.division_id && data.division_id !== input.division_id) return false;
    if (data.brand_id && data.brand_id !== input.brand_id) return false;
    return true;
  }

  return false;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (!ALLOWED_ORIGINS.has(origin)) {
    return new Response("Origin not allowed", { status: 403 });
  }
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Vary": "Origin"
      }
    });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  try {
    const body = await req.json();
    const action = body?.action;
    const source_page = cleanPage(body?.source_page);
    const referrer = cleanReferrer(body?.referrer);
    const utm_source = cleanText(body?.utm_source, 200);
    const utm_medium = cleanText(body?.utm_medium, 200);
    const utm_campaign = cleanText(body?.utm_campaign, 200);

    if (action === "event") {
      if (!(await allowRate(req, "event", 120, 60_000))) {
        return json({ error: "Activity rate limit reached. Please try again shortly." }, 429, origin);
      }
      const distributor_id = cleanUuid(body?.distributor_id);
      const event_type = cleanText(body?.event_type, 40);
      const session_id = cleanUuid(body?.session_id);
      if (!distributor_id || !event_type || !EVENT_TYPES.has(event_type)) {
        return json({ error: "Invalid activity details" }, 400, origin);
      }
      if (!(await activeDistributor(distributor_id))) {
        return json({ error: "Distributor is not active" }, 404, origin);
      }
      if (session_id) {
        const { count, error } = await supabase
          .from("distributor_contact_events")
          .select("id", { count: "exact", head: true })
          .eq("session_id", session_id)
          .gte("created_at", new Date(Date.now() - 60_000).toISOString());
        if (error) throw error;
        if ((count || 0) >= 50) return json({ error: "Activity limit reached" }, 429, origin);
      }
      const row = {
        distributor_id,
        event_type,
        company_id: cleanUuid(body?.company_id),
        division_id: cleanUuid(body?.division_id),
        brand_id: cleanUuid(body?.brand_id),
        product_id: cleanUuid(body?.product_id),
        distributorship_id: cleanUuid(body?.distributorship_id),
        product_distributor_id: cleanUuid(body?.product_distributor_id),
        session_id,
        source_page,
        referrer,
        utm_source,
        utm_medium,
        utm_campaign
      };
      const { error } = await supabase.from("distributor_contact_events").insert(row);
      if (error) throw error;
      return json({ ok: true }, 200, origin);
    }

    if (action === "enquiry") {
      if (!(await allowRate(req, "enquiry", 6, 60 * 60_000))) {
        return json({ error: "Too many enquiries from this connection. Please try again later." }, 429, origin);
      }
      const customer_name = cleanText(body?.customer_name, 100);
      const mobileRaw = cleanText(body?.mobile, 20) || "";
      const mobile = mobileRaw.replace(/[^0-9+]/g, "");
      const email = cleanText(body?.email, 254);
      const message = cleanText(body?.message, 1500);
      const consent = body?.consent === true;
      const distributor_id = cleanUuid(body?.distributor_id);
      if (!customer_name || customer_name.length < 2 || !/^[+0-9]{8,16}$/.test(mobile) ||
          !message || message.length < 5 || !consent) {
        return json({ error: "Please provide valid contact details, an enquiry message and consent." }, 400, origin);
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: "Please provide a valid email address." }, 400, origin);
      }
      if (distributor_id && !(await activeDistributor(distributor_id))) {
        return json({ error: "Selected distributor is not active" }, 404, origin);
      }
      const { count, error: recentError } = await supabase
        .from("distributor_enquiries")
        .select("id", { count: "exact", head: true })
        .eq("mobile", mobile)
        .gte("created_at", new Date(Date.now() - 30 * 60_000).toISOString());
      if (recentError) throw recentError;
      if ((count || 0) >= 3) return json({ error: "Please wait before submitting another enquiry." }, 429, origin);

      const company_id = cleanUuid(body?.company_id);
      const division_id = cleanUuid(body?.division_id);
      const brand_id = cleanUuid(body?.brand_id);
      const product_id = cleanUuid(body?.product_id);
      const distributorship_id = cleanUuid(body?.distributorship_id);
      const product_distributor_id = cleanUuid(body?.product_distributor_id);
      const verifiedRelationship = await verifyEnquiryRelationship({
        distributor_id, company_id, division_id, brand_id, product_id,
        distributorship_id, product_distributor_id
      });
      const row = {
        distributor_id,
        company_id,
        division_id,
        brand_id,
        product_id,
        distributorship_id,
        product_distributor_id,
        customer_name,
        mobile,
        email,
        message,
        consent: true,
        routing_status: verifiedRelationship ? "routed" : "needs_review",
        source_page,
        referrer,
        utm_source,
        utm_medium,
        utm_campaign
      };
      const { data, error } = await supabase
        .from("distributor_enquiries")
        .insert(row)
        .select("id")
        .single();
      if (error) throw error;
      return json({ ok: true, enquiry_id: data.id }, 201, origin);
    }

    return json({ error: "Unknown action" }, 400, origin);
  } catch (error) {
    console.error("Distributor activity error:", error);
    return json({ error: "Unable to record this request" }, 500, origin);
  }
});
