import mongoose, { Schema } from "mongoose";

const formFieldSchema = new Schema(
  {
    id:          { type: String, required: true },
    type:        { type: String, enum: ["text", "email", "phone", "textarea", "select", "checkbox", "radio", "number", "date"] },
    label:       { type: String, required: true },
    placeholder: { type: String, default: "" },
    required:    { type: Boolean, default: false },
    options:     { type: [String], default: [] },
  },
  { _id: false }
);

const pmFormSchema = new Schema(
  {
    title:          { type: String, required: true, trim: true },
    description:    { type: String, trim: true, default: "" },
    status:         { type: String, enum: ["active", "inactive"], default: "active" },
    fields:         { type: [formFieldSchema], default: [] },
    submissions:    { type: Number, default: 0 },
    successMessage: { type: String, default: "" },
    redirectUrl:    { type: String, default: "" },
  },
  { timestamps: true }
);

export const PmForm = mongoose.model("PmForm", pmFormSchema);
