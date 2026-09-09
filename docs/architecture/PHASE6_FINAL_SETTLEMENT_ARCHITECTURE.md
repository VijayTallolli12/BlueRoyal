# Phase 6 Architecture: Final Settlement, Gratuity, Leave Salary & Air Tickets

**System:** Blue Royal HRMS  
**Module:** Phase 6 — Employee Separation, Statutory Gratuity, Leave Encashment, Repatriation & Settlement Engine  
**Status:** Requirements & Architecture Definition (Pre-Implementation Pass — Ready for Review)  
**Baseline Standards:** `Master.md`, `docs/PROJECT_STATUS.md`, `docs/architecture/FINAL_ARCHITECTURE.md`, `docs/architecture/PHASE4_PAYROLL_ARCHITECTURE.md`, `docs/architecture/PHASE5_DOCUMENTS_ONBOARDING_ARCHITECTURE.md`

---

## 1. Domain Overview & Architectural Principles

The Final Settlement Engine is the terminal financial reconciliation domain of Blue Royal HRMS. Its responsibility is to compute and execute statutory and contractual end-of-service obligations when an employment relationship concludes.

It synthesizes data across all prior phases:
- **Phase 1 (Masters & Remuneration):** Employee contract parameters, remuneration basis, and effective-dated salary structures / hourly rates.
- **Phase 2 (Attendance & Overtime):** Point-in-time timesheets for the final incomplete payroll cycle up to the Last Working Day.
- **Phase 3 (Leave Management):** Accrued, used, and remaining annual leave balances for leave salary encashment.
- **Phase 4 (Payroll Engine):** Historical payslips, deduction tracking, and prevention of duplicate wage disbursements.
- **Phase 5 (Documents & Compliance):** Statutory visa cancellation, labor card de-registration, and passport return verification.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 UPSTREAM DOMAINS                                       │
│                                                                                        │
│   ┌───────────────────────────┐                      ┌─────────────────────────────┐   │
│   │   Phase 1: Masters & Comp │                      │   Phase 2: Attendance       │   │
│   │   • date_of_joining       │                      │   • Final month actual hrs  │   │
│   │   • employment_type       │                      │   • Final month OT hrs      │   │
│   │   • remuneration_basis    │                      │   • Unpaid absence days     │   │
│   │   • Last Basic Salary     │                      │   • Cut-off: LastWorkingDay │   │
│   └─────────────┬─────────────┘                      └──────────────┬──────────────┘   │
│                 │                                                   │                  │
│                 │           ┌─────────────────────────────┐         │                  │
│                 │           │     Phase 3: Leave          │         │                  │
│                 │           │     • Accrued Annual Leave  │         │                  │
│                 │           │     • Unused Balance Days   │         │                  │
│                 │           │     • Unpaid Leave History  │         │                  │
│                 │           └──────────────┬──────────────┘         │                  │
│                 │                          │                        │                  │
│                 │           ┌──────────────┴──────────────┐         │                  │
│                 │           │     Phase 5: Compliance     │         │                  │
│                 │           │     • Visa Status           │         │                  │
│                 │           │     • Passport Custody      │         │                  │
│                 │           │     • Clearance Docs        │         │                  │
│                 │           └──────────────┬──────────────┘         │                  │
│                 │                          │                        │                  │
└─────────────────┼──────────────────────────┼────────────────────────┼──────────────────┘
                  ▼                          ▼                        ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              PHASE 6: SETTLEMENT DOMAIN                                │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                         employee_separations                                   │   │
