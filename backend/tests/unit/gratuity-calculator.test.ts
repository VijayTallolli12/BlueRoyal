import { GratuityCalculationService } from '../../src/modules/settlement/services/gratuity-calculator.service';

describe('Phase 6: GratuityCalculationService Unit Tests', () => {
  describe('Service Duration & Statutory Eligibility (< 1 Year)', () => {
    it('should return 0.00 gratuity when net service duration is less than 1 full year (364 days)', () => {
      const result = GratuityCalculationService.computeGratuityStatutory({
        serviceStartDate: '2025-01-01',
        lastWorkingDay: '2025-12-30', // 364 days
        unpaidLeaveDays: 0,
        monthlyBasicSalary: 10000,
      });

      expect(result.isEligible).toBe(false);
      expect(result.gratuityAmount).toBe(0);
      expect(result.totalCalendarDays).toBe(364);
      expect(result.netServiceDays).toBe(364);
      expect(result.serviceYears).toBeCloseTo(364 / 365, 2);
      expect(result.notes).toContain('No gratuity due');
    });

    it('should become eligible on exactly 365 days (1 full year) and calculate 21 days basic salary', () => {
      const result = GratuityCalculationService.computeGratuityStatutory({
        serviceStartDate: '2025-01-01',
        lastWorkingDay: '2025-12-31', // 365 days
        unpaidLeaveDays: 0,
        monthlyBasicSalary: 6000, // daily basic = 6000 / 30 = 200
      });

      expect(result.isEligible).toBe(true);
      expect(result.totalCalendarDays).toBe(365);
      expect(result.netServiceDays).toBe(365);
      expect(result.serviceYears).toBe(1);
      // 1 year * 21 days/year * 200/day = 4200.00
      expect(result.gratuityAmount).toBe(4200.0);
    });

    it('should deduct unpaid leave days from service duration and disqualify if net drops below 1 year', () => {
      const result = GratuityCalculationService.computeGratuityStatutory({
        serviceStartDate: '2025-01-01',
        lastWorkingDay: '2026-01-10', // 375 days
        unpaidLeaveDays: 20, // net = 355 days (< 365)
        monthlyBasicSalary: 6000,
      });

      expect(result.isEligible).toBe(false);
      expect(result.totalCalendarDays).toBe(375);
      expect(result.unpaidLeaveDays).toBe(20);
      expect(result.netServiceDays).toBe(355);
      expect(result.gratuityAmount).toBe(0);
    });
  });

  describe('Multi-Tier Calculation (1 to 5 Years vs > 5 Years)', () => {
    it('should calculate 21 days/year for exactly 3 years', () => {
      // 3 years = 1095 days (or 1096 in leap year). Monthly basic = 9,000 => daily = 300
      const result = GratuityCalculationService.computeGratuityStatutory({
        serviceStartDate: '2023-01-01',
        lastWorkingDay: '2025-12-31', // 1096 days. 1096 / 365 = 3.0027 => round2 is 3.00
        unpaidLeaveDays: 0,
        monthlyBasicSalary: 9000,
      });

      expect(result.isEligible).toBe(true);
      expect(result.serviceYears).toBe(3.0);
      // 3.0 * 21 days * 300 = 18,900.00
      expect(result.gratuityAmount).toBe(18900.0);
      expect(result.tier1Days).toBe(63.0);
      expect(result.tier2Days).toBe(0);
    });

    it('should calculate 21 days for first 5 years and 30 days for subsequent years (e.g. 7 years)', () => {
      // 7 years: Tier 1 = 5 * 21 = 105 days. Tier 2 = 2 * 30 = 60 days. Total = 165 days.
      // Daily basic = 3000 / 30 = 100.
      // Total Gratuity = 165 * 100 = 16,500.00
      const result = GratuityCalculationService.computeGratuityStatutory({
        serviceStartDate: '2019-01-01',
        lastWorkingDay: '2025-12-28',
        unpaidLeaveDays: 0,
        monthlyBasicSalary: 3000,
      });

      expect(result.isEligible).toBe(true);
      expect(result.tier1Days).toBe(105); // 5 * 21
      expect(result.tier2Days).toBeGreaterThan(59);
      expect(result.isCapped).toBe(false);
    });
  });

  describe('Statutory 2-Year Basic Salary Cap (Article 51(3))', () => {
    it('should cap gratuity at 2 years of basic wage (24 × monthlyBasicSalary)', () => {
      // Monthly basic = 5000 => Cap = 5000 * 24 = 120,000
      // 30 years of service:
      // Tier 1: 5 * 21 = 105 days
      // Tier 2: 25 * 30 = 750 days
      // Total = 855 days * (5000 / 30 = 166.6667) = 142,500 > 120,000 cap
      const result = GratuityCalculationService.computeGratuityStatutory({
        serviceStartDate: '1995-01-01',
        lastWorkingDay: '2025-01-01', // 30+ years
        unpaidLeaveDays: 0,
        monthlyBasicSalary: 5000,
      });

      expect(result.isEligible).toBe(true);
      expect(result.maximumCapAmount).toBe(120000.0);
      expect(result.isCapped).toBe(true);
      expect(result.gratuityAmount).toBe(120000.0);
      expect(result.notes).toContain('Capped at 2 years basic salary');
    });
  });

  describe('Hourly Remuneration Conversion (Rule BR-01)', () => {
    it('should calculate monthly basic salary as baseHourlyRate * 8 * 30', () => {
      const derived = GratuityCalculationService.deriveBasicFromHourly(25.0);
      // 25 * 8 * 30 = 6,000.00
      expect(derived).toBe(6000.0);
    });

    it('should calculate daily basic wage as monthlyBasicSalary / 30', () => {
      const daily = GratuityCalculationService.calculateDailyBasicWage(6000.0);
      expect(daily).toBe(200.0);
    });
  });

  describe('Article 44 Separation Withholding Policy (Rule BR-06)', () => {
    it('should NOT automatically forfeit gratuity on Article 44 separation', () => {
      // Article 44 dismissal without explicit withhold flag should still calculate gratuity
      const result = GratuityCalculationService.computeGratuityStatutory({
        serviceStartDate: '2023-01-01',
        lastWorkingDay: '2025-01-01', // 2 years
        unpaidLeaveDays: 0,
        monthlyBasicSalary: 6000,
      });

      expect(result.isEligible).toBe(true);
      expect(result.gratuityAmount).toBeGreaterThan(0);
      // Federal Decree-Law No. 33 of 2021 abolished automatic forfeiture
    });
  });
});
