import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email)
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!canManageAnnouncements(session.user.roles))
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session };
}

// PATCH /api/admin/public-events/[id] — edit event config. Used by admin to
// turn on contributions, update UPI / QR / instructions, close registration
// early, etc.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const existing = await prisma.publicEvent.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const data: Record<string, unknown> = {};

  if ("title" in body) data.title = String(body.title).trim();
  if ("description" in body)
    data.description = body.description ? String(body.description).trim() : null;
  if ("organizer" in body)
    data.organizer = body.organizer ? String(body.organizer).trim() : null;
  if ("venue" in body)
    data.venue = body.venue ? String(body.venue).trim() : null;
  if ("startAt" in body && body.startAt)
    data.startAt = new Date(body.startAt);
  if ("endAt" in body)
    data.endAt = body.endAt ? new Date(body.endAt) : null;
  if ("registrationClosesAt" in body)
    data.registrationClosesAt = body.registrationClosesAt
      ? new Date(body.registrationClosesAt)
      : null;
  if ("active" in body) data.active = body.active === true;
  if ("contributionEnabled" in body)
    data.contributionEnabled = body.contributionEnabled === true;
  if ("maxContribution" in body)
    data.maxContribution =
      body.maxContribution == null || body.maxContribution === ""
        ? null
        : Math.trunc(Number(body.maxContribution));
  if ("targetAmount" in body)
    data.targetAmount =
      body.targetAmount == null || body.targetAmount === ""
        ? null
        : Math.trunc(Number(body.targetAmount));
  if ("paymentInstructions" in body)
    data.paymentInstructions = body.paymentInstructions
      ? String(body.paymentInstructions).trim()
      : null;
  if ("paymentQrImageUrl" in body)
    data.paymentQrImageUrl = body.paymentQrImageUrl
      ? String(body.paymentQrImageUrl).trim()
      : null;
  if ("upiId" in body)
    data.upiId = body.upiId ? String(body.upiId).trim() : null;

  const updated = await prisma.publicEvent.update({
    where: { id },
    data,
  });

  return NextResponse.json({ event: updated });
}
