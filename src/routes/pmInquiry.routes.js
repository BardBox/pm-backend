import { Router } from "express";
import {
  addPmInquiry,
  getAllPmInquiries,
  getPmInquiry,
  updatePmInquiry,
  deletePmInquiry,
  deleteMultiplePmInquiries,
  getPmInquiryStats,
  convertByEmail,
} from "../controllers/pmInquiry.controller.js";
import {
  handleZohoPaymentWebhook,
  verifyPaymentByEmail,
} from "../controllers/pmPaymentWebhook.controller.js";
import {
  createPmOrder,
  verifyPmPayment,
} from "../controllers/pmPayment.controller.js";

const router = Router();

// Public - submit inquiry from landing page
router.post("/add", addPmInquiry);

// Razorpay payment
router.post("/create-order", createPmOrder);
router.post("/verify-payment", verifyPmPayment);

// Zoho payment webhook (kept for backward compatibility)
router.post("/webhook/zoho", handleZohoPaymentWebhook);

// Check payment status by email
router.get("/payment-status/:email", verifyPaymentByEmail);

// Convert inquiry by email (payment success redirect)
router.patch("/convert-by-email/:email", convertByEmail);

// Admin - manage inquiries
router.get("/", getAllPmInquiries);
router.get("/stats", getPmInquiryStats);
router.get("/:id", getPmInquiry);
router.patch("/:id", updatePmInquiry);
router.delete("/:id", deletePmInquiry);
router.post("/delete-multiple", deleteMultiplePmInquiries);

export default router;
