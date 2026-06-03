import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/Modal'
import { Icon } from '../../components/Icon'
import { EmptyBoxArt } from '../../components/Illustration'
import { useAuth } from '../../stores/authStore'
import { useSettings } from '../../stores/settingsStore'
import { formatMoney, toPiasters, toPounds } from '../../lib/format'
import { toast } from '../../stores/toastStore'
import { confirmDialog } from '../../stores/confirmStore'
import { ModifierGroupsManager } from './ModifierGroupsManager'
import { ProductExtrasManager } from './ProductExtrasManager'
import type { Category, Product, ProductInput, Unit } from '@shared/types'

const empty: ProductInput = { name: '', costPrice: 0, sellPrice: 0, trackStock: true, isWeighed: false, barcodes: [] }

/** Minimal CSV parser supporting quoted fields and the template header. */
function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'))
  if (lines.length < 2) return []
  const splitLine = (line: string): string[] => {
    const out: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
        else if (c === '"') inQ = false
        else cur += c
      } else if (c === '"') inQ = true
      else if (c === ',') { out.push(cur); cur = '' }
      else cur += c
    }
    out.push(cur)
    return out
  }
  const headers = splitLine(lines[0]).map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const cells = splitLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => (row[h] = (cells[i] ?? '').trim()))
    return row
  })
}

