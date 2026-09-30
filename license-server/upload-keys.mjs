/**
 * Upload VALID_KEYS into Cloudflare KV from tokens-SELLER-ONLY.txt
 *
 * Usage (from extension root):
 *   node license-server/upload-keys.mjs
 *
 * Requires: wrangler logged in, and LICENSE_KV id set in wrangler.toml
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const tokensPath = join(root, "tokens-SELLER-ONLY.txt");

const raw = readFileSync(tokensPath, "utf8");
const keys = raw
  .split("\n")
  .map((l) => l.trim())
  .map((l) => {
    const m = l.match(/RSHP-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}/);
    return m ? m[0].toUpperCase() : null;
  })
  .filter(Boolean);

if (!keys.length) {
  console.error("No keys found in", tokensPath);
  process.exit(1);
}

const json = JSON.stringify(keys);
const tmp = join(__dirname, "valid-keys.json");
import { writeFileSync, unlinkSync } from "node:fs";
writeFileSync(tmp, json);

console.log(`Uploading ${keys.length} keys to KV as VALID_KEYS ...`);

try {
  execSync(
    `npx wrangler kv key put VALID_KEYS --path="${tmp}" --binding=LICENSE_KV`,
    { cwd: __dirname, stdio: "inherit" }
  );
  console.log("Done. VALID_KEYS is set.");
} catch (e) {
  console.error(
    "Upload failed. Check wrangler login and LICENSE_KV id in wrangler.toml"
  );
  process.exit(1);
} finally {
  try {
    unlinkSync(tmp);
  } catch {}
}
