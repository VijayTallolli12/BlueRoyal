# Blue Royal HRMS — Database Schema & Data Dictionary

## Engine

PostgreSQL 17.x

## Tables Established in Phase 0 Foundation

| Table Name         | Purpose                                           | Primary Key                            | Paranoid (Soft Delete) |
| ------------------ | ------------------------------------------------- | -------------------------------------- | ---------------------- |
| `users`            | User credentials and profile accounts             | UUID (`id`)                            | Yes (`deleted_at`)     |
| `roles`            | System and organizational roles                   | UUID (`id`)                            | No                     |
| `permissions`      | Atomic permissions (`resource:action`)            | UUID (`id`)                            | No                     |
| `role_permissions` | Mapping of roles to granted permissions           | Composite (`role_id`, `permission_id`) | No                     |
| `user_roles`       | Mapping of users to assigned roles                | Composite (`user_id`, `role_id`)       | No                     |
| `refresh_tokens`   | Secure hashed refresh tokens for session rotation | UUID (`id`)                            | No (`revoked_at`)      |
| `audit_logs`       | Append-only regulatory audit trail                | UUID (`id`)                            | No (Immutable)         |

## Seeded Roles

1. `super_admin` — Unrestricted platform access
2. `hr_admin` — Human resources administrative operations
3. `employee` — Self-service access
