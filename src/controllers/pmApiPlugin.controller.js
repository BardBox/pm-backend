import { PmApiPlugin } from "../models/pmApiPlugin.model.js";

/**
 * Slugify a name
 */
const slugify = (str) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Build auth headers based on plugin config
 */
const buildAuthHeaders = (plugin) => {
  const headers = {};

  switch (plugin.authType) {
    case "bearer":
      if (plugin.authValue) headers["Authorization"] = `Bearer ${plugin.authValue}`;
      break;
    case "api_key_header":
      if (plugin.authValue) {
        const headerName = plugin.authHeaderName || "X-API-Key";
        headers[headerName] = plugin.authValue;
      }
      break;
    case "basic":
      if (plugin.authValue) {
        headers["Authorization"] = `Basic ${Buffer.from(plugin.authValue).toString("base64")}`;
      }
      break;
  }

  // Add custom headers
  if (plugin.customHeaders) {
    for (const [key, value] of plugin.customHeaders.entries()) {
      headers[key] = value;
    }
  }

  return headers;
};

/**
 * GET /api/v1/pm/api-plugins
 */
export const getAllPlugins = async (req, res) => {
  const plugins = await PmApiPlugin.find().sort({ createdAt: -1 });
  res.json({ success: true, data: plugins });
};

/**
 * GET /api/v1/pm/api-plugins/nav
 * Lightweight list for sidebar navigation
 */
export const getPluginNav = async (req, res) => {
  const plugins = await PmApiPlugin.find({ isActive: true })
    .select("name slug icon color")
    .sort({ name: 1 });
  res.json({ success: true, data: plugins });
};

/**
 * GET /api/v1/pm/api-plugins/:slug
 */
export const getPluginBySlug = async (req, res) => {
  const plugin = await PmApiPlugin.findOne({ slug: req.params.slug });
  if (!plugin) {
    return res.status(404).json({ success: false, message: "Plugin not found" });
  }
  res.json({ success: true, data: plugin });
};

/**
 * POST /api/v1/pm/api-plugins
 */
export const createPlugin = async (req, res) => {
  const { name, description, baseUrl, authType, authValue, authHeaderName, customHeaders, icon, color } = req.body;

  if (!name || !baseUrl) {
    return res.status(400).json({ success: false, message: "Name and Base URL are required" });
  }

  let slug = slugify(name);

  // Ensure unique slug
  const existing = await PmApiPlugin.findOne({ slug });
  if (existing) {
    slug = `${slug}-${Date.now()}`;
  }

  const plugin = await PmApiPlugin.create({
    name,
    slug,
    description: description || "",
    baseUrl: baseUrl.replace(/\/+$/, ""), // remove trailing slash
    authType: authType || "none",
    authValue: authValue || "",
    authHeaderName: authHeaderName || "X-API-Key",
    customHeaders: customHeaders || {},
    icon: icon || "Plug",
    color: color || "#6366f1",
    endpoints: [],
  });

  res.status(201).json({ success: true, data: plugin });
};

/**
 * PUT /api/v1/pm/api-plugins/:slug
 */
export const updatePlugin = async (req, res) => {
  const plugin = await PmApiPlugin.findOne({ slug: req.params.slug });
  if (!plugin) {
    return res.status(404).json({ success: false, message: "Plugin not found" });
  }

  const allowed = [
    "name", "description", "baseUrl", "authType", "authValue",
    "authHeaderName", "customHeaders", "icon", "color", "isActive", "endpoints",
  ];

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      if (key === "baseUrl") {
        plugin[key] = req.body[key].replace(/\/+$/, "");
      } else {
        plugin[key] = req.body[key];
      }
    }
  }

  await plugin.save();
  res.json({ success: true, data: plugin });
};

/**
 * DELETE /api/v1/pm/api-plugins/:slug
 */
export const deletePlugin = async (req, res) => {
  const plugin = await PmApiPlugin.findOneAndDelete({ slug: req.params.slug });
  if (!plugin) {
    return res.status(404).json({ success: false, message: "Plugin not found" });
  }
  res.json({ success: true, message: "Plugin deleted" });
};

/**
 * POST /api/v1/pm/api-plugins/:slug/test
 * Test base URL connectivity
 */
export const testPlugin = async (req, res) => {
  const plugin = await PmApiPlugin.findOne({ slug: req.params.slug });
  if (!plugin) {
    return res.status(404).json({ success: false, message: "Plugin not found" });
  }

  try {
    const headers = buildAuthHeaders(plugin);
    headers["Accept"] = "application/json";

    const response = await fetch(plugin.baseUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10000),
    });

    const connected = response.ok;
    plugin.lastTestedAt = new Date();
    plugin.lastTestSuccess = connected;
    await plugin.save();

    res.json({
      success: true,
      data: {
        connected,
        status: response.status,
        statusText: response.statusText,
      },
    });
  } catch (err) {
    plugin.lastTestedAt = new Date();
    plugin.lastTestSuccess = false;
    await plugin.save();

    res.json({
      success: true,
      data: { connected: false, error: err.message },
    });
  }
};

/**
 * POST /api/v1/pm/api-plugins/:slug/request
 * Proxy a request through the plugin
 * Body: { endpointId?, method, path, body? }
 */
export const proxyRequest = async (req, res) => {
  const plugin = await PmApiPlugin.findOne({ slug: req.params.slug });
  if (!plugin) {
    return res.status(404).json({ success: false, message: "Plugin not found" });
  }

  const { method = "GET", path = "/", body } = req.body;

  try {
    const headers = buildAuthHeaders(plugin);
    headers["Content-Type"] = "application/json";
    headers["Accept"] = "application/json";

    const url = `${plugin.baseUrl}${path.startsWith("/") ? path : "/" + path}`;

    const fetchOpts = {
      method,
      headers,
      signal: AbortSignal.timeout(15000),
    };

    if (body && ["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
      fetchOpts.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOpts);

    let responseData;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    res.json({
      success: true,
      data: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseData,
      },
    });
  } catch (err) {
    res.json({
      success: true,
      data: { status: 0, error: err.message },
    });
  }
};

/**
 * POST /api/v1/pm/api-plugins/:slug/endpoints
 * Add an endpoint to the plugin
 */
export const addEndpoint = async (req, res) => {
  const plugin = await PmApiPlugin.findOne({ slug: req.params.slug });
  if (!plugin) {
    return res.status(404).json({ success: false, message: "Plugin not found" });
  }

  const { name, method, path, description, sampleBody } = req.body;
  if (!name || !path) {
    return res.status(400).json({ success: false, message: "Name and path are required" });
  }

  plugin.endpoints.push({ name, method: method || "GET", path, description, sampleBody });
  await plugin.save();

  res.json({ success: true, data: plugin });
};

/**
 * DELETE /api/v1/pm/api-plugins/:slug/endpoints/:endpointId
 */
export const removeEndpoint = async (req, res) => {
  const plugin = await PmApiPlugin.findOne({ slug: req.params.slug });
  if (!plugin) {
    return res.status(404).json({ success: false, message: "Plugin not found" });
  }

  plugin.endpoints = plugin.endpoints.filter(
    (ep) => ep._id.toString() !== req.params.endpointId
  );
  await plugin.save();

  res.json({ success: true, data: plugin });
};
