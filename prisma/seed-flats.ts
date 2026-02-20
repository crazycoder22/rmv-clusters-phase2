import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import * as fs from "fs";
import * as path from "path";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Read CSV file
  const csvPath = path.join(__dirname, "..", "resident_details.csv");
  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.trim().split("\n");

  // Skip header, parse unique block+flat pairs
  const flatSet = new Set<string>();
  const flats: { block: number; flatNumber: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("BLOCK")) continue;

    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;

    const block = parseInt(parts[0]);
    const flatNumber = parts[1];

    if (isNaN(block) || block < 1 || block > 4 || !flatNumber) continue;

    const key = `${block}-${flatNumber}`;
    if (!flatSet.has(key)) {
      flatSet.add(key);
      flats.push({ block, flatNumber });
    }
  }

  console.log(`Found ${flats.length} unique flats from CSV`);

  // Use createMany with skipDuplicates
  const result = await prisma.flat.createMany({
    data: flats,
    skipDuplicates: true,
  });

  console.log(`Seeded ${result.count} new flats (${flats.length - result.count} already existed)`);

  // Print total
  const total = await prisma.flat.count();
  console.log(`Total flats in database: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    pool.end();
  });
