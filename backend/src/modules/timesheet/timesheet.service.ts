import { Op, Transaction } from 'sequelize';
import { sequelize } from '../../core/database/sequelize';
import { AppError } from '../../core/errors/app-error';
import { AttendancePeriod } from '../attendance/models/attendance-period.model';
import { AttendanceRecord } from '../attendance/models/attendance-record.model';
import { AttendanceCalculationService } from '../attendance/services/attendance-calculation.service';
import { Employee } from '../masters/models/employee.model';
import { Project } from '../masters/models/project.model';
import { Designation } from '../masters/models/designation.model';
import { EmployeeAssignment } from '../masters/models/employee-assignment.model';
import { Shift } from '../masters/models/shift.model';
import { LeaveRequest } from '../leave/models/leave-request.model';

export class TimesheetService {
    public static async getProjectSupervisors(projectId: string): Promise<Array<{id: string, employeeCode: string, name: string}>> {
        const project = await Project.findByPk(projectId, {
            include: [{ model: Employee, as: 'supervisor' }]
        });
        if (!project) throw AppError.notFound(`Project ${projectId} not found`);

        if (project.supervisor) {
            return [{
                id: project.supervisor.id,
                employeeCode: project.supervisor.employeeCode,
                name: `${project.supervisor.firstName} ${project.supervisor.lastName}`
            }];
        }
        return [];
    }

    public static async getProjectDesignations(projectId: string): Promise<Array<{id: string, code: string, title: string}>> {
        const assignments = await EmployeeAssignment.findAll({
            where: {
                projectId,
                [Op.or]: [
                    { effectiveTo: null },
                    { effectiveTo: { [Op.gte]: new Date().toISOString().slice(0, 10) } }
                ]
            },
            include: [{ model: Designation, as: 'designation' }],
        });

        const designationsMap = new Map();
        for (const assignment of assignments) {
            if (assignment.designation && !designationsMap.has(assignment.designation.id)) {
                designationsMap.set(assignment.designation.id, {
                    id: assignment.designation.id,
                    code: assignment.designation.code,
                    title: assignment.designation.title
                });
            }
        }
        return Array.from(designationsMap.values());
    }

    public static async getProjectEmployees(projectId: string, designationId?: string): Promise<Array<{employeeId: string, employeeCode: string, employeeName: string, designationId: string, designationTitle: string}>> {
        const whereClause: any = {
            projectId,
            [Op.or]: [
                { effectiveTo: null },
                { effectiveTo: { [Op.gte]: new Date().toISOString().slice(0, 10) } }
            ]
        };
        if (designationId) {
            whereClause.designationId = designationId;
        }

        const assignments = await EmployeeAssignment.findAll({
            where: whereClause,
            include: [
                { model: Employee, as: 'employee' },
                { model: Designation, as: 'designation' }
            ]
        });

        const result = assignments.map((a: EmployeeAssignment) => ({
            employeeId: a.employeeId,
            employeeCode: a.employee?.employeeCode || '',
            employeeName: a.employee ? `${a.employee.firstName} ${a.employee.lastName}`.trim() : '',
            designationId: a.designationId,
            designationTitle: a.designation?.title || ''
        }));
        
        // Remove duplicates by employeeId just in case
        const unique = new Map();
        for(const item of result) {
            if(!unique.has(item.employeeId)) unique.set(item.employeeId, item);
        }
        return Array.from(unique.values());
    }

