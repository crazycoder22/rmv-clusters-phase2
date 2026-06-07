import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canManageDomesticHelp } from "@/lib/roles";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const worker = await prisma.domesticHelp.findUnique({
    where: { id },
    include: {
      addedBy: { select: { id: true, name: true, block: true, flatNumber: true } },
      reviews: {
        include: {
          resident: { select: { id: true, name: true, block: true, flatNumber: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!worker) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  }

  const myReview = worker.reviews.find((r) => r.residentId === resident.id) || null;

  return NextResponse.json({
    worker,
    myReview,
    isOwner: worker.addedById === resident.id,
    canManage: canManageDomesticHelp(resident.roles),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const worker = await prisma.domesticHelp.findUnique({
    where: { id },
    select: { addedById: true },
  });
  if (!worker) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  }

  const isOwner = worker.addedById === resident.id;
  const isAdminUser = canManageDomesticHelp(resident.roles);
  if (!isOwner && !isAdminUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, phone, categories, description, availability } = body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name.trim();
  if (phone !== undefined) data.phone = phone.trim();
  if (categories !== undefined) data.categories = categories;
  if (description !== undefined) data.description = description?.trim() || null;
  if (availability !== undefined) data.availability = availability?.trim() || null;

  const updated = await prisma.domesticHelp.update({ where: { id }, data });

  return NextResponse.json({ worker: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const worker = await prisma.domesticHelp.findUnique({
    where: { id },
    select: { addedById: true },
  });
  if (!worker) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  }
  const isOwner = worker.addedById === resident.id;
  if (!isOwner && !canManageDomesticHelp(resident.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.domesticHelp.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
