# Phase 4 Business Workflows: Payroll Processing Engine

**System:** Blue Royal HRMS  
**Module:** Phase 4 — Payroll Engine & Financial Integrity  
**Status:** Workflow Specification (Pre-Implementation Pass — Ready for Review)  
**Baseline Standards:** `Master.md`, `FINAL_ARCHITECTURE.md`, `docs/PROJECT_STATUS.md`, `docs/architecture/PHASE4_PAYROLL_ARCHITECTURE.md`

---

## 1. End-to-End Operational Lifecycle

The Phase 4 Payroll domain coordinates monthly financial disbursements across strictly confirmed business roles (`Super Admin`, `HR Admin`, `Employee`):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PAYROLL PERIOD OPERATIONAL LIFECYCLE                            │
│                                                                                        │
│   1. CREATE PERIOD             2. RUN ENGINE                3. RESOLVE ANOMALIES       │
│   HR Admin links               HR Admin triggers            If missing rate/config,    │
│   LOCKED attendance            calculation based on         block period; HR configures│
│   period (`DRAFT`)             remuneration_basis           rate in Masters            │
│          │                            │                               │                │
│          ▼                            ▼                               ▼                │
│   ┌──────────────┐             ┌──────────────┐             ┌────────────────────┐     │
│   │    DRAFT     │ ──────────► │  CALCULATED  │ ◄────────── │ Recalculate Period │     │
│   └──────────────┘             └──────┬───────┘             └────────────────────┘     │
│                                       │                               ▲                │
│                                       ▼                               │                │
│                                4. MANUAL ADJUSTMENTS                  │                │
│                                HR Admin adds additions                │                │
│                                or deductions with reason ─────────────┘                │
│                                       │ (Preserved on Recalculate)                     │
│                                       ▼                                                │
│                                5. REVIEW SUMMARY                                       │
│                                HR Admin inspects line                                  │
│                                breakdowns & totals                                     │
│                                       │                                                │
│                                       ▼                                                │
│                                ┌──────────────┐                                        │
│                                │   REVIEWED   │                                        │
│                                └──────┬───────┘                                        │
│                                       │                                                │
│                                       ▼                                                │
│                                6. FINALIZE RUN                                         │
│                                HR Admin locks period;                                  │
│                                payslips released to ESS                                │
│                                       │                                                │
│                                       ▼                                                │
│                                ┌──────────────┐                                        │
│                                │  FINALIZED   │                                        │
│                                └──────┬───────┘                                        │
│                                       │                                                │
│                                       ▼                                                │
│                                7. CONTROLLED UNLOCK                                    │
│                                Super Admin override                                    │
│                                with >= 15 chars reason;                                │
│                                reverts run to DRAFT                                    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Workflow Specifications

### Workflow 1: Create Payroll Period Linked to Locked Attendance
- **Actors:** `HR Admin`, `Super Admin`
- **Preconditions:**
  1. An attendance period exists for the target month (e.g. `2026-05`).
  2. The attendance period status is strictly `locked`.
  3. No prior payroll period exists for this attendance period or `period_code`.
- **Trigger:** HR Admin navigates to the Payroll Hub and clicks *"New Payroll Run"*.
- **Standard Flow:**
  1. System displays list of locked attendance periods eligible for payroll processing.
  2. HR Admin selects the locked attendance period and confirms cycle dates (`startDate`, `endDate`).
  3. HR Admin submits the form.
  4. Backend verifies `attendance_periods.status === 'locked'`. If not locked, request is rejected with `400 Bad Request ("Attendance period must be locked prior to payroll creation")`.
  5. System creates `payroll_periods` record with status `draft`.
  6. Dispatches `PAYROLL_PERIOD_CREATED` event to `audit_logs`.
- **Postconditions:** Period is initialized in `draft` with 0 totals, ready for calculation.

---

### Workflow 2: Execute Payroll Calculation Engine
- **Actors:** `HR Admin`, `Super Admin`
- **Preconditions:**
  1. Payroll period is in `draft` or `calculated` status.
  2. Linked attendance period remains `locked`.
