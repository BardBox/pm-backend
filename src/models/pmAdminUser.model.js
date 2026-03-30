import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

const DEFAULT_PERMISSIONS = () => ({
  dashboard: "none",
  inquiries: "none",
  plans: "none",
  members: "none",
  stories: "none",
  contacts: "none",
  pipeline: "none",
  email: "none",
  whatsapp: "none",
  templates: "none",
  api: "none",
});

const pmAdminUserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    permissions: {
      type: Object,
      default: DEFAULT_PERMISSIONS,
    },
  },
  { timestamps: true }
);

pmAdminUserSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

pmAdminUserSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

export const PmAdminUser = mongoose.model("PmAdminUser", pmAdminUserSchema);
