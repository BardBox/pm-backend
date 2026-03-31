import axios from "axios";
import { google } from "googleapis";
import { PmConversationMessage } from "../models/pmConversationMessage.model.js";
import { PmInquiry } from "../models/pmInquiry.model.js";

// OAuth2 client — created lazily so env vars are read at call time, not import time
const getOAuthClient = () => {
  const client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
  if (process.env.GMAIL_REFRESH_TOKEN) {
    client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  }
  return client;
};

/**
 * Get authorization URL for Gmail
 */
export const getGmailAuthUrl = () => {
  const scopes = ["https://www.googleapis.com/auth/gmail.readonly"];
  return getOAuthClient().generateAuthUrl({
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
    const { tokens } = await getOAuthClient().getToken(code);
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
    // Check if we have credentials
    if (!process.env.GMAIL_REFRESH_TOKEN) {
      console.warn("[Gmail Service] No refresh token configured");
      return [];
    }

    const oauth2Client = getOAuthClient();
    const gmail = google.gmail("v1");

    // Get email threads from last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const query = `after:${Math.floor(sevenDaysAgo.getTime() / 1000)}`;

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

      // Process ALL messages in thread, skip ones sent by us
      const ourEmail = (process.env.RESEND_FROM_EMAIL || process.env.CLIENT_EMAIL || "").toLowerCase().trim();

      for (const msg of messages) {
        const headers = msg.payload.headers;

        const from = headers.find((h) => h.name === "From")?.value || "";
        const subject = headers.find((h) => h.name === "Subject")?.value || "";
        const date = headers.find((h) => h.name === "Date")?.value || new Date().toISOString();

        // Extract email address from "Name <email@domain.com>" format
        const emailMatch = from.match(/<([^>]+)>/);
        const fromEmail = (emailMatch ? emailMatch[1] : from).toLowerCase().trim();
        const senderName = from.replace(/<[^>]+>/, "").trim();

        console.log(`[Gmail Debug] Message from: ${fromEmail}`);

        // Skip emails sent by us
        if (ourEmail && fromEmail === ourEmail) {
          console.log(`[Gmail Debug] Skipping our own email: ${fromEmail}`);
          continue;
        }

        // Get email body
        let content = "";
        if (msg.payload.parts) {
          const textPart = msg.payload.parts.find((p) => p.mimeType === "text/plain");
          if (textPart && textPart.body.data) {
            content = Buffer.from(textPart.body.data, "base64").toString("utf8");
          }
        } else if (msg.payload.body?.data) {
          content = Buffer.from(msg.payload.body.data, "base64").toString("utf8");
        }

        if (!content) continue;

        // Find most recent inquiry by email
        const inquiry = await PmInquiry.findOne({
          email: { $regex: `^${fromEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        }).sort({ createdAt: -1 });

        if (!inquiry) {
          console.log(`[Gmail Service] No inquiry found for ${fromEmail} — skipping`);
          continue;
        }

        // Check for duplicate by gmailMessageId
        const existing = await PmConversationMessage.findOne({
          "metadata.gmailMessageId": msg.id,
        });

        if (!existing) {
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
              gmailMessageId: msg.id,
            },
          });

          newMessages.push(message);
          console.log(`[Gmail Service] ✓ Added reply from ${fromEmail} for inquiry ${inquiry._id}`);
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