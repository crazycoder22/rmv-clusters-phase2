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
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;
  const body = await request.json();

  // Validate category if provided
  if (body.category) {
    const validCategories = ["maintenance", "event", "general", "urgent", "sports"];
    if (!validCategories.includes(body.category)) {
      return NextResponse.json(
        { error: `Category must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }
  }

  // Validate priority if provided
  if (body.priority) {
    const validPriorities = ["low", "normal", "high"];
    if (!validPriorities.includes(body.priority)) {
      return NextResponse.json(
        { error: `Priority must be one of: ${validPriorities.join(", ")}` },
        { status: 400 }
      );
    }
  }

  // Build update data — only include provided fields
  const updateData: Record<string, unknown> = {};
  if (body.title !== undefined) updateData.title = body.title;
  if (body.date !== undefined) updateData.date = new Date(body.date);
  if (body.category !== undefined) updateData.category = body.category;
  if (body.priority !== undefined) updateData.priority = body.priority;
  if (body.summary !== undefined) updateData.summary = body.summary;
  if (body.body !== undefined) updateData.body = body.body;
  if (body.author !== undefined) updateData.author = body.author;
  if (body.link !== undefined) updateData.link = body.link || null;
  if (body.linkText !== undefined) updateData.linkText = body.linkText || null;
  if (body.published !== undefined) updateData.published = body.published;

  try {
    // Handle eventConfig updates
    if (body.eventConfig !== undefined) {
      if (body.eventConfig === null) {
        // Remove eventConfig (disable RSVP)
        await prisma.eventConfig.deleteMany({ where: { announcementId: id } });
      } else {
        const ec = body.eventConfig;
        const existing = await prisma.eventConfig.findUnique({
          where: { announcementId: id },
        });

        if (existing) {
          // Update config fields
          await prisma.eventConfig.update({
            where: { id: existing.id },
            data: {
              mealType: ec.mealType || null,
              rsvpDeadline: new Date(ec.rsvpDeadline),
              requirePayment: ec.requirePayment ?? false,
              entranceFee: ec.entranceFee ?? null,
              entranceFeeLabel: ec.entranceFeeLabel || "Entrance Fee",
              confirmationMessage: ec.confirmationMessage || null,
              enableFeedback: ec.enableFeedback ?? false,
              feedbackStyle: ec.feedbackStyle ?? "stars",
            },
          });

          // Update menu items in-place to preserve FK references (RsvpItem, GuestRsvpItem)
          if (ec.menuItems) {
            const incomingIds = (ec.menuItems as { id?: string; name: string; pricePerPlate: number }[])
              .filter((item) => item.id)
              .map((item) => item.id!);
            // Delete removed items
            await prisma.menuItem.deleteMany({
              where: { eventConfigId: existing.id, id: { notIn: incomingIds } },
            });
            // Upsert each item
            for (let i = 0; i < ec.menuItems.length; i++) {
              const item = ec.menuItems[i] as { id?: string; name: string; pricePerPlate: number };
              if (item.id) {
                await prisma.menuItem.update({
                  where: { id: item.id },
                  data: { name: item.name, pricePerPlate: item.pricePerPlate, sortOrder: i },
                });
              } else {
                await prisma.menuItem.create({
                  data: {
                    eventConfigId: existing.id,
                    name: item.name,
                    pricePerPlate: item.pricePerPlate,
                    sortOrder: i,
                  },
                });
              }
            }
          } else {
            // No menu items sent — delete all
            await prisma.menuItem.deleteMany({ where: { eventConfigId: existing.id } });
          }

          // Update custom fields in-place to preserve FK references (RsvpFieldResponse, GuestRsvpFieldResponse)
          if (ec.customFields && ec.customFields.length > 0) {
            const incomingIds = (ec.customFields as { id?: string }[])
              .filter((f) => f.id)
              .map((f) => f.id!);
            // Delete removed fields
            await prisma.customField.deleteMany({
              where: { eventConfigId: existing.id, id: { notIn: incomingIds } },
            });
            // Upsert each field
            for (let i = 0; i < ec.customFields.length; i++) {
              const field = ec.customFields[i] as {
                id?: string; label: string; fieldType: string; required: boolean; options: string | null;
              };
              if (field.id) {
                await prisma.customField.update({
                  where: { id: field.id },
                  data: {
                    label: field.label,
                    fieldType: field.fieldType,
                    required: field.required,
                    options: field.options,
                    sortOrder: i,
                  },
                });
              } else {
                await prisma.customField.create({
                  data: {
                    eventConfigId: existing.id,
                    label: field.label,
                    fieldType: field.fieldType,
                    required: field.required,
                    options: field.options,
                    sortOrder: i,
                  },
                });
              }
            }
          } else {
            // No custom fields sent — delete all
            await prisma.customField.deleteMany({ where: { eventConfigId: existing.id } });
          }
        } else {
          await prisma.eventConfig.create({
            data: {
              announcementId: id,
              mealType: ec.mealType || null,
              rsvpDeadline: new Date(ec.rsvpDeadline),
              requirePayment: ec.requirePayment ?? false,
              entranceFee: ec.entranceFee ?? null,
              entranceFeeLabel: ec.entranceFeeLabel || "Entrance Fee",
              confirmationMessage: ec.confirmationMessage || null,
              enableFeedback: ec.enableFeedback ?? false,
              feedbackStyle: ec.feedbackStyle ?? "stars",
              ...(ec.menuItems && ec.menuItems.length > 0 && {
                menuItems: {
                  create: ec.menuItems.map(
                    (item: { name: string; pricePerPlate: number }, index: number) => ({
                      name: item.name,
                      pricePerPlate: item.pricePerPlate,
                      sortOrder: index,
                    })
                  ),
                },
              }),
              ...(ec.customFields && ec.customFields.length > 0 && {
                customFields: {
                  create: ec.customFields.map(
                    (field: { label: string; fieldType: string; required: boolean; options: string | null }, index: number) => ({
                      label: field.label,
                      fieldType: field.fieldType,
                      required: field.required,
                      options: field.options,
                      sortOrder: index,
                    })
                  ),
                },
              }),
            },
          });
        }
      }
    }

    // Handle sportsConfig updates
    if (body.sportsConfig !== undefined) {
      if (body.sportsConfig === null) {
        // Remove sportsConfig (disable sports registration)
        await prisma.sportsConfig.deleteMany({ where: { announcementId: id } });
      } else {
        const sc = body.sportsConfig;
        const existing = await prisma.sportsConfig.findUnique({
          where: { announcementId: id },
        });

        if (existing) {
          await prisma.sportItem.deleteMany({ where: { sportsConfigId: existing.id } });
          await prisma.sportsConfig.update({
            where: { id: existing.id },
            data: {
              registrationDeadline: new Date(sc.registrationDeadline),
              sportItems: {
                create: sc.sportItems.map(
                  (item: { name: string }, index: number) => ({
                    name: item.name,
                    sortOrder: index,
                  })
                ),
              },
            },
          });
        } else {
          await prisma.sportsConfig.create({
            data: {
              announcementId: id,
              registrationDeadline: new Date(sc.registrationDeadline),
              sportItems: {
                create: sc.sportItems.map(
                  (item: { name: string }, index: number) => ({
                    name: item.name,
                    sortOrder: index,
                  })
                ),
              },
            },
          });
        }
      }
    }

    const announcement = await prisma.announcement.update({
      where: { id },
      data: updateData,
      include: {
        eventConfig: {
          include: {
            menuItems: { orderBy: { sortOrder: "asc" } },
            customFields: { orderBy: { sortOrder: "asc" } },
          },
        },
        sportsConfig: {
          include: { sportItems: { orderBy: { sortOrder: "asc" } } },
        },
      },
    });

    // Create notifications when publishing (draft → published)
    if (body.published === true) {
      const existingCount = await prisma.notification.count({
        where: { announcementId: id },
      });
      if (existingCount === 0) {
        const residents = await prisma.resident.findMany({
          select: { id: true },
        });
        if (residents.length > 0) {
          await prisma.notification.createMany({
            data: residents.map((r) => ({
              residentId: r.id,
              announcementId: id,
            })),
            skipDuplicates: true,
          });
        }
      }
    }

    return NextResponse.json({ success: true, announcement });
  } catch {
    return NextResponse.json(
      { error: "Announcement not found" },
      { status: 404 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;

  try {
    await prisma.announcement.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Announcement not found" },
      { status: 404 }
    );
  }
}
