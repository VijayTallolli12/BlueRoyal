# Blue Royal HRMS — Phase 2 Attendance & Overtime Architecture Specification

**Document ID:** `DOC-ARCH-PHASE2-ATT-001`  
**Date:** 2026-09-08  
**Scope:** Phase 2 Attendance Domain, Excel Ingestion, Shift-Aware Working Hour & OT Calculation, Approval/Lock Lifecycle, and Self-Service  
**Governing Documents:** `Master.md`, `FINAL_ARCHITECTURE.md`, `docs/modules/phase-1-plan.md`  
**Status:** **Architectural Design Plan — Pending Formal User Approval**  

---

## 1. Attendance Domain Boundaries & Core Principles

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
│   │  * Effective Assignment (from employee_assignments: Client + Project + Desig)│     │
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
1. **Raw Input vs. Calculated State:** HR and site supervisors enter **strictly Actual Hours Worked** (`actual_hours`). The system backend deterministically derives **Regular Hours** (`regular_hours`) and **Overtime Hours** (`ot_hours`).
2. **Zero Financial Derivation in Attendance:** Attendance records hold **no currency, wage rates, or billing figures**. Attendance is pure operational data consumed independently downstream by Payroll (Phase 4) and Commercial Invoicing.
3. **Point-in-Time Temporal Resolution:** Shift rules, weekly off days, and project assignments applied to a work date must reflect the records **effective on that exact historical calendar date**, guaranteeing historical reproducibility.
4. **Day-Type Derivation Hierarchy:**
   - If date is a **Public Holiday**: All hours worked are classified as **OT Hours** (`regular_hours = 0`, `ot_hours = actual_hours`).
   - If date is a **Weekly Off**: All hours worked are classified as **OT Hours** (`regular_hours = 0`, `ot_hours = actual_hours`).
   - If date is a **Regular Workday**: Hours up to the assigned shift's standard work hours are **Regular Hours**; hours exceeding standard shift hours are **OT Hours**.
5. **Zero-Work Handling on Rest Days:** A weekly off or public holiday with zero actual hours is **not an absence**; it is an authorized rest day.
6. **Strict Lifecycle Gates:** Attendance records progress through: `draft` ➔ `submitted` ➔ `approved` ➔ `locked`. Only locked attendance may be processed by Payroll.
7. **Controlled Reopen / Correction Workflow:** Once locked, records cannot be silently mutated. Unlocking requires high-privilege authorization (`attendance:unlock`), a mandatory audit justification, and generates immutable before/after audit entries.
8. **Employee Read-Only Self-View:** Employees can inspect their personal daily attendance, shift details, and approval statuses, but have zero edit or self-logging privileges.

---

## 2. Database Entities & Relationships

