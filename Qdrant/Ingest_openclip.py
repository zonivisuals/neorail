"""
Ingest rail incident data using OpenCLIP embeddings.

This script:
1. Loads rail incident CSV data
2. Generates embeddings using OpenCLIP (local, no API limits)
3. Stores vectors in Qdrant for semantic search

Usage:
    python Ingest_openclip.py --csv data.csv --limit 500
"""

import argparse
import logging
import os
import sys
from pathlib import Path
from typing import List

import pandas as pd
import random
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

from openclip_embeddings import embed_texts, get_embedding_dimension

# Constants
DEFAULT_COLLECTION = "rail_incidents"

# Configure logging
LOG_LEVEL = os.environ.get("INGEST_LOG_LEVEL", "INFO").upper()

logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def load_data(csv_path: Path, limit: int | None = 500) -> pd.DataFrame:
    """Load and preprocess CSV data"""
    tried_paths: list[str] = []

    candidates = [
        csv_path,
        Path.cwd() / csv_path,
        Path(__file__).parent / csv_path,
    ]

    found: Path | None = None
    for p in candidates:
        tried_paths.append(str(p.resolve()))
        if p.exists():
            found = p
            logger.debug("Found CSV at candidate path: %s", p)
            break

    if not found:
        search_root = Path(__file__).parent
        matches = list(search_root.rglob(csv_path.name))
        if matches:
            found = matches[0]
            tried_paths.append(str(found.resolve()))
            logger.debug("Found CSV via recursive search: %s", found)

    if not found:
        logger.error("CSV file not found. Tried paths: %s", tried_paths)
        raise FileNotFoundError(f"CSV file not found. Tried paths: {tried_paths}")

    csv_path = found

    try:
        df = pd.read_csv(csv_path, on_bad_lines="skip", low_memory=False, encoding="latin1")
        logger.info("Loaded CSV '%s' with %d rows", csv_path, len(df))
    except Exception as exc:
        logger.exception("Failed to read CSV: %s", exc)
        raise

    narrative_cols = [c for c in df.columns if "NARR" in c]
    if not narrative_cols:
        logger.error("No narrative columns (NARR*) found in CSV columns: %s", list(df.columns))
        raise ValueError("No narrative columns found")

    for c in ["WEATHER", "ACCDMG"]:
        if c not in df.columns:
            logger.error("Required column '%s' not found in CSV", c)
            raise ValueError(f"Required column '{c}' not found")

    df["Full_Description"] = df[narrative_cols].apply(lambda x: " ".join(x.dropna().astype(str)), axis=1)

    df = df[df["Full_Description"].str.strip().astype(bool)].copy()
    logger.info("Rows with non-empty descriptions: %d", len(df))

    if limit:
        df = df.head(limit).copy()
        logger.info("Trimmed to first %d rows for processing", len(df))

    return df[["Full_Description", "WEATHER", "ACCDMG"]]


def init_vector_store(path: Path) -> QdrantClient:
    """Initialize Qdrant client"""
    try:
        client = QdrantClient(path=str(path))
        logger.info("Initialized Qdrant client with path: %s", path)
        return client
    except Exception as exc:
        logger.exception("Failed to initialize Qdrant client: %s", exc)
        raise


def create_collection_safe(client: QdrantClient, collection_name: str, vector_size: int) -> None:
    """Create or recreate collection with specified vector size"""
    try:
        client.recreate_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
        )
        logger.info("Collection '%s' created with vector size %d", collection_name, vector_size)
    except Exception as exc:
        logger.exception("Failed to create collection '%s': %s", collection_name, exc)
        raise


