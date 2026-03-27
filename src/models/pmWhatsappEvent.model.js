import mongoose, { Schema } from "mongoose";

const pmWhatsappEventSchema = new Schema(
  {
    inquiryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PmInquiry",
    },
    mobile: {
      type: String,
      required: true,
    },
    eventType: {
      type: String,
      enum: ["sent", "delivered", "read", "failed"],
      required: true,
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PmWhatsappTemplate",
    },
    templateName: {
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

// Indexes for quick lookups
pmWhatsappEventSchema.index({ mobile: 1, eventType: 1 });
pmWhatsappEventSchema.index({ inquiryId: 1 });
pmWhatsappEventSchema.index({ eventTimestamp: -1 });

export const PmWhatsappEvent = mongoose.model("PmWhatsappEvent", pmWhatsappEventSchema);
