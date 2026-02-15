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

export async function GET() {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const announcements = await prisma.announcement.findMany({
    orderBy: { date: "desc" },
    include: {
      eventConfig: {
        include: { menuItems: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  return NextResponse.json({ announcements });
}

export async function POST(request: Request) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const body = await request.json();
  const { title, date, category, priority, summary, body: announcementBody, author, link, linkText, published, eventConfig } = body;

  // Validate required fields
  if (!title || !summary || !announcementBody || !author) {
    return NextResponse.json(
      { error: "Title, summary, body, and author are required" },
      { status: 400 }
    );
  }

  const validCategories = ["maintenance", "event", "general", "urgent"];
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
    if (!validMealTypes.includes(eventConfig.mealType)) {
      return NextResponse.json(
        { error: `Meal type must be one of: ${validMealTypes.join(", ")}` },
        { status: 400 }
      );
    }
    if (!eventConfig.rsvpDeadline) {
      return NextResponse.json(
        { error: "RSVP deadline is required" },
        { status: 400 }
      );
    }
    if (!eventConfig.menuItems || eventConfig.menuItems.length === 0) {
      return NextResponse.json(
        { error: "At least one menu item is required" },
        { status: 400 }
      );
    }
  }

  // Create announcement with optional eventConfig in a single nested create
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
            mealType: eventConfig.mealType,
            rsvpDeadline: new Date(eventConfig.rsvpDeadline),
            menuItems: {
              create: eventConfig.menuItems.map(
                (item: { name: string; pricePerPlate: number }, index: number) => ({
                  name: item.name,
                  pricePerPlate: item.pricePerPlate,
                  sortOrder: index,
                })
              ),
            },
          },
        },
      }),
    },
    include: {
      eventConfig: {
        include: { menuItems: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  return NextResponse.json({ success: true, announcement }, { status: 201 });
}
