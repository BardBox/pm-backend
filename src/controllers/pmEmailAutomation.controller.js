import { PmEmailAutomation } from "../models/pmEmailAutomation.model.js";
import { PmScoringConfig, DEFAULT_PIPELINE_STAGES } from "../models/pmScoringConfig.model.js";
import ApiResponses from "../utils/ApiResponses.js";
import asyncHandler from "../utils/asyncHandler.js";

/**
 * Get all automations
 * GET /api/v1/pm/email-automations
 */
const getAllAutomations = asyncHandler(async (req, res) => {
  const automations = await PmEmailAutomation.find()
    .populate("templateId", "name subject category")
    .sort({ type: 1, pipelineStage: 1 });

  return res.status(200).json(
    new ApiResponses(200, automations, "Automations fetched successfully")
  );
});

/**
 * Get distinct automation groups (for tabs)
 * Returns: [{ type, groupName, isBuiltIn }]
 * GET /api/v1/pm/email-automations/groups
 */
const getAutomationGroups = asyncHandler(async (req, res) => {
  const automations = await PmEmailAutomation.find().lean();

  // Extract unique groups
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

  // Always include built-in groups even if no automations exist yet
  if (!groupMap.has("welcome")) {
    groupMap.set("welcome", { type: "welcome", groupName: "Welcome", isBuiltIn: true });
  }
  if (!groupMap.has("follow_up")) {
    groupMap.set("follow_up", { type: "follow_up", groupName: "Follow-ups", isBuiltIn: true });
  }

  // Sort: built-in first, then custom by name
  const groups = Array.from(groupMap.values()).sort((a, b) => {
    if (a.isBuiltIn && !b.isBuiltIn) return -1;
    if (!a.isBuiltIn && b.isBuiltIn) return 1;
    return a.groupName.localeCompare(b.groupName);
  });

  return res.status(200).json(
    new ApiResponses(200, groups, "Automation groups fetched")
  );
});

/**
 * Get pipeline stages (for UI dropdown)
 * GET /api/v1/pm/email-automations/pipeline-stages
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
 * POST /api/v1/pm/email-automations/groups
 * Body: { groupName }
 */
const createCustomGroup = asyncHandler(async (req, res) => {
  const { groupName } = req.body;

  if (!groupName || !groupName.trim()) {
    return res.status(400).json(
      new ApiResponses(400, null, "Group name is required")
    );
  }

  const slug = `custom_${Date.now()}`;

  // Get pipeline stages to pre-create empty automation rows
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

  await PmEmailAutomation.insertMany(automations);

  return res.status(201).json(
    new ApiResponses(201, { type: slug, groupName: groupName.trim(), isBuiltIn: false }, "Custom automation group created")
  );
});

/**
 * Delete an entire custom automation group
 * DELETE /api/v1/pm/email-automations/groups/:type
 */
const deleteCustomGroup = asyncHandler(async (req, res) => {
  const { type } = req.params;

  // Prevent deleting built-in groups
  if (type === "welcome" || type === "follow_up") {
    return res.status(400).json(
      new ApiResponses(400, null, "Cannot delete built-in automation groups")
    );
  }

  const result = await PmEmailAutomation.deleteMany({ type });

  if (result.deletedCount === 0) {
    return res.status(404).json(new ApiResponses(404, null, "Automation group not found"));
  }

  return res.status(200).json(
    new ApiResponses(200, null, "Automation group deleted successfully")
  );
});

/**
 * Create or update automation (upsert by type + pipelineStage)
 * PUT /api/v1/pm/email-automations
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

  const automation = await PmEmailAutomation.findOneAndUpdate(
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

  const populated = await automation.populate("templateId", "name subject category");

  return res.status(200).json(
    new ApiResponses(200, populated, "Automation saved successfully")
  );
});

/**
 * Delete single automation
 * DELETE /api/v1/pm/email-automations/:id
 */
const deleteAutomation = asyncHandler(async (req, res) => {
  const automation = await PmEmailAutomation.findByIdAndDelete(req.params.id);
  if (!automation) {
    return res.status(404).json(new ApiResponses(404, null, "Automation not found"));
  }
  return res.status(200).json(
    new ApiResponses(200, null, "Automation deleted successfully")
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
