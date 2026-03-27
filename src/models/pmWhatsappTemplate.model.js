import mongoose, { Schema } from "mongoose";

const pmWhatsappTemplateSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    tftTemplateName: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      default: "custom",
    },
    // TFT-specific fields (synced from TFT platform)
    tftCategory: {
      type: String, // MARKETING, UTILITY, AUTHENTICATION
    },
    tftStatus: {
      type: String, // APPROVED, PENDING, REJECTED
    },
    tftMessage: {
      type: String, // Template message body from TFT
    },
    tftFooter: {
      type: String,
    },
    tftSystemId: {
      type: String, // TFT's internal system ID
    },
    tftTemplateId: {
      type: String, // Meta's template ID
    },
    tftLanguage: {
      type: String,
      default: "en",
    },
    tftTemplateType: {
      type: String, // standard, media, carousel
      default: "standard",
    },
    tftDynamicVars: {
      type: String, // comma-separated dynamic variable examples
    },
    tftQuickReply: {
      type: String, // comma-separated quick reply buttons
    },
    tftLinkCaption: {
      type: String,
    },
    tftLink: {
      type: String,
    },
    tftCallCaption: {
      type: String,
    },
    tftCallNumber: {
      type: String,
    },
    tftCreatedOn: {
      type: String, // date string from TFT
    },
    tftComponents: {
      type: Schema.Types.Mixed, // Full Meta component structure from detail API
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastSentAt: {
      type: Date,
    },
    sentCount: {
      type: Number,
      default: 0,
    },
    lastSyncedAt: {
      type: Date,
    },
    source: {
      type: String,
      enum: ["manual", "synced", "created_via_admin"],
      default: "manual",
    },
  },
  {
    timestamps: true,
  }
);

export const PmWhatsappTemplate = mongoose.model("PmWhatsappTemplate", pmWhatsappTemplateSchema);
