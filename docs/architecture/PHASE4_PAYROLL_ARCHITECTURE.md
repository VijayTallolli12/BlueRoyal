# Phase 4 Architecture: Payroll Processing Engine & Financial Traceability

**System:** Blue Royal HRMS  
**Module:** Phase 4 — Payroll Engine & Financial Integrity  
**Status:** Architectural Plan (Ready for Review — No Implementation)  
**Baseline Standards:** `Master.md`, `FINAL_ARCHITECTURE.md`, `docs/PROJECT_STATUS.md`, `docs/architecture/PHASE2_ATTENDANCE_ARCHITECTURE.md`, `docs/architecture/PHASE3_LEAVE_ARCHITECTURE.md`

---

## 1. Domain Overview & Architectural Principles

The Payroll Processing Engine is the core financial disbursement domain of Blue Royal HRMS. Its responsibility is to transform locked operational attendance records, effective-dated employee compensation models, and verified leave statuses into reproducible, auditable, and immutable employee remuneration records.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 UPSTREAM DOMAINS                                       │
│                                                                                        │
│   ┌───────────────────────────┐                      ┌─────────────────────────────┐   │
│   │   Phase 2: Attendance     │                      │   Phase 1: Compensation     │   │
│   │   • Daily Regular Hours   │                      │   • employee_hourly_rates   │   │
│   │   • Daily OT Hours        │                      │   • employee_salary_structs │   │
│   │   • Absence & Shifts      │                      │   • salary_components       │   │
│   │   • Status: LOCKED ONLY   │                      │   • Point-in-time validity  │   │
│   └─────────────┬─────────────┘                      └──────────────┬──────────────┘   │
│                 │                                                   │                  │
│                 │           ┌─────────────────────────────┐         │                  │
│                 │           │     Phase 3: Leave          │         │                  │
│                 │           │     • Approved Leave Dates  │         │                  │
│                 │           │     • Paid vs Unpaid Types  │         │                  │
│                 │           └──────────────┬──────────────┘         │                  │
│                 │                          │                        │                  │
└─────────────────┼──────────────────────────┼────────────────────────┼──────────────────┘
                  ▼                          ▼                        ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              PHASE 4: PAYROLL DOMAIN                                   │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                             payroll_periods                                    │   │
│   │   • period_code (YYYY-MM)          • attendance_period_id (LOCKED)             │   │
│   │   • status: DRAFT ➔ CALCULATED ➔ REVIEWED ➔ FINALIZED                          │   │
│   │   • Summary Totals (Gross, Deductions, Net, Headcount)                         │   │
│   └───────────────────────────────────────┬────────────────────────────────────────┘   │
│                                           │ 1:N                                        │
│                                           ▼                                            │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                              payroll_items                                     │   │
│   │   • employee_id                    • remuneration_type (hourly / salaried)     │   │
│   │   • gross_pay                      • total_deductions        • net_pay         │   │
│   │   • regular_hours, ot_hours        • leave_days, absence_days                  │   │
│   │   • has_blocking_issue             • blocking_reason                           │   │
│   └───────────────────────────────────────┬────────────────────────────────────────┘   │
│                                           │ 1:N                                        │
│                                           ▼                                            │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                            payroll_item_lines                                  │   │
│   │   • category: earning | deduction | adjustment                                 │   │
│   │   • code: REGULAR_PAY, OT_PAY, BASIC, HRA, etc.                                │   │
│   │   • rate, quantity, amount, component_id (Traceable Line Breakdown)            │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Core Architectural Invariants
1. **LOCKED Attendance Gate:** Payroll calculation strictly requires that the referenced `attendance_periods.status == 'locked'`. Processing `draft`, `submitted`, or `approved` attendance is strictly forbidden.
2. **Strict Dual-Stream Cost Decoupling:** Remuneration is computed exclusively from `employee_hourly_rates` or `employee_salary_structures`. **Payroll rates must NEVER depend upon `client_billing_rates`**.
3. **Calculation Reproducibility:** Payroll results are deterministic. The formula:
   $$\text{Locked Inputs} + \text{Effective Configuration on Work Date} \implies \text{Identical Net Result}$$
