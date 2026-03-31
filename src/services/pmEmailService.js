import { Resend } from "resend";
import { PmEmailTemplate } from "../models/pmEmailTemplate.model.js";
import { PmEmailAutomation } from "../models/pmEmailAutomation.model.js";
import { PmEmailEvent } from "../models/pmEmailEvent.model.js";
import { PmInquiry } from "../models/pmInquiry.model.js";

const BACKEND_URL = process.env.PM_BACKEND_URL;
const TRACK_BASE = `${BACKEND_URL}/pm/track`;

export const deliverEmail = async ({ from, to, subject, html }) => {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({ from, to, subject, html });
  if (error) throw new Error(error.message);
  return data;
};

/**
 * Replace placeholders in content with inquiry data
 */
const FRONTEND_URL = "https://bizcivitas-performance-marketing.vercel.app";

export const replacePlaceholders = (html, data) => {
  return html
    .replace(/\{\{name\}\}/gi, data.name || "")
    .replace(/\{\{email\}\}/gi, data.email || "")
    .replace(/\{\{company\}\}/gi, data.company || "")
    .replace(/\{\{phone\}\}/gi, data.phone || "")
    .replace(/\{\{city\}\}/gi, data.city || "")
    .replace(/\{\{state\}\}/gi, data.state || "")
    .replace(/\{\{cta_link\}\}/gi, data.ctaLink || FRONTEND_URL);
};

/**
 * Inject open tracking pixel into HTML (before </body> or at end)
 */
export const injectTrackingPixel = (html, email, templateId) => {
  const params = new URLSearchParams({
    e: email,
    t: templateId,
    ts: Date.now().toString(),
  });
  const pixelUrl = `${TRACK_BASE}/open?${params.toString()}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="" />`;

  if (html.includes("</body>")) {
    return html.replace("</body>", `${pixel}</body>`);
  }
  return html + pixel;
};

/**
 * Auto-append UTM params to landing page links in the email
 */
