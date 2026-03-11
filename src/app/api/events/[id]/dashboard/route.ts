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

  const entranceFee = announcement.eventConfig.entranceFee ?? 0;
  const ec = announcement.eventConfig;

  // Fetch all step entries for this event
  const stepEntries = await prisma.stepEntry.findMany({
    where: { eventConfigId: ec.id },
    orderBy: { date: "asc" },
  });

  // Group step entries by participant
  const stepsByParticipant = new Map<string, { date: Date; steps: number }[]>();
  for (const se of stepEntries) {
    const key = se.rsvpId ? `r-${se.rsvpId}` : `g-${se.guestRsvpId}`;
    if (!stepsByParticipant.has(key)) stepsByParticipant.set(key, []);
    stepsByParticipant.get(key)!.push({ date: se.date, steps: se.steps });
  }

  // Find goal field (first select-type custom field)
  const goalField = ec.customFields.find((cf) => cf.fieldType === "select");

  // Map resident participants
  const residentParticipants = ec.rsvps.map((rsvp) => {
    const goalResponse = goalField
      ? rsvp.fieldResponses.find((fr) => fr.customFieldId === goalField.id)
      : undefined;
    const dailyGoal = parseInt(goalResponse?.value || "0") || 0;
    const dailySteps = stepsByParticipant.get(`r-${rsvp.id}`) || [];
    const totalSteps = dailySteps.reduce((sum, d) => sum + d.steps, 0);

    return {
      id: rsvp.id,
      name: rsvp.resident.name,
      block: rsvp.resident.block,
      flatNumber: rsvp.resident.flatNumber,
      paid: rsvp.paid,
      fieldResponses: rsvp.fieldResponses.map((fr) => ({
        customFieldId: fr.customFieldId,
        customField: { label: fr.customField.label },
        value: fr.value,
      })),
      createdAt: rsvp.createdAt,
      totalSteps,
      dailyGoal,
      daysTracked: dailySteps.length,
      daysGoalMet: dailyGoal > 0 ? dailySteps.filter((d) => d.steps >= dailyGoal).length : 0,
      averageDailySteps: dailySteps.length > 0 ? Math.round(totalSteps / dailySteps.length) : 0,
      bestDay: dailySteps.length > 0
        ? dailySteps.reduce((best, d) => (d.steps > best.steps ? d : best))
        : null,
      dailySteps: dailySteps.map((d) => ({ date: d.date, steps: d.steps })),
    };
  });

  // Map guest participants
  const guestParticipants = ec.guestRsvps.map((grsvp) => {
    const goalResponse = goalField
      ? grsvp.fieldResponses.find((fr) => fr.customFieldId === goalField.id)
      : undefined;
    const dailyGoal = parseInt(goalResponse?.value || "0") || 0;
    const dailySteps = stepsByParticipant.get(`g-${grsvp.id}`) || [];
    const totalSteps = dailySteps.reduce((sum, d) => sum + d.steps, 0);

    return {
      id: grsvp.id,
      name: grsvp.name,
      block: grsvp.block,
      flatNumber: grsvp.flatNumber,
      paid: grsvp.paid,
      fieldResponses: grsvp.fieldResponses.map((fr) => ({
        customFieldId: fr.customFieldId,
        customField: { label: fr.customField.label },
        value: fr.value,
      })),
      createdAt: grsvp.createdAt,
      totalSteps,
      dailyGoal,
      daysTracked: dailySteps.length,
      daysGoalMet: dailyGoal > 0 ? dailySteps.filter((d) => d.steps >= dailyGoal).length : 0,
      averageDailySteps: dailySteps.length > 0 ? Math.round(totalSteps / dailySteps.length) : 0,
      bestDay: dailySteps.length > 0
        ? dailySteps.reduce((best, d) => (d.steps > best.steps ? d : best))
        : null,
      dailySteps: dailySteps.map((d) => ({ date: d.date, steps: d.steps })),
    };
  });

  // Combine and sort by registration date
  const participants = [...residentParticipants, ...guestParticipants].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const hasStepTracking = stepEntries.length > 0;

  // Build leaderboard sorted by total steps
  const stepLeaderboard = hasStepTracking
    ? [...participants]
        .filter((p) => p.totalSteps > 0)
        .sort((a, b) => b.totalSteps - a.totalSteps)
    : [];

  return NextResponse.json({
    announcement: {
      id: announcement.id,
      title: announcement.title,
      date: announcement.date,
      summary: announcement.summary,
    },
    eventConfig: {
      id: ec.id,
      customFields: ec.customFields,
      entranceFee,
      entranceFeeLabel: ec.entranceFeeLabel,
    },
    participants,
    totalParticipants: participants.length,
    hasStepTracking,
    stepLeaderboard,
  });
}
