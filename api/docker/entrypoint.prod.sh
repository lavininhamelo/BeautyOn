#!/bin/sh
set -e
if [ -z "$SKIP_MIGRATIONS" ]; then
  npx prisma migrate deploy
fi
exec "$@"
