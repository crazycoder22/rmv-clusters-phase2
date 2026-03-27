import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageReviewDocs } from "@/lib/roles";

async function requireResident() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, isApproved: true, roles: { select: { name: true } } },
  });
  if (!resident || !resident.isApproved) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, resident };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const result = await requireResident();
  if ("error" in result && result.error instanceof NextResponse) {
    return result.error;
  }
  const { resident } = result as {
    resident: { id: string; name: string; isApproved: boolean; roles: { name: string }[] };
  };

  const { commentId } = await params;

  const comment = await prisma.reviewComment.findUnique({
    where: { id: commentId },
    select: { id: true, residentId: true },
  });

  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  if (comment.residentId !== resident.id) {
    return NextResponse.json({ error: "You can only edit your own comments" }, { status: 403 });
  }

  const body = await request.json();
  const { content, suggestedText } = body as { content?: string; suggestedText?: string };

  const data: Record<string, string | null> = {};
  if (content !== undefined) {
    if (!content.trim()) {
      return NextResponse.json({ error: "Content cannot be empty" }, { status: 400 });
    }
    data.content = content.trim();
  }
  if (suggestedText !== undefined) {
    data.suggestedText = suggestedText?.trim() || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.reviewComment.update({
    where: { id: commentId },
    data,
    include: {
      resident: {
        select: { id: true, name: true, block: true, flatNumber: true, googleImage: true },
      },
    },
  });

  return NextResponse.json({ comment: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const result = await requireResident();
  if ("error" in result && result.error instanceof NextResponse) {
    return result.error;
  }
  const { resident } = result as {
    resident: { id: string; name: string; isApproved: boolean; roles: { name: string }[] };
  };

  const { commentId } = await params;

  const comment = await prisma.reviewComment.findUnique({
    where: { id: commentId },
    select: { id: true, residentId: true },
  });

  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const isAuthor = comment.residentId === resident.id;
  const isAdminUser = canManageReviewDocs(resident.roles.map((r) => r.name));

  if (!isAuthor && !isAdminUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.reviewComment.delete({ where: { id: commentId } });

  return NextResponse.json({ success: true });
}
