/**
 * Solution Generation Service
 * 
 * Uses Gemini LLM to generate tailored solutions based on:
 * - The current incident report
 * - Retrieved similar incidents from vector search
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SimilarIncident } from "./vectorSearch";

// Gemini model for solution generation
const SOLUTION_MODEL = "gemini-2.0-flash";

export type GeneratedSolution = {
  title: string;
  steps: string;
  source: string;
  confidence: number;
};

export type SolutionGenerationResult = {
  success: true;
  solution: GeneratedSolution;
} | {
  success: false;
  error: string;
};

/**
 * Initialize Gemini client
 */
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE") {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }
  
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Generate a solution for an incident report using Gemini LLM
 * 
 * @param report - The current incident report details
 * @param similarIncidents - Retrieved similar incidents from vector search
 * @returns Generated solution with title, steps, and confidence
 */
export async function generateSolution(
  report: {
    content: string;
    location: string;
    urgency: string;
    trainId?: string | null;
    imageAnalysis?: string;
  },
  similarIncidents: SimilarIncident[]
): Promise<SolutionGenerationResult> {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: SOLUTION_MODEL });
    
    // Build context from similar incidents
    const incidentContext = similarIncidents
      .map((incident, i) => {
        return `
### Similar Incident ${i + 1} (Similarity: ${(incident.score * 100).toFixed(1)}%)
- **Action Taken:** ${incident.action}
- **Details:** ${incident.detail}
- **Average Resolution Time:** ${incident.avgDelay} minutes
- **Times Used Successfully:** ${incident.timesUsed}
${incident.originalLog ? `- **Original Log:** ${incident.originalLog.substring(0, 200)}...` : ""}
${incident.weather ? `- **Weather Conditions:** ${incident.weather}` : ""}
`;
      })
      .join("\n");
    
    // Calculate average confidence from similar incidents
    const avgScore = similarIncidents.length > 0
      ? similarIncidents.reduce((sum, inc) => sum + inc.score, 0) / similarIncidents.length
      : 0;
    
    const prompt = `You are an expert rail incident response coordinator. Based on the current incident report and similar past incidents, generate a clear, actionable solution.

## Current Incident Report
- **Description:** ${report.content}
- **Location:** ${report.location}
- **Urgency Level:** ${report.urgency}
${report.trainId ? `- **Train ID:** ${report.trainId}` : ""}
${report.imageAnalysis ? `- **Image Analysis:** ${report.imageAnalysis}` : ""}

## Similar Past Incidents
${incidentContext || "No similar incidents found in database."}

---

Based on the above information, provide a solution in the following JSON format:
{
  "title": "Brief title for the recommended action (e.g., 'Emergency Bus Bridge Deployment')",
  "steps": "Detailed step-by-step instructions for resolving this incident. Use numbered steps. Be specific about actions, timing, and coordination required."
}

Important guidelines:
1. Prioritize passenger safety
2. Consider the urgency level when recommending response time
3. If similar incidents exist, leverage their successful resolution strategies
4. If no similar incidents exist, provide general best practices
5. Be concise but thorough

Respond with ONLY the JSON object, no additional text.`;

    console.log("[SolutionGen] Generating solution with Gemini...");
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Parse JSON response
    let parsedSolution: { title: string; steps: string };
    try {
      // Clean up the response (remove markdown code blocks if present)
      const cleanedResponse = responseText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      
      parsedSolution = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error("[SolutionGen] Failed to parse JSON response:", responseText);
      
      // Fallback: extract content manually
      parsedSolution = {
        title: "Incident Response Required",
        steps: responseText,
      };
    }
    
    // Determine source based on similar incidents
    let source: string;
    if (similarIncidents.length > 0 && avgScore > 0.7) {
      source = "vector-search-high-confidence";
    } else if (similarIncidents.length > 0) {
      source = "vector-search-partial-match";
    } else {
      source = "llm-generated";
    }
    
    // Calculate confidence (combination of similarity scores and match count)
    const confidence = Math.min(
      avgScore * 0.7 + (similarIncidents.length > 0 ? 0.3 : 0),
      1.0
    );
    
    console.log(`[SolutionGen] Solution generated: "${parsedSolution.title}" (confidence: ${(confidence * 100).toFixed(1)}%)`);
    
    return {
      success: true,
      solution: {
        title: parsedSolution.title,
        steps: parsedSolution.steps,
        source,
        confidence,
      },
    };
  } catch (error) {
    console.error("[SolutionGen] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Solution generation failed",
    };
  }
}

/**
 * Generate a fallback solution when vector search or LLM fails
 */
export function generateFallbackSolution(
  urgency: string
): GeneratedSolution {
  const urgencyResponses: Record<string, { title: string; steps: string }> = {
    CRITICAL: {
      title: "Emergency Response Protocol",
      steps: `1. IMMEDIATELY notify dispatch and emergency services
2. Stop all train movements in the affected area
3. Evacuate passengers if safety is compromised
4. Establish a safety perimeter
5. Wait for emergency response team
6. Document all actions taken
7. Prepare incident report for management`,
    },
    HIGH: {
      title: "Urgent Incident Response",
      steps: `1. Notify dispatch of the situation
2. Assess immediate safety risks
3. Implement temporary traffic control measures
4. Coordinate with maintenance team
5. Communicate delays to affected passengers
6. Monitor situation until resolved
7. File detailed incident report`,
    },
    MEDIUM: {
      title: "Standard Incident Response",
      steps: `1. Log the incident in the system
2. Notify relevant maintenance team
3. Assess impact on operations
4. Implement workaround if available
5. Schedule repair/resolution
6. Monitor for escalation
7. Complete incident documentation`,
    },
    LOW: {
      title: "Routine Issue Response",
      steps: `1. Document the issue
2. Add to maintenance queue
3. Schedule routine inspection
4. Monitor for any changes
5. Complete standard report`,
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
