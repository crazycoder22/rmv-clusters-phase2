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
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WebP, and GIF images are allowed" },
      { status: 400 }
    );
  }

  // Validate file size (5MB)
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File size must be less than 5MB" },
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