export function ProductsScreen() {
  const { t } = useTranslation()
  const { can } = useAuth()
  const { settings } = useSettings()
  const isRestaurant = settings.businessType === 'restaurant'
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<ProductInput | null>(null)
  const [barcodeStr, setBarcodeStr] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: Array<{ row: number; message: string }> } | null>(null)
  const [showGroups, setShowGroups] = useState(false)
  const [extrasFor, setExtrasFor] = useState<Product | null>(null)
  const [labelProduct, setLabelProduct] = useState<Product | null>(null)
  const [labelCopies, setLabelCopies] = useState('1')
  const fileRef = useRef<HTMLInputElement>(null)

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
    const sku = editing.sku || barcodes[0] || undefined
    await window.api.products.upsert({ ...editing, sku, barcodes })
    setEditing(null)
    reload()
  }

  const remove = async (id: number) => {
    if (!(await confirmDialog({ message: 'هل تريد حذف هذا الصنف؟', danger: true, confirmLabel: 'حذف' }))) return
    await window.api.products.delete(id)
    toast.ok('تم حذف الصنف')
    reload()
  }

  const generateBarcode = async () => {
    const code = await window.api.products.genBarcode()
    setBarcodeStr((prev) => (prev.trim() ? prev : code))
  }

  const printLabel = async (id: number, copies: number) => {
    try {
      await window.api.hardware.printLabel({ productIds: [id], copies })
      toast.ok('تم إرسال الملصق للطباعة')
    } catch (e) {
      toast.err((e as Error).message)
    }
  }

  const downloadTemplate = async () => {
    const r = await window.api.products.downloadTemplate()
    if (r.saved) toast.ok('تم حفظ القالب — املأه بالإكسل واحفظه CSV ثم ارفعه')
  }

  const onFilePicked = async (file: File) => {
    const text = await file.text()
    const rows = parseCsv(text)
    if (rows.length === 0) {
      toast.err('الملف فارغ أو غير صالح')
      return
    }
    const res = await window.api.products.bulkImport(rows)
    setImportResult(res)
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
          <div className="flex gap-2">
            {isRestaurant && (
              <button className="btn-ghost" onClick={() => setShowGroups(true)}>
                <Icon name="list" className="h-4 w-4" /> الإضافات والمجموعات
              </button>
            )}
            <button className="btn-ghost" onClick={() => { setImportResult(null); setImporting(true) }}>
              <Icon name="download" className="h-4 w-4" /> رفع منتجات (Excel)
            </button>
            <button className="btn-primary" onClick={openNew}>
              <Icon name="plus" className="h-4 w-4" />
              {t('common.add')}
            </button>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFilePicked(f)
          e.target.value = ''
        }}
      />

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
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost h-8 px-2.5 text-xs" title="طباعة ملصق باركود" onClick={() => { setLabelProduct(p); setLabelCopies('1') }}>
                        <Icon name="barcode" className="h-3.5 w-3.5" />
                      </button>
                      {can('product.edit') && (
                        <>
                          <button className="btn-ghost h-8 px-2.5 text-xs" title="الخيارات (متغيّرات / إضافات / وجبة)" onClick={() => setExtrasFor(p)}>
                            <Icon name="settings" className="h-3.5 w-3.5" />
                          </button>
                          <button className="btn-ghost h-8 px-2.5 text-xs" onClick={() => openEdit(p)}>
                            <Icon name="edit" className="h-3.5 w-3.5" />
                          </button>
                          <button className="btn-ghost h-8 px-2.5 text-xs text-rose-600" onClick={() => remove(p.id)}>
                            <Icon name="trash" className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / edit product */}
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
              <label className="label">الباركود (هو كود الصنف — افصل بفاصلة لأكثر من باركود)</label>
              <div className="flex gap-2">
                <input className="input flex-1" dir="ltr" value={barcodeStr} onChange={(e) => setBarcodeStr(e.target.value)} placeholder="امسح الباركود أو اضغط توليد" />
                <button type="button" className="btn-ghost whitespace-nowrap" onClick={generateBarcode}>
                  <Icon name="barcode" className="h-4 w-4" /> توليد
                </button>
              </div>
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

      {/* Bulk import */}
      <Modal open={importing} onClose={() => setImporting(false)} title="رفع منتجات المتجر (Excel / CSV)" width="max-w-xl">
        <div className="space-y-4">
          <ol className="space-y-2 rounded-xl bg-ink-50 p-4 text-sm text-ink-600">
            <li>1. حمّل قالب الإكسل المنسّق واضغط الزر بالأسفل.</li>
            <li>2. افتحه بالإكسل واملأ المنتجات (الاسم، الباركود، الفئة، الوحدة، التكلفة، سعر البيع، المخزون، بالوزن، الضريبة).</li>
            <li>3. احفظه بصيغة <b>CSV UTF-8</b> ثم ارفعه هنا — سيُضاف/يُحدَّث المتجر فورًا.</li>
          </ol>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={downloadTemplate}>
              <Icon name="download" className="h-4 w-4" /> تحميل القالب
            </button>
            <button className="btn-primary flex-1" onClick={() => fileRef.current?.click()}>
              <Icon name="box" className="h-4 w-4" /> اختيار ملف ورفعه
            </button>
          </div>
          {importResult && (
            <div className="rounded-xl border border-ink-200 p-4 text-sm">
              <div className="mb-2 flex gap-4">
                <span className="chip bg-emerald-100 text-emerald-700">أُضيف: {importResult.created}</span>
                <span className="chip bg-brand-100 text-brand-700">حُدِّث: {importResult.updated}</span>
                {importResult.errors.length > 0 && <span className="chip bg-rose-100 text-rose-700">أخطاء: {importResult.errors.length}</span>}
              </div>
              {importResult.errors.length > 0 && (
                <div className="max-h-40 space-y-1 overflow-auto text-xs text-rose-600">
                  {importResult.errors.map((er, i) => (
                    <div key={i}>سطر {er.row}: {er.message}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <ModifierGroupsManager open={showGroups} onClose={() => setShowGroups(false)} />
      <ProductExtrasManager product={extrasFor} open={!!extrasFor} onClose={() => { setExtrasFor(null); reload() }} />

      {/* Print barcode label */}
      <Modal open={!!labelProduct} onClose={() => setLabelProduct(null)} title="طباعة ملصق باركود">
        {labelProduct && (
          <div className="space-y-3">
            <p className="text-sm text-ink-600">{labelProduct.name}</p>
            <div>
              <label className="label">عدد الملصقات</label>
              <input className="input text-center text-lg" type="number" min={1} value={labelCopies} onChange={(e) => setLabelCopies(e.target.value)} autoFocus />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button className="btn-ghost" onClick={() => setLabelProduct(null)}>{t('common.cancel')}</button>
              <button
                className="btn-primary"
                onClick={() => {
                  const n = Number(labelCopies) || 1
                  const id = labelProduct.id
                  setLabelProduct(null)
                  printLabel(id, Math.max(1, n))
                }}
              >
                <Icon name="print" className="h-4 w-4" /> طباعة
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
