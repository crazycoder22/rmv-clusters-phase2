import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Fetch the event with both resident and guest RSVPs
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
          guestRsvps: {
            include: {
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

  // Map resident participants
  const residentParticipants = announcement.eventConfig.rsvps.map((rsvp) => ({
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

  // Map guest participants
  const guestParticipants = announcement.eventConfig.guestRsvps.map((grsvp) => ({
    id: grsvp.id,
    name: grsvp.name,
    block: grsvp.block,
    flatNumber: grsvp.flatNumber,
    fieldResponses: grsvp.fieldResponses.map((fr) => ({
      customFieldId: fr.customFieldId,
      customField: { label: fr.customField.label },
      value: fr.value,
    })),
    createdAt: grsvp.createdAt,
  }));

  // Combine and sort by registration date
  const participants = [...residentParticipants, ...guestParticipants].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

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