Phase 2 introduces **3 new tables** and leverages existing Phase 0/1 entities:

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
│ submitted_at TIMESTAMP          │
│ approved_by UUID (FK users)     │
│ approved_at TIMESTAMP           │
│ locked_by UUID (FK users)       │
│ locked_at TIMESTAMP             │
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
│ employee_id UUID (FK)                   │──────►│ date_of_joining              │
│ work_date DATE                          │   1   └──────────────────────────────┘
│ client_id UUID (FK clients)             │
│ project_id UUID (FK projects)           │       ┌──────────────────────────────┐
│ designation_id UUID (FK designations)   │       │           shifts             │
│ shift_id UUID (FK shifts, nullable)     │       ├──────────────────────────────┤
│ day_type VARCHAR(20)                    │       │ id (PK, UUID)                │
│ actual_hours NUMERIC(4,2)               │──────►│ work_hours NUMERIC(4,2)      │
│ regular_hours NUMERIC(4,2)              │       │ start_time / end_time        │
│ ot_hours NUMERIC(4,2)                   │       └──────────────────────────────┘
│ is_absent BOOLEAN                       │
│ is_leave BOOLEAN                        │
│ leave_type VARCHAR(32) (placeholder)    │
│ has_anomaly BOOLEAN                     │
│ anomaly_reason VARCHAR(255)             │
│ remarks VARCHAR(255)                    │
│ created_at / updated_at                 │
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
│ field_name VARCHAR(64)                  │
│ old_value VARCHAR(64)                   │
│ new_value VARCHAR(64)                   │
│ change_reason TEXT                      │
│ actor_id UUID (FK users)                │
│ created_at TIMESTAMP                    │
└─────────────────────────────────────────┘
```

---

## 3. Attendance Daily Record Model

### Table: `attendance_periods`
Manages the monthly operational cycle for the entire company or operational division:
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
Stores daily attendance at worker-day granularity:
- `id`: UUID Primary Key.
- `attendance_period_id`: UUID NOT NULL REFERENCES `attendance_periods(id)` ON DELETE RESTRICT.
- `employee_id`: UUID NOT NULL REFERENCES `employees(id)` ON DELETE RESTRICT.
- `work_date`: DATE NOT NULL.
- `client_id`: UUID NULL REFERENCES `clients(id)` ON DELETE RESTRICT (Point-in-time deployment).
- `project_id`: UUID NULL REFERENCES `projects(id)` ON DELETE RESTRICT (Point-in-time deployment).
- `designation_id`: UUID NULL REFERENCES `designations(id)` ON DELETE RESTRICT (Point-in-time deployment).
- `shift_id`: UUID NULL REFERENCES `shifts(id)` ON DELETE SET NULL (Point-in-time roster).
- `day_type`: VARCHAR(20) NOT NULL DEFAULT `'regular_workday'` (`regular_workday`, `weekly_off`, `public_holiday`).
- `actual_hours`: NUMERIC(4, 2) NOT NULL DEFAULT 0.00 (Check constraint: `actual_hours >= 0 AND actual_hours <= 24.00`).
- `regular_hours`: NUMERIC(4, 2) NOT NULL DEFAULT 0.00.
- `ot_hours`: NUMERIC(4, 2) NOT NULL DEFAULT 0.00.
- `is_absent`: BOOLEAN NOT NULL DEFAULT false.
- `is_leave`: BOOLEAN NOT NULL DEFAULT false (Phase 3 integration point).
- `leave_type`: VARCHAR(32) NULL.
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
Fine-grained, immutable history of cell-level edits and corrections:
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

## 4. Actual-Hours Storage & Derivation Mathematics

### 4.1 Actual-Hours Precision & Validation
- Stored as `NUMERIC(4, 2)` (precision 4, scale 2: up to 99.99, constrained to 0.00 to 24.00).
- Granularity: Supports decimal quarters/halves (e.g. `8.00`, `8.50`, `10.25`, `12.00`).
- Strict validation rejects negative values and values exceeding 24.00.
- Values exceeding 16.00 trigger an **excessive labor hours warning** (`has_anomaly = true`, `anomaly_reason = 'EXCESSIVE_HOURS_WARNING: >16h'`) while preserving the data for HR verification.

### 4.2 Derivation Algorithms by Day Type

$$\text{Day Type} = \begin{cases} 
\text{public\_holiday} & \text{if } \text{work\_date} \in \text{public\_holidays} \\
\text{weekly\_off} & \text{if } \text{DOW}(\text{work\_date}) \in \text{weekly\_off\_configs} \\
\text{regular\_workday} & \text{otherwise}
\end{cases}$$

#### Case A: Public Holiday (`day_type = 'public_holiday'`)
- All work performed on a public holiday is categorized as Overtime.
- If $\text{actual\_hours} > 0$:
  $$\text{regular\_hours} = 0.00, \quad \text{ot\_hours} = \text{actual\_hours}, \quad \text{is\_absent} = \text{false}$$
- If $\text{actual\_hours} = 0$:
  $$\text{regular\_hours} = 0.00, \quad \text{ot\_hours} = 0.00, \quad \text{is\_absent} = \text{false}$$
  *(Statutory rest day; not recorded as an absence).*

#### Case B: Weekly Off (`day_type = 'weekly_off'`)
- All work performed on a scheduled weekly rest day is categorized as Overtime.
- If $\text{actual\_hours} > 0$:
  $$\text{regular\_hours} = 0.00, \quad \text{ot\_hours} = \text{actual\_hours}, \quad \text{is\_absent} = \text{false}$$
- If $\text{actual\_hours} = 0$:
  $$\text{regular\_hours} = 0.00, \quad \text{ot\_hours} = 0.00, \quad \text{is\_absent} = \text{false}$$
  *(Weekly off rest day; not recorded as an absence).*

#### Case C: Regular Workday (`day_type = 'regular_workday'`)
- Standard working hours are determined by the employee's applicable shift ($S_{\text{hours}}$).
- If $\text{actual\_hours} == 0$:
  $$\text{regular\_hours} = 0.00, \quad \text{ot\_hours} = 0.00, \quad \text{is\_absent} = \text{true}$$
  *(Absence flagged unless covered by approved leave).*
- If $0 < \text{actual\_hours} \le S_{\text{hours}}$:
  $$\text{regular\_hours} = \text{actual\_hours}, \quad \text{ot\_hours} = 0.00, \quad \text{is\_absent} = \text{false}$$
- If $\text{actual\_hours} > S_{\text{hours}}$:
  $$\text{regular\_hours} = S_{\text{hours}}, \quad \text{ot\_hours} = \text{actual\_hours} - S_{\text{hours}}, \quad \text{is\_absent} = \text{false}$$

---

## 5. Point-in-Time Context Resolution Pipeline

On every work date $D$, the attendance calculation engine executes a sequential point-in-time context resolution:

```
                     ┌───────────────────────────────────────┐
                     │          TARGET WORK DATE: D          │
                     └──────────────────┬────────────────────┘
                                        │
                                        ▼
                     ┌───────────────────────────────────────┐
                     │ 1. EMPLOYEE ACTIVE STATUS ON DATE D   │
                     │    date_of_joining <= D AND           │
                     │    (deleted_at IS NULL OR > D)        │
                     └──────────────────┬────────────────────┘
                                        │
                                        ▼
                     ┌───────────────────────────────────────┐
                     │ 2. PUBLIC HOLIDAY RESOLUTION          │
                     │    SELECT FROM public_holidays        │
                     │    WHERE holiday_date = D             │
                     └──────────────────┬────────────────────┘
                                        │
                         Found? ──► YES ──► DayType = public_holiday
                                        │
                                        ▼ NO
                     ┌───────────────────────────────────────┐
                     │ 3. WEEKLY OFF RESOLUTION              │
                     │    SELECT FROM weekly_off_configs     │
                     │    WHERE effective_from <= D <= to    │
                     └──────────────────┬────────────────────┘
                                        │
       DOW(D) in days_of_week? ──► YES ──► DayType = weekly_off
                                        │
                                        ▼ NO ──► DayType = regular_workday
                     ┌───────────────────────────────────────┐
                     │ 4. SHIFT RESOLUTION                   │
                     │    SELECT FROM shift_assignments      │
                     │    WHERE employee_id = E              │
                     │      AND effective_from <= D <= to    │
                     └──────────────────┬────────────────────┘
                                        │
                         Found? ──► YES ──► NormalHours = shift.work_hours
                                        │
                                        ▼ NO ──► Flag Anomaly (MISSING_SHIFT)
                                                 Fallback NormalHours = 8.00
                                        │
                                        ▼
                     ┌───────────────────────────────────────┐
                     │ 5. PROJECT DEPLOYMENT RESOLUTION      │
                     │    SELECT FROM employee_assignments   │
                     │    WHERE employee_id = E              │
                     │      AND effective_from <= D <= to    │
                     └──────────────────┬────────────────────┘
                                        │
                         Found? ──► Tag record with (client_id, project_id, designation_id)
                                        │
                                        ▼ NO ──► Flag Anomaly (UNASSIGNED_ON_DATE)
