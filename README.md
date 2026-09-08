# Blue Royal HRMS

Enterprise Human Resource Management System built with a modular monolith architecture.

## Architecture & Technology Stack

- **Backend:** Node.js 22 LTS, Express.js, TypeScript (strict mode), Sequelize ORM
- **Database:** PostgreSQL 17 (migrations and seeders isolated in `database/`)
- **Frontend:** Angular 19+ (standalone components, Signals, RxJS)
- **API Contracts:** Shared TypeScript DTOs and contracts in `packages/contracts`
- **Security:** Stateless JWT + rotating HttpOnly Refresh Tokens, granular RBAC (`resource:action`)
- **Observability:** Structured Winston logging with `X-Correlation-ID` tracing, append-only `audit_logs`

---

## Workspace Structure

```
HRMS/
├── database/            # Dedicated migration and seeder lifecycle tooling (Umzug)
├── packages/contracts/  # Shared API contracts and DTO types
├── backend/             # Node.js + Express API application
├── frontend/            # Angular standalone frontend application
├── docs/                # Architecture, database, and API specifications
└── docker/              # Containerization and production deployment assets
```

---

## Quick Start (Development)

### 1. Prerequisites

- Node.js `v22.x` (LTS)
- npm `v11.x`
- PostgreSQL 17 running locally on port `5432`

### 2. Installation

```bash
npm install
```

### 3. Database Setup (Migrations & Seeders)

Ensure your PostgreSQL credentials in `backend/.env` are correct, then run:

```bash
# Check migration status
npm run db:status

# Run pending migrations
npm run db:migrate

# Seed baseline roles, permissions, and initial admin
npm run db:seed
```

### 4. Running the Development Servers

```bash
# Start both backend and frontend concurrently
npm run dev

# Or start individually:
npm run dev:backend   # API at http://localhost:3000
npm run dev:frontend  # UI at http://localhost:4200
```

### 5. API Documentation

Open your browser and navigate to:

```
http://localhost:3000/api/docs
```

---

## Testing & Quality Assurance

```bash
# Run all workspace test suites
npm run test

# Run linter
npm run lint

# Check formatting
npm run format:check
```

---

## Production Deployment & Migration Policy

> **CRITICAL POLICY:** Database migrations **NEVER** run automatically during API application startup.

1. **Database Migration Step:**
   ```bash
   npm run db:migrate
   # Or via Docker:
   docker compose run --rm migration
   ```
2. **Deploy Application Instances:**
   Deploy backend and frontend services only after the migration step has exited with exit code 0.
