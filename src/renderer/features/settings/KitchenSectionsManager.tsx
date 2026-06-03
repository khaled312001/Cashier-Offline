import { useEffect, useState } from 'react'
import { Modal } from '../../components/Modal'
import { Icon } from '../../components/Icon'
import { toast } from '../../stores/toastStore'
import { confirmDialog } from '../../stores/confirmStore'

interface Section {
  id: number
  name: string
  printerId: number | null
}

/**
 * Manage kitchen sections (e.g. "المطبخ", "المشروبات"). Products are routed to a
 * section via their kitchenSectionId; each section prints its own KOT ticket.
 * Sections without a dedicated printer print to the default receipt printer.
 */
export function KitchenSectionsManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [sections, setSections] = useState<Section[]>([])
  const [name, setName] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  const reload = async () => setSections((await window.api.kot.sections()) as Section[])
  useEffect(() => {
    if (open) reload()
  }, [open])

  const add = async () => {
    if (!name.trim()) return
    await window.api.kot.upsertSection({ name: name.trim() })
    setName('')
    reload()
  }
  const saveEdit = async () => {
    if (editId == null || !editName.trim()) return
    await window.api.kot.upsertSection({ id: editId, name: editName.trim() })
    setEditId(null)
    reload()
  }
  const remove = async (id: number) => {
    if (!(await confirmDialog({ message: 'حذف هذا القسم؟', danger: true, confirmLabel: 'حذف' }))) return
    await window.api.kot.deleteSection(id)
    toast.ok('تم حذف القسم')
    reload()
  }

  return (
    <Modal open={open} onClose={onClose} title="أقسام المطبخ" width="max-w-lg">
      <div className="space-y-3">
        <p className="text-sm text-ink-400">
          وجّه كل صنف إلى قسم من شاشة المنتج. كل قسم يطبع تذكرة منفصلة على الطابعة الافتراضية.
        </p>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="اسم القسم (مثال: المطبخ، المشروبات)" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button className="btn-primary" onClick={add} disabled={!name.trim()}>
            <Icon name="plus" className="h-4 w-4" /> إضافة
          </button>
        </div>

        {sections.length === 0 && <p className="py-6 text-center text-ink-400">لا توجد أقسام</p>}
        {sections.map((sec) => (
          <div key={sec.id} className="flex items-center justify-between rounded-xl border border-ink-200 px-3 py-2.5">
            {editId === sec.id ? (
              <>
                <input className="input h-9 flex-1" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && saveEdit()} />
                <div className="ms-2 flex gap-1">
                  <button className="btn-primary h-9 px-3" onClick={saveEdit}>حفظ</button>
                  <button className="btn-ghost h-9 px-3" onClick={() => setEditId(null)}>إلغاء</button>
                </div>
              </>
            ) : (
              <>
                <span className="font-semibold text-ink-800">{sec.name}</span>
                <div className="flex gap-1">
                  <button className="btn-ghost h-8 px-2.5 text-xs" onClick={() => { setEditId(sec.id); setEditName(sec.name) }}>
                    <Icon name="edit" className="h-3.5 w-3.5" />
                  </button>
                  <button className="btn-ghost h-8 px-2.5 text-xs text-rose-600" onClick={() => remove(sec.id)}>
                    <Icon name="trash" className="h-3.5 w-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </Modal>
  )
}
