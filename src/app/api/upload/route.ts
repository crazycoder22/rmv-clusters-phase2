import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getAuthedResident } from "@/lib/api-auth";

// Accepts NextAuth cookie (web) or `Authorization: Bearer <jwt>` (mobile).
export async function POST(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident || !resident.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WebP, GIF images and PDF documents are allowed" },
      { status: 400 }
    );
  }

  // Validate file size — PDFs may be larger (15MB) than images (5MB).
  const isPdf = file.type === "application/pdf";
  const maxBytes = isPdf ? 15 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: `File size must be less than ${isPdf ? 15 : 5}MB` },
      { status: 400 }
    );
  }

  try {
    const blob = await put(`community/${Date.now()}-${file.name}`, file, {
      access: "public",
    });
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