│   │   • employee_id                    • separation_type (resignation, etc.)       │   │
│   │   • notice_date                    • last_working_day                          │   │
│   │   • reason                         • clearance_status                          │   │
│   │   • status: PENDING ➔ CLEARED ➔ SETTLED ➔ CANCELLED                            │   │
│   └───────────────────────────────────────┬────────────────────────────────────────┘   │
│                                           │ 1:1                                        │
│                                           ▼                                            │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                         final_settlements                                      │   │
│   │   • settlement_code (SET-YYYY-XXXX)• separation_id                             │   │
│   │   • service_years, service_days    • unpaid_leave_days_deducted                │   │
│   │   • basic_wage_daily, gross_wage_d • last_basic_salary                         │   │
│   │   • gratuity_amount                • leave_encashment_amount                   │   │
│   │   • air_ticket_amount              • final_salary_amount                       │   │
│   │   • gross_additions                • total_deductions        • net_settlement  │   │
│   │   • status: DRAFT ➔ IN_REVIEW ➔ APPROVED ➔ FINALIZED                           │   │
│   └───────────────────────────────────────┬────────────────────────────────────────┘   │
│                                           │ 1:N                                        │
│                                           ▼                                            │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                         settlement_item_lines                                  │   │
│   │   • category: earning | deduction | statutory | recovery                       │   │
│   │   • code: GRATUITY, LEAVE_SALARY, AIR_TICKET, FINAL_WAGES, NOTICE_PAY, LOAN... │   │
│   │   • is_manual: boolean             • adjustment_type: addition | deduction     │   │
│   │   • rate, quantity, amount, calculation_notes                                  │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Core Architectural Invariants
1. **Attendance Cut-Off Enforcement:** Settlement calculations evaluate attendance exclusively up to `last_working_day`. No timesheet hours logged past `last_working_day` may enter the calculation.
2. **Exclusion of Unpaid Absence from Continuous Service:** In statutory alignment with UAE Labor Law (Federal Decree-Law No. 33 of 2021 Article 51), days of unpaid leave (`leave_requests.is_paid = false`) and unauthorized absences are deducted from the continuous service duration for gratuity computation.
3. **Basic Salary Exclusivity for Gratuity:** Gratuity is strictly computed on the employee's **Last Basic Salary** (`salary_components.is_wps_basic = true`). All allowances (Housing, Transport, Utilities, Overtime, Site Incentives) are strictly excluded by law.
4. **Duplicate Payroll Prevention:** If the monthly payroll period covering the final month has already been finalized (`payroll_periods.status = 'finalized'`), regular wage components for that period are omitted from the settlement to avoid double payment. If unfinalized, the partial month's earnings are absorbed into the settlement voucher, and the employee is excluded from subsequent monthly payroll runs.
5. **Zero-Assumption Financial Integrity:** All rate snapshots, service duration multipliers, and component values are permanently stored on the settlement voucher. Calculations are deterministic and fully auditable.
6. **Immutable Finalization & Controlled Unlock:** Upon finalization, the settlement voucher is frozen, the employee profile transitions to `terminated` / `separated`, user login credentials are deactivated, and assignments are terminated. Unlocking requires Super Admin authorization with a mandatory justification ($\ge 15$ characters).

---

## 2. Business Rules & Statutory Alignment

### A. Confirmed Statutory Rules (UAE Federal Decree-Law No. 33 of 2021)

#### 1. Statutory Gratuity (Article 51)
- **Eligibility Threshold:** Minimum 1 continuous year of service ($\text{Continuous Service} \ge 365\text{ days}$).
  - Service $< 1$ year: Gratuity = `0.00 AED`.
- **Wage Basis:** Last Basic Salary only.
  $$\text{Daily Basic Wage} = \frac{\text{Monthly Basic Salary}}{30}$$
- **Tiered Multipliers:**
  - First 5 years of service (Years 1 to 5): **21 days of basic wage** per continuous year of service.
  - Exceeding 5 years of service (Year 6+): **30 days of basic wage** per continuous year of service.
