import { sqliteTable, integer, text, index, primaryKey } from 'drizzle-orm/sqlite-core'
import { bool, timestamps, softDelete } from './common'

export const roles = sqliteTable('roles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  nameEn: text('name_en'),
  isSystem: bool('is_system').notNull().default(false),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now())
})

export const permissions = sqliteTable('permissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  description: text('description')
})

export const rolePermissions = sqliteTable(
  'role_permissions',
  {
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: integer('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' })
  },
  (t) => ({ pk: primaryKey({ columns: [t.roleId, t.permissionId] }) })
)

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  publicId: text('public_id').notNull(),
  name: text('name').notNull(),
  username: text('username').notNull().unique(),
  pinHash: text('pin_hash'),
  passwordHash: text('password_hash'),
  roleId: integer('role_id')
    .notNull()
    .references(() => roles.id),
  branchId: integer('branch_id').notNull().default(1),
  isActive: bool('is_active').notNull().default(true),
  lastLoginAt: integer('last_login_at'),
  ...softDelete,
  ...timestamps
})

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id'),
    action: text('action').notNull(),
    entity: text('entity'),
    entityId: integer('entity_id'),
    detail: text('detail'),
    createdAt: integer('created_at').notNull().$defaultFn(() => Date.now())
  },
  (t) => ({
    userDate: index('idx_audit_user_date').on(t.userId, t.createdAt),
    entityIdx: index('idx_audit_entity').on(t.entity, t.entityId)
  })
)
