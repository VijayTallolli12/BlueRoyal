import { Op, Transaction } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { AppError } from '../../../core/errors/app-error';
import { AuditService } from '../../../core/audit/audit.service';
import { Invoice } from '../models/invoice.model';
import { InvoiceLine } from '../models/invoice-line.model';
import { ClientPayment } from '../models/client-payment.model';
import { InvoicePaymentAllocation } from '../models/invoice-payment-allocation.model';
import { Client } from '../../masters/models/client.model';
import { Project } from '../../masters/models/project.model';
import { Employee } from '../../masters/models/employee.model';
import { Designation } from '../../masters/models/designation.model';
import { User } from '../../auth/models/user.model';
import { EmployeeAssignment } from '../../masters/models/employee-assignment.model';
import { AttendanceRecord } from '../../attendance/models/attendance-record.model';
import { BillingRateResolutionService } from '../../masters/services/billing-rate-resolution.service';
import {
  GenerateInvoiceDto,
  InvoicePreviewDto,
  InvoicePreviewItemDto,
} from '@blue-royal/contracts';

export class InvoiceService {
  /**
   * Helper to round financial numbers to 2 decimal places.
   */
  public static round2(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  /**
   * Compute date range for a YYYY-MM billing period.
   */
  private static getPeriodDateRange(billingPeriod: string): { startDate: string; endDate: string; midDate: string } {
    if (!/^\d{4}-\d{2}$/.test(billingPeriod)) {
      throw AppError.badRequest('billingPeriod must follow format YYYY-MM (e.g. 2026-08)');
    }
    const [yearStr, monthStr] = billingPeriod.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const startDate = `${billingPeriod}-01`;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const endDate = `${billingPeriod}-${String(lastDay).padStart(2, '0')}`;
    const midDate = `${billingPeriod}-15`;

    return { startDate, endDate, midDate };
  }

  /**
   * Compute live preview calculation of an invoice before persistence.
   * Consumes existing authoritative Timesheet/Attendance calculations.
   */
  public static async previewInvoice(
    dto: GenerateInvoiceDto,
    transaction?: Transaction,
  ): Promise<InvoicePreviewDto> {
    const client = await Client.findByPk(dto.clientId, { transaction });
    if (!client) {
      throw AppError.notFound(`Client with ID ${dto.clientId} not found`);
    }

    const project = await Project.findByPk(dto.projectId, { transaction });
    if (!project) {
      throw AppError.notFound(`Project with ID ${dto.projectId} not found`);
    }

    if (project.clientId !== client.id) {
      throw AppError.badRequest(`Project '${project.name}' does not belong to Client '${client.name}'`);
    }

    let filterDesignationTitle: string | undefined = undefined;
    if (dto.designationId) {
      const designation = await Designation.findByPk(dto.designationId, { transaction });
      if (!designation) {
        throw AppError.notFound(`Designation with ID ${dto.designationId} not found`);
      }
      filterDesignationTitle = designation.title;

      // Strictly validate that the designation belongs to the selected project
      const hasAssignment = await EmployeeAssignment.findOne({
        where: {
          projectId: project.id,
          designationId: dto.designationId,
        },
        transaction,
      });

      if (!hasAssignment) {
        throw AppError.badRequest(
          `Designation '${designation.title}' (${designation.code}) does not belong to or have active assignments on Project '${project.name}'.`,
        );
      }
    }

    const { startDate, endDate, midDate } = this.getPeriodDateRange(dto.billingPeriod);

    // Fetch verified attendance records for this client, project, and period
    const recordWhere: any = {
      clientId: client.id,
      projectId: project.id,
      workDate: {
        [Op.gte]: startDate,
        [Op.lte]: endDate,
      },
    };
    if (dto.designationId) {
      recordWhere.designationId = dto.designationId;
    }

    const records = await AttendanceRecord.findAll({
      where: recordWhere,
      include: [
        { model: Employee, as: 'employee' },
        { model: Designation, as: 'designation' },
      ],
      order: [['workDate', 'ASC']],
      transaction,
    });

    // Group records by employee
    const empMap = new Map<string, { employee: Employee; records: AttendanceRecord[] }>();
    for (const rec of records) {
      if (!rec.employee) continue;
      if (!empMap.has(rec.employeeId)) {
        empMap.set(rec.employeeId, {
          employee: rec.employee,
          records: [],
        });
      }
      empMap.get(rec.employeeId)!.records.push(rec);
    }

    const items: InvoicePreviewItemDto[] = [];
    let totalRegularHours = 0;
    let totalOtHours = 0;
    let subtotal = 0;
    let dominantRegRate = 0;
    let dominantOtRate = 0;

    for (const [empId, data] of empMap.entries()) {
      let regHours = 0;
      let otHours = 0;

      for (const r of data.records) {
        regHours += Number(r.regularHours || 0);
        otHours += Number(r.otHours || 0);
      }

      regHours = this.round2(regHours);
      otHours = this.round2(otHours);

      // Skip employees with no billable hours in this period
      if (regHours === 0 && otHours === 0) continue;

      // Determine designation title from attendance record or active employee assignment
      let desigTitle: string | null = null;
      for (let i = data.records.length - 1; i >= 0; i--) {
        if (data.records[i]?.designation?.title) {
          desigTitle = data.records[i].designation!.title;
          break;
        }
      }

      if (!desigTitle) {
        // Fallback: check project assignment for designation
        const assignment = await EmployeeAssignment.findOne({
          where: {
            employeeId: empId,
            projectId: project.id,
            effectiveFrom: { [Op.lte]: midDate },
            [Op.or]: [
              { effectiveTo: null },
              { effectiveTo: { [Op.gte]: midDate } },
            ],
          },
          include: [{ model: Designation, as: 'designation' }],
          transaction,
        });
        if (assignment?.designation?.title) {
          desigTitle = assignment.designation.title;
        }
      }

      if (!desigTitle) {
        desigTitle = 'Worker';
      }

      // Resolve official point-in-time client billing rate
      const rateRes = await BillingRateResolutionService.resolveBillingRate(empId, midDate, transaction);
      if (rateRes.status !== 'RESOLVED' || !rateRes.normalBillingRate) {
        throw AppError.badRequest(
          `Missing client billing rate for Employee ${data.employee.employeeCode} (${data.employee.firstName} ${data.employee.lastName}) on Project '${project.name}' for Designation '${desigTitle}'. Please configure a client billing rate before generating an invoice.`,
        );
      }

      const regularRate = Number(rateRes.normalBillingRate);
      const otRate = Number(rateRes.otBillingRate || 0);

      const regularAmount = this.round2(regHours * regularRate);
      const otAmount = this.round2(otHours * otRate);
      const itemTotal = this.round2(regularAmount + otAmount);

      dominantRegRate = regularRate;
      dominantOtRate = otRate;
      totalRegularHours = this.round2(totalRegularHours + regHours);
      totalOtHours = this.round2(totalOtHours + otHours);
      subtotal = this.round2(subtotal + itemTotal);

      items.push({
        employeeId: empId,
        employeeCode: data.employee.employeeCode,
        employeeName: `${data.employee.firstName} ${data.employee.lastName}`.trim(),
        designationTitle: desigTitle,
        regularHours: regHours,
        otHours: otHours,
        regularRate,
        otRate,
        regularAmount,
        otAmount,
        totalAmount: itemTotal,
      });
    }

    return {
      clientId: client.id,
      clientName: client.name,
      projectId: project.id,
      projectName: project.name,
      billingPeriod: dto.billingPeriod,
      designationId: dto.designationId,
      designationTitle: filterDesignationTitle,
      billableEmployeesCount: items.length,
      totalRegularHours,
      totalOtHours,
      regularRate: dominantRegRate,
      otRate: dominantOtRate,
      subtotal,
      taxAmount: 0.0,
      totalAmount: subtotal,
      currency: 'AED',
      taxNotice: 'Tax configuration is not enabled.',
      items,
    };
  }

  /**
   * Generate a DRAFT invoice from actual attendance/timesheet.
   * Respects duplicate protection:
   * - If existing DRAFT exists, updates and reuses it.
   * - If existing APPROVED or ISSUED exists, blocks with conflict error.
   */
  public static async generateInvoice(
    dto: GenerateInvoiceDto,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
  ): Promise<Invoice> {
    return sequelize.transaction(async (t) => {
      const preview = await this.previewInvoice(dto, t);

      if (preview.items.length === 0) {
        throw AppError.badRequest(
          `Cannot generate invoice. No billable attendance hours found for ${preview.clientName} - ${preview.projectName} during ${dto.billingPeriod}.`,
        );
      }

      // Duplicate protection check
      const existing = await Invoice.findOne({
        where: {
          clientId: dto.clientId,
          projectId: dto.projectId,
          billingPeriod: dto.billingPeriod,
        },
        transaction: t,
      });

      if (existing) {
        if (existing.status === 'issued') {
          throw AppError.conflict(
            `An invoice (${existing.invoiceNumber}) has already been ISSUED for this client, project, and billing period. Issued invoices cannot be modified.`,
          );
        }

        if (existing.status === 'approved') {
          throw AppError.conflict(
            `An invoice (${existing.invoiceNumber}) is already APPROVED for this client, project, and billing period. Please issue or reject the existing approved invoice.`,
          );
        }

        if (existing.status === 'rejected') {
          throw AppError.conflict(
            `An invoice (${existing.invoiceNumber}) for this client, project, and billing period was REJECTED (${existing.rejectionReason || 'No reason specified'}).`,
          );
        }

        // If existing is in 'draft' status, reuse and update it with latest calculation!
        existing.subtotal = preview.subtotal;
        existing.taxAmount = preview.taxAmount;
        existing.totalAmount = preview.totalAmount;
        existing.notes = dto.notes !== undefined ? dto.notes.trim() : existing.notes;
        existing.invoiceDate = new Date().toISOString().slice(0, 10);
        await existing.save({ transaction: t });

        // Remove previous lines and recreate
        await InvoiceLine.destroy({ where: { invoiceId: existing.id }, transaction: t });

        for (const item of preview.items) {
          if (item.regularHours > 0) {
            await InvoiceLine.create(
              {
                invoiceId: existing.id,
                employeeId: item.employeeId,
                projectId: dto.projectId,
                description: `${item.employeeName} — Regular Hours`,
                designationTitle: item.designationTitle,
                hours: item.regularHours,
                overtimeHours: 0.0,
                rate: item.regularRate,
                otRate: 0.0,
                amount: item.regularAmount,
                lineType: 'billable_regular',
              },
              { transaction: t },
            );
          }

          if (item.otHours > 0) {
            await InvoiceLine.create(
              {
                invoiceId: existing.id,
                employeeId: item.employeeId,
                projectId: dto.projectId,
                description: `${item.employeeName} — Overtime`,
                designationTitle: item.designationTitle,
                hours: 0.0,
                overtimeHours: item.otHours,
                rate: 0.0,
                otRate: item.otRate,
                amount: item.otAmount,
                lineType: 'billable_overtime',
              },
              { transaction: t },
            );
          }
        }

        await AuditService.recordEvent({
          actorId,
          actorIp,
          actorUserAgent,
          action: 'INVOICE_UPDATED',
          resourceType: 'Invoice',
          resourceId: existing.id,
          newValues: {
            invoiceNumber: existing.invoiceNumber,
            totalAmount: existing.totalAmount,
            status: existing.status,
            reusedDraft: true,
          },
          transaction: t,
        });

        return existing;
      }

      // Generate next sequential invoice number for this billing period
      const count = await Invoice.count({
        where: { billingPeriod: dto.billingPeriod },
        transaction: t,
      });
      let seq = count + 1;
      let invoiceNumber = `INV-${dto.billingPeriod}-${String(seq).padStart(4, '0')}`;

      // Guarantee unique invoice number
      while (await Invoice.findOne({ where: { invoiceNumber }, transaction: t })) {
        seq++;
        invoiceNumber = `INV-${dto.billingPeriod}-${String(seq).padStart(4, '0')}`;
      }

      const invoiceDate = new Date().toISOString().slice(0, 10);

      const invoice = await Invoice.create(
        {
          invoiceNumber,
          clientId: dto.clientId,
          projectId: dto.projectId,
          billingPeriod: dto.billingPeriod,
          invoiceDate,
          status: 'draft',
          subtotal: preview.subtotal,
          taxAmount: preview.taxAmount,
          totalAmount: preview.totalAmount,
          currency: 'AED',
          notes: dto.notes ? dto.notes.trim() : `Commercial invoice generated from verified timesheet hours for ${preview.projectName}.`,
        },
        { transaction: t },
      );

      // Create itemized lines
      for (const item of preview.items) {
        if (item.regularHours > 0) {
          await InvoiceLine.create(
            {
              invoiceId: invoice.id,
              employeeId: item.employeeId,
              projectId: dto.projectId,
              description: `${item.employeeName} — Regular Hours`,
              designationTitle: item.designationTitle,
              hours: item.regularHours,
              overtimeHours: 0.0,
              rate: item.regularRate,
              otRate: 0.0,
              amount: item.regularAmount,
              lineType: 'billable_regular',
            },
            { transaction: t },
          );
        }

        if (item.otHours > 0) {
          await InvoiceLine.create(
            {
              invoiceId: invoice.id,
              employeeId: item.employeeId,
              projectId: dto.projectId,
              description: `${item.employeeName} — Overtime`,
              designationTitle: item.designationTitle,
              hours: 0.0,
              overtimeHours: item.otHours,
              rate: 0.0,
              otRate: item.otRate,
              amount: item.otAmount,
              lineType: 'billable_overtime',
            },
            { transaction: t },
          );
        }
      }

      await AuditService.recordEvent({
        actorId,
        actorIp,
        actorUserAgent,
        action: 'INVOICE_GENERATED',
        resourceType: 'Invoice',
        resourceId: invoice.id,
        newValues: {
          invoiceNumber: invoice.invoiceNumber,
          clientId: invoice.clientId,
          projectId: invoice.projectId,
          billingPeriod: invoice.billingPeriod,
          totalAmount: invoice.totalAmount,
          status: invoice.status,
        },
        transaction: t,
      });

      return invoice;
    });
  }

  /**
   * Transition an invoice from 'draft' to 'approved'.
   */
  public static async approveInvoice(
    id: string,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
  ): Promise<Invoice> {
    const invoice = await Invoice.findByPk(id);

    if (!invoice) {
      throw AppError.notFound(`Invoice with ID ${id} not found`);
    }

    if (invoice.status === 'approved') {
      throw AppError.badRequest(`Invoice ${invoice.invoiceNumber} is already approved.`);
    }

    if (invoice.status === 'issued') {
      throw AppError.badRequest(`Invoice ${invoice.invoiceNumber} has already been issued.`);
    }

    if (invoice.status === 'rejected') {
      throw AppError.badRequest(`Cannot approve a rejected invoice (${invoice.invoiceNumber}). A new draft must be generated.`);
    }

    if (invoice.status !== 'draft') {
      throw AppError.badRequest(`Invoice ${invoice.invoiceNumber} cannot be approved from current status '${invoice.status}'.`);
    }

    invoice.status = 'approved';
    invoice.approvedAt = new Date();
    invoice.approvedBy = actorId || null;
    await invoice.save();

    await AuditService.recordEvent({
      actorId,
      actorIp,
      actorUserAgent,
      action: 'INVOICE_APPROVED',
      resourceType: 'Invoice',
      resourceId: invoice.id,
      newValues: {
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        approvedAt: invoice.approvedAt,
        approvedBy: invoice.approvedBy,
      },
    });

    return invoice;
  }

  /**
   * Reject an invoice with a mandatory reason.
   */
  public static async rejectInvoice(
    id: string,
    reason: string,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
  ): Promise<Invoice> {
    if (!reason || !reason.trim()) {
      throw AppError.badRequest('A reason is required to reject an invoice.');
    }

    const invoice = await Invoice.findByPk(id);

    if (!invoice) {
      throw AppError.notFound(`Invoice with ID ${id} not found`);
    }

    if (invoice.status === 'issued') {
      throw AppError.badRequest(`Cannot reject issued invoice ${invoice.invoiceNumber}. Issued invoices are permanently locked.`);
    }

    if (invoice.status === 'rejected') {
      throw AppError.badRequest(`Invoice ${invoice.invoiceNumber} is already rejected.`);
    }

    invoice.status = 'rejected';
    invoice.rejectedAt = new Date();
    invoice.rejectedBy = actorId || null;
    invoice.rejectionReason = reason.trim();
    await invoice.save();

    await AuditService.recordEvent({
      actorId,
      actorIp,
      actorUserAgent,
      action: 'INVOICE_REJECTED',
      resourceType: 'Invoice',
      resourceId: invoice.id,
      newValues: {
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        rejectedAt: invoice.rejectedAt,
        rejectedBy: invoice.rejectedBy,
        rejectionReason: invoice.rejectionReason,
      },
    });

    return invoice;
  }

  /**
   * Transition an invoice from 'approved' to 'issued'.
   * MANDATORY: Invoice must be in 'approved' status.
   * Directly issuing 'draft' or 'rejected' is strictly forbidden.
   */
  public static async issueInvoice(
    id: string,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
  ): Promise<Invoice> {
    const invoice = await Invoice.findByPk(id, {
      include: [{ model: InvoiceLine, as: 'lines' }],
    });

    if (!invoice) {
      throw AppError.notFound(`Invoice with ID ${id} not found`);
    }

    if (invoice.status === 'issued') {
      throw AppError.badRequest(`Invoice ${invoice.invoiceNumber} is already issued. Financial values are permanently locked.`);
    }

    if (invoice.status === 'draft') {
      throw AppError.badRequest(
        `Invoice ${invoice.invoiceNumber} cannot be issued directly from DRAFT status. Approval is mandatory before an invoice can be issued.`,
      );
    }

    if (invoice.status === 'rejected') {
      throw AppError.badRequest(
        `Invoice ${invoice.invoiceNumber} is REJECTED and cannot be issued.`,
      );
    }

    if (invoice.status !== 'approved') {
      throw AppError.badRequest(
        `Invoice ${invoice.invoiceNumber} cannot be issued from current status '${invoice.status}'. Only APPROVED invoices can be issued.`,
      );
    }

    invoice.status = 'issued';
    invoice.issuedAt = new Date();
    invoice.issuedBy = actorId || null;
    await invoice.save();

    await AuditService.recordEvent({
      actorId,
      actorIp,
      actorUserAgent,
      action: 'INVOICE_ISSUED',
      resourceType: 'Invoice',
      resourceId: invoice.id,
      newValues: {
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        issuedAt: invoice.issuedAt,
        issuedBy: invoice.issuedBy,
      },
    });

    return invoice;
  }

  /**
   * List all invoices with optional filtering.
   */
  public static async listInvoices(filters?: {
    clientId?: string;
    projectId?: string;
    billingPeriod?: string;
    status?: string;
  }): Promise<Invoice[]> {
    const where: any = {};
    if (filters?.clientId) where.clientId = filters.clientId;
    if (filters?.projectId) where.projectId = filters.projectId;
    if (filters?.billingPeriod) where.billingPeriod = filters.billingPeriod;
    if (filters?.status && filters.status !== 'all') where.status = filters.status;

    const invoices = await Invoice.findAll({
      where,
      include: [
        { model: Client, as: 'client', attributes: ['id', 'name', 'code', 'billingAddress'] },
        { model: Project, as: 'project', attributes: ['id', 'name', 'code'] },
        { model: User, as: 'issuedByUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: User, as: 'approvedByUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: User, as: 'rejectedByUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: InvoiceLine, as: 'lines', attributes: ['id', 'employeeId', 'hours', 'overtimeHours', 'amount'] },
        {
          model: InvoicePaymentAllocation,
          as: 'allocations',
          include: [{ model: ClientPayment, as: 'payment', where: { status: 'RECORDED' }, required: false }],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return invoices.map((inv) => {
      const json = inv.toJSON() as any;
      json.clientName = inv.client?.name;
      json.clientCode = inv.client?.code;
      json.projectName = inv.project?.name;
      json.projectCode = inv.project?.code;
      json.dueDate = inv.dueDate || null;

      // Authoritative payment calculation
      const activeAllocs = (json.allocations || []).filter((a: any) => a.payment && a.payment.status === 'RECORDED');
      const paidCents = activeAllocs.reduce((sum: number, a: any) => sum + Math.round(Number(a.allocatedAmount || 0) * 100), 0);
      const totalCents = Math.round(Number(inv.totalAmount || 0) * 100);
      const outstandingCents = Math.max(0, totalCents - paidCents);

      json.paidAmount = Math.round(paidCents) / 100;
      json.outstandingAmount = Math.round(outstandingCents) / 100;
      json.paymentStatus = paidCents <= 0 ? 'UNPAID' : (paidCents < totalCents ? 'PARTIALLY_PAID' : 'PAID');

      // Compute summary stats from lines
      const lines = json.lines || [];
      const uniqueEmployees = new Set(lines.map((l: any) => l.employeeId).filter(Boolean));
      json.workforceCount = uniqueEmployees.size;
      json.totalRegularHours = InvoiceService.round2(
        lines.reduce((sum: number, l: any) => sum + Number(l.hours || 0), 0),
      );
      json.totalOtHours = InvoiceService.round2(
        lines.reduce((sum: number, l: any) => sum + Number(l.overtimeHours || 0), 0),
      );

      return json;
    });
  }

  /**
   * Get single invoice by ID with itemized lines and grouped Annexure items.
   */
  public static async getInvoiceById(id: string): Promise<any> {
    const invoice = await Invoice.findByPk(id, {
      include: [
        { model: Client, as: 'client' },
        { model: Project, as: 'project' },
        { model: User, as: 'issuedByUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: User, as: 'approvedByUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: User, as: 'rejectedByUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
        {
          model: InvoiceLine,
          as: 'lines',
          include: [{ model: Employee, as: 'employee', attributes: ['id', 'employeeCode', 'firstName', 'lastName'] }],
        },
        {
          model: InvoicePaymentAllocation,
          as: 'allocations',
          include: [{ model: ClientPayment, as: 'payment', where: { status: 'RECORDED' }, required: false }],
        },
      ],
    });

    if (!invoice) {
      throw AppError.notFound(`Invoice with ID ${id} not found`);
    }

    const json = invoice.toJSON() as any;
    json.clientName = invoice.client?.name;
    json.clientCode = invoice.client?.code;
    json.projectName = invoice.project?.name;
    json.projectCode = invoice.project?.code;
    json.dueDate = invoice.dueDate || null;

    const activeAllocs = (json.allocations || []).filter((a: any) => a.payment && a.payment.status === 'RECORDED');
    const paidCents = activeAllocs.reduce((sum: number, a: any) => sum + Math.round(Number(a.allocatedAmount || 0) * 100), 0);
    const totalCents = Math.round(Number(invoice.totalAmount || 0) * 100);
    const outstandingCents = Math.max(0, totalCents - paidCents);

    json.paidAmount = Math.round(paidCents) / 100;
    json.outstandingAmount = Math.round(outstandingCents) / 100;
    json.paymentStatus = paidCents <= 0 ? 'UNPAID' : (paidCents < totalCents ? 'PARTIALLY_PAID' : 'PAID');

    const rawLines = json.lines || [];
    const formattedLines: any[] = [];
    const annexureMap = new Map<string, InvoicePreviewItemDto>();
    let totalRegHours = 0;
    let totalOtHours = 0;

    for (const l of rawLines) {
      const empName = l.employee ? `${l.employee.firstName} ${l.employee.lastName}`.trim() : null;
      const empCode = l.employee ? l.employee.employeeCode : null;
      formattedLines.push({
        ...l,
        employeeName: empName,
        employeeCode: empCode,
      });

      if (l.employeeId) {
        if (!annexureMap.has(l.employeeId)) {
          annexureMap.set(l.employeeId, {
            employeeId: l.employeeId,
            employeeCode: empCode || '—',
            employeeName: empName || '—',
            designationTitle: l.designationTitle || 'Worker',
            regularHours: 0,
            otHours: 0,
            regularRate: 0,
            otRate: 0,
            regularAmount: 0,
            otAmount: 0,
            totalAmount: 0,
          });
        }

        const item = annexureMap.get(l.employeeId)!;
        if (l.lineType === 'billable_regular' || Number(l.hours) > 0) {
          item.regularHours = InvoiceService.round2(item.regularHours + Number(l.hours || 0));
          item.regularRate = Number(l.rate || item.regularRate);
          item.regularAmount = InvoiceService.round2(item.regularAmount + Number(l.amount || 0));
          totalRegHours += Number(l.hours || 0);
        } else if (l.lineType === 'billable_overtime' || Number(l.overtimeHours) > 0) {
          item.otHours = InvoiceService.round2(item.otHours + Number(l.overtimeHours || 0));
          item.otRate = Number(l.otRate || item.otRate);
          item.otAmount = InvoiceService.round2(item.otAmount + Number(l.amount || 0));
          totalOtHours += Number(l.overtimeHours || 0);
        }
        item.totalAmount = InvoiceService.round2(item.regularAmount + item.otAmount);
      }
    }

    json.lines = formattedLines;
    json.annexureItems = Array.from(annexureMap.values());
    json.workforceCount = annexureMap.size;
    json.totalRegularHours = InvoiceService.round2(totalRegHours);
    json.totalOtHours = InvoiceService.round2(totalOtHours);

    return json;
  }
}
