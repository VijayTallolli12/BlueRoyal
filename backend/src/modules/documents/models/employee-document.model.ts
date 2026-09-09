import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';
import { DocumentType } from './document-type.model';
import { Employee } from '../../masters/models/employee.model';
import { User } from '../../auth/models/user.model';

export class EmployeeDocument extends BaseModel {
  declare public employeeId: string;
  declare public documentTypeId: string;
  declare public documentNumber: string | null;
  declare public issueDate: string | null;
  declare public expiryDate: string | null;
  declare public originalFileName: string;
  declare public storedFileName: string;
  declare public filePath: string;
  declare public fileSizeBytes: number;
  declare public mimeType: string;
  declare public version: number;
  declare public verificationStatus: 'pending' | 'verified' | 'rejected';
  declare public verifiedBy: string | null;
  declare public verifiedAt: Date | null;
  declare public rejectionReason: string | null;
  declare public metadata: Record<string, any> | null;
  declare public notes: string | null;

  declare public documentType?: DocumentType;
  declare public employee?: Employee;
  declare public verifier?: User;
}

EmployeeDocument.init(
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
    documentTypeId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'document_type_id',
      references: {
        model: 'document_types',
        key: 'id',
      },
    },
    documentNumber: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'document_number',
    },
    issueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'issue_date',
    },
    expiryDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'expiry_date',
    },
    originalFileName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'file_name',
    },
    filePath: {
      type: DataTypes.STRING(500),
      allowNull: false,
      field: 'file_path',
    },
    fileSizeBytes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'file_size_bytes',
    },
    mimeType: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: 'mime_type',
    },
    verificationStatus: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'pending',
      field: 'verification_status',
    },
    verifiedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'verified_by_user_id',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'verified_at',
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'verification_remarks',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'employee_documents',
    timestamps: true,
    underscored: true,
  },
);

EmployeeDocument.belongsTo(DocumentType, { foreignKey: 'document_type_id', as: 'documentType' });
DocumentType.hasMany(EmployeeDocument, { foreignKey: 'document_type_id', as: 'documents' });

EmployeeDocument.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
Employee.hasMany(EmployeeDocument, { foreignKey: 'employee_id', as: 'documents' });

EmployeeDocument.belongsTo(User, { foreignKey: 'verified_by_user_id', as: 'verifier' });
