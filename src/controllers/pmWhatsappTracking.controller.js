import { PmWhatsappEvent } from "../models/pmWhatsappEvent.model.js";
import { PmWhatsappTemplate } from "../models/pmWhatsappTemplate.model.js";
import { PmInquiry } from "../models/pmInquiry.model.js";
import {
  getTftReportByTemplate,
  getTftReportByDate,
  getTftReportByNumber,
  getTftSummaryReport,
} from "../services/tftSessionService.js";
import { updateInquiryScoreForWhatsapp } from "../services/pmWhatsappService.js";
import ApiResponses from "../utils/ApiResponses.js";
import asyncHandler from "../utils/asyncHandler.js";

// Map TFT status strings to our event types
const TFT_STATUS_MAP = {
  SENT: "sent",
  DELIVERED: "delivered",
  DLVD: "delivered",
  READ: "read",
  FAILED: "failed",
  ERROR: "failed",
  REJECTED: "failed",
  PENDING: null, // skip pending
  "NON WA": "failed",
};

/**
 * Get WhatsApp stats (sent, delivered, read, failed counts) from local DB
 * GET /api/v1/pm/whatsapp-tracking/stats
 */
const getWhatsappStats = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

  const stats = await PmWhatsappEvent.aggregate([
    { $match: { eventTimestamp: { $gte: since } } },
    {
      $group: {
        _id: "$eventType",
        count: { $sum: 1 },
      },
    },
  ]);

  const result = {
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
  };

  for (const s of stats) {
    if (result[s._id] !== undefined) {
      result[s._id] = s.count;
    }
  }

  // Calculate rates
  if (result.sent > 0) {
    result.deliveryRate = ((result.delivered / result.sent) * 100).toFixed(1);
    result.readRate = ((result.read / result.sent) * 100).toFixed(1);
  }

  return res.status(200).json(
    new ApiResponses(200, result, "WhatsApp stats fetched successfully")
  );
});

/**
 * Get WhatsApp events with filtering
 * GET /api/v1/pm/whatsapp-tracking/events
 */
const getWhatsappEvents = asyncHandler(async (req, res) => {
  const {
    eventType,
    templateId,
    mobile,
    pipelineStage,
    sort = "newest",
    page = 1,
    limit = 50,
  } = req.query;

  const filter = {};
  if (eventType) filter.eventType = eventType;
  if (templateId) filter.templateId = templateId;
  if (mobile) filter.mobile = { $regex: mobile, $options: "i" };

  const sortOrder = sort === "oldest" ? 1 : -1;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // If filtering by pipeline stage, get inquiry IDs first
  if (pipelineStage) {
    const inquiries = await PmInquiry.find({ pipelineStage }).select("_id");
    filter.inquiryId = { $in: inquiries.map((i) => i._id) };
  }

  const [events, total] = await Promise.all([
    PmWhatsappEvent.find(filter)
      .populate("templateId", "name tftTemplateName")
      .populate("inquiryId", "fullName phone pipelineStage")
      .sort({ eventTimestamp: sortOrder })
      .skip(skip)
      .limit(parseInt(limit)),
    PmWhatsappEvent.countDocuments(filter),
  ]);

  return res.status(200).json(
    new ApiResponses(200, {
      events,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    }, "WhatsApp events fetched successfully")
  );
});

/**
 * Get top leads by WhatsApp engagement
 * GET /api/v1/pm/whatsapp-tracking/top-leads
 */
