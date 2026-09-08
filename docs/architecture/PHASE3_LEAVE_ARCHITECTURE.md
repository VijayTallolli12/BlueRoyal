# Blue Royal HRMS — Phase 3: Leave Management & Employee Entitlements Architecture

**Document ID:** `DOC-ARCH-PHASE3-LEAVE`  
**Status:** Approved Architectural Specification  
**Version:** 1.0.0  
**Date:** 2026-09-09  

---

## 1. Executive Summary & Domain Boundaries

Phase 3 introduces the **Leave Management & Employee Entitlements** module into the Blue Royal HRMS modular monolith. It provides:
1. **Configurable Leave Types:** Comprehensive catalog of organizational leave categories (Annual Leave, Sick Leave, Unpaid Leave, Compassionate Leave, Maternity/Paternity Leave) with configurable rules.
2. **Employee Leave Balances & Entitlements:** Periodic (annual) balance allocations with transactional debit/credit tracking (`allocated_days`, `used_days`, `pending_days`, `remaining_days`).
3. **Leave Request & Approval Lifecycle:** Multi-state lifecycle (`PENDING` ➔ `APPROVED` | `REJECTED` | `CANCELLED`) with role-based transitions for confirmed roles (`employee`, `hr_admin`, `super_admin`).
4. **Overlap & Eligibility Guardrails:** Strict temporal validation prohibiting overlapping leave intervals, enforcing employment contract boundaries (`date_of_joining` to `contract_end_date`), and preventing over-utilization of balances.
5. **Phase 2 Attendance Engine Integration:** Direct, atomic synchronization with Phase 2 attendance records through the pre-established `is_on_leave: BOOLEAN` hook and attendance period pre-generation logic.
6. **Regulatory Audit Trail & Immutability:** Append-only mutation logging capturing balance adjustments, application submissions, approvals, rejections, and cancellations.

### Strict Architectural Boundaries
- **Neutral Entitlement Engine:** As mandated by project principles, statutory UAE labor-law formulas (such as mid-year monthly accrual or sick leave tiered pay splits) are not hardcoded or invented. The architecture provides flexible, configurable leave types and annual allocations.
- **Confirmed Roles Only:** All workflows and permissions use **only** `super_admin`, `hr_admin`, and `employee`. No unconfirmed roles (e.g. Line Manager, Department Head) are introduced.
- **Attendance Decoupling:** Approved leave drives attendance records in open periods (`DRAFT`, `SUBMITTED`, `APPROVED`), but cannot alter records in `LOCKED` attendance periods.

---

## 2. Entity Relational Model & Database Schema

The Leave domain introduces 3 primary tables within the PostgreSQL schema:

```
┌─────────────────────────────────┐
│          leave_types            │
├─────────────────────────────────┤
│ id: UUID (PK)                   │
│ code: VARCHAR(32) (UNIQUE)      │
│ name: VARCHAR(100)              │
│ description: TEXT               │
│ is_paid: BOOLEAN                │
│ default_days_per_year: NUMERIC  │
│ requires_attachment: BOOLEAN    │
│ deduct_working_days_only: BOOL  │
│ allow_during_probation: BOOLEAN │
│ is_active: BOOLEAN              │
│ created_at: TIMESTAMPTZ         │
│ updated_at: TIMESTAMPTZ         │
│ deleted_at: TIMESTAMPTZ         │
└────────────────┬────────────────┘
                 │ 1
                 │
                 │ N
┌────────────────┴────────────────┐         1    ┌─────────────────────────────────┐
│     employee_leave_balances     │ ──────────── │            employees            │
├─────────────────────────────────┤              ├─────────────────────────────────┤
│ id: UUID (PK)                   │              │ id: UUID (PK)                   │
│ employee_id: UUID (FK)          │              │ employee_code: VARCHAR(32)      │
│ leave_type_id: UUID (FK)        │              │ date_of_joining: DATE           │
│ year: INTEGER (e.g. 2026)       │              │ status: VARCHAR(32)             │
│ allocated_days: NUMERIC(5,2)    │              └────────────────┬────────────────┘
│ used_days: NUMERIC(5,2)         │                               │
│ pending_days: NUMERIC(5,2)      │                               │ 1
│ carried_forward: NUMERIC(5,2)   │                               │
│ notes: TEXT                     │                               │ N
│ created_at: TIMESTAMPTZ         │              ┌────────────────┴────────────────┐
│ updated_at: TIMESTAMPTZ         │              │         leave_requests          │
└─────────────────────────────────┘              ├─────────────────────────────────┤
                                                 │ id: UUID (PK)                   │
                                                 │ request_number: VARCHAR(32) (UQ)│
                                                 │ employee_id: UUID (FK)          │
                                                 │ leave_type_id: UUID (FK)        │
                                                 │ start_date: DATE                │
                                                 │ end_date: DATE                  │
                                                 │ total_days: NUMERIC(5,2)        │
                                                 │ reason: TEXT                    │
                                                 │ status: VARCHAR(32)             │
                                                 │   (PENDING/APPROVED/REJECTED/   │
                                                 │    CANCELLED)                   │
                                                 │ approved_by: UUID (FK users)    │
                                                 │ approved_at: TIMESTAMPTZ        │
                                                 │ rejected_by: UUID (FK users)    │
                                                 │ rejected_at: TIMESTAMPTZ        │
                                                 │ rejection_reason: TEXT          │
                                                 │ cancelled_by: UUID (FK users)   │
                                                 │ cancelled_at: TIMESTAMPTZ       │
                                                 │ cancellation_reason: TEXT       │
                                                 │ attachment_url: VARCHAR(255)    │
                                                 │ created_at: TIMESTAMPTZ         │
                                                 │ updated_at: TIMESTAMPTZ         │
                                                 └─────────────────────────────────┘
```