4. **Transparent Line-Item Breakdown:** The system records full itemized calculation lines (`payroll_item_lines`) for every employee, eliminating black-box totals.
5. **Zero-Assumption Financial Rule:** The engine never guesses or defaults a missing pay rate. If an employee has worked hours but no valid rate exists for that date, the calculation **blocks** the employee item, flags an anomaly, and prevents finalization.
6. **Immutable Finalization & Controlled Unlock:** Once finalized, records are read-only. Unlocking requires a mandatory audit reason ($\ge 15$ chars), returns the period to `DRAFT`, requires re-calculation, and generates tamper-evident audit logs.

---

## 2. Confirmed Payroll Business Rules

To prevent scope creep or inventing statutory rules, all business rules are segregated into three strict categories:

### A. Explicitly Confirmed Rules
1. **Dual Remuneration Schemes:**
   - **Hourly Workers:** Compensated based on point-in-time `employee_hourly_rates` (`normal_hourly_rate`, `ot_hourly_rate`) multiplied by daily locked timesheet hours (`regular_hours`, `ot_hours`).
   - **Salaried Workers:** Compensated based on monthly packages defined in `employee_salary_structures` and `salary_components` (`fixed_amount` or `percentage`).
2. **Attendance Dependency:** Only locked attendance periods can be consumed.
3. **Point-in-Time Effective Dating:** Rates and compensation packages must resolve using the exact interval (`effective_from` $\le \text{date} \le$ `effective_to`) active on each work date.
4. **Three Confirmed Enterprise Roles:**
   - `hr_admin`: Normal operational authority (create run, trigger calculation, review items, finalize).
   - `super_admin`: Administrative override authority and unlock capabilities.
   - `employee`: Read-only self-service access to own payslips. Zero operational authority.

### B. Technically Inferred Rules (Architecture Consistent)
1. **Monthly Period Cycle:** Aligns 1:1 with the Phase 2 calendar monthly attendance cycle (`period_code` format `YYYY-MM`).
2. **Hourly Pay Line Breakdown:**
   $$\text{Daily Regular Pay} = \text{regular\_hours} \times \text{normal\_hourly\_rate}$$
   $$\text{Daily OT Pay} = \text{ot\_hours} \times \text{ot\_hourly\_rate}$$
   Gross hourly pay equals the sum of daily regular and OT pay across the locked period dates.
3. **Percentage Salary Components:** Percentage components compute strictly against their declared `percentage_basis_component_id` (e.g., HRA configured as 40% of BASIC).
4. **Reopening / Reversal Protocol:** Controlled unlock reverts status to `DRAFT`, sets `has_blocking_issue = true` until re-run, and logs to `audit_logs`.

### C. Not Yet Defined / Requires Business Decision (Neutral Safeguards)
The following are **NOT** hardcoded or assumed in Phase 4:
1. *Absence / Unpaid Leave Deduction Formula:* (e.g., whether to deduct $\frac{\text{Gross}}{30}$, $\frac{\text{Basic}}{30}$, or $\frac{\text{Gross}}{\text{Working Days}}$).  
   *Neutral Safeguard:* Absence and unpaid leave days are tracked and tallied in `payroll_items` as quantitative counts. The deduction rate is not hardcoded with an assumed formula; deductions are driven either by explicit configured deduction components or manual adjustments until formally confirmed.
2. *Statutory UAE Pension / GPSSA:* (Differs for UAE/GCC nationals vs expatriates).  
   *Neutral Safeguard:* Zero automatic deductions are assumed. Configured only if explicitly mapped via `salary_components`.
