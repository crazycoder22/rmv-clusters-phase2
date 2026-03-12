import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageNewsletters } from "@/lib/roles";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canManageNewsletters(session.user.roles)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const submissions = await prisma.newsletterSubmission.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      resident: {
        select: { id: true, name: true, email: true, block: true, flatNumber: true },
      },
    },
  });

  return NextResponse.json({ submissions });
}
