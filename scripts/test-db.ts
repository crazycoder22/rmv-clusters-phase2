import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const connStr = (process.env.DATABASE_URL || '').replace('&channel_binding=require', '');
console.log('Connecting to:', connStr.replace(/:[^:@]+@/, ':***@'));

async function main() {
  const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected!');
  const res = await client.query('SELECT count(*) FROM "GuestRsvp"');
  console.log('GuestRsvp count:', res.rows[0].count);
  await client.end();
}
main().catch(console.error);
