import { sequelize } from '../../src/core/database/sequelize';
import { InvoiceService } from '../../src/modules/invoices/services/invoice.service';
import { Invoice } from '../../src/modules/invoices/models/invoice.model';
import { InvoiceLine } from '../../src/modules/invoices/models/invoice-line.model';
import { Employee } from '../../src/modules/masters/models/employee.model';
import { Client } from '../../src/modules/masters/models/client.model';
import { Project } from '../../src/modules/masters/models/project.model';
import { Designation } from '../../src/modules/masters/models/designation.model';
import { EmployeeAssignment } from '../../src/modules/masters/models/employee-assignment.model';
import { ClientBillingRate } from '../../src/modules/masters/models/client-billing-rate.model';
import { AttendanceRecord } from '../../src/modules/attendance/models/attendance-record.model';
import { AttendancePeriod } from '../../src/modules/attendance/models/attendance-period.model';
import { User } from '../../src/modules/auth/models/user.model';

describe('HRMS Client Invoice / Billing Workflow Integration Tests', () => {
  let clientId: string;
  let projectId: string;
  let desId: string;
  let desWithoutRateId: string;
  let emp1Id: string;
  let emp2Id: string;
  let periodId: string;
  let testUserId: string;
  const billingPeriod = '2026-11';

  beforeAll(async () => {
    await sequelize.authenticate();
    const ts = Date.now();

    const user = await User.findOne();
    if (user) {
      testUserId = user.id;
    }

    // 1. Designation with rate
    const des = await Designation.create({
      code: `DES-INV-${ts}`,
      title: 'Senior Electrician',
    });
    desId = des.id;

    // 2. Designation without rate
    const desNoRate = await Designation.create({
      code: `DES-NORATE-${ts}`,
      title: 'Helper',
    });
    desWithoutRateId = desNoRate.id;

    // 3. Client
    const client = await Client.create({
      code: `CLI-INV-${ts}`,
      name: 'Emaar Development LLC',
    });
    clientId = client.id;

    // 4. Project
    const project = await Project.create({
      clientId,
      code: `PRJ-INV-${ts}`,
      name: 'Emaar Beachfront Tower 1',
    });
    projectId = project.id;

    // 5. Billing Rate (Normal: 60 AED/hr, OT: 90 AED/hr)
    await ClientBillingRate.create({
      clientId,
      projectId,
      designationId: desId,
      normalBillingRate: 60.0,
      otBillingRate: 90.0,
      effectiveFrom: '2026-11-01',
      effectiveTo: null,
    });

    // 6. Employees
    const emp1 = await Employee.create({
      employeeCode: `EMP-INV1-${ts}`,
      firstName: 'Ahmed',
      lastName: 'Hassan',
      gender: 'male',
      dateOfBirth: '1990-01-01',
      nationality: 'Egyptian',
      dateOfJoining: '2026-01-01',
      status: 'active',
    });
    emp1Id = emp1.id;

    const emp2 = await Employee.create({
      employeeCode: `EMP-INV2-${ts}`,
      firstName: 'Tariq',
      lastName: 'Ali',
      gender: 'male',
      dateOfBirth: '1993-04-12',
      nationality: 'Pakistani',
      dateOfJoining: '2026-01-01',
      status: 'active',
    });
    emp2Id = emp2.id;

    // 7. Project Assignments
    await EmployeeAssignment.create({
      employeeId: emp1Id,
      clientId,
      projectId,
      designationId: desId,
      effectiveFrom: '2026-11-01',
      effectiveTo: null,
    });

    // 8. Attendance Period (periodCode max length is 7 chars e.g. 2026-11)
    // First remove any leftover period from previous run
    await AttendancePeriod.destroy({ where: { periodCode: billingPeriod } });
    const attPeriod = await AttendancePeriod.create({
      periodCode: billingPeriod,
      name: 'November 2026 Test Period',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      status: 'draft',
    });
    periodId = attPeriod.id;

    // 9. Attendance Records for emp1 (160 regular hours, 20 overtime hours)
    // Create 20 records with 8 reg hrs each = 160 hrs, plus 2 records with 10 ot hrs each = 20 ot hrs
    for (let day = 1; day <= 20; day++) {
      const dayStr = String(day).padStart(2, '0');
      await AttendanceRecord.create({
        attendancePeriodId: periodId,
        employeeId: emp1Id,
        workDate: `2026-11-${dayStr}`,
        clientId,
        projectId,
        designationId: desId,
        dayType: 'regular_workday',
        actualHours: 8.0,
        regularHours: 8.0,
        otHours: day <= 2 ? 10.0 : 0.0,
        isAbsent: false,
        isOnLeave: false,
        hasAnomaly: false,
      });
    }
  });

  afterAll(async () => {
    if (projectId) await InvoiceLine.destroy({ where: { projectId } });
    if (clientId) await Invoice.destroy({ where: { clientId } });
    if (periodId) {
      await AttendanceRecord.destroy({ where: { attendancePeriodId: periodId } });
      await AttendancePeriod.destroy({ where: { id: periodId } });
    }
    if (clientId) await ClientBillingRate.destroy({ where: { clientId } });
    if (emp1Id || emp2Id) {
      const empIds = [emp1Id, emp2Id].filter(Boolean);
      await EmployeeAssignment.destroy({ where: { employeeId: empIds } });
      await Employee.destroy({ where: { id: empIds }, force: true });
    }
    if (projectId) await Project.destroy({ where: { id: projectId }, force: true });
    if (clientId) await Client.destroy({ where: { id: clientId }, force: true });
    const desIds = [desId, desWithoutRateId].filter(Boolean);
    if (desIds.length > 0) await Designation.destroy({ where: { id: desIds } });
  });

  it('Step 1: previewInvoice correctly computes hours, rates, workforce count, and totals', async () => {
    const preview = await InvoiceService.previewInvoice({
      clientId,
      projectId,
      billingPeriod,
    });

    expect(preview.billableEmployeesCount).toBe(1);
    expect(preview.totalRegularHours).toBe(160);
    expect(preview.totalOtHours).toBe(20);
    expect(preview.items.length).toBe(1);

    const item = preview.items[0];
    expect(item.employeeId).toBe(emp1Id);
    expect(item.regularHours).toBe(160);
    expect(item.regularRate).toBe(60);
    expect(item.regularAmount).toBe(9600); // 160 * 60
    expect(item.otHours).toBe(20);
    expect(item.otRate).toBe(90);
    expect(item.otAmount).toBe(1800); // 20 * 90
    expect(item.totalAmount).toBe(11400); // 9600 + 1800

    expect(preview.subtotal).toBe(11400);
    expect(preview.taxAmount).toBe(0);
    expect(preview.totalAmount).toBe(11400);
  });

  it('Step 2: previewInvoice blocks and reports error if a billable worker has missing billing rate', async () => {
    // Deploy emp2 with designation without rate and add attendance
    const assign2 = await EmployeeAssignment.create({
      employeeId: emp2Id,
      clientId,
      projectId,
      designationId: desWithoutRateId,
      effectiveFrom: '2026-11-01',
      effectiveTo: null,
    });

    const rec2 = await AttendanceRecord.create({
      attendancePeriodId: periodId,
      employeeId: emp2Id,
      workDate: '2026-11-05',
      clientId,
      projectId,
      designationId: desWithoutRateId,
      dayType: 'regular_workday',
      actualHours: 8.0,
      regularHours: 8.0,
      otHours: 0.0,
      isAbsent: false,
      isOnLeave: false,
      hasAnomaly: false,
    });

    // Preview should fail identifying the employee and designation
    await expect(
      InvoiceService.previewInvoice({
        clientId,
        projectId,
        billingPeriod,
      }),
    ).rejects.toThrow(/Missing client billing rate for Employee.*Helper/);

    // Clean up temporary unrated record so subsequent tests pass
    await rec2.destroy();
    await assign2.destroy();
  });

  it('Step 3: generateInvoice creates invoice in DRAFT status only (not issued)', async () => {
    const invoice = await InvoiceService.generateInvoice({
      clientId,
      projectId,
      billingPeriod,
      notes: 'Initial November Draft',
    });

    expect(invoice.status).toBe('draft');
    expect(Number(invoice.totalAmount)).toBe(11400);
    expect(invoice.invoiceNumber).toMatch(/^INV-2026-11-\d{4}$/);
  });

  it('Step 4: duplicate protection - re-generating while DRAFT updates existing draft without creating duplicate', async () => {
    const invoicesBefore = await Invoice.count({ where: { clientId, projectId, billingPeriod } });
    expect(invoicesBefore).toBe(1);

    const updated = await InvoiceService.generateInvoice({
      clientId,
      projectId,
      billingPeriod,
      notes: 'Updated November Draft Notes',
    });

    const invoicesAfter = await Invoice.count({ where: { clientId, projectId, billingPeriod } });
    expect(invoicesAfter).toBe(1); // Same count!
    expect(updated.notes).toBe('Updated November Draft Notes');
    expect(updated.status).toBe('draft');
  });

  it('Step 5: APPROVAL BYPASS TEST - DRAFT -> ISSUE MUST FAIL', async () => {
    const draft = await Invoice.findOne({ where: { clientId, projectId, billingPeriod } });
    expect(draft!.status).toBe('draft');

    await expect(InvoiceService.issueInvoice(draft!.id)).rejects.toThrow(
      /cannot be issued directly from DRAFT status. Approval is mandatory/,
    );
  });

  it('Step 6: APPROVAL BYPASS TEST - DRAFT -> APPROVE MUST SUCCEED', async () => {
    const draft = await Invoice.findOne({ where: { clientId, projectId, billingPeriod } });
    const approved = await InvoiceService.approveInvoice(draft!.id, testUserId);

    expect(approved.status).toBe('approved');
    expect(approved.approvedAt).toBeDefined();
    expect(approved.approvedBy).toBe(testUserId);
  });

  it('Step 7: duplicate protection - generating another invoice when one is APPROVED MUST FAIL', async () => {
    await expect(
      InvoiceService.generateInvoice({
        clientId,
        projectId,
        billingPeriod,
      }),
    ).rejects.toThrow(/is already APPROVED for this client/);
  });

  it('Step 8: APPROVAL BYPASS TEST - APPROVED -> ISSUE MUST SUCCEED', async () => {
    const approved = await Invoice.findOne({ where: { clientId, projectId, billingPeriod } });
    expect(approved!.status).toBe('approved');

    const issued = await InvoiceService.issueInvoice(approved!.id, testUserId);
    expect(issued.status).toBe('issued');
    expect(issued.issuedAt).toBeDefined();
    expect(issued.issuedBy).toBe(testUserId);
  });

  it('Step 9: APPROVAL BYPASS TEST - ISSUED -> ISSUE MUST FAIL', async () => {
    const issued = await Invoice.findOne({ where: { clientId, projectId, billingPeriod } });
    expect(issued!.status).toBe('issued');

    await expect(InvoiceService.issueInvoice(issued!.id)).rejects.toThrow(/already issued/);
  });

  it('Step 10: ISSUED -> REJECT MUST FAIL', async () => {
    const issued = await Invoice.findOne({ where: { clientId, projectId, billingPeriod } });
    await expect(InvoiceService.rejectInvoice(issued!.id, 'Trying to reject issued')).rejects.toThrow(
      /Cannot reject issued invoice.*Issued invoices are permanently locked/,
    );
  });

  it('Step 11: REJECTION LIFECYCLE & BYPASS TEST - DRAFT -> REJECT -> ISSUE MUST FAIL', async () => {
    // Generate a new draft for another period (2026-12)
    const decPeriod = '2026-12';
    // Add 1 record in Dec
    const recDec = await AttendanceRecord.create({
      attendancePeriodId: periodId,
      employeeId: emp1Id,
      workDate: '2026-12-01',
      clientId,
      projectId,
      designationId: desId,
      dayType: 'regular_workday',
      actualHours: 8.0,
      regularHours: 8.0,
      otHours: 0.0,
      isAbsent: false,
      isOnLeave: false,
      hasAnomaly: false,
    });

    const decDraft = await InvoiceService.generateInvoice({
      clientId,
      projectId,
      billingPeriod: decPeriod,
    });
    expect(decDraft.status).toBe('draft');

    // Reject it
    const rejected = await InvoiceService.rejectInvoice(
      decDraft.id,
      'Incorrect timesheet hours for December',
      testUserId,
    );
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectionReason).toBe('Incorrect timesheet hours for December');
    expect(rejected.rejectedBy).toBe(testUserId);

    // REJECTED -> ISSUE MUST FAIL
    await expect(InvoiceService.issueInvoice(rejected.id)).rejects.toThrow(
      /is REJECTED and cannot be issued/,
    );

    // REJECTED -> APPROVE MUST FAIL
    await expect(InvoiceService.approveInvoice(rejected.id)).rejects.toThrow(
      /Cannot approve a rejected invoice/,
    );

    // Clean up Dec records
    await recDec.destroy();
    await InvoiceLine.destroy({ where: { invoiceId: decDraft.id } });
    await decDraft.destroy();
  });

  it('Step 12: getInvoiceById returns structured Annexure breakdown and workforce count', async () => {
    const inv = await Invoice.findOne({ where: { clientId, projectId, billingPeriod } });
    const full = await InvoiceService.getInvoiceById(inv!.id);

    expect(full.workforceCount).toBe(1);
    expect(full.totalRegularHours).toBe(160);
    expect(full.totalOtHours).toBe(20);
    expect(full.annexureItems).toBeDefined();
    expect(full.annexureItems.length).toBe(1);

    const item = full.annexureItems[0];
    expect(item.employeeId).toBe(emp1Id);
    expect(item.employeeName).toBe('Ahmed Hassan');
    expect(item.regularHours).toBe(160);
    expect(item.otHours).toBe(20);
    expect(item.totalAmount).toBe(11400);
  });
});
