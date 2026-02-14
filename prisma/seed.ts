import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.SUPERADMIN_EMAIL;

  if (!email) {
    console.log("Usage: SUPERADMIN_EMAIL=user@example.com npm run db:seed");
    process.exit(1);
  }

  // Find the SUPERADMIN role
  const superAdminRole = await prisma.role.findUnique({
    where: { name: "SUPERADMIN" },
  });

  if (!superAdminRole) {
    console.error("SUPERADMIN role not found. Run migrations first.");
    process.exit(1);
  }

  // Find the resident
  const resident = await prisma.resident.findUnique({
    where: { email },
    include: { role: true },
  });

  if (!resident) {
    console.log(`No resident found with email ${email}. They must register first.`);
    process.exit(1);
  }

  if (resident.role.name === "SUPERADMIN") {
    console.log(`${email} is already a SuperAdmin.`);
    return;
  }

  // Update to SuperAdmin
  await prisma.resident.update({
    where: { email },
    data: { roleId: superAdminRole.id },
  });

  console.log(`Successfully assigned SUPERADMIN role to ${email}`);
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
