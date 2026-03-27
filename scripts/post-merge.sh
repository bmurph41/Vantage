#!/bin/bash
set -e
npm install --prefer-offline
timeout 60 bash -c 'yes | npm run db:push' || echo "db:push skipped (timeout or no changes needed)"
