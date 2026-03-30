import { Router } from "express";
import {
  handleIncomingEmail,
  handleIncomingWhatsapp,
} from "../controllers/pmIncomingMessages.controller.js";

const router = Router();

// Incoming email webhook
router.post("/email", handleIncomingEmail);

// Incoming WhatsApp webhook
router.post("/whatsapp", handleIncomingWhatsapp);

export default router;