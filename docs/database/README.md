# Blue Royal HRMS — Database Schema & Data Dictionary

## Engine

PostgreSQL 17.x

---

## 1. Tables Established in Phase 0 Foundation

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

## 2. Tables Planned for Phase 1 (Core Masters & Rostering)

| Table Name                   | Purpose                                     | Primary Key | Effective-Dated                            | Foreign Keys                                                                    |
| ---------------------------- | ------------------------------------------- | ----------- | ------------------------------------------ | ------------------------------------------------------------------------------- |
| `employees`                  | Core employee profile and employment status | UUID (`id`) | No (Paranoid)                              | `user_id` ➔ `users(id)`                                                         |
| `clients`                    | Client companies and contracting partners   | UUID (`id`) | No (Paranoid)                              | None                                                                            |
| `projects`                   | Work sites and client projects              | UUID (`id`) | No (Paranoid)                              | `client_id` ➔ `clients(id)`                                                     |
| `employee_assignments`       | Employee deployment to Client & Project     | UUID (`id`) | **Yes** (`effective_from`, `effective_to`) | `employee_id` ➔ `employees`, `client_id` ➔ `clients`, `project_id` ➔ `projects` |
| `shifts`                     | Work shift definitions and timings          | UUID (`id`) | No                                         | None                                                                            |
| `employee_shift_assignments` | Employee shift schedule timeline            | UUID (`id`) | **Yes** (`effective_from`, `effective_to`) | `employee_id` ➔ `employees`, `shift_id` ➔ `shifts`                              |
| `weekly_off_configs`         | Standard weekly rest days (e.g. Sunday)     | UUID (`id`) | **Yes** (`effective_from`, `effective_to`) | None                                                                            |
| `public_holidays`            | Official annual public holidays             | UUID (`id`) | No                                         | None                                                                            |
| `salary_components`          | Wage types (Basic, Housing, Allowances)     | UUID (`id`) | No                                         | None                                                                            |
| `employee_hourly_rates`      | Employee normal and overtime rate history   | UUID (`id`) | **Yes** (`effective_from`, `effective_to`) | `employee_id` ➔ `employees`                                                     |

---

## 3. Effective-Dating Design Pattern

For all tables marked **Effective-Dated**, the following rules are enforced:

1. `effective_from` (DATE, NOT NULL): Start date of the validity period.
2. `effective_to` (DATE, NULLABLE): End date of the validity period (`NULL` indicates the ongoing, current record).
3. The application enforces that no two records for the same parent entity have overlapping date intervals.
4. Point-in-time historical queries (e.g. for attendance calculation or retroactive payroll) query:
   ```sql
   WHERE employee_id = :employeeId
     AND effective_from <= :targetDate
     AND (effective_to IS NULL OR effective_to >= :targetDate)
   ```
