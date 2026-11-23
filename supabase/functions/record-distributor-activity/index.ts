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

      const row = {
        distributor_id,
        company_id: cleanUuid(body?.company_id),
        division_id: cleanUuid(body?.division_id),
        brand_id: cleanUuid(body?.brand_id),
        product_id: cleanUuid(body?.product_id),
        distributorship_id: cleanUuid(body?.distributorship_id),
        product_distributor_id: cleanUuid(body?.product_distributor_id),
        customer_name,
        mobile,
        email,
        message,
        consent: true,
        routing_status: distributor_id ? "routed" : "needs_review",
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