3. *WPS SIF Column Format Specifications:* SIF bank routing codes, employer MOHRE IDs, and file headers.  
   *Neutral Safeguard:* Phase 4 focuses on the core calculation engine, line breakdown, and summary totals; WPS SIF export is isolated behind a dedicated service contract once company bank details are confirmed.
4. *Overtime Multiplier for Salaried Staff:* Whether monthly salaried workers are entitled to OT and at what multiplier.  
   *Neutral Safeguard:* Salaried compensation is derived strictly from active `employee_salary_structures`. If an employee has hourly rates configured, hourly calculation applies.

---

## 3. Database Entity Model

To guarantee the smallest, most maintainable, and fully auditable schema, Phase 4 evaluates and implements **three core relational tables** rather than sprawling redundant tables:

```mermaid
erDiagram
    ATTENDANCE_PERIODS ||--o| PAYROLL_PERIODS : "locks for"
    USERS ||--o{ PAYROLL_PERIODS : "calculates / finalizes"
    
    PAYROLL_PERIODS ||--o{ PAYROLL_ITEMS : "contains"
    EMPLOYEES ||--o{ PAYROLL_ITEMS : "remunerates"
    DESIGNATIONS ||--o{ PAYROLL_ITEMS : "point-in-time role"
    
    PAYROLL_ITEMS ||--o{ PAYROLL_ITEM_LINES : "breaks down into"
    SALARY_COMPONENTS ||--o{ PAYROLL_ITEM_LINES : "derives from"
```

### 3.1 Table 1: `payroll_periods`
Governs the monthly payroll run lifecycle, period totals, and gatekeepers.

| Column | Type | Nullable | Constraints / Description |
|---|---|---|---|
| `id` | UUID | No | Primary Key, `DEFAULT gen_random_uuid()` |
| `period_code` | VARCHAR(32) | No | Unique (e.g. `2026-05`). Matches attendance cycle |
| `name` | VARCHAR(100) | No | Display name (e.g. `May 2026 Payroll`) |
| `start_date` | DATE | No | Period start date (e.g. `2026-05-01`) |
| `end_date` | DATE | No | Period end date (e.g. `2026-05-31`) |
| `attendance_period_id` | UUID | No | FK ➔ `attendance_periods(id)` ON DELETE RESTRICT |
| `status` | VARCHAR(32) | No | Enum: `draft`, `calculated`, `reviewed`, `finalized`. Default: `draft` |
| `total_gross_pay` | NUMERIC(14,2) | No | Default: `0.00` |
| `total_deductions` | NUMERIC(14,2) | No | Default: `0.00` |
| `total_net_pay` | NUMERIC(14,2) | No | Default: `0.00` |
| `employee_count` | INTEGER | No | Default: `0` |
| `blocking_issues_count` | INTEGER | No | Default: `0`. Blocks review and finalization if $> 0$ |
| `calculated_by` | UUID | Yes | FK ➔ `users(id)` ON DELETE SET NULL |
| `calculated_at` | TIMESTAMPTZ | Yes | Timestamp of last calculation |
| `reviewed_by` | UUID | Yes | FK ➔ `users(id)` ON DELETE SET NULL |
| `reviewed_at` | TIMESTAMPTZ | Yes | Timestamp of review sign-off |
| `finalized_by` | UUID | Yes | FK ➔ `users(id)` ON DELETE SET NULL |
| `finalized_at` | TIMESTAMPTZ | Yes | Timestamp of final lock |
| `unlock_reason` | TEXT | Yes | Audit justification for reopening ($ \ge 15$ chars) |
| `unlocked_by` | UUID | Yes | FK ➔ `users(id)` ON DELETE SET NULL |
| `unlocked_at` | TIMESTAMPTZ | Yes | Timestamp of unlock |
| `created_at` | TIMESTAMPTZ | No | Timestamp |
| `updated_at` | TIMESTAMPTZ | No | Timestamp |

