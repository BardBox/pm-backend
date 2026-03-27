import { PmScoringConfig, DEFAULT_EVENTS, DEFAULT_PIPELINE_STAGES } from "../models/pmScoringConfig.model.js";
import ApiErrors from "../utils/ApiErrors.js";
import ApiResponses from "../utils/ApiResponses.js";
import asyncHandler from "../utils/asyncHandler.js";

// Get or create the singleton config with default events and pipeline stages
const getConfig = async () => {
  let config = await PmScoringConfig.findOne();
  if (!config) {
    config = await PmScoringConfig.create({ events: DEFAULT_EVENTS, pipelineStages: DEFAULT_PIPELINE_STAGES });
  }
  // Migration: if old config has no events, populate with defaults
  if (!config.events || config.events.length === 0) {
    config.events = DEFAULT_EVENTS;
    await config.save();
  }
  // Migration: if old config has no pipeline stages, populate with defaults
  if (!config.pipelineStages || config.pipelineStages.length === 0) {
    config.pipelineStages = DEFAULT_PIPELINE_STAGES;
    await config.save();
  }
  return config;
};

// GET — fetch current scoring config
const getScoringConfig = asyncHandler(async (req, res) => {
  const config = await getConfig();
  return res.status(200).json(
    new ApiResponses(200, config, "Scoring config fetched successfully")
  );
});

// PATCH — update thresholds, decay, and existing event scores
const updateScoringConfig = asyncHandler(async (req, res) => {
  const { events, thresholds, decay } = req.body;
  const config = await getConfig();

  // Update events array (scores, labels, descriptions, active status)
  if (events && Array.isArray(events)) {
    for (const update of events) {
      const existing = config.events.id(update._id);
      if (existing) {
        if (update.label !== undefined) existing.label = update.label;
        if (update.description !== undefined) existing.description = update.description;
        if (typeof update.score === "number" && update.score >= 0) existing.score = update.score;
        if (update.icon !== undefined) existing.icon = update.icon;
        if (typeof update.isActive === "boolean") existing.isActive = update.isActive;
        // Key can only be changed on custom events
        if (update.key !== undefined && !existing.isSystem) existing.key = update.key;
      }
    }
  }

  if (thresholds) {
    if (typeof thresholds.cold === "number" && thresholds.cold > 0) config.thresholds.cold = thresholds.cold;
    if (typeof thresholds.warm === "number" && thresholds.warm > 0) config.thresholds.warm = thresholds.warm;
    if (typeof thresholds.hot === "number" && thresholds.hot > 0) config.thresholds.hot = thresholds.hot;
  }

  // Update pipeline stages (scores, labels, colors)
  const { pipelineStages } = req.body;
  if (pipelineStages && Array.isArray(pipelineStages)) {
    for (const update of pipelineStages) {
      const existing = config.pipelineStages.id(update._id);
      if (existing) {
        if (update.label !== undefined) existing.label = update.label;
        if (typeof update.minScore === "number" && update.minScore >= 0) existing.minScore = update.minScore;
        if (update.color !== undefined) existing.color = update.color;
        if (typeof update.order === "number") existing.order = update.order;
        if (update.key !== undefined && !existing.isSystem) existing.key = update.key;
      }
    }
  }

  if (decay) {
    if (typeof decay.enabled === "boolean") config.decay.enabled = decay.enabled;
    if (typeof decay.inactiveDays === "number" && decay.inactiveDays > 0) config.decay.inactiveDays = decay.inactiveDays;
    if (typeof decay.decayAmount === "number" && decay.decayAmount >= 0) config.decay.decayAmount = decay.decayAmount;
  }

  await config.save();

  return res.status(200).json(
    new ApiResponses(200, config, "Scoring config updated successfully")
  );
});

// POST — add a new custom event
const addEvent = asyncHandler(async (req, res) => {
  const { key, label, description, score, icon } = req.body;

  if (!key || !label || score === undefined) {
    throw new ApiErrors(400, "key, label, and score are required");
  }

  const config = await getConfig();

  // Check for duplicate key
  const duplicate = config.events.find((e) => e.key === key);
  if (duplicate) {
    throw new ApiErrors(400, `Event with key "${key}" already exists`);
  }

  config.events.push({
    key: key.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
    label,
    description: description || "",
    score: Math.max(0, score),
    icon: icon || "Zap",
    isSystem: false,
    isActive: true,
  });

  await config.save();

  return res.status(201).json(
    new ApiResponses(201, config, "Event added successfully")
  );
});

