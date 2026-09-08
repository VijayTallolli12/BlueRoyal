# Blue Royal HRMS — Phase 2 Attendance UI & Screen Design Specification

**Document ID:** `DOC-UI-PLAN-PHASE2-ATT-001`  
**Date:** 2026-09-08  
**Scope:** Frontend User Experience, Component Architecture, Monthly Matrix Grid, Excel Ingestion Modals, and Self-Service Views  
**Governing Documents:** `Master.md`, `FINAL_ARCHITECTURE.md`, `docs/architecture/PHASE2_ATTENDANCE_ARCHITECTURE.md`  
**Target View:** Dedicated Angular Feature Route `/attendance` and `/attendance/my-attendance`  
**Status:** **UI Design Plan — Pending Review & Sign-Off**  

---

## 1. Executive Summary & UX Design Goals

Phase 2 replaces the consolidated masters approach with **dedicated enterprise feature routing** for Attendance. The primary user interface is the **Monthly Attendance Sheet Management Console** (`AttendanceSheetComponent`), designed specifically for high-efficiency, multi-row, multi-column timekeeping by HR administrators and operations managers.

### Core UX Goals
1. **High-Density Data Grid:** Renders up to 31 calendar day columns alongside employee identity, project tagging, and calculated totals without visual clutter.
2. **Instant Visual Feedback:** Differentiates Weekly Offs (`WO`), Public Holidays (`PH`), Absences (`A`), Overtime badges (`+2.5h`), and Anomalies via subtle, accessible color palettes.
3. **Responsive Keyboard Navigation:** Excel-like arrow key navigation and Enter-to-next-row navigation for rapid data entry.
4. **State-Driven Action Bar:** Contextual action buttons dynamically reflect the period's lifecycle state (`draft` $\rightarrow$ `submitted` $\rightarrow$ `approved` $\rightarrow$ `locked`).
5. **Zero Silent Changes:** Strict visual indicators and modal prompts for locking, unlocking, and cell-level corrections.

---

## 2. Component Hierarchy & Architectural Structure

```
AttendanceFeatureModule (Standalone Components)
├── AttendanceSheetComponent (Primary Route: /attendance)
│   ├── AttendanceFilterBarComponent
│   │   ├── PeriodSelector (Month picker: 2026-03)
│   │   ├── ClientDropdown (Cascading filter)
│   │   ├── ProjectDropdown (Filtered by selected client)
│   │   ├── EmployeeSearchInput (Debounced live filter by code/name)
│   │   └── AnomalyFilterToggle ("Show Anomalies Only")
│   ├── AttendanceSummaryCardsComponent
│   │   ├── TotalWorkersCard (Count active in period)
│   │   ├── TotalActualHoursCard (Sum of all hours)
│   │   ├── TotalRegularHoursCard (Standard payroll base)
│   │   ├── TotalOtHoursCard (Premium overtime pool)
│   │   └── PeriodStatusBadge (Draft | Submitted | Approved | Locked)
│   ├── AttendanceGridComponent
│   │   ├── StickyEmployeeHeaderColumns (Code, Name, Designation, Project)
│   │   ├── CalendarDayColumns (Day 1 to 28/29/30/31 with DOW indicator)
│   │   │   ├── StandardCell (Editable input / Read-only text)
│   │   │   ├── WeeklyOffCell (Gray/Blue tint, WO badge)
│   │   │   ├── PublicHolidayCell (Amber tint, PH badge)
│   │   │   └── AnomalyIndicator (Red indicator dot with hover tooltip)
│   │   └── StickyRowTotalsColumns (Days Present, Regular Hrs, OT Hrs, Total Hrs)
│   ├── ExcelImportModalComponent
│   │   ├── DropzoneUploader (Supports .xlsx, .csv up to 10MB)
│   │   ├── PreValidationSummary (Total rows, Valid rows, Error count)
│   │   └── ErrorDetailsTable (Row number, Employee Code, Day, Input Value, Reason)
│   ├── UnlockReasonModalComponent (Mandatory justification capture for locked sheets)
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
│  │ 125 Active       │  │ 26,450.00 hrs    │  │ 22,100.00 hrs    │  │ 4,350.00 hrs     │  │ 3 Warnings (Review)       │ │
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
│  BR003 Rajiv Kumar  Helper│  [ 0.0 ]│  [ 0.0 ]│  [ 8.0 ]│ ... │  [ 0.0 ]│ ... │  [ 8.0 ]│   24    192.0h   0.0h 192.0h │
│        Unassigned Shift ⚠️ │   (WO)  │   (A)   │         │     │   (PH)  │     │         │                              │
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
| **Public Holiday (No Work)** | `#fffbeb` (Light Amber) | `#b45309` (Amber) | `1px solid #fde68a` | `PH` badge | *"Public Holiday: UAE National Day (Rest Day)"* |
| **Public Holiday (Worked)** | `#fef3c7` (Medium Amber) | `#92400e` (Dark Amber)| `1px solid #fcd34d` | `PH-OT` | *"8.0h Overtime (Work on Statutory Public Holiday)"* |
| **Absence (Zero Hours Workday)** | `#fef2f2` (Light Red) | `#991b1b` (Red) | `1px solid #fca5a5` | `A` badge | *"Absent (0.0h logged on regular working day)"* |
| **Approved Leave (Phase 3)** | `#f5f3ff` (Light Purple)| `#5b21b6` (Purple) | `1px solid #ddd6fe` | `LV` badge | *"Approved Annual Leave (Phase 3 Leave Integration)"* |
| **Validation Anomaly** | `#fff1f2` (Light Rose) | `#be123c` (Rose) | `2px solid #e11d48` | `⚠️` dot | Hover shows exact error reason (e.g. `Hours > 16.0`) |

