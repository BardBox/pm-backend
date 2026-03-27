import mongoose, { Schema } from "mongoose";

const pmInquirySchema = new Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    companyName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    city: {
      type: String,
    },
    state: {
      type: String,
    },
    role: {
      type: String,
      enum: ["founder", "co-founder", "ceo", "director", "manager", "other"],
    },
    teamSize: {
      type: String,
      enum: ["1-5", "6-20", "21-50", "51-100", "100+"],
    },
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    consentMessages: {
      type: Boolean,
      default: false,
    },
    consentMarketing: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["new", "contacted", "converted", "hot", "warm", "cold"],
      default: "new",
    },
    engagementScore: {
      type: Number,
      default: 0,
    },
    pipelineStage: {
      type: String,
      default: "new",
    },
    activityLog: [
      {
        event: String,
        scoreAdded: Number,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    lastActivity: {
      type: String,
    },
    paymentAmount: {
      type: Number,
    },
    razorpayPaymentId: {
      type: String,
    },
    razorpayOrderId: {
      type: String,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    notes: {
      type: String,
    },
    utm_source: {
      type: String,
    },
    utm_medium: {
      type: String,
    },
    utm_campaign: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const PmInquiry = mongoose.model("PmInquiry", pmInquirySchema);
