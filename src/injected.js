(() => {
  if (window.__reshapeMainInstalled) return;
  window.__reshapeMainInstalled = true;

  let rules = [];
  let interceptorOn = true;
  let licensed = false;

  // Receive rules + license state from content script bridge
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "reshape-extension") return;
    if (data.type === "RESHAPE_SYNC") {
      rules = Array.isArray(data.rules) ? data.rules : [];
      licensed = data.licensed === true;
      interceptorOn = data.interceptorOn !== false && licensed;
    }
  });

  // Ask content script for initial rules
  window.postMessage({ source: "reshape-page", type: "RESHAPE_REQUEST_SYNC" }, "*");

  // ---- matching ----
  function safeUrl(raw) {
    try {
      return new URL(raw, location.origin);
    } catch {
      return null;
    }
  }

  function wildcardToRegExp(pattern) {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    return new RegExp(`^${escaped}$`);
  }

  function matchTargetValue(rule, rawUrl) {
    const parsed = safeUrl(rawUrl);
    if (!parsed) return rawUrl;
    if (rule.matchTarget === "host") return parsed.host;
    if (rule.matchTarget === "path") return parsed.pathname + parsed.search;
    return parsed.href;
  }

  function urlMatches(rule, rawUrl) {
    const needle = (rule.matchValue || "").trim();
    if (!needle) return false;
    const target = matchTargetValue(rule, rawUrl);

    switch (rule.matchOperator) {
      case "equals": {
        if (target === needle || rawUrl === needle) return true;
        const parsed = safeUrl(rawUrl);
        if (parsed && needle.startsWith("/")) {
          return (
            parsed.pathname === needle ||
            parsed.pathname + parsed.search === needle
          );
        }
        return parsed?.host === needle;
      }
      case "contains":
        return target.includes(needle) || rawUrl.includes(needle);
      case "wildcard":
        try {
          const re = wildcardToRegExp(needle);
          return re.test(target) || re.test(rawUrl);
        } catch {
          return false;
        }
      case "regex":
        try {
          return new RegExp(needle).test(target) || new RegExp(needle).test(rawUrl);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  function methodMatches(rule, method) {
    if (!rule.method || rule.method === "ANY") return true;
    return rule.method === String(method).toUpperCase();
  }

  function findMatchingRule(url, method) {
    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (!urlMatches(rule, url)) continue;
      if (!methodMatches(rule, method)) continue;
      return rule;
    }
    return null;
  }

  // ---- apply ----
  function looksLikeJson(text) {
    const t = (text || "").trim();
    if (!t) return false;
    const c = t[0];
    return c === "{" || c === "[" || t === "null" || t === "true" || t === "false";
  }

  function applyRule(rule, ctx) {
    const originalBody = ctx.body;
    const status = rule.statusCode != null ? Number(rule.statusCode) : ctx.status;

    try {
      if (rule.bodyMode === "static") {
        const body = rule.staticBody || "";
        return {
          body,
          status,
          modified: body !== originalBody || status !== ctx.status,
        };
      }

      let responseJSON = null;
      try {
        responseJSON = originalBody ? JSON.parse(originalBody) : null;
      } catch {
        responseJSON = null;
      }

      const source =
        (rule.dynamicScript || "").trim() ||
        "function modifyResponse() { return undefined; }";
      // eslint-disable-next-line no-new-func
      const factory = new Function(`${source}\n; return modifyResponse;`);
      const fn = factory();
      if (typeof fn !== "function") {
        throw new Error("Script must define function modifyResponse(args)");
      }
      const result = fn({
        method: ctx.method,
        url: ctx.url,
        response: originalBody,
        responseType: ctx.contentType,
        requestHeaders: ctx.requestHeaders || {},
        responseJSON,
      });

      let body = originalBody;
      if (result !== undefined) {
        body =
          typeof result === "string"
            ? result
            : JSON.stringify(result, null, 2);
      }
      return {
        body,
        status,
        modified: body !== originalBody || status !== ctx.status,
      };
    } catch (err) {
      console.warn("[Reshape] rule error:", err);
      return { body: originalBody, status: ctx.status, modified: false };
    }
  }

  // ---- patch fetch (MAIN world) ----
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function reshapeFetch(input, init) {
    if (!interceptorOn) return originalFetch(input, init);

    let url = "";
    let method = "GET";
    try {
      const req =
        input instanceof Request ? input.clone() : new Request(input, init);
      url = req.url;
      method = (req.method || "GET").toUpperCase();
    } catch {
      return originalFetch(input, init);
    }

    const rule = findMatchingRule(url, method);
    if (!rule) return originalFetch(input, init);

    if (rule.serveWithoutRequest) {
      const applied = applyRule(rule, {
        method,
        url,
        body: "",
        status: 200,
        contentType: "application/json",
        requestHeaders: {},
      });
      return new Response(applied.body, {
        status: applied.status,
        headers: {
          "Content-Type": "application/json",
          "X-Reshape": "1",
        },
      });
    }

    const response = await originalFetch(input, init);
    const contentType = response.headers.get("content-type") || "";
    let bodyText = "";
    try {
      bodyText = await response.clone().text();
    } catch {
      return response;
    }

    const applied = applyRule(rule, {
      method,
      url,
      body: bodyText,
      status: response.status,
      contentType,
      requestHeaders: {},
    });

    if (!applied.modified) return response;

    const headers = new Headers(response.headers);
    headers.set("X-Reshape", "1");
    if (looksLikeJson(applied.body)) {
      headers.set("Content-Type", "application/json");
    }

    return new Response(applied.body, {
      status: applied.status,
      statusText: response.statusText,
      headers,
    });
  };

  // ---- patch XHR (MAIN world) ----
  const OriginalXHR = window.XMLHttpRequest;

  function ReshapeXHR() {
    const xhr = new OriginalXHR();
    let _url = "";
    let _method = "GET";

    const origOpen = xhr.open;
    xhr.open = function (method, url, ...rest) {
      _method = (method || "GET").toUpperCase();
      _url = String(url);
      return origOpen.call(this, method, url, ...rest);
    };

    const origSend = xhr.send;
    xhr.send = function (body) {
      if (!interceptorOn) return origSend.call(this, body);

      const rule = findMatchingRule(_url, _method);
      if (!rule) return origSend.call(this, body);

      if (rule.serveWithoutRequest) {
        const applied = applyRule(rule, {
          method: _method,
          url: _url,
          body: "",
          status: 200,
          contentType: "application/json",
          requestHeaders: {},
        });
        // Simulate successful response
        const fire = () => {
          Object.defineProperty(xhr, "readyState", { configurable: true, get: () => 4 });
          Object.defineProperty(xhr, "status", { configurable: true, get: () => applied.status });
          Object.defineProperty(xhr, "statusText", { configurable: true, get: () => "OK" });
          Object.defineProperty(xhr, "responseText", { configurable: true, get: () => applied.body });
          Object.defineProperty(xhr, "response", { configurable: true, get: () => applied.body });
          xhr.dispatchEvent(new Event("readystatechange"));
          xhr.dispatchEvent(new Event("load"));
          xhr.dispatchEvent(new Event("loadend"));
        };
        setTimeout(fire, 0);
        return;
      }

      xhr.addEventListener("load", function onLoad() {
        if (xhr.readyState !== 4) return;
        const applied = applyRule(rule, {
          method: _method,
          url: _url,
          body: xhr.responseText || "",
          status: xhr.status,
          contentType: xhr.getResponseHeader("content-type") || "",
          requestHeaders: {},
        });
        if (applied.modified) {
          try {
            Object.defineProperty(xhr, "responseText", {
              configurable: true,
              get: () => applied.body,
            });
            Object.defineProperty(xhr, "response", {
              configurable: true,
              get: () => applied.body,
            });
            Object.defineProperty(xhr, "status", {
              configurable: true,
              get: () => applied.status,
            });
          } catch (e) {
            /* some browsers lock these */
          }
        }
      });

      return origSend.call(this, body);
    };

    return xhr;
  }
  ReshapeXHR.prototype = OriginalXHR.prototype;
  ReshapeXHR.UNSENT = OriginalXHR.UNSENT;
  ReshapeXHR.OPENED = OriginalXHR.OPENED;
  ReshapeXHR.HEADERS_RECEIVED = OriginalXHR.HEADERS_RECEIVED;
  ReshapeXHR.LOADING = OriginalXHR.LOADING;
  ReshapeXHR.DONE = OriginalXHR.DONE;
  window.XMLHttpRequest = ReshapeXHR;

  console.log("[Reshape] MAIN-world interceptor installed");
})();
