/**
 * TFT (TheFutureTech) Session Service
 * Handles login, cookie-based authentication, template CRUD, and syncing
 * with the TFT WhatsApp platform via reverse-engineered internal APIs.
 */

const TFT_BASE_URL = process.env.TFT_BASE_URL || "https://official.thefuturetech.in";
const TFT_EMAIL = process.env.TFT_EMAIL || "";
const TFT_PASSWORD = process.env.TFT_PASSWORD || "";
const TFT_API_KEY = process.env.TFT_WHATSAPP_API_KEY || "";
const TFT_CHANNEL = process.env.TFT_WHATSAPP_CHANNEL || "919558708295";

// In-memory session store
let sessionCookies = "";
let sessionExpiry = 0;
let activeBaseUrl = TFT_BASE_URL;

const extractCookies = (res) => {
  const setCookieHeaders = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const rawHeader = res.headers.get("set-cookie") || "";
  const sources = setCookieHeaders.length > 0 ? setCookieHeaders : rawHeader ? rawHeader.split(/,(?=[^;]*=)/) : [];
  const cookies = [];

  for (const cookie of sources) {
    const match = cookie.match(/^([^=]+)=([^;]*)/);
    if (match) cookies.push(`${match[1].trim()}=${match[2].trim()}`);
  }

  return cookies;
};

const getBaseUrl = () => activeBaseUrl || TFT_BASE_URL;

const mergeCookies = (cookieMap, cookiePairs) => {
  for (const pair of cookiePairs) {
    const idx = pair.indexOf("=");
    if (idx > 0) {
      const name = pair.slice(0, idx);
      const value = pair.slice(idx + 1);
      cookieMap[name] = value;
    }
  }
};

const cookieHeaderFromMap = (cookieMap) =>
  Object.entries(cookieMap)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");

const requestWithCookies = async (url, options, cookieMap) => {
  const headers = { ...(options.headers || {}) };
  const cookieHeader = cookieHeaderFromMap(cookieMap);
  if (cookieHeader) headers.Cookie = cookieHeader;

  const res = await fetch(url, {
    ...options,
    headers,
    redirect: options.redirect || "manual",
  });

  mergeCookies(cookieMap, extractCookies(res));
  return res;
};

const followRedirects = async (res, baseUrl, cookieMap, baseHeaders) => {
  let currentRes = res;
  let currentUrl = currentRes.url || baseUrl;
  let redirects = 0;

  while (redirects < 5 && currentRes.status >= 300 && currentRes.status < 400) {
    const location = currentRes.headers.get("location");
    if (!location) break;
    const nextUrl = new URL(location, currentUrl).toString();
    currentRes = await requestWithCookies(nextUrl, { method: "GET", headers: baseHeaders }, cookieMap);
    currentUrl = nextUrl;
    redirects += 1;
  }

  return currentRes;
};

const loginWithBase = async (baseUrl) => {
  const cookieMap = {};
  const baseHeaders = {
    "User-Agent": "Mozilla/5.0",
    Referer: `${baseUrl}/`,
    Origin: baseUrl,
  };

  try {
    await requestWithCookies(`${baseUrl}/`, { method: "GET", headers: baseHeaders }, cookieMap);
  } catch { /* ignore */ }
  try {
    await requestWithCookies(`${baseUrl}/login`, { method: "GET", headers: baseHeaders }, cookieMap);
  } catch { /* ignore */ }

  const formBody = `username=${encodeURIComponent(TFT_EMAIL)}&password=${encodeURIComponent(TFT_PASSWORD)}`;
  let res = await requestWithCookies(
    `${baseUrl}/login`,
    {
      method: "POST",
      headers: { ...baseHeaders, "Content-Type": "application/x-www-form-urlencoded", Referer: `${baseUrl}/login` },
      body: formBody,
    },
    cookieMap
  );

  res = await followRedirects(res, baseUrl, cookieMap, baseHeaders);
  let usedMethod = "POST";
  let status = res.status;

  if (status === 404 || status === 405) {
    const fallbackRes = await requestWithCookies(
      `${baseUrl}/dologin`,
      {
        method: "POST",
        headers: { ...baseHeaders, "Content-Type": "application/x-www-form-urlencoded", Referer: `${baseUrl}/login` },
        body: formBody,
      },
      cookieMap
    );
    res = await followRedirects(fallbackRes, baseUrl, cookieMap, baseHeaders);
    usedMethod = "POST";
    status = res.status;
  }

  const checkRes = await requestWithCookies(
    `${baseUrl}/session/isloggedin`,
    { method: "GET", headers: baseHeaders },
    cookieMap
  );
  const checkBody = await checkRes.text().catch(() => "");

  return {
    success: checkBody.trim() === "1",
    cookieMap,
    status,
    usedMethod,
    lastResponse: res,
    checkBody,
  };
};

