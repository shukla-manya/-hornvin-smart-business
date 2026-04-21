import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { connectDb, disconnectDb } from "../src/config/db.js";
import { createApp, runStartupMigrations } from "../src/createApp.js";
import { User } from "../src/models/User.js";
import { GarageInventoryItem } from "../src/models/GarageInventoryItem.js";
import { Product } from "../src/models/Product.js";
import { Coupon } from "../src/models/Coupon.js";
import { CouponRedemption } from "../src/models/CouponRedemption.js";

process.env.JWT_SECRET = "integration-test-jwt-secret-do-not-use-elsewhere";
process.env.NODE_ENV = "test";
/** Auto-approve new users so register returns a JWT (production uses pending + admin approval). */
process.env.SKIP_USER_APPROVAL = "1";

let mongo;
let app;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDb(mongo.getUri());
  ({ app } = createApp());
  await runStartupMigrations();
});

after(async () => {
  await disconnectDb();
  if (mongo) await mongo.stop();
});

/** Fields so approved retail passes `computeNeedsProfileSetup` in integration tests. */
function retailOnboardedProfile(overrides = {}) {
  return {
    name: "Garage Owner",
    businessName: "Test Garage",
    address: "1 Industrial Road",
    addressLandmark: "Near highway",
    stateRegion: "MH",
    businessType: "independent",
    gstNumber: "",
    shopPhotoUrl: "https://example.com/tests/garage-shop.jpg",
    profilePhotoUrl: "https://example.com/tests/garage-owner.jpg",
    ...overrides,
  };
}

test("GET /health returns ok", async () => {
  const res = await request(app).get("/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});

test("GET /api/auth/roles returns registerableRoles without distributor by default", async () => {
  const res = await request(app).get("/api/auth/roles");
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.registerableRoles));
  const ids = res.body.registerableRoles.map((r) => r.id);
  assert.ok(ids.includes("end_user"));
  assert.ok(!ids.includes("distributor"));
  assert.equal(res.body.policy?.distributorSelfRegisterAllowed, false);
  assert.equal(typeof res.body.policy?.companyRootExists, "boolean");
  assert.equal(typeof res.body.policy?.hornvinRootSignupOpen, "boolean");
});

test("login flow: register + login + me (phone — no email OTP)", async () => {
  const phone = `+1555${String(Date.now()).slice(-8)}`;
  const reg = await request(app).post("/api/auth/register").send({
    phone,
    password: "secret12",
    role: "end_user",
    name: "Flow User",
    businessName: "Flow User Motors",
  });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  assert.ok(reg.body.token);

  const login = await request(app).post("/api/auth/login").send({
    phone,
    password: "secret12",
  });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.ok(login.body.token);

  const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${login.body.token}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.phone, phone);
  assert.equal(me.body.user.lifecycleStatus, "active");
});

test("orders + chat API responses (company seller, end_user buyer)", async () => {
  const sellerPhone = `+1556${String(Date.now()).slice(-8)}`;
  const buyerPhone = `+1557${String(Date.now()).slice(-8)}`;

  await User.create({
    phone: sellerPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
    isPlatformOwner: true,
    name: "Co Orders",
    location: { type: "Point", coordinates: [0, 0] },
  });
  const sellerLogin = await request(app).post("/api/auth/login").send({ phone: sellerPhone, password: "secret12" });
  assert.equal(sellerLogin.status, 200, JSON.stringify(sellerLogin.body));
  const tokenS = sellerLogin.body.token;
  const sellerId = sellerLogin.body.user.id;

  const buyer = await request(app).post("/api/auth/register").send({
    phone: buyerPhone,
    password: "secret12",
    role: "end_user",
    name: "Buyer Orders",
    businessName: "Buyer Orders LLC",
  });
  assert.equal(buyer.status, 201);
  const tokenB = buyer.body.token;

  const prod = await request(app).post("/api/products").set("Authorization", `Bearer ${tokenS}`).send({
    name: "Oil filter",
    category: "Parts",
    price: 150,
    quantity: 20,
  });
  assert.equal(prod.status, 201, prod.body?.error || "");
  const productId = prod.body.product._id;

  const ord = await request(app).post("/api/orders").set("Authorization", `Bearer ${tokenB}`).send({
    sellerId,
    items: [{ productId, quantity: 1 }],
  });
  assert.equal(ord.status, 201, ord.body?.error || "");
  assert.ok(ord.body.order._id);
  assert.equal(ord.body.order.status, "pending");

  const orderId = ord.body.order._id;
  const patch = await request(app).patch(`/api/orders/${orderId}/status`).set("Authorization", `Bearer ${tokenS}`).send({ status: "confirmed" });
  assert.equal(patch.status, 200);
  assert.equal(patch.body.order.status, "confirmed");

  const room = await request(app).post("/api/chat/rooms").set("Authorization", `Bearer ${tokenB}`).send({ withUserId: sellerId });
  assert.equal(room.status, 200, room.body?.error || "");
  const roomId = room.body.room._id;

  const msgs = await request(app).get(`/api/chat/rooms/${roomId}/messages`).set("Authorization", `Bearer ${tokenB}`);
  assert.equal(msgs.status, 200);
  assert.ok(Array.isArray(msgs.body.messages));

  const send = await request(app).post(`/api/chat/rooms/${roomId}/messages`).set("Authorization", `Bearer ${tokenB}`).send({ body: "Integration test message" });
  assert.equal(send.status, 201);
  assert.ok(send.body.message._id);
  assert.equal(send.body.message.body, "Integration test message");
});

