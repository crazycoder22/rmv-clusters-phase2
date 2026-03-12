import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";
import { getResend, EMAIL_FROM, renderStepStatsEmailHtml } from "@/lib/email";
import { generateStepChartPng } from "@/lib/step-chart";

function parseGoal(value: string): number {
  if (!value) return 0;
  const cleaned = value.trim().toUpperCase();
  const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*K$/);
  if (match) return Math.round(parseFloat(match[1]) * 1000);
  return parseInt(cleaned) || 0;
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canManageAnnouncements(session.user.roles)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  // Check email service
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "Email service not configured" },
      { status: 500 }
    );
  }

  // Parse request body
  let participantIds: string[] | undefined;
  try {
    const body = await request.json();
    participantIds = body.participantIds;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  // Fetch event data (same pattern as dashboard API)
  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: {
      eventConfig: {
        include: {
          customFields: { orderBy: { sortOrder: "asc" } },
          rsvps: {
            include: {
              resident: {
                select: { name: true, block: true, flatNumber: true, email: true },
              },
              fieldResponses: {
                include: {
                  customField: { select: { id: true, label: true, fieldType: true } },
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
          guestRsvps: {
            include: {
              fieldResponses: {
                include: {
                  customField: { select: { id: true, label: true, fieldType: true } },
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
      { error: "Event not found" },
      { status: 404 }
    );
  }

  const ec = announcement.eventConfig;

  // Fetch all step entries
  const stepEntries = await prisma.stepEntry.findMany({
    where: { eventConfigId: ec.id },
    orderBy: { date: "asc" },
  });

  if (stepEntries.length === 0) {
    return NextResponse.json(
      { error: "No step data recorded yet" },
      { status: 400 }
    );
  }

  // Group step entries by participant
  const stepsByParticipant = new Map<string, { date: Date; steps: number }[]>();
  for (const se of stepEntries) {
    const key = se.rsvpId ? `r-${se.rsvpId}` : `g-${se.guestRsvpId}`;
    if (!stepsByParticipant.has(key)) stepsByParticipant.set(key, []);
    stepsByParticipant.get(key)!.push({ date: se.date, steps: se.steps });
  }

  // Find goal field
  const goalField = ec.customFields.find((cf) => cf.fieldType === "select");

  // Build participant stats
  interface ParticipantStats {
    key: string;
    email: string;
    name: string;
    block: number;
    flatNumber: string;
    totalSteps: number;
    dailyGoal: number;
    daysTracked: number;
    daysGoalMet: number;
    averageDailySteps: number;
    bestDay: { date: string; steps: number } | null;
    dailySteps: { date: string; steps: number }[];
  }

  const allParticipants: ParticipantStats[] = [];

  // Resident participants
  for (const rsvp of ec.rsvps) {
    const goalResponse = goalField
      ? rsvp.fieldResponses.find((fr) => fr.customFieldId === goalField.id)
      : undefined;
    const dailyGoal = parseGoal(goalResponse?.value || "0");
    const dailySteps = stepsByParticipant.get(`r-${rsvp.id}`) || [];
    const totalSteps = dailySteps.reduce((sum, d) => sum + d.steps, 0);

    if (totalSteps === 0) continue;

    allParticipants.push({
      key: `r-${rsvp.id}`,
      email: rsvp.resident.email,
      name: rsvp.resident.name,
      block: rsvp.resident.block,
      flatNumber: rsvp.resident.flatNumber,
      totalSteps,
      dailyGoal,
      daysTracked: dailySteps.length,
      daysGoalMet: dailyGoal > 0 ? dailySteps.filter((d) => d.steps >= dailyGoal).length : 0,
      averageDailySteps: dailySteps.length > 0 ? Math.round(totalSteps / dailySteps.length) : 0,
      bestDay: dailySteps.length > 0
        ? (() => {
            const best = dailySteps.reduce((b, d) => (d.steps > b.steps ? d : b));
            return { date: best.date.toISOString(), steps: best.steps };
          })()
        : null,
      dailySteps: dailySteps.map((d) => ({ date: d.date.toISOString(), steps: d.steps })),
    });
  }

  // Guest participants
  for (const grsvp of ec.guestRsvps) {
    const goalResponse = goalField
      ? grsvp.fieldResponses.find((fr) => fr.customFieldId === goalField.id)
      : undefined;
    const dailyGoal = parseGoal(goalResponse?.value || "0");
    const dailySteps = stepsByParticipant.get(`g-${grsvp.id}`) || [];
    const totalSteps = dailySteps.reduce((sum, d) => sum + d.steps, 0);

    if (totalSteps === 0) continue;

    allParticipants.push({
      key: `g-${grsvp.id}`,
      email: grsvp.email,
      name: grsvp.name,
      block: grsvp.block,
      flatNumber: grsvp.flatNumber,
      totalSteps,
      dailyGoal,
      daysTracked: dailySteps.length,
      daysGoalMet: dailyGoal > 0 ? dailySteps.filter((d) => d.steps >= dailyGoal).length : 0,
      averageDailySteps: dailySteps.length > 0 ? Math.round(totalSteps / dailySteps.length) : 0,
      bestDay: dailySteps.length > 0
        ? (() => {
            const best = dailySteps.reduce((b, d) => (d.steps > b.steps ? d : b));
            return { date: best.date.toISOString(), steps: best.steps };
          })()
        : null,
      dailySteps: dailySteps.map((d) => ({ date: d.date.toISOString(), steps: d.steps })),
    });
  }

  // Sort by total steps for leaderboard ranking
  allParticipants.sort((a, b) => b.totalSteps - a.totalSteps);
  const totalLeaderboard = allParticipants.length;

  // Build rank map
  const rankMap = new Map<string, number>();
  allParticipants.forEach((p, i) => rankMap.set(p.key, i + 1));

  // Filter to target participants
  let targets = allParticipants;
  if (participantIds && participantIds.length > 0) {
    const idSet = new Set(participantIds);
    targets = allParticipants.filter((p) => idSet.has(p.key));
  }

  if (targets.length === 0) {
    return NextResponse.json(
      { error: "No participants with step data found" },
      { status: 400 }
    );
  }

  // Send emails
  const resend = getResend();
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const participant of targets) {
    if (!participant.email) {
      skipped++;
      continue;
    }

    try {
      // Generate bar chart
      const chartBuffer = await generateStepChartPng(
        participant.dailySteps,
        participant.dailyGoal
      );

      // Render email HTML
      const html = renderStepStatsEmailHtml({
        eventTitle: announcement.title,
        name: participant.name,
        block: participant.block,
        flatNumber: participant.flatNumber,
        rank: rankMap.get(participant.key) || 0,
        totalParticipants: totalLeaderboard,
        totalSteps: participant.totalSteps,
        averageDailySteps: participant.averageDailySteps,
        dailyGoal: participant.dailyGoal,
        daysTracked: participant.daysTracked,
        daysGoalMet: participant.daysGoalMet,
        bestDay: participant.bestDay,
      });

      const { error: sendError } = await resend.emails.send({
        from: EMAIL_FROM,
        to: participant.email,
        subject: `Your Step Challenge Stats: ${announcement.title}`,
        html,
        attachments: [
          {
            filename: "stepchart.png",
            content: chartBuffer,
          },
        ],
      });

      if (sendError) {
        console.error(`Email send error for ${participant.email}:`, sendError);
        failed++;
      } else {
        sent++;
      }

      // Small delay to avoid rate limits
      if (targets.length > 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    } catch (err) {
      console.error(`Email error for ${participant.email}:`, err);
      failed++;
    }
  }

  return NextResponse.json({
    sent,
    failed,
    skipped,
    total: targets.length,
  });
}
