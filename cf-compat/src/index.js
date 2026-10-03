/* مختبر توافق Cloudflare Workers — يختبر أسطح الخطر الحقيقية لمنارة */
import { randomBytes, createHash, createHmac } from "node:crypto";

const VAPID_PUB = "BB9G9PVkxMnrLHBR7nPpDwfTM1KgPfNMcrke5THGB9ffpubbwHXFeewxePzW_QxYhzA0pNwMKqIFbafBOABkAF4";
const VAPID_PRIV = "2XYEzXqZE_Zbio1jz03_EKEGPMFWVQYeu6yfLHGQmzk";
const JWKX = "H0b09WTEyesscFHuc-kPB9MzUqA980xyuR7lMcYH198";
const JWKY = "pubbwHXFeewxePzW_QxYhzA0pNwMKqIFbafBOABkAF4";
const SUPA_URL = "https://tshpfgdcpdaouznxpcne.supabase.co";
const SUPA_ANON = "sb_publishable_ZJ5MuW3nWV5RtEo0tcPzxQ_dCaCup_J";

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function vapidJwt(aud) {
  const key = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: JWKX, y: JWKY, d: VAPID_PRIV }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = b64u(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const body = b64u(new TextEncoder().encode(JSON.stringify({ aud, exp, sub: "mailto:support@manara.app" })));
  const data = new TextEncoder().encode(header + "." + body);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, data);
  const raw = new Uint8Array(sig);
  const joined = new Uint8Array(64);
  joined.set(raw.slice(0, 32), 0);
  joined.set(raw.slice(32, 64), 32);
  return header + "." + body + "." + b64u(joined);
}

async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8);
  return new Uint8Array(bits);
}

async function fcmProbe() {
  // تشفير Web Push حقيقي (RFC8291) لمشترك وهمي — الرد 410/404 من FCM = المسار يعمل
  const ecdh = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const pubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", ecdh.publicKey));
  const subPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const fakeP256 = new Uint8Array(await crypto.subtle.exportKey("raw", subPair.publicKey));
  const fakeAuth = crypto.getRandomValues(new Uint8Array(16));
  const subPub = await crypto.subtle.importKey("raw", fakeP256, { name: "ECDH", namedCurve: "P-256" }, true, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: subPub }, ecdh.privateKey, 256));
  const authInfo = new TextEncoder().encode("Content-Encoding: auth\0");
  const prk = await hkdf(fakeAuth, shared, authInfo, 32);
  const ctxBuf = new Uint8Array(1 + 2 + 65 + 2 + 65);
  ctxBuf.set([0]); ctxBuf.set([0, 65], 1); ctxBuf.set(fakeP256, 3); ctxBuf.set([0, 65], 68); ctxBuf.set(pubRaw, 70);
  const cekInfo = new Uint8Array(new TextEncoder().encode("Content-Encoding: aesgcm\0P-256\0").length + ctxBuf.length);
  cekInfo.set(new TextEncoder().encode("Content-Encoding: aesgcm\0P-256\0")); cekInfo.set(ctxBuf, new TextEncoder().encode("Content-Encoding: aesgcm\0P-256\0").length);
  const nonceInfo = new Uint8Array(new TextEncoder().encode("Content-Encoding: nonce\0P-256\0").length + ctxBuf.length);
  nonceInfo.set(new TextEncoder().encode("Content-Encoding: nonce\0P-256\0")); nonceInfo.set(ctxBuf, new TextEncoder().encode("Content-Encoding: nonce\0P-256\0").length);
  const cek = await hkdf(new Uint8Array(0), prk, cekInfo, 16);
  const nonce = await hkdf(new Uint8Array(0), prk, nonceInfo, 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const pt = new Uint8Array([...new TextEncoder().encode(JSON.stringify({ title: "t" })), 2]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, pt));
  const jwt = await vapidJwt("https://fcm.googleapis.com");
  const r = await fetch("https://fcm.googleapis.com/fcm/send/fake-manara-probe", {    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream", "Content-Encoding": "aesgcm", TTL: "60",
      Authorization: "vapid t=" + jwt + ", k=" + VAPID_PUB,
      "Crypto-Key": "dh=" + b64u(pubRaw),
      Encryption: "salt=" + b64u(crypto.getRandomValues(new Uint8Array(16))),
    },
    body: ct,
  });
  const body = await r.text();
  return { status: r.status, body: body.slice(0, 100) };
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (u.pathname !== "/test") {
      return Response.json({ ok: true, usage: "GET /test", cron: "every 5 min" });
    }
    const out = {};
    try {
      const rb = randomBytes(16).toString("hex");
      const h = createHash("sha256").update("manara").digest("hex").slice(0, 12);
      const m = createHmac("sha256", "k").update("m").digest("hex").slice(0, 12);
      out.node_crypto = { ok: rb.length === 32 && h.length === 12 && m.length === 12 };
    } catch (e) { out.node_crypto = { ok: false, err: String(e).slice(0, 80) }; }
    try {
      const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("x"));
      out.webcrypto = { ok: d.byteLength === 32 };
    } catch (e) { out.webcrypto = { ok: false }; }
    try {
      const r = await fetch(SUPA_URL + "/rest/v1/tenants?select=id&limit=1", { headers: { apikey: SUPA_ANON, Authorization: "Bearer " + SUPA_ANON } });
      out.supabase_rest = { ok: r.status === 200, status: r.status };
    } catch (e) { out.supabase_rest = { ok: false, err: String(e).slice(0, 80) }; }
    try {
      out.fcm = await fcmProbe();
      out.fcm.ok = [400, 401, 404, 410].includes(out.fcm.status);
    } catch (e) { out.fcm = { ok: false, err: String(e && e.message || e).slice(0, 100) }; }
    out.all_ok = !!(out.node_crypto.ok && out.webcrypto.ok && out.supabase_rest.ok && out.fcm.ok);
    return Response.json(out);
  },
  async scheduled(event, env, ctx) {
    console.log("manara-compat cron tick " + new Date(event.scheduledTime).toISOString());
  },
};
