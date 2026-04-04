import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/housekeeping/feedback?block=1&month=4&year=2026
// Returns staff assigned + feedback for that block/month (public read)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const block = parseInt(searchParams.get("block") ?? "");
  const month = parseInt(searchParams.get("month") ?? "");
  const year = parseInt(searchParams.get("year") ?? "");

  if (!block || !month || !year) {
    return NextResponse.json({ error: "block, month, year are required" }, { status: 400 });
  }

  const [assignments, feedback] = await Promise.all([
    prisma.hKAssignment.findMany({
      where: { block, month, year },
      include: { staff: true },
    }),
    prisma.hKFeedback.findMany({
      where: { block, month, year },
      include: { resident: { select: { id: true, name: true, flatNumber: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ assignments, feedback });
}

// POST /api/housekeeping/feedback
// body: { block, month, year, rating, comment? }
// Logged-in: uses session resident. Guest: requires guestName, guestEmail, guestPhone, guestFlat
export async function POST(req: NextRequest) {
  const session = await auth();
  const body = await req.json();
  const { block, month, year, rating, comment, guestName, guestEmail, guestPhone, guestFlat } = body;

  if (!block || !month || !year || !rating) {
    return NextResponse.json({ error: "block, month, year, rating are required" }, { status: 400 });
  }
  if (rating < 1 || rating > 5) {
    return NextResponse.json({ error: "rating must be 1–5" }, { status: 400 });
  }

  let residentId: string | null = null;
  let residentBlock: number | null = null;

  if (session?.user?.email) {
    const resident = await prisma.resident.findUnique({
      where: { email: session.user.email },
      select: { id: true, block: true },
    });
    if (resident) {
      residentId = resident.id;
      residentBlock = resident.block;
    }
  }

  // Block check: logged-in resident must match the block they're giving feedback for
  if (residentBlock !== null && residentBlock !== block) {
    return NextResponse.json({ error: "You can only give feedback for your own block." }, { status: 403 });
  }

  // Guest must provide details
  if (!residentId) {
    if (!guestName?.trim() || !guestPhone?.trim() || !guestFlat?.trim()) {
      return NextResponse.json(
        { error: "Name, phone, and flat number are required for guest submissions." },
        { status: 400 }
      );
    }
  }

  const feedback = await prisma.hKFeedback.create({
    data: {
      block,
      month,
      year,
      rating,
      comment: comment?.trim() || null,
      residentId: residentId ?? undefined,
      guestName: residentId ? null : guestName?.trim(),
      guestEmail: residentId ? null : guestEmail?.trim() || null,
      guestPhone: residentId ? null : guestPhone?.trim(),
      guestFlat: residentId ? null : guestFlat?.trim(),
    },
  });

  return NextResponse.json({ feedback });
}
