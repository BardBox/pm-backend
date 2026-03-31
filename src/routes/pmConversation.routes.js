import { Router } from "express";
import {
  getInquiryConversation,
  sendDirectEmail,
  sendDirectWhatsapp,
  syncWhatsappMessages,
} from "../controllers/pmConversation.controller.js";

const router = Router();

// GET /pm/conversations/:inquiryId - fetch conversation history
router.get("/:inquiryId", getInquiryConversation);

// POST /pm/conversations/:inquiryId/email - send direct email
router.post("/:inquiryId/email", sendDirectEmail);

// POST /pm/conversations/:inquiryId/whatsapp - send direct whatsapp (free text via TFT chatbot)
router.post("/:inquiryId/whatsapp", sendDirectWhatsapp);

// POST /pm/conversations/:inquiryId/whatsapp/sync - pull incoming replies from TFT
router.post("/:inquiryId/whatsapp/sync", syncWhatsappMessages);

export default router;
