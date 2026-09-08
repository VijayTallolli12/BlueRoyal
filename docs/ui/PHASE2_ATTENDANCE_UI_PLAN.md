# Blue Royal HRMS — Phase 2 Attendance UI & Screen Design Specification (Revised)

**Document ID:** `DOC-UI-PLAN-PHASE2-ATT-002`  
**Date:** 2026-09-09  
**Scope:** Frontend User Experience, Component Architecture, Monthly Matrix Grid, Excel Ingestion Modals, and Self-Service Views  
**Governing Documents:** `Master.md`, `FINAL_ARCHITECTURE.md`, `docs/architecture/PHASE2_ATTENDANCE_ARCHITECTURE.md`  
**Target View:** Dedicated Angular Feature Route `/attendance` and `/attendance/my-attendance`  
**Status:** **UI Design Plan — Revised per Requirements Review**  

---

## 1. Executive Summary & UX Design Principles

Phase 2 introduces a dedicated, high-density **Monthly Attendance Sheet Management Console** (`AttendanceSheetComponent`) at `/attendance`. The UI focuses purely on HR timekeeping efficiency, shift-aware hours calculation, and regulatory approval gating, avoiding over-engineering into an overly complex generic spreadsheet application.

### Core UX Principles
1. **High-Density Monthly Matrix:** Clean, responsive tabular grid rendering days $1 \dots 31$ alongside employee identity, project tags, and live calculated totals.
2. **Accessible Color & Badge Cues:** Visual tokens for Weekly Offs (`WO`), Public Holidays (`PH`), Absences (`A`), Overtime pills (`+2.5h`), Ineligible contract days, and Anomaly badges (`⚠️`).
3. **Strict Shift Warning & Blocking Indicator:** Any worker lacking an assigned shift is prominently flagged with `MISSING_SHIFT_ASSIGNMENT`. The UI disables period submission/approval buttons and shows a direct prompt: *"2 workers have unassigned shifts. Assign shifts to proceed with approval."*
4. **Intuitive Keyboard Navigation:** Arrow key navigation across cells and Enter-to-next-row traversal for high-speed manual data entry.
5. **Role-Driven Controls:** Action buttons correspond strictly to confirmed system roles (`Super Admin`, `HR Admin`, `Employee`). HR Admin has full operational control to edit, import, submit, approve, lock, and unlock.

---

## 2. Component Hierarchy & Feature Structure

```
AttendanceFeatureModule (Standalone Components)
├── AttendanceSheetComponent (Primary Route: /attendance)
│   ├── AttendanceFilterBarComponent
│   │   ├── PeriodSelector (Month picker: e.g. 2026-03)
│   │   ├── ClientDropdown (Cascading filter)
│   │   ├── ProjectDropdown (Filtered by selected client)
│   │   ├── EmployeeSearchInput (Debounced text filter by code/name)
│   │   └── AnomalyFilterToggle ("Show Anomalies Only")
│   ├── AttendanceSummaryCardsComponent
│   │   ├── TotalWorkersCard (Eligible active headcount)
│   │   ├── TotalActualHoursCard (Sum of entered hours)
│   │   ├── TotalRegularHoursCard (Standard payroll base)
│   │   ├── TotalOtHoursCard (Overtime pool)
│   │   └── PeriodStatusBadge (Draft | Submitted | Approved | Locked)
│   ├── AttendanceGridComponent
│   │   ├── StickyEmployeeHeaderColumns (Code, Name, Designation, Project)
│   │   ├── CalendarDayColumns (Day 1 to 28/29/30/31 with DOW indicator)
│   │   │   ├── StandardCell (Editable input / Read-only text)
│   │   │   ├── WeeklyOffCell (Light Slate, WO badge)
│   │   │   ├── PublicHolidayCell (Light Amber, PH badge)
│   │   │   ├── IneligibleCell (Hatched pattern: pre-joining / post-contract)
│   │   │   └── AnomalyIndicator (Red indicator dot with hover tooltip)
│   │   └── StickyRowTotalsColumns (Days Present, Regular Hrs, OT Hrs, Total Hrs)
│   ├── ExcelImportModalComponent
│   │   ├── DropzoneUploader (Supports .xlsx, .csv up to 10MB)
│   │   ├── PreValidationSummary (Total rows, Valid rows, Error count)
│   │   └── ErrorDetailsTable (Row number, Employee Code, Day, Input Value, Reason)
│   ├── UnlockReasonModalComponent (Mandatory justification capture for reopening locked sheets)
│   └── CellAuditDrawerComponent (Slide-out drawer showing historical modifications)
│
└── MyAttendanceComponent (Employee Self-Service Route: /attendance/my-attendance)
    ├── MonthNavigator (Previous / Next month switcher)
    ├── PersonalSummaryCards (My Total Hours, My Regular Hours, My Overtime)
    └── PersonalTimesheetTable (Date, Day, Shift Timings, Logged Hours, Reg/OT Breakdown, Status)
```

