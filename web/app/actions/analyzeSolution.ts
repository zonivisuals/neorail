"use server";

/**
 * Analyze Solution Server Action
 * 
 * This action orchestrates the multimodal RAG pipeline:
 * 1. Fetch report data from database
 * 2. Generate multimodal embedding (text + images)
 * 3. Search for similar incidents in Qdrant
 * 4. Generate solution using Gemini LLM
 * 5. Store solution in database
 * 6. Update report status
 */

import { prismaClient as prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/auth";
import {
  generateMultimodalEmbedding,
  generateTextEmbedding,
} from "@/lib/services/geminiEmbedding";
import {
  searchSimilarIncidents,
  searchByEmbedding,
} from "@/lib/services/vectorSearch";
import {
  generateSolution,
  generateFallbackSolution,
} from "@/lib/services/solutionGeneration";

export type AnalyzeSolutionResult =
  | {
      success: true;
      solutionId: string;
      title: string;
      confidence: number;
      source: string;
    }
  | {
      success: false;
      error: string;
    };

/**
 * Analyze a report and generate a solution using multimodal RAG
 * 
 * @param reportId - The ID of the report to analyze
 * @returns The generated solution details
 */
export async function analyzeSolution(
  reportId: string
): Promise<AnalyzeSolutionResult> {
  console.log(`[analyzeSolution] Starting analysis for report: ${reportId}`);
  
  try {
    // TODO: Re-enable auth check in production
    // 1. Authenticate user (must be admin) - DISABLED FOR TESTING
    // const session = await auth();
    
    // if (!session?.user?.id) {
    //   return {
    //     success: false,
    //     error: "Authentication required",
    //   };
    // }
    
    // // Verify user is admin
    // const user = await prisma.user.findUnique({
    //   where: { id: session.user.id },
    //   select: { role: true },
    // });
    
    // if (!user || user.role !== "ADMIN") {
    //   return {
    //     success: false,
    //     error: "Only admins can analyze reports",
    //   };
    // }
    
    // 2. Fetch the report with all details
    // @ts-ignore - Prisma adapter type issue
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        conductor: {
          select: { name: true, email: true },
        },
        solution: true,
      },
    });
    
    if (!report) {
      return {
        success: false,
        error: "Report not found",
      };
    }
    
    // Check if solution already exists
    if (report.solution) {
      return {
        success: false,
        error: "Solution already exists for this report",
      };
    }
    
    // 3. Update status to ANALYZING
    // @ts-ignore
    await prisma.report.update({
      where: { id: reportId },
      data: { 
        status: "ANALYZING",
        // adminId: session.user.id, // Disabled for testing
      },
    });
    
    console.log(`[analyzeSolution] Report status updated to ANALYZING`);
    
    // 4. Generate multimodal embedding
    let embeddingResult;
    let retrievalMethod: string;
    
    if (report.imageUrl && report.imageUrl.length > 0) {
      console.log(`[analyzeSolution] Generating multimodal embedding with ${report.imageUrl.length} images`);
      embeddingResult = await generateMultimodalEmbedding(
        `${report.content} | Location: ${report.location} | Urgency: ${report.urgency}`,
        report.imageUrl
      );
      retrievalMethod = "multimodal";
    } else {
      console.log(`[analyzeSolution] Generating text-only embedding`);
      embeddingResult = await generateTextEmbedding(
        `${report.content} | Location: ${report.location} | Urgency: ${report.urgency}`
      );
      retrievalMethod = "text-only";
    }
    
    // 5. Search for similar incidents
    let similarIncidents;
    
    if (embeddingResult.success) {
      console.log(`[analyzeSolution] Embedding generated (${embeddingResult.dimensions} dims)`);
      
      // Try searching with embedding first (requires updated FastAPI)
      similarIncidents = await searchByEmbedding(embeddingResult.embedding, 3);
      
      // Fallback to text search if embedding search fails
      if (!similarIncidents.success) {
        console.log(`[analyzeSolution] Embedding search failed, trying text search`);
        similarIncidents = await searchSimilarIncidents(report.content, 3);
      }
    } else {
      console.log(`[analyzeSolution] Embedding failed, using text search`);
      similarIncidents = await searchSimilarIncidents(report.content, 3);
      retrievalMethod = "text-only";
    }
    
    // 6. Generate solution using Gemini LLM
    let solutionData;
    let retrievedSources: { id: number; score: number; action: string }[] = [];
    
    if (similarIncidents.success && similarIncidents.results.length > 0) {
      console.log(`[analyzeSolution] Found ${similarIncidents.results.length} similar incidents`);
      
      retrievedSources = similarIncidents.results.map((inc) => ({
        id: inc.id,
        score: inc.score,
        action: inc.action,
      }));
      
      const solutionResult = await generateSolution(
        {
          content: report.content,
          location: report.location,
          urgency: report.urgency,
          trainId: report.trainId,
        },
        similarIncidents.results
      );
      
      if (solutionResult.success) {
        solutionData = solutionResult.solution;
      } else {
        console.log(`[analyzeSolution] LLM generation failed, using fallback`);
        solutionData = generateFallbackSolution(report.urgency);
        retrievalMethod = "fallback";
      }
    } else {
      console.log(`[analyzeSolution] No similar incidents found, using LLM only`);
      
      const solutionResult = await generateSolution(
        {
          content: report.content,
          location: report.location,
          urgency: report.urgency,
          trainId: report.trainId,
        },
        []
      );
      
      if (solutionResult.success) {
        solutionData = solutionResult.solution;
      } else {
        solutionData = generateFallbackSolution(report.urgency);
        retrievalMethod = "fallback";
      }
    }
    
    // 7. Store solution in database
    // @ts-ignore
    const solution = await prisma.solution.create({
      data: {
        title: solutionData.title,
        steps: solutionData.steps,
        source: solutionData.source,
        confidence: solutionData.confidence,
        retrievalMethod,
        embeddingModel: embeddingResult.success ? embeddingResult.model : null,
        similarityScore: retrievedSources.length > 0 ? retrievedSources[0].score : null,
        retrievedSources: retrievedSources.length > 0 ? JSON.parse(JSON.stringify(retrievedSources)) : undefined,
        reportId: reportId,
      },
    });
    
    // 8. Update report status to RESOLVED
    // @ts-ignore
    await prisma.report.update({
      where: { id: reportId },
      data: { status: "RESOLVED" },
    });
    
    console.log(`[analyzeSolution] Solution created: ${solution.id}`);
    console.log(`[analyzeSolution] Report status updated to RESOLVED`);
    
    return {
      success: true,
      solutionId: solution.id,
      title: solutionData.title,
      confidence: solutionData.confidence,
      source: solutionData.source,
    };
  } catch (error) {
    console.error("[analyzeSolution] Error:", error);
    
    // Try to revert status if possible
    try {
      // @ts-ignore
      await prisma.report.update({
        where: { id: reportId },
        data: { status: "OPEN" },
      });
    } catch {
      // Ignore revert errors
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Analysis failed",
    };
  }
}

/**
 * Get solution for a report
 */
export async function getSolution(reportId: string) {
  try {
    // @ts-ignore
    const solution = await prisma.solution.findUnique({
      where: { reportId },
    });
    
    return solution;
  } catch (error) {
    console.error("[getSolution] Error:", error);
    return null;
  }
}
