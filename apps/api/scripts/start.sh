#!/bin/bash
set -e

echo "[startup] Running database migrations..."
cd "$(dirname "$0")/.."
npx prisma migrate deploy

echo "[startup] Migrations complete. Starting API server..."
exec node dist/src/server.js
