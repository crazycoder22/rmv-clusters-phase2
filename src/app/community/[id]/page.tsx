import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import siteData from "@/data/site.json";
import PostDetailClient from "./PostDetailClient";

// Per-post Open Graph tags so a shared link unfurls with the post's photo +
// a snippet (WhatsApp / iMessage / Slack read these server-side, unauthenticated).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const post = await prisma.post.findUnique({
      where: { id },
      select: {
        content: true,
        images: true,
        author: { select: { name: true } },
      },
    });

    if (!post) return { title: "Post" };

    const snippet =
      post.content?.trim().slice(0, 160) ||
      (post.images.length > 0 ? "Shared a photo" : "Community post");
    const title = `${post.author.name} · ${siteData.name} Community`;
    const image = post.images[0]; // Vercel Blob → already an absolute https URL

    return {
      title,
      description: snippet,
      openGraph: {
        title,
        description: snippet,
        type: "article",
        siteName: siteData.name,
        ...(image ? { images: [{ url: image }] } : {}),
      },
      twitter: {
        card: image ? "summary_large_image" : "summary",
        title,
        description: snippet,
        ...(image ? { images: [image] } : {}),
      },
    };
  } catch {
    return { title: "Post" };
  }
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PostDetailClient id={id} />;
}
