import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find the resident
  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true, isApproved: true },
  });

  if (!resident || !resident.isApproved) {
    return NextResponse.json(
      { error: "Only approved residents can submit articles" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { title, contentHtml } = body;

  if (!title?.trim() || !contentHtml?.trim()) {
    return NextResponse.json(
      { error: "Title and content are required" },
      { status: 400 }
    );
  }

  const submission = await prisma.newsletterSubmission.create({
    data: {
      title: title.trim(),
      contentHtml,
      residentId: resident.id,
    },
  });

  return NextResponse.json({ submission }, { status: 201 });
}
