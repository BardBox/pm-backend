/**
 * Reset PM Admin User Password
 *
 * Usage:
 *   node src/seed/resetAdminPassword.js <email> <newPassword>
 *
 * Example:
 *   node src/seed/resetAdminPassword.js admin@bizcivitas.com Admin@123
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import dns from "dns";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { PmAdminUser } from "../models/pmAdminUser.model.js";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const [email, newPassword] = process.argv.slice(2);

if (!email || !newPassword) {
  console.error("Usage: node src/seed/resetAdminPassword.js <email> <newPassword>");
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 30000,
  family: 4,
});
console.log("MongoDB connected");

const user = await PmAdminUser.findOne({ email: email.toLowerCase().trim() });

if (!user) {
  console.error(`No admin user found with email: ${email}`);
  console.log("\nExisting admin users:");
  const all = await PmAdminUser.find({}, "email name isActive");
  all.forEach((u) => console.log(`  - ${u.email} (${u.name}) active=${u.isActive}`));
  await mongoose.disconnect();
  process.exit(1);
}

user.password = newPassword;
await user.save(); // pre-save hook will bcrypt hash it

console.log(`✅ Password reset for: ${user.email} (${user.name})`);

await mongoose.disconnect();