test("register without SKIP_USER_APPROVAL: company blocked without bootstrap; end_user phone is approved", async () => {
  const prev = process.env.SKIP_USER_APPROVAL;
  delete process.env.SKIP_USER_APPROVAL;
  try {
    const phoneEnd = `+1560${String(Date.now()).slice(-8)}`;
    const regEnd = await request(app).post("/api/auth/register").send({
      phone: phoneEnd,
      password: "secret12",
      role: "end_user",
      name: "Buyer no skip",
      businessName: "Buyer no skip Garage",
    });
    assert.equal(regEnd.status, 201, JSON.stringify(regEnd.body));
    assert.ok(regEnd.body.token);
    assert.equal(regEnd.body.user.status, "approved");

    const regCo = await request(app)
      .post("/api/auth/register")
      .send({
        email: `blocked-co-${Date.now()}@example.com`,
        phone: `+1577${String(Date.now()).slice(-8)}`,
        password: "secret12",
        role: "company",
        name: "No bootstrap",
        businessName: "No Bootstrap Co",
      });
    assert.equal(regCo.status, 403, JSON.stringify(regCo.body));
    assert.ok(
      regCo.body.code === "COMPANY_REGISTER_BOOTSTRAP_EMAIL_ONLY" || regCo.body.code === "PLATFORM_ROOT_EXISTS",
      regCo.body.code
    );
  } finally {
    if (prev !== undefined) process.env.SKIP_USER_APPROVAL = prev;
    else process.env.SKIP_USER_APPROVAL = "1";
  }
});

test("end_user email: verify registration OTP then login mail OTP (no admin approval)", async () => {
  const prev = process.env.SKIP_USER_APPROVAL;
  delete process.env.SKIP_USER_APPROVAL;
  try {
    const em = `buyer-${Date.now()}@example.com`;
    const buyerPhone = `+1877${String(Date.now()).slice(-8)}`;
    const reg = await request(app).post("/api/auth/register").send({
      email: em,
      phone: buyerPhone,
      password: "secret12",
      role: "end_user",
      name: "Email Buyer",
      businessName: "Email Buyer Inc",
    });
    assert.equal(reg.status, 201, JSON.stringify(reg.body));
    assert.ok(!reg.body.token);
    assert.equal(reg.body.needsEmailVerification, true);
    assert.ok(reg.body._testOnlyEmailCode);
    assert.equal(reg.body.user.status, "approved");
    assert.equal(reg.body.user.emailVerified, false);

    const blocked = await request(app).post("/api/auth/login").send({ email: em, password: "secret12" });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.code, "EMAIL_NOT_VERIFIED");

    const verify = await request(app)
      .post("/api/auth/register/verify-email")
      .send({ email: em, otpCode: reg.body._testOnlyEmailCode });
    assert.equal(verify.status, 200, JSON.stringify(verify.body));
    assert.ok(verify.body.token);

    const step1 = await request(app).post("/api/auth/login").send({ email: em, password: "secret12" });
    assert.equal(step1.status, 200, JSON.stringify(step1.body));
    assert.equal(step1.body.needsOtp, true);
    assert.ok(step1.body._testOnlyEmailCode);
    assert.ok(step1.body._testOnlyPhoneCode);

    const step2 = await request(app)
      .post("/api/auth/login")
      .send({
        email: em,
        password: "secret12",
        emailOtp: step1.body._testOnlyEmailCode,
        phoneOtp: step1.body._testOnlyPhoneCode,
      });
    assert.equal(step2.status, 200, JSON.stringify(step2.body));
    assert.ok(step2.body.token);
  } finally {
    if (prev !== undefined) process.env.SKIP_USER_APPROVAL = prev;
    else process.env.SKIP_USER_APPROVAL = "1";
  }
});

test("pending user cannot log in with phone + password", async () => {
  const phone = `+1561${String(Date.now()).slice(-8)}`;
  await User.create({
    phone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "end_user",
    status: "pending",
  });
  const login = await request(app).post("/api/auth/login").send({ phone, password: "secret12" });
  assert.equal(login.status, 403);
  assert.equal(login.body.code, "ACCOUNT_PENDING");
});

