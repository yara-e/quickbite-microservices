#!/bin/sh
set -e

# Wait for postgres before touching knex.
if [ -n "${DB_HOST:-}" ]; then
  echo "[entrypoint] waiting for postgres at ${DB_HOST}:${DB_PORT:-5432}"
  until node -e "const net=require('net');const s=net.connect({host:process.argv[1],port:Number(process.argv[2])});s.then(()=>process.exit(0)).catch(()=>process.exit(1))" "${DB_HOST}" "${DB_PORT:-5432}"; do
    echo "[entrypoint] postgres not ready, retrying in 2s..."
    sleep 2
  done
fi

if [ -n "${REDIS_HOST:-}" ]; then
  echo "[entrypoint] waiting for redis at ${REDIS_HOST}:${REDIS_PORT:-6379}"
  until node -e "const net=require('net');const s=net.connect({host:process.argv[1],port:Number(process.argv[2])});s.then(()=>process.exit(0)).catch(()=>process.exit(1))" "${REDIS_HOST}" "${REDIS_PORT:-6379}"; do
    echo "[entrypoint] redis not ready, retrying in 2s..."
    sleep 2
  done
fi

echo "[entrypoint] running core-service migrations"
npm run migrate

echo "[entrypoint] starting: $*"
exec "$@"