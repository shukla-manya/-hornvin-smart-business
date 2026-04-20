import "dotenv/config";
import { connectDb, disconnectDb } from "./config/db.js";
import { createApp, runStartupMigrations } from "./createApp.js";

const PORT = Number(process.env.PORT || 4000);
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/vello";

if (!process.env.JWT_SECRET) {
  console.warn("Warning: JWT_SECRET not set; using insecure default for local dev only");
  process.env.JWT_SECRET = "dev-insecure-secret-change-me";
}

const { app, httpServer } = createApp();

await connectDb(MONGODB_URI);
await runStartupMigrations();

httpServer.listen(PORT, () => {
  console.log(`API + Socket listening on http://localhost:${PORT}`);
});

async function shutdown(signal) {
  console.log(`${signal} received, closing…`);
  await new Promise((resolve) => httpServer.close(resolve));
  await disconnectDb();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
