import mongoose, { Schema } from "mongoose";

const pmWhatsappAutomationSchema = new Schema(
  {
    // "welcome", "follow_up", or custom slug like "custom_1710934800000"
    type: {
      type: String,
      required: true,
    },
    // Display name for the tab (e.g. "Welcome", "Re-engagement Campaign")
    groupName: {
      type: String,
      required: true,
    },
    // Whether this is a built-in type (welcome/follow_up) or user-created
    isBuiltIn: {
      type: Boolean,
      default: false,
    },
    pipelineStage: {
      type: String,
      required: true,
    },
    templateId: {
      type: Schema.Types.ObjectId,
      ref: "PmWhatsappTemplate",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    delay: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Only one automation per type + pipelineStage combo
pmWhatsappAutomationSchema.index({ type: 1, pipelineStage: 1 }, { unique: true });

export const PmWhatsappAutomation = mongoose.model("PmWhatsappAutomation", pmWhatsappAutomationSchema);
