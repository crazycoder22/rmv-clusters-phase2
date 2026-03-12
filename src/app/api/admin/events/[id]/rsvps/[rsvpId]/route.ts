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
      body.items !== undefined ||
      body.fieldResponses !== undefined ||
      body.notes !== undefined;

    if (!hasEditFields) {
      // Simple paid toggle (existing behavior)
      const rsvp = await prisma.rsvp.update({
        where: { id: rsvpId },
        data: { paid: body.paid },
        include: {
          resident: {
            select: { id: true, name: true, email: true, block: true, flatNumber: true },
          },
          items: { include: { menuItem: true } },
          fieldResponses: { include: { customField: true } },
        },
      });
      return NextResponse.json({ success: true, rsvp });
    }

    // Full edit with transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update basic fields
      const updateData: Record<string, unknown> = {};
      if (body.notes !== undefined) updateData.notes = body.notes || null;
      if (body.paid !== undefined) updateData.paid = body.paid;

      if (Object.keys(updateData).length > 0) {
        await tx.rsvp.update({
          where: { id: rsvpId },
          data: updateData,
        });
      }

      // Update items if provided
      if (body.items !== undefined) {
        await tx.rsvpItem.deleteMany({ where: { rsvpId } });
        if (body.items.length > 0) {
          await tx.rsvpItem.createMany({
            data: body.items
              .filter((item: { menuItemId: string; plates: number }) => item.plates > 0)
              .map((item: { menuItemId: string; plates: number }) => ({
                rsvpId,
                menuItemId: item.menuItemId,
                plates: item.plates,
              })),
          });
        }
      }

      // Update field responses if provided
      if (body.fieldResponses !== undefined) {
        await tx.rsvpFieldResponse.deleteMany({ where: { rsvpId } });
        if (body.fieldResponses.length > 0) {
          await tx.rsvpFieldResponse.createMany({
            data: body.fieldResponses
              .filter((fr: { customFieldId: string; value: string }) => fr.value)
              .map((fr: { customFieldId: string; value: string }) => ({
                rsvpId,
                customFieldId: fr.customFieldId,
                value: fr.value,
              })),
          });
        }
      }

      // Return the updated RSVP with all relations
      return tx.rsvp.findUnique({
        where: { id: rsvpId },
        include: {
          resident: {
            select: { id: true, name: true, email: true, block: true, flatNumber: true },
          },
          items: { include: { menuItem: true } },
          fieldResponses: { include: { customField: true } },
        },
      });
    });

    return NextResponse.json({ success: true, rsvp: result });
  } catch (err) {
    console.error("RSVP update error:", err);
    return NextResponse.json(
      { error: "Failed to update RSVP" },
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
    await prisma.rsvp.delete({ where: { id: rsvpId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "RSVP not found" },
      { status: 404 }
    );
  }
}
