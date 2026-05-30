import { create } from 'zustand'
import { taxFromBasisPoints } from '@shared/money'
import type { CartLine, Customer, Product, SaleDetail } from '@shared/types'
import type { OrderType } from '@shared/enums'

export interface CartTotals {
  subtotal: number
  discountTotal: number
  taxTotal: number
  serviceCharge: number
  grandTotal: number
  itemCount: number
}

interface CartState {
  lines: CartLine[]
  orderType: OrderType
  customer: Customer | null
  tableId: number | null
  orderDiscount: number
  orderDiscountType: 'amount' | 'percent'
  serviceCharge: number
  addProduct: (product: Product, qty?: number) => void
  setQty: (lineId: string, qty: number) => void
  setPrice: (lineId: string, price: number) => void
  setLineDiscount: (lineId: string, discount: number) => void
  removeLine: (lineId: string) => void
  setCustomer: (c: Customer | null) => void
  setOrderType: (t: OrderType) => void
  setTable: (id: number | null) => void
  setOrderDiscount: (amount: number, type: 'amount' | 'percent') => void
  clear: () => void
  loadFromSale: (sale: SaleDetail) => void
  totals: () => CartTotals
}

function makeLine(product: Product, qty: number): CartLine {
  return {
    lineId: crypto.randomUUID(),
    productId: product.id,
    name: product.name,
    unitPrice: product.sellPrice,
    costPrice: product.costPrice,
    quantity: qty,
    isWeighed: product.isWeighed,
    unit: product.unitName ?? null,
    discount: 0,
    taxRateBp: product.taxRateBp,
    taxInclusive: product.taxInclusive
  }
}

export const useCart = create<CartState>((set, get) => ({
  lines: [],
  orderType: 'quick',
  customer: null,
  tableId: null,
  orderDiscount: 0,
  orderDiscountType: 'amount',
  serviceCharge: 0,

  addProduct: (product, qty = 1) =>
    set((state) => {
      // For non-weighed items, merge with an existing identical line.
      if (!product.isWeighed) {
        const existing = state.lines.find((l) => l.productId === product.id && l.discount === 0)
        if (existing) {
          return {
            lines: state.lines.map((l) =>
              l.lineId === existing.lineId ? { ...l, quantity: l.quantity + qty } : l
            )
          }
        }
      }
      return { lines: [...state.lines, makeLine(product, qty)] }
    }),

  setQty: (lineId, qty) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.lineId === lineId ? { ...l, quantity: Math.max(0, qty) } : l)).filter((l) => l.quantity > 0)
    })),

  setPrice: (lineId, price) =>
    set((state) => ({ lines: state.lines.map((l) => (l.lineId === lineId ? { ...l, unitPrice: price } : l)) })),

  setLineDiscount: (lineId, discount) =>
    set((state) => ({ lines: state.lines.map((l) => (l.lineId === lineId ? { ...l, discount } : l)) })),

  removeLine: (lineId) => set((state) => ({ lines: state.lines.filter((l) => l.lineId !== lineId) })),

  setCustomer: (c) => set({ customer: c }),
  setOrderType: (t) => set({ orderType: t }),
  setTable: (id) => set({ tableId: id }),
  setOrderDiscount: (amount, type) => set({ orderDiscount: amount, orderDiscountType: type }),

  clear: () =>
    set({ lines: [], customer: null, tableId: null, orderDiscount: 0, orderDiscountType: 'amount', serviceCharge: 0, orderType: 'quick' }),

  loadFromSale: (sale) =>
    set({
      lines: sale.lines.map((l) => ({
        lineId: crypto.randomUUID(),
        productId: l.productId,
        name: l.name,
        unitPrice: l.unitPrice,
        costPrice: 0,
        quantity: l.quantity,
        isWeighed: false,
        discount: l.discount,
        taxRateBp: 0,
        taxInclusive: true
      })),
      customer: null,
      orderType: sale.orderType
    }),

  totals: () => {
    const state = get()
    let subtotal = 0
    let taxTotal = 0
    let itemsGrand = 0
    let itemCount = 0
    for (const l of state.lines) {
      const gross = Math.round(l.unitPrice * l.quantity)
      const net = gross - l.discount
      const tax = taxFromBasisPoints(net, l.taxRateBp, l.taxInclusive)
      subtotal += net
      taxTotal += tax
      itemsGrand += l.taxInclusive ? net : net + tax
      itemCount += 1
    }
    let discountTotal = state.orderDiscount
    if (state.orderDiscountType === 'percent' && discountTotal > 0) {
      discountTotal = Math.round((subtotal * discountTotal) / 10000)
    }
    const grandTotal = itemsGrand - discountTotal + state.serviceCharge
    return { subtotal, discountTotal, taxTotal, serviceCharge: state.serviceCharge, grandTotal, itemCount }
  }
}))
