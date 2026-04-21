import express from "express";
import cors from "cors";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";
import { authRouter } from "./routes/auth.js";
import { productsRouter } from "./routes/products.js";
import { ordersRouter } from "./routes/orders.js";
import { chatRouter } from "./routes/chat.js";
import { invoicesRouter } from "./routes/invoices.js";
import { dealersRouter } from "./routes/dealers.js";
import { usersRouter } from "./routes/users.js";
import { paymentsRouter } from "./routes/payments.js";
import { locationsRouter } from "./routes/locations.js";
import { dealerLocatorRouter } from "./routes/dealerLocator.js";
import { notificationsRouter } from "./routes/notifications.js";
import { wishlistRouter } from "./routes/wishlist.js";
import { adminRouter } from "./routes/admin.js";
import { garageRouter } from "./routes/garage.js";
import { rewardsRouter } from "./routes/rewards.js";
import { partFinderRouter } from "./routes/partFinder.js";
import { ChatRoom } from "./models/ChatRoom.js";
import { Product } from "./models/Product.js";
import { User, getAccountAccessDenial } from "./models/User.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadOpenApiSpec() {
  const path = join(__dirname, "../docs/openapi.yaml");
  return YAML.parse(readFileSync(path, "utf8"));
}

/**
 * Builds Express + Socket.IO (no DB connect, no listen). Used by `index.js` and API tests.
 */
export function createApp() {
  const app = express();
  app.use(cors());
  app.use("/api/part-finder", express.json({ limit: "10mb" }), partFinderRouter);
  /** Large enough for retail profile photos (data URLs) on PATCH /api/auth/profile. */
  app.use(express.json({ limit: "8mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.get("/", (_req, res) => {
    res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Vello API</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0f1419; color: #e8eef4; }
    main { text-align: center; padding: 2rem; max-width: 28rem; }
    a { color: #7ec8ff; }
    .muted { color: #9aa7b4; font-size: 0.95rem; margin-top: 1.5rem; }
  </style>
</head>
<body>
  <main>
    <h1>Vello Trade API</h1>
    <p><a href="/api-docs">Open API documentation (Swagger UI)</a></p>
    <p class="muted">Made with  by Manya Shukla</p>
  </main>
</body>
</html>`);
  });

  try {
    const openApiDocument = loadOpenApiSpec();
    app.get("/openapi.json", (_req, res) => res.json(openApiDocument));
    app.use(
      "/api-docs",
      swaggerUi.serve,
      swaggerUi.setup(openApiDocument, {
        explorer: true,
        docExpansion: "list",
        defaultModelsExpandDepth: 4,
        defaultModelExpandDepth: 4,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
      })
    );
  } catch (e) {
    console.warn("OpenAPI / Swagger UI not mounted:", e.message);
  }

  app.use("/api/auth", authRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/invoices", invoicesRouter);
  app.use("/api/dealers", dealersRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/locations", locationsRouter);
  app.use("/api/dealer-locator", dealerLocatorRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/wishlist", wishlistRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/garage", garageRouter);
  app.use("/api/rewards", rewardsRouter);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  });

  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Unauthorized"));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.sub).select("status mustChangePassword");
      if (!user || getAccountAccessDenial(user) || user.mustChangePassword) return next(new Error("Unauthorized"));
      socket.userId = payload.sub;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.userId}`);

    socket.on("room:join", async (roomId) => {
      if (!roomId || !mongoose.isValidObjectId(roomId)) return;
      const room = await ChatRoom.findById(roomId);
      if (!room) return;
      if (!room.participants.some((p) => p.equals(socket.userId))) return;
      socket.join(String(roomId));
    });

    socket.on("chat:typing", async (payload) => {
      const roomId = payload?.roomId;
      const typing = Boolean(payload?.typing);
      if (!roomId || !mongoose.isValidObjectId(roomId)) return;
      const room = await ChatRoom.findById(roomId);
      if (!room) return;
      if (!room.participants.some((p) => p.equals(socket.userId))) return;
      socket.to(String(roomId)).emit("chat:typing", {
        userId: String(socket.userId),
        typing,
      });
    });

    socket.on("disconnect", () => {});
  });

  app.set("io", io);

  return { app, httpServer, io };
}

export async function runStartupMigrations() {
  try {
    const users = await User.updateMany(
      { $or: [{ status: { $exists: false } }, { status: null }] },
      { $set: { status: "approved" } }
    );
    if (users.modifiedCount) console.log("Users migrated: default status → approved", users.modifiedCount);
  } catch (e) {
    console.warn("User status migration skipped:", e.message);
  }
  try {
    const companies = await User.find({ role: "company" }).sort({ createdAt: 1 }).select("_id").lean();
    if (companies.length > 1) {
      const keepId = companies[0]._id;
      for (let i = 1; i < companies.length; i++) {
        await User.updateOne(
          { _id: companies[i]._id },
          { $set: { role: "distributor", isPlatformOwner: false, companyId: keepId } }
        );
      }
      console.warn(
        "Users migrated: demoted extra `company` accounts to distributor under the Hornvin root",
        companies.length - 1
      );
    }
    await User.updateMany({ role: "company" }, { $set: { isPlatformOwner: true } });
    await User.updateMany({ role: { $ne: "company" }, isPlatformOwner: true }, { $set: { isPlatformOwner: false } });
  } catch (e) {
    console.warn("Single-root company migration skipped:", e.message);
  }
  try {
    const r = await Product.updateMany(
      { $or: [{ sellerId: { $exists: false } }, { sellerId: null }] },
      [{ $set: { sellerId: "$companyId" } }]
    );
    if (r.modifiedCount) console.log("Products migrated: sellerId from companyId", r.modifiedCount);
  } catch (e) {
    console.warn("Product sellerId migration skipped:", e.message);
  }
}
