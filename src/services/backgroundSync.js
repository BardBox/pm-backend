/**
 * Background WhatsApp Sync Service
 *
 * Automatically polls TFT for ALL active inquiries every 60 seconds.
 * Runs on the server — no frontend needed.
 *
 * Only syncs inquiries that:
 *  - Have a phone number
 *  - Are in an active pipeline status (not "cold")
 *  - Were created or contacted in the last 90 days
 */

import { PmInquiry } from "../models/pmInquiry.model.js";
import { syncInquiryWhatsapp } from "../controllers/pmConversation.controller.js";

const SYNC_INTERVAL_MS = 30_000; // 30 seconds between full rounds
const BATCH_SIZE = 5; // max inquiries per tick (avoid hammering TFT)
const BATCH_DELAY_MS = 3_000; // pause between each inquiry in a batch

let intervalId = null;
let isRunning = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Single sync round: find active inquiries, sync each with TFT
 */
const runSyncRound = async () => {
  if (isRunning) return; // prevent overlapping rounds
  isRunning = true;

  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Find active inquiries with phone numbers
    const inquiries = await PmInquiry.find({
      phone: { $exists: true, $ne: "" },
      status: { $in: ["new", "contacted", "hot", "warm", "converted"] },
      createdAt: { $gte: ninetyDaysAgo },
    })
      .sort({ updatedAt: -1 }) // most recently active first
      .limit(BATCH_SIZE)
      .lean();

    if (inquiries.length === 0) return;

    let totalSynced = 0;

    for (const inquiry of inquiries) {
      try {
        const result = await syncInquiryWhatsapp(inquiry._id, inquiry);
        if (result.synced > 0) {
          totalSynced += result.synced;
          console.log(
            `[BackgroundSync] ${inquiry.fullName} (${inquiry.phone}): +${result.synced} new messages`
          );
        }
      } catch (err) {
        // Don't let one inquiry failure stop the whole batch
        console.error(
          `[BackgroundSync] Failed for ${inquiry.fullName} (${inquiry.phone}): ${err.message}`
        );
      }

      // Small delay between inquiries to avoid rate-limiting
      if (inquiries.length > 1) await sleep(BATCH_DELAY_MS);
    }

    if (totalSynced > 0) {
      console.log(`[BackgroundSync] Round complete: ${totalSynced} total new messages across ${inquiries.length} inquiries`);
    }
  } catch (err) {
    console.error("[BackgroundSync] Round failed:", err.message);
  } finally {
    isRunning = false;
  }
};

/**
 * Start the background sync loop.
 * Call this once after DB connection is established.
 */
export const startBackgroundSync = () => {
  if (intervalId) return; // already running

  console.log(
    `[BackgroundSync] Started — syncing up to ${BATCH_SIZE} inquiries every ${SYNC_INTERVAL_MS / 1000}s`
  );

  // First run after a short delay (let server finish booting)
  setTimeout(() => runSyncRound(), 5_000);

  // Then repeat
  intervalId = setInterval(() => runSyncRound(), SYNC_INTERVAL_MS);
};

export const stopBackgroundSync = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[BackgroundSync] Stopped");
  }
};
