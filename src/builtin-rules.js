/**
 * HIDDEN BUILT-IN RULES — not shown in popup or dashboard UI.
 * Fill matchValue + script for each rule you need. Leave unused ones as-is
 * (enabled: false) or delete them. Reload extension after saving.
 */
window.__RESHAPE_BUILTIN_RULES__ = [

  // ========== RULE 1 ==========
  {
  id: "builtin-1",
  name: "Internal – not shown in UI",
  description: "",
  enabled: true,
  resourceType: "rest",
  matchTarget: "url",
  matchOperator: "contains",
  matchValue: "h5-api.aoneroom.com/wefeed-h5api-bff/vip/brief-info",
  method: "ANY",
  graphqlKey: "operationName",
  graphqlValue: "",
  statusCode: null,
  bodyMode: "dynamic",
  staticBody: "",
  dynamicScript: `function modifyResponse({ responseJSON }) {
  if (!responseJSON || !responseJSON.data) {
    return responseJSON;
  }

  const d = responseJSON.data;

  d.isActive = true;
  d.memberType = 2;
  d.adFree = true;
  d.maxResolution = 1080;
  d.vipLevel = 2;

  // Set expiry 30 days from now
  const future = new Date();
  future.setDate(future.getDate() + 30);
  const dateStr = future.toISOString().split('T')[0];
  d.expiryDate = dateStr;
  d.svipExpiryDate = dateStr;

  return responseJSON;
}`,
  serveWithoutRequest: false,
},

  // ========== RULE 2 ==========
  {
  id: "builtin-1",
  name: "Internal – not shown in UI",
  description: "",
  enabled: true,
  resourceType: "rest",
  matchTarget: "url",
  matchOperator: "contains",
  matchValue: "h5-api.aoneroom.com/wefeed-h5api-bff/user/profile",
  method: "ANY",
  graphqlKey: "operationName",
  graphqlValue: "",
  statusCode: null,
  bodyMode: "dynamic",
  staticBody: "",
  dynamicScript: `function modifyResponse({ responseJSON }) {
  if (!responseJSON || !responseJSON.data || !responseJSON.data.vipInfo) {
    return responseJSON;
  }
  const vip = responseJSON.data.vipInfo;
  vip.isActive = true;
  vip.memberType = 2;          // 1 = Pro / VIP
  vip.adFree = true;
  vip.maxResolution = 1080;    // or 2160 for 4K
  vip.vipLevel = 2;
  vip.daysLeft = 30;
  vip.isAutoRenew = true;
  // Optional: set expiry to 30 days from now
  const future = new Date();
  future.setDate(future.getDate() + 30);
  vip.expiryDate = future.toISOString().split('T')[0];
  vip.nextRenewDate = vip.expiryDate;
  return responseJSON;
}`,
  serveWithoutRequest: false,
},

  // ========== RULE 3 ==========
  {
    id: "builtin-3",
    name: "Hidden rule 3",
    description: "",
    enabled: true,
    resourceType: "rest",
    matchTarget: "url",
    matchOperator: "contains",
    matchValue: "PASTE_MATCH_URL_OR_PATH_HERE",
    method: "ANY",
    graphqlKey: "operationName",
    graphqlValue: "",
    statusCode: null,
    bodyMode: "dynamic",
    staticBody: "",
    dynamicScript: `function modifyResponse(args) {
  const { responseJSON } = args;
  // PASTE YOUR SCRIPT LOGIC HERE
  return responseJSON;
}`,
    serveWithoutRequest: false,
  },

  // ========== RULE 4 ==========
  {
    id: "builtin-4",
    name: "Hidden rule 4",
    description: "",
    enabled: true,
    resourceType: "rest",
    matchTarget: "url",
    matchOperator: "contains",
    matchValue: "PASTE_MATCH_URL_OR_PATH_HERE",
    method: "ANY",
    graphqlKey: "operationName",
    graphqlValue: "",
    statusCode: null,
    bodyMode: "dynamic",
    staticBody: "",
    dynamicScript: `function modifyResponse(args) {
  const { responseJSON } = args;
  // PASTE YOUR SCRIPT LOGIC HERE
  return responseJSON;
}`,
    serveWithoutRequest: false,
  },

  // ========== RULE 5 ==========
  {
    id: "builtin-5",
    name: "Hidden rule 5",
    description: "",
    enabled: true,
    resourceType: "rest",
    matchTarget: "url",
    matchOperator: "contains",
    matchValue: "PASTE_MATCH_URL_OR_PATH_HERE",
    method: "ANY",
    graphqlKey: "operationName",
    graphqlValue: "",
    statusCode: null,
    bodyMode: "dynamic",
    staticBody: "",
    dynamicScript: `function modifyResponse(args) {
  const { responseJSON } = args;
  // PASTE YOUR SCRIPT LOGIC HERE
  return responseJSON;
}`,
    serveWithoutRequest: false,
  },

];
