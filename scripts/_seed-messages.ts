import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { orderPair } from "../src/lib/messages";

// Demo seed for direct messaging. Creates 2 conversations between YOU and two
// other residents. Only the OLDEST message of each thread carries the hidden
// "[demo]" marker (scrolled up, least visible) so the visible recent bubbles
// stay clean while _clear-messages-seed.ts can still find + remove these.
const MARK = " [demo]";

async function main() {
  const me = await prisma.resident.findFirst({
    where: { email: "lakshmankamathk@gmail.com" },
  });
  if (!me) throw new Error("your resident record not found");

  const others = await prisma.resident.findMany({
    where: { isApproved: true, id: { not: me.id } },
    take: 2,
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (others.length < 1) throw new Error("need at least one other approved resident");

  // Idempotent: clear prior demo conversations (any conv with a [demo] message).
  const tagged = await prisma.directMessage.findMany({
    where: { body: { contains: "[demo]" } },
    select: { conversationId: true },
    distinct: ["conversationId"],
  });
  if (tagged.length) {
    await prisma.conversation.deleteMany({ where: { id: { in: tagged.map((t) => t.conversationId) } } });
    console.log(`cleared ${tagged.length} previous demo conversations`);
  }

  const now = Date.now();
  const ago = (mins: number) => new Date(now - mins * 60_000);

  // Insert a thread; only the FIRST message gets the marker.
  async function seedThread(convId: string, msgs: { from: string; body: string; at: Date }[]) {
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      await prisma.directMessage.create({
        data: { conversationId: convId, senderId: m.from, body: i === 0 ? m.body + MARK : m.body, createdAt: m.at },
      });
    }
  }

  // ── Conversation 1: with others[0] — they sent the last message (1 unread for you)
  const o1 = others[0];
  {
    const [aId, bId] = orderPair(me.id, o1.id);
    const conv = await prisma.conversation.create({ data: { aId, bId, lastMessageAt: ago(3) } });
    await seedThread(conv.id, [
      { from: me.id, body: `Hi ${o1.name.split(" ")[0]}, is your parking slot free this evening?`, at: ago(30) },
      { from: o1.id, body: `Hey! Yes it's free after 6pm.`, at: ago(25) },
      { from: me.id, body: `Perfect, I'll book it. Thanks!`, at: ago(20) },
      { from: o1.id, body: `Great 👍 Just scan the QR near B2.`, at: ago(3) },
    ]);
    await prisma.conversation.update({
      where: { id: conv.id },
      data: conv.aId === me.id ? { aLastReadAt: ago(20) } : { bLastReadAt: ago(20) }, // last msg unread
    });
  }

  // ── Conversation 2: with others[1] — you sent last, they've read it (shows "Seen")
  if (others[1]) {
    const o2 = others[1];
    const [aId, bId] = orderPair(me.id, o2.id);
    const conv = await prisma.conversation.create({ data: { aId, bId, lastMessageAt: ago(120) } });
    await seedThread(conv.id, [
      { from: o2.id, body: `Did you try the biryani from the home kitchen upstairs?`, at: ago(180) },
      { from: me.id, body: `Not yet! Is it good?`, at: ago(150) },
      { from: o2.id, body: `Amazing. Order before noon though, sells out fast.`, at: ago(140) },
      { from: me.id, body: `Will do, thanks for the tip 🙏`, at: ago(120) },
    ]);
    await prisma.conversation.update({
      where: { id: conv.id },
      data: conv.aId === me.id
        ? { aLastReadAt: ago(110), bLastReadAt: ago(115) }
        : { bLastReadAt: ago(110), aLastReadAt: ago(115) },
    });
  }

  console.log("\n✅ Created demo conversations:");
  console.log(`   • with ${o1.name} — they replied 3 min ago (1 unread for you)`);
  if (others[1]) console.log(`   • with ${others[1].name} — you sent last, marked "Seen"`);
  console.log(`\n   Open the app / website → Messages to see them.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FAIL", e.message);
    await prisma.$disconnect();
    process.exit(1);
  });
