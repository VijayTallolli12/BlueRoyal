# Blue Royal HRMS — Phase 2 Attendance End-to-End Business Workflows (Revised)

**Document ID:** `DOC-WF-PHASE2-ATT-002`  
**Date:** 2026-09-09  
**Scope:** Specification and Operational Blueprint for 10 Core Attendance Business Workflows  
**Governing Documents:** `Master.md`, `FINAL_ARCHITECTURE.md`, `docs/architecture/PHASE2_ATTENDANCE_ARCHITECTURE.md`  
**Status:** **Architectural Workflows — Revised per Confirmed Business Rules**  

---

## 1. Overview & Workflow Lifecycle

Phase 2 establishes the end-to-end operational lifecycle for monthly timekeeping, from initial monthly draft generation to locked payroll input, utilizing strictly confirmed business roles (`Super Admin`, `HR Admin`, `Employee`):

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                ATTENDANCE OPERATIONAL LIFECYCLE                                         │
│                                                                                                         │
│  [ WF-1: Period Init (Eligible Workers) ]                                                               │
│           │                                                                                             │
│           ▼                                                                                             │
│  ┌─────────────────┐       [ WF-3: Excel Import ]                                                       │
│  │   DRAFT STATE   │ ◄───────────────────────────────┐                                                  │
│  └────────┬────────┘                                 │                                                  │
│           │                                          │                                                  │
│           ├─────────────────► [ WF-2: Direct Grid Entry & Live Derivation ]                             │
│           │                   [ WF-4: Shift, Weekly-Off & Holiday Math (Zero Assumed Shift) ]           │
│           │                                                                                             │
│           ▼                                                                                             │
│  [ WF-5: Anomaly Flagging & Missing Shift Resolution ]                                                  │
│           │                                                                                             │
│           ▼                                                                                             │
│  [ WF-6: Submission & Approval (by HR Admin / Super Admin) ]                                            │
│           │                                                                                             │
│           ▼                                                                                             │
│  ┌─────────────────┐                                                                                    │
│  │ APPROVED STATE  │                                                                                    │
│  └────────┬────────┘                                                                                    │
│           │                                                                                             │
│           ▼                                                                                             │
│  [ WF-7: Attendance Locking (by HR Admin / Super Admin) ]                                               │
│           │                                                                                             │
│           ▼                                                                                             │
│  ┌─────────────────┐                                                                                    │
│  │  LOCKED STATE   │ ────► [ WF-8: Controlled Correction / Unlock ] ────► Returns to Draft with Audit   │
│  └────────┬────────┘                                                                                    │
│           │                                                                                             │
│           ├─────────────────► [ WF-9: Employee Self-View (Read-Only) ]                                  │
│           │                                                                                             │
│           ▼                                                                                             │
│  Ready for Phase 4 Payroll Engine                                                                       │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Security & Authentication Note:** Use locally configured development credentials. Never commit, log, or hardcode shared or production credentials in workflows or tests.

---

## 2. Detailed End-to-End Workflows

### Workflow 1: Monthly Attendance Sheet Initialization (Eligible Workers Only)
- **Business Purpose:** Establish the operational container for a given calendar month (e.g. `'2026-03'`) covering strictly active, contractually eligible workers.
- **Actor:** HR Admin / Super Admin (`attendance:create`).
- **Step-by-Step Flow:**
  1. HR Admin navigates to `/attendance` and clicks **"+ Initialize Month"**.
  2. Selects Year and Month (`2026-03`).
  3. System checks whether `attendance_periods` already exists for `'2026-03'`. If so, returns `409 Conflict`.
  4. **Eligibility Filtering:** System queries active employees who overlap with the month:
     $$\text{date\_of\_joining} \le 2026\text{-}03\text{-}31 \quad \text{AND} \quad (\text{contract\_end\_date IS NULL OR } \ge 2026\text{-}03\text{-}01) \quad \text{AND} \quad (\text{deleted\_at IS NULL OR } \ge 2026\text{-}03\text{-}01)$$
  5. Inserts a new `attendance_periods` row with `status = 'draft'`.
  6. **Daily Pre-Generation per Worker:** For each calendar day $D$ ($1 \dots 31$):
     - If $D < \text{date\_of\_joining}$ OR ($D > \text{contract\_end\_date}$ for contract workers): day is marked as **ineligible / inactive** (zero hours, disabled cell).
     - If eligible: creates skeleton row in `attendance_records` with `actual_hours = 0.00`, resolves `day_type` (`weekly_off`, `public_holiday`, or `regular_workday`), and freezes historical snapshots of `client_id`, `project_id`, `designation_id`, and `shift_id` on date $D$.
  7. Returns initialized period with active worker headcount and total day count.

