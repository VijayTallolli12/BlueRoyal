# Phase 6 UI Plan: Final Settlement, Gratuity & Separation Management

**System:** Blue Royal HRMS  
**Module:** Phase 6 — Final Settlement UI/UX & Responsive Interaction Plan  
**Status:** Requirements & Design Definition (Pre-Implementation Pass)  
**Baseline Standards:** `docs/ui/UI_DESIGN_SYSTEM.md`, `docs/ui/PRODUCT_DESIGN_AUDIT.md`, `docs/ui/FUTURE_MODULE_UI_BLUEPRINT.md`

---

## 1. Information Architecture & Navigation

Phase 6 integrates seamlessly into the established Blue Royal HRMS application shell:

```
App Shell Sidebar
├── CORE
│   └── Dashboard (/dashboard)
├── PEOPLE
│   ├── Employee Directory (/employees)
│   └── Onboarding Hub (/onboarding)
├── OPERATIONS
│   ├── Attendance Sheet (/attendance)
│   ├── Leave Management (/leave)
│   ├── Payroll Periods (/payroll)
│   └── Final Settlements (/settlements)  <── [NEW PHASE 6 ROUTE]
├── COMPLIANCE
│   └── Document Center (/documents)
├── MASTERS
│   └── Masters Hub (/masters)
└── MY SELF-SERVICE
    ├── My Attendance (/attendance/my-attendance)
    ├── My Leave (/leave/my-leave)
    ├── My Payroll (/payroll/my-payroll)
    ├── My Documents (/documents/my-documents)
    └── My Settlement (/settlements/my-settlement)  <── [NEW PHASE 6 ESS ROUTE]
```

### Contextual Entry Points
- **Primary Route:** `/settlements` (Gated by `settlements:read`).
- **Profile Action Shortcut:** Within the Employee Profile Inspection Drawer (`/employees`), the action menu provides:
  `[ Initiate Separation / Final Settlement ]` $\rightarrow$ Opens the Initiate Separation Drawer pre-populated with employee context.
- **Dashboard Action Queue:** The Command Center displays a dedicated triage card:
  `[ Pending Final Settlements (N) ]` $\rightarrow$ One-click filter to pending vouchers requiring review or approval.

---

## 2. Screen 1: Settlements Hub & Overview (`/settlements`)

### A. Operational Metrics Bar
A high-level 4-card telemetry row:
1. **Pending Separations:** Headcount of initiated separations currently in clearance or notice period.
2. **Settlements In Review:** Total vouchers awaiting HR Director / Management approval.
3. **Finalized (Current Month):** Total settlements finalized in the active billing period.
4. **Net Disbursed (Current Month):** Aggregate AED amount of finalized end-of-service benefits.

### B. Settlements Register Table
Enterprise responsive data table with sticky left columns and smooth horizontal scrolling:

| Column Header | Class / Responsive Behavior | Content / Formatting |
|---|---|---|
| **Settlement Code** | `.col-sticky-left` | `SET-2026-0001` (Monospace font, primary link) |
| **Employee** | `.col-sticky-left` | Avatar initials + Full Name + Code stacked |
| **Separation Type** | Standard | Badge: `Resignation` (blue), `Termination` (amber), `Contract Expiry` (purple) |
| **Last Working Day** | Standard | Date formatted `DD MMM YYYY` |
| **Service Tenure** | `.col-hide-mobile` | e.g. `3 yrs 4 mos` |
| **Gratuity (AED)** | `.col-hide-tablet` | Tabular numbers, right-aligned |
| **Leave Encash (AED)** | `.col-hide-tablet` | Tabular numbers, right-aligned |
| **Net Payable (AED)** | High-priority | Bold tabular numbers (e.g. `24,850.00 AED`) |
| **Status** | High-priority | Badge: `DRAFT` (gray), `IN_REVIEW` (amber), `APPROVED` (blue), `FINALIZED` (emerald) |
| **Actions** | `.col-sticky-right` | View Voucher, Review, Finalize, Print |