- **Trigger:** HR Admin clicks *"Run Calculation"* on the period dashboard.
- **Standard Flow:**
  1. Backend initiates a database transaction.
  2. Retrieves all employees with records in the linked attendance period.
  3. For each employee, queries `employee.remuneration_basis`:
     - **Authoritative Branch 1: `remuneration_basis === 'hourly'`**
       - Pulls daily attendance records (`regular_hours`, `ot_hours`, `is_absent`, `is_on_leave`).
       - Resolves `employee_hourly_rates` active on each specific date using `EffectiveDateService`.
       - If any rate is missing for a date where hours are recorded, creates `payroll_item` with `has_blocking_issue = true` and details in `blocking_reason = "Missing hourly rate on YYYY-MM-DD"`.
       - Computes daily regular pay and overtime pay, generating itemized `payroll_item_lines` (`is_manual = false`).
     - **Authoritative Branch 2: `remuneration_basis === 'salaried'`**
       - Retrieves active package from `employee_salary_structures` and `salary_components`.
       - If no active structure exists, creates `payroll_item` with `has_blocking_issue = true` and `blocking_reason = "Missing active salary structure"`.
       - Resolves fixed amounts and dependent percentage components.
       - Generates itemized `payroll_item_lines` (`is_manual = false`) for each earning and deduction.
  4. **Preserves Existing Manual Adjustments:** Any existing manual adjustments (`is_manual = true`) on the employee item are retained.
  5. Sums all earnings, deductions, and adjustments to derive `gross_pay` and `net_pay` per employee.
  6. Aggregates period summary: `total_gross_pay`, `total_deductions`, `total_net_pay`, `employee_count`, `blocking_issues_count`.
  7. If `blocking_issues_count == 0`: updates period status to `calculated`.
  8. If `blocking_issues_count > 0`: keeps period in `draft` and flags blocking alerts in UI.
  9. Commits transaction and records `PAYROLL_CALCULATED` in `audit_logs`.
- **Postconditions:** Full calculation breakdown stored in `payroll_items` and `payroll_item_lines`.

---

### Workflow 3: Manual Payroll Adjustments (Additions & Deductions)
- **Actors:** `HR Admin`, `Super Admin`
- **Preconditions:**
  1. Period status is `draft` or `calculated`. (Forbidden if `finalized`).
  2. Employee payroll item exists.
- **Trigger:** HR Admin clicks *"Add Adjustment"* inside an employee's detail drawer.
- **Standard Flow:**
  1. HR Admin selects Adjustment Type:
     - `addition` (e.g. site allowance, approved performance bonus, retroactive pay correction).
     - `deduction` (e.g. advance salary recovery, equipment damage fee).
  2. HR Admin enters:
     - `amount`: Numeric value $> 0$.
     - `description`: Mandatory justification detailing the operational reason ($\ge 5$ chars).
  3. System validates input and persists to `payroll_item_lines`:
     - `category = 'adjustment'`
     - `is_manual = true`
     - `adjustment_type = addition | deduction`
     - `amount = amount`
     - `description = description`
     - `created_by = current_user.id`
  4. System updates employee totals:
     - If `addition`: `gross_pay += amount`, `net_pay = gross_pay - total_deductions`.
     - If `deduction`: `total_deductions += amount`, `net_pay = gross_pay - total_deductions`.
  5. Atomically re-sums period summary totals (`total_gross_pay`, `total_deductions`, `total_net_pay`).
  6. Records `PAYROLL_ADJUSTMENT_CREATED` in `audit_logs` with before/after state.
- **Deletion Flow:**
  - Prior to finalization, HR Admin can delete an adjustment line.
  - The line is removed, totals are re-summed, and `PAYROLL_ADJUSTMENT_DELETED` is logged.
- **Recalculation Invariant:**
  - If a batch recalculation (Workflow 2) is triggered, manual adjustments are **not** wiped; they remain intact and are added into the newly computed figures.
- **Postconditions:** Adjustment is clearly reflected on the calculation breakdown and payslip.

---

### Workflow 4: Blocking Anomaly Resolution & Recalculation
- **Actors:** `HR Admin`
- **Preconditions:**
  1. Payroll calculation completed with `blocking_issues_count > 0`.
- **Trigger:** HR Admin filters payroll items by *"Blocked / Incomplete"*.
- **Standard Flow:**
  1. System highlights employees with blocking issues (e.g. *"Missing hourly rate on 2026-05-14"*).
  2. HR Admin navigates to Masters Hub (`/masters`) and configures the missing `employee_hourly_rates` or `employee_salary_structures` with effective dates covering the missing interval.
  3. HR Admin returns to Payroll Hub and clicks *"Recalculate Period"*.
  4. Backend refreshes system lines while preserving any manual adjustments (Workflow 2).
  5. The previously missing rates resolve successfully. `blocking_issues_count` drops to 0.
  6. Period status advances to `calculated`.
- **Postconditions:** Zero unresolved anomalies exist; review step is unlocked.

---

### Workflow 5: Review Payroll Items & Line-Item Traceability
- **Actors:** `HR Admin`, `Super Admin`
- **Preconditions:**
  1. Period status is `calculated` with `blocking_issues_count == 0`.
