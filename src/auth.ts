import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        token.name = profile.name;
        token.email = profile.email;
        token.picture = profile.picture;
      }

      // Always refresh registration/approval/roles from the DB when we have an
      // email on the token. The previous version cached these in the JWT and
      // only re-checked under narrow conditions, which meant changes in the DB
      // (email updates from MyGate import, manual un-approval, deletion) were
      // invisible to the running session until the user signed out.
      if (token.email) {
        const resident = await prisma.resident.findUnique({
          where: { email: token.email },
          select: { id: true, isApproved: true, roles: { select: { name: true } } },
        });
        token.isRegistered = !!resident;
        token.isApproved = resident?.isApproved ?? false;
        token.roles = resident?.roles.map((r) => r.name) ?? [];
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.image = token.picture as string;
        session.user.isRegistered = token.isRegistered ?? false;
        session.user.isApproved = token.isApproved ?? false;
        session.user.roles = (token.roles as string[]) ?? [];
      }
      return session;
    },
  },
});
