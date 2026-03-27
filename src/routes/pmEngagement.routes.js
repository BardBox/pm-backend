import { Router } from "express";
import {
  trackEvent,
  syncScore,
  getEngagementData,
  applyScoreDecay,
} from "../controllers/pmEngagement.controller.js";

const router = Router();

// Public — track engagement events from landing page
router.post("/track", trackEvent);

// Public — sync accumulated events after inquiry creation
router.post("/sync", syncScore);

// Admin — get engagement data for an inquiry
router.get("/:id", getEngagementData);

// Admin — apply score decay for inactive leads
router.post("/decay", applyScoreDecay);

export default router;
