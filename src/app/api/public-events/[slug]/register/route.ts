import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ── Simple in-memory rate limit ────────────────────────────────────────────
// Not perfect under multi-instance serverless, but catches naive flooding.
// Key = IP. Records up to N timestamps per window and rejects beyond that.
const RATE_LIMIT_MAX = 5;          // max submissions
const RATE_LIMIT_WINDOW_MS = 3600_000; // per hour
const MIN_GAP_MS = 10_000;         // ≥10s between two submissions per IP

const hits = new Map<string, number[]>();

function rateLimit(ip: string): { ok: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const list = (hits.get(ip) ?? []).filter((t) => t > windowStart);

  // Enforce the minimum gap to block rapid-fire double-submits.
  if (list.length > 0 && now - list[list.length - 1] < MIN_GAP_MS) {
    return { ok: false, retryAfterMs: MIN_GAP_MS - (now - list[list.length - 1]) };
  }
  if (list.length >= RATE_LIMIT_MAX) {
    const oldest = list[0];
    return { ok: false, retryAfterMs: RATE_LIMIT_WINDOW_MS - (now - oldest) };
  }

  list.push(now);
  hits.set(ip, list);

  // Opportunistic cleanup to keep the Map bounded.
  if (hits.size > 2000) {
    for (const [k, v] of hits) {
      const pruned = v.filter((t) => t > windowStart);
      if (pruned.length === 0) hits.delete(k);
      else hits.set(k, pruned);
    }
  }

  return { ok: true };
}

// ── Field validation helpers ───────────────────────────────────────────────

/** Normalise an Indian phone to 10 digits (strips +91, 91, spaces, dashes). */
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  if (digits.length === 10) return digits;
  return null;
}

// ── POST /api/public-events/[slug]/register ────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // 1. Honeypot — if the hidden `website` field is non-empty, it's a bot.
  //    (Field is named something bots are likely to auto-fill but real
  //    users never see because it's hidden via CSS.)
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (typeof body.website === "string" && body.website.trim() !== "") {
    // Pretend success so bots don't learn to try harder.
    return NextResponse.json({ ok: true });
  }

  // 2. Rate limit by IP (best-effort — Vercel passes `x-forwarded-for`).
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const rl = rateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts — please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs ?? 0) / 1000)) } }
    );
  }

  // 3. Look up the event.
  const event = await prisma.publicEvent.findUnique({
    where: { slug },
    select: {
      id: true,
      active: true,
      registrationClosesAt: true,
      contributionEnabled: true,
      maxContribution: true,
    },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (!event.active) {
    return NextResponse.json(
      { error: "Registrations for this event are closed." },
      { status: 400 }
    );
  }
  if (event.registrationClosesAt && event.registrationClosesAt < new Date()) {
    return NextResponse.json(
      { error: "Registration window has closed." },
      { status: 400 }
    );
  }

  // 4. Validate fields. Required: name + phone. Optional: block + flat.
  //    Contribution amount is required only for contribution-enabled events.
  const { name, phone, block, flatNumber, contributionAmount } = body as {
    name?: string;
    phone?: string;
    block?: number | string;
    flatNumber?: string;
    contributionAmount?: number | string;
  };

  const cleanName = (name ?? "").trim();
  if (cleanName.length < 2 || cleanName.length > 80) {
    return NextResponse.json({ error: "Please enter a valid name." }, { status: 400 });
  }

  const cleanPhone = normalisePhone(String(phone ?? ""));
  if (!cleanPhone) {
    return NextResponse.json(
      { error: "Please enter a valid 10-digit mobile number." },
      { status: 400 }
    );
  }

  // Block is optional but if present must be 1-4.
  let cleanBlock: number | null = null;
  if (block !== undefined && block !== null && block !== "") {
    const asNum = Number(block);
    if (!Number.isInteger(asNum) || asNum < 1 || asNum > 4) {
      return NextResponse.json(
        { error: "Block must be 1, 2, 3 or 4." },
        { status: 400 }
      );
    }
    cleanBlock = asNum;
  }

  const cleanFlat = (flatNumber ?? "").trim().slice(0, 30) || null;

  // Contribution amount: required when contributionEnabled, else ignored.
  let cleanAmount: number | null = null;
  if (event.contributionEnabled) {
    const asNum =
      typeof contributionAmount === "number"
        ? contributionAmount
        : Number(String(contributionAmount ?? "").trim());
    if (!Number.isFinite(asNum) || !Number.isInteger(asNum) || asNum < 1) {
      return NextResponse.json(
        { error: "Please enter a contribution amount (whole rupees)." },
        { status: 400 }
      );
    }
    if (event.maxContribution && asNum > event.maxContribution) {
      return NextResponse.json(
        {
          error: `Please keep contributions ≤ ₹${event.maxContribution} so we can include everyone.`,
        },
        { status: 400 }
      );
    }
    cleanAmount = asNum;
  }

  // 5. Create the registration.
  const reg = await prisma.publicEventRegistration.create({
    data: {
      eventId: event.id,
      name: cleanName,
      phone: cleanPhone,
      block: cleanBlock,
      flatNumber: cleanFlat,
      contributionAmount: cleanAmount,
    },
    select: { id: true, createdAt: true },
  });

  // Count the total (1-based) for a cute "you're #N" confirmation.
  const position = await prisma.publicEventRegistration.count({
    where: { eventId: event.id, createdAt: { lte: reg.createdAt } },
  });

  return NextResponse.json({
    ok: true,
    registrationId: reg.id,
    position,
  });
}
