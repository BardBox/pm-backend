import { PmInquiry } from "../models/pmInquiry.model.js";
import { createSubscriber } from "../services/mailerliteService.js";
import { triggerAutomationEmail } from "../services/pmEmailService.js";
import { triggerWhatsappAutomation } from "../services/pmWhatsappService.js";
import ApiErrors from "../utils/ApiErrors.js";
import ApiResponses from "../utils/ApiResponses.js";
import asyncHandler from "../utils/asyncHandler.js";

// Add new PM Inquiry
const addPmInquiry = asyncHandler(async (req, res) => {
  const {
    fullName,
    companyName,
    email,
    phone,
    city,
    state,
    role,
    teamSize,
    gstNumber,
    consentMessages,
    consentMarketing,
    utm_source,
    utm_medium,
    utm_campaign,
  } = req.body;

  if (
    [fullName, companyName, email, phone].some(
      (field) => !field || field.trim() === ""
    )
  ) {
    throw new ApiErrors(
      400,
      "Full name, company name, email, and phone are required"
    );
  }

  // Validate phone is a valid Indian mobile number (10 digits, optionally prefixed with +91/91/0)
  const cleanedPhone = phone.trim().replace(/[\s\-\+\(\)]/g, "");
  if (!/^(91|0)?\d{10}$/.test(cleanedPhone)) {
    throw new ApiErrors(400, "Please provide a valid 10-digit Indian mobile number");
  }

  const inquiry = await PmInquiry.create({
    fullName: fullName.trim(),
    companyName: companyName.trim(),
    email: email.trim(),
    phone: phone.trim(),
    city: city ? city.trim() : undefined,
    state: state ? state.trim() : undefined,
    role: role || undefined,
    teamSize: teamSize || undefined,
    gstNumber: gstNumber ? gstNumber.trim() : undefined,
    consentMessages: consentMessages || false,
    consentMarketing: consentMarketing || false,
    utm_source: utm_source || undefined,
    utm_medium: utm_medium || undefined,
    utm_campaign: utm_campaign || undefined,
  });

  if (!inquiry) {
    throw new ApiErrors(500, "Error while creating performance marketing inquiry");
  }

  // Create MailerLite subscriber (non-blocking)
  createSubscriber({
    email: inquiry.email,
    name: inquiry.fullName,
    company: inquiry.companyName,
    phone: inquiry.phone,
    city: inquiry.city,
    state: inquiry.state,
    source: utm_source || "direct",
  }).catch((err) => console.error("[MailerLite] Subscriber creation failed:", err.message));

  // Trigger welcome automation for "new" pipeline stage (non-blocking)
  triggerAutomationEmail("welcome", "new", inquiry.email, {
    name: inquiry.fullName,
    email: inquiry.email,
    company: inquiry.companyName,
    phone: inquiry.phone,
    city: inquiry.city || "",
    state: inquiry.state || "",
  }).catch((err) => console.error("[PM Email] Welcome automation failed:", err.message));

  // Trigger WhatsApp welcome automation (non-blocking)
  if (inquiry.phone) {
    triggerWhatsappAutomation("welcome", "new", inquiry.phone, inquiry._id)
      .catch((err) => console.error("[PM WhatsApp] Welcome automation failed:", err.message));
  }

  return res
    .status(201)
    .json(new ApiResponses(201, inquiry, "Inquiry submitted successfully"));
});

// Get all PM Inquiries
const getAllPmInquiries = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20, includeConverted } = req.query;

  const filter = {};
  if (status) {
    filter.status = status;
  } else if (includeConverted !== "true") {
    // By default exclude converted inquiries (they appear on members page)
    filter.status = { $ne: "converted" };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [inquiries, total] = await Promise.all([
    PmInquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    PmInquiry.countDocuments(filter),
  ]);

  return res.status(200).json(
    new ApiResponses(
      200,
      {
        inquiries,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
      "PM inquiries fetched successfully"
    )
  );
});

// Get single PM Inquiry
const getPmInquiry = asyncHandler(async (req, res) => {
  const inquiry = await PmInquiry.findById(req.params.id);

  if (!inquiry) {
    throw new ApiErrors(404, "Inquiry not found");
  }

  return res
    .status(200)
    .json(new ApiResponses(200, inquiry, "Inquiry fetched successfully"));
});

