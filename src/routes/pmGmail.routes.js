import { Router } from "express";
import {
  initiateGmailAuth,
  gmailCallback,
  manualGmailSync,
  startAutoGmailSync,
} from "../controllers/pmGmailAuth.controller.js";

const router = Router();

// GET  /pm/gmail/auth         → Get OAuth consent URL
router.get("/auth", initiateGmailAuth);

// GET /pm/gmail/callback      → Exchange code for refresh token (Google redirects here)
router.get("/callback", gmailCallback);

// POST /pm/gmail/sync         → Manual one-time sync
router.post("/sync", manualGmailSync);

// POST /pm/gmail/start-sync   → Start periodic auto-sync
router.post("/start-sync", startAutoGmailSync);

export default router;