---

### Workflow 2: Daily Actual-Hours Direct Entry & Grid Calculation
- **Business Purpose:** Enable HR timekeepers to enter daily actual hours worked directly into the interactive monthly grid.
- **Actor:** HR Admin / Super Admin (`attendance:create`).
- **Step-by-Step Flow:**
  1. HR selects Period (`2026-03`), Client, and Project in the filter bar.
  2. The UI renders the monthly matrix with employee rows and day columns ($1 \dots 31$).
  3. HR clicks into an editable cell (e.g., Worker BR-001 on Day 15) and enters `10.5`.
  4. Frontend performs client-side validation (`0.00 <= hours <= 24.00`).
  5. Debounced auto-save triggers `PUT /api/v1/attendance/records/batch` sending `[{ employeeId, workDate: '2026-03-15', actualHours: 10.5 }]`.
  6. Backend executes `runInTransaction`:
     - Verifies `attendance_periods.status == 'draft'`.
     - Checks worker eligibility on that date.
     - Resolves employee shift and day type.
     - Calculates: `regular_hours` and `ot_hours`.
     - Updates `attendance_records` and recalibrates monthly totals.
  7. Frontend updates cell visual feedback: Regular: `8.0h`, OT: `+2.5h`, Row Total updated.

---

### Workflow 3: Excel Attendance Sheet Import
- **Business Purpose:** Support bulk attendance uploads from site timekeepers who maintain Excel sheets.
- **Actor:** HR Admin / Super Admin (`attendance:import`).
- **Step-by-Step Flow:**
  1. HR clicks **"Download Excel Template"** (`GET /api/v1/attendance/export-template?periodCode=2026-03`). The `.xlsx` file contains pre-filled employee codes, names, designations, and calendar day columns.
  2. Site supervisors populate daily actual hours in the file.
  3. HR opens the **"Import Excel"** modal on `/attendance` and drops the `.xlsx` file.
  4. Client uploads to `POST /api/v1/attendance/import` with `multipart/form-data`.
  5. **Backend Ingestion Pipeline:**
     - Checks period status is `draft`.
     - Parses sheet rows with Excel streaming parser.
     - **Dry-Run Validation Pass:**
       - Verifies all employee codes exist.
       - Validates all hours are numeric between `0.00` and `24.00`.
       - Verifies no dates occur before `date_of_joining` or after `contract_end_date`.
     - If ANY validation errors are found:
       - Aborts database insertion.
       - Returns `422 Unprocessable Entity` with error details array (row number, employee code, day, invalid value, failure reason).
       - Frontend displays diagnostic error table.
     - If NO validation errors are found:
       - Opens database transaction.
       - Bulk upserts `attendance_records`.
       - Derives regular hours and OT hours.
       - Records `ATTENDANCE_IMPORTED` in audit log.
       - Commits transaction and returns summary.
  6. Grid refreshes automatically with newly imported values.

---

