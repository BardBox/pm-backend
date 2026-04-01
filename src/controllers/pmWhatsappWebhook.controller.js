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
    const last10 = cleanMobile.slice(-10);

    // Find inquiry by phone number (last 10 digits, exact match on stored value)
    const inquiry = await PmInquiry.findOne({ phone: { $regex: last10 } }).sort({ createdAt: -1 });

    // Create event — unique index on messageId handles atomic deduplication
    // If TFT sends duplicate webhooks for same messageId, DB throws 11000 and we skip
    try {
      await PmWhatsappEvent.create({
        mobile: cleanMobile,
        eventType,
        templateName,
        messageId: messageId || null,
        inquiryId: inquiry?._id || null,
        eventTimestamp: new Date(timestamp),
        metadata: {
          source: "tft_webhook",
          rawPayload: payload,
        },
      });
    } catch (err) {
      if (err.code === 11000) {
        console.log(`[PM WhatsApp Webhook] Duplicate messageId "${messageId}", skipping`);
        return res.status(200).json({ received: true, deduplicated: true });
      }
      throw err;
    }

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