const login = async () => {
  if (!TFT_EMAIL || !TFT_PASSWORD) {
    throw new Error("TFT_EMAIL and TFT_PASSWORD env vars are required for TFT session");
  }

  const primaryBase = TFT_BASE_URL;
  const altBase = primaryBase.startsWith("https://")
    ? primaryBase.replace("https://", "http://")
    : primaryBase.replace("http://", "https://");

  const attempts = [primaryBase];
  if (altBase !== primaryBase) attempts.push(altBase);

  for (const baseUrl of attempts) {
    const attempt = await loginWithBase(baseUrl);
    if (attempt.success) {
      activeBaseUrl = baseUrl;
      sessionCookies = cookieHeaderFromMap(attempt.cookieMap);
      sessionExpiry = Date.now() + 55 * 60 * 1000;
      console.log(`[TFT Session] Logged in successfully using ${attempt.usedMethod} on ${baseUrl}`);
      return;
    }
  }

  const checkRes = await fetch(`${getBaseUrl()}/session/isloggedin`, {
    headers: { Cookie: sessionCookies },
  });
  const checkBody = await checkRes.text();
  if (checkBody.trim() === "1") return;

  const failedAttempt = await loginWithBase(primaryBase);
  const body = await failedAttempt.lastResponse.text().catch(() => "");
  const snippet = body ? body.slice(0, 200).replace(/\s+/g, " ") : "";
  throw new Error(
    `TFT login failed: no session cookies received (status ${failedAttempt.status}, method ${failedAttempt.usedMethod}). ${snippet}`
  );
};

const getSession = async () => {
  if (!sessionCookies || Date.now() > sessionExpiry) {
    await login();
  }

  try {
    const res = await fetch(`${getBaseUrl()}/session/isloggedin`, {
      headers: { Cookie: sessionCookies },
    });
    const body = await res.text();
    if (body.trim() !== "1") {
      sessionCookies = "";
      await login();
    }
  } catch {
    sessionCookies = "";
    await login();
  }

  return sessionCookies;
};

const tftRequest = async (path, options = {}) => {
  const cookies = await getSession();
  const url = path.startsWith("http") ? path : `${getBaseUrl()}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Cookie: cookies,
      ...options.headers,
    },
  });

  return res;
};

export const fetchTftTemplateList = async () => {
  if (!TFT_API_KEY) throw new Error("TFT_WHATSAPP_API_KEY not configured");

  const res = await fetch(
    `${getBaseUrl()}/wapp/api/offwatemp/list?apikey=${encodeURIComponent(TFT_API_KEY)}`
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TFT template list failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data;
};

export const fetchTftTemplateDetails = async (templateName) => {
  if (!TFT_API_KEY) throw new Error("TFT_WHATSAPP_API_KEY not configured");

  const res = await fetch(
    `${getBaseUrl()}/wapp/api/get/offwatemp/info?apikey=${encodeURIComponent(TFT_API_KEY)}&templatename=${encodeURIComponent(templateName)}`
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TFT template details failed (${res.status}): ${body}`);
  }

  return res.json();
};