- **Pro-Rata Calculation:** Fractional service years are compensated proportionally:
  $$\text{Gratuity}_{\le 5\text{yr}} = \min(\text{Service Years}, 5.0) \times 21 \times \text{Daily Basic Wage}$$
  $$\text{Gratuity}_{> 5\text{yr}} = \max(0, \text{Service Years} - 5.0) \times 30 \times \text{Daily Basic Wage}$$
  $$\text{Total Gratuity} = \text{Gratuity}_{\le 5\text{yr}} + \text{Gratuity}_{> 5\text{yr}}$$
- **Statutory Maximum Cap:** Total gratuity payout cannot exceed **2 years' gross basic wage** ($24 \times \text{Monthly Basic Salary}$).
  $$\text{Final Gratuity} = \min(\text{Total Gratuity}, 24 \times \text{Monthly Basic Salary})$$
- **Resignation Treatment:** Under Federal Decree-Law No. 33 of 2021, the historical reduction tiers (1/3rd, 2/3rd) under the repealed 1980 law no longer apply. Full gratuity is payable upon voluntary resignation provided the 1-year service threshold is satisfied.

#### 2. Leave Encashment / Leave Salary (Article 29(9))
- **Eligible Days:** Accrued, unused annual leave remaining on `last_working_day`:
  $$\text{Eligible Leave Days} = \text{remaining\_days from annual leave balance} + \text{pro-rata accrual for partial year}$$
- **Wage Basis:** Calculated on the **Daily Basic Wage** ($\text{Monthly Basic Salary} / 30$).
  $$\text{Leave Salary} = \text{Eligible Leave Days} \times \text{Daily Basic Wage}$$
- **Negative Leave Balance (Excess Leave Taken):** If the employee took leave exceeding their accrued entitlement, the negative balance is treated as a statutory recovery (deduction) from the final settlement:
  $$\text{Leave Recovery} = |\text{Negative Days}| \times \text{Daily Basic Wage}$$

#### 3. Repatriation Air Ticket (Article 13(12))
- **Statutory Requirement:** The employer must bear the cost of repatriating the employee to their recruitment location or country of origin upon employment termination.
- **Statutory Exclusions:**
  - The employee has joined another employer within the UAE (local sponsorship transfer / work permit change).
  - The employee unlawfully terminated employment without serving statutory notice.

---

### B. Business Rules Requiring Formal Approval (`BUSINESS RULE REQUIRES APPROVAL`)

The following operational ambiguities are not defined in `Master.md` and require corporate stakeholder sign-off:

| # | Item | Question / Ambiguity | Options / Alternatives | Recommendation |
|---|---|---|---|---|
| **BR-01** | **Hourly Workers Gratuity Basis** | How is the Basic Salary derived for workers paid exclusively on an hourly remuneration basis? | **Option A:** Average total earnings of actual working days over the preceding 6 months.<br>**Option B:** Base hourly rate $\times$ 8 standard daily hours $\times$ 30 days.<br>**Option C:** Contractual monthly wage declared on MOHRE employment contract. | **Option B** (Clear deterministic statutory baseline: $\text{Normal Hourly Rate} \times 8 \times 30$). |
| **BR-02** | **Daily Wage Divisor** | Should the daily wage divisor be 30 days or calendar days (e.g. 365/12 = 30.416 or 26 working days)? | **Option A:** Fixed 30 days ($\text{Monthly Basic} / 30$) — standard UAE court practice.<br>**Option B:** Calendar days in the exit month.<br>**Option C:** Working days in the exit month. | **Option A** (Fixed 30 days divisor for standard statutory uniformity). |
| **BR-03** | **Leave Salary Basis** | Should leave encashment be paid on Basic Wage only or Gross Salary? | **Option A:** Basic Wage only (Statutory minimum under Article 29(9)).<br>**Option B:** Gross Wage (Basic + Housing + Transport) — corporate benefit. | **Option A** (Basic Wage only as per UAE Labor Law). |
| **BR-04** | **Air Ticket Entitlement Scheme** | How is the repatriation air ticket value determined and disbursed? | **Option A:** Cash encashment via fixed tariff matrix based on employee nationality/destination (e.g. AED 1,500 for South Asia, AED 2,500 for Africa/Europe).<br>**Option B:** Actual flight booking by HR administration (zero cash in settlement voucher, recorded as clearance proof).<br>**Option C:** Employee reimbursement upon presenting ticket receipt. | **Option A** (Fixed cash allowance matrix included directly in settlement line items). |
| **BR-05** | **Notice Period Shortfall** | If either party fails to give contractual notice, how is the shortfall calculated? | **Option A:** Basic wage for shortfall calendar days.<br>**Option B:** Gross wage (full salary) for shortfall days.<br>**Option C:** No automated deduction; manual adjustment only. | **Option B** (Gross wage in lieu of notice, mirroring UAE Article 43). |
| **BR-06** | **Article 44 Misconduct Forfeiture** | Does termination under Article 44 (gross misconduct) forfeit end-of-service gratuity? | **Option A:** Full forfeiture of gratuity.<br>**Option B:** Gratuity paid; disciplinary damages pursued via legal channels (modern Decree-Law 33 stance). | **Option A** (Automated flag to withhold gratuity pending legal review). |
| **BR-07** | **Asset / Loan Recovery Clawback** | Can recruitment, visa, or unreturned asset costs be deducted from final settlement? | **Option A:** Visa costs cannot be deducted (MOHRE statutory mandate). Unreturned assets & loan balances capped at 50% of settlement.<br>**Option B:** Full deduction permitted if supported by signed employee loan agreement. | **Option A** (Strict compliance with UAE Labor Law prohibition on visa cost clawbacks). |

