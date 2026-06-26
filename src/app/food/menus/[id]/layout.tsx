import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

// Per-stall share metadata for the (client) Food/Bazaar menu detail page. The
// sibling opengraph-image.tsx supplies the preview image (first item photo or a
// themed fallback). Covers shared /bazaar/menus/:id links too — they 308 here.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const menu = await prisma.foodMenu.findUnique({
    where: { id },
    select: {
      title: true,
      kind: true,
      description: true,
      chef: { select: { name: true } },
      items: { select: { name: true }, orderBy: { sortOrder: "asc" }, take: 4 },
    },
  });
  if (!menu) return {};

  const isMarket = menu.kind === "MARKET";
  const noun = isMarket ? "stall" : "kitchen";
  const itemTeaser = menu.items.map((i) => i.name).filter(Boolean).join(", ");
  const description =
    menu.description?.trim() ||
    `${isMarket ? "🛒" : "🍱"} ${menu.chef.name}'s ${noun}${itemTeaser ? ` — ${itemTeaser}` : ""}. Order on the RMV app.`;
  const ogTitle = `${menu.title} — ${menu.chef.name}'s ${noun}`;

  return {
    title: menu.title,
    description,
    openGraph: { title: ogTitle, description },
    twitter: { card: "summary_large_image", title: ogTitle, description },
  };
}

export default function MenuDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