### C. Search & Filter Bar
- **Search Input:** Filter by employee name, code, or settlement voucher number.
- **Status Filter:** Pills for `All`, `Draft`, `In Review`, `Approved`, `Finalized`.
- **Primary CTA Button:** `+ Initiate Employee Separation` (Launches Drawer).

---

## 3. Screen 2: Initiate Separation Drawer (`.drawer-panel`)

Contextual slide-over drawer launched from the Settlements Hub or Employee Directory:

```
┌─────────────────────────────────────────────────────────────┐
│  Initiate Employee Separation                        [ ✕ ]  │
├─────────────────────────────────────────────────────────────┤
│  EMPLOYEE SELECTION                                         │
│  [ Select Employee: Alice Smith (EP-1002)                 ▼]│
│  Current Status: Active | Date of Joining: 15 Jan 2022      │
│                                                             │
│  SEPARATION DETAILS                                         │
│  Separation Type:                                           │
│  [ (•) Resignation  ( ) Termination  ( ) Contract Expiry   ]│
│  [ ( ) Mutual Agreement  ( ) Probation Termination         ]│
│                                                             │
│  Notice Submission Date:     Last Working Day (LWD):        │
│  [ 2026-09-01             ]  [ 2026-09-30                 ]│
│  Contractual Notice: 30 days | Actual Served: 30 days       │
│                                                             │
│  Reason / Remarks:                                          │
│  [ Career advancement abroad                              ]│
│                                                             │
│  REPATRIATION & EXIT PARAMETERS                             │
│  [✓] Repatriation Air Ticket Required                       │
│  Destination Country: [ Philippines                       ▼]│
│  [ ] Employee has joined new employer in UAE (Exempt Ticket)│
│                                                             │
│  DEPARTMENTAL CLEARANCE CHECKLIST                           │
│  [✓] IT Equipment & Laptops returned                        │
│  [✓] Access Badges & Uniforms handed over                   │
│  [ ] Outstanding Loan / Advances verified (Finance)        │
│  [ ] Visa Cancellation Application Initiated (HR)           │
├─────────────────────────────────────────────────────────────┤
│  [ Cancel ]              [ Generate Settlement Calculation ]│
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Screen 3: Settlement Calculation Voucher (`/settlements/:id`)

The flagship financial reconciliation workspace. Structured into an Executive Summary followed by 4 detailed entitlement cards and an adjustments table:

### A. Executive Financial Header
- **Employee Snapshot:** Name, Code, Designation, Joining Date, Last Working Day, Net Continuous Service Duration ($X.XX$ years).
- **Status Chip:** Animated status pill with contextual actions (`Submit for Review`, `Approve`, `Finalize`, `Unlock`).
- **Financial Summary Cards:**
  - **Gross Additions:** $\text{AED } 32,450.00$
  - **Total Deductions / Recoveries:** $\text{AED } 1,200.00$
  - **Net Settlement Payable:** $\text{AED } 31,250.00$ (Prominent typography)

### B. 4-Quadrant Calculation Cards
1. **Statutory Gratuity Card:**
   - Base Wage: Last Basic Salary ($\text{AED } 6,000.00$) $\rightarrow$ Daily Basic Wage ($\text{AED } 200.00$).
   - Service Years Breakdown:
     - Tier 1 (First 5 Years): $3.72 \times 21 \times 200.00 = \text{AED } 15,624.00$
     - Tier 2 (Exceeding 5 Years): $0.00 \text{ yrs} = \text{AED } 0.00$
   - Unpaid Absences Deducted: $4\text{ days}$.
   - Statutory Cap Check: $\text{AED } 15,624.00 < \text{AED } 144,000.00$ (Cap: 2 years basic).
2. **Leave Salary Encashment Card:**
   - Carried forward from previous year: $6.0\text{ days}$.
   - Current year pro-rata accrued: $17.5\text{ days}$.
   - Used in current year: $4.0\text{ days}$.
   - Net Unused Leave: $19.5\text{ days}$.
   - Calculation: $19.5 \times 200.00 = \text{AED } 3,900.00$.
3. **Final Month Unpaid Wages Card:**
   - Attendance Interval: 01 Sep 2026 to 22 Sep 2026 ($22\text{ calendar days}$).
   - Timesheet Hours Logged: $176\text{ Regular Hours}$, $14\text{ OT Hours}$.
   - Earnings: Regular Pay ($\text{AED } 4,400.00$) + Overtime Pay ($\text{AED } 525.00$).
   - Deduplication Check: "September monthly payroll run has not been executed. Wages integrated directly into settlement."
4. **Repatriation Air Ticket Card:**
   - Destination: Manila, Philippines.
   - Status: Eligible (No local UAE transfer).
   - Entitlement: Standard repatriation tariff ($\text{AED } 2,000.00$).

### C. Adjustments & Deductions Ledger
Itemized table displaying non-statutory adjustments:
- Salary Advance Recovery ($-\text{AED } 1,000.00$)
- Unreturned Access Tool Replacement ($-\text{AED } 200.00$)
- Action: `+ Add Manual Adjustment Line` (Drawer allowing type: addition/deduction, description, amount, justification note).

---

## 5. High-Consequence Modal Dialogs (`.dialog-box`)

In adherence to the design system rules established in Phase 4:
- Routine forms and line edits use **slide-over drawers** (`.drawer-panel`).
- Destructive, irreversible actions use **focused centered modal dialogs** (`.dialog-box`):

### 1. Finalize Settlement Dialog (`.dialog-box.dialog-danger`)
- **Header:** "Finalize Settlement Voucher & Deactivate Employee Profile"
- **Body:** Warns that finalization is an irreversible financial lock:
  - Freezes all settlement calculations permanently.
  - Transitions employee status to `terminated`.
  - Terminates active client assignments.
  - Deactivates user portal login credentials.
- **Actions:** `[ Cancel ]` and `[ Finalize & Lock Settlement ]`.

### 2. Super Admin Unlock Override Dialog (`.dialog-box.dialog-danger`)
- **Header:** "Unlock Finalized Settlement Voucher (Super Admin Override)"
- **Body:** Requires explicit confirmation and a mandatory audit reason:
  - Input: `<textarea>` requiring $\ge 15$ characters.
  - Explains that unlocking returns the settlement to `DRAFT` and generates a permanent compliance audit trail.
- **Actions:** `[ Cancel ]` and `[ Authorize Unlock ]` (Disabled until $\ge 15$ chars entered).

---

## 6. Screen 4: Employee Self-Service (ESS) View (`/settlements/my-settlement`)

Clean, printable statement voucher formatted for desktop and mobile viewports:
- **Header:** Blue Royal HRMS company branding, employee details, separation date, service tenure.
- **Itemized Earnings & Statutory Benefits:** Gratuity, Leave Encashment, Air Ticket, Final Wages.
- **Itemized Deductions:** Loan balance, recoveries.
- **Net Payout:** Prominently highlighted in primary brand styling.
- **Digital Clearance Sign-off:** Displays verified clearance timestamps.
- **Action:** `[ Download Settlement Voucher (PDF) ]`.

---

## 7. Responsive Breakpoint Strategy

| Breakpoint | Target Devices | Layout Adjustments |
|---|---|---|
| **1920px – 1440px** | Widescreen Desktop | 4-column metric bar, 4-quadrant settlement cards side-by-side (2x2 grid). |
| **1280px – 1024px** | Small Desktop / Tablet Landscape | Metric bar 2x2, 2-column calculation cards, table hides secondary metadata columns. |
| **768px** | Tablet Portrait | Metric bar wraps to 2 columns, calculation cards stack into single column accordion, drawer width expands to 90vw. |
| **430px – 375px** | Mobile Devices (iPhone SE, Pro Max) | Full-width stacked metric cards, sticky employee column with code stacked below name, 100% drawer width, touch targets $\ge 44$px. |
