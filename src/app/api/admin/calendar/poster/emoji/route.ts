import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!canManageAnnouncements(session.user.roles)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session };
}

export async function PATCH(request: Request) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { id, emoji, source } = await request.json();

  if (!id || !emoji || !source) {
    return NextResponse.json(
      { error: "id, emoji, and source are required" },
      { status: 400 }
    );
  }

  try {
    if (source === "calendar") {
      await prisma.calendarEvent.update({
        where: { id },
        data: { emoji },
      });
    } else if (source === "announcement") {
      await prisma.announcement.update({
        where: { id },
        data: { emoji },
      });
    } else {
      return NextResponse.json(
        { error: "Invalid source" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to update emoji" },
      { status: 500 }
    );
  }
}
