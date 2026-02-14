import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN") {
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

  const { id } = await params;
  const body = await request.json();

  // Validate category if provided
  if (body.category) {
    const validCategories = ["maintenance", "event", "general", "urgent"];
    if (!validCategories.includes(body.category)) {
      return NextResponse.json(
        { error: `Category must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }
  }

  // Validate priority if provided
  if (body.priority) {
    const validPriorities = ["low", "normal", "high"];
    if (!validPriorities.includes(body.priority)) {
      return NextResponse.json(
        { error: `Priority must be one of: ${validPriorities.join(", ")}` },
        { status: 400 }
      );
    }
  }

  // Build update data — only include provided fields
  const updateData: Record<string, unknown> = {};
  if (body.title !== undefined) updateData.title = body.title;
  if (body.date !== undefined) updateData.date = new Date(body.date);
  if (body.category !== undefined) updateData.category = body.category;
  if (body.priority !== undefined) updateData.priority = body.priority;
  if (body.summary !== undefined) updateData.summary = body.summary;
  if (body.body !== undefined) updateData.body = body.body;
  if (body.author !== undefined) updateData.author = body.author;
  if (body.link !== undefined) updateData.link = body.link || null;
  if (body.linkText !== undefined) updateData.linkText = body.linkText || null;
  if (body.published !== undefined) updateData.published = body.published;

  try {
    const announcement = await prisma.announcement.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json({ success: true, announcement });
  } catch {
    return NextResponse.json(
      { error: "Announcement not found" },
      { status: 404 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;

  try {
    await prisma.announcement.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Announcement not found" },
      { status: 404 }
    );
  }
}
