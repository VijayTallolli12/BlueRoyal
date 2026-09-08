import * as XLSX from 'xlsx';
import { Op } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { AppError } from '../../../core/errors/app-error';
import { AuditService } from '../../../core/audit/audit.service';
import { AttendancePeriod } from '../models/attendance-period.model';
import { AttendanceRecord, DayType } from '../models/attendance-record.model';
import { AttendanceAuditLog } from '../models/attendance-audit-log.model';
import { Employee } from '../../masters/models/employee.model';
import { Shift } from '../../masters/models/shift.model';
import {
  AttendanceCalculationService,
  EmployeeEligibilityContext,
} from './attendance-calculation.service';
import { AttendanceImportResultDto } from '@blue-royal/contracts';

interface ExcelImportRow {
  'Employee Code'?: string;
  'Employee Name'?: string;
  'Work Date (YYYY-MM-DD)'?: string | number;
  'Actual Hours'?: number | string;
  'On Leave (Y/N)'?: string;
  Remarks?: string;
  [key: string]: any;
}

export class AttendanceImportService {
  /**
   * Generates a pre-formatted Excel template for the attendance period.
   */
  public static async generateTemplate(periodId: string): Promise<Buffer> {
    const period = await AttendancePeriod.findByPk(periodId);
    if (!period) {
      throw AppError.notFound(`Attendance period ${periodId} not found`);
    }

    const employees = await Employee.findAll({
      where: {
        dateOfJoining: { [Op.lte]: period.endDate },
        status: { [Op.ne]: 'terminated' },
      },
      order: [['employeeCode', 'ASC']],
    });

    const rows: any[] = [];

    // Helper: generate dates for template
    const current = new Date(`${period.startDate}T00:00:00Z`);
    const end = new Date(`${period.endDate}T00:00:00Z`);
    const dates: string[] = [];
    while (current <= end) {
      dates.push(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + 1);
    }

    // Pre-populate template with rows for each employee and date
    for (const emp of employees) {
      const eligibility: EmployeeEligibilityContext = {
        dateOfJoining: emp.dateOfJoining,
        employmentType: emp.employmentType,
        contractEndDate: emp.contractEndDate,
      };

      for (const d of dates) {
        if (!AttendanceCalculationService.isEmployeeEligibleOnDate(eligibility, d)) {
          continue;
        }
        rows.push({
          'Employee Code': emp.employeeCode,
          'Employee Name': `${emp.firstName} ${emp.lastName}`,
          'Work Date (YYYY-MM-DD)': d,
          'Actual Hours': 0.0,
          'On Leave (Y/N)': 'N',
          Remarks: '',
        });
      }
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Attendance_${period.periodCode}`);

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Dry-run validation or full import execution of attendance Excel file.
   */
  public static async processImport(
    periodId: string,
    fileBuffer: Buffer,
    dryRun: boolean,
    actorId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<AttendanceImportResultDto> {
    const period = await AttendancePeriod.findByPk(periodId);
    if (!period) {
      throw AppError.notFound(`Attendance period ${periodId} not found`);
    }

    if (period.status === 'locked') {
      throw AppError.badRequest(
        'Attendance period is locked. Cannot import records into a locked period.',
      );
    }

    // Parse Excel Buffer
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch (err: any) {
      throw AppError.badRequest(`Invalid or corrupted Excel file: ${err.message}`);
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw AppError.badRequest('Excel workbook contains no sheets');
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<ExcelImportRow>(sheet);

    if (!rawRows || rawRows.length === 0) {
      throw AppError.badRequest('Excel sheet contains no data rows');
    }

    // Preload employees by code
    const allEmployees = await Employee.findAll();
    const employeeMap = new Map<string, Employee>();
    for (const emp of allEmployees) {
      employeeMap.set(emp.employeeCode.trim().toUpperCase(), emp);
    }

    const errors: Array<{
      rowNumber: number;
      employeeCode?: string;
      workDate?: string;
      field: string;
      message: string;
    }> = [];

    const validatedRows: Array<{
      employee: Employee;
      workDate: string;
      actualHours: number;
      isOnLeave: boolean;
      remarks: string | null;
    }> = [];

    const seenKeys = new Set<string>();

    // Row-by-row validation
    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 2; // Excel 1-based index (header is row 1)

      const rawCode = row['Employee Code'];
      const rawDate = row['Work Date (YYYY-MM-DD)'];
      const rawHours = row['Actual Hours'];
      const rawLeave = row['On Leave (Y/N)'];
      const remarks = row['Remarks'] ? String(row['Remarks']).trim() : null;

      // 1. Employee Code validation
      if (!rawCode || String(rawCode).trim() === '') {
        errors.push({
          rowNumber: rowNum,
          field: 'Employee Code',
          message: 'Employee Code is required',
        });
        continue;
      }
      const code = String(rawCode).trim().toUpperCase();
      const employee = employeeMap.get(code);
      if (!employee) {
        errors.push({
          rowNumber: rowNum,
          employeeCode: code,
          field: 'Employee Code',
          message: `Employee with code '${code}' does not exist`,
        });
        continue;
      }

      // 2. Work Date validation
      if (!rawDate) {
        errors.push({
          rowNumber: rowNum,
          employeeCode: code,
          field: 'Work Date',
          message: 'Work Date is required',
        });
        continue;
      }

      let dateStr = '';
      if (typeof rawDate === 'number') {
        // Excel date serial number conversion
        const parsed = new Date((rawDate - (25567 + 2)) * 86400 * 1000);
        dateStr = parsed.toISOString().slice(0, 10);
      } else {
        dateStr = String(rawDate).trim();
      }

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateStr)) {
        errors.push({
          rowNumber: rowNum,
          employeeCode: code,
          workDate: dateStr,
          field: 'Work Date',
          message: `Work Date '${dateStr}' is invalid. Format must be YYYY-MM-DD`,
        });
        continue;
      }

      if (dateStr < period.startDate || dateStr > period.endDate) {
        errors.push({
          rowNumber: rowNum,
          employeeCode: code,
          workDate: dateStr,
          field: 'Work Date',
          message: `Work Date '${dateStr}' is outside period range (${period.startDate} to ${period.endDate})`,
        });
        continue;
      }

      // 3. Employee contract eligibility validation
      const eligibility: EmployeeEligibilityContext = {
        dateOfJoining: employee.dateOfJoining,
        employmentType: employee.employmentType,
        contractEndDate: employee.contractEndDate,
      };

      if (!AttendanceCalculationService.isEmployeeEligibleOnDate(eligibility, dateStr)) {
        errors.push({
          rowNumber: rowNum,
          employeeCode: code,
          workDate: dateStr,
          field: 'Work Date',
          message: `Employee ${code} is ineligible on ${dateStr} (Joining: ${employee.dateOfJoining}, Contract End: ${employee.contractEndDate || 'N/A'})`,
        });
        continue;
      }

      // 4. Duplicate within spreadsheet check
      const uniqueKey = `${employee.id}_${dateStr}`;
      if (seenKeys.has(uniqueKey)) {
        errors.push({
          rowNumber: rowNum,
          employeeCode: code,
          workDate: dateStr,
          field: 'Work Date',
          message: `Duplicate entry for employee ${code} on date ${dateStr} in file`,
        });
        continue;
      }
      seenKeys.add(uniqueKey);

      // 5. Actual Hours validation
      if (rawHours === undefined || rawHours === null || rawHours === '') {
        errors.push({
          rowNumber: rowNum,
          employeeCode: code,
          workDate: dateStr,
          field: 'Actual Hours',
          message: 'Actual Hours is required',
        });
        continue;
      }

      const hoursNum = Number(rawHours);
      if (isNaN(hoursNum) || hoursNum < 0 || hoursNum > 24) {
        errors.push({
          rowNumber: rowNum,
          employeeCode: code,
          workDate: dateStr,
          field: 'Actual Hours',
          message: `Actual Hours '${rawHours}' must be a number between 0.00 and 24.00`,
        });
        continue;
      }

      // 6. Leave flag
      let isOnLeave = false;
      if (rawLeave !== undefined && rawLeave !== null) {
        const leaveStr = String(rawLeave).trim().toUpperCase();
        isOnLeave = leaveStr === 'Y' || leaveStr === 'YES' || leaveStr === 'TRUE';
      }

      validatedRows.push({
        employee,
        workDate: dateStr,
        actualHours: Number(hoursNum.toFixed(2)),
        isOnLeave,
        remarks,
      });
    }

    const totalRows = rawRows.length;
    const validRows = validatedRows.length;
    const errorCount = errors.length;

    // If dry run, return preview and validation report immediately
    if (dryRun) {
      return {
        dryRun: true,
        success: errorCount === 0,
        periodCode: period.periodCode,
        totalRowsAnalyzed: totalRows,
        totalRows,
        validRows,
        errorCount,
        errors,
      };
    }

    // STRICT: If any errors exist, do not import anything (Zero partial imports)
    if (errorCount > 0) {
      return {
        dryRun: false,
        success: false,
        periodCode: period.periodCode,
        totalRowsAnalyzed: totalRows,
        totalRows,
        validRows,
        errorCount,
        errors,
      };
    }

    // Execution: Commit all changes in a database transaction
    return sequelize.transaction(async (t) => {
      let importedCount = 0;

      for (const item of validatedRows) {
        const { employee, workDate, actualHours, isOnLeave, remarks } = item;

        // Find existing record or create new
        let record = await AttendanceRecord.findOne({
          where: { attendancePeriodId: periodId, employeeId: employee.id, workDate },
          include: [{ model: Shift, as: 'shift' }],
          transaction: t,
        });

        if (!record) {
          const dayType: DayType = await AttendanceCalculationService.resolveDayType(workDate, t);
          const pitContext = await AttendanceCalculationService.resolvePointInTimeContext(
            employee.id,
            workDate,
            t,
          );
          const calc = AttendanceCalculationService.calculateHours({
            actualHours,
            dayType,
            shiftWorkHours: pitContext.shiftWorkHours,
            isOnLeave,
          });

          record = await AttendanceRecord.create(
            {
              attendancePeriodId: period.id,
              employeeId: employee.id,
              workDate,
              clientId: pitContext.clientId,
              projectId: pitContext.projectId,
              designationId: pitContext.designationId,
              shiftId: pitContext.shiftId,
              dayType,
              actualHours,
              regularHours: calc.regularHours,
              otHours: calc.otHours,
              isAbsent: calc.isAbsent,
              isOnLeave,
              hasAnomaly: calc.hasAnomaly,
              anomalyReason: calc.anomalyReason,
              remarks,
            },
            { transaction: t },
          );

          await AttendanceAuditLog.create(
            {
              attendanceRecordId: record.id,
              employeeId: employee.id,
              workDate,
              fieldName: 'actual_hours',
              oldValue: null,
              newValue: actualHours.toFixed(2),
              changeReason: 'EXCEL_IMPORT_INITIAL',
              actorId,
            },
            { transaction: t },
          );
        } else {
          const oldActual = Number(record.actualHours);
          const shiftHours = record.shift ? Number(record.shift.workHours) : null;
          const calc = AttendanceCalculationService.calculateHours({
            actualHours,
            dayType: record.dayType,
            shiftWorkHours: shiftHours,
            isOnLeave,
          });

          if (oldActual !== actualHours) {
            await AttendanceAuditLog.create(
              {
                attendanceRecordId: record.id,
                employeeId: employee.id,
                workDate,
                fieldName: 'actual_hours',
                oldValue: oldActual.toFixed(2),
                newValue: actualHours.toFixed(2),
                changeReason: 'EXCEL_IMPORT_UPDATE',
                actorId,
              },
              { transaction: t },
            );
          }

          await record.update(
            {
              actualHours,
              regularHours: calc.regularHours,
              otHours: calc.otHours,
              isAbsent: calc.isAbsent,
              isOnLeave,
              hasAnomaly: calc.hasAnomaly,
              anomalyReason: calc.anomalyReason,
              remarks: remarks || record.remarks,
            },
            { transaction: t },
          );
        }

        importedCount++;
      }

      // Invalidate submitted/approved status if mutated
      if (period.status === 'submitted' || period.status === 'approved') {
        await period.update(
          {
            status: 'draft',
            submittedBy: null,
            submittedAt: null,
            approvedBy: null,
            approvedAt: null,
          },
          { transaction: t },
        );
      }

      await AuditService.recordEvent({
        actorId,
        actorIp: ip,
        actorUserAgent: userAgent,
        action: 'ATTENDANCE_IMPORTED',
        resourceType: 'AttendancePeriod',
        resourceId: period.id,
        newValues: {
          importedCount,
          totalRows,
        },
      });

      return {
        dryRun: false,
        success: true,
        periodCode: period.periodCode,
        totalRowsAnalyzed: totalRows,
        totalRows,
        validRows: importedCount,
        errorCount: 0,
        errors: [],
      };
    });
  }
}
