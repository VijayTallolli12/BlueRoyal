# Blue Royal HRMS - Target Foundation & System Architecture

**Document ID:** `DOC-ARCH-FINAL-001`  
**Date:** 2026-09-08  
**Status:** Ready for Phase 0 Implementation  
**Target Scope:** Phase 0 (Foundation & Infrastructure) to Production Deployment

---

## 1. System Overview & Core Architectural Principles

The **Blue Royal HRMS** is an enterprise-grade Human Resource Management System engineered for high reliability, maintainability, regulatory auditability, and modular extensibility.

### Guiding Principles

1. **Modular Monolith Architecture:**
   - Single cohesive codebase with strict internal module boundaries.
   - Modules communicate via well-defined public service interfaces, never via direct internal model/table tampering across module boundaries.
   - Avoids the premature operational complexity, distributed transactions, network latency, and infrastructure overhead of microservices, while remaining cleanly organized for future extraction if scale demands it.

2. **API-First & Headless Business Logic:**
   - All business logic, validations, calculations, workflows, and state transitions reside **exclusively in the backend Service layer**.
   - Angular frontend and future mobile apps act strictly as presentation and user-interaction layers consuming RESTful JSON APIs.
   - Business rules must never be placed in frontend components/services or in backend HTTP controllers.

3. **Database Migration & Seeder Driven:**
   - Zero manual SQL execution in staging or production.
   - All schema modifications are version-controlled, reversible, and executed via migrations.
   - Migrations are strictly **immutable** once committed to version control; corrections or adjustments are made via subsequent migrations.
   - Baseline reference data is loaded via deterministic, idempotent seeders.

4. **Zero Dead Code & No Premature Placeholders:**
   - We do not create empty stub modules for business domains (Employee, Payroll, Attendance, Leave, etc.) before their functional requirements and data contracts are formally specified.
   - Phase 0 implements only foundational infrastructure: configuration, database connection, migration/seeding tooling, authentication/RBAC primitives, logging, auditing, API routing engine, base error handler, and health checks.

5. **Pragmatic Version Management:**
   - Specific framework versions are not permanent architectural constraints.
   - At implementation time, currently supported compatible stable versions are selected and pinned deterministically in `package.json` and `package-lock.json`.

---

## 2. Repository Structure & Workspace Configuration

The project uses an npm workspaces monorepo structure. Each top-level package has dedicated ownership, dependencies, and clear lifecycle boundaries.

### 2.1 Workspace Configuration (`package.json`)

The root `package.json` coordinates all workspaces with exact matching paths:

```json
{
  "name": "blue-royal-hrms",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["packages/*", "backend", "frontend", "database"],
  "scripts": {
    "dev": "concurrently \"npm run dev --workspace=backend\" \"npm run dev --workspace=frontend\"",
    "dev:backend": "npm run dev --workspace=backend",
    "dev:frontend": "npm run dev --workspace=frontend",
    "build": "npm run build --workspaces",
    "build:backend": "npm run build --workspace=backend",
    "build:frontend": "npm run build --workspace=frontend",
    "build:contracts": "npm run build --workspace=packages/contracts",
    "test": "npm run test --workspaces",
    "test:backend": "npm run test --workspace=backend",
    "test:frontend": "npm run test --workspace=frontend",
    "lint": "npm run lint --workspaces",
    "db:migrate": "npm run migrate --workspace=database",
    "db:migrate:undo": "npm run migrate:undo --workspace=database",
    "db:seed": "npm run seed --workspace=database",
    "db:status": "npm run status --workspace=database"
  }
}
```

### 2.2 Repository Tree

