import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { markProcessRunStopped, requestProcessStop } from "@/lib/process-run-service";
import { markAllStaleProcesses } from "@/lib/stale-process";

const bulkSchema = z.object({
  action: z.enum(["stop_ai", "stop_search", "mark_stale_stopped", "hide_completed"])
});

export async function POST(request: Request) {
  try {
    const body = bulkSchema.parse(await request.json().catch(() => ({})));

    if (body.action === "stop_ai") {
      const runs = await prisma.processRun.findMany({
        where: { type: "vacancy_analysis", status: { in: ["running", "queued"] } }
      });
      await Promise.all(runs.map((run) => requestProcessStop(run.id)));
      return NextResponse.json({ ok: true, stopped: runs.length });
    }

    if (body.action === "stop_search") {
      const runs = await prisma.searchRun.findMany({ where: { status: "running" } });
      await Promise.all(
        runs.map((run) =>
          prisma.searchRun.update({
            where: { id: run.id },
            data: { stopRequested: true, stage: "stopping" }
          })
        )
      );
      return NextResponse.json({ ok: true, stopped: runs.length });
    }

    if (body.action === "mark_stale_stopped") {
      await markAllStaleProcesses();
      const staleProcesses = await prisma.processRun.findMany({ where: { status: "stale" } });
      const staleSearch = await prisma.searchRun.findMany({ where: { status: "stale" } });
      await Promise.all(staleProcesses.map((run) => markProcessRunStopped(run.id, "marked_stale")));
      await Promise.all(
        staleSearch.map((run) =>
          prisma.searchRun.update({
            where: { id: run.id },
            data: { status: "stopped", stage: "stopped", finishedAt: new Date() }
          })
        )
      );
      return NextResponse.json({ ok: true, marked: staleProcesses.length + staleSearch.length });
    }

    if (body.action === "hide_completed") {
      const [processes, searches] = await Promise.all([
        prisma.processRun.updateMany({
          where: { status: { in: ["completed", "stopped", "error"] }, listHidden: false },
          data: { listHidden: true }
        }),
        prisma.searchRun.updateMany({
          where: { status: { in: ["completed", "stopped", "error"] }, listHidden: false },
          data: { listHidden: true }
        })
      ]);
      return NextResponse.json({ ok: true, hidden: processes.count + searches.count });
    }

    return NextResponse.json({ ok: false, message: "Неизвестное действие." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось выполнить действие." },
      { status: 400 }
    );
  }
}
