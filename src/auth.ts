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
    async jwt({ token, profile, trigger }) {
      if (profile) {
        token.name = profile.name;
        token.email = profile.email;
        token.picture = profile.picture;
      }

      // Check registration status on sign-in, session update, or when not yet registered
      if (
        token.email &&
        (trigger === "signIn" || trigger === "update" || !token.isRegistered)
      ) {
        const resident = await prisma.resident.findUnique({
          where: { email: token.email },
          select: { id: true },
        });
        token.isRegistered = !!resident;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.image = token.picture as string;
        session.user.isRegistered = token.isRegistered ?? false;
      }
      return session;
    },
  },
});
