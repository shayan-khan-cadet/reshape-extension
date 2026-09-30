/**
 * Reshape license server — Cloudflare Worker (free tier)
 *
 * Bind a KV namespace named LICENSE_KV in the dashboard / wrangler.toml
 *
 * Actions (POST JSON):
 *   { action: "activate", key, deviceId }
 *   { action: "check",    key, deviceId }
 *   { action: "release",  key, deviceId }  // optional: free the key from this device
 *
 * Responses: { ok: true } or { ok: false, error: "..." }
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

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

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "POST only" }, 405);
    }

    if (!env.LICENSE_KV) {
      return json(
        { ok: false, error: "Server misconfigured: LICENSE_KV not bound" },
        500
      );
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
    // If VALID_KEYS exists as a JSON array in KV, enforce membership.
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
      if (existing && existing.deviceId && existing.deviceId !== deviceId) {
        return json(
          {
            ok: false,
            error: "This key is already active on another device.",
          },
          409
        );
      }
      await env.LICENSE_KV.put(
        kvKey,
        JSON.stringify({
          deviceId,
          activatedAt: Date.now(),
          lastSeenAt: Date.now(),
        })
      );
      return json({ ok: true, deviceId });
    }

    if (action === "check") {
      const existing = await env.LICENSE_KV.get(kvKey, "json");
      if (!existing || !existing.deviceId) {
        // Not registered online yet — allow first check to claim (or reject)
        return json({ ok: false, error: "Key not activated on server." }, 404);
      }
      if (existing.deviceId !== deviceId) {
        return json(
          {
            ok: false,
            error: "This key is active on another device.",
          },
          409
        );
      }
      // Touch lastSeen
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
