import mongoose, { Schema } from "mongoose";

const pmEmailTemplateSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    preheader: {
      type: String,
      default: "",
    },
    htmlContent: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ["welcome", "follow-up", "promotion", "reminder", "custom"],
      default: "custom",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    autoSend: {
      type: String,
      enum: ["none", "on_inquiry"],
      default: "none",
    },
    lastSentAt: {
      type: Date,
    },
    sentCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const PmEmailTemplate = mongoose.model("PmEmailTemplate", pmEmailTemplateSchema);
