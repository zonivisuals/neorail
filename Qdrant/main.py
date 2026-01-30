from fastapi import FastAPI, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
import os

# Embedding provider selection
EMBEDDING_PROVIDER = os.environ.get("EMBEDDING_PROVIDER", "openclip").lower()

app = FastAPI(
    title="Rail Incident Vector Search API",
    description="Semantic search for rail incident solutions using Qdrant + OpenCLIP/Gemini",
    version="3.0.0"
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

# Initialize embedding provider
if EMBEDDING_PROVIDER == "openclip":
    from openclip_embeddings import embed_text, embed_multimodal, get_embedding_dimension
    print(f"[main] Using OpenCLIP for embeddings (no rate limits!)")
    try:
        dim = get_embedding_dimension()
        print(f"[main] OpenCLIP embedding dimension: {dim}")
    except Exception as e:
        print(f"[main] OpenCLIP init deferred (will load on first request): {e}")
else:
    import google.generativeai as genai
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
    GEMINI_EMBEDDING_MODEL = "models/text-embedding-004"
    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
        print(f"[main] Using Gemini for embeddings: {GEMINI_EMBEDDING_MODEL}")
    else:
        print("[main] WARNING: GEMINI_API_KEY not set. Text search will fail.")

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
    image_urls: Optional[List[str]] = None  # Images from the original incident report


class SearchResponse(BaseModel):
    """Response containing list of solutions"""
    results: List[SolutionResult]


def format_hit(hit) -> dict:
    """Format a Qdrant hit into a solution result"""
    # Convert weather to string (CSV may have numeric weather codes)
    weather_val = hit.payload.get("weather")
    weather_str = str(weather_val) if weather_val is not None else None
    
    # Get image URLs if they exist in payload
    image_urls = hit.payload.get("image_urls")
    
    return {
        "id": hit.id,
        "score": round(hit.score, 3),
        "action": hit.payload.get("resolution_action", "Unknown"),
        "detail": hit.payload.get("resolution_detail", "No details available"),
        "avg_delay": hit.payload.get("statistics", {}).get("avg_delay_mins", 0),
        "times_used": hit.payload.get("statistics", {}).get("times_used", 0),
        "original_log": hit.payload.get("original_log"),
        "weather": weather_str,
        "image_urls": image_urls,
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
    Uses OpenCLIP (local) or Gemini (API) for embedding generation.
    """
    try:
        # Generate embedding based on provider
        if EMBEDDING_PROVIDER == "openclip":
            query_vector = embed_text(description)
            print(f"[find-solution] OpenCLIP embedding: {len(query_vector)} dimensions")
        else:
            if not GEMINI_API_KEY:
                print("[find-solution] ERROR: GEMINI_API_KEY not configured")
                return {"results": []}
            
            result = genai.embed_content(
                model=GEMINI_EMBEDDING_MODEL,
                content=description,
                task_type="retrieval_query",
            )
            query_vector = result['embedding']
            print(f"[find-solution] Gemini embedding: {len(query_vector)} dimensions")

        response = client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            limit=3
        )

        solutions = [format_hit(hit) for hit in response.points]
        print(f"[find-solution] Found {len(solutions)} results")
        return {"results": solutions}
    
    except Exception as e:
        print(f"[find-solution] Error: {e}")
        return {"results": []}


@app.post("/search-by-embedding", response_model=SearchResponse)
async def search_by_embedding(request: EmbeddingSearchRequest):
    """
    Search for similar incidents using pre-computed embedding vector.
    Expects Gemini embeddings (768 dimensions).
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


class MultimodalSearchRequest(BaseModel):
    """Request for multimodal (text + images) search"""
    text: str
    image_urls: Optional[List[str]] = None
    text_weight: float = 0.6  # Weight for text (images get 1 - text_weight)
    limit: int = 3


class MultimodalSearchResponse(BaseModel):
    """Response containing results and embedding metadata"""
    results: List[SolutionResult]
    embedding_info: dict


@app.post("/search-multimodal", response_model=MultimodalSearchResponse)
async def search_multimodal(request: MultimodalSearchRequest):
    """
    Search using text and optional images (OpenCLIP only).
    
    Uses weighted fusion to combine text and image embeddings:
    - Text weight (default 0.6): prioritized since KB is text-only
    - Image weight (1 - text_weight): adds visual context
    
    The fused embedding searches the same vector space as text-only queries.
    """
    if EMBEDDING_PROVIDER != "openclip":
        print("[search-multimodal] This endpoint requires OpenCLIP")
        return {
            "results": [],
            "embedding_info": {"error": "OpenCLIP required for multimodal search"}
        }
    
    try:
        # Count how many images we'll actually process
        image_count = len(request.image_urls) if request.image_urls else 0
        images_to_process = min(image_count, 3)  # Cap at 3
        
        print(f"[search-multimodal] Text: {request.text[:50]}...")
        print(f"[search-multimodal] Images: {images_to_process} of {image_count}")
        print(f"[search-multimodal] Weights: text={request.text_weight}, images={1-request.text_weight}")
        
        # Generate combined embedding with weighted fusion
        query_vector = embed_multimodal(
            text=request.text,
            image_urls=request.image_urls,
            text_weight=request.text_weight
        )
        print(f"[search-multimodal] Generated multimodal embedding: {len(query_vector)} dims")
        
        response = client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            limit=request.limit
        )
        
        solutions = [format_hit(hit) for hit in response.points]
        print(f"[search-multimodal] Found {len(solutions)} results")
        
        return {
            "results": solutions,
            "embedding_info": {
                "text_weight": request.text_weight,
                "image_weight": 1 - request.text_weight,
                "images_provided": image_count,
                "images_processed": images_to_process,
                "fusion_method": "weighted_average",
                "dimension": len(query_vector),
            }
        }
    
    except Exception as e:
        print(f"[search-multimodal] Error: {e}")
        return {
            "results": [],
            "embedding_info": {"error": str(e)}
        }


class AddIncidentRequest(BaseModel):
    """Request to add a new resolved incident to the knowledge base"""
    description: str
    resolution_action: str
    resolution_detail: str
    image_urls: Optional[List[str]] = None
    weather: Optional[str] = None
    delay_mins: int = 0
    location: Optional[str] = None
    report_id: Optional[str] = None  # Reference to original report in Postgres


class AddIncidentResponse(BaseModel):
    """Response after adding incident"""
    success: bool
    point_id: int
    message: str
    embedding_info: Optional[dict] = None


@app.post("/add-incident", response_model=AddIncidentResponse)
async def add_incident(request: AddIncidentRequest):
    """
    Add a new resolved incident to the knowledge base.
    
    Called after a conductor acknowledges a solution, allowing the system
    to learn from new incidents for future recommendations.
    
    Uses multimodal embedding if images are provided.
    """
    if EMBEDDING_PROVIDER != "openclip":
        return AddIncidentResponse(
            success=False,
            point_id=-1,
            message="OpenCLIP required for adding incidents"
        )
    
    try:
        # Get the next available ID
        collection_info = client.get_collection(COLLECTION_NAME)
        next_id = collection_info.points_count
        
        # Generate embedding (multimodal if images provided)
        image_count = len(request.image_urls) if request.image_urls else 0
        
        if image_count > 0:
            print(f"[add-incident] Generating multimodal embedding with {image_count} images")
            embedding = embed_multimodal(
                text=request.description,
                image_urls=request.image_urls,
                text_weight=0.6
            )
            embedding_type = "multimodal"
        else:
            print(f"[add-incident] Generating text-only embedding")
            embedding = embed_text(request.description)
            embedding_type = "text_only"
        
        # Build payload with all incident data
        payload = {
            "original_log": request.description[:500],
            "resolution_action": request.resolution_action,
            "resolution_detail": request.resolution_detail,
            "weather": request.weather,
            "location": request.location,
            "image_urls": request.image_urls or [],  # Store image URLs for context
            "report_id": request.report_id,  # Link back to original report
            "statistics": {
                "avg_delay_mins": request.delay_mins,
                "times_used": 1,  # First use
            },
            "source": "conductor_report",  # Mark as user-submitted vs CSV import
        }
        
        # Create and upsert the point
        point = PointStruct(
            id=next_id,
            vector=embedding,
            payload=payload
        )
        
        client.upsert(collection_name=COLLECTION_NAME, points=[point])
        
        print(f"[add-incident] Added incident {next_id} with {embedding_type} embedding")
        
        return AddIncidentResponse(
            success=True,
            point_id=next_id,
            message=f"Incident added successfully with {embedding_type} embedding",
            embedding_info={
                "type": embedding_type,
                "images_included": image_count,
                "dimension": len(embedding),
            }
        )
    
    except Exception as e:
        print(f"[add-incident] Error: {e}")
        return AddIncidentResponse(
            success=False,
            point_id=-1,
            message=f"Failed to add incident: {str(e)}"
        )


@app.get("/embedding-info")
async def embedding_info():
    """Get information about the current embedding provider"""
    info = {
        "provider": EMBEDDING_PROVIDER,
        "supports_multimodal": EMBEDDING_PROVIDER == "openclip",
    }
    
    if EMBEDDING_PROVIDER == "openclip":
        try:
            info["dimension"] = get_embedding_dimension()
            info["status"] = "ready"
        except Exception as e:
            info["status"] = f"loading: {e}"
    else:
        info["dimension"] = 768
        info["status"] = "ready" if GEMINI_API_KEY else "missing_api_key"
    
    return info


# Run with: uvicorn main:app --reload --port 8000