"use server";

/**
 * Analyze Solution Server Action
 * 
 * This action orchestrates the RAG pipeline using FastAPI + OpenCLIP:
 * 1. Fetch report data from database
 * 2. Call FastAPI server which uses OpenCLIP for embeddings (no rate limits!)
 * 3. Get similar incidents directly from Qdrant
 * 4. Format the best match as the solution (no LLM needed)
 * 5. Store solution in database
 * 6. Update report status
 */

import { prismaClient as prisma } from "@/lib/prisma";

// FastAPI server URL (uses OpenCLIP embeddings)
const FASTAPI_URL = process.env.QDRANT_SERVICE_URL || "http://localhost:8000";

export type AnalyzeSolutionResult =
  | {
      success: true;
      solutionId: string;
      title: string;
      confidence: number;
      source: string;
    }
  | {
      success: true;
      candidatesCount: number;
      status: string;
      message: string;
      topCandidate?: {
        title: string;
        confidence: number;
      };
    }
  | {
      success: false;
      error: string;
    };

type FastAPISolutionResult = {
  id: number;
  score: number;
  action: string;
  detail: string;
  avg_delay: number;
  times_used: number;
  original_log?: string;
  weather?: string;
};

type MultimodalSearchResponse = {
  results: FastAPISolutionResult[];
  embedding_info: {
    text_weight: number;
    image_weight: number;
    images_provided: number;
    images_processed: number;
    fusion_method: string;
    dimension: number;
    error?: string;
  };
};

/**
 * Search for solutions using FastAPI + OpenCLIP multimodal embeddings
 * 
 * This sends both the text description AND any attached images to create
 * a fused embedding that captures both textual and visual context.
 * 
 * @param description - Text description of the incident
 * @param imageUrls - Optional array of image URLs from the report
 * @returns Array of similar incidents from the vector database
 */
async function searchWithOpenCLIP(
  description: string,
  imageUrls?: string[]
): Promise<FastAPISolutionResult[]> {
  try {
    // Use the multimodal endpoint for better search quality
    const url = `${FASTAPI_URL}/search-multimodal`;
    
    const requestBody = {
      text: description,
      image_urls: imageUrls && imageUrls.length > 0 ? imageUrls : null,
      text_weight: 0.6,  // Prioritize text since KB is text-only
      limit: 3,
    };
    
    console.log(`[analyzeSolution] Calling FastAPI multimodal search`);
    console.log(`[analyzeSolution] Text: ${description.substring(0, 50)}...`);
    console.log(`[analyzeSolution] Images: ${imageUrls?.length || 0} provided`);
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      throw new Error(`FastAPI error: ${response.status}`);
    }
    
    const data: MultimodalSearchResponse = await response.json();
    
    // Log embedding info for debugging
    if (data.embedding_info) {
      console.log(`[analyzeSolution] Embedding info:`, {
        textWeight: data.embedding_info.text_weight,
        imagesProcessed: data.embedding_info.images_processed,
        fusionMethod: data.embedding_info.fusion_method,
      });
    }
    
    return data.results || [];
  } catch (error) {
    console.error("[analyzeSolution] FastAPI multimodal search failed:", error);
    
    // Fallback to text-only search if multimodal fails
    console.log("[analyzeSolution] Falling back to text-only search...");
    return searchTextOnly(description);
  }
}

/**
 * Fallback: Text-only search (original endpoint)
 */
async function searchTextOnly(description: string): Promise<FastAPISolutionResult[]> {
  try {
    const url = `${FASTAPI_URL}/find-solution?description=${encodeURIComponent(description)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`FastAPI error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("[analyzeSolution] Text-only search failed:", error);
    return [];
  }
}

/**
 * Generate a fallback solution when no similar incidents are found
 */
