import axios from "axios";
import { google } from "googleapis";
import { PmConversationMessage } from "../models/pmConversationMessage.model.js";
import { PmInquiry } from "../models/pmInquiry.model.js";

const gmail = google.gmail("v1");

// OAuth2 client setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

/**
 * Set up auth with refresh token
 */
const setupAuth = () => {
  if (process.env.GMAIL_REFRESH_TOKEN) {
    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    });
  }
};

/**
 * Get authorization URL for Gmail
 */
export const getGmailAuthUrl = () => {
  const scopes = ["https://www.googleapis.com/auth/gmail.readonly"];
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });
};

/**
 * Exchange authorization code for refresh token
 */
export const handleGmailCallback = async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;
    
    console.log("[Gmail Service] Got refresh token:", refreshToken);
    
    // Save this to your .env and restart
    return refreshToken;
  } catch (err) {
    console.error("[Gmail Service] Failed to get refresh token:", err);
    throw err;
  }
};

/**
 * Fetch email threads from Gmail
 * Only gets emails from the last 24 hours with specific labels
 */
export const fetchGmailReplies = async () => {
  try {
    setupAuth();

    // Check if we have credentials
    if (!process.env.GMAIL_REFRESH_TOKEN) {
      console.warn("[Gmail Service] No refresh token configured");
      return [];
    }

    const gmail = google.gmail("v1");

    // Get email threads from last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const query = `after:${Math.floor(oneDayAgo.getTime() / 1000)}`;

    // List threads
    const threadsRes = await gmail.users.threads.list({
      userId: "me",
      q: query,
      maxResults: 20,
      auth: oauth2Client,
    });

    const threads = threadsRes.data.threads || [];
    console.log(`[Gmail Service] Found ${threads.length} threads in last 24h`);

    const newMessages = [];

    // Process each thread
    for (const thread of threads) {
      const threadRes = await gmail.users.threads.get({
        userId: "me",
        id: thread.id,
        format: "full",
        auth: oauth2Client,
      });

      const messages = threadRes.data.messages || [];

      // Get only the last message (newest reply)
      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        const headers = lastMsg.payload.headers;

        // Extract email details
        const from = headers.find((h) => h.name === "From")?.value || "";
        const subject = headers.find((h) => h.name === "Subject")?.value || "";
        const date = headers.find((h) => h.name === "Date")?.value || new Date().toISOString();

        // Extract email address from "Name <email@domain.com>" format
        const emailMatch = from.match(/<([^>]+)>/);
        const fromEmail = emailMatch ? emailMatch[1] : from;
        const senderName = from.replace(/<[^>]+>/, "").trim();

        // Get email body
        let content = "";
        if (lastMsg.payload.parts) {
          const textPart = lastMsg.payload.parts.find(
            (p) => p.mimeType === "text/plain"
          );
          if (textPart && textPart.body.data) {
            content = Buffer.from(textPart.body.data, "base64").toString("utf8");
          }
        } else if (lastMsg.payload.body?.data) {
          content = Buffer.from(lastMsg.payload.body.data, "base64").toString("utf8");
        }

        // Find inquiry by email
        const inquiry = await PmInquiry.findOne({
          email: { $regex: `^${fromEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        });

        if (inquiry && content) {
          // Check for duplicate
          const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
          const existing = await PmConversationMessage.findOne({
            inquiryId: inquiry._id,
            sender: "user",
            content: { $regex: content.substring(0, 50) },
            messageTimestamp: { $gte: fiveMinAgo },
          });

          if (!existing) {
            // Create conversation message
            const message = await PmConversationMessage.create({
              inquiryId: inquiry._id,
              type: "email",
              sender: "user",
              channel: "email",
              content: content.substring(0, 5000),
              subject: subject.replace(/^Re:\s*/i, ""),
              recipient: inquiry.email,
              senderName: senderName || fromEmail,
              status: "received",
              messageTimestamp: new Date(date),
              metadata: {
                gmailThreadId: thread.id,
                gmailMessageId: lastMsg.id,
              },
            });

            newMessages.push(message);
            console.log(`[Gmail Service] ✓ Added email from ${fromEmail} for inquiry ${inquiry._id}`);
          }
        }
      }
    }

    return newMessages;
  } catch (err) {
    console.error("[Gmail Service] Error fetching replies:", err);
    return [];
  }
};

/**
 * Start periodic Gmail sync (every 5 minutes)
 */
export const startGmailSync = () => {
  // Initial sync
  fetchGmailReplies().catch((err) => console.error("[Gmail Sync] Error:", err));

  // Set up interval to run every 5 minutes
  setInterval(() => {
    fetchGmailReplies().catch((err) => console.error("[Gmail Sync] Error:", err));
  }, 5 * 60 * 1000);

  console.log("[Gmail Service] Started periodic sync (every 5 minutes)");
};