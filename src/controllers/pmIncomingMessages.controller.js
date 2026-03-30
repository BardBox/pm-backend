import { PmConversationMessage } from "../models/pmConversationMessage.model.js";
import { PmInquiry } from "../models/pmInquiry.model.js";

/**
 * Email Webhook Handler
 * POST /pm/webhooks/email
 * 
 * Accepts incoming email replies forwarded via:
 * - Zapier (Catch Email by Zapier + Webhooks)
 * - Make.com (Gmail/Email module → Webhooks)
 * - Direct email forwarding services
 * 
 * Payload format from Zapier:
 * {
 *   from: "customer@email.com",
 *   to: "your@email.com",
 *   subject: "Re: Your Message",
 *   text: "The email body",
 *   html: "<p>The email body</p>"
 * }
 */
export const handleIncomingEmail = async (req, res) => {
  try {
    const payload = req.body;
    
    console.log("[Email Webhook] Received:", JSON.stringify(payload, null, 2));

    // Extract email details - flexible parsing
    let fromEmail = payload.from || payload.sender || payload.senderEmail || payload.fromEmail;
    const toEmail = payload.to || payload.recipient || payload.toEmail;
    let content = payload.content || payload.body || payload.text || payload.html || "";
    let subject = payload.subject || "Email Reply";

    // Handle Zapier format where from might be object
    if (typeof fromEmail === 'object' && fromEmail.email) {
      fromEmail = fromEmail.email;
    }
    if (typeof fromEmail === 'object' && fromEmail.address) {
      fromEmail = fromEmail.address;
    }

    // Strip HTML if present
    if (content.includes('<')) {
      content = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
    }

    // Capitalize subject for reply
    if (!subject.toLowerCase().startsWith('re:')) {
      subject = `Re: ${subject}`;
    }

    if (!fromEmail || !content) {
      console.error("[Email Webhook] Missing required fields:", { fromEmail, content: content ? "present" : "missing" });
      return res.status(400).json({ error: "Missing required fields: from email and content" });
    }

    // Clean email
    const cleanEmail = fromEmail.toLowerCase().trim();

    // Find inquiry by email address
    const inquiry = await PmInquiry.findOne({
      email: { $regex: `^${cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: "i" },
    });

    if (!inquiry) {
      console.log(`[Email Webhook] Inquiry not found for email: ${cleanEmail}`);
      return res.status(404).json({ error: "Inquiry not found for this email address" });
    }

    // Check for duplicate (avoid double-processing)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existing = await PmConversationMessage.findOne({
      inquiryId: inquiry._id,
      type: "email",
      sender: "user",
      content: { $regex: content.substring(0, 50) },
      messageTimestamp: { $gte: fiveMinAgo },
    });

    if (existing) {
      console.log("[Email Webhook] Duplicate email detected, skipping");
      return res.status(200).json({ received: true, deduplicated: true });
    }

    // Create conversation message record
    const message = await PmConversationMessage.create({
      inquiryId: inquiry._id,
      type: "email",
      sender: "user",
      channel: "email",
      content: content.substring(0, 5000), // Limit content
      subject,
      recipient: inquiry.email,
      senderName: payload.senderName || payload.from_name || fromEmail,
      status: "received",
      messageTimestamp: new Date(payload.timestamp || Date.now()),
    });

    console.log(
      `[Email Webhook] ✓ Logged incoming email from ${cleanEmail} for inquiry ${inquiry._id}`
    );

    return res.status(201).json({
      success: true,
      data: message,
    });
  } catch (err) {
    console.error("[Email Webhook] Error:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
};

/**
 * WhatsApp Incoming Message Handler
 * POST /pm/webhooks/whatsapp
 * 
 * This handles incoming WhatsApp messages and logs them to conversations
 */
export const handleIncomingWhatsapp = async (req, res) => {
  try {
    const payload = req.body;

    console.log("[WhatsApp Webhook] Received:", JSON.stringify(payload));

    // Extract message details - adjust based on TFT webhook format
    const fromPhone = payload.from || payload.phone || payload.sender;
    const content = payload.content || payload.message || payload.text;
    const messageId = payload.messageId || payload.message_id;
    const timestamp = payload.timestamp || new Date().toISOString();

    if (!fromPhone || !content) {
      console.error("[WhatsApp Webhook] Missing required fields");
      return res.status(400).json({ error: "Missing required fields: from, content" });
    }

    // Clean phone number (last 10 digits)
    const cleanPhone = fromPhone.replace(/\D/g, "");
    const last10 = cleanPhone.slice(-10);

    // Find inquiry by phone number
    const inquiry = await PmInquiry.findOne({
      phone: { $regex: last10 },
    }).sort({ createdAt: -1 });

    if (!inquiry) {
      console.log(`[WhatsApp Webhook] Inquiry not found for phone: ${fromPhone}`);
      return res.status(404).json({ error: "Inquiry not found" });
    }

    // Check for duplicate
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existing = await PmConversationMessage.findOne({
      inquiryId: inquiry._id,
      type: "whatsapp",
      sender: "user",
      content: content.substring(0, 100),
      messageTimestamp: { $gte: fiveMinAgo },
    });

    if (existing) {
      console.log("[WhatsApp Webhook] Duplicate WhatsApp message detected, skipping");
      return res.status(200).json({ received: true, deduplicated: true });
    }

    // Create conversation message record
    const message = await PmConversationMessage.create({
      inquiryId: inquiry._id,
      type: "whatsapp",
      sender: "user",
      channel: "whatsapp",
      content,
      recipient: inquiry.phone,
      senderName: inquiry.fullName,
      status: "received",
      messageTimestamp: new Date(timestamp),
    });

    console.log(
      `[WhatsApp Webhook] Logged incoming WhatsApp from ${fromPhone} for inquiry ${inquiry._id}`
    );

    return res.status(201).json({
      success: true,
      data: message,
    });
  } catch (err) {
    console.error("[WhatsApp Webhook] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};