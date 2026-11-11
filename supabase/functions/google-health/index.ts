import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const APP_URL = Deno.env.get("RUNTRACK_APP_URL") ?? "https://iamaaan.github.io/runtrack-pro/";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "sb_publishable_NTuvMZo_dNDbwr-FXZ1dvA_7GjoSuKP";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const GOOGLE_REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI") ?? `${SUPABASE_URL}/functions/v1/google-health`;
const TOKEN_KEY_B64 = Deno.env.get("GOOGLE_TOKEN_ENCRYPTION_KEY") ?? "";
const ACTIVITY_SCOPE = "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly";
const CORS = {
  "Access-Control-Allow-Origin": "https://iamaaan.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
function hex(bytes: Uint8Array) { return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join(""); }
function b64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)); }
function unb64(value: string) { return Uint8Array.from(atob(value), (c) => c.charCodeAt(0)); }
async function sha(value: string) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))); }
function randomToken(bytes = 32) { const data = crypto.getRandomValues(new Uint8Array(bytes)); return b64(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
function validSyncCode(code: unknown): code is string { return typeof code === "string" && /^[A-Za-z0-9_-]{43}$/.test(code); }

async function serviceFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Database request failed (${response.status}): ${body.slice(0, 500)}`);
  return body ? JSON.parse(body) : null;
}
async function verifySyncCode(code: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/runtrack_sync_get`, {
    method: "POST",
    headers: { "apikey": ANON_KEY, "Authorization": `Bearer ${ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_code: code }),
  });
  if (!response.ok) throw new Error("Could not verify the RunTrack sync code.");
  const result = await response.json();
  if (!result?.payload) throw new Error("Sync code not found. Connect this device to RunTrack cloud sync first.");
  return result.payload;
}
async function encryptToken(token: string) {
  if (!TOKEN_KEY_B64) throw new Error("Google token encryption secret is not configured.");
  const rawKey = unb64(TOKEN_KEY_B64);
  if (rawKey.length !== 32) throw new Error("Google token encryption key must be 32 bytes (base64 encoded).");
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token));
  return b64(new Uint8Array([...iv, ...new Uint8Array(ciphertext)]));
}
async function decryptToken(value: string) {
  if (!TOKEN_KEY_B64) throw new Error("Google token encryption secret is not configured.");
  const rawKey = unb64(TOKEN_KEY_B64);
  if (rawKey.length !== 32) throw new Error("Google token encryption key must be 32 bytes (base64 encoded).");
  const packed = unb64(value);
  const iv = packed.slice(0, 12);
  const ciphertext = packed.slice(12);
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}
function requireConfig() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI || !SERVICE_KEY || !TOKEN_KEY_B64) {
    throw new Error("Google Health integration is not configured. Add the Google OAuth and token-encryption secrets.");
  }
  if (unb64(TOKEN_KEY_B64).length !== 32) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }
}
async function tokenRequest(params: Record<string, string>) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || "Google OAuth token request failed.");
  return data;
}
function parseDuration(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = value.match(/^([0-9]+(?:\.[0-9]+)?)s$/);
  return m ? Number(m[1]) : null;
}
function toRun(point: any) {
  const ex = point?.exercise;
  const interval = ex?.interval ?? {};
  const start = Date.parse(interval.startTime ?? "");
  const end = Date.parse(interval.endTime ?? "");
  const metrics = ex?.metricsSummary ?? {};
  const distance = Number(metrics.distanceMillimeters ?? 0) / 1000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || distance <= 0) return null;
  const duration = parseDuration(ex.activeDuration) ?? (end - start) / 1000;
  if (!(duration > 0)) return null;
  const pace = Number(metrics.averagePaceSecondsPerMeter ?? 0) > 0
    ? Number(metrics.averagePaceSecondsPerMeter) * 1000
    : duration / (distance / 1000);
  const avgHr = Number(metrics.averageHeartRateBeatsPerMinute ?? 0);
  const steps = Number(metrics.steps ?? 0);
  const calories = Number(metrics.caloriesKcal ?? 0);
  const elevation = Number(metrics.elevationGainMillimeters ?? 0) / 1000;
  const id = String(point.name ?? "");
  return {
    id: "google-health:" + (id.split("/").pop() || id),
    externalId: id,
    name: ex.displayName || ex.exerciseType || "Fitbit workout",
    date: new Date(start).toISOString(),
    start,
    end,
    distance,
    duration,
    pace,
    avgHr: avgHr > 0 ? avgHr : null,
    maxHr: null,
    avgCad: null,
    elevation: elevation > 0 ? elevation : 0,
    calories: calories > 0 ? calories : null,
    steps: steps > 0 ? steps : null,
    points: [],
    track: [],
    splits: [],
    source: "GOOGLE_HEALTH",
  };
}
async function startOAuth(code: string) {
  requireConfig();
  await verifySyncCode(code);
  const codeHash = await sha(code);
  const state = randomToken(32);
  const stateHash = await sha(state);
  await serviceFetch("google_health_oauth_states", {
    method: "POST",
    headers: { "Prefer": "return=minimal" },
    body: JSON.stringify({ state_hash: stateHash, code_hash: codeHash, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() }),
  });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: ACTIVITY_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  }).toString();
  return { authorizationUrl: url.toString() };
}
async function oauthCallback(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const error = url.searchParams.get("error");
  const finish = (status: string, message?: string) => {
    const dest = new URL(APP_URL);
    dest.searchParams.set("google_health", status);
    if (message) dest.searchParams.set("google_health_message", message.slice(0, 240));
    return Response.redirect(dest.toString(), 303);
  };
  if (!state) return finish("error", "Google did not return an OAuth state.");
  const stateHash = await sha(state);
  const rows = await serviceFetch(`google_health_oauth_states?state_hash=eq.${encodeURIComponent(stateHash)}&select=code_hash,expires_at&limit=1`);
  const saved = rows?.[0];
  if (!saved || new Date(saved.expires_at).getTime() < Date.now()) return finish("error", "This Google connection request expired. Please try again.");
  await serviceFetch(`google_health_oauth_states?state_hash=eq.${encodeURIComponent(stateHash)}`, { method: "DELETE" });
  if (error) return finish("error", error === "access_denied" ? "Google permission was not granted." : error);
  if (!code) return finish("error", "Google did not return an authorization code.");
  try {
    requireConfig();
    const tokens = await tokenRequest({ code, redirect_uri: GOOGLE_REDIRECT_URI, grant_type: "authorization_code" });
    if (!tokens.refresh_token) throw new Error("Google did not return a refresh token. Please reconnect and approve access.");
    const identityResponse = await fetch("https://health.googleapis.com/v4/users/me/identity", {
      headers: { "Authorization": `Bearer ${tokens.access_token}` },
    });
    const identity = await identityResponse.json();
    if (!identityResponse.ok) {
      const reason = identity?.error?.details?.[0]?.reason ?? identity?.error?.status;
      if (reason === "ACCOUNT_NOT_LINKED" || identity?.error?.message?.includes("ACCOUNT_NOT_LINKED")) {
        throw new Error("Your Google account is not linked to Google Health yet. Open the Google Health app, finish linking your Fitbit account, then try again.");
      }
      throw new Error(identity?.error?.message || "Could not verify your Google Health account.");
    }
    const encrypted = await encryptToken(tokens.refresh_token);
    const scopes = String(tokens.scope ?? "").split(" ").filter(Boolean);
    await serviceFetch("google_health_connections?on_conflict=code_hash", {
      method: "POST",
      headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        code_hash: saved.code_hash,
        health_user_id: identity.healthUserId,
        legacy_user_id: identity.legacyUserId ?? null,
        refresh_token_ciphertext: encrypted,
        granted_scopes: scopes,
        connected_at: new Date().toISOString(),
        last_sync_error: null,
      }),
    });
    return finish("connected");
  } catch (e) {
    return finish("error", e instanceof Error ? e.message : "Google connection failed.");
  }
}
async function getConnection(codeHash: string) {
  const rows = await serviceFetch(`google_health_connections?code_hash=eq.${encodeURIComponent(codeHash)}&select=*&limit=1`);
  return rows?.[0] ?? null;
}
async function getAccessToken(connection: any) {
  const refreshToken = await decryptToken(connection.refresh_token_ciphertext);
  const tokens = await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
  return tokens.access_token as string;
}
async function handleAction(action: string, syncCode: string) {
  if (!validSyncCode(syncCode)) throw new Error("Enter a valid 43-character RunTrack sync code.");
  await verifySyncCode(syncCode);
  const codeHash = await sha(syncCode);
  const connection = await getConnection(codeHash);

  if (action === "status") {
    return {
      connected: !!connection,
      healthUserId: connection?.health_user_id ?? null,
      connectedAt: connection?.connected_at ?? null,
      lastSyncedAt: connection?.last_synced_at ?? null,
      lastSyncError: connection?.last_sync_error ?? null,
      scopes: connection?.granted_scopes ?? [],
    };
  }
  if (action === "disconnect") {
    if (connection) {
      try {
        const refresh = await decryptToken(connection.refresh_token_ciphertext);
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      } catch { /* Local disconnect still removes stored credentials. */ }
      await serviceFetch(`google_health_connections?code_hash=eq.${encodeURIComponent(codeHash)}`, { method: "DELETE" });
    }
    return { disconnected: true };
  }
  if (action !== "sync") throw new Error("Unknown Google Health action.");
  if (!connection) throw new Error("Google Health is not connected yet.");

  try {
    const accessToken = await getAccessToken(connection);
    const since = new Date(Date.now() - 730 * 86400_000).toISOString().slice(0, 10);
    const filter = `exercise.interval.civil_start_time >= "${since}"`;
    let pageToken = "";
    const runs: any[] = [];
    for (let page = 0; page < 10; page++) {
      const apiUrl = new URL("https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints:reconcile");
      apiUrl.searchParams.set("pageSize", "25");
      apiUrl.searchParams.set("filter", filter);
      if (pageToken) apiUrl.searchParams.set("pageToken", pageToken);
      const response = await fetch(apiUrl, { headers: { "Authorization": `Bearer ${accessToken}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Google Health workout request failed.");
      for (const point of (data.dataPoints ?? [])) {
        const run = toRun(point);
        if (run) runs.push(run);
      }
      pageToken = data.nextPageToken ?? "";
      if (!pageToken) break;
    }
    await serviceFetch(`google_health_connections?code_hash=eq.${encodeURIComponent(codeHash)}`, {
      method: "PATCH",
      headers: { "Prefer": "return=minimal" },
      body: JSON.stringify({ last_synced_at: new Date().toISOString(), last_sync_error: null }),
    });
    return { runs, fetched: runs.length, since };
  } catch (e) {
    await serviceFetch(`google_health_connections?code_hash=eq.${encodeURIComponent(codeHash)}`, {
      method: "PATCH",
      headers: { "Prefer": "return=minimal" },
      body: JSON.stringify({ last_sync_error: e instanceof Error ? e.message : "Sync failed." }),
    });
    throw e;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  if (req.method === "GET" && (url.searchParams.has("code") || url.searchParams.has("error"))) {
    try { return await oauthCallback(req); }
    catch (e) {
      const dest = new URL(APP_URL);
      dest.searchParams.set("google_health", "error");
      dest.searchParams.set("google_health_message", e instanceof Error ? e.message.slice(0, 240) : "Google OAuth callback failed.");
      return Response.redirect(dest.toString(), 303);
    }
  }
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const origin = req.headers.get("origin");
  if (origin && origin !== "https://iamaaan.github.io") return json({ error: "Origin not allowed." }, 403);
  try {
    const body = await req.json();
    if (body.action === "start") {
      const result = await startOAuth(body.syncCode);
      return json(result);
    }
    const result = await handleAction(body.action, body.syncCode);
    return json(result);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Google Health request failed." }, 400);
  }
});