export const createTftTemplate = async (params) => {
  const cookies = await getSession();

  const formData = new URLSearchParams();
  formData.append("templatename", params.templatename);
  formData.append("temptype", params.temptype || "standard");
  formData.append("msg", params.msg || "");
  formData.append("offch", params.offch || TFT_CHANNEL);
  formData.append("media", params.media || "");
  formData.append("lang", params.lang || "en");
  formData.append("category", params.category || "MARKETING");
  formData.append("lcap", params.lcap || "Visit now");
  formData.append("lnk", params.lnk || "");
  formData.append("urltype", params.urltype || "");
  formData.append("lnkexm", params.lnkexm || "");
  formData.append("cbtncap", params.cbtncap || "Call Now");
  formData.append("callno", params.callno || "");
  formData.append("btn3cap", params.btn3cap || "Whatsapp Now");
  formData.append("btn3numb", params.btn3numb || "");
  formData.append("btn3msg", params.btn3msg || "");
  formData.append("footer", params.footer || "");
  formData.append("dvariables", params.dvariables || "");
  formData.append("isbtn", "true");
  formData.append("copycodetxt", "");
  formData.append("catalogtext", "");
  formData.append("flow_text", "");
  formData.append("navigate_screen", "");
  formData.append("flow_action", "");
  formData.append("flowtype", "");
  formData.append("flowtype_text", "");
  formData.append("cardData", "");

  if (params.qreply && Array.isArray(params.qreply)) {
    for (const qr of params.qreply) {
      formData.append("qreply", qr);
    }
  }

  if (params.btntype && Array.isArray(params.btntype)) {
    for (const bt of params.btntype) {
      formData.append("btntype", bt);
    }
  }

  const res = await fetch(`${getBaseUrl()}/api/v5/officalwatemplate/save`, {
    method: "POST",
    headers: {
      Cookie: cookies,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  const data = await res.json().catch(() => null);

  if (!data) {
    const text = await res.text().catch(() => "");
    throw new Error(`TFT template creation failed: ${text || res.status}`);
  }

  return data;
};

export const deleteTftTemplate = async (systemId) => {
  const cookies = await getSession();

  const res = await fetch(`${getBaseUrl()}/api/v1/delete/offtemplate?systempid=${encodeURIComponent(systemId)}`, {
    headers: { Cookie: cookies },
  });

  return res.ok;
};

export const getTftChannels = async () => {
  if (!TFT_API_KEY) throw new Error("TFT_WHATSAPP_API_KEY not configured");

  const cookies = await getSession();
  const res = await fetch(`${getBaseUrl()}/api/v1/get/offwa/channellist/select`, {
    headers: { Cookie: cookies },
  });

  if (!res.ok) throw new Error("Failed to fetch TFT channels");
  return res.json();
};

export const getTftReportByTemplate = async (templateName) => {
  if (!TFT_API_KEY) throw new Error("TFT_WHATSAPP_API_KEY not configured");

  const res = await fetch(
    `${getBaseUrl()}/wapp/api/report/bycampaign?apikey=${encodeURIComponent(TFT_API_KEY)}&tempname=${encodeURIComponent(templateName)}`
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TFT report by template failed (${res.status}): ${body}`);
  }
  return res.json();
};

export const getTftReportByDate = async (startDate, endDate) => {
  if (!TFT_API_KEY) throw new Error("TFT_WHATSAPP_API_KEY not configured");

  const res = await fetch(
    `${getBaseUrl()}/wapp/api/report/bydate?apikey=${encodeURIComponent(TFT_API_KEY)}&startDate=${startDate}&endDate=${endDate}`
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TFT report by date failed (${res.status}): ${body}`);
  }
  return res.json();
};

export const getTftReportByNumber = async (mobile) => {
  if (!TFT_API_KEY) throw new Error("TFT_WHATSAPP_API_KEY not configured");

  const res = await fetch(
    `${getBaseUrl()}/wapp/api/report/bynumber?apikey=${encodeURIComponent(TFT_API_KEY)}&mobile=${encodeURIComponent(mobile)}`
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TFT report by number failed (${res.status}): ${body}`);
  }
  return res.json();
};

export const getTftSummaryReport = async () => {
  if (!TFT_API_KEY) throw new Error("TFT_WHATSAPP_API_KEY not configured");

  const res = await fetch(
    `${getBaseUrl()}/wapp/api/wacamp/report/summary?apikey=${encodeURIComponent(TFT_API_KEY)}`
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TFT summary report failed (${res.status}): ${body}`);
  }
  return res.json();
};
