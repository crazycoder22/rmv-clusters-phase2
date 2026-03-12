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
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { sectionId } = await params;
  const body = await request.json();
  const { type, title, contentHtml, authorName, authorBlock, authorFlat } = body;

  const data: Record<string, unknown> = {};
  if (type !== undefined) data.type = type;
  if (title !== undefined) data.title = title.trim();
  if (contentHtml !== undefined) data.contentHtml = contentHtml;
  if (authorName !== undefined) data.authorName = authorName?.trim() || null;
  if (authorBlock !== undefined) data.authorBlock = authorBlock || null;
  if (authorFlat !== undefined) data.authorFlat = authorFlat?.trim() || null;

  const section = await prisma.newsletterSection.update({
    where: { id: sectionId },
    data,
  });

  return NextResponse.json({ section });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { sectionId } = await params;

  await prisma.newsletterSection.delete({ where: { id: sectionId } });

  return NextResponse.json({ success: true });
}