```
HRMS/
├── .github/                      # CI/CD pipelines (lint, test, build, migration job, container build)
├── .vscode/                      # Recommended extensions, settings, debugger launch tasks
├── docs/                         # System documentation
│   ├── architecture/
│   │   ├── PROJECT_BASELINE.md   # Host environment & tooling assessment
│   │   └── FINAL_ARCHITECTURE.md # System architecture specification (this document)
│   ├── api/                      # OpenAPI / Swagger contracts and documentation
│   └── database/                 # ERDs, schema dictionaries, and data models
├── database/                     # Dedicated Database Lifecycle Tooling Workspace
│   ├── migrations/               # Version-controlled, immutable database migration files
│   ├── seeders/                  # Idempotent master data seeders (confirmed roles, permissions, admin)
│   ├── factories/                # Data factories for testing and development fixtures
│   ├── scripts/                  # Migration CLI runner, rollback utilities, DB sanity scripts
│   ├── tsconfig.json             # TypeScript config for database tooling
│   └── package.json              # Dedicated dependencies: Umzug, Sequelize QueryInterface, pg
├── packages/                     # Shared Cross-Tier Packages
│   └── contracts/                # Shared API Contracts & DTOs
│       ├── src/
│       │   ├── auth/             # Login/Refresh request/response contracts
│       │   ├── common/           # Standard API response envelopes, pagination schemas, error formats
│       │   └── index.ts          # Public barrel export for contracts
│       ├── tsconfig.json
│       └── package.json
├── backend/                      # Node.js + Express + TypeScript Backend API Application
│   ├── src/
│   │   ├── config/               # Environment parsing and schema validation (Zod)
│   │   ├── core/                 # Shared Kernel (Cross-cutting infrastructure)
│   │   │   ├── database/         # Runtime Database Infrastructure (Sequelize owns connection pool)
│   │   │   │   ├── sequelize.ts  # Sequelize setup, pool configuration, lifecycle & model registry
│   │   │   │   ├── transactions.ts # Managed transaction wrappers and helper utilities
│   │   │   │   └── base.model.ts # Base model class with common attributes (UUID, timestamps)
│   │   │   ├── errors/           # Custom AppError hierarchy & HTTP status mappings
│   │   │   ├── middleware/       # Auth, RBAC, Zod validation, request context, rate limiting
│   │   │   ├── logger/           # Structured Winston logger & correlation ID tracing
│   │   │   ├── audit/            # Regulatory audit trail logger & event publisher
│   │   │   └── utils/            # Crypto, date helpers, response formatters
│   │   ├── modules/              # Domain Modules (Modular Monolith)
│   │   │   ├── health/           # Liveness/readiness health-check module
│   │   │   └── auth/             # Authentication & session management module
│   │   │   # (Business modules: employee, attendance, leave, payroll added sequentially in Phase 1+)
│   │   ├── app.ts                # Express application setup & middleware assembly
│   │   └── server.ts             # HTTP server entry point & graceful shutdown hooks
│   ├── tests/
│   │   ├── unit/                 # Unit tests (isolated domain logic & helpers)
│   │   └── integration/          # API integration tests (Supertest + test database)
│   ├── .env.example              # Documented environment variables template
│   ├── tsconfig.json             # Backend TypeScript compiler configuration
│   └── package.json              # Backend dependencies and scripts
├── frontend/                     # Angular Single Page Application
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/             # Singleton services (Auth, Token, Interceptors, Guards, API client)
│   │   │   │   ├── guards/       # AuthGuard, PermissionGuard
│   │   │   │   ├── interceptors/ # AuthTokenInterceptor, ErrorInterceptor, CorrelationIdInterceptor
│   │   │   │   └── services/     # AuthService, StorageService, NotificationService
│   │   │   ├── shared/           # Reusable UI components, pipes, directives, display models
│   │   │   ├── layout/           # App shell (Header, Sidebar, Navigation, Footer, Breadcrumbs)
│   │   │   ├── features/         # Feature views (lazy-loaded standalone components)
│   │   │   │   ├── auth/         # Login, Password Reset views
│   │   │   │   └── dashboard/    # System Landing & Overview
│   │   │   ├── app.routes.ts     # Root route definitions with lazy loading
│   │   │   ├── app.config.ts     # Standalone application configuration (providers, HTTP, animations)
│   │   │   └── app.component.ts  # Root shell component
│   │   ├── environments/         # Angular environment configurations (dev, staging, prod)
│   │   ├── styles/               # Global styling and design system tokens
│   │   ├── index.html
│   │   └── main.ts
│   ├── tsconfig.json             # Angular TypeScript compiler configuration
│   ├── angular.json              # Angular workspace configuration
│   └── package.json              # Frontend dependencies and scripts
├── docker/                       # Containerization assets
│   ├── Dockerfile.backend        # Multi-stage production build for Node backend
│   ├── Dockerfile.frontend       # Multi-stage production build (Angular build -> Nginx runtime)
│   ├── Dockerfile.migration      # Dedicated migration container for CI/CD deployment jobs
│   └── nginx.conf                # Nginx reverse proxy configuration for frontend SPA
├── docker-compose.yml            # Local development orchestration (DB + Backend + Frontend)
├── docker-compose.prod.yml       # Production-ready composition
├── .gitignore                    # Comprehensive ignore rules
├── package.json                  # Root monorepo workspace orchestrator
└── README.md                     # Project onboarding and developer handbook
```

