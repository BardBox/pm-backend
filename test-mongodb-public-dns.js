import mongoose from "mongoose";
import dns from "dns";
import { promisify } from "util";

// Use Google's public DNS (8.8.8.8) as fallback
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const resolveSrv = promisify(dns.resolveSrv);
const resolve4 = promisify(dns.resolve4);

const MONGO_URI = "mongodb+srv://bardboxllp_db_user:bardboxllp123@cluster0.wvbexul.mongodb.net/bizcivitas-pm";

console.log("🧪 MongoDB Connection Testing Script (With Public DNS)\n");
console.log("=" .repeat(50));

// Test 1: DNS Resolution with Public DNS
console.log("\n1️⃣  Testing DNS SRV Resolution (Using 8.8.8.8)...");
console.log(`   Hostname: _mongodb._tcp.cluster0.wvbexul.mongodb.net`);

try {
  const srvRecords = await resolveSrv("_mongodb._tcp.cluster0.wvbexul.mongodb.net");
  console.log("   ✅ SRV Records Found:");
  srvRecords.forEach((record) => {
    console.log(`      - ${record.name}:${record.port} (priority: ${record.priority})`);
  });
} catch (err) {
  console.log("   ❌ SRV Resolution Failed:", err.message);
}

// Test 2: Standard DNS A Record
console.log("\n2️⃣  Testing Standard DNS A Record (Using 8.8.8.8)...");
console.log(`   Hostname: cluster0.wvbexul.mongodb.net`);

try {
  const aRecords = await resolve4("cluster0.wvbexul.mongodb.net");
  console.log("   ✅ A Records Found:", aRecords);
} catch (err) {
  console.log("   ❌ A Record Resolution Failed:", err.message);
}

// Test 3: MongoDB Connection
console.log("\n3️⃣  Testing MongoDB Connection...");
console.log(`   URI: ${MONGO_URI}`);
console.log("   Attempting to connect...\n");

const mongoOptions = {
  serverSelectionTimeoutMS: 30000,
  maxPoolSize: 10,
  family: 4, // Try IPv4 only
};

try {
  const connectionInstance = await mongoose.connect(MONGO_URI, mongoOptions);

  console.log("   ✅ MongoDB Connected Successfully!");
  console.log(`   Host: ${connectionInstance.connection.host}`);
  console.log(`   Database: ${connectionInstance.connection.name}`);
  console.log(`   State: ${connectionInstance.connection.readyState === 1 ? "Connected" : "Disconnected"}`);

  // Test 4: Ping MongoDB
  console.log("\n4️⃣  Testing MongoDB Ping...");
  const pingResult = await mongoose.connection.db.command({ ping: 1 });
  console.log("   ✅ Ping Response:", pingResult);

  // Disconnect
  await mongoose.disconnect();
  console.log("\n✨ All tests passed! MongoDB connection is working.");
  process.exit(0);
} catch (err) {
  console.log("   ❌ MongoDB Connection Failed!");
  console.log(`   Error Code: ${err.code}`);
  console.log(`   Error Message: ${err.message}`);
  console.log(`   Syscall: ${err.syscall}`);
  console.log(`   Hostname: ${err.hostname}`);
  console.error("\n   Full Error:");
  console.error(err);
  process.exit(1);
}
