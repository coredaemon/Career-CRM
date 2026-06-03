import { NextResponse } from "next/server";
import { fromJsonText } from "@/lib/json";
import { recalculateSearchRunStats } from "@/lib/search-run-stats";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const run = await recalculateSearchRunStats(id);
    return NextResponse.json({
      ok: true,
      run,
      progress: fromJsonText(run.progressJson, {})
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Запуск не найден." }, { status: 404 });
  }
}
