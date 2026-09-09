import { Employee } from '../../masters/models/employee.model';
import { EmployeeHourlyRate } from '../../masters/models/employee-hourly-rate.model';
import { EmployeeSalaryStructure, SalaryComponent } from '../../masters/models/salary-component.model';
import { EmployeeSeparation } from '../models/employee-separation.model';
import { PayrollPeriod } from '../../payroll/models/payroll-period.model';
import { AttendancePeriod } from '../../attendance/models/attendance-period.model';
import { AttendanceRecord } from '../../attendance/models/attendance-record.model';
import { GratuityCalculationService } from './gratuity-calculator.service';
import { LeaveEncashmentService } from './leave-encashment.service';
import { AirTicketService } from './air-ticket.service';
import { round2 } from '../../../core/utils/math.util';
import { AppError } from '../../../core/errors/app-error';
import {
  SettlementLineCategory,
  SettlementAdjustmentType,
  CalculateSettlementDto,
} from '@blue-royal/contracts';
import { Op } from 'sequelize';

export interface GeneratedSettlementLine {
  category: SettlementLineCategory;
  code: string;
  description: string;
  isManual: boolean;
  adjustmentType: SettlementAdjustmentType;
  quantity?: number | null;
  rate?: number | null;
  amount: number;
  calculationNotes?: string | null;
}

export interface SettlementCalculationOutput {
  employeeId: string;
  separationId: string;
  serviceStartDate: string;
  lastWorkingDay: string;
  totalServiceCalendarDays: number;
  unpaidLeaveDays: number;
  netServiceDays: number;
  serviceYears: number;
  remunerationBasis: 'hourly' | 'salaried';
  lastBasicSalary: number;
  dailyBasicWage: number;
  dailyGrossWage: number | null;
  gratuityAmount: number;
  gratuityWithheld: boolean;
  gratuityWithholdReason?: string | null;
  leaveBalanceDays: number;
  leaveSalaryAmount: number;
  airTicketAmount: number;
  finalWagesAmount: number;
  noticeShortfallAmount: number;
  grossAdditions: number;
  totalDeductions: number;
  netSettlementAmount: number;
  lines: GeneratedSettlementLine[];
}

export class SettlementCalculationService {
  /**
   * Prohibited deduction keywords per statutory mandate (BR-07)
   */
  private static readonly PROHIBITED_DEDUCTION_KEYWORDS = [
    'visa',
    'recruitment',
    'labor_card',
    'work_permit',
    'permit_fee',
    'immigration',
    'sponsorship',
  ];

  /**
   * Validate that a deduction line does not violate statutory UAE Labor Law protections against visa clawback.
   */
  public static validateAdjustmentLine(line: {
    category: string;
    code: string;
    description: string;
    adjustmentType: string;
    amount: number;
  }): void {
    if (line.adjustmentType === 'deduction') {
      const combinedText = `${line.code} ${line.description}`.toLowerCase();
      for (const kw of this.PROHIBITED_DEDUCTION_KEYWORDS) {
        if (combinedText.includes(kw)) {
          throw AppError.badRequest(
            `Statutory violation: Deductions for visa, recruitment, or work permit costs (${kw}) are strictly prohibited under UAE Labor Law (BR-07)`,
          );
        }
      }
    }
  }

