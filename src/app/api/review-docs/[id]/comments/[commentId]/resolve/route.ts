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

export async function POST(
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
    select: { id: true, residentId: true, resolved: true },
  });

  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const isAuthor = comment.residentId === resident.id;
  const isAdminUser = canManageReviewDocs(resident.roles.map((r) => r.name));

  if (!isAuthor && !isAdminUser) {
    return NextResponse.json(
      { error: "Only the comment author or an admin can resolve comments" },
      { status: 403 }
    );
  }

  // Toggle resolve state
  const nowResolved = !comment.resolved;

  const updated = await prisma.reviewComment.update({
    where: { id: commentId },
    data: nowResolved
      ? {
          resolved: true,
          resolvedById: resident.id,
          resolvedAt: new Date(),
        }
      : {
          resolved: false,
          resolvedById: null,
          resolvedAt: null,
        },
    include: {
      resident: {
        select: { id: true, name: true, block: true, flatNumber: true, googleImage: true },
      },
      resolvedBy: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json({ comment: updated });
}
