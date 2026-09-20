#!/usr/bin/env bash
set -Eeuo pipefail

# ==============================================================================
# Bare-Metal PM2 Deployment Script (Optimized for Low-End VPS / Machines)
# ==============================================================================

APP_DIR="${APP_DIR:-/opt/cronos}"
NODE_ENV="${NODE_ENV:-production}"

echo "[$(date)] Starting bare-metal deployment for Cronos..."

cd "${APP_DIR}"

echo "[$(date)] 1. Pulling latest code from git..."
git pull origin main

echo "[$(date)] 2. Installing dependencies (clean install)..."
npm ci --omit=dev

echo "[$(date)] 3. Building application (Frontend Vite + Backend esbuild bundle)..."
npm run build

echo "[$(date)] 4. Running database migrations..."
NODE_ENV=production npm run db:migrate || echo "Warning: migrations had issues or already applied."

echo "[$(date)] 5. Starting or reloading application via PM2..."
if pm2 list | grep -q "cronos-app"; then
    pm2 reload ecosystem.config.cjs --update-env
else
    pm2 start ecosystem.config.cjs
fi

echo "[$(date)] 6. Saving PM2 process list for server reboots..."
pm2 save

echo "[$(date)] SUCCESS: Deployment completed successfully on bare-metal PM2!"
pm2 status
