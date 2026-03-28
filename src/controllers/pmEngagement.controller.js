import { PmInquiry } from "../models/pmInquiry.model.js";
import { PmScoringConfig, DEFAULT_EVENTS } from "../models/pmScoringConfig.model.js";
import { triggerWhatsappAutomation } from "../services/pmWhatsappService.js";
import ApiErrors from "../utils/ApiErrors.js";
import ApiResponses from "../utils/ApiResponses.js";
import asyncHandler from "../utils/asyncHandler.js";

// Build score map from events array { key: score }
const getScoreMap = async () => {
  const config = await PmScoringConfig.findOne();
  if (config && config.events && config.events.length > 0) {
    const map = {};
    for (const e of config.events) {
      if (e.isActive) map[e.key] = e.score;
    }
    return map;
  }
  // Fallback to defaults
  const map = {};
  for (const e of DEFAULT_EVENTS) map[e.key] = e.score;
  return map;
};

const getPipelineStages = async () => {
  const config = await PmScoringConfig.findOne();
  if (config && config.pipelineStages && config.pipelineStages.length > 0) {
    return config.pipelineStages.toObject().sort((a, b) => b.minScore - a.minScore);
  }
  // Fallback to legacy thresholds
  if (config && config.thresholds) {
    const t = config.thresholds.toObject();
    return [
      { key: "hot", minScore: t.hot },
      { key: "warm", minScore: t.warm },
      { key: "cold", minScore: t.cold },
      { key: "new", minScore: 0 },
    ];
  }
  return [
    { key: "hot", minScore: 51 },
    { key: "warm", minScore: 26 },
    { key: "cold", minScore: 11 },
    { key: "new", minScore: 0 },
  ];
};

// Determine pipeline stage from score using dynamic stages
const getPipelineStage = async (score, isConverted) => {
  if (isConverted) return "converted";
  const stages = await getPipelineStages();
  // stages sorted by minScore descending — first match wins
  for (const stage of stages) {
    if (score >= stage.minScore) return stage.key;
  }
  return "new";
};

// Track engagement event (before inquiry is created — uses sessionId)
const trackEvent = asyncHandler(async (req, res) => {
  const { sessionId, event, email } = req.body;

  if (!sessionId || !event) {
    throw new ApiErrors(400, "sessionId and event are required");
  }

  const scoreMap = await getScoreMap();
  const scoreToAdd = scoreMap[event];
  if (scoreToAdd === undefined) {
    throw new ApiErrors(400, `Unknown event type: ${event}`);
  }

  // If email is provided, try to find existing inquiry
  let inquiry = null;
  if (email) {
    inquiry = await PmInquiry.findOne({ email: email.toLowerCase() }).sort({ createdAt: -1 });
  }

  if (inquiry) {
    // Update existing inquiry's score
    const oldStage = inquiry.pipelineStage || "new";
    inquiry.engagementScore += scoreToAdd;
    inquiry.lastActivity = event;
    inquiry.activityLog.push({
      event,
      scoreAdded: scoreToAdd,
      timestamp: new Date(),
    });

    // Update pipeline stage (don't downgrade converted or contacted)
    if (inquiry.status !== "converted") {
      const newStage = await getPipelineStage(inquiry.engagementScore, false);
      inquiry.pipelineStage = newStage;
      // Auto-update status for cold/warm/hot — "contacted" is admin-only
      if (["cold", "warm", "hot"].includes(newStage) && inquiry.status !== "contacted") {
        inquiry.status = newStage;
      }

      // Trigger WhatsApp automation when stage changes (welcome type — first contact for this stage)
      if (newStage !== oldStage && inquiry.phone) {
        triggerWhatsappAutomation("welcome", newStage, inquiry.phone, inquiry._id)
          .catch((err) => console.error("[PM WhatsApp] Auto stage-change automation failed:", err.message));
      }
    }

    await inquiry.save();

    return res.status(200).json(
      new ApiResponses(200, {
        engagementScore: inquiry.engagementScore,
        pipelineStage: inquiry.pipelineStage,
      }, "Event tracked successfully")
    );
  }

  // No inquiry yet — store in temporary tracking (return score for frontend to carry forward)
  return res.status(200).json(
    new ApiResponses(200, {
      sessionId,
      event,
      scoreAdded: scoreToAdd,
      message: "Event recorded (pre-inquiry)",
    }, "Event tracked successfully")
  );
});

