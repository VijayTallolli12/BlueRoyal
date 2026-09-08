import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';
import { Employee } from './employee.model';
import { Shift } from './shift.model';

export class EmployeeShiftAssignment extends BaseModel {
  declare public employeeId: string;
  declare public shiftId: string;
  declare public effectiveFrom: string;
  declare public effectiveTo: string | null;

  declare public employee?: Employee;
  declare public shift?: Shift;
}

EmployeeShiftAssignment.init(
  {
    ...baseModelAttributes,
    employeeId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'employee_id',
      references: {
        model: 'employees',
        key: 'id',
      },
    },
    shiftId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'shift_id',
      references: {
        model: 'shifts',
        key: 'id',
      },
    },
    effectiveFrom: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'effective_from',
    },
    effectiveTo: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'effective_to',
    },
  },
  {
    sequelize,
    tableName: 'employee_shift_assignments',
    timestamps: true,
    underscored: true,
  },
);

Employee.hasMany(EmployeeShiftAssignment, { foreignKey: 'employee_id', as: 'shiftAssignments' });
EmployeeShiftAssignment.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

Shift.hasMany(EmployeeShiftAssignment, { foreignKey: 'shift_id', as: 'assignments' });
EmployeeShiftAssignment.belongsTo(Shift, { foreignKey: 'shift_id', as: 'shift' });
