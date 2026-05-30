import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { prisma } from "../src/lib/prisma";
async function main() {
  const e = await prisma.publicEvent.findUnique({
    where: { slug: "hearing-checkup-apr-2026" },
    select: { id: true, title: true, active: true, startAt: true, _count: { select: { registrations: true } } },
  });
  console.log(e);
  await prisma.$disconnect();
}
main();
