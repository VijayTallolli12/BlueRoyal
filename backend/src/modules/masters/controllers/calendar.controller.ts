import { Request, Response, NextFunction } from 'express';
import { WeeklyOffConfig, PublicHoliday } from '../models/calendar.model';
import { sendSuccess } from '../../../core/utils/response.util';
import { AppError } from '../../../core/errors/app-error';

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
      await item.destroy();
      sendSuccess(req, res, { message: 'Holiday deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}