### Table Definitions

#### 1. `leave_types`
- `id` (UUID, PK)
- `code` (VARCHAR(32), UNIQUE, e.g. `ANNUAL`, `SICK`, `UNPAID`, `EMERGENCY`)
- `name` (VARCHAR(100), e.g. "Annual Leave", "Medical / Sick Leave")
- `description` (TEXT)
- `is_paid` (BOOLEAN, default `true`)
- `default_days_per_year` (NUMERIC(5,2), default `30.00`)
- `requires_attachment` (BOOLEAN, default `false`)
- `deduct_working_days_only` (BOOLEAN, default `true` — when true, weekly offs and public holidays falling within the range are not deducted from balance)
- `allow_during_probation` (BOOLEAN, default `false`)
- `is_active` (BOOLEAN, default `true`)
- Standard timestamps (`created_at`, `updated_at`, `deleted_at`).

#### 2. `employee_leave_balances`
- `id` (UUID, PK)
- `employee_id` (UUID, FK ➔ `employees.id`, ON DELETE RESTRICT)
- `leave_type_id` (UUID, FK ➔ `leave_types.id`, ON DELETE RESTRICT)
- `year` (INTEGER, e.g. `2026`)
- `allocated_days` (NUMERIC(5,2), default `0.00`)
- `used_days` (NUMERIC(5,2), default `0.00`)
- `pending_days` (NUMERIC(5,2), default `0.00`)
- `carried_forward` (NUMERIC(5,2), default `0.00`)
- `notes` (TEXT, optional)
- Composite Unique Constraint: `(employee_id, leave_type_id, year)`
- Computed available days: `remaining_days = allocated_days + carried_forward - used_days - pending_days`.

#### 3. `leave_requests`
- `id` (UUID, PK)
- `request_number` (VARCHAR(32), UNIQUE, e.g. `LR-202609-0001`)
- `employee_id` (UUID, FK ➔ `employees.id`, ON DELETE RESTRICT)
- `leave_type_id` (UUID, FK ➔ `leave_types.id`, ON DELETE RESTRICT)
- `start_date` (DATE, ISO `YYYY-MM-DD`)
- `end_date` (DATE, ISO `YYYY-MM-DD`)
- `total_days` (NUMERIC(5,2), calculated duration)
- `reason` (TEXT, mandatory)
- `status` (VARCHAR(32), enum: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, default `PENDING`)
- `approved_by` (UUID, FK ➔ `users.id`, nullable)
- `approved_at` (TIMESTAMPTZ, nullable)
- `rejected_by` (UUID, FK ➔ `users.id`, nullable)
- `rejected_at` (TIMESTAMPTZ, nullable)
- `rejection_reason` (TEXT, nullable)
- `cancelled_by` (UUID, FK ➔ `users.id`, nullable)
- `cancelled_at` (TIMESTAMPTZ, nullable)
- `cancellation_reason` (TEXT, nullable)
- `attachment_url` (VARCHAR(255), nullable)
- Standard timestamps (`created_at`, `updated_at`).

---

## 3. Leave Request Lifecycle & State Transitions

The lifecycle transitions are strictly governed by RBAC and transactional state machines:

```
                      ┌─────────────────────────┐
                      │        (Draft)          │
                      └────────────┬────────────┘
                                   │ Employee / HR Admin submits
                                   │ [leave:self_create | leave:create]
                                   ▼
                      ┌─────────────────────────┐
       ┌───────────── │         PENDING         │ ─────────────┐
       │              └────────────┬────────────┘              │
       │ Cancelled by              │                           │ Rejected by HR
       │ Employee/HR               │ Approved by HR            │ [leave:reject]
       │ [leave:self_cancel]       │ [leave:approve]           │ (Requires reason)
       ▼                           ▼                           ▼
┌──────────────┐             ┌───────────┐             ┌──────────────┐
│  CANCELLED   │             │ APPROVED  │             │   REJECTED   │
└──────────────┘             └─────┬─────┘             └──────────────┘
                                   │
                                   │ Admin / HR Revocation
                                   │ [leave:cancel]
                                   │ (Requires reason & restores balance)
                                   ▼
                             ┌───────────┐
                             │ CANCELLED │
                             └───────────┘
```

