import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendPassWhatsApp } from "@/lib/whatsapp";
import crypto from "crypto";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    items,
    notes,
    fieldResponses,
    isGuest,
    guestInfo,
  } = body;

  // Verify signature
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return NextResponse.json(
      { error: "Payment verification failed" },
      { status: 400 }
    );
  }

  // Fetch event config
  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: {
      eventConfig: {
        include: { menuItems: true, customFields: true },
      },
    },
  });

  if (!announcement?.eventConfig) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const eventConfig = announcement.eventConfig;

  // Prepare items and field responses
  const foodItems = items
    ?.filter((item: { plates: number }) => item.plates > 0)
    .map((item: { menuItemId: string; plates: number }) => ({
      menuItemId: item.menuItemId,
      plates: item.plates,
    })) || [];

  const validFieldResponses = fieldResponses
    ?.filter((r: { value: string }) => r.value?.trim())
    .map((r: { customFieldId: string; value: string }) => ({
      customFieldId: r.customFieldId,
      value: r.value.trim(),
    })) || [];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (isGuest) {
    // Guest flow
    const guestRsvp = await prisma.guestRsvp.create({
      data: {
        eventConfigId: eventConfig.id,
        name: guestInfo.name.trim(),
        email: guestInfo.email.trim().toLowerCase(),
        phone: guestInfo.phone.trim(),
        block: Number(guestInfo.block),
        flatNumber: guestInfo.flatNumber.trim(),
        notes: notes?.trim() || null,
        paid: true,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        ...(foodItems.length > 0 && { items: { create: foodItems } }),
        ...(validFieldResponses.length > 0 && {
          fieldResponses: { create: validFieldResponses },
        }),
      },
      include: {
        items: { include: { menuItem: true } },
        fieldResponses: { include: { customField: true } },
      },
    });

    // WhatsApp notification (fire-and-forget)
    if (process.env.TWILIO_ACCOUNT_SID) {
      const passCode = `g-${guestRsvp.id}`;
      sendPassWhatsApp(guestInfo.phone.trim(), {
        eventTitle: announcement.title,
        eventDate: announcement.date,
        name: guestInfo.name.trim(),
        block: Number(guestInfo.block),
        flatNumber: guestInfo.flatNumber.trim(),
        passUrl: `${appUrl}/pass/${passCode}`,
      }).catch((err) => console.error("WhatsApp auto-send failed:", err));
    }

    return NextResponse.json({ success: true, guestRsvp }, { status: 201 });
  } else {
    // Resident flow
    const session = await auth();
    if (!session?.user?.email || !session.user.isRegistered) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const resident = await prisma.resident.findUnique({
      where: { email: session.user.email },
    });
    if (!resident) {
      return NextResponse.json({ error: "Resident not found" }, { status: 404 });
    }

    const rsvp = await prisma.rsvp.create({
      data: {
        eventConfigId: eventConfig.id,
        residentId: resident.id,
        notes: notes?.trim() || null,
        paid: true,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        ...(foodItems.length > 0 && { items: { create: foodItems } }),
        ...(validFieldResponses.length > 0 && {
          fieldResponses: { create: validFieldResponses },
        }),
      },
      include: {
        items: { include: { menuItem: true } },
        fieldResponses: { include: { customField: true } },
      },
    });

    // WhatsApp notification (fire-and-forget)
    if (process.env.TWILIO_ACCOUNT_SID) {
      const passCode = `r-${rsvp.id}`;
      sendPassWhatsApp(resident.phone, {
        eventTitle: announcement.title,
        eventDate: announcement.date,
        name: resident.name,
        block: resident.block,
        flatNumber: resident.flatNumber,
        passUrl: `${appUrl}/pass/${passCode}`,
      }).catch((err) => console.error("WhatsApp auto-send failed:", err));
    }

    return NextResponse.json({ success: true, rsvp }, { status: 201 });
  }
}
