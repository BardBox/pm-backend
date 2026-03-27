import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new Schema(
  {
    avatar: {
      type: String,
      default: "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg",
    },
    fname: { type: String, required: true, trim: true },
    lname: { type: String, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      unique: true,
      trim: true,
    },
    mobile: {
      type: String,
      required: false,
      default: undefined,
      trim: true,
    },
    country: { type: String, trim: true },
    state: { type: String, trim: true },
    city: { type: String, trim: true },
    username: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
      unique: true,
    },
    password: { type: String },
    isPasswordTemp: { type: Boolean, default: true },
    showPasswordPopup: { type: Boolean, default: true },
    profile: { type: Schema.Types.ObjectId, ref: "Profile" },
    paymentVerification: [{ type: Schema.Types.ObjectId, ref: "Payment" }],
    membershipType: {
      type: String,
      enum: [
        "Core Membership",
        "Flagship Membership",
        "Industria Membership",
        "Digital Membership",
        "Digital Membership Trial",
      ],
      required: true,
      trim: true,
    },
    role: {
      type: String,
      default: "digital-member",
      trim: true,
    },
    isActive: { type: Boolean, default: false },
    renewalDate: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

userSchema.index(
  { mobile: 1 },
  {
    unique: true,
    partialFilterExpression: {
      mobile: { $exists: true, $ne: null, $type: "string" },
    },
    name: "mobile_unique_partial",
  }
);

userSchema.virtual("name").get(function () {
  return `${this.fname} ${this.lname || ""}`.trim();
});

userSchema.pre("save", async function (next) {
  if (this.mobile === null || this.mobile === undefined) {
    this.mobile = undefined;
  }
  if (this.password && this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

userSchema.pre("validate", async function (next) {
  if (!this.mobile || (typeof this.mobile === "string" && this.mobile.trim() === "")) {
    this.mobile = undefined;
  }
  if (!this.username && this.fname) {
    let baseUsername;
    let exists = true;
    while (exists) {
      baseUsername =
        this.fname.toLowerCase().replace(/\s+/g, "") + Math.floor(100 + Math.random() * 900);
      exists = await mongoose.models.User.findOne({ username: baseUsername });
    }
    this.username = baseUsername;
  }
  next();
});

export const User = mongoose.model("User", userSchema);