- **Trigger:** HR Admin opens the period detail and reviews employee items.
- **Standard Flow:**
  1. System renders employee list with Gross Pay, Deductions, and Net Pay.
  2. HR Admin clicks an employee to inspect the itemized drawer:
     - **Remuneration Basis:** Displays authoritative scheme (`hourly` or `salaried`).
     - **Hours Breakdown:** Regular hours, OT hours, Leave days, Absences.
     - **Earnings Breakdown:** Itemized lines with rate, quantity, and computed amount.
     - **Manual Adjustments:** Additions and deductions with reasons and author.
     - **Audit Trace:** Exact effective rate versions applied on each day.
  3. Once verified, HR Admin clicks *"Mark as Reviewed"*.
  4. Backend verifies `blocking_issues_count === 0` and advances status to `reviewed`.
  5. Records `PAYROLL_REVIEWED` in `audit_logs`.
- **Postconditions:** Period is marked `reviewed` and ready for final authorization.

---

### Workflow 6: Finalize Payroll & Authorize Payslips
- **Actors:** `HR Admin`, `Super Admin`
- **Preconditions:**
  1. Period status is `reviewed`.
  2. Zero blocking issues exist.
- **Trigger:** HR Admin clicks *"Finalize Payroll Run"*.
- **Standard Flow:**
  1. System displays confirmation modal summarizing total disbursement, headcount, and warning that the period will become strictly immutable.
  2. HR Admin confirms.
  3. Backend updates status to `finalized`, sets `finalized_by` and `finalized_at`.
  4. Records `PAYROLL_FINALIZED` in `audit_logs`.
  5. Payslips become immediately visible to employees in Employee Self-Service (`/payroll/my-payroll`).
  6. All subsequent modification attempts (including adding manual adjustments) are strictly blocked.
- **Postconditions:** Payroll run is permanently locked against modifications.

---

### Workflow 7: Controlled Unlock / Reversal for Administrative Corrections
- **Actors:** `Super Admin` (administrative override only)
- **Preconditions:**
  1. Period is `finalized`.
  2. Post-finalization error discovered (e.g. retroactive attendance adjustment approved via attendance unlock).
- **Trigger:** Super Admin clicks *"Unlock Finalized Payroll"*.
- **Standard Flow:**
  1. System prompts for mandatory audit justification ($\ge 15$ characters).
  2. Super Admin enters reason: *"Retroactive overtime correction approved for site worker timesheets"*.
  3. Backend updates period status back to `draft`, clears `finalized_at`, records `unlock_reason`, `unlocked_by`, and `unlocked_at`.
  4. Dispatches `PAYROLL_UNLOCKED` event to `audit_logs`.
  5. While in `draft`, payslips are hidden from Employee Self-Service.
  6. Required data corrections are performed, followed by Recalculation (WF-2), Review (WF-5), and Re-Finalization (WF-6).
- **Postconditions:** Audit log permanently records who unlocked the run and why; integrity preserved.

---

### Workflow 8: Employee Self-Service Payslip Viewing
- **Actors:** `Employee`
- **Preconditions:**
  1. Employee is authenticated with role `employee`.
  2. At least one finalized payroll period exists for the employee.
- **Trigger:** Employee navigates to `/payroll/my-payroll`.
- **Standard Flow:**
  1. System queries finalized payroll items where `employee_id = current_user.employee_id`.
  2. Unfinalized runs (`draft`, `calculated`, `reviewed`) are strictly excluded.
  3. System renders historical payroll cards with Net Pay, Period Code, and Gross Pay.
  4. Employee selects a period to view full payslip:
     - Header: Employee Name, Code, Designation, Month.
     - Summary Tiles: Gross Pay, Total Deductions, Net Payable.
     - Attendance Summary: Days Worked, Regular Hours, Overtime Hours, Leaves.
     - Earnings, Deductions & Adjustments Tables: Itemized lines matching `payroll_item_lines`.
- **Postconditions:** Employee receives transparent, read-only proof of remuneration.

---

### Workflow 9: WPS SIF Integration Boundary (Deferred to Phase 4.2)
- **Status:** **Integration Boundary Specification Only (No Phase 4 Code)**
- **Scope Clarification:**
  - Production generation of the electronic Wage Protection System (WPS) Salary Information File (`.SIF`) is intentionally deferred until company-specific bank routing codes, MOHRE Employer IDs, and agent specifications are provided.
  - Phase 4 delivers the clean, auditable financial dataset (`payroll_items`, `gross_pay`, `net_pay`, `employee.nationality`, `employee.employee_code`) which will feed directly into the future SIF exporter without requiring payroll recalculation.
