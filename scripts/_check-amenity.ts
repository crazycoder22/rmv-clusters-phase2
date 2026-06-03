import "dotenv/config";
import { prisma } from "../src/lib/prisma";
async function main() {
  const a = await prisma.amenity.count();
  const s = await prisma.amenitySlot.count();
  const b = await prisma.amenityBooking.count();
  console.log(`QUERYABLE -> amenities:${a} slots:${s} bookings:${b}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
