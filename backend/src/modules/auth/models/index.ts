import { User } from './user.model';
import { Role } from './role.model';
import { Permission } from './permission.model';
import { RolePermission } from './role-permission.model';
import { UserRole } from './user-role.model';
import { RefreshToken } from './refresh-token.model';
import { AuditLog } from './audit-log.model';

// User <-> Role (Many-to-Many)
User.belongsToMany(Role, {
  through: UserRole,
  foreignKey: 'user_id',
  otherKey: 'role_id',
  as: 'roles',
});

Role.belongsToMany(User, {
  through: UserRole,
  foreignKey: 'role_id',
  otherKey: 'user_id',
  as: 'users',
});

// Role <-> Permission (Many-to-Many)
Role.belongsToMany(Permission, {
  through: RolePermission,
  foreignKey: 'role_id',
  otherKey: 'permission_id',
  as: 'permissions',
});

Permission.belongsToMany(Role, {
  through: RolePermission,
  foreignKey: 'permission_id',
  otherKey: 'role_id',
  as: 'roles',
});

// User <-> RefreshToken (One-to-Many)
User.hasMany(RefreshToken, {
  foreignKey: 'user_id',
  as: 'refreshTokens',
  onDelete: 'CASCADE',
});

RefreshToken.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

export { User, Role, Permission, RolePermission, UserRole, RefreshToken, AuditLog };