**Indexes & Constraints:**
- `uq_payroll_periods_code`: UNIQUE (`period_code`)
- `uq_payroll_attendance_period`: UNIQUE (`attendance_period_id`)
- `chk_payroll_period_dates`: CHECK (`end_date >= start_date`)

---

### 3.2 Table 2: `payroll_items`
Stores the consolidated remuneration and timesheet metrics per employee for the period.

| Column | Type | Nullable | Constraints / Description |
|---|---|---|---|
| `id` | UUID | No | Primary Key, `DEFAULT gen_random_uuid()` |
| `payroll_period_id` | UUID | No | FK ➔ `payroll_periods(id)` ON DELETE CASCADE |
| `employee_id` | UUID | No | FK ➔ `employees(id)` ON DELETE RESTRICT |
| `remuneration_type` | VARCHAR(16) | No | Enum: `hourly`, `salaried` |
| `designation_id` | UUID | Yes | FK ➔ `designations(id)` ON DELETE RESTRICT |
| `days_in_period` | INTEGER | No | Calendar days in cycle |
| `total_actual_hours` | NUMERIC(6,2) | No | Total hours logged |
| `total_regular_hours` | NUMERIC(6,2) | No | Regular hours logged |
| `total_ot_hours` | NUMERIC(6,2) | No | Overtime hours logged |
| `total_absence_days` | INTEGER | No | Days marked absent |
| `total_leave_days` | NUMERIC(5,2) | No | Approved leave days |
| `gross_pay` | NUMERIC(12,2) | No | Calculated gross remuneration |
| `total_deductions` | NUMERIC(12,2) | No | Total deductions |
| `net_pay` | NUMERIC(12,2) | No | Net payable: `gross_pay - total_deductions` |
| `has_blocking_issue` | BOOLEAN | No | Default: `false`. True if missing rates or invalid config |
| `blocking_reason` | TEXT | Yes | Descriptive explanation (e.g. `MISSING_HOURLY_RATE on 2026-05-12`) |
| `created_at` | TIMESTAMPTZ | No | Timestamp |
| `updated_at` | TIMESTAMPTZ | No | Timestamp |

**Indexes & Constraints:**
- `uq_payroll_item_emp_period`: UNIQUE (`payroll_period_id`, `employee_id`)
- `idx_payroll_item_lookup`: (`employee_id`, `payroll_period_id`)

---

### 3.3 Table 3: `payroll_item_lines`
Stores the individual auditable calculation breakdown lines explaining how gross pay, deductions, and adjustments were computed.

| Column | Type | Nullable | Constraints / Description |
|---|---|---|---|
| `id` | UUID | No | Primary Key, `DEFAULT gen_random_uuid()` |
| `payroll_item_id` | UUID | No | FK ➔ `payroll_items(id)` ON DELETE CASCADE |
| `category` | VARCHAR(16) | No | Enum: `earning`, `deduction`, `adjustment` |
| `code` | VARCHAR(32) | No | Line code (e.g. `REGULAR_PAY`, `OT_PAY`, `BASIC`, `HRA`, `TRANSPORT`) |
| `description` | VARCHAR(255) | No | Human-readable explanation |
| `rate` | NUMERIC(10,2) | Yes | Applicable rate (e.g. normal hourly wage or base amount) |
| `quantity` | NUMERIC(8,2) | Yes | Quantity (e.g. hours worked or units) |
| `amount` | NUMERIC(12,2) | No | Net line item amount |
| `salary_component_id` | UUID | Yes | FK ➔ `salary_components(id)` ON DELETE RESTRICT |
| `work_date` | DATE | Yes | Point-in-time date for daily rate application (if applicable) |
| `created_at` | TIMESTAMPTZ | No | Timestamp |

**Indexes:**
- `idx_payroll_lines_item`: (`payroll_item_id`, `category`)

---

## 4. Payroll Calculation Engine & Effective-Date Resolution

The calculation pipeline enforces zero guesswork and complete point-in-time integrity.

