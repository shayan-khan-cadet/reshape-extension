importScripts("license.js");

const DEFAULT_SCRIPT = `function modifyResponse(args) {
  const { responseJSON } = args;
  return responseJSON;
}`;

const DEFAULT_RULES = [
  {
    id: "rule-user-pro",
    name: "Upgrade user to Pro",
    description: "Replace a demo user payload with a Pro plan account.",
    enabled: true,
    resourceType: "rest",
    matchTarget: "url",
    matchOperator: "contains",
    matchValue: "/api/demo/user",
    method: "GET",
    statusCode: 200,
    bodyMode: "static",
    staticBody: JSON.stringify(
      {
        id: "u_ada",
        name: "Ada Lovelace",
        email: "ada@analytical.engine",
        plan: "pro",
        seats: 25,
        features: { sso: true, auditLog: true },
        rewrittenBy: "Reshape",
      },
      null,
      2
    ),
    dynamicScript: DEFAULT_SCRIPT,
    serveWithoutRequest: false,
  },
  {
    id: "rule-product-prices",
    name: "Slash product prices",
    description: "Rewrite every item price to $0.01.",
    enabled: true,
    resourceType: "rest",
    matchTarget: "url",
    matchOperator: "contains",
    matchValue: "/api/demo/products",
    method: "GET",
    statusCode: null,
    bodyMode: "dynamic",
    staticBody: "",
    dynamicScript: `function modifyResponse(args) {
  const { responseJSON } = args;
  if (responseJSON && Array.isArray(responseJSON.items)) {
    responseJSON.items = responseJSON.items.map((item) => ({
      ...item,
      price: 0.01,
      originalPrice: item.price,
    }));
    responseJSON.rewrittenBy = "Reshape";
  }
  return responseJSON;
}`,
    serveWithoutRequest: false,
  },
  {
    id: "rule-checkout-500",
    name: "Force checkout 500",
    description: "Simulate a payment-service outage.",
    enabled: true,
    resourceType: "rest",
    matchTarget: "url",
    matchOperator: "contains",
    matchValue: "/api/demo/orders",
    method: "POST",
    statusCode: 500,
    bodyMode: "static",
    staticBody: JSON.stringify(
      {
        error: "Payment service unavailable",
        code: "PAYMENT_DOWN",
        rewrittenBy: "Reshape",
      },
      null,
      2
    ),
    dynamicScript: DEFAULT_SCRIPT,
    serveWithoutRequest: false,
  },
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["rules"], (data) => {
    if (!data.rules || !Array.isArray(data.rules) || data.rules.length === 0) {
      chrome.storage.local.set({
        interceptorOn: true,
        rules: DEFAULT_RULES,
      });
    }
  });
});

// Relay storage changes to all tabs so content scripts re-sync
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id != null) {
        chrome.tabs
          .sendMessage(tab.id, { type: "RESHAPE_RULES_UPDATED" })
          .catch(() => {});
      }
    }
  });
});

// Open dashboard in a new tab when requested
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "OPEN_DASHBOARD") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
  }
});
