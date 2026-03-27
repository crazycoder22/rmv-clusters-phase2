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

export async function GET(request: Request) {
  const check = await requireReviewDocsAccess();
  if ("error" in check && check.error) return check.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const reviewDocs = await prisma.reviewDocument.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, flatNumber: true },
      },
      _count: { select: { comments: true } },
    },
  });

  return NextResponse.json({ reviewDocs });
}

export async function POST(request: Request) {
  const check = await requireReviewDocsAccess();
  if ("error" in check && check.error) return check.error;

  const body = await request.json();
  const { title, content, linkedDocumentId } = body;

  if (!title || !content) {
    return NextResponse.json(
      { error: "Title and content are required" },
      { status: 400 }
    );
  }

  const resident = await prisma.resident.findUnique({
    where: { email: check.session.user.email! },
  });

  if (!resident) {
    return NextResponse.json(
      { error: "Resident profile not found" },
      { status: 404 }
    );
  }

  try {
    const reviewDoc = await prisma.reviewDocument.create({
      data: {
        title,
        content,
        status: "DRAFT",
        createdById: resident.id,
        linkedDocumentId: linkedDocumentId || null,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, flatNumber: true },
        },
        _count: { select: { comments: true } },
      },
    });

    return NextResponse.json({ success: true, reviewDoc }, { status: 201 });
  } catch (err) {
    console.error("Failed to create review document:", err);
    return NextResponse.json(
      { error: "Failed to create review document" },
      { status: 500 }
    );
  }
}
