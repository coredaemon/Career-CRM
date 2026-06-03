import { NextResponse } from "next/server";
import { getActiveProcessesSummary } from "@/lib/active-processes";

export async function GET() {
  const summary = await getActiveProcessesSummary();
  return NextResponse.json({ ok: true, ...summary });
}
