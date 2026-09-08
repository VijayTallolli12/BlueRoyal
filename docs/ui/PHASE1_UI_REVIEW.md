# Blue Royal HRMS — Phase 1 UI & Screen Review

**Document ID:** `DOC-UI-REV-PHASE1-001`  
**Date:** 2026-09-08  
**Scope:** Comprehensive UX/UI and Component Review for Phase 1 Masters & Rostering  
**Target View:** `app-dashboard` containing `app-masters-hub`  
**Audience:** HR Administrators, Operations Managers, Frontend Engineering  

---

## 1. Executive Summary

Phase 1 provides an interactive, unified management portal (`MastersHubComponent`) embedded directly inside the authenticated dashboard. 

> [!NOTE]
> **Consolidated Hub Notice:** `MastersHubComponent` is a temporary consolidated Phase 1 UI designed to enable rapid administrative testing, verification, and demonstration across all 8 master domains in a single coherent workspace. As business modules mature in subsequent phases, dedicated standalone feature routes (e.g., `/employees`, `/clients`, `/assignments`, `/rates`) will replace this consolidated hub.

> [!IMPORTANT]
> **Security & Authentication Note:** Use locally configured development credentials. Never commit, log, or document real or shared credentials.

The Masters Hub allows HR Administrators and Operations Managers to view, register, schedule, and resolve all foundational organizational entities:

- **Designations** (Roles catalog)
- **Clients & Projects** (Customer entities and job site locations)
- **Employees** (Core identity profile)
- **Employee Assignments** (Authoritative historical project deployments and designations)
- **Dual-Stream Rates & Invoicing Tester** (Employee pay rates, client billing cards, and point-in-time rate resolution engine)
- **Shifts & Rostering** (Standard shift timings and employee shift timelines)
- **Calendar & Holidays** (Weekend settings and company-configured statutory holidays)
- **Salary Packages** (Earnings and deductions catalog)

---

## 2. Screen & Tab-Level Detailed Review

### Screen 1: Phase 1 Architecture Overview
- **Route:** `/dashboard` (Tab: `Phase 1 Architecture`)
- **Screen Purpose:** Visualizes the dual-stream financial decoupling and provides an interactive overview of Phase 1 capabilities.
- **Components:** `MastersHubComponent` (Overview template slice).
- **APIs Used:** None (Static architectural flow and documentation).
- **Permissions:** `system:health`
- **Create / Edit / Delete:** Read-only explanatory diagram.
- **Loading State:** Instantaneous signal evaluation.
- **Empty State:** N/A.
- **Validation / Error States:** N/A.
- **Responsive Behavior:** Flexbox diagram wraps naturally on mobile and tablet screens.
- **Current Limitations:** Static diagram; future enhancement can render live count metrics of active projects and workers.

---

### Screen 2: Designations Master Catalog
- **Route:** `/dashboard` (Tab: `Designations`)
- **Screen Purpose:** Catalog of organizational job titles, descriptions, and active status used across employee profiles and billing rate cards.
- **Components:** `MastersHubComponent` (Designations template slice).
- **APIs Used:**
  - `GET /api/v1/designations`
  - `POST /api/v1/designations`
- **Permissions Enforced:**
  - View: `designations:read`
  - Add: `designations:create`
- **Create / Edit / Delete Behavior:**
  - Create: Inline collapsible form with `code`, `title`, `description`. Adds record and triggers full signal refresh.
  - Edit/Delete: Backend supports `PUT /api/v1/designations/:id` and `DELETE /api/v1/designations/:id`; UI currently exposes read and create actions.
- **Loading State:** Async HTTP subscription populating Angular signal (`designations`).
- **Empty State:** Renders table header with empty body if no designations exist.
- **Validation / Error States:** Form fields marked `required`; backend duplicate `code` conflict returns structured 409 conflict envelope.
- **Responsive Behavior:** Table scrolls horizontally on smaller viewports (`width: 100%`).
- **Current Limitations:** Inline edit modal and pagination controls are not yet added (currently displays all designations sorted by title).

---

### Screen 3: Employees (Core Biographical Profiles)
- **Route:** `/dashboard` (Tab: `Employees`)
- **Screen Purpose:** HR registry of employee identity, nationality, date of joining, dynamic active designation, and active deployment site.
- **Components:** `MastersHubComponent` (Employees template slice).
- **APIs Used:**
  - `GET /api/v1/employees`
  - `POST /api/v1/employees`
- **Permissions Enforced:**
  - View: `employees:read`
  - Register: `employees:create`
- **Create / Edit / Delete Behavior:**
  - Register: Responsive grid form capturing `employeeCode`, `firstName`, `lastName`, `gender`, `dateOfBirth`, `nationality`, `dateOfJoining`.
  - Edit/Delete: Backend supports `PUT /api/v1/employees/:id` and `DELETE /api/v1/employees/:id` (soft-delete).
- **Dynamic Derived Data:**
  - **Authoritative Designation:** The UI dynamically displays the designation from the employee's active assignment. If the employee has no active deployment, it displays `Unassigned` in muted italics.
  - **Active Deployment:** Shows `Client Name / Project Name` resolved on today's date.
