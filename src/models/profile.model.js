import mongoose, { Schema } from "mongoose";

const profileSchema = new Schema(
  {
    contactDetails: {
      mobileNumber: { type: String },
      email: { type: String, unique: true },
    },
    professionalDetails: {
      business: { type: String, trim: true, default: "" },
    },
  },
  {
    timestamps: true,
  }
);

export const Profile = mongoose.model("Profile", profileSchema);