```
   ┌───────────────────────────────────────────────────────────────┐
   │                  HR Admin Triggers Calculation                │
   └───────────────────────────────┬───────────────────────────────┘
                                   │
                                   ▼
   ┌───────────────────────────────────────────────────────────────┐
   │             1. Verify Attendance Period Status                │
   │      Must be LOCKED. If draft/submitted/approved: REJECT 400  │
   └───────────────────────────────┬───────────────────────────────┘
                                   │
                                   ▼
   ┌───────────────────────────────────────────────────────────────┐
   │             2. Retrieve Eligible Employees in Period          │
   │       Active employees with records in the locked period      │
   └───────────────────────────────┬───────────────────────────────┘
                                   │
          ┌────────────────────────┴────────────────────────┐
          ▼                                                 ▼
┌───────────────────────────────────┐     ┌───────────────────────────────────┐
│       Hourly Remuneration         │     │       Salaried Remuneration       │
│  For each day in locked records:  │     │  Resolve active salary structure: │
│  • Query employee_hourly_rates    │     │  • Fixed earnings & deductions    │
│    where eff_from <= d <= eff_to  │     │  • Percentage basis resolution    │
│  • If missing: FLAG BLOCKING ISSUE│     │  • If missing: FLAG BLOCKING ISSUE│
│  • Calculate Regular & OT pay     │     │  • Generate item lines            │
│  • Generate item lines per date   │     └─────────────────┬─────────────────┘
└─────────────────┬─────────────────┘                       │
                  └────────────────────────┬────────────────┘
                                           │
                                           ▼
   ┌───────────────────────────────────────────────────────────────┐
   │           3. Aggregate Totals & Populate Payroll Item         │
   │   Gross Pay = Earnings - Deductions. Block if any issues.     │
   └───────────────────────────────┬───────────────────────────────┘
                                   │
                                   ▼
   ┌───────────────────────────────────────────────────────────────┐
   │           4. Transition Period Status to CALCULATED           │
   │           Record summary totals & dispatch audit event        │
   └───────────────────────────────────────────────────────────────┘
```

### 4.1 Resolution Algorithm (Hourly Workers)
For each employee with hourly configuration:
1. Extract daily records from `attendance_records` for the period.
2. For each day with `regular_hours > 0` or `ot_hours > 0`:
   - Call `EffectiveDateService` on `employee_hourly_rates` for `(employeeId, workDate)`.
   - If no rate record exists: mark `has_blocking_issue = true`, set `blocking_reason = "Missing hourly rate on YYYY-MM-DD"`. **Do not fallback to 0.00.**
   - Otherwise:
     $$\text{Daily Reg Pay} = \text{record.regularHours} \times \text{rate.normalHourlyRate}$$
     $$\text{Daily OT Pay} = \text{record.otHours} \times \text{rate.otHourlyRate}$$
3. Create `payroll_item_lines` recording the date, hours, rate, and amount.

### 4.2 Resolution Algorithm (Salaried Workers)
For employees with monthly salary structures:
1. Query `employee_salary_structures` active across the period (`effective_from` $\le \text{period.endDate}$ and (`effective_to` is null or $\ge \text{period.startDate}$)).
2. If no components exist: mark `has_blocking_issue = true`, set `blocking_reason = "Missing salary structure"`.
3. Resolve base components first (`percentage_basis_component_id IS NULL`), then evaluate dependent percentage components.
4. Tally earnings and deductions into `payroll_item_lines`.

---

## 5. Lifecycle & State Machine

```mermaid
stateDiagram-v2
    [*] --> DRAFT : Period Created (Linked to Locked Attendance)
    DRAFT --> CALCULATED : Run Calculation (Zero Blocking Issues)
    DRAFT --> DRAFT : Run Calculation (Blocking Issues Found)
    CALCULATED --> CALCULATED : Re-Calculate
    CALCULATED --> REVIEWED : HR Admin Reviews & Approves
    REVIEWED --> FINALIZED : Final Sign-Off (Period Locked)
    FINALIZED --> DRAFT : Controlled Unlock (Requires Reason >= 15 chars)
```

