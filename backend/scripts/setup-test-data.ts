import { Designation } from '../src/modules/masters/models/designation.model';
import { Project } from '../src/modules/masters/models/project.model';
import { Employee } from '../src/modules/masters/models/employee.model';
import { EmployeeAssignment } from '../src/modules/masters/models/employee-assignment.model';
import { AttendancePeriod } from '../src/modules/attendance/models/attendance-period.model';
import { AttendanceRecord } from '../src/modules/attendance/models/attendance-record.model';
import { AttendanceCalculationService } from '../src/modules/attendance/services/attendance-calculation.service';
import { Shift } from '../src/modules/masters/models/shift.model';
import { sequelize } from '../src/core/database/sequelize';

async function setup() {
  await sequelize.authenticate();

  // 1. Ensure Mason and Steel Fixer designations exist
  let [mason] = await Designation.findOrCreate({
    where: { code: 'DES-MASON' },
    defaults: {
      code: 'DES-MASON',
      title: 'Mason',
      description: 'Skilled Mason for blockwork and plastering',
      isActive: true,
    },
  });
  if (mason.title !== 'Mason') {
    await mason.update({ title: 'Mason' });
  }

  let [steelFixer] = await Designation.findOrCreate({
    where: { code: 'DES-STEEL' },
    defaults: {
      code: 'DES-STEEL',
      title: 'Steel Fixer',
      description: 'Skilled Steel Fixer for reinforcement work',
      isActive: true,
    },
  });

  console.log('Designations ready:', mason.title, steelFixer.title);

  // 2. Find Downtown Dubai Project
  const project = await Project.findOne({ where: { code: 'PRJ-DEMO-01' } });
  if (!project) {
    console.error('Downtown Dubai Project not found!');
    process.exit(1);
  }

  // 3. Find employees to act as Supervisor, Mason, and Steel Fixer
  const allEmps = await Employee.findAll({ limit: 10, order: [['employeeCode', 'ASC']] });
  if (allEmps.length < 3) {
    console.error('Not enough employees in database!');
    process.exit(1);
  }

  const supervisorEmp = allEmps[0];
  const masonEmp = allEmps[1];
  const steelEmp = allEmps[2];

  // Set project supervisor
  await project.update({ supervisorId: supervisorEmp.id });
  console.log(`Assigned supervisor ${supervisorEmp.firstName} ${supervisorEmp.lastName} (${supervisorEmp.employeeCode}) to project ${project.name}`);

  // 4. Create active assignments for Mason and Steel Fixer to Downtown Dubai Project
  await EmployeeAssignment.findOrCreate({
    where: {
      employeeId: masonEmp.id,
      projectId: project.id,
    },
    defaults: {
      employeeId: masonEmp.id,
      clientId: project.clientId,
      projectId: project.id,
      designationId: mason.id,
      effectiveFrom: '2026-08-01',
      effectiveTo: null,
      remarks: 'Project Mason worker',
    },
  });

  await EmployeeAssignment.findOrCreate({
    where: {
      employeeId: steelEmp.id,
      projectId: project.id,
    },
    defaults: {
      employeeId: steelEmp.id,
      clientId: project.clientId,
      projectId: project.id,
      designationId: steelFixer.id,
      effectiveFrom: '2026-08-01',
      effectiveTo: null,
      remarks: 'Project Steel Fixer worker',
    },
  });

  console.log(`Assigned Mason (${masonEmp.employeeCode}) and Steel Fixer (${steelEmp.employeeCode}) to ${project.name}`);

  // 5. Check attendance period for 2026-09
  let periodSep = await AttendancePeriod.findOne({ where: { periodCode: '2026-09' } });
  if (!periodSep) {
    periodSep = await AttendancePeriod.create({
      periodCode: '2026-09',
      name: 'September 2026 Attendance',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      status: 'draft',
    });
  }

  // Find standard shift
  const defaultShift = await Shift.findOne({ where: { isActive: true } });

  // 6. Generate attendance records for September for masonEmp and steelEmp if not present
  for (const emp of [masonEmp, steelEmp]) {
    const recCount = await AttendanceRecord.count({
      where: { attendancePeriodId: periodSep.id, employeeId: emp.id },
    });

    if (recCount === 0) {
      console.log(`Generating September attendance records for ${emp.employeeCode}...`);
      const records = [];
      const current = new Date('2026-09-01T00:00:00Z');
      const end = new Date('2026-09-30T00:00:00Z');

      const isMason = emp.id === masonEmp.id;
      const desigId = isMason ? mason.id : steelFixer.id;

      while (current <= end) {
        const dateStr = current.toISOString().slice(0, 10);
        const dayType = await AttendanceCalculationService.resolveDayType(dateStr);

        // Standard 8h for regular workdays, 0 for weekly off
        const actualHours = dayType === 'regular_workday' ? 8.0 : 0.0;
        const calc = AttendanceCalculationService.calculateHours({
          actualHours,
          dayType,
          shiftWorkHours: defaultShift ? Number(defaultShift.workHours) : 8.0,
          isOnLeave: false,
        });

        records.push({
          attendancePeriodId: periodSep.id,
          employeeId: emp.id,
          workDate: dateStr,
          clientId: project.clientId,
          projectId: project.id,
          designationId: desigId,
          shiftId: defaultShift ? defaultShift.id : null,
          dayType,
          actualHours,
          regularHours: calc.regularHours,
          otHours: calc.otHours,
          isAbsent: calc.isAbsent,
          isOnLeave: false,
          hasAnomaly: calc.hasAnomaly,
          anomalyReason: calc.anomalyReason,
          remarks: null,
        });

        current.setUTCDate(current.getUTCDate() + 1);
      }

      await AttendanceRecord.bulkCreate(records);
      console.log(`Created ${records.length} September records for ${emp.employeeCode}`);
    } else {
      console.log(`September records already exist for ${emp.employeeCode} (${recCount} records)`);
    }
  }

  console.log('=== Test Data Setup Complete ===');
  process.exit(0);
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
