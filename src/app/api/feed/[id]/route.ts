import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { del } from "@vercel/blob";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email || !session.user.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true, roles: { select: { name: true } } },
  });
  if (!resident) {
    return NextResponse.json({ error: "Not registered" }, { status: 403 });
  }

  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    select: { authorId: true, images: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const isAuthor = post.authorId === resident.id;
  const isAdmin = resident.roles.some((r) =>
    ["ADMIN", "SUPERADMIN"].includes(r.name)
  );

  if (!isAuthor && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Cleanup Vercel Blob images
  if (post.images.length > 0) {
    try {
      await Promise.all(post.images.map((url) => del(url)));
    } catch {
      // Continue even if blob cleanup fails
    }
  }

  await prisma.post.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
