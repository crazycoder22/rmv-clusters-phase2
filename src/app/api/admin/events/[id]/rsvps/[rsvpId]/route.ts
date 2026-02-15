import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN") {
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
    const rsvp = await prisma.rsvp.update({
      where: { id: rsvpId },
      data: { paid: body.paid },
      include: {
        resident: {
          select: { id: true, name: true, email: true, block: true, flatNumber: true },
        },
        items: { include: { menuItem: true } },
      },
    });
    return NextResponse.json({ success: true, rsvp });
  } catch {
    return NextResponse.json(
      { error: "RSVP not found" },
      { status: 404 }
    );
  }
}
