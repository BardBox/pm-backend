import { getGmailAuthUrl, handleGmailCallback, fetchGmailReplies, startGmailSync } from "../services/gmailService.js";

/**
 * GET /pm/gmail/auth
 * Redirect user to Gmail OAuth consent screen
 */
export const initiateGmailAuth = async (req, res) => {
  try {
    const authUrl = getGmailAuthUrl();
    console.log("[Gmail Auth] Generated auth URL");
    res.json({ authUrl });
  } catch (err) {
    console.error("[Gmail Auth] Error:", err);
    res.status(500).json({ error: "Failed to initiate auth" });
  }
};

/**
 * POST /pm/gmail/callback
 * Handle OAuth callback and store refresh token
 */
export const gmailCallback = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Missing authorization code" });
    }

    const refreshToken = await handleGmailCallback(code);

    console.log("[Gmail Auth] ✓ Got refresh token. Add this to .env:");
    console.log(`GMAIL_REFRESH_TOKEN=${refreshToken}`);

    res.json({
      success: true,
      message: "Authorization successful! Add the refresh token to your .env",
      refreshToken,
    });
  } catch (err) {
    console.error("[Gmail Auth] Callback error:", err);
    res.status(500).json({ error: "Failed to get authorization" });
  }
};

/**
 * POST /pm/gmail/sync
 * Manually trigger Gmail sync
 */
export const manualGmailSync = async (req, res) => {
  try {
    console.log("[Gmail] Starting manual sync...");
    const newMessages = await fetchGmailReplies();

    res.json({
      success: true,
      message: `Synced ${newMessages.length} new messages from Gmail`,
      messagesAdded: newMessages.length,
    });
  } catch (err) {
    console.error("[Gmail] Sync error:", err);
    res.status(500).json({ error: "Failed to sync Gmail" });
  }
};

/**
 * POST /pm/gmail/start-sync
 * Start automatic Gmail sync
 */
export const startAutoGmailSync = async (req, res) => {
  try {
    startGmailSync();
    res.json({ success: true, message: "Gmail auto-sync started (every 5 minutes)" });
  } catch (err) {
    console.error("[Gmail] Start sync error:", err);
    res.status(500).json({ error: "Failed to start sync" });
  }
};