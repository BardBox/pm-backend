import { Router } from "express";
import { trackOpen, trackClick } from "../controllers/pmEmailTracking.controller.js";

const router = Router();

// These are public endpoints - no auth required (called from email clients)
router.get("/open", trackOpen);
router.get("/click", trackClick);

export default router;
