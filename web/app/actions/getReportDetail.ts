"use server";

/**
 * Get Report Details Server Action
 * 
 * Fetches a single report with its solution for detailed view
 */

import { prismaClient as prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/auth";
import type { ConductorReport } from "@/lib/stores/conductorDashboardStore";

export type GetReportResult = {
  success: true;
  report: ConductorReport;
} | {
  success: false;
  error: string;
};

/**
 * Fetch a single report with its solution
 */
export async function getReportDetail(reportId: string): Promise<GetReportResult> {
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
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        solution: true,
      },
    });

    if (!report) {
      return {
        success: false,
        error: "Report not found",
      };
    }

    // Verify ownership - only the conductor who created it can view
    if (report.conductorId !== session.user.id) {
      return {
        success: false,
        error: "Not authorized to view this report",
      };
    }

    // Serialize the report
    const serializedReport: ConductorReport = {
      id: report.id,
      createdAt: report.createdAt.toISOString(),
      content: report.content,
      location: report.location,
      urgency: report.urgency,
      status: report.status,
      trainId: report.trainId,
      imageUrl: report.imageUrl || [],
      solution: report.solution ? {
        id: report.solution.id,
        title: report.solution.title,
        steps: typeof report.solution.steps === 'string' 
          ? report.solution.steps.split('\n').filter((s: string) => s.trim())
          : Array.isArray(report.solution.steps) 
            ? report.solution.steps 
            : [],
        source: report.solution.source,
        confidence: report.solution.confidence,
        createdAt: report.solution.createdAt.toISOString(),
      } : null,
    };

    return {
      success: true,
      report: serializedReport,
    };
  } catch (error) {
    console.error("[getReportDetail] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch report",
    };
  }
}

/**
 * Fetch all reports for the current conductor with solutions
 */
export async function getConductorReportsWithSolutions(): Promise<{
  success: true;
  reports: ConductorReport[];
} | {
  success: false;
  error: string;
}> {
  try {
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
      include: {
        solution: true,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serializedReports: ConductorReport[] = reports.map((report: any) => ({
      id: report.id,
      createdAt: report.createdAt.toISOString(),
      content: report.content,
      location: report.location,
      urgency: report.urgency,
      status: report.status,
      trainId: report.trainId,
      imageUrl: report.imageUrl || [],
      solution: report.solution ? {
        id: report.solution.id,
        title: report.solution.title,
        steps: typeof report.solution.steps === 'string' 
          ? report.solution.steps.split('\n').filter((s: string) => s.trim())
          : Array.isArray(report.solution.steps) 
            ? report.solution.steps 
            : [],
        source: report.solution.source,
        confidence: report.solution.confidence,
        createdAt: report.solution.createdAt.toISOString(),
      } : null,
    }));

    return {
      success: true,
      reports: serializedReports,
    };
  } catch (error) {
    console.error("[getConductorReportsWithSolutions] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch reports",
    };
  }
}