---

## 3. Primary Screen: Monthly Attendance Management Grid

### 3.1 Screen Layout Wireframe

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  BLUE ROYAL HRMS   │  Dashboard  │  Masters  │  Attendance  │  Leaves  │  Payroll             [ HR Administrator ] ▼   │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  ATTENDANCE MANAGEMENT — MARCH 2026                                              [ Status: DRAFT ]                      │
│                                                                                                                        │
│  [ Period: March 2026 ▼ ]  [ Client: All Clients ▼ ]  [ Project: All Projects ▼ ]  [ Search Employee... 🔍 ]           │
│  [x] Show Anomalies Only   [ Action: Save Draft 💾 ]  [ Import Excel 📤 ]  [ Export Template 📥 ]  [ Submit for Approval ➔ ] │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────────────┐ │
│  │ Total Workers    │  │ Actual Hours     │  │ Regular Hours    │  │ Overtime Hours   │  │ Flagged Anomalies         │ │
│  │ 125 Active       │  │ 26,450.00 hrs    │  │ 22,100.00 hrs    │  │ 4,350.00 hrs     │  │ 1 Missing Shift (Blocking)│ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘  └───────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  EMPLOYEE INFORMATION     │  DAY 1  │  DAY 2  │  DAY 3  │ ... │  DAY 15 │ ... │  DAY 31 │  TOTALS (CALCULATED)        │
│  Code  Name         Desig │  Sun(WO)│  Mon    │  Tue    │     │  Sun(PH)│     │  Tue    │  Days  Regular    OT    Total │
├───────────────────────────┼─────────┼─────────┼─────────┼─────┼─────────┼─────┼─────────┼──────────────────────────────┤
│  BR001 Ahmed Khan   Mason │  [ 0.0 ]│  [ 8.0 ]│ [ 10.5 ]│ ... │  [ 8.0 ]│ ... │  [ 8.0 ]│   26    208.0h  32.5h 240.5h │
│        Downtown Tower     │   (WO)  │         │  (+2.5) │     │  (PH-OT)│     │         │                              │
├───────────────────────────┼─────────┼─────────┼─────────┼─────┼─────────┼─────┼─────────┼──────────────────────────────┤
│  BR002 John Smith   Welder│  [ 4.0 ]│  [ 8.0 ]│  [ 8.0 ]│ ... │  [ 0.0 ]│ ... │  [ 8.0 ]│   25    200.0h  14.0h 214.0h │
│        Marina Creek Res.  │  (!OT)  │         │         │     │   (PH)  │     │         │                              │
├───────────────────────────┼─────────┼─────────┼─────────┼─────┼─────────┼─────┼─────────┼──────────────────────────────┤
│  BR003 Rajiv Kumar  Helper│  [ 0.0 ]│  [ 8.0 ]│  [ 8.0 ]│ ... │  [ 0.0 ]│ ... │  [ 0.0 ]│    0      0.0h   0.0h  16.0h │
│        Missing Shift ⚠️   │   (WO)  │ [Unres] │ [Unres] │     │   (PH)  │     │ (Unres) │  * Blocking Approval *       │
├───────────────────────────┼─────────┼─────────┼─────────┼─────┼─────────┼─────┼─────────┼──────────────────────────────┤
│  BR004 Sarah Lee (Contract│  [ 0.0 ]│  [ 8.0 ]│  [ 8.0 ]│ ... │ //////  │ ... │ //////  │   14    112.0h   0.0h 112.0h │
│        Contract End: Mar15│   (WO)  │         │         │     │(Inelig) │     │(Inelig) │  * Post-Contract Days *      │
├───────────────────────────┴─────────┴─────────┴─────────┴─────┴─────────┴─────┴─────────┴──────────────────────────────┤
│  MONTHLY COLUMN TOTALS:   │  12.0h  │ 980.0h  │1,045.0h │ ... │ 450.0h  │ ... │ 990.0h  │ 3,120d  22,100h 4,350h 26,450h│
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Cell Visual Design Tokens & Behavior

| Cell State / Type | Background Color | Text / Badge Color | Input Border | Visual Badge | Tooltip / Interaction |
|---|---|---|---|:---:|---|
| **Standard Workday (Normal Hours)** | `#ffffff` (White) | `#1a202c` (Dark) | `1px solid #e2e8f0` | None | Regular hours matching shift |
| **Workday with Overtime** | `#f0fdf4` (Light Green) | `#166534` (Dark Green)| `1px solid #86efac` | `+2.5h` pill | *"8.0h Regular + 2.5h OT (Standard 8h Shift)"* |
| **Weekly Off (No Work)** | `#f8fafc` (Light Slate) | `#64748b` (Muted) | `1px solid #e2e8f0` | `WO` badge | *"Weekly Off (Standard Rest Day)"* |
| **Weekly Off (Worked)** | `#eff6ff` (Light Blue) | `#1e40af` (Dark Blue) | `1px solid #93c5fd` | `WO-OT` | *"8.0h Overtime (Work on Weekly Rest Day)"* |
| **Public Holiday (No Work)** | `#fffbeb` (Light Amber) | `#b45309` (Amber) | `1px solid #fde68a` | `PH` badge | *"Public Holiday (Rest Day)"* |
| **Public Holiday (Worked)** | `#fef3c7` (Medium Amber) | `#92400e` (Dark Amber)| `1px solid #fcd34d` | `PH-OT` | *"8.0h Overtime (Work on Public Holiday)"* |
| **Absence (Zero Hours Workday)** | `#fef2f2` (Light Red) | `#991b1b` (Red) | `1px solid #fca5a5` | `A` badge | *"Absent (0.0h logged on regular working day)"* |
| **Approved Leave (Phase 3 Hook)** | `#f5f3ff` (Light Purple)| `#5b21b6` (Purple) | `1px solid #ddd6fe` | `LV` badge | *"On Approved Leave"* |
| **Missing Shift Assignment (Blocking)** | `#fff1f2` (Light Rose) | `#be123c` (Rose) | `2px solid #e11d48` | `⚠️ Unres` | *"Missing Shift: Hours uncalculated; blocks approval"* |
| **Ineligible Day (Contract Ended)** | `#f1f5f9` (Hatched Slate)| `#94a3b8` (Muted) | `1px solid #cbd5e1` | `/////` | *"Ineligible: Contract ended on 2026-03-15"* |

---

## 4. Modal Specifications

### 4.1 Excel Import Modal (`ExcelImportModalComponent`)
- **Trigger:** Click **"Import Excel"** in action bar.
- **Header:** *"Import Monthly Attendance — March 2026"*
- **Dropzone Area:** Accepts `.xlsx`, `.xls`, `.csv`. Supports drag-and-drop or file browser. Maximum file size: 10 MB.
- **Pre-Validation Analysis:** Upon selecting a file, frontend invokes `POST /api/v1/attendance/import?dryRun=true`.
  - Summary Bar: Total Rows Analyzed (`150`), Valid Records (`147`), Errors Encountered (`3`).
  - Error Table: Displays `Row #`, `Employee Code`, `Day Column`, `Input Value`, and `Failure Reason`.
  - Action: **"Download Error Report (.csv)"** allows HR to export errors for site supervisors.
  - The **"Confirm & Commit Import"** button remains disabled until all errors are resolved.

### 4.2 Reopen / Correction Modal (`UnlockReasonModalComponent`)
- **Trigger:** Click **"Request Unlock / Correction"** when viewing a locked period.
- **Actor:** HR Admin / Super Admin.
- **Header:** *"Unlock Attendance Period — March 2026"*
- **Warning Alert:** *"Unlocking this period will transition the attendance sheet back to DRAFT. All subsequent modifications will be permanently recorded in the audit log. The period must be re-submitted and re-approved before running Payroll."*
- **Form Controls:**
  - `unlockReason`: Textarea (Required, minimum 15 characters).
  - Checkbox: `[ ] I confirm that this attendance correction is authorized.`
- **Action Buttons:** `[ Cancel ]` and `[ Reopen Period for Correction ]` (Destructive action button styling `#b91c1c`).

### 4.3 Cell Audit Drawer (`CellAuditDrawerComponent`)
- **Trigger:** Click audit history icon on an edited cell.
- **Drawer Title:** *"Audit History — Ahmed Khan (BR-001) on 2026-03-15"*
- **Timeline Items:**
  - **2026-03-28 14:32:** Changed from `8.00h` to `10.50h` by `hr_admin`. Reason: *"Overtime approved by site engineer for concrete pour delay"*.
  - **2026-03-25 09:15:** Initial import from `Site_Timesheet_A.xlsx` (`8.00h`).

---

## 5. Employee Self-Service View (`MyAttendanceComponent`)

- **Route:** `/attendance/my-attendance`
- **Accessible By:** All authenticated employees (`attendance:self_read`).
- **Layout:**
  - **Top Bar:** Month Navigator (`< February 2026 | March 2026 | April 2026 >`).
  - **Key Metrics:** Days Present (`26`), Regular Hours (`208.0`), Overtime Hours (`32.5`), Total Hours (`240.5`).
  - **Monthly Timesheet Table:** Date, Day, Assigned Shift, Logged Hours, Regular Hours, OT Hours, Status badges.
  - Strictly read-only: Zero input fields or editing controls rendered.

---

## 6. Usability & Keyboard Navigation

1. **Virtualized Scrolling:** Grid utilizes `@angular/cdk/scrolling` (`cdk-virtual-scroll-viewport`) to render only visible rows, ensuring rapid scrolling for large employee lists.
2. **Keyboard Traversal:**
   - `ArrowLeft` / `ArrowRight`: Moves across consecutive calendar days.
   - `ArrowUp` / `ArrowDown`: Moves across employees on the same calendar day.
   - `Enter`: Commits current cell and shifts focus to the next employee row.
