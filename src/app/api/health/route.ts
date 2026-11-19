import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { MODEL_COUNT } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    const result = (await db.execute(sql`select now()::text as now`)) as unknown as {
      rows?: { now: string }[];
    };
    return NextResponse.json({
      ok: true,
      service: "firm-fleet-classification",
      version: "1.0.0",
      database: process.env.DATABASE_URL ? "postgres" : "pglite",
      time: result.rows?.[0]?.now ?? null,
      modelMasterSize: MODEL_COUNT,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        service: "firm-fleet-classification",
        error: error instanceof Error ? error.message : "database unavailable",
      },
      { status: 503 },
    );
  }
}
