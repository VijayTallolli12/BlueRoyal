# Blue Royal HRMS — Database Schema & Data Dictionary

## Engine

PostgreSQL 17.x

---

## 1. Tables Established in Phase 0 Foundation (7 Tables)

| Table Name         | Purpose                                           | Primary Key                            | Paranoid (Soft Delete) |
| ------------------ | ------------------------------------------------- | -------------------------------------- | ---------------------- |
| `users`            | User credentials and profile accounts             | UUID (`id`)                            | Yes (`deleted_at`)     |
| `roles`            | System and organizational roles                   | UUID (`id`)                            | No                     |
| `permissions`      | Atomic permissions (`resource:action`)            | UUID (`id`)                            | No                     |
| `role_permissions` | Mapping of roles to granted permissions           | Composite (`role_id`, `permission_id`) | No                     |
| `user_roles`       | Mapping of users to assigned roles                | Composite (`user_id`, `role_id`)       | No                     |
| `refresh_tokens`   | Secure hashed refresh tokens for session rotation | UUID (`id`)                            | No (`revoked_at`)      |
| `audit_logs`       | Append-only regulatory audit trail                | UUID (`id`)                            | No (Immutable)         |

---

## 2. Tables Planned for Phase 1 Masters & Rostering (13 Tables)

| # | Table Name                     | Purpose                                          | Primary Key | Effective-Dated | Foreign Keys & Constraints |
|---| ------------------------------ | ------------------------------------------------ | ----------- | --------------- | -------------------------- |
| 1 | `designations`                 | Catalog of organizational job titles/roles       | UUID (`id`) | No              | None                       |
| 2 | `employees`                    | Core biographical profile (docs in Documents mod)| UUID (`id`) | No (Paranoid)   | `user_id` ➔ `users(id)`    |
| 3 | `clients`                      | Contracting partner companies                    | UUID (`id`) | No (Paranoid)   | None                       |
| 4 | `projects`                     | Work sites and customer client projects          | UUID (`id`) | No (Paranoid)   | `client_id` ➔ `clients(id)`|
| 5 | `employee_assignments`         | Authoritative deployment & designation history   | UUID (`id`) | **Yes**         | `employee_id` ➔ `employees`, `client_id` ➔ `clients`, `project_id` ➔ `projects`, `designation_id` ➔ `designations` |
| 6 | `employee_hourly_rates`        | Normal & OT wage remuneration (Payroll Cost)     | UUID (`id`) | **Yes**         | `employee_id` ➔ `employees`|
| 7 | `client_billing_rates`         | Normal & OT invoice rates (Billing Revenue)      | UUID (`id`) | **Yes**         | `client_id` ➔ `clients`, `project_id` ➔ `projects` (nullable), `designation_id` ➔ `designations` |
| 8 | `shifts`                       | Work shift timing definitions                    | UUID (`id`) | No              | None                       |
| 9 | `employee_shift_assignments`   | Shift roster assignments timeline                | UUID (`id`) | **Yes**         | `employee_id` ➔ `employees`, `shift_id` ➔ `shifts` |
| 10| `weekly_off_configs`           | Standard weekly rest days (e.g. Sunday)          | UUID (`id`) | **Yes**         | None                       |
| 11| `public_holidays`              | Official annual public holidays                  | UUID (`id`) | No              | Unique `holiday_date`      |
| 12| `salary_components`            | Fixed/percentage wage component catalog          | UUID (`id`) | No              | `percentage_basis_component_id` ➔ `salary_components(id)` |
| 13| `employee_salary_structures`   | Monthly salaried compensation package            | UUID (`id`) | **Yes**         | `employee_id` ➔ `employees`, `component_id` ➔ `salary_components` |

---

## 3. The Dual-Stream Four-Rate Resolution Flow

In Blue Royal HRMS, **Labor Cost (Payroll)** and **Commercial Revenue (Billing)** are strictly decoupled:
- **Employee Pay Rates** are tied to the worker's contract (`employee_hourly_rates`).
- **Client Billing Rates** are tied to commercial contracts (`client_billing_rates`).
- **Employee Pay is NEVER derived from Client Billing.**

### Official Billing Rate Point-in-Time Resolution Pipeline
For any given `work_date` and `employee_id`:
1. Find active `employee_assignments` record on `work_date`:
   - Returns `{ client_id, project_id, designation_id }`
   - If no record exists $\longrightarrow$ Flag as `UNASSIGNED_EMPLOYEE`.
2. Look for project-specific rate in `client_billing_rates`:
   - Match: `client_id = :client_id`, `project_id = :project_id`, `designation_id = :designation_id`, active on `work_date`.
   - If found $\longrightarrow$ Return Project Billing Rate (`normal_billing_rate`, `ot_billing_rate`).
3. Fallback to client-wide rate in `client_billing_rates`:
   - Match: `client_id = :client_id`, `project_id IS NULL`, `designation_id = :designation_id`, active on `work_date`.
   - If found $\longrightarrow$ Return Client-Wide Default Rate (`normal_billing_rate`, `ot_billing_rate`).
4. If no rate matches $\longrightarrow$ Flag as `MISSING_BILLING_RATE`.

---

## 4. Effective-Dating Design Pattern & Boundary Tests

For all tables marked **Effective-Dated**, the following schema and query conventions apply:

```sql
SELECT *
FROM {table_name}
WHERE {entity_foreign_key} = :entityId
  AND effective_from <= :targetDate
  AND (effective_to IS NULL OR effective_to >= :targetDate)
ORDER BY effective_from DESC
LIMIT 1;
```

### Boundary Verification Rules
1. **Exact Start Date:** `targetDate = effective_from` must resolve.
2. **Exact End Date:** `targetDate = effective_to` must resolve.
3. **Pre-Effective Date:** `targetDate < effective_from` returns no record.
4. **Post-Effective Date:** `targetDate > effective_to` returns no record.
5. **Non-Overlapping Guarantee:** The system rejects any interval insertion that intersects an existing interval for the same scope.
6. **Future Schedules:** Pre-scheduled future revisions do not affect today's calculations.
7. **Historical Lookups:** Retroactive processing precisely reconstructs the state active on past dates.
