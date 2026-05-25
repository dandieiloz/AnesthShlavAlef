import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "USER" | "ADMIN";
    } & DefaultSession["user"];
  }
  interface User {
    role?: "USER" | "ADMIN";
    fullName?: string | null;
    hospitalName?: string | null;
    residencyYear?: number | null;
  }
}

