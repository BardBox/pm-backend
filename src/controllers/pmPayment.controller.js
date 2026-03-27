import crypto from "crypto";
import Razorpay from "razorpay";
import { PmInquiry } from "../models/pmInquiry.model.js";
import { PmPlan } from "../models/pmPlan.model.js";
import { User } from "../models/user.model.js";
import { Profile } from "../models/profile.model.js";
import { Payment } from "../models/payment.model.js";
import ApiErrors from "../utils/ApiErrors.js";
import ApiResponses from "../utils/ApiResponses.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendEmailWithCredentials } from "../services/credentialsEmail.js";

console.log("PM Razorpay Key:", process.env.RAZORPAY_KEY_ID?.substring(0, 12) + "...");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Fallback amount if no plan found (₹1 for testing)
const FALLBACK_AMOUNT = 1;

// Create Razorpay order for PM inquiry
const createPmOrder = asyncHandler(async (req, res) => {
  const { inquiryId, planId } = req.body;

  if (!inquiryId) {
    throw new ApiErrors(400, "Inquiry ID is required");
  }

  const inquiry = await PmInquiry.findById(inquiryId);
  if (!inquiry) {
    throw new ApiErrors(404, "Inquiry not found");
  }

  // Check if user already exists with this email
  const existingUser = await User.findOne({ email: inquiry.email.toLowerCase() });
  if (existingUser) {
    // Update inquiry status
    inquiry.status = "converted";
    inquiry.notes = `${inquiry.notes ? inquiry.notes + "\n" : ""}User already exists in system`;
    await inquiry.save();
    throw new ApiErrors(409, "User with this email already exists");
  }

  // Get plan amount - by planId, or default plan, or fallback
  let plan = null;
  let amount = FALLBACK_AMOUNT;

  if (planId) {
    plan = await PmPlan.findById(planId);
    if (!plan || !plan.isActive) {
      throw new ApiErrors(400, "Selected plan is not available");
    }
    amount = plan.discountPrice != null ? plan.discountPrice : plan.amount;
  } else {
    // Try to get default plan
    plan = await PmPlan.findOne({ isDefault: true, isActive: true });
    if (plan) {
      amount = plan.discountPrice != null ? plan.discountPrice : plan.amount;
    }
  }

  // GST calculation (CGST 9% + SGST 9% = 18%)
  const GST_RATE = 18;
  const subtotal = amount;
  const gstAmount = Math.round((subtotal * GST_RATE) / 100);
  const cgst = Math.round((subtotal * 9) / 100);
  const sgst = Math.round((subtotal * 9) / 100);
  const totalAmount = subtotal + gstAmount;

  const transactionId = `PM-TXN-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  const options = {
    amount: totalAmount * 100, // Razorpay expects paise
    currency: "INR",
    receipt: transactionId,
    payment_capture: 1,
    notes: {
      inquiryId: inquiry._id.toString(),
      email: inquiry.email,
      fullName: inquiry.fullName,
      phone: inquiry.phone,
      planId: plan ? plan._id.toString() : "none",
      planName: plan ? plan.name : "Default",
      source: "performance-marketing",
    },
  };

  const order = await razorpay.orders.create(options);

  return res.status(200).json(
    new ApiResponses(200, {
      orderId: order.id,
      amount: order.amount,
      originalAmount: plan ? plan.amount * 100 : subtotal * 100,
      subtotal: subtotal * 100,
      cgst: cgst * 100,
      sgst: sgst * 100,
      gstTotal: gstAmount * 100,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
      inquiryId: inquiry._id,
      email: inquiry.email,
      fullName: inquiry.fullName,
      phone: inquiry.phone,
      planName: plan ? plan.name : "Digital Membership",
    }, "Razorpay order created successfully")
  );
});

// Helper to generate unique username
const generateUniqueUsername = async (fname) => {
  const baseUsername = fname.toLowerCase().replace(/[^a-z0-9]/g, "");
  let username = baseUsername;
  let counter = 1;
  while (await User.findOne({ username })) {
    username = `${baseUsername}${counter}`;
    counter++;
  }
  return username;
};

// Helper to generate random password
const generateRandomPassword = () => {
  return crypto.randomBytes(6).toString("hex");
};

// Verify payment and create user
const verifyPmPayment = asyncHandler(async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    inquiryId,
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !inquiryId) {
    throw new ApiErrors(400, "Missing payment verification details");
  }

  // Verify signature
  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    throw new ApiErrors(400, "Invalid payment signature");
  }

  // Get inquiry
  const inquiry = await PmInquiry.findById(inquiryId);
  if (!inquiry) {
    throw new ApiErrors(404, "Inquiry not found");
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email: inquiry.email.toLowerCase() });
  if (existingUser) {
    inquiry.status = "converted";
    await inquiry.save();
    return res.status(200).json(
      new ApiResponses(200, { userId: existingUser._id }, "User already exists, inquiry marked as converted")
    );
  }

  // Create profile
  const profile = await Profile.create({
    contactDetails: {
      email: inquiry.email,
      ...(inquiry.phone ? { mobileNumber: inquiry.phone } : {}),
    },
    professionalDetails: {
      business: inquiry.companyName || "",
    },
  });

  // Generate username and password
  const nameParts = inquiry.fullName.trim().split(" ");
  const fname = nameParts[0] || inquiry.fullName;
  const lname = nameParts.slice(1).join(" ") || "";
  const username = await generateUniqueUsername(fname);
  const password = generateRandomPassword();

  // Create user
  const user = await User.create({
    fname,
    lname,
    username,
    email: inquiry.email.toLowerCase(),
    ...(inquiry.phone ? { mobile: Number(inquiry.phone) || undefined } : {}),
    country: "India",
    state: inquiry.state || "",
    city: inquiry.city || "",
    profile: profile._id,
    membershipType: "Digital Membership",
    role: "digital-member",
    isActive: true,
    password,
    isPasswordTemp: true,
    showPasswordPopup: true,
  });

  // Get actual amount from Razorpay order
  const rzpOrder = await razorpay.orders.fetch(razorpay_order_id);

  // Create payment record and link to user
  const payment = await Payment.create({
    userId: user._id,
    membershipType: "Digital Membership",
    feeType: "annual",
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
    status: "completed",
    amount: rzpOrder.amount,
    paymentMethod: "razorpay",
  });

  // Add payment to user's paymentVerification array (so main admin panel can see it)
  user.paymentVerification.push(payment._id);
  await user.save();

  // Send welcome email with credentials
  try {
    await sendEmailWithCredentials(fname, user.email, password);
    console.log(`✅ PM credentials email sent to ${user.email}`);
  } catch (err) {
    console.error("Failed to send PM credentials email:", err.message);
    // Don't throw - user is already created, email failure shouldn't block response
  }

  // Update inquiry status to converted with payment details
  inquiry.status = "converted";
  inquiry.paymentAmount = rzpOrder.amount / 100; // Convert from paise to rupees
  inquiry.razorpayPaymentId = razorpay_payment_id;
  inquiry.razorpayOrderId = razorpay_order_id;
  inquiry.userId = user._id;
  inquiry.notes = `${inquiry.notes ? inquiry.notes + "\n" : ""}Payment completed & user created on ${new Date().toLocaleDateString("en-IN")}. User ID: ${user._id}. Temp password: ${password}`;
  await inquiry.save();

  return res.status(201).json(
    new ApiResponses(201, {
      userId: user._id,
      email: user.email,
      username: user.username,
      tempPassword: password,
    }, "Payment verified, user created successfully")
  );
});

export { createPmOrder, verifyPmPayment };
