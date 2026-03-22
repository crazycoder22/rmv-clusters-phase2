import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDocuments } from "@/lib/roles";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageDocuments(session.user.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const folders = await prisma.documentFolder.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: "asc" },
    include: {
      children: {
        orderBy: { sortOrder: "asc" },
        include: {
          children: {
            orderBy: { sortOrder: "asc" },
            include: {
              children: { orderBy: { sortOrder: "asc" }, include: { files: { orderBy: { sortOrder: "asc" } } } },
              files: { orderBy: { sortOrder: "asc" } },
            },
          },
          files: { orderBy: { sortOrder: "asc" } },
        },
      },
      files: { orderBy: { sortOrder: "asc" } },
    },
  });

  return NextResponse.json({ folders });
}
