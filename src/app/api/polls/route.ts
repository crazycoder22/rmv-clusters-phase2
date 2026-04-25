import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManagePolls } from "@/lib/roles";
import { getAuthedResident } from "@/lib/api-auth";

export async function GET(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { surveyId: null };
  if (status) where.status = status;

  const polls = await prisma.poll.findMany({
    where,
    include: {
      createdBy: { select: { name: true, block: true, flatNumber: true } },
      options: { orderBy: { sortOrder: "asc" } },
      _count: { select: { votes: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ polls });
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
  const { title, description, type, isAnonymous, deadline, options } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!deadline) {
    return NextResponse.json({ error: "Deadline is required" }, { status: 400 });
  }
  if (!options || !Array.isArray(options) || options.length < 2) {
    return NextResponse.json(
      { error: "At least 2 options are required" },
      { status: 400 }
    );
  }

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!resident) {
    return NextResponse.json({ error: "Resident not found" }, { status: 404 });
  }

  const poll = await prisma.$transaction(async (tx) => {
    const created = await tx.poll.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        type: type === "MULTIPLE" ? "MULTIPLE" : "SINGLE",
        isAnonymous: isAnonymous ?? false,
        deadline: new Date(deadline),
        createdById: resident.id,
        options: {
          create: options.map((text: string, i: number) => ({
            text: text.trim(),
            sortOrder: i,
          })),
        },
      },
      include: {
        options: true,
      },
    });

    // Notify all approved residents
    const residents = await tx.resident.findMany({
      where: { isApproved: true },
      select: { id: true },
    });
    if (residents.length > 0) {
      await tx.notification.createMany({
        data: residents.map((r) => ({
          residentId: r.id,
          pollId: created.id,
          message: `New poll: ${created.title}`,
        })),
        skipDuplicates: true,
      });
    }

    return created;
  });

  return NextResponse.json({ poll }, { status: 201 });
}
