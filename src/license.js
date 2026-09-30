/**
 * Reshape license gate
 * - First launch requires a valid token
 * - Token is bound to this browser profile (deviceId)
 * - Offline validation via SHA-256 hash set
 * - Optional online check can be added later (LICENSE_SERVER_URL)
 */

const LICENSE_HASHES = new Set(
[
  "67243da149915ca41ba01b2d4324ea65bd75a60c87fda5a902902498b95d484b",
  "b021c8133518d51fae88f6016ccf2aab8914d601b550f14cc7ea575b67cc6527",
  "a3d28c99df979a49c7328b03d749ade9017694188f7605ad3ba09b45d3ec788f",
  "edc3819e17b9f84397807983d4810e434304eb03ce5692274fbcf139549ac0fa",
  "c674234b47536b9ee7186feb24bc362183154fbaf85c2170ee1e335e7e54a045",
  "2ce8cba8a5d41e5bdfdb6e87b8304c9be76f7ceb078cf289cc51dbd4dd07c7f0",
  "6b6e8b26c0310a33fb9d88e56a951ad6ff03d26d95d1b4c3e69bc38297eeecd0",
  "7cdcc4412c1e4fcc4726c6e62692043eb24f6d283fe548f20cc1c786e4924e0e",
  "e2d8e24b76a66ea55c645118e88033613ee9271f8881d30daaf0762e52c6712e",
  "2a709ad926f2c9637524ae5dc6f3334c4699838c26b8073cc5122db0282cd1ab",
  "5c78e0082be06ff0f41cfb54922f7c1df175689680acc40505611e24a7fb6d58",
  "99256f25aaf0f1e702d964d4dc1a24039ef61c6838bfe03c2e5f2a7b8656173b",
  "a61d7f5ce96eca7506eb7c933f742fa7f254bb0960ea4e1f41311638ca6ca248",
  "30c4aa8c4884a6ae3ffb8807ebfdeddc91b6dfe513cd09fb6b2ce3a57c278398",
  "f61f8f6cbe4213654c791e85548b9fc66db39afb2d5721092f14d1240b82f59a",
  "4251418f2d6272f0f2086025332cc5a39867ed0243e73bc1e0b23ea8a82a1fb3",
  "597a2f1785863a806d4879f8241752507f811936a9da1adea12fa7c945461eeb",
  "4f8ee7a4e50ae56f4ce85ac0e4e19ff952525167eaa792c08154150b00daa046",
  "7e72bf9a9ba0612966c0ea848db59582400c739c80bd5e64a7d770616360aa74",
  "84101cfb8eef0a9dfd06a78d31546d2b242db1423dd2af472aa0ca55c7232493",
  "cbd32663e1efc61b21ad82e7d25d26b9b6a36dc78f93eb0eec380c705c6cc07c",
  "adc354cef510a76a6d50b50a3e7d96bf3670f3fe6c01de47f17f65fad622f572",
  "9d24607e41c97a052f2fe4fc7f52f876db1759f93b676d8a7567f640b88b84c9",
  "a375f00f7ae4c6b3eae21d365acbedd6fdaf32aad879f10e436eaec3b617f594",
  "d685e2465a8f1afd5f4c321b1d3a61d0cb1d1e04acd7dad132a67ff575982a85",
  "7b4b2c38494473cc0431b7fbeffcbfd94113fde9eb6516c16541a2454ed65bdb",
  "3417522bf23e3d23a50b9c0ad68e989f340cc890cbe89724d28ce67ce11b9e37",
  "5c6d0c3dc403a670a7f38a436e6173f9c4893c1bdc8ab0156b210544720eacda",
  "52fa5b215c458c9e6bb1be6b95d3600650ec6892c92b8a88e33ce0bfcf365818",
  "14270899bd414c2ddb2e2b2c0d6f7306707d3aabf8cbeaf1e27c6ef8ab09bc7d",
  "abd2de9e95a1095aa2af017514e1718a424f81aac5d3e3ad4cd27a1eecd9546a",
  "06edde4cc5c9b2157c2877ce63aedcefa87af4d0583dc50bfbfde7349728e301",
  "5e2cb3755e74ab41abf5bfdbe45dc044380758202b78f88a7287f2768754850e",
  "44d8ea762558c88c95cb4d782c943a222934c4956bbcf1b2b03eb4ed973e6677",
  "62e7dd17e16a46df5614055b8ccc507ae46ffc90c8e1f5d5e8bedfd89c97576c",
  "bd88c5eaff5da36422fae67b64d1a4d61644a3336e5bc59d0e5560fa6a2e658d",
  "2bfc83c85fdbc3b14a68edb7c40d0e8fab7523250c7d4aae1d7326953f7b9939",
  "8ba84654aabd88172f77ba41b3f501f48b12c2f35a41c06353880ed2d6315fc6",
  "84999a55defe991569e120834b49e690a1e268f9e2ce506ef049ed32e54ce989",
  "95a6d73bdc82fd2f5165151e9566c9f75fa85a4f750e022fd56cb233ed29f708",
  "13b8eaf178ef3af05a3e3303dabebb910bec74a10492a715f43dc4779ed0152e",
  "8d56c277c5e453ce6ebb1f62591650de5442435b2affc968e0a34fe8374e2153",
  "0cef359a6fdf521f0034b2e20ebdff00a1d58b8431df328d5c4ca9ccc8f4a267",
  "821aa160f4c721902c0453544b9e8b78121e900e6e4ac4a6d8bdb4cf04da0ef3",
  "afc2c5d90d703fdc0122d61e27410470a2a62ee205aee45b0e95a5ceee7e6113",
  "a63ccaef7f78a3418ae7ca31477796e8e885f7b97d9bf8aac4453859b9a0a091",
  "3b1f5b3365af59c6b7bb2f6928e221d748e6db96a7ac6cb95249ae59abe13fdd",
  "a15d4fd19430b02bb906bd33906e796ea5e64ba4043afaa8ed5a8a8caaeea6ca",
  "677593226aecf96bd78a89b7e9164c46bab28e00035ed136a16c2561c802d2ac",
  "c2842f3f5de4f957de4915a87488240496806c41cb20033d160410bbf514ef91",
  "69473e127caa031e84d2ba67ab27acaa5e296dc018de1e1bcd9a1d203054b979",
  "78c37035da49bfc6831d22bef489cffcec6fb59125574fda2aa0a99c679981e5",
  "d9e839ad689c7c28899a85e91e28d67582110cb30d65330360450bf7b9e81980",
  "cfbeb46f904bf697c42abd7fb93ce5bd89674a995c456f9704ffa7be65e15de4",
  "f3751a668c4255a36f049f3e34b1b6ea0008bf4f96d16d02a43e27fd4ea45c8c",
  "2fbb2f5fc88a61c971b6934ad2256a379297ea4c9e7e60e7457964a584990814",
  "54728d33dd9ac982159eb8a2a1efcf90555e4cedc76a9ccbe92c3333ce64a711",
  "f1c401e33daf46ad2a15c8301fa44bf36fb9e5694dde16feda3285e54b4253ef",
  "d30b5c7175c14c7fc04549fc2106ff5d811045f65789db3166c7fdf227c29268",
  "ff08cb399c2649ae036418a6213a627744e291a2df8c2a160ff0e85848d94eae",
  "5bd90c5c30a08e011e14b274c0ffe795354f3e94f2c717c74e13e2e56d19ab7b",
  "832e46994cd0e62a299d1468dc1d21f311121e085310956ff16c2e634384c103",
  "36e01a06a2ac535b7ce64460b9368c94e50beb5a09fd64c657c6b1d99c929900",
  "154f98b0067c3c78a5e565fe57f99dab0338ca9588a7e7ee139a24a5f47ccfda",
  "0124caf2cc77c5d63afdbb3f8b2a0051b2def6224c356b5d6f2591484c8cc720",
  "6ea8ce5c622019bd9dea5aa22eb5a1e55f90c36c6fa2221c140a09ea55515963",
  "18ef9773e18265c7efcede3810e9f0f628975abad83e8fe1fe60523ef7e7a6f4",
  "f5528623b0a5408956e08dbc223bb70804327e8b5ae6ac7ef7129a9f15e23b54",
  "9fa6998ffc39d9e9f7730233d1ed121641fc8d1ba7c52d56743c225587a48642",
  "62f0708b3a187cca7d25fcaecbe4affd202444e596373b245106c76dfa23d618",
  "e1899e342cac1066316ab3988632fea1051c0a27cda9a7a90cd4b11b8c8ae0a4",
  "aa8f5e5ff99caf63a0b65b9b010611c424004b71c3f105c721e4f0c234043e49",
  "0415ac65f3a911025ca9426d464601cf3d416a0ccba1be59540897ab30fb762f",
  "dad9e7373eefbeacb7c5f978bd7f707c8f7830c162856f1587ca7f2d1acaad79",
  "c2a4032ec374ed8808e1f885c8584feea27d51c8183dfa2c4d9c3b8126a335e0",
  "cfb867d4bc34d4f4fbf09548f0767ba7b2197785eb74e13f859c2b55b1af7ee7",
  "153358e85df0fb8d68d98da4b8ba47d21a5e30b115e8bcea105e28c04a7fe501",
  "e1500a73d98bec5a2f3dd3c16e0c298ef88205cc9506dd0866756098529657cd",
  "2b20fc8320813f19725129912cc07f4ed67ce70d94182bace769be9380f3b8f9",
  "f68d44abb3c68e36c4917460d1b6b1f4046b9114d3883e4eed06e635d0acec57",
  "df0cdc5114638747c2fac55c5b9b482fa07927cd74b5fc6d76e2fbe250a68279",
  "3ab3c7001042e46602ff7dde56cbc82366b276d73f2b3b2b606c79489075e99e",
  "63a4c6d804433549d01d8de06b4299933a7c1fd367f26a8bd235172af940d3b0",
  "469baf6b30f204cc0e113cd60df4e5cac505f3bc99ac9b6b0d666cd13ac6f636",
  "e6b553f1f99bd52505f9ce1c0ffef67b652bd3b025d8c7d7ce062ba21dc3d6ab",
  "db53e1d3e05a321d4fc05f64740d0fac8f82d977b5ee6c9a790ccba9ffb55ebd",
  "3a7a224e6499aaf97ef21346eb9a92fb6a605f0d32171499ec0a90571dffeca0",
  "4a1a39ed6929b3d5978f80d67482bf684b38cbdcf121f465d04c6174e02e8d52",
  "cf2357c775b74816a124e2685e554ca3ff70a414507ac52807add8ab12577c5c",
  "cb41eceb44f1103df9c1d3ebe8b814597a77da2f1590f67b7dc5906498975fac",
  "5011bdaa1abff42f05dff1fac366b9cb320141b5ec7b9949002373a2f19e3974",
  "4fecc06ecf96c8fb4e42d5ccfe9f80d662ac11a7b71d890fede6f6c575858293",
  "b0c8dba8c37414420d027de162897aae184bb0b06b0673d75ac59be4b2b30cd7",
  "bd5fcbe27226e7f09a6283ee7631aa8db21c45995e7108363a098a6b4ba824fb",
  "09eb9ad164e6b5e361aea57e35d5813faeecb91015770e6dc5c4bcef92fc7fb8",
  "695a334c8bf7e4e829145f9b919730a1a596a54d72c688e7c97c9e05edf31e23",
  "d5c4ad339db17f827192d373d51d9796d3a751eff7216ad9ba7e66c1a4cd665a",
  "60184e6487203126aa9893eb17506472984480ecdd415ab85326dc930e8d77bf",
  "0f7458870cc80903cceaaa5a9dceee8e98c9b820ec97f004ec67aa6720db8273",
  "86285f32f5da4d4c549234549c169cb4f10d283b05674b18966a7d899082f0ac"
]
);

