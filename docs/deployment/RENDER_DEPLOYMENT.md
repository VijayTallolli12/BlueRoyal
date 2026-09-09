# BLUE ROYAL HRMS — RENDER PRODUCTION & STAGING DEPLOYMENT RUNBOOK

This guide provides the authoritative, end-to-end procedure for deploying Blue Royal HRMS to Render for Staging, UAT, and Production.

---

## 1. System Architecture on Render

```mermaid
flowchart TB
    User["Client Browser / Mobile Web (HTTPS)"]
    
    subgraph Render["Render Cloud Infrastructure"]
        StaticSite["Frontend Static Site<br/>(Angular 19 SPA)<br/>https://blue-royal-hrms.onrender.com"]
        WebService["Backend Web Service<br/>(Node.js / Express API)<br/>https://blue-royal-hrms-api.onrender.com"]
        ManagedDB[("Render Managed PostgreSQL<br/>(Internal Private Network)")]
        Disk[("Render Persistent Disk<br/>/opt/render/project/src/backend/storage<br/>(Employee Compliance Documents)")]
    end

    User -->|"1. Static Assets & SPA Routing"| StaticSite
    User -->|"2. API Calls & Uploads (/api/v1/...)"| WebService
    WebService -->|"3. Pre-Deploy Migrations & Queries"| ManagedDB
    WebService -->|"4. Document Read / Write"| Disk
```

### Component Isolation & Topology
1. **Frontend Static Site (`blue-royal-hrms`)**:
   - Compiles Angular 19 production bundle.
   - Hosted globally on Render's CDN.
   - SPA rewrite rule (`/*` $\rightarrow$ `/index.html`) ensures full client-side routing on reloads.
2. **Backend Web Service (`blue-royal-hrms-api`)**:
   - Compiled TypeScript runtime on Node.js 22.
   - Listens on Render's dynamic `$PORT`.
   - Exposes authoritative health telemetry at `GET /api/v1/health`.
   - Runs `npm run db:migrate` automatically as a `preDeployCommand` before new versions go live.
3. **Managed PostgreSQL (`blue-royal-postgres`)**:
   - Private connection string (`DATABASE_URL` via Render internal network).
   - Encrypted in transit (`DB_SSL=true`).
   - Zero public port exposure.
4. **Persistent Document Storage**:
   - Attached 10GB persistent disk mounted at `/opt/render/project/src/backend/storage`.
   - Preserves uploaded employee passports, visas, Emirates IDs, and contracts across deploys.

---

## 2. Fast-Track Deployment via Render Blueprint (`render.yaml`)

The repository includes a root `render.yaml` blueprint. To deploy the entire stack in one click:

1. Log in to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** $\rightarrow$ **Blueprint**.
3. Connect your GitHub / GitLab repository (`blue-royal-hrms`).
4. Render will detect `render.yaml` and configure:
   - `blue-royal-postgres` (PostgreSQL database)
   - `blue-royal-hrms-api` (Backend Web Service + Persistent Disk)
   - `blue-royal-hrms` (Frontend Static Site + SPA Rewrites)
5. Click **Apply**.
6. Render will automatically build the packages, run database migrations, attach storage, and launch services.

---

## 3. Manual Step-by-Step Deployment Guide

If configuring services manually through the Render UI, follow this sequence:

### Step 1: Create Managed PostgreSQL Database
1. Go to **New +** $\rightarrow$ **PostgreSQL**.
2. **Name**: `blue-royal-postgres`
3. **Database**: `blue_royal_hrms`
4. **User**: `blue_royal_admin`
5. **Region**: `Oregon (US West)` (choose the same region for all services).
6. **Plan**: `Starter` (or Free for initial sandbox testing).
7. Once provisioned, copy the **Internal Database URL** (e.g. `postgresql://blue_royal_admin:...@dpg-xxx:5432/blue_royal_hrms`).

---

