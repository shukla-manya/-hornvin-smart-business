# Vello Trade (Hornvin Smart Business)

Vello Trade is a **B2B automotive / parts marketplace** delivered as an **Expo (React Native)** mobile app plus a **Node.js + Express + MongoDB** API. Companies, distributors, retailers, and end customers can list inventory, place **marketplace** or **stock-channel** orders, chat in real time, manage invoices and payments, and use a **dealer locator** backed by GeoJSON locations.

---

## Repository layout

```text
hornvin-smart-business/
├── README.md                 ← This file
├── .gitignore
├── mobile/                   ← Expo app ("Vello" in app.json)
│   ├── App.js
│   ├── app.json              ← Expo config, bundle IDs, plugins
│   ├── assets/               ← Icons, splash, branding
│   ├── babel.config.js
│   ├── metro.config.js
│   └── src/
│       ├── api/resources.js  ← Typed-ish API path helpers (Axios)
│       ├── context/          ← Auth session (JWT in AsyncStorage)
│       ├── constants/        ← Role helpers
│       ├── hooks/
│       ├── navigation/       ← Tabs, stack, role-based guards
│       ├── screens/          ← UI: marketplace, orders, chat, admin, etc.
│       ├── services/api.js   ← Axios baseURL = EXPO_PUBLIC_API_URL + /api
│       ├── theme.js
│       └── utils/
└── server/                   ← REST + Socket.IO API
    ├── docs/
    │   └── openapi.yaml      ← OpenAPI 3 spec (source for Swagger UI)
    ├── package.json
    ├── tests/
    │   └── api.integration.test.mjs
    └── src/
        ├── index.js          ← listen + Mongo connect + migrations
        ├── createApp.js      ← Express app, routes, Socket.IO, Swagger
        ├── config/           ← db.js, mail.js
        ├── middleware/     ← JWT (auth.js), roles, platform owner
        ├── models/           ← Mongoose schemas (User, Product, Order, …)
        ├── routes/           ← One router per domain under /api/*
        ├── services/         ← Email OTP, push/in-app notify, onboarding mail
        └── utils/            ← permissions.js
```

---

## Roles and product flows

| Role | Typical use |
|------|-------------|
| **company** | Brand / OEM: global catalog (Super Admin), sells stock to linked distributors and retailers; does not place marketplace orders in-app. |
| **distributor** | Branch operations: links to a company, lists products, manages linked **retail** accounts, stock orders from company catalog, workspace summary. |
| **retail** | Garage / shop: marketplace buyer, can be onboarded by distributor or admin with **must-change-password** on first login. |
| **end_user** | Consumer buyer on the marketplace; email self-signup may require **inbox verification** before a JWT is issued. |

**Super Admin** is the single **platform owner** (`isPlatformOwner` on a `company` user). That account uses `/api/admin/*` for users, global catalog, categories, all orders/payments, and analytics.

**Orders**

- **Marketplace** (`orderChannel: "marketplace"` or default): buyers such as `end_user` or `retail` purchase from a seller’s listings.
- **Stock** (`orderChannel: "stock"`): only **distributor** / **retail**; seller must be the **company** the buyer is linked to (`companyId`), for replenishment from the company catalog.

**Products**

- Public **GET** `/api/products` merges **global catalog** items (`isGlobalCatalog`) with normal listings; optional filters `q`, `category`, `companyId`, `sellerId`.
- **POST/PATCH/DELETE** require JWT; sellers are **company** or **distributor** subject to `permissions` (see `server/src/utils/permissions.js`).

---

## API overview

- **Base URL**: `http://<host>:<port>` (default port **8000**).
- **REST prefix**: all JSON APIs are under **`/api`** (the mobile client sets `baseURL` to `{API_URL}/api`).
- **Auth**: JWT in header `Authorization: Bearer <token>` (except explicitly public routes such as health, auth register/login, product catalog **GET**, nearby dealers).
- **Interactive docs (Swagger UI)**: **`http://localhost:8000/api-docs`** after starting the server.
- **Machine-readable spec**: **`http://localhost:8000/openapi.json`** (same content as `server/docs/openapi.yaml`).

Main route groups (see `server/src/createApp.js`):

| Mount path | Purpose |
|------------|---------|
| `/api/auth` | Register, login (password + email OTP step), password reset, profile, roles policy |
| `/api/products` | Catalog CRUD + public listing |
| `/api/orders` | Create/list/update order status |
| `/api/chat` | Rooms and messages (REST); live updates via Socket.IO |
| `/api/invoices` | List, create from order, status (drives payment on “paid”) |
| `/api/dealers` | `GET /nearby` — geo query on user locations |
| `/api/users` | Team, distributor workspace, link company/distributor, distributor-created retail |
| `/api/payments` | Ledger-style payments and status updates |
| `/api/locations` | Saved pins; primary pin syncs `User.location` for maps |
| `/api/dealer-locator` | Bundles `locations` + `nearby` (same handlers as above) |
| `/api/notifications` | Push status, device tokens, in-app feed |
| `/api/wishlist` | Saved products |
| `/api/admin` | Super Admin only: users, global catalog, categories, orders, payments, analytics |

