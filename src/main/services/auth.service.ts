import { eq, and, isNull } from 'drizzle-orm'
import { getDb } from '../db/connection'
import * as s from '@db/schema'
import { verifyPin } from '../security/crypto'
import { AppError } from '../ipc/errors'
import type { SessionUser } from '@shared/types'
import type { PermissionKey } from '@shared/permissions'
import { ALL_PERMISSION_KEYS } from '@shared/permissions'

class AuthService {
  private session: SessionUser | null = null

  login(username: string, pin: string): SessionUser {
    const db = getDb()
    const user = db
      .select()
      .from(s.users)
      .where(and(eq(s.users.username, username), isNull(s.users.deletedAt)))
      .get()
    if (!user || !user.isActive) throw new AppError('AUTH_INVALID', 'اسم المستخدم غير موجود')
    if (!verifyPin(pin, user.pinHash)) throw new AppError('AUTH_INVALID', 'الرقم السري غير صحيح')

    const role = db.select().from(s.roles).where(eq(s.roles.id, user.roleId)).get()
    const perms = this.permissionsForRole(user.roleId)

    db.update(s.users).set({ lastLoginAt: Date.now() }).where(eq(s.users.id, user.id)).run()

    this.session = {
      id: user.id,
      name: user.name,
      username: user.username,
      roleId: user.roleId,
      roleName: role?.name ?? '',
      branchId: user.branchId,
      permissions: perms
    }
    return this.session
  }

  logout() {
    this.session = null
  }

  current(): SessionUser | null {
    return this.session
  }

  requireSession(): SessionUser {
    if (!this.session) throw new AppError('AUTH_REQUIRED', 'يجب تسجيل الدخول أولاً')
    return this.session
  }

  hasPermission(key: PermissionKey): boolean {
    return this.session?.permissions.includes(key) ?? false
  }

  assertPermission(key: PermissionKey) {
    this.requireSession()
    if (!this.hasPermission(key)) {
      throw new AppError('FORBIDDEN', 'ليس لديك صلاحية لتنفيذ هذا الإجراء')
    }
  }

  private permissionsForRole(roleId: number): PermissionKey[] {
    const db = getDb()
    const rows = db
      .select({ key: s.permissions.key })
      .from(s.rolePermissions)
      .innerJoin(s.permissions, eq(s.rolePermissions.permissionId, s.permissions.id))
      .where(eq(s.rolePermissions.roleId, roleId))
      .all()
    const keys = rows.map((r) => r.key as PermissionKey)
    // Admin convenience: if the role has every permission, treat as full.
    return keys.length >= ALL_PERMISSION_KEYS.length ? ALL_PERMISSION_KEYS : keys
  }

  listUsers() {
    const db = getDb()
    return db
      .select({ id: s.users.id, name: s.users.name, username: s.users.username, roleName: s.roles.name })
      .from(s.users)
      .innerJoin(s.roles, eq(s.users.roleId, s.roles.id))
      .where(isNull(s.users.deletedAt))
      .all()
  }
}

export const authService = new AuthService()
