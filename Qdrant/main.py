from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer

app = FastAPI()

# Enable CORS for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Qdrant and Encoder once (Global)
client = QdrantClient(path="./qdrant_db")
encoder = SentenceTransformer('all-MiniLM-L6-v2')

@app.get("/find-solution")
async def find_solution(description: str = Query(..., description="The live incident report")):

    query_vector = encoder.encode(description).tolist()

    response = client.query_points(
        collection_name="rail_incidents",
        query=query_vector,
        limit=3
    )

    solutions = []
    for hit in response.points:
        solutions.append({
            "id": hit.id,
            "score": round(hit.score, 3),
            "action": hit.payload["resolution_action"],
            "detail": hit.payload["resolution_detail"],
            "avg_delay": hit.payload["statistics"]["avg_delay_mins"],
            "times_used": hit.payload["statistics"]["times_used"]
        })

    return {"results": solutions}

# Run with: uvicorn main:app --reload