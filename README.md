# Dairy Sales

Dairy Sales is an internal order entry app for dairy products, used by staff and external customers. This scaffold includes an Expo/React Native mobile client and an Express/tRPC backend backed by MySQL on Railway.

## Workspace layout

- `/home/runner/work/roses-halloumi/roses-halloumi/apps/api` — Express + tRPC API, Prisma schema, and seed data
- `/home/runner/work/roses-halloumi/roses-halloumi/apps/mobile` — Expo mobile app scaffold for auth, catalog, ordering, and order history

## Phase 1 features in this scaffold

- Customer and staff authentication with role-aware tRPC procedures
- Railway-ready Prisma schema for customers, products, orders, order items, and staff users
- Tier-based pricing that automatically switches between retail and wholesale product prices
- New order flow with pay-now discount, pay-in-30 due dates, EFTPOS/in-app placeholders, and instant confirmation
- Order history filtering by payment status, including overdue derivation from due dates
- Staff customer creation and admin-only retail/wholesale upgrades
- CSV export endpoint for finance handoff instead of Xero integration

## Getting started

1. Copy `/home/runner/work/roses-halloumi/roses-halloumi/apps/api/.env.example` to `/home/runner/work/roses-halloumi/roses-halloumi/apps/api/.env` and set `DATABASE_URL`, a secure `JWT_SECRET`, and any allowed browser origins in `ALLOWED_ORIGINS`.
2. Install dependencies from `/home/runner/work/roses-halloumi/roses-halloumi`:
   ```bash
   npm install
   ```
3. Generate the Prisma client and push the schema:
   ```bash
   npm run db:generate
   npm run db:push
   npm run db:seed
   ```
4. Start the API:
   ```bash
   npm run dev:api
   ```
5. In a second terminal, set `EXPO_PUBLIC_API_URL` to a reachable `/trpc` endpoint for your device or simulator and start the mobile app:
   ```bash
   export EXPO_PUBLIC_API_URL="http://YOUR-LAN-IP:4000/trpc"
   npm run dev:mobile
   ```

## Seed credentials

All seeded accounts use `password123`.

- `admin@dairysales.local`
- `staff@dairysales.local`
- `wholesale@dairysales.local`
- `retail@dairysales.local`

## Railway deployment (two separate services)

This monorepo deploys as **two independent Railway services**, each with its own root directory and `nixpacks.toml`. Do not point a single Railway service at the repo root — each service's *Root Directory* setting must match the app it is meant to run, and no service should override the committed `nixpacks.toml` [start] command with a custom start command in the Railway dashboard.

- **API service** (Express/tRPC backend, reads `DATABASE_URL`/`JWT_SECRET`/`STRIPE_SECRET_KEY`, etc.):
  - Root Directory: `apps/api`
  - Uses `apps/api/nixpacks.toml`, which installs from the repo root, runs `npm run build:api` (Prisma generate + `tsc`), and starts with `npm run start:api` (`node dist/src/server.js`).
- **Web service** (Expo web build served to customers, e.g. `grasslandcheese.com`):
  - Root Directory: `apps/mobile`
  - Uses `apps/mobile/nixpacks.toml`, which installs from the repo root, runs `npm run build:mobile:web` (Expo web export), and starts with `npm run start:mobile:web` (`node ./serve-web.mjs`).
  - Set `EXPO_PUBLIC_API_URL` on this service to the API service's public `/trpc` URL so the web frontend talks to the backend instead of falling back to a hardcoded default.

If a Railway service's logs show `expo start` / "Metro is running in CI mode" instead of `API listening on http://localhost:<PORT>`, that service's Root Directory or start command is misconfigured to run `apps/mobile`'s dev script rather than either app's production start command above.

## Notes

- Customer self-registration always creates a retail account; staff can later upgrade it to wholesale.
- `PAY_NOW` orders receive a 10% discount and are marked paid immediately in this scaffold.
- `PAY_30` orders store a due date 30 days in the future and remain outstanding until settled.
- Inventory tracking, live payment processing, and Xero API integration are intentionally out of scope.