```

---

## 6. Leave / Attendance Integration & Conflict Handling

In Phase 2, the Attendance module establishes the schema contract for Phase 3 (Leave Management):
1. **Schema Flags:** `is_leave: BOOLEAN`, `leave_type: VARCHAR(32)` (e.g. `'ANNUAL'`, `'SICK'`, `'UNPAID'`).
2. **Conflict Rule (Leave vs. Actual Hours):**
   - If a work date has approved leave in Phase 3, default `actual_hours` is 0.00, `is_leave = true`, `is_absent = false`.
   - If HR logs $\text{actual\_hours} > 0$ on an approved leave day, the system registers an anomaly: `CONFLICT_LEAVE_WORK_LOGGED: Actual hours entered on approved leave`.
   - The UI presents a conflict resolution prompt: HR must either confirm the worker was recalled from leave (adjusting leave balance in Phase 3) or adjust the hours.
3. **Phase 2 Implementation:** In Phase 2, `is_leave` remains false by default and is fully ready to be updated by Phase 3 leave approval hooks without requiring schema migrations.

---

## 7. Attendance Status Lifecycle & State Machine

```
              ┌───────────────┐
              │     DRAFT     │ ◄────────────────────────────────────────┐
              └───────┬───────┘                                          │
                      │                                                  │
                      │ Submit by HR Admin                               │
                      │ [attendance:submit]                              │
                      ▼                                                  │
              ┌───────────────┐                                          │
              │   SUBMITTED   │                                          │
              └───────┬───────┘                                          │
                      │                                                  │
                      │ Approve by Operations / HR Lead                  │
                      │ [attendance:approve]                             │
                      ▼                                                  │
              ┌───────────────┐                                          │
              │   APPROVED    │                                          │
              └───────┬───────┘                                          │
                      │                                                  │
                      │ Lock by Payroll / HR Admin                       │
                      │ [attendance:lock]                                │
                      ▼                                                  │
              ┌───────────────┐       Unlock Request with Justification  │
              │    LOCKED     │ ─────────────────────────────────────────┘
              └───────┬───────┘       [attendance:unlock]
                      │               Generates Audit Log Entry
                      ▼
           Ready for Phase 4 Payroll
