import path from "node:path";
import { mkdir } from "node:fs/promises";
import { asc, eq, sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { DDL } from "./ddl";
import * as schema from "./schema";
import { hashPassword } from "@/lib/password";
import { POLICY_DEFAULTS } from "@/lib/policy";

/**
 * Both drivers expose the same Drizzle query API, so the rest of the app is
 * database-agnostic. Local development uses embedded PGlite (PostgreSQL in
 * WASM); production uses a real PostgreSQL server via DATABASE_URL.
 */
export type Database = PgDatabase<any, typeof schema>;

type DbGlobal = typeof globalThis & { __firmDb?: Promise<Database> };
const globalForDb = globalThis as DbGlobal;

export function getDb(): Promise<Database> {
  if (!globalForDb.__firmDb) {
    globalForDb.__firmDb = initDb().catch((error) => {
      globalForDb.__firmDb = undefined;
      throw error;
    });
  }
  return globalForDb.__firmDb;
}

async function initDb(): Promise<Database> {
  const url = process.env.DATABASE_URL?.trim();
  let db: Database;

  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({ connectionString: url, max: 10 });
    db = drizzle(pool, { schema }) as unknown as Database;
    await pool.query(DDL);
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const dir =
      process.env.PGLITE_DIR?.trim() || path.join(process.cwd(), ".data", "pglite");
    await mkdir(dir, { recursive: true });
    const client = new PGlite(dir);
    await client.waitReady;
    db = drizzle(client, { schema }) as unknown as Database;
    await client.exec(DDL);
  }

  await seed(db);
  return db;
}

const SEED_USERS = [
  { name: "FP&A Team", email: "fpna@firm.local", password: "Firm@12345", role: "FPNA", designation: "FP&A" },
  { name: "Domestic Sales Team", email: "sales@firm.local", password: "Firm@12345", role: "SALES", designation: "Sales Team (Domestic)" },
  { name: "Maintenance Team", email: "maintenance@firm.local", password: "Firm@12345", role: "MAINTENANCE", designation: "Maintenance Team" },
  { name: "Finance Team", email: "finance@firm.local", password: "Firm@12345", role: "FINANCE", designation: "Finance" },
  { name: "Strategy Team", email: "strategy@firm.local", password: "Firm@12345", role: "STRATEGY", designation: "Strategy Team (International)" },
  { name: "International BU", email: "bu@firm.local", password: "Firm@12345", role: "BU", designation: "International BU" },
  { name: "Marketing Team", email: "marketing@firm.local", password: "Firm@12345", role: "MARKETING", designation: "Marketing Team" },
  { name: "SCM Team", email: "scm@firm.local", password: "Firm@12345", role: "SCM", designation: "SCM Team" },
  { name: "CBO", email: "cbo@firm.local", password: "Firm@12345", role: "CBO", designation: "Chief Business Officer" },
  { name: "CSO", email: "cso@firm.local", password: "Firm@12345", role: "CSO", designation: "Chief Strategy Officer" },
  { name: "MD", email: "md@firm.local", password: "Firm@12345", role: "MD", designation: "Managing Director" },
  { name: "Global Administrator", email: "admin@firm.local", password: "Firm@12345", role: "GLOBAL_ADMIN", designation: "Global Administrator" },
];


async function seed(db: Database): Promise<void> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.users);

  if (Number(count) === 0) {
    await db
      .insert(schema.users)
      .values(
        SEED_USERS.map((user) => ({
          name: user.name,
          email: user.email,
          passwordHash: hashPassword(user.password),
          role: user.role,
          designation: user.designation,
        })),
      )
      .onConflictDoNothing();
  } else {
    // Migrate accounts from the previous classification tool in place so that
    // foreign keys from the old audit tables stay valid. Any remaining role
    // accounts are added after the existing rows are updated.
    const existing = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .orderBy(asc(schema.users.id));
    for (let index = 0; index < existing.length && index < SEED_USERS.length; index += 1) {
      const target = SEED_USERS[index];
      await db
        .update(schema.users)
        .set({
          name: target.name,
          email: target.email,
          passwordHash: hashPassword(target.password),
          role: target.role,
          designation: target.designation,
        })
        .where(eq(schema.users.id, existing[index].id));
    }
    if (SEED_USERS.length > existing.length) {
      await db
        .insert(schema.users)
        .values(
          SEED_USERS.slice(existing.length).map((user) => ({
            name: user.name,
            email: user.email,
            passwordHash: hashPassword(user.password),
            role: user.role,
            designation: user.designation,
          })),
        )
        .onConflictDoNothing();
    }
  }

  const existing = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, "policy"));

  if (existing.length === 0) {
    await db
      .insert(schema.settings)
      .values({ key: "policy", value: JSON.stringify(POLICY_DEFAULTS) })
      .onConflictDoNothing();
  }
}