---

## 3. Proposed Data Model & Entity Relationships

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              ENTITY RELATIONSHIP DIAGRAM                               │
│                                                                                        │
│   ┌───────────────────────────┐                      ┌─────────────────────────────┐   │
│   │         employees         │                      │      document_types         │   │
│   │   • id (UUID)             │                      │   • id (UUID)               │   │
│   │   • employee_code         │                      │   • code (PASSPORT, etc.)   │   │
│   │   • status                │                      └──────────────┬──────────────┘   │
│   └─────────────┬─────────────┘                                     │                  │
│                 │ 1                                                 │                  │
│                 ▼                                                   ▼                  │
│   ┌───────────────────────────┐                      ┌─────────────────────────────┐   │
│   │   employee_separations    │                      │     employee_documents      │   │
│   │   • id (UUID)             │                      │   • verification_status     │   │
│   │   • separation_type       │                      │   • expiry_date             │   │
│   │   • notice_date           │                      └─────────────────────────────┘   │
│   │   • last_working_day      │                                                        │
│   │   • clearance_status      │                                                        │
│   └─────────────┬─────────────┘                                                        │
│                 │ 1                                                                    │
│                 ▼ 1                                                                    │
│   ┌───────────────────────────┐                      ┌─────────────────────────────┐   │
│   │     final_settlements     │                      │      payroll_periods        │   │
│   │   • id (UUID)             │                      │   • id (UUID)               │   │
│   │   • settlement_code       │                      │   • status: locked          │   │
│   │   • service_years         │                      └─────────────────────────────┘   │
│   │   • last_basic_salary     │                                                        │
│   │   • gratuity_amount       │                                                        │
│   │   • leave_salary_amount   │                                                        │
│   │   • air_ticket_amount     │                                                        │
│   │   • net_settlement        │                                                        │
│   │   • status (DRAFT..FIN)   │                                                        │
│   └─────────────┬─────────────┘                                                        │
│                 │ 1                                                                    │
│                 ▼ N                                                                    │
│   ┌───────────────────────────┐                                                        │
│   │   settlement_item_lines   │                                                        │
│   │   • id (UUID)             │                                                        │
│   │   • category              │                                                        │
│   │   • code                  │                                                        │
│   │   • amount                │                                                        │
│   │   • is_manual             │                                                        │
│   └───────────────────────────┘                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Table 1: `employee_separations`
Tracks the formal separation initiation, notice period, handover, and departmental clearance.

