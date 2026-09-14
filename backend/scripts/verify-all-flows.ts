import { Client } from '../src/modules/masters/models/client.model';
import { Project } from '../src/modules/masters/models/project.model';
import { Designation } from '../src/modules/masters/models/designation.model';
import { Employee } from '../src/modules/masters/models/employee.model';
import { AttendancePeriod } from '../src/modules/attendance/models/attendance-period.model';
import { AttendanceRecord } from '../src/modules/attendance/models/attendance-record.model';
import { AttendancePeriodService } from '../src/modules/attendance/services/attendance-period.service';
import { TimesheetService } from '../src/modules/timesheet/timesheet.service';
import { sequelize } from '../src/core/database/sequelize';

import { User } from '../src/modules/auth/models/user.model';

async function runVerification() {
  await sequelize.authenticate();
  console.log('=== STARTING COMPLETE TIMESHEET WORKFLOW VERIFICATION ===\n');

  const adminUser = await User.findOne();
  if (!adminUser) {
    console.error('No admin user found in database!');
    process.exit(1);
  }
  const actorId = adminUser.id;

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // --- Flow A: Select September 2026 ---
  const periodSep = await AttendancePeriod.findOne({ where: { periodCode: '2026-09' } });
  assert(!!periodSep, 'Flow A: September 2026 period exists');
  const dSep = new Date(2026, 9, 0).getDate();
  assert(dSep === 30, 'Flow A: September 2026 has exactly 30 days');

  // --- Flow B: Select Client -> verify only that client's projects appear ---
  const client = await Client.findOne({ where: { code: 'CL-DEMO-01' } });
  assert(!!client, 'Flow B: Client Blue Royal Client Partner exists');
  const clientProjects = await Project.findAll({ where: { clientId: client!.id } });
  assert(clientProjects.length > 0 && clientProjects.every(p => p.clientId === client!.id), 'Flow B: Only projects for selected client returned');
  const downtownProject = clientProjects.find(p => p.code === 'PRJ-DEMO-01');
  assert(!!downtownProject, 'Flow B: Downtown Dubai Project found under Client');

  // --- Flow C: Select Project -> verify assigned employees appear ---
  const projectEmployees = await TimesheetService.getProjectEmployees(downtownProject!.id);
  assert(projectEmployees.length >= 2, `Flow C: Project employees found (${projectEmployees.length} employees)`);

  // --- Flow D: Select Supervisor -> verify project supervisor relationship works ---
  const supervisors = await TimesheetService.getProjectSupervisors(downtownProject!.id);
  assert(supervisors.length === 1 && !!supervisors[0].name, `Flow D: Project supervisor resolved (${supervisors[0]?.name})`);

  // --- Flow E: Select Profession -> verify only designations used by that project appear ---
  const projectDesignations = await TimesheetService.getProjectDesignations(downtownProject!.id);
  const titles = projectDesignations.map(d => d.title);
  assert(titles.includes('Mason'), 'Flow E: Project designations include Mason');
  assert(titles.includes('Steel Fixer'), 'Flow E: Project designations include Steel Fixer');
  assert(!titles.includes('Specialist P5 054034'), 'Flow E: Unrelated global designations are NOT included');

  // --- Flow F: Select Profession = Mason -> verify only assigned Mason employees appear ---
  const masonDesignation = projectDesignations.find(d => d.title === 'Mason');
  assert(!!masonDesignation, 'Flow F: Mason designation found');
  const masonEmployees = await TimesheetService.getProjectEmployees(downtownProject!.id, masonDesignation!.id);
  assert(masonEmployees.length >= 1 && masonEmployees.every(e => e.designationTitle === 'Mason'), 'Flow F: Only Mason employees appear when filtered by Mason');

  // Grid check for Mason
  const masonGrid = await AttendancePeriodService.getGrid(periodSep!.id, {
    clientId: client!.id,
    projectId: downtownProject!.id,
    designationId: masonDesignation!.id,
  });
  assert(masonGrid.rows.length >= 1 && masonGrid.rows.every(r => r.designationTitle === 'Mason'), 'Flow F: Attendance Grid rows match Mason filter');

  // --- Flow G: Click daily cell. Change: 8 -> 7. Blur -> saved to backend, row & daily totals change ---
  const masonRow = masonGrid.rows[0];
  const testDay = 15; // Day 15 (2026-09-15 is Tuesday, regular workday)
  const testDate = '2026-09-15';
  const cellBefore = await AttendanceRecord.findOne({
    where: { attendancePeriodId: periodSep!.id, employeeId: masonRow.employeeId, workDate: testDate }
  });
  assert(!!cellBefore, 'Flow G: Day 15 attendance record exists before edit');

  // Update cell 8 -> 7 via batchUpdateRecords
  await AttendancePeriodService.batchUpdateRecords(periodSep!.id, {
    batchReason: 'Timesheet daily cell edit',
    records: [{
      recordId: cellBefore!.id,
      employeeId: masonRow.employeeId,
      workDate: testDate,
      actualHours: 7.0,
      changeReason: 'Daily cell edit: 8h -> 7h',
    }]
  }, actorId);

  // Verify persistence
  const cellAfter = await AttendanceRecord.findByPk(cellBefore!.id);
  assert(Number(cellAfter!.actualHours) === 7.0, 'Flow G: Database preserved actualHours = 7.0');
  assert(Number(cellAfter!.regularHours) === 7.0, 'Flow G: Database regularHours recalculated = 7.0');
  assert(Number(cellAfter!.otHours) === 0.0, 'Flow G: Database otHours = 0.0');

  // Verify grid totals reflect change
  const gridAfterEdit = await AttendancePeriodService.getGrid(periodSep!.id, {
    clientId: client!.id,
    projectId: downtownProject!.id,
    designationId: masonDesignation!.id,
  });
  const updatedRow = gridAfterEdit.rows.find(r => r.employeeId === masonRow.employeeId);
  const day15Cell = updatedRow?.days ? updatedRow.days[15] : updatedRow?.records?.[testDate];
  assert(Number(day15Cell.actualHours) === 7.0, 'Flow G: Grid returns 7.0 for day 15');

  // --- Flow H: Enter OT where supported -> verify Regular and OT remain separate ---
  await AttendancePeriodService.batchUpdateRecords(periodSep!.id, {
    batchReason: 'Timesheet overtime entry test',
    records: [{
      recordId: cellBefore!.id,
      employeeId: masonRow.employeeId,
      workDate: testDate,
      actualHours: 10.0, // 8h shift + 2h OT
      changeReason: 'Overtime test: 10h logged',
    }]
  }, actorId);

  const cellOT = await AttendanceRecord.findByPk(cellBefore!.id);
  assert(Number(cellOT!.actualHours) === 10.0, 'Flow H: actualHours = 10.0');
  assert(Number(cellOT!.regularHours) === 8.0, 'Flow H: regularHours capped at shift hours = 8.0');
  assert(Number(cellOT!.otHours) === 2.0, 'Flow H: otHours = 2.0 (separate from regular)');

  // Reset back to 8h
  await AttendancePeriodService.batchUpdateRecords(periodSep!.id, {
    batchReason: 'Reset to standard',
    records: [{
      recordId: cellBefore!.id,
      employeeId: masonRow.employeeId,
      workDate: testDate,
      actualHours: 8.0,
      changeReason: 'Reset cell to standard 8h',
    }]
  }, actorId);

  // --- Flow I: Click Fill 8h Standard ---
  const fillResult = await TimesheetService.fillStandardHours(
    periodSep!.id,
    [masonRow.employeeId],
    actorId
  );
  assert(fillResult.updatedRecords > 0, `Flow I: Fill 8h Standard updated ${fillResult.updatedRecords} records`);
  assert(fillResult.skippedWeeklyOff > 0, `Flow I: Weekly off days protected (${fillResult.skippedWeeklyOff} skipped)`);

  // Verify records after Fill 8h
  const cellPostFill = await AttendanceRecord.findByPk(cellBefore!.id);
  assert(Number(cellPostFill!.actualHours) === 8.0, 'Flow I: Regular workday is 8.0h');
  assert(Number(cellPostFill!.regularHours) === 8.0, 'Flow I: regularHours = 8.0');
  assert(Number(cellPostFill!.otHours) === 0.0, 'Flow I: otHours = 0.0');

  // --- Flow J: Change filters -> verify table and totals update ---
  const allProjectGrid = await AttendancePeriodService.getGrid(periodSep!.id, {
    clientId: client!.id,
    projectId: downtownProject!.id,
  });
  const masonOnlyGrid = await AttendancePeriodService.getGrid(periodSep!.id, {
    clientId: client!.id,
    projectId: downtownProject!.id,
    designationId: masonDesignation!.id,
  });
  assert(allProjectGrid.rows.length >= masonOnlyGrid.rows.length, 'Flow J: Filtered row count correctly varies by filter');
  assert(allProjectGrid.summary.totalEmployees >= masonOnlyGrid.summary.totalEmployees, 'Flow J: Summary totals update with filter context');

  // --- Flow K: Change August <-> September -> verify day count and data ---
  const dAug = new Date(2026, 8, 0).getDate();
  assert(dAug === 31, 'Flow K: August has 31 days');
  assert(dSep === 30, 'Flow K: September has 30 days');

  // --- Flow L: Refresh / persistence check ---
  const recordCheck = await AttendanceRecord.findByPk(cellBefore!.id);
  assert(recordCheck !== null && Number(recordCheck.actualHours) === 8.0, 'Flow L: Persistence verified from clean query');

  // --- Flow N: Test Add Worker (assign existing employee to project) ---
  const availableEmps = await Employee.findAll({
    where: { status: 'active' },
    limit: 15,
    order: [['employeeCode', 'ASC']],
  });
  const unassignedEmp = availableEmps.find(e => !projectEmployees.some(pe => pe.employeeId === e.id));
  if (unassignedEmp) {
    const newAssignment = await TimesheetService.assignWorker(
      downtownProject!.id,
      {
        employeeId: unassignedEmp.id,
        designationId: masonDesignation!.id,
        effectiveFrom: '2026-09-01',
        remarks: 'Add Worker test assignment',
      },
      actorId
    );
    assert(!!newAssignment, `Flow N: Add Worker assigned ${unassignedEmp.employeeCode} to project`);

    // Verify employee now appears in Timesheet project employees
    const refreshedProjectEmps = await TimesheetService.getProjectEmployees(downtownProject!.id);
    const foundNew = refreshedProjectEmps.find(pe => pe.employeeId === unassignedEmp.id);
    assert(!!foundNew, 'Flow N: Assigned employee immediately appears in project employees');

    // Test duplicate prevention
    let threwConflict = false;
    try {
      await TimesheetService.assignWorker(
        downtownProject!.id,
        {
          employeeId: unassignedEmp.id,
          designationId: masonDesignation!.id,
          effectiveFrom: '2026-09-01',
        },
        actorId
      );
    } catch {
      threwConflict = true;
    }
    assert(threwConflict, 'Flow N: Duplicate active assignment correctly prevented with conflict error');
  }

  console.log('\n=== VERIFICATION SUMMARY ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('\nALL FLOWS VERIFIED SUCCESSFULLY!');
    process.exit(0);
  }
}

runVerification().catch(err => {
  console.error('Verification script encountered error:', err);
  process.exit(1);
});
