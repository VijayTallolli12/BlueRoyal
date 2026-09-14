import { Client } from '../src/modules/masters/models/client.model';
import { Project } from '../src/modules/masters/models/project.model';
import { Employee } from '../src/modules/masters/models/employee.model';
import { Designation } from '../src/modules/masters/models/designation.model';
import { EmployeeAssignment } from '../src/modules/masters/models/employee-assignment.model';
import { AttendancePeriod } from '../src/modules/attendance/models/attendance-period.model';
import { AttendanceRecord } from '../src/modules/attendance/models/attendance-record.model';
import { sequelize } from '../src/core/database/sequelize';

async function check() {
  await sequelize.authenticate();
  const clients = await Client.findAll();
  const projects = await Project.findAll({ include: [{ model: Client, as: 'client' }, { model: Employee, as: 'supervisor' }] });
  const employees = await Employee.findAll();
  const designations = await Designation.findAll();
  const assignments = await EmployeeAssignment.findAll({
    include: [{ model: Employee, as: 'employee' }, { model: Project, as: 'project' }, { model: Designation, as: 'designation' }]
  });
  const periods = await AttendancePeriod.findAll();

  console.log('=== DATA REPORT ===');
  console.log('Clients count:', clients.length);
  clients.forEach(c => console.log(`  Client: ${c.code} - ${c.name} (${c.id})`));

  console.log('\nProjects count:', projects.length);
  projects.forEach(p => console.log(`  Project: ${p.code} - ${p.name} | Client: ${p.client?.name} | Supervisor: ${p.supervisor ? p.supervisor.firstName + ' ' + p.supervisor.lastName : 'None'} (${p.id})`));

  console.log('\nEmployees count:', employees.length);
  employees.slice(0, 10).forEach(e => console.log(`  Emp: ${e.employeeCode} - ${e.firstName} ${e.lastName} (${e.id})`));

  console.log('\nDesignations count:', designations.length);
  designations.forEach(d => console.log(`  Desig: ${d.code} - ${d.title} (${d.id})`));

  console.log('\nAssignments count:', assignments.length);
  assignments.forEach(a => console.log(`  Assignment: Emp=${a.employee?.employeeCode} -> Proj=${a.project?.name} | Desig=${a.designation?.title}`));

  console.log('\nPeriods count:', periods.length);
  for (const p of periods) {
    const recCount = await AttendanceRecord.count({ where: { attendancePeriodId: p.id } });
    console.log(`  Period: ${p.periodCode} (${p.startDate} to ${p.endDate}) | Status: ${p.status} | Records: ${recCount}`);
  }

  process.exit(0);
}

check().catch(err => {
  console.error('Check failed:', err);
  process.exit(1);
});
