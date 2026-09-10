import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';
import { Employee } from '../../masters/models/employee.model';
import { Project } from '../../masters/models/project.model';

export class InvoiceLine extends BaseModel {
  declare public invoiceId: string;
  declare public employeeId: string | null;
  declare public projectId: string;
  declare public description: string;
  declare public hours: number;
  declare public overtimeHours: number;
  declare public rate: number;
  declare public otRate: number;
  declare public amount: number;
  declare public lineType: string;

  declare public employee?: Employee;
  declare public project?: Project;
}

InvoiceLine.init(
  {
    ...baseModelAttributes,
    invoiceId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'invoice_id',
      references: { model: 'client_invoices', key: 'id' },
    },
    employeeId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'employee_id',
      references: { model: 'employees', key: 'id' },
    },
    projectId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'project_id',
      references: { model: 'projects', key: 'id' },
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'description',
    },
    hours: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'hours',
    },
    overtimeHours: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'overtime_hours',
    },
    rate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'rate',
    },
    otRate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'ot_rate',
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'amount',
    },
    lineType: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'billable_hours',
      field: 'line_type',
    },
  },
  {
    sequelize,
    tableName: 'client_invoice_lines',
    timestamps: true,
    underscored: true,
  },
);

InvoiceLine.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
InvoiceLine.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
