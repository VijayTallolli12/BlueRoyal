import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';

export class RefreshToken extends BaseModel {
  declare public userId: string;
  declare public tokenHash: string;
  declare public expiresAt: Date;
  declare public revokedAt: Date | null;
}

RefreshToken.init(
  {
    ...baseModelAttributes,
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
    },
    tokenHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'token_hash',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'revoked_at',
    },
  },
  {
    sequelize,
    tableName: 'refresh_tokens',
    timestamps: true,
    underscored: true,
  },
);
