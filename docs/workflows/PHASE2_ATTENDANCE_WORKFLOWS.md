# Blue Royal HRMS — Phase 2 Attendance End-to-End Business Workflows

**Document ID:** `DOC-WF-PHASE2-ATT-001`  
**Date:** 2026-09-08  
**Scope:** Specification and Operational Blueprint for 10 Core Attendance Business Workflows  
**Governing Documents:** `Master.md`, `FINAL_ARCHITECTURE.md`, `docs/architecture/PHASE2_ATTENDANCE_ARCHITECTURE.md`  
**Status:** **Architectural Planning — Pending Review & Sign-Off**  

---

## 1. Overview & Workflow Lifecycle

Phase 2 establishes the end-to-end operational lifecycle for monthly timekeeping, from initial monthly draft generation to locked payroll input:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                ATTENDANCE OPERATIONAL LIFECYCLE                                         │
│                                                                                                         │
│  [ WF-1: Period Init ]                                                                                  │
│           │                                                                                             │
│           ▼                                                                                             │
│  ┌─────────────────┐       [ WF-3: Excel Import ]                                                       │
│  │   DRAFT STATE   │ ◄───────────────────────────────┐                                                  │
│  └────────┬────────┘                                 │                                                  │
│           │                                          │                                                  │
│           ├─────────────────► [ WF-2: Direct Grid Entry & Live Derivation ]                             │
│           │                   [ WF-4: Shift, Weekly-Off & Holiday Math ]                                │
│           │                                                                                             │
│           ▼                                                                                             │
│  [ WF-5: Anomaly Flagging & HR Review ]                                                                 │
│           │                                                                                             │
│           ▼                                                                                             │
│  [ WF-6: Submission & Approval ]                                                                        │
│           │                                                                                             │
│           ▼                                                                                             │
│  ┌─────────────────┐                                                                                    │
│  │ APPROVED STATE  │                                                                                    │
│  └────────┬────────┘                                                                                    │
│           │                                                                                             │
│           ▼                                                                                             │
│  [ WF-7: Attendance Locking ]                                                                           │
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

### Workflow 1: Monthly Attendance Sheet Initialization (Draft Creation)
- **Business Purpose:** Establish the operational container for a given calendar month (e.g. `'2026-03'`) covering all eligible active workers.
- **Actor:** HR Admin / Operations Lead (`attendance:create`).
- **Trigger:** Start of the monthly timekeeping cycle or first working day of the month.
- **Step-by-Step Flow:**
  1. HR navigates to `/attendance` and clicks **"+ Initialize Month"**.
  2. Selects Year and Month (`2026-03`).
  3. The system checks whether `attendance_periods` already has an entry for `'2026-03'`. If so, returns `409 Conflict`.
  4. The system queries all active employees where `date_of_joining <= 2026-03-31` and `deleted_at IS NULL`.
  5. Inserts a new `attendance_periods` row with `status = 'draft'`.
  6. Generates skeleton daily records in `attendance_records` for all active workers for days $1 \dots N$ (e.g. 31 days) with `actual_hours = 0.00`, resolving `day_type` (`weekly_off`, `public_holiday`, or `regular_workday`) based on effective master rules.
  7. Returns the initialized period envelope with summary counts.
- **Outcome:** Clean monthly grid ready for manual entry or Excel upload.

---

### Workflow 2: Daily Actual-Hours Direct Entry & Grid Calculation
- **Business Purpose:** Enable HR timekeepers to enter daily actual hours worked directly into the interactive monthly grid.
- **Actor:** HR Admin (`attendance:create`).
- **Step-by-Step Flow:**
  1. HR selects Period (`2026-03`), Client, and Project in the filter bar.
  2. The UI renders the monthly matrix with employee rows and day columns ($1 \dots 31$).
  3. HR clicks into an editable cell (e.g., Worker BR-001 on Day 15) and enters `10.5`.
  4. The frontend performs client-side validation (`0.00 <= hours <= 24.00`).
  5. The debounced auto-save triggers `PUT /api/v1/attendance/records/batch` sending `[{ employeeId, workDate: '2026-03-15', actualHours: 10.5 }]`.
  6. The backend executes `runInTransaction`:
     - Verifies `attendance_periods.status == 'draft'`.
     - Resolves employee shift on `2026-03-15` (e.g. 8h shift).
     - Resolves day type (Regular Workday).
     - Calculates: `regular_hours = 8.00`, `ot_hours = 2.50`, `is_absent = false`.
     - Updates `attendance_records` row and updates row totals.
  7. The frontend updates cell feedback: Regular: `8.0h`, OT: `+2.5h`, Row Total updated.
- **Error Handling:** Negative values or characters trigger instant red inline warning without submitting to the API.

---

