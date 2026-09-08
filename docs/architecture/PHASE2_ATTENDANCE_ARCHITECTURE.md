# Blue Royal HRMS — Phase 2 Attendance & Overtime Architecture Specification (Revised)

**Document ID:** `DOC-ARCH-PHASE2-ATT-002`  
**Date:** 2026-09-09  
**Scope:** Phase 2 Attendance Domain, Excel Ingestion, Shift-Aware Working Hour & OT Calculation, Approval/Lock Lifecycle, and Self-Service  
**Governing Documents:** `Master.md`, `FINAL_ARCHITECTURE.md`, `docs/modules/phase-1-plan.md`  
**Status:** **Architectural Design Plan — Revised per Requirements Review**  

---

## 1. Attendance Domain Boundaries & Core Invariants

The **Attendance Module** in Blue Royal HRMS is the authoritative operational registry of daily labor time delivered by company workers across client projects and internal deployments.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 ATTENDANCE DOMAIN BOUNDARY                             │
│                                                                                        │
│   HR Timekeepers & Excel Uploads                                                       │
│                │                                                                       │
│                ▼                                                                       │
│     [ Actual Hours Worked ] (Input Only)                                               │
│                │                                                                       │
│                ▼                                                                       │
│   ┌──────────────────────────────────────────────────────────────────────────────┐     │
│   │            POINT-IN-TIME BACKEND CALCULATION ENGINE                          │     │
│   │                                                                              │     │
│   │  * Shift Normal Hours (from effective-dated employee_shift_assignments)      │     │
│   │  * Weekly Off Schedule (from effective-dated weekly_off_configs)             │     │
│   │  * Public Holiday Calendar (from company-configured public_holidays)         │     │
│   │  * Historical Snapshot (from employee_assignments: Client + Project + Desig) │     │
│   └──────────────────────────────────────┬───────────────────────────────────────┘     │
│                                          │                                             │
│                     ┌────────────────────┴────────────────────┐                        │
│                     ▼                                         ▼                        │
│           [ Regular Hours ]                           [ OT Hours ]                     │
│                     │                                         │                        │
└─────────────────────┼─────────────────────────────────────────┼────────────────────────┘
                      │                                         │
     Operational Data │ Only (Zero Money)      Operational Data │ Only (Zero Money)
                      ▼                                         ▼
   ┌─────────────────────────────────────┐   ┌────────────────────────────────────────┐
   │    PHASE 4: PAYROLL ENGINE (COST)   │   │   FUTURE COMMERCIAL BILLING (REVENUE)  │
   ├─────────────────────────────────────┤   ├────────────────────────────────────────┤
   │ Multiplies by:                      │   │ Multiplies by:                         │
   │  - employee_hourly_rates.normal     │   │  - client_billing_rates.normal         │
   │  - employee_hourly_rates.ot         │   │  - client_billing_rates.ot             │
   └─────────────────────────────────────┘   └────────────────────────────────────────┘
