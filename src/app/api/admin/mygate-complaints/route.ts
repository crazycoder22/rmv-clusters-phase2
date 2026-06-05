import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canViewMygate } from "@/lib/mygate-auth";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

// GET /api/admin/mygate-complaints?status=&category=&block=&open=&q=&page=
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewMygate(me.roles)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");
  const blockRaw = url.searchParams.get("block");
  const open = url.searchParams.get("open");
  const q = url.searchParams.get("q")?.trim();
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (category) where.category = category;
  if (blockRaw && /^\d+$/.test(blockRaw)) where.block = parseInt(blockRaw, 10);
  if (open === "true") where.isOpen = true;
  else if (open === "false") where.isOpen = false;
  if (q) {
    where.OR = [
      { subject: { contains: q, mode: "insensitive" } },
      { createdBy: { contains: q, mode: "insensitive" } },
      { flatRaw: { contains: q, mode: "insensitive" } },
      { assignee: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.mygateComplaint.count({ where }),
    prisma.mygateComplaint.findMany({
      where,
      orderBy: { mygateCreatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, mygateId: true, subject: true, category: true, subCategory: true,
        type: true, block: true, flatNumber: true, flatRaw: true, createdBy: true,
        status: true, isOpen: true, assignee: true, comments: true,
        mygateCreatedAt: true, lastUpdateAt: true, closedAt: true,
        resolutionMinutes: true, reopenCount: true, rating: true,
      },
    }),
  ]);

  return NextResponse.json({
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
    items: items.map((c) => ({
      ...c,
      mygateCreatedAt: c.mygateCreatedAt?.toISOString() ?? null,
      lastUpdateAt: c.lastUpdateAt?.toISOString() ?? null,
      closedAt: c.closedAt?.toISOString() ?? null,
    })),
  });
}
