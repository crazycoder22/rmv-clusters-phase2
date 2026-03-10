import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    isRegistered?: boolean;
    isApproved?: boolean;
    roles?: string[];
  }
  interface Session {
    user: {
      isRegistered: boolean;
      isApproved: boolean;
      roles: string[];
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
    isApproved?: boolean;
    roles?: string[];
  }
}
