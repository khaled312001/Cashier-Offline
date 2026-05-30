-- Full-text search over products (Arabic + English). Applied after Drizzle migrations.
-- unicode61 with remove_diacritics handles Arabic harakat so searches match.

CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
  name,
  name_en,
  sku,
  barcode,
  content='',
  tokenize='unicode61 remove_diacritics 2'
);

-- products_fts is an external-content-free (contentless) index we maintain manually
-- via triggers on products. rowid mirrors products.id.

CREATE TRIGGER IF NOT EXISTS products_fts_ai AFTER INSERT ON products BEGIN
  INSERT INTO products_fts(rowid, name, name_en, sku, barcode)
  VALUES (new.id, new.name, coalesce(new.name_en,''), coalesce(new.sku,''),
          coalesce((SELECT group_concat(barcode,' ') FROM product_barcodes WHERE product_id=new.id),''));
END;

CREATE TRIGGER IF NOT EXISTS products_fts_ad AFTER DELETE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, name, name_en, sku, barcode)
  VALUES ('delete', old.id, old.name, coalesce(old.name_en,''), coalesce(old.sku,''), '');
END;

CREATE TRIGGER IF NOT EXISTS products_fts_au AFTER UPDATE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, name, name_en, sku, barcode)
  VALUES ('delete', old.id, old.name, coalesce(old.name_en,''), coalesce(old.sku,''), '');
  INSERT INTO products_fts(rowid, name, name_en, sku, barcode)
  VALUES (new.id, new.name, coalesce(new.name_en,''), coalesce(new.sku,''),
          coalesce((SELECT group_concat(barcode,' ') FROM product_barcodes WHERE product_id=new.id),''));
END;

-- Keep barcode column fresh when barcodes change.
CREATE TRIGGER IF NOT EXISTS product_barcodes_ai AFTER INSERT ON product_barcodes BEGIN
  INSERT INTO products_fts(products_fts, rowid, name, name_en, sku, barcode)
  VALUES ('delete', new.product_id,
          (SELECT name FROM products WHERE id=new.product_id),
          coalesce((SELECT name_en FROM products WHERE id=new.product_id),''),
          coalesce((SELECT sku FROM products WHERE id=new.product_id),''), '');
  INSERT INTO products_fts(rowid, name, name_en, sku, barcode)
  VALUES (new.product_id,
          (SELECT name FROM products WHERE id=new.product_id),
          coalesce((SELECT name_en FROM products WHERE id=new.product_id),''),
          coalesce((SELECT sku FROM products WHERE id=new.product_id),''),
          coalesce((SELECT group_concat(barcode,' ') FROM product_barcodes WHERE product_id=new.product_id),''));
END;
