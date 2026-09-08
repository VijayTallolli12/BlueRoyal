# Blue Royal HRMS — Phase 3: Leave Management & Employee Entitlements Workflows

**Document ID:** `DOC-WF-PHASE3-LEAVE`  
**Status:** Approved Workflow Specification  
**Version:** 1.0.0  
**Date:** 2026-09-09  

---

## 1. Overview

This document specifies the end-to-end operational workflows for Phase 3: Leave Management & Employee Entitlements in the Blue Royal HRMS.
These workflows define the precise sequence of operations across the Angular frontend, Node.js API, PostgreSQL database, and Phase 2 Attendance synchronization engine.

---

## 2. End-to-End Business Workflows

### WF-3.1: Configure Leave Types & Annual Balance Allocation
**Actors:** HR Admin, Super Admin  
**Permissions:** `leave_types:create`, `leave_types:update`, `leave_balances:manage`

```
 [HR Admin]
      │
      ├─► 1. Access Masters Hub ➔ Leave Types tab
      │     └─ Defines Leave Type (Code, Name, Is Paid, Default Days, Deduct Working Days Only)
      │
      ├─► 2. Backend validates uniqueness of code & creates `leave_types` record
      │     └─ Emits audit event `LEAVE_TYPE_CREATED`
      │
      └─► 3. Access Employee Leave Balances tab
            ├─ Selects Employee and Year (e.g. 2026)
            ├─ Specifies Allocated Days (e.g. 30.00) & Carried Forward Days (e.g. 0.00)
            ├─ Backend upserts `employee_leave_balances` record (idempotent composite key)
            └─ Emits audit event `LEAVE_BALANCE_ALLOCATED`
```

---

### WF-3.2: Employee Submits Leave Request (Self-Service)
**Actors:** Employee  
**Permissions:** `leave:self_create`

```
 [Employee]
      │
      ├─► 1. Navigates to /leave/my-leave
      │     └─ System loads current year balances (Allocated, Used, Pending, Remaining)
      │
      ├─► 2. Clicks "Request Leave" and selects:
      │     ├─ Leave Type (e.g. Annual Leave)
      │     ├─ Start Date & End Date
      │     └─ Reason for leave (Mandatory)
      │
      ├─► 3. System checks business rules:
      │     ├─ Rule A: start_date <= end_date
      │     ├─ Rule B: Employee must be active and within contract dates (date_of_joining <= start_date <= contract_end_date)
      │     ├─ Rule C: No overlapping PENDING or APPROVED leave request for this employee
      │     ├─ Rule D: If leave type is paid/capped, remaining_days >= total_days requested
      │     └─ Rule E: If allow_during_probation is false and employee in probation, request is rejected
      │
      └─► 4. On successful validation:
            ├─ Generates unique request number (e.g. `LR-202609-0001`)
            ├─ Inserts `leave_requests` record in `PENDING` status
            ├─ Transactionally increments `pending_days` on `employee_leave_balances`
            └─ Emits audit event `LEAVE_REQUEST_SUBMITTED`
```

---

### WF-3.3: HR Review & Request Approval
**Actors:** HR Admin, Super Admin  
**Permissions:** `leave:approve`

```
 [HR Admin]
      │
      ├─► 1. Navigates to /leave (Admin Management Hub)
      │     └─ Views pending leave requests with filter bar (Status = PENDING, Employee, Leave Type)
      │
      ├─► 2. Selects request and clicks "Approve"
      │
      ├─► 3. Database Transaction:
      │     ├─ Updates request status to `APPROVED`, records `approved_by` and `approved_at`
      │     ├─ Adjusts balances: decrements `pending_days` by total_days, increments `used_days` by total_days
      │     └─ Invokes `AttendanceLeaveSyncService.syncApprovedLeave(request)`:
      │          ├─ Finds attendance records in existing periods covering [start_date, end_date]
      │          ├─ If period is LOCKED ➔ Raises conflict / blocks past locked alteration
      │          ├─ If period is DRAFT / SUBMITTED / APPROVED:
      │          │    ├─ Sets `is_on_leave = true`
      │          │    ├─ Recomputes regular=0, OT=0, is_absent=false
      │          │    ├─ Flags anomaly `CONFLICT_LEAVE_WORK_LOGGED` if actual_hours > 0
      │          │    ├─ If period was SUBMITTED or APPROVED, reverts period to DRAFT
      │          │    └─ Records entry in `attendance_audit_logs`
      │          └─ Emits regulatory audit event `LEAVE_REQUEST_APPROVED`
      │
      └─► 4. Frontend updates: Real-time UI reflects APPROVED badge; Attendance Sheet highlights leave days
```

