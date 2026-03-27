import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
const envPath = path.resolve(__dirname, '../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('Error loading .env file:', result.error);
  process.exit(1);
}

// Import modules after dotenv
import app from './app.js';
import connectDb from './db/index.js';

const PORT = process.env.PORT || 8090;

connectDb()
  .then(() => {
    app.on('error', (error) => {
      console.error('Server error:', error);
    });
    app.listen(PORT, () => {
      console.log(`PM Backend is running on port: ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Database connection error:', error);
    process.exit(1);
  });
