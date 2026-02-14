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
  });

  return NextResponse.json({ announcements });
}

export async function POST(request: Request) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const body = await request.json();
  const { title, date, category, priority, summary, body: announcementBody, author, link, linkText, published } = body;

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
    },
  });

  return NextResponse.json({ success: true, announcement }, { status: 201 });
}
