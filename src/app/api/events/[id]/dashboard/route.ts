import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseGoal(value: string): number {
  if (!value) return 0;
  const cleaned = value.trim().toUpperCase();
  const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*K$/);
  if (match) return Math.round(parseFloat(match[1]) * 1000);
  return parseInt(cleaned) || 0;
}

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
    const dailyGoal = parseGoal(goalResponse?.value || "0");
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
    const dailyGoal = parseGoal(goalResponse?.value || "0");
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

  // Compute aggregate totals
  const totalStepTarget = participants.reduce((sum, p) => sum + p.dailyGoal, 0) * 12;
  const totalActualSteps = stepEntries.reduce((sum, se) => sum + se.steps, 0);

  // Compute "on track" count
  // Challenge: 14 days starting from event date, must meet goal on at least 12 days
  const CHALLENGE_DAYS = 14;
  const REQUIRED_DAYS = 12;
  const MAX_MISSES = CHALLENGE_DAYS - REQUIRED_DAYS; // 2

  const eventStartDate = announcement.date
    ? new Date(announcement.date)
    : null;

  let onTrackCount = 0;
  let totalWithGoal = 0;

  if (eventStartDate && hasStepTracking) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const startUTC = new Date(eventStartDate);
    startUTC.setUTCHours(0, 0, 0, 0);

    // Days elapsed so far (capped at 14)
    const daysElapsed = Math.min(
      CHALLENGE_DAYS,
      Math.max(0, Math.floor((today.getTime() - startUTC.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    );

    // Build list of elapsed dates as ISO strings for lookup
    const elapsedDates: string[] = [];
    for (let d = 0; d < daysElapsed; d++) {
      const dt = new Date(startUTC);
      dt.setUTCDate(dt.getUTCDate() + d);
      elapsedDates.push(dt.toISOString().slice(0, 10));
    }

    for (const p of participants) {
      if (p.dailyGoal <= 0) continue;
      totalWithGoal++;

      // Build a set of dates where goal was met
      const metDates = new Set<string>();
      for (const ds of p.dailySteps) {
        const dateStr = new Date(ds.date).toISOString().slice(0, 10);
        if (ds.steps >= p.dailyGoal) metDates.add(dateStr);
      }

      // Count misses across elapsed days
      let misses = 0;
      for (const dateStr of elapsedDates) {
        if (!metDates.has(dateStr)) misses++;
      }

      if (misses <= MAX_MISSES) onTrackCount++;
    }
  }

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
    totalStepTarget,
    totalActualSteps,
    onTrackCount,
    totalWithGoal,
  });
}