// PATCH — update a single event by ID
const updateEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { key, label, description, score, icon, isActive } = req.body;

  const config = await getConfig();
  const event = config.events.id(eventId);

  if (!event) {
    throw new ApiErrors(404, "Event not found");
  }

  if (label !== undefined) event.label = label;
  if (description !== undefined) event.description = description;
  if (typeof score === "number" && score >= 0) event.score = score;
  if (icon !== undefined) event.icon = icon;
  if (typeof isActive === "boolean") event.isActive = isActive;
  // Key change only for custom events
  if (key !== undefined && !event.isSystem) {
    const sanitized = key.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const duplicate = config.events.find((e) => e.key === sanitized && e._id.toString() !== eventId);
    if (duplicate) {
      throw new ApiErrors(400, `Event with key "${sanitized}" already exists`);
    }
    event.key = sanitized;
  }

  await config.save();

  return res.status(200).json(
    new ApiResponses(200, config, "Event updated successfully")
  );
});

// DELETE — remove a custom event (system events cannot be deleted)
const deleteEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const config = await getConfig();
  const event = config.events.id(eventId);

  if (!event) {
    throw new ApiErrors(404, "Event not found");
  }

  if (event.isSystem) {
    throw new ApiErrors(400, "System events cannot be deleted. You can deactivate them instead.");
  }

  config.events.pull(eventId);
  await config.save();

  return res.status(200).json(
    new ApiResponses(200, config, "Event deleted successfully")
  );
});

// POST — add a new pipeline stage
const addPipelineStage = asyncHandler(async (req, res) => {
  const { key, label, minScore, color } = req.body;

  if (!key || !label || minScore === undefined) {
    throw new ApiErrors(400, "key, label, and minScore are required");
  }

  const config = await getConfig();

  const sanitizedKey = key.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  const duplicate = config.pipelineStages.find((s) => s.key === sanitizedKey);
  if (duplicate) {
    throw new ApiErrors(400, `Stage with key "${sanitizedKey}" already exists`);
  }

  const maxOrder = config.pipelineStages.reduce((max, s) => Math.max(max, s.order), 0);

  config.pipelineStages.push({
    key: sanitizedKey,
    label,
    minScore: Math.max(0, minScore),
    color: color || "#8b5cf6",
    order: maxOrder + 1,
    isSystem: false,
  });

  await config.save();
  return res.status(201).json(new ApiResponses(201, config, "Pipeline stage added"));
});

// PATCH — update a pipeline stage
const updatePipelineStage = asyncHandler(async (req, res) => {
  const { stageId } = req.params;
  const { key, label, minScore, color, order } = req.body;

  const config = await getConfig();
  const stage = config.pipelineStages.id(stageId);

  if (!stage) throw new ApiErrors(404, "Pipeline stage not found");

  if (label !== undefined) stage.label = label;
  if (typeof minScore === "number" && minScore >= 0) stage.minScore = minScore;
  if (color !== undefined) stage.color = color;
  if (typeof order === "number") stage.order = order;
  if (key !== undefined && !stage.isSystem) {
    const sanitized = key.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const duplicate = config.pipelineStages.find((s) => s.key === sanitized && s._id.toString() !== stageId);
    if (duplicate) throw new ApiErrors(400, `Stage with key "${sanitized}" already exists`);
    stage.key = sanitized;
  }

  await config.save();
  return res.status(200).json(new ApiResponses(200, config, "Pipeline stage updated"));
});

// DELETE — remove a custom pipeline stage
const deletePipelineStage = asyncHandler(async (req, res) => {
  const { stageId } = req.params;

  const config = await getConfig();
  const stage = config.pipelineStages.id(stageId);

  if (!stage) throw new ApiErrors(404, "Pipeline stage not found");
  if (stage.isSystem) throw new ApiErrors(400, "System stages cannot be deleted");

  config.pipelineStages.pull(stageId);
  await config.save();
  return res.status(200).json(new ApiResponses(200, config, "Pipeline stage deleted"));
});

// POST — reset to defaults
const resetScoringConfig = asyncHandler(async (req, res) => {
  await PmScoringConfig.deleteMany({});
  const config = await PmScoringConfig.create({ events: DEFAULT_EVENTS, pipelineStages: DEFAULT_PIPELINE_STAGES });
  return res.status(200).json(
    new ApiResponses(200, config, "Scoring config reset to defaults")
  );
});

export {
  getScoringConfig, updateScoringConfig,
  addEvent, updateEvent, deleteEvent,
  addPipelineStage, updatePipelineStage, deletePipelineStage,
  resetScoringConfig,
};