```sql
CREATE TABLE employee_separations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  separation_type VARCHAR(32) NOT NULL, -- resignation, termination_with_notice, contract_expiry, mutual_agreement, termination_probation, termination_summary, death
  notice_date DATE NOT NULL,
  last_working_day DATE NOT NULL,
  contractual_notice_days INTEGER NOT NULL DEFAULT 30,
  actual_notice_days INTEGER NOT NULL,
  reason TEXT,
  repatriation_required BOOLEAN NOT NULL DEFAULT true,
  destination_country VARCHAR(64),
  has_new_uae_employment BOOLEAN NOT NULL DEFAULT false,
  clearance_status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending, partially_cleared, fully_cleared
  clearance_details JSONB NOT NULL DEFAULT '{}', -- asset_handover, company_sim, laptop, tools, access_card
  status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending, cleared, settled, cancelled
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_separations_employee_id ON employee_separations(employee_id);
CREATE INDEX idx_separations_status ON employee_separations(status);
```

### Table 2: `final_settlements`
Master financial settlement voucher aggregating all statutory entitlements, final wages, leave encashment, and recoveries.

```sql
CREATE TABLE final_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_code VARCHAR(32) NOT NULL UNIQUE, -- SET-2026-0001
  separation_id UUID NOT NULL UNIQUE REFERENCES employee_separations(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  service_start_date DATE NOT NULL,
  last_working_day DATE NOT NULL,
  total_service_calendar_days INTEGER NOT NULL,
  unpaid_leave_days INTEGER NOT NULL DEFAULT 0,
  net_service_days INTEGER NOT NULL,
  service_years NUMERIC(5, 2) NOT NULL,
  remuneration_basis VARCHAR(16) NOT NULL, -- hourly, salaried
  last_basic_salary NUMERIC(12, 2) NOT NULL,
  daily_basic_wage NUMERIC(10, 2) NOT NULL,
  gratuity_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  leave_balance_days NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  leave_salary_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  air_ticket_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  final_wages_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  gross_additions NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  net_settlement_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(32) NOT NULL DEFAULT 'draft', -- draft, in_review, approved, finalized, cancelled
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  finalized_by UUID REFERENCES users(id) ON DELETE SET NULL,
  finalized_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_settlements_employee_id ON final_settlements(employee_id);
CREATE INDEX idx_settlements_status ON final_settlements(status);
```

### Table 3: `settlement_item_lines`
Individual itemized calculation and manual adjustment lines providing complete financial auditability.

```sql
CREATE TABLE settlement_item_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES final_settlements(id) ON DELETE CASCADE,
  category VARCHAR(32) NOT NULL, -- statutory, wage, leave, benefit, deduction, recovery
  code VARCHAR(32) NOT NULL, -- GRATUITY_TIER1, GRATUITY_TIER2, LEAVE_ENCASHMENT, UNPAID_DAYS, AIR_TICKET, NOTICE_PAY, ASSET_RECOVERY, LOAN_DEDUCTION
  description VARCHAR(255) NOT NULL,
  is_manual BOOLEAN NOT NULL DEFAULT false,
  adjustment_type VARCHAR(16) NOT NULL DEFAULT 'addition', -- addition, deduction
  quantity NUMERIC(8, 2), -- e.g. service years, leave days, hours
  rate NUMERIC(10, 2), -- e.g. daily wage, ticket cost
  amount NUMERIC(12, 2) NOT NULL,
  calculation_notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_settlement_lines_settlement_id ON settlement_item_lines(settlement_id);
```

---

## 4. Separation & Settlement State Machines

### Separation Lifecycle
```
[ DRAFT / INITIATED ]
        │
        ▼ (Submit Separation Notice)
   [ PENDING ] ──────────(Cancel)──────────> [ CANCELLED ]
        │
        ▼ (All Department Clearances Completed)
   [ CLEARED ]
        │
        ▼ (Final Settlement Voucher Finalized)
   [ SETTLED ]
```