    public static async fillStandardHours(periodId: string, employeeIds: string[], _actorId: string) {
        // Find period
        const period = await AttendancePeriod.findByPk(periodId);
        if (!period) throw AppError.notFound(`Attendance period ${periodId} not found`);
        if (period.status === 'locked') {
            throw AppError.badRequest('Attendance period is locked');
        }

        return sequelize.transaction(async (t: Transaction) => {
            let updatedRecords = 0;
            let skippedLeave = 0;
            let skippedHoliday = 0;
            let skippedWeeklyOff = 0;
            let createdRecords = 0;

            // Find default shift if available
            const defaultShift = await Shift.findOne({ where: { isActive: true }, transaction: t });

            // Fetch approved leaves overlapping this period
            const approvedLeaves = await LeaveRequest.findAll({
                where: {
                    status: 'APPROVED',
                    employeeId: { [Op.in]: employeeIds },
                    startDate: { [Op.lte]: period.endDate },
                    endDate: { [Op.gte]: period.startDate },
                },
                transaction: t,
            });

            for (const employeeId of employeeIds) {
                const emp = await Employee.findByPk(employeeId, { transaction: t });
                if (!emp) continue;

                const records = await AttendanceRecord.findAll({
                    where: { attendancePeriodId: periodId, employeeId },
                    include: [{ model: Shift, as: 'shift' }],
                    transaction: t
                });

                const existingDates = new Set(records.map((r: AttendanceRecord) => r.workDate));

                // Process existing records
                for (const record of records) {
                    if (record.isOnLeave) {
                        skippedLeave++;
                        continue;
                    }
                    if (record.dayType === 'weekly_off') {
                        skippedWeeklyOff++;
                        continue;
                    }
                    if (record.dayType === 'public_holiday') {
                        skippedHoliday++;
                        continue;
                    }

                    if (record.dayType === 'regular_workday') {
                        let shiftWorkHours: number | null = null;
                        let shiftId = record.shiftId;
                        if (record.shift) {
                            shiftWorkHours = Number(record.shift.workHours);
                        } else if (record.shiftId) {
                            const shift = await Shift.findByPk(record.shiftId, { transaction: t });
                            if (shift) shiftWorkHours = Number(shift.workHours);
                        } else {
                            const pit = await AttendanceCalculationService.resolvePointInTimeContext(employeeId, record.workDate, t);
                            shiftWorkHours = pit.shiftWorkHours;
                            if (pit.shiftId) shiftId = pit.shiftId;
                        }

                        if (!shiftWorkHours && defaultShift) {
                            shiftWorkHours = Number(defaultShift.workHours);
                            if (!shiftId) shiftId = defaultShift.id;
                        }

                        const calc = AttendanceCalculationService.calculateHours({
                            actualHours: 8.0,
                            dayType: record.dayType,
                            shiftWorkHours: shiftWorkHours || 8.0,
                            isOnLeave: false
                        });

                        await record.update({
                            shiftId,
                            actualHours: 8.0,
                            regularHours: calc.regularHours,
                            otHours: calc.otHours,
                            isAbsent: false,
                            hasAnomaly: calc.hasAnomaly,
                            anomalyReason: calc.anomalyReason
                        }, { transaction: t });
                        updatedRecords++;
                    }
                }

                // Create missing records
                const current = new Date(`${period.startDate}T00:00:00Z`);
                const end = new Date(`${period.endDate}T00:00:00Z`);
                const dates: string[] = [];
                while (current <= end) {
                    dates.push(current.toISOString().slice(0, 10));
                    current.setUTCDate(current.getUTCDate() + 1);
                }

                const recordsToCreate = [];
                for (const date of dates) {
                    if (!existingDates.has(date)) {
                        // Check employment eligibility
                        const isEligible = AttendanceCalculationService.isEmployeeEligibleOnDate(
                            {
                                dateOfJoining: emp.dateOfJoining,
                                employmentType: emp.employmentType as 'full_time' | 'contract',
                                contractEndDate: emp.contractEndDate,
                            },
                            date,
                        );
                        if (!isEligible) continue;

                        const dayType = await AttendanceCalculationService.resolveDayType(date, t);
                        const pitContext = await AttendanceCalculationService.resolvePointInTimeContext(employeeId, date, t);

                        const isOnLeave = approvedLeaves.some(
                            (l: LeaveRequest) => l.employeeId === employeeId && date >= l.startDate && date <= l.endDate,
                        );

                        if (isOnLeave) {
                            skippedLeave++;
                        } else if (dayType === 'weekly_off') {
                            skippedWeeklyOff++;
                        } else if (dayType === 'public_holiday') {
                            skippedHoliday++;
                        }

                        let actualHours = 0.0;
                        if (dayType === 'regular_workday' && !isOnLeave) {
                            actualHours = 8.0;
                        }

                        let shiftWorkHours = pitContext.shiftWorkHours;
                        let shiftId = pitContext.shiftId;
                        if (!shiftWorkHours && defaultShift) {
                            shiftWorkHours = Number(defaultShift.workHours);
                            if (!shiftId) shiftId = defaultShift.id;
                        }

                        const calc = AttendanceCalculationService.calculateHours({
                            actualHours,
                            dayType,
                            shiftWorkHours: shiftWorkHours || 8.0,
                            isOnLeave
                        });

                        recordsToCreate.push({
                            attendancePeriodId: periodId,
                            employeeId,
                            workDate: date,
                            clientId: pitContext.clientId,
                            projectId: pitContext.projectId,
                            designationId: pitContext.designationId,
                            shiftId,
                            dayType,
                            actualHours,
                            regularHours: calc.regularHours,
                            otHours: calc.otHours,
                            isAbsent: calc.isAbsent,
                            isOnLeave,
                            hasAnomaly: calc.hasAnomaly,
                            anomalyReason: calc.anomalyReason,
                            remarks: null
                        });
                        createdRecords++;
                    }
                }

                if (recordsToCreate.length > 0) {
                    await AttendanceRecord.bulkCreate(recordsToCreate, { transaction: t });
                }
            }

            return { updatedRecords, skippedLeave, skippedHoliday, skippedWeeklyOff, createdRecords };
        });
    }

    public static async assignWorker(projectId: string, dto: {employeeId: string, designationId: string, effectiveFrom: string, effectiveTo?: string, remarks?: string}, _actorId: string) {
        return sequelize.transaction(async (t: Transaction) => {
            const project = await Project.findByPk(projectId, { transaction: t });
            if (!project) throw AppError.notFound(`Project ${projectId} not found`);

            const employee = await Employee.findByPk(dto.employeeId, { transaction: t });
            if (!employee) throw AppError.notFound(`Employee ${dto.employeeId} not found`);

            const designation = await Designation.findByPk(dto.designationId, { transaction: t });
            if (!designation) throw AppError.notFound(`Designation ${dto.designationId} not found`);

            // Check for existing active assignment
            const existing = await EmployeeAssignment.findOne({
                where: {
                    employeeId: dto.employeeId,
                    projectId,
                    [Op.or]: [
                        { effectiveTo: null },
                        { effectiveTo: { [Op.gte]: dto.effectiveFrom } }
                    ]
                },
                transaction: t
            });

            if (existing) {
                throw AppError.conflict('Employee already has an active assignment to this project for the given period');
            }

            const assignment = await EmployeeAssignment.create({
                employeeId: dto.employeeId,
                clientId: project.clientId,
                projectId: project.id,
                designationId: dto.designationId,
                effectiveFrom: dto.effectiveFrom,
                effectiveTo: dto.effectiveTo || null,
                remarks: dto.remarks || null
            }, { transaction: t });

            return assignment;
        });
    }
}
