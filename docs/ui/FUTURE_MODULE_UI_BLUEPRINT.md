# Blue Royal HRMS — Future Modules UI/UX Architecture Blueprint
**Document ID:** `BLUEPRINT-FUTURE-001`  
**Date:** September 2026  
**Status:** Architectural Blueprint (Pre-Implementation Reference)  

---

## 1. Purpose & Scope

This blueprint defines the interaction patterns, visual components, and information architecture required to seamlessly integrate upcoming roadmap modules (Phase 5 Employee Documents & Expiry Alerts, Phase 6 End of Service Settlements, and System Branding Settings) without requiring structural refactoring of the Angular design system.

> [!NOTE]
> Per engineering constraints, no fake APIs, mock data, or backend logic are implemented now. This document defines the frontend design contract and structural readiness.

---

## 2. Module 1: Employee Onboarding & Profile Readiness

### 2.1 Information Architecture & UI Placement
- **Route Placement:** Child view under People: `/employees/onboarding` or tab within the Employees flagship workspace.
- **Role Permissions Anticipated:** `employees:create`, `onboarding:manage`.

### 2.2 Reusable Interaction Patterns
- **Multi-Step Stepper Component:** Horizontal stepper (1. Identity ➔ 2. Employment & Shift ➔ 3. Compensation & Bank ➔ 4. Document Check ➔ 5. Deployment Assignment).
- **Profile Readiness Progress Bar:** Radial or linear score indicator (e.g., `85% Complete - Missing Passport Copy`).
- **Pre-Hire Checklist Cards:** Actionable items with status badges (`Pending`, `In Review`, `Verified`).

---

## 3. Module 2: Employee Documents Management & Expiry Tracking (Phase 5)

### 3.1 Information Architecture
- **Global Overview Route:** `/documents` (Documents & Compliance Console).
- **Contextual View:** "Documents" tab inside the Employee Profile Drawer/Page (`/employees/:id/documents`).

### 3.2 UI Component Specifications
- **Document Card Grid:**
  - Card anatomy: Document Type icon (Passport, Visa, Emirates ID, Labor Card, Contract), Document Number, Issuing Authority, Issue Date, Expiry Date, Expiry Status Badge.
- **Four-Tier Status Matrix:**
  - **Valid / Compliant:** Emerald green pill (`> 60 days remaining`).
  - **Notice Window:** Amber pill (`30–60 days remaining`).
  - **Critical Expiry:** Orange pill with pulse indicator (`< 30 days remaining`).
  - **Expired / Non-Compliant:** Crimson red pill (`Expired`).
- **Document Upload Drawer:**
  - Drag-and-drop file target (PDF, PNG, JPEG up to 10MB).
  - Metadata fields: Document Type dropdown, Expiry Date picker, Document Reference Number.
- **Dashboard Compliance Widget:**
  - Actionable alert queue: "3 Documents Expiring within 30 Days" with direct filter link.

---

## 4. Module 3: End-of-Service Settlements & Gratuity (Phase 6)

### 4.1 Information Architecture
- **Route Placement:** `/settlements` under Operations, or initiated from Employee Profile action menu ("Initiate Final Settlement").

### 4.2 Interaction Patterns
- **Settlement Calculator Drawer / Page:**
  - Multi-section financial breakdown:
    1. Statutory Gratuity (based on UAE Labor Law service duration & contract type).
    2. Unused Leave Encashment (linked to active leave balance remaining days).
    3. Final Unpaid Working Days / Attendance sync.
    4. Deductions / Recoveries (e.g., company assets, advances).
    5. Net Settlement Payable.
- **Settlement Approval Dialog:** Double-confirmation dialog before locking settlement voucher.

---

## 5. Module 4: Administrative Branding & Customization Settings

### 5.1 System Branding Model (Frontend Architecture)
The design system supports central runtime customization through CSS custom property injection on `:root`:
```typescript
export interface BrandThemeConfig {
  productName: string;
  brandSubtitle: string;
  logoUrl?: string;
  colors: {
    primary: string;       // --brand-600
    primaryDark: string;   // --brand-800
    primaryLight: string;  // --brand-100
    accent: string;        // --brand-500
  };
  typography: {
    fontFamilySans: string;
    fontFamilyDisplay: string;
  };
  loginHero: {
    slides: Array<{
      id: number;
      imageUrl: string;
      category: string;
      title: string;
      description: string;
      highlights: string[];
    }>;
  };
}
```

### 5.2 Future Settings API Requirement
When Phase 7 / Admin Settings is scheduled, the backend will expose:
- `GET /api/v1/system/branding` (returns public brand settings for login and shell).
- `PUT /api/v1/system/branding` (requires `system:configure` permission).
Until that endpoint exists, the frontend provides a clean default configuration singleton (`DEFAULT_BRAND_CONFIG`), allowing theme adjustments without altering component logic.
