import { useEffect, useState } from 'react'
import { Modal } from '../../components/Modal'
import { Icon } from '../../components/Icon'
import { formatMoney, toPiasters, toPounds } from '../../lib/format'
import { toast } from '../../stores/toastStore'
import type { Product } from '@shared/types'

interface Variant {
  id: number
  productId: number
  name: string
  sku: string | null
  sellPrice: number | null
  costPrice: number | null
}
interface Group {
  id: number
  name: string
  modifiers: Array<{ id: number; name: string; price: number }>
}
interface Component {
  componentProductId: number
  componentName?: string
  quantity: number
  extraPrice: number
  isSwappable?: boolean
}

type Tab = 'variants' | 'modifiers' | 'combo'

/**
 * Per-product extras: product variants (size/color), which modifier groups apply,
 * and combo components. Each save syncs the matching product flag in the backend.
 */
export function ProductExtrasManager({ product, open, onClose }: { product: Product | null; open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('variants')
  const [variants, setVariants] = useState<Variant[]>([])
  const [editVar, setEditVar] = useState<Partial<Variant> | null>(null)
  const [allGroups, setAllGroups] = useState<Group[]>([])
  const [assigned, setAssigned] = useState<Set<number>>(new Set())
  const [components, setComponents] = useState<Component[]>([])
  const [picker, setPicker] = useState('')
  const [pickerResults, setPickerResults] = useState<Product[]>([])

  useEffect(() => {
    if (!product || !open) return
    setTab('variants')
    window.api.variants.list(product.id).then((v) => setVariants(v as Variant[]))
    window.api.modifiers.listGroups().then((g) => setAllGroups(g as Group[]))
    window.api.modifiers.groupsForProduct(product.id).then((g) => setAssigned(new Set((g as Group[]).map((x) => x.id))))
    window.api.combos.components(product.id).then((c) => setComponents((c as Component[]).map((x) => ({ ...x, componentName: x.componentName }))))
  }, [product, open])

  useEffect(() => {
    if (tab !== 'combo') return
    const id = setTimeout(async () => {
      setPickerResults(picker.trim() ? await window.api.products.search(picker.trim(), 8) : [])
    }, 180)
    return () => clearTimeout(id)
  }, [picker, tab])

  if (!product) return null

  const saveVariant = async () => {
    if (!editVar?.name?.trim()) return
    await window.api.variants.upsert({
      id: editVar.id,
      productId: product.id,
      name: editVar.name.trim(),
      sku: editVar.sku ?? undefined,
      sellPrice: editVar.sellPrice ?? null,
      costPrice: editVar.costPrice ?? null
    })
    setEditVar(null)
    setVariants((await window.api.variants.list(product.id)) as Variant[])
  }
  const removeVariant = async (id: number) => {
    await window.api.variants.delete(id)
    setVariants((await window.api.variants.list(product.id)) as Variant[])
  }

  const toggleGroup = (id: number) => {
    setAssigned((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }
  const saveModifiers = async () => {
    await window.api.modifiers.setProductGroups(product.id, [...assigned])
    toast.ok('تم حفظ الإضافات')
  }

  const addComponent = (p: Product) => {
    if (components.some((c) => c.componentProductId === p.id)) return
    setComponents([...components, { componentProductId: p.id, componentName: p.name, quantity: 1, extraPrice: 0 }])
    setPicker('')
    setPickerResults([])
  }
  const saveCombo = async () => {
    await window.api.combos.setComponents(
      product.id,
      components.map((c) => ({ componentProductId: c.componentProductId, quantity: c.quantity, extraPrice: c.extraPrice, isSwappable: c.isSwappable }))
    )
    toast.ok('تم حفظ مكوّنات الوجبة')
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'variants', label: 'المتغيّرات' },
    { key: 'modifiers', label: 'الإضافات' },
    { key: 'combo', label: 'الوجبة (كومبو)' }
  ]

  return (
    <Modal open={open} onClose={onClose} title={`خيارات: ${product.name}`} width="max-w-2xl">
      <div className="mb-4 flex gap-1 rounded-xl bg-ink-100 p-1">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${tab === tb.key ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500'}`}
            onClick={() => setTab(tb.key)}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'variants' && (
        <div className="space-y-2">
          <div className="flex justify-between">
            <p className="text-sm text-ink-400">أنواع/مقاسات بسعر مختلف وخصم مخزون مستقل.</p>
            <button className="btn-primary h-9" onClick={() => setEditVar({ sellPrice: product.sellPrice, costPrice: product.costPrice })}>
              <Icon name="plus" className="h-4 w-4" /> متغيّر
            </button>
          </div>
          {variants.length === 0 && <p className="py-6 text-center text-ink-400">لا توجد متغيّرات</p>}
          {variants.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-xl border border-ink-200 px-3 py-2.5">
              <div>
                <span className="font-semibold text-ink-800">{v.name}</span>
                <span className="ms-2 text-sm text-brand-600">{formatMoney(v.sellPrice ?? product.sellPrice)}</span>
              </div>
              <div className="flex gap-1">
                <button className="btn-ghost h-8 px-2.5 text-xs" onClick={() => setEditVar(v)}>
                  <Icon name="edit" className="h-3.5 w-3.5" />
                </button>
                <button className="btn-ghost h-8 px-2.5 text-xs text-rose-600" onClick={() => removeVariant(v.id)}>
                  <Icon name="trash" className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'modifiers' && (
        <div className="space-y-3">
          <p className="text-sm text-ink-400">اختر مجموعات الإضافات التي تظهر عند بيع هذا الصنف.</p>
          {allGroups.length === 0 && <p className="py-6 text-center text-ink-400">أنشئ مجموعات إضافات أولًا من زر «الإضافات والمجموعات».</p>}
          <div className="space-y-2">
            {allGroups.map((g) => (
              <label key={g.id} className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5 ${assigned.has(g.id) ? 'border-brand-400 bg-brand-50' : 'border-ink-200'}`}>
                <div className="flex items-center gap-2.5">
                  <input type="checkbox" className="h-4 w-4" checked={assigned.has(g.id)} onChange={() => toggleGroup(g.id)} />
                  <span className="font-semibold text-ink-800">{g.name}</span>
                </div>
                <span className="text-xs text-ink-400">{g.modifiers.map((m) => m.name).join('، ')}</span>
              </label>
            ))}
          </div>
          {allGroups.length > 0 && (
            <div className="flex justify-end">
              <button className="btn-primary" onClick={saveModifiers}>حفظ</button>
            </div>
          )}
        </div>
      )}

      {tab === 'combo' && (
        <div className="space-y-3">
          <p className="text-sm text-ink-400">حدّد مكوّنات الوجبة — تُخصم من المخزون عند البيع بسعر الوجبة.</p>
          <div className="relative">
            <input className="input" placeholder="ابحث عن صنف لإضافته للوجبة" value={picker} onChange={(e) => setPicker(e.target.value)} />
            {pickerResults.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-ink-200 bg-white shadow-pop">
                {pickerResults.filter((p) => p.id !== product.id).map((p) => (
                  <button key={p.id} className="flex w-full items-center justify-between px-4 py-2 text-start hover:bg-brand-50" onClick={() => addComponent(p)}>
                    <span>{p.name}</span>
                    <Icon name="plus" className="h-4 w-4 text-brand-600" />
                  </button>
                ))}
              </div>
            )}
          </div>
          {components.length === 0 && <p className="py-6 text-center text-ink-400">لا توجد مكوّنات</p>}
          {components.map((c) => (
            <div key={c.componentProductId} className="flex items-center gap-2 rounded-xl border border-ink-200 px-3 py-2">
              <span className="flex-1 font-semibold text-ink-800">{c.componentName}</span>
              <span className="text-xs text-ink-400">الكمية</span>
              <input
                className="input h-9 w-20 text-center"
                type="number"
                min={1}
                value={c.quantity}
                onChange={(e) => setComponents(components.map((x) => (x.componentProductId === c.componentProductId ? { ...x, quantity: Number(e.target.value) || 1 } : x)))}
              />
              <button className="text-ink-400 hover:text-rose-600" onClick={() => setComponents(components.filter((x) => x.componentProductId !== c.componentProductId))}>
                <Icon name="trash" className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex justify-end">
            <button className="btn-primary" onClick={saveCombo}>حفظ الوجبة</button>
          </div>
        </div>
      )}

      {/* edit variant */}
      <Modal open={!!editVar} onClose={() => setEditVar(null)} title={editVar?.id ? 'تعديل متغيّر' : 'متغيّر جديد'}>
        {editVar && (
          <div className="space-y-3">
            <div>
              <label className="label">الاسم (مثال: كبير، أحمر)</label>
              <input className="input" value={editVar.name ?? ''} onChange={(e) => setEditVar({ ...editVar, name: e.target.value })} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">سعر البيع</label>
                <input className="input" type="number" value={toPounds(editVar.sellPrice ?? product.sellPrice)} onChange={(e) => setEditVar({ ...editVar, sellPrice: toPiasters(Number(e.target.value)) })} />
              </div>
              <div>
                <label className="label">التكلفة</label>
                <input className="input" type="number" value={toPounds(editVar.costPrice ?? product.costPrice)} onChange={(e) => setEditVar({ ...editVar, costPrice: toPiasters(Number(e.target.value)) })} />
              </div>
            </div>
            <div>
              <label className="label">باركود/SKU (اختياري)</label>
              <input className="input" dir="ltr" value={editVar.sku ?? ''} onChange={(e) => setEditVar({ ...editVar, sku: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={() => setEditVar(null)}>إلغاء</button>
              <button className="btn-primary" onClick={saveVariant} disabled={!editVar.name?.trim()}>حفظ</button>
            </div>
          </div>
        )}
      </Modal>
    </Modal>
  )
}