// Batch sync — apply accumulated score when inquiry is created
const syncScore = asyncHandler(async (req, res) => {
  const { inquiryId, events } = req.body;

  if (!inquiryId || !events || !Array.isArray(events)) {
    throw new ApiErrors(400, "inquiryId and events array are required");
  }

  const inquiry = await PmInquiry.findById(inquiryId);
  if (!inquiry) {
    throw new ApiErrors(404, "Inquiry not found");
  }

  const scoreMap = await getScoreMap();
  let totalScore = 0;
  const oldStage = inquiry.pipelineStage || "new";

  for (const event of events) {
    const score = scoreMap[event.event] || 0;
    totalScore += score;
    inquiry.activityLog.push({
      event: event.event,
      scoreAdded: score,
      timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
    });
  }

  inquiry.engagementScore += totalScore;
  inquiry.lastActivity = events[events.length - 1]?.event || "sync";

  // Update pipeline stage (don't downgrade converted or contacted)
  if (inquiry.status !== "converted") {
    const newStage = await getPipelineStage(inquiry.engagementScore, false);
    inquiry.pipelineStage = newStage;
    // Auto-update status for cold/warm/hot — "contacted" is admin-only
    if (["cold", "warm", "hot"].includes(newStage) && inquiry.status !== "contacted") {
      inquiry.status = newStage;
    }

    // Trigger WhatsApp automation when stage changes (welcome type — first contact for this stage)
    if (newStage !== oldStage && inquiry.phone) {
      triggerWhatsappAutomation("welcome", newStage, inquiry.phone, inquiry._id)
        .catch((err) => console.error("[PM WhatsApp] Auto stage-change automation failed:", err.message));
    }
  }

  await inquiry.save();

  return res.status(200).json(
    new ApiResponses(200, {
      engagementScore: inquiry.engagementScore,
      pipelineStage: inquiry.pipelineStage,
      eventsProcessed: events.length,
    }, "Score synced successfully")
  );
});

// Get engagement data for an inquiry (admin)
const getEngagementData = asyncHandler(async (req, res) => {
  const inquiry = await PmInquiry.findById(req.params.id).select(
    "engagementScore pipelineStage activityLog lastActivity"
  );

  if (!inquiry) {
    throw new ApiErrors(404, "Inquiry not found");
  }

  return res.status(200).json(
    new ApiResponses(200, inquiry, "Engagement data fetched successfully")
  );
});

// Score decay — reduce score for inactive users (run via cron or manually)
const applyScoreDecay = asyncHandler(async (req, res) => {
  const config = await PmScoringConfig.findOne();
  const inactiveDays = config?.decay?.inactiveDays || 30;
  const decayAmount = config?.decay?.decayAmount || 10;

  const cutoffDate = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);

  const result = await PmInquiry.updateMany(
    {
      status: { $ne: "converted" },
      updatedAt: { $lt: cutoffDate },
      engagementScore: { $gt: 0 },
    },
    [
      {
        $set: {
          engagementScore: { $max: [0, { $subtract: ["$engagementScore", decayAmount] }] },
        },
      },
    ]
  );

  // Update pipeline stages for affected documents
  const affected = await PmInquiry.find({
    status: { $ne: "converted" },
    updatedAt: { $lt: cutoffDate },
  });

  for (const inquiry of affected) {
    const newStage = await getPipelineStage(inquiry.engagementScore, false);
    if (inquiry.pipelineStage !== newStage) {
      inquiry.pipelineStage = newStage;
      // Auto-update status for cold/warm/hot — "contacted" is admin-only
      if (["cold", "warm", "hot"].includes(newStage) && inquiry.status !== "contacted") {
        inquiry.status = newStage;
      }
      await inquiry.save();
    }
  }

  return res.status(200).json(
    new ApiResponses(200, {
      modified: result.modifiedCount,
    }, "Score decay applied successfully")
  );
});

export { trackEvent, syncScore, getEngagementData, applyScoreDecay };