---

### WF-3.4: HR Review & Request Rejection
**Actors:** HR Admin, Super Admin  
**Permissions:** `leave:reject`

```
 [HR Admin]
      │
      ├─► 1. Selects pending leave request and clicks "Reject"
      │     └─ Rejection modal prompts for mandatory rejection reason (min 5 characters)
      │
      ├─► 2. Database Transaction:
      │     ├─ Updates request status to `REJECTED`, records `rejected_by`, `rejected_at`, and `rejection_reason`
      │     ├─ Decrements `pending_days` by total_days on `employee_leave_balances` (restores remaining balance)
      │     └─ Emits audit event `LEAVE_REQUEST_REJECTED`
      │
      └─► 3. Employee self-service view displays REJECTED status with the documented rejection reason
```

---

### WF-3.5: Employee Self-Service Request Cancellation
**Actors:** Employee  
**Permissions:** `leave:self_cancel`

```
 [Employee]
      │
      ├─► 1. Navigates to /leave/my-leave
      │     └─ Locates request in `PENDING` status
      │
      ├─► 2. Clicks "Cancel Request"
      │     └─ Confirms action in cancellation dialog
      │
      ├─► 3. Database Transaction:
      │     ├─ Verifies request status is strictly `PENDING`
      │     ├─ Updates status to `CANCELLED`, records `cancelled_by` = user_id and `cancelled_at` = NOW()
      │     ├─ Decrements `pending_days` on `employee_leave_balances` (restores remaining balance)
      │     └─ Emits audit event `LEAVE_REQUEST_CANCELLED`
      │
      └─► 4. UI immediately refreshes balance card and updates request row status
```

---

### WF-3.6: Administrative Revocation of Approved Leave
**Actors:** HR Admin, Super Admin  
**Permissions:** `leave:cancel`

```
 [HR Admin / Super Admin]
      │
      ├─► 1. Locates previously `APPROVED` leave request in /leave
      │     └─ Clicks "Revoke / Cancel Leave"
      │     └─ Provides mandatory cancellation reason
      │
      ├─► 2. Database Transaction:
      │     ├─ Updates request status to `CANCELLED`, records `cancelled_by`, `cancelled_at`, and reason
      │     ├─ Decrements `used_days` by total_days on `employee_leave_balances` (restores remaining balance)
      │     ├─ Invokes `AttendanceLeaveSyncService.revertApprovedLeave(request)`:
      │     │    ├─ For each day in open attendance periods:
      │     │    │    ├─ Sets `is_on_leave = false`
      │     │    │    ├─ Recomputes hours: if actual_hours == 0 ➔ marks `is_absent = true`
      │     │    │    └─ Emits cell audit log
      │     │    └─ If attendance period is LOCKED ➔ Returns descriptive warning/error
      │     └─ Emits audit event `LEAVE_REQUEST_CANCELLED`
      │
      └─► 3. Audit trail records full revocation rationale and timestamp
```

---

### WF-3.7: Pre-Generation Integration with Attendance Engine
**Actors:** HR Admin, Super Admin  
**Permissions:** `attendance:create`

```
 [HR Admin]
      │
      ├─► 1. Creates new monthly attendance period (e.g. September 2026) via /attendance
      │
      ├─► 2. `AttendancePeriodService.createPeriod` runs:
      │     ├─ For each active eligible employee and each day in the month:
      │     │    ├─ Queries `leave_requests` where employee_id = E, status = 'APPROVED', work_date BETWEEN start_date AND end_date
      │     │    ├─ If match found:
      │     │    │    └─ Initializes `attendance_records` with:
      │     │    │         actual_hours = 0.00, regular_hours = 0.00, ot_hours = 0.00,
      │     │    │         is_absent = false, is_on_leave = true
      │     │    └─ If no leave:
      │     │         └─ Standard shift resolution and dayType determination
      │     └─ Generates entire monthly matrix pre-populated with approved leaves
```