def generate_resolution(description: str, weather: str, damage: float) -> dict:
    """
    Generate resolution data based on incident content analysis.
    Uses heuristic rules matching the notebook approach - NOT random.
    """
    strategies = [
        {
            "action": "REVERSE_MANEUVER",
            "desc": "Initiated retrograde movement to nearest switch.",
            "base_delay": 45
        },
        {
            "action": "REROUTE_FAST_TRACK",
            "desc": "Diverted following traffic to High-Speed Line B.",
            "base_delay": 10
        },
        {
            "action": "SINGLE_LINE_WORKING",
            "desc": "Established bidirectional flow on remaining open track.",
            "base_delay": 25
        },
        {
            "action": "BUS_BRIDGE",
            "desc": "Track impassable. Deployed emergency bus fleet.",
            "base_delay": 120
        }
    ]
    
    full_text = description.upper()
    
    # Heuristic-based selection (same logic as notebook)
    if damage > 100000:
        # Severe damage = bus bridge required
        sol = strategies[3]
    elif "DERAILED" in full_text or "DERAIL" in full_text:
        # Derailment = single line working
        sol = strategies[2]
    elif "SWITCH" in full_text or "TURNOUT" in full_text:
        # Switch-related = reverse maneuver
        sol = strategies[0]
    elif "COLLISION" in full_text or "STRUCK" in full_text:
        # Collision = depends on severity, use single line
        sol = strategies[2]
    elif "SIGNAL" in full_text or "CROSSING" in full_text:
        # Signal/crossing issue = reroute
        sol = strategies[1]
    elif "OBSTRUCTION" in full_text or "DEBRIS" in full_text or "OBJECT" in full_text:
        # Track obstruction = single line or reroute
        sol = strategies[2] if damage > 50000 else strategies[1]
    elif "FIRE" in full_text or "SMOKE" in full_text:
        # Fire = bus bridge
        sol = strategies[3]
    elif "WEATHER" in full_text or "FLOOD" in full_text or "SNOW" in full_text:
        # Weather-related = reduce speed, reroute
        sol = strategies[1]
    elif "MECHANICAL" in full_text or "BRAKE" in full_text or "ENGINE" in full_text:
        # Mechanical failure = reverse maneuver
        sol = strategies[0]
    elif "TRESPASS" in full_text or "PERSON" in full_text or "PEDESTRIAN" in full_text:
        # Person on track = stop and investigate
        sol = strategies[2]
    else:
        # Default: choose based on damage level
        if damage > 50000:
            sol = strategies[2]  # Single line working
        elif damage > 10000:
            sol = strategies[1]  # Reroute
        else:
            sol = strategies[0]  # Reverse maneuver
    
    return {
        "resolution_action": sol["action"],
        "resolution_detail": sol["desc"],
        "statistics": {
            "avg_delay_mins": sol["base_delay"],
            "times_used": random.randint(1, 50),
        }
    }


def ingest_with_openclip(
    df: pd.DataFrame,
    client: QdrantClient,
    collection_name: str,
    batch_size: int = 32
) -> int:
    """
    Ingest data using OpenCLIP embeddings (batched for efficiency).
    """
    texts = df["Full_Description"].tolist()
    logger.info("Generating OpenCLIP embeddings for %d texts...", len(texts))
    
    # Generate all embeddings in batches
    embeddings = embed_texts(texts, batch_size=batch_size)
    logger.info("Generated %d embeddings", len(embeddings))
    
    # Create points
    points = []
    for idx, (row_idx, row) in enumerate(df.iterrows()):
        description = row["Full_Description"]
        weather = str(row["WEATHER"])
        damage = float(row["ACCDMG"]) if pd.notna(row["ACCDMG"]) else 0.0
        
        resolution = generate_resolution(description, weather, damage)
        
        payload = {
            "original_log": description[:500],
            "weather": weather,
            "damage_amount": damage,
            **resolution
        }
        
        points.append(PointStruct(
            id=idx,
            vector=embeddings[idx],
            payload=payload
        ))
    
    # Upload in batches
    upload_batch_size = 100
    for i in range(0, len(points), upload_batch_size):
        batch = points[i:i + upload_batch_size]
        client.upsert(collection_name=collection_name, points=batch)
        logger.info("Uploaded points %d-%d", i, min(i + upload_batch_size, len(points)))
    
    return len(points)


def main():
    parser = argparse.ArgumentParser(description="Ingest rail incident data with OpenCLIP embeddings")
    parser.add_argument("--csv", type=str, default="RailEquipment.csv", help="Path to CSV file")
    parser.add_argument("--limit", type=int, default=500, help="Max rows to process")
    parser.add_argument("--collection", type=str, default=DEFAULT_COLLECTION, help="Qdrant collection name")
    parser.add_argument("--db-path", type=str, default="qdrant_db", help="Qdrant database path")
    parser.add_argument("--batch-size", type=int, default=32, help="Embedding batch size")
    
    args = parser.parse_args()
    
    logger.info("=" * 60)
    logger.info("Rail Incident Ingestion with OpenCLIP")
    logger.info("=" * 60)
    
    # Get embedding dimension from OpenCLIP
    vector_size = get_embedding_dimension()
    logger.info("OpenCLIP embedding dimension: %d", vector_size)
    
    # Load data
    df = load_data(Path(args.csv), args.limit)
    
    # Initialize Qdrant
    db_path = Path(__file__).parent / args.db_path
    client = init_vector_store(db_path)
    
    # Create collection
    create_collection_safe(client, args.collection, vector_size)
    
    # Ingest with OpenCLIP
    count = ingest_with_openclip(df, client, args.collection, args.batch_size)
    
    logger.info("=" * 60)
    logger.info("SUCCESS: Ingested %d incidents with OpenCLIP embeddings", count)
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
