import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  isVotingOpen,
  isEligible,
  type ReferendumEligibilityValue,
  type ReferendumStatusValue,
} from "@/lib/referendums";

// POST /api/referendums/[id]/vote  { optionId }
//
// The integrity core. Secret ballot + one-flat-one-vote:
//   - A ReferendumBallot row records that THIS FLAT voted (and who pressed
//     submit) — but NOT the choice. The @@unique([referendumId, block,
//     flatNumber]) makes a second vote from the same flat impossible.
//   - The chosen option's voteCount is incremented in the SAME transaction.
//   - No row anywhere links the flat/resident to the option → true secrecy.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const optionId = typeof body?.optionId === "string" ? body.optionId : "";
  if (!optionId) return NextResponse.json({ error: "Choose an option" }, { status: 400 });

  const referendum = await prisma.referendum.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      closesAt: true,
      eligibility: true,
      options: { select: { id: true } },
    },
  });
  if (!referendum) return NextResponse.json({ error: "Referendum not found" }, { status: 404 });

  if (!isVotingOpen(referendum.status as ReferendumStatusValue, referendum.closesAt)) {
    return NextResponse.json({ error: "Voting is closed" }, { status: 400 });
  }
  if (!isEligible(me.residentType, referendum.eligibility as ReferendumEligibilityValue)) {
    return NextResponse.json(
      { error: "This referendum is for owners only" },
      { status: 403 }
    );
  }
  if (!referendum.options.some((o) => o.id === optionId)) {
    return NextResponse.json({ error: "Invalid option" }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Insert the flat's ballot first — the unique constraint is the gate.
      // If the flat already voted this throws P2002 and we abort before any
      // counter changes.
      await tx.referendumBallot.create({
        data: {
          referendumId: id,
          residentId: me.id,
          block: me.block,
          flatNumber: me.flatNumber,
        },
      });
      await tx.referendumOption.update({
        where: { id: optionId },
        data: { voteCount: { increment: 1 } },
      });
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      return NextResponse.json({ error: "Your flat has already voted" }, { status: 409 });
    }
    console.error("referendum vote error", err);
    return NextResponse.json({ error: "Could not record your vote" }, { status: 500 });
  }

  // Never return the running tally.
  return NextResponse.json({ ok: true }, { status: 201 });
}
