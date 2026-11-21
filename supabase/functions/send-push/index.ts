// Sends Web Push notifications to the phones and PCs that turned on device alerts.
//   {type:"request", id, kind, station, requester_id, requester_name}  -> right away, to the people who handle requests
//   {type:"digest"}                                                      -> once a day at 7 PM (Manila), one summary of critical and low stock
// Called only by the database (a trigger and a pg_cron job) with the shared secret kept in public.push_config.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SITE = "https://rainbrewhr.github.io/rainbrew-inventory/";
const b64url = (u8: Uint8Array) => btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// The VAPID key pair is created once, inside this function, and kept in public.push_config (service role only).
async function config() {
  const { data } = await sb.from("push_config").select("*").eq("id", 1).single();
  if (data?.public_key && data?.private_key) return data;
  const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const pub = b64url(new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey)));
  const priv = (await crypto.subtle.exportKey("jwk", kp.privateKey)).d as string;
  await sb.from("push_config").update({ public_key: pub, private_key: priv }).eq("id", 1).is("public_key", null);
  return (await sb.from("push_config").select("*").eq("id", 1).single()).data;
}

Deno.serve(async (req) => {
  const cfg = await config();
  if (req.headers.get("x-push-secret") !== cfg.trigger_secret) return new Response("forbidden", { status: 403 });
  const body = await req.json().catch(() => ({}));
  webpush.setVapidDetails(SITE, cfg.public_key, cfg.private_key);

  let roles: string[] = [], exclude: string | null = null, payload: Record<string, string> | null = null;
  if (body.type === "request") {
    const buy = body.kind === "Purchase";
    roles = buy ? ["Admin", "Stock Keeper", "Procurement Officer"] : ["Admin", "Stock Keeper"];
    exclude = body.requester_id ?? null;
    payload = {
      title: buy ? "New buy request" : "New stock request",
      body: `${body.id}${body.requester_name ? " · " + body.requester_name : ""}${body.station ? " · " + body.station : ""}`,
      url: buy ? "#buy" : "#release", tag: String(body.id),
    };
  } else if (body.type === "digest") {
    roles = ["Admin", "Stock Keeper", "Procurement Officer"];
    const { data: items } = await sb.from("item_stock").select("name,current_stock,status,ever_stocked").eq("active", true);
    const crit = (items ?? []).filter((i) => i.status === "CRITICAL" || (Number(i.current_stock) <= 0 && i.ever_stocked));
    const critNames = new Set(crit.map((i) => i.name));
    const low = (items ?? []).filter((i) => i.status === "LOW" && !critNames.has(i.name));
    if (!crit.length && !low.length) return Response.json({ type: "digest", recipients: 0, sent: 0, message: null });
    const names = [...crit, ...low].map((i) => i.name);
    payload = {
      title: "Stock check · 7 PM",
      body: `${crit.length} critical, ${low.length} low: ${names.slice(0, 4).join(", ")}${names.length > 4 ? " +" + (names.length - 4) + " more" : ""}`,
      url: "#buy", tag: "stock-digest",
    };
  } else return new Response("unknown type", { status: 400 });

  const { data: subs } = await sb.from("push_subscriptions")
    .select("endpoint,p256dh,auth,user_id,profiles!inner(role,approved,active)")
    .in("profiles.role", roles).eq("profiles.approved", true).eq("profiles.active", true);
  const targets = (subs ?? []).filter((s) => s.user_id !== exclude);
  let sent = 0, removed = 0;
  await Promise.allSettled(targets.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 12 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint); removed++; }
    }
  }));
  return Response.json({ type: body.type, recipients: targets.length, sent, removed, message: payload.body });
});
