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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { code } = await params;

  // Parse type prefix and ID
  const match = code.match(/^(r|g)-(.+)$/);
  if (!match) {
    return NextResponse.json(
      { error: "Invalid pass code" },
      { status: 400 }
    );
  }

  const [, type, id] = match;

  try {
    if (type === "r") {
      // Resident RSVP
      const rsvp = await prisma.rsvp.findUnique({
        where: { id },
        select: {
          attended: true,
          attendedAt: true,
          resident: { select: { name: true } },
        },
      });

      if (!rsvp) {
        return NextResponse.json(
          { error: "Pass not found" },
          { status: 404 }
        );
      }

      if (rsvp.attended) {
        return NextResponse.json({
          success: true,
          alreadyAttended: true,
          attendedAt: rsvp.attendedAt,
          name: rsvp.resident.name,
        });
      }

      const now = new Date();
      await prisma.rsvp.update({
        where: { id },
        data: { attended: true, attendedAt: now },
      });

      return NextResponse.json({
        success: true,
        alreadyAttended: false,
        attendedAt: now,
        name: rsvp.resident.name,
      });
    } else {
      // Guest RSVP
      const guestRsvp = await prisma.guestRsvp.findUnique({
        where: { id },
        select: {
          attended: true,
          attendedAt: true,
          name: true,
        },
      });

      if (!guestRsvp) {
        return NextResponse.json(
          { error: "Pass not found" },
          { status: 404 }
        );
      }

      if (guestRsvp.attended) {
        return NextResponse.json({
          success: true,
          alreadyAttended: true,
          attendedAt: guestRsvp.attendedAt,
          name: guestRsvp.name,
        });
      }

      const now = new Date();
      await prisma.guestRsvp.update({
        where: { id },
        data: { attended: true, attendedAt: now },
      });

      return NextResponse.json({
        success: true,
        alreadyAttended: false,
        attendedAt: now,
        name: guestRsvp.name,
      });
    }
  } catch (err) {
    console.error("Attendance marking error:", err);
    return NextResponse.json(
      { error: "Failed to mark attendance" },
      { status: 500 }
    );
  }
}
