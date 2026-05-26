import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";
import { getAuthedResident } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// Accepts NextAuth cookie (web) or `Authorization: Bearer <jwt>` (mobile).
async function requireAdmin(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canManageAnnouncements(resident.roles)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { resident };
}

// GET /api/admin/public-events — list all events with registration counts.
export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if ("error" in check && check.error) return check.error;

  const events = await prisma.publicEvent.findMany({
    orderBy: { startAt: "desc" },
    include: {
      _count: { select: { registrations: true } },
      createdBy: { select: { name: true } },
    },
  });

  return NextResponse.json({
    events: events.map((e) => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      organizer: e.organizer,
      venue: e.venue,
      startAt: e.startAt,
      endAt: e.endAt,
      registrationClosesAt: e.registrationClosesAt,
      active: e.active,
      registrationCount: e._count.registrations,
      createdByName: e.createdBy.name,
      createdAt: e.createdAt,
    })),
  });
}

// POST /api/admin/public-events — create a new event. Admin only.
export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if ("error" in check && check.error) return check.error;
  // getAuthedResident already returned the full Resident; no extra lookup needed.
  const resident = { id: check.resident.id };

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const {
    slug,
    title,
    description,
    organizer,
    venue,
    startAt,
    endAt,
    registrationClosesAt,
    active,
    contributionEnabled,
    maxContribution,
    targetAmount,
    paymentInstructions,
    paymentQrImageUrl,
    upiId,
  } = body as {
    slug?: string;
    title?: string;
    description?: string;
    organizer?: string;
    venue?: string;
    startAt?: string;
    endAt?: string;
    registrationClosesAt?: string;
    active?: boolean;
    contributionEnabled?: boolean;
    maxContribution?: number | null;
    targetAmount?: number | null;
    paymentInstructions?: string | null;
    paymentQrImageUrl?: string | null;
    upiId?: string | null;
  };

  if (!slug?.trim() || !title?.trim() || !startAt) {
    return NextResponse.json(
      { error: "slug, title and startAt are required" },
      { status: 400 }
    );
  }
  // Slug must be URL-safe lowercase-kebab.
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug.trim())) {
    return NextResponse.json(
      { error: "Slug may only contain lowercase letters, numbers and hyphens." },
      { status: 400 }
    );
  }

  const existing = await prisma.publicEvent.findUnique({
    where: { slug: slug.trim() },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An event with that slug already exists." },
      { status: 409 }
    );
  }

  const event = await prisma.publicEvent.create({
    data: {
      slug: slug.trim(),
      title: title.trim(),
      description: description?.trim() || null,
      organizer: organizer?.trim() || null,
      venue: venue?.trim() || null,
      startAt: new Date(startAt),
      endAt: endAt ? new Date(endAt) : null,
      registrationClosesAt: registrationClosesAt ? new Date(registrationClosesAt) : null,
      active: active !== undefined ? active : true,
      contributionEnabled: contributionEnabled === true,
      maxContribution: maxContribution ?? null,
      targetAmount: targetAmount ?? null,
      paymentInstructions: paymentInstructions?.trim() || null,
      paymentQrImageUrl: paymentQrImageUrl?.trim() || null,
      upiId: upiId?.trim() || null,
      createdById: resident.id,
    },
  });

  return NextResponse.json({ event }, { status: 201 });
}
