import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "USER" | "ADMIN";
      plan: "DEMO" | "PAID";
    } & DefaultSession["user"];
  }
  interface User {
    role?: "USER" | "ADMIN";
    plan?: "DEMO" | "PAID";
    fullName?: string | null;
    hospitalName?: string | null;
    residencyYear?: number | null;
  }
}

