import Database from 'better-sqlite3'

let db: Database.Database | null = null

export function openDb(path: string): Database.Database {
  if (db) return db
  db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

export function getDb(): Database.Database {
  if (!db) throw new Error('DB not opened')
  return db
}

export function closeDb() {
  if (db) {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)')
    } catch {
      /* ignore */
    }
    db.close()
  }
  db = null
}

function migrate(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      public_key_path TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      note TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      type TEXT NOT NULL,
      machine_id TEXT NOT NULL,
      issued_at INTEGER NOT NULL,
      expires_at INTEGER,
      grace_days INTEGER NOT NULL DEFAULT 7,
      features TEXT NOT NULL DEFAULT '["*"]',
      price INTEGER NOT NULL DEFAULT 0,
      key_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      note TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_lic_customer ON licenses(customer_id);
    CREATE INDEX IF NOT EXISTS idx_lic_expires ON licenses(expires_at);
    CREATE INDEX IF NOT EXISTS idx_cust_phone ON customers(phone);
  `)

  // Seed the default product (the cashier app) if none exist.
  const count = d.prepare('SELECT count(*) AS c FROM products').get() as { c: number }
  if (count.c === 0) {
    d.prepare('INSERT INTO products (name, code, created_at) VALUES (?, ?, ?)').run('كاشير أوفلاين', 'CASHIER', Date.now())
  }
}
