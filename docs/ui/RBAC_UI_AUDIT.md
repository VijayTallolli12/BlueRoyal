# Blue Royal HRMS — RBAC & Navigation Architectural Audit
**Document ID:** `AUDIT-RBAC-001`  
**Date:** September 2026  
**Status:** Approved Architectural Baseline  

---

## 1. Core Investigation: Super Admin vs. HR Admin Navigation Parity

### 1.1 The Inquiry
In the initial frontend implementation, both `Super Admin` and `HR Admin` appeared to see identical or near-identical sidebar navigation items (Dashboard, Master Catalogs, Attendance & OT, Leave Approvals, Payroll Processing). This investigation determines the exact cause across four architectural categories:
- **A.** Intentional based on current business permissions
- **B.** A frontend navigation implementation issue
- **C.** Missing permission/module granularity
- **D.** Functionality that does not yet exist

---

## 2. Analysis & Categorization

### Category A: Intentional Operational Authority (Valid Business Domain Design)
In enterprise HRMS systems, **HR Admin** is the primary operational user responsible for workforce management:
- Managing designations, employees, clients, projects, shifts, holidays, and salary packages.
- Creating, importing, submitting, and approving attendance periods.
- Reviewing, approving, and rejecting employee leave applications.
- Calculating, adjusting, and reviewing monthly payroll runs.

Consequently, `HR Admin` is **intentionally granted 63 permissions** out of the system's 71 total permissions (see `database/src/scripts/seed.ts`). It is completely intentional and required that HR Admin can access the operational modules (`/masters`, `/attendance`, `/leave`, `/payroll`).

### Category B: Frontend Navigation Implementation Gap
While both roles access operational modules, the backend defines **specific administrative capabilities** that belong exclusively to `Super Admin`, which the frontend sidebar previously failed to distinguish:
1. **Administrative Overrides (Unlock Workflows):**
   - `payroll:unlock`: Permitted **strictly to `super_admin`** (HR Admin receives `403 Forbidden` if attempted).
   - `attendance:unlock`: Permitted **strictly to `super_admin`**.
   - *Frontend Issue:* The previous UI displayed unlock buttons uniformly without gating button visibility strictly on `authService.hasPermission('payroll:unlock')`.
2. **Audit Trails & Security Logs:**
   - `audit:read`: Permitted to `super_admin` (and HR Admin in read-only capacity).
   - `audit:export`: Permitted **strictly to `super_admin`**.
   - *Frontend Issue:* The frontend sidebar had no dedicated entry point for system compliance audit logs, even though the backend audit engine (`/api/v1/audit-logs`) is fully functional.

### Category C & D: Future Functionality & Administration Granularity
The backend `seed.ts` defines baseline permissions for:
- `system:configure` (Global system parameters and branding settings) — Granted **strictly to `super_admin`**.
- `users:create`, `users:update`, `users:delete` (User accounts and credentials management) — Granted **strictly to `super_admin`**.
- `roles:create`, `roles:update`, `roles:delete` (RBAC role management) — Granted **strictly to `super_admin`**.

*Why this did not appear in navigation:*
The dedicated `User Management & RBAC Administration` module and `System Configuration / Branding` module are planned as Phase 7 / Administration suite enhancements. They do not yet have active front-end management screens.

---

## 3. Resolution & UI Implementation Rules

1. **Preserve Valid Operational Access:**
   - Do **NOT** artificially hide operational modules (`Employees`, `Attendance`, `Leave`, `Payroll`) from `HR Admin`. Doing so would break the core HR business workflow.
2. **Strict In-Page Action Gating (Zero Unauthorized Buttons):**
   - The "Unlock Finalized Payroll" button/modal must be rendered **only** if the authenticated user possesses `payroll:unlock` (Super Admin only).
   - The "Unlock Locked Attendance" button must be rendered **only** if the user possesses `attendance:unlock`.
3. **Role Badge & Identity Reflection:**
   - The App Shell header and sidebar footer must prominently display the active role (`SUPER ADMIN` vs `HR ADMIN` vs `EMPLOYEE`) with distinct semantic color badges.
4. **Prepare Future Administration Navigation:**
   - When the System Settings / Branding module is implemented, it will be gated strictly to `system:configure` (Super Admin only), creating full visual separation between root administrators and operational HR officers.
