import { PmInquiry } from "../models/pmInquiry.model.js";
import { PmEmailEvent } from "../models/pmEmailEvent.model.js";
import { PmScoringConfig, DEFAULT_EVENTS } from "../models/pmScoringConfig.model.js";
import ApiResponses from "../utils/ApiResponses.js";
import asyncHandler from "../utils/asyncHandler.js";

// Map MailerLite webhook event types to our event types
const EVENT_TYPE_MAP = {
  // Actual MailerLite webhook events
  "subscriber.created": "sent",
  "subscriber.updated": "sent",
  "subscriber.unsubscribed": "unsubscribe",
  "subscriber.added_to_group": "sent",
  "subscriber.removed_from_group": "unsubscribe",
  "subscriber.bounced": "bounce",
  "subscriber.automation_triggered": "open",
  "subscriber.automation_completed": "click",
  "subscriber.spam_reported": "spam_complaint",
  "campaign.sent": "sent",
  // Legacy/alternative event names (in case MailerLite adds them)
  "subscriber.opened": "open",
  "subscriber.clicked": "click",
  "subscriber.spam_complained": "spam_complaint",
};

// Get score for an email event by searching scoring config for matching key
const getEmailEventScore = async (eventType) => {
  const config = await PmScoringConfig.findOne();
  const events = (config && config.events && config.events.length > 0)
    ? config.events
    : DEFAULT_EVENTS;

  // Search for any active event whose key contains the eventType (e.g. "open" matches "email_opened")
  const match = events.find(
    (e) => e.isActive !== false && e.key.includes(eventType)
  );

  return match ? match.score : 0;
};

/**
 * Handle MailerLite webhook events
 * POST /api/v1/pm/mailerlite/webhook
 */
const handleMailerliteWebhook = asyncHandler(async (req, res) => {
  // Verify webhook secret if configured
  const webhookSecret = process.env.MAILERLITE_WEBHOOK_SECRET;
  if (webhookSecret) {
    const token = req.query.token || req.headers["x-mailerlite-webhook-secret"];
    if (token !== webhookSecret) {
      console.warn("[MailerLite Webhook] Invalid token, rejecting request");
      return res.status(401).json({ message: "Unauthorized" });
    }
  }

  const { type, data } = req.body;

  if (!type || !data) {
    return res.status(200).json({ message: "No actionable data" });
  }

  const eventType = EVENT_TYPE_MAP[type];
  if (!eventType) {
    console.log(`[MailerLite Webhook] Unknown event type: ${type}`);
    return res.status(200).json({ message: "Event type not tracked" });
  }

  const email = data.email || data.subscriber?.email;
  if (!email) {
    return res.status(200).json({ message: "No email in payload" });
  }

  // Store the email event
  const emailEvent = await PmEmailEvent.create({
    email: email.toLowerCase(),
    eventType,
    campaignId: data.campaign_id || data.campaign?.id || null,
    campaignName: data.campaign?.name || null,
    eventTimestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
    metadata: data,
  });

  // Find the corresponding inquiry and update engagement score
  const inquiry = await PmInquiry.findOne({
    email: email.toLowerCase(),
  }).sort({ createdAt: -1 });

  if (inquiry) {
    // Link email event to inquiry
    emailEvent.inquiryId = inquiry._id;
    await emailEvent.save();

    const scoreToAdd = await getEmailEventScore(eventType);

    if (scoreToAdd !== 0) {
      inquiry.engagementScore = Math.max(0, inquiry.engagementScore + scoreToAdd);
      inquiry.lastActivity = `email_${eventType}`;
      inquiry.activityLog.push({
        event: `email_${eventType}`,
        scoreAdded: scoreToAdd,
        timestamp: new Date(),
      });
      await inquiry.save();
    }
  }

  console.log(`[MailerLite Webhook] Processed ${eventType} for ${email}`);
  return res.status(200).json({ message: "Webhook processed" });
});

/**
 * Get email engagement reports (admin)
 * GET /api/v1/pm/mailerlite/reports
 */
const getEmailReports = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

  // Aggregate event counts by type
  const eventCounts = await PmEmailEvent.aggregate([
    { $match: { eventTimestamp: { $gte: since } } },
    {
      $group: {
        _id: "$eventType",
        count: { $sum: 1 },
      },
    },
  ]);

  // Daily breakdown
  const dailyBreakdown = await PmEmailEvent.aggregate([
    { $match: { eventTimestamp: { $gte: since } } },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$eventTimestamp" } },
          eventType: "$eventType",
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.date": 1 } },
  ]);

  // Top engaged leads (most email opens/clicks)
  const topLeads = await PmEmailEvent.aggregate([
    {
      $match: {
        eventTimestamp: { $gte: since },
        eventType: { $in: ["open", "click"] },
      },
    },
    {
      $group: {
        _id: "$email",
        opens: { $sum: { $cond: [{ $eq: ["$eventType", "open"] }, 1, 0] } },
        clicks: { $sum: { $cond: [{ $eq: ["$eventType", "click"] }, 1, 0] } },
        totalEngagements: { $sum: 1 },
        lastEngagement: { $max: "$eventTimestamp" },
      },
    },
    { $sort: { totalEngagements: -1 } },
    { $limit: 20 },
  ]);

  // Recent events
  const recentEvents = await PmEmailEvent.find()
    .sort({ eventTimestamp: -1 })
    .limit(50)
    .populate("inquiryId", "fullName companyName status pipelineStage");

  // Summary stats
  const stats = {
    sent: 0,
    opens: 0,
    clicks: 0,
    unsubscribes: 0,
    bounces: 0,
  };
  for (const ec of eventCounts) {
    if (ec._id === "sent") stats.sent = ec.count;
    if (ec._id === "open") stats.opens = ec.count;
    if (ec._id === "click") stats.clicks = ec.count;
    if (ec._id === "unsubscribe") stats.unsubscribes = ec.count;
    if (ec._id === "bounce") stats.bounces = ec.count;
  }
  stats.openRate = stats.sent > 0 ? ((stats.opens / stats.sent) * 100).toFixed(1) : "0";
  stats.clickRate = stats.opens > 0 ? ((stats.clicks / stats.opens) * 100).toFixed(1) : "0";

  return res.status(200).json(
    new ApiResponses(200, {
      stats,
      dailyBreakdown,
      topLeads,
      recentEvents,
    }, "Email reports fetched successfully")
  );
});