const STORAGE_KEY = "reshape.license.v1";

// After you deploy license-server (Cloudflare Worker free tier), paste the URL:
// e.g. "https://reshape-license.YOUR_SUBDOMAIN.workers.dev"
// Leave null for offline-only mode (no cross-device lock).
const LICENSE_SERVER_URL = "https://reshape-license.reshape404.workers.dev/";

function sha256Hex(str) {
  // Web Crypto (available in extension pages + service worker)
  const data = new TextEncoder().encode(str);
  return crypto.subtle.digest("SHA-256", data).then((buf) => {
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  });
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

async function getOrCreateDeviceId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["deviceId"], (data) => {
      if (data.deviceId) {
        resolve(data.deviceId);
        return;
      }
      const id =
        (crypto.randomUUID && crypto.randomUUID()) ||
        `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      chrome.storage.local.set({ deviceId: id }, () => resolve(id));
    });
  });
}

async function loadLicense() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (data) => {
      resolve(data[STORAGE_KEY] || null);
    });
  });
}

async function saveLicense(record) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: record }, resolve);
  });
}

async function clearLicense() {
  return new Promise((resolve) => {
    chrome.storage.local.remove([STORAGE_KEY], resolve);
  });
}

/**
 * Check if a plain key is in the valid set (by hash).
 */
async function isValidKey(plainKey) {
  const key = normalizeKey(plainKey);
  if (!isKeyFormatValid(key)) return false;
  const hash = await sha256Hex(key);
  return LICENSE_HASHES.has(hash);
}

/**
 * Activate a key on this device.
 * Returns { ok: true, record } or { ok: false, error }
 */
async function activateLicense(plainKey) {
  const key = normalizeKey(plainKey);
  if (!isKeyFormatValid(key)) {
    return { ok: false, error: "Invalid key format. Expected RSHP-XXXX-XXXX-XXXX-XXXX" };
  }

  const valid = await isValidKey(key);
  if (!valid) {
    return { ok: false, error: "This key is not valid." };
  }

  const deviceId = await getOrCreateDeviceId();

  // Optional online activation (single-seat server)
  if (LICENSE_SERVER_URL) {
    try {
      const res = await fetch(LICENSE_SERVER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, deviceId, action: "activate" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.ok === false) {
        return {
          ok: false,
          error: body.error || "This key is already active on another device.",
        };
      }
    } catch (e) {
      return { ok: false, error: "Could not reach license server. Try again." };
    }
  }

  const record = {
    key,
    deviceId,
    activatedAt: Date.now(),
    plan: "pro",
  };
  await saveLicense(record);
  return { ok: true, record };
}

/**
 * Returns true if this installation has an active Pro license.
 */
async function isLicensed() {
  const record = await loadLicense();
  if (!record || !record.key) return false;

  // Re-validate key still in valid set (in case you revoke hashes in an update)
  const stillValid = await isValidKey(record.key);
  if (!stillValid) {
    await clearLicense();
    return false;
  }

  // Device binding: key must match this profile's deviceId
  const deviceId = await getOrCreateDeviceId();
  if (record.deviceId && record.deviceId !== deviceId) {
    return false;
  }

  // Optional periodic online check
  if (LICENSE_SERVER_URL) {
    try {
      const res = await fetch(LICENSE_SERVER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: record.key,
          deviceId,
          action: "check",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (body.ok === false) {
        await clearLicense();
        return false;
      }
    } catch {
      // Offline: trust local license
    }
  }

  return true;
}

// Expose for popup / dashboard / background (classic scripts, not modules)
if (typeof globalThis !== "undefined") {
  globalThis.ReshapeLicense = {
    activateLicense,
    isLicensed,
    loadLicense,
    clearLicense,
    normalizeKey,
    isKeyFormatValid,
  };
}