test("super admin analytics OK; non-owner gets 403 on /api/admin", async () => {
  const ownerPhone = `+1570${String(Date.now()).slice(-8)}`;
  const owner = await User.create({
    phone: ownerPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
    isPlatformOwner: true,
  });
  const regularPhone = `+1571${String(Date.now()).slice(-8)}`;
  await User.create({
    phone: regularPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "distributor",
    status: "approved",
    companyId: owner._id,
  });
  const regularLogin = await request(app).post("/api/auth/login").send({ phone: regularPhone, password: "secret12" });
  assert.equal(regularLogin.status, 200, JSON.stringify(regularLogin.body));
  const regularToken = regularLogin.body.token;

  const ownerLogin = await request(app).post("/api/auth/login").send({ phone: ownerPhone, password: "secret12" });
  assert.equal(ownerLogin.status, 200, JSON.stringify(ownerLogin.body));
  const adminToken = ownerLogin.body.token;

  const ok = await request(app).get("/api/admin/analytics/summary").set("Authorization", `Bearer ${adminToken}`);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(typeof ok.body.totalRevenue, "number");

  const forbid = await request(app).get("/api/admin/analytics/summary").set("Authorization", `Bearer ${regularToken}`);
  assert.equal(forbid.status, 403);
  assert.equal(forbid.body.code, "HORNVIN_SUPER_ADMIN_ONLY");

  const dash = await request(app).get("/api/admin/dashboard").set("Authorization", `Bearer ${adminToken}`);
  assert.equal(dash.status, 200);
  assert.equal(typeof dash.body.totalGarages, "number");
  assert.equal(typeof dash.body.totalDistributors, "number");
  assert.ok(Array.isArray(dash.body.recentOrders));

  const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${adminToken}`);
  const uid = me.body.user.id;
  const detail = await request(app).get(`/api/admin/users/${uid}`).set("Authorization", `Bearer ${adminToken}`);
  assert.equal(detail.status, 200);
  assert.ok(detail.body.user);
  assert.ok(detail.body.stats);
});

test("Super Admin with email logs in with password only (no mail OTP step)", async () => {
  const em = `owner-${Date.now()}@example.com`;
  await User.create({
    email: em,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
    isPlatformOwner: true,
    emailVerified: true,
  });
  const login = await request(app).post("/api/auth/login").send({ email: em, password: "secret12" });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.ok(login.body.token);
  assert.equal(login.body.user.isPlatformOwner, true);
  assert.ok(!login.body.needsOtp);
});

test("cannot self-register as distributor without ALLOW_DOWNSTREAM_SELF_REGISTER", async () => {
  const prev = process.env.ALLOW_DOWNSTREAM_SELF_REGISTER;
  delete process.env.ALLOW_DOWNSTREAM_SELF_REGISTER;
  try {
    const phone = `+1580${String(Date.now()).slice(-8)}`;
    const reg = await request(app).post("/api/auth/register").send({
      phone,
      password: "secret12",
      role: "distributor",
      name: "Bad",
      businessName: "Bad Distributor LLC",
    });
    assert.equal(reg.status, 403);
    assert.equal(reg.body.code, "ROLE_NOT_SELF_SIGNUP");
  } finally {
    if (prev !== undefined) process.env.ALLOW_DOWNSTREAM_SELF_REGISTER = prev;
  }
});

test("retail self-register is always pending without token", async () => {
  const phone = `+1590${String(Date.now()).slice(-8)}`;
  const reg = await request(app).post("/api/auth/register").send({
    phone,
    password: "secret12",
    role: "retail",
    name: "Self Retail",
    businessName: "Self Retail Garage",
  });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  assert.ok(!reg.body.token);
  assert.equal(reg.body.pendingApproval, true);
  assert.equal(reg.body.user.status, "pending");
  assert.equal(reg.body.user.mustChangePassword, false);
});

test("distributor creates retail and lists my-retail", async () => {
  const companyPhone = `+1582${String(Date.now()).slice(-8)}`;
  const company = await User.create({
    phone: companyPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
  });
  const distPhone = `+1583${String(Date.now()).slice(-8)}`;
  const distributor = await User.create({
    phone: distPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "distributor",
    status: "approved",
    companyId: company._id,
  });
  const login = await request(app).post("/api/auth/login").send({ phone: distPhone, password: "secret12" });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  const token = login.body.token;

  const retailPhone = `+1584${String(Date.now()).slice(-8)}`;
  const create = await request(app)
    .post("/api/users/retail")
    .set("Authorization", `Bearer ${token}`)
    .send({
      phone: retailPhone,
      password: "secret12",
      name: "Shop",
      businessName: "Garage 1",
    });
  assert.equal(create.status, 201, JSON.stringify(create.body));
  assert.equal(create.body.user.role, "retail");
  const retailDoc = await User.findOne({ phone: retailPhone });
  assert.equal(String(retailDoc.createdBy), String(distributor._id));

  const list = await request(app).get("/api/users/my-retail").set("Authorization", `Bearer ${token}`);
  assert.equal(list.status, 200);
  assert.equal(list.body.retail.length, 1);
  assert.equal(list.body.retail[0].phone, retailPhone);
});

test("retail created by distributor must change password then can use API", async () => {
  const companyPhone = `+1592${String(Date.now()).slice(-8)}`;
  const company = await User.create({
    phone: companyPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
  });
  const distPhone = `+1593${String(Date.now()).slice(-8)}`;
  await User.create({
    phone: distPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "distributor",
    status: "approved",
    companyId: company._id,
  });
  const dLogin = await request(app).post("/api/auth/login").send({ phone: distPhone, password: "secret12" });
  const dToken = dLogin.body.token;

  const retailPhone = `+1594${String(Date.now()).slice(-8)}`;
  const create = await request(app)
    .post("/api/users/retail")
    .set("Authorization", `Bearer ${dToken}`)
    .send({ phone: retailPhone, password: "temp1234", name: "Shop", businessName: "Garage" });
  assert.equal(create.status, 201);
  assert.equal(create.body.user.mustChangePassword, true);

  const rLogin = await request(app).post("/api/auth/login").send({ phone: retailPhone, password: "temp1234" });
  assert.equal(rLogin.status, 200);
  const rToken = rLogin.body.token;
  assert.equal(rLogin.body.user.mustChangePassword, true);

  const blocked = await request(app).get("/api/orders").set("Authorization", `Bearer ${rToken}`);
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.code, "MUST_CHANGE_PASSWORD");

  const pwd = await request(app)
    .patch("/api/auth/password")
    .set("Authorization", `Bearer ${rToken}`)
    .send({ currentPassword: "temp1234", newPassword: "secret99xx" });
  assert.equal(pwd.status, 200, JSON.stringify(pwd.body));
  assert.equal(pwd.body.user.mustChangePassword, false);

  const ok = await request(app).get("/api/orders").set("Authorization", `Bearer ${rToken}`);
  assert.equal(ok.status, 200);
});

test("retail created by distributor with email skips login mail OTP until password changed", async () => {
  const companyPhone = `+1692${String(Date.now()).slice(-8)}`;
  const company = await User.create({
    phone: companyPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
  });
  const distPhone = `+1693${String(Date.now()).slice(-8)}`;
  await User.create({
    phone: distPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "distributor",
    status: "approved",
    companyId: company._id,
  });
  const dLogin = await request(app).post("/api/auth/login").send({ phone: distPhone, password: "secret12" });
  const dToken = dLogin.body.token;

  const em = `retail-prov-${Date.now()}@example.com`;
    const create = await request(app)
    .post("/api/users/retail")
    .set("Authorization", `Bearer ${dToken}`)
    .send({
      email: em,
      phone: `+1578${String(Date.now()).slice(-8)}`,
      password: "temp1234",
      name: "Shop",
      businessName: "Garage",
    });
  assert.equal(create.status, 201, JSON.stringify(create.body));
  assert.equal(create.body.user.mustChangePassword, true);

  const login = await request(app).post("/api/auth/login").send({ email: em, password: "temp1234" });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.ok(login.body.token);
  assert.ok(!login.body.needsOtp);
  assert.equal(login.body.user.mustChangePassword, true);

  const blocked = await request(app).get("/api/orders").set("Authorization", `Bearer ${login.body.token}`);
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.code, "MUST_CHANGE_PASSWORD");
});

test("Super Admin creates distributor with mustChangePassword until password change", async () => {
  const ownerPhone = `+1595${String(Date.now()).slice(-8)}`;
  await User.create({
    phone: ownerPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
    isPlatformOwner: true,
  });
  const ownerLogin = await request(app).post("/api/auth/login").send({ phone: ownerPhone, password: "secret12" });
  assert.equal(ownerLogin.status, 200);
  const adminToken = ownerLogin.body.token;

  const distPhone = `+1596${String(Date.now()).slice(-8)}`;
  const create = await request(app)
    .post("/api/admin/users/distributor")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      phone: distPhone,
      password: "firsttemp9",
      name: "Regional",
    });
  assert.equal(create.status, 201, JSON.stringify(create.body));
  assert.equal(create.body.user.mustChangePassword, true);

  const ownerDoc = await User.findOne({ phone: ownerPhone });
  const distDoc = await User.findOne({ phone: distPhone });
  assert.ok(distDoc.createdBy, "distributor should have createdBy set to Super Admin");
  assert.equal(String(distDoc.createdBy), String(ownerDoc._id));

  const dLogin = await request(app).post("/api/auth/login").send({ phone: distPhone, password: "firsttemp9" });
  assert.equal(dLogin.status, 200, JSON.stringify(dLogin.body));
  assert.equal(dLogin.body.user.mustChangePassword, true);
  const dToken = dLogin.body.token;

  const blocked = await request(app).get("/api/orders").set("Authorization", `Bearer ${dToken}`);
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.code, "MUST_CHANGE_PASSWORD");

  const pwd = await request(app)
    .patch("/api/auth/password")
    .set("Authorization", `Bearer ${dToken}`)
    .send({ currentPassword: "firsttemp9", newPassword: "newpass99aa" });
  assert.equal(pwd.status, 200);
  const ok = await request(app).get("/api/orders").set("Authorization", `Bearer ${dToken}`);
  assert.equal(ok.status, 200);
});

test("retail with companyId can create marketplace listing (POST /api/products)", async () => {
  const company = await User.create({
    phone: `+1930${String(Date.now()).slice(-8)}`,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
    isPlatformOwner: true,
    location: { type: "Point", coordinates: [0, 0] },
  });
  const retailPhone = `+1931${String(Date.now()).slice(-8)}`;
  await User.create({
    phone: retailPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "retail",
    status: "approved",
    companyId: company._id,
    location: { type: "Point", coordinates: [0, 0] },
    ...retailOnboardedProfile(),
  });
  const login = await request(app).post("/api/auth/login").send({ phone: retailPhone, password: "secret12" });
  assert.equal(login.status, 200);
  const token = login.body.token;
  const prod = await request(app)
    .post("/api/products")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Garage-listed wiper",
      category: "Wipers",
      price: 120,
      quantity: 5,
      description: "From retail seller",
    });
  assert.equal(prod.status, 201, JSON.stringify(prod.body));
  assert.equal(prod.body.product.sellerId?._id || prod.body.product.sellerId, login.body.user.id);
});

test("retail: needsGarageServiceSelection until PATCH profile garageServices", async () => {
  const company = await User.create({
    phone: `+1940${String(Date.now()).slice(-8)}`,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
    isPlatformOwner: true,
    location: { type: "Point", coordinates: [0, 0] },
  });
  const retailPhone = `+1941${String(Date.now()).slice(-8)}`;
  await User.create({
    phone: retailPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "retail",
    status: "approved",
    companyId: company._id,
    location: { type: "Point", coordinates: [0, 0] },
    ...retailOnboardedProfile({ name: "Owner", businessName: "Bay One" }),
  });
  const login = await request(app).post("/api/auth/login").send({ phone: retailPhone, password: "secret12" });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.needsGarageServiceSelection, true);
  const token = login.body.token;
  const bad = await request(app)
    .patch("/api/auth/profile")
    .set("Authorization", `Bearer ${token}`)
    .send({ garageServices: ["not_a_real_tag"] });
  assert.equal(bad.status, 400);
  const ok = await request(app)
    .patch("/api/auth/profile")
    .set("Authorization", `Bearer ${token}`)
    .send({ garageServices: ["tyres", "ac"] });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.needsGarageServiceSelection, false);
  assert.deepEqual(ok.body.user.garageServices, ["tyres", "ac"]);
});

test("GET /api/admin/platform describes Hornvin super-admin controls", async () => {
  const ownerPhone = `+1914${String(Date.now()).slice(-8)}`;
  await User.create({
    phone: ownerPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
    isPlatformOwner: true,
    location: { type: "Point", coordinates: [0, 0] },
  });
  const login = await request(app).post("/api/auth/login").send({ phone: ownerPhone, password: "secret12" });
  const res = await request(app).get("/api/admin/platform").set("Authorization", `Bearer ${login.body.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.identity, "hornvin_company_super_admin");
  assert.equal(res.body.singleRoot, true);
  assert.ok(Array.isArray(res.body.controls));
  assert.ok(res.body.controls.some((c) => c.id === "global_catalog"));
});