function generateFallbackSolution(urgency: string): {
  title: string;
  steps: string;
  source: string;
  confidence: number;
} {
  const urgencyResponses: Record<string, { title: string; steps: string }> = {
    CRITICAL: {
      title: "Emergency Response Protocol",
      steps: `1. IMMEDIATELY notify dispatch and emergency services
2. Stop all train movements in the affected area
3. Evacuate passengers if safety is compromised
4. Establish a safety perimeter
5. Wait for emergency response team
6. Document all actions taken`,
    },
    HIGH: {
      title: "Priority Incident Response",
      steps: `1. Notify dispatch immediately
2. Assess the situation for safety concerns
3. Implement speed restrictions if needed
4. Coordinate with nearby stations
5. Prepare for potential service delays
6. Keep passengers informed`,
    },
    MEDIUM: {
      title: "Standard Incident Response",
      steps: `1. Report to dispatch
2. Document the incident details
3. Monitor the situation
4. Implement temporary measures if needed
5. Schedule follow-up inspection`,
    },
    LOW: {
      title: "Routine Maintenance Request",
      steps: `1. Log the incident in the system
2. Schedule inspection during next maintenance window
3. Monitor for any changes
4. Report completion when resolved`,
    },
  };

  const response = urgencyResponses[urgency] || urgencyResponses.MEDIUM;
  
  return {
    title: response.title,
    steps: response.steps,
    source: "fallback-template",
    confidence: 0.3,
  };
}

/**
 * Analyze a report and generate a solution using OpenCLIP + Qdrant
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
    
    // 4. Search for similar incidents using FastAPI + OpenCLIP MULTIMODAL
    // Build a comprehensive search query with all available context
    const searchQuery = `${report.content} | Location: ${report.location} | Urgency: ${report.urgency}`;
    
    // Get image URLs from the report (if any)
    const imageUrls = report.imageUrl && report.imageUrl.length > 0 
      ? report.imageUrl 
      : undefined;
    
    console.log(`[analyzeSolution] Searching with OpenCLIP multimodal...`);
    console.log(`[analyzeSolution] Query: ${searchQuery.substring(0, 80)}...`);
    console.log(`[analyzeSolution] Images attached: ${imageUrls?.length || 0}`);
    
    // Use multimodal search (text + images for better matching)
    const similarIncidents = await searchWithOpenCLIP(searchQuery, imageUrls);
    console.log(`[analyzeSolution] Found ${similarIncidents.length} similar incidents`);
    
    // 5. Store solution candidates for admin review (don't auto-select!)
    if (similarIncidents.length === 0) {
      // No matches found - create fallback candidate
      const fallback = generateFallbackSolution(report.urgency);
      
      // @ts-ignore
      await prisma.solutionCandidate.create({
        data: {
          title: fallback.title,
          steps: fallback.steps,
          action: "Fallback Protocol",
          detail: fallback.steps,
          score: fallback.confidence,
          rank: 1,
          sourceId: 0,
          reportId: reportId,
        },
      });
      
      // Update status to PENDING_REVIEW
      // @ts-ignore
      await prisma.report.update({
        where: { id: reportId },
        data: { status: "PENDING_REVIEW" },
      });
      
      console.log(`[analyzeSolution] No matches - created fallback candidate`);
      
      return {
        success: true,
        candidatesCount: 1,
        status: "PENDING_REVIEW",
        message: "No similar incidents found. Fallback solution created for review.",
      };
    }
    
    // Delete any existing candidates for this report
    // @ts-ignore
    await prisma.solutionCandidate.deleteMany({
      where: { reportId: reportId },
    });
    
    // Create candidates from similar incidents (up to 3)
    const candidatesData = similarIncidents.slice(0, 3).map((inc, index) => ({
      title: inc.action.replace(/_/g, " "),
      steps: inc.detail,
      action: inc.action,
      detail: inc.detail,
      score: inc.score,
      rank: index + 1,
      sourceId: inc.id,
      avgDelay: inc.avg_delay,
      timesUsed: inc.times_used,
      reportId: reportId,
    }));
    
    // @ts-ignore
    await prisma.solutionCandidate.createMany({
      data: candidatesData,
    });
    
    // 6. Update report status to PENDING_REVIEW
    // @ts-ignore
    await prisma.report.update({
      where: { id: reportId },
      data: { status: "PENDING_REVIEW" },
    });
    
    console.log(`[analyzeSolution] Created ${candidatesData.length} solution candidates`);
    console.log(`[analyzeSolution] Report status updated to PENDING_REVIEW`);
    
    return {
      success: true,
      candidatesCount: candidatesData.length,
      status: "PENDING_REVIEW",
      message: `Found ${candidatesData.length} solution candidates. Admin review required.`,
      topCandidate: {
        title: candidatesData[0].title,
        confidence: candidatesData[0].score,
      },
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
