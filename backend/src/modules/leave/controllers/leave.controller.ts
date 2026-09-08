import { Request, Response, NextFunction } from 'express';
import { LeaveTypeService } from '../services/leave-type.service';
import { LeaveBalanceService } from '../services/leave-balance.service';
import { LeaveRequestService } from '../services/leave-request.service';
import { Employee } from '../../masters/models/employee.model';
import {
  createLeaveTypeSchema,
  updateLeaveTypeSchema,
  allocateLeaveBalanceSchema,
  createLeaveRequestSchema,
  rejectLeaveRequestSchema,
  cancelLeaveRequestSchema,
} from '../validators/leave.validator';
import { sendSuccess } from '../../../core/utils/response.util';
import { AppError } from '../../../core/errors/app-error';

export class LeaveController {
  // ==========================================
  // Leave Types
  // ==========================================

  public static async listTypes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const types = await LeaveTypeService.listTypes(includeInactive);
      sendSuccess(req, res, types);
    } catch (err) {
      next(err);
    }
  }

  public static async createType(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createLeaveTypeSchema.parse(req.body);
      const actorId = req.user?.id;
      if (!actorId) throw AppError.unauthorized('User identity not resolved');

      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const created = await LeaveTypeService.createType(parsed, actorId, ip, userAgent);
      sendSuccess(req, res, created, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async updateType(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const parsed = updateLeaveTypeSchema.parse(req.body);
      const actorId = req.user?.id;
      if (!actorId) throw AppError.unauthorized('User identity not resolved');

      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const updated = await LeaveTypeService.updateType(id, parsed, actorId, ip, userAgent);
      sendSuccess(req, res, updated);
    } catch (err) {
      next(err);
    }
  }

  public static async deleteType(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const actorId = req.user?.id;
      if (!actorId) throw AppError.unauthorized('User identity not resolved');

      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      await LeaveTypeService.deleteType(id, actorId, ip, userAgent);
      sendSuccess(req, res, { message: 'Leave type deactivated successfully' });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // Leave Balances
  // ==========================================

  public static async listBalances(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = {
        employeeId: req.query.employeeId ? String(req.query.employeeId) : undefined,
        leaveTypeId: req.query.leaveTypeId ? String(req.query.leaveTypeId) : undefined,
        year: req.query.year ? parseInt(String(req.query.year), 10) : undefined,
      };
      const balances = await LeaveBalanceService.listBalances(query);
      sendSuccess(req, res, balances);
    } catch (err) {
      next(err);
    }
  }

  public static async allocateBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = allocateLeaveBalanceSchema.parse(req.body);
      const actorId = req.user?.id;
      if (!actorId) throw AppError.unauthorized('User identity not resolved');

      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await LeaveBalanceService.allocateBalance(parsed, actorId, ip, userAgent);
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // Leave Requests (HR / Admin)
  // ==========================================

  public static async listRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = {
        employeeId: req.query.employeeId ? String(req.query.employeeId) : undefined,
        leaveTypeId: req.query.leaveTypeId ? String(req.query.leaveTypeId) : undefined,
        status: req.query.status as any,
        year: req.query.year ? parseInt(String(req.query.year), 10) : undefined,
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        page: req.query.page ? parseInt(String(req.query.page), 10) : 1,
        limit: req.query.limit ? parseInt(String(req.query.limit), 10) : 20,
      };

      const result = await LeaveRequestService.listRequests(query);
      const totalPages = Math.ceil(result.total / result.limit);
      sendSuccess(req, res, result.items, 200, {
        page: result.page,
        limit: result.limit,
        totalItems: result.total,
        totalPages,
        hasNextPage: result.page < totalPages,
        hasPrevPage: result.page > 1,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getRequestById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const request = await LeaveRequestService.getRequestById(id);
      sendSuccess(req, res, request);
    } catch (err) {
      next(err);
    }
  }

  public static async createRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createLeaveRequestSchema.parse(req.body);
      const actorId = req.user?.id;
      if (!actorId) throw AppError.unauthorized('User identity not resolved');

      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const created = await LeaveRequestService.submitRequest(parsed, actorId, ip, userAgent);
      sendSuccess(req, res, created, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async approveRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const actorId = req.user?.id;
      if (!actorId) throw AppError.unauthorized('User identity not resolved');

      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const approved = await LeaveRequestService.approveRequest(id, actorId, ip, userAgent);
      sendSuccess(req, res, approved);
    } catch (err) {
      next(err);
    }
  }

  public static async rejectRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const parsed = rejectLeaveRequestSchema.parse(req.body);
      const actorId = req.user?.id;
      if (!actorId) throw AppError.unauthorized('User identity not resolved');

      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const rejected = await LeaveRequestService.rejectRequest(
        id,
        parsed.rejectionReason,
        actorId,
        ip,
        userAgent,
      );
      sendSuccess(req, res, rejected);
    } catch (err) {
      next(err);
    }
  }

  public static async cancelRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const parsed = cancelLeaveRequestSchema.parse(req.body);
      const actorId = req.user?.id;
      if (!actorId) throw AppError.unauthorized('User identity not resolved');

      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const cancelled = await LeaveRequestService.cancelRequest(
        id,
        parsed.cancellationReason,
        actorId,
        false, // Admin / HR cancellation
        ip,
        userAgent,
      );
      sendSuccess(req, res, cancelled);
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // Employee Self-Service (/my-leave)
  // ==========================================

  public static async getMyLeaveOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) throw AppError.unauthorized('User identity not resolved');

      const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
      const overview = await LeaveRequestService.getMyLeaveOverview(userId, year);
      sendSuccess(req, res, overview);
    } catch (err) {
      next(err);
    }
  }

  public static async submitMyLeave(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) throw AppError.unauthorized('User identity not resolved');

      const employee = await Employee.findOne({ where: { userId } });
      if (!employee) {
        throw new AppError('No employee profile linked to your user account', 404);
      }

      const parsed = createLeaveRequestSchema.parse({
        ...req.body,
        employeeId: employee.id,
      });

      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const created = await LeaveRequestService.submitRequest(parsed, userId, ip, userAgent);
      sendSuccess(req, res, created, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async cancelMyLeave(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const userId = req.user?.id;
      if (!userId) throw AppError.unauthorized('User identity not resolved');

      const employee = await Employee.findOne({ where: { userId } });
      if (!employee) {
        throw new AppError('No employee profile linked to your user account', 404);
      }

      const leaveRequest = await LeaveRequestService.getRequestById(id);
      if (leaveRequest.employeeId !== employee.id) {
        throw new AppError('You can only cancel your own leave requests', 403);
      }

      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const cancelled = await LeaveRequestService.cancelRequest(
        id,
        'Cancelled by employee',
        userId,
        true, // isSelfCancel
        ip,
        userAgent,
      );
      sendSuccess(req, res, cancelled);
    } catch (err) {
      next(err);
    }
  }
}
