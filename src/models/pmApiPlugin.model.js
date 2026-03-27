import mongoose, { Schema } from "mongoose";

const endpointSchema = new Schema(
  {
    name: { type: String, required: true },
    method: {
      type: String,
      enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      default: "GET",
    },
    path: { type: String, required: true },
    description: { type: String, default: "" },
    sampleBody: { type: String, default: "" },
  },
  { _id: true }
);

const pmApiPluginSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
    baseUrl: { type: String, required: true },
    authType: {
      type: String,
      enum: ["none", "bearer", "api_key_header", "basic"],
      default: "none",
    },
    // For bearer: the token; for api_key_header: the key value; for basic: "user:pass"
    authValue: { type: String, default: "" },
    // For api_key_header: custom header name (default X-API-Key)
    authHeaderName: { type: String, default: "X-API-Key" },
    customHeaders: { type: Map, of: String, default: {} },
    endpoints: [endpointSchema],
    icon: { type: String, default: "Plug" },
    color: { type: String, default: "#6366f1" },
    isActive: { type: Boolean, default: true },
    lastTestedAt: { type: Date },
    lastTestSuccess: { type: Boolean },
  },
  { timestamps: true }
);

export const PmApiPlugin = mongoose.model("PmApiPlugin", pmApiPluginSchema);
