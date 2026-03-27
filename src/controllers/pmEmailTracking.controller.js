import { PmEmailEvent } from "../models/pmEmailEvent.model.js";
import { PmInquiry } from "../models/pmInquiry.model.js";
import { PmScoringConfig, DEFAULT_EVENTS } from "../models/pmScoringConfig.model.js";

// 1x1 transparent GIF pixel
const TRACKING_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

/**
 * Get score for an email event from scoring config
 */
const getEmailEventScore = async (eventType) => {
  const config = await PmScoringConfig.findOne();
  const events =
    config && config.events && config.events.length > 0
      ? config.events
      : DEFAULT_EVENTS;

  const match = events.find(
    (e) => e.isActive !== false && e.key.includes(eventType)
  );
  return match ? match.score : 0;
};

/**
 * Update inquiry engagement score
 */
const updateInquiryScore = async (email, eventType) => {
  const inquiry = await PmInquiry.findOne({
    email: email.toLowerCase(),
  }).sort({ createdAt: -1 });

  if (!inquiry) return;

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
};

/**
 * Track email open (1x1 pixel)
 * GET /api/v1/pm/track/open?e=email&t=templateId&ts=timestamp
 */
const trackOpen = async (req, res) => {
  try {
    const { e: email, t: templateId, ts } = req.query;

    if (email) {
      // Deduplicate: only count one open per email+template combo per hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const existing = await PmEmailEvent.findOne({
        email: email.toLowerCase(),
        eventType: "open",
        campaignId: templateId || "automation",
        eventTimestamp: { $gte: oneHourAgo },
      });

      if (!existing) {
        const inquiry = await PmInquiry.findOne({
          email: email.toLowerCase(),
        }).sort({ createdAt: -1 });

        await PmEmailEvent.create({
          email: email.toLowerCase(),
          eventType: "open",
          campaignId: templateId || "automation",
          campaignName: "PM Automation",
          inquiryId: inquiry?._id || null,
          eventTimestamp: new Date(),
          metadata: { source: "tracking_pixel", ts },
        });

        // Update engagement score
        await updateInquiryScore(email, "open");

        console.log(`[PM Track] Open: ${email}`);
      }
    }
  } catch (err) {
    console.error("[PM Track] Open error:", err.message);
  }

  // Always return the pixel regardless of errors
  res.set({
    "Content-Type": "image/gif",
    "Content-Length": TRACKING_PIXEL.length,
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });
  res.end(TRACKING_PIXEL);
};

/**
 * Track email click (redirect)
 * GET /api/v1/pm/track/click?e=email&t=templateId&url=encodedURL
 */
const trackClick = async (req, res) => {
  const { e: email, t: templateId, url } = req.query;

  if (!url) {
    return res.status(400).send("Missing URL");
  }

  const targetUrl = decodeURIComponent(url);

  try {
    if (email) {
      // Deduplicate: one click per email+url combo per hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const existing = await PmEmailEvent.findOne({
        email: email.toLowerCase(),
        eventType: "click",
        campaignId: templateId || "automation",
        "metadata.url": targetUrl,
        eventTimestamp: { $gte: oneHourAgo },
      });

      if (!existing) {
        const inquiry = await PmInquiry.findOne({
          email: email.toLowerCase(),
        }).sort({ createdAt: -1 });

        await PmEmailEvent.create({
          email: email.toLowerCase(),
          eventType: "click",
          campaignId: templateId || "automation",
          campaignName: "PM Automation",
          inquiryId: inquiry?._id || null,
          eventTimestamp: new Date(),
          metadata: { source: "link_tracking", url: targetUrl },
        });

        // Update engagement score
        await updateInquiryScore(email, "click");

        console.log(`[PM Track] Click: ${email} → ${targetUrl}`);
      }
    }
  } catch (err) {
    console.error("[PM Track] Click error:", err.message);
  }

  // Always redirect regardless of errors
  res.redirect(302, targetUrl);
};

export { trackOpen, trackClick };
