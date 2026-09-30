# Reshape license server (free)

Runs on **Cloudflare Workers** free plan:

- 100,000 requests / day  
- KV storage included  

This enforces: **one license key → one device at a time**.

---

## 1. One-time setup (≈10 minutes)

### Requirements
- Free [Cloudflare account](https://dash.cloudflare.com/sign-up)
- Node.js installed on your PC

### Commands

```bash
cd license-server

# Login (opens browser)
npx wrangler login

# Create KV store
npx wrangler kv namespace create LICENSE_KV
```

Copy the **id** from the output into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "LICENSE_KV"
id = "paste_the_id_here"
```

### Deploy

```bash
npx wrangler deploy
```

You get a URL like:

```text
https://reshape-license.YOUR_SUBDOMAIN.workers.dev
```

---

## 2. Upload your 100 valid keys (optional but recommended)

Without this list, any correctly formatted `RSHP-…` key could be claimed on the server.  
With `VALID_KEYS` in KV, only keys you issued work online.

```bash
# From the extension root (where tokens-SELLER-ONLY.txt lives)
node license-server/upload-keys.mjs
```

Or manually in Cloudflare dashboard → Workers → KV → `LICENSE_KV` → add key `VALID_KEYS` with value = JSON array of keys.

---

## 3. Point the extension at the server

Open `src/license.js` and set:

```js
const LICENSE_SERVER_URL = "https://reshape-license.YOUR_SUBDOMAIN.workers.dev";
```

Rebuild / reload the unpacked extension.

---

## How it behaves

| Action | Result |
|--------|--------|
| First activate with key on device A | OK — key locked to A |
| Same key on device B | Rejected — “already active on another device” |
| Check from device A | OK |
| `release` from device A (optional) | Key freed for another device |

Offline: if the server is unreachable, the extension still trusts a **locally activated** license (so the user is not locked out offline). The server is enforced on activate and on periodic check when online.

---

## Cost

**$0** on the free plan for normal indie usage.
