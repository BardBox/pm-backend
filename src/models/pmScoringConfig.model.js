import mongoose, { Schema } from "mongoose";

const scoringEventSchema = new Schema(
  {
    key: { type: String, required: true },         // e.g. "page_visit"
    label: { type: String, required: true },        // e.g. "Page Visit"
    description: { type: String, default: "" },     // e.g. "Each page the user visits"
    score: { type: Number, required: true, min: 0 }, // points awarded
    icon: { type: String, default: "Zap" },         // lucide icon name
    isSystem: { type: Boolean, default: false },    // system events can't be deleted
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

const pipelineStageSchema = new Schema(
  {
    key: { type: String, required: true },           // e.g. "cold"
    label: { type: String, required: true },          // e.g. "Cold"
    minScore: { type: Number, required: true },       // e.g. 11
    color: { type: String, default: "#3b82f6" },      // hex color for UI
    order: { type: Number, default: 0 },              // display order
    isSystem: { type: Boolean, default: false },      // system stages can't be deleted
  },
  { _id: true }
);

const pmScoringConfigSchema = new Schema(
  {
    events: [scoringEventSchema],
    // Dynamic pipeline stages
    pipelineStages: [pipelineStageSchema],
    // Legacy thresholds (kept for backward compatibility)
    thresholds: {
      cold: { type: Number, default: 11 },
      warm: { type: Number, default: 26 },
      hot: { type: Number, default: 51 },
    },
    // Score decay
    decay: {
      enabled: { type: Boolean, default: true },
      inactiveDays: { type: Number, default: 30 },
      decayAmount: { type: Number, default: 10 },
    },
  },
  { timestamps: true }
);

// Default system events
export const DEFAULT_EVENTS = [
  { key: "page_visit", label: "Page Visit", description: "Each page the user visits", score: 2, icon: "Eye", isSystem: true },
  { key: "return_visit", label: "Return Visit", description: "User comes back to the site", score: 5, icon: "Undo2", isSystem: true },
  { key: "time_30sec", label: "Stay 30 seconds", description: "User stays on a page for 30s+", score: 3, icon: "Clock", isSystem: true },
  { key: "time_2min", label: "Stay 2 minutes", description: "User stays on a page for 2min+", score: 8, icon: "Clock", isSystem: true },
  { key: "scroll_50", label: "Scroll 50%", description: "User scrolls past half the page", score: 3, icon: "ScrollText", isSystem: true },
  { key: "cta_click", label: "CTA Click", description: "User clicks a call-to-action button", score: 5, icon: "MousePointerClick", isSystem: true },
  { key: "form_started", label: "Form Started", description: "User begins filling out the form", score: 8, icon: "FormInput", isSystem: true },
  { key: "form_submitted", label: "Form Submitted", description: "User submits the inquiry form", score: 20, icon: "FormInput", isSystem: true },
  { key: "file_download", label: "File Download", description: "User downloads a file/brochure", score: 10, icon: "FileDown", isSystem: true },
  { key: "pricing_visit", label: "Pricing Page", description: "User visits pricing/checkout page", score: 15, icon: "CreditCard", isSystem: true },
  { key: "multiple_pages", label: "5+ Pages Visited", description: "User visits more than 5 pages", score: 10, icon: "ArrowLeftRight", isSystem: true },
  { key: "whatsapp_sent", label: "WhatsApp Sent", description: "WhatsApp message sent to lead", score: 0, icon: "MessageCircle", isSystem: true },
  { key: "whatsapp_delivered", label: "WhatsApp Delivered", description: "WhatsApp message delivered to lead", score: 2, icon: "MessageCircle", isSystem: true },
  { key: "whatsapp_read", label: "WhatsApp Read", description: "WhatsApp message read by lead", score: 5, icon: "MessageCircle", isSystem: true },
];

export const DEFAULT_PIPELINE_STAGES = [
  { key: "cold", label: "Cold", minScore: 0, color: "#06b6d4", order: 0, isSystem: true },
  { key: "warm", label: "Warm", minScore: 26, color: "#f97316", order: 1, isSystem: true },
  { key: "hot", label: "Hot", minScore: 51, color: "#ef4444", order: 2, isSystem: true },
];

export const PmScoringConfig = mongoose.model("PmScoringConfig", pmScoringConfigSchema);
