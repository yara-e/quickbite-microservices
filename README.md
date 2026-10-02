# QuickBite — Microservices Backend for Food Delivery & Online Ordering

QuickBite is an **asynchronous, event-driven microservices backend** engineered for high-throughput food delivery platforms. It manages the complete order lifecycle — from restaurant browsing and order placement to real-time delivery tracking, payments, and driver assignments — across multi-region environments.

[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-blue)](https://github.com/yara-e/quickbite-microservices/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🌐 Live Deployment & Demo Links

The production infrastructure is deployed on **AWS ECS (Fargate)** and **AWS RDS (PostgreSQL/PostGIS)** behind an **AWS Application Load Balancer (ALB)**:


* 💚 **Core Service Health Check:** [`http://alb-1918623630.eu-north-1.elb.amazonaws.com:3000/api/health`](http://alb-1918623630.eu-north-1.elb.amazonaws.com:3000/api/health)
* 🧡 **Order Service Health Check:** [`http://alb-1918623630.eu-north-1.elb.amazonaws.com:4000/api/health`](http://alb-1918623630.eu-north-1.elb.amazonaws.com:4000/api/health)
* 📜 **Postman Collection & QA Setup:** See [`scripts/reset-and-seed.ts`](scripts/reset-and-seed.ts) for seed credentials.

---

## ⚡ Performance & Load Benchmark (k6)

Benchmarked using **k6** against AWS ECS tasks backed by a single AWS RDS Free-Tier instance (`db.t4g.micro` with 2 vCPUs and 2 GB RAM hosting 5 regional databases):

* **Throughput:** ~125 Requests/Second (~7,500 RPM / ~10.8M daily)
* **Error Rate:** **0.00%** under continuous load
* **Latency:** **114 ms** Average | **146 ms** p95
* **Key Finding:** Scaled horizontally up to 162 RPS where database connection limits on the micro RDS instance defined the system's baseline saturation point.

---

## 🏗️ System Architecture

QuickBite decouples domain operations into two main Node.js application services communicating via **internal REST APIs** and **RabbitMQ event streams**, managed in production by AWS Application Load Balancer path routing.

```text
                    ┌───────────────────────────────┐
                    │      Client Applications      │
                    └───────────────┬───────────────┘
                                    │ HTTP + WebSocket
                                    ▼
                    ┌───────────────────────────────┐
                    │ AWS Application Load Balancer │
                    │   Path Routing & Rate Limits  │
                    └───────┬───────────────┬───────┘
                            │               │
               :3000/api/*              :4000/api/*
                            │               │
                            ▼               ▼
             ┌──────────────────┐   ┌─────────────────────────┐
             │   Core Service   │   │      Order Service      │
             │ Auth · Catalog · │   │ Orders · Payments ·     │
             │ Restaurants ·    │   │ Assignments · Finance · │
             │ Users · RBAC     │   │ WebSocket (socket.io)   │
             └────────┬─────────┘   └──────────┬───────┬───────┘
                      │ internal REST          │       │
                      ▼                        │       ▼
             ┌────────────────┐     ┌──────────┴───────────────┐
             │   PostgreSQL   │     │      Redis Cluster       │
             │   (PostGIS)    │     │         Caching          │
             │ Sharded catalog│     └───────────┬─────────────┘
             └────────────────┘                 │
                                                ▼
                                    ┌──────────────────────────┐
                                    │        RabbitMQ          │
                                    │  core.events / orders    │
                                    └──────────────────────────┘
```

---

## 💡 Key Architectural Highlights

1. **Transactional Outbox Pattern:** Guarantees **at-least-once** event publishing by writing domain data and outbox events in a single DB transaction, dispatched via background workers with `SKIP LOCKED`.
2. **Regionally Sharded & Partitioned DB:** Order data is split by region (`eg`, `sa`), utilizing PostgreSQL **monthly RANGE partitioning** for optimal query performance.
3. **Geospatial Agent Matching:** Utilizes PostGIS `GIST` indexes and Redis `GEOSEARCH` to locate and assign nearby delivery agents within seconds.
4. **Real-time WebSocket Layer:** Powered by `socket.io` with a Redis adapter for cross-instance state broadcasting (`order.status_changed`, `task.assigned`).

---

## 🛠️ Tech Stack & Components

* **Runtime & Framework:** Node.js (v22), Express, TypeScript, `tsyringe` (DI).
* **Databases:** PostgreSQL 16 with PostGIS extension on AWS RDS, Knex.js query builder.
* **Caching & Locks:** Redis (ioredis), Socket.io Redis Adapter.
* **Messaging & Queues:** RabbitMQ (AMQP 0-9-1).
* **Infrastructure & Cloud:** AWS ECS (Fargate), AWS Application Load Balancer (ALB), AWS RDS, Docker.
* **Testing:** Jest, Supertest, k6.

---

## ☁️ Cloud Infrastructure Architecture

```text
  AWS Cloud
  └── VPC (Public & Private Subnets)
      ├── Application Load Balancer (ALB) ── Ports 80 / 443
      ├── ECS Cluster (Fargate)
      │   ├── Core Service Tasks (Auto-scaled)
      │   └── Order Service Tasks (Auto-scaled)
      ├── Redis Cache Container
      └── Amazon RDS (PostgreSQL + PostGIS)
```

1. **Containerization:** Multi-stage `Dockerfile` configurations yield slim Node.js 22 runtime images for deployment to AWS ECS Fargate.
2. **Gateway & Load Balancing:** AWS Application Load Balancer (ALB) handles path-based routing (`:3000/api/*` → Core Service, `:4000/api/*` → Order Service).
3. **Automated CI/CD:** GitHub Actions workflows run TypeScript checks, unit tests, integration suites, and Docker image builds on every pull request.

---

## 🚀 Local Development Quick Start

### 1. Prerequisites
* **Node.js** (v20+) installed locally.
* **PostgreSQL (with PostGIS)** & **Redis** instances running.

### 2. Environment Setup
```bash
# Clone repository
git clone https://github.com/yara-e/quickbite-microservices.git
cd quickbite-microservices

# Configure environment variables
cp core-service/.env.docker core-service/.env
cp order-service/.env.docker order-service/.env
```

### 3. Run Services
```bash
# Core Service
cd core-service
npm ci
npm run dev

# Order Service
cd ../order-service
npm ci
npm run dev
```

---

## 🧪 Testing & Coverage

The project enforces a **≥80% combined unit & integration code coverage threshold**.

```bash
# Run unit tests
npm test

# Run integration tests (Requires PG & Redis)
npm run test:integration

# Run load test script
k6 run ratelimit.js
```

---

## 🔌 API Route Reference

| Service | Path Prefix | Key Features |
| :--- | :--- | :--- |
| **Core** | `:3000/api/auth` | User registration, JWT login, refresh tokens, password reset |
| **Core** | `:3000/api/restaurants` | Restaurant & branch management, PostGIS nearby lookup |
| **Core** | `:3000/api/products` | Menu catalog, categories, stock reservation |
| **Order** | `:4000/api/orders` | Order creation (COD & Kashier online payment), state transitions |
| **Order** | `:4000/api/agents` | Agent presence ping (Redis GEO), task accept/reject |
| **Order** | `:4000/api/finance` | Restaurant balances, commission calculations, payouts |

*For complete endpoint specifications and contracts, see [`order-service/docs/api-contracts.md`](order-service/docs/api-contracts.md).*
