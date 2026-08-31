import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../../drizzle/schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _schemaReady: Promise<void> | null = null;

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS stores (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    branch TEXT NOT NULL DEFAULT '',
    pin_hash TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS submissions (
    store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    iso_week TEXT NOT NULL,
    total_orders INTEGER NOT NULL DEFAULT 0,
    picking_min REAL NOT NULL DEFAULT 0,
    assignment_min REAL NOT NULL DEFAULT 0,
    fulfillment_rate REAL NOT NULL DEFAULT 0,
    compensation_rate REAL NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (store_id, iso_week)
  )`,
  `CREATE TABLE IF NOT EXISTS performers (
    store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    iso_week TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT '',
    quote TEXT NOT NULL DEFAULT '',
    badge_title TEXT NOT NULL DEFAULT 'HungerStation Market',
    photo TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (store_id, iso_week)
  )`,
];

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  if (!_db) _db = drizzle(neon(url), { schema });
  return _db;
}

export function ensureSchema(): Promise<void> {
  if (!_schemaReady) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      return Promise.reject(new Error("DATABASE_URL is not configured"));
    }
    const sql = neon(url);
    _schemaReady = (async () => {
      for (const statement of DDL_STATEMENTS) {
        await sql.query(statement);
      }
    })();
  }
  return _schemaReady;
}
