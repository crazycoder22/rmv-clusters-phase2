import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

// Server layout that attaches per-event share metadata to the (client) RSVP
// page, so a shared RSVP link previews with the event's own image/title rather
// than the site-wide default. Generic: every event uses its own imageUrl.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ev = await prisma.announcement.findUnique({
    where: { id },
    select: { title: true, summary: true, imageUrl: true },
  });
  if (!ev) return {};

  const images = ev.imageUrl ? [ev.imageUrl] : undefined;
  return {
    title: ev.title,
    description: ev.summary,
    openGraph: {
      title: ev.title,
      description: ev.summary,
      images,
    },
    twitter: {
      card: "summary",
      title: ev.title,
      description: ev.summary,
      images,
    },
  };
}

export default function RsvpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
