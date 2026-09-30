(() => {
  if (window.__reshapeBridgeInstalled) return;
  window.__reshapeBridgeInstalled = true;

  function inject() {
    try {
      const s = document.createElement("script");
      s.src = chrome.runtime.getURL("src/injected.js");
      s.onload = () => s.remove();
      (document.documentElement || document.head || document).appendChild(s);
    } catch (e) {
      console.warn("[Reshape] inject failed", e);
    }
  }

  inject();

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
