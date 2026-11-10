import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // Self-hosteado atrás de un reverse proxy (Nginx) en vez de Vercel — sin
  // esto, NextAuth rechaza las requests porque no reconoce el Host que le
  // llega a través del proxy ("UntrustedHost").
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        // Sin passwordHash = cuenta creada por Google — no tiene contraseña
        // propia, no se puede loguear por acá.
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    // No usamos el PrismaAdapter (todo el resto de la app es JWT-only, sin
    // tablas Account/Session) — acá simplemente nos aseguramos de que
    // exista un User con ese email antes de dejar pasar el login. Si ya
    // existe (por ej. se había registrado con contraseña), se reutiliza la
    // misma cuenta: es el mismo email, es la misma persona.
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        await prisma.user.upsert({
          where: { email: user.email },
          create: { email: user.email, name: user.name },
          update: {},
        });
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "google" && token.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: token.email } });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
        }
      } else if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      if (typeof token.id !== "string") return null;
      const currentUser = await prisma.user.findUnique({
        where: { id: token.id },
        select: { role: true },
      });
      if (!currentUser) return null;
      token.role = currentUser.role;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "customer" | "admin" | "superadmin";
      }
      return session;
    },
  },
});
