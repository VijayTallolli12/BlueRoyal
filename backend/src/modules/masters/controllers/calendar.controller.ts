import { Request, Response, NextFunction } from 'express';
import { WeeklyOffConfig, PublicHoliday } from '../models/calendar.model';
import { sendSuccess } from '../../../core/utils/response.util';
import { AppError } from '../../../core/errors/app-error';
import { AuditService } from '../../../core/audit/audit.service';

export class CalendarController {
  // 1. Weekly Off Configs
  public static async listWeeklyOffs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const configs = await WeeklyOffConfig.findAll({ order: [['effectiveFrom', 'DESC']] });
      sendSuccess(req, res, configs);
    } catch (err) {
      next(err);
    }
  }

  public static async createWeeklyOff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, daysOfWeek, effectiveFrom, effectiveTo, isDefault } = req.body;
      const config = await WeeklyOffConfig.create({
        name,
        daysOfWeek,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        isDefault: isDefault || false,
      });

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip || req.socket.remoteAddress,
        actorUserAgent: req.headers['user-agent'],
        action: 'WEEKLY_OFF_CONFIGURED',
        resourceType: 'WeeklyOffConfig',
        resourceId: config.id,
        newValues: config.toJSON(),
        correlationId: req.headers['x-correlation-id'] as string,
      });

      sendSuccess(req, res, config, 201);
    } catch (err) {
      next(err);
    }
  }

  // 2. Company Public Holidays
  public static async listHolidays(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const where: Record<string, unknown> = {};
      if (req.query.year) where.calendarYear = Number(req.query.year);

      const holidays = await PublicHoliday.findAll({
        where,
        order: [['holidayDate', 'ASC']],
      });
      sendSuccess(req, res, holidays);
    } catch (err) {
      next(err);
    }
  }

  public static async createHoliday(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { calendarYear, name, holidayDate, description } = req.body;
      const existing = await PublicHoliday.findOne({ where: { holidayDate } });
      if (existing) {
        throw AppError.conflict(`Public holiday already configured on ${holidayDate}`);
      }
      const item = await PublicHoliday.create({
        calendarYear,
        name,
        holidayDate,
        description: description || null,
      });

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip || req.socket.remoteAddress,
        actorUserAgent: req.headers['user-agent'],
        action: 'PUBLIC_HOLIDAY_CONFIGURED',
        resourceType: 'PublicHoliday',
        resourceId: item.id,
        newValues: item.toJSON(),
        correlationId: req.headers['x-correlation-id'] as string,
      });

      sendSuccess(req, res, item, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async deleteHoliday(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const item = await PublicHoliday.findByPk(id);
      if (!item) throw AppError.notFound(`Holiday ${id} not found`);
      const oldValues = item.toJSON();
      await item.destroy();

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip || req.socket.remoteAddress,
        actorUserAgent: req.headers['user-agent'],
        action: 'PUBLIC_HOLIDAY_DELETED',
        resourceType: 'PublicHoliday',
        resourceId: id,
        oldValues,
        correlationId: req.headers['x-correlation-id'] as string,
      });

      sendSuccess(req, res, { message: 'Holiday deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}
