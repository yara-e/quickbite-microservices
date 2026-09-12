# QuickBite — Microservices Backend Architecture
QuickBite is a full-featured, asynchronous microservices backend engineered for high-throughput food delivery and online ordering platforms. Built with Node.js, Express, TypeScript, PostgreSQL (PostGIS), Redis, RabbitMQ, and Docker Compose, it provides an enterprise-ready foundation for managing real-time restaurant orders, geospatial location tracking, and secure payment processing.

---

## 🏗️ Architecture Overview

The system is organized into modular services communicating via internal Docker DNS networks and asynchronous event messaging:

```text
                          ┌──────────────────────────┐
                          │   Client / Frontend      │
                          └─────────────┬────────────┘
                                        │
                         ┌──────────────┴──────────────┐
                         │                             │
                         ▼                             ▼
              ┌─────────────────────┐       ┌─────────────────────┐
              │    Core Service     │       │    Order Service    │
              │  (Auth, Users, REST)│       │  (Orders, Kashier)  │
              └──────────┬──────────┘       └──────────┬──────────┘
                         │                             │
        ┌────────────────┼─────────────────────────────┼────────────────┐
        │                │                             │                │
        ▼                ▼                             ▼                ▼
┌──────────────┐ ┌──────────────┐             ┌──────────────┐ ┌──────────────┐
│  PostgreSQL  │ │    Redis     │             │  RabbitMQ    │ │ Kashier API  │
│  (PostGIS)   │ │  (Caching)   │             │ (Events/AMQP)│ │ (Payments)   │
└──────────────┘ └──────────────┘             └──────────────┘ └──────────────┘
```

---

## 🛠️ Tech Stack & Key Features

* **Node.js, Express & TypeScript:** Strongly typed, multi-stage Dockerized microservices.
* **PostgreSQL & PostGIS:** Relational data persistence with spatial capabilities for location-based features.
* **Redis:** In-memory caching and session state management for performance optimization.
* **RabbitMQ (AMQP):** Asynchronous event-driven messaging for service decoupling.
* **Kashier Payment Gateway:** Integration with Kashier REST APIs for secure payment workflows.
* **Docker & Docker Compose:** Orchestrated container environment with service health check dependencies (`depends_on`).

---

## 🟡 Deployment Status

> **Status:** 🛠️ **Deployment in Progress**  
> Containerized architecture and multi-stage Docker Compose orchestrations are fully functional locally. Cloud infrastructure setup and CI/CD deployment pipelines are currently underway.

---

## 🚀 Running Locally

### Prerequisites
* Docker Desktop & Docker Compose
* Node.js v20+ / v22+

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yara-e/quickbite-microservices.git
   cd quickbite-microservices
   ```

2. **Configure environment variables:**
   Refer to `.env.example` inside `core-service` and `order-service`.

3. **Build and launch all services via Docker Compose:**
   ```bash
   docker compose up -d --build
   ```

4. **Verify service health status:**
   ```bash
   docker compose ps
   ```

5. **Access local health endpoints:**
   * **Core Service:** `http://localhost:3000/api/health`
   * **Order Service:** `http://localhost:4000/api/health`
