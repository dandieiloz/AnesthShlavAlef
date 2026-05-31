import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "USER";
        token.plan = (user as { plan?: string }).plan ?? "DEMO";
      }
      // Backfill role/plan for existing sessions whose tokens predate this field,
      // and refresh on explicit session updates so admin changes propagate without re-login.
      const needsBackfill = token.id && (token.plan === undefined || trigger === "update");
      if (needsBackfill) {
        const fresh = await db.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, plan: true },
        });
        if (fresh) {
          token.role = fresh.role;
          token.plan = fresh.plan;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as "USER" | "ADMIN") ?? "USER";
        session.user.plan = (token.plan as "DEMO" | "PAID") ?? "DEMO";
      }
      return session;
    },
  },
});

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  return session.user as {
    id: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
    role: "USER" | "ADMIN";
    plan: "DEMO" | "PAID";
  };
}

export async function requireCompletedProfile() {
  const me = await requireUser();
  const dbUser = await db.user.findUnique({
    where: { id: me.id },
    select: { residencyYear: true },
  });
  if (!dbUser?.residencyYear) redirect("/onboarding");
  return me;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
