import { Employee } from '../../masters/models/employee.model';
import { EmployeeHourlyRate } from '../../masters/models/employee-hourly-rate.model';
import { EmployeeSalaryStructure, SalaryComponent } from '../../masters/models/salary-component.model';
import { EmployeeLeaveBalance } from '../../leave/models/employee-leave-balance.model';
import { LeaveRequest } from '../../leave/models/leave-request.model';
import { LeaveType } from '../../leave/models/leave-type.model';
import { AppError } from '../../../core/errors/app-error';
import { round2 } from '../../../core/utils/math.util';
import { Op } from 'sequelize';

export interface GratuityCalculationResult {
  serviceStartDate: string;
  lastWorkingDay: string;
  totalServiceCalendarDays: number;
  unpaidLeaveDays: number;
  netServiceDays: number;
  serviceYears: number;
  remunerationBasis: 'hourly' | 'salaried';
  monthlyBasicSalary: number;
  dailyBasicWage: number;
  isEligible: boolean; // serviceYears >= 1.0
  tier1Years: number; // <= 5 years
  tier1Gratuity: number; // tier1Years * 21 * dailyBasicWage
  tier2Years: number; // > 5 years
  tier2Gratuity: number; // tier2Years * 30 * dailyBasicWage
  grossGratuity: number;
  isCapped: boolean;
  statutoryMaxCap: number; // 24 * monthlyBasicSalary
  gratuityAmount: number;
  gratuityWithheld: boolean;
  withholdReason?: string;
}

export class GratuityCalculationService {
  /**
   * Derive monthly basic salary for hourly workers per Rule BR-01:
   * Base Hourly Rate * 8 hours/day * 30 days
   */
  public static deriveBasicFromHourly(hourlyRate: number): number {
    return round2(hourlyRate * 8 * 30);
  }

  /**
   * Derive daily basic wage per Rule BR-02:
   * Fixed 30-day divisor
   */
  public static calculateDailyBasicWage(monthlyBasicSalary: number): number {
    return round2(monthlyBasicSalary / 30.0);
  }

  /**
   * Pure statutory calculation method for End of Service Gratuity
   */
  public static computeGratuityStatutory(params: {
    serviceStartDate: string;
    lastWorkingDay: string;
    unpaidLeaveDays?: number;
    monthlyBasicSalary: number;
    withholdGratuityArticle44?: boolean;
    withholdReason?: string;
  }): GratuityCalculationResult & { notes?: string; totalCalendarDays: number; maximumCapAmount: number; tier1Days: number; tier2Days: number } {
    const startDate = new Date(params.serviceStartDate);
    const endDate = new Date(params.lastWorkingDay);

    if (endDate < startDate) {
      throw AppError.badRequest(
        `Last working day (${params.lastWorkingDay}) cannot precede date of joining (${params.serviceStartDate})`,
      );
    }

    const diffTime = endDate.getTime() - startDate.getTime();
    const totalServiceCalendarDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const unpaidLeaveDays = params.unpaidLeaveDays || 0;
    const netServiceDays = Math.max(0, totalServiceCalendarDays - unpaidLeaveDays);
    const serviceYears = round2(netServiceDays / 365.0);

    const monthlyBasicSalary = round2(params.monthlyBasicSalary);
    const dailyBasicWage = this.calculateDailyBasicWage(monthlyBasicSalary);

    const isEligible = netServiceDays >= 365;
    let tier1Years = 0;
    let tier1Gratuity = 0;
    let tier2Years = 0;
    let tier2Gratuity = 0;
    let grossGratuity = 0;
    let isCapped = false;
    const statutoryMaxCap = round2(24 * monthlyBasicSalary);

    let tier1Days = 0;
    let tier2Days = 0;

    if (isEligible) {
      if (serviceYears <= 5.0) {
        tier1Years = serviceYears;
        tier1Days = round2(tier1Years * 21);
        tier1Gratuity = round2(tier1Days * dailyBasicWage);
      } else {
        tier1Years = 5.0;
        tier1Days = 5.0 * 21;
        tier1Gratuity = round2(tier1Days * dailyBasicWage);

        tier2Years = round2(serviceYears - 5.0);
        tier2Days = round2(tier2Years * 30);
        tier2Gratuity = round2(tier2Days * dailyBasicWage);
      }

      grossGratuity = round2(tier1Gratuity + tier2Gratuity);
      if (grossGratuity > statutoryMaxCap) {
        isCapped = true;
      }
    }

    let gratuityAmount = isCapped ? statutoryMaxCap : grossGratuity;

    let gratuityWithheld = false;
    let withholdReason: string | undefined;

    if (params.withholdGratuityArticle44) {
      gratuityWithheld = true;
      withholdReason =
        params.withholdReason || 'Withheld under UAE Labor Law Article 44 pending legal review';
      gratuityAmount = 0.0;
    }

    let notes = '';
    if (!isEligible) {
      notes = 'No gratuity due: Continuous service less than 1 year';
    } else if (isCapped) {
      notes = 'Capped at 2 years basic salary statutory ceiling';
    }

    return {
      serviceStartDate: params.serviceStartDate,
      lastWorkingDay: params.lastWorkingDay,
      totalCalendarDays: totalServiceCalendarDays,
      totalServiceCalendarDays,
      unpaidLeaveDays,
      netServiceDays,
      serviceYears,
      remunerationBasis: 'salaried',
      monthlyBasicSalary,
      dailyBasicWage,
      isEligible,
      tier1Years,
      tier1Days,
      tier1Gratuity,
      tier2Years,
      tier2Days,
      tier2Gratuity,
      grossGratuity,
      isCapped,
      maximumCapAmount: statutoryMaxCap,
      statutoryMaxCap,
      gratuityAmount,
      gratuityWithheld,
      withholdReason,
      notes,
    };
  }

