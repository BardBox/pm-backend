import { PmConversationMessage } from "../models/pmConversationMessage.model.js";
import { PmInquiry } from "../models/pmInquiry.model.js";
import { sendChatbotMsg, fetchChatHistory } from "../services/tftSessionService.js";
import { formatMobile, updateInquiryScoreForWhatsapp } from "../services/pmWhatsappService.js";
import {
  deliverEmail,
  replacePlaceholders,
  injectTrackingPixel,
  wrapLinksWithTracking,
} from "../services/pmEmailService.js";

// GET /pm/conversations/:inquiryId
export const getInquiryConversation = async (req, res) => {
  try {
    const { inquiryId } = req.params;

    const inquiry = await PmInquiry.findById(inquiryId);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: "Inquiry not found" });
    }

    // Fetch all messages for this inquiry, sorted by timestamp
    const messages = await PmConversationMessage.find({ inquiryId })
      .sort({ messageTimestamp: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        inquiry: {
          _id: inquiry._id,
          fullName: inquiry.fullName,
          email: inquiry.email,
          phone: inquiry.phone,
        },
        messages,
      },
    });
  } catch (err) {
    console.error("Get conversation error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// POST /pm/conversations/:inquiryId/email
export const sendDirectEmail = async (req, res) => {
  try {
    const { inquiryId } = req.params;
    const { content, subject = "Message from BizCivitas", isHtml = false } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: "Content is required" });
    }

    const inquiry = await PmInquiry.findById(inquiryId);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: "Inquiry not found" });
    }

    // Build HTML body
    let html;
    if (isHtml) {
      // Replace placeholders with inquiry data
      const placeholderData = {
        name: inquiry.fullName || "",
        email: inquiry.email || "",
        company: inquiry.companyName || "",
        phone: inquiry.phone || "",
        city: inquiry.city || "",
        state: inquiry.state || "",
      };
      html = replacePlaceholders(content, placeholderData);

      // Add open tracking pixel + click tracking on links
      const trackingId = `conv_${inquiryId}_${Date.now()}`;
      html = wrapLinksWithTracking(html, inquiry.email, trackingId);
      html = injectTrackingPixel(html, inquiry.email, trackingId);
    } else {
      // Plain text — wrap in <p> tags
      html = `<p>${content.replace(/\n/g, "<br>")}</p>`;
    }

    // Send via Resend
    try {
      await deliverEmail({
        from: process.env.RESEND_FROM_EMAIL,
        to: inquiry.email,
        subject: isHtml ? replacePlaceholders(subject, { name: inquiry.fullName || "", email: inquiry.email || "", company: inquiry.companyName || "", phone: inquiry.phone || "", city: inquiry.city || "", state: inquiry.state || "" }) : subject,
        html,
      });
    } catch (emailErr) {
      console.error("Email send error:", emailErr);
      return res.status(500).json({ success: false, message: "Failed to send email" });
    }

    // Create conversation message record
    const message = await PmConversationMessage.create({
      inquiryId,
      type: "manual_email",
      sender: "admin",
      channel: "email",
      content,
      subject,
      recipient: inquiry.email,
      status: "sent",
      messageTimestamp: new Date(),
      metadata: isHtml ? { isHtml: true } : null,
    });

    return res.status(201).json({
      success: true,
      data: message,
    });
  } catch (err) {
    console.error("Send email error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// POST /pm/conversations/:inquiryId/whatsapp
export const sendDirectWhatsapp = async (req, res) => {
  try {
    const { inquiryId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: "Content is required" });
    }

    const inquiry = await PmInquiry.findById(inquiryId);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: "Inquiry not found" });
    }

    const formattedPhone = formatMobile(inquiry.phone);
    const channel = process.env.TFT_WHATSAPP_CHANNEL || "919558708295";

    // Send via TFT chatbot session API (supports free-text, not just templates)
    const tftResult = await sendChatbotMsg({
      mobile: formattedPhone,
      message: content,
      chno: channel,
    });

    const status = tftResult.ok && tftResult.body === "OK" ? "sent" : "failed";

    if (status === "failed") {
      console.error("[Conversation WhatsApp] TFT send failed:", tftResult);
    }

    const message = await PmConversationMessage.create({
      inquiryId,
      type: "manual_whatsapp",
      sender: "admin",
      channel: "whatsapp",
      content,
      recipient: inquiry.phone,
      status,
      messageTimestamp: new Date(),
    });

    // Update engagement score on successful send
    if (status === "sent") {
      await updateInquiryScoreForWhatsapp(inquiryId, "sent");
    }

    return res.status(201).json({
      success: true,
      data: message,
      tftStatus: tftResult.body,
    });
  } catch (err) {
    console.error("Send WhatsApp error:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal server error" });
  }
};