const getTopLeadsByWhatsapp = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;

  const topLeads = await PmWhatsappEvent.aggregate([
    { $match: { eventType: { $in: ["sent", "delivered", "read"] } } },
    {
      $group: {
        _id: "$mobile",
        totalEvents: { $sum: 1 },
        sentCount: {
          $sum: { $cond: [{ $eq: ["$eventType", "sent"] }, 1, 0] },
        },
        deliveredCount: {
          $sum: { $cond: [{ $eq: ["$eventType", "delivered"] }, 1, 0] },
        },
        readCount: {
          $sum: { $cond: [{ $eq: ["$eventType", "read"] }, 1, 0] },
        },
        lastEvent: { $max: "$eventTimestamp" },
        inquiryId: { $first: "$inquiryId" },
      },
    },
    { $sort: { totalEvents: -1 } },
    { $limit: parseInt(limit) },
    {
      $lookup: {
        from: "pminquiries",
        localField: "inquiryId",
        foreignField: "_id",
        as: "inquiry",
      },
    },
    { $unwind: { path: "$inquiry", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        mobile: "$_id",
        totalEvents: 1,
        sentCount: 1,
        deliveredCount: 1,
        readCount: 1,
        lastEvent: 1,
        inquiryName: "$inquiry.fullName",
        inquiryEmail: "$inquiry.email",
      },
    },
  ]);

  return res.status(200).json(
    new ApiResponses(200, topLeads, "Top WhatsApp leads fetched successfully")
  );
});

/**
 * Sync delivery/read statuses from TFT into local DB
 * POST /api/v1/pm/whatsapp-tracking/sync
 *
 * Pulls recent messages from TFT's report API and creates delivered/read
 * events for messages we only have "sent" records for locally.
 */
