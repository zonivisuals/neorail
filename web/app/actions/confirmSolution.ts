"use server";

/**
 * Confirm Solution Server Action
 * 
 * Called when admin selects and confirms a solution from the candidates.
 * Creates the final solution and updates report status to PENDING_CONDUCTOR.
 */

import { prismaClient as prisma } from "@/lib/prisma";

export type ConfirmSolutionResult =
  | {
      success: true;
      solutionId: string;
      message: string;
    }
  | {
      success: false;
      error: string;
    };

/**
 * Confirm a solution candidate selected by admin
 * 
 * @param candidateId - The ID of the selected solution candidate
 * @param editedTitle - Optional edited title by admin
 * @param editedSteps - Optional edited steps/description by admin
 * @returns The created solution details
 */
export async function confirmSolution(
  candidateId: string,
  editedTitle?: string,
  editedSteps?: string
): Promise<ConfirmSolutionResult> {
  console.log(`[confirmSolution] Confirming candidate: ${candidateId}`);
  
  try {
    // 1. Fetch the candidate
    // @ts-ignore
    const candidate = await prisma.solutionCandidate.findUnique({
      where: { id: candidateId },
      include: {
        report: {
          include: {
            solution: true,
          },
        },
      },
    });
    
    if (!candidate) {
      return {
        success: false,
        error: "Solution candidate not found",
      };
    }
    
    // Check if solution already exists for this report
    if (candidate.report.solution) {
      return {
        success: false,
        error: "Solution already exists for this report",
      };
    }
    
    // 2. Create the final solution
    const finalTitle = editedTitle?.trim() || candidate.title;
    const finalSteps = editedSteps?.trim() || candidate.steps;
    
    // @ts-ignore
    const solution = await prisma.solution.create({
      data: {
        title: finalTitle,
        steps: finalSteps,
        source: candidate.score > 0.7 ? "vector-search-high-confidence" : "vector-search-partial-match",
        confidence: candidate.score,
        retrievalMethod: "openclip-vector-search",
        embeddingModel: "openclip-ViT-L-14",
        similarityScore: candidate.score,
        retrievedSources: JSON.stringify([{
          id: candidate.sourceId,
          score: candidate.score,
          action: candidate.action,
        }]),
        confirmedAt: new Date(),
        reportId: candidate.reportId,
      },
    });
    
    // 3. Update report status to PENDING_CONDUCTOR
    // @ts-ignore
    await prisma.report.update({
      where: { id: candidate.reportId },
      data: { status: "PENDING_CONDUCTOR" },
    });
    
    // 4. Delete all candidates for this report (cleanup)
    // @ts-ignore
    await prisma.solutionCandidate.deleteMany({
      where: { reportId: candidate.reportId },
    });
    
    console.log(`[confirmSolution] Solution created: ${solution.id}`);
    console.log(`[confirmSolution] Report status updated to PENDING_CONDUCTOR`);
    
    return {
      success: true,
      solutionId: solution.id,
      message: "Solution confirmed and sent to conductor",
    };
  } catch (error) {
    console.error("[confirmSolution] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to confirm solution",
    };
  }
}

/**
 * Get solution candidates for a report
 */
export async function getSolutionCandidates(reportId: string) {
  try {
    // @ts-ignore
    const candidates = await prisma.solutionCandidate.findMany({
      where: { reportId },
      orderBy: { rank: "asc" },
    });
    
    return candidates;
  } catch (error) {
    console.error("[getSolutionCandidates] Error:", error);
    return [];
  }
}