---

## 4. Modal Specifications

### 4.1 Excel Import Modal (`ExcelImportModalComponent`)
- **Trigger:** Click **"Import Excel"** in action bar.
- **Header:** *"Import Monthly Attendance — March 2026"*
- **Dropzone Area:** Accepts `.xlsx`, `.xls`, `.csv`. Supports drag-and-drop or file browser. Maximum file size: 10 MB.
- **Pre-Validation Analysis:** Upon selecting a file, the frontend invokes `POST /api/v1/attendance/import?dryRun=true`.
  - Displays progress spinner: *"Validating spreadsheet structure and employee records..."*
  - Summary Bar:
    - Total Rows Analyzed: `150`
    - Valid Records: `147`
    - Errors Encountered: `3`
- **Error Review Table (Conditional):** If errors are found, renders a detailed diagnostic table:
  - Columns: `Row #`, `Employee Code`, `Day Column`, `Input Value`, `Failure Reason`.
  - Example: `Row 14 | BR-012 | Day 18 | 26.50 | "Hours cannot exceed 24.00 per calendar day"`
  - Action: **"Download Error Report (.csv)"** allows HR to send the exact issues to the site supervisor.
  - The **"Confirm & Commit Import"** button remains disabled until all errors are resolved.
- **Successful Commit:** When 0 errors exist, clicking **"Commit Import"** saves records and updates the live grid.

### 4.2 Reopen / Correction Modal (`UnlockReasonModalComponent`)
- **Trigger:** Click **"Request Unlock / Correction"** when viewing a locked period.
- **Header:** *"Unlock Attendance Period — March 2026"*
- **Warning Alert:** *"Unlocking this period will transition the attendance sheet back to DRAFT. All subsequent modifications will be permanently recorded in the audit log. The period must be re-submitted and re-approved before running Payroll."*
- **Form Controls:**
  - `unlockReason`: Textarea (Required, minimum 15 characters, counter: `0 / 15 chars min`).
  - Checkbox: `[ ] I confirm that this attendance correction is authorized by HR Operations.`
- **Action Buttons:** `[ Cancel ]` and `[ Reopen Period for Correction ]` (Destructive action button styling `#b91c1c`).

