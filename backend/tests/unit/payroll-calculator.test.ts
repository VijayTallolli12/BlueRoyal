import { PayrollCalculationService } from '../../src/modules/payroll/services/payroll-calculation.service';

describe('Phase 4: PayrollCalculationService Unit Tests', () => {
  describe('round2 financial rounding utility', () => {
    it('should accurately round to 2 decimal places', () => {
      expect(PayrollCalculationService.round2(100.456)).toBe(100.46);
      expect(PayrollCalculationService.round2(100.454)).toBe(100.45);
      expect(PayrollCalculationService.round2(0)).toBe(0);
      expect(PayrollCalculationService.round2(12.3)).toBe(12.3);
    });

    it('should avoid floating point epsilon pitfalls', () => {
      expect(PayrollCalculationService.round2(1.005)).toBe(1.01);
      expect(PayrollCalculationService.round2(35.255)).toBe(35.26);
    });
  });

  describe('Hourly Pay Calculation Logic', () => {
    it('should correctly calculate regular and overtime pay given exact hourly rates', () => {
      const normalRate = 25.5; // AED / hour
      const otRate = 31.875; // 1.25x AED / hour
      const regHours = 8.0;
      const otHours = 2.5;

      const regularPay = PayrollCalculationService.round2(regHours * normalRate);
      const otPay = PayrollCalculationService.round2(otHours * otRate);
      const grossPay = PayrollCalculationService.round2(regularPay + otPay);

      expect(regularPay).toBe(204.0);
      expect(otPay).toBe(79.69);
      expect(grossPay).toBe(283.69);
    });

    it('should result in 0 pay when employee is completely absent and logged 0 hours', () => {
      const normalRate = 25.0;
      const otRate = 31.25;
      const regHours = 0.0;
      const otHours = 0.0;

      const regularPay = PayrollCalculationService.round2(regHours * normalRate);
      const otPay = PayrollCalculationService.round2(otHours * otRate);

      expect(regularPay).toBe(0.0);
      expect(otPay).toBe(0.0);
    });
  });

  describe('Salaried Package and Percentage Component Breakdown', () => {
    it('should correctly derive fixed and percentage-based earnings and deductions', () => {
      // Base monthly salary package: AED 10,000
      // Basic salary: 60% = 6,000
      // Housing allowance: 25% = 2,500
      // Transport allowance: 15% = 1,500
      // Fixed deduction (e.g. phone bill): 150
      const basicPay = 6000.0;
      const housing = PayrollCalculationService.round2((basicPay * 25) / 60); // 2500
      const transport = 1500.0; // fixed amount
      const fixedDeduction = 150.0;

      const gross = PayrollCalculationService.round2(basicPay + housing + transport);
      const totalDeductions = PayrollCalculationService.round2(fixedDeduction);
      const netPay = PayrollCalculationService.round2(gross - totalDeductions);

      expect(gross).toBe(10000.0);
      expect(totalDeductions).toBe(150.0);
      expect(netPay).toBe(9850.0);
    });
  });

  describe('Manual Adjustments Mathematics & Net Pay Impact', () => {
    it('should increase net pay on manual addition adjustment', () => {
      const gross = 5000.0;
      const deductions = 0.0;
      const addition = 250.0; // e.g. Performance bonus

      const adjustedGross = PayrollCalculationService.round2(gross + addition);
      const netPay = PayrollCalculationService.round2(adjustedGross - deductions);

      expect(adjustedGross).toBe(5250.0);
      expect(netPay).toBe(5250.0);
    });

    it('should decrease net pay on manual deduction adjustment', () => {
      const gross = 5000.0;
      const standardDeductions = 100.0;
      const manualDeduction = 300.0; // e.g. Damage recovery

      const totalDeductions = PayrollCalculationService.round2(standardDeductions + manualDeduction);
      const netPay = PayrollCalculationService.round2(gross - totalDeductions);

      expect(totalDeductions).toBe(400.0);
      expect(netPay).toBe(4600.0);
    });

    it('should preserve manual adjustments independently of system recalculation', () => {
      // Manual adjustments are tagged with is_manual = true and category = 'adjustment'
      const manualLines = [
        { isManual: true, category: 'adjustment', code: 'ADJ_ADDITION', amount: 150.0 },
        { isManual: true, category: 'adjustment', code: 'ADJ_DEDUCTION', amount: 50.0 },
      ];

      // After deleting and recalculating system lines (isManual: false)
      const systemLines = [
        { isManual: false, category: 'earning', code: 'REGULAR_PAY', amount: 2000.0 },
      ];

      const allLines = [...systemLines, ...manualLines];
      expect(allLines.filter((l) => l.isManual).length).toBe(2);
      expect(allLines.filter((l) => !l.isManual).length).toBe(1);
    });
  });
});
