import { PmInquiry } from "../models/pmInquiry.model.js";
import ApiResponses from "../utils/ApiResponses.js";
import asyncHandler from "../utils/asyncHandler.js";

// Zoho webhook - called when payment is completed
const handleZohoPaymentWebhook = asyncHandler(async (req, res) => {
  const payload = req.body;

  console.log("Zoho webhook received:", JSON.stringify(payload, null, 2));

  // Zoho sends event_type for subscription events
  const eventType = payload.event_type;

  // Only process successful subscription/payment events
  const successEvents = [
    "subscription_created",
    "subscription_renewed",
    "payment_thankyou",
    "invoice_paid",
  ];

  if (eventType && !successEvents.includes(eventType)) {
    return res
      .status(200)
      .json(new ApiResponses(200, null, "Event ignored"));
  }

  // Try to find inquiry by email or custom field inquiry_id
  const email =
    payload.data?.subscription?.customer?.email ||
    payload.data?.customer?.email ||
    payload.customer?.email ||
    payload.email ||
    payload.cf_email;

  const inquiryId =
    payload.data?.subscription?.custom_fields?.cf_inquiry_id ||
    payload.cf_inquiry_id;

  let inquiry = null;

  // First try by inquiry ID
  if (inquiryId) {
    try {
      inquiry = await PmInquiry.findById(inquiryId);
    } catch {
      // Invalid ID format, try email
    }
  }

  // Fallback to email match (most recent inquiry with that email)
  if (!inquiry && email) {
    inquiry = await PmInquiry.findOne({ email: email.toLowerCase() }).sort({
      createdAt: -1,
    });
  }

  if (inquiry) {
    inquiry.status = "converted";
    inquiry.notes = `${inquiry.notes ? inquiry.notes + "\n" : ""}Payment completed via Zoho on ${new Date().toISOString()}`;
    await inquiry.save();
    console.log(`PM Inquiry ${inquiry._id} marked as converted (payment received)`);
  } else {
    console.log(`No matching PM inquiry found for email: ${email}, inquiryId: ${inquiryId}`);
  }

  // Always return 200 to Zoho
  return res
    .status(200)
    .json(new ApiResponses(200, null, "Webhook processed"));
});

// Manual payment verification - check by email
const verifyPaymentByEmail = asyncHandler(async (req, res) => {
  const { email } = req.params;

  const inquiry = await PmInquiry.findOne({
    email: email.toLowerCase(),
  }).sort({ createdAt: -1 });

  if (!inquiry) {
    return res
      .status(404)
      .json(new ApiResponses(404, null, "No inquiry found for this email"));
  }

  return res
    .status(200)
    .json(
      new ApiResponses(200, { status: inquiry.status, id: inquiry._id }, "Inquiry status fetched")
    );
});

export { handleZohoPaymentWebhook, verifyPaymentByEmail };
