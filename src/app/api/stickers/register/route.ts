import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ── Rate limiting (same shape as public-events) ────────────────────────────
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 3600_000;
const MIN_GAP_MS = 10_000;

const hits = new Map<string, number[]>();

function rateLimit(ip: string): { ok: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const list = (hits.get(ip) ?? []).filter((t) => t > windowStart);

  if (list.length > 0 && now - list[list.length - 1] < MIN_GAP_MS) {
    return { ok: false, retryAfterMs: MIN_GAP_MS - (now - list[list.length - 1]) };
  }
  if (list.length >= RATE_LIMIT_MAX) {
    const oldest = list[0];
    return { ok: false, retryAfterMs: RATE_LIMIT_WINDOW_MS - (now - oldest) };
  }

  list.push(now);
  hits.set(ip, list);

  if (hits.size > 2000) {
    for (const [k, v] of hits) {
      const pruned = v.filter((t) => t > windowStart);
      if (pruned.length === 0) hits.delete(k);
      else hits.set(k, pruned);
    }
  }

  return { ok: true };
}

/** Normalise an Indian phone to 10 digits (strips +91, 91, spaces, dashes). */
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  if (digits.length === 10) return digits;
  return null;
}

// ── POST /api/stickers/register ────────────────────────────────────────────
// Public endpoint. Upserts on (block, flatNumber) — latest submission wins,
// so a flat can correct their entry by submitting again.

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // Honeypot.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  // Rate limit.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const rl = rateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts — please wait a moment and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs ?? 0) / 1000)) },
      }
    );
  }

  const {
    block,
    flatNumber,
    residentName,
    phone,
    email,
    residentType,
    fourWheelers,
    twoWheelers,
    notes,
  } = body as {
    block?: number | string;
    flatNumber?: string;
    residentName?: string;
    phone?: string;
    email?: string;
    residentType?: string;
    fourWheelers?: number | string;
    twoWheelers?: number | string;
    notes?: string;
  };

  // Block: required, 1-4.
  const blockNum = Number(block);
  if (!Number.isInteger(blockNum) || blockNum < 1 || blockNum > 4) {
    return NextResponse.json(
      { error: "Please select your block (1, 2, 3 or 4)." },
      { status: 400 }
    );
  }

  // Flat: required.
  const cleanFlat = (flatNumber ?? "").trim().slice(0, 30);
  if (!cleanFlat) {
    return NextResponse.json(
      { error: "Please enter your flat number." },
      { status: 400 }
    );
  }

  // Name: required, 2-80.
  const cleanName = (residentName ?? "").trim();
  if (cleanName.length < 2 || cleanName.length > 80) {
    return NextResponse.json(
      { error: "Please enter your full name." },
      { status: 400 }
    );
  }

  // Phone: required, 10 digits.
  const cleanPhone = normalisePhone(String(phone ?? ""));
  if (!cleanPhone) {
    return NextResponse.json(
      { error: "Please enter a valid 10-digit mobile number." },
      { status: 400 }
    );
  }

  // Email: optional. If present, basic format check.
  const rawEmail = (email ?? "").trim().toLowerCase();
  let cleanEmail: string | null = null;
  if (rawEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) || rawEmail.length > 200) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }
    cleanEmail = rawEmail;
  }

  // Resident type: required, must be OWNER or TENANT.
  const cleanType = (residentType ?? "").trim().toUpperCase();
  if (cleanType !== "OWNER" && cleanType !== "TENANT") {
    return NextResponse.json(
      { error: "Please pick Owner or Tenant." },
      { status: 400 }
    );
  }

  // 4W and 2W counts: integer 0-10. At least one must be > 0.
  const fourW = Number(fourWheelers ?? 0);
  const twoW = Number(twoWheelers ?? 0);
  if (!Number.isInteger(fourW) || fourW < 0 || fourW > 10) {
    return NextResponse.json(
      { error: "4-wheeler count must be between 0 and 10." },
      { status: 400 }
    );
  }
  if (!Number.isInteger(twoW) || twoW < 0 || twoW > 10) {
    return NextResponse.json(
      { error: "2-wheeler count must be between 0 and 10." },
      { status: 400 }
    );
  }
  if (fourW + twoW === 0) {
    return NextResponse.json(
      { error: "Please enter at least one 4-wheeler or 2-wheeler sticker." },
      { status: 400 }
    );
  }

  const cleanNotes = (notes ?? "").trim().slice(0, 500) || null;

  // Upsert — one record per flat. Latest submission wins.
  const row = await prisma.vehicleStickerRequest.upsert({
    where: { block_flat: { block: blockNum, flatNumber: cleanFlat } },
    create: {
      block: blockNum,
      flatNumber: cleanFlat,
      residentName: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      residentType: cleanType,
      fourWheelers: fourW,
      twoWheelers: twoW,
      notes: cleanNotes,
    },
    update: {
      // Don't touch `stickersIssued` / `issuedAt` / `issuedBy` / `adminNote`
      // — those are admin-managed. A resident re-submitting just refreshes
      // their request fields.
      residentName: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      residentType: cleanType,
      fourWheelers: fourW,
      twoWheelers: twoW,
      notes: cleanNotes,
    },
    select: { id: true, createdAt: true, updatedAt: true },
  });

  const wasUpdate = row.createdAt.getTime() !== row.updatedAt.getTime();

  return NextResponse.json({
    ok: true,
    id: row.id,
    updated: wasUpdate,
    totals: { fourWheelers: fourW, twoWheelers: twoW },
  });
}