### Workflow 3: Excel Attendance Sheet Import
- **Business Purpose:** Support high-volume bulk attendance uploads from site timekeepers who maintain Excel sheets.
- **Actor:** HR Admin (`attendance:import`).
- **Step-by-Step Flow:**
  1. HR clicks **"Download Excel Template"** (`GET /api/v1/attendance/export-template?periodCode=2026-03`). The downloaded `.xlsx` file contains pre-filled employee codes, names, current designations, and calendar day columns.
  2. Site supervisors populate daily actual hours in the file.
  3. HR opens the **"Import Excel"** modal on `/attendance` and drops the `.xlsx` file.
  4. The client uploads the file to `POST /api/v1/attendance/import` with `multipart/form-data`.
  5. **Backend Ingestion Pipeline:**
     - Checks period status is `draft`.
     - Parses sheet rows with Excel streaming parser.
     - **Dry-Run Validation Pass:**
       - Verifies all employee codes exist in `employees`.
       - Validates all hours are numeric between `0.00` and `24.00`.
       - Verifies no dates occur before employee's `date_of_joining`.
     - If ANY validation errors are found:
       - Aborts database insertion.
       - Returns `422 Unprocessable Entity` with comprehensive error details array (row number, employee code, day, invalid value, failure reason).
       - Frontend displays an interactive error table allowing HR to review and fix the spreadsheet.
     - If NO validation errors are found:
       - Opens database transaction.
       - Performs bulk upsert of `attendance_records`.
       - Computes regular hours and OT hours for all records.
       - Records `ATTENDANCE_IMPORTED` in audit log.
       - Commits transaction and returns summary: `{ importedRows: 250, totalHours: 42500 }`.
  6. Grid refreshes automatically with newly imported values.

---

### Workflow 4: Point-in-Time Working Hour & OT Derivation
- **Business Purpose:** Authoritatively determine Regular Hours and Overtime Hours based on the employee's applicable shift, weekly rest schedule, and public holiday calendar effective on each exact date.
- **Execution:** Backend domain service (`AttendanceCalculationService`).
- **Rule Hierarchy:**
  1. **Public Holiday Check:**
     - Query `public_holidays` for `work_date`.
     - If holiday: `day_type = 'public_holiday'`.
     - All worked hours $\rightarrow$ `ot_hours = actual_hours`, `regular_hours = 0.00`.
  2. **Weekly Off Check:**
     - Query `weekly_off_configs` effective on `work_date`.
     - If day of week matches (e.g. Sunday): `day_type = 'weekly_off'`.
     - All worked hours $\rightarrow$ `ot_hours = actual_hours`, `regular_hours = 0.00`.
  3. **Regular Workday Check:**
     - `day_type = 'regular_workday'`.
     - Query `employee_shift_assignments` effective on `work_date`.
     - If shift exists with standard hours $S$:
       - If $\text{actual\_hours} \le S$: $\text{regular\_hours} = \text{actual\_hours}, \quad \text{ot\_hours} = 0.00$.
       - If $\text{actual\_hours} > S$: $\text{regular\_hours} = S, \quad \text{ot\_hours} = \text{actual\_hours} - S$.
     - If no shift assigned: Flags anomaly `MISSING_SHIFT_ASSIGNMENT`, applies standard 8.00h fallback.
  4. **Zero-Work Distinction:**
     - If $\text{actual\_hours} == 0.00$ on Public Holiday or Weekly Off: $\text{is\_absent} = \text{false}$.
     - If $\text{actual\_hours} == 0.00$ on Regular Workday: $\text{is\_absent} = \text{true}$ (unless approved leave in Phase 3).

---

### Workflow 5: Attendance Review & Anomaly Flagging
- **Business Purpose:** Identify human error, missing logs, potential labor violations, and deployment gaps before submitting attendance.
- **Actor:** HR Admin / Reviewer (`attendance:read`).
- **Automated Flags Generated by Engine:**
  - **`EXCESSIVE_HOURS`:** Worker logged $> 16.00$ hours in a single calendar day (safety/labor compliance check).
  - **`MISSING_SHIFT_ASSIGNMENT`:** Worker has no shift roster record active on the work date.
  - **`UNASSIGNED_ON_WORK_DATE`:** Worker has no active project deployment on the work date.
  - **`PRE_JOINING_WORK_LOGGED`:** Hours entered for a date prior to the employee's official `date_of_joining`.
  - **`CONSECUTIVE_DAYS_WARNING`:** Worker logged $> 12$ consecutive working days without a rest day (UAE Labor Law check).
- **UI Presentation:**
  - Filter by **"Show Anomalies Only"** toggle on the grid.
  - Warning icons rendered on flagged cells with descriptive hover tooltips.
  - Anomaly summary banner: *"5 workers have unassigned shifts. 2 entries have excessive hours."*

---

