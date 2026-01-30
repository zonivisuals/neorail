from fastapi import FastAPI, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer
import os

app = FastAPI(
    title="Rail Incident Vector Search API",
    description="Semantic search for rail incident solutions using Qdrant",
    version="2.0.0"
)

# Enable CORS for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Qdrant (path relative to script location)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(SCRIPT_DIR, "qdrant_db")
client = QdrantClient(path=DB_PATH)

# Initialize SentenceTransformer encoder for text-only fallback
encoder = SentenceTransformer('all-MiniLM-L6-v2')

# Collection name
COLLECTION_NAME = "rail_incidents"


class EmbeddingSearchRequest(BaseModel):
    """Request body for embedding-based search"""
    embedding: List[float]
    limit: int = 3


class SolutionResult(BaseModel):
    """Individual solution result"""
    id: int
    score: float
    action: str
    detail: str
    avg_delay: int
    times_used: int
    original_log: Optional[str] = None
    weather: Optional[str] = None


class SearchResponse(BaseModel):
    """Response containing list of solutions"""
    results: List[SolutionResult]


def format_hit(hit) -> dict:
    """Format a Qdrant hit into a solution result"""
    return {
        "id": hit.id,
        "score": round(hit.score, 3),
        "action": hit.payload.get("resolution_action", "Unknown"),
        "detail": hit.payload.get("resolution_detail", "No details available"),
        "avg_delay": hit.payload.get("statistics", {}).get("avg_delay_mins", 0),
        "times_used": hit.payload.get("statistics", {}).get("times_used", 0),
        "original_log": hit.payload.get("original_log"),
        "weather": hit.payload.get("weather"),
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        collections = client.get_collections()
        return {
            "status": "healthy",
            "collections": [c.name for c in collections.collections],
            "db_path": DB_PATH,
        }
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}


@app.get("/find-solution", response_model=SearchResponse)
async def find_solution(
    description: str = Query(..., description="The live incident report text")
):
    """
    Search for similar incidents using text description.
    Uses SentenceTransformer for local text embedding.
    """
    try:
        query_vector = encoder.encode(description).tolist()

        response = client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            limit=3
        )

        solutions = [format_hit(hit) for hit in response.points]
        return {"results": solutions}
    
    except Exception as e:
        print(f"[find-solution] Error: {e}")
        return {"results": []}


@app.post("/search-by-embedding", response_model=SearchResponse)
async def search_by_embedding(request: EmbeddingSearchRequest):
    """
    Search for similar incidents using pre-computed embedding vector.
    Supports Gemini embeddings (768 dimensions) or SentenceTransformer (384 dimensions).
    """
    try:
        print(f"[search-by-embedding] Received embedding with {len(request.embedding)} dimensions")
        
        # Validate embedding dimensions
        embedding_dim = len(request.embedding)
        
        # Get collection info to check vector size
        collection_info = client.get_collection(COLLECTION_NAME)
        expected_dim = collection_info.config.params.vectors.size
        
        if embedding_dim != expected_dim:
            print(f"[search-by-embedding] Dimension mismatch: got {embedding_dim}, expected {expected_dim}")
            # If dimensions don't match, fall back to empty results
            # In production, you'd want to handle this better
            return {"results": []}
        
        response = client.query_points(
            collection_name=COLLECTION_NAME,
            query=request.embedding,
            limit=request.limit
        )

        solutions = [format_hit(hit) for hit in response.points]
        print(f"[search-by-embedding] Found {len(solutions)} results")
        return {"results": solutions}
    
    except Exception as e:
        print(f"[search-by-embedding] Error: {e}")
        return {"results": []}


# Run with: uvicorn main:app --reload --port 8000