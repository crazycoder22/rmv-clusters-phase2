import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";

export const dynamic = "force-dynamic";

// GET /api/admin/public-events/[id]/registrations
//   ?format=csv → downloadable CSV for the vendor
//   (default)   → JSON list
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAnnouncements(session.user.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  const event = await prisma.publicEvent.findUnique({
    where: { id },
    select: { id: true, slug: true, title: true, startAt: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const registrations = await prisma.publicEventRegistration.findMany({
    where: { eventId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      block: true,
      flatNumber: true,
      contributionAmount: true,
      paid: true,
      paidAt: true,
      adminNote: true,
      createdAt: true,
    },
  });

  if (format === "csv") {
    const header =
      "#,Name,Phone,Email,Block,Flat,Amount,Paid,Paid At,Registered At";
    const rows = registrations.map((r, i) => {
      const when = new Date(r.createdAt).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      });
      const paidWhen = r.paidAt
        ? new Date(r.paidAt).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            dateStyle: "medium",
            timeStyle: "short",
          })
        : "";
      const esc = (s: string | number | null) =>
        s == null ? "" : `"${String(s).replace(/"/g, '""')}"`;
      return [
        i + 1,
        esc(r.name),
        esc(r.phone),
        esc(r.email),
        r.block ?? "",
        esc(r.flatNumber),
        r.contributionAmount ?? "",
        r.paid ? "Yes" : "No",
        esc(paidWhen),
        esc(when),
      ].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const datePart = event.startAt.toISOString().split("T")[0];
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${event.slug}-${datePart}-registrations.csv"`,
      },
    });
  }

  return NextResponse.json({
    event: { id: event.id, slug: event.slug, title: event.title },
    registrations: registrations.map((r, i) => ({
      position: i + 1,
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      block: r.block,
      flatNumber: r.flatNumber,
      contributionAmount: r.contributionAmount,
      paid: r.paid,
      paidAt: r.paidAt,
      adminNote: r.adminNote,
      createdAt: r.createdAt,
    })),
  });
}

// PATCH /api/admin/public-events/[id]/registrations — update a registration
// (mark paid / unpaid, adjust amount, set admin note). Admin only.
// Body: { registrationId, paid?, contributionAmount?, adminNote? }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageAnnouncements(session.user.roles))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { registrationId, paid, contributionAmount, adminNote } = body as {
    registrationId?: string;
    paid?: boolean;
    contributionAmount?: number | null;
    adminNote?: string | null;
  };

  if (!registrationId)
    return NextResponse.json(
      { error: "registrationId required" },
      { status: 400 }
    );

  const existing = await prisma.publicEventRegistration.findUnique({
    where: { id: registrationId },
  });
  if (!existing || existing.eventId !== id)
    return NextResponse.json(
      { error: "Registration not found" },
      { status: 404 }
    );

  const data: Record<string, unknown> = {};
  if (typeof paid === "boolean") {
    data.paid = paid;
    data.paidAt = paid ? new Date() : null;
  }
  if (contributionAmount !== undefined)
    data.contributionAmount =
      contributionAmount == null
        ? null
        : Math.trunc(Number(contributionAmount));
  if (adminNote !== undefined)
    data.adminNote = adminNote ? String(adminNote).trim() : null;

  const updated = await prisma.publicEventRegistration.update({
    where: { id: registrationId },
    data,
  });

  return NextResponse.json({ registration: updated });
}
