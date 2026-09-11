import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../../core/middleware/auth.middleware';
import { requirePermission } from '../../../core/middleware/rbac.middleware';
import { DesignationController } from '../controllers/designation.controller';
import { ClientController, ProjectController } from '../controllers/client-project.controller';
import { EmployeeController } from '../controllers/employee.controller';
import { AssignmentController } from '../controllers/assignment.controller';
import { RateController } from '../controllers/rate.controller';
import { ShiftController } from '../controllers/shift.controller';
import { CalendarController } from '../controllers/calendar.controller';
import { SalaryController } from '../controllers/salary.controller';

const employeeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
}).fields([
  { name: 'photo', maxCount: 1 },
  { name: 'passport', maxCount: 1 },
  { name: 'visa', maxCount: 1 },
]);

const router = Router();

// 1. Designations
router.get('/designations', authenticate, requirePermission('designations:read'), DesignationController.list);
router.get('/designations/:id', authenticate, requirePermission('designations:read'), DesignationController.getById);
router.post('/designations', authenticate, requirePermission('designations:create'), DesignationController.create);
router.put('/designations/:id', authenticate, requirePermission('designations:update'), DesignationController.update);
router.delete('/designations/:id', authenticate, requirePermission('designations:delete'), DesignationController.delete);

// 2. Clients
router.get('/clients', authenticate, requirePermission('clients:read'), ClientController.list);
router.get('/clients/:id', authenticate, requirePermission('clients:read'), ClientController.getById);
router.post('/clients', authenticate, requirePermission('clients:create'), ClientController.create);
router.put('/clients/:id', authenticate, requirePermission('clients:update'), ClientController.update);
router.delete('/clients/:id', authenticate, requirePermission('clients:delete'), ClientController.delete);

// 3. Projects
router.get('/projects', authenticate, requirePermission('projects:read'), ProjectController.list);
router.get('/projects/:id', authenticate, requirePermission('projects:read'), ProjectController.getById);
router.post('/projects', authenticate, requirePermission('projects:create'), ProjectController.create);
router.put('/projects/:id', authenticate, requirePermission('projects:update'), ProjectController.update);
router.delete('/projects/:id', authenticate, requirePermission('projects:delete'), ProjectController.delete);

// 4. Employees
router.get('/employees', authenticate, requirePermission('employees:read'), EmployeeController.list);
router.get('/employees/:id/photo', authenticate, EmployeeController.getPhoto);
router.delete('/employees/:id/photo', authenticate, requirePermission('employees:update'), EmployeeController.deletePhoto);
router.get('/employees/:id', authenticate, requirePermission('employees:read'), EmployeeController.getById);
router.post('/employees', authenticate, requirePermission('employees:create'), employeeUpload, EmployeeController.create);
router.put('/employees/:id', authenticate, requirePermission('employees:update'), employeeUpload, EmployeeController.update);
router.delete('/employees/:id', authenticate, requirePermission('employees:delete'), EmployeeController.delete);

// 5. Assignments (Effective-Dated)
router.get('/assignments', authenticate, requirePermission('assignments:read'), AssignmentController.list);
router.get('/assignments/:id', authenticate, requirePermission('assignments:read'), AssignmentController.getById);
router.post('/assignments', authenticate, requirePermission('assignments:create'), AssignmentController.create);
router.put('/assignments/:id', authenticate, requirePermission('assignments:update'), AssignmentController.update);

// 6. Rates (Dual-Stream Rates & Point-in-Time Resolution)
router.get('/rates/employee-rates', authenticate, requirePermission('rates:read'), RateController.listEmployeeRates);
router.post('/rates/employee-rates', authenticate, requirePermission('rates:create'), RateController.createEmployeeRate);
router.get('/rates/client-rates', authenticate, requirePermission('rates:read'), RateController.listClientRates);
router.post('/rates/client-rates', authenticate, requirePermission('rates:create'), RateController.createClientRate);
router.get('/rates/resolve-billing', authenticate, requirePermission('rates:read'), RateController.resolveBillingRate);

// 7. Shifts & Rostering
router.get('/shifts', authenticate, requirePermission('shifts:read'), ShiftController.listShifts);
router.post('/shifts', authenticate, requirePermission('shifts:create'), ShiftController.createShift);
router.put('/shifts/:id', authenticate, requirePermission('shifts:update'), ShiftController.updateShift);
router.get('/shifts/assignments', authenticate, requirePermission('shifts:read'), ShiftController.listAssignments);
router.post('/shifts/assignments', authenticate, requirePermission('shifts:create'), ShiftController.createAssignment);

// 8. Calendar & Holidays
router.get('/calendar/weekly-offs', authenticate, requirePermission('calendar:read'), CalendarController.listWeeklyOffs);
router.post('/calendar/weekly-offs', authenticate, requirePermission('calendar:create'), CalendarController.createWeeklyOff);
router.get('/calendar/holidays', authenticate, requirePermission('calendar:read'), CalendarController.listHolidays);
router.post('/calendar/holidays', authenticate, requirePermission('calendar:create'), CalendarController.createHoliday);
router.put('/calendar/holidays/:id', authenticate, requirePermission('calendar:update'), CalendarController.updateHoliday);
router.delete('/calendar/holidays/:id', authenticate, requirePermission('calendar:delete'), CalendarController.deleteHoliday);

// 9. Salary Components & Structures
router.get('/salary/components', authenticate, requirePermission('salary:read'), SalaryController.listComponents);
router.post('/salary/components', authenticate, requirePermission('salary:create'), SalaryController.createComponent);
router.get('/salary/structures', authenticate, requirePermission('salary:read'), SalaryController.listStructures);
router.post('/salary/structures', authenticate, requirePermission('salary:create'), SalaryController.createStructure);

export default router;
