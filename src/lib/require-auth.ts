import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

/**
 * Ensures the request comes from a signed-in, approved resident.
 *
 * - Not signed in → redirect to NextAuth sign-in with a callbackUrl set to
 *   the current path, so after Google OAuth the user lands back where they
 *   started instead of the home page.
 * - Signed in but not approved → redirect to /pending-approval.
 *
 * Relies on middleware.ts setting the `x-pathname` request header.
 *
 * Pass `{ requireApproved: false }` for pages that only need a signed-in
 * user regardless of approval state.
 */
export async function requireAuth(opts: { requireApproved?: boolean } = {}) {
  const { requireApproved = true } = opts;
  const session = await auth();

  if (!session?.user?.email) {
    const h = await headers();
    const pathname = h.get("x-pathname") || "/";
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`);
  }

  if (requireApproved && !session.user.isApproved) {
    redirect("/pending-approval");
  }

  return session;
}
