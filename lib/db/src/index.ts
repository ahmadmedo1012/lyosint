import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env["DATABASE_URL"]) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env["DATABASE_URL"];
const isNeon = connectionString.includes(".neon.tech") || connectionString.includes("neon.");

export const pool = new Pool({
  connectionString,
  ssl: isNeon || connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env["DB_POOL_MAX"] ?? "10"),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export const db = drizzle(pool, { schema });

export * from "./schema";
