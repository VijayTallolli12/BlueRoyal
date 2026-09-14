import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../core/utils/response.util';
import { TimesheetService } from './timesheet.service';

export class TimesheetController {
    public static async getProjectSupervisors(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const projectId = String(req.params.projectId);
            const supervisors = await TimesheetService.getProjectSupervisors(projectId);
            sendSuccess(req, res, supervisors);
        } catch (err) {
            next(err);
        }
    }

    public static async getProjectDesignations(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const projectId = String(req.params.projectId);
            const designations = await TimesheetService.getProjectDesignations(projectId);
            sendSuccess(req, res, designations);
        } catch (err) {
            next(err);
        }
    }

    public static async getProjectEmployees(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const projectId = String(req.params.projectId);
            const designationId = req.query.designationId ? String(req.query.designationId) : undefined;
            const employees = await TimesheetService.getProjectEmployees(projectId, designationId);
            sendSuccess(req, res, employees);
        } catch (err) {
            next(err);
        }
    }

    public static async fillStandardHours(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { periodId, projectId, designationId } = req.body;
            const actorId = req.user?.id as string;
            
            // Resolve employeeIds
            const projectEmployees = await TimesheetService.getProjectEmployees(projectId, designationId);
            const employeeIds = projectEmployees.map(emp => emp.employeeId);

            const result = await TimesheetService.fillStandardHours(periodId, employeeIds, actorId);
            sendSuccess(req, res, result);
        } catch (err) {
            next(err);
        }
    }

    public static async assignWorker(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const projectId = String(req.params.projectId);
            const actorId = req.user?.id as string;
            const result = await TimesheetService.assignWorker(projectId, req.body, actorId);
            sendSuccess(req, res, result, 201);
        } catch (err) {
            next(err);
        }
    }
}