---

## 3. Node.js Backend Architecture

### 3.1 Framework & Runtime

- **Runtime:** Node.js 22 LTS (active LTS supported at implementation time).
- **Language:** TypeScript with strict type checking (`strict: true`, `noImplicitAny: true`).
- **Web Framework:** Express.js (lightweight, predictable, minimal magic).
- **Execution Model:** Layered Clean Architecture within each domain module.

### 3.2 Strict Layering & Separation of Concerns

Each domain module enforces clear boundaries:

```
[ HTTP Request ]
       │
       ▼
[ Route Definition ]  ──> Attaches Auth, RBAC & Schema Validation Middleware
       │
       ▼
[ Controller ]         ──> Extracts inputs, calls Service, wraps in Standard Envelope
       │                   (NO business rules allowed here)
       ▼
[ Service ]            ──> 100% OF BUSINESS LOGIC, Calculations, Workflows,
       │                   Transactions, Event Triggers, Audit Records
       ▼
[ Repository / Model ] ──> Data Access, Sequelize ORM queries, PostgreSQL constraints
       │
       ▼
[ PostgreSQL 17 DB ]
```

1. **Routing Layer (`*.routes.ts`):**
   - Declarative route mapping and middleware chaining.
   - Ensures all incoming requests pass authentication, permission verification, and schema validation before reaching controllers.

2. **Controller Layer (`*.controller.ts`):**
   - Extracts typed inputs (`req.params`, `req.query`, `req.body`, `req.user`).
   - Delegates directly to domain services.
   - Formats responses using the standard API response envelope.
   - **Prohibited in Controllers:** Direct database queries, business policy decisions, or data mutation algorithms.

3. **Service Layer (`*.service.ts`):**
   - **Contains all business rules, policies, workflows, calculations, and state transitions.**
   - Throws semantic domain errors (`AppError`, `ConflictError`, `ValidationError`, `NotFoundError`).
   - Manages transactional boundaries using `runInTransaction`.
   - Dispatches audit events to the audit logging subsystem.

4. **Data Access Layer (`*.model.ts`):**
   - Defines Sequelize model attributes, types, relations, and table constraints.
   - Encapsulates scoped queries and database-level operations.

---

## 4. Angular Frontend Architecture

### 4.1 Framework & Paradigm

- **Paradigm:** Standalone components (no `NgModule` boilerplate).
- **Reactivity Model:** Modern Angular **Signals** for local component state and UI reactivity, combined with **RxJS** for asynchronous HTTP calls and event streams.
- **Routing:** Component-level lazy loading (`loadComponent` / `loadChildren`) ensuring small initial bundles and fast load times.

### 4.2 Presentation-Only Boundary

- The frontend is strictly a presentation and user interaction layer.
- **Prohibited in Angular:** Re-implementing backend business rules, payroll/leave entitlement calculation formulas, or authorization enforcement. Frontend guards provide UX guidance, while backend middleware strictly guarantees security.

### 4.3 Structure

1. **Core (`app/core/`):**
   - Singleton HTTP interceptors:
     - `auth.interceptor.ts`: Attaches Bearer JWT token; coordinates 401 refresh token flow.
     - `correlation.interceptor.ts`: Generates and propagates `X-Correlation-ID`.
     - `error.interceptor.ts`: Centralizes API error notification handling.
   - Route guards (`auth.guard.ts`, `permission.guard.ts`).
2. **Shared (`app/shared/`):**
   - Pure, reusable UI components (data tables, modal dialogs, status badges, form controls).
3. **Features (`app/features/`):**
   - Isolated feature modules organized by user journey, lazy-loaded on demand (`auth/` with login and password reset views; `dashboard/`).

---

## 5. Dedicated Database Architecture & Lifecycle Tooling

Database infrastructure is strictly divided into two distinct concerns:

### 5.1 Application Runtime Database Infrastructure (`backend/src/core/database/`)

- `sequelize.ts`: Initializes the Sequelize ORM instance and **exclusively manages the database connection pool** (`min: 2`, `max: 20`, `idle: 10000ms`, `acquire: 30000ms`). No secondary `pg` pool is maintained alongside Sequelize. Exposes connection health check and teardown hooks.
- `transactions.ts`: Provides a managed transaction wrapper (`runInTransaction`) ensuring all multi-entity operations either commit atomically or roll back cleanly.
- `base.model.ts`: Abstract base model providing common attributes (`id` as UUID, `created_at`, `updated_at`, `deleted_at`).

