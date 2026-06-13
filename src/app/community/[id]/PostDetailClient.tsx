"use client";

import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import FeedPost from "@/components/community/FeedPost";

interface PostData {
  id: string;
  content: string;
  images: string[];
  videoUrl: string | null;
  author: {
    id: string;
    name: string;
    block: number;
    flatNumber: string;
    googleImage: string | null;
  };
  commentCount: number;
  likeCount: number;
  isLiked: boolean;
  createdAt: string;
}

export default function PostDetailClient({ id }: { id: string }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      // Preserve the deep link — return to this post after Google login.
      signIn("google", { callbackUrl: `/community/${id}` });
    } else if (status === "authenticated" && !session?.user?.isApproved) {
      router.push("/");
    }
  }, [status, session, router, id]);

  useEffect(() => {
    if (status !== "authenticated") return;

    fetch("/api/residents/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setCurrentUserId(data.id);
      })
      .catch(() => {});
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;

    fetch(`/api/feed/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((data) => setPost(data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [status, id]);

  const isAdmin =
    session?.user?.roles?.some((r: string) =>
      ["ADMIN", "SUPERADMIN"].includes(r)
    ) ?? false;

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary-600" />
      </div>
    );
  }

  if (status !== "authenticated" || !session?.user?.isApproved) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href="/community"
        className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium mb-6"
      >
        <ArrowLeft size={16} />
        Back to Community
      </Link>

      {notFound ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">
            This post was not found or has been deleted.
          </p>
        </div>
      ) : post ? (
        <FeedPost
          post={post}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onDelete={() => router.push("/community")}
        />
      ) : null}
    </div>
  );
}
