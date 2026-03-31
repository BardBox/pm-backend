import mongoose, { Schema } from "mongoose";

const pmConversationMessageSchema = new Schema(
  {
    inquiryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PmInquiry",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["email", "whatsapp", "manual_email", "manual_whatsapp"],
      required: true,
    },
    sender: {
      type: String,
      enum: ["admin", "system", "user"],
      required: true,
    },
    channel: {
      type: String,
      enum: ["email", "whatsapp"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    subject: String,
    recipient: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "read", "failed", "pending", "received"],
      default: "sent",
    },
    linkedEventId: mongoose.Schema.Types.ObjectId,
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    messageTimestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

pmConversationMessageSchema.index({ inquiryId: 1, messageTimestamp: -1 });
pmConversationMessageSchema.index({ sender: 1 });
pmConversationMessageSchema.index({ "metadata.tftMsgId": 1 }, { sparse: true });

export const PmConversationMessage = mongoose.model(
  "PmConversationMessage",
  pmConversationMessageSchema
);
