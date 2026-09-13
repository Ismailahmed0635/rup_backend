#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy --schema=models/prisma/schema.prisma

echo "Starting server..."
node dist/app/index.js