### 5.2 Database Lifecycle Tooling (`database/`)

All migration, seeding, and database provisioning tooling lives in its own dedicated workspace:

- `database/migrations/`: Timestamped migration files (`YYYYMMDDHHMMSS-action.ts`).
- `database/seeders/`: Idempotent seeders for reference data (`01-permissions.ts`, `02-roles.ts`, `03-admin.ts`).
- `database/factories/`: Test data generators for development and integration test fixtures.
- `database/scripts/`: Migration CLI runners using Umzug and Sequelize QueryInterface.

### 5.3 Production Migration Execution Policy

> [!IMPORTANT]
> **Production database migrations must NEVER run automatically during API application startup.**
>
> - Auto-running migrations on server startup causes race conditions during multi-instance rolling deployments, risks partial rollouts, and violates separation of privilege.
> - **Production Deployment:** Migrations execute as a **dedicated deployment step/job** (e.g. CI/CD pre-rollout job, Kubernetes Helm pre-upgrade hook, or dedicated migration runner container) _before_ the new API version is deployed.
> - **Development:** Developers execute migrations explicitly via `npm run db:migrate`.

### 5.4 Migration Immutability

- Once a migration is merged into source control and executed against staging or production, it is **strictly immutable**.
- Modifying historical migration files is prohibited. Any schema alteration, correction, or rollback must be performed by authoring a new forward-moving migration file.

---

## 6. Shared Contracts (`packages/contracts`)

To guarantee that backend API payloads, frontend consumers, and future mobile applications never drift out of sync:

- `packages/contracts` contains shared TypeScript interfaces, request/response DTO contracts, and shared Zod validation schemas.
- Both `backend` and `frontend` import from `@blue-royal/contracts` via npm workspaces.
- Future mobile applications (Flutter/React Native) can generate client models directly from these contracts or exported OpenAPI specifications.

---

## 7. API Architecture & Versioning Strategy

### 7.1 Versioning

- URL prefix versioning: `/api/v1/` (e.g., `/api/v1/auth/login`, `/api/v1/health`).
- Breaking contract changes require a new version segment (`/api/v2/`).

### 7.2 Standard Response Envelope

All API endpoints return a uniform response envelope:

**Success (200, 201):**

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "correlationId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "timestamp": "2026-09-08T12:00:00.000Z",
    "pagination": {
      "page": 1,
      "limit": 25,
      "totalItems": 100,
      "totalPages": 4
    }
  }
}
```

**Error (400, 401, 403, 404, 409, 422, 500):**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The request payload failed validation checks.",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format."
      }
    ]
  },
  "meta": {
    "correlationId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "timestamp": "2026-09-08T12:00:00.000Z"
  }
}
```

---

## 8. Authentication & RBAC Strategy

### 8.1 Dual-Token Authentication

- **Access Token:** Short-lived (15 minutes), stateless JWT containing `userId` and active `roleId`, passed in `Authorization: Bearer <token>`.
- **Refresh Token:** Long-lived (7 days), stored securely in an `HttpOnly`, `SameSite=Strict`, `Secure` cookie. Stored hashed in the database session table to support immediate revocation.
- **Passwords:** Hashed using `bcrypt` (cost factor 12) or `argon2id`.
- **MFA Policy:** MFA is **not** implemented in Phase 0. The authentication architecture remains cleanly extensible to support MFA in future phases if required, without building unused MFA endpoints or UI views now.

### 8.2 Role-Based Access Control (RBAC)

- **Confirmed System Roles:** The system initializes ONLY the following confirmed roles:
  1. **Super Admin**
  2. **HR Admin**
  3. **Employee**
     _(No Line Manager, Department Manager, or unconfirmed business roles will be seeded or hardcoded as defaults)._
- **Extensible Role Design:** The RBAC schema supports dynamic addition of new organizational roles without requiring schema migrations:
  - `users`: User identity and credentials.
  - `roles`: System and organizational roles (`super_admin`, `hr_admin`, `employee`).
  - `permissions`: Atomic action definitions following `resource:action` format (e.g., `auth:read`, `system:configure`).
  - `role_permissions`: Mapping of roles to allowed permissions.
  - `user_roles`: User role assignments.
- Enforced at route level via `requirePermission('resource:action')` middleware.

---

## 9. Validation & Error Handling

### 9.1 Request Validation

