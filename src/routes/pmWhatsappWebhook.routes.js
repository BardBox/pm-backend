import { Router } from "express";
import { handleWebhook, testWebhook } from "../controllers/pmWhatsappWebhook.controller.js";

const router = Router();

// Public endpoints - no auth required (called by TFT platform)
router.post("/", handleWebhook);
router.get("/test", testWebhook);

export default router;