Validation errors often return **400** with `{ errors: [...] }` (express-validator). Business rules return **403** with `code` fields such as `ACCOUNT_PENDING`, `EMAIL_NOT_VERIFIED`, `MUST_CHANGE_PASSWORD`.

---

## Realtime (Socket.IO)

The HTTP server from `createApp()` also hosts **Socket.IO** with CORS `origin: "*"`.

1. Obtain a JWT from `/api/auth/login` or register.
2. Connect to the **same origin** as the API (see `mobile/src/services/api.js`: `getSocketBaseUrl()` defaults to `EXPO_PUBLIC_API_URL` or `EXPO_PUBLIC_SOCKET_URL`).
3. Pass `{ auth: { token: "<jwt>" } }` on connect. Middleware loads the user and rejects invalid or blocked accounts.

**Server → client events** (see `server/src/createApp.js` and chat route): `message:new`, `chat:room:updated`, `chat:typing`. **Client → server**: `room:join` (with Mongo `ChatRoom` id), `chat:typing`.

---

## Running locally

### Prerequisites

- Node.js **18+**
- MongoDB (local URI default in code: `mongodb://127.0.0.1:27017/hornvin_users`)

### Server

```bash
cd server
cp .env.example .env
# Edit .env: set MONGODB_URI and JWT_SECRET (see table below)
npm install
npm run dev
```

- Health: `GET http://localhost:8000/health`
- Swagger UI: `http://localhost:8000/api-docs`

**Seed Super Admin in the database** (no hardcoded users — uses `.env` only):

```bash
cd server
# Set BOOTSTRAP_PLATFORM_OWNER_EMAIL + BOOTSTRAP_PLATFORM_OWNER_PASSWORD in .env, then:
npm run seed:superadmin
```

If a platform owner already exists, the script exits successfully and does nothing.

### Mobile (Expo)

```bash
cd mobile
npm install
npx expo start
```

Configure the API host (device or simulator must reach your machine):

- **`EXPO_PUBLIC_API_URL`** — e.g. `http://127.0.0.1:8000` (iOS simulator) or your LAN IP for a physical device.

See `mobile/.env.example` if present for other Expo public variables.

### Server tests

```bash
cd server
npm test
```

Uses `mongodb-memory-server` (no local Mongo required for tests).

---

## Environment variables (server)

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP port (default `8000`) |
| `MONGODB_URI` | Mongo connection string |
| `JWT_SECRET` | Signing key for JWT (required in production) |
| `JWT_EXPIRES_IN` | Optional token TTL (default `7d`) |
| `REGISTER_ALLOWED_ROLES` | Comma list to restrict self-registration roles |
| `ALLOW_DOWNSTREAM_SELF_REGISTER` | Set `1` to allow distributor self-signup |
| `SKIP_USER_APPROVAL` | Set `1` to auto-approve most roles in dev (retail still pending) |
| `BOOTSTRAP_PLATFORM_OWNER_EMAIL` | Super Admin identity: first `company` **register** with this email becomes owner if none exists; also used by `npm run seed:superadmin` |
| `BOOTSTRAP_PLATFORM_OWNER_PASSWORD` | **Only** for `npm run seed:superadmin` — creates or promotes that user in MongoDB (not read by HTTP auth) |
| `SMTP_*` | Nodemailer for OTP and onboarding mail (`config/mail.js`, `otpEmail.js`) |
| `EXPO_ACCESS_TOKEN`, `PUSH_SEND_ENABLED` | Expo push delivery (`pushNotify.js`) |
| `PUSH_PROVIDER`, `STOCK_LOW_THRESHOLD` | Push behaviour / low-stock threshold |

Never commit real `.env` files. Keep secrets in local env or a secret manager.

---

## OpenAPI maintenance

The canonical description lives in **`server/docs/openapi.yaml`**. Swagger UI reads it at startup and exposes JSON at **`/openapi.json`**. When you add or change routes under `server/src/routes/`, update the YAML so interactive docs stay accurate.

---

## Licence / product name

App display name and slugs are configured in `mobile/app.json` (e.g. **Vello**, slug `vello-trade`). Package names in `package.json` files may still read `vello-*`; align naming in your release pipeline as needed.
 by - MANYA SHUKLA 2026