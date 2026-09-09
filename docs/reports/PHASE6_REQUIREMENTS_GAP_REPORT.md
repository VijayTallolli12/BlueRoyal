# Phase 6 Requirements & Architecture Gap Report
## Final Settlement, Gratuity, Leave Salary & Air Tickets

**Document Date:** 2026-09-09  
**System:** Blue Royal HRMS  
**Phase:** Phase 6 — End-of-Service Settlements & Separation  
**Status:** Requirements Analysis & Architecture Definition Complete — Implementation Gated  

---

## Executive Summary

This report establishes the complete requirements, architectural specifications, statutory foundations, and operational gap analysis for **Phase 6: Final Settlement, Gratuity, Leave Salary & Air Tickets**.

In accordance with strict project constraints:
- **Zero Phase 6 code has been written.**
- **Zero database migrations have been executed.**
- **Zero existing APIs, models, or contracts have been modified.**
- All statutory rules are aligned with **UAE Federal Decree-Law No. 33 of 2021 on the Regulation of Labour Relations**.
- All operational ambiguities have been identified and explicitly flagged as `BUSINESS RULE REQUIRES APPROVAL`.

---

## 1. Confirmed Requirements (Source of Truth)

The following requirements are confirmed through statutory UAE Labor Law and existing Blue Royal HRMS domain architecture (`Master.md`, `PHASE4_PAYROLL_ARCHITECTURE.md`, `PHASE5_DOCUMENTS_ONBOARDING_ARCHITECTURE.md`):

1. **Continuous Service Duration:**
   - Service start date is anchored to `employees.date_of_joining`.
   - Service end date is anchored to `employee_separations.last_working_day`.
   - Days of unpaid leave (`leave_requests.is_paid = false`) and unauthorized absences are deducted from continuous service before computing gratuity.
2. **Statutory Gratuity Entitlement (Article 51):**
   - Eligibility threshold: Continuous service $\ge 1$ year ($365\text{ calendar days}$). Service $< 1$ year yields AED 0.00 gratuity.
   - Wage basis: Computed strictly on **Last Basic Salary** (`salary_components.is_wps_basic = true`). All allowances (housing, transport, overtime) are legally excluded.
   - Multipliers: **21 days' basic wage per year** for the first 5 years of service; **30 days' basic wage per year** for each year exceeding 5 years.
   - Pro-rata calculation: Incomplete fractional years are computed proportionally on a daily basis.
   - Statutory cap: Total gratuity payout cannot exceed **2 years' gross basic wage** ($24 \times \text{Monthly Basic Salary}$).
3. **Resignation Parity (Federal Decree-Law No. 33 of 2021):**
   - Gratuity reduction tiers for voluntary resignation (1/3rd, 2/3rd under the repealed 1980 law) are abolished. Full gratuity is payable upon voluntary resignation provided the employee completed $\ge 1$ year.
4. **Leave Salary Encashment (Article 29(9)):**
   - Accrued, unused annual leave remaining on `last_working_day` is en-cashed into the final settlement.
   - Unspent days are derived from `employee_leave_balances` plus pro-rata accrual ($2.5\text{ days/month}$) up to `last_working_day`.
5. **Repatriation Air Ticket (Article 13(12)):**
   - Employer bears the cost of repatriating the employee to their recruitment country upon contract termination unless the employee transfers to a new UAE employer.
6. **Attendance Cut-Off & Final Wages:**
   - Evaluates timesheet records between the 1st of the exit month and `last_working_day`.
   - Must avoid duplicate wage disbursement if regular monthly payroll for that period was already finalized.
7. **Immutable Audit & Finalization Lifecycle:**
   - Multi-stage voucher governance: `DRAFT` $\rightarrow$ `IN_REVIEW` $\rightarrow$ `APPROVED` $\rightarrow$ `FINALIZED`.
   - Finalization freezes all calculations, transitions employee status to `terminated`, and deactivates portal user credentials.
   - Unlocking is strictly restricted to `super_admin` with a mandatory $\ge 15$-character justification note.

---

## 2. Undefined Requirements

The following operational aspects are not addressed in existing documentation and must be resolved before software development begins:

1. **Hourly Remuneration Gratuity Basis:** While salaried staff have an explicit `BASIC` component, hourly workers do not have a separate "basic" rate. A standardized formula is required to derive an hourly worker's basic monthly equivalent wage.
2. **Daily Wage Calculation Divisor:** Statutory conventions in UAE dispute resolution utilize either a fixed 30-day divisor or calendar days in the final month. A single consistent divisor must be locked.
3. **Leave Encashment Rate Basis:** Whether leave salary encashment should be valued on Basic Wage only (statutory minimum under Article 29(9)) or Gross Package.
4. **Air Ticket Tariff Matrix:** Fixed monetary allowance per destination country versus physical flight ticket booking proof without cash disbursement.
5. **Notice Period Shortfall Valuation:** Valuation basis (Basic vs Gross) for deducting notice shortfall if an employee departs without serving contractual notice.
6. **Disciplinary Termination (Article 44):** Policy on whether end-of-service gratuity is completely forfeited or withheld pending legal review.
7. **Deduction Limits & Non-Clawback Items:** Maximum permissible deduction threshold from final settlement (statutory 50% cap) and explicit prohibition of visa recruitment cost clawback.

---

## 3. Business Rules Requiring Approval (`BUSINESS RULE REQUIRES APPROVAL`)

| Ref ID | Policy Dimension | Ambiguity / Decision Required | Proposed Recommendation | Impact if Unapproved |
|---|---|---|---|---|
| **BR-01** | **Hourly Workers Gratuity Basis** | How to establish the basic monthly wage for hourly employees who lack a fixed monthly salary. | **Recommend Option B:** Base Hourly Rate $\times 8\text{ hours/day} \times 30\text{ days}$. | Inability to calculate gratuity for hourly workforce. |
| **BR-02** | **Daily Wage Divisor** | Choice between fixed 30-day divisor ($\text{Basic}/30$) versus actual days in month. | **Recommend Option A:** Fixed 30 days divisor for standard statutory uniformity across all months. | Inconsistent daily wage values between 28, 30, and 31-day months. |
| **BR-03** | **Leave Encashment Basis** | Calculate unused leave on Basic Wage only or Gross Salary. | **Recommend Option A:** Basic Wage only ($\text{Daily Basic Wage} \times \text{Remaining Days}$), matching statutory Article 29(9). | Overpayment or contract dispute risk. |
| **BR-04** | **Air Ticket Tariff Matrix** | Monetary allowance matrix by region vs actual flight ticket booking by HR. | **Recommend Option A:** Cash allowance matrix: Gulf AED 1,000; South Asia AED 1,500; SE Asia AED 2,000; Other AED 2,500. Exempt if local transfer. | Ambiguity in settlement voucher monetary totals. |
| **BR-05** | **Notice Shortfall Deduction** | Formula for deduction when employee fails to serve contractual notice. | **Recommend Option B:** Gross Wage in lieu of notice for unserved calendar days, matching UAE Article 43. | Dispute regarding unserved notice penalties. |
| **BR-06** | **Article 44 Misconduct Forfeiture** | Whether Article 44 gross misconduct termination forfeits gratuity. | **Recommend Option A:** System allows HR Admin to flag "Withhold Gratuity - Article 44" pending legal sign-off. | Legal exposure under modern Decree-Law 33. |
| **BR-07** | **Deduction Caps & Visa Clawback** | Caps on asset loss/advance deductions; prohibition of visa cost recovery. | **Recommend Option A:** Strict adherence to MOHRE rules: Visa costs zero deduction; loan/asset deductions capped at 50% of net. | Potential MOHRE labor complaint. |

---

## 4. Proposed Data Model

The proposed relational schema integrates with existing tables (`employees`, `users`, `payroll_periods`, `salary_components`):

### 1. `employee_separations`
- `id` (UUID, PK)
- `employee_id` (UUID, FK $\rightarrow$ `employees.id`)
- `separation_type` (VARCHAR: `resignation`, `termination_with_notice`, `contract_expiry`, `mutual_agreement`, `termination_probation`, `termination_summary`, `death`)
- `notice_date` (DATE)
- `last_working_day` (DATE)
- `contractual_notice_days` (INTEGER)
- `actual_notice_days` (INTEGER)
- `reason` (TEXT)
- `repatriation_required` (BOOLEAN)
- `destination_country` (VARCHAR)
- `has_new_uae_employment` (BOOLEAN)
- `clearance_status` (VARCHAR: `pending`, `partially_cleared`, `fully_cleared`)
- `clearance_details` (JSONB)
- `status` (VARCHAR: `pending`, `cleared`, `settled`, `cancelled`)
- `created_by` (UUID, FK $\rightarrow$ `users.id`)
- `timestamps`

