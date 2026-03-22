import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDocuments } from "@/lib/roles";

async function requireDocumentsAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canManageDocuments(session.user.roles)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const check = await requireDocumentsAdmin();
  if ("error" in check && check.error) return check.error;

  const folders = await prisma.documentFolder.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      children: { orderBy: { sortOrder: "asc" } },
      files: { orderBy: { sortOrder: "asc" } },
    },
  });

  return NextResponse.json({ folders });
}

export async function POST(request: Request) {
  const check = await requireDocumentsAdmin();
  if ("error" in check && check.error) return check.error;

  const body = await request.json();
  const { name, parentId, driveUrl } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const maxSort = await prisma.documentFolder.aggregate({
    _max: { sortOrder: true },
    where: { parentId: parentId || null },
  });
  const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

  const folder = await prisma.documentFolder.create({
    data: {
      name: name.trim(),
      parentId: parentId || null,
      driveUrl: driveUrl?.trim() || null,
      sortOrder,
    },
  });

  return NextResponse.json({ folder }, { status: 201 });
}
