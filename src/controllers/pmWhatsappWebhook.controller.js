import { PmWhatsappEvent } from "../models/pmWhatsappEvent.model.js";
import { PmInquiry } from "../models/pmInquiry.model.js";
import { updateInquiryScoreForWhatsapp } from "../services/pmWhatsappService.js";
import ApiResponses from "../utils/ApiResponses.js";

/**
 * TFT WhatsApp Webhook Handler
 * POST /api/v1/pm/whatsapp-webhook
 *
 * This endpoint receives delivery/read status updates from TFT platform.
 * Configure this URL in your TFT WhatsApp dashboard as the webhook callback.
 *
 * Expected payload (adjust based on actual TFT webhook format):
 * {
 *   mobile: "919876543210",
 *   status: "delivered" | "read" | "failed",
 *   messageId: "...",
 *   timestamp: "...",
 *   templateName: "..."
 * }
 */
const handleWebhook = async (req, res) => {
  try {
    const payload = req.body;

    // Verify webhook secret if configured
    const webhookSecret = process.env.TFT_WHATSAPP_WEBHOOK_SECRET;
    if (webhookSecret) {
      const authHeader = req.headers["x-webhook-secret"] || req.headers["authorization"];
      if (authHeader !== webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
        console.error("[PM WhatsApp Webhook] Invalid webhook secret");
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    console.log("[PM WhatsApp Webhook] Received:", JSON.stringify(payload));

    // Extract fields from payload
    // NOTE: Adjust these field names based on actual TFT webhook payload format
    const mobile = payload.mobile || payload.phone || payload.to;
    const status = payload.status || payload.event || payload.eventType;
    const templateName = payload.templateName || payload.template_name || "";
    const messageId = payload.messageId || payload.message_id || "";
    const timestamp = payload.timestamp || new Date().toISOString();

    if (!mobile || !status) {
      console.error("[PM WhatsApp Webhook] Missing mobile or status in payload");
      return res.status(400).json({ error: "Missing required fields: mobile, status" });
    }

    // Map TFT status to our event types
    const statusMap = {
      delivered: "delivered",
      read: "read",
      seen: "read",
      failed: "failed",
      rejected: "failed",
      undeliverable: "failed",
      sent: "sent",
    };

    const eventType = statusMap[status.toLowerCase()];
    if (!eventType) {
      console.log(`[PM WhatsApp Webhook] Unknown status "${status}", ignoring`);
      return res.status(200).json({ received: true, ignored: true });
    }

    // Clean mobile number for lookup
    const cleanMobile = mobile.replace(/[\s\-\+\(\)]/g, "");

    // Deduplicate: only one event per mobile+type per 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existing = await PmWhatsappEvent.findOne({
      mobile: { $regex: cleanMobile.slice(-10) },
      eventType,
      eventTimestamp: { $gte: fiveMinAgo },
    });

    if (existing) {
      console.log(`[PM WhatsApp Webhook] Duplicate ${eventType} for ${cleanMobile}, skipping`);
      return res.status(200).json({ received: true, deduplicated: true });
    }

    // Find inquiry by phone number (last 10 digits)
    const last10 = cleanMobile.slice(-10);
    const inquiry = await PmInquiry.findOne({
      phone: { $regex: last10 },
    }).sort({ createdAt: -1 });

    // Create event
    await PmWhatsappEvent.create({
      mobile: cleanMobile,
      eventType,
      templateName,
      inquiryId: inquiry?._id || null,
      eventTimestamp: new Date(timestamp),
      metadata: {
        source: "tft_webhook",
        messageId,
        rawPayload: payload,
      },
    });

    // Update engagement score
    if (inquiry && (eventType === "delivered" || eventType === "read")) {
      await updateInquiryScoreForWhatsapp(inquiry._id, eventType);
    }

    console.log(`[PM WhatsApp Webhook] ${eventType}: ${cleanMobile}${inquiry ? ` (inquiry: ${inquiry.fullName})` : ""}`);

    return res.status(200).json({ received: true, eventType });
  } catch (err) {
    console.error("[PM WhatsApp Webhook] Error:", err.message);
    return res.status(200).json({ received: true, error: err.message });
  }
};

/**
 * Test webhook endpoint (for verifying webhook setup)
 * GET /api/v1/pm/whatsapp-webhook/test
 */
const testWebhook = async (req, res) => {
  return res.status(200).json(
    new ApiResponses(200, { status: "ok", timestamp: new Date() }, "WhatsApp webhook endpoint is active")
  );
};

export { handleWebhook, testWebhook };
