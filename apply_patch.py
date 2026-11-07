#!/usr/bin/env python3
"""Apply the Reshape license v2 patch to a reshape-extension repo checkout.

Usage (from inside the cloned repo):
    python3 apply_patch.py
Or:
    python3 /path/to/apply_patch.py /path/to/reshape-extension

It edits, in place:
  - src/license.js     : adds releaseLicense() + setUninstallUrl(),
                         calls setUninstallUrl() after activation,
                         exports both functions.
  - src/background.js  : adds a daily license heartbeat alarm.
  - manifest.json      : adds "alarms" permission, bumps version to 1.4.0.

Safe to run twice — already-patched parts are skipped.
"""
import json
import sys
from pathlib import Path

LICENSE_FUNCS = '''
/**
 * Release this device's binding on the server, then clear the local
 * license. Call this from a "Deactivate" button, and (via the
 * uninstall URL below) on uninstall.
 */
async function releaseLicense() {
  const record = await loadLicense();
  if (record && record.key) {
    const deviceId = await getOrCreateDeviceId();
    if (LICENSE_SERVER_URL) {
      try {
        await fetch(LICENSE_SERVER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: record.key, deviceId, action: "release" }),
        });
      } catch {
        // Offline: local clear still happens below; the 7-day
        // expiry on the server frees the key anyway.
      }
    }
  }
  await clearLicense();
  try {
    chrome.runtime.setUninstallURL("");
  } catch {}
  return { ok: true };
}

/**
 * Register the uninstall release URL. Chrome can only open a GET
 * URL on uninstall, so the v2 server also accepts:
 *   GET /?action=release&key=RSHP-...&deviceId=...
 * Call this right after a successful activation.
 */
async function setUninstallUrl(record) {
  if (!LICENSE_SERVER_URL || !record || !record.key) return;
  try {
    const url =
      LICENSE_SERVER_URL +
      "?action=release&key=" + encodeURIComponent(record.key) +
      "&deviceId=" + encodeURIComponent(record.deviceId);
    chrome.runtime.setUninstallURL(url);
  } catch {}
}

'''

BG_TOP = '''// License heartbeat (v2): keeps lastSeen fresh so a key that is
// actually installed is never freed by the 7-day expiry.
try { importScripts("license.js"); } catch {}

'''

BG_BOTTOM = '''
// --- Reshape license heartbeat (v2) ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("reshape-license-check", { periodInMinutes: 1440 });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("reshape-license-check", { periodInMinutes: 1440 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "reshape-license-check") return;
  try {
    if (globalThis.ReshapeLicense && globalThis.ReshapeLicense.isLicensed) {
      await globalThis.ReshapeLicense.isLicensed();
    }
  } catch {}
});
'''


def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    print(f"Patching repo at: {root}")

    # --- src/license.js ---
    p = root / "src" / "license.js"
    text = p.read_text(encoding="utf-8")
    changed = False
    if "releaseLicense" not in text:
        anchor = "/**\n * Returns true if this installation has an active Pro license.\n */"
        if anchor not in text:
            print("ERROR: could not find isLicensed() anchor in src/license.js")
            sys.exit(1)
        text = text.replace(anchor, LICENSE_FUNCS + anchor, 1)
        changed = True
    old_save = "  await saveLicense(record);\n  return { ok: true, record };"
    if old_save in text and "await setUninstallUrl(record);" not in text:
        text = text.replace(
            old_save,
            "  await saveLicense(record);\n  await setUninstallUrl(record);\n  return { ok: true, record };",
            1,
        )
        changed = True
    if "releaseLicense," not in text:
        old_export = "    clearLicense,\n"
        if old_export not in text:
            print("ERROR: could not find ReshapeLicense export in src/license.js")
            sys.exit(1)
        text = text.replace(
            old_export, "    clearLicense,\n    releaseLicense,\n    setUninstallUrl,\n", 1
        )
        changed = True
    p.write_text(text, encoding="utf-8")
    print(f"src/license.js: {'patched' if changed else 'already patched'}")

    # --- src/background.js ---
    p = root / "src" / "background.js"
    text = p.read_text(encoding="utf-8")
    changed = False
    if "reshape-license-check" not in text:
        text = BG_TOP + text + BG_BOTTOM
        changed = True
    p.write_text(text, encoding="utf-8")
    print(f"src/background.js: {'patched' if changed else 'already patched'}")

    # --- manifest.json ---
    p = root / "manifest.json"
    data = json.loads(p.read_text(encoding="utf-8"))
    perms = data.setdefault("permissions", [])
    if "alarms" not in perms:
        perms.append("alarms")
    old_version = data.get("version")
    data["version"] = "1.4.0"
    p.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"manifest.json: version {old_version} -> 1.4.0, permissions: {perms}")

    print("\nDone. Check with: git diff --stat")
    print("Then: git add -A && git commit -m 'License v2: 7-day expiry, uninstall release, daily heartbeat' && git push")


if __name__ == "__main__":
    main()