- All incoming payloads (`body`, `query`, `params`) are validated at the middleware layer using **Zod** schemas.
- Payloads failing validation are rejected with HTTP 422 before invoking any controller or service code.

### 9.2 Centralized Error Handling Hierarchy

- Custom application error classes:
  - `AppError` (base operational error)
  - `ValidationError` (422)
  - `AuthenticationError` (401)
  - `AuthorizationError` (403)
  - `NotFoundError` (404)
  - `ConflictError` (409)
  - `RateLimitError` (429)
  - `InternalServerError` (500)
- Unhandled rejections are caught by the global Express error handler: logged with full stack trace and correlation ID; client receives a sanitized `INTERNAL_SERVER_ERROR` without internal leakage.

---

## 10. Observability: Logging & Audit Trail

### 10.1 Application Logging

- Structured JSON logging via **Winston**.
- Every request is tagged with an `X-Correlation-ID` (UUIDv4) that propagates through all logs and database operations.
- Outputs structured logs to stdout for container log collection and rotating log files for local debugging.

### 10.2 Regulatory Audit Logging

- Dedicated, **append-only** `audit_logs` table.
- Captures: `actor_id`, `actor_ip`, `user_agent`, `action`, `resource_type`, `resource_id`, `old_values` (JSONB), `new_values` (JSONB), `created_at`.
- Guaranteed audit records for all sensitive operations.

---

## 11. Testing Strategy

- **Unit Tests:** Pure domain logic, salary math, date calculations, validation schemas in isolation.
- **Integration Tests:** API endpoint contracts via Supertest against an isolated PostgreSQL test database with transactional rollback.
- **E2E Tests:** Critical business flows via Playwright/Cypress.

---

## 12. Docker & Deployment Strategy

- **Backend:** Multi-stage `Dockerfile.backend` compiling TypeScript and running a lightweight Node production container.
- **Frontend:** Multi-stage `Dockerfile.frontend` compiling Angular and serving through Nginx Alpine.
- **Dedicated Migration Runner:** `Dockerfile.migration` containing the `database/` workspace tooling to execute migrations in CI/CD before rolling out API updates.
- **Docker Compose:** `docker-compose.yml` provides a unified local environment running PostgreSQL, Backend API, and Frontend.

---

## 13. Phase 0 Implementation Plan

Phase 0 establishes the verified system foundation without business modules:

1. **Step 0.1 — Repository & Workspace Foundation:**
   - Initialize Git repository and `.gitignore`.
   - Setup root `package.json` with npm workspaces (`packages/*`, `backend`, `frontend`, `database`).
   - Setup unified root ESLint and Prettier configurations.

2. **Step 0.2 — Shared Contracts Workspace (`packages/contracts`):**
   - Initialize package with `tsconfig.json`.
   - Implement base API response envelopes, standard error schemas, pagination types, and health check contract.

3. **Step 0.3 — Dedicated Database Workspace (`database/`):**
   - Initialize package with `tsconfig.json`, Umzug migration runner, and CLI scripts (`migrate`, `migrate:undo`, `seed`, `status`).
   - Implement initial baseline migration: `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, and `audit_logs`.
   - Implement initial idempotent seeders for confirmed roles (`super_admin`, `hr_admin`, `employee`) and baseline permissions.

4. **Step 0.4 — Backend Foundation (`backend/`):**
   - Initialize Express application with TypeScript.
   - Configure environment loader with Zod validation.
   - Setup `backend/src/core/database/` with `sequelize.ts` (owning connection pool), `transactions.ts`, and `base.model.ts`.
   - Setup Winston logger with `X-Correlation-ID` middleware.
   - Setup AppError hierarchy and global Express error handling middleware.
   - Implement `/api/v1/health` endpoint validating active database connectivity via Sequelize.

5. **Step 0.5 — Frontend Foundation (`frontend/`):**
   - Scaffold clean Angular standalone application.
   - Configure core HTTP client, environment configuration, correlation ID interceptor, and global error interceptor.
   - Setup minimal application shell layout (header/nav) and routing.

6. **Step 0.6 — Verification & Baseline Sign-Off:**
   - Run `npm run db:migrate` via database workspace and verify tables created in PostgreSQL 17.
   - Run `npm run db:seed` and verify default roles and permissions.
   - Boot backend API and verify `GET /api/v1/health` returns `200 OK` with database health.
   - Serve frontend and verify successful health check communication with backend.
   - Commit verified baseline.
