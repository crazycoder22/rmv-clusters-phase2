import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    isRegistered?: boolean;
    role?: "RESIDENT" | "ADMIN" | "SUPERADMIN" | null;
  }
  interface Session {
    user: {
      isRegistered: boolean;
      role: "RESIDENT" | "ADMIN" | "SUPERADMIN" | null;
    } & {
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    isRegistered?: boolean;
    role?: string | null;
  }
}
