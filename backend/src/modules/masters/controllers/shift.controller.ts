import { Request, Response, NextFunction } from 'express';
import { Shift } from '../models/shift.model';
import { EmployeeShiftAssignment } from '../models/employee-shift-assignment.model';
import { Employee } from '../models/employee.model';
import { sendSuccess } from '../../../core/utils/response.util';
import { AppError } from '../../../core/errors/app-error';
import { EffectiveDateService } from '../../../core/services/effective-date.service';
import { runInTransaction } from '../../../core/database/transactions';
import { AuditService } from '../../../core/audit/audit.service';

export class ShiftController {
  // 1. Shift Masters
  public static async listShifts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const shifts = await Shift.findAll({ order: [['startTime', 'ASC']] });
      sendSuccess(req, res, shifts);
    } catch (err) {
      next(err);
    }
  }

  public static async createShift(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, name, startTime, endTime, breakMinutes, workHours, isNightShift, isActive } = req.body;
      const existing = await Shift.findOne({ where: { code } });
      if (existing) throw AppError.conflict(`Shift code ${code} already exists`);

      const shift = await Shift.create({
        code,
        name,
        startTime,
        endTime,
        breakMinutes: breakMinutes !== undefined ? breakMinutes : 60,
        workHours,
        isNightShift: isNightShift || false,
        isActive: isActive !== undefined ? isActive : true,
      });

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip || req.socket.remoteAddress,
        actorUserAgent: req.headers['user-agent'],
        action: 'SHIFT_CREATED',
        resourceType: 'Shift',
        resourceId: shift.id,
        newValues: shift.toJSON(),
        correlationId: req.headers['x-correlation-id'] as string,
      });

      sendSuccess(req, res, shift, 201);
    } catch (err) {
      next(err);
    }
  }

  // 2. Roster Assignments
  public static async listAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const where: Record<string, unknown> = {};
      if (req.query.employeeId) where.employeeId = String(req.query.employeeId);

      const assignments = await EmployeeShiftAssignment.findAll({
        where,
        include: [
          { model: Employee, as: 'employee' },
          { model: Shift, as: 'shift' },
        ],
        order: [['effectiveFrom', 'DESC']],
      });
      sendSuccess(req, res, assignments);
    } catch (err) {
      next(err);
    }
  }

  public static async createAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { employeeId, shiftId, effectiveFrom, effectiveTo } = req.body;
      const [emp, shift] = await Promise.all([
        Employee.findByPk(String(employeeId)),
        Shift.findByPk(String(shiftId)),
      ]);
      if (!emp) throw AppError.badRequest(`Employee ${employeeId} not found`);
      if (!shift) throw AppError.badRequest(`Shift ${shiftId} not found`);

      const result = await runInTransaction(async (t) => {
        await EffectiveDateService.validateAndPrepareInterval(
          EmployeeShiftAssignment,
          { employeeId },
          effectiveFrom,
          effectiveTo || null,
          true,
          t,
        );

        const assignment = await EmployeeShiftAssignment.create(
          {
            employeeId,
            shiftId,
            effectiveFrom,
            effectiveTo: effectiveTo || null,
          },
          { transaction: t },
        );

        await AuditService.recordEvent({
          actorId: req.user?.id,
          actorIp: req.ip || req.socket.remoteAddress,
          actorUserAgent: req.headers['user-agent'],
          action: 'SHIFT_ROSTER_ASSIGNED',
          resourceType: 'EmployeeShiftAssignment',
          resourceId: assignment.id,
          newValues: assignment.toJSON(),
          correlationId: req.headers['x-correlation-id'] as string,
          transaction: t,
        });

        return assignment;
      });

      sendSuccess(req, res, result, 201);
    } catch (err) {
      next(err);
    }
  }
}
