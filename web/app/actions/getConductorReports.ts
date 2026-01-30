"use server";

/**
 * Get Conductor Reports Server Action
 * 
 * Fetches reports created by the authenticated conductor
 */

import { prismaClient as prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/auth";

export type ConductorReportItem = {
  id: string;
  createdAt: string;
  content: string;
  location: string;
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "ANALYZING" | "RESOLVED";
  trainId: string | null;
};

export type GetConductorReportsResult = {
  success: true;
  reports: ConductorReportItem[];
} | {
  success: false;
  error: string;
};

/**
 * Fetch reports for the current conductor
 */
export async function getConductorReports(): Promise<GetConductorReportsResult> {
  try {
    // Get authenticated user
    const session = await auth();
    
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // @ts-ignore - Prisma adapter type issue
    const reports = await prisma.report.findMany({
      where: {
        conductorId: session.user.id,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        content: true,
        location: true,
        urgency: true,
        status: true,
        trainId: true,
      },
    });

    // Serialize dates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serializedReports: ConductorReportItem[] = reports.map((report: any) => ({
      id: report.id,
      createdAt: report.createdAt.toISOString(),
      content: report.content,
      location: report.location,
      urgency: report.urgency,
      status: report.status,
      trainId: report.trainId,
    }));

    return {
      success: true,
      reports: serializedReports,
    };
  } catch (error) {
    console.error("[getConductorReports] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch reports",
    };
  }
}
