# Testing — core-service

The test suite lives in `tests/` and mirrors the source layout:

```
tests/
  unit/            … fast, mocked unit tests (no infra)
  integration/     … real Postgres + Redis tests (supertest over the Express app)
  helpers/         … shared test utilities (seeding, truncation, email stub)
  setup-env.ts     … loads .env.test for every test file
```

## Prerequisites

| Dependency | Version | Notes |
| --- | --- | --- |
| PostgreSQL | 13+ | must have the **PostGIS** extension available |
| Redis | 6+ | used for idempotency keys + `withCache` |
| Node | 20+ | |

The integration config expects a database named **`quickbite_test`** and reads
credentials from **`.env.test`** (already committed; `INTERNAL_API_KEY` and the
RabbitMQ settings were added so internal endpoints and outbox writes work in
tests).

Create the test database once:

```sql
CREATE DATABASE quickbite_test;
```

`tests/integration/globalSetup.ts` runs `knex migrate:latest` against that DB
before the suite and ensures PostGIS `spatial_ref_sys` contains SRID 4326 (some
Windows PostGIS bundles ship the extension without the EPSG data).

> **Note:** `tests/helpers/db.ts` truncates every table between tests except:
> `knex_migrations*`, `roles`, `permissions`, `role_permissions` and
> `spatial_ref_sys`. It also sweeps Redis keys so caches (idempotency, withCache)
> never leak between tests.

## Commands

```bash
npm test                          # unit tests (jest)
npm run test:unit                 # same
npm run test:coverage:unit        # unit tests + coverage
npm run test:integration          # integration tests (Postgres + Redis)
npm run test:coverage:integration # integration tests + coverage
npm run test:coverage             # unit + integration coverage, merged report + gate
npm run build                     # tsc typecheck (includes tests via tsconfig.test.json)
```

Run a single integration module (fast iteration):

```bash
npx jest --config jest.integration.config.js branch
npx jest --config jest.integration.config.js -t "reserve-stock"
```

## Coverage

The project targets **≥80%** combined (unit + integration) coverage on
statements / lines / functions. Both jest configs write Istanbul reports into
`coverage/unit` and `coverage/integration`; `scripts/merge-coverage.ts` merges
them (max hit-count per instrumented id) and enforces the gate:

| Metric | Combined |
| --- | --- |
| Statements | **92.7%** |
| Lines | **97.8%** |
| Functions | **93.8%** |
| Branches | **100%** |

`npm run test:coverage` fails the build if any metric drops below the gate.

## Writing tests

- **Unit** tests mock every boundary (repos, `db`, `container`, `pkg` adapters)
  — no database or Redis. Use the `@/` path alias (`@/lib/error/AppError`).
- **Integration** tests exercise the full Express app via `supertest` against
  the real Postgres/Redis. Use `tests/helpers/seed.ts` for fixtures; its
  factories map snake_case rows back into camelCase entities and issue signed
  JWTs with the correct `role` / `restaurantId` / `restaurantRole` claims.
- Every integration file stubs the email provider:
  `jest.mock("../../../src/lib/email/init", () => ({ emailProvider: ... }))`,
  usually with `tests/helpers/email-stub.ts` to assert on outgoing email.
- Internal service-to-service endpoints require the header
  `api-key: test-internal-api-key` (matches `.env.test`).