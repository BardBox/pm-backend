import { PmEmailTemplate } from "../models/pmEmailTemplate.model.js";
import { PmInquiry } from "../models/pmInquiry.model.js";
import { sendPmTemplateEmail } from "../services/pmEmailService.js";
import ApiResponses from "../utils/ApiResponses.js";
import asyncHandler from "../utils/asyncHandler.js";

const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY;
const MAILERLITE_BASE_URL = "https://connect.mailerlite.com/api";
const MAILERLITE_GROUP_ID = process.env.MAILERLITE_GROUP_ID;

const mlHeaders = {
  Authorization: `Bearer ${MAILERLITE_API_KEY}`,
  "Content-Type": "application/json",
  Accept: "application/json",
};

/**
 * Get all templates
 * GET /api/v1/pm/email-templates
 */
const getAllTemplates = asyncHandler(async (req, res) => {
  const { category, isActive } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (isActive !== undefined) filter.isActive = isActive === "true";

  const templates = await PmEmailTemplate.find(filter).sort({ updatedAt: -1 });
  return res.status(200).json(
    new ApiResponses(200, templates, "Templates fetched successfully")
  );
});

/**
 * Get single template
 * GET /api/v1/pm/email-templates/:id
 */
const getTemplate = asyncHandler(async (req, res) => {
  const template = await PmEmailTemplate.findById(req.params.id);
  if (!template) {
    return res.status(404).json(new ApiResponses(404, null, "Template not found"));
  }
  return res.status(200).json(
    new ApiResponses(200, template, "Template fetched successfully")
  );
});

/**
 * Create template
 * POST /api/v1/pm/email-templates
 */
const createTemplate = asyncHandler(async (req, res) => {
  const { name, subject, preheader, htmlContent, category, autoSend } = req.body;

  if (!name || !subject || !htmlContent) {
    return res.status(400).json(
      new ApiResponses(400, null, "Name, subject, and HTML content are required")
    );
  }

  // If setting autoSend to "on_inquiry", clear it from other templates first
  if (autoSend && autoSend !== "none") {
    await PmEmailTemplate.updateMany(
      { autoSend },
      { $set: { autoSend: "none" } }
    );
  }

  const template = await PmEmailTemplate.create({
    name,
    subject,
    preheader: preheader || "",
    htmlContent,
    category: category || "custom",
    autoSend: autoSend || "none",
  });

  return res.status(201).json(
    new ApiResponses(201, template, "Template created successfully")
  );
});

/**
 * Update template
 * PUT /api/v1/pm/email-templates/:id
 */
const updateTemplate = asyncHandler(async (req, res) => {
  const { name, subject, preheader, htmlContent, category, isActive, autoSend } = req.body;

  const template = await PmEmailTemplate.findById(req.params.id);
  if (!template) {
    return res.status(404).json(new ApiResponses(404, null, "Template not found"));
  }

  // If setting autoSend to "on_inquiry", clear it from other templates first
  if (autoSend && autoSend !== "none") {
    await PmEmailTemplate.updateMany(
      { autoSend, _id: { $ne: template._id } },
      { $set: { autoSend: "none" } }
    );
  }

  if (name !== undefined) template.name = name;
  if (subject !== undefined) template.subject = subject;
  if (preheader !== undefined) template.preheader = preheader;
  if (htmlContent !== undefined) template.htmlContent = htmlContent;
  if (category !== undefined) template.category = category;
  if (isActive !== undefined) template.isActive = isActive;
  if (autoSend !== undefined) template.autoSend = autoSend;

  await template.save();

  return res.status(200).json(
    new ApiResponses(200, template, "Template updated successfully")
  );
});

/**
 * Delete template
 * DELETE /api/v1/pm/email-templates/:id
 */
const deleteTemplate = asyncHandler(async (req, res) => {
  const template = await PmEmailTemplate.findByIdAndDelete(req.params.id);
  if (!template) {
    return res.status(404).json(new ApiResponses(404, null, "Template not found"));
  }
  return res.status(200).json(
    new ApiResponses(200, null, "Template deleted successfully")
  );
});

/**
 * Send campaign using a template
 * POST /api/v1/pm/email-templates/:id/send
 *
 * Body: { emails?: string[], groupId?: string }
 *   - If emails[] is provided: sends via Gmail SMTP to those specific emails (with tracking)
 *   - If no emails[]: falls back to MailerLite campaign to a subscriber group
 */