```

### Core Invariants & Business Rules
1. **Raw Input vs. Calculated State:** HR enters **strictly Actual Hours Worked** (`actual_hours`). The backend deterministically derives **Regular Hours** (`regular_hours`) and **Overtime Hours** (`ot_hours`).
2. **Zero Financial Derivation in Attendance:** Attendance records hold **no currency, wage rates, or billing figures**. Attendance is pure operational data consumed independently downstream by Payroll (Phase 4) and Commercial Invoicing.
3. **Point-in-Time Historical Snapshots:** `client_id`, `project_id`, `designation_id`, and `shift_id` stored on daily records are **historical context snapshots** resolved from effective-dated masters for the exact work date. They are **not** independent editable master values. Later changes to assignments or shift rosters must never mutate historical attendance context.
4. **Day-Type Derivation Hierarchy:**
   - **Public Holiday Worked:** All hours worked are classified as **OT Hours** (`regular_hours = 0.00`, `ot_hours = actual_hours`).
   - **Weekly Off Worked:** All hours worked are classified as **OT Hours** (`regular_hours = 0.00`, `ot_hours = actual_hours`).
   - **Public Holiday without Work:** Company-configured holiday rest day, **not an absence** (`regular_hours = 0.00`, `ot_hours = 0.00`, `is_absent = false`).
   - **Weekly Off without Work:** Scheduled weekly rest day, **not an absence** (`regular_hours = 0.00`, `ot_hours = 0.00`, `is_absent = false`).
   - **Regular Workday:**
     - $\text{actual\_hours} \le S_{\text{hours}}$: `regular_hours = actual_hours`, `ot_hours = 0.00`.
     - $\text{actual\_hours} > S_{\text{hours}}$: `regular_hours = S_hours`, `ot_hours = actual_hours - S_hours`.
     - $\text{actual\_hours} == 0.00$: Unexcused absence (`is_absent = true`), unless later covered by approved leave.
5. **Strict Shift Assignment Rule (Zero Calculation without Shift):** If an employee has no effective shift assigned on a work date:
   - The engine flags `MISSING_SHIFT_ASSIGNMENT`.
   - Retains raw `actual_hours`.
   - Sets `regular_hours = 0.00` and `ot_hours = 0.00` (calculation unresolved).
   - **Mandatory Approval Gate:** Blocks period submission, approval, and locking until HR assigns an effective shift.
6. **Confirmed System Roles Only:** System uses **strictly** the confirmed roles:
   - `HR Admin`: Primary operational attendance authority and final approver (enters, imports, submits, approves, locks, and unlocks).
   - `Super Admin`: Administrative and override authority.
   - `Employee`: Read-only self-view of personal timesheet.
7. **Strict Attendance Lifecycle:** Attendance records progress strictly through: `DRAFT` ➔ `SUBMITTED` ➔ `APPROVED` ➔ `LOCKED`. Only locked attendance may be processed by Phase 4 Payroll.
8. **Controlled Reopen / Unlock Workflow:** Once locked, records cannot be silently modified. Unlocking (`attendance:unlock`) requires a mandatory audit justification, returns the period to `DRAFT`, generates immutable audit entries, and requires re-submission, re-approval, and re-locking before payroll consumption.
9. **Employee Read-Only Self-View:** Employees can inspect their personal daily attendance, shift details, and approval statuses, but have zero edit or self-logging privileges.

---

## 2. Employee Employment-Date Model Integration

To cleanly support contract vs. full-time workers and accurate attendance generation, the Employee model provides:

```
┌─────────────────────────────────────────────────────────┐
│                       employees                         │
├─────────────────────────────────────────────────────────┤
│ id (PK, UUID)                                           │
│ employee_code VARCHAR(32) UNIQUE                        │
│ date_of_joining DATE NOT NULL                           │
│ employment_type VARCHAR(20) NOT NULL DEFAULT 'full_time'│ ─── 'full_time' | 'contract'
│ contract_end_date DATE NULL                             │ ─── Mandatory if contract
│ status VARCHAR(32) NOT NULL DEFAULT 'probation'         │
│ deleted_at TIMESTAMPTZ NULL (Soft-delete)               │
└─────────────────────────────────────────────────────────┘
```

### Employment Lifecycle Rules for Attendance Generation
- **Full-Time Employees:** `employment_type = 'full_time'`, `contract_end_date = NULL` (open-ended employment). Eligible for attendance generation on any calendar day $D \ge \text{date\_of\_joining}$ (provided `deleted_at IS NULL OR deleted_at >= D`).
- **Contract Employees:** `employment_type = 'contract'`, `contract_end_date` is mandatory. Eligible for attendance generation only during the active contract window:
  $$\text{date\_of\_joining} \le D \le \text{contract\_end\_date}$$
- **Calendar Days Outside Eligibility:** For any day in the month before joining or after contract end date:
  - The worker is marked ineligible / inactive for that specific calendar day.
  - The UI displays an inactive non-editable cell (hatched pattern).
  - The backend rejects actual-hour inputs for those days with `422 Unprocessable Entity: Worker not active on work date`.

---

## 3. Database Entities & Relationships

Phase 2 introduces **3 new tables**:

```
┌─────────────────────────────────┐
│       attendance_periods        │
├─────────────────────────────────┤
│ id (PK, UUID)                   │
│ period_code VARCHAR(7)          │ ─── '2026-03'
│ name VARCHAR(64)                │
│ start_date DATE                 │
│ end_date DATE                   │
│ status VARCHAR(20)              │ ─── draft | submitted | approved | locked
│ submitted_by UUID (FK users)    │
│ submitted_at TIMESTAMPTZ        │
│ approved_by UUID (FK users)     │ ─── HR Admin / Super Admin
│ approved_at TIMESTAMPTZ         │
│ locked_by UUID (FK users)       │ ─── HR Admin / Super Admin
│ locked_at TIMESTAMPTZ           │
│ unlocked_by UUID (FK users)     │
│ unlocked_at TIMESTAMPTZ         │
│ unlock_reason TEXT              │
│ created_at / updated_at         │
└────────────────┬────────────────┘
                 │ 1
                 │
                 │ N