### Transition Invariants
1. **Submission (`PENDING`):**
   - Validates that `start_date <= end_date`.
   - Checks employment eligibility: `start_date >= employee.date_of_joining` and `end_date <= employee.contract_end_date` (if contract).
   - Validates no active overlapping requests exist for the same employee (`status IN ('PENDING', 'APPROVED')`).
   - If leave type requires balance tracking (`is_paid = true` or `default_days_per_year > 0`), verifies `remaining_days >= total_days`.
   - Transactionally increments `pending_days` on the employee's `employee_leave_balances` record.
2. **Approval (`APPROVED`):**
   - Requires `leave:approve` permission (held by `hr_admin` and `super_admin`).
   - In a single database transaction:
     - Transitions request status from `PENDING` to `APPROVED`.
     - Decrements `pending_days` by `total_days` and increments `used_days` by `total_days`.
     - Calls `AttendanceLeaveSyncService.syncApprovedLeave(leaveRequest)` to immediately mark `is_on_leave = true` on corresponding daily attendance records.
     - Emits regulatory audit log.
3. **Rejection (`REJECTED`):**
   - Requires `leave:reject` permission and mandatory non-empty `rejection_reason`.
   - In a single database transaction:
     - Transitions status from `PENDING` to `REJECTED`.
     - Decrements `pending_days` by `total_days` on the employee's balance record, restoring available balance.
     - Emits regulatory audit log.
4. **Cancellation (`CANCELLED`):**
   - **Case A: Cancellation of `PENDING` request:**
     - Employee can cancel own request via `leave:self_cancel`; HR Admin can cancel via `leave:cancel`.
     - Decrements `pending_days` by `total_days`, restoring available balance.
   - **Case B: Cancellation of `APPROVED` request:**
     - Only HR Admin or Super Admin can cancel an already approved leave request.
     - Requires mandatory `cancellation_reason`.
     - Decrements `used_days` by `total_days`, returning days to remaining balance.
     - Calls `AttendanceLeaveSyncService.revertApprovedLeave(leaveRequest)` to clear `is_on_leave` on attendance records, unless the attendance period is already `LOCKED`.
     - Emits regulatory audit log.

---

## 4. Phase 2 Attendance Integration Architecture

Phase 2 established the core hook for Phase 3 integration:
- `attendance_records.is_on_leave: BOOLEAN NOT NULL DEFAULT false`
- `AttendanceCalculationService.calculateHours({ actualHours, dayType, shiftWorkHours, isOnLeave })`

### Synchronization Mechanism (`AttendanceLeaveSyncService`)

1. **On Leave Approval:**
   - Iterate each calendar day $D \in [\text{start\_date}, \text{end\_date}]$.
   - Query existing `attendance_records` for the employee where `work_date = D`.
   - If a record exists:
     - Inspect parent `attendance_periods.status`.
     - If `LOCKED`: Leave approval for past locked dates is prohibited or flagged (records cannot be modified).
     - If `DRAFT`, `SUBMITTED`, or `APPROVED`:
       - Set `is_on_leave = true`.
       - Recompute attendance hours using `AttendanceCalculationService.calculateHours`:
         - `actual_hours` retained (or 0.00 if previously absent).
         - `regular_hours = 0.00`.
         - `ot_hours = 0.00`.
         - `is_absent = false`.
         - `has_anomaly = (actual_hours > 0)`.
         - `anomaly_reason = (actual_hours > 0) ? 'CONFLICT_LEAVE_WORK_LOGGED' : null`.
       - If period was `SUBMITTED` or `APPROVED`, revert period to `DRAFT` per Phase 2 integrity rule.
       - Create cell-level audit log entry in `attendance_audit_logs`.

2. **On Attendance Period Creation (Pre-Generation):**
   - When `AttendancePeriodService.createPeriod` generates initial records for a month:
   - Queries `leave_requests` where `employee_id = E`, `status = 'APPROVED'`, and $D \in [\text{start\_date}, \text{end\_date}]$.
   - If an approved leave covers date $D$:
     - Initializes `attendance_records` with `is_on_leave = true`, `is_absent = false`, `regular_hours = 0.00`, `ot_hours = 0.00`.

