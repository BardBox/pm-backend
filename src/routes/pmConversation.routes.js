import { Router } from "express";
import {
  getInquiryConversation,
  sendDirectEmail,
  sendDirectWhatsapp,
} from "../controllers/pmConversation.controller.js";

const router = Router();

// GET /pm/conversations/:inquiryId - fetch conversation history
router.get("/:inquiryId", getInquiryConversation);

// POST /pm/conversations/:inquiryId/email - send direct email
router.post("/:inquiryId/email", sendDirectEmail);

// POST /pm/conversations/:inquiryId/whatsapp - send direct whatsapp
router.post("/:inquiryId/whatsapp", sendDirectWhatsapp);

export default router;