┌────────────────┴────────────────────────┐       ┌──────────────────────────────┐
│           attendance_records            │       │         employees            │
├─────────────────────────────────────────┤       ├──────────────────────────────┤
│ id (PK, UUID)                           │   N   │ id (PK, UUID)                │
│ attendance_period_id UUID (FK)          │◄──────┤ employee_code                │
│ employee_id UUID (FK)                   │──────►│ employment_type              │
│ work_date DATE                          │   1   │ date_of_joining              │
│ client_id UUID (FK clients)             │       │ contract_end_date            │
│ project_id UUID (FK projects)           │       └──────────────────────────────┘
│ designation_id UUID (FK designations)   │
│ shift_id UUID (FK shifts, nullable)     │ ◄──── [ HISTORICAL SNAPSHOTS ]
│ day_type VARCHAR(20)                    │       Point-in-time context frozen
│ actual_hours NUMERIC(4,2)               │       at calculation time.
│ regular_hours NUMERIC(4,2)              │
│ ot_hours NUMERIC(4,2)                   │       ┌──────────────────────────────┐
│ is_absent BOOLEAN                       │       │           shifts             │
│ is_on_leave BOOLEAN DEFAULT false       │       ├──────────────────────────────┤
│ has_anomaly BOOLEAN                     │       │ id (PK, UUID)                │
│ anomaly_reason VARCHAR(255)             │──────►│ work_hours NUMERIC(4,2)      │
│ remarks VARCHAR(255)                    │       │ (Standard shift hours)       │
│ created_at / updated_at                 │       └──────────────────────────────┘
└────────────────┬────────────────────────┘
                 │ 1
                 │
                 │ N
