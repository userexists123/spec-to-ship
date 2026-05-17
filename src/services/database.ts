import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getAppConfig } from "./config";
import * as schema from "../db/schema";

let pool: Pool | null = null;

export function getPgPool(): Pool {
  if (!pool) {
    const config = getAppConfig();

    if (!config.databaseUrl) {
      throw new Error("Missing required environment variable: DATABASE_URL");
    }

    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined
    });
  }

  return pool;
}

export function getDb() {
  return drizzle(getPgPool(), { schema });
}