import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManagePolls } from "@/lib/roles";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const surveys = await prisma.survey.findMany({
    where,
    include: {
      createdBy: { select: { name: true, block: true, flatNumber: true } },
      polls: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true },
      },
      _count: { select: { polls: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ surveys });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManagePolls(session.user.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { title, description, isAnonymous, deadline, questions } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!deadline) {
    return NextResponse.json({ error: "Deadline is required" }, { status: 400 });
  }
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json(
      { error: "At least one question is required" },
      { status: 400 }
    );
  }

  // Validate each question has at least 2 options
  for (const q of questions) {
    if (!q.title?.trim()) {
      return NextResponse.json(
        { error: "Each question must have a title" },
        { status: 400 }
      );
    }
    if (!q.options || q.options.length < 2) {
      return NextResponse.json(
        { error: `Question "${q.title}" needs at least 2 options` },
        { status: 400 }
      );
    }
  }

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!resident) {
    return NextResponse.json({ error: "Resident not found" }, { status: 404 });
  }

  const deadlineDate = new Date(deadline);

  const survey = await prisma.$transaction(async (tx) => {
    const created = await tx.survey.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        isAnonymous: isAnonymous ?? false,
        deadline: deadlineDate,
        createdById: resident.id,
      },
    });

    // Create polls (questions) for the survey
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await tx.poll.create({
        data: {
          title: q.title.trim(),
          description: q.description?.trim() || null,
          type: q.type === "MULTIPLE" ? "MULTIPLE" : "SINGLE",
          isAnonymous: isAnonymous ?? false,
          deadline: deadlineDate,
          sortOrder: i,
          createdById: resident.id,
          surveyId: created.id,
          options: {
            create: q.options
              .filter((o: string) => o.trim())
              .map((text: string, j: number) => ({
                text: text.trim(),
                sortOrder: j,
              })),
          },
        },
      });
    }

    // Notify all approved residents
    const residents = await tx.resident.findMany({
      where: { isApproved: true },
      select: { id: true },
    });
    if (residents.length > 0) {
      await tx.notification.createMany({
        data: residents.map((r) => ({
          residentId: r.id,
          surveyId: created.id,
          message: `New survey: ${created.title}`,
        })),
        skipDuplicates: true,
      });
    }

    return created;
  });

  return NextResponse.json({ survey }, { status: 201 });
}
