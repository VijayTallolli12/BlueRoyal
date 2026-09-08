# Phase 4 UI Plan: Payroll Management & Employee Payslips

**System:** Blue Royal HRMS  
**Module:** Phase 4 — Payroll Engine & Financial Integrity  
**Status:** UI Design Plan (Ready for Review — No Implementation)  
**Baseline Standards:** `Master.md`, `FINAL_ARCHITECTURE.md`, `docs/PROJECT_STATUS.md`, `docs/architecture/PHASE4_PAYROLL_ARCHITECTURE.md`, `docs/workflows/PHASE4_PAYROLL_WORKFLOWS.md`

---

## 1. UI Architecture & Design Principles

The Phase 4 Payroll UI avoids dense spreadsheet-like interfaces and instead provides clear, structured financial views optimized for clarity, decision-making, and auditability:

1. **Clean Separation of Concerns:**
   - **HR / Management Hub (`/payroll`):** Operational dashboard for period setup, calculation execution, anomaly resolution, review, and finalization.
   - **Employee Self-Service (`/payroll/my-payroll`):** Transparent, readable payslips and earnings history for authenticated employees.
2. **Deterministic Status Indicators:**
   - `DRAFT`: Gray badge (Initial or unlocked state).
   - `CALCULATED`: Blue badge (Calculated, awaiting review).
   - `REVIEWED`: Yellow/Amber badge (Sign-off complete, ready for lock).
   - `FINALIZED`: Green badge (Locked and immutable).
3. **Traceable Drill-Down:**
   - Clicking an employee row opens a slide-over drawer displaying exact line items, rates, hours, and daily calculation breakdowns.
4. **Strict Guardrails:**
   - Action buttons (e.g. *Run Calculation*, *Mark as Reviewed*, *Finalize*) dynamically disable with explanatory tooltips whenever blocking anomalies exist.

---

## 2. Screen 1: HR Payroll Management Hub (`/payroll`)

### 2.1 Screen Layout & Wireframe

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  BLUE ROYAL HRMS   │  Masters  │  Attendance  │  Leave  │  Payroll             [ HR Admin ] ▼          │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  Payroll Management Hub                                                         [ + New Payroll Run ]  │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐  │
│  │ Total Gross Pay       │ │ Total Deductions      │ │ Total Net Payable     │ │ Active Runs           │  │
│  │ AED 245,600.00        │ │ AED 12,400.00         │ │ AED 233,200.00        │ │ 1 In Progress         │  │
│  └───────────────────────┘ └───────────────────────┘ └───────────────────────┘ └───────────────────────┘  │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  PAYROLL PERIODS                                                                                       │
│  ┌───────────┬─────────────┬──────────────┬────────────┬─────────────┬───────────┬─────────┬────────┐  │
│  │ Period    │ Name        │ Linked Att.  │ Employees  │ Net Pay     │ Status    │ Issues  │ Action │  │
│  ├───────────┼─────────────┼──────────────┼────────────┼─────────────┼───────────┼─────────┼────────┤  │
│  │ 2026-05   │ May 2026    │ ATT-2026-05  │ 42         │ AED 233,200 │ CALCULATED│ 0       │ Manage │  │
│  │ 2026-04   │ April 2026  │ ATT-2026-04  │ 40         │ AED 218,500 │ FINALIZED │ 0       │ View   │  │
│  └───────────┴─────────────┴──────────────┴────────────┴─────────────┴───────────┴─────────┴────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Functional Behavior
- **Period Creation Modal:**
  - Dropdown populated only with attendance periods that have `status == 'locked'`.
  - Auto-fills `periodCode`, `startDate`, and `endDate`.
  - Prevents creating duplicate runs for an already processed attendance cycle.
- **Summary KPI Cards:**
  - Aggregates active period gross, deductions, and net disbursements.

---

## 3. Screen 2: Payroll Run Detail & Item Inspection (`/payroll/periods/:id`)