### 2. `final_settlements`
- `id` (UUID, PK)
- `settlement_code` (VARCHAR: `SET-YYYY-XXXX`, UNIQUE)
- `separation_id` (UUID, FK $\rightarrow$ `employee_separations.id`, UNIQUE)
- `employee_id` (UUID, FK $\rightarrow$ `employees.id`)
- `service_start_date` (DATE)
- `last_working_day` (DATE)
- `total_service_calendar_days` (INTEGER)
- `unpaid_leave_days` (INTEGER)
- `net_service_days` (INTEGER)
- `service_years` (NUMERIC(5,2))
- `remuneration_basis` (VARCHAR: `hourly`, `salaried`)
- `last_basic_salary` (NUMERIC(12,2))
- `daily_basic_wage` (NUMERIC(10,2))
- `gratuity_amount` (NUMERIC(12,2))
- `leave_balance_days` (NUMERIC(5,2))
- `leave_salary_amount` (NUMERIC(12,2))
- `air_ticket_amount` (NUMERIC(10,2))
- `final_wages_amount` (NUMERIC(12,2))
- `gross_additions` (NUMERIC(12,2))
- `total_deductions` (NUMERIC(12,2))
- `net_settlement_amount` (NUMERIC(12,2))
- `status` (VARCHAR: `draft`, `in_review`, `approved`, `finalized`, `cancelled`)
- `reviewed_by`, `reviewed_at`
- `approved_by`, `approved_at`
- `finalized_by`, `finalized_at`
- `notes` (TEXT)
- `timestamps`

### 3. `settlement_item_lines`
- `id` (UUID, PK)
- `settlement_id` (UUID, FK $\rightarrow$ `final_settlements.id`)
- `category` (VARCHAR: `statutory`, `wage`, `leave`, `benefit`, `deduction`, `recovery`)
- `code` (VARCHAR: `GRATUITY_TIER1`, `GRATUITY_TIER2`, `LEAVE_ENCASHMENT`, `UNPAID_WAGES`, `AIR_TICKET`, `NOTICE_SHORTFALL`, `LOAN_RECOVERY`, `ASSET_DAMAGE`)
- `description` (VARCHAR)
- `is_manual` (BOOLEAN)
- `adjustment_type` (VARCHAR: `addition`, `deduction`)
- `quantity` (NUMERIC(8,2))
- `rate` (NUMERIC(10,2))
- `amount` (NUMERIC(12,2))
- `calculation_notes` (TEXT)
- `created_by` (UUID, FK $\rightarrow$ `users.id`)
- `timestamps`

---

## 5. Proposed REST APIs

| Method | Endpoint Path | Permission | Description |
|---|---|---|---|
| `POST` | `/api/v1/separations` | `separations:create` | Initiate separation notice |
| `GET` | `/api/v1/separations` | `separations:read` | List separations with filters |
| `GET` | `/api/v1/separations/:id` | `separations:read` | Get separation record & clearance status |
| `PUT` | `/api/v1/separations/:id/clearance`| `separations:update` | Update asset/IT/finance clearance checklist |
| `POST` | `/api/v1/settlements/calculate` | `settlements:create` | Compute real-time settlement preview |
| `POST` | `/api/v1/settlements` | `settlements:create` | Save draft settlement voucher |
| `GET` | `/api/v1/settlements` | `settlements:read` | List settlement vouchers with search/filter |
| `GET` | `/api/v1/settlements/:id` | `settlements:read` | Get settlement voucher with itemized lines |
| `POST` | `/api/v1/settlements/:id/lines` | `settlements:update` | Add manual adjustment line |
| `DELETE`| `/api/v1/settlements/:id/lines/:lineId` | `settlements:update`| Remove manual adjustment line |
| `POST` | `/api/v1/settlements/:id/review` | `settlements:review` | Move voucher to `in_review` |
| `POST` | `/api/v1/settlements/:id/approve` | `settlements:approve`| Approve settlement voucher |
| `POST` | `/api/v1/settlements/:id/finalize` | `settlements:finalize`| Finalize, lock voucher, deactivate employee |
| `POST` | `/api/v1/settlements/:id/unlock` | `settlements:unlock` | Super Admin unlock override |
| `GET` | `/api/v1/settlements/my-settlement` | `settlements:self_read`| Employee ESS view own finalized settlement |

---

## 6. Proposed Lifecycle State Machines

### Separation Lifecycle
$$\text{PENDING} \xrightarrow{\text{clearance done}} \text{CLEARED} \xrightarrow{\text{settlement finalized}} \text{SETTLED}$$
$$(\text{PENDING} \xrightarrow{\text{withdrawn}} \text{CANCELLED})$$

