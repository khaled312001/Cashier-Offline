import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCart } from '../../stores/cartStore'
import { useSettings } from '../../stores/settingsStore'
import { useScanner } from '../../hooks/useScanner'
import { formatMoney } from '../../lib/format'
import { PaymentModal } from './PaymentModal'
import { Modal } from '../../components/Modal'
import { Icon } from '../../components/Icon'
import { EmptyCartArt } from '../../components/Illustration'
import type { Category, PaymentInput, Product, SaleSummary } from '@shared/types'

export function PosScreen() {
  const { t } = useTranslation()
  const cart = useCart()
  const { settings } = useSettings()
  const totals = cart.totals()

  const [categories, setCategories] = useState<Category[]>([])
  const [gridProducts, setGridProducts] = useState<Product[]>([])
  const [activeCat, setActiveCat] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [showPay, setShowPay] = useState(false)
  const [showHeld, setShowHeld] = useState(false)
  const [held, setHeld] = useState<SaleSummary[]>([])
  const [flash, setFlash] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.products.listCategories().then(setCategories)
    window.api.products.list({ limit: 60 }).then(setGridProducts)
  }, [])

  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 2500)
    return () => clearTimeout(id)
  }, [flash])

  useEffect(() => {
    const id = setTimeout(async () => {
      if (query.trim()) setResults(await window.api.products.search(query.trim(), 12))
      else setResults([])
    }, 180)
    return () => clearTimeout(id)
  }, [query])

  const flashMsg = (msg: string, kind: 'ok' | 'err' = 'ok') => setFlash({ msg, kind })

  const addProduct = (p: Product, qty = 1) => {
    cart.addProduct(p, qty)
    setQuery('')
    setResults([])
    searchRef.current?.focus()
  }

  const handleScan = async (code: string) => {
    const hit = await window.api.products.byBarcode(code)
    if (hit) {
      addProduct(hit.product, hit.quantity)
      return
    }
    const sc = settings.pos.scaleBarcode
    if (sc.enabled && code.length === 13 && code.startsWith(sc.prefix)) {
      const itemCode = code.substr(sc.prefix.length, sc.codeLen)
      const valueDigits = code.substr(sc.prefix.length + sc.codeLen, 5)
      const value = Number(valueDigits) / Math.pow(10, sc.decimals)
      const hit2 = await window.api.products.byBarcode(itemCode)
      if (hit2) {
        if (sc.valueType === 'weight') addProduct(hit2.product, value)
        else addProduct(hit2.product, value / (hit2.product.sellPrice / 100))
        return
      }
    }
    flashMsg(`الباركود غير معروف: ${code}`, 'err')
  }
  useScanner(handleScan, !showPay && !showHeld)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault()
        if (cart.lines.length > 0) setShowPay(true)
      } else if (e.key === 'F7') {
        e.preventDefault()
        holdSale()
      } else if (e.key === 'F8') {
        e.preventDefault()
        openHeld()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const loadGrid = async (catId: number | null) => {
    setActiveCat(catId)
    setGridProducts(await window.api.products.list(catId ? { categoryId: catId, limit: 60 } : { limit: 60 }))
  }

  const completeSale = async (payments: PaymentInput[]) => {
    const sale = await window.api.sales.create({
      orderType: cart.orderType,
      customerId: cart.customer?.id ?? null,
      lines: cart.lines,
      payments,
      discountTotal: cart.orderDiscount,
      discountType: cart.orderDiscountType
    })
    window.api.hardware.printReceipt(sale.id).catch(() => undefined)
    if (payments.some((p) => p.method === 'cash')) window.api.hardware.openDrawer().catch(() => undefined)
    setShowPay(false)
    cart.clear()
    flashMsg(sale.changeDue > 0 ? `تم البيع — الباقي ${formatMoney(sale.changeDue, true)}` : 'تم البيع بنجاح', 'ok')
    searchRef.current?.focus()
  }

  const holdSale = async () => {
    if (cart.lines.length === 0) return
    await window.api.sales.create({ orderType: cart.orderType, lines: cart.lines, payments: [], hold: true })
    cart.clear()
    flashMsg('تم تعليق الفاتورة')
  }

  const openHeld = async () => {
    setHeld(await window.api.sales.listHeld())
    setShowHeld(true)
  }

  const resumeHeld = async (id: number) => {
    const sale = await window.api.sales.resume(id)
    cart.loadFromSale(sale)
    setShowHeld(false)
  }

  return (
    <div className="grid h-full grid-cols-[1fr_440px] gap-4 p-4">
      {/* LEFT: search + product grid */}
      <div className="flex flex-col gap-3 overflow-hidden">
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3.5 h-5 w-5 text-ink-400" />
          <input
            ref={searchRef}
            className="input h-12 ps-11 text-lg"
            placeholder={t('pos.scanHint')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {results.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-ink-200 bg-white shadow-pop">
              {results.map((p) => (
                <button
                  key={p.id}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-start hover:bg-brand-50"
                  onClick={() => addProduct(p)}
                >
                  <span className="font-medium text-ink-700">{p.name}</span>
                  <span className="font-bold text-brand-600">{formatMoney(p.sellPrice)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            className={`btn h-10 whitespace-nowrap ${activeCat === null ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 border border-ink-200'}`}
            onClick={() => loadGrid(null)}
          >
            الكل
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={`btn h-10 whitespace-nowrap ${activeCat === c.id ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 border border-ink-200'}`}
              style={activeCat !== c.id && c.color ? { borderInlineStartColor: c.color, borderInlineStartWidth: 4 } : undefined}
              onClick={() => loadGrid(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2.5 overflow-auto pe-1 sm:grid-cols-3 xl:grid-cols-4">
          {gridProducts.map((p) => (
            <button
              key={p.id}
              className="card flex h-24 flex-col justify-between p-3 text-start transition hover:border-brand-400 hover:shadow-soft xl:h-28"
              onClick={() => addProduct(p)}
            >
              <span className="line-clamp-2 text-sm font-semibold text-ink-700">{p.name}</span>
              <div className="flex items-end justify-between">
                <span className="text-base font-extrabold text-brand-600 xl:text-lg">{formatMoney(p.sellPrice)}</span>
                {p.isWeighed && <span className="chip bg-amber-100 text-amber-700">وزن</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT: cart */}
      <div className="card flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-200 p-3.5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink-800">
            <Icon name="receipt" className="h-5 w-5 text-brand-600" />
            الفاتورة الحالية
          </h2>
          <div className="flex gap-1.5">
            <button className="btn-ghost h-9 px-3 text-sm" onClick={openHeld}>
              <Icon name="list" className="h-4 w-4" />
              {t('pos.held')}
            </button>
            <button className="btn-ghost h-9 px-3 text-sm text-rose-600" onClick={cart.clear} disabled={cart.lines.length === 0}>
              <Icon name="trash" className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-2.5">
          {cart.lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-ink-400">
              <EmptyCartArt className="mb-3 h-36 w-36" />
              <p className="font-medium">{t('pos.cartEmpty')}</p>
              <p className="text-xs">امسح باركود أو اختر صنفًا للبدء</p>
            </div>
          ) : (
            cart.lines.map((l) => (
              <div key={l.lineId} className="mb-2 rounded-xl border border-ink-100 bg-ink-50/50 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink-800">{l.name}</span>
                  <button className="text-ink-400 hover:text-rose-600" onClick={() => cart.removeLine(l.lineId)}>
                    <Icon name="close" className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button className="btn-ghost h-8 w-8 p-0" onClick={() => cart.setQty(l.lineId, l.quantity - (l.isWeighed ? 0.5 : 1))}>
                      <Icon name="minus" className="h-3.5 w-3.5" />
                    </button>
                    <input
                      className="input h-8 w-16 px-1 text-center"
                      value={l.quantity}
                      onChange={(e) => cart.setQty(l.lineId, Number(e.target.value) || 0)}
                    />
                    <button className="btn-ghost h-8 w-8 p-0" onClick={() => cart.setQty(l.lineId, l.quantity + (l.isWeighed ? 0.5 : 1))}>
                      <Icon name="plus" className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs text-ink-400">× {formatMoney(l.unitPrice)}</span>
                  </div>
                  <span className="font-bold text-ink-800">{formatMoney(Math.round(l.unitPrice * l.quantity) - l.discount)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-ink-200 bg-white p-4">
          <div className="mb-1 flex justify-between text-sm text-ink-500">
            <span>{t('pos.subtotal')}</span>
            <span>{formatMoney(totals.subtotal)}</span>
          </div>
          {totals.discountTotal > 0 && (
            <div className="mb-1 flex justify-between text-sm text-amber-600">
              <span>{t('pos.discount')}</span>
              <span>-{formatMoney(totals.discountTotal)}</span>
            </div>
          )}
          {totals.taxTotal > 0 && (
            <div className="mb-1 flex justify-between text-sm text-ink-500">
              <span>{t('pos.tax')}</span>
              <span>{formatMoney(totals.taxTotal)}</span>
            </div>
          )}
          <div className="mb-3 mt-2 flex items-center justify-between border-t border-dashed border-ink-200 pt-2">
            <span className="text-lg font-bold text-ink-700">{t('pos.grandTotal')}</span>
            <span className="text-3xl font-extrabold text-brand-600">{formatMoney(totals.grandTotal, true)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost h-12" onClick={holdSale} disabled={cart.lines.length === 0}>
              <Icon name="pause" className="h-4 w-4" />
              {t('pos.hold')}
              <span className="text-xs text-ink-400">F7</span>
            </button>
            <button className="btn-success h-12 text-lg" onClick={() => setShowPay(true)} disabled={cart.lines.length === 0}>
              <Icon name="cash" className="h-5 w-5" />
              {t('pos.pay')}
              <span className="text-xs opacity-80">F9</span>
            </button>
          </div>
        </div>
      </div>

      {flash && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl px-6 py-3 text-lg font-bold text-white shadow-pop ${
            flash.kind === 'ok' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          <Icon name={flash.kind === 'ok' ? 'check' : 'alert'} className="h-5 w-5" />
          {flash.msg}
        </div>
      )}

      <PaymentModal open={showPay} total={totals.grandTotal} onClose={() => setShowPay(false)} onConfirm={completeSale} allowCredit={!!cart.customer} />

      <Modal open={showHeld} onClose={() => setShowHeld(false)} title={t('pos.held')}>
        {held.length === 0 ? (
          <p className="py-6 text-center text-ink-400">{t('pos.cartEmpty')}</p>
        ) : (
          <div className="space-y-2">
            {held.map((h) => (
              <button
                key={h.id}
                className="flex w-full items-center justify-between rounded-xl border border-ink-200 p-3 hover:bg-brand-50"
                onClick={() => resumeHeld(h.id)}
              >
                <span className="font-semibold text-ink-700">{h.receiptNo}</span>
                <span className="text-ink-400">{h.itemCount} صنف</span>
                <span className="font-bold text-brand-600">{formatMoney(h.grandTotal)}</span>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
