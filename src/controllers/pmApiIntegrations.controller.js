/**
 * API Integrations Controller
 * Manages third-party APIs used by the Performance Marketing system
 */

const MAILERLITE_BASE_URL = "https://connect.mailerlite.com/api";

/**
 * Check if an env var is configured (non-empty)
 */
const isConfigured = (key) => {
  const val = process.env[key];
  return !!(val && val.trim().length > 0);
};

/**
 * Test MailerLite API connectivity
 */
const testMailerLite = async () => {
  const apiKey = process.env.MAILERLITE_API_KEY;
  if (!apiKey) return { connected: false, error: "API key not configured" };

  try {
    const res = await fetch(`${MAILERLITE_BASE_URL}/subscribers?limit=1`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { connected: false, error: data.message || `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { connected: true, subscriberCount: data.total || 0 };
  } catch (err) {
    return { connected: false, error: err.message };
  }
};

/**
 * Test Razorpay API connectivity
 */
const testRazorpay = async () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret)
    return { connected: false, error: "Credentials not configured" };

  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/payments?count=1", {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) {
      return { connected: false, error: `HTTP ${res.status}` };
    }
    return { connected: true };
  } catch (err) {
    return { connected: false, error: err.message };
  }
};

/**
 * Test Gmail SMTP by checking config
 */
const testGmailSMTP = async () => {
  const email = process.env.CLIENT_EMAIL;
  const pass = process.env.APP_PASSWORD_EMAIL;
  if (!email || !pass)
    return { connected: false, error: "Email credentials not configured" };

  return { connected: true, email, note: "Credentials configured" };
};

/**
 * GET /api/v1/pm/api-integrations
 * Returns list of PM-specific integrations with config status
 */
export const getIntegrations = async (req, res) => {
  const integrations = [
    {
      id: "mailerlite",
      name: "MailerLite",
      description: "Subscriber list management for PM inquiries",
      category: "Email Marketing",
      envVars: ["MAILERLITE_API_KEY", "MAILERLITE_GROUP_ID"],
      configured: isConfigured("MAILERLITE_API_KEY"),
      docs: "https://developers.mailerlite.com/docs",
      usedIn: ["Inquiry creation", "Subscriber groups", "Webhook events"],
    },
    {
      id: "gmail_smtp",
      name: "Gmail SMTP (Nodemailer)",
      description: "Sends automation emails, welcome emails, and follow-ups",
      category: "Email Sending",
      envVars: ["CLIENT_EMAIL", "APP_PASSWORD_EMAIL", "MAILERLITE_FROM_EMAIL"],
      configured:
        isConfigured("CLIENT_EMAIL") && isConfigured("APP_PASSWORD_EMAIL"),
      docs: "https://support.google.com/mail/answer/185833",
      usedIn: ["Welcome automation", "Follow-up automation", "Campaign sends"],
    },
    {
      id: "razorpay",
      name: "Razorpay",
      description: "Payment gateway for PM plan purchases",
      category: "Payments",
      envVars: [
        "RAZORPAY_KEY_ID",
        "RAZORPAY_KEY_SECRET",
        "RAZORPAY_WEBHOOK_SECRET",
      ],
      configured:
        isConfigured("RAZORPAY_KEY_ID") &&
        isConfigured("RAZORPAY_KEY_SECRET"),
      docs: "https://razorpay.com/docs/api",
      usedIn: ["Plan payments", "Payment verification", "Webhook processing"],
    },
  ];

  res.json({ success: true, data: integrations });
};

/**
 * POST /api/v1/pm/api-integrations/:id/test
 * Test connectivity for a specific integration
 */
export const testIntegration = async (req, res) => {
  const { id } = req.params;

  const testers = {
    mailerlite: testMailerLite,
    gmail_smtp: testGmailSMTP,
    razorpay: testRazorpay,
  };

  const tester = testers[id];
  if (!tester) {
    return res.status(404).json({ success: false, message: "Unknown integration" });
  }

  try {
    const result = await tester();
    res.json({ success: true, data: { id, ...result } });
  } catch (err) {
    res.json({
      success: true,
      data: { id, connected: false, error: err.message },
    });
  }
};

/**
 * POST /api/v1/pm/api-integrations/test-all
 * Test all PM integrations at once
 */
export const testAllIntegrations = async (req, res) => {
  const tests = {
    mailerlite: testMailerLite,
    gmail_smtp: testGmailSMTP,
    razorpay: testRazorpay,
  };

  const results = {};
  await Promise.all(
    Object.entries(tests).map(async ([id, tester]) => {
      try {
        results[id] = await tester();
      } catch (err) {
        results[id] = { connected: false, error: err.message };
      }
    })
  );

  res.json({ success: true, data: results });
};
