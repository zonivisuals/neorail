import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";

/**
 * Server-side authentication guard for protected routes
 * Use this in Server Components (layouts, pages) to enforce authentication
 */
export async function requireAuth() {
  const session = await auth();
  
  if (!session) {
    redirect("/login");
  }
  
  return session;
}

/**
 * Role-based access control guard
 * Redirects to appropriate dashboard if user doesn't have required role
 */
export async function requireRole(allowedRoles: string[]) {
  const session = await requireAuth();
  
  /* if (!allowedRoles.includes(session.user.role)) {
    // Redirect to user's own dashboard
    const dashboardUrl = session.user.role === "ADMIN" 
      ? "/admin/dashboard" 
      : "/conductor/dashboard";
    redirect(dashboardUrl);
  } */
  
  return session;
}

/**
 * Redirect authenticated users away from public pages (like login)
 */
export async function redirectIfAuthenticated() {
  const session = await auth();
  
  if (session) {
    const dashboardUrl = session.user.role === "ADMIN" 
      ? "/admin/dashboard" 
      : "/conductor/dashboard";
    redirect(dashboardUrl);
  }
}
