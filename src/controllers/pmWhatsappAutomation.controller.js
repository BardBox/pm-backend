import { PmWhatsappAutomation } from "../models/pmWhatsappAutomation.model.js";
import { PmScoringConfig, DEFAULT_PIPELINE_STAGES } from "../models/pmScoringConfig.model.js";
import ApiResponses from "../utils/ApiResponses.js";
import asyncHandler from "../utils/asyncHandler.js";

/**
 * Get all WhatsApp automations
 * GET /api/v1/pm/whatsapp-automations
 */
const getAllAutomations = asyncHandler(async (req, res) => {
  const automations = await PmWhatsappAutomation.find()
    .populate("templateId", "name tftTemplateName category")
    .sort({ type: 1, pipelineStage: 1 });

  return res.status(200).json(
    new ApiResponses(200, automations, "WhatsApp automations fetched successfully")
  );
});

/**
 * Get distinct automation groups (for tabs)
 * GET /api/v1/pm/whatsapp-automations/groups
 */
const getAutomationGroups = asyncHandler(async (req, res) => {
  const automations = await PmWhatsappAutomation.find().lean();

  const groupMap = new Map();
  for (const a of automations) {
    if (!groupMap.has(a.type)) {
      groupMap.set(a.type, {
        type: a.type,
        groupName: a.groupName,
        isBuiltIn: a.isBuiltIn,
      });
    }
  }

  // Always include built-in groups
  if (!groupMap.has("welcome")) {
    groupMap.set("welcome", { type: "welcome", groupName: "Welcome", isBuiltIn: true });
  }
  if (!groupMap.has("follow_up")) {
    groupMap.set("follow_up", { type: "follow_up", groupName: "Follow-ups", isBuiltIn: true });
  }

  const groups = Array.from(groupMap.values()).sort((a, b) => {
    if (a.isBuiltIn && !b.isBuiltIn) return -1;
    if (!a.isBuiltIn && b.isBuiltIn) return 1;
    return a.groupName.localeCompare(b.groupName);
  });

  return res.status(200).json(
    new ApiResponses(200, groups, "WhatsApp automation groups fetched")
  );
});

/**
 * Get pipeline stages
 * GET /api/v1/pm/whatsapp-automations/pipeline-stages
 */
const getPipelineStages = asyncHandler(async (req, res) => {
  const config = await PmScoringConfig.findOne();
  const stages =
    config && config.pipelineStages && config.pipelineStages.length > 0
      ? config.pipelineStages
      : DEFAULT_PIPELINE_STAGES;

  return res.status(200).json(
    new ApiResponses(200, stages, "Pipeline stages fetched")
  );
});

/**
 * Create a new custom automation group
 * POST /api/v1/pm/whatsapp-automations/groups
 */
const createCustomGroup = asyncHandler(async (req, res) => {
  const { groupName } = req.body;

  if (!groupName || !groupName.trim()) {
    return res.status(400).json(
      new ApiResponses(400, null, "Group name is required")
    );
  }

  const slug = `custom_${Date.now()}`;

  const config = await PmScoringConfig.findOne();
  const stages =
    config && config.pipelineStages && config.pipelineStages.length > 0
      ? config.pipelineStages
      : DEFAULT_PIPELINE_STAGES;

  const automations = [];
  for (const stage of stages) {
    automations.push({
      type: slug,
      groupName: groupName.trim(),
      isBuiltIn: false,
      pipelineStage: stage.key,
      templateId: null,
      isActive: false,
      delay: 0,
    });
  }

  await PmWhatsappAutomation.insertMany(automations);

  return res.status(201).json(
    new ApiResponses(201, { type: slug, groupName: groupName.trim(), isBuiltIn: false }, "Custom WhatsApp automation group created")
  );
});

/**
 * Delete an entire custom automation group
 * DELETE /api/v1/pm/whatsapp-automations/groups/:type
 */
const deleteCustomGroup = asyncHandler(async (req, res) => {
  const { type } = req.params;

  if (type === "welcome" || type === "follow_up") {
    return res.status(400).json(
      new ApiResponses(400, null, "Cannot delete built-in automation groups")
    );
  }

  const result = await PmWhatsappAutomation.deleteMany({ type });

  if (result.deletedCount === 0) {
    return res.status(404).json(new ApiResponses(404, null, "Automation group not found"));
  }

  return res.status(200).json(
    new ApiResponses(200, null, "WhatsApp automation group deleted successfully")
  );
});

/**
 * Create or update automation (upsert by type + pipelineStage)
 * PUT /api/v1/pm/whatsapp-automations
 */
const upsertAutomation = asyncHandler(async (req, res) => {
  const { type, pipelineStage, templateId, isActive, delay, groupName } = req.body;

  if (!type || !pipelineStage) {
    return res.status(400).json(
      new ApiResponses(400, null, "Type and pipeline stage are required")
    );
  }

  const isBuiltIn = type === "welcome" || type === "follow_up";
  const displayName = groupName || (isBuiltIn ? (type === "welcome" ? "Welcome" : "Follow-ups") : type);

  const automation = await PmWhatsappAutomation.findOneAndUpdate(
    { type, pipelineStage },
    {
      type,
      pipelineStage,
      templateId: templateId || null,
      isActive: isActive !== undefined ? isActive : false,
      delay: delay || 0,
      groupName: displayName,
      isBuiltIn,
    },
    { upsert: true, new: true }
  );

  const populated = await automation.populate("templateId", "name tftTemplateName category");

  return res.status(200).json(
    new ApiResponses(200, populated, "WhatsApp automation saved successfully")
  );
});

/**
 * Delete single automation
 * DELETE /api/v1/pm/whatsapp-automations/:id
 */
const deleteAutomation = asyncHandler(async (req, res) => {
  const automation = await PmWhatsappAutomation.findByIdAndDelete(req.params.id);
  if (!automation) {
    return res.status(404).json(new ApiResponses(404, null, "Automation not found"));
  }
  return res.status(200).json(
    new ApiResponses(200, null, "WhatsApp automation deleted successfully")
  );
});

export {
  getAllAutomations,
  getAutomationGroups,
  getPipelineStages,
  createCustomGroup,
  deleteCustomGroup,
  upsertAutomation,
  deleteAutomation,
};