const sendCampaign = asyncHandler(async (req, res) => {
  const template = await PmEmailTemplate.findById(req.params.id);
  if (!template) {
    return res.status(404).json(new ApiResponses(404, null, "Template not found"));
  }

  const { emails } = req.body;

  // ── Mode 1: Send to specific emails via SMTP (selected / manual) ──
  if (emails && Array.isArray(emails) && emails.length > 0) {
    const results = { sent: 0, failed: 0, errors: [] };

    for (const email of emails) {
      try {
        // Look up inquiry for placeholder data
        const inquiry = await PmInquiry.findOne({
          email: email.toLowerCase(),
        }).sort({ createdAt: -1 });

        const placeholderData = inquiry
          ? {
              name: inquiry.fullName || "",
              email: inquiry.email || email,
              company: inquiry.companyName || "",
              phone: inquiry.phone || "",
              city: inquiry.city || "",
              state: inquiry.state || "",
            }
          : { name: "", email, company: "", phone: "", city: "", state: "" };

        await sendPmTemplateEmail(template._id.toString(), email, placeholderData);
        results.sent++;
      } catch (err) {
        results.failed++;
        results.errors.push({ email, error: err.message });
        console.error(`[PM Campaign] Failed to send to ${email}:`, err.message);
      }
    }

    console.log(
      `[PM Campaign] "${template.name}" — sent: ${results.sent}, failed: ${results.failed}`
    );

    return res.status(200).json(
      new ApiResponses(
        200,
        {
          templateName: template.name,
          totalRecipients: emails.length,
          sent: results.sent,
          failed: results.failed,
          errors: results.errors.length > 0 ? results.errors : undefined,
        },
        results.failed > 0
          ? `Campaign sent to ${results.sent}/${emails.length} recipients (${results.failed} failed)`
          : `Campaign sent successfully to ${results.sent} recipient${results.sent > 1 ? "s" : ""}`
      )
    );
  }

  // ── Mode 2: Fallback to MailerLite group campaign ──
  if (!MAILERLITE_API_KEY) {
    return res.status(400).json(
      new ApiResponses(400, null, "MailerLite API key not configured")
    );
  }

  const groupId = req.body.groupId || MAILERLITE_GROUP_ID;
  if (!groupId) {
    return res.status(400).json(
      new ApiResponses(400, null, "No group ID provided and no default group configured")
    );
  }

  try {
    // Step 1: Create campaign
    const campaignRes = await fetch(`${MAILERLITE_BASE_URL}/campaigns`, {
      method: "POST",
      headers: mlHeaders,
      body: JSON.stringify({
        name: `${template.name} - ${new Date().toISOString().split("T")[0]}`,
        type: "regular",
        emails: [
          {
            subject: template.subject,
            from: process.env.MAILERLITE_FROM_EMAIL || "connect@bizcivitas.com",
            from_name: process.env.MAILERLITE_FROM_NAME || "BizCivitas",
            content: template.htmlContent,
          },
        ],
        groups: [groupId],
      }),
    });

    const campaignData = await campaignRes.json();

    if (!campaignRes.ok) {
      console.error("[MailerLite] Campaign creation failed:", campaignData);
      return res.status(500).json(
        new ApiResponses(500, campaignData, "Failed to create campaign in MailerLite")
      );
    }

    const campaignId = campaignData.data?.id;

    // Step 2: Schedule/send the campaign immediately
    const sendRes = await fetch(
      `${MAILERLITE_BASE_URL}/campaigns/${campaignId}/schedule`,
      {
        method: "POST",
        headers: mlHeaders,
        body: JSON.stringify({
          delivery: "instant",
        }),
      }
    );

    const sendData = await sendRes.json();

    if (!sendRes.ok) {
      console.error("[MailerLite] Campaign send failed:", sendData);
      return res.status(500).json(
        new ApiResponses(500, sendData, "Campaign created but failed to send")
      );
    }

    // Update template stats
    template.lastSentAt = new Date();
    template.sentCount += 1;
    await template.save();

    console.log(`[MailerLite] Campaign sent: ${template.name} (ID: ${campaignId})`);

    return res.status(200).json(
      new ApiResponses(200, {
        campaignId,
        templateName: template.name,
        sentAt: template.lastSentAt,
      }, "Campaign sent successfully via MailerLite")
    );
  } catch (error) {
    console.error("[MailerLite] Send campaign error:", error.message);
    return res.status(500).json(
      new ApiResponses(500, null, "Failed to send campaign: " + error.message)
    );
  }
});

export {
  getAllTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  sendCampaign,
};