- **Loading State:** Signal-based reactive population.
- **Empty State:** Empty table rows if database contains no employee profiles.
- **Validation / Error States:** Required fields; duplicate employee code returns 409 Conflict.
- **Responsive Behavior:** Form uses CSS Grid `repeat(auto-fit, minmax(200px, 1fr))`.
- **Current Limitations:** Search bar and status filtering (e.g. active vs probation) to be added in Phase 2 UI polish.

---

### Screen 4: Clients Master
- **Route:** `/dashboard` (Tab: `Clients`)
- **Screen Purpose:** Commercial client directory with legal company names, contact persons, and active contracting status.
- **Components:** `MastersHubComponent` (Clients template slice).
- **APIs Used:**
  - `GET /api/v1/clients`
  - `POST /api/v1/clients`
- **Permissions Enforced:**
  - View: `clients:read`
  - Add: `clients:create`
- **Create / Edit / Delete Behavior:**
  - Create: Inline form capturing client `code`, `name`, `contactPerson`. Saves and triggers signal refresh.
  - Edit/Delete: Supported via backend API endpoints.
- **Loading State:** Reactive signal subscription.
- **Empty State:** Empty table if no clients exist.
- **Validation / Error States:** Client code uniqueness enforced.
- **Responsive Behavior:** Clean table with auto-wrapping layout.
- **Current Limitations:** Direct link to client's projects sub-table from this view.

---

### Screen 5: Project Worksites
- **Route:** `/dashboard` (Tab: `Projects`)
- **Screen Purpose:** Worksites and job site locations commissioned under specific clients.
- **Components:** `MastersHubComponent` (Projects template slice).
- **APIs Used:**
  - `GET /api/v1/projects`
  - `POST /api/v1/projects`
- **Permissions Enforced:**
  - View: `projects:read`
  - Add: `projects:create`
- **Create / Edit / Delete Behavior:**
  - Create: Dropdown to select parent client, project `code`, `name`, and `siteLocation`.
- **Loading State:** Reactive signal subscription.
- **Empty State:** Displays table headers with empty rows if no projects exist.
- **Validation / Error States:** Client selection required; project code uniqueness checked.
- **Responsive Behavior:** CSS Grid form adaptively stacks inputs.
- **Current Limitations:** Filtering projects by client directly in the data table.

---

### Screen 6: Employee Project Assignments (Authoritative Deployment & Role)
- **Route:** `/dashboard` (Tab: `Assignments`)
- **Screen Purpose:** Authoritative assignment console linking an employee to Client, Project, and Designation for an effective-dated interval.
- **Components:** `MastersHubComponent` (Assignments template slice).
- **APIs Used:**
  - `GET /api/v1/assignments`
  - `POST /api/v1/assignments`
- **Permissions Enforced:**
  - View: `assignments:read`
  - Deploy: `assignments:create`
- **Create / Edit / Delete Behavior:**
  - Deploy: Select Employee ➔ Select Client ➔ Filtered Project dropdown ➔ Assign Designation ➔ Specify `effectiveFrom`.
  - **Automatic Prior Closure:** If an employee already has an open-ended active assignment, the backend automatically closes the prior assignment on `effectiveFrom - 1 day` inside a transaction.
- **Loading State:** Signal-based reactive population.
- **Empty State:** Displays table headers if no assignments exist.
- **Validation / Error States:** Rejects overlapping intervals; ensures selected project belongs to selected client.
- **Responsive Behavior:** Full-width table with code badges for effective dates (`YYYY-MM-DD ➔ Ongoing`).
- **Current Limitations:** Date picker defaults to today's date; manual end-date closure button could be added directly to the table row.

---

### Screen 7: Dual-Stream Rates & Point-in-Time Billing Resolution Tester
- **Route:** `/dashboard` (Tab: `Dual-Stream Rates & Invoicing Resolution`)
- **Screen Purpose:** Interactive tester enabling HR and Billing admins to test point-in-time commercial billing rate resolution on any arbitrary historical or current work date.
- **Components:** `MastersHubComponent` (Rates & Resolution template slice).
- **APIs Used:**
  - `GET /api/v1/rates/resolve-billing?employeeId=:id&workDate=:date`
- **Permissions Enforced:**
  - View & Test: `rates:read`
- **Interactive Behavior:**
  - Select Employee from dropdown.
  - Pick Target Work Date.
  - Click "Test Resolution".
  - Runs full 4-rate pipeline: checks active assignment on date ➔ project-specific billing rate ➔ client-wide fallback ➔ missing rate.
- **Visual Feedback:**
  - **Success (`RESOLVED`):** Light green panel displaying rate source (`PROJECT_SPECIFIC` vs `CLIENT_WIDE_FALLBACK`), Normal Billing Rate, and OT Billing Rate.
  - **Failure (`MISSING_ASSIGNMENT` / `MISSING_BILLING_RATE`):** Light red alert panel with explicit error code (`UNASSIGNED_EMPLOYEE` or `MISSING_BILLING_RATE`) and human-readable explanation.
