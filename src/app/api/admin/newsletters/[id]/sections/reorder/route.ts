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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  await params; // consume params
  const body = await request.json();
  const { sectionIds } = body as { sectionIds: string[] };

  if (!Array.isArray(sectionIds) || sectionIds.length === 0) {
    return NextResponse.json(
      { error: "sectionIds array is required" },
      { status: 400 }
    );
  }

  // Update sort order for each section
  await Promise.all(
    sectionIds.map((id, index) =>
      prisma.newsletterSection.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  return NextResponse.json({ success: true });
}
