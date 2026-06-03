import { NextResponse } from "next/server";
import { requestProcessStop } from "@/lib/process-run-service";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const run = await requestProcessStop(id);
    return NextResponse.json({ ok: true, run });
  } catch {
    return NextResponse.json({ ok: false, message: "Процесс не найден." }, { status: 404 });
  }
}
