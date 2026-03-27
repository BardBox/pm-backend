import mongoose, { Schema } from "mongoose";

const pmEmailEventSchema = new Schema(
  {
    inquiryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PmInquiry",
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    eventType: {
      type: String,
      enum: ["sent", "open", "click", "unsubscribe", "bounce", "spam_complaint"],
      required: true,
    },
    campaignId: {
      type: String,
    },
    campaignName: {
      type: String,
    },
    eventTimestamp: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Index for quick lookups
pmEmailEventSchema.index({ email: 1, eventType: 1 });
pmEmailEventSchema.index({ inquiryId: 1 });
pmEmailEventSchema.index({ eventTimestamp: -1 });

export const PmEmailEvent = mongoose.model("PmEmailEvent", pmEmailEventSchema);