// Update PM Inquiry status/notes
const updatePmInquiry = asyncHandler(async (req, res) => {
  const { status, notes, pipelineStage } = req.body;

  // Get old inquiry to detect pipeline stage change
  const oldInquiry = await PmInquiry.findById(req.params.id);
  if (!oldInquiry) {
    throw new ApiErrors(404, "Inquiry not found");
  }

  const updateData = {};
  if (status) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes;
  if (pipelineStage !== undefined) updateData.pipelineStage = pipelineStage;

  const inquiry = await PmInquiry.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
  });

  // Trigger follow-up automation if pipeline stage changed
  if (pipelineStage && pipelineStage !== oldInquiry.pipelineStage) {
    triggerAutomationEmail("follow_up", pipelineStage, inquiry.email, {
      name: inquiry.fullName,
      email: inquiry.email,
      company: inquiry.companyName,
      phone: inquiry.phone,
      city: inquiry.city || "",
      state: inquiry.state || "",
    }).catch((err) => console.error("[PM Email] Follow-up automation failed:", err.message));

    // Trigger WhatsApp follow-up automation
    if (inquiry.phone) {
      triggerWhatsappAutomation("follow_up", pipelineStage, inquiry.phone, inquiry._id)
        .catch((err) => console.error("[PM WhatsApp] Follow-up automation failed:", err.message));
    }
  }

  return res
    .status(200)
    .json(new ApiResponses(200, inquiry, "Inquiry updated successfully"));
});

// Delete PM Inquiry
const deletePmInquiry = asyncHandler(async (req, res) => {
  const inquiry = await PmInquiry.findByIdAndDelete(req.params.id);

  if (!inquiry) {
    throw new ApiErrors(404, "Inquiry not found");
  }

  return res
    .status(200)
    .json(new ApiResponses(200, null, "Inquiry deleted successfully"));
});

// Delete multiple PM Inquiries
const deleteMultiplePmInquiries = asyncHandler(async (req, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new ApiErrors(400, "IDs array is required");
  }

  const result = await PmInquiry.deleteMany({ _id: { $in: ids } });

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        result,
        `${result.deletedCount} inquiries deleted successfully`
      )
    );
});

// Get PM Inquiry stats
const getPmInquiryStats = asyncHandler(async (req, res) => {
  const [total, newCount, contactedCount, convertedCount, hotCount, warmCount, coldCount] =
    await Promise.all([
      PmInquiry.countDocuments(),
      PmInquiry.countDocuments({ status: "new" }),
      PmInquiry.countDocuments({ status: "contacted" }),
      PmInquiry.countDocuments({ status: "converted" }),
      PmInquiry.countDocuments({ status: "hot" }),
      PmInquiry.countDocuments({ status: "warm" }),
      PmInquiry.countDocuments({ status: "cold" }),
    ]);

  return res.status(200).json(
    new ApiResponses(
      200,
      { total, new: newCount, contacted: contactedCount, converted: convertedCount, hot: hotCount, warm: warmCount, cold: coldCount },
      "PM inquiry stats fetched successfully"
    )
  );
});

// Convert inquiry by email (used by payment success redirect)
const convertByEmail = asyncHandler(async (req, res) => {
  const { email } = req.params;

  const inquiry = await PmInquiry.findOne({
    email: email.toLowerCase(),
  }).sort({ createdAt: -1 });

  if (!inquiry) {
    throw new ApiErrors(404, "No inquiry found for this email");
  }

  inquiry.status = "converted";
  inquiry.notes = `${inquiry.notes ? inquiry.notes + "\n" : ""}Payment completed on ${new Date().toLocaleDateString("en-IN")}`;
  await inquiry.save();

  return res
    .status(200)
    .json(new ApiResponses(200, inquiry, "Inquiry marked as converted"));
});

export {
  addPmInquiry,
  getAllPmInquiries,
  getPmInquiry,
  updatePmInquiry,
  deletePmInquiry,
  deleteMultiplePmInquiries,
  getPmInquiryStats,
  convertByEmail,
};
