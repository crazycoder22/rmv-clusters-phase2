import { PrismaClient } from '../src/generated/prisma/client';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function parseGoal(value: string): number {
  if (!value) return 0;
  const cleaned = value.trim().toUpperCase();
  const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*K$/);
  if (match) return Math.round(parseFloat(match[1]) * 1000);
  return parseInt(cleaned) || 0;
}

async function main() {
  const ann = await prisma.announcement.findUnique({
    where: { id: 'cmml05a7x000004kz5qxwonk3' },
    select: { date: true, title: true, eventConfig: { select: { id: true } } },
  });
  console.log('Event:', ann?.title);
  console.log('Event date:', ann?.date);

  const ecId = ann?.eventConfig?.id;

  const entries = await prisma.stepEntry.findMany({
    where: { eventConfigId: ecId },
    select: { date: true },
    distinct: ['date'],
    orderBy: { date: 'asc' },
  });
  console.log('Distinct dates with step data:', entries.map(e => e.date.toISOString().slice(0, 10)));

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(ann?.date as Date);
  start.setUTCHours(0, 0, 0, 0);
  const daysElapsed = Math.min(14, Math.max(0, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1));
  console.log('Start UTC:', start.toISOString());
  console.log('Today UTC:', today.toISOString());
  console.log('Days elapsed:', daysElapsed);

  // Build elapsed dates
  const elapsedDates: string[] = [];
  for (let d = 0; d < daysElapsed; d++) {
    const dt = new Date(start);
    dt.setUTCDate(dt.getUTCDate() + d);
    elapsedDates.push(dt.toISOString().slice(0, 10));
  }
  console.log('Elapsed dates:', elapsedDates);

  // Check a few participants
  const ec = await prisma.eventConfig.findUnique({
    where: { id: ecId },
    include: {
      customFields: { orderBy: { sortOrder: 'asc' } },
      rsvps: {
        include: {
          resident: { select: { name: true } },
          fieldResponses: { include: { customField: { select: { id: true, fieldType: true } } } },
        },
      },
    },
  });

  const goalField = ec?.customFields.find(cf => cf.fieldType === 'select');
  const allSteps = await prisma.stepEntry.findMany({ where: { eventConfigId: ecId }, orderBy: { date: 'asc' } });

  const stepsByParticipant = new Map<string, { date: Date; steps: number }[]>();
  for (const se of allSteps) {
    const key = se.rsvpId ? `r-${se.rsvpId}` : `g-${se.guestRsvpId}`;
    if (!stepsByParticipant.has(key)) stepsByParticipant.set(key, []);
    stepsByParticipant.get(key)!.push({ date: se.date, steps: se.steps });
  }

  let onTrack = 0;
  let total = 0;
  for (const rsvp of ec?.rsvps || []) {
    const goalResp = goalField ? rsvp.fieldResponses.find(fr => fr.customFieldId === goalField.id) : undefined;
    const dailyGoal = parseGoal(goalResp?.value || '0');
    if (dailyGoal <= 0) continue;
    total++;

    const dailySteps = stepsByParticipant.get(`r-${rsvp.id}`) || [];
    const metDates = new Set<string>();
    for (const ds of dailySteps) {
      if (ds.steps >= dailyGoal) metDates.add(new Date(ds.date).toISOString().slice(0, 10));
    }

    let misses = 0;
    for (const dateStr of elapsedDates) {
      if (!metDates.has(dateStr)) misses++;
    }

    const status = misses <= 2 ? 'ON TRACK' : 'OFF TRACK';
    if (misses <= 2) onTrack++;
    console.log(`${rsvp.resident.name}: goal=${dailyGoal}, metDays=${metDates.size}, misses=${misses}, ${status}`);
  }
  console.log(`\nResult: ${onTrack} / ${total} on track`);

  await pool.end();
}

main();
