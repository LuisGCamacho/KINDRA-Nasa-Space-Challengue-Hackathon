import "server-only";
import postgres from "postgres";

/**
 * Conexión a Postgres de Supabase, o `null` si falta `DATABASE_URL`.
 * `prepare: false` porque el pooler de Supabase (modo transacción) no admite sentencias preparadas.
 */
export const sql = process.env.DATABASE_URL
  ? postgres(process.env.DATABASE_URL, { prepare: false, max: 5, idle_timeout: 20 })
  : null;
