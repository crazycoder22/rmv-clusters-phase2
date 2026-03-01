import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getResend, EMAIL_FROM, renderPassEmailHtml } from "@/lib/email";
import QRCode from "qrcode";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  // Check email service configuration
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "Email service not configured" },
      { status: 500 }
    );
  }

  // Parse request body
  let email: string;
  let passUrl: string;
  try {
    const body = await request.json();
    email = body.email?.trim();
    passUrl = body.passUrl?.trim();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  // Validate email
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address" },
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
    // Fetch pass data
    let passData: {
      eventTitle: string;
      eventDate: string | Date;
      name: string;
      type: "resident" | "guest";
      block: number;
      flatNumber: string;
      hasFood: boolean;
      items: { name: string; plates: number; pricePerPlate: number }[];
      paid: boolean;
    } | null = null;

    if (type === "r") {
      const rsvp = await prisma.rsvp.findUnique({
        where: { id },
        include: {
          resident: {
            select: { name: true, block: true, flatNumber: true },
          },
          items: { include: { menuItem: true } },
          eventConfig: {
            include: {
              announcement: { select: { title: true, date: true } },
              menuItems: true,
            },
          },
        },
      });

      if (rsvp) {
        passData = {
          type: "resident",
          eventTitle: rsvp.eventConfig.announcement.title,
          eventDate: rsvp.eventConfig.announcement.date,
          name: rsvp.resident.name,
          block: rsvp.resident.block,
          flatNumber: rsvp.resident.flatNumber,
          hasFood: rsvp.eventConfig.menuItems.length > 0,
          items: rsvp.items.map((i) => ({
            name: i.menuItem.name,
            plates: i.plates,
            pricePerPlate: i.menuItem.pricePerPlate,
          })),
          paid: rsvp.paid,
        };
      }
    } else {
      const guestRsvp = await prisma.guestRsvp.findUnique({
        where: { id },
        include: {
          items: { include: { menuItem: true } },
          eventConfig: {
            include: {
              announcement: { select: { title: true, date: true } },
              menuItems: true,
            },
          },
        },
      });

      if (guestRsvp) {
        passData = {
          type: "guest",
          eventTitle: guestRsvp.eventConfig.announcement.title,
          eventDate: guestRsvp.eventConfig.announcement.date,
          name: guestRsvp.name,
          block: guestRsvp.block,
          flatNumber: guestRsvp.flatNumber,
          hasFood: guestRsvp.eventConfig.menuItems.length > 0,
          items: guestRsvp.items.map((i) => ({
            name: i.menuItem.name,
            plates: i.plates,
            pricePerPlate: i.menuItem.pricePerPlate,
          })),
          paid: guestRsvp.paid,
        };
      }
    }

    if (!passData) {
      return NextResponse.json(
        { error: "Pass not found" },
        { status: 404 }
      );
    }

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(passUrl, {
      width: 200,
      margin: 1,
    });

    // Render HTML email
    const html = renderPassEmailHtml({
      ...passData,
      qrCodeDataUrl,
      passUrl,
    });

    // Send email via Resend
    const { error: sendError } = await getResend().emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: `Your Event Pass: ${passData.eventTitle}`,
      html,
    });

    if (sendError) {
      console.error("Resend error:", sendError);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Email send error:", err);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
