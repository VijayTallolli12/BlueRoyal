# Blue Royal HRMS — Phase 3: Leave Management UI Specification & Plan

**Document ID:** `DOC-UI-PHASE3-LEAVE`  
**Status:** Approved UI Specification  
**Version:** 1.0.0  
**Date:** 2026-09-09  

---

## 1. User Interface Overview & Information Architecture

The Leave Management UI is engineered around two distinct user journeys aligned with the confirmed roles:
1. **Administrative Management Hub (`/leave`):** Designed for `hr_admin` and `super_admin` to oversee enterprise leave requests, review and action applications, configure leave types, and manage employee annual balance allocations.
2. **Employee Self-Service View (`/leave/my-leave`):** Designed for `employee` (as well as admins reviewing their personal records) to view real-time leave entitlement balances, submit new leave applications with date-range pickers and day counts, and monitor application history with cancellation controls.

---

## 2. Navigation & Role-Based Access

The frontend navigation bar and dashboard cards dynamically adapt based on user permissions:

```
Navigation Header:
├── Dashboard
├── Masters Hub (HR Admin / Super Admin)
├── Attendance Hub (HR Admin / Super Admin)
├── Leave Management (HR Admin / Super Admin) ──► /leave
├── My Attendance (All Authenticated Users)
└── My Leave (All Authenticated Users) ─────────► /leave/my-leave
```

---

## 3. Screen Specifications

### Screen 1: Employee Self-Service — My Leave (`/leave/my-leave`)
- **Route:** `/leave/my-leave`
- **Guards:** `authGuard`, `permissionGuard(['leave:self_read'])`
- **Layout & Components:**
  1. **Header & Action Bar:**
     - Title: "My Leave Portal"
     - Subtitle: "View your personal leave entitlement balances and submit leave requests."
     - Action Button: "+ Request Leave" (opens interactive application modal).
  2. **Entitlement Balance KPI Cards:**
     - Responsive 4-card grid displaying:
       - **Annual Leave Allocated:** `30.00` days (with badge showing carry-forward).
       - **Leave Used:** `5.00` days.
       - **Pending Approvals:** `2.00` days.
       - **Available Remaining:** `23.00` days (highlighted in prominent primary color).
     - Secondary summary pills for Sick Leave and Unpaid Leave balances.
  3. **Leave Applications History Table:**
     - Columns:
       - Request Number (`LR-202609-0001`)
       - Leave Type (with color tag, e.g. Annual, Sick)
       - Date Range (`2026-09-15` to `2026-09-18`)
       - Total Days (`4.00 days`)
       - Reason
       - Status Badge (`PENDING` [yellow], `APPROVED` [green], `REJECTED` [red], `CANCELLED` [gray])
       - Action: "Cancel" button (enabled only when status is `PENDING`).
  4. **Request Leave Modal (`RequestLeaveDialog`):**
     - Form fields:
       - Leave Type dropdown (populated from active `leave_types`)
       - Start Date (date picker with disabled dates prior to joining)
       - End Date (date picker)
       - Computed Duration display (auto-computes working days or calendar days based on leave type config)
       - Reason (textarea, min 5 characters)
     - Real-time client validation: checks remaining balance and flags overlap or insufficient balance.

---

### Screen 2: Administrative Leave Management Hub (`/leave`)
- **Route:** `/leave`
- **Guards:** `authGuard`, `permissionGuard(['leave:read'])`
- **Tabbed Interface:**
  1. **Tab 1: Requests Management (`LeaveRequestsTab`):**
     - Filter Bar:
       - Status Filter dropdown (`All`, `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`)
       - Search input (Employee Name / Code)
       - Leave Type filter dropdown
     - Data Table:
       - Employee (Code + Name)
       - Request #
       - Leave Type
       - Start Date ➔ End Date
       - Total Days
       - Reason
       - Submitted At
       - Status Badge
       - Actions:
         - When `PENDING`: "Approve" (green button) and "Reject" (red button, opens reason prompt).
         - When `APPROVED`: "Cancel / Revoke" button (opens revocation modal).
  2. **Tab 2: Leave Types Catalog (`LeaveTypesTab`):**
     - Header: "+ Add Leave Type" button (`leave_types:create`).
     - Table:
       - Code (e.g. `ANNUAL`, `SICK`, `UNPAID`)
       - Name
       - Is Paid (`Yes` / `No`)
       - Default Days per Year (`30.00`)
       - Deduct Working Days Only (`Yes` / `No`)
       - Status (`Active` / `Inactive`)
       - Action: "Edit" modal.
  3. **Tab 3: Employee Balances (`LeaveBalancesTab`):**
     - Filter: Year selector (`2026`, `2025`), Search by Employee.
     - Header Action: "+ Allocate Balance" modal (`leave_balances:manage`).
     - Table:
       - Employee Code & Name
       - Leave Type
       - Year
       - Allocated Days
       - Carried Forward
       - Used Days
       - Pending Days
       - Available Remaining Days
       - Actions: "Edit Allocation" button.

---

## 4. Visual Design & State Management

- **Angular Signals:** All component state (active tab, balance arrays, request lists, loading indicators, modal visibility) managed using Angular 19 `signal()`, `computed()`, and `effect()`.
- **Feedback & Alerts:** Inline toast notifications on successful actions (approval, rejection, submission) and explicit alert banners on validation errors.
- **Empty & Loading States:** Skeleton placeholders during API load; informative empty state illustrations when no leave records or requests are found.
