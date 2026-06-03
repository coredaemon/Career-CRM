import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "draft";

  const observations = await prisma.learningObservation.findMany({
    where: { status: status as "draft" | "proposed" | "accepted" | "rejected" },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return NextResponse.json({ observations });
}
