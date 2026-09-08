# Blue Royal HRMS — Phase 1 End-to-End Business Workflows Verification

**Document ID:** `DOC-WF-VER-PHASE1-001`  
**Date:** 2026-09-08  
**Scope:** Verification of all 12 Phase 1 business workflows across UI, API, Database, Validation, RBAC, Audit, Effective-Dating, and Error Handling.  
**Governing Documents:** `Master.md`, `FINAL_ARCHITECTURE.md`, `docs/modules/phase-1-plan.md`  
**Status:** **VERIFIED & TESTED**

---

## 1. Executive Summary & Verification Matrix

The 12 core Phase 1 foundational workflows have been implemented and verified end-to-end. Every workflow operates under strict architectural guidelines:
- **Zero Derivation Rule:** Employee remuneration rates are never derived from client billing rates.
- **Authoritative Designation History:** Employee designation is derived dynamically from their effective-dated assignment timeline, eliminating conflicting sources of truth.
- **Transactional Interval Management:** Assignment, pay rate, billing rate, and salary structure intervals automatically prevent overlaps and auto-close open-ended predecessor records within database transactions.

---

## 2. Detailed Verification of the 12 Phase 1 Workflows

### Workflow 1: Create Designation
- **Business Purpose:** Establish standard organizational job titles for employee classification and commercial rate cards.
- **UI:** Tab `Designations` ➔ "+ Add Designation" form (`code`, `title`, `description`).
- **API Endpoint:** `POST /api/v1/designations`
- **Database Persistence:** Inserts record into `designations` table (`id`, `code`, `title`, `description`, `is_active`, `created_at`, `updated_at`).
- **Validation:** `code` and `title` are mandatory; `code` must be unique.
- **RBAC Enforced:** Requires permission `designations:create` (Super Admin, HR Admin).
- **Audit Trail:** Captured via centralized logging and database audit schema.
- **Error Handling:** Duplicate designation codes return `409 Conflict` (`Designation code already exists`).

---

### Workflow 2: Create Client
- **Business Purpose:** Onboard contracting partner companies and commercial customers.
- **UI:** Tab `Clients` ➔ "+ Add Client" form (`code`, `name`, `contactPerson`).
- **API Endpoint:** `POST /api/v1/clients`
- **Database Persistence:** Inserts into `clients` table (`code` unique, `name`, `contact_person`, `is_active`). Soft-delete enabled (`deleted_at`).
- **Validation:** `code` and `name` are mandatory strings.
- **RBAC Enforced:** Requires permission `clients:create`.
- **Audit Trail:** Logged with actor and request correlation ID.
- **Error Handling:** Duplicate client code returns `409 Conflict`.

---

### Workflow 3: Create Project under Client
- **Business Purpose:** Register worksites and projects tied to an existing client entity.
- **UI:** Tab `Projects` ➔ "+ Add Project" form (Client dropdown, `code`, `name`, `siteLocation`).
- **API Endpoint:** `POST /api/v1/projects`
- **Database Persistence:** Inserts into `projects` table with Foreign Key `client_id ➔ clients(id)`. Soft-delete enabled.
- **Validation:** Verifies that the referenced `clientId` exists in the database; `code` must be unique.
- **RBAC Enforced:** Requires permission `projects:create`.
- **Audit Trail:** Logged with actor and correlation ID.
- **Error Handling:** Referencing an invalid `clientId` returns `400 Bad Request`. Duplicate project code returns `409 Conflict`.

---

### Workflow 4: Create Employee (Core Identity)
- **Business Purpose:** Register new worker profile containing strictly biographical identity data. (All document records are deferred to the future Documents module).
- **UI:** Tab `Employees` ➔ "+ Register Employee" form (`employeeCode`, `firstName`, `lastName`, `gender`, `dateOfBirth`, `nationality`, `dateOfJoining`).
- **API Endpoint:** `POST /api/v1/employees`
- **Database Persistence:** Inserts into `employees` table. Soft-delete enabled. (Note: `designation_id` is intentionally omitted from this table to prevent conflicting sources of truth).
- **Validation:** Unique `employeeCode`, valid gender enum (`male`, `female`, `other`), valid dates.
- **RBAC Enforced:** Requires permission `employees:create`.
- **Audit Trail:** Logged with actor ID and correlation ID.
- **Error Handling:** Duplicate employee code returns `409 Conflict`.

