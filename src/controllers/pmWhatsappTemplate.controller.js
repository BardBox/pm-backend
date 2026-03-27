import { PmWhatsappTemplate } from "../models/pmWhatsappTemplate.model.js";
import { PmInquiry } from "../models/pmInquiry.model.js";
import { sendWhatsappTemplate } from "../services/pmWhatsappService.js";
import {
  fetchTftTemplateList,
  fetchTftTemplateDetails,
  createTftTemplate,
  deleteTftTemplate,
  getTftChannels,
} from "../services/tftSessionService.js";
import ApiResponses from "../utils/ApiResponses.js";
import asyncHandler from "../utils/asyncHandler.js";

/**
 * Get all WhatsApp templates
 * GET /api/v1/pm/whatsapp-templates
 */
const getAllTemplates = asyncHandler(async (req, res) => {
  const { category, isActive, tftStatus } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (isActive !== undefined) filter.isActive = isActive === "true";
  if (tftStatus) filter.tftStatus = tftStatus;

  const templates = await PmWhatsappTemplate.find(filter).sort({ updatedAt: -1 });
  return res.status(200).json(
    new ApiResponses(200, templates, "WhatsApp templates fetched successfully")
  );
});

/**
 * Get single WhatsApp template
 * GET /api/v1/pm/whatsapp-templates/:id
 */
const getTemplate = asyncHandler(async (req, res) => {
  const template = await PmWhatsappTemplate.findById(req.params.id);
  if (!template) {
    return res.status(404).json(new ApiResponses(404, null, "Template not found"));
  }
  return res.status(200).json(
    new ApiResponses(200, template, "Template fetched successfully")
  );
});

/**
 * Create WhatsApp template (local only — for manual entry)
 * POST /api/v1/pm/whatsapp-templates
 */
const createTemplate = asyncHandler(async (req, res) => {
  const { name, tftTemplateName, description, category } = req.body;

  if (!name || !tftTemplateName) {
    return res.status(400).json(
      new ApiResponses(400, null, "Name and TFT template name are required")
    );
  }

  const existing = await PmWhatsappTemplate.findOne({ tftTemplateName: tftTemplateName.trim() });
  if (existing) {
    return res.status(400).json(
      new ApiResponses(400, null, "A template with this TFT template name already exists")
    );
  }

  const template = await PmWhatsappTemplate.create({
    name: name.trim(),
    tftTemplateName: tftTemplateName.trim(),
    description: description || "",
    category: category || "custom",
    source: "manual",
  });

  return res.status(201).json(
    new ApiResponses(201, template, "WhatsApp template created successfully")
  );
});

/**
 * Create WhatsApp template on TFT platform + save locally
 * POST /api/v1/pm/whatsapp-templates/create-on-tft
 */
const createOnTft = asyncHandler(async (req, res) => {
  const {
    templatename, temptype, msg, lang, category,
    footer, dvariables, lcap, lnk, cbtncap, callno,
    qreply, displayName, description,
  } = req.body;

  if (!templatename || !msg) {
    return res.status(400).json(
      new ApiResponses(400, null, "Template name and message are required")
    );
  }

  // Sanitize template name (TFT only allows lowercase, numbers, underscores)
  const cleanName = templatename.toLowerCase().replace(/[^a-z0-9_]/g, "_");

  // Check if already exists locally
  const existing = await PmWhatsappTemplate.findOne({ tftTemplateName: cleanName });
  if (existing) {
    return res.status(400).json(
      new ApiResponses(400, null, `Template "${cleanName}" already exists`)
    );
  }

  // Submit to TFT
  let tftResult;
  try {
    tftResult = await createTftTemplate({
      templatename: cleanName,
      temptype: temptype || "standard",
      msg,
      lang: lang || "en",
      category: category || "MARKETING",
      footer: footer || "",
      dvariables: dvariables || "",
      lcap: lcap || "",
      lnk: lnk || "",
      cbtncap: cbtncap || "",
      callno: callno || "",
      qreply: qreply || [],
    });
  } catch (err) {
    return res.status(500).json(
      new ApiResponses(500, null, `Failed to create template on TFT: ${err.message}`)
    );
  }

  if (tftResult && tftResult.code !== 200) {
    return res.status(400).json(
      new ApiResponses(400, tftResult, tftResult.msg || "TFT rejected the template")
    );
  }

  // Save locally
  const template = await PmWhatsappTemplate.create({
    name: displayName || cleanName,
    tftTemplateName: cleanName,
    description: description || "",
    category: (category || "MARKETING").toLowerCase(),
    tftCategory: category || "MARKETING",
    tftStatus: "PENDING",
    tftMessage: msg,
    tftFooter: footer || "",
    tftLanguage: lang || "en",
    tftTemplateType: temptype || "standard",
    tftDynamicVars: dvariables || "",
    tftQuickReply: Array.isArray(qreply) ? qreply.join(",") : "",
    tftLinkCaption: lcap || "",
    tftLink: lnk || "",
    tftCallCaption: cbtncap || "",
    tftCallNumber: callno || "",
    source: "created_via_admin",
    lastSyncedAt: new Date(),
  });

  return res.status(201).json(
    new ApiResponses(201, { template, tftResult }, "Template submitted to TFT for approval")
  );
});