```

### State Behaviors
| State | Actual Hours Editable? | Excel Upload Permitted? | Visible to Payroll? | Visible to Employee? |
|---|:---:|:---:|:---:|:---:|
| **`draft`** | ✅ Yes | ✅ Yes | ❌ No | ❌ No (or draft indicator) |
| **`submitted`** | ❌ No (Read-only) | ❌ No | ❌ No | ✅ Yes (Pending approval) |
| **`approved`** | ❌ No (Read-only) | ❌ No | ❌ No | ✅ Yes (Approved) |
| **`locked`** | ❌ Strictly Locked | ❌ Strictly Locked | ✅ Yes (Authoritative Input) | ✅ Yes (Final) |

---

## 8. Controlled Correction & Unlock Workflow

1. **Lock Immunity:** Once an attendance period is in `locked` state, all update, delete, and import endpoints reject modifications with `409 Conflict: Attendance period is locked`.
2. **Authorized Unlock Process:**
   - User must possess `attendance:unlock` permission (Super Admin or HR Director).
   - Must provide a non-empty `unlockReason` string (minimum 15 characters).
   - Transitions `attendance_periods.status` back to `draft`.
   - Records an immutable system audit event: `ATTENDANCE_PERIOD_UNLOCKED`.
3. **Cell-Level Correction Tracking:**
   - Any modification to an individual worker's daily hours while reopening must capture `change_reason`.
   - Inserts row into `attendance_audit_logs` storing `old_value`, `new_value`, `change_reason`, and `actor_id`.
   - Re-calculation of regular hours and OT hours occurs automatically upon saving.
4. **Relock Requirement:** Corrected sheet must be re-submitted, re-approved, and re-locked before subsequent payroll execution.

---

## 9. Excel Attendance Import Architecture

### 9.1 Template Format Specification
The system provides a standardized, downloadable Excel workbook (`.xlsx`) per attendance period:
- **Sheet 1: `Monthly_Attendance`**
  - Column A: `Employee Code` (e.g. `'BR-001'`)
  - Column B: `Employee Name` (Read-only helper)
  - Column C: `Client Code` (Read-only helper)
  - Column D: `Project Code` (Read-only helper)
  - Column E to Column AI: Daily columns `1`, `2`, `3`, ..., `31` representing calendar days of the month.
  - Column AJ: `Total Hours` (Formula helper)
- **Sheet 2: `Reference_Metadata` (Hidden / Protected)**
  - Stores `Period Code`, `Generation Timestamp`, and cryptographic checksum to verify template integrity.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        EXCEL ATTENDANCE INGESTION PIPELINE                             │
│                                                                                        │
│   1. Upload .xlsx File ──► 2. File & Checksum Validation (Max 10MB)                    │
│                                     │                                                  │
│                                     ▼                                                  │
│                       3. Parse Sheet Rows via Streaming Parser                         │
│                                     │                                                  │
│                                     ▼                                                  │
│                       4. Dry-Run In-Memory Pre-Validation:                             │
│                          * Verify Employee Codes exist in database                     │
│                          * Verify values are valid decimals (0.00 - 24.00)             │
│                          * Detect duplicate employee rows                              │
│                          * Check work dates against joining/termination dates          │
│                                     │                                                  │
│                ┌────────────────────┴────────────────────┐                             │
│                ▼ Errors Found                            ▼ Clean                       │
│     Generate Error Report Envelope          Execute Transactional Batch Upsert         │
│     [ { row: 4, emp: 'BR-012',                * Lock Period Check                      │
│         col: '15', val: '28',                 * Bulk Upsert attendance_records         │
│         error: 'Hours > 24' } ]               * Derive Regular & OT Hours in Backend   │
│                                               * Dispatch ATTENDANCE_IMPORTED Audit Log │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Error Reporting Envelope Contract
```json
{
  "success": false,
  "errorCode": "IMPORT_VALIDATION_FAILED",
  "message": "Attendance import failed with 3 validation errors",
  "details": {
    "totalRows": 150,
    "validRows": 147,
    "errorCount": 3,
    "errors": [
      {
        "rowNumber": 12,
        "employeeCode": "BR-015",
        "day": 14,
        "rawInput": "26.00",
        "reason": "Actual hours cannot exceed 24.00 in a single calendar day"
      },
      {
        "rowNumber": 45,
        "employeeCode": "UNKNOWN-99",
        "day": 1,
        "rawInput": "8.00",
        "reason": "Employee code UNKNOWN-99 not found in organization master"
      }
    ]
  }
}
```

---

## 10. RBAC Permissions Matrix

The Phase 0/1 RBAC engine is extended with 7 granular attendance permissions:

| Permission Code | Description | Super Admin | HR Admin | Employee |
|---|---|:---:|:---:|:---:|
| `attendance:read` | View attendance sheets, monthly grids, and summaries | ✅ | ✅ | ❌ |
| `attendance:create` | Initialize new monthly periods and input daily actual hours | ✅ | ✅ | ❌ |
| `attendance:import` | Upload attendance data via Excel sheets | ✅ | ✅ | ❌ |
| `attendance:submit` | Submit draft attendance sheets for management approval | ✅ | ✅ | ❌ |
| `attendance:approve` | Formally approve submitted attendance sheets | ✅ | ✅ | ❌ |
| `attendance:lock` | Lock approved sheets prior to payroll calculation | ✅ | ✅ | ❌ |
| `attendance:unlock` | Reopen locked sheets with mandatory justification | ✅ | ❌ | ❌ |
| `attendance:self_read`| View own personal daily attendance and timesheet history | ✅ | ✅ | ✅ |

---

## 11. REST API Specification

All endpoints follow the established standard envelope format (`{ success: true, data: ..., correlationId: ... }`).

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
| `POST`| `/api/v1/attendance/periods/:id/approve`| Approve submitted period | `attendance:approve` |
| `POST`| `/api/v1/attendance/periods/:id/lock` | Lock period for payroll readiness | `attendance:lock` |
| `POST`| `/api/v1/attendance/periods/:id/unlock` | Reopen locked period (requires `unlockReason`) | `attendance:unlock` |
| `GET` | `/api/v1/attendance/my-attendance` | Employee self-view personal monthly attendance | `attendance:self_read` |
| `GET` | `/api/v1/attendance/records/:id/audit` | View cell-level edit audit history for an attendance record | `attendance:read` |

---

## 12. Angular Frontend Feature Architecture

In accordance with Phase 1 UX recommendations, Attendance is designed as a standalone module located in `frontend/src/app/features/attendance`:

```
frontend/src/app/features/attendance/
├── attendance.routes.ts              # Route definitions (/attendance, /my-attendance)
├── pages/
│   ├── attendance-sheet/             # Primary monthly HR grid management page
│   │   ├── attendance-sheet.component.ts
│   │   ├── attendance-sheet.component.html
│   │   └── attendance-sheet.component.css
│   └── my-attendance/                # Employee self-service personal timesheet view
│       ├── my-attendance.component.ts
│       ├── my-attendance.component.html
│       └── my-attendance.component.css
├── components/
│   ├── attendance-filter-bar/        # Period, Client, Project cascading dropdowns & search
│   ├── attendance-grid/              # Sticky-header virtualized monthly data table
│   ├── attendance-summary-cards/     # Top KPI cards (Total Regular Hours, OT Hours, Headcount)
│   ├── excel-import-modal/           # Drag-and-drop file upload & dry-run error viewer
│   ├── unlock-request-modal/         # Reason capture modal for reopening locked sheets
│   └── cell-audit-drawer/            # Side-drawer showing cell modification history
└── services/
    ├── attendance-api.service.ts     # HTTP client for all Phase 2 attendance endpoints
    └── attendance-state.service.ts   # Angular Signals store for monthly grid state & totals
