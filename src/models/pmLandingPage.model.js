import mongoose, { Schema } from "mongoose";

const pmLandingPageSchema = new Schema(
  {
    title:  { type: String, required: true, trim: true },
    slug:   { type: String, required: true, unique: true, trim: true, lowercase: true },
    type:   { type: String, enum: ["page", "popup"], required: true },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    description: { type: String, trim: true, default: "" },
    content:     { type: String, default: "" },
    settings: {
      triggerType:    { type: String, enum: ["time", "scroll", "exit_intent"] },
      triggerValue:   { type: Number },
      successMessage: { type: String },
      redirectUrl:    { type: String },
    },
    buildMethod: { type: String, enum: ["visual", "code", "upload", "github"], default: "code" },
    subdomain:   { type: String, trim: true, lowercase: true, default: "" },
    githubRepo:  { type: String, default: "" },
    githubBranch:{ type: String, default: "main" },
    staticPath:  { type: String, default: "" }, // server path for uploaded/github content
  },
  { timestamps: true }
);

export const PmLandingPage = mongoose.model("PmLandingPage", pmLandingPageSchema);