/**
 * Sync all templates from TFT platform into local DB
 * POST /api/v1/pm/whatsapp-templates/sync
 */
const syncFromTft = asyncHandler(async (req, res) => {
  let tftTemplates;
  try {
    tftTemplates = await fetchTftTemplateList();
  } catch (err) {
    return res.status(500).json(
      new ApiResponses(500, null, `Failed to fetch from TFT: ${err.message}`)
    );
  }

  if (!Array.isArray(tftTemplates)) {
    return res.status(500).json(
      new ApiResponses(500, null, "Invalid response from TFT template list API")
    );
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const tft of tftTemplates) {
    const tftName = tft.templatename;
    if (!tftName) { skipped++; continue; }

    const existing = await PmWhatsappTemplate.findOne({ tftTemplateName: tftName });

    const syncData = {
      tftCategory: tft.category || "",
      tftStatus: tft.status || "",
      tftMessage: tft.message || "",
      tftFooter: tft.footer || "",
      tftSystemId: tft.systempid || "",
      tftTemplateId: tft.tempid || "",
      tftDynamicVars: tft.dyvar || "",
      tftQuickReply: tft.quickreply || "",
      tftLinkCaption: tft.linkcap || "",
      tftLink: tft.lnk || "",
      tftCallCaption: tft.callcap || "",
      tftCallNumber: tft.callno || "",
      tftCreatedOn: tft.createon || "",
      lastSyncedAt: new Date(),
    };

    if (existing) {
      // Update existing
      Object.assign(existing, syncData);
      await existing.save();
      updated++;
    } else {
      // Create new
      await PmWhatsappTemplate.create({
        name: tftName,
        tftTemplateName: tftName,
        description: (tft.message || "").substring(0, 100),
        category: (tft.category || "custom").toLowerCase(),
        source: "synced",
        ...syncData,
      });
      created++;
    }
  }

  return res.status(200).json(
    new ApiResponses(200, {
      total: tftTemplates.length,
      created,
      updated,
      skipped,
    }, `Sync complete: ${created} created, ${updated} updated, ${skipped} skipped`)
  );
});

/**
 * Get template preview (full Meta component structure from TFT)
 * GET /api/v1/pm/whatsapp-templates/:id/preview
 */
const getTemplatePreview = asyncHandler(async (req, res) => {
  const template = await PmWhatsappTemplate.findById(req.params.id);
  if (!template) {
    return res.status(404).json(new ApiResponses(404, null, "Template not found"));
  }

  let preview;
  try {
    preview = await fetchTftTemplateDetails(template.tftTemplateName);
  } catch (err) {
    return res.status(500).json(
      new ApiResponses(500, null, `Failed to fetch preview from TFT: ${err.message}`)
    );
  }

  // Update local record with components
  template.tftComponents = preview;
  await template.save();

  return res.status(200).json(
    new ApiResponses(200, preview, "Template preview fetched")
  );
});

/**
 * Get TFT channel list (WhatsApp numbers)
 * GET /api/v1/pm/whatsapp-templates/channels
 */