┌────────────────┴────────────────────────┐
│          attendance_audit_logs          │
├─────────────────────────────────────────┤
│ id (PK, UUID)                           │
│ attendance_record_id UUID (FK)          │
│ employee_id UUID (FK employees)         │
│ work_date DATE                          │
│ field_name VARCHAR(64)                  │ ─── e.g. 'actual_hours'
│ old_value VARCHAR(64)                   │
│ new_value VARCHAR(64)                   │
│ change_reason TEXT                      │
│ actor_id UUID (FK users)                │
│ created_at TIMESTAMPTZ                  │
└─────────────────────────────────────────┘
```

---

## 4. Attendance Daily Record Model Specifications

### Table: `attendance_periods`
- `id`: UUID Primary Key.
- `period_code`: VARCHAR(7) UNIQUE (e.g. `'2026-03'`).
- `name`: VARCHAR(64) (e.g. `'March 2026 Monthly Attendance'`).
- `start_date`: DATE NOT NULL (e.g. `'2026-03-01'`).
- `end_date`: DATE NOT NULL (e.g. `'2026-03-31'`).
- `status`: VARCHAR(20) NOT NULL DEFAULT `'draft'` (`draft`, `submitted`, `approved`, `locked`).
- `submitted_by`: UUID NULL REFERENCES `users(id)`.
- `submitted_at`: TIMESTAMPTZ NULL.
- `approved_by`: UUID NULL REFERENCES `users(id)`.
- `approved_at`: TIMESTAMPTZ NULL.
- `locked_by`: UUID NULL REFERENCES `users(id)`.
- `locked_at`: TIMESTAMPTZ NULL.
- `unlocked_by`: UUID NULL REFERENCES `users(id)`.
- `unlocked_at`: TIMESTAMPTZ NULL.
- `unlock_reason`: TEXT NULL.
- `created_at`, `updated_at`: Standard timestamps.

### Table: `attendance_records`
- `id`: UUID Primary Key.
- `attendance_period_id`: UUID NOT NULL REFERENCES `attendance_periods(id)` ON DELETE RESTRICT.
- `employee_id`: UUID NOT NULL REFERENCES `employees(id)` ON DELETE RESTRICT.
- `work_date`: DATE NOT NULL.
- **Historical Snapshot Columns:**
  - `client_id`: UUID NULL REFERENCES `clients(id)` ON DELETE RESTRICT.
  - `project_id`: UUID NULL REFERENCES `projects(id)` ON DELETE RESTRICT.
  - `designation_id`: UUID NULL REFERENCES `designations(id)` ON DELETE RESTRICT.
  - `shift_id`: UUID NULL REFERENCES `shifts(id)` ON DELETE SET NULL.
- `day_type`: VARCHAR(20) NOT NULL DEFAULT `'regular_workday'` (`regular_workday`, `weekly_off`, `public_holiday`).
- `actual_hours`: NUMERIC(4, 2) NOT NULL DEFAULT 0.00 (Check constraint: `actual_hours >= 0.00 AND actual_hours <= 24.00`).
- `regular_hours`: NUMERIC(4, 2) NOT NULL DEFAULT 0.00.
- `ot_hours`: NUMERIC(4, 2) NOT NULL DEFAULT 0.00.
- `is_absent`: BOOLEAN NOT NULL DEFAULT false.
- `is_on_leave`: BOOLEAN NOT NULL DEFAULT false (Phase 3 Leave hook).
- `has_anomaly`: BOOLEAN NOT NULL DEFAULT false.
- `anomaly_reason`: VARCHAR(255) NULL.
- `remarks`: VARCHAR(255) NULL.
- `created_at`, `updated_at`: Standard timestamps.
- **Unique Constraint:** `CONSTRAINT uq_attendance_employee_date UNIQUE (employee_id, work_date)`.
- **Database Indexes:**
  - `idx_attendance_period`: `(attendance_period_id)`
  - `idx_attendance_emp_date`: `(employee_id, work_date)`
  - `idx_attendance_client_proj_date`: `(client_id, project_id, work_date)`
  - `idx_attendance_work_date`: `(work_date)`

### Table: `attendance_audit_logs`
- `id`: UUID Primary Key.
- `attendance_record_id`: UUID NOT NULL REFERENCES `attendance_records(id)` ON DELETE CASCADE.
- `employee_id`: UUID NOT NULL REFERENCES `employees(id)` ON DELETE RESTRICT.
- `work_date`: DATE NOT NULL.
- `field_name`: VARCHAR(64) NOT NULL (e.g. `'actual_hours'`, `'day_type'`, `'shift_id'`).
- `old_value`: VARCHAR(64) NULL.
- `new_value`: VARCHAR(64) NULL.
- `change_reason`: TEXT NOT NULL.
- `actor_id`: UUID NOT NULL REFERENCES `users(id)` ON DELETE RESTRICT.
- `created_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW().
- **Indexes:** `(attendance_record_id)`, `(employee_id, work_date)`, `(created_at)`.

---

## 5. Point-in-Time Context Resolution & Calculation Flow

