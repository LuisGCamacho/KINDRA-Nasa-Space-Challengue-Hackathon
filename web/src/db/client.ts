import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

export const sqlClient = process.env.DATABASE_URL
  ? postgres(process.env.DATABASE_URL, { prepare: false, max: 5 })
  : null;
export const db = sqlClient ? drizzle(sqlClient) : null;