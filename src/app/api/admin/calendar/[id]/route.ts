import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";
import { getAuthedResident } from "@/lib/api-auth";

// Accepts NextAuth cookie (web) or `Authorization: Bearer <jwt>` (mobile).
async function requireAdmin(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canManageAnnouncements(resident.roles)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { resident };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin(request);
  if ("error" in check && check.error) return check.error;

  const { id } = await params;
  const body = await request.json();
  const { title, date, color } = body;

  if (!title?.trim() || !date) {
    return NextResponse.json(
      { error: "Title and date are required" },
      { status: 400 }
    );
  }

  const event = await prisma.calendarEvent.update({
    where: { id },
    data: {
      title: title.trim(),
      date: new Date(date),
      color: color || "#3b82f6",
    },
  });

  return NextResponse.json({ event });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin(request);
  if ("error" in check && check.error) return check.error;

  const { id } = await params;

  await prisma.calendarEvent.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
