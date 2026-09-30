const $ = (sel) => document.querySelector(sel);

const DEFAULT_SCRIPT = `function modifyResponse(args) {
  const { responseJSON } = args;
  // Mutate or return a new object / string
  return responseJSON;
}`;

const SAMPLE_RULES = [
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

let rules = [];
let interceptorOn = true;
let editingId = null;

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `rule-${Date.now()}`;
}

function load() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["rules", "interceptorOn"], (data) => {
      rules =
        Array.isArray(data.rules) && data.rules.length
          ? data.rules
          : SAMPLE_RULES;
      interceptorOn = data.interceptorOn !== false;
      resolve();
    });
  });
}

function save() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ rules, interceptorOn }, resolve);
  });
}

function setStatus(msg) {
  $("#statusText").textContent = msg;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderList() {
  const list = $("#ruleList");
  list.innerHTML = "";
  if (!rules.length) {
    list.innerHTML =
      '<li style="color:var(--muted);padding:20px;text-align:center">No rules yet</li>';
    return;
  }
  rules.forEach((r) => {
    const li = document.createElement("li");
    li.className = "rule-item" + (r.enabled ? "" : " off");
    li.innerHTML = `
      <input type="checkbox" class="enable" ${r.enabled ? "checked" : ""} data-id="${r.id}" />
      <div class="rule-meta">
        <strong>${escapeHtml(r.name || "Untitled")}</strong>
        <span>${escapeHtml(r.matchOperator)} “${escapeHtml(r.matchValue || "")}” · ${r.method || "ANY"}</span>
      </div>
      <span class="badge">${r.bodyMode === "dynamic" ? "script" : "static"}</span>
    `;
    li.querySelector(".enable").addEventListener("click", (e) => {
      e.stopPropagation();
      r.enabled = e.target.checked;
      save().then(() => {
        renderList();
        setStatus(r.enabled ? "Rule enabled" : "Rule disabled");
      });
    });
    li.addEventListener("click", () => openEditor(r.id));
    list.appendChild(li);
  });
}

function openEditor(id) {
  editingId = id;
  const r = rules.find((x) => x.id === id);
  if (!r) return;

  $("#editorTitle").textContent = r.name || "Edit rule";
  $("#fName").value = r.name || "";
  $("#fDesc").value = r.description || "";
  $("#fMatchTarget").value = r.matchTarget || "url";
  $("#fMatchOp").value = r.matchOperator || "contains";
  $("#fMatchValue").value = r.matchValue || "";
  $("#fMethod").value = r.method || "ANY";
  $("#fStatus").value = r.statusCode != null ? String(r.statusCode) : "";
  $("#fBodyMode").value = r.bodyMode || "static";
  $("#fStaticBody").value = r.staticBody || "";
  $("#fDynamicScript").value = r.dynamicScript || DEFAULT_SCRIPT;
  $("#fServeLocal").checked = !!r.serveWithoutRequest;

  toggleBodyMode();
  $("#editor").classList.remove("hidden");
}

function toggleBodyMode() {
  const mode = $("#fBodyMode").value;
  $("#staticWrap").classList.toggle("hidden", mode !== "static");
  $("#dynamicWrap").classList.toggle("hidden", mode !== "dynamic");
}

function closeEditor() {
  editingId = null;
  $("#editor").classList.add("hidden");
}

function collectForm() {
  const statusVal = $("#fStatus").value;
  return {
    name: $("#fName").value.trim() || "Untitled",
    description: $("#fDesc").value.trim(),
    matchTarget: $("#fMatchTarget").value,
    matchOperator: $("#fMatchOp").value,
    matchValue: $("#fMatchValue").value.trim(),
    method: $("#fMethod").value,
    statusCode: statusVal ? Number(statusVal) : null,
    bodyMode: $("#fBodyMode").value,
    staticBody: $("#fStaticBody").value,
    dynamicScript: $("#fDynamicScript").value,
    serveWithoutRequest: $("#fServeLocal").checked,
    resourceType: "rest",
  };
}

async function saveEditor() {
  if (!editingId) return;
  const idx = rules.findIndex((r) => r.id === editingId);
  if (idx < 0) return;
  const patch = collectForm();
  rules[idx] = { ...rules[idx], ...patch };
  await save();
  closeEditor();
  renderList();
  setStatus("Rule saved");
}

async function deleteRule() {
  if (!editingId) return;
  rules = rules.filter((r) => r.id !== editingId);
  await save();
  closeEditor();
  renderList();
  setStatus("Rule deleted");
}

async function addRule() {
  const rule = {
    id: uid(),
    name: "New rule",
    description: "",
    enabled: true,
    resourceType: "rest",
    matchTarget: "url",
    matchOperator: "contains",
    matchValue: "/api/",
    method: "ANY",
    statusCode: null,
    bodyMode: "static",
    staticBody: '{\n  "ok": true\n}',
    dynamicScript: DEFAULT_SCRIPT,
    serveWithoutRequest: false,
  };
  rules.unshift(rule);
  await save();
  renderList();
  openEditor(rule.id);
  setStatus("Rule created");
}

async function restoreSamples() {
  if (!confirm("Replace all rules with the sample set?")) return;
  rules = SAMPLE_RULES.map((r) => ({ ...r, id: uid() }));
  await save();
  renderList();
  setStatus("Samples restored");
}

function openDashboard() {
  // Opens the options page in a full browser tab
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    chrome.tabs.create({
      url: chrome.runtime.getURL("dashboard/dashboard.html"),
    });
  }
  window.close();
}

// Init
(async () => {
  const gate = $("#licenseGate");
  const app = $("#appRoot");

  async function showApp() {
    gate.classList.add("hidden");
    app.classList.remove("hidden");
  }

  async function showGate() {
    gate.classList.remove("hidden");
    app.classList.add("hidden");
  }

  const licensed = await ReshapeLicense.isLicensed();
  if (!licensed) {
    await showGate();
  } else {
    await showApp();
  }

  $("#btnActivate").addEventListener("click", async () => {
    const input = $("#licenseInput");
    const err = $("#licenseError");
    err.classList.add("hidden");
    const result = await ReshapeLicense.activateLicense(input.value);
    if (!result.ok) {
      err.textContent = result.error || "Activation failed";
      err.classList.remove("hidden");
      return;
    }
    await showApp();
    await load();
    $("#interceptorToggle").checked = interceptorOn;
    renderList();
    setStatus("License activated — Pro unlocked");
  });

  $("#licenseInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#btnActivate").click();
  });

  if (!licensed) {
    // Still wire nothing else until activated — re-run after activate via showApp path
    // Load data only when licensed
  }

  await load();
  $("#interceptorToggle").checked = interceptorOn;
  if (licensed) {
    renderList();
    setStatus(
      interceptorOn
        ? `${rules.filter((r) => r.enabled).length} active rule(s)`
        : "Interceptor OFF"
    );
  }

  $("#interceptorToggle").addEventListener("change", async (e) => {
    interceptorOn = e.target.checked;
    await save();
    setStatus(interceptorOn ? "Interceptor ON" : "Interceptor OFF");
  });

  $("#btnAdd").addEventListener("click", addRule);
  $("#btnOpenTab").addEventListener("click", openDashboard);
  $("#btnSamples").addEventListener("click", restoreSamples);
  $("#btnCloseEditor").addEventListener("click", closeEditor);
  $("#btnSave").addEventListener("click", saveEditor);
  $("#btnDelete").addEventListener("click", deleteRule);
  $("#fBodyMode").addEventListener("change", toggleBodyMode);
})();
