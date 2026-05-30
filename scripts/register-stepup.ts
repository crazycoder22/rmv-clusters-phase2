import { PrismaClient } from '../src/generated/prisma/client';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const connStr = (process.env.DATABASE_URL || '').replace('&channel_binding=require', '');
const pool = new pg.Pool({ connectionString: connStr, ssl: true });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const guestRsvps = await prisma.guestRsvp.findMany({
    where: { eventConfig: { announcement: { id: 'cmml05a7x000004kz5qxwonk3' } } },
    select: { id: true, name: true, email: true, phone: true, block: true, flatNumber: true },
  });

  console.log(`Found ${guestRsvps.length} guest RSVPs to process\n`);

  let created = 0;
  let skipped = 0;

  for (const g of guestRsvps) {
    const existing = await prisma.resident.findUnique({ where: { email: g.email } });
    if (existing) {
      console.log(`SKIP: ${g.name} (${g.email}) - already registered`);
      skipped++;
      continue;
    }

    await prisma.resident.create({
      data: {
        email: g.email,
        name: g.name,
        phone: g.phone || '',
        block: g.block,
        flatNumber: g.flatNumber,
        residentType: 'TENANT',
        isApproved: true,
      },
    });
    console.log(`CREATED: ${g.name} (${g.email}) - B${g.block}-${g.flatNumber}`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
  await pool.end();
}

main().catch(console.error);