  /**
   * Compute complete multi-component final settlement.
   */
  public static async calculateFullSettlement(
    dto: CalculateSettlementDto,
  ): Promise<SettlementCalculationOutput> {
    const separation = await EmployeeSeparation.findByPk(dto.separationId, {
      include: [{ model: Employee, as: 'employee' }],
    });
    if (!separation) {
      throw AppError.notFound(`Separation record ${dto.separationId} not found`);
    }

    const employee = separation.employee;
    if (!employee) {
      throw AppError.notFound(`Employee for separation ${dto.separationId} not found`);
    }

    const lastWorkingDay = separation.lastWorkingDay;
    const lines: GeneratedSettlementLine[] = [];

    // 1. Gratuity Calculation (BR-01, BR-02, BR-06)
    const gratuityResult = await GratuityCalculationService.calculateGratuity({
      employeeId: employee.id,
      lastWorkingDay,
      withholdGratuityArticle44: dto.withholdGratuityArticle44,
      withholdReason: dto.withholdReason,
    });

    if (gratuityResult.gratuityWithheld) {
      lines.push({
        category: 'statutory',
        code: 'GRATUITY_WITHHELD',
        description: 'End of Service Gratuity (Withheld under Article 44)',
        isManual: false,
        adjustmentType: 'addition',
        quantity: gratuityResult.serviceYears,
        rate: gratuityResult.dailyBasicWage,
        amount: 0.0,
        calculationNotes: gratuityResult.withholdReason,
      });
    } else if (gratuityResult.isEligible && gratuityResult.gratuityAmount > 0) {
      if (gratuityResult.tier1Gratuity > 0) {
        lines.push({
          category: 'statutory',
          code: 'GRATUITY_TIER1',
          description: `End of Service Gratuity - Tier 1 (${gratuityResult.tier1Years} yrs @ 21 days/yr)`,
          isManual: false,
          adjustmentType: 'addition',
          quantity: gratuityResult.tier1Years,
          rate: round2(21 * gratuityResult.dailyBasicWage),
          amount: gratuityResult.tier1Gratuity,
          calculationNotes: `Daily Basic Wage: AED ${gratuityResult.dailyBasicWage}`,
        });
      }

      if (gratuityResult.tier2Gratuity > 0) {
        lines.push({
          category: 'statutory',
          code: 'GRATUITY_TIER2',
          description: `End of Service Gratuity - Tier 2 (${gratuityResult.tier2Years} yrs @ 30 days/yr)`,
          isManual: false,
          adjustmentType: 'addition',
          quantity: gratuityResult.tier2Years,
          rate: round2(30 * gratuityResult.dailyBasicWage),
          amount: gratuityResult.tier2Gratuity,
          calculationNotes: `Daily Basic Wage: AED ${gratuityResult.dailyBasicWage}`,
        });
      }

      if (gratuityResult.isCapped) {
        lines.push({
          category: 'statutory',
          code: 'GRATUITY_CAP_ADJUSTMENT',
          description: 'Statutory 2-Year Basic Salary Gratuity Cap Adjustment',
          isManual: false,
          adjustmentType: 'deduction',
          amount: round2(gratuityResult.grossGratuity - gratuityResult.statutoryMaxCap),
          calculationNotes: `Cap: 24 * AED ${gratuityResult.monthlyBasicSalary} = AED ${gratuityResult.statutoryMaxCap}`,
        });
      }
    }

    // 2. Leave Salary Encashment (BR-03: Basic Wage only)
    const leaveResult = await LeaveEncashmentService.calculateLeaveEncashment({
      employeeId: employee.id,
      lastWorkingDay,
      dailyBasicWage: gratuityResult.dailyBasicWage,
    });

    if (leaveResult.leaveSalaryAmount > 0) {
      lines.push({
        category: 'leave',
        code: 'LEAVE_ENCASHMENT',
        description: `Unused Annual Leave Encashment (${leaveResult.remainingLeaveDays} days)`,
        isManual: false,
        adjustmentType: 'addition',
        quantity: leaveResult.remainingLeaveDays,
        rate: leaveResult.dailyBasicWage,
        amount: leaveResult.leaveSalaryAmount,
        calculationNotes: `Accrued remaining leave valued at Daily Basic Wage (AED ${leaveResult.dailyBasicWage})`,
      });
    } else if (leaveResult.recoveryAmount > 0) {
      lines.push({
        category: 'recovery',
        code: 'LEAVE_OVERDRAWN_RECOVERY',
        description: `Excess Leave Taken in Advance (${Math.abs(leaveResult.remainingLeaveDays)} days)`,
        isManual: false,
        adjustmentType: 'deduction',
        quantity: Math.abs(leaveResult.remainingLeaveDays),
        rate: leaveResult.dailyBasicWage,
        amount: leaveResult.recoveryAmount,
        calculationNotes: `Negative leave balance recovered at Daily Basic Wage (AED ${leaveResult.dailyBasicWage})`,
      });
    }

    // 3. Repatriation Air Ticket Entitlement (BR-04: Configurable policy)
    const airTicketResult = await AirTicketService.calculateAirTicketEntitlement({
      repatriationRequired: separation.repatriationRequired,
      hasNewUaeEmployment: separation.hasNewUaeEmployment,
      destinationCountry: separation.destinationCountry,
      manualOverrideAmount: dto.airTicketAllowanceOverride,
    });

    if (airTicketResult.isEligible && airTicketResult.entitlementAmount > 0) {
      lines.push({
        category: 'benefit',
        code: 'AIR_TICKET_ALLOWANCE',
        description: `Repatriation Flight Ticket Allowance (${airTicketResult.destinationCountry || 'Home Country'})`,
        isManual: false,
        adjustmentType: 'addition',
        amount: airTicketResult.entitlementAmount,
        calculationNotes: airTicketResult.notes,
      });
    }

    // 4. Final Month Unpaid Wages (Attendance Integration & Duplicate Payroll Prevention)
    const exitDate = new Date(lastWorkingDay);
    const exitYear = exitDate.getFullYear();
    const exitMonth = String(exitDate.getMonth() + 1).padStart(2, '0');
    const exitPeriodCode = `${exitYear}-${exitMonth}`;

    let finalWagesAmount = 0.0;
    const exitMonthFirstDay = `${exitYear}-${exitMonth}-01`;

    // Check if payroll period for this month is already finalized
    const existingPayrollPeriod = await PayrollPeriod.findOne({
      where: { periodCode: exitPeriodCode, status: 'finalized' },
    });

    if (existingPayrollPeriod) {
      // Regular monthly payroll already finalized and disbursed
      finalWagesAmount = 0.0;
    } else {
      // Calculate unpaid wages up to lastWorkingDay
      if (employee.remunerationBasis === 'hourly') {
        const attendancePeriod = await AttendancePeriod.findOne({
          where: { periodCode: exitPeriodCode },
        });

        if (attendancePeriod) {
          const records = await AttendanceRecord.findAll({
            where: {
              attendancePeriodId: attendancePeriod.id,
              employeeId: employee.id,
              date: {
                [Op.gte]: exitMonthFirstDay,
                [Op.lte]: lastWorkingDay,
              },
            },
          });

          // Fetch active hourly rates
          const hourlyRateRow = await EmployeeHourlyRate.findOne({
            where: {
              employeeId: employee.id,
              effectiveFrom: { [Op.lte]: lastWorkingDay },
              [Op.or]: [{ effectiveTo: null }, { effectiveTo: { [Op.gte]: lastWorkingDay } }],
            },
            order: [['effectiveFrom', 'DESC']],
          });

          const normRate = hourlyRateRow ? Number(hourlyRateRow.normalHourlyRate) : 0;
          const otRate = hourlyRateRow ? Number(hourlyRateRow.otHourlyRate) : 0;

          let totalRegHours = 0;
          let totalOtHours = 0;

          for (const r of records) {
            totalRegHours += Number(r.regularHours || 0);
            totalOtHours += Number(r.otHours || 0);
          }

          const regPay = round2(totalRegHours * normRate);
          const otPay = round2(totalOtHours * otRate);
          finalWagesAmount = round2(regPay + otPay);

          if (finalWagesAmount > 0) {
            lines.push({
              category: 'wage',
              code: 'FINAL_HOURLY_WAGES',
              description: `Final Month Wages (${exitMonthFirstDay} to ${lastWorkingDay}: ${totalRegHours}h Reg + ${totalOtHours}h OT)`,
              isManual: false,
              adjustmentType: 'addition',
              amount: finalWagesAmount,
              calculationNotes: `Regular Pay: AED ${regPay} | OT Pay: AED ${otPay}`,
            });
          }
        }
      } else {
        // Salaried: compute pro-rata salary for partial month
        const daysInMonth = new Date(exitYear, exitDate.getMonth() + 1, 0).getDate();
        const workedCalendarDays = exitDate.getDate();

        // Calculate monthly gross package
        const salaryStructures = await EmployeeSalaryStructure.findAll({
          where: {
            employeeId: employee.id,
            effectiveFrom: { [Op.lte]: lastWorkingDay },
            [Op.or]: [{ effectiveTo: null }, { effectiveTo: { [Op.gte]: lastWorkingDay } }],
          },
          include: [{ model: SalaryComponent, as: 'component' }],
        });

        let monthlyGrossPackage = 0;
        for (const s of salaryStructures) {
          if (s.component && s.component.type === 'earning') {
            monthlyGrossPackage += Number(s.amountOrPercentage || 0);
          }
        }

        const proRataFactor = workedCalendarDays / daysInMonth;
        finalWagesAmount = round2(monthlyGrossPackage * proRataFactor);

        if (finalWagesAmount > 0) {
          lines.push({
            category: 'wage',
            code: 'FINAL_SALARY_WAGES',
            description: `Final Month Wages (${workedCalendarDays}/${daysInMonth} calendar days)`,
            isManual: false,
            adjustmentType: 'addition',
            rate: round2(monthlyGrossPackage / daysInMonth),
            quantity: workedCalendarDays,
            amount: finalWagesAmount,
            calculationNotes: `Pro-rata gross package (AED ${monthlyGrossPackage}) for ${workedCalendarDays} days`,
          });
        }
      }
    }

    // 5. Notice Shortfall Calculation (Approved Rule BR-05: Gross wage basis for shortfall)
    let noticeShortfallAmount = 0.0;
    let dailyGrossWage: number | null = null;

    // Derive daily gross wage for notice calculation
    if (employee.remunerationBasis === 'hourly') {
      const hrRecord = await EmployeeHourlyRate.findOne({
        where: {
          employeeId: employee.id,
          effectiveFrom: { [Op.lte]: lastWorkingDay },
          [Op.or]: [{ effectiveTo: null }, { effectiveTo: { [Op.gte]: lastWorkingDay } }],
        },
        order: [['effectiveFrom', 'DESC']],
      });
      const hrRate = hrRecord ? Number(hrRecord.normalHourlyRate) : 0;
      dailyGrossWage = round2(hrRate * 8);
    } else {
      const structures = await EmployeeSalaryStructure.findAll({
        where: {
          employeeId: employee.id,
          effectiveFrom: { [Op.lte]: lastWorkingDay },
          [Op.or]: [{ effectiveTo: null }, { effectiveTo: { [Op.gte]: lastWorkingDay } }],
        },
        include: [{ model: SalaryComponent, as: 'component' }],
      });
      let grossMonthly = 0;
      for (const s of structures) {
        if (s.component && s.component.type === 'earning') {
          grossMonthly += Number(s.amountOrPercentage || 0);
        }
      }
      dailyGrossWage = round2(grossMonthly / 30.0);
    }

    if (separation.actualNoticeDays < separation.contractualNoticeDays) {
      const shortfallDays = separation.contractualNoticeDays - separation.actualNoticeDays;
      noticeShortfallAmount = round2(shortfallDays * (dailyGrossWage || gratuityResult.dailyBasicWage));

      if (noticeShortfallAmount > 0) {
        lines.push({
          category: 'deduction',
          code: 'NOTICE_SHORTFALL_DEDUCTION',
          description: `Contractual Notice Shortfall (${shortfallDays} unserved days)`,
          isManual: false,
          adjustmentType: 'deduction',
          quantity: shortfallDays,
          rate: dailyGrossWage || gratuityResult.dailyBasicWage,
          amount: noticeShortfallAmount,
          calculationNotes: `Gross wage in lieu of notice per UAE Labor Law Article 43 (BR-05)`,
        });
      }
    }

    // 6. Tally Gross Additions and Total Deductions
    let grossAdditions = 0.0;
    let totalDeductions = 0.0;

    for (const l of lines) {
      if (l.adjustmentType === 'addition') {
        grossAdditions += l.amount;
      } else {
        totalDeductions += l.amount;
      }
    }

    grossAdditions = round2(grossAdditions);
    totalDeductions = round2(totalDeductions);
    const netSettlementAmount = round2(Math.max(0, grossAdditions - totalDeductions));

    return {
      employeeId: employee.id,
      separationId: separation.id,
      serviceStartDate: gratuityResult.serviceStartDate,
      lastWorkingDay,
      totalServiceCalendarDays: gratuityResult.totalServiceCalendarDays,
      unpaidLeaveDays: gratuityResult.unpaidLeaveDays,
      netServiceDays: gratuityResult.netServiceDays,
      serviceYears: gratuityResult.serviceYears,
      remunerationBasis: employee.remunerationBasis as 'hourly' | 'salaried',
      lastBasicSalary: gratuityResult.monthlyBasicSalary,
      dailyBasicWage: gratuityResult.dailyBasicWage,
      dailyGrossWage,
      gratuityAmount: gratuityResult.gratuityAmount,
      gratuityWithheld: gratuityResult.gratuityWithheld,
      gratuityWithholdReason: gratuityResult.withholdReason,
      leaveBalanceDays: leaveResult.remainingLeaveDays,
      leaveSalaryAmount: leaveResult.leaveSalaryAmount,
      airTicketAmount: airTicketResult.entitlementAmount,
      finalWagesAmount,
      noticeShortfallAmount,
      grossAdditions,
      totalDeductions,
      netSettlementAmount,
      lines,
    };
  }
}