### Workflow 4: Point-in-Time Working Hour & OT Derivation (Strict Shift Rule)
- **Business Purpose:** Authoritatively determine Regular Hours and Overtime Hours based on the employee's applicable shift, weekly rest schedule, and public holiday calendar effective on each exact date.
- **Execution:** Backend domain service (`AttendanceCalculationService`).
- **Strict Rule Hierarchy:**
  1. **Public Holiday Check:**
     - Query `public_holidays` for `work_date`.
     - If holiday: `day_type = 'public_holiday'`.
     - All worked hours $\rightarrow$ `ot_hours = actual_hours`, `regular_hours = 0.00`.
     - If $\text{actual\_hours} == 0.00 \rightarrow \text{is\_absent} = \text{false}$ (statutory rest day).
  2. **Weekly Off Check:**
     - Query `weekly_off_configs` effective on `work_date`.
     - If day of week matches: `day_type = 'weekly_off'`.
     - All worked hours $\rightarrow$ `ot_hours = actual_hours`, `regular_hours = 0.00`.
     - If $\text{actual\_hours} == 0.00 \rightarrow \text{is\_absent} = \text{false}$ (weekly rest day).
  3. **Regular Workday Check (Strict Shift Rule):**
     - `day_type = 'regular_workday'`.
     - Query `employee_shift_assignments` effective on `work_date`.
     - **If Shift Exists ($S_{\text{hours}}$):**
       - If $\text{actual\_hours} == 0.00$: `regular_hours = 0.00`, `ot_hours = 0.00`, `is_absent = true`.
       - If $\text{actual\_hours} \le S_{\text{hours}}$: `regular_hours = actual_hours`, `ot_hours = 0.00`, `is_absent = false`.
       - If $\text{actual\_hours} > S_{\text{hours}}$: `regular_hours = S_hours`, `ot_hours = actual_hours - S_hours`, `is_absent = false`.
     - **If NO Shift Assigned (Zero-Assumption Rule):**
       - **DO NOT ASSUME 8.00 HOURS.**
       - Keep `actual_hours`.
       - Set `regular_hours = 0.00`, `ot_hours = 0.00` (unresolved calculation state).
       - Flag anomaly `MISSING_SHIFT_ASSIGNMENT`.
       - **Approval Blocking Gate:** System will reject period submission/approval until a shift is assigned for this worker on this date.

---

### Workflow 5: Attendance Review & Anomaly Flagging
- **Business Purpose:** Identify human error, missing logs, potential labor violations, and deployment gaps before submitting attendance.
- **Actor:** HR Admin / Super Admin (`attendance:read`).
- **Automated Flags Generated by Engine:**
  - **`MISSING_SHIFT_ASSIGNMENT` (BLOCKING):** Worker has no shift roster record active on the work date. Must be resolved before approval.
  - **`EXCESSIVE_HOURS`:** Worker logged $> 16.00$ hours in a single calendar day (safety/compliance check).
  - **`UNASSIGNED_ON_WORK_DATE`:** Worker has no active project deployment on the work date.
  - **`OUTSIDE_CONTRACT_WINDOW`:** Attempted hour logging outside joining or contract dates.
- **UI Presentation:**
  - Filter by **"Show Anomalies Only"** toggle on the grid.
  - Red warning badges on flagged cells with descriptive hover tooltips.
  - Anomaly summary banner with direct count of unresolved shifts.

---

### Workflow 6: Attendance Submission & Approval Workflow (HR Admin Final Authority)
- **Business Purpose:** Enforce management verification before freezing monthly timekeeping.
- **Actors:**
  - Submitter: HR Admin / Super Admin (`attendance:submit`).
  - Approver: HR Admin / Super Admin (`attendance:approve`).
  *(HR Admin is the confirmed final approver; no invented roles).*
- **Step-by-Step Flow:**
  1. HR Admin verifies data entry and resolves all `MISSING_SHIFT_ASSIGNMENT` anomalies.
  2. HR Admin clicks **"Submit for Approval"**.
  3. System validates that `0` blocking anomalies exist. If any missing shifts remain, aborts with `422: Cannot submit attendance with unresolved missing shifts`.
  4. Calls `POST /api/v1/attendance/periods/:id/submit`.
  5. Transitions `status` to `'submitted'`, sets `submitted_by = actorId`, `submitted_at = NOW()`.
  6. Dispatches audit event `ATTENDANCE_PERIOD_SUBMITTED`.
  7. HR Admin reviews the submitted period summary and clicks **"Approve Attendance"**.
  8. Calls `POST /api/v1/attendance/periods/:id/approve`.
  9. Transitions `status` to `'approved'`, sets `approved_by = actorId`, `approved_at = NOW()`.
  10. Dispatches audit event `ATTENDANCE_PERIOD_APPROVED`.

---