```

---

## 13. High-Volume Performance Considerations (>500 Employees)

1. **Paginated Virtual Scrolling:** Rather than rendering 500 rows $\times$ 31 days = 15,500 interactive DOM input nodes simultaneously, the grid utilizes Angular CDK Virtual Scroll or server-side pagination (50 employees per page).
2. **Bulk SQL Upsert with Point-in-Time Resolution:** Attendance record updates execute using PostgreSQL bulk `INSERT ... ON CONFLICT (employee_id, work_date) DO UPDATE` wrapped in transactions, ensuring fast writes (<200ms for 500 rows).
3. **In-Memory Context Pre-Fetching:** The calculation service pre-fetches all active shifts, weekly offs, and holidays for the selected month into memory Maps before processing worker records, reducing database round-trips from $N \times 31$ queries to exactly 4 batch queries.
4. **Debounced Grid Auto-Save:** The UI triggers debounced auto-saves (500ms after user pauses typing) to prevent UI freezes.

---

## 14. Testing Strategy

1. **Unit Tests (`backend/tests/unit/attendance-calculator.test.ts`):**
   - Shift Normal Hour derivation (8h shift vs 10h actual = 8h regular + 2h OT).
   - Weekly Off derivation (Sunday actual 8h = 0h regular + 8h OT).
   - Public Holiday derivation (National Day actual 8h = 0h regular + 8h OT).
   - Zero hours on rest day (0h regular, 0h OT, not absent).
   - Zero hours on regular workday (0h regular, 0h OT, absent).
   - Part-time / half-day hours (4h actual on 8h shift = 4h regular, 0h OT).
   - Boundary checks: joining date mid-month, termination date mid-month.
2. **Integration Tests (`backend/tests/integration/attendance.test.ts`):**
   - End-to-end period initialization.
   - Batch grid actual hours update and auto-derivation.
   - Excel template download and valid file import.
   - Excel invalid file import with detailed error report envelope.
   - Lifecycle progression: `draft` ➔ `submitted` ➔ `approved` ➔ `locked`.
   - Rejection of edits on `locked` periods.
   - Controlled unlock with mandatory justification and audit trail verification.
   - Employee self-view boundary isolation (Employee B cannot view Employee A's attendance).

---

## 15. Database Migration Strategy

- **Migration Identifier:** `20260910000001-create-phase2-attendance.ts`
- Creates `attendance_periods`, `attendance_records`, and `attendance_audit_logs`.
- Adds appropriate foreign key constraints with `ON DELETE RESTRICT` to protect historical records.
- Creates unique composite index on `(employee_id, work_date)` to guarantee zero duplicate days.
- **Rollback Safety:** Reversible migration with complete `down()` implementation dropping tables in reverse foreign key order.
