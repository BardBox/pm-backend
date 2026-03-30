import { PmConversationMessage } from "../models/pmConversationMessage.model.js";
import { PmInquiry } from "../models/pmInquiry.model.js";

// Import Resend for email sending
const sendEmailViaResend = async (to, subject, content) => {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to,
        subject,
        html: `<p>${content.replace(/\n/g, "<br>")}</p>`,
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Resend email error:", error);
    throw error;
  }
};

// GET /pm/conversations/:inquiryId
export const getInquiryConversation = async (req, res) => {
  try {
    const { inquiryId } = req.params;

    const inquiry = await PmInquiry.findById(inquiryId);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: "Inquiry not found" });
    }

    // Fetch all messages for this inquiry, sorted by timestamp
    const messages = await PmConversationMessage.find({ inquiryId })
      .sort({ messageTimestamp: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        inquiry: {
          _id: inquiry._id,
          fullName: inquiry.fullName,
          email: inquiry.email,
          phone: inquiry.phone,
        },
        messages,
      },
    });
  } catch (err) {
    console.error("Get conversation error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// POST /pm/conversations/:inquiryId/email
export const sendDirectEmail = async (req, res) => {
  try {
    const { inquiryId } = req.params;
    const { content, subject = "Message from BizCivitas" } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: "Content is required" });
    }

    const inquiry = await PmInquiry.findById(inquiryId);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: "Inquiry not found" });
    }

    // Send email via Resend
    try {
      await sendEmailViaResend(inquiry.email, subject, content);
    } catch (emailErr) {
      console.error("Email send error:", emailErr);
      return res.status(500).json({ success: false, message: "Failed to send email" });
    }

    // Create conversation message record
    const message = await PmConversationMessage.create({
      inquiryId,
      type: "manual_email",
      sender: "admin",
      channel: "email",
      content,
      subject,
      recipient: inquiry.email,
      status: "sent",
      messageTimestamp: new Date(),
    });

    return res.status(201).json({
      success: true,
      data: message,
    });
  } catch (err) {
    console.error("Send email error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// POST /pm/conversations/:inquiryId/whatsapp
export const sendDirectWhatsapp = async (req, res) => {
  try {
    const { inquiryId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: "Content is required" });
    }

    const inquiry = await PmInquiry.findById(inquiryId);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: "Inquiry not found" });
    }

    // Format phone number (add country code if needed)
    let formattedPhone = inquiry.phone.replace(/\D/g, "");
    if (!formattedPhone.startsWith("91")) {
      formattedPhone = "91" + formattedPhone.slice(-10);
    }

    // Note: TFT WhatsApp API is template-based (send/bytemplate endpoint)
    // For direct messages without a template, we'll store the message locally
    // and log it as a pending message
    let whatsappStatus = "pending";
    
    // Create conversation message record
    const message = await PmConversationMessage.create({
      inquiryId,
      type: "manual_whatsapp",
      sender: "admin",
      channel: "whatsapp",
      content,
      recipient: inquiry.phone,
      status: whatsappStatus,
      messageTimestamp: new Date(),
    });

    return res.status(201).json({
      success: true,
      data: message,
    });
  } catch (err) {
    console.error("Send WhatsApp error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