test("Super Admin POST admin retail rejects foreign companyId; accepts Hornvin companyId", async () => {
  const hornvin = await User.create({
    phone: `+1915${String(Date.now()).slice(-8)}`,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
    isPlatformOwner: true,
    location: { type: "Point", coordinates: [0, 0] },
  });
  const otherCo = await User.create({
    phone: `+1916${String(Date.now()).slice(-8)}`,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
    isPlatformOwner: false,
    location: { type: "Point", coordinates: [0, 0] },
  });
  const distB = await User.create({
    phone: `+1917${String(Date.now()).slice(-8)}`,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "distributor",
    status: "approved",
    companyId: otherCo._id,
    location: { type: "Point", coordinates: [0, 0] },
  });
  const ownerLogin = await request(app).post("/api/auth/login").send({ phone: hornvin.phone, password: "secret12" });
  const bad = await request(app)
    .post("/api/admin/users/retail")
    .set("Authorization", `Bearer ${ownerLogin.body.token}`)
    .send({
      phone: `+1918${String(Date.now()).slice(-8)}`,
      password: "secret12",
      name: "X",
      companyId: String(otherCo._id),
      distributorId: String(distB._id),
    });
  assert.equal(bad.status, 403, JSON.stringify(bad.body));
  assert.equal(bad.body.code, "ADMIN_RETAIL_MUST_USE_HORNVIN_COMPANY");

  const distGood = await User.create({
    phone: `+1919${String(Date.now()).slice(-8)}`,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "distributor",
    status: "approved",
    companyId: hornvin._id,
    location: { type: "Point", coordinates: [0, 0] },
  });
  const ok = await request(app)
    .post("/api/admin/users/retail")
    .set("Authorization", `Bearer ${ownerLogin.body.token}`)
    .send({
      phone: `+1920${String(Date.now()).slice(-8)}`,
      password: "secret12",
      name: "Garage OK",
      companyId: String(hornvin._id),
      distributorId: String(distGood._id),
    });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal(ok.body.user.role, "retail");
});

