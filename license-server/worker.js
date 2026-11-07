/**
 * Reshape license server v2 — Cloudflare Worker (free tier)
 *
 * Changes vs v1 (Nov 7, 2026):
 *  - 7-DAY STALE EXPIRY: a key bound to a deviceId is freed if that
 *    device has not checked in for 7 days. This is what fixes the
 *    uninstall/reinstall bug: uninstall wipes chrome.storage.local,
 *    so the reinstall gets a NEW deviceId and v1 rejected it forever
 *    ("already active on another device"). In v2, a stale binding
 *    can be claimed by the new deviceId.
 *  - GET release: chrome.runtime.setUninstallURL() can only open a
 *    GET URL, so release now also works as:
 *      GET /?action=release&key=RSHP-...&deviceId=...
 *    (POST release still works as before.)
 *  - Daily cleanup: a scheduled cron deletes stale bindings so the
 *    KV does not fill with dead keys. Add the [triggers] cron in
 *    wrangler.toml (already included in this package).
 *  - "check" from the SAME device revives a stale binding instead
 *    of killing it, so a user who just did not open the popup for
 *    a week is not locked out.
 *
 * Bind a KV namespace named LICENSE_KV in wrangler.toml.
 * Actions (POST JSON): { action: "activate"|"check"|"release", key, deviceId }
 * Responses: { ok: true } or { ok: false, error: "..." }
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

// 7 days, in milliseconds — chosen by Shayan, Nov 7 2026.
const STALE_MS = 7 * 24 * 60 * 60 * 1000;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function normalizeKey(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function isKeyFormatValid(key) {
  return /^RSHP-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(key);
}

function isStale(existing) {
  if (!existing) return true;
  if (!existing.lastSeenAt) return true;
  return Date.now() - existing.lastSeenAt > STALE_MS;
}

export default {
  // Daily cron: delete bindings that have not checked in for 7+ days.
  async scheduled(_event, env) {
    if (!env.LICENSE_KV) return;
    let cursor;
    do {
      const page = await env.LICENSE_KV.list({ prefix: "license:", cursor });
      for (const entry of page.keys) {
        const existing = await env.LICENSE_KV.get(entry.name, "json");
        if (existing && isStale(existing)) {
          await env.LICENSE_KV.delete(entry.name);
        }
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  },

  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (!env.LICENSE_KV) {
      return json(
        { ok: false, error: "Server misconfigured: LICENSE_KV not bound" },
        500
      );
    }

    // GET release — for chrome.runtime.setUninstallURL().
    // Example: GET /?action=release&key=RSHP-...&deviceId=...
    if (request.method === "GET") {
      const url = new URL(request.url);
      if (url.searchParams.get("action") === "release") {
        const key = normalizeKey(url.searchParams.get("key"));
        const deviceId = String(url.searchParams.get("deviceId") || "").trim();
        if (!isKeyFormatValid(key) || !deviceId) {
          return json({ ok: false, error: "key and deviceId required" }, 400);
        }
        const kvKey = `license:${key}`;
        const existing = await env.LICENSE_KV.get(kvKey, "json");
        if (existing && existing.deviceId === deviceId) {
          await env.LICENSE_KV.delete(kvKey);
        }
        // Always return a tiny page, not JSON, so the uninstall tab
        // (if Chrome opens one) shows something human.
        return new Response("Reshape license released. You can close this tab.", {
          status: 200,
          headers: { "content-type": "text/plain", ...CORS },
        });
      }
      return json({ ok: true, version: "v2-7day-expiry" });
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "POST only" }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "Invalid JSON" }, 400);
    }

    const action = body.action;
    const key = normalizeKey(body.key);
    const deviceId = String(body.deviceId || "").trim();

    if (!isKeyFormatValid(key)) {
      return json({ ok: false, error: "Invalid key format" }, 400);
    }
    if (!deviceId) {
      return json({ ok: false, error: "deviceId required" }, 400);
    }

    const kvKey = `license:${key}`;

    // Optional: restrict to keys you issued (upload a set into KV once)
    const validListRaw = await env.LICENSE_KV.get("VALID_KEYS");
    if (validListRaw) {
      try {
        const list = JSON.parse(validListRaw);
        if (Array.isArray(list) && list.length && !list.includes(key)) {
          return json({ ok: false, error: "This key is not valid." }, 403);
        }
      } catch {
        /* ignore bad VALID_KEYS */
      }
    }

    if (action === "activate") {
      const existing = await env.LICENSE_KV.get(kvKey, "json");

      // Bound to a DIFFERENT device and still fresh (< 7 days):
      // keep the single-seat lock.
      if (existing && existing.deviceId && existing.deviceId !== deviceId && !isStale(existing)) {
        return json(
          { ok: false, error: "This key is already active on another device." },
          409
        );
      }
      // Same device, different device after uninstall, or stale
      // binding (> 7 days no check-in): claim / reclaim it.
      const reclaimed = Boolean(existing && existing.deviceId && existing.deviceId !== deviceId);
      await env.LICENSE_KV.put(
        kvKey,
        JSON.stringify({ deviceId, activatedAt: Date.now(), lastSeenAt: Date.now() })
      );
      return json({ ok: true, deviceId, reclaimed });
    }

    if (action === "check") {
      const existing = await env.LICENSE_KV.get(kvKey, "json");
      if (!existing || !existing.deviceId) {
        return json({ ok: false, error: "Key not activated on server." }, 404);
      }
      if (existing.deviceId !== deviceId) {
        // Bound to another device. If that binding is stale, tell
        // the caller to re-activate (activate will then succeed).
        // If it is fresh, this is a genuine second device.
        if (isStale(existing)) {
          return json(
            { ok: false, error: "This key was freed after 7 days inactive. Re-activate it." },
            409
          );
        }
        return json({ ok: false, error: "This key is active on another device." }, 409);
      }
      // Same device: touch lastSeen (this also revives a stale
      // binding for a user who just did not open the popup for a week).
      await env.LICENSE_KV.put(
        kvKey,
        JSON.stringify({ ...existing, lastSeenAt: Date.now() })
      );
      return json({ ok: true });
    }

    if (action === "release") {
      const existing = await env.LICENSE_KV.get(kvKey, "json");
      if (existing && existing.deviceId === deviceId) {
        await env.LICENSE_KV.delete(kvKey);
      }
      return json({ ok: true });
    }

    return json({ ok: false, error: "Unknown action" }, 400);
  },
};
