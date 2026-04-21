
import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../src/models/User.js";

const email = (process.env.BOOTSTRAP_PLATFORM_OWNER_EMAIL || "").trim().toLowerCase();
const password = process.env.BOOTSTRAP_PLATFORM_OWNER_PASSWORD || "";
const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/hornvin_users";

async function main() {
  if (!email || !password) {
    console.error(
      "Missing env: set BOOTSTRAP_PLATFORM_OWNER_EMAIL and BOOTSTRAP_PLATFORM_OWNER_PASSWORD in .env"
    );
    process.exit(1);
  }

  await mongoose.connect(uri);

  const owner = await User.findOne({ isPlatformOwner: true });
  if (owner) {
    console.log("Hornvin company (Super Admin) already present:", owner.email || owner.id, "— nothing to do.");
    await mongoose.disconnect();
    process.exit(0);
  }

  const existing = await User.findOne({ email });
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({
      email,
      passwordHash,
      role: "company",
      name: "Platform Owner",
      businessName: "Platform",
      isPlatformOwner: true,
      status: "approved",
      emailVerified: true,
      mustChangePassword: false,
      permissions: { canAddProducts: true, canPlaceOrders: true, canSell: true },
    });
    console.log("Created Hornvin company / Super Admin (platform owner):", email);
    await mongoose.disconnect();
    process.exit(0);
  }

  if (existing.role !== "company") {
    console.error(
      `Email ${email} is already registered as role "${existing.role}". Use another email or fix the account in MongoDB.`
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  existing.isPlatformOwner = true;
  existing.status = "approved";
  existing.emailVerified = true;
  const passwordHash = await bcrypt.hash(password, 10);
  existing.passwordHash = passwordHash;
  existing.mustChangePassword = false;
  await existing.save();
  console.log("Promoted existing Hornvin company user to Super Admin and reset password:", email);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