test("Super Admin approves self-registered retail linked to distributor; retail can log in", async () => {
  const ownerPhone = `+1600${String(Date.now()).slice(-8)}`;
  const owner = await User.create({
    phone: ownerPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
    isPlatformOwner: true,
  });
  const distPhone = `+1601${String(Date.now()).slice(-8)}`;
  const distributor = await User.create({
    phone: distPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "distributor",
    status: "approved",
    companyId: owner._id,
  });
  const retailPhone = `+1602${String(Date.now()).slice(-8)}`;
  const reg = await request(app).post("/api/auth/register").send({
    phone: retailPhone,
    password: "secret12",
    role: "retail",
    name: "Pending Shop",
    businessName: "Pending Shop Ltd",
    companyId: String(owner._id),
    distributorId: String(distributor._id),
  });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  assert.ok(!reg.body.token);
  assert.equal(reg.body.user.status, "pending");

  const ownerLogin = await request(app).post("/api/auth/login").send({ phone: ownerPhone, password: "secret12" });
  assert.equal(ownerLogin.status, 200, JSON.stringify(ownerLogin.body));
  const adminToken = ownerLogin.body.token;

  const retailId = reg.body.user.id;
  const appr = await request(app)
    .patch(`/api/admin/users/${retailId}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ status: "approved" });
  assert.equal(appr.status, 200, JSON.stringify(appr.body));

  const rLogin = await request(app).post("/api/auth/login").send({ phone: retailPhone, password: "secret12" });
  assert.equal(rLogin.status, 200, JSON.stringify(rLogin.body));
  assert.ok(rLogin.body.token);
  assert.equal(rLogin.body.user.lifecycleStatus, "active");
});

test("distributor cannot access Super Admin admin API", async () => {
  const company = await User.create({
    phone: `+1610${String(Date.now()).slice(-8)}`,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
  });
  const dPhone = `+1611${String(Date.now()).slice(-8)}`;
  await User.create({
    phone: dPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "distributor",
    status: "approved",
    companyId: company._id,
  });
  const dLogin = await request(app).post("/api/auth/login").send({ phone: dPhone, password: "secret12" });
  assert.equal(dLogin.status, 200);
  const forbid = await request(app).get("/api/admin/analytics/summary").set("Authorization", `Bearer ${dLogin.body.token}`);
  assert.equal(forbid.status, 403);
  assert.equal(forbid.body.code, "HORNVIN_SUPER_ADMIN_ONLY");
});

test("retail cannot access Super Admin admin API", async () => {
  const retailPhone = `+1620${String(Date.now()).slice(-8)}`;
  await User.create({
    phone: retailPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "retail",
    status: "approved",
    ...retailOnboardedProfile(),
  });
  const login = await request(app).post("/api/auth/login").send({ phone: retailPhone, password: "secret12" });
  assert.equal(login.status, 200);
  const forbid = await request(app).get("/api/admin/analytics/summary").set("Authorization", `Bearer ${login.body.token}`);
  assert.equal(forbid.status, 403);
  assert.equal(forbid.body.code, "HORNVIN_SUPER_ADMIN_ONLY");
});

test("Super Admin approves pending retail scoped by companyId (no distributor)", async () => {
  const ownerPhone = `+1621${String(Date.now()).slice(-8)}`;
  const owner = await User.create({
    phone: ownerPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
    isPlatformOwner: true,
  });
  const retailPhone = `+1622${String(Date.now()).slice(-8)}`;
  const retail = await User.create({
    phone: retailPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "retail",
    status: "pending",
    companyId: owner._id,
    ...retailOnboardedProfile(),
  });

  const ownerLogin = await request(app).post("/api/auth/login").send({ phone: ownerPhone, password: "secret12" });
  assert.equal(ownerLogin.status, 200);
  const adminToken = ownerLogin.body.token;

  const appr = await request(app)
    .patch(`/api/admin/users/${retail._id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ status: "approved" });
  assert.equal(appr.status, 200, JSON.stringify(appr.body));

  const rLogin = await request(app).post("/api/auth/login").send({ phone: retailPhone, password: "secret12" });
  assert.equal(rLogin.status, 200, JSON.stringify(rLogin.body));
  assert.equal(rLogin.body.user.lifecycleStatus, "active");
});

test("RBAC: company cannot place marketplace orders", async () => {
  const hornvin = await User.create({
    phone: `+1630${String(Date.now()).slice(-8)}`,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
    isPlatformOwner: true,
  });
  const retail = await User.create({
    phone: `+1632${String(Date.now()).slice(-8)}`,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "retail",
    status: "approved",
    companyId: hornvin._id,
    ...retailOnboardedProfile(),
  });
  const prod = await Product.create({
    companyId: hornvin._id,
    sellerId: retail._id,
    name: "Wrench",
    category: "Tools",
    price: 5,
    quantity: 10,
  });
  const buyerLogin = await request(app).post("/api/auth/login").send({ phone: hornvin.phone, password: "secret12" });
  assert.equal(buyerLogin.status, 200);
  const ord = await request(app)
    .post("/api/orders")
    .set("Authorization", `Bearer ${buyerLogin.body.token}`)
    .send({
      sellerId: String(retail._id),
      items: [{ productId: String(prod._id), quantity: 1 }],
    });
  assert.equal(ord.status, 403);
  assert.equal(ord.body.code, "MARKETPLACE_ORDER_ROLE");
});