### Settlement Voucher Lifecycle
```
[ DRAFT ] (Automated Calculation Generated)
   │
   ▼ (Submit for Internal Review)
[ IN_REVIEW ] ────────(Dispute / Reject)────> [ DRAFT ]
   │
   ▼ (Management / HR Director Sign-Off)
[ APPROVED ]
   │
   ▼ (Payment Disbursed & Profile Deactivated)
[ FINALIZED ] (Immutable Lock)
   │
   ▼ (Exceptional Super Admin Override with >= 15 char reason)
[ UNLOCKED ] ──(Re-calculate)──> [ DRAFT ]
```

---

## 5. Proposed REST API Contracts

### Endpoints
| HTTP Verb | Path | Permission Required | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/separations` | `separations:create` | Initiate employee separation record |
| `GET` | `/api/v1/separations` | `separations:read` | List separations with filters |
| `GET` | `/api/v1/separations/:id` | `separations:read` | Get separation details and clearance |
| `PUT` | `/api/v1/separations/:id/clearance` | `separations:update` | Update departmental clearance items |
| `POST` | `/api/v1/settlements/calculate` | `settlements:create` | Generate settlement calculation preview |
| `POST` | `/api/v1/settlements` | `settlements:create` | Create draft settlement voucher |
| `GET` | `/api/v1/settlements` | `settlements:read` | List settlements with status/filters |
| `GET` | `/api/v1/settlements/:id` | `settlements:read` | Get settlement voucher with itemized lines |
| `POST` | `/api/v1/settlements/:id/lines` | `settlements:update` | Add manual adjustment line (earning/deduction) |
| `DELETE` | `/api/v1/settlements/:id/lines/:lineId` | `settlements:update` | Remove manual adjustment line |
| `POST` | `/api/v1/settlements/:id/review` | `settlements:review` | Transition status to `in_review` |
| `POST` | `/api/v1/settlements/:id/approve` | `settlements:approve` | Approve settlement voucher |
| `POST` | `/api/v1/settlements/:id/finalize` | `settlements:finalize` | Finalize, freeze voucher, deactivate employee |
| `POST` | `/api/v1/settlements/:id/unlock` | `settlements:unlock` | Super Admin unlock override |
| `GET` | `/api/v1/settlements/my-settlement` | `settlements:self_read`| Employee view own finalized settlement |

---

## 6. Security, RBAC & Audit Matrix

### Role Permissions
| Permission Code | Super Admin | HR Admin | Employee |
|---|---|---|---|
| `separations:read` | Yes | Yes | No |
| `separations:create` | Yes | Yes | No |
| `separations:update` | Yes | Yes | No |
| `settlements:read` | Yes | Yes | No |
| `settlements:create` | Yes | Yes | No |
| `settlements:update` | Yes | Yes | No |
| `settlements:review` | Yes | Yes | No |
| `settlements:approve` | Yes | Yes | No |
| `settlements:finalize` | Yes | Yes | No |
| `settlements:unlock` | **Yes (Exclusive)** | **No (403)** | No |
| `settlements:self_read` | Yes | Yes | **Yes (Own Finalized Only)** |

### Audit Events
Every sensitive mutation produces an immutable record in `audit_logs`:
- `SEPARATION_INITIATED`
- `CLEARANCE_UPDATED`
- `SETTLEMENT_CREATED`
- `SETTLEMENT_RECALCULATED`
- `SETTLEMENT_ADJUSTMENT_ADDED`
- `SETTLEMENT_ADJUSTMENT_REMOVED`
- `SETTLEMENT_REVIEWED`
- `SETTLEMENT_APPROVED`
- `SETTLEMENT_FINALIZED`
- `SETTLEMENT_UNLOCKED`
- `SETTLEMENT_CANCELLED`
