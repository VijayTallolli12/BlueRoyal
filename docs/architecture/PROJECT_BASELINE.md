# Blue Royal HRMS - Baseline Environment & Tooling Assessment

**Document ID:** `DOC-ARCH-BASELINE-001`  
**Date:** 2026-09-08  
**Status:** Ready for Phase 0 Implementation  
**Workspace:** `F:\Folkslogic\blue-royal\HRMS`

---

## 1. Executive Summary

This document establishes the technical baseline and environment assessment for the **Blue Royal HRMS** project as mandated by `Master.md`. The project is a new, production-grade enterprise Human Resource Management System.

An exhaustive inspection of the host environment was performed on 2026-09-08. The assessment below details the host infrastructure, operational readiness, gaps, and foundational tooling established for Phase 0 initialization.

---

## 2. Environment Inspection Findings

| #      | Inspection Category          | Current Detected State                                                                                                                                   | Operational Status         | Assessment / Action Required                                                                                                                                                                                        |
| ------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**  | **Operating System & Shell** | Windows 11 / Windows Server (64-bit), PowerShell 5.1                                                                                                     | Active                     | Host environment is Windows. Path handling must use cross-platform path resolution (`path.join` / POSIX path conventions) and avoid Windows-specific shell commands in build scripts.                               |
| **2**  | **Node.js**                  | `v22.16.0` (Active LTS)                                                                                                                                  | Ready                      | Active LTS provides native fetch, WebSocket, ESM support, and high-performance V8 runtime. Suitable for backend execution.                                                                                          |
| **3**  | **Package Manager**          | `npm v11.5.2`                                                                                                                                            | Ready                      | Modern npm with native workspace support (`npm workspaces`). Global prefix at `C:\Users\vijay\AppData\Roaming\npm`.                                                                                                 |
| **4**  | **Angular Availability**     | Available via npm registry; not installed globally                                                                                                       | Action Required            | Angular CLI will be managed locally per-project (in `frontend/package.json`) via npm scripts and `npx ng`. Currently supported compatible stable version will be pinned at implementation time.                     |
| **5**  | **TypeScript**               | Available via npm; not global in PATH                                                                                                                    | Ready via npm              | Configured as explicit `devDependencies` in workspaces to lock exact compiler versions and guarantee deterministic, reproducible builds.                                                                            |
| **6**  | **PostgreSQL**               | `psql (PostgreSQL) 17.11` installed; Windows Service `postgresql-x64-17` **Running**                                                                     | Ready                      | PostgreSQL 17 is active and running locally on standard port (5432). Modern JSONB, transactional DDL, and enterprise features available immediately for local development.                                          |
| **7**  | **Docker / Docker Compose**  | `Docker version 29.6.2`, `Docker Compose v5.3.1` installed; daemon currently stopped                                                                     | Optional / Action Required | CLI is installed. Docker Desktop service is currently stopped. Local development connects directly to active local PostgreSQL 17 service; Docker Compose will be configured for containerized deployment and CI/CD. |
| **8**  | **Git Configuration**        | `git version 2.51.0.windows.1` installed. User configured (`Vijay Tallolli <vijaytallolli@gmail.com>`). Workspace not yet initialized as git repository. | Action Required            | Git repository initialization (`git init`) required in Phase 0 along with comprehensive `.gitignore` for Node/Angular/IDE.                                                                                          |
| **9**  | **Testing Tools**            | None initialized in workspace                                                                                                                            | Action Required            | Test runners (Jest/Vitest + Supertest for backend; test runner for Angular frontend) will be pinned as explicit devDependencies during Phase 0 setup.                                                               |
| **10** | **Linting & Formatting**     | None initialized in workspace                                                                                                                            | Action Required            | ESLint (flat config), Prettier, and git hook scripts will be configured to ensure uniform code quality across all workspaces.                                                                                       |

---

## 3. Workspace Inspection

The workspace currently contains:

- `Master.md`: The governing architectural instructions and master requirements.

**Repository State:**

- Clean state with no legacy source code, avoiding any technical debt.
- No business modules exist yet.
- Ready for clean foundation architecture scaffolding under Phase 0.

---

## 4. Environment Compatibility & Version Management Strategy

- **Version Compatibility at Implementation:** Select currently supported, compatible, and actively maintained stable versions across the stack at implementation time.
- **Deterministic Pinning:** All dependencies and transitive trees are locked deterministically via `package.json` and `package-lock.json`.
- **Target Platform Compatibility:** Target runtime is Node.js 22 LTS with TypeScript 5.x, modern Angular, and PostgreSQL 17.
- **Database Connection Management:** Sequelize exclusively manages the application database connection pool. No secondary connection pool library is maintained.

---

## 5. Architectural Recommendations

1. **Git Initialization:**
   Initialize a clean Git repository with `master` default branch, committing the architecture documentation as the baseline commit.
2. **Workspace Isolation & Consistency:**
   Use npm workspaces (`workspaces: ["packages/*", "backend", "frontend", "database"]`) to maintain strict separation of concerns between shared contracts, backend API, frontend SPA, and database lifecycle tooling.
3. **Database Tooling Separation:**
   Decouple migration, seeding, and database maintenance scripts into an independent `database/` workspace, keeping `backend/src/core/database/` focused purely on Sequelize runtime setup, transaction helpers, and base models.
4. **Independent Migration Execution:**
   Production database migrations must execute as a dedicated deployment step prior to application rollout—never as an automated startup side-effect of the API server.
5. **Tooling Standards:**
   Establish unified ESLint, Prettier, and TypeScript configuration before writing any application code.
