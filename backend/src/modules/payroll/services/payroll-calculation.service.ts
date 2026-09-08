import { Op, Transaction } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { AppError } from '../../../core/errors/app-error';
import { PayrollPeriod } from '../models/payroll-period.model';
import { PayrollItem } from '../models/payroll-item.model';
import { PayrollItemLine } from '../models/payroll-item-line.model';
import { AttendancePeriod } from '../../attendance/models/attendance-period.model';
import { AttendanceRecord } from '../../attendance/models/attendance-record.model';
import { Employee } from '../../masters/models/employee.model';
import { EmployeeHourlyRate } from '../../masters/models/employee-hourly-rate.model';
import { SalaryComponent, EmployeeSalaryStructure } from '../../masters/models/salary-component.model';
import { EmployeeAssignment } from '../../masters/models/employee-assignment.model';

export class PayrollCalculationService {
  /**
   * Helper to safely round a number to 2 decimal places
   */
  public static round2(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  /**
   * Calculate or recalculate an entire payroll period.
   * Locked attendance is required.
   * Preserves any existing manual adjustment lines.
   */
  public static async calculatePeriod(
    payrollPeriodId: string,
    actorId?: string,
    outerTransaction?: Transaction,
  ): Promise<PayrollPeriod> {
    const execute = async (t: Transaction) => {
      const period = await PayrollPeriod.findByPk(payrollPeriodId, {
        include: [{ model: AttendancePeriod, as: 'attendancePeriod' }],
        transaction: t,
      });

      if (!period) {
        throw AppError.notFound(`Payroll period with ID ${payrollPeriodId} not found`);
      }

      if (period.status === 'finalized') {
        throw AppError.badRequest('Cannot calculate a finalized payroll period. It is permanently locked.');
      }

      const attendancePeriod = period.attendancePeriod;
      if (!attendancePeriod) {
        throw AppError.badRequest('Linked attendance period not found.');
      }

      if (attendancePeriod.status !== 'locked') {
        throw AppError.badRequest(
          `Linked attendance period ${attendancePeriod.periodCode} is not locked (status: ${attendancePeriod.status}). Payroll calculation requires LOCKED attendance.`,
        );
      }

      // 1. Fetch all distinct employees with attendance records in this period
      const distinctEmpRecords = await AttendanceRecord.findAll({
        where: { attendancePeriodId: attendancePeriod.id },
        attributes: ['employeeId'],
        group: ['employeeId'],
        transaction: t,
      });

      const employeeIds = distinctEmpRecords.map((r) => r.employeeId);
      if (employeeIds.length === 0) {
        throw AppError.badRequest('No attendance records found for linked attendance period.');
      }

      const employees = await Employee.findAll({
        where: { id: { [Op.in]: employeeIds } },
        transaction: t,
      });

      let periodBlockingCount = 0;
      let periodTotalGross = 0;
      let periodTotalDeductions = 0;
      let periodTotalNet = 0;

      // Calculate calendar days in period
      const startMs = new Date(period.startDate).getTime();
      const endMs = new Date(period.endDate).getTime();
      const daysInPeriod = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;

      for (const emp of employees) {
        // Fetch all attendance records for this employee
        const records = await AttendanceRecord.findAll({
          where: {
            attendancePeriodId: attendancePeriod.id,
            employeeId: emp.id,
          },
          order: [['workDate', 'ASC']],
          transaction: t,
        });

        let totalActualHours = 0;
        let totalRegularHours = 0;
        let totalOtHours = 0;
        let totalAbsenceDays = 0;
        let totalLeaveDays = 0;

        for (const r of records) {
          totalActualHours += Number(r.actualHours || 0);
          totalRegularHours += Number(r.regularHours || 0);
          totalOtHours += Number(r.otHours || 0);
          if (r.isAbsent) totalAbsenceDays += 1;
          if (r.isOnLeave) totalLeaveDays += 1;
        }

        totalActualHours = PayrollCalculationService.round2(totalActualHours);
        totalRegularHours = PayrollCalculationService.round2(totalRegularHours);
        totalOtHours = PayrollCalculationService.round2(totalOtHours);

        // Resolve active designation from assignment
        const activeAssignment = await EmployeeAssignment.findOne({
          where: {
            employeeId: emp.id,
            effectiveFrom: { [Op.lte]: period.endDate },
            [Op.or]: [{ effectiveTo: null }, { effectiveTo: { [Op.gte]: period.startDate } }],
          },
          order: [['effectiveFrom', 'DESC']],
          transaction: t,
        });

        // Check if a PayrollItem already exists for (period.id, emp.id)
        let payrollItem = await PayrollItem.findOne({
          where: {
            payrollPeriodId: period.id,
            employeeId: emp.id,
          },
          transaction: t,
        });

        // Retrieve existing manual adjustments if item exists
        let existingManualLines: PayrollItemLine[] = [];
        if (payrollItem) {
          existingManualLines = await PayrollItemLine.findAll({
            where: {
              payrollItemId: payrollItem.id,
              isManual: true,
            },
            transaction: t,
          });

          // Delete only system-generated lines
          await PayrollItemLine.destroy({
            where: {
              payrollItemId: payrollItem.id,
              isManual: false,
            },
            transaction: t,
          });
        } else {
          payrollItem = await PayrollItem.create(
            {
              payrollPeriodId: period.id,
              employeeId: emp.id,
              remunerationBasis: emp.remunerationBasis,
              designationId: activeAssignment?.designationId || null,
              daysInPeriod,
              totalActualHours,
              totalRegularHours,
              totalOtHours,
              totalAbsenceDays,
              totalLeaveDays,
              grossPay: 0,
              totalDeductions: 0,
              netPay: 0,
              hasBlockingIssue: false,
              blockingReason: null,
            },
            { transaction: t },
          );
        }

        const newSystemLines: any[] = [];
        let hasBlockingIssue = false;
        let blockingReason: string | null = null;

        // Authoritative remuneration basis branch
        if (emp.remunerationBasis === 'hourly') {
          // Calculate hourly pay for each day with regular or OT hours
          for (const r of records) {
            const regHours = Number(r.regularHours || 0);
            const otHours = Number(r.otHours || 0);

            if (regHours > 0 || otHours > 0) {
              // Resolve active hourly rate on workDate
              const rate = await EmployeeHourlyRate.findOne({
                where: {
                  employeeId: emp.id,
                  effectiveFrom: { [Op.lte]: r.workDate },
                  [Op.or]: [{ effectiveTo: null }, { effectiveTo: { [Op.gte]: r.workDate } }],
                },
                transaction: t,
              });

              if (!rate) {
                hasBlockingIssue = true;
                blockingReason = `Missing active hourly rate for employee ${emp.employeeCode} on ${r.workDate}`;
                break;
              }

              if (regHours > 0) {
                const amount = PayrollCalculationService.round2(regHours * Number(rate.normalHourlyRate));
                newSystemLines.push({
                  payrollItemId: payrollItem.id,
                  category: 'earning',
                  isManual: false,
                  code: 'REGULAR_PAY',
                  description: `Regular Hours Pay (${r.workDate})`,
                  rate: Number(rate.normalHourlyRate),
                  quantity: regHours,
                  amount,
                  workDate: r.workDate,
                });
              }

              if (otHours > 0) {
                const amount = PayrollCalculationService.round2(otHours * Number(rate.otHourlyRate));
                newSystemLines.push({
                  payrollItemId: payrollItem.id,
                  category: 'earning',
                  isManual: false,
                  code: 'OVERTIME_PAY',
                  description: `Overtime Hours Pay (${r.workDate})`,
                  rate: Number(rate.otHourlyRate),
                  quantity: otHours,
                  amount,
                  workDate: r.workDate,
                });
              }
            }
          }
        } else if (emp.remunerationBasis === 'salaried') {
          // Resolve active salary structures
          const structures = await EmployeeSalaryStructure.findAll({
            where: {
              employeeId: emp.id,
              effectiveFrom: { [Op.lte]: period.endDate },
              [Op.or]: [{ effectiveTo: null }, { effectiveTo: { [Op.gte]: period.startDate } }],
            },
            include: [{ model: SalaryComponent, as: 'component' }],
            transaction: t,
          });

          if (structures.length === 0) {
            hasBlockingIssue = true;
            blockingReason = `Missing active salary structure package for salaried employee ${emp.employeeCode}`;
          } else {
            // Split base vs percentage components
            const baseStructures = structures.filter((s: EmployeeSalaryStructure) => !s.component?.percentageBasisComponentId);
            const pctStructures = structures.filter((s: EmployeeSalaryStructure) => !!s.component?.percentageBasisComponentId);

            const baseAmountMap = new Map<string, number>();

            // 1. Process base components
            for (const s of baseStructures) {
              const comp = s.component;
              if (!comp) continue;
              const amount = PayrollCalculationService.round2(Number(s.amountOrPercentage));
              baseAmountMap.set(comp.id, amount);

              newSystemLines.push({
                payrollItemId: payrollItem.id,
                category: comp.type, // 'earning' | 'deduction'
                isManual: false,
                code: comp.code,
                description: comp.name,
                rate: amount,
                quantity: 1,
                amount,
                salaryComponentId: comp.id,
              });
            }

            // 2. Process percentage components
            for (const s of pctStructures) {
              const comp = s.component;
              if (!comp) continue;
              const baseCompId = comp.percentageBasisComponentId;
              const baseAmount = baseCompId ? baseAmountMap.get(baseCompId) || 0 : 0;
              const pct = Number(s.amountOrPercentage);
              const amount = PayrollCalculationService.round2((baseAmount * pct) / 100);

              newSystemLines.push({
                payrollItemId: payrollItem.id,
                category: comp.type,
                isManual: false,
                code: comp.code,
                description: `${comp.name} (${pct}% of base)`,
                rate: baseAmount,
                quantity: pct / 100,
                amount,
                salaryComponentId: comp.id,
              });
            }
          }
        }

        // Bulk insert new system lines
        if (newSystemLines.length > 0) {
          await PayrollItemLine.bulkCreate(newSystemLines, { transaction: t });
        }

        // Sum earnings and deductions including preserved manual adjustments
        let empGross = 0;
        let empDeductions = 0;

        // System lines
        for (const line of newSystemLines) {
          if (line.category === 'earning') empGross += line.amount;
          if (line.category === 'deduction') empDeductions += line.amount;
        }

        // Preserved manual lines
        for (const line of existingManualLines) {
          if (line.adjustmentType === 'addition') empGross += Number(line.amount);
          if (line.adjustmentType === 'deduction') empDeductions += Number(line.amount);
        }

        empGross = PayrollCalculationService.round2(empGross);
        empDeductions = PayrollCalculationService.round2(empDeductions);
        const empNet = PayrollCalculationService.round2(empGross - empDeductions);

        if (hasBlockingIssue) {
          periodBlockingCount += 1;
        }

        // Update PayrollItem
        await payrollItem.update(
          {
            remunerationBasis: emp.remunerationBasis,
            designationId: activeAssignment?.designationId || null,
            daysInPeriod,
            totalActualHours,
            totalRegularHours,
            totalOtHours,
            totalAbsenceDays,
            totalLeaveDays,
            grossPay: empGross,
            totalDeductions: empDeductions,
            netPay: empNet,
            hasBlockingIssue,
            blockingReason,
          },
          { transaction: t },
        );

        periodTotalGross += empGross;
        periodTotalDeductions += empDeductions;
        periodTotalNet += empNet;
      }

      periodTotalGross = PayrollCalculationService.round2(periodTotalGross);
      periodTotalDeductions = PayrollCalculationService.round2(periodTotalDeductions);
      periodTotalNet = PayrollCalculationService.round2(periodTotalNet);

      const newStatus = periodBlockingCount === 0 ? 'calculated' : 'draft';

      await period.update(
        {
          status: newStatus,
          totalGrossPay: periodTotalGross,
          totalDeductions: periodTotalDeductions,
          totalNetPay: periodTotalNet,
          employeeCount: employees.length,
          blockingIssuesCount: periodBlockingCount,
          calculatedBy: actorId || null,
          calculatedAt: new Date(),
        },
        { transaction: t },
      );

      return period;
    };

    if (outerTransaction) {
      return execute(outerTransaction);
    }
    return sequelize.transaction(execute);
  }
}
