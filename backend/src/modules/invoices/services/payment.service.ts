import { Op, Transaction } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { AppError } from '../../../core/errors/app-error';
import { AuditService } from '../../../core/audit/audit.service';
import { Client } from '../../masters/models/client.model';
import { Project } from '../../masters/models/project.model';
import { User } from '../../auth/models/user.model';
import { Invoice } from '../models/invoice.model';
import { ClientPayment } from '../models/client-payment.model';
import { InvoicePaymentAllocation } from '../models/invoice-payment-allocation.model';
import {
  RecordPaymentDto,
  ReversePaymentDto,
  PaymentDto,
  PaymentAllocationDto,
  InvoicePaymentStatus,
  InvoicePaymentSummaryDto,
  ReceivableInvoiceDto,
  ReceivablesSummaryDto,
  ReceivablesListResponseDto,
  ClientPaymentSummaryDto,
} from '@blue-royal/contracts';

export class PaymentService {
  /**
   * Helper: Round monetary amounts safely to 2 decimal places.
   */
  public static round2(val: number | string): number {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return 0;
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  /**
   * Helper: Convert monetary amount to integer cents to avoid floating-point drift.
   */
  public static toCents(val: number | string): number {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return 0;
    return Math.round((num + Number.EPSILON) * 100);
  }

  /**
   * Helper: Convert integer cents back to 2-decimal rounded number.
   */
  public static fromCents(cents: number): number {
    return Math.round(cents) / 100;
  }

  /**
   * Authoritative calculation: Derive payment status from invoice total and paid amount.
   */
  public static derivePaymentStatus(
    totalAmount: number | string,
    paidAmount: number | string,
  ): InvoicePaymentStatus {
    const totalCents = this.toCents(totalAmount);
    const paidCents = this.toCents(paidAmount);

    if (paidCents <= 0) {
      return 'UNPAID';
    }
    if (paidCents < totalCents) {
      return 'PARTIALLY_PAID';
    }
    return 'PAID';
  }

  /**
   * Record a client payment and allocate it atomically against an issued invoice.
   * Utilizes database row locking (t.LOCK.UPDATE) on the invoice to eliminate concurrency race conditions.
   */
  public static async recordPayment(
    dto: RecordPaymentDto,
    actorId: string,
    actorIp?: string,
    actorUserAgent?: string,
  ): Promise<PaymentDto> {
    return await sequelize.transaction(async (t: Transaction) => {
      // 1. Validate Client
      const client = await Client.findByPk(dto.clientId, { transaction: t });
      if (!client) {
        throw AppError.notFound(`Client with ID ${dto.clientId} not found`);
      }

      // 2. Lock & Validate Invoice row
      const invoice = await Invoice.findByPk(dto.invoiceId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!invoice) {
        throw AppError.notFound(`Invoice with ID ${dto.invoiceId} not found`);
      }

      if (invoice.clientId !== client.id) {
        throw AppError.badRequest(
          `Invoice ${invoice.invoiceNumber} does not belong to Client '${client.name}'.`,
        );
      }

      // 3. Strict Invoice Status Gate: Only ISSUED invoices can receive payments
      if (invoice.status === 'draft') {
        throw AppError.badRequest(
          `Cannot record payment against DRAFT invoice ${invoice.invoiceNumber}. Approval and issuance are required first.`,
        );
      }
      if (invoice.status === 'approved') {
        throw AppError.badRequest(
          `Cannot record payment against APPROVED invoice ${invoice.invoiceNumber}. Invoice must be issued before receiving payments.`,
        );
      }
      if (invoice.status === 'rejected') {
        throw AppError.badRequest(
          `Cannot record payment against REJECTED invoice ${invoice.invoiceNumber}.`,
        );
      }
      if (invoice.status !== 'issued') {
        throw AppError.badRequest(
          `Cannot record payment against invoice ${invoice.invoiceNumber} with status '${invoice.status}'. Only ISSUED invoices can receive payments.`,
        );
      }

      // 4. Validate Payment Amount
      const paymentAmount = this.round2(dto.amount);
      if (paymentAmount <= 0) {
        throw AppError.badRequest('Payment amount must be greater than 0.');
      }
      const paymentCents = this.toCents(paymentAmount);

      // 5. Reasonable Duplicate Payment Check (client + reference + amount)
      if (dto.referenceNumber && dto.referenceNumber.trim()) {
        const trimmedRef = dto.referenceNumber.trim();
        const existingDuplicate = await ClientPayment.findOne({
          where: {
            clientId: client.id,
            referenceNumber: trimmedRef,
            amount: paymentAmount,
            status: 'RECORDED',
          },
          transaction: t,
        });

        if (existingDuplicate) {
          throw AppError.conflict(
            `A payment with reference "${trimmedRef}" and amount AED ${paymentAmount.toFixed(
              2,
            )} has already been recorded for this client (${existingDuplicate.paymentNumber}).`,
          );
        }
      }

      // 6. Authoritative Paid & Outstanding Balance Calculation
      const activeAllocations = await InvoicePaymentAllocation.findAll({
        where: { invoiceId: invoice.id },
        include: [
          {
            model: ClientPayment,
            as: 'payment',
            where: { status: 'RECORDED' },
            required: true,
          },
        ],
        transaction: t,
      });

      const currentPaidCents = activeAllocations.reduce(
        (sum, a) => sum + this.toCents(a.allocatedAmount),
        0,
      );
      const invoiceTotalCents = this.toCents(invoice.totalAmount);
      const currentOutstandingCents = Math.max(0, invoiceTotalCents - currentPaidCents);

      if (currentOutstandingCents <= 0) {
        throw AppError.badRequest(
          `Invoice ${invoice.invoiceNumber} is already fully paid (Total: AED ${this.fromCents(
            invoiceTotalCents,
          ).toFixed(2)}, Paid: AED ${this.fromCents(currentPaidCents).toFixed(2)}).`,
        );
      }

      if (paymentCents > currentOutstandingCents) {
        const outstandingFormatted = this.fromCents(currentOutstandingCents).toFixed(2);
        const requestedFormatted = paymentAmount.toFixed(2);
        throw AppError.badRequest(
          `Payment amount (AED ${requestedFormatted}) exceeds the invoice outstanding balance of AED ${outstandingFormatted}. Overpayments are strictly prohibited.`,
        );
      }

      // 7. Generate Sequential Payment Number
      const year = parseInt(dto.paymentDate.slice(0, 4), 10);
      const month = parseInt(dto.paymentDate.slice(5, 7), 10);
      const startOfMonth = `${dto.paymentDate.slice(0, 7)}-01`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const startOfNextMonth = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

      const count = await ClientPayment.count({
        where: {
          paymentDate: {
            [Op.gte]: startOfMonth,
            [Op.lt]: startOfNextMonth,
          },
        },
        transaction: t,
      });

      const prefix = `PAY-${dto.paymentDate.slice(0, 7)}`;
      let seq = count + 1;
      let paymentNumber = `${prefix}-${String(seq).padStart(4, '0')}`;
      while (await ClientPayment.findOne({ where: { paymentNumber }, transaction: t })) {
        seq++;
        paymentNumber = `${prefix}-${String(seq).padStart(4, '0')}`;
      }

      // 8. Create ClientPayment record
      const payment = await ClientPayment.create(
        {
          paymentNumber,
          clientId: client.id,
          paymentDate: dto.paymentDate,
          amount: paymentAmount,
          currency: invoice.currency || 'AED',
          paymentMethod: dto.paymentMethod,
          referenceNumber: dto.referenceNumber?.trim() || null,
          notes: dto.notes?.trim() || null,
          status: 'RECORDED',
          recordedBy: actorId,
        },
        { transaction: t },
      );

      // 9. Create InvoicePaymentAllocation record
      const allocation = await InvoicePaymentAllocation.create(
        {
          paymentId: payment.id,
          invoiceId: invoice.id,
          allocatedAmount: paymentAmount,
          createdBy: actorId,
        },
        { transaction: t },
      );

      const newPaidCents = currentPaidCents + paymentCents;
      const newOutstandingCents = Math.max(0, invoiceTotalCents - newPaidCents);
      const newPaymentStatus = this.derivePaymentStatus(invoiceTotalCents, newPaidCents);

      // 10. Audit Logging inside the same transaction
      await AuditService.recordEvent({
        actorId,
        actorIp,
        actorUserAgent,
        action: 'PAYMENT_RECORDED',
        resourceType: 'ClientPayment',
        resourceId: payment.id,
        newValues: {
          paymentNumber: payment.paymentNumber,
          clientId: client.id,
          clientName: client.name,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: paymentAmount,
          paymentMethod: payment.paymentMethod,
          referenceNumber: payment.referenceNumber,
          status: payment.status,
          invoiceTotal: this.fromCents(invoiceTotalCents),
          previousPaid: this.fromCents(currentPaidCents),
          newPaid: this.fromCents(newPaidCents),
          newOutstanding: this.fromCents(newOutstandingCents),
          paymentStatus: newPaymentStatus,
        },
        transaction: t,
      });

      await AuditService.recordEvent({
        actorId,
        actorIp,
        actorUserAgent,
        action: 'PAYMENT_ALLOCATED',
        resourceType: 'InvoicePaymentAllocation',
        resourceId: allocation.id,
        newValues: {
          paymentId: payment.id,
          paymentNumber: payment.paymentNumber,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          allocatedAmount: paymentAmount,
        },
        transaction: t,
      });

      // 11. Format and return PaymentDto
      const actorUser = await User.findByPk(actorId, { transaction: t });
      const actorName = actorUser ? `${actorUser.firstName} ${actorUser.lastName}`.trim() : 'System';

      return {
        id: payment.id,
        paymentNumber: payment.paymentNumber,
        clientId: client.id,
        clientName: client.name,
        paymentDate: payment.paymentDate,
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.paymentMethod as any,
        referenceNumber: payment.referenceNumber,
        notes: payment.notes,
        status: payment.status as any,
        recordedBy: payment.recordedBy,
        recordedByName: actorName,
        recordedAt: payment.createdAt.toISOString(),
        reversedAt: null,
        reversedBy: null,
        reversedByName: null,
        reversalReason: null,
        allocations: [
          {
            id: allocation.id,
            paymentId: payment.id,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            allocatedAmount: allocation.allocatedAmount,
            createdBy: actorId,
            createdByName: actorName,
            createdAt: allocation.createdAt.toISOString(),
            updatedAt: allocation.updatedAt.toISOString(),
          },
        ],
        createdAt: payment.createdAt.toISOString(),
        updatedAt: payment.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Reverse an existing payment record non-destructively.
   * Tracks actor, timestamp, and mandatory reason, and dynamically restores invoice outstanding balance.
   */
  public static async reversePayment(
    paymentId: string,
    dto: ReversePaymentDto,
    actorId: string,
    actorIp?: string,
    actorUserAgent?: string,
  ): Promise<PaymentDto> {
    return await sequelize.transaction(async (t: Transaction) => {
      const payment = await ClientPayment.findByPk(paymentId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!payment) {
        throw AppError.notFound(`Payment with ID ${paymentId} not found`);
      }

      if (payment.status === 'REVERSED') {
        throw AppError.badRequest(
          `Payment ${payment.paymentNumber} is already REVERSED on ${payment.reversedAt?.toISOString().slice(0, 10)}. A reversed payment cannot be reversed again.`,
        );
      }

      const reason = dto.reason?.trim();
      if (!reason || reason.length < 5) {
        throw AppError.badRequest('A non-empty reversal reason of at least 5 characters is required.');
      }

      payment.status = 'REVERSED';
      payment.reversedAt = new Date();
      payment.reversedBy = actorId;
      payment.reversalReason = reason;
      await payment.save({ transaction: t });

      const actorUser = await User.findByPk(actorId, { transaction: t });
      const actorName = actorUser ? `${actorUser.firstName} ${actorUser.lastName}`.trim() : 'System';

      // Audit Reversal
      await AuditService.recordEvent({
        actorId,
        actorIp,
        actorUserAgent,
        action: 'PAYMENT_REVERSED',
        resourceType: 'ClientPayment',
        resourceId: payment.id,
        oldValues: {
          status: 'RECORDED',
        },
        newValues: {
          status: 'REVERSED',
          paymentNumber: payment.paymentNumber,
          amount: payment.amount,
          reversedAt: payment.reversedAt,
          reversedBy: actorId,
          reversalReason: reason,
        },
        transaction: t,
      });

      const client = await Client.findByPk(payment.clientId, { transaction: t });
      const allocations = await InvoicePaymentAllocation.findAll({
        where: { paymentId: payment.id },
        include: [{ model: Invoice, as: 'invoice' }],
        transaction: t,
      });
      const recordedByUser = await User.findByPk(payment.recordedBy, { transaction: t });
      const recordedByName = recordedByUser
        ? `${recordedByUser.firstName} ${recordedByUser.lastName}`.trim()
        : undefined;

      return {
        id: payment.id,
        paymentNumber: payment.paymentNumber,
        clientId: payment.clientId,
        clientName: client?.name,
        paymentDate: payment.paymentDate,
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.paymentMethod as any,
        referenceNumber: payment.referenceNumber,
        notes: payment.notes,
        status: 'REVERSED',
        recordedBy: payment.recordedBy,
        recordedByName,
        recordedAt: payment.createdAt.toISOString(),
        reversedAt: payment.reversedAt.toISOString(),
        reversedBy: actorId,
        reversedByName: actorName,
        reversalReason: reason,
        allocations: allocations.map((a) => ({
          id: a.id,
          paymentId: a.paymentId,
          invoiceId: a.invoiceId,
          invoiceNumber: (a as any).invoice?.invoiceNumber,
          allocatedAmount: a.allocatedAmount,
          createdBy: a.createdBy,
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
        })),
        createdAt: payment.createdAt.toISOString(),
        updatedAt: payment.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Get complete payment summary and history for a given invoice.
   */
  public static async getInvoicePaymentSummary(invoiceId: string): Promise<InvoicePaymentSummaryDto> {
    const invoice = await Invoice.findByPk(invoiceId, {
      include: [{ model: Client, as: 'client' }],
    });

    if (!invoice) {
      throw AppError.notFound(`Invoice with ID ${invoiceId} not found`);
    }

    // Fetch all allocations for this invoice
    const allocations = await InvoicePaymentAllocation.findAll({
      where: { invoiceId },
      include: [
        {
          model: ClientPayment,
          as: 'payment',
          include: [
            { model: User, as: 'recordedByUser' },
            { model: User, as: 'reversedByUser' },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    let activePaidCents = 0;
    const paymentMap = new Map<string, PaymentDto>();

    for (const alloc of allocations) {
      const p = alloc.payment;
      if (!p) continue;

      if (p.status === 'RECORDED') {
        activePaidCents += this.toCents(alloc.allocatedAmount);
      }

      if (!paymentMap.has(p.id)) {
        const recordedByName = p.recordedByUser
          ? `${p.recordedByUser.firstName} ${p.recordedByUser.lastName}`.trim()
          : undefined;
        const reversedByName = p.reversedByUser
          ? `${p.reversedByUser.firstName} ${p.reversedByUser.lastName}`.trim()
          : undefined;

        paymentMap.set(p.id, {
          id: p.id,
          paymentNumber: p.paymentNumber,
          clientId: p.clientId,
          clientName: invoice.client?.name,
          paymentDate: p.paymentDate,
          amount: p.amount,
          currency: p.currency,
          paymentMethod: p.paymentMethod as any,
          referenceNumber: p.referenceNumber,
          notes: p.notes,
          status: p.status as any,
          recordedBy: p.recordedBy,
          recordedByName,
          recordedAt: p.createdAt.toISOString(),
          reversedAt: p.reversedAt ? p.reversedAt.toISOString() : null,
          reversedBy: p.reversedBy,
          reversedByName,
          reversalReason: p.reversalReason,
          allocations: [],
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        });
      }

      const pDto = paymentMap.get(p.id)!;
      pDto.allocations?.push({
        id: alloc.id,
        paymentId: alloc.paymentId,
        invoiceId: alloc.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        allocatedAmount: alloc.allocatedAmount,
        createdBy: alloc.createdBy,
        createdAt: alloc.createdAt.toISOString(),
        updatedAt: alloc.updatedAt.toISOString(),
      });
    }

    const invoiceTotalCents = this.toCents(invoice.totalAmount);
    const outstandingCents = Math.max(0, invoiceTotalCents - activePaidCents);
    const paymentStatus = this.derivePaymentStatus(invoiceTotalCents, activePaidCents);

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientId: invoice.clientId,
      clientName: invoice.client?.name || '—',
      invoiceTotal: this.fromCents(invoiceTotalCents),
      paid: this.fromCents(activePaidCents),
      outstanding: this.fromCents(outstandingCents),
      paymentStatus,
      currency: invoice.currency || 'AED',
      dueDate: invoice.dueDate || null,
      payments: Array.from(paymentMap.values()),
    };
  }

  /**
   * List receivables ledger and compute authoritative KPI metrics.
   * STRICT DUE DATE RULES:
   * - No hardcoded +30 days.
   * - If due_date is null, isOverdue = false and daysOverdue = null.
   * - Overdue when: status = 'issued' AND outstanding > 0 AND due_date IS NOT NULL AND due_date < today.
   */
  public static async listReceivables(filters?: {
    clientId?: string;
    projectId?: string;
    paymentStatus?: string;
  }): Promise<ReceivablesListResponseDto> {
    const where: any = { status: 'issued' };
    if (filters?.clientId) where.clientId = filters.clientId;
    if (filters?.projectId) where.projectId = filters.projectId;

    const invoices = await Invoice.findAll({
      where,
      include: [
        { model: Client, as: 'client' },
        { model: Project, as: 'project' },
        {
          model: InvoicePaymentAllocation,
          as: 'allocations',
          include: [
            {
              model: ClientPayment,
              as: 'payment',
              where: { status: 'RECORDED' },
              required: false,
            },
          ],
        },
      ],
      order: [['invoiceDate', 'DESC']],
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTime = new Date(`${todayStr}T00:00:00Z`).getTime();
    const currentMonthPrefix = todayStr.slice(0, 7); // e.g. "2026-09"

    let totalOutstandingCents = 0;
    let overdueCents = 0;
    let partiallyPaidCount = 0;
    let dueThisMonthCents = 0;

    const receivableItems: ReceivableInvoiceDto[] = [];

    for (const inv of invoices) {
      // Calculate paid strictly from valid (non-reversed) allocations
      const activeAllocs = (inv.allocations || []).filter((a) => a.payment && a.payment.status === 'RECORDED');
      const paidCents = activeAllocs.reduce((sum, a) => sum + this.toCents(a.allocatedAmount), 0);
      const totalCents = this.toCents(inv.totalAmount);
      const outstandingCents = Math.max(0, totalCents - paidCents);
      const paymentStatus = this.derivePaymentStatus(totalCents, paidCents);

      // Overdue determination strictly according to business rule
      let isOverdue = false;
      let daysOverdue: number | null = null;

      if (inv.dueDate && outstandingCents > 0) {
        const dueTime = new Date(`${inv.dueDate}T00:00:00Z`).getTime();
        if (dueTime < todayTime) {
          isOverdue = true;
          daysOverdue = Math.max(1, Math.floor((todayTime - dueTime) / (1000 * 60 * 60 * 24)));
        }
      }

      // Check if due in the current month
      const isDueThisMonth = inv.dueDate && inv.dueDate.startsWith(currentMonthPrefix) && outstandingCents > 0;

      // Accumulate KPIs across all issued invoices
      totalOutstandingCents += outstandingCents;
      if (isOverdue) {
        overdueCents += outstandingCents;
      }
      if (paymentStatus === 'PARTIALLY_PAID') {
        partiallyPaidCount++;
      }
      if (isDueThisMonth) {
        dueThisMonthCents += outstandingCents;
      }

      // Filter by paymentStatus if specified
      if (filters?.paymentStatus && filters.paymentStatus !== 'all') {
        if (filters.paymentStatus === 'OVERDUE') {
          if (!isOverdue) continue;
        } else if (paymentStatus !== filters.paymentStatus) {
          continue;
        }
      }

      receivableItems.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientId: inv.clientId,
        clientName: inv.client?.name || '—',
        projectId: inv.projectId,
        projectName: inv.project?.name || '—',
        billingPeriod: inv.billingPeriod,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate || null,
        invoiceTotal: this.fromCents(totalCents),
        paid: this.fromCents(paidCents),
        outstanding: this.fromCents(outstandingCents),
        paymentStatus,
        isOverdue,
        daysOverdue,
        currency: inv.currency || 'AED',
      });
    }

    const summary: ReceivablesSummaryDto = {
      totalOutstanding: this.fromCents(totalOutstandingCents),
      overdueAmount: this.fromCents(overdueCents),
      partiallyPaidCount,
      dueThisMonthAmount: this.fromCents(dueThisMonthCents),
      totalReceivablesCount: receivableItems.length,
    };

    return {
      summary,
      items: receivableItems,
    };
  }

  /**
   * Get client financial summary (Total Invoiced, Total Paid, Outstanding).
   */
  public static async getClientFinancialSummary(clientId: string): Promise<ClientPaymentSummaryDto> {
    const client = await Client.findByPk(clientId);
    if (!client) {
      throw AppError.notFound(`Client with ID ${clientId} not found`);
    }

    const issuedInvoices = await Invoice.findAll({
      where: { clientId, status: 'issued' },
      include: [
        {
          model: InvoicePaymentAllocation,
          as: 'allocations',
          include: [
            {
              model: ClientPayment,
              as: 'payment',
              where: { status: 'RECORDED' },
              required: false,
            },
          ],
        },
      ],
    });

    let totalInvoicedCents = 0;
    let totalPaidCents = 0;

    for (const inv of issuedInvoices) {
      totalInvoicedCents += this.toCents(inv.totalAmount);
      const activeAllocs = (inv.allocations || []).filter((a) => a.payment && a.payment.status === 'RECORDED');
      for (const a of activeAllocs) {
        totalPaidCents += this.toCents(a.allocatedAmount);
      }
    }

    const outstandingCents = Math.max(0, totalInvoicedCents - totalPaidCents);

    return {
      clientId: client.id,
      clientName: client.name,
      totalInvoiced: this.fromCents(totalInvoicedCents),
      totalPaid: this.fromCents(totalPaidCents),
      outstanding: this.fromCents(outstandingCents),
    };
  }

  /**
   * List client payments with optional client and status filters.
   */
  public static async listPayments(filters?: {
    clientId?: string;
    status?: string;
  }): Promise<{ items: PaymentDto[]; total: number }> {
    const where: any = {};
    if (filters?.clientId) where.clientId = filters.clientId;
    if (filters?.status && filters.status !== 'all') where.status = filters.status;

    const payments = await ClientPayment.findAll({
      where,
      include: [
        { model: Client, as: 'client' },
        { model: User, as: 'recordedByUser' },
        { model: User, as: 'reversedByUser' },
        {
          model: InvoicePaymentAllocation,
          as: 'allocations',
          include: [{ model: Invoice, as: 'invoice' }],
        },
      ],
      order: [['paymentDate', 'DESC'], ['createdAt', 'DESC']],
    });

    const items: PaymentDto[] = payments.map((p) => {
      const recordedByName = p.recordedByUser
        ? `${p.recordedByUser.firstName} ${p.recordedByUser.lastName}`.trim()
        : undefined;
      const reversedByName = p.reversedByUser
        ? `${p.reversedByUser.firstName} ${p.reversedByUser.lastName}`.trim()
        : undefined;

      return {
        id: p.id,
        paymentNumber: p.paymentNumber,
        clientId: p.clientId,
        clientName: p.client?.name,
        paymentDate: p.paymentDate,
        amount: p.amount,
        currency: p.currency,
        paymentMethod: p.paymentMethod as any,
        referenceNumber: p.referenceNumber,
        notes: p.notes,
        status: p.status as any,
        recordedBy: p.recordedBy,
        recordedByName,
        recordedAt: p.createdAt.toISOString(),
        reversedAt: p.reversedAt ? p.reversedAt.toISOString() : null,
        reversedBy: p.reversedBy,
        reversedByName,
        reversalReason: p.reversalReason,
        allocations: (p.allocations || []).map((a) => ({
          id: a.id,
          paymentId: a.paymentId,
          invoiceId: a.invoiceId,
          invoiceNumber: (a as any).invoice?.invoiceNumber,
          allocatedAmount: a.allocatedAmount,
          createdBy: a.createdBy,
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
        })),
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      };
    });

    return { items, total: items.length };
  }

  /**
   * Get single payment record by ID.
   */
  public static async getPaymentById(id: string): Promise<PaymentDto> {
    const payment = await ClientPayment.findByPk(id, {
      include: [
        { model: Client, as: 'client' },
        { model: User, as: 'recordedByUser' },
        { model: User, as: 'reversedByUser' },
        {
          model: InvoicePaymentAllocation,
          as: 'allocations',
          include: [{ model: Invoice, as: 'invoice' }],
        },
      ],
    });

    if (!payment) {
      throw AppError.notFound(`Payment with ID ${id} not found`);
    }

    const recordedByName = payment.recordedByUser
      ? `${payment.recordedByUser.firstName} ${payment.recordedByUser.lastName}`.trim()
      : undefined;
    const reversedByName = payment.reversedByUser
      ? `${payment.reversedByUser.firstName} ${payment.reversedByUser.lastName}`.trim()
      : undefined;

    return {
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      clientId: payment.clientId,
      clientName: payment.client?.name,
      paymentDate: payment.paymentDate,
      amount: payment.amount,
      currency: payment.currency,
      paymentMethod: payment.paymentMethod as any,
      referenceNumber: payment.referenceNumber,
      notes: payment.notes,
      status: payment.status as any,
      recordedBy: payment.recordedBy,
      recordedByName,
      recordedAt: payment.createdAt.toISOString(),
      reversedAt: payment.reversedAt ? payment.reversedAt.toISOString() : null,
      reversedBy: payment.reversedBy,
      reversedByName,
      reversalReason: payment.reversalReason,
      allocations: (payment.allocations || []).map((a) => ({
        id: a.id,
        paymentId: a.paymentId,
        invoiceId: a.invoiceId,
        invoiceNumber: (a as any).invoice?.invoiceNumber,
        allocatedAmount: a.allocatedAmount,
        createdBy: a.createdBy,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    };
  }
}
