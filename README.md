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

1. Copy `/home/runner/work/roses-halloumi/roses-halloumi/apps/api/.env.example` to `/home/runner/work/roses-halloumi/roses-halloumi/apps/api/.env` and set `DATABASE_URL` plus a secure `JWT_SECRET`.
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
5. In a second terminal, point Expo at the API and start the mobile app:
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

## Notes

- Customer self-registration always creates a retail account; staff can later upgrade it to wholesale.
- `PAY_NOW` orders receive a 10% discount and are marked paid immediately in this scaffold.
- `PAY_30` orders store a due date 30 days in the future and remain outstanding until settled.
- Inventory tracking, live payment processing, and Xero API integration are intentionally out of scope.
