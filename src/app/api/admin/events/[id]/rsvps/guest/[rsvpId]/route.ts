import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; rsvpId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { rsvpId } = await params;
  const body = await request.json();

  try {
    // Check if this is a full edit or just a paid toggle
    const hasEditFields =
      body.name !== undefined ||
      body.email !== undefined ||
      body.phone !== undefined ||
      body.block !== undefined ||
      body.flatNumber !== undefined ||
      body.items !== undefined ||
      body.fieldResponses !== undefined ||
      body.notes !== undefined;

    if (!hasEditFields) {
      // Simple paid toggle (existing behavior)
      const guestRsvp = await prisma.guestRsvp.update({
        where: { id: rsvpId },
        data: { paid: body.paid },
        include: {
          items: { include: { menuItem: true } },
          fieldResponses: { include: { customField: true } },
        },
      });
      return NextResponse.json({ success: true, guestRsvp });
    }

    // Full edit with transaction
    const result = await prisma.$transaction(async (tx) => {
      // Build update data for basic fields
      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name.trim();
      if (body.email !== undefined) updateData.email = body.email.trim().toLowerCase();
      if (body.phone !== undefined) updateData.phone = body.phone.trim();
      if (body.block !== undefined) updateData.block = body.block;
      if (body.flatNumber !== undefined) updateData.flatNumber = body.flatNumber.trim();
      if (body.notes !== undefined) updateData.notes = body.notes || null;
      if (body.paid !== undefined) updateData.paid = body.paid;

      // Update basic fields
      await tx.guestRsvp.update({
        where: { id: rsvpId },
        data: updateData,
      });

      // Update items if provided
      if (body.items !== undefined) {
        await tx.guestRsvpItem.deleteMany({ where: { guestRsvpId: rsvpId } });
        if (body.items.length > 0) {
          await tx.guestRsvpItem.createMany({
            data: body.items
              .filter((item: { menuItemId: string; plates: number }) => item.plates > 0)
              .map((item: { menuItemId: string; plates: number }) => ({
                guestRsvpId: rsvpId,
                menuItemId: item.menuItemId,
                plates: item.plates,
              })),
          });
        }
      }

      // Update field responses if provided
      if (body.fieldResponses !== undefined) {
        await tx.guestRsvpFieldResponse.deleteMany({ where: { guestRsvpId: rsvpId } });
        if (body.fieldResponses.length > 0) {
          await tx.guestRsvpFieldResponse.createMany({
            data: body.fieldResponses
              .filter((fr: { customFieldId: string; value: string }) => fr.value)
              .map((fr: { customFieldId: string; value: string }) => ({
                guestRsvpId: rsvpId,
                customFieldId: fr.customFieldId,
                value: fr.value,
              })),
          });
        }
      }

      // Return the updated RSVP with all relations
      return tx.guestRsvp.findUnique({
        where: { id: rsvpId },
        include: {
          items: { include: { menuItem: true } },
          fieldResponses: { include: { customField: true } },
        },
      });
    });

    return NextResponse.json({ success: true, guestRsvp: result });
  } catch (err) {
    console.error("Guest RSVP update error:", err);
    return NextResponse.json(
      { error: "Failed to update guest RSVP" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; rsvpId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { rsvpId } = await params;

  try {
    await prisma.guestRsvp.delete({ where: { id: rsvpId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Guest RSVP not found" },
      { status: 404 }
    );
  }
}
