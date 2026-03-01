import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPassWhatsApp } from "@/lib/whatsapp";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  // Check WhatsApp service configuration
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return NextResponse.json(
      { error: "WhatsApp service not configured" },
      { status: 500 }
    );
  }

  // Parse request body
  let phone: string;
  let passUrl: string;
  try {
    const body = await request.json();
    phone = body.phone?.trim();
    passUrl = body.passUrl?.trim();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  // Validate phone
  if (!phone || phone.replace(/[\s\-()]/g, "").length < 10) {
    return NextResponse.json(
      { error: "Please enter a valid phone number" },
      { status: 400 }
    );
  }

  if (!passUrl) {
    return NextResponse.json(
      { error: "Pass URL is required" },
      { status: 400 }
    );
  }

  // Parse type prefix and ID
  const match = code.match(/^(r|g)-(.+)$/);
  if (!match) {
    return NextResponse.json(
      { error: "Invalid pass code" },
      { status: 400 }
    );
  }

  const [, type, id] = match;

  try {
    let passData: {
      eventTitle: string;
      eventDate: string | Date;
      name: string;
      block: number;
      flatNumber: string;
    } | null = null;

    if (type === "r") {
      const rsvp = await prisma.rsvp.findUnique({
        where: { id },
        include: {
          resident: {
            select: { name: true, block: true, flatNumber: true },
          },
          eventConfig: {
            include: {
              announcement: { select: { title: true, date: true } },
            },
          },
        },
      });
      if (rsvp) {
        passData = {
          eventTitle: rsvp.eventConfig.announcement.title,
          eventDate: rsvp.eventConfig.announcement.date,
          name: rsvp.resident.name,
          block: rsvp.resident.block,
          flatNumber: rsvp.resident.flatNumber,
        };
      }
    } else {
      const guestRsvp = await prisma.guestRsvp.findUnique({
        where: { id },
        include: {
          eventConfig: {
            include: {
              announcement: { select: { title: true, date: true } },
            },
          },
        },
      });
      if (guestRsvp) {
        passData = {
          eventTitle: guestRsvp.eventConfig.announcement.title,
          eventDate: guestRsvp.eventConfig.announcement.date,
          name: guestRsvp.name,
          block: guestRsvp.block,
          flatNumber: guestRsvp.flatNumber,
        };
      }
    }

    if (!passData) {
      return NextResponse.json(
        { error: "Pass not found" },
        { status: 404 }
      );
    }

    const result = await sendPassWhatsApp(phone, {
      ...passData,
      passUrl,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send WhatsApp message" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("WhatsApp send error:", err);
    return NextResponse.json(
      { error: "Failed to send WhatsApp message" },
      { status: 500 }
    );
  }
}
