import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageNewsletters } from "@/lib/roles";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canManageNewsletters(session.user.roles)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { submissionId } = await params;
  const body = await request.json();
  const { status, adminNotes, newsletterId } = body;

  if (!status || !["approved", "rejected"].includes(status)) {
    return NextResponse.json(
      { error: "Status must be 'approved' or 'rejected'" },
      { status: 400 }
    );
  }

  // Update submission status
  const submission = await prisma.newsletterSubmission.update({
    where: { id: submissionId },
    data: {
      status,
      adminNotes: adminNotes?.trim() || null,
    },
    include: {
      resident: {
        select: { name: true, block: true, flatNumber: true },
      },
    },
  });

  // If approved and a newsletter is specified, create a section in that newsletter
  if (status === "approved" && newsletterId) {
    const maxSort = await prisma.newsletterSection.aggregate({
      where: { newsletterId },
      _max: { sortOrder: true },
    });
    const nextSortOrder = (maxSort._max.sortOrder ?? -1) + 1;

    await prisma.newsletterSection.create({
      data: {
        newsletterId,
        type: "article",
        title: submission.title,
        contentHtml: submission.contentHtml,
        authorName: submission.resident.name,
        authorBlock: submission.resident.block,
        authorFlat: submission.resident.flatNumber,
        sortOrder: nextSortOrder,
      },
    });
  }

  return NextResponse.json({ submission });
}