const getChannels = asyncHandler(async (req, res) => {
  try {
    const channels = await getTftChannels();
    return res.status(200).json(
      new ApiResponses(200, channels, "Channels fetched")
    );
  } catch (err) {
    return res.status(500).json(
      new ApiResponses(500, null, `Failed to fetch channels: ${err.message}`)
    );
  }
});

/**
 * Update WhatsApp template
 * PUT /api/v1/pm/whatsapp-templates/:id
 */
const updateTemplate = asyncHandler(async (req, res) => {
  const { name, tftTemplateName, description, category, isActive } = req.body;

  const template = await PmWhatsappTemplate.findById(req.params.id);
  if (!template) {
    return res.status(404).json(new ApiResponses(404, null, "Template not found"));
  }

  if (tftTemplateName && tftTemplateName.trim() !== template.tftTemplateName) {
    const existing = await PmWhatsappTemplate.findOne({
      tftTemplateName: tftTemplateName.trim(),
      _id: { $ne: template._id },
    });
    if (existing) {
      return res.status(400).json(
        new ApiResponses(400, null, "A template with this TFT template name already exists")
      );
    }
  }

  if (name !== undefined) template.name = name;
  if (tftTemplateName !== undefined) template.tftTemplateName = tftTemplateName.trim();
  if (description !== undefined) template.description = description;
  if (category !== undefined) template.category = category;
  if (isActive !== undefined) template.isActive = isActive;

  await template.save();

  return res.status(200).json(
    new ApiResponses(200, template, "Template updated successfully")
  );
});

/**
 * Delete WhatsApp template
 * DELETE /api/v1/pm/whatsapp-templates/:id
 */
const deleteTemplate = asyncHandler(async (req, res) => {
  const template = await PmWhatsappTemplate.findByIdAndDelete(req.params.id);
  if (!template) {
    return res.status(404).json(new ApiResponses(404, null, "Template not found"));
  }
  return res.status(200).json(
    new ApiResponses(200, null, "Template deleted successfully")
  );
});

/**
 * Send WhatsApp to specific inquiry/mobile
 * POST /api/v1/pm/whatsapp-templates/:id/send
 */
const sendWhatsapp = asyncHandler(async (req, res) => {
  const template = await PmWhatsappTemplate.findById(req.params.id);
  if (!template) {
    return res.status(404).json(new ApiResponses(404, null, "Template not found"));
  }

  const { mobile, inquiryId, mobiles } = req.body;

  if (mobiles && Array.isArray(mobiles) && mobiles.length > 0) {
    const results = { sent: 0, failed: 0, errors: [] };

    for (const item of mobiles) {
      try {
        let inqId = item.inquiryId;
        if (!inqId && item.mobile) {
          const inquiry = await PmInquiry.findOne({
            phone: { $regex: item.mobile.replace(/\D/g, "").slice(-10) },
          }).sort({ createdAt: -1 });
          inqId = inquiry?._id || null;
        }

        await sendWhatsappTemplate(template._id.toString(), item.mobile, inqId);
        results.sent++;
      } catch (err) {
        results.failed++;
        results.errors.push({ mobile: item.mobile, error: err.message });
      }
    }

    return res.status(200).json(
      new ApiResponses(
        200,
        { templateName: template.name, totalRecipients: mobiles.length, ...results },
        results.failed > 0
          ? `WhatsApp sent to ${results.sent}/${mobiles.length} recipients`
          : `WhatsApp sent successfully to ${results.sent} recipient${results.sent > 1 ? "s" : ""}`
      )
    );
  }

  if (!mobile) {
    return res.status(400).json(
      new ApiResponses(400, null, "Mobile number is required")
    );
  }

  try {
    const result = await sendWhatsappTemplate(template._id.toString(), mobile, inquiryId || null);
    return res.status(200).json(
      new ApiResponses(200, result, "WhatsApp message sent successfully")
    );
  } catch (err) {
    return res.status(500).json(
      new ApiResponses(500, null, `Failed to send WhatsApp: ${err.message}`)
    );
  }
});

export {
  getAllTemplates,
  getTemplate,
  createTemplate,
  createOnTft,
  syncFromTft,
  getTemplatePreview,
  getChannels,
  updateTemplate,
  deleteTemplate,
  sendWhatsapp,
};
