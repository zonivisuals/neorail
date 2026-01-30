"use server";

/**
 * Fetch Reports Server Action
 * 
 * Retrieves all reports with their solutions from the database
 * for initial dashboard hydration.
 */

import { prismaClient as prisma } from "@/lib/prisma";

export type SolutionCandidateData = {
  id: string;
  createdAt: string;
  title: string;
  steps: string;
  action: string;
  detail: string;
  score: number;
  rank: number;
  sourceId: number;
  avgDelay: number | null;
  timesUsed: number | null;
  reportId: string;
};

export type ReportWithSolutionData = {
  id: string;
  createdAt: string;
  updatedAt: string;
  content: string;
  imageUrl: string[];
  location: string;
  trainId: string | null;
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "ANALYZING" | "PENDING_REVIEW" | "PENDING_CONDUCTOR" | "RESOLVED";
  conductorId: string;
  adminId: string | null;
  solution: {
    id: string;
    createdAt: string;
    updatedAt: string;
    title: string;
    steps: string[] | string;
    confidence: number;
    source: string;
    similarityScore: number | null;
    retrievalMethod: string | null;
    retrievedSources: unknown;
    reportId: string;
    confirmedAt: string | null;
    acknowledgedAt: string | null;
  } | null;
  candidates: SolutionCandidateData[];
};

export type GetReportsResult = {
  success: true;
  reports: ReportWithSolutionData[];
} | {
  success: false;
  error: string;
};

/**
 * Fetch all reports with their solutions
 */
export async function getReports(): Promise<GetReportsResult> {
  try {
    // @ts-ignore - Prisma adapter type issue
    const reports = await prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        solution: true,
        candidates: {
          orderBy: { rank: "asc" },
        },
      },
    });

    // Transform dates to strings for serialization
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serializedReports: ReportWithSolutionData[] = reports.map((report: any) => ({
      id: report.id,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      content: report.content,
      imageUrl: report.imageUrl,
      location: report.location,
      trainId: report.trainId,
      urgency: report.urgency,
      status: report.status,
      conductorId: report.conductorId,
      adminId: report.adminId,
      solution: report.solution ? {
        id: report.solution.id,
        createdAt: report.solution.createdAt.toISOString(),
        updatedAt: report.solution.updatedAt?.toISOString() ?? report.solution.createdAt.toISOString(),
        title: report.solution.title,
        steps: report.solution.steps,
        confidence: report.solution.confidence ?? 0,
        source: report.solution.source,
        similarityScore: report.solution.similarityScore,
        retrievalMethod: report.solution.retrievalMethod,
        retrievedSources: report.solution.retrievedSources,
        reportId: report.solution.reportId,
        confirmedAt: report.solution.confirmedAt?.toISOString() ?? null,
        acknowledgedAt: report.solution.acknowledgedAt?.toISOString() ?? null,
      } : null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      candidates: (report.candidates ?? []).map((c: any) => ({
        id: c.id,
        createdAt: c.createdAt.toISOString(),
        title: c.title,
        steps: c.steps,
        action: c.action,
        detail: c.detail,
        score: c.score,
        rank: c.rank,
        sourceId: c.sourceId,
        avgDelay: c.avgDelay,
        timesUsed: c.timesUsed,
        reportId: c.reportId,
      })),
    }));

    return {
      success: true,
      reports: serializedReports,
    };
  } catch (error) {
    console.error("[getReports] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch reports",
    };
  }
}
