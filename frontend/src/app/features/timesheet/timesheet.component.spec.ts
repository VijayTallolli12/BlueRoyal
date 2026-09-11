import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TimesheetComponent, TimesheetEmployeeRow } from './timesheet.component';
import { AttendanceApiService } from '../../core/services/attendance-api.service';
import { MasterService } from '../../core/services/master.service';

describe('TimesheetComponent', () => {
  let component: TimesheetComponent;
  let fixture: ComponentFixture<TimesheetComponent>;
  let attendanceApi: jasmine.SpyObj<AttendanceApiService>;
  let masterService: jasmine.SpyObj<MasterService>;

  beforeEach(async () => {
    attendanceApi = jasmine.createSpyObj('AttendanceApiService', [
      'listPeriods',
      'getGrid',
      'batchUpdateRecords',
      'downloadTemplate',
      'importExcel',
    ]);
    masterService = jasmine.createSpyObj('MasterService', ['getEmployees']);

    attendanceApi.listPeriods.and.returnValue(
      of({
        success: true,
        data: [
          {
            id: 'period-1',
            periodCode: '2026-09',
            name: 'September 2026',
            status: 'active' as const,
            startDate: '2026-09-01',
            endDate: '2026-09-30',
          },
        ],
        meta: { correlationId: 'c-1', timestamp: new Date().toISOString() },
      }),
    );

    attendanceApi.getGrid.and.returnValue(
      of({
        success: true,
        data: {
          period: {
            id: 'period-1',
            periodCode: '2026-09',
            name: 'September 2026',
            status: 'active' as const,
            startDate: '2026-09-01',
            endDate: '2026-09-30',
          },
          dates: ['2026-09-01', '2026-09-02'],
          rows: [
            {
              employeeId: 'emp-1',
              employeeCode: 'EMP001',
              employeeName: 'Ahmed Al-Mansoor',
              designationTitle: 'Senior Engineer',
              shiftName: 'Standard Day (8h)',
              shiftWorkHours: 8,
              totalActualHours: 16,
              totalOtHours: 0,
              records: {
                '2026-09-01': {
                  id: 'rec-1',
                  workDate: '2026-09-01',
                  actualHours: 8,
                  dayType: 'regular_workday',
                },
                '2026-09-02': {
                  id: 'rec-2',
                  workDate: '2026-09-02',
                  actualHours: 8,
                  dayType: 'regular_workday',
                },
              },
            },
          ],
          summary: {
            totalEmployees: 1,
            totalActualHours: 16,
            totalRegularHours: 16,
            totalOtHours: 0,
            totalAbsences: 0,
            totalAnomalies: 0,
          },
        },
        meta: { correlationId: 'c-2', timestamp: new Date().toISOString() },
      }),
    );

    attendanceApi.batchUpdateRecords.and.returnValue(
      of({
        success: true,
        data: { updatedCount: 1, newPeriodStatus: 'active' },
        meta: { correlationId: 'c-3', timestamp: new Date().toISOString() },
      }),
    );

    await TestBed.configureTestingModule({
      imports: [TimesheetComponent],
      providers: [
        { provide: AttendanceApiService, useValue: attendanceApi },
        { provide: MasterService, useValue: masterService },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TimesheetComponent);
    component = fixture.componentInstance;
    component.selectedMonth.set('2026-09');
    fixture.detectChanges();
  });

  it('should render sticky summary columns: Employee, Total Hours, and OT', () => {
    const el: HTMLElement = fixture.nativeElement;
    const thEmp = el.querySelector('th.col-sticky-emp');
    const thTotal = el.querySelector('th.col-sticky-total');
    const thOt = el.querySelector('th.col-sticky-ot');

    expect(thEmp).toBeTruthy();
    expect(thTotal).toBeTruthy();
    expect(thOt).toBeTruthy();
    expect(thEmp?.textContent).toContain('Employee');
    expect(thTotal?.textContent).toContain('Total Hours');
    expect(thOt?.textContent).toContain('OT');

    const tdEmp = el.querySelector('td.col-sticky-emp');
    const tdTotal = el.querySelector('td.col-sticky-total');
    const tdOt = el.querySelector('td.col-sticky-ot');

    expect(tdEmp).toBeTruthy();
    expect(tdTotal).toBeTruthy();
    expect(tdOt).toBeTruthy();
    expect(tdEmp?.textContent).toContain('Ahmed Al-Mansoor');
  });

  it('should enter edit mode when clicking on a day cell', () => {
    const rows = component.employeeRows();
    expect(rows.length).toBeGreaterThan(0);
    const emp = rows[0];

    const fakeEvent = new MouseEvent('click');
    component.startCellEdit(emp, 1, fakeEvent);

    expect(component.isEditing(emp.id, 1)).toBe(true);
    expect(component.editValue).toBe('8');
  });

  it('should save changed hours, recalculate Total Hours and OT using shift rules on blur', () => {
    const rows = component.employeeRows();
    const emp = rows[0];

    // Day 1: change from 8h to 10h (with 8h shift, OT should be 2h)
    component.startCellEdit(emp, 1, new MouseEvent('click'));
    component.editValue = '10';

    component.onCellBlur(emp, 1);

    expect(component.isEditing(emp.id, 1)).toBe(false);
    expect(emp.dailyHours[1]).toBe(10);
    // Day 1 (10h) + Day 2 (8h) = 18h
    expect(emp.totalHours).toBe(18);
    // Shift is 8h: Day 1 has 2h OT, Day 2 has 0h OT -> total OT = 2h
    expect(emp.ot).toBe(2);

    expect(attendanceApi.batchUpdateRecords).toHaveBeenCalledWith(
      'period-1',
      jasmine.objectContaining({
        records: jasmine.arrayContaining([
          jasmine.objectContaining({
            recordId: 'rec-1',
            employeeId: 'emp-1',
            actualHours: 10,
          }),
        ]),
      }),
    );
  });

  it('should handle decreasing hours e.g. 8h to 7h with 0 OT', () => {
    const rows = component.employeeRows();
    const emp = rows[0];

    component.startCellEdit(emp, 1, new MouseEvent('click'));
    component.editValue = '7';

    component.onCellBlur(emp, 1);

    expect(emp.dailyHours[1]).toBe(7);
    // Day 1 (7h) + Day 2 (8h) = 15h
    expect(emp.totalHours).toBe(15);
    expect(emp.ot).toBe(0);
  });

  it('should render the Download column in header and body', () => {
    const el: HTMLElement = fixture.nativeElement;
    const thDownload = el.querySelector('th.col-download');
    const tdDownload = el.querySelector('td.col-download');
    const btnDownload = el.querySelector('.btn-download-row');

    expect(thDownload).toBeTruthy();
    expect(thDownload?.textContent).toContain('Download');
    expect(tdDownload).toBeTruthy();
    expect(btnDownload?.textContent).toContain('Download Excel');
  });

  it('should update selected month and reload when month index changes', () => {
    component.selectedYear.set(2026);
    component.onMonthIndexChange(9); // October (index 9)

    expect(component.selectedMonthIndex()).toBe(9);
    expect(component.selectedMonth()).toBe('2026-10');
    expect(component.formattedSelectedMonth()).toBe('October 2026');
    expect(attendanceApi.listPeriods).toHaveBeenCalled();
  });

  it('should update selected year and reload when year changes', () => {
    component.selectedMonthIndex.set(8); // September (index 8)
    component.onYearChange(2027);

    expect(component.selectedYear()).toBe(2027);
    expect(component.selectedMonth()).toBe('2027-09');
    expect(component.formattedSelectedMonth()).toBe('September 2027');
    expect(attendanceApi.listPeriods).toHaveBeenCalled();
  });

  it('should trigger single employee Excel download without throwing', () => {
    const rows = component.employeeRows();
    const emp = rows[0];
    spyOn(window.URL, 'createObjectURL').and.returnValue('blob:fake-url');
    spyOn(window.URL, 'revokeObjectURL');

    component.downloadSingleEmployee(emp);

    expect(component.successMessage()).toContain('Downloaded timesheet for Ahmed Al-Mansoor');
  });

  it('should trigger all employees Excel download without throwing', () => {
    spyOn(window.URL, 'createObjectURL').and.returnValue('blob:fake-url');
    spyOn(window.URL, 'revokeObjectURL');

    component.downloadAllEmployeesTimesheet();

    expect(component.successMessage()).toContain('Downloaded timesheet for all employees');
  });

  it('should invoke attendanceApi.importExcel when importing attendance file', () => {
    attendanceApi.importExcel.and.returnValue(
      of({
        success: true,
        data: {
          validRows: 15,
          errorRows: 0,
          createdRecords: 15,
          updatedRecords: 0,
          unchangedRecords: 0,
          anomaliesDetected: 0,
          errors: [],
          anomalies: [],
          warnings: [],
        },
        meta: { correlationId: 'c-import', timestamp: new Date().toISOString() },
      }),
    );

    const fakeFile = new File(['content'], 'attendance.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const fakeEvent = {
      target: {
        files: [fakeFile],
        value: 'attendance.xlsx',
      },
    } as unknown as Event;

    component.onImportAttendanceFile(fakeEvent);

    expect(attendanceApi.importExcel).toHaveBeenCalledWith('period-1', fakeFile, false);
  });
});