| Lifecycle State | Description | Modifiable? | Blocking Issues Permitted? |
|---|---|:---:|:---:|
| `DRAFT` | Initial run created or unlocked after correction. | Yes | Yes (Visible to HR) |
| `CALCULATED` | Engine ran successfully across all employees. | Yes | No (Must be 0 to advance) |
| `REVIEWED` | HR Admin reviewed all employee totals and exceptions. | Yes | No |
| `FINALIZED` | Period formally locked for payment and payslip release. | **NO (Read-only)** | No |

---

## 6. Role-Based Access Control (RBAC)

Phase 4 strictly utilizes the three confirmed roles: `super_admin`, `hr_admin`, and `employee`.

| Permission Code | Description | Super Admin | HR Admin | Employee |
|---|---|:---:|:---:|:---:|
| `payroll:read` | View payroll periods, summaries, and employee breakdowns | ✅ | ✅ | ❌ |
| `payroll:create` | Create new payroll period linked to locked attendance | ✅ | ✅ | ❌ |
| `payroll:calculate` | Trigger engine calculation and recalculation | ✅ | ✅ | ❌ |
| `payroll:review` | Sign off on calculated payroll items | ✅ | ✅ | ❌ |
| `payroll:finalize` | Immutably lock period and authorize payslips | ✅ | ✅ | ❌ |
| `payroll:unlock` | Revert finalized payroll to draft with audit reason | ✅ | ❌ (Override only) | ❌ |
| `payroll:self_read` | View own payslip and historical remuneration | ❌ | ❌ | ✅ |

---

## 7. REST API Architecture

Base URL: `/api/v1/payroll`

### 7.1 HR Admin Endpoints
- `GET /periods`: List all payroll periods with summary totals, status, and blocking counts.
- `POST /periods`: Create a new payroll period (`attendancePeriodId`, `periodCode`, `name`).
- `GET /periods/:id`: Get detailed period metadata and summary cards.
- `POST /periods/:id/calculate`: Execute calculation engine (asynchronous or transactional synchronous).
- `GET /periods/:id/items`: Paginated employee payroll items with filter by status (`all`, `blocked`, `hourly`, `salaried`).
- `GET /periods/:id/items/:itemId`: Detailed employee breakdown including all `payroll_item_lines`.
- `POST /periods/:id/review`: Mark period as `reviewed`.
- `POST /periods/:id/finalize`: Immutably finalize period (`finalized`).
- `POST /periods/:id/unlock`: Controlled unlock (`reason` $\ge 15$ chars). Reverts to `draft`.

### 7.2 Employee Self-Service Endpoints
- `GET /my-payroll`: List employee's finalized payroll periods and net pay history.
- `GET /my-payroll/:periodId/payslip`: Detailed payslip breakdown for the employee (regular hours, OT, earnings, deductions, net pay). Rejects unfinalized periods.

---

## 8. Financial Integrity & Traceability Safeguards

1. **Duplicate Period Prevention:** Compound unique constraints prevent duplicate payroll periods for the same month or the same attendance period.
2. **Locked Attendance Gate:** `AttendancePeriod.status === 'locked'` is validated at both the API controller and service layers.
3. **Missing Rate Anomaly Flagging:** Missing rates never default to 0.00. The item is flagged as blocked, and the period cannot proceed to `reviewed` or `finalized`.
4. **Audit Logging:** Every state transition (`CALCULATE`, `REVIEW`, `FINALIZE`, `UNLOCK`) records an immutable event in `audit_logs` capturing user ID, IP address, user agent, and before/after payloads.
5. **Payslip Confidentiality:** Employees can access only their own records (`WHERE employee_id = req.user.employeeId`). Access to unfinalized payroll runs returns `404 Not Found`.
