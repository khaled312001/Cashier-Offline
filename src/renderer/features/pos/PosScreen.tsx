import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCart } from '../../stores/cartStore'
import { useSettings } from '../../stores/settingsStore'
import { useScanner } from '../../hooks/useScanner'
import { toast } from '../../stores/toastStore'
import { formatMoney } from '../../lib/format'
import { PaymentModal } from './PaymentModal'
import { ProductExtrasModal } from './ProductExtrasModal'
import { Modal } from '../../components/Modal'
import { Icon } from '../../components/Icon'
import { EmptyCartArt } from '../../components/Illustration'
import type { Category, Customer, PaymentInput, Product, SaleSummary } from '@shared/types'

export function PosScreen() {
  const { t } = useTranslation()
  const cart = useCart()
  const { settings } = useSettings()
  const totals = cart.totals()
  const isRestaurant = settings.businessType === 'restaurant'

  const [categories, setCategories] = useState<Category[]>([])
  const [gridProducts, setGridProducts] = useState<Product[]>([])
  const [activeCat, setActiveCat] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [showPay, setShowPay] = useState(false)
  const [showHeld, setShowHeld] = useState(false)
  const [held, setHeld] = useState<SaleSummary[]>([])
  const [showBarcode, setShowBarcode] = useState(false)
  const [manualBarcode, setManualBarcode] = useState('')
  const [showPrice, setShowPrice] = useState(false)
  const [priceQuery, setPriceQuery] = useState('')
  const [priceResult, setPriceResult] = useState<Product | null>(null)
  const [priceList, setPriceList] = useState<Product[]>([])
  const [extras, setExtras] = useState<Product | null>(null)
  const [showCustomers, setShowCustomers] = useState(false)
  const [customerList, setCustomerList] = useState<Customer[]>([])
  const [custQuery, setCustQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.products.listCategories().then(setCategories)
    window.api.products.list({ limit: 60 }).then(setGridProducts)
  }, [])

  useEffect(() => {
    const id = setTimeout(async () => {
      if (query.trim()) setResults(await window.api.products.search(query.trim(), 12))
      else setResults([])
    }, 180)
    return () => clearTimeout(id)
  }, [query])

  const anyModalOpen = showPay || showHeld || showBarcode || showPrice || !!extras || showCustomers

  // Add a product, opening the extras picker first if it has variants/modifiers.
  const addProduct = (p: Product, qty = 1) => {
    if (p.hasVariants || p.hasModifiers) {
      setExtras(p)
      return
    }
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
        if (sc.valueType === 'weight') cart.addProduct(hit2.product, value)
        else cart.addProduct(hit2.product, value / (hit2.product.sellPrice / 100))
        return
      }
    }
    toast.err(`الباركود غير معروف: ${code}`)
  }
  useScanner(handleScan, !anyModalOpen)

  const submitManualBarcode = async () => {
    const code = manualBarcode.trim()
    if (!code) return
    await handleScan(code)
    setShowBarcode(false)
    setManualBarcode('')
    searchRef.current?.focus()
  }

  // Price check
  useEffect(() => {
    if (!showPrice) return
    const id = setTimeout(async () => {
      const q = priceQuery.trim()
      if (!q) {
        setPriceList([])
        return
      }
      const byCode = await window.api.products.byBarcode(q)
      if (byCode) {
        setPriceResult(byCode.product)
        setPriceList([])
        return
      }
      setPriceList(await window.api.products.search(q, 8))
    }, 180)
    return () => clearTimeout(id)
  }, [priceQuery, showPrice])

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (anyModalOpen) return
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
      tableId: cart.tableId,
      lines: cart.lines,
      payments,
      discountTotal: cart.orderDiscount,
      discountType: cart.orderDiscountType
    })
    if (settings.receipt.autoPrint) window.api.hardware.printReceipt(sale.id).catch(() => undefined)
    if (settings.receipt.openDrawerOnCash && payments.some((p) => p.method === 'cash')) window.api.hardware.openDrawer().catch(() => undefined)
    setShowPay(false)
    cart.clear()
    toast.ok(sale.changeDue > 0 ? `تم البيع — الباقي ${formatMoney(sale.changeDue, true)}` : 'تم البيع بنجاح')
    searchRef.current?.focus()
  }

  const holdSale = async () => {
    if (cart.lines.length === 0) return
    await window.api.sales.create({ orderType: cart.orderType, tableId: cart.tableId, lines: cart.lines, payments: [], hold: true })
    cart.clear()
    toast.ok('تم تعليق الفاتورة')
  }

  // Restaurant: send current cart to kitchen as a held order + KOT print.
  const sendToKitchen = async () => {
    if (cart.lines.length === 0) return
    const sale = await window.api.sales.create({ orderType: cart.orderType || 'dine_in', tableId: cart.tableId, lines: cart.lines, payments: [], hold: true })
    try {
      const res = await window.api.kot.printForSale(sale.id)
      toast.ok(`تم إرسال ${res.tickets} تذكرة للمطبخ`)
    } catch (e) {
      toast.err((e as Error).message)
    }
    if (cart.tableId) await window.api.restaurant.attachOrder(cart.tableId, sale.id)
    cart.clear()
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

  const openCustomers = async () => {
    setCustomerList(await window.api.customers.list())
    setShowCustomers(true)
  }
  useEffect(() => {
    if (!showCustomers) return
    const id = setTimeout(async () => {
      setCustomerList(custQuery.trim() ? await window.api.customers.search(custQuery.trim()) : await window.api.customers.list())
    }, 180)
    return () => clearTimeout(id)
  }, [custQuery, showCustomers])

  return (
    <div className="grid h-full grid-cols-[1fr_minmax(340px,420px)] gap-3 p-3 xl:gap-4 xl:p-4">
      {/* LEFT: search + product grid */}
      <div className="flex flex-col gap-3 overflow-hidden">
        <div className="flex gap-2">
          <div className="relative flex-1">
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
                  <button key={p.id} className="flex w-full items-center justify-between px-4 py-2.5 text-start hover:bg-brand-50" onClick={() => addProduct(p)}>
                    <span className="font-medium text-ink-700">{p.name}</span>
                    <span className="font-bold text-brand-600">{formatMoney(p.sellPrice)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="btn-primary h-12 px-4" onClick={() => { setManualBarcode(''); setShowBarcode(true) }} title="إدخال باركود">
            <Icon name="barcode" className="h-5 w-5" />
            <span className="hidden lg:inline">باركود</span>
          </button>
          <button className="btn-ghost h-12 px-4" onClick={() => { setPriceQuery(''); setPriceResult(null); setShowPrice(true) }} title="استعلام سعر">
            <Icon name="tag" className="h-5 w-5" />
            <span className="hidden lg:inline">سعر</span>
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button className={`btn h-10 whitespace-nowrap ${activeCat === null ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 border border-ink-200'}`} onClick={() => loadGrid(null)}>
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
            <button key={p.id} className="card flex h-24 flex-col justify-between p-3 text-start transition hover:border-brand-400 hover:shadow-soft xl:h-28" onClick={() => addProduct(p)}>
              <span className="line-clamp-2 text-sm font-semibold text-ink-700">{p.name}</span>
              <div className="flex items-end justify-between">
                <span className="text-base font-extrabold text-brand-600 xl:text-lg">{formatMoney(p.sellPrice)}</span>
                {p.isWeighed && <span className="chip bg-amber-100 text-amber-700">وزن</span>}
                {p.isCombo && <span className="chip bg-brand-100 text-brand-700">وجبة</span>}
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
            الفاتورة
          </h2>
          <div className="flex gap-1.5">
            <button className="btn-ghost h-9 px-3 text-sm" onClick={openCustomers}>
              <Icon name="users" className="h-4 w-4" />
            </button>
            <button className="btn-ghost h-9 px-3 text-sm" onClick={openHeld}>
              <Icon name="list" className="h-4 w-4" />
              {t('pos.held')}
            </button>
            <button className="btn-ghost h-9 px-3 text-sm text-rose-600" onClick={cart.clear} disabled={cart.lines.length === 0}>
              <Icon name="trash" className="h-4 w-4" />
            </button>
          </div>
        </div>

        {cart.customer && (
          <div className="flex items-center justify-between border-b border-ink-100 bg-brand-50 px-3.5 py-2 text-sm">
            <span className="flex items-center gap-1.5 font-semibold text-brand-700">
              <Icon name="user" className="h-4 w-4" /> {cart.customer.name}
            </span>
            <button className="text-ink-400 hover:text-rose-600" onClick={() => cart.setCustomer(null)}>
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-auto p-2.5">
          {cart.lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-ink-400">
              <EmptyCartArt className="mb-3 h-32 w-32" />
              <p className="font-medium">{t('pos.cartEmpty')}</p>
              <p className="text-xs">امسح باركود أو اختر صنفًا للبدء</p>
            </div>
          ) : (
            cart.lines.map((l) => {
              const modTotal = (l.modifiers ?? []).reduce((a, m) => a + m.price * m.quantity, 0)
              const lineTotal = Math.round(l.unitPrice * l.quantity) + modTotal - l.discount
              return (
                <div key={l.lineId} className="mb-2 rounded-xl border border-ink-100 bg-ink-50/50 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink-800">{l.name}</span>
                    <button className="text-ink-400 hover:text-rose-600" onClick={() => cart.removeLine(l.lineId)}>
                      <Icon name="close" className="h-4 w-4" />
                    </button>
                  </div>
                  {l.modifiers && l.modifiers.length > 0 && (
                    <div className="mt-0.5 text-xs text-ink-400">{l.modifiers.map((m) => m.name).join('، ')}</div>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button className="btn-ghost h-8 w-8 p-0" onClick={() => cart.setQty(l.lineId, l.quantity - (l.isWeighed ? 0.5 : 1))}>
                        <Icon name="minus" className="h-3.5 w-3.5" />
                      </button>
                      <input className="input h-8 w-16 px-1 text-center" value={l.quantity} onChange={(e) => cart.setQty(l.lineId, Number(e.target.value) || 0)} />
                      <button className="btn-ghost h-8 w-8 p-0" onClick={() => cart.setQty(l.lineId, l.quantity + (l.isWeighed ? 0.5 : 1))}>
                        <Icon name="plus" className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-xs text-ink-400">× {formatMoney(l.unitPrice)}</span>
                    </div>
                    <span className="font-bold text-ink-800">{formatMoney(lineTotal)}</span>
                  </div>
                </div>
              )
            })
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
          {isRestaurant && (
            <button className="btn-soft mb-2 h-11 w-full" onClick={sendToKitchen} disabled={cart.lines.length === 0}>
              <Icon name="receipt" className="h-4 w-4" /> إرسال للمطبخ
            </button>
          )}
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

      <PaymentModal open={showPay} total={totals.grandTotal} onClose={() => setShowPay(false)} onConfirm={completeSale} allowCredit={!!cart.customer} />

      <ProductExtrasModal
        product={extras}
        open={!!extras}
        onClose={() => setExtras(null)}
        onConfirm={(opts) => {
          if (extras) cart.addProductWithExtras(extras, 1, opts)
          setExtras(null)
          searchRef.current?.focus()
        }}
      />

      <Modal open={showBarcode} onClose={() => setShowBarcode(false)} title="إدخال باركود">
        <div className="space-y-3">
          <p className="text-sm text-ink-500">امسح الباركود بالقارئ أو اكتبه يدويًا ثم اضغط إضافة.</p>
          <input className="input text-center text-xl font-mono" dir="ltr" value={manualBarcode} onChange={(e) => setManualBarcode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitManualBarcode()} placeholder="باركود الصنف" autoFocus />
          <button className="btn-primary w-full" onClick={submitManualBarcode} disabled={!manualBarcode.trim()}>
            <Icon name="plus" className="h-5 w-5" /> إضافة للسلة
          </button>
        </div>
      </Modal>

      <Modal open={showPrice} onClose={() => setShowPrice(false)} title="استعلام عن سعر">
        <div className="space-y-3">
          <input className="input text-lg" value={priceQuery} onChange={(e) => { setPriceQuery(e.target.value); setPriceResult(null) }} placeholder="امسح الباركود أو اكتب اسم الصنف" autoFocus />
          {priceResult && (
            <div className="rounded-2xl bg-brand-50 p-5 text-center">
              <div className="text-lg font-bold text-ink-800">{priceResult.name}</div>
              <div className="my-2 text-4xl font-extrabold text-brand-600">{formatMoney(priceResult.sellPrice, true)}</div>
              <div className="text-sm text-ink-500">المتاح بالمخزون: {priceResult.stock ?? 0}</div>
              <button className="btn-success mt-3" onClick={() => { addProduct(priceResult); setShowPrice(false) }}>
                <Icon name="plus" className="h-4 w-4" /> إضافة للسلة
              </button>
            </div>
          )}
          {!priceResult && priceList.length > 0 && (
            <div className="max-h-72 space-y-1 overflow-auto">
              {priceList.map((p) => (
                <button key={p.id} className="flex w-full items-center justify-between rounded-xl border border-ink-100 px-4 py-3 hover:bg-brand-50" onClick={() => setPriceResult(p)}>
                  <span className="font-medium text-ink-700">{p.name}</span>
                  <span className="font-bold text-brand-600">{formatMoney(p.sellPrice)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={showCustomers} onClose={() => setShowCustomers(false)} title="اختيار عميل">
        <div className="space-y-3">
          <input className="input" placeholder="بحث بالاسم أو الهاتف" value={custQuery} onChange={(e) => setCustQuery(e.target.value)} autoFocus />
          <button className="btn-ghost w-full" onClick={() => { cart.setCustomer(null); setShowCustomers(false) }}>
            بدون عميل (عابر)
          </button>
          <div className="max-h-72 space-y-1 overflow-auto">
            {customerList.map((c) => (
              <button key={c.id} className="flex w-full items-center justify-between rounded-xl border border-ink-100 px-4 py-2.5 hover:bg-brand-50" onClick={() => { cart.setCustomer(c); setShowCustomers(false) }}>
                <span className="font-medium text-ink-700">{c.name}</span>
                <span className="text-xs text-ink-400" dir="ltr">{c.phone}</span>
              </button>
            ))}
            {customerList.length === 0 && <p className="py-6 text-center text-ink-400">لا يوجد عملاء</p>}
          </div>
        </div>
      </Modal>

      <Modal open={showHeld} onClose={() => setShowHeld(false)} title={t('pos.held')}>
        {held.length === 0 ? (
          <p className="py-6 text-center text-ink-400">{t('pos.cartEmpty')}</p>
        ) : (
          <div className="space-y-2">
            {held.map((h) => (
              <button key={h.id} className="flex w-full items-center justify-between rounded-xl border border-ink-200 p-3 hover:bg-brand-50" onClick={() => resumeHeld(h.id)}>
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
