import mongoose from "mongoose";
import { dbName } from "../constants.js";

let isConnected = false;

const connectDb = async () => {
  if (isConnected) {
    console.log("MongoDB already connected. Skipping reinit.");
    return;
  }

  console.time("MongoDB Connection");

  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not set");
    }

    let connectionUri = process.env.MONGO_URI;
    try {
      const parsed = new URL(process.env.MONGO_URI);
      // If DB name already present in URI path, don't append dbName again
      if (!parsed.pathname || parsed.pathname === "/") {
        connectionUri = `${process.env.MONGO_URI}/${dbName}`;
      }
    } catch {
      // If URL parsing fails, fall back to appending dbName
      connectionUri = `${process.env.MONGO_URI}/${dbName}`;
    }

    const connectionInstance = await mongoose.connect(connectionUri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    });

    isConnected = true;
    console.timeEnd("MongoDB Connection");
    console.log(`MongoDB connected at host: ${connectionInstance.connection.host}`);

    // Keep-alive ping every 5 minutes
    setInterval(() => {
      mongoose.connection.db.command({ ping: 1 });
      console.log("Pinged MongoDB to keep cluster awake.");
    }, 5 * 60 * 1000);

  } catch (err) {
    console.timeEnd("MongoDB Connection");
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  }
};

export default connectDb;