- **Loading State:** Instantaneous API call with signal update.
- **Validation / Error States:** Disables resolution if employee or work date is unselected.
- **Responsive Behavior:** Form inputs arrange horizontally on desktop and stack vertically on mobile.
- **Current Limitations:** Dedicated UI tabs for bulk rate card editing (e.g. updating 20 client rates simultaneously).

---

### Screen 8: Shifts & Rostering
- **Route:** `/dashboard` (Tab: `Shifts & Roster`)
- **Screen Purpose:** Definition of shift operating hours, scheduled breaks, and overnight indicators.
- **Components:** `MastersHubComponent` (Shifts template slice).
- **APIs Used:**
  - `GET /api/v1/shifts`
  - `POST /api/v1/shifts`
- **Permissions Enforced:**
  - View: `shifts:read`
  - Add: `shifts:create`
- **Create / Edit / Delete Behavior:**
  - Create: Code, Name, Start Time, End Time, Break Minutes, and Net Work Hours.
- **Loading State:** Signal-based population.
- **Empty State:** Empty table when no shifts exist.
- **Validation / Error States:** Unique shift code required.
- **Responsive Behavior:** Grid form with clean table styling.
- **Current Limitations:** Weekly shift rotation scheduling calendar view.

---

### Screen 9: Calendar & Company Public Holidays
- **Route:** `/dashboard` (Tab: `Calendar & Holidays`)
- **Screen Purpose:** Management of company-configured statutory public holidays and observation dates.
- **Components:** `MastersHubComponent` (Calendar template slice).
- **APIs Used:**
  - `GET /api/v1/calendar/holidays`
  - `POST /api/v1/calendar/holidays`
- **Permissions Enforced:**
  - View: `calendar:read`
  - Add: `calendar:create`
- **Create / Edit / Delete Behavior:**
  - Add: Calendar Year, Holiday Title, Exact Date, and optional Description.
- **Loading State:** Signal-based population.
- **Empty State:** Clean empty table if no holidays are configured.
- **Validation / Error States:** Prevents duplicate holidays on the same date (unique constraint).
- **Responsive Behavior:** Inline form wrapping neatly.
- **Current Limitations:** Month-by-month graphical calendar widget view.

---

### Screen 10: Salary Components Master
- **Route:** `/dashboard` (Tab: `Salary Packages`)
- **Screen Purpose:** Displays the catalog of earnings and deductions, calculation rules, and WPS statutory flags for monthly salaried staff.
- **Components:** `MastersHubComponent` (Salary template slice).
- **APIs Used:**
  - `GET /api/v1/salary/components`
- **Permissions Enforced:**
  - View: `salary:read`
- **Create / Edit / Delete Behavior:**
  - Displays seeded components: `BASIC`, `HRA`, `TRANSPORT` with WPS flags.
- **Loading State:** Reactive signal subscription.
- **Empty State:** Empty table if no components exist.
- **Validation / Error States:** N/A (read view).
- **Responsive Behavior:** Formatted table with badges.
- **Current Limitations:** UI form for creating customized deduction components (e.g. uniform, visa fine deductions).

---

## 3. UI Limitations & UX Backlog

The following items are officially cataloged in the UX backlog for implementation as dedicated module views are created:

### UX Backlog Items
1. **Assignment Transfer Confirmation Modal:**
   - *Problem:* When assigning an employee who already has an ongoing deployment, the system automatically auto-closes the prior assignment record on `effectiveFrom - 1 day`.
   - *Backlog Action:* Introduce a confirmation modal dialog before submitting: *"Employee BR-001 currently has an active deployment to [Client / Project]. Assigning to [New Project] on [Date] will close the existing deployment as of [Date - 1]. Proceed?"*

2. **Table Pagination, Search, and Filtering:**
   - *Problem:* Phase 1 renders lists directly in responsive tables. While sufficient for master reference data, employee and assignment tables for enterprise workforces (>100 workers) require rapid search and pagination.
   - *Backlog Action:* Add a searchable text filter (by employee code, full name, nationality) and client-side or server-side pagination controls (10, 25, 50, 100 rows per page).

3. **Bulk Client Billing-Rate Import (CSV / Excel):**
   - *Problem:* Subcontracting and manpower rate cards typically involve dozens of designations per client/project. Configuring them one-by-one via form input is labor-intensive.
   - *Backlog Action:* Design and implement a bulk CSV/spreadsheet import workflow with pre-validation of client codes, project codes, and designation codes. *(Deferred to Phase 2/3 UI polish; do NOT implement now)*.

4. **Transition to Dedicated Feature Routes:**
   - *Problem:* The consolidated `MastersHubComponent` combines all 8 master domains into a single tabbed container.
   - *Backlog Action:* Deconstruct the consolidated hub into dedicated child routes (e.g. `/masters/employees`, `/masters/clients`, `/masters/assignments`, `/masters/rates`) with shared navigational breadcrumbs and deep linking.

5. **Client-Project Cascading Filter Reset:**
   - *Problem:* In the Assignment form, clearing or changing the selected Client should immediately reset the Project dropdown to avoid mismatched project submissions.
   - *Backlog Action:* Add explicit reset handling on client selection change.
