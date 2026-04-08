import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageAnnouncements } from "@/lib/roles";

export const dynamic = "force-dynamic";

// POST — End a Tambola session (admin only)
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageAnnouncements(session.user.roles))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tambolaSession = await prisma.tambolaSession.findUnique({
    where: { code },
  });
  if (!tambolaSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (tambolaSession.status === "COMPLETED") {
    return NextResponse.json(
      { error: "Session is already completed" },
      { status: 400 }
    );
  }

  await prisma.tambolaSession.update({
    where: { id: tambolaSession.id },
    data: { status: "COMPLETED" },
  });

  return NextResponse.json({ success: true });
}
