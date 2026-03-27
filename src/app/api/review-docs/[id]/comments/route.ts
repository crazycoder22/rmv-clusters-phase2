import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireResident() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, isApproved: true },
  });
  if (!resident || !resident.isApproved) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, resident };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireResident();
  if ("error" in result && result.error instanceof NextResponse) {
    return result.error;
  }
  const { resident } = result as { resident: { id: string; name: string; isApproved: boolean } };

  const { id: reviewDocumentId } = await params;

  const doc = await prisma.reviewDocument.findUnique({
    where: { id: reviewDocumentId },
    select: { id: true, title: true, status: true, createdById: true },
  });

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (doc.status !== "PUBLISHED") {
    return NextResponse.json(
      { error: "Comments are only allowed on published documents" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { content, type, suggestedText, highlightFrom, highlightTo, highlightedText, parentId } =
    body as {
      content: string;
      type?: string;
      suggestedText?: string;
      highlightFrom?: number;
      highlightTo?: number;
      highlightedText?: string;
      parentId?: string;
    };

  if (!content || !content.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const commentType = type === "SUGGESTION" ? "SUGGESTION" : "COMMENT";

  // If parentId is provided, verify the parent comment exists and belongs to this doc
  if (parentId) {
    const parentComment = await prisma.reviewComment.findUnique({
      where: { id: parentId },
      select: { id: true, reviewDocumentId: true },
    });
    if (!parentComment || parentComment.reviewDocumentId !== reviewDocumentId) {
      return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
    }
  }

  const comment = await prisma.reviewComment.create({
    data: {
      reviewDocumentId,
      residentId: resident.id,
      content: content.trim(),
      type: commentType,
      suggestedText: suggestedText?.trim() || null,
      highlightFrom: highlightFrom ?? null,
      highlightTo: highlightTo ?? null,
      highlightedText: highlightedText ?? null,
      parentId: parentId || null,
    },
    include: {
      resident: {
        select: { id: true, name: true, block: true, flatNumber: true, googleImage: true },
      },
    },
  });

  // Notify doc author if commenter is not the author
  if (doc.createdById !== resident.id) {
    await prisma.notification.create({
      data: {
        residentId: doc.createdById,
        reviewDocId: reviewDocumentId,
        message: `${resident.name} commented on: ${doc.title}`,
      },
    });
  }

  // If this is a reply, notify the parent comment author (if different from commenter)
  if (parentId) {
    const parentComment = await prisma.reviewComment.findUnique({
      where: { id: parentId },
      select: { residentId: true },
    });
    if (parentComment && parentComment.residentId !== resident.id) {
      await prisma.notification.create({
        data: {
          residentId: parentComment.residentId,
          reviewDocId: reviewDocumentId,
          message: `${resident.name} replied to your comment on: ${doc.title}`,
        },
      });
    }
  }

  return NextResponse.json({ comment }, { status: 201 });
}
