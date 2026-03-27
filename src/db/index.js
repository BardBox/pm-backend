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
    const connectionInstance = await mongoose.connect(`${process.env.MONGO_URI}/${dbName}`, {
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
