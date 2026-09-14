import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/core/database/sequelize';
import { env } from '../../src/config/env';
import { User } from '../../src/modules/auth/models/user.model';
import { Role } from '../../src/modules/auth/models/role.model';
import { Client } from '../../src/modules/masters/models/client.model';
import { Project } from '../../src/modules/masters/models/project.model';
import { Invoice } from '../../src/modules/invoices/models/invoice.model';
import { ClientPayment } from '../../src/modules/invoices/models/client-payment.model';
import { InvoicePaymentAllocation } from '../../src/modules/invoices/models/invoice-payment-allocation.model';
import { PaymentService } from '../../src/modules/invoices/services/payment.service';
import { AuditLog } from '../../src/modules/auth/models/audit-log.model';

describe('Client Payments & Receivables Foundation Integration Tests', () => {
  const app = createApp();
  let superAdminToken: string;
  let hrAdminToken: string;
  let employeeToken: string;

  let superAdminUser: User;
  let hrAdminUser: User;
  let employeeUser: User;

  let testClient: Client;
  let testProject: Project;

  let issuedInvoice: Invoice;
  let draftInvoice: Invoice;
  let approvedInvoice: Invoice;
  let rejectedInvoice: Invoice;

  const ts = Date.now();

  beforeAll(async () => {
    await sequelize.authenticate();

    // 1. Locate/Identify Super Admin User
    const sa = await User.findOne({
      include: [{ model: Role, as: 'roles', where: { name: 'super_admin' } }],
    });
    if (!sa) throw new Error('Super Admin user not found');
    superAdminUser = sa;
    superAdminToken = jwt.sign(
      { userId: sa.id, email: sa.email, roles: ['super_admin'] },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' },
    );

    // 2. Locate/Identify HR Admin User
    const hr = await User.findOne({
      include: [{ model: Role, as: 'roles', where: { name: 'hr_admin' } }],
    });
    if (!hr) throw new Error('HR Admin user not found');
    hrAdminUser = hr;
    hrAdminToken = jwt.sign(
      { userId: hr.id, email: hr.email, roles: ['hr_admin'] },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' },
    );

    // 3. Locate/Identify Employee User
    let emp = await User.findOne({
      include: [{ model: Role, as: 'roles', where: { name: 'employee' } }],
    });
    if (!emp) {
      // Find employee role to associate if needed
      const empRole = await Role.findOne({ where: { name: 'employee' } });
      emp = await User.create({
        email: `emp.test.${ts}@blueroyal.com`,
        passwordHash: 'dummyhash',
        firstName: 'Test',
        lastName: 'Employee',
        isActive: true,
      });
      if (empRole) {
        await (emp as any).addRole(empRole);
      }
    }
    employeeUser = emp;
    employeeToken = jwt.sign(
      { userId: emp.id, email: emp.email, roles: ['employee'] },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' },
    );

    // 4. Create isolated Test Client & Project
    testClient = await Client.create({
      code: `CLI-PAY-${ts}`,
      name: `Payment Test Client ${ts}`,
      isActive: true,
    });

    testProject = await Project.create({
      clientId: testClient.id,
      code: `PRJ-PAY-${ts}`,
      name: `Payment Test Project ${ts}`,
      status: 'active',
    });

    // 5. Create Test Invoices across distinct lifecycle statuses
    issuedInvoice = await Invoice.create({
      invoiceNumber: `INV-PAY-ISSUED-${ts}`,
      clientId: testClient.id,
      projectId: testProject.id,
      billingPeriod: '2026-09',
      invoiceDate: '2026-09-01',
      dueDate: null, // Null due date test
      status: 'issued',
      subtotal: 10000,
      taxAmount: 0,
      totalAmount: 10000,
      currency: 'AED',
      issuedAt: new Date(),
      issuedBy: superAdminUser.id,
    });

    draftInvoice = await Invoice.create({
      invoiceNumber: `INV-PAY-DRAFT-${ts}`,
      clientId: testClient.id,
      projectId: testProject.id,
      billingPeriod: '2026-09',
      invoiceDate: '2026-09-01',
      status: 'draft',
      subtotal: 5000,
      taxAmount: 0,
      totalAmount: 5000,
      currency: 'AED',
    });

    approvedInvoice = await Invoice.create({
      invoiceNumber: `INV-PAY-APPROVED-${ts}`,
      clientId: testClient.id,
      projectId: testProject.id,
      billingPeriod: '2026-09',
      invoiceDate: '2026-09-01',
      status: 'approved',
      subtotal: 7500,
      taxAmount: 0,
      totalAmount: 7500,
      currency: 'AED',
      approvedAt: new Date(),
      approvedBy: superAdminUser.id,
    });

    rejectedInvoice = await Invoice.create({
      invoiceNumber: `INV-PAY-REJECTED-${ts}`,
      clientId: testClient.id,
      projectId: testProject.id,
      billingPeriod: '2026-09',
      invoiceDate: '2026-09-01',
      status: 'rejected',
      subtotal: 4000,
      taxAmount: 0,
      totalAmount: 4000,
      currency: 'AED',
      rejectedAt: new Date(),
      rejectedBy: superAdminUser.id,
      rejectionReason: 'Invalid billing period',
    });
  });

  afterAll(async () => {
    // Clean up created payment test records
    await InvoicePaymentAllocation.destroy({ where: {} });
    await ClientPayment.destroy({ where: {} });
    await Invoice.destroy({ where: { clientId: testClient.id } });
    await Project.destroy({ where: { id: testProject.id } });
    await Client.destroy({ where: { id: testClient.id } });
  });

  // ==========================================
  // SECTION A: RBAC VERIFICATION
  // ==========================================
  describe('A. RBAC Permissions Enforcement', () => {
    it('1. Employee role receives 403 FORBIDDEN when attempting to read payments', async () => {
      const res = await request(app)
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('2. Employee role receives 403 FORBIDDEN when attempting to record payment', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          clientId: testClient.id,
          invoiceId: issuedInvoice.id,
          paymentDate: '2026-09-10',
          amount: 1000,
          paymentMethod: 'BANK_TRANSFER',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('3. Employee role receives 403 FORBIDDEN when attempting to read receivables', async () => {
      const res = await request(app)
        .get('/api/v1/receivables')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('4. Super Admin is fully authorized to view payments and receivables', async () => {
      const resPay = await request(app)
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(resPay.status).toBe(200);

      const resRec = await request(app)
        .get('/api/v1/receivables')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(resRec.status).toBe(200);
      expect(resRec.body.data.summary).toBeDefined();
    });

    it('5. HR Admin is fully authorized to view payments and receivables', async () => {
      const resPay = await request(app)
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${hrAdminToken}`);
      expect(resPay.status).toBe(200);

      const resRec = await request(app)
        .get('/api/v1/receivables')
        .set('Authorization', `Bearer ${hrAdminToken}`);
      expect(resRec.status).toBe(200);
      expect(resRec.body.data.summary).toBeDefined();
    });
  });

  // ==========================================
  // SECTION B: INVOICE STATUS GATE
  // ==========================================
  describe('B. Strict Invoice Status Gate', () => {
    it('1. Recording payment against DRAFT invoice must be REJECTED with 400', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          clientId: testClient.id,
          invoiceId: draftInvoice.id,
          paymentDate: '2026-09-10',
          amount: 1000,
          paymentMethod: 'BANK_TRANSFER',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Cannot record payment against DRAFT invoice');
    });

    it('2. Recording payment against APPROVED invoice must be REJECTED with 400', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          clientId: testClient.id,
          invoiceId: approvedInvoice.id,
          paymentDate: '2026-09-10',
          amount: 1000,
          paymentMethod: 'CHEQUE',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Cannot record payment against APPROVED invoice');
    });

    it('3. Recording payment against REJECTED invoice must be REJECTED with 400', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          clientId: testClient.id,
          invoiceId: rejectedInvoice.id,
          paymentDate: '2026-09-10',
          amount: 1000,
          paymentMethod: 'CASH',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Cannot record payment against REJECTED invoice');
    });

    it('4. Recording payment against ISSUED invoice succeeds', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          clientId: testClient.id,
          invoiceId: issuedInvoice.id,
          paymentDate: '2026-09-10',
          amount: 2500,
          paymentMethod: 'BANK_TRANSFER',
          referenceNumber: `TXN-INIT-${ts}`,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.paymentNumber).toMatch(/^PAY-\d{4}-\d{2}-\d{4}$/);
      expect(Number(res.body.data.amount)).toBe(2500);
    });
  });

  // ==========================================
  // SECTION C: CALCULATIONS & OVERPAYMENT
  // ==========================================
  describe('C. Authoritative Calculations & Payment Status Transitions', () => {
    let secondIssuedInvoice: Invoice;

    beforeAll(async () => {
      secondIssuedInvoice = await Invoice.create({
        invoiceNumber: `INV-PAY-CALC-${ts}`,
        clientId: testClient.id,
        projectId: testProject.id,
        billingPeriod: '2026-09',
        invoiceDate: '2026-09-05',
        dueDate: '2026-09-25',
        status: 'issued',
        subtotal: 5000,
        taxAmount: 0,
        totalAmount: 5000,
        currency: 'AED',
        issuedAt: new Date(),
        issuedBy: superAdminUser.id,
      });
    });

    it('1. Untouched issued invoice has paid = 0, outstanding = total, and status = UNPAID', async () => {
      const summary = await PaymentService.getInvoicePaymentSummary(secondIssuedInvoice.id);
      expect(summary.paid).toBe(0);
      expect(summary.outstanding).toBe(5000);
      expect(summary.paymentStatus).toBe('UNPAID');
    });

    it('2. Overpayment attempt exceeding total is strictly REJECTED with 400', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${hrAdminToken}`)
        .send({
          clientId: testClient.id,
          invoiceId: secondIssuedInvoice.id,
          paymentDate: '2026-09-10',
          amount: 5000.01,
          paymentMethod: 'BANK_TRANSFER',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('exceeds the invoice outstanding balance');
    });

    it('3. Partial payment of AED 2,000 transitions status to PARTIALLY_PAID with outstanding AED 3,000', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${hrAdminToken}`)
        .send({
          clientId: testClient.id,
          invoiceId: secondIssuedInvoice.id,
          paymentDate: '2026-09-10',
          amount: 2000,
          paymentMethod: 'BANK_TRANSFER',
          referenceNumber: `TXN-P1-${ts}`,
        });

      expect(res.status).toBe(201);

      const summary = await PaymentService.getInvoicePaymentSummary(secondIssuedInvoice.id);
      expect(summary.paid).toBe(2000);
      expect(summary.outstanding).toBe(3000);
      expect(summary.paymentStatus).toBe('PARTIALLY_PAID');
    });

    it('4. Further overpayment exceeding remaining AED 3,000 is strictly REJECTED', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          clientId: testClient.id,
          invoiceId: secondIssuedInvoice.id,
          paymentDate: '2026-09-11',
          amount: 3000.50,
          paymentMethod: 'CHEQUE',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('exceeds the invoice outstanding balance of AED 3000.00');
    });

    it('5. Exact remaining payment of AED 3,000 transitions status to PAID with outstanding 0', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          clientId: testClient.id,
          invoiceId: secondIssuedInvoice.id,
          paymentDate: '2026-09-12',
          amount: 3000,
          paymentMethod: 'CHEQUE',
          referenceNumber: `CHQ-FINAL-${ts}`,
        });

      expect(res.status).toBe(201);

      const summary = await PaymentService.getInvoicePaymentSummary(secondIssuedInvoice.id);
      expect(summary.paid).toBe(5000);
      expect(summary.outstanding).toBe(0);
      expect(summary.paymentStatus).toBe('PAID');
    });

    it('6. Attempting to record any additional payment on a PAID invoice is REJECTED', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          clientId: testClient.id,
          invoiceId: secondIssuedInvoice.id,
          paymentDate: '2026-09-13',
          amount: 100,
          paymentMethod: 'CASH',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('already fully paid');
    });
  });

  // ==========================================
  // SECTION D: REVERSALS & AUDIT
  // ==========================================
  describe('D. Payment Reversal & Dynamic Balance Restoration', () => {
    let revInvoice: Invoice;
    let paymentToReverseId: string;

    beforeAll(async () => {
      revInvoice = await Invoice.create({
        invoiceNumber: `INV-PAY-REV-${ts}`,
        clientId: testClient.id,
        projectId: testProject.id,
        billingPeriod: '2026-09',
        invoiceDate: '2026-09-08',
        status: 'issued',
        subtotal: 6000,
        taxAmount: 0,
        totalAmount: 6000,
        currency: 'AED',
        issuedAt: new Date(),
        issuedBy: superAdminUser.id,
      });

      // Record AED 4,000 payment
      const p = await PaymentService.recordPayment(
        {
          clientId: testClient.id,
          invoiceId: revInvoice.id,
          paymentDate: '2026-09-09',
          amount: 4000,
          paymentMethod: 'BANK_TRANSFER',
          referenceNumber: `REV-TXN-${ts}`,
        },
        superAdminUser.id,
      );
      paymentToReverseId = p.id;
    });

    it('1. Before reversal, paid is AED 4,000 and outstanding is AED 2,000', async () => {
      const summary = await PaymentService.getInvoicePaymentSummary(revInvoice.id);
      expect(summary.paid).toBe(4000);
      expect(summary.outstanding).toBe(2000);
      expect(summary.paymentStatus).toBe('PARTIALLY_PAID');
    });

    it('2. Reversal without a reason or too short reason is REJECTED with 422', async () => {
      const res = await request(app)
        .post(`/api/v1/payments/${paymentToReverseId}/reverse`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: 'abc' });

      expect(res.status).toBe(422);
    });

    it('3. Reversing payment updates status to REVERSED and logs PAYMENT_REVERSED audit event', async () => {
      const res = await request(app)
        .post(`/api/v1/payments/${paymentToReverseId}/reverse`)
        .set('Authorization', `Bearer ${hrAdminToken}`)
        .send({ reason: 'Client bank bounced transfer due to account signature mismatch' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('REVERSED');
      expect(res.body.data.reversalReason).toBe('Client bank bounced transfer due to account signature mismatch');
      expect(res.body.data.reversedByName).toBeDefined();

      // Verify audit event exists
      const audit = await AuditLog.findOne({
        where: {
          action: 'PAYMENT_REVERSED',
          resourceId: paymentToReverseId,
        },
      });
      expect(audit).not.toBeNull();
      expect(audit?.actorId).toBe(hrAdminUser.id);
    });

    it('4. Reversed payment is excluded from paid amount, restoring outstanding back to AED 6,000 (UNPAID)', async () => {
      const summary = await PaymentService.getInvoicePaymentSummary(revInvoice.id);
      expect(summary.paid).toBe(0);
      expect(summary.outstanding).toBe(6000);
      expect(summary.paymentStatus).toBe('UNPAID');
    });

    it('5. Repeated reversal of already REVERSED payment is REJECTED with 400', async () => {
      const res = await request(app)
        .post(`/api/v1/payments/${paymentToReverseId}/reverse`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: 'Trying to reverse again' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('already REVERSED');
    });
  });

  // ==========================================
  // SECTION E: DUPLICATE DETECTION & CONCURRENCY
  // ==========================================
  describe('E. Duplicate Payment Protection', () => {
    let dupInvoice: Invoice;

    beforeAll(async () => {
      dupInvoice = await Invoice.create({
        invoiceNumber: `INV-PAY-DUP-${ts}`,
        clientId: testClient.id,
        projectId: testProject.id,
        billingPeriod: '2026-09',
        invoiceDate: '2026-09-08',
        status: 'issued',
        subtotal: 8000,
        taxAmount: 0,
        totalAmount: 8000,
        currency: 'AED',
        issuedAt: new Date(),
        issuedBy: superAdminUser.id,
      });

      // Record first payment with a specific reference number
      await PaymentService.recordPayment(
        {
          clientId: testClient.id,
          invoiceId: dupInvoice.id,
          paymentDate: '2026-09-09',
          amount: 1500,
          paymentMethod: 'CHEQUE',
          referenceNumber: `CHQ-DUP-TEST-${ts}`,
        },
        superAdminUser.id,
      );
    });

    it('1. Recording same client + same reference + same amount is REJECTED with 409 CONFLICT', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          clientId: testClient.id,
          invoiceId: dupInvoice.id,
          paymentDate: '2026-09-10',
          amount: 1500,
          paymentMethod: 'CHEQUE',
          referenceNumber: `CHQ-DUP-TEST-${ts}`,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('has already been recorded for this client');
    });

    it('2. Legitimate payment with same amount (AED 1,500) but different reference succeeds', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          clientId: testClient.id,
          invoiceId: dupInvoice.id,
          paymentDate: '2026-09-10',
          amount: 1500,
          paymentMethod: 'CHEQUE',
          referenceNumber: `CHQ-DIFF-REF-${ts}`,
        });

      expect(res.status).toBe(201);
    });

    it('3. Legitimate payment with same amount (AED 1,500) without reference number succeeds', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          clientId: testClient.id,
          invoiceId: dupInvoice.id,
          paymentDate: '2026-09-10',
          amount: 1500,
          paymentMethod: 'CASH',
        });

      expect(res.status).toBe(201);
    });
  });

  // ==========================================
  // SECTION F: DUE DATE & RECEIVABLES AGING
  // ==========================================
  describe('F. Due Date & Receivables Overdue Calculation', () => {
    let overdueInvoice: Invoice;
    let futureDueInvoice: Invoice;
    let nullDueInvoice: Invoice;

    beforeAll(async () => {
      // 1. Past due date + outstanding > 0 -> Overdue
      overdueInvoice = await Invoice.create({
        invoiceNumber: `INV-PAY-OVERDUE-${ts}`,
        clientId: testClient.id,
        projectId: testProject.id,
        billingPeriod: '2026-08',
        invoiceDate: '2026-08-01',
        dueDate: '2026-08-31', // definitely in the past relative to Sept 2026
        status: 'issued',
        subtotal: 3000,
        taxAmount: 0,
        totalAmount: 3000,
        currency: 'AED',
        issuedAt: new Date(),
        issuedBy: superAdminUser.id,
      });

      // 2. Future due date -> Not overdue
      futureDueInvoice = await Invoice.create({
        invoiceNumber: `INV-PAY-FUTURE-${ts}`,
        clientId: testClient.id,
        projectId: testProject.id,
        billingPeriod: '2026-09',
        invoiceDate: '2026-09-01',
        dueDate: '2026-12-31', // in the future
        status: 'issued',
        subtotal: 4000,
        taxAmount: 0,
        totalAmount: 4000,
        currency: 'AED',
        issuedAt: new Date(),
        issuedBy: superAdminUser.id,
      });

      // 3. Null due date -> Never overdue
      nullDueInvoice = await Invoice.create({
        invoiceNumber: `INV-PAY-NULLDUE-${ts}`,
        clientId: testClient.id,
        projectId: testProject.id,
        billingPeriod: '2026-09',
        invoiceDate: '2026-09-01',
        dueDate: null,
        status: 'issued',
        subtotal: 2000,
        taxAmount: 0,
        totalAmount: 2000,
        currency: 'AED',
        issuedAt: new Date(),
        issuedBy: superAdminUser.id,
      });
    });

    it('1. listReceivables accurately detects overdue invoice with daysOverdue > 0', async () => {
      const res = await request(app)
        .get(`/api/v1/receivables?clientId=${testClient.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data.items;

      const overdueItem = items.find((i: any) => i.invoiceId === overdueInvoice.id);
      expect(overdueItem).toBeDefined();
      expect(overdueItem.isOverdue).toBe(true);
      expect(overdueItem.daysOverdue).toBeGreaterThan(0);
    });

    it('2. Invoice with future due date is NOT overdue and daysOverdue is null', async () => {
      const res = await request(app)
        .get(`/api/v1/receivables?clientId=${testClient.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      const items = res.body.data.items;
      const futureItem = items.find((i: any) => i.invoiceId === futureDueInvoice.id);
      expect(futureItem).toBeDefined();
      expect(futureItem.isOverdue).toBe(false);
      expect(futureItem.daysOverdue).toBeNull();
    });

    it('3. Invoice with NULL due_date is NOT overdue, daysOverdue is null, and dueDate is null', async () => {
      const res = await request(app)
        .get(`/api/v1/receivables?clientId=${testClient.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      const items = res.body.data.items;
      const nullItem = items.find((i: any) => i.invoiceId === nullDueInvoice.id);
      expect(nullItem).toBeDefined();
      expect(nullItem.dueDate).toBeNull();
      expect(nullItem.isOverdue).toBe(false);
      expect(nullItem.daysOverdue).toBeNull();
    });

    it('4. Fully paid overdue invoice clears overdue status', async () => {
      // Pay overdue invoice in full
      await PaymentService.recordPayment(
        {
          clientId: testClient.id,
          invoiceId: overdueInvoice.id,
          paymentDate: '2026-09-12',
          amount: 3000,
          paymentMethod: 'BANK_TRANSFER',
          referenceNumber: `CLR-OVERDUE-${ts}`,
        },
        superAdminUser.id,
      );

      const res = await request(app)
        .get(`/api/v1/receivables?clientId=${testClient.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      const items = res.body.data.items;
      const clearedItem = items.find((i: any) => i.invoiceId === overdueInvoice.id);
      expect(clearedItem.outstanding).toBe(0);
      expect(clearedItem.paymentStatus).toBe('PAID');
      expect(clearedItem.isOverdue).toBe(false);
    });
  });

  // ==========================================
  // SECTION G: ZERO-DATA INTEGRITY
  // ==========================================
  describe('G. Zero Data Safety', () => {
    let emptyClient: Client;

    beforeAll(async () => {
      emptyClient = await Client.create({
        code: `CLI-EMPTY-${ts}`,
        name: `Empty Client Without Invoices ${ts}`,
        isActive: true,
      });
    });

    afterAll(async () => {
      await Client.destroy({ where: { id: emptyClient.id } });
    });

    it('1. Receivables returns clean empty collection and 0 summary values for client with zero invoices', async () => {
      const res = await request(app)
        .get(`/api/v1/receivables?clientId=${emptyClient.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.summary.totalOutstanding).toBe(0);
      expect(res.body.data.summary.overdueAmount).toBe(0);
      expect(res.body.data.summary.partiallyPaidCount).toBe(0);
      expect(res.body.data.summary.totalReceivablesCount).toBe(0);
    });

    it('2. Client financial summary returns exact 0 values without NaN', async () => {
      const res = await request(app)
        .get(`/api/v1/receivables/clients/${emptyClient.id}/summary`)
        .set('Authorization', `Bearer ${hrAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalInvoiced).toBe(0);
      expect(res.body.data.totalPaid).toBe(0);
      expect(res.body.data.outstanding).toBe(0);
      expect(isNaN(res.body.data.outstanding)).toBe(false);
    });

    it('3. Payments list returns empty array when no payments match filters', async () => {
      const res = await request(app)
        .get(`/api/v1/payments?clientId=${emptyClient.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.total).toBe(0);
    });
  });
});
