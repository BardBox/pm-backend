import { PmWhatsappTemplate } from "../models/pmWhatsappTemplate.model.js";
import { PmWhatsappAutomation } from "../models/pmWhatsappAutomation.model.js";
import { PmWhatsappEvent } from "../models/pmWhatsappEvent.model.js";
import { PmInquiry } from "../models/pmInquiry.model.js";

const TFT_API_URL = process.env.TFT_WHATSAPP_API_URL || "https://official.thefuturetech.in/wapp/api/v2/send/bytemplate";
const TFT_API_KEY = process.env.TFT_WHATSAPP_API_KEY;
const TFT_CHANNEL = process.env.TFT_WHATSAPP_CHANNEL || "919558708295";

/**
 * Format mobile number to 12-digit format with 91 prefix
 */
const formatMobile = (mobile) => {
  if (!mobile) throw new Error("Mobile number is required");

  // Remove spaces, dashes, plus signs, brackets
  let cleaned = mobile.replace(/[\s\-\+\(\)]/g, "");

  // If 10 digits, prepend 91
  if (cleaned.length === 10) {
    cleaned = "91" + cleaned;
  }

  // If starts with 0, remove it and prepend 91
  if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = "91" + cleaned.slice(1);
  }

  // Validate: must be 12 digits starting with 91
  if (!/^91\d{10}$/.test(cleaned)) {
    throw new Error(`Invalid mobile number format: ${mobile}. Expected 10-digit Indian number.`);
  }

  return cleaned;
};

/**
 * Log a WhatsApp event
 */
const logWhatsappEvent = async (mobile, eventType, templateId, templateName, inquiryId, metadata = {}) => {
  try {
    await PmWhatsappEvent.create({
      mobile,
      eventType,
      templateId: templateId || null,
      templateName: templateName || "",
      inquiryId: inquiryId || null,
      eventTimestamp: new Date(),
      metadata,
    });
  } catch (err) {
    console.error("[PM WhatsApp] Failed to log event:", err.message);
  }
};

/**
 * Update inquiry engagement score for WhatsApp events
 */
const updateInquiryScoreForWhatsapp = async (inquiryId, eventType) => {
  if (!inquiryId) return;

  try {
    const inquiry = await PmInquiry.findById(inquiryId);
    if (!inquiry) return;

    // Score mapping for WhatsApp events
    const scoreMap = {
      sent: 3,
      delivered: 2,
      read: 5,
    };

    const scoreToAdd = scoreMap[eventType] || 0;
    if (scoreToAdd > 0) {
      inquiry.engagementScore = Math.max(0, inquiry.engagementScore + scoreToAdd);
      inquiry.lastActivity = `whatsapp_${eventType}`;
      inquiry.activityLog.push({
        event: `whatsapp_${eventType}`,
        scoreAdded: scoreToAdd,
        timestamp: new Date(),
      });
      await inquiry.save();
    }
  } catch (err) {
    console.error("[PM WhatsApp] Failed to update inquiry score:", err.message);
  }
};

/**
 * Send WhatsApp message via TFT API using a template
 */
export const sendWhatsappTemplate = async (templateId, mobile, inquiryId = null) => {
  const template = await PmWhatsappTemplate.findById(templateId);
  if (!template || !template.isActive) {
    throw new Error("Template not found or inactive");
  }

  if (!TFT_API_KEY) {
    throw new Error("TFT WhatsApp API key not configured");
  }

  const formattedMobile = formatMobile(mobile);

  // Build TFT API URL (channel = WhatsApp business number to send from)
  const url = `${TFT_API_URL}?apikey=${encodeURIComponent(TFT_API_KEY)}&channel=${encodeURIComponent(TFT_CHANNEL)}&templatename=${encodeURIComponent(template.tftTemplateName)}&mobile=${formattedMobile}`;

  try {
    const response = await fetch(url);
    const data = await response.json().catch(() => ({ status: response.status }));

    if (response.ok) {
      // Log sent event
      await logWhatsappEvent(formattedMobile, "sent", template._id, template.name, inquiryId, {
        source: "pm_automation",
        tftResponse: data,
      });

      // Update template stats
      template.lastSentAt = new Date();
      template.sentCount += 1;
      await template.save();

      // Update inquiry engagement score
      await updateInquiryScoreForWhatsapp(inquiryId, "sent");

      console.log(`[PM WhatsApp] Sent "${template.name}" to ${formattedMobile}`);
      return { success: true, data };
    } else {
      // Log failed event
      await logWhatsappEvent(formattedMobile, "failed", template._id, template.name, inquiryId, {
        source: "pm_automation",
        error: data,
        httpStatus: response.status,
      });

      console.error(`[PM WhatsApp] Failed to send "${template.name}" to ${formattedMobile}:`, data);
      return { success: false, error: data };
    }
  } catch (err) {
    // Log failed event
    await logWhatsappEvent(formattedMobile, "failed", template._id, template.name, inquiryId, {
      source: "pm_automation",
      error: err.message,
    });

    console.error(`[PM WhatsApp] Error sending "${template.name}" to ${formattedMobile}:`, err.message);
    throw err;
  }
};

/**
 * Trigger WhatsApp automation based on type and pipeline stage
 */
export const triggerWhatsappAutomation = async (type, pipelineStage, mobile, inquiryId = null) => {
  if (!mobile) {
    console.log(`[PM WhatsApp] No mobile number provided, skipping ${type} automation`);
    return;
  }

  // Quick validation: skip if mobile looks like an email or has no digits
  const digitsOnly = mobile.replace(/\D/g, "");
  if (mobile.includes("@") || digitsOnly.length < 10) {
    console.log(`[PM WhatsApp] Invalid mobile "${mobile}", skipping ${type} automation`);
    return;
  }

  const automation = await PmWhatsappAutomation.findOne({
    type,
    pipelineStage,
    isActive: true,
  }).populate("templateId");

  if (!automation || !automation.templateId) {
    console.log(`[PM WhatsApp] No active ${type} automation for stage "${pipelineStage}"`);
    return;
  }

  const template = automation.templateId;
  if (!template.isActive) {
    console.log(`[PM WhatsApp] Template "${template.name}" is inactive, skipping`);
    return;
  }

  const sendMessage = async () => {
    try {
      await sendWhatsappTemplate(template._id.toString(), mobile, inquiryId);
      console.log(
        `[PM WhatsApp] ${type} automation sent "${template.name}" to ${mobile} (stage: ${pipelineStage})`
      );
    } catch (err) {
      console.error(
        `[PM WhatsApp] Failed ${type} automation "${template.name}" to ${mobile}:`,
        err.message
      );
    }
  };

  // Handle delay
  if (automation.delay > 0) {
    console.log(
      `[PM WhatsApp] Scheduling ${type} automation "${template.name}" with ${automation.delay}min delay`
    );
    setTimeout(sendMessage, automation.delay * 60 * 1000);
  } else {
    await sendMessage();
  }
};

export { formatMobile, updateInquiryScoreForWhatsapp };
