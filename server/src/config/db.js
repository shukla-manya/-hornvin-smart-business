import mongoose from "mongoose";

export async function connectDb(uri) {
  mongoose.set("strictQuery", true);

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err.message);
  });
  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected");
  });

  await mongoose.connect(uri);
  console.log("MongoDB connected:", mongoose.connection.name);
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
