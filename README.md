# Reshape – API Response Rewriter

A real Chrome / Edge / Brave / Chromium extension that intercepts `fetch` and `XMLHttpRequest` **in the page's own JavaScript context** and rewrites responses according to your rules.

## Install

1. Unzip this folder
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `reshape-extension` folder

## Features

- **Main-world injection** – actually intercepts the page’s own `fetch` / XHR (not just the content-script sandbox)
- **Popup** – quick toggle + rule list
- **Full dashboard in a separate tab** – click **Open in tab** in the popup, or right-click the icon → Options
- Match by URL / host / path (contains, equals, wildcard, regex)
- Method filter + status code override
- Static body or dynamic JS script
- Pure mock mode (no network request)
- Export / import rules as JSON
- Sample rules included

## How to open the full UI in a tab

- Click the extension icon → **Open in tab**
- Or: `chrome://extensions` → Reshape → **Details** → **Extension options**
- Or right-click the toolbar icon → **Options**

## Quick test

1. Make sure Interceptor is **ON**
2. Create a rule:
   - Match value: `httpbin.org/json` (contains)
   - Method: GET
   - Body mode: Static
   - Static body: `{"hello":"from Reshape"}`
   - Check **Serve without real request**
3. Open a new tab → DevTools → Console:
   ```js
   fetch("https://httpbin.org/json").then(r => r.json()).then(console.log)
   ```
4. You should see `{"hello":"from Reshape"}` instead of the real response.

## Notes

- Works on almost all sites. A few sites with very strict CSP may block the injected script; refresh the page after installing.
- Does not intercept WebSockets or Service Worker requests.
- Rules live in `chrome.storage.local`.

## Uninstall

`chrome://extensions` → Reshape → Remove

## License keys (v1.2)

On first open the extension asks for a license key (`RSHP-XXXX-XXXX-XXXX-XXXX`).

- Keys are validated offline (SHA-256 hash set inside the extension)
- Each activation binds the key to **this browser profile** (`deviceId`)
- Without a valid key the interceptor stays off


## License keys

On first open the extension asks for a license key (`RSHP-XXXX-XXXX-XXXX-XXXX`).

- Without a valid key the interceptor stays off
- Each key is meant for **one browser profile**
- **License keys are not stored in this repository** — contact the maintainer for a key

Early users may receive a free key. After the free allocation is used up, keys may be sold.

## Single-seat lock (optional)

For true one-device-at-a-time enforcement, deploy the Worker in `license-server/` (Cloudflare free tier) and set `LICENSE_SERVER_URL` in `src/license.js` to your Worker URL.

See folder **`license-server/`**:

1. Deploy the Worker (free Cloudflare account)
2. Upload your valid keys to KV
3. Set `LICENSE_SERVER_URL` in `src/license.js` to your Worker URL
4. Reload the extension

Then a key activated on device A is rejected on device B.
