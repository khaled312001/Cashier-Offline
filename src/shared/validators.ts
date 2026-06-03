import { z } from 'zod'
import { PAYMENT_METHODS, ORDER_TYPES, MOVEMENT_TYPES, LICENSE_TYPES } from './enums'

/**
 * Runtime validation for IPC inputs. These run at the main-process boundary so
 * the renderer can never push malformed money/quantities/enums into services.
 * Money is integer piasters (>=0). Quantities are positive reals.
 */

const money = z.number().int().min(0)
const moneySigned = z.number().int()
const qty = z.number().positive()
const id = z.number().int().positive()

export const cartLineSchema = z.object({
  lineId: z.string(),
  productId: id,
  variantId: z.number().int().positive().nullable().optional(),
  name: z.string().min(1),
  unitPrice: money,
  costPrice: money.optional(),
  quantity: qty,
  isWeighed: z.boolean().optional(),
  unit: z.string().nullable().optional(),
  discount: money.optional(),
  taxRateBp: z.number().int().min(0).max(100000).optional(),
  taxInclusive: z.boolean().optional(),
  note: z.string().optional(),
  modifiers: z
    .array(
      z.object({
        modifierId: z.number().int(),
        name: z.string(),
        price: moneySigned,
        quantity: z.number().positive()
      })
    )
    .optional()
})

export const paymentSchema = z.object({
  method: z.enum(PAYMENT_METHODS as unknown as [string, ...string[]]),
  amount: money,
  reference: z.string().optional(),
  tendered: money.optional()
})

export const createSaleSchema = z.object({
  orderType: z.enum(ORDER_TYPES as unknown as [string, ...string[]]),
  tableId: z.number().int().positive().nullable().optional(),
  customerId: z.number().int().positive().nullable().optional(),
  lines: z.array(cartLineSchema).min(1, 'لا توجد أصناف في الفاتورة'),
  payments: z.array(paymentSchema),
  discountTotal: z.number().int().min(0).optional(),
  discountType: z.enum(['amount', 'percent']).nullable().optional(),
  serviceCharge: money.optional(),
  note: z.string().optional(),
  guestCount: z.number().int().min(0).optional(),
  hold: z.boolean().optional(),
  holdSaleId: id.optional()
})

export const productInputSchema = z.object({
  id: id.optional(),
  sku: z.string().nullable().optional(),
  name: z.string().min(1, 'الاسم مطلوب'),
  nameEn: z.string().nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  unitId: z.number().int().positive().nullable().optional(),
  costPrice: money,
  sellPrice: money,
  taxRateBp: z.number().int().min(0).max(100000).optional(),
  taxInclusive: z.boolean().optional(),
  isWeighed: z.boolean().optional(),
  trackStock: z.boolean().optional(),
  isActive: z.boolean().optional(),
  allowPriceEdit: z.boolean().optional(),
  reorderLevel: z.number().min(0).optional(),
  imagePath: z.string().nullable().optional(),
  kitchenSectionId: z.number().int().positive().nullable().optional(),
  barcodes: z.array(z.string()).optional()
})

export const inventoryAdjustSchema = z.object({
  productId: id,
  quantity: z.number(), // signed delta
  reason: z.string().min(1),
  unitCost: money.optional()
})

export const customerUpsertSchema = z.object({
  id: id.optional(),
  name: z.string().min(1),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  groupId: z.number().int().positive().nullable().optional(),
  creditLimit: money.optional()
})

export const customerPaySchema = z.object({
  customerId: id,
  amount: z.number().int().positive(),
  note: z.string().optional()
})

export const supplierPaySchema = z.object({
  supplierId: id,
  amount: z.number().int().positive(),
  method: z.string().optional(),
  note: z.string().optional()
})

export const purchaseCreateSchema = z.object({
  supplierId: id,
  lines: z
    .array(
      z.object({
        productId: id,
        quantity: qty,
        unitCost: money,
        taxRateBp: z.number().int().min(0).optional(),
        batchNo: z.string().optional(),
        expiryDate: z.number().int().positive().nullable().optional()
      })
    )
    .min(1),
  paidAmount: money,
  note: z.string().optional(),
  receiveNow: z.boolean().optional()
})

export const refundSchema = z.object({
  originalSaleId: id,
  lines: z.array(z.object({ saleItemId: id, quantity: z.number().positive() })).min(1),
  method: z.string(),
  restock: z.boolean(),
  reason: z.string()
})

export const userUpsertSchema = z.object({
  id: id.optional(),
  name: z.string().min(1),
  username: z.string().min(1),
  pin: z.string().min(4).max(12).optional(),
  roleId: id,
  isActive: z.boolean().optional()
})

export const shiftOpenSchema = z.number().int().min(0)
export const shiftCloseSchema = z.number().int().min(0)

export const expenseAddSchema = z.object({
  category: z.string().min(1),
  amount: z.number().int().positive(),
  description: z.string().optional(),
  paymentMethod: z.string().optional()
})

export const cashMovementSchema = z.object({
  type: z.string().min(1),
  amount: z.number().int().positive(),
  reason: z.string().optional()
})

export const licenseTypeSchema = z.enum(LICENSE_TYPES as unknown as [string, ...string[]])
export const movementTypeSchema = z.enum(MOVEMENT_TYPES as unknown as [string, ...string[]])
