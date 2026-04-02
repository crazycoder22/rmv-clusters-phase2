"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import CreatePost from "@/components/community/CreatePost";
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

export default function CommunityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  // Check auth
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated" && !session?.user?.isApproved) {
      router.push("/");
    }
  }, [status, session, router]);

  const fetchPosts = useCallback(async (cursor?: string) => {
    try {
      const url = cursor ? `/api/feed?cursor=${cursor}` : "/api/feed";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch {
      // ignore
    }
    return null;
  }, []);

  // Fetch current user's resident ID
  useEffect(() => {
    if (status !== "authenticated") return;

    fetch("/api/residents/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setCurrentUserId(data.id);
      })
      .catch(() => {});
  }, [status]);

  // Initial load
  useEffect(() => {
    if (status !== "authenticated") return;

    fetchPosts().then((data) => {
      if (data) {
        setPosts(data.posts);
        setNextCursor(data.nextCursor);
      }
      setLoading(false);
    });
  }, [status, fetchPosts]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const data = await fetchPosts(nextCursor);
    if (data) {
      setPosts((prev) => [...prev, ...data.posts]);
      setNextCursor(data.nextCursor);
    }
    setLoadingMore(false);
  };

  const handlePostCreated = (post: PostData) => {
    setPosts((prev) => [post, ...prev]);
  };

  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const isAdmin = session?.user?.roles?.some((r: string) =>
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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Community</h1>

      <CreatePost onPostCreated={handlePostCreated} />

      {posts.length === 0 && !loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">
            No posts yet. Be the first to share something!
          </p>
        </div>
      ) : (
        <>
          {posts.map((post) => (
            <FeedPost
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onDelete={handlePostDeleted}
            />
          ))}

          {nextCursor && (
            <div className="flex justify-center py-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-6 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/50 disabled:opacity-50 transition-colors"
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    Loading...
                  </span>
                ) : (
                  "Load more"
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
