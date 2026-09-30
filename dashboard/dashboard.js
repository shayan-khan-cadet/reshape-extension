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

function toast(msg, kind = "ok") {
  const el = $("#toast");
  el.textContent = msg;
  el.className = "toast " + kind;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.classList.add("hidden");
  }, 2200);
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
      '<li style="color:var(--muted);padding:16px;text-align:center;font-size:12px">No rules</li>';
    return;
  }
  rules.forEach((r) => {
    const li = document.createElement("li");
    li.className =
      "rule-item" +
      (r.enabled ? "" : " off") +
      (r.id === editingId ? " active" : "");
    li.innerHTML = `
      <input type="checkbox" class="enable" ${r.enabled ? "checked" : ""} />
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
        toast(r.enabled ? "Rule enabled" : "Rule disabled");
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

  $("#emptyState").classList.add("hidden");
  $("#editor").classList.remove("hidden");

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
  renderList();
}

function toggleBodyMode() {
  const mode = $("#fBodyMode").value;
  $("#staticWrap").classList.toggle("hidden", mode !== "static");
  $("#dynamicWrap").classList.toggle("hidden", mode !== "dynamic");
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
  rules[idx] = { ...rules[idx], ...collectForm() };
  await save();
  renderList();
  $("#editorTitle").textContent = rules[idx].name;
  toast("Rule saved");
}

async function deleteRule() {
  if (!editingId) return;
  if (!confirm("Delete this rule?")) return;
  rules = rules.filter((r) => r.id !== editingId);
  editingId = null;
  await save();
  $("#editor").classList.add("hidden");
  $("#emptyState").classList.remove("hidden");
  renderList();
  toast("Rule deleted");
}

async function duplicateRule() {
  if (!editingId) return;
  const src = rules.find((r) => r.id === editingId);
  if (!src) return;
  const copy = {
    ...src,
    id: uid(),
    name: (src.name || "Rule") + " copy",
  };
  const idx = rules.findIndex((r) => r.id === editingId);
  rules.splice(idx + 1, 0, copy);
  await save();
  openEditor(copy.id);
  toast("Rule duplicated");
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
  openEditor(rule.id);
  toast("Rule created");
}

async function restoreSamples() {
  if (!confirm("Replace all current rules with the sample set?")) return;
  rules = SAMPLE_RULES.map((r) => ({ ...r, id: uid() }));
  editingId = null;
  await save();
  $("#editor").classList.add("hidden");
  $("#emptyState").classList.remove("hidden");
  renderList();
  toast("Samples restored");
}

function exportRules() {
  const blob = new Blob([JSON.stringify(rules, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "reshape-rules.json";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Exported");
}

function importRules() {
  $("#importFile").click();
}

function onImportFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed)) throw new Error("Expected array");
      rules = parsed.map((r) => ({
        ...r,
        id: r.id || uid(),
      }));
      editingId = null;
      await save();
      $("#editor").classList.add("hidden");
      $("#emptyState").classList.remove("hidden");
      renderList();
      toast(`Imported ${rules.length} rule(s)`);
    } catch (err) {
      toast("Import failed: invalid JSON", "err");
    }
    e.target.value = "";
  };
  reader.readAsText(file);
}

// Init
(async () => {
  const gate = $("#licenseGate");
  const app = $("#appRoot");

  const licensed = await ReshapeLicense.isLicensed();
  if (!licensed) {
    gate.classList.remove("hidden");
    if (app) app.classList.add("hidden");
  } else {
    gate.classList.add("hidden");
    if (app) app.classList.remove("hidden");
  }

  $("#btnActivate")?.addEventListener("click", async () => {
    const err = $("#licenseError");
    err?.classList.add("hidden");
    const result = await ReshapeLicense.activateLicense($("#licenseInput").value);
    if (!result.ok) {
      if (err) {
        err.textContent = result.error || "Activation failed";
        err.classList.remove("hidden");
      }
      return;
    }
    gate.classList.add("hidden");
    if (app) app.classList.remove("hidden");
    toast("License activated");
    await load();
    $("#interceptorToggle").checked = interceptorOn;
    renderList();
  });

  $("#licenseInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#btnActivate")?.click();
  });

  await load();
  $("#interceptorToggle").checked = interceptorOn;
  if (licensed) renderList();

  $("#interceptorToggle").addEventListener("change", async (e) => {
    interceptorOn = e.target.checked;
    await save();
    toast(interceptorOn ? "Interceptor ON" : "Interceptor OFF");
  });

  $("#btnAdd").addEventListener("click", addRule);
  $("#btnSamples").addEventListener("click", restoreSamples);
  $("#btnExport").addEventListener("click", exportRules);
  $("#btnImport").addEventListener("click", importRules);
  $("#importFile").addEventListener("change", onImportFile);
  $("#btnSave").addEventListener("click", saveEditor);
  $("#btnDelete").addEventListener("click", deleteRule);
  $("#btnDuplicate").addEventListener("click", duplicateRule);
  $("#fBodyMode").addEventListener("change", toggleBodyMode);

  $("#fName").addEventListener("input", () => {
    if (editingId) {
      const r = rules.find((x) => x.id === editingId);
      if (r) {
        r.name = $("#fName").value;
        renderList();
      }
    }
  });
})();