```
                     ┌───────────────────────────────────────┐
                     │          TARGET WORK DATE: D          │
                     └──────────────────┬────────────────────┘
                                        │
                                        ▼
                     ┌───────────────────────────────────────┐
                     │ 1. EMPLOYEE ELIGIBILITY ON DATE D     │
                     │    date_of_joining <= D AND           │
                     │    (contract_end_date IS NULL OR >= D)│
                     │    AND (deleted_at IS NULL OR >= D)   │
                     └──────────────────┬────────────────────┘
                                        │
                         Eligible? ──► NO ──► Mark INELIGIBLE_DAY (Cell disabled, 0h)
                                        │
                                        ▼ YES
                     ┌───────────────────────────────────────┐
                     │ 2. PUBLIC HOLIDAY RESOLUTION          │
                     │    SELECT FROM public_holidays        │
                     │    WHERE holiday_date = D             │
                     └──────────────────┬────────────────────┘
                                        │
                         Found? ──► YES ──► DayType = public_holiday
                                            actual_hours > 0: regular = 0, OT = actual
                                            actual_hours = 0: regular = 0, OT = 0, absent = false
                                        │
                                        ▼ NO
                     ┌───────────────────────────────────────┐
                     │ 3. WEEKLY OFF RESOLUTION              │
                     │    SELECT FROM weekly_off_configs     │
                     │    WHERE effective_from <= D <= to    │
                     └──────────────────┬────────────────────┘
                                        │
       DOW(D) in days_of_week? ──► YES ──► DayType = weekly_off
                                            actual_hours > 0: regular = 0, OT = actual
                                            actual_hours = 0: regular = 0, OT = 0, absent = false
                                        │
                                        ▼ NO ──► DayType = regular_workday
                     ┌───────────────────────────────────────┐
                     │ 4. SHIFT RESOLUTION (STRICT)          │
                     │    SELECT FROM shift_assignments      │
                     │    WHERE employee_id = E              │
                     │      AND effective_from <= D <= to    │
                     └──────────────────┬────────────────────┘
                                        │
                         Found? ──► YES ──► NormalHours = shift.work_hours
                                            actual == 0: regular = 0, OT = 0, absent = true
                                            actual <= shift: regular = actual, OT = 0
                                            actual > shift: regular = shift, OT = actual - shift
                                        │
                                        ▼ NO ──► Flag Anomaly (MISSING_SHIFT_ASSIGNMENT)
                                                 regular = 0.00, OT = 0.00 (Unresolved)
                                                 * BLOCKS PERIOD APPROVAL & LOCKING *
                                        │
                                        ▼
                     ┌───────────────────────────────────────┐
                     │ 5. PROJECT DEPLOYMENT SNAPSHOT        │
                     │    SELECT FROM employee_assignments   │
                     │    WHERE employee_id = E              │
                     │      AND effective_from <= D <= to    │
                     └──────────────────┬────────────────────┘
                                        │
                         Found? ──► Snapshot: client_id, project_id, designation_id
                                        │
                                        ▼ NO ──► Flag Anomaly (UNASSIGNED_ON_DATE)
```

---

## 6. Leave Integration (Phase 3 Foundation)

- Phase 2 remains strictly decoupled from Leave implementation.
- The `is_on_leave: BOOLEAN` column acts as an atomic operational status flag.
- When Phase 3 (Leave Management) is implemented:
  - Approved leave records hook directly into `is_on_leave = true`.
  - For approved leave days: `actual_hours = 0.00`, `regular_hours = 0.00`, `ot_hours = 0.00`, `is_absent = false`, `is_on_leave = true`.
  - If HR subsequently enters actual hours on an approved leave day, the system registers a review anomaly (`CONFLICT_LEAVE_WORK_LOGGED`).
- In Phase 2, `is_on_leave` defaults to `false` without requiring future database migrations.

---

## 7. Attendance Status Lifecycle & Confirmed Roles

```
              ┌───────────────┐
              │     DRAFT     │ ◄────────────────────────────────────────┐
              └───────┬───────┘                                          │
                      │                                                  │
                      │ Submit by HR Admin / Super Admin                 │
                      │ [attendance:submit]                              │
                      ▼                                                  │
              ┌───────────────┐                                          │
              │   SUBMITTED   │                                          │
              └───────┬───────┘                                          │
                      │                                                  │
                      │ Approve by HR Admin / Super Admin                │
                      │ [attendance:approve]                             │
                      ▼                                                  │
              ┌───────────────┐                                          │
              │   APPROVED    │                                          │
              └───────┬───────┘                                          │
                      │                                                  │
                      │ Lock by HR Admin / Super Admin                   │
                      │ [attendance:lock]                                │
                      ▼                                                  │
              ┌───────────────┐       Unlock Request with Justification  │
              │    LOCKED     │ ─────────────────────────────────────────┘
              └───────┬───────┘       [attendance:unlock] (HR Admin / Super Admin)
                      │               Generates Audit Log Entry
                      ▼
           Ready for Phase 4 Payroll
```

