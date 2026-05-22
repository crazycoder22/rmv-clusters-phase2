import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canIssueStickers, canManageAnnouncements } from "@/lib/roles";

export const dynamic = "force-dynamic";

// View + issue: admins and facility managers
async function requireStickerStaff() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canIssueStickers(session.user.roles)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

// Destructive actions (delete a row) stay admin-only — facility manager
// can issue but shouldn't be able to remove residents' submissions.
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canManageAnnouncements(session.user.roles)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

// GET /api/admin/stickers
//   ?format=csv   — returns CSV file (text/csv)
//   default       — returns JSON with rows + totals
export async function GET(request: NextRequest) {
  const check = await requireStickerStaff();
  if ("error" in check && check.error) return check.error;

  const rows = await prisma.vehicleStickerRequest.findMany({
    orderBy: [{ block: "asc" }, { flatNumber: "asc" }],
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.fourWheelers += r.fourWheelers;
      acc.twoWheelers += r.twoWheelers;
      acc.flats += 1;
      if (r.stickersIssued) acc.issued += 1;
      if (r.mygateRegistered) acc.mygateConfirmed += 1;
      if (r.alreadyHasSticker) acc.selfCollected += 1;
      return acc;
    },
    {
      fourWheelers: 0,
      twoWheelers: 0,
      flats: 0,
      issued: 0,
      mygateConfirmed: 0,
      selfCollected: 0,
    }
  );

  const url = new URL(request.url);
  if (url.searchParams.get("format") === "csv") {
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      // Quote everything to be safe; double up internal quotes.
      return `"${s.replace(/"/g, '""')}"`;
    };
    const header = [
      "Block",
      "Flat",
      "Name",
      "Phone",
      "Email",
      "Type",
      "4-wheelers",
      "2-wheelers",
      "MyGate Registered",
      "Already Has Sticker",
      "Notes",
      "Submitted",
      "Stickers Issued",
      "Issued At",
      "Issued By",
      "Admin Note",
    ].join(",");
    const csvRows = rows.map((r) =>
      [
        r.block,
        r.flatNumber,
        r.residentName,
        r.phone,
        r.email ?? "",
        r.residentType,
        r.fourWheelers,
        r.twoWheelers,
        r.mygateRegistered ? "YES" : "NO",
        r.alreadyHasSticker ? "YES" : "NO",
        r.notes ?? "",
        new Date(r.createdAt).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        }),
        r.stickersIssued ? "YES" : "NO",
        r.issuedAt
          ? new Date(r.issuedAt).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
            })
          : "",
        r.issuedBy ?? "",
        r.adminNote ?? "",
      ]
        .map(escape)
        .join(",")
    );
    const csv = [header, ...csvRows].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="vehicle-stickers-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ rows, totals });
}

// PATCH /api/admin/stickers
//   { id, stickersIssued, adminNote }
// Toggles the issued flag for one row. When flipping to issued, stamps
// issuedAt + issuedBy from the current session — usable by both admins
// and facility managers.
export async function PATCH(request: NextRequest) {
  const check = await requireStickerStaff();
  if ("error" in check && check.error) return check.error;
  const { session } = check;

  const body = await request.json().catch(() => null);
  if (!body?.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const adminName = session?.user?.name ?? session?.user?.email ?? "admin";

  const data: Record<string, unknown> = {};
  if (typeof body.stickersIssued === "boolean") {
    data.stickersIssued = body.stickersIssued;
    if (body.stickersIssued) {
      data.issuedAt = new Date();
      data.issuedBy = adminName;
    } else {
      data.issuedAt = null;
      data.issuedBy = null;
    }
  }
  if (typeof body.adminNote === "string") {
    data.adminNote = body.adminNote.trim().slice(0, 500) || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const row = await prisma.vehicleStickerRequest.update({
    where: { id: body.id },
    data,
  });

  return NextResponse.json({ row });
}

// DELETE /api/admin/stickers?id=...
// Admin can remove a duplicate / mistaken entry.
export async function DELETE(request: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.vehicleStickerRequest.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
