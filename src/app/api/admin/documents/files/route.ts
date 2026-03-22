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

export async function POST(request: Request) {
  const check = await requireDocumentsAdmin();
  if ("error" in check && check.error) return check.error;

  const body = await request.json();
  const { name, folderId, driveUrl, fileType } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!folderId) {
    return NextResponse.json({ error: "Folder is required" }, { status: 400 });
  }

  const maxSort = await prisma.documentFile.aggregate({
    _max: { sortOrder: true },
    where: { folderId },
  });
  const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

  const file = await prisma.documentFile.create({
    data: {
      name: name.trim(),
      folderId,
      driveUrl: driveUrl?.trim() || null,
      fileType: fileType?.trim() || null,
      sortOrder,
    },
  });

  return NextResponse.json({ file }, { status: 201 });
}
