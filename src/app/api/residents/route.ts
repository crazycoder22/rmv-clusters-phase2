import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isValidResidentType } from "@/lib/resident-types";
import { sendPushToResidents } from "@/lib/push";
import { AUTO_APPROVE_REGISTRATIONS, getBoolSetting } from "@/lib/settings";

// Roles that can approve a new registration (mirrors canManageResidents /
// isAdmin in @/lib/roles — ADMIN-level and above).
const RESIDENT_MANAGER_ROLES = ["ADMIN", "COMMUNITY_ADMIN", "SUPERADMIN"];

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Prevent duplicate registration
  const existing = await prisma.resident.findUnique({
    where: { email: session.user.email },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Already registered" },
      { status: 409 }
    );
  }

  const body = await request.json();
  const { phone, block, flatNumber, residentType } = body;

  // Server-side validation
  if (!phone || !block || !flatNumber || !residentType) {
    return NextResponse.json(
      { error: "All fields are required" },
      { status: 400 }
    );
  }

  if (![1, 2, 3, 4].includes(Number(block))) {
    return NextResponse.json(
      { error: "Block must be 1, 2, 3, or 4" },
      { status: 400 }
    );
  }

  // Validate flat exists in the Flat table
  const flatExists = await prisma.flat.findUnique({
    where: { block_flatNumber: { block: Number(block), flatNumber } },
  });
  if (!flatExists) {
    return NextResponse.json(
      { error: "Invalid flat number for the selected block" },
      { status: 400 }
    );
  }

  if (!isValidResidentType(residentType)) {
    return NextResponse.json(
      { error: "Invalid resident type" },
      { status: 400 }
    );
  }

  // Open-registration window: when the admin flag is on, new signups are
  // approved automatically (no manual review).
  const autoApprove = await getBoolSetting(AUTO_APPROVE_REGISTRATIONS);

  // RESIDENT role is implicit — no roles connection needed
  const resident = await prisma.resident.create({
    data: {
      email: session.user.email,
      name: session.user.name ?? "",
      phone,
      block: Number(block),
      flatNumber,
      residentType,
      googleImage: session.user.image ?? null,
      isApproved: autoApprove,
    },
  });

  // Notify residents who can approve (admins/committee): in-app bell (web) +
  // push (mobile). Copy differs for auto-approved vs awaiting-review. Both
  // deep-link to admin Residents on tap. Best-effort — never block signup.
  try {
    const managers = await prisma.resident.findMany({
      where: { isApproved: true, roles: { some: { name: { in: RESIDENT_MANAGER_ROLES } } } },
      select: { id: true },
    });
    const managerIds = managers.map((m) => m.id);
    if (managerIds.length > 0) {
      const who = `${resident.name || "A resident"} (Block ${resident.block}, ${resident.flatNumber})`;
      const msg = autoApprove
        ? `Auto-approved: ${who} has joined the community.`
        : `New registration: ${who} — review in Residents.`;
      await prisma.notification.createMany({
        data: managerIds.map((residentId) => ({ residentId, message: msg })),
      });
      await sendPushToResidents(managerIds, {
        title: autoApprove ? "✅ New resident auto-approved" : "🆕 New registration",
        body: autoApprove
          ? `${resident.name || "A new resident"} · Block ${resident.block}, ${resident.flatNumber} joined automatically`
          : `${resident.name || "A new resident"} · Block ${resident.block}, ${resident.flatNumber} — tap to review`,
        data: { type: "new_resident" },
      });
    }
  } catch (err) {
    console.error("[new-registration notify] failed:", err);
  }

  return NextResponse.json(
    { success: true, id: resident.id },
    { status: 201 }
  );
}
