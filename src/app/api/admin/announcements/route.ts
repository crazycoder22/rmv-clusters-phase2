import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

const announcementInclude = {
  eventConfig: {
    include: { menuItems: { orderBy: { sortOrder: "asc" as const } } },
  },
  sportsConfig: {
    include: { sportItems: { orderBy: { sortOrder: "asc" as const } } },
  },
};

export async function GET() {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const announcements = await prisma.announcement.findMany({
    orderBy: { date: "desc" },
    include: announcementInclude,
  });

  return NextResponse.json({ announcements });
}

export async function POST(request: Request) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const body = await request.json();
  const { title, date, category, priority, summary, body: announcementBody, author, link, linkText, published, eventConfig, sportsConfig } = body;

  // Validate required fields
  if (!title || !summary || !announcementBody || !author) {
    return NextResponse.json(
      { error: "Title, summary, body, and author are required" },
      { status: 400 }
    );
  }

  const validCategories = ["maintenance", "event", "general", "urgent", "sports"];
  if (category && !validCategories.includes(category)) {
    return NextResponse.json(
      { error: `Category must be one of: ${validCategories.join(", ")}` },
      { status: 400 }
    );
  }

  const validPriorities = ["low", "normal", "high"];
  if (priority && !validPriorities.includes(priority)) {
    return NextResponse.json(
      { error: `Priority must be one of: ${validPriorities.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate eventConfig if provided
  if (eventConfig) {
    const validMealTypes = ["breakfast", "lunch", "dinner"];
    if (eventConfig.mealType && !validMealTypes.includes(eventConfig.mealType)) {
      return NextResponse.json(
        { error: `Meal type must be one of: ${validMealTypes.join(", ")}` },
        { status: 400 }
      );
    }
    if (!eventConfig.rsvpDeadline) {
      return NextResponse.json({ error: "RSVP deadline is required" }, { status: 400 });
    }
    // menuItems are optional — events can be RSVP-only without food ordering
  }

  // Validate sportsConfig if provided
  if (sportsConfig) {
    if (!sportsConfig.registrationDeadline) {
      return NextResponse.json({ error: "Registration deadline is required" }, { status: 400 });
    }
    if (!sportsConfig.sportItems || sportsConfig.sportItems.length === 0) {
      return NextResponse.json({ error: "At least one sport is required" }, { status: 400 });
    }
  }

  const announcement = await prisma.announcement.create({
    data: {
      title,
      date: date ? new Date(date) : new Date(),
      category: category || "general",
      priority: priority || "normal",
      summary,
      body: announcementBody,
      author,
      link: link || null,
      linkText: linkText || null,
      published: published !== undefined ? published : true,
      ...(eventConfig && {
        eventConfig: {
          create: {
            mealType: eventConfig.mealType || null,
            rsvpDeadline: new Date(eventConfig.rsvpDeadline),
            ...(eventConfig.menuItems && eventConfig.menuItems.length > 0 && {
              menuItems: {
                create: eventConfig.menuItems.map(
                  (item: { name: string; pricePerPlate: number }, index: number) => ({
                    name: item.name,
                    pricePerPlate: item.pricePerPlate,
                    sortOrder: index,
                  })
                ),
              },
            }),
          },
        },
      }),
      ...(sportsConfig && {
        sportsConfig: {
          create: {
            registrationDeadline: new Date(sportsConfig.registrationDeadline),
            sportItems: {
              create: sportsConfig.sportItems.map(
                (item: { name: string }, index: number) => ({
                  name: item.name,
                  sortOrder: index,
                })
              ),
            },
          },
        },
      }),
    },
    include: announcementInclude,
  });

  // Create notifications for all residents if published
  if (announcement.published) {
    const residents = await prisma.resident.findMany({
      select: { id: true },
    });
    if (residents.length > 0) {
      await prisma.notification.createMany({
        data: residents.map((r) => ({
          residentId: r.id,
          announcementId: announcement.id,
        })),
        skipDuplicates: true,
      });
    }
  }

  return NextResponse.json({ success: true, announcement }, { status: 201 });
}
