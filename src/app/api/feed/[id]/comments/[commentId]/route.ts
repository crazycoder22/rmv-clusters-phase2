import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!resident.isApproved) {
    return NextResponse.json({ error: "Not approved" }, { status: 403 });
  }

  const { commentId } = await params;

  const comment = await prisma.postComment.findUnique({
    where: { id: commentId },
    select: { authorId: true },
  });

  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const isAuthor = comment.authorId === resident.id;
  const isAdminish = resident.roles.some((r) =>
    ["ADMIN", "SUPERADMIN"].includes(r)
  );

  if (!isAuthor && !isAdminish) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.postComment.delete({ where: { id: commentId } });

  return NextResponse.json({ success: true });
}
