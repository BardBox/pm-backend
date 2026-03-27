import { Router } from "express";
import {
  getWhatsappStats,
  getWhatsappEvents,
  getTopLeadsByWhatsapp,
  syncFromTft,
  getTftReport,
  getTftSummary,
  getTemplateStats,
} from "../controllers/pmWhatsappTracking.controller.js";

const router = Router();

// Local DB stats
router.get("/stats", getWhatsappStats);
router.get("/events", getWhatsappEvents);
router.get("/top-leads", getTopLeadsByWhatsapp);
router.get("/template-stats", getTemplateStats);

// TFT live reports (direct from TFT API)
router.get("/tft-report", getTftReport);
router.get("/tft-summary", getTftSummary);

// Sync statuses from TFT into local DB
router.post("/sync", syncFromTft);

export default router;