test("RBAC: distributor stock order from linked company catalog succeeds", async () => {
  const companyPhone = `+1633${String(Date.now()).slice(-8)}`;
  const company = await User.create({
    phone: companyPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
  });
  const prod = await Product.create({
    companyId: company._id,
    sellerId: company._id,
    name: "Bulk SKU",
    category: "Parts",
    price: 10,
    quantity: 100,
  });
  const distPhone = `+1634${String(Date.now()).slice(-8)}`;
  await User.create({
    phone: distPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "distributor",
    status: "approved",
    companyId: company._id,
  });
  const dLogin = await request(app).post("/api/auth/login").send({ phone: distPhone, password: "secret12" });
  assert.equal(dLogin.status, 200);
  const ord = await request(app)
    .post("/api/orders")
    .set("Authorization", `Bearer ${dLogin.body.token}`)
    .send({
      sellerId: String(company._id),
      orderChannel: "stock",
      items: [{ productId: String(prod._id), quantity: 2 }],
    });
  assert.equal(ord.status, 201, JSON.stringify(ord.body));
});

test("RBAC: end_user cannot place stock-channel orders", async () => {
  const companyPhone = `+1635${String(Date.now()).slice(-8)}`;
  const company = await User.create({
    phone: companyPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
  });
  const prod = await Product.create({
    companyId: company._id,
    sellerId: company._id,
    name: "Bulk",
    category: "Parts",
    price: 1,
    quantity: 50,
  });
  const buyerPhone = `+1636${String(Date.now()).slice(-8)}`;
  const buyer = await request(app).post("/api/auth/register").send({
    phone: buyerPhone,
    password: "secret12",
    role: "end_user",
    name: "Buyer",
    businessName: "Buyer Co",
  });
  assert.equal(buyer.status, 201);
  const token = buyer.body.token;
  const ord = await request(app)
    .post("/api/orders")
    .set("Authorization", `Bearer ${token}`)
    .send({
      sellerId: String(company._id),
      orderChannel: "stock",
      items: [{ productId: String(prod._id), quantity: 1 }],
    });
  assert.equal(ord.status, 403);
  assert.equal(ord.body.code, "STOCK_ORDER_ROLE");
});