3. **On Leave Cancellation (Post-Approval):**
   - For all dates $D \in [\text{start\_date}, \text{end\_date}]$ with open attendance records:
     - Set `is_on_leave = false`.
     - Recalculate daily hours against the scheduled shift. If `actual_hours == 0`, mark `is_absent = true`.
     - Emits audit entry.

---

## 5. Security & RBAC Specifications

Following the project's zero-unconfirmed-roles standard, only the 3 confirmed roles are configured:

| Permission Code | Description | Super Admin | HR Admin | Employee |
|---|---|:---:|:---:|:---:|
| `leave_types:read` | View leave type catalogs | ✅ | ✅ | ✅ |
| `leave_types:create` | Create new leave types | ✅ | ✅ | ❌ |
| `leave_types:update` | Update leave type rules | ✅ | ✅ | ❌ |
| `leave_types:delete` | Soft-delete leave types | ✅ | ✅ | ❌ |
| `leave_balances:read` | View employee leave balances | ✅ | ✅ | ❌ (Own view via self API) |
| `leave_balances:manage` | Allocate or adjust balances | ✅ | ✅ | ❌ |
| `leave:read` | View all leave requests across company | ✅ | ✅ | ❌ |
| `leave:create` | Create leave request on behalf of employee | ✅ | ✅ | ❌ |
| `leave:approve` | Approve submitted leave requests | ✅ | ✅ | ❌ |
| `leave:reject` | Reject submitted leave requests | ✅ | ✅ | ❌ |
| `leave:cancel` | Cancel approved or pending requests | ✅ | ✅ | ❌ |
| `leave:self_read` | View own leave requests & balances | ✅ | ✅ | ✅ |
| `leave:self_create` | Submit own leave request | ✅ | ✅ | ✅ |
| `leave:self_cancel` | Cancel own pending leave request | ✅ | ✅ | ✅ |

---

## 6. REST API Endpoints

All endpoints adhere to the standard `/api/v1` prefix and return standard response envelopes.

### Leave Types
- `GET /api/v1/leave/types` — List active leave types (`leave_types:read`)
- `POST /api/v1/leave/types` — Create leave type (`leave_types:create`)
- `PUT /api/v1/leave/types/:id` — Update leave type (`leave_types:update`)
- `DELETE /api/v1/leave/types/:id` — Deactivate leave type (`leave_types:delete`)

### Employee Leave Balances
- `GET /api/v1/leave/balances` — Query balances with filters (`employeeId`, `year`) (`leave_balances:read`)
- `POST /api/v1/leave/balances/allocate` — Allocate or adjust annual balance (`leave_balances:manage`)

### Leave Requests (Administrative / HR)
- `GET /api/v1/leave/requests` — Query requests with pagination and filters (`employeeId`, `status`, `leaveTypeId`, `year`) (`leave:read`)
- `GET /api/v1/leave/requests/:id` — Get single request details (`leave:read`)
- `POST /api/v1/leave/requests` — Create leave request for an employee (`leave:create`)
- `POST /api/v1/leave/requests/:id/approve` — Approve leave request (`leave:approve`)
- `POST /api/v1/leave/requests/:id/reject` — Reject leave request (`leave:reject`)
- `POST /api/v1/leave/requests/:id/cancel` — Cancel approved or pending leave request (`leave:cancel`)

### Employee Self-Service
- `GET /api/v1/leave/my-leave` — Get own leave requests and current year balances (`leave:self_read`)
- `POST /api/v1/leave/my-leave` — Submit own leave request (`leave:self_create`)
- `POST /api/v1/leave/my-leave/:id/cancel` — Cancel own pending request (`leave:self_cancel`)

---

## 7. Audit Logging Specifications

All state-changing operations trigger structured audit events recorded via `AuditService.recordEvent`:

| Operation | Action Code | Resource Type | Captured Metadata |
|---|---|---|---|
| Leave Type Created | `LEAVE_TYPE_CREATED` | `leave_type` | Full leave type configuration |
| Leave Type Updated | `LEAVE_TYPE_UPDATED` | `leave_type` | Old vs New configuration |
| Balance Allocated | `LEAVE_BALANCE_ALLOCATED` | `employee_leave_balance` | Employee ID, year, allocated days, prior values |
| Leave Request Submitted | `LEAVE_REQUEST_SUBMITTED` | `leave_request` | Employee ID, leave type, start/end dates, total days, reason |
| Leave Request Approved | `LEAVE_REQUEST_APPROVED` | `leave_request` | Approver ID, attendance sync count |
| Leave Request Rejected | `LEAVE_REQUEST_REJECTED` | `leave_request` | Rejector ID, mandatory rejection reason |
| Leave Request Cancelled | `LEAVE_REQUEST_CANCELLED` | `leave_request` | Canceller ID, cancellation reason, balance restored |
