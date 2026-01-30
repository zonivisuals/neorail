/**
 * Vector Search Service
 * 
 * Connects to the Qdrant FastAPI service to perform similarity search
 * on rail incident embeddings.
 */

export type SimilarIncident = {
  id: number;
  score: number;
  action: string;
  detail: string;
  avgDelay: number;
  timesUsed: number;
  originalLog?: string;
  weather?: string;
};

export type VectorSearchResult = {
  success: true;
  results: SimilarIncident[];
} | {
  success: false;
  error: string;
};

/**
 * Get the Qdrant service URL from environment
 */
function getQdrantServiceUrl(): string {
  const url = process.env.QDRANT_SERVICE_URL;
  
  if (!url) {
    // Default to localhost for development
    return "http://localhost:8000";
  }
  
  return url;
}

/**
 * Search for similar incidents using text description
 * 
 * @param description - The incident description text
 * @param limit - Maximum number of results to return
 * @returns Array of similar incidents with scores
 */
export async function searchSimilarIncidents(
  description: string,
  limit: number = 3
): Promise<VectorSearchResult> {
  try {
    const baseUrl = getQdrantServiceUrl();
    const url = new URL("/find-solution", baseUrl);
    url.searchParams.set("description", description);
    
    console.log(`[VectorSearch] Querying: ${url.toString()}`);
    
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[VectorSearch] API error:", response.status, errorText);
      return {
        success: false,
        error: `Qdrant service error: ${response.status}`,
      };
    }
    
    const data = await response.json();
    
    const results: SimilarIncident[] = data.results.map((hit: {
      id: number;
      score: number;
      action: string;
      detail: string;
      avg_delay: number;
      times_used: number;
      original_log?: string;
      weather?: string;
    }) => ({
      id: hit.id,
      score: hit.score,
      action: hit.action,
      detail: hit.detail,
      avgDelay: hit.avg_delay,
      timesUsed: hit.times_used,
      originalLog: hit.original_log,
      weather: hit.weather,
    }));
    
    console.log(`[VectorSearch] Found ${results.length} similar incidents`);
    
    return {
      success: true,
      results: results.slice(0, limit),
    };
  } catch (error) {
    console.error("[VectorSearch] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Vector search failed",
    };
  }
}

/**
 * Search for similar incidents using pre-computed embedding vector
 * 
 * @param embedding - The embedding vector (768 dimensions for Gemini)
 * @param limit - Maximum number of results to return
 * @returns Array of similar incidents with scores
 */
export async function searchByEmbedding(
  embedding: number[],
  limit: number = 3
): Promise<VectorSearchResult> {
  try {
    const baseUrl = getQdrantServiceUrl();
    const url = new URL("/search-by-embedding", baseUrl);
    
    console.log(`[VectorSearch] Searching with embedding (${embedding.length} dims)`);
    
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        embedding,
        limit,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[VectorSearch] API error:", response.status, errorText);
      return {
        success: false,
        error: `Qdrant service error: ${response.status}`,
      };
    }
    
    const data = await response.json();
    
    const results: SimilarIncident[] = data.results.map((hit: {
      id: number;
      score: number;
      action: string;
      detail: string;
      avg_delay: number;
      times_used: number;
      original_log?: string;
      weather?: string;
    }) => ({
      id: hit.id,
      score: hit.score,
      action: hit.action,
      detail: hit.detail,
      avgDelay: hit.avg_delay,
      timesUsed: hit.times_used,
      originalLog: hit.original_log,
      weather: hit.weather,
    }));
    
    console.log(`[VectorSearch] Found ${results.length} similar incidents`);
    
    return {
      success: true,
      results: results.slice(0, limit),
    };
  } catch (error) {
    console.error("[VectorSearch] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Vector search failed",
    };
  }
}

/**
 * Search for similar incidents using multimodal input (text + images)
 * Requires OpenCLIP backend (EMBEDDING_PROVIDER=openclip)
 * 
 * @param text - The incident description text
 * @param imageUrls - Optional array of image URLs
 * @param limit - Maximum number of results to return
 * @returns Array of similar incidents with scores
 */
export async function searchMultimodal(
  text: string,
  imageUrls?: string[],
  limit: number = 3
): Promise<VectorSearchResult> {
  try {
    const baseUrl = getQdrantServiceUrl();
    const url = new URL("/search-multimodal", baseUrl);
    
    console.log(`[VectorSearch] Multimodal search with ${imageUrls?.length || 0} images`);
    
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        image_urls: imageUrls,
        limit,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[VectorSearch] Multimodal API error:", response.status, errorText);
      return {
        success: false,
        error: `Qdrant service error: ${response.status}`,
      };
    }
    
    const data = await response.json();
    
    const results: SimilarIncident[] = data.results.map((hit: {
      id: number;
      score: number;
      action: string;
      detail: string;
      avg_delay: number;
      times_used: number;
      original_log?: string;
      weather?: string;
    }) => ({
      id: hit.id,
      score: hit.score,
      action: hit.action,
      detail: hit.detail,
      avgDelay: hit.avg_delay,
      timesUsed: hit.times_used,
      originalLog: hit.original_log,
      weather: hit.weather,
    }));
    
    console.log(`[VectorSearch] Multimodal found ${results.length} similar incidents`);
    
    return {
      success: true,
      results: results.slice(0, limit),
    };
  } catch (error) {
    console.error("[VectorSearch] Multimodal error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Multimodal search failed",
    };
  }
}