### 3.1 Screen Layout & Wireframe

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ◄ Back to Periods   │   Period: May 2026 (2026-05)   │   Status: CALCULATED                           │
│  Actions:  [ ⚡ Recalculate ]   [ ✓ Mark Reviewed ]   [ 🔒 Finalize Run ]   [ ⚠️ Unlock (Admin) ]       │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐  │
│  │ Total Gross           │ │ Total Deductions      │ │ Net Disbursement      │ │ Blocking Issues     │  │
│  │ AED 245,600.00        │ │ AED 12,400.00         │ │ AED 233,200.00        │ │ 0 (All Clear)       │  │
│  └───────────────────────┘ └───────────────────────┘ └───────────────────────┘ └───────────────────────┘  │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  Filters: [ All Employees ▼ ]  [ Status: All ▼ ]  [ Remuneration: Hourly & Salaried ▼ ]  [ Search: Q ] │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  EMPLOYEE PAYROLL ITEMS                                                                                │
│  ┌──────┬──────────────────┬────────────┬─────────────┬──────────┬──────────┬──────────┬────────┬───────┐  │
│  │ Code │ Employee Name    │ Scheme     │ Reg / OT Hrs│ Gross    │ Deduct.  │ Net Pay  │ Status │ Action│  │
│  ├──────┼──────────────────┼────────────┼─────────────┼──────────┼──────────┼──────────┼────────┼───────┤  │
│  │ E001 │ Ahmed Al-Falasi  │ Hourly     │ 176h / 24h  │ 8,400.00 │ 0.00     │ 8,400.00 │ Valid  │ View  │  │
│  │ E002 │ John Smith       │ Salaried   │ Standard    │ 12,500.00│ 500.00   │ 12,000.00│ Valid  │ View  │  │
│  │ E003 │ Tariq Mansoor    │ Hourly     │ 160h / 0h   │ 0.00     │ 0.00     │ 0.00     │ BLOCK  │ Resolve│  │
│  └──────┴──────────────────┴────────────┴─────────────┴──────────┴──────────┴──────────┴────────┴───────┘  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Slide-Over Detail Drawer (Employee Calculation Line Breakdown)
When clicking *"View"* or an employee row, a slide-over panel displays:
- **Header:** Employee Code, Full Name, Designation, Remuneration Scheme.
- **Attendance Summary Tile:**
  - Actual Hours Logged, Regular Hours, Overtime Hours, Leave Days, Absences.
- **Itemized Calculation Lines Table:**
  - `Category` (Earning, Deduction, Adjustment)
  - `Description` (e.g. `Regular Hours Pay (176 hrs @ AED 35.00/hr)`)
  - `Rate` (AED 35.00)
  - `Quantity` (176.00)
  - `Amount` (AED 6,160.00)
  - `Date / Basis` (Point-in-time rate validity interval)
- **Net Calculation Box:**
  $$\text{Gross Pay (AED 8,400.00)} - \text{Total Deductions (AED 0.00)} = \mathbf{\text{AED 8,400.00}}$$

---

## 4. Screen 3: Employee Self-Service — My Payroll (`/payroll/my-payroll`)

### 4.1 Screen Layout & Wireframe

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  BLUE ROYAL HRMS   │  My Attendance  │  My Leave  │  My Payroll               [ Ahmed Al-Falasi ] ▼    │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  My Payroll & Compensation History                                                                     │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  LATEST FINALIZED PAYSLIP: May 2026                                                                    │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │  Blue Royal Facilities Management LLC                                      Payslip: May 2026     │  │
│  │  Employee: Ahmed Al-Falasi (BR-EMP-001)                Designation: Senior Electrician           │  │
│  ├──────────────────────────────────────────────────────────────────────────────────────────────────┤  │
│  │  ATTENDANCE SUMMARY: 26 Days Worked  │  176.00 Regular Hours  │  24.00 Overtime Hours  │ 0 Absent │  │
│  ├──────────────────────────────────────────────────────┬───────────────────────────────────────────┤  │
│  │  EARNINGS                                            │  DEDUCTIONS                               │  │
│  │  • Regular Pay (176h @ 35.00/h):        AED 6,160.00 │  • None Recorded                 AED 0.00 │  │
│  │  • Overtime Pay (24h @ 45.00/h):        AED 1,080.00 │                                           │  │
│  ├──────────────────────────────────────────────────────┴───────────────────────────────────────────┤  │
│  │  NET PAYABLE:  AED 7,240.00                                               [ 🖨️ Download / Print ] │  │
│  └──────────────────────────────────────────────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  HISTORICAL PAYROLL RECORDS                                                                            │
│  ┌───────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬───────────┐  │
│  │ Period    │ Cycle Dates  │ Regular Hrs  │ OT Hrs       │ Gross Pay    │ Deductions   │ Net Pay   │  │
│  ├───────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼───────────┤  │
│  │ 2026-04   │ Apr 01 - 30  │ 168.00       │ 16.00        │ AED 6,600.00 │ AED 0.00     │ AED 6,600 │  │
│  │ 2026-03   │ Mar 01 - 31  │ 176.00       │ 20.00        │ AED 7,060.00 │ AED 0.00     │ AED 7,060 │  │
│  └───────────┴─────────────-┴──────────────┴──────────────┴──────────────┴──────────────┴───────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Security & Isolation
- The screen automatically queries `/api/v1/payroll/my-payroll`.
- Unfinalized periods are never visible to the employee.
- Attempts to query other employee IDs are strictly blocked at backend via JWT identity mapping.
