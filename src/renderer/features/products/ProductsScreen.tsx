import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/Modal'
import { Icon } from '../../components/Icon'
import { EmptyBoxArt } from '../../components/Illustration'
import { useAuth } from '../../stores/authStore'
import { formatMoney, toPiasters, toPounds } from '../../lib/format'
import type { Category, Product, ProductInput, Unit } from '@shared/types'

const empty: ProductInput = { name: '', costPrice: 0, sellPrice: 0, trackStock: true, isWeighed: false, barcodes: [] }

export function ProductsScreen() {
  const { t } = useTranslation()
  const { can } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<ProductInput | null>(null)
  const [barcodeStr, setBarcodeStr] = useState('')

  const reload = async () =>
    setProducts(query.trim() ? await window.api.products.search(query.trim(), 100) : await window.api.products.list({ limit: 300 }))

  useEffect(() => {
    window.api.products.listCategories().then(setCategories)
    window.api.products.listUnits().then(setUnits)
  }, [])
  useEffect(() => {
    const id = setTimeout(reload, 200)
    return () => clearTimeout(id)
  }, [query])

  const openNew = () => {
    setEditing({ ...empty })
    setBarcodeStr('')
  }
  const openEdit = async (p: Product) => {
    const full = await window.api.products.get(p.id)
    if (!full) return
    setEditing({
      id: full.id,
      name: full.name,
      nameEn: full.nameEn,
      categoryId: full.categoryId,
      unitId: full.unitId,
      costPrice: full.costPrice,
      sellPrice: full.sellPrice,
      taxRateBp: full.taxRateBp,
      taxInclusive: full.taxInclusive,
      isWeighed: full.isWeighed,
      trackStock: full.trackStock,
      reorderLevel: full.reorderLevel
    })
    setBarcodeStr((full.barcodes ?? []).join(', '))
  }

  const save = async () => {
    if (!editing) return
    const barcodes = barcodeStr.split(/[,\s]+/).map((b) => b.trim()).filter(Boolean)
    await window.api.products.upsert({ ...editing, barcodes })
    setEditing(null)
    reload()
  }

  const remove = async (id: number) => {
    if (!confirm('حذف هذا الصنف؟')) return
    await window.api.products.delete(id)
    reload()
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-800">{t('nav.products')}</h1>
          <p className="text-sm text-ink-400">إدارة الأصناف والأسعار والباركود</p>
        </div>
        {can('product.edit') && (
          <button className="btn-primary" onClick={openNew}>
            <Icon name="plus" className="h-4 w-4" />
            {t('common.add')}
          </button>
        )}
      </div>

      <div className="relative mb-4">
        <Icon name="search" className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3.5 h-5 w-5 text-ink-400" />
        <input className="input ps-11" placeholder={t('common.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="card flex-1 overflow-auto">
        {products.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-16 text-ink-400">
            <EmptyBoxArt className="mb-3 h-28 w-28" />
            <p>لا توجد أصناف</p>
          </div>
        ) : (
          <table className="w-full text-start text-sm">
            <thead className="sticky top-0 bg-ink-50 text-ink-500">
              <tr>
                <th className="p-3 text-start font-semibold">{t('common.name')}</th>
                <th className="p-3 text-start font-semibold">المخزون</th>
                {can('product.view_cost') && <th className="p-3 text-start font-semibold">التكلفة</th>}
                <th className="p-3 text-start font-semibold">{t('common.price')}</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-ink-100 hover:bg-ink-50/60">
                  <td className="p-3 font-semibold text-ink-800">
                    {p.name}
                    {p.isWeighed && <span className="chip ms-2 bg-amber-100 text-amber-700">وزن</span>}
                  </td>
                  <td className="p-3 text-ink-600">{p.stock ?? 0}</td>
                  {can('product.view_cost') && <td className="p-3 text-ink-400">{formatMoney(p.costPrice)}</td>}
                  <td className="p-3 font-bold text-brand-600">{formatMoney(p.sellPrice)}</td>
                  <td className="p-3 text-end">
                    {can('product.edit') && (
                      <div className="flex justify-end gap-1">
                        <button className="btn-ghost h-8 px-2.5 text-xs" onClick={() => openEdit(p)}>
                          <Icon name="edit" className="h-3.5 w-3.5" />
                        </button>
                        <button className="btn-ghost h-8 px-2.5 text-xs text-rose-600" onClick={() => remove(p.id)}>
                          <Icon name="trash" className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t('common.edit') : t('common.add')} width="max-w-xl">
        {editing && (
          <div className="space-y-3">
            <div>
              <label className="label">{t('common.name')}</label>
              <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">الفئة</label>
                <select className="input" value={editing.categoryId ?? ''} onChange={(e) => setEditing({ ...editing, categoryId: Number(e.target.value) || null })}>
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">الوحدة</label>
                <select className="input" value={editing.unitId ?? ''} onChange={(e) => setEditing({ ...editing, unitId: Number(e.target.value) || null })}>
                  <option value="">—</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">سعر التكلفة</label>
                <input className="input" type="number" value={toPounds(editing.costPrice)} onChange={(e) => setEditing({ ...editing, costPrice: toPiasters(Number(e.target.value)) })} />
              </div>
              <div>
                <label className="label">سعر البيع</label>
                <input className="input" type="number" value={toPounds(editing.sellPrice)} onChange={(e) => setEditing({ ...editing, sellPrice: toPiasters(Number(e.target.value)) })} />
              </div>
            </div>
            <div>
              <label className="label">الباركود (افصل بفاصلة لأكثر من باركود)</label>
              <input className="input" dir="ltr" value={barcodeStr} onChange={(e) => setBarcodeStr(e.target.value)} />
            </div>
            <div className="flex gap-6 pt-1">
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" className="h-4 w-4" checked={editing.isWeighed} onChange={(e) => setEditing({ ...editing, isWeighed: e.target.checked })} />
                صنف بالوزن
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" className="h-4 w-4" checked={editing.trackStock} onChange={(e) => setEditing({ ...editing, trackStock: e.target.checked })} />
                تتبّع المخزون
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
              <button className="btn-primary" onClick={save} disabled={!editing.name}>{t('common.save')}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
