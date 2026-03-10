import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.isRegistered || !session.user.isApproved) {
    return NextResponse.json({ error: "Not approved" }, { status: 403 });
  }

  const { id } = await params;
  const isAdminUser = canManageAnnouncements(session.user.roles);

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!resident) {
    return NextResponse.json({ error: "Resident not found" }, { status: 404 });
  }

  // Fetch the event with RSVPs and custom field responses
  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: {
      eventConfig: {
        include: {
          customFields: { orderBy: { sortOrder: "asc" } },
          rsvps: {
            include: {
              resident: {
                select: { name: true, block: true, flatNumber: true },
              },
              fieldResponses: {
                include: {
                  customField: { select: { id: true, label: true } },
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!announcement || !announcement.eventConfig) {
    return NextResponse.json(
      { error: "Event not found or RSVP not enabled" },
      { status: 404 }
    );
  }

  // Check if user has RSVP'd (unless admin/event manager)
  if (!isAdminUser) {
    const hasRsvp = announcement.eventConfig.rsvps.some(
      (r) => r.residentId === resident.id
    );
    if (!hasRsvp) {
      return NextResponse.json(
        { error: "You must RSVP for this event to view the dashboard" },
        { status: 403 }
      );
    }
  }

  // Map participants (resident RSVPs only for privacy)
  const participants = announcement.eventConfig.rsvps.map((rsvp) => ({
    id: rsvp.id,
    name: rsvp.resident.name,
    block: rsvp.resident.block,
    flatNumber: rsvp.resident.flatNumber,
    fieldResponses: rsvp.fieldResponses.map((fr) => ({
      customFieldId: fr.customFieldId,
      customField: { label: fr.customField.label },
      value: fr.value,
    })),
    createdAt: rsvp.createdAt,
  }));

  return NextResponse.json({
    announcement: {
      id: announcement.id,
      title: announcement.title,
      date: announcement.date,
      summary: announcement.summary,
    },
    eventConfig: {
      id: announcement.eventConfig.id,
      customFields: announcement.eventConfig.customFields,
    },
    participants,
    totalParticipants: participants.length,
  });
}
