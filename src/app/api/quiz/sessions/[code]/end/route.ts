import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageAnnouncements } from "@/lib/roles";

export const dynamic = "force-dynamic";

// POST — End the quiz session (admin)
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const authSession = await auth();
  if (!authSession?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageAnnouncements(authSession.user.roles))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.quizSession.update({
    where: { code },
    data: { status: "COMPLETED" },
  });

  return NextResponse.json({ status: "COMPLETED" });
}
