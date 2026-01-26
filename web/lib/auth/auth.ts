import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyCredentials } from "@/lib/auth/auth.config";
import { loginSchema } from "@/lib/validations/authSchema";
import { authConfig } from "./auth.edge.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        
        if (!parsed.success) {
          return null;
        }

        const result = await verifyCredentials(
          parsed.data.email,
          parsed.data.password
        );

        if (!result.success) {
          return null;
        }

        return {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role,
        };
      },
    }),
  ],
});
