import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getRazorpay } from "@/lib/razorpay";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { items = [], isGuest } = body;

  // Fetch event config with menu items
  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: {
      eventConfig: { include: { menuItems: true } },
    },
  });

  if (!announcement?.eventConfig) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const eventConfig = announcement.eventConfig;

  // Check deadline
  if (new Date() > new Date(eventConfig.rsvpDeadline)) {
    return NextResponse.json({ error: "RSVP deadline has passed" }, { status: 400 });
  }

  // Calculate total server-side: food items + entrance fee
  let foodTotal = 0;
  for (const item of items) {
    const menuItem = eventConfig.menuItems.find((m: { id: string }) => m.id === item.menuItemId);
    if (!menuItem) continue;
    foodTotal += menuItem.pricePerPlate * item.plates;
  }

  const entranceFee = eventConfig.entranceFee && eventConfig.entranceFee > 0
    ? eventConfig.entranceFee
    : 0;

  const totalAmount = foodTotal + entranceFee;

  // If total is 0, skip payment
  if (totalAmount === 0) {
    return NextResponse.json({ skipPayment: true });
  }

  // Determine receipt prefix
  let receiptPrefix = "guest";
  if (!isGuest) {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    receiptPrefix = session.user.email.split("@")[0];
  }

  // Create Razorpay order (amount in paise)
  const order = await getRazorpay().orders.create({
    amount: Math.round(totalAmount * 100),
    currency: "INR",
    receipt: `${receiptPrefix}_${eventConfig.id.slice(0, 8)}`,
  });

  return NextResponse.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  });
}