/**
 * Core sync logic — reusable by both the HTTP endpoint and the background job.
 * Returns { synced: number } or throws on TFT errors.
 */
export const syncInquiryWhatsapp = async (inquiryId, inquiry) => {
  const formattedPhone = formatMobile(inquiry.phone);
  const channel = process.env.TFT_WHATSAPP_CHANNEL || "919558708295";

  const chatHistory = await fetchChatHistory(formattedPhone, channel);

  if (!Array.isArray(chatHistory)) return { synced: 0 };

  let synced = 0;

  for (const msg of chatHistory) {
    const isFromMe = msg.fromme === true || msg.fromme === 1;
    const content = msg.msg || msg.message || msg.text || "";
    const tftMsgId = String(msg.msgid || msg.id || "");
    const timestamp = msg.lnxtime ? new Date(msg.lnxtime) : new Date();

    if (!content || !tftMsgId) continue;
    if (msg.msgtype === "reaction") continue;

    // Already saved?
    const exists = await PmConversationMessage.findOne({
      inquiryId,
      "metadata.tftMsgId": tftMsgId,
    });
    if (exists) continue;

    if (isFromMe) {
      // Check if our API already saved it (fuzzy match by content + timestamp)
      const twoMin = 2 * 60 * 1000;
      const existingAdminMsg = await PmConversationMessage.findOne({
        inquiryId,
        sender: "admin",
        channel: "whatsapp",
        content,
        messageTimestamp: { $gte: new Date(timestamp - twoMin), $lte: new Date(timestamp + twoMin) },
        "metadata.tftMsgId": { $exists: false },
      });

      if (existingAdminMsg) {
        await PmConversationMessage.updateOne(
          { _id: existingAdminMsg._id },
          { $set: { metadata: { tftMsgId, source: "tft_sync" } } }
        );
      } else {
        await PmConversationMessage.create({
          inquiryId,
          type: "manual_whatsapp",
          sender: "admin",
          channel: "whatsapp",
          content,
          recipient: inquiry.phone,
          status: "sent",
          messageTimestamp: timestamp,
          metadata: { tftMsgId, source: "tft_sync" },
        });
        synced++;
      }
    } else {
      // Incoming customer reply
      await PmConversationMessage.create({
        inquiryId,
        type: "whatsapp",
        sender: "user",
        channel: "whatsapp",
        content,
        recipient: inquiry.phone,
        status: "received",
        messageTimestamp: timestamp,
        metadata: { tftMsgId, source: "tft_sync" },
      });
      await updateInquiryScoreForWhatsapp(inquiryId, "read");
      synced++;
    }
  }

  return { synced };
};

// POST /pm/conversations/:inquiryId/whatsapp/sync
export const syncWhatsappMessages = async (req, res) => {
  try {
    const { inquiryId } = req.params;

    const inquiry = await PmInquiry.findById(inquiryId);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: "Inquiry not found" });
    }

    try {
      const result = await syncInquiryWhatsapp(inquiryId, inquiry);
      return res.status(200).json({ success: true, synced: result.synced });
    } catch (err) {
      console.error("[Sync] TFT error:", err.message);
      return res.status(502).json({ success: false, message: `TFT sync failed: ${err.message}` });
    }
  } catch (err) {
    console.error("Sync WhatsApp error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
