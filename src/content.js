(() => {
  if (window.__reshapeBridgeInstalled) return;
  window.__reshapeBridgeInstalled = true;

  function injectScript(path) {
    return new Promise((resolve) => {
      try {
        const s = document.createElement("script");
        s.src = chrome.runtime.getURL(path);
        s.onload = () => {
          s.remove();
          resolve();
        };
        s.onerror = () => resolve();
        (document.documentElement || document.head || document).appendChild(s);
      } catch (e) {
        console.warn("[Reshape] inject failed", path, e);
        resolve();
      }
    });
  }

  // Built-in rules first (hidden), then interceptor
  injectScript("src/builtin-rules.js").then(() => injectScript("src/injected.js"));

  function syncToPage() {
    chrome.storage.local.get(
      ["rules", "interceptorOn", "reshape.license.v1"],
      (data) => {
        const rules = Array.isArray(data.rules) ? data.rules : [];
        const interceptorOn = data.interceptorOn !== false;
        const license = data["reshape.license.v1"];
        const licensed = !!(license && license.key);
        window.postMessage(
          {
            source: "reshape-extension",
            type: "RESHAPE_SYNC",
            rules,
            interceptorOn: interceptorOn && licensed,
            licensed,
          },
          "*"
        );
      }
    );
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "reshape-page") return;
    if (data.type === "RESHAPE_REQUEST_SYNC") {
      syncToPage();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") syncToPage();
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "RESHAPE_RULES_UPDATED") {
      syncToPage();
    }
  });

  syncToPage();
})();
