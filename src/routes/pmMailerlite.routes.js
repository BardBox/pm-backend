import { Router } from "express";
import {
  handleMailerliteWebhook,
  getEmailReports,
  getInquiryEmailEvents,
  syncFromMailerLite,
} from "../controllers/pmMailerliteWebhook.controller.js";

const router = Router();

// Public - MailerLite webhook endpoint
router.post("/webhook", handleMailerliteWebhook);

// Admin - email engagement reports
router.get("/reports", getEmailReports);

// Admin - sync data from MailerLite API
router.post("/sync", syncFromMailerLite);

// Admin - email events for specific inquiry
router.get("/inquiry/:inquiryId/events", getInquiryEmailEvents);

export default router;
