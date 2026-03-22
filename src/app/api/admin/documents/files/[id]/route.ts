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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireDocumentsAdmin();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;
  const body = await request.json();
  const { name, driveUrl, fileType, folderId, sortOrder } = body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name.trim();
  if (driveUrl !== undefined) data.driveUrl = driveUrl?.trim() || null;
  if (fileType !== undefined) data.fileType = fileType?.trim() || null;
  if (folderId !== undefined) data.folderId = folderId;
  if (sortOrder !== undefined) data.sortOrder = sortOrder;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const file = await prisma.documentFile.update({
    where: { id },
    data,
  });

  return NextResponse.json({ file });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireDocumentsAdmin();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;
  await prisma.documentFile.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
