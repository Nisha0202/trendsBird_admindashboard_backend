# Backend README

## 1. Project Overview

E-commerce Admin REST API with JWT authentication, RBAC, product variants, a shared media library, categories, brands, attributes, and products. Admin-only — no storefront, no customer-facing side.

## Link: https://dashboard-backend-six-zeta.vercel.app/health 
## Frontend Repo: https://github.com/Nisha0202/trendsBird_admindashboard_frontend

**Tech stack:** Node.js, Express, TypeScript, Prisma, PostgreSQL (hosted on Supabase).

## 📚 Table of Contents

- Project Overview
- Technologies Used
- Installation & Setup
- Environment Variables
- Seed Credentials
- API Integration
- Module Status
- Design Decisions
- Known Issues
---

## 2. Technologies Used

- Node.js
- Express
- TypeScript
- PostgreSQL
- Prisma
- Zod
- JWT
- bcrypt
- Multer
- Sharp

File storage uses Supabase Storage (accessed via `@supabase/supabase-js`, service-role key, server-side only) — Supabase itself is not used for Auth; authentication is fully custom (see Section 7).

---

## 3. Installation & Setup

```bash
git clone <repo-url>

cd backend

npm install

cp .env.example .env
# fill in real values — see Section 4

npx prisma generate

npx prisma migrate deploy
# (use `npx prisma migrate dev` instead, in local development)

npm run seed

npm run dev
```

- **Node version:** 20.x LTS or later
- **npm version:** 10.x or later (ships with Node 20)

Server runs on `http://localhost:4000` by default. Health check: `GET /health`.

The Supabase Storage bucket referenced by `SUPABASE_MEDIA_BUCKET` must exist and be set **public** before Media uploads will work.

---

## 4. Environment Variables

```env
NODE_ENV=development
PORT=4000
CORS_ORIGIN=http://localhost:3000

DATABASE_URL=postgresql://postgres:[PASSWORD]@[POOLER_HOST]:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:[PASSWORD]@[DIRECT_HOST]:5432/postgres

JWT_ACCESS_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=30

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_MEDIA_BUCKET=media
MAX_FILE_SIZE_MB=10
```

**Note on naming vs. a typical `JWT_REFRESH_SECRET` setup:** this API's refresh tokens are **not** JWTs — they're opaque random strings, hashed (SHA-256) before being stored in the database, the same way a password is hashed. There's no `JWT_REFRESH_SECRET` to sign them with, because nothing signs them; a lookup against the stored hash is what validates them. `REFRESH_TOKEN_EXPIRES_DAYS` controls their lifetime instead. See Section 7 for why.

`DATABASE_URL` uses Supabase's transaction pooler (port 6543) for the running app; `DIRECT_URL` uses the direct connection (port 5432), required for running migrations. `CORS_ORIGIN` should match wherever the frontend is hosted (`FRONTEND_URL` in spirit — named `CORS_ORIGIN` here since that's precisely what it configures in `app.ts`).

---

## 5. Seed Credentials

Running `npm run seed` (or `npx prisma migrate reset`, which auto-seeds) creates:

```
Admin

email:
admin@example.com

password:
SuperAdmin123!

-------------------

Catalog User

email:
catalog@example.com

password:
Catalog123!
```

The Catalog User holds every catalog permission (Media, Category, Brand, Attribute, Product, Dashboard) but **no** Permission/Role/User access — use it to verify `403` behaviour.

---

## 6. Backend API Integration

The frontend communicates with the backend through a RESTful API.

### Base URL

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

> Replace the value above with your deployed backend URL in production.

### Authentication

All protected endpoints require the following header:

```http
Authorization: Bearer <accessToken>
```

**Public Endpoints**

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

---

## 🔐 Authentication

| Method | Endpoint | Purpose |
| :----: | -------- | ------- |
| **POST** | `/auth/login` | User login |
| **GET** | `/auth/me` | Restore authenticated session |
| **POST** | `/auth/refresh` | Refresh expired access token |
| **POST** | `/auth/logout` | Logout current user |

---

## 🔑 Permission Groups

| Method | Endpoint | Purpose |
| :----: | -------- | ------- |
| **GET** | `/permissions/groups` | Get permission groups |
| **POST** | `/permissions/groups` | Create permission group |
| **PATCH** | `/permissions/groups/:id` | Update permission group |

---

## 👥 Roles

| Method | Endpoint | Purpose |
| :----: | -------- | ------- |
| **GET** | `/roles` | Get all roles |
| **GET** | `/roles/:id` | Get a single role |
| **POST** | `/roles` | Create role |
| **PATCH** | `/roles/:id` | Update role |
| **DELETE** | `/roles/:id` | Delete role |

---

## 👤 Users

| Method | Endpoint | Purpose |
| :----: | -------- | ------- |
| **GET** | `/users` | Get all users |
| **POST** | `/users` | Create user |
| **PATCH** | `/users/:id` | Update user |
| **DELETE** | `/users/:id` | Delete user |

---

## 🖼️ Media

| Method | Endpoint | Purpose |
| :----: | -------- | ------- |
| **GET** | `/media` | Get media library |
| **POST** | `/media/upload` | Upload media |
| **PATCH** | `/media/:id` | Update media |
| **DELETE** | `/media/:id` | Delete media |

---

## 📂 Categories

| Method | Endpoint | Purpose |
| :----: | -------- | ------- |
| **GET** | `/categories/tree` | Get category tree |
| **POST** | `/categories` | Create category |
| **PATCH** | `/categories/:id` | Update category |
| **DELETE** | `/categories/:id` | Delete category |

---

## 🏷️ Brands

