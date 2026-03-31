import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file (optional — on Render, env vars are injected directly)
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

// Import modules after dotenv
import app from './app.js';
import connectDb from './db/index.js';
import { startBackgroundSync } from './services/backgroundSync.js';
import { startGmailSync } from './services/gmailService.js';

const PORT = process.env.PORT || 8090;

connectDb()
  .then(() => {
    app.on('error', (error) => {
      console.error('Server error:', error);
    });
    app.listen(PORT, () => {
      console.log(`PM Backend is running on port: ${PORT}`);
      startBackgroundSync();
      // Start Gmail sync only if credentials are configured
      if (process.env.GMAIL_REFRESH_TOKEN) {
        startGmailSync();
      } else {
        console.log('[Gmail] No GMAIL_REFRESH_TOKEN found — skipping auto-sync. Visit GET /pm/gmail/auth to connect.');
      }
    });
  })
  .catch((error) => {
    console.error('Database connection error:', error);
    process.exit(1);
  });
