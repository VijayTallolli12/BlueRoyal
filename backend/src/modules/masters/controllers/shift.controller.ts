import { Request, Response, NextFunction } from 'express';
import { Shift } from '../models/shift.model';
import { EmployeeShiftAssignment } from '../models/employee-shift-assignment.model';
import { Employee } from '../models/employee.model';
import { sendSuccess } from '../../../core/utils/response.util';
import { AppError } from '../../../core/errors/app-error';
import { EffectiveDateService } from '../../../core/services/effective-date.service';
import { runInTransaction } from '../../../core/database/transactions';
import { AuditService } from '../../../core/audit/audit.service';

function parseTimeToMinutes(t: string): number {
  if (!t) return 0;
  const parts = t.split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function calculateShiftMetrics(startTime: string, endTime: string, breakMinutes?: number): {
  workHours: number;
  isNightShift: boolean;
  breakMinutes: number;
} {
  const startMins = parseTimeToMinutes(startTime);
  const endMins = parseTimeToMinutes(endTime);

  if (startMins === endMins) {
    throw AppError.badRequest('Start time and end time cannot be the same');
  }

  let totalDurationMins = endMins - startMins;
  const isNightShift = endMins < startMins; // Automatic overnight detection: shift crosses midnight
  if (isNightShift) {
    totalDurationMins += 1440; // 24 hours * 60 minutes
  }

  const cleanBreak = breakMinutes !== undefined && !isNaN(Number(breakMinutes)) ? Number(breakMinutes) : 60;
  if (cleanBreak < 0) {
    throw AppError.badRequest('Break time cannot be negative');
  }
  if (cleanBreak >= totalDurationMins) {
    throw AppError.badRequest('Break time cannot be greater than the shift duration');
  }

  const netMinutes = totalDurationMins - cleanBreak;
  const workHours = Math.round((netMinutes / 60) * 100) / 100;

  return {
    workHours,
    isNightShift,
    breakMinutes: cleanBreak,
  };
}

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
      const { code, name, startTime, endTime, breakMinutes, isActive } = req.body;
      if (!code || !String(code).trim()) throw AppError.badRequest('Shift Code is required');
      if (!name || !String(name).trim()) throw AppError.badRequest('Shift Name is required');
      if (!startTime) throw AppError.badRequest('Start Time is required');
      if (!endTime) throw AppError.badRequest('End Time is required');

      const existing = await Shift.findOne({ where: { code: String(code).trim() } });
      if (existing) throw AppError.conflict(`Shift code ${code} already exists`);

      const metrics = calculateShiftMetrics(startTime, endTime, breakMinutes);

      const shift = await Shift.create({
        code: String(code).trim(),
        name: String(name).trim(),
        startTime,
        endTime,
        breakMinutes: metrics.breakMinutes,
        workHours: metrics.workHours,
        isNightShift: metrics.isNightShift,
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

  public static async updateShift(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const shift = await Shift.findByPk(id);
      if (!shift) throw AppError.notFound(`Shift ${id} not found`);

      const { code, name, startTime, endTime, breakMinutes, isActive } = req.body;
      const oldValues = shift.toJSON();

      const newCode = code !== undefined ? String(code).trim() : shift.code;
      if (!newCode) throw AppError.badRequest('Shift Code is required');

      if (newCode !== shift.code) {
        const existing = await Shift.findOne({ where: { code: newCode } });
        if (existing && existing.id !== id) {
          throw AppError.conflict(`Shift code ${newCode} already exists`);
        }
      }

      const newName = name !== undefined ? String(name).trim() : shift.name;
      if (!newName) throw AppError.badRequest('Shift Name is required');

      const newStart = startTime !== undefined ? startTime : shift.startTime;
      const newEnd = endTime !== undefined ? endTime : shift.endTime;
      const newBreak = breakMinutes !== undefined ? Number(breakMinutes) : shift.breakMinutes;

      const metrics = calculateShiftMetrics(newStart, newEnd, newBreak);

      await shift.update({
        code: newCode,
        name: newName,
        startTime: newStart,
        endTime: newEnd,
        breakMinutes: metrics.breakMinutes,
        workHours: metrics.workHours,
        isNightShift: metrics.isNightShift,
        isActive: isActive !== undefined ? isActive : shift.isActive,
      });

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip || req.socket.remoteAddress,
        actorUserAgent: req.headers['user-agent'],
        action: 'SHIFT_UPDATED',
        resourceType: 'Shift',
        resourceId: id,
        oldValues,
        newValues: shift.toJSON(),
        correlationId: req.headers['x-correlation-id'] as string,
      });

      sendSuccess(req, res, shift);
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
