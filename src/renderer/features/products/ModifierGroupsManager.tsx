import { useEffect, useState } from 'react'
import { Modal } from '../../components/Modal'
import { Icon } from '../../components/Icon'
import { formatMoney, toPiasters, toPounds } from '../../lib/format'
import { toast } from '../../stores/toastStore'

interface Modifier {
  id: number
  groupId: number
  name: string
  price: number
  isDefault: boolean
  sortOrder: number
}
interface Group {
  id: number
  name: string
  minSelect: number
  maxSelect: number
  isRequired: boolean
  sortOrder: number
  modifiers: Modifier[]
}

/**
 * Global CRUD for modifier groups and their modifiers (e.g. "الحجم", "إضافات").
 * Groups are reusable across products; products opt in via ProductExtrasManager.
 */
export function ModifierGroupsManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [editGroup, setEditGroup] = useState<Partial<Group> | null>(null)
  const [editMod, setEditMod] = useState<{ groupId: number; mod: Partial<Modifier> } | null>(null)

  const reload = async () => setGroups((await window.api.modifiers.listGroups()) as Group[])
  useEffect(() => {
    if (open) reload()
  }, [open])

  const saveGroup = async () => {
    if (!editGroup?.name?.trim()) return
    await window.api.modifiers.upsertGroup({
      id: editGroup.id,
      name: editGroup.name.trim(),
      minSelect: editGroup.minSelect ?? 0,
      maxSelect: editGroup.maxSelect ?? 1,
      isRequired: editGroup.isRequired ?? false
    })
    setEditGroup(null)
    reload()
  }
  const removeGroup = async (id: number) => {
    await window.api.modifiers.deleteGroup(id)
    toast.ok('تم حذف المجموعة')
    reload()
  }
  const saveMod = async () => {
    if (!editMod?.mod.name?.trim()) return
    await window.api.modifiers.upsertModifier({
      id: editMod.mod.id,
      groupId: editMod.groupId,
      name: editMod.mod.name.trim(),
      price: editMod.mod.price ?? 0,
      isDefault: editMod.mod.isDefault ?? false
    })
    setEditMod(null)
    reload()
  }
  const removeMod = async (id: number) => {
    await window.api.modifiers.deleteModifier(id)
    reload()
  }

  return (
    <Modal open={open} onClose={onClose} title="الإضافات والتعديلات (مجموعات)" width="max-w-2xl">
      <div className="space-y-3">
        <div className="flex justify-end">
          <button className="btn-primary h-9" onClick={() => setEditGroup({ minSelect: 0, maxSelect: 1, isRequired: false })}>
            <Icon name="plus" className="h-4 w-4" /> مجموعة جديدة
          </button>
        </div>

        {groups.length === 0 && <p className="py-8 text-center text-ink-400">لا توجد مجموعات بعد</p>}

        {groups.map((g) => (
          <div key={g.id} className="rounded-xl border border-ink-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-ink-800">{g.name}</span>
                <span className="ms-2 text-xs text-ink-400">
                  {g.isRequired ? 'مطلوب' : 'اختياري'} · اختر {g.minSelect}–{g.maxSelect}
                </span>
              </div>
              <div className="flex gap-1">
                <button className="btn-ghost h-8 px-2.5 text-xs" onClick={() => setEditGroup(g)}>
                  <Icon name="edit" className="h-3.5 w-3.5" />
                </button>
                <button className="btn-ghost h-8 px-2.5 text-xs text-rose-600" onClick={() => removeGroup(g.id)}>
                  <Icon name="trash" className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {g.modifiers.map((m) => (
                <span key={m.id} className="chip group bg-ink-100 text-ink-600">
                  {m.name}
                  {m.price > 0 && <b className="ms-1 text-brand-600">+{formatMoney(m.price)}</b>}
                  {m.isDefault && <b className="ms-1 text-emerald-600">★</b>}
                  <button className="ms-1.5 text-ink-400 hover:text-brand-600" onClick={() => setEditMod({ groupId: g.id, mod: m })}>
                    <Icon name="edit" className="h-3 w-3" />
                  </button>
                  <button className="ms-0.5 text-ink-400 hover:text-rose-600" onClick={() => removeMod(m.id)}>
                    <Icon name="close" className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button className="chip bg-brand-50 text-brand-700 hover:bg-brand-100" onClick={() => setEditMod({ groupId: g.id, mod: { isDefault: false, price: 0 } })}>
                <Icon name="plus" className="h-3 w-3" /> إضافة عنصر
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* edit group */}
      <Modal open={!!editGroup} onClose={() => setEditGroup(null)} title={editGroup?.id ? 'تعديل المجموعة' : 'مجموعة جديدة'}>
        {editGroup && (
          <div className="space-y-3">
            <div>
              <label className="label">اسم المجموعة</label>
              <input className="input" value={editGroup.name ?? ''} onChange={(e) => setEditGroup({ ...editGroup, name: e.target.value })} placeholder="مثال: الحجم، الإضافات" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">أقل عدد للاختيار</label>
                <input className="input" type="number" min={0} value={editGroup.minSelect ?? 0} onChange={(e) => setEditGroup({ ...editGroup, minSelect: Number(e.target.value) })} />
              </div>
              <div>
                <label className="label">أقصى عدد للاختيار</label>
                <input className="input" type="number" min={1} value={editGroup.maxSelect ?? 1} onChange={(e) => setEditGroup({ ...editGroup, maxSelect: Number(e.target.value) })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" className="h-4 w-4" checked={editGroup.isRequired ?? false} onChange={(e) => setEditGroup({ ...editGroup, isRequired: e.target.checked })} />
              إجباري (يجب الاختيار)
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={() => setEditGroup(null)}>إلغاء</button>
              <button className="btn-primary" onClick={saveGroup} disabled={!editGroup.name?.trim()}>حفظ</button>
            </div>
          </div>
        )}
      </Modal>

      {/* edit modifier */}
      <Modal open={!!editMod} onClose={() => setEditMod(null)} title={editMod?.mod.id ? 'تعديل العنصر' : 'عنصر جديد'}>
        {editMod && (
          <div className="space-y-3">
            <div>
              <label className="label">الاسم</label>
              <input className="input" value={editMod.mod.name ?? ''} onChange={(e) => setEditMod({ ...editMod, mod: { ...editMod.mod, name: e.target.value } })} placeholder="مثال: جبنة إضافية" autoFocus />
            </div>
            <div>
              <label className="label">السعر الإضافي (ج.م)</label>
              <input className="input" type="number" value={toPounds(editMod.mod.price ?? 0)} onChange={(e) => setEditMod({ ...editMod, mod: { ...editMod.mod, price: toPiasters(Number(e.target.value)) } })} />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" className="h-4 w-4" checked={editMod.mod.isDefault ?? false} onChange={(e) => setEditMod({ ...editMod, mod: { ...editMod.mod, isDefault: e.target.checked } })} />
              مُختار افتراضيًا
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={() => setEditMod(null)}>إلغاء</button>
              <button className="btn-primary" onClick={saveMod} disabled={!editMod.mod.name?.trim()}>حفظ</button>
            </div>
          </div>
        )}
      </Modal>
    </Modal>
  )
}
