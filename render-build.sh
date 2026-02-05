#!/usr/bin/env bash
# Build script for Render deployment

set -e

echo "==> Installing backend dependencies..."
yarn install

echo "==> Building frontend..."
cd frontend

# Install ALL dependencies including devDependencies
npm install --include=dev

# Build the frontend
npm run build

echo "==> Build complete!"