### Workflow 7: Attendance Locking & Payroll Readiness Gate
- **Business Purpose:** Immutably freeze the approved attendance period to guarantee data integrity during payroll calculation.
- **Actor:** HR Admin / Super Admin (`attendance:lock`).
- **Step-by-Step Flow:**
  1. Once approved, the **"Lock Attendance"** button becomes active.
  2. HR Admin clicks **"Lock Attendance"**.
  3. Confirmation dialog confirms intent: *"Locking March 2026 will freeze all worker attendance for payroll processing. Proceed?"*
  4. Calls `POST /api/v1/attendance/periods/:id/lock`.
  5. Backend verifies status is `'approved'`.
  6. Transitions `status` to `'locked'`, sets `locked_by = actorId`, `locked_at = NOW()`.
  7. Dispatches audit event `ATTENDANCE_PERIOD_LOCKED`.
  8. **Payroll Gate:** Phase 4 Payroll Engine verifies `attendance_periods.status == 'locked'` before generating payroll batches.

---

### Workflow 8: Controlled Attendance Correction & Unlock Workflow
- **Business Purpose:** Permit authorized corrections to a locked attendance period while strictly preventing silent or untracked changes.
- **Actor:** HR Admin / Super Admin (`attendance:unlock`).
- **Step-by-Step Flow:**
  1. Site supervisor or payroll identifies a required retroactive correction on a locked period.
  2. HR Admin clicks **"Request Unlock / Correction"**.
  3. Dialog requires a mandatory justification (`unlockReason`, minimum 15 characters).
  4. Calls `POST /api/v1/attendance/periods/:id/unlock` with `{ unlockReason }`.
  5. Transitions period `status` back to `'draft'`.
  6. Sets `unlocked_by = actorId`, `unlocked_at = NOW()`, `unlock_reason = unlockReason`.
  7. Records audit event `ATTENDANCE_PERIOD_UNLOCKED`.
  8. HR edits the necessary cells in the grid.
  9. For every modified cell, backend inserts a row into `attendance_audit_logs` storing `old_value`, `new_value`, `change_reason`, and `actor_id`.
  10. Period must be re-submitted (WF-6), re-approved (WF-6), and re-locked (WF-7) before downstream payroll processing.

---

### Workflow 9: Employee Attendance Self-View Workflow
- **Business Purpose:** Transparency for workers to inspect their monthly logged hours, shift assignments, regular hours, and OT hours without granting edit access.
- **Actor:** Employee (`attendance:self_read`).
- **Step-by-Step Flow:**
  1. Employee logs in and navigates to `/attendance/my-attendance`.
  2. Calls `GET /api/v1/attendance/my-attendance?month=2026-03`.
  3. Backend extracts authenticated user ID (`req.user.id`), locates linked `employee_id`, and queries `attendance_records`.
  4. **Strict Isolation:** Enforces that employees can ONLY access their own records (`WHERE employee_id = :myEmployeeId`).
  5. UI displays personal timesheet table: Date, Day of Week, Shift Name & Hours, Logged Hours, Regular Hours, OT Hours, Status badges (Present, Rest Day, Holiday, OT).
  6. Read-only: Zero input fields or edit actions rendered.

---

### Workflow 10: Regulatory Audit Trail on Attendance Changes
- **Business Purpose:** Provide an immutable compliance record of every mutation, batch import, and cell correction for statutory audits (UAE Ministry of Human Resources & Emiratisation / MOHRE).
- **Execution:** Automated via `AuditService` and `attendance_audit_logs`.
- **Logged Events:**
  1. `ATTENDANCE_PERIOD_INITIALIZED`: Captured with period code, date range, and actor.
  2. `ATTENDANCE_BATCH_UPDATED`: Captured with modified record count and correlation ID.
  3. `ATTENDANCE_IMPORTED`: Captured with filename, valid row count, and actor.
  4. `ATTENDANCE_PERIOD_SUBMITTED`: Captured with actor and timestamp.
  5. `ATTENDANCE_PERIOD_APPROVED`: Captured with approver ID and timestamp.
  6. `ATTENDANCE_PERIOD_LOCKED`: Captured with locking actor and timestamp.
  7. `ATTENDANCE_PERIOD_UNLOCKED`: Captured with actor, timestamp, and mandatory justification.
  8. `ATTENDANCE_CELL_CORRECTED`: Captured in `attendance_audit_logs` with cell coordinate, old hours, new hours, change reason, and actor ID.
