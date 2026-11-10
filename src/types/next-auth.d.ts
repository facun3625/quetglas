import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: "customer" | "admin" | "superadmin" | "couponStaff";
  }

  interface Session {
    user: {
      id: string;
      role: "customer" | "admin" | "superadmin" | "couponStaff";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "customer" | "admin" | "superadmin" | "couponStaff";
  }
}