### Step 2: Create Backend Web Service
1. Go to **New +** $\rightarrow$ **Web Service**.
2. Connect your repository.
3. Configure settings:
   - **Name**: `blue-royal-hrms-api`
   - **Region**: Same as database (`Oregon`)
   - **Branch**: `main` (or your staging branch)
   - **Root Directory**: *(Leave empty to use repository root)*
   - **Runtime**: `Node`
   - **Build Command**:
     ```bash
     npm ci && npm run build:contracts && npm run build:database && npm run build:backend
     ```
   - **Start Command**:
     ```bash
     npm run start --workspace=backend
     ```
   - **Plan**: `Starter` (Starter plan is required to attach a persistent disk).

4. **Add Pre-Deploy Command** (Under Advanced Settings):
   - **Pre-Deploy Command**:
     ```bash
     npm run db:migrate
     ```
     *(This ensures migrations are executed safely before the web service traffic switches over)*.

5. **Attach Persistent Disk** (Under Disks):
   - **Name**: `document-storage`
   - **Mount Path**: `/opt/render/project/src/backend/storage`
   - **Size**: `10 GB`

6. **Add Environment Variables**:

| Variable | Recommended Value | Notes |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production optimizations |
| `PORT` | `10000` | Render standard internal port |
| `API_PREFIX` | `/api/v1` | Versioned route root |
| `CORS_ORIGIN` | `https://blue-royal-hrms.onrender.com` | Your frontend Static Site URL |
| `DATABASE_URL` | *(Paste Internal DB URL from Step 1)* | Direct internal connection |
| `DB_SSL` | `true` | Enforces SSL encryption |
| `STORAGE_PATH` | `storage/documents` | Resolves inside mounted disk |
| `COOKIE_SAME_SITE` | `none` | Required for cross-subdomain Render hosting |
| `COOKIE_SECURE` | `true` | Enforces HTTPS cookie transmission |
| `JWT_ACCESS_SECRET` | *(Generate via `openssl rand -hex 32`)* | Min 32 characters |
| `JWT_REFRESH_SECRET` | *(Generate via `openssl rand -hex 32`)* | Min 32 characters |
| `LOG_LEVEL` | `info` | Structured application logging |

7. **Health Check Path**:
   - Set to `/api/v1/health`.

8. Click **Create Web Service**.

---

### Step 3: Seed Initial Database (One-Time Setup)
After the backend and database are live for the first time, seed the default roles, permissions, designations, and initial Super Admin account:

1. Open the **Shell** tab in the `blue-royal-hrms-api` service in Render dashboard.
2. Run:
   ```bash
   npm run db:seed
   ```
3. Default credentials created:
   - **Email**: `admin@blueroyal.com`
   - **Password**: `Admin@123456` *(Change immediately upon first login)*

---

### Step 4: Create Frontend Static Site
1. Go to **New +** $\rightarrow$ **Static Site**.
2. Connect your repository.
3. Configure settings:
   - **Name**: `blue-royal-hrms`
   - **Branch**: `main`
   - **Root Directory**: *(Leave empty)*
   - **Build Command**:
     ```bash
     npm ci && npm run build:contracts && npm run build:frontend
     ```
   - **Publish Directory**:
     ```
     frontend/dist/blue-royal-hrms/browser
     ```

4. **Configure Client-Side SPA Rewrite Rules** (Under Redirects/Rewrites):
   - **Type**: `Rewrite`
   - **Source**: `/*`
   - **Destination**: `/index.html`

5. Click **Create Static Site**.

---

## 4. Cross-Origin Architecture & Authentication Details

When hosting on Render default subdomains (`*.onrender.com`):