test("distributor workspace-summary returns limited report counts", async () => {
  const company = await User.create({
    phone: `+1637${String(Date.now()).slice(-8)}`,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
  });
  const distPhone = `+1638${String(Date.now()).slice(-8)}`;
  await User.create({
    phone: distPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "distributor",
    status: "approved",
    companyId: company._id,
  });
  const dLogin = await request(app).post("/api/auth/login").send({ phone: distPhone, password: "secret12" });
  const res = await request(app).get("/api/users/workspace-summary").set("Authorization", `Bearer ${dLogin.body.token}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(typeof res.body.retailLinkedCount, "number");
  assert.equal(typeof res.body.pendingApprovalCount, "number");
  assert.equal(typeof res.body.ordersOpenAsSeller, "number");
  assert.equal(typeof res.body.ordersOpenAsBuyer, "number");
  assert.equal(typeof res.body.completedRevenueAsSeller, "number");
  assert.equal(typeof res.body.lowStockSkuCount, "number");
  assert.equal(typeof res.body.stockOrdersOpenAsBuyer, "number");
  assert.equal(typeof res.body.garageOrdersPendingAsSeller, "number");
});

test("Super Admin suspend or block revokes API access with distinct error codes", async () => {
  const ownerPhone = `+1640${String(Date.now()).slice(-8)}`;
  await User.create({
    phone: ownerPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
    isPlatformOwner: true,
  });
  const victimPhone = `+1641${String(Date.now()).slice(-8)}`;
  const victim = await User.create({
    phone: victimPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "end_user",
    status: "approved",
  });
  const victimLogin = await request(app).post("/api/auth/login").send({ phone: victimPhone, password: "secret12" });
  assert.equal(victimLogin.status, 200, JSON.stringify(victimLogin.body));
  const victimToken = victimLogin.body.token;

  const ownerLogin = await request(app).post("/api/auth/login").send({ phone: ownerPhone, password: "secret12" });
  assert.equal(ownerLogin.status, 200, JSON.stringify(ownerLogin.body));
  const ownerToken = ownerLogin.body.token;

  const meOk = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${victimToken}`);
  assert.equal(meOk.status, 200);

  const susp = await request(app)
    .patch(`/api/admin/users/${victim.id}`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ status: "suspended" });
  assert.equal(susp.status, 200, JSON.stringify(susp.body));

  const meSusp = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${victimToken}`);
  assert.equal(meSusp.status, 403);
  assert.equal(meSusp.body.code, "ACCOUNT_SUSPENDED");

  const restore = await request(app)
    .patch(`/api/admin/users/${victim.id}`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ status: "approved" });
  assert.equal(restore.status, 200);

  const meBack = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${victimToken}`);
  assert.equal(meBack.status, 200);

  const blk = await request(app)
    .patch(`/api/admin/users/${victim.id}`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ status: "blocked" });
  assert.equal(blk.status, 200);

  const meBlk = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${victimToken}`);
  assert.equal(meBlk.status, 403);
  assert.equal(meBlk.body.code, "ACCOUNT_BLOCKED");
});

test("wishlist + in-app notifications feed (seller sees new order)", async () => {
  const sellerPhone = `+1788${String(Date.now()).slice(-8)}`;
  const buyerPhone = `+1789${String(Date.now()).slice(-8)}`;

  await User.create({
    phone: sellerPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
    isPlatformOwner: true,
    name: "Wish Co",
    location: { type: "Point", coordinates: [0, 0] },
  });
  const sellerLogin = await request(app).post("/api/auth/login").send({ phone: sellerPhone, password: "secret12" });
  assert.equal(sellerLogin.status, 200, JSON.stringify(sellerLogin.body));
  const tokenS = sellerLogin.body.token;
  const sellerId = sellerLogin.body.user.id;

  const buyer = await request(app).post("/api/auth/register").send({
    phone: buyerPhone,
    password: "secret12",
    role: "end_user",
    name: "Wish Buyer",
    businessName: "Wish Buyer Motors",
  });
  assert.equal(buyer.status, 201);
  const tokenB = buyer.body.token;

  const prod = await request(app).post("/api/products").set("Authorization", `Bearer ${tokenS}`).send({
    name: "Wish SKU",
    category: "Parts",
    price: 10,
    quantity: 5,
    images: ["https://example.com/image-one.png"],
  });
  assert.equal(prod.status, 201, prod.body?.error || "");
  const productId = prod.body.product._id;

  const st = await request(app).get(`/api/wishlist/status/${productId}`).set("Authorization", `Bearer ${tokenB}`);
  assert.equal(st.status, 200);
  assert.equal(st.body.inWishlist, false);

  const add = await request(app).post("/api/wishlist").set("Authorization", `Bearer ${tokenB}`).send({ productId });
  assert.equal(add.status, 201, add.body?.error || "");

  const list = await request(app).get("/api/wishlist").set("Authorization", `Bearer ${tokenB}`);
  assert.equal(list.status, 200);
  assert.equal(list.body.items.length, 1);

  const ord = await request(app).post("/api/orders").set("Authorization", `Bearer ${tokenB}`).send({
    sellerId,
    items: [{ productId, quantity: 1 }],
  });
  assert.equal(ord.status, 201, ord.body?.error || "");

  const feed = await request(app).get("/api/notifications").set("Authorization", `Bearer ${tokenS}`);
  assert.equal(feed.status, 200);
  assert.ok(Array.isArray(feed.body.notifications));
  assert.ok(feed.body.notifications.some((n) => n.type === "order_new"), JSON.stringify(feed.body.notifications));

  const nid = feed.body.notifications.find((n) => n.type === "order_new").id;
  const read = await request(app).patch(`/api/notifications/${nid}/read`).set("Authorization", `Bearer ${tokenS}`);
  assert.equal(read.status, 200);
  assert.ok(read.body.notification.readAt);

  const del = await request(app).delete(`/api/wishlist/${productId}`).set("Authorization", `Bearer ${tokenB}`);
  assert.equal(del.status, 200);
  assert.equal(del.body.removed, 1);
});

test("cannot self-register a second Hornvin company when platform root already exists", async () => {
  const em = `hornvin-root-${Date.now()}@example.com`;
  await User.create({
    email: em,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
    isPlatformOwner: true,
    emailVerified: true,
  });
  const prev = process.env.BOOTSTRAP_PLATFORM_OWNER_EMAIL;
  process.env.BOOTSTRAP_PLATFORM_OWNER_EMAIL = em;
  try {
    const res = await request(app).post("/api/auth/register").send({
      email: em,
      phone: `+1579${String(Date.now()).slice(-8)}`,
      password: "anotherpw12",
      role: "company",
      name: "Second root",
      businessName: "Second Root Hornvin",
    });
    assert.equal(res.status, 403, JSON.stringify(res.body));
    assert.equal(res.body.code, "PLATFORM_ROOT_EXISTS");
  } finally {
    if (prev !== undefined) process.env.BOOTSTRAP_PLATFORM_OWNER_EMAIL = prev;
    else delete process.env.BOOTSTRAP_PLATFORM_OWNER_EMAIL;
  }
});

test("retail garage API: inventory summary and work estimate", async () => {
  const company = await User.create({
    phone: `+1900${String(Date.now()).slice(-8)}`,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
    isPlatformOwner: true,
    location: { type: "Point", coordinates: [0, 0] },
  });
  const retailPhone = `+1901${String(Date.now()).slice(-8)}`;
  await User.create({
    phone: retailPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "retail",
    status: "approved",
    companyId: company._id,
    location: { type: "Point", coordinates: [0, 0] },
    ...retailOnboardedProfile(),
  });
  const login = await request(app).post("/api/auth/login").send({ phone: retailPhone, password: "secret12" });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  const token = login.body.token;

  const inv = await request(app)
    .post("/api/garage/inventory")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Brake pads front", quantity: 4, reorderAt: 2, unit: "set" });
  assert.equal(inv.status, 201, JSON.stringify(inv.body));

  const sum = await request(app).get("/api/garage/summary").set("Authorization", `Bearer ${token}`);
  assert.equal(sum.status, 200);
  assert.equal(sum.body.inventoryCount, 1);
  assert.equal(sum.body.lowStockCount, 0);

  const list = await request(app).get("/api/garage/inventory").set("Authorization", `Bearer ${token}`);
  assert.equal(list.status, 200);
  assert.equal(list.body.items.length, 1);

  const est = await request(app)
    .post("/api/garage/work-estimate")
    .set("Authorization", `Bearer ${token}`)
    .send({ laborHours: 2, laborRate: 500, partsCost: 2000, taxPercent: 18 });
  assert.equal(est.status, 200);
  assert.equal(est.body.total, 3540);

  const u = await User.findOne({ phone: retailPhone });
  await GarageInventoryItem.deleteMany({ garageUserId: u._id });
});

test("POST /api/part-finder/identify manual query returns products and nearby seller", async () => {
  const company = await User.create({
    phone: `+1700${String(Date.now()).slice(-8)}`,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
    isPlatformOwner: true,
    location: { type: "Point", coordinates: [77.209, 28.6139] },
  });
  const retailPhone = `+1701${String(Date.now()).slice(-8)}`;
  const retail = await User.create({
    phone: retailPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "retail",
    status: "approved",
    companyId: company._id,
    location: { type: "Point", coordinates: [77.21, 28.614] },
    ...retailOnboardedProfile(),
  });
  const login = await request(app).post("/api/auth/login").send({ phone: retailPhone, password: "secret12" });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  const token = login.body.token;

  const createProd = await request(app)
    .post("/api/products")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Deluxe oil filter synthetic spin-on",
      category: "Filters",
      price: 450,
      quantity: 5,
      description: "For diesel engines",
    });
  assert.equal(createProd.status, 201, JSON.stringify(createProd.body));

  const id = await request(app)
    .post("/api/part-finder/identify")
    .set("Authorization", `Bearer ${token}`)
    .send({
      manualQuery: "oil filter synthetic",
      lat: 28.6139,
      lng: 77.209,
    });
  assert.equal(id.status, 200, JSON.stringify(id.body));
  assert.equal(id.body.ai, false);
  assert.ok(String(id.body.searchQuery || "").length > 0);
  assert.ok(Array.isArray(id.body.products));
  assert.ok(id.body.products.length >= 1, "expected at least one product match");
  assert.ok(id.body.products.some((p) => String(p.name).toLowerCase().includes("oil")));
  assert.ok(Array.isArray(id.body.nearbySellers));
  assert.ok(id.body.nearbySellers.some((s) => String(s._id) === String(retail._id)), "expected listing seller in nearby results");

  await Product.deleteMany({ sellerId: retail._id });
  await User.deleteMany({ _id: { $in: [retail._id, company._id] } });
});

test("rewards: Super Admin creates coupon; user redeems points", async () => {
  const ownerPhone = `+1710${String(Date.now()).slice(-8)}`;
  const owner = await User.create({
    phone: ownerPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "company",
    status: "approved",
    isPlatformOwner: true,
  });
  const buyerPhone = `+1711${String(Date.now()).slice(-8)}`;
  const buyer = await User.create({
    phone: buyerPhone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "end_user",
    status: "approved",
  });
  const adminLogin = await request(app).post("/api/auth/login").send({ phone: ownerPhone, password: "secret12" });
  assert.equal(adminLogin.status, 200, JSON.stringify(adminLogin.body));
  const buyerLogin = await request(app).post("/api/auth/login").send({ phone: buyerPhone, password: "secret12" });
  assert.equal(buyerLogin.status, 200, JSON.stringify(buyerLogin.body));

  const createC = await request(app)
    .post("/api/admin/coupons")
    .set("Authorization", `Bearer ${adminLogin.body.token}`)
    .send({ code: "WELCOME50", title: "Welcome", pointsValue: 50, maxUses: 10 });
  assert.equal(createC.status, 201, JSON.stringify(createC.body));

  const redeem = await request(app)
    .post("/api/rewards/redeem")
    .set("Authorization", `Bearer ${buyerLogin.body.token}`)
    .send({ code: "welcome50" });
  assert.equal(redeem.status, 200, JSON.stringify(redeem.body));
  assert.equal(redeem.body.pointsAwarded, 50);
  assert.equal(redeem.body.rewardPoints, 50);

  const me = await request(app).get("/api/rewards/me").set("Authorization", `Bearer ${buyerLogin.body.token}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.rewardPoints, 50);

  const dup = await request(app)
    .post("/api/rewards/redeem")
    .set("Authorization", `Bearer ${buyerLogin.body.token}`)
    .send({ code: "WELCOME50" });
  assert.equal(dup.status, 400);
  assert.equal(dup.body.code, "COUPON_ALREADY_USED");

  await CouponRedemption.deleteMany({ userId: buyer._id });
  await Coupon.deleteMany({ code: "WELCOME50" });
  await User.deleteMany({ _id: { $in: [owner._id, buyer._id] } });
});

