import { sequelize } from './src/core/database/sequelize';
import { User, Role, UserRole } from './src/modules/auth/models';
import {
  Client,
  Project,
  Designation,
  Shift,
  PublicHoliday,
  SalaryComponent,
  Employee,
  EmployeeAssignment,
  EmployeeHourlyRate,
  ClientBillingRate,
} from './src/modules/masters/models';
import { EmployeeOnboarding } from './src/modules/onboarding/models/employee-onboarding.model';
import { DocumentType } from './src/modules/documents/models/document-type.model';
import { EmployeeDocument } from './src/modules/documents/models/employee-document.model';
import { AttendancePeriod } from './src/modules/attendance/models/attendance-period.model';
import { AttendanceRecord } from './src/modules/attendance/models/attendance-record.model';
import { LeaveType } from './src/modules/leave/models/leave-type.model';
import { LeaveRequest } from './src/modules/leave/models/leave-request.model';
import { EmployeeLeaveBalance } from './src/modules/leave/models/employee-leave-balance.model';
import { PayrollPeriod } from './src/modules/payroll/models/payroll-period.model';
import { PayrollItem } from './src/modules/payroll/models/payroll-item.model';
import bcrypt from 'bcryptjs';

async function runDemoSeed() {
  await sequelize.authenticate();
  console.log('=== STARTING BLUE ROYAL HRMS DEMO RUNNER ===\n');

  // =========================================================================
  // STEP 1: SUPER ADMIN — ORGANIZATION & COMMERCIAL MASTERS
  // =========================================================================
  console.log('--- STEP 1: Setting up Organization Masters ---');

  // 1.1 Commercial Client
  let client = await Client.findOne({ where: { code: 'CL-DEMO-01' } });
  if (!client) {
    client = await Client.create({
      name: 'DEMO - Blue Royal Client',
      code: 'CL-DEMO-01',
      contactPerson: 'John Smith',
      contactEmail: 'contact@blueroyalclient.demo',
      contactPhone: '+971 4 123 4567',
      billingAddress: 'Dubai Internet City, Building 3',
      isActive: true,
    });
    console.log('✓ Created Client: DEMO - Blue Royal Client (CL-DEMO-01)');
  } else {
    console.log('✓ Client already exists: DEMO - Blue Royal Client');
  }

  // 1.2 Project / Worksite
  let project = await Project.findOne({ where: { code: 'PRJ-DEMO-01' } });
  if (!project) {
    project = await Project.create({
      name: 'DEMO - Enterprise HRMS Project',
      code: 'PRJ-DEMO-01',
      clientId: client.id,
      siteLocation: 'Dubai HQ',
      status: 'active',
      startDate: '2026-01-01',
    });
    console.log('✓ Created Project: DEMO - Enterprise HRMS Project (PRJ-DEMO-01)');
  } else {
    console.log('✓ Project already exists: DEMO - Enterprise HRMS Project');
  }

  // 1.3 Designation
  let designation = await Designation.findOne({ where: { code: 'DES-DEMO-SE' } });
  if (!designation) {
    designation = await Designation.create({
      title: 'DEMO - Software Engineer',
      code: 'DES-DEMO-SE',
      department: 'Engineering',
      description: 'Full-stack software engineering and delivery',
      minSalary: 8000,
      maxSalary: 18000,
      isActive: true,
    });
    console.log('✓ Created Designation: DEMO - Software Engineer (DES-DEMO-SE)');
  } else {
    console.log('✓ Designation already exists: DEMO - Software Engineer');
  }

  // 1.4 Client Invoicing / Billing Rate
  let billingRate = await ClientBillingRate.findOne({
    where: { clientId: client.id, projectId: project.id, designationId: designation.id },
  });
  if (!billingRate) {
    billingRate = await ClientBillingRate.create({
      clientId: client.id,
      projectId: project.id,
      designationId: designation.id,
      normalBillingRate: 85.0,
      otBillingRate: 125.0,
      effectiveFrom: '2026-08-01',
    });
    console.log('✓ Created Client Invoicing Rate: 85.00 AED/hr normal, 125.00 AED/hr OT');
  } else {
    console.log('✓ Client Invoicing Rate already exists');
  }

  // 1.5 Work Shift
  let shift = await Shift.findOne({ where: { code: 'SH-DEMO-GEN' } });
  if (!shift) {
    shift = await Shift.create({
      name: 'DEMO - General Shift',
      code: 'SH-DEMO-GEN',
      startTime: '09:00:00',
      endTime: '18:00:00',
      workHours: 8.0,
      breakDurationMinutes: 60,
    });
    console.log('✓ Created Shift: DEMO - General Shift (SH-DEMO-GEN)');
  } else {
    console.log('✓ Shift already exists: DEMO - General Shift');
  }

  // 1.6 Holiday
  let holiday = await PublicHoliday.findOne({ where: { holidayDate: '2026-12-02' } });
  if (!holiday) {
    holiday = await PublicHoliday.create({
      calendarYear: 2026,
      name: 'DEMO - National Holiday',
      holidayDate: '2026-12-02',
      description: 'National Day Celebration',
    });
    console.log('✓ Created Holiday: DEMO - National Holiday (2026-12-02)');
  } else {
    console.log('✓ Holiday already exists: DEMO - National Holiday');
  }

  // 1.7 Salary Component
  let basicSalary = await SalaryComponent.findOne({ where: { code: 'BASIC-DEMO' } });
  if (!basicSalary) {
    basicSalary = await SalaryComponent.create({
      name: 'DEMO - Basic Salary',
      code: 'BASIC-DEMO',
      type: 'earning',
      calculationType: 'fixed_amount',
      isRecurring: true,
      isWpsBasic: true,
      isWpsHousing: false,
      isActive: true,
    });
    console.log('✓ Created Salary Component: DEMO - Basic Salary');
  }

  // =========================================================================
  // STEP 2: HR ADMIN — CREATE EMPLOYEE & ONBOARDING LIFECYCLE
  // =========================================================================
  console.log('\n--- STEP 2: Creating Employee & Onboarding ---');

  // 2.1 User Account for Rahul Sharma
  let rahulUser = await User.findOne({ where: { email: 'rahul.demo@blueroyal.com' } });
  if (!rahulUser) {
    const hashedPassword = await bcrypt.hash('Employee@2026!', 10);
    rahulUser = await User.create({
      email: 'rahul.demo@blueroyal.com',
      passwordHash: hashedPassword,
      firstName: 'Rahul',
      lastName: 'Sharma',
      status: 'active',
    });
    const employeeRole = await Role.findOne({ where: { name: 'employee' } });
    if (employeeRole) {
      await UserRole.create({
        userId: rahulUser.id,
        roleId: employeeRole.id,
      });
    }
    console.log('✓ Created User Account: rahul.demo@blueroyal.com (Password: Employee@2026!)');
  } else {
    console.log('✓ User Account already exists: rahul.demo@blueroyal.com');
  }

  // 2.2 Employee Core Profile
  let rahulEmp = await Employee.findOne({ where: { employeeCode: 'DEMO-EMP-001' } });
  if (!rahulEmp) {
    rahulEmp = await Employee.create({
      firstName: 'Rahul',
      lastName: 'Sharma',
      employeeCode: 'DEMO-EMP-001',
      email: 'rahul.demo@blueroyal.com',
      phoneNumber: '+971 50 123 4567',
      dateOfBirth: '1995-05-15',
      gender: 'male',
      nationality: 'Indian',
      dateOfJoining: '2026-08-01',
      employmentType: 'full_time',
      remunerationBasis: 'hourly',
      userId: rahulUser.id,
      status: 'draft',
    });
    console.log('✓ Created Employee: DEMO - Rahul Sharma (DEMO-EMP-001)');
  } else {
    rahulEmp.userId = rahulUser.id;
    await rahulEmp.save();
    console.log('✓ Employee already exists: DEMO - Rahul Sharma');
  }

  // 2.3 Onboarding Record (Pillars 1 & 2 satisfied via profile)
  let onboarding = await EmployeeOnboarding.findOne({ where: { employeeId: rahulEmp.id } });
  if (!onboarding) {
    onboarding = await EmployeeOnboarding.create({
      employeeId: rahulEmp.id,
      status: 'in_progress',
      currentStep: 'assignmentSetup',
      completionPercentage: 40,
      checklistProgress: {
        personalInfo: true,
        employmentDetails: true,
        assignmentSetup: false,
        compensationSetup: false,
        mandatoryDocuments: false,
      },
    });
    console.log('✓ Initiated Onboarding for Rahul Sharma (Pillars 1 & 2 checked)');
  }

  // 2.4 Pillar 3: Workforce Deployment / Assignment
  let assignment = await EmployeeAssignment.findOne({ where: { employeeId: rahulEmp.id } });
  if (!assignment) {
    assignment = await EmployeeAssignment.create({
      employeeId: rahulEmp.id,
      clientId: client.id,
      projectId: project.id,
      designationId: designation.id,
      effectiveFrom: '2026-08-01',
      remarks: 'Primary Onboarding Deployment',
    });
    console.log('✓ Pillar 3 Satisfied: Deployed Rahul Sharma to DEMO - Enterprise HRMS Project');
  }

  // 2.5 Pillar 4: Worker Pay Rate
  let payRate = await EmployeeHourlyRate.findOne({ where: { employeeId: rahulEmp.id } });
  if (!payRate) {
    payRate = await EmployeeHourlyRate.create({
      employeeId: rahulEmp.id,
      normalHourlyRate: 50.0,
      otHourlyRate: 75.0,
      effectiveFrom: '2026-08-01',
      changeReason: 'Initial Onboarding Rate',
    });
    console.log('✓ Pillar 4 Satisfied: Configured Worker Pay Rate (50 AED/hr normal, 75 AED/hr OT)');
  }

  // 2.6 Pillar 5: Statutory Documents
  const mandatoryDocTypes = await DocumentType.findAll({ where: { isMandatory: true } });
  console.log(`Found ${mandatoryDocTypes.length} mandatory document types.`);

  for (const dt of mandatoryDocTypes) {
    let doc = await EmployeeDocument.findOne({
      where: {
        employeeId: rahulEmp.id,
        documentTypeId: dt.id,
      },
    });
    if (!doc) {
      doc = await EmployeeDocument.create({
        employeeId: rahulEmp.id,
        documentTypeId: dt.id,
        documentNumber: `DEMO-${dt.code}-2026`,
        issueDate: '2026-01-01',
        expiryDate: '2028-12-31',
        originalFileName: `${dt.code.toLowerCase()}.pdf`,
        filePath: `demo/${dt.code.toLowerCase()}.pdf`,
        fileSizeBytes: 102400,
        mimeType: 'application/pdf',
        verificationStatus: 'verified',
      });
      console.log(`✓ Pillar 5 Document: Uploaded & Verified [${dt.name}]`);
    }
  }

  // 2.7 Complete Onboarding & Activate Employee
  onboarding.status = 'completed';
  onboarding.currentStep = 'completed';
  onboarding.completionPercentage = 100;
  onboarding.checklistProgress = {
    personalInfo: true,
    employmentDetails: true,
    assignmentSetup: true,
    compensationSetup: true,
    mandatoryDocuments: true,
  };
  onboarding.completedAt = new Date();
  await onboarding.save();

  rahulEmp.status = 'active';
  await rahulEmp.save();
  console.log('✓ All 5 Pillars Completed! Employee Rahul Sharma status is now: ACTIVE');

  // =========================================================================
  // STEP 3: WORKFORCE OPERATIONS — ATTENDANCE & LEAVE
  // =========================================================================
  console.log('\n--- STEP 3: Workforce Operations (Attendance & Leave) ---');

  // 3.1 Active Attendance Period (September 2026)
  const sepPeriod = await AttendancePeriod.findOne({ where: { periodCode: '2026-09' } });
  if (!sepPeriod) {
    throw new Error('September 2026 attendance period not found!');
  }
  console.log(`Using Active Attendance Period: [${sepPeriod.periodCode}] ${sepPeriod.name}`);

  // Create 18 days of real attendance records for Rahul Sharma (18 x 8h = 144 regular hours)
  let existingRecords = await AttendanceRecord.count({
    where: {
      attendancePeriodId: sepPeriod.id,
      employeeId: rahulEmp.id,
    },
  });

  if (existingRecords === 0) {
    const dates = [
      '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04',
      '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10',
      '2026-09-11', '2026-09-14', '2026-09-15', '2026-09-16',
      '2026-09-17', '2026-09-18', '2026-09-21', '2026-09-22',
      '2026-09-23', '2026-09-28',
    ];

    for (const d of dates) {
      await AttendanceRecord.create({
        attendancePeriodId: sepPeriod.id,
        employeeId: rahulEmp.id,
        shiftId: shift.id,
        projectId: project.id,
        clientId: client.id,
        designationId: designation.id,
        workDate: d,
        dayType: 'regular_workday',
        actualHours: 8.0,
        regularHours: 8.0,
        otHours: 0.0,
        isAbsent: false,
        isOnLeave: false,
        hasAnomaly: false,
        remarks: 'Normal daily shift completed',
      });
    }
    console.log(`✓ Created 18 Present Attendance Records for Rahul Sharma in September 2026 (144 hrs)`);
  } else {
    console.log(`✓ Rahul Sharma already has ${existingRecords} attendance records in September 2026`);
  }

  // 3.2 Leave Balances
  const annualLeaveType = await LeaveType.findOne({ where: { code: 'ANNUAL' } });
  const sickLeaveType = await LeaveType.findOne({ where: { code: 'SICK' } });

  if (annualLeaveType) {
    let bal = await EmployeeLeaveBalance.findOne({
      where: { employeeId: rahulEmp.id, leaveTypeId: annualLeaveType.id },
    });
    if (!bal) {
      await EmployeeLeaveBalance.create({
        employeeId: rahulEmp.id,
        leaveTypeId: annualLeaveType.id,
        year: 2026,
        allocatedDays: 30,
        usedDays: 2,
        pendingDays: 0,
        carriedForward: 0,
      });
      console.log('✓ Allocated 30 Annual Leave days (2 used, 28 remaining)');
    }
  }

  if (sickLeaveType) {
    let bal = await EmployeeLeaveBalance.findOne({
      where: { employeeId: rahulEmp.id, leaveTypeId: sickLeaveType.id },
    });
    if (!bal) {
      await EmployeeLeaveBalance.create({
        employeeId: rahulEmp.id,
        leaveTypeId: sickLeaveType.id,
        year: 2026,
        allocatedDays: 15,
        usedDays: 0,
        pendingDays: 0,
        carriedForward: 0,
      });
      console.log('✓ Allocated 15 Sick Leave days (0 used, 15 remaining)');
    }
  }

  // 3.3 Leave Request & Approval
  if (annualLeaveType) {
    let leaveReq = await LeaveRequest.findOne({ where: { employeeId: rahulEmp.id } });
    if (!leaveReq) {
      leaveReq = await LeaveRequest.create({
        requestNumber: 'DEMO-LR-2026-001',
        employeeId: rahulEmp.id,
        leaveTypeId: annualLeaveType.id,
        startDate: '2026-09-24',
        endDate: '2026-09-25',
        totalDays: 2,
        reason: 'Family event and personal travel',
        status: 'APPROVED',
      });
      console.log('✓ Created & Approved Leave Request: 2 days Annual Leave (2026-09-24 to 2026-09-25)');
    } else {
      console.log(`✓ Leave request already exists: Status is ${leaveReq.status}`);
    }
  }

  // =========================================================================
  // STEP 4: PAYROLL CYCLE FOR SEPTEMBER 2026
  // =========================================================================
  console.log('\n--- STEP 4: Payroll Cycle Processing ---');

  let payrollPeriod = await PayrollPeriod.findOne({ where: { periodCode: '2026-09' } });
  if (!payrollPeriod) {
    payrollPeriod = await PayrollPeriod.create({
      periodCode: '2026-09',
      name: 'September 2026 Payroll',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      attendancePeriodId: sepPeriod.id,
      status: 'calculated',
      employeeCount: 1,
      totalGrossPay: 7200.0,
      totalNetPay: 7200.0,
      blockingIssuesCount: 0,
    });
    console.log('✓ Created Payroll Period: September 2026 Payroll (calculated)');
  } else {
    payrollPeriod.status = 'calculated';
    await payrollPeriod.save();
    console.log('✓ Payroll Period exists: September 2026 Payroll');
  }

  let payrollItem = await PayrollItem.findOne({
    where: { payrollPeriodId: payrollPeriod.id, employeeId: rahulEmp.id },
  });
  if (!payrollItem) {
    payrollItem = await PayrollItem.create({
      payrollPeriodId: payrollPeriod.id,
      employeeId: rahulEmp.id,
      remunerationBasis: 'hourly',
      designationId: designation.id,
      daysInPeriod: 30,
      totalActualHours: 144.0,
      totalRegularHours: 144.0,
      totalOtHours: 0.0,
      totalAbsenceDays: 0,
      totalLeaveDays: 2,
      grossPay: 7200.0,
      totalDeductions: 0.0,
      netPay: 7200.0,
      hasBlockingIssue: false,
    });
    console.log('✓ Computed Itemized Payslip for Rahul Sharma: Gross 7,200 AED | Net 7,200 AED (144 hrs @ 50 AED/hr)');
  } else {
    console.log('✓ Payslip for Rahul Sharma already exists: Net 7,200 AED');
  }

  // Also verify standard demo account `employee@blueroyal.com`
  const standardDemoUser = await User.findOne({ where: { email: 'employee@blueroyal.com' } });
  if (standardDemoUser) {
    const demoEmp = await Employee.findOne({ where: { userId: standardDemoUser.id } });
    if (demoEmp) {
      console.log(`✓ Standard demo account employee@blueroyal.com is linked to Employee [${demoEmp.employeeCode}] ${demoEmp.firstName} ${demoEmp.lastName}`);
    }
  }

  console.log('\n=== DEMO RUNNER COMPLETED WITH 100% SUCCESS ===');
  process.exit(0);
}

runDemoSeed().catch(err => {
  console.error('Demo Runner Error:', err);
  process.exit(1);
});
