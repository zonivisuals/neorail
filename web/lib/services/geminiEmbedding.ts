/**
 * Gemini Multimodal Embedding Service
 * 
 * Generates unified embeddings for text + images using Google Gemini API.
 * Used for vector similarity search in the RAG pipeline.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

// Gemini embedding model configuration
const EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_DIMENSIONS = 768;

// Initialize Gemini client
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE") {
    throw new Error(
      "Missing GEMINI_API_KEY environment variable. " +
      "Get your API key from: https://aistudio.google.com/apikey"
    );
  }
  
  return new GoogleGenerativeAI(apiKey);
}

export type EmbeddingResult = {
  success: true;
  embedding: number[];
  model: string;
  dimensions: number;
} | {
  success: false;
  error: string;
};

/**
 * Generate text embedding using Gemini
 * 
 * @param text - The text to embed
 * @returns Embedding vector (768 dimensions)
 */
export async function generateTextEmbedding(
  text: string
): Promise<EmbeddingResult> {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    
    const result = await model.embedContent(text);
    const embedding = result.embedding.values;
    
    if (!embedding || embedding.length === 0) {
      return {
        success: false,
        error: "Empty embedding returned from Gemini",
      };
    }
    
    console.log(`[Gemini] Generated text embedding: ${embedding.length} dimensions`);
    
    return {
      success: true,
      embedding,
      model: EMBEDDING_MODEL,
      dimensions: embedding.length,
    };
  } catch (error) {
    console.error("[Gemini] Text embedding error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown embedding error",
    };
  }
}

/**
 * Generate multimodal embedding using Gemini
 * 
 * For multimodal content (text + images), we create a rich text description
 * that includes image analysis, then embed the combined text.
 * 
 * @param text - The text content
 * @param imageUrls - Array of public image URLs
 * @returns Embedding vector (768 dimensions)
 */
export async function generateMultimodalEmbedding(
  text: string,
  imageUrls: string[]
): Promise<EmbeddingResult> {
  try {
    const genAI = getGeminiClient();
    
    // If no images, use text-only embedding
    if (!imageUrls || imageUrls.length === 0) {
      console.log("[Gemini] No images provided, using text-only embedding");
      return generateTextEmbedding(text);
    }
    
    // Use Gemini 2.0 Flash to analyze images and create enriched text
    const visionModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    // Fetch images and convert to base64
    const imageParts = await Promise.all(
      imageUrls.slice(0, 3).map(async (url) => { // Limit to 3 images
        try {
          const response = await fetch(url);
          if (!response.ok) {
            console.warn(`[Gemini] Failed to fetch image: ${url}`);
            return null;
          }
          const arrayBuffer = await response.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          const mimeType = response.headers.get("content-type") || "image/jpeg";
          
          return {
            inlineData: {
              data: base64,
              mimeType,
            },
          };
        } catch (error) {
          console.warn(`[Gemini] Error fetching image ${url}:`, error);
          return null;
        }
      })
    );
    
    // Filter out failed image fetches
    const validImageParts = imageParts.filter((part): part is NonNullable<typeof part> => part !== null);
    
    if (validImageParts.length === 0) {
      console.log("[Gemini] No valid images, falling back to text-only embedding");
      return generateTextEmbedding(text);
    }
    
    // Analyze images with Gemini Vision
    const analysisPrompt = `Analyze these images from a rail incident report. Describe what you see in detail, focusing on:
- Type of incident (derailment, obstruction, damage, weather-related, etc.)
- Visible damage or hazards
- Environmental conditions
- Any equipment or infrastructure visible
- Severity indicators

Be concise but thorough. This description will be used for similarity search.

Original report text: "${text}"`;

    const visionResult = await visionModel.generateContent([
      analysisPrompt,
      ...validImageParts,
    ]);
    
    const imageAnalysis = visionResult.response.text();
    console.log("[Gemini] Image analysis complete:", imageAnalysis.substring(0, 200) + "...");
    
    // Combine original text with image analysis for embedding
    const enrichedText = `${text}\n\nImage Analysis: ${imageAnalysis}`;
    
    // Generate embedding from enriched text
    const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const embeddingResult = await embeddingModel.embedContent(enrichedText);
    const embedding = embeddingResult.embedding.values;
    
    if (!embedding || embedding.length === 0) {
      return {
        success: false,
        error: "Empty embedding returned from Gemini",
      };
    }
    
    console.log(`[Gemini] Generated multimodal embedding: ${embedding.length} dimensions`);
    
    return {
      success: true,
      embedding,
      model: `${EMBEDDING_MODEL}+gemini-1.5-flash`,
      dimensions: embedding.length,
    };
  } catch (error) {
    console.error("[Gemini] Multimodal embedding error:", error);
    
    // Fallback to text-only embedding
    console.log("[Gemini] Falling back to text-only embedding");
    return generateTextEmbedding(text);
  }
}

/**
 * Get the expected embedding dimensions
 */
export function getEmbeddingDimensions(): number {
  return EMBEDDING_DIMENSIONS;
}