test("garage API forbidden for non-retail roles", async () => {
  const phone = `+1902${String(Date.now()).slice(-8)}`;
  await User.create({
    phone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "distributor",
    status: "approved",
    location: { type: "Point", coordinates: [0, 0] },
  });
  const login = await request(app).post("/api/auth/login").send({ phone, password: "secret12" });
  assert.equal(login.status, 200);
  const res = await request(app).get("/api/garage/summary").set("Authorization", `Bearer ${login.body.token}`);
  assert.equal(res.status, 403);
});

test("PATCH /api/auth/profile retail shop fields and GST", async () => {
  const phone = `+1643${String(Date.now()).slice(-8)}`;
  await User.create({
    phone,
    passwordHash: await bcrypt.hash("secret12", 10),
    role: "retail",
    status: "approved",
    ...retailOnboardedProfile({ name: "Owner", businessName: "Bay" }),
  });
  const login = await request(app).post("/api/auth/login").send({ phone, password: "secret12" });
  assert.equal(login.status, 200);
  const token = login.body.token;
  const bad = await request(app)
    .patch("/api/auth/profile")
    .set("Authorization", `Bearer ${token}`)
    .send({ businessType: "not_a_type" });
  assert.equal(bad.status, 400);
  const ok = await request(app)
    .patch("/api/auth/profile")
    .set("Authorization", `Bearer ${token}`)
    .send({ gstNumber: "22aaaaa0000a1z5", addressLandmark: "Opposite main gate" });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.gstNumber, "22AAAAA0000A1Z5");
  assert.equal(ok.body.user.addressLandmark, "Opposite main gate");
});

test("PATCH /api/auth/profile updates display name only", async () => {
  const phone = `+1642${String(Date.now()).slice(-8)}`;
  const reg = await request(app).post("/api/auth/register").send({
    phone,
    password: "secret12",
    role: "end_user",
    name: "Before",
    businessName: "Before Profile Shop",
  });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  const token = reg.body.token;

  const ok = await request(app).patch("/api/auth/profile").set("Authorization", `Bearer ${token}`).send({ name: "After Name" });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.user.name, "After Name");

  const bad = await request(app)
    .patch("/api/auth/profile")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "X", email: "hacker@example.com" });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, "PROFILE_CONTACT_READ_ONLY");
});