const appendUtmParams = (html, type, pipelineStage, templateName, inquiryId) => {
  return html.replace(
    /<a\s([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi,
    (match, before, url, after) => {
      // Only add UTMs to our own landing page links
      if (!url.includes("bizcivitas-performance-marketing")) return match;
      try {
        const urlObj = new URL(url);
        if (!urlObj.searchParams.has("utm_source")) urlObj.searchParams.set("utm_source", "email");
        if (!urlObj.searchParams.has("utm_medium")) urlObj.searchParams.set("utm_medium", type || "automation");
        if (!urlObj.searchParams.has("utm_campaign")) urlObj.searchParams.set("utm_campaign", `${pipelineStage}_${(templateName || "email").replace(/\s+/g, "_").toLowerCase()}`);
        // Attach inquiry_id so returning visitors auto-redirect to checkout
        if (inquiryId && !urlObj.searchParams.has("inquiry_id")) urlObj.searchParams.set("inquiry_id", inquiryId);
        return `<a ${before}href="${urlObj.toString()}"${after}>`;
      } catch {
        return match;
      }
    }
  );
};

/**
 * Wrap all <a href="..."> links with click tracking redirect
 * Skips mailto: links and unsubscribe links
 */
export const wrapLinksWithTracking = (html, email, templateId) => {
  return html.replace(
    /<a\s([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi,
    (match, before, url, after) => {
      // Skip mailto, tel, anchor links, and tracking URLs (avoid double-wrapping)
      if (
        url.startsWith("mailto:") ||
        url.startsWith("tel:") ||
        url.startsWith("#") ||
        url.includes("/pm/track/")
      ) {
        return match;
      }

      const params = new URLSearchParams({
        e: email,
        t: templateId,
        url: url,
      });
      const trackedUrl = `${TRACK_BASE}/click?${params.toString()}`;
      return `<a ${before}href="${trackedUrl}"${after}>`;
    }
  );
};

/**
 * Log a "sent" event to PmEmailEvent
 */
const logSentEvent = async (email, templateId, templateName) => {
  try {
    const inquiry = await PmInquiry.findOne({
      email: email.toLowerCase(),
    }).sort({ createdAt: -1 });

    await PmEmailEvent.create({
      email: email.toLowerCase(),
      eventType: "sent",
      campaignId: templateId,
      campaignName: templateName || "PM Automation",
      inquiryId: inquiry?._id || null,
      eventTimestamp: new Date(),
      metadata: { source: "pm_automation" },
    });
  } catch (err) {
    console.error("[PM Email] Failed to log sent event:", err.message);
  }
};

/**
 * Send an email using a specific PM template (with tracking)
 */
export const sendPmTemplateEmail = async (templateId, recipientEmail, placeholderData = {}) => {
  const template = await PmEmailTemplate.findById(templateId);
  if (!template || !template.isActive) return null;

  let html = replacePlaceholders(template.htmlContent, placeholderData);
  const subject = replacePlaceholders(template.subject, placeholderData);

  // Find inquiry for this recipient to attach inquiry_id to links
  const inquiryForLink = await PmInquiry.findOne({ email: recipientEmail.toLowerCase() }).sort({ createdAt: -1 });

  // Append UTM params + inquiry_id to landing page links
  html = appendUtmParams(html, "campaign", "manual", template.name, inquiryForLink?._id?.toString());

  // Inject tracking
  html = wrapLinksWithTracking(html, recipientEmail, templateId);
  html = injectTrackingPixel(html, recipientEmail, templateId);

  const info = await deliverEmail({
    from: process.env.RESEND_FROM_EMAIL,
    to: recipientEmail,
    subject,
    html,
  });

  // Update template stats
  template.lastSentAt = new Date();
  template.sentCount += 1;
  await template.save();

  // Log sent event
  await logSentEvent(recipientEmail, templateId, template.name);

  console.log(`[PM Email] Sent "${template.name}" to ${recipientEmail} (tracked)`);
  return info;
};

/**
 * Trigger automation emails based on type and pipeline stage
 */
export const triggerAutomationEmail = async (type, pipelineStage, recipientEmail, placeholderData = {}) => {
  const automation = await PmEmailAutomation.findOne({
    type,
    pipelineStage,
    isActive: true,
  }).populate("templateId");

  if (!automation || !automation.templateId) {
    console.log(`[PM Email] No active ${type} automation for stage "${pipelineStage}"`);
    return;
  }

  const template = automation.templateId;
  if (!template.isActive) {
    console.log(`[PM Email] Template "${template.name}" is inactive, skipping`);
    return;
  }

  const sendEmail = async () => {
    try {
      // Build personalized CTA link — returning users go to checkout
      const inquiry = await PmInquiry.findOne({ email: recipientEmail.toLowerCase() }).sort({ createdAt: -1 });
      if (inquiry && inquiry.status !== "converted") {
        placeholderData.ctaLink = `${FRONTEND_URL}/checkout?inquiry_id=${inquiry._id}`;
      }

      let html = replacePlaceholders(template.htmlContent, placeholderData);
      const subject = replacePlaceholders(template.subject, placeholderData);

      // Append UTM params + inquiry_id to landing page links
      html = appendUtmParams(html, type, pipelineStage, template.name, inquiry?._id?.toString());

      // Inject tracking
      html = wrapLinksWithTracking(html, recipientEmail, template._id.toString());
      html = injectTrackingPixel(html, recipientEmail, template._id.toString());

      await deliverEmail({
        from: process.env.RESEND_FROM_EMAIL,
        to: recipientEmail,
        subject,
        html,
      });

      template.lastSentAt = new Date();
      template.sentCount += 1;
      await template.save();

      // Log sent event
      await logSentEvent(recipientEmail, template._id.toString(), template.name);

      console.log(
        `[PM Email] ${type} automation sent "${template.name}" to ${recipientEmail} (stage: ${pipelineStage}, tracked)`
      );
    } catch (err) {
      console.error(
        `[PM Email] Failed ${type} automation "${template.name}" to ${recipientEmail}:`,
        err.message
      );
    }
  };

  // Handle delay
  if (automation.delay > 0) {
    console.log(
      `[PM Email] Scheduling ${type} automation "${template.name}" with ${automation.delay}min delay`
    );
    setTimeout(sendEmail, automation.delay * 60 * 1000);
  } else {
    await sendEmail();
  }
};
