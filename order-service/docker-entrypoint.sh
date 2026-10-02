#!/bin/sh
set -e

# Wait for postgres
if [ -n "${DB_eg_HOST:-}" ]; then
  echo "[entrypoint] waiting for postgres at ${DB_eg_HOST}:${DB_eg_PORT:-5432}"
  until node -e "const net=require('net');const s=net.connect(Number(process.argv[2]), process.argv[1], ()=>(process.exit(0)));s.on('error', ()=>(process.exit(1)));" "${DB_eg_HOST}" "${DB_eg_PORT:-5432}"; do
    echo "[entrypoint] postgres not ready, retrying in 2s..."
    sleep 2
  done
fi

if [ -n "${REDIS_HOST:-}" ]; then
  echo "[entrypoint] waiting for redis at ${REDIS_HOST}:${REDIS_PORT:-6379}"
  until node -e "const net=require('net');const s=net.connect(Number(process.argv[2]), process.argv[1], ()=>(process.exit(0)));s.on('error', ()=>(process.exit(1)));" "${REDIS_HOST}" "${REDIS_PORT:-6379}"; do
    echo "[entrypoint] redis not ready, retrying in 2s..."
    sleep 2
  done
fi

# Run migrations
echo "[entrypoint] migrating regions: ${REGIONS}"
for region in $(printf '%s' "$REGIONS" | tr ',' ' '); do
  region=$(printf '%s' "$region" | xargs)
  if [ -n "$region" ]; then
    echo "[entrypoint]   -> migrating region: $region"
    REGION="$region" CLUSTER="hot" npx knex --knexfile dist/lib/knex/knexfile.js migrate:latest
  fi
done

echo "[entrypoint] starting: $*"
exec "$@"