### Settlement Voucher Lifecycle
$$\text{DRAFT} \xrightarrow{\text{submit}} \text{IN\_REVIEW} \xrightarrow{\text{sign-off}} \text{APPROVED} \xrightarrow{\text{disburse}} \text{FINALIZED}$$
$$\text{FINALIZED} \xrightarrow{\text{Super Admin unlock}} \text{DRAFT}$$

---

## 7. Proposed RBAC Matrix

| Capability | Super Admin | HR Admin | Employee |
|---|---|---|---|
| View Separations Register | ✅ Yes | ✅ Yes | ❌ No |
| Initiate Employee Separation | ✅ Yes | ✅ Yes | ❌ No |
| Update Clearance Checklist | ✅ Yes | ✅ Yes | ❌ No |
| Generate Settlement Preview | ✅ Yes | ✅ Yes | ❌ No |
| Add / Remove Manual Adjustments | ✅ Yes | ✅ Yes | ❌ No |
| Submit for Internal Review | ✅ Yes | ✅ Yes | ❌ No |
| Approve Settlement Voucher | ✅ Yes | ✅ Yes | ❌ No |
| Finalize & Lock Settlement Voucher | ✅ Yes | ✅ Yes | ❌ No |
| **Unlock Finalized Settlement** | ✅ **Yes (Exclusive)** | ❌ **No (HTTP 403)** | ❌ No |
| **View Own Finalized Settlement** | ✅ Yes | ✅ Yes | ✅ **Yes (Own Only)** |

---

## 8. Proposed Audit Events

Every mutation logs to `audit_logs` with actor ID, IP, user-agent, action, resource ID, and old/new states:
1. `SEPARATION_INITIATED`
2. `CLEARANCE_UPDATED`
3. `SETTLEMENT_CREATED`
4. `SETTLEMENT_RECALCULATED`
5. `SETTLEMENT_ADJUSTMENT_ADDED`
6. `SETTLEMENT_ADJUSTMENT_REMOVED`
7. `SETTLEMENT_REVIEWED`
8. `SETTLEMENT_APPROVED`
9. `SETTLEMENT_FINALIZED`
10. `SETTLEMENT_UNLOCKED`
11. `SETTLEMENT_CANCELLED`

---

## 9. UI / UX Workflow Overview

1. **Navigation:** `/settlements` accessible under the `OPERATIONS` cluster in the application sidebar.
2. **Settlements Hub:** Metrics row (Pending, In Review, Finalized, Net Total), search/filter toolbar, and responsive settlements register table.
3. **Initiate Separation Drawer (`.drawer-panel`):** Employee selection, notice dates, repatriation destination, and clearance checklist.
4. **Settlement Calculator Workspace (`/settlements/:id`):** Executive summary banner with Gross, Deductions, and Net Payable, followed by 4 distinct entitlement breakdown cards (Gratuity, Leave Encashment, Final Month Wages, Air Ticket) and an adjustments ledger.
5. **High-Consequence Modal Dialogs (`.dialog-box`):** Focused centered dialogs for approval, finalization, and Super Admin unlock with mandatory $\ge 15$-character reason.
6. **ESS My Settlement (`/settlements/my-settlement`):** Clean printable statement voucher for employee records and PDF export.

---

## 10. Technical Risks & Cross-Module Dependencies

| Risk | Downstream Impact | Architectural Mitigation |
|---|---|---|
| **Duplicate Wage Payment** | Paying employee wages twice (once in regular monthly payroll and once in final settlement). | Engine verifies `payroll_periods` for the exit month. If finalized, final wage line is AED 0.00. If open, settlement absorbs wages and flags employee as excluded from the regular monthly run. |
| **Post-Settlement Timesheet Edits** | Attendance records modified after a settlement voucher is finalized. | Finalization sets `last_working_day` as a strict upper bound and deactivates employee assignments, rejecting subsequent attendance logs. |
| **Unapproved Leave Encashment Valuations** | Calculating leave on gross salary leading to budget variance or labor dispute. | Strict parameterization (`BR-03`). Default statutory formula uses Basic Wage; configuration flag permits gross wage only upon explicit approval. |
| **Excessive Settlement Recoveries** | Deducting loan balances exceeding legal limits, provoking MOHRE labor claims. | Enforce statutory 50% deduction ceiling rule on non-statutory recoveries and strictly block recruitment visa clawbacks. |
| **Hourly Rate Volatility** | Changes to hourly rates during the final month. | Point-in-time rate resolution engine evaluates exact hourly rate effective on each work date up to `last_working_day`. |
