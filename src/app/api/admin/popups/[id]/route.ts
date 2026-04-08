import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email)
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!canManageAnnouncements(session.user.roles))
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.message !== undefined) data.message = body.message.trim();
  if (body.active !== undefined) data.active = body.active;
  if (body.startsAt !== undefined) data.startsAt = new Date(body.startsAt);
  if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  const popup = await prisma.sitePopup.update({ where: { id }, data });
  return NextResponse.json({ popup });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;
  await prisma.sitePopup.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
