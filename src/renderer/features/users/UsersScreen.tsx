import { useEffect, useState } from 'react'
import { Modal } from '../../components/Modal'
import { Icon } from '../../components/Icon'
import type { PermissionKey } from '@shared/permissions'

interface UserRow { id: number; name: string; username: string; roleId: number; roleName: string; isActive: boolean }
interface Role { id: number; name: string; isSystem: boolean }

const ROLE_LABEL: Record<string, string> = { Admin: 'مدير', Manager: 'مشرف', Cashier: 'كاشير', Waiter: 'نادل' }

export function UsersScreen() {
  const [tab, setTab] = useState<'users' | 'roles'>('users')
  const [users, setUsers] = useState<UserRow[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [catalog, setCatalog] = useState<Array<{ key: PermissionKey; description: string }>>([])
  const [editing, setEditing] = useState<Partial<UserRow> & { pin?: string } | null>(null)
  const [permRole, setPermRole] = useState<Role | null>(null)
  const [rolePerms, setRolePerms] = useState<Set<PermissionKey>>(new Set())

  const reload = async () => {
    setUsers((await window.api.users.list()) as UserRow[])
    setRoles((await window.api.users.listRoles()) as Role[])
  }
  useEffect(() => {
    reload()
    window.api.users.permCatalog().then((c) => setCatalog(c as any))
  }, [])

  const saveUser = async () => {
    if (!editing?.name || !editing.username || !editing.roleId) return
    await window.api.users.upsert({ id: editing.id, name: editing.name, username: editing.username, pin: editing.pin, roleId: editing.roleId, isActive: editing.isActive ?? true })
    setEditing(null)
    reload()
  }

  const deleteUser = async (id: number) => {
    if (!confirm('حذف هذا المستخدم؟')) return
    try {
      await window.api.users.delete(id)
      reload()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const openPerms = async (role: Role) => {
    setPermRole(role)
    const keys = (await window.api.users.permsForRole(role.id)) as PermissionKey[]
    setRolePerms(new Set(keys))
  }

  const togglePerm = (key: PermissionKey) => {
    setRolePerms((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const savePerms = async () => {
    if (!permRole) return
    try {
      await window.api.users.setPermsForRole(permRole.id, [...rolePerms])
      setPermRole(null)
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-800">المستخدمون والصلاحيات</h1>
          <p className="text-sm text-ink-400">إدارة حسابات الموظفين والأدوار</p>
        </div>
        {tab === 'users' && (
          <button className="btn-primary" onClick={() => setEditing({ name: '', username: '', roleId: roles.find((r) => r.name === 'Cashier')?.id })}>
            <Icon name="plus" className="h-4 w-4" /> مستخدم جديد
          </button>
        )}
      </div>

      <div className="mb-4 flex gap-2">
        <button className={`btn h-10 px-5 ${tab === 'users' ? 'bg-brand-600 text-white' : 'bg-white border border-ink-200 text-ink-600'}`} onClick={() => setTab('users')}>المستخدمون</button>
        <button className={`btn h-10 px-5 ${tab === 'roles' ? 'bg-brand-600 text-white' : 'bg-white border border-ink-200 text-ink-600'}`} onClick={() => setTab('roles')}>الأدوار والصلاحيات</button>
      </div>

      {tab === 'users' ? (
        <div className="card flex-1 overflow-auto">
          <table className="w-full text-start text-sm">
            <thead className="sticky top-0 bg-ink-50 text-ink-500">
              <tr><th className="p-3 text-start font-semibold">الاسم</th><th className="p-3 text-start font-semibold">اسم الدخول</th><th className="p-3 text-start font-semibold">الدور</th><th className="p-3 text-start font-semibold">الحالة</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-ink-100 hover:bg-ink-50/60">
                  <td className="p-3 font-semibold text-ink-800">{u.name}</td>
                  <td className="p-3 text-ink-500" dir="ltr">{u.username}</td>
                  <td className="p-3"><span className="chip bg-brand-100 text-brand-700">{ROLE_LABEL[u.roleName] ?? u.roleName}</span></td>
                  <td className="p-3"><span className={`chip ${u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-500'}`}>{u.isActive ? 'نشط' : 'موقوف'}</span></td>
                  <td className="p-3 text-end">
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost h-8 px-2.5 text-xs" onClick={() => setEditing({ ...u, pin: '' })}><Icon name="edit" className="h-3.5 w-3.5" /></button>
                      <button className="btn-ghost h-8 px-2.5 text-xs text-rose-600" onClick={() => deleteUser(u.id)}><Icon name="trash" className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {roles.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-bold text-ink-800"><Icon name="shieldUser" className="h-5 w-5 text-brand-600" /> {ROLE_LABEL[r.name] ?? r.name}</h3>
              </div>
              <p className="mb-3 text-xs text-ink-400">{r.name === 'Admin' ? 'كل الصلاحيات (غير قابل للتعديل)' : 'اضبط صلاحيات هذا الدور'}</p>
              <button className="btn-ghost w-full" disabled={r.name === 'Admin'} onClick={() => openPerms(r)}>
                <Icon name="settings" className="h-4 w-4" /> تعديل الصلاحيات
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title="مستخدم">
        {editing && (
          <div className="space-y-3">
            <div><label className="label">الاسم</label><input className="input" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus /></div>
            <div><label className="label">اسم الدخول</label><input className="input" dir="ltr" value={editing.username ?? ''} onChange={(e) => setEditing({ ...editing, username: e.target.value })} /></div>
            <div><label className="label">{editing.id ? 'رقم سري جديد (اتركه فارغًا للإبقاء)' : 'الرقم السري'}</label><input className="input" type="password" value={editing.pin ?? ''} onChange={(e) => setEditing({ ...editing, pin: e.target.value })} /></div>
            <div>
              <label className="label">الدور</label>
              <select className="input" value={editing.roleId ?? ''} onChange={(e) => setEditing({ ...editing, roleId: Number(e.target.value) })}>
                {roles.map((r) => (<option key={r.id} value={r.id}>{ROLE_LABEL[r.name] ?? r.name}</option>))}
              </select>
            </div>
            {editing.id && (
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" className="h-4 w-4" checked={editing.isActive ?? true} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} /> نشط
              </label>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={() => setEditing(null)}>إلغاء</button>
              <button className="btn-primary" onClick={saveUser} disabled={!editing.name || !editing.username}>حفظ</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!permRole} onClose={() => setPermRole(null)} title={`صلاحيات: ${permRole ? ROLE_LABEL[permRole.name] ?? permRole.name : ''}`} width="max-w-2xl">
        <div className="max-h-[60vh] space-y-1.5 overflow-auto">
          {catalog.map((p) => (
            <label key={p.key} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-ink-50">
              <input type="checkbox" className="h-4 w-4" checked={rolePerms.has(p.key)} onChange={() => togglePerm(p.key)} />
              <span className="text-sm text-ink-700">{p.description}</span>
              <span className="ms-auto font-mono text-[10px] text-ink-300">{p.key}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setPermRole(null)}>إلغاء</button>
          <button className="btn-primary" onClick={savePerms}>حفظ الصلاحيات</button>
        </div>
      </Modal>
    </div>
  )
}