### Workflow 6: Attendance Submission & Approval Workflow
- **Business Purpose:** Enforce a strict dual-control governance gate between timekeeping entry and management approval.
- **Actors:**
  - Submitter: HR Admin (`attendance:submit`).
  - Approver: Operations Manager / HR Lead (`attendance:approve`).
- **Step-by-Step Flow:**
  1. Once data entry is verified and anomalies resolved, HR Admin clicks **"Submit for Approval"**.
  2. Dialog prompts for optional submission remarks.
  3. Calls `POST /api/v1/attendance/periods/:id/submit`.
  4. Backend verifies period status is `draft`.
  5. Transitions `status` to `'submitted'`, sets `submitted_by = actorId`, `submitted_at = NOW()`.
  6. Dispatches audit event `ATTENDANCE_PERIOD_SUBMITTED`.
  7. Grid becomes **read-only** for timekeepers.
  8. Approver logs in, reviews summary totals, checks flagged anomalies, and clicks **"Approve Attendance"**.
  9. Calls `POST /api/v1/attendance/periods/:id/approve`.
  10. Transitions `status` to `'approved'`, sets `approved_by = actorId`, `approved_at = NOW()`.
  11. Dispatches audit event `ATTENDANCE_PERIOD_APPROVED`.

---

### Workflow 7: Attendance Locking & Payroll Readiness Gate
- **Business Purpose:** Immutably freeze the approved attendance period to guarantee data integrity during payroll calculation and statutory WPS file generation.
- **Actor:** Payroll Officer / HR Director (`attendance:lock`).
- **Step-by-Step Flow:**
  1. Once approved, the **"Lock Attendance"** button becomes active.
  2. HR Director clicks **"Lock Attendance"**.
  3. Modal warning appears: *"Locking March 2026 will freeze all worker attendance. Only Super Admin can unlock this period with formal justification. Proceed?"*
  4. Calls `POST /api/v1/attendance/periods/:id/lock`.
  5. Backend verifies status is `'approved'`.
  6. Transitions `status` to `'locked'`, sets `locked_by = actorId`, `locked_at = NOW()`.
  7. Dispatches audit event `ATTENDANCE_PERIOD_LOCKED`.
  8. **Payroll Readiness:** Phase 4 Payroll Engine checks `attendance_periods.status == 'locked'` before allowing payroll batch creation.

---

### Workflow 8: Controlled Attendance Correction & Unlock Workflow
- **Business Purpose:** Permit authorized corrections to a locked attendance period while strictly preventing silent or untracked changes.
- **Actor:** Super Admin / HR Director (`attendance:unlock`).
- **Step-by-Step Flow:**
  1. A site supervisor identifies an error in locked attendance (e.g. 5 workers were incorrectly marked absent on Day 20).
  2. HR Director clicks **"Request Unlock / Correction"**.
  3. Dialog requires a mandatory, detailed justification (`unlockReason`, minimum 15 characters, e.g. *"Correcting Day 20 site overtime for Tower A electrical crew as per approved site supervisor timesheet revision"*).
  4. Calls `POST /api/v1/attendance/periods/:id/unlock` with `{ unlockReason }`.
  5. Backend verifies user has `attendance:unlock` permission.
  6. Transitions period `status` back to `'draft'`.
  7. Sets `unlocked_by = actorId`, `unlocked_at = NOW()`, `unlock_reason = unlockReason`.
  8. Records high-priority audit event `ATTENDANCE_PERIOD_UNLOCKED`.
  9. HR enters corrected hours in the grid.
  10. When saving modified cells, backend inserts rows into `attendance_audit_logs` storing `old_value`, `new_value`, `change_reason`, and `actor_id`.
  11. Period must be re-submitted (WF-6), re-approved (WF-6), and re-locked (WF-7) before downstream payroll processing.

---

### Workflow 9: Employee Attendance Self-View Workflow
- **Business Purpose:** Transparency for workers to inspect their monthly logged hours, shift assignments, regular hours, and OT hours without granting edit access.
- **Actor:** Employee (`attendance:self_read`).
- **Step-by-Step Flow:**
  1. Employee logs in and navigates to `/attendance/my-attendance`.
  2. Calls `GET /api/v1/attendance/my-attendance?month=2026-03`.
  3. Backend extracts authenticated user ID (`req.user.id`), locates their linked `employee_id`, and queries `attendance_records`.
  4. **Strict Isolation:** Enforces that employees can ONLY access their own records (`WHERE employee_id = :myEmployeeId`).
  5. UI displays an employee-friendly calendar/timesheet view:
     - Date, Day of Week.
     - Shift Name & Operating Hours.
     - Logged Actual Hours.
     - Regular Hours vs. OT Hours breakdown.
     - Status badges: Present, Rest Day, Public Holiday, Overtime.
     - Monthly summary card: Total Hours Worked, Total OT Hours Accumulated.
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
