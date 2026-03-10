import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canManageAnnouncements(session.user.roles)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; rsvpId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { rsvpId } = await params;
  const body = await request.json();

  try {
    const guestRsvp = await prisma.guestRsvp.update({
      where: { id: rsvpId },
      data: { paid: body.paid },
      include: {
        items: { include: { menuItem: true } },
      },
    });
    return NextResponse.json({ success: true, guestRsvp });
  } catch {
    return NextResponse.json(
      { error: "Guest RSVP not found" },
      { status: 404 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; rsvpId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { rsvpId } = await params;

  try {
    await prisma.guestRsvp.delete({ where: { id: rsvpId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Guest RSVP not found" },
      { status: 404 }
    );
  }
}