### Why `COOKIE_SAME_SITE=none` & `COOKIE_SECURE=true`?
- `onrender.com` is listed on the **Public Suffix List (PSL)**.
- Browsers treat `blue-royal-hrms.onrender.com` (frontend) and `blue-royal-hrms-api.onrender.com` (backend) as **cross-site**.
- To ensure the `refreshToken` HttpOnly cookie is transmitted securely during `/api/v1/auth/refresh` and `/api/v1/auth/login`, `sameSite: 'none'` with `secure: true` is strictly enforced over HTTPS.
- Access tokens are passed via standard `Authorization: Bearer <token>` headers by Angular's HTTP interceptor.

---

## 5. Employee Document Storage & Future Object Storage Migration

### Current Staging / Production Setup:
- Render mounts a block storage disk to `/opt/render/project/src/backend/storage`.
- Documents are partitioned by employee UUID: `storage/documents/<employeeId>/<documentUuid>.<ext>`.
- Files are **never** exposed statically through Nginx or the web server.
- All access is strictly gated through authenticated and RBAC-authorized endpoints:
  - `POST /api/v1/documents` (Upload)
  - `GET /api/v1/documents/:id/download` (Download stream with audit logging)

### Future Object Storage Migration (S3 / Cloudflare R2 / MinIO):
The backend storage abstraction in [`document.service.ts`](file:///f:/Folkslogic/blue-royal/HRMS/backend/src/modules/documents/services/document.service.ts) is fully encapsulated:
1. `saveUploadedFile()` stores file bytes and returns a URI key.
2. `getDownloadInfo()` resolves the binary resource for authorized streaming.
3. Migrating to S3/R2 in future phases will only require implementing a cloud storage adapter (`S3Client.send(PutObjectCommand)`) without modifying any database tables, models, or UI flows.

---

## 6. Zero-Downtime Releases & Migration Lifecycle

When new code is pushed to your Git branch:

```mermaid
sequenceDiagram
    autonumber
    actor Developer
    participant Git as GitHub Repository
    participant Render as Render Deployment Pipeline
    participant DB as Managed PostgreSQL
    participant Backend as Backend Web Service
    participant Frontend as Frontend Static Site

    Developer->>Git: git push origin main
    Git->>Render: Webhook Trigger
    Render->>Render: Run Build Commands
    Note over Render: npm run build:contracts<br/>npm run build:backend
    Render->>DB: Execute Pre-Deploy Migrations (npm run db:migrate)
    alt Migration Successful
        DB-->>Render: Schema Up to Date
        Render->>Backend: Start new container instance
        Backend->>Backend: Health Check (/api/v1/health)
        Render->>Backend: Route production traffic to new instance
        Render->>Frontend: Deploy updated static bundle
    else Migration Fails
        DB-->>Render: Migration Error
        Render->>Developer: Halt deployment, previous version remains live
    end
```

---

## 7. Post-Deployment Verification Checklist

Execute these checks after deployment completes:

- [ ] **Health Endpoint**: Navigate to `https://<backend-url>/api/v1/health` $\rightarrow$ Expect `{"status": "healthy", "components": {"database": {"status": "healthy"}}}`.
- [ ] **SPA Routing**: Open `https://<frontend-url>/login` directly $\rightarrow$ Ensure page renders without 404.
- [ ] **Authentication**: Log in as `admin@blueroyal.com` $\rightarrow$ Confirm successful dashboard redirect.
- [ ] **Token Refresh**: Wait 15 minutes or trigger refresh $\rightarrow$ Confirm session remains active.
- [ ] **Employee Onboarding**: Navigate to `/onboarding` $\rightarrow$ Verify 5 readiness pillars render.
- [ ] **Document Upload**: Upload a sample PDF in `/documents` $\rightarrow$ Confirm file writes to persistent disk.
- [ ] **Document Download**: Download uploaded document $\rightarrow$ Confirm bytes match original file.
- [ ] **Workforce Catalogs**: Open `/masters?tab=assignments` $\rightarrow$ Verify client/project deployment tables load.
- [ ] **Attendance & Payroll**: Open `/attendance` and `/payroll` $\rightarrow$ Confirm calculations and periods display accurately.
