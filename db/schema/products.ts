import { sqliteTable, integer, text, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { bool, timestamps, softDelete } from './common'

export const categories = sqliteTable(
  'categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    publicId: text('public_id').notNull(),
    name: text('name').notNull(),
    nameEn: text('name_en'),
    parentId: integer('parent_id'),
    color: text('color'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: bool('is_active').notNull().default(true),
    ...softDelete,
    ...timestamps
  },
  (t) => ({ parentIdx: index('idx_categories_parent').on(t.parentId) })
)

export const units = sqliteTable('units', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  nameEn: text('name_en'),
  shortCode: text('short_code'),
  allowDecimal: bool('allow_decimal').notNull().default(false),
  ...timestamps
})

export const products = sqliteTable(
  'products',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    publicId: text('public_id').notNull(),
    sku: text('sku'),
    name: text('name').notNull(),
    nameEn: text('name_en'),
    categoryId: integer('category_id').references(() => categories.id),
    unitId: integer('unit_id').references(() => units.id),
    costPrice: integer('cost_price').notNull().default(0), // piasters, moving avg
    sellPrice: integer('sell_price').notNull().default(0),
    taxRateBp: integer('tax_rate_bp').notNull().default(0),
    taxInclusive: bool('tax_inclusive').notNull().default(true),
    isWeighed: bool('is_weighed').notNull().default(false),
    trackStock: bool('track_stock').notNull().default(true),
    isActive: bool('is_active').notNull().default(true),
    allowPriceEdit: bool('allow_price_edit').notNull().default(false),
    reorderLevel: real('reorder_level').notNull().default(0),
    imagePath: text('image_path'),
    hasVariants: bool('has_variants').notNull().default(false),
    hasModifiers: bool('has_modifiers').notNull().default(false),
    isCombo: bool('is_combo').notNull().default(false),
    kitchenSectionId: integer('kitchen_section_id'),
    ...softDelete,
    ...timestamps
  },
  (t) => ({
    catIdx: index('idx_products_category').on(t.categoryId),
    skuIdx: index('idx_products_sku').on(t.sku),
    activeIdx: index('idx_products_active').on(t.isActive)
  })
)

export const productBarcodes = sqliteTable(
  'product_barcodes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    barcode: text('barcode').notNull(),
    variantId: integer('variant_id'),
    packSize: real('pack_size').notNull().default(1)
  },
  (t) => ({ barcodeUniq: uniqueIndex('idx_barcode').on(t.barcode) })
)

export const productVariants = sqliteTable('product_variants', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  publicId: text('public_id').notNull(),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sku: text('sku'),
  sellPrice: integer('sell_price'),
  costPrice: integer('cost_price'),
  isActive: bool('is_active').notNull().default(true),
  ...timestamps
})

export const productPrices = sqliteTable(
  'product_prices',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    branchId: integer('branch_id').notNull().default(1),
    priceLevel: integer('price_level').notNull().default(0),
    price: integer('price').notNull()
  },
  (t) => ({ uniq: uniqueIndex('idx_prices_uniq').on(t.productId, t.branchId, t.priceLevel) })
)
