import { connection, NextResponse } from "next/server";
import { sql } from "@/db/client";

export async function GET() {
  await connection();
  if (!sql) return NextResponse.json({ db: "off", fallback: "json" });
  try {
    const t = Date.now();
    await sql`select 1`;
    return NextResponse.json({ db: "ok", ms: Date.now() - t });
  } catch {
    return NextResponse.json({ db: "down", fallback: "json" });
  }
}