### Operational Role Authority & Lifecycle Gates
1. **Normal Operational Flow (HR Admin):**
   - **HR Admin** creates/initializes the draft period, enters actual hours, and imports Excel sheets.
   - **HR Admin** submits the period (`attendance:submit`).
   - **HR Admin** performs final review and approves the period (`attendance:approve`).
   - **HR Admin** locks the period (`attendance:lock`) to freeze it for Phase 4 Payroll.
2. **Administrative Override (Super Admin):**
   - **Super Admin** possesses full system authority and can perform any lifecycle transition as an administrative override where necessary.
3. **Mandatory Shift Gating:**
   - Period submission, approval, and locking are strictly blocked if any active record contains `MISSING_SHIFT_ASSIGNMENT`. All shifts must be assigned before proceeding.
4. **Lock Enforcement:**
   - Once in `LOCKED` status, all write endpoints (`PUT /batch`, `POST /import`) immediately reject modifications with `409 Conflict: Attendance period is locked`.
5. **Controlled Reopen (Unlock):**
   - A locked period can be reopened only via `POST /api/v1/attendance/periods/:id/unlock` by `HR Admin` (normal operational authority) or `Super Admin` (override authority).
   - Requires a mandatory justification string ($\ge 15$ characters).
   - Records an immutable system audit event (`ATTENDANCE_PERIOD_UNLOCKED`).
   - Transitions period `status` back to `DRAFT`.
   - Before consumption by Phase 4 Payroll, the reopened period must be re-submitted, re-approved, and re-locked.

---

## 8. RBAC Permissions Matrix (Confirmed Roles Only)

| Permission Code | Description | Super Admin | HR Admin | Employee |
|---|---|:---:|:---:|:---:|
| `attendance:read` | View attendance sheets, monthly grids, and summaries | ✅ | ✅ | ❌ |
| `attendance:create` | Initialize new monthly periods and input daily actual hours | ✅ | ✅ | ❌ |
| `attendance:import` | Upload attendance data via Excel sheets | ✅ | ✅ | ❌ |
| `attendance:submit` | Submit draft attendance sheets for approval | ✅ | ✅ | ❌ |
| `attendance:approve` | Formally approve submitted attendance sheets | ✅ | ✅ | ❌ |
| `attendance:lock` | Lock approved sheets prior to payroll calculation | ✅ | ✅ | ❌ |
| `attendance:unlock` | Reopen locked sheets with mandatory justification | ✅ | ✅ | ❌ |
| `attendance:self_read`| View own personal daily attendance and timesheet history | ✅ | ✅ | ✅ |

---

## 9. REST API Specification

| Method | Endpoint | Description | Permission |
|---|---|---|---|
| `GET` | `/api/v1/attendance/periods` | List all monthly attendance periods and status | `attendance:read` |
| `POST`| `/api/v1/attendance/periods` | Initialize a new monthly attendance period (`periodCode`) | `attendance:create` |
| `GET` | `/api/v1/attendance/periods/:id` | Get period details, status, and summary metrics | `attendance:read` |
| `GET` | `/api/v1/attendance/grid` | Fetch monthly attendance matrix (filtered by period, client, project, search) | `attendance:read` |
| `PUT` | `/api/v1/attendance/records/batch` | Save draft actual hours for multiple employees/days | `attendance:create` |
| `POST`| `/api/v1/attendance/import` | Upload Excel file for validation and bulk ingestion | `attendance:import` |
| `GET` | `/api/v1/attendance/export-template`| Download pre-populated Excel template for the month | `attendance:read` |
| `POST`| `/api/v1/attendance/periods/:id/submit` | Submit draft period for approval | `attendance:submit` |
| `POST`| `/api/v1/attendance/periods/:id/approve`| Formally approve submitted period | `attendance:approve` |
| `POST`| `/api/v1/attendance/periods/:id/lock` | Lock period for payroll readiness | `attendance:lock` |
| `POST`| `/api/v1/attendance/periods/:id/unlock` | Reopen locked period (requires `unlockReason`) | `attendance:unlock` |
| `GET` | `/api/v1/attendance/my-attendance` | Employee self-view personal monthly attendance | `attendance:self_read` |
| `GET` | `/api/v1/attendance/records/:id/audit` | View cell-level edit audit history for an attendance record | `attendance:read` |
