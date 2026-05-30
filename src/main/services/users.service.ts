import { eq, isNull } from 'drizzle-orm'
import { getDb } from '../db/connection'
import * as s from '@db/schema'
import { authService } from './auth.service'
import { hashPin } from '../security/crypto'
import { genId } from '@shared/id'
import { AppError } from '../ipc/errors'
import { ALL_PERMISSION_KEYS, PERMISSIONS } from '@shared/permissions'
import type { PermissionKey } from '@shared/permissions'

export interface UserRow {
  id: number
  name: string
  username: string
  roleId: number
  roleName: string
  isActive: boolean
}

class UsersService {
  list(): UserRow[] {
    const db = getDb()
    return db
      .select({ id: s.users.id, name: s.users.name, username: s.users.username, roleId: s.users.roleId, roleName: s.roles.name, isActive: s.users.isActive })
      .from(s.users)
      .innerJoin(s.roles, eq(s.users.roleId, s.roles.id))
      .where(isNull(s.users.deletedAt))
      .all()
  }

  listRoles() {
    return getDb().select().from(s.roles).all().map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem }))
  }

  listPermissionCatalog() {
    return ALL_PERMISSION_KEYS.map((key) => ({ key, description: PERMISSIONS[key] }))
  }

  rolePermissions(roleId: number): PermissionKey[] {
    const db = getDb()
    return db
      .select({ key: s.permissions.key })
      .from(s.rolePermissions)
      .innerJoin(s.permissions, eq(s.rolePermissions.permissionId, s.permissions.id))
      .where(eq(s.rolePermissions.roleId, roleId))
      .all()
      .map((r) => r.key as PermissionKey)
  }

  setRolePermissions(roleId: number, keys: PermissionKey[]) {
    authService.assertPermission('users.manage')
    const db = getDb()
    const role = db.select().from(s.roles).where(eq(s.roles.id, roleId)).get()
    if (!role) throw new AppError('NOT_FOUND', 'الدور غير موجود')
    if (role.name === 'Admin') throw new AppError('FORBIDDEN', 'لا يمكن تعديل صلاحيات المدير')
    const allPerms = db.select().from(s.permissions).all()
    const idByKey = new Map(allPerms.map((p) => [p.key, p.id]))
    db.delete(s.rolePermissions).where(eq(s.rolePermissions.roleId, roleId)).run()
    for (const k of keys) {
      const pid = idByKey.get(k)
      if (pid) db.insert(s.rolePermissions).values({ roleId, permissionId: pid }).run()
    }
  }

  createRole(name: string): number {
    authService.assertPermission('users.manage')
    const res = getDb().insert(s.roles).values({ name }).run()
    return Number(res.lastInsertRowid)
  }

  upsertUser(input: { id?: number; name: string; username: string; pin?: string; roleId: number; isActive?: boolean }): UserRow {
    authService.assertPermission('users.manage')
    const db = getDb()
    if (input.id) {
      const patch: Record<string, unknown> = { name: input.name, username: input.username, roleId: input.roleId, isActive: input.isActive ?? true, updatedAt: Date.now() }
      if (input.pin) patch.pinHash = hashPin(input.pin)
      db.update(s.users).set(patch).where(eq(s.users.id, input.id)).run()
      return this.list().find((u) => u.id === input.id)!
    }
    if (!input.pin) throw new AppError('PIN_REQUIRED', 'الرقم السري مطلوب للمستخدم الجديد')
    const existing = db.select().from(s.users).where(eq(s.users.username, input.username)).get()
    if (existing) throw new AppError('DUP', 'اسم المستخدم مستخدم بالفعل')
    const res = db.insert(s.users).values({ publicId: genId('usr_'), name: input.name, username: input.username, pinHash: hashPin(input.pin), roleId: input.roleId }).run()
    return this.list().find((u) => u.id === Number(res.lastInsertRowid))!
  }

  deleteUser(id: number) {
    authService.assertPermission('users.manage')
    const db = getDb()
    const me = authService.current()
    if (me?.id === id) throw new AppError('SELF', 'لا يمكنك حذف حسابك الحالي')
    const remaining = db.select().from(s.users).where(isNull(s.users.deletedAt)).all().length
    if (remaining <= 1) throw new AppError('LAST', 'لا يمكن حذف آخر مستخدم')
    db.update(s.users).set({ deletedAt: Date.now(), isActive: false }).where(eq(s.users.id, id)).run()
  }

  auditLog(limit = 100) {
    const db = getDb()
    return db
      .select({ id: s.auditLog.id, action: s.auditLog.action, entity: s.auditLog.entity, userName: s.users.name, createdAt: s.auditLog.createdAt, detail: s.auditLog.detail })
      .from(s.auditLog)
      .leftJoin(s.users, eq(s.auditLog.userId, s.users.id))
      .orderBy(eq(s.auditLog.id, s.auditLog.id))
      .limit(limit)
      .all()
  }
}

export const usersService = new UsersService()