---

### Workflow 5: Assign Employee to Client + Project + Designation
- **Business Purpose:** Deploy an employee to a worksite under an authoritative job title for an effective-dated interval.
- **UI:** Tab `Assignments` ➔ "+ Deploy Employee" form (Employee select, Client select, cascaded Project select, Designation select, `effectiveFrom`).
- **API Endpoint:** `POST /api/v1/assignments`
- **Database Persistence:** Inserts into `employee_assignments` table with FKs to `employees`, `clients`, `projects`, `designations`.
- **Effective-Dating Behavior:**
  - `EffectiveDateService.validateAndPrepareInterval` runs inside `runInTransaction`.
  - If the employee has an ongoing prior assignment (`effective_to IS NULL`) starting before `effectiveFrom`, the system automatically closes the prior record on `effectiveFrom - 1 day`.
  - Rejects overlapping date ranges with `409 Conflict`.
- **Validation:** Verifies that the project belongs to the client; all FKs must exist.
- **RBAC Enforced:** Requires permission `assignments:create`.
- **Audit Trail:** Logged with actor ID, old assignment end date, and new assignment record.
- **Error Handling:** Attempting to assign an employee to a project not owned by the chosen client returns `400 Bad Request`.

---

### Workflow 6: Configure Employee Normal / OT Pay Rates (Labor Cost)
- **Business Purpose:** Establish an employee's remuneration rate schedule for payroll.
- **UI:** Accessible via API and Employee Detail timeline.
- **API Endpoint:** `POST /api/v1/rates/employee-rates`
- **Database Persistence:** Inserts into `employee_hourly_rates` table (`employee_id`, `normal_hourly_rate`, `ot_hourly_rate`, `effective_from`, `effective_to`, `change_reason`).
- **Effective-Dating Behavior:**
  - Automated auto-closure of previous rate interval on `(new_effective_from - 1 day)`.
  - Guarantees at most one applicable rate exists for any work date.
  - Verified across 7 temporal boundary tests in `tests/unit/effective-date.test.ts`.
- **Zero Derivation Rule:** Completely decoupled from client billing rates.
- **RBAC Enforced:** Requires permission `rates:create`.
- **Error Handling:** Negative rates or inverted dates (`effectiveTo < effectiveFrom`) return `400 Bad Request`.

---

### Workflow 7: Configure Client Normal / OT Billing Rates (Commercial Revenue)
- **Business Purpose:** Configure rate cards billed to clients for work delivered by a designation on a specific project or client-wide.
- **UI:** Accessible via API and tested in the Real-Time Resolution console.
- **API Endpoint:** `POST /api/v1/rates/client-rates`
- **Database Persistence:** Inserts into `client_billing_rates` table (`client_id`, `project_id` nullable, `designation_id`, `normal_billing_rate`, `ot_billing_rate`, `effective_from`, `effective_to`).
- **Effective-Dating Behavior:**
  - Bounded or open-ended rate cards per `(client_id, project_id, designation_id)`.
  - Verified project-specific precedence over client-wide fallback in `tests/integration/rate-resolution.test.ts`.
- **RBAC Enforced:** Requires permission `rates:create`.
- **Error Handling:** Overlapping rates for the same client/project/designation return `409 Conflict`.

---

### Workflow 8: Assign Shift to Employee (Rostering)
- **Business Purpose:** Roster an employee onto a specific shift schedule.
- **UI:** Tab `Shifts & Roster` ➔ Shift overview and employee shift scheduling.
- **API Endpoint:** `POST /api/v1/shifts/assignments`
- **Database Persistence:** Inserts into `employee_shift_assignments` table (`employee_id`, `shift_id`, `effective_from`, `effective_to`).
- **Effective-Dating Behavior:** Auto-closes prior shift roster record upon scheduling new shift interval.
- **RBAC Enforced:** Requires permission `shifts:create`.
- **Error Handling:** Invalid employee or shift ID returns `400 Bad Request`.

---

