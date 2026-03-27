import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageReviewDocs } from "@/lib/roles";

async function requireReviewDocsAccess() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canManageReviewDocs(session.user.roles)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireReviewDocsAccess();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;

  try {
    const reviewDoc = await prisma.reviewDocument.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, flatNumber: true },
        },
        linkedDocument: true,
        comments: {
          where: { parentId: null },
          orderBy: { createdAt: "asc" },
          include: {
            resident: {
              select: { id: true, name: true, email: true, flatNumber: true },
            },
            replies: {
              orderBy: { createdAt: "asc" },
              include: {
                resident: {
                  select: { id: true, name: true, email: true, flatNumber: true },
                },
              },
            },
          },
        },
      },
    });

    if (!reviewDoc) {
      return NextResponse.json(
        { error: "Review document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ reviewDoc });
  } catch {
    return NextResponse.json(
      { error: "Review document not found" },
      { status: 404 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireReviewDocsAccess();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;
  const body = await request.json();
  const { title, content, status } = body;

  // Validate status if provided
  if (status) {
    const validStatuses = ["DRAFT", "PUBLISHED", "CLOSED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }
  }

  try {
    const existing = await prisma.reviewDocument.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Review document not found" },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (status !== undefined) {
      updateData.status = status;
      if (status === "PUBLISHED" && existing.status !== "PUBLISHED") {
        updateData.publishedAt = new Date();
      }
      if (status === "CLOSED" && existing.status !== "CLOSED") {
        updateData.closedAt = new Date();
      }
    }

    const reviewDoc = await prisma.reviewDocument.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, flatNumber: true },
        },
        _count: { select: { comments: true } },
      },
    });

    // Create notifications when publishing
    if (status === "PUBLISHED" && existing.status !== "PUBLISHED") {
      const resident = await prisma.resident.findUnique({
        where: { email: check.session.user.email! },
      });

      if (resident) {
        const residents = await prisma.resident.findMany({
          where: { isApproved: true, id: { not: resident.id } },
          select: { id: true },
        });
        await prisma.notification.createMany({
          data: residents.map((r) => ({
            residentId: r.id,
            reviewDocId: reviewDoc.id,
            message: `New document for review: ${reviewDoc.title}`,
          })),
          skipDuplicates: true,
        });
      }
    }

    return NextResponse.json({ success: true, reviewDoc });
  } catch {
    return NextResponse.json(
      { error: "Failed to update review document" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireReviewDocsAccess();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;

  try {
    const existing = await prisma.reviewDocument.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Review document not found" },
        { status: 404 }
      );
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft documents can be deleted" },
        { status: 400 }
      );
    }

    await prisma.reviewDocument.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete review document" },
      { status: 500 }
    );
  }
}