const syncFromTft = asyncHandler(async (req, res) => {
  const { days = 7, templateName } = req.body;

  let tftMessages = [];

  if (templateName) {
    // Sync for a specific template
    tftMessages = await getTftReportByTemplate(templateName);
  } else {
    // Sync by date range (last N days)
    const endDate = new Date();
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const fmt = (d) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    tftMessages = await getTftReportByDate(fmt(startDate), fmt(endDate));
  }

  if (!Array.isArray(tftMessages)) {
    return res.status(200).json(
      new ApiResponses(200, { synced: 0, skipped: 0, total: 0 }, "No messages found from TFT")
    );
  }

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  for (const msg of tftMessages) {
    try {
      const status = (msg.status || "").toUpperCase().trim();
      const eventType = TFT_STATUS_MAP[status];
      if (!eventType || eventType === "sent") {
        // Skip pending/unknown statuses and "sent" (we already track sent locally)
        skipped++;
        continue;
      }

      const mobile = (msg.mobile || "").replace(/[\s\-\+\(\)]/g, "");
      if (!mobile) { skipped++; continue; }

      const tftTemplateName = msg.campname || msg.templatename || "";

      // Deduplicate: check if we already have this event
      const existing = await PmWhatsappEvent.findOne({
        mobile: { $regex: mobile.slice(-10) },
        eventType,
        templateName: tftTemplateName,
        // Allow one delivered + one read per template per mobile
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Find the local template
      let templateId = null;
      if (tftTemplateName) {
        const template = await PmWhatsappTemplate.findOne({
          tftTemplateName: tftTemplateName,
        });
        templateId = template?._id || null;
      }

      // Find inquiry by phone
      const last10 = mobile.slice(-10);
      const inquiry = await PmInquiry.findOne({
        phone: { $regex: last10 },
      }).sort({ createdAt: -1 });

      // Create the event
      await PmWhatsappEvent.create({
        mobile,
        eventType,
        templateId,
        templateName: tftTemplateName,
        inquiryId: inquiry?._id || null,
        eventTimestamp: msg.date ? new Date(msg.date) : new Date(),
        metadata: {
          source: "tft_sync",
          tftStatus: status,
          tftMessage: (msg.msg || "").substring(0, 200),
        },
      });

      // Update engagement score for delivered/read
      if (inquiry && (eventType === "delivered" || eventType === "read")) {
        await updateInquiryScoreForWhatsapp(inquiry._id, eventType);
      }

      synced++;
    } catch (err) {
      console.error(`[TFT Sync] Error processing message:`, err.message);
      errors++;
    }
  }

  console.log(`[TFT Sync] Complete: ${synced} synced, ${skipped} skipped, ${errors} errors out of ${tftMessages.length} total`);

  return res.status(200).json(
    new ApiResponses(200, {
      total: tftMessages.length,
      synced,
      skipped,
      errors,
    }, `Sync complete: ${synced} new statuses imported`)
  );
});

/**
 * Get live TFT report by template (direct from TFT, no local DB)
 * GET /api/v1/pm/whatsapp-tracking/tft-report
 */
const getTftReport = asyncHandler(async (req, res) => {
  const { templateName, startDate, endDate, mobile } = req.query;

  let data;

  if (templateName) {
    data = await getTftReportByTemplate(templateName);
  } else if (mobile) {
    data = await getTftReportByNumber(mobile);
  } else if (startDate && endDate) {
    data = await getTftReportByDate(startDate, endDate);
  } else {
    // Default: last 7 days
    const end = new Date();
    const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fmt = (d) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    data = await getTftReportByDate(fmt(start), fmt(end));
  }

  if (!Array.isArray(data)) {
    return res.status(200).json(
      new ApiResponses(200, { messages: [], summary: {} }, "No data from TFT")
    );
  }

  // Build summary from raw data
  const summary = { total: data.length, SENT: 0, DELIVERED: 0, READ: 0, FAILED: 0, PENDING: 0, OTHER: 0 };
  for (const msg of data) {
    const s = (msg.status || "").toUpperCase().trim();
    if (summary[s] !== undefined) {
      summary[s]++;
    } else if (s === "ERROR" || s === "REJECTED" || s === "NON WA") {
      summary.FAILED++;
    } else {
      summary.OTHER++;
    }
  }

  if (summary.total > 0) {
    summary.deliveryRate = (((summary.DELIVERED + summary.READ) / summary.total) * 100).toFixed(1);
    summary.readRate = ((summary.READ / summary.total) * 100).toFixed(1);
  }

  return res.status(200).json(
    new ApiResponses(200, {
      messages: data,
      summary,
    }, "TFT report fetched successfully")
  );
});

/**
 * Get TFT summary report (daily aggregates)
 * GET /api/v1/pm/whatsapp-tracking/tft-summary
 */
const getTftSummary = asyncHandler(async (req, res) => {
  const data = await getTftSummaryReport();

  return res.status(200).json(
    new ApiResponses(200, data, "TFT summary fetched successfully")
  );
});

/**
 * Get per-template stats (aggregated from local events)
 * GET /api/v1/pm/whatsapp-tracking/template-stats
 */
const getTemplateStats = asyncHandler(async (req, res) => {
  const stats = await PmWhatsappEvent.aggregate([
    {
      $group: {
        _id: { templateName: "$templateName", eventType: "$eventType" },
        count: { $sum: 1 },
        lastEvent: { $max: "$eventTimestamp" },
      },
    },
    {
      $group: {
        _id: "$_id.templateName",
        stats: {
          $push: {
            eventType: "$_id.eventType",
            count: "$count",
          },
        },
        lastEvent: { $max: "$lastEvent" },
      },
    },
    { $sort: { lastEvent: -1 } },
  ]);

  // Transform into a cleaner format
  const result = stats.map((t) => {
    const counts = { sent: 0, delivered: 0, read: 0, failed: 0 };
    for (const s of t.stats) {
      if (counts[s.eventType] !== undefined) counts[s.eventType] = s.count;
    }
    return {
      templateName: t._id || "Unknown",
      ...counts,
      deliveryRate: counts.sent > 0 ? (((counts.delivered + counts.read) / counts.sent) * 100).toFixed(1) : "0.0",
      readRate: counts.sent > 0 ? ((counts.read / counts.sent) * 100).toFixed(1) : "0.0",
      lastEvent: t.lastEvent,
    };
  });

  return res.status(200).json(
    new ApiResponses(200, result, "Template stats fetched successfully")
  );
});

export {
  getWhatsappStats,
  getWhatsappEvents,
  getTopLeadsByWhatsapp,
  syncFromTft,
  getTftReport,
  getTftSummary,
  getTemplateStats,
};
