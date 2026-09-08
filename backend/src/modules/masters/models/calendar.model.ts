import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';

export class WeeklyOffConfig extends BaseModel {
  declare public name: string;
  declare public daysOfWeek: number[];
  declare public effectiveFrom: string;
  declare public effectiveTo: string | null;
  declare public isDefault: boolean;
}

WeeklyOffConfig.init(
  {
    ...baseModelAttributes,
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    daysOfWeek: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      allowNull: false,
      field: 'days_of_week',
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
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_default',
    },
  },
  {
    sequelize,
    tableName: 'weekly_off_configs',
    timestamps: true,
    underscored: true,
  },
);

export class PublicHoliday extends BaseModel {
  declare public calendarYear: number;
  declare public name: string;
  declare public holidayDate: string;
  declare public description: string | null;
}

PublicHoliday.init(
  {
    ...baseModelAttributes,
    calendarYear: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'calendar_year',
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    holidayDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      unique: true,
      field: 'holiday_date',
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'public_holidays',
    timestamps: true,
    underscored: true,
  },
);
