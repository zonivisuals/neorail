"use server";

/**
 * Acknowledge Solution Server Action
 * 
 * Called when conductor acknowledges they received the solution
 * and will take action. Updates the solution and report status.
 * Also adds the resolved incident to the vector KB for future learning.
 */

import { prismaClient as prisma } from "@/lib/prisma";

const QDRANT_API_URL = process.env.QDRANT_API_URL || "http://localhost:8000";

export type AcknowledgeSolutionResult =
  | {
      success: true;
      message: string;
      kbAdded?: boolean;  // Whether incident was added to knowledge base
    }
  | {
      success: false;
      error: string;
    };

/**
 * Add resolved incident to Qdrant knowledge base
 * This enables the system to learn from new incidents
 */
async function addToKnowledgeBase(
  reportId: string,
  description: string,
  solution: { action: string; description: string },
  imageUrls: string[],
  location: string | null,
  weather?: string | null
): Promise<boolean> {
  try {
    const response = await fetch(`${QDRANT_API_URL}/add-incident`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description,
        resolution_action: solution.action,
        resolution_detail: solution.description,
        image_urls: imageUrls,
        weather: weather || null,
        delay_mins: 0,  // Could be calculated from createdAt to acknowledgedAt
        location,
        report_id: reportId,
      }),
    });
    
    if (!response.ok) {
      console.warn(`[addToKnowledgeBase] Failed to add to KB: ${response.status}`);
      return false;
    }
    
    const result = await response.json();
    console.log(`[addToKnowledgeBase] Added to KB: point_id=${result.point_id}`);
    return result.success;
  } catch (error) {
    // Don't fail the acknowledgement if KB update fails
    console.warn("[addToKnowledgeBase] Error (non-blocking):", error);
    return false;
  }
}

/**
 * Conductor acknowledges receiving and acting on the solution
 * 
 * @param reportId - The ID of the report whose solution to acknowledge
 * @returns Success or error result
 */
export async function acknowledgeSolution(
  reportId: string
): Promise<AcknowledgeSolutionResult> {
  console.log(`[acknowledgeSolution] Acknowledging solution for report: ${reportId}`);
  
  try {
    // 1. Fetch the solution by reportId with report details including imageUrl
    // @ts-ignore
    const solution = await prisma.solution.findUnique({
      where: { reportId: reportId },
      include: {
        report: {
          select: {
            id: true,
            content: true,
            imageUrl: true,
            location: true,
          },
        },
      },
    });
    
    if (!solution) {
      return {
        success: false,
        error: "Solution not found for this report",
      };
    }
    
    // Check if already acknowledged
    if (solution.acknowledgedAt) {
      return {
        success: false,
        error: "Solution already acknowledged",
      };
    }
    
    // 2. Update solution with acknowledgement timestamp
    // @ts-ignore
    await prisma.solution.update({
      where: { id: solution.id },
      data: {
        acknowledgedAt: new Date(),
      },
    });
    
    // 3. Update report status to RESOLVED
    // @ts-ignore
    await prisma.report.update({
      where: { id: reportId },
      data: { status: "RESOLVED" },
    });
    
    console.log(`[acknowledgeSolution] Solution acknowledged`);
    console.log(`[acknowledgeSolution] Report status updated to RESOLVED`);
    
    // 4. Add resolved incident to knowledge base (non-blocking)
    // This enables the system to learn from new incidents
    const report = solution.report;
    const kbAdded = await addToKnowledgeBase(
      reportId,
      report.content,
      { action: solution.title, description: solution.steps },
      report.imageUrl || [],
      report.location
    );
    
    if (kbAdded) {
      console.log(`[acknowledgeSolution] Incident added to KB for future learning`);
    }
    
    return {
      success: true,
      message: "Solution acknowledged. Taking action on the incident.",
      kbAdded,
    };
  } catch (error) {
    console.error("[acknowledgeSolution] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to acknowledge solution",
    };
  }
}

/**
 * Get solution for conductor to acknowledge
 */
export async function getSolutionForConductor(reportId: string) {
  try {
    // @ts-ignore
    const solution = await prisma.solution.findUnique({
      where: { reportId },
      include: {
        report: {
          select: {
            status: true,
            content: true,
            location: true,
            urgency: true,
          },
        },
      },
    });
    
    return solution;
  } catch (error) {
    console.error("[getSolutionForConductor] Error:", error);
    return null;
  }
}