  /**
   * Calculate statutory UAE End of Service Gratuity strictly per Federal Decree-Law No. 33 of 2021 Article 51.
   * Approved Rules:
   * - BR-01: Hourly gratuity basis = Base Hourly Rate * 8 hours/day * 30 days.
   * - BR-02: Daily wage divisor = Fixed 30-day divisor.
   * - BR-06: Controlled Article 44 withhold mechanism with explicit audit trail.
   */
  public static async calculateGratuity(params: {
    employeeId: string;
    lastWorkingDay: string;
    withholdGratuityArticle44?: boolean;
    withholdReason?: string;
  }): Promise<GratuityCalculationResult> {
    const employee = await Employee.findByPk(params.employeeId);
    if (!employee) {
      throw AppError.notFound(`Employee ${params.employeeId} not found`);
    }

    const serviceStartDate = employee.dateOfJoining;
    const lastWorkingDay = params.lastWorkingDay;

    const startDate = new Date(serviceStartDate);
    const endDate = new Date(lastWorkingDay);

    if (endDate < startDate) {
      throw AppError.badRequest(
        `Last working day (${lastWorkingDay}) cannot precede date of joining (${serviceStartDate})`,
      );
    }

    // 1. Calendar service duration
    const diffTime = endDate.getTime() - startDate.getTime();
    const totalServiceCalendarDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // 2. Query unpaid leave days between serviceStartDate and lastWorkingDay
    // In accordance with UAE Labor Law Article 51, unpaid leave days are excluded from continuous service.
    const unpaidLeaveTypes = await LeaveType.findAll({
      where: { isPaid: false },
      attributes: ['id'],
    });
    const unpaidTypeIds = unpaidLeaveTypes.map((t) => t.id);

    let unpaidLeaveDays = 0;
    if (unpaidTypeIds.length > 0) {
      const unpaidRequests = await LeaveRequest.findAll({
        where: {
          employeeId: params.employeeId,
          leaveTypeId: { [Op.in]: unpaidTypeIds },
          status: 'approved',
          startDate: { [Op.lte]: lastWorkingDay },
          endDate: { [Op.gte]: serviceStartDate },
        },
      });

      for (const req of unpaidRequests) {
        unpaidLeaveDays += Number(req.totalDays || 0);
      }
    }

    const netServiceDays = Math.max(0, totalServiceCalendarDays - unpaidLeaveDays);
    const serviceYears = round2(netServiceDays / 365.0);

    // 3. Determine Basic Salary & Daily Wage based on remuneration basis
    let monthlyBasicSalary = 0;
    const remunerationBasis = (employee.remunerationBasis as 'hourly' | 'salaried') || 'salaried';

    if (remunerationBasis === 'hourly') {
      // BR-01 Approved Rule: Base Hourly Rate * 8 hours/day * 30 days
      const rateRecord = await EmployeeHourlyRate.findOne({
        where: {
          employeeId: params.employeeId,
          effectiveFrom: { [Op.lte]: lastWorkingDay },
          [Op.or]: [{ effectiveTo: null }, { effectiveTo: { [Op.gte]: lastWorkingDay } }],
        },
        order: [['effectiveFrom', 'DESC']],
      });

      if (!rateRecord) {
        throw AppError.badRequest(
          `No active hourly rate found for employee ${employee.employeeCode} on last working day (${lastWorkingDay})`,
        );
      }

      const hourlyRate = Number(rateRecord.normalHourlyRate);
      monthlyBasicSalary = round2(hourlyRate * 8 * 30);
    } else {
      // Salaried: Query active salary structure with isWpsBasic = true
      const basicComponents = await SalaryComponent.findAll({
        where: { isWpsBasic: true, isActive: true },
        attributes: ['id'],
      });
      const basicComponentIds = basicComponents.map((c) => c.id);

      const structures = await EmployeeSalaryStructure.findAll({
        where: {
          employeeId: params.employeeId,
          componentId: { [Op.in]: basicComponentIds },
          effectiveFrom: { [Op.lte]: lastWorkingDay },
          [Op.or]: [{ effectiveTo: null }, { effectiveTo: { [Op.gte]: lastWorkingDay } }],
        },
        order: [['effectiveFrom', 'DESC']],
      });

      if (structures.length === 0) {
        throw AppError.badRequest(
          `No active basic salary structure found for employee ${employee.employeeCode} on last working day (${lastWorkingDay})`,
        );
      }

      monthlyBasicSalary = round2(Number(structures[0].amountOrPercentage));
    }

    // BR-02 Approved Rule: Fixed 30-day divisor
    const dailyBasicWage = round2(monthlyBasicSalary / 30.0);

    // 4. Eligibility Check: Minimum 1 continuous year of service
    const isEligible = netServiceDays >= 365;

    let tier1Years = 0;
    let tier1Gratuity = 0;
    let tier2Years = 0;
    let tier2Gratuity = 0;
    let grossGratuity = 0;
    let isCapped = false;
    const statutoryMaxCap = round2(24 * monthlyBasicSalary); // 2 years' basic salary max cap

    if (isEligible) {
      if (serviceYears <= 5.0) {
        tier1Years = serviceYears;
        tier1Gratuity = round2(tier1Years * 21 * dailyBasicWage);
      } else {
        tier1Years = 5.0;
        tier1Gratuity = round2(5.0 * 21 * dailyBasicWage);
        tier2Years = round2(serviceYears - 5.0);
        tier2Gratuity = round2(tier2Years * 30 * dailyBasicWage);
      }

      grossGratuity = round2(tier1Gratuity + tier2Gratuity);

      if (grossGratuity > statutoryMaxCap) {
        isCapped = true;
      }
    }

    let gratuityAmount = isCapped ? statutoryMaxCap : grossGratuity;

    // BR-06 Approved Rule: Controlled Article 44 withhold mechanism
    let gratuityWithheld = false;
    let withholdReason: string | undefined;

    if (params.withholdGratuityArticle44) {
      gratuityWithheld = true;
      withholdReason =
        params.withholdReason || 'Withheld under UAE Labor Law Article 44 pending legal review';
      gratuityAmount = 0.0;
    }

    return {
      serviceStartDate,
      lastWorkingDay,
      totalServiceCalendarDays,
      unpaidLeaveDays,
      netServiceDays,
      serviceYears,
      remunerationBasis,
      monthlyBasicSalary,
      dailyBasicWage,
      isEligible,
      tier1Years,
      tier1Gratuity,
      tier2Years,
      tier2Gratuity,
      grossGratuity,
      isCapped,
      statutoryMaxCap,
      gratuityAmount,
      gratuityWithheld,
      withholdReason,
    };
  }
}