/**
 * Get email events for a specific inquiry (admin)
 * GET /api/v1/pm/mailerlite/inquiry/:inquiryId/events
 */
const getInquiryEmailEvents = asyncHandler(async (req, res) => {
  const events = await PmEmailEvent.find({
    inquiryId: req.params.inquiryId,
  }).sort({ eventTimestamp: -1 });

  return res.status(200).json(
    new ApiResponses(200, events, "Inquiry email events fetched")
  );
});

/**
 * Sync subscriber activity from MailerLite API (pulls opens/clicks)
 * POST /api/v1/pm/mailerlite/sync
 */
const syncFromMailerLite = asyncHandler(async (req, res) => {
  const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY;
  if (!MAILERLITE_API_KEY) {
    return res.status(400).json(new ApiResponses(400, null, "MailerLite API key not configured"));
  }

  const headers = {
    Authorization: `Bearer ${MAILERLITE_API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // Get all subscribers from our group
  const groupId = process.env.MAILERLITE_GROUP_ID;
  if (!groupId) {
    return res.status(400).json(new ApiResponses(400, null, "MailerLite group ID not configured"));
  }

  let synced = 0;

  try {
    // Fetch subscribers from the group
    const subRes = await fetch(
      `https://connect.mailerlite.com/api/groups/${groupId}/subscribers?limit=100`,
      { headers }
    );
    const subData = await subRes.json();
    const subscribers = subData.data || [];

    for (const sub of subscribers) {
      const email = sub.email?.toLowerCase();
      if (!email) continue;

      // Check opens count from subscriber data
      if (sub.opens_count > 0) {
        const existingOpen = await PmEmailEvent.findOne({
          email,
          eventType: "open",
          campaignId: "mailerlite_sync",
        });

        if (!existingOpen) {
          await PmEmailEvent.create({
            email,
            eventType: "open",
            campaignId: "mailerlite_sync",
            campaignName: "MailerLite Automation",
            eventTimestamp: sub.last_open_at ? new Date(sub.last_open_at) : new Date(),
            metadata: { opens_count: sub.opens_count, source: "api_sync" },
          });

          // Update inquiry score
          const openScore = await getEmailEventScore("open");
          const inquiry = await PmInquiry.findOne({ email }).sort({ createdAt: -1 });
          if (inquiry && openScore !== 0) {
            inquiry.engagementScore = Math.max(0, inquiry.engagementScore + openScore);
            inquiry.lastActivity = "email_open";
            inquiry.activityLog.push({ event: "email_open", scoreAdded: openScore, timestamp: new Date() });
            await inquiry.save();
          }
          synced++;
        }
      }

      if (sub.clicks_count > 0) {
        const existingClick = await PmEmailEvent.findOne({
          email,
          eventType: "click",
          campaignId: "mailerlite_sync",
        });

        if (!existingClick) {
          await PmEmailEvent.create({
            email,
            eventType: "click",
            campaignId: "mailerlite_sync",
            campaignName: "MailerLite Automation",
            eventTimestamp: sub.last_click_at ? new Date(sub.last_click_at) : new Date(),
            metadata: { clicks_count: sub.clicks_count, source: "api_sync" },
          });

          const clickScore = await getEmailEventScore("click");
          const inquiry = await PmInquiry.findOne({ email }).sort({ createdAt: -1 });
          if (inquiry && clickScore !== 0) {
            inquiry.engagementScore = Math.max(0, inquiry.engagementScore + clickScore);
            inquiry.lastActivity = "email_click";
            inquiry.activityLog.push({ event: "email_click", scoreAdded: clickScore, timestamp: new Date() });
            await inquiry.save();
          }
          synced++;
        }
      }

      // Track as "sent" if subscriber exists in group
      const existingSent = await PmEmailEvent.findOne({
        email,
        eventType: "sent",
        campaignId: "mailerlite_sync",
      });

      if (!existingSent) {
        const inquiry = await PmInquiry.findOne({ email }).sort({ createdAt: -1 });
        await PmEmailEvent.create({
          email,
          eventType: "sent",
          campaignId: "mailerlite_sync",
          campaignName: "MailerLite Automation",
          inquiryId: inquiry?._id || null,
          eventTimestamp: sub.subscribed_at ? new Date(sub.subscribed_at) : new Date(),
          metadata: { source: "api_sync" },
        });
        synced++;
      }
    }
  } catch (error) {
    console.error("[MailerLite Sync] Error:", error.message);
    return res.status(500).json(new ApiResponses(500, null, "Sync failed: " + error.message));
  }

  return res.status(200).json(
    new ApiResponses(200, { synced }, `Synced ${synced} events from MailerLite`)
  );
});

export { handleMailerliteWebhook, getEmailReports, getInquiryEmailEvents, syncFromMailerLite };