| Method | Endpoint | Purpose |
| :----: | -------- | ------- |
| **GET** | `/brands` | Get all brands |
| **POST** | `/brands` | Create brand |
| **PATCH** | `/brands/:id` | Update brand |
| **DELETE** | `/brands/:id` | Delete brand |

---

## 🎨 Attributes

| Method | Endpoint | Purpose |
| :----: | -------- | ------- |
| **GET** | `/attributes` | Get attributes |
| **POST** | `/attributes` | Create attribute |
| **DELETE** | `/attributes/:id` | Delete attribute |
| **POST** | `/attributes/:id/values` | Add attribute value |
| **PATCH** | `/attributes/:id/values/:valueId` | Update attribute value |
| **DELETE** | `/attributes/:id/values/:valueId` | Delete attribute value |

---

## 📦 Products

| Method | Endpoint | Purpose |
| :----: | -------- | ------- |
| **GET** | `/products` | Get products |
| **GET** | `/products/:id` | Get product details |
| **POST** | `/products` | Create product |
| **PATCH** | `/products/:id` | Update product |
| **DELETE** | `/products/:id` | Delete product |
| **POST** | `/products/generate-combinations` | Generate product variants |
| **POST** | `/products/:id/variants` | Add variant |
| **DELETE** | `/products/:id/variants/:variantId` | Delete variant |
| **POST** | `/products/:id/media` | Attach media |
| **DELETE** | `/products/:id/media/:mediaAttachmentId` | Remove media |
| **PATCH** | `/products/:id/media/reorder` | Reorder product gallery |

---

## ⚙️ API Features

- 🔐 JWT Authentication
- 🔄 Automatic Access Token Refresh
- ♻️ Automatic Request Retry after Token Refresh
- 🚫 Global Error Handling
- 🛡️ Protected Routes
- 📁 Multipart File Upload Support
- 🧩 Atomic Product Creation (Variants, Categories & Media)
- ⚡ React Query for Caching & Data Synchronization

---

## 7. Module Status

| Module | Status |
|---|---|
| Authentication | ✅ Complete |
| Permission | ✅ Complete |
| Role | ✅ Complete |
| User | ✅ Complete |
| Media | ✅ Complete |
| Category | ✅ Complete |
| Brand | ✅ Complete |
| Attribute | ✅ Complete |
| Product | ✅ Complete |

Not implemented (bonus items, explicitly out of scope for this pass): rate limiting on login, an audit log, an automated test suite (Jest/Vitest — verification instead used the `scripts/test-*.ts` files run against a live dev server), Docker Compose.

---

## 8. Design Decisions

**JWT access + opaque refresh token, not JWT + JWT.** Access tokens are short-lived JWTs (15 min) carrying only `{ sub: userId }` — deliberately minimal, no role or permissions baked in. Refresh tokens are long-lived (30 days) opaque random strings, stored **hashed** in the database rather than as a second signed JWT. This means revoking a specific session is a real database operation (flip `revoked = true`), not something you have to fake with a blocklist of JWT ids.

**Refresh token rotation + reuse detection.** Every `/auth/refresh` call invalidates the presented token and issues a new one. If an already-rotated-away token is presented again, every active session for that user is revoked immediately — a replayed old token is a strong signal of theft.

**Permission checks are always live, never cached in the token.** Because the access token carries no role/permission data, `authGuard` re-fetches the user's role and flat permission list from the database on every single request. A permission revoked from a role, or a role changed on a user, takes effect on that user's *very next request* — not merely once their 15-minute access token happens to expire.

**RBAC model:** User → one Role → many Permissions, permissions named `module:action` (e.g. `product:delete`). Every protected route declares exactly which permission it needs via a `requirePermission()` middleware, checked *after* the global `authGuard`.

**Global auth guard, explicit public-route allowlist.** `authGuard` is mounted globally in `app.ts`, before any module routes — a newly added route is protected by default. Only `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, and `GET /health` are exempted, via an explicit list inside `authGuard.ts`. There is no per-route opt-in mechanism, by design — it can't be forgotten.

**Transactions for Product creation.** Creating a product together with its categories, media attachments, and variants runs inside one `prisma.$transaction`. If any variant fails validation (duplicate combination, bad attribute-value reference) partway through, nothing is persisted — no half-built product survives.

**Soft delete vs. hard delete — module by module:**
- **User** uses a soft delete (`deletedAt` column). A hard delete here would orphan audit trails — who uploaded which media, who created which product — so the row is marked deleted and excluded from all queries instead.
- **Every other module** (Permission, Role, Media, Category, Brand, Attribute, Product) uses a **hard delete**, guarded by a referential check: deletion is refused (`409 Conflict`) while something still depends on the record — a role still held by a user, a brand still referenced by a product, an attribute value still used by a variant, etc. The one deliberate exception: deleting a Product cascades its own Variants and its `ProductMedia` attachment rows, but the underlying `Media` **assets** themselves always survive, since other products may reference the same uploaded file.

**Exactly-one-thumbnail rule.** Setting a new thumbnail on a product or variant silently demotes whichever one was previously set, in the same transaction — never two thumbnails at once, and never a hard rejection for the natural act of changing your mind.

**Response shape.** Every response is one of:
```json
{ "success": true, "data": ..., "meta": { "pagination": {...} } }
{ "success": false, "message": "...", "details": [...] }
```
`details` (an array of `{ field, message }`) appears only on `422` validation failures. No response — success or error — ever includes a stack trace, a raw database error, or an internal file path.

## 8. Known issues:
- No audit log of who changed what.
- Docker Compose is not set up; local development assumes a cloud Supabase instance reachable over the network.