### 4.3 Cell Audit Drawer (`CellAuditDrawerComponent`)
- **Trigger:** Right-click or click history icon on an edited cell.
- **Drawer Title:** *"Audit History — Ahmed Khan (BR-001) on 2026-03-15"*
- **Timeline Items:**
  - **2026-03-28 14:32:** Changed from `8.00h` to `10.50h` by `hr_admin@blueroyal.com`. Reason: *"Overtime approved by site engineer for concrete pour delay"*.
  - **2026-03-25 09:15:** Initial import from `Site_Timesheet_A.xlsx` (`8.00h`).

---

## 5. Employee Self-Service View (`MyAttendanceComponent`)

- **Route:** `/attendance/my-attendance`
- **Accessible By:** All authenticated employees (`attendance:self_read`).
- **Layout:**
  - **Top Bar:** Month Navigator (`< February 2026 | March 2026 | April 2026 >`).
  - **Key Metrics:**
    - Days Present: `26 Days`
    - Regular Hours: `208.0 Hours`
    - Overtime Hours: `32.5 Hours`
    - Total Hours: `240.5 Hours`
  - **Monthly Calendar / Timesheet Table:**
    - Columns: `Date`, `Day`, `Assigned Shift`, `Shift Hours`, `Logged Hours`, `Regular Hours`, `OT Hours`, `Status`.
    - Clean, read-only presentation. No input boxes or editing controls.
    - Export personal timesheet to PDF button.

---

## 6. Angular Reactive State Architecture (Signals)

The attendance feature utilizes Angular 18 Signals in `AttendanceStateService`:

```typescript
@Injectable({ providedIn: 'root' })
export class AttendanceStateService {
  // 1. Reactive State Signals
  public readonly selectedPeriod = signal<AttendancePeriod | null>(null);
  public readonly selectedClient = signal<string | null>(null);
  public readonly selectedProject = signal<string | null>(null);
  public readonly searchQuery = signal<string>('');
  public readonly showAnomaliesOnly = signal<boolean>(false);
  public readonly records = signal<AttendanceRecord[]>([]);
  public readonly isSaving = signal<boolean>(false);
  public readonly isDirty = signal<boolean>(false);

  // 2. Computed Metrics (Instant UI Reactivity)
  public readonly filteredRecords = computed(() => {
    // Filters records by selected client, project, search text, and anomaly flag
  });

  public readonly totalActualHours = computed(() => {
    return this.filteredRecords().reduce((sum, r) => sum + Number(r.actualHours), 0);
  });

  public readonly totalRegularHours = computed(() => {
    return this.filteredRecords().reduce((sum, r) => sum + Number(r.regularHours), 0);
  });

  public readonly totalOtHours = computed(() => {
    return this.filteredRecords().reduce((sum, r) => sum + Number(r.otHours), 0);
  });

  public readonly isLocked = computed(() => {
    return this.selectedPeriod()?.status === 'locked';
  });
}
```

---

## 7. Usability, Performance & Accessibility (a11y)

1. **Virtualized Scrolling:** For workforces with hundreds of workers, the grid uses `@angular/cdk/scrolling` (`cdk-virtual-scroll-viewport`) to render only visible rows, guaranteeing 60fps scrolling performance.
2. **Keyboard Traversal:**
   - `ArrowLeft` / `ArrowRight`: Moves focus across consecutive calendar days.
   - `ArrowUp` / `ArrowDown`: Moves focus across employees on the same calendar day.
   - `Tab`: Standard forward tab traversal.
   - `Enter`: Commits current cell and shifts focus to the next employee row.
3. **Accessibility (WCAG 2.1 AA):**
   - High contrast ratios ($\ge 4.5:1$) on all status text and background badges.
   - Accessible ARIA labels on all dynamic inputs: `aria-label="Hours worked for Ahmed Khan on March 15, 2026"`.
   - Screen reader announcements for auto-saved changes via `aria-live="polite"`.