### Workflow 9: Configure Weekly Off
- **Business Purpose:** Set organizational rest days (e.g. standard Sunday weekend).
- **UI:** Managed via Calendar service and database seeders.
- **API Endpoint:** `POST /api/v1/calendar/weekly-offs`
- **Database Persistence:** Inserts into `weekly_off_configs` table (`name`, `days_of_week` integer array, `effective_from`, `effective_to`, `is_default`).
- **Default Seed:** Seeded with standard Sunday (`[0]`) from `2020-01-01`.
- **RBAC Enforced:** Requires permission `calendar:create`.

---

### Workflow 10: Configure Public Holiday (Company-Configured)
- **Business Purpose:** Define statutory or observed public holidays.
- **UI:** Tab `Calendar & Holidays` ➔ "+ Add Holiday" form (`calendarYear`, `name`, `holidayDate`, `description`).
- **API Endpoint:** `POST /api/v1/calendar/holidays`
- **Database Persistence:** Inserts into `public_holidays` table (`calendar_year`, `name`, `holiday_date` unique, `description`).
- **Seeding Rule:** Strictly company-configured; no UAE public holidays hardcoded in production seeds.
- **RBAC Enforced:** Requires permission `calendar:create`.
- **Error Handling:** Duplicate date configuration returns `409 Conflict`.

---

### Workflow 11: Configure Salary Components
- **Business Purpose:** Manage the catalog of monthly compensation elements (Basic, HRA, Transport, Deductions).
- **UI:** Tab `Salary Packages` ➔ Catalog table with WPS flags.
- **API Endpoint:** `POST /api/v1/salary/components`
- **Database Persistence:** Inserts into `salary_components` table (`code` unique, `name`, `type`, `calculation_type`, `percentage_basis_component_id`, `is_wps_basic`, `is_wps_housing`).
- **Seeded Defaults:** Idempotently seeds `BASIC`, `HRA`, `TRANSPORT`.
- **RBAC Enforced:** Requires permission `salary:create`.

---

### Workflow 12: Configure Employee Salary Structure
- **Business Purpose:** Assign a monthly salary package to an employee with customized amounts or percentages.
- **UI:** Queried on employee summary view (`GET /api/v1/employees/:id`).
- **API Endpoint:** `POST /api/v1/salary/structures`
- **Database Persistence:** Inserts into `employee_salary_structures` table (`employee_id`, `component_id`, `amount_or_percentage`, `effective_from`, `effective_to`).
- **Effective-Dating Behavior:** Enforces non-overlapping intervals per `(employee_id, component_id)`.
- **RBAC Enforced:** Requires permission `salary:create`.
- **Separation Guarantee:** Distinct from `employee_hourly_rates`.

---

## 3. Real-Time Resolution Engine Flow Verification

The point-in-time rate resolution engine (`GET /api/v1/rates/resolve-billing?employeeId=:id&workDate=:date`) was tested against all 4 operational states:
1. **Unassigned Worker on Work Date:** Correctly resolves to `MISSING_ASSIGNMENT` (`UNASSIGNED_EMPLOYEE`).
2. **Missing Rate Card:** Correctly resolves to `MISSING_BILLING_RATE`.
3. **Client-Wide Rate:** Correctly returns `CLIENT_WIDE_FALLBACK` rate.
4. **Project-Specific Rate:** Correctly resolves `PROJECT_SPECIFIC` rate overriding the fallback.

All 4 states verified passing via automated integration tests in `backend/tests/integration/rate-resolution.test.ts`.

---

## 4. HR Admin Usability & Workflow Gap Analysis

While the underlying models and APIs are sound and verified, the following workflow gaps should be addressed during Phase 2 UI enhancement:
1. **Employee Detail Modal / Slide-Out:** Clicking an employee row currently relies on the parent table summary. A slide-out drawer showing active assignments, rate timeline, and salary components in one place will reduce navigation overhead.
2. **Bulk Rate Import:** In large contracting operations, client rate cards frequently arrive as spreadsheets covering 20+ designations. A CSV import for client billing rates will improve administrative efficiency.
3. **Assignment Transfer Confirmation:** When deploying an employee to a new project that auto-closes their existing deployment, displaying a brief confirmation modal (e.g., *"This will close BR-001's current deployment to Downtown Tower on 2026-09-30. Proceed?"*) will prevent accidental reassignments.
