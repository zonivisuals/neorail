import argparse
import logging
import os
import sys
from pathlib import Path
from typing import List

import pandas as pd
import random
import google.generativeai as genai
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

# Constants
DEFAULT_COLLECTION = "rail_incidents"
EXPECTED_VECTOR_SIZE = 768  # Gemini text-embedding-004 dimensions
GEMINI_EMBEDDING_MODEL = "models/text-embedding-004"

# Configure logging
LOG_LEVEL = os.environ.get("INGEST_LOG_LEVEL", "INFO").upper()

logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def load_data(csv_path: Path, limit: int | None = 500) -> pd.DataFrame:
    # Try several strategies to resolve the CSV path so the script works regardless of cwd
    tried_paths: list[str] = []

    # Candidate locations
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

    # As a last resort search the script directory recursively
    if not found:
        search_root = Path(__file__).parent
        matches = list(search_root.rglob(csv_path.name))
        if matches:
            found = matches[0]
            tried_paths.append(str(found.resolve()))
            logger.debug("Found CSV via recursive search: %s", found)

    if not found:
        logger.error(
            "CSV file not found. Tried paths: %s | cwd=%s | script_dir=%s",
            tried_paths,
            Path.cwd(),
            Path(__file__).parent,
        )
        raise FileNotFoundError(
            "CSV file not found. Tried paths: {}. Use --csv to specify an explicit path.".format(tried_paths)
        )

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

    # Drop rows without useful text
    df = df[df["Full_Description"].str.strip().astype(bool)].copy()
    logger.info("Rows with non-empty descriptions: %d", len(df))

    if limit:
        df = df.head(limit).copy()
        logger.info("Trimmed to first %d rows for processing", len(df))

    return df[["Full_Description", "WEATHER", "ACCDMG"]]


def init_vector_store(path: Path) -> QdrantClient:
    try:
        client = QdrantClient(path=str(path))
        logger.info("Initialized Qdrant client with path: %s", path)
        return client
    except Exception as exc:
        logger.exception("Failed to initialize Qdrant client: %s", exc)
        raise


def create_collection_safe(client: QdrantClient, collection_name: str) -> None:
    try:
        client.recreate_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=EXPECTED_VECTOR_SIZE, distance=Distance.COSINE),
        )
        logger.info("Collection '%s' (re)created", collection_name)
    except Exception as exc:
        logger.exception("Failed to create collection '%s': %s", collection_name, exc)
        raise


def generate_embedding(text: str) -> List[float]:
    """Generate embedding using Gemini text-embedding-004"""
    try:
        result = genai.embed_content(
            model=GEMINI_EMBEDDING_MODEL,
            content=text,
            task_type="retrieval_document",
        )
        return result['embedding']
    except Exception as exc:
        logger.error("Failed to generate embedding: %s", exc)
        raise


def select_strategy(description: str, damage: float, strategies: List[dict]) -> dict:
    """
    Select resolution strategy based on incident content analysis.
    Uses heuristic rules - NOT random selection.
    """
    full_text = description.upper()
    
    # Heuristic-based selection
    if damage > 100000:
        return strategies[3]  # BUS_BRIDGE
    elif "DERAILED" in full_text or "DERAIL" in full_text:
        return strategies[2]  # SINGLE_LINE_WORKING
    elif "SWITCH" in full_text or "TURNOUT" in full_text:
        return strategies[0]  # REVERSE_MANEUVER
    elif "COLLISION" in full_text or "STRUCK" in full_text:
        return strategies[2]  # SINGLE_LINE_WORKING
    elif "SIGNAL" in full_text or "CROSSING" in full_text:
        return strategies[1]  # REROUTE_FAST_TRACK
    elif "OBSTRUCTION" in full_text or "DEBRIS" in full_text or "OBJECT" in full_text:
        return strategies[2] if damage > 50000 else strategies[1]
    elif "FIRE" in full_text or "SMOKE" in full_text:
        return strategies[3]  # BUS_BRIDGE
    elif "WEATHER" in full_text or "FLOOD" in full_text or "SNOW" in full_text:
        return strategies[1]  # REROUTE_FAST_TRACK
    elif "MECHANICAL" in full_text or "BRAKE" in full_text or "ENGINE" in full_text:
        return strategies[0]  # REVERSE_MANEUVER
    elif "TRESPASS" in full_text or "PERSON" in full_text or "PEDESTRIAN" in full_text:
        return strategies[2]  # SINGLE_LINE_WORKING
    else:
        # Default based on damage level
        if damage > 50000:
            return strategies[2]
        elif damage > 10000:
            return strategies[1]
        else:
            return strategies[0]


def build_points(df: pd.DataFrame, strategies: List[dict]) -> List[PointStruct]:
    points: List[PointStruct] = []

    for idx, row in df.iterrows():
        try:
            text_to_embed = f"{row['Full_Description']} | Weather: {row['WEATHER']}"
            vector = generate_embedding(text_to_embed)

            if len(vector) != EXPECTED_VECTOR_SIZE:
                logger.error("Unexpected vector size %d for row %s", len(vector), idx)
                raise ValueError(f"Unexpected vector size: {len(vector)}")

            # Gemini already returns a list, no need for tolist()

            accdmg = row['ACCDMG']
            try:
                accdmg_val = float(accdmg)
            except Exception:
                logger.debug("Non-numeric ACCDMG '%s' for index %s; defaulting to 0", accdmg, idx)
                accdmg_val = 0.0

            # Use heuristic-based selection instead of random
            strat = select_strategy(row['Full_Description'], accdmg_val, strategies)

            pts = PointStruct(
                id=int(idx),
                vector=vector,
                payload={
                    "original_log": row['Full_Description'],
                    "weather": row['WEATHER'],
                    "resolution_action": strat['action'],
                    "resolution_detail": strat['desc'],
                    "statistics": {
                        "avg_delay_mins": strat['delay'],
                        "times_used": random.randint(1, 50),
                    },
                },
            )
            points.append(pts)

        except Exception:
            logger.exception("Failed to build point for index %s; skipping", idx)
            continue

    logger.info("Constructed %d points", len(points))
    return points


def upsert_in_batches(client: QdrantClient, collection_name: str, points: List[PointStruct], batch_size: int = 100) -> None:
    total = len(points)
    if total == 0:
        logger.warning("No points to upsert")
        return

    for i in range(0, total, batch_size):
        batch = points[i : i + batch_size]
        try:
            client.upsert(collection_name=collection_name, points=batch)
            logger.info("Upserted batch %d-%d (%d points)", i + 1, min(i + batch_size, total), len(batch))
        except Exception:
            logger.exception("Failed to upsert batch %d-%d; stopping", i + 1, min(i + batch_size, total))
            raise

    logger.info("Successfully upserted %d points into '%s'", total, collection_name)


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Ingest rail incident data into a local Qdrant DB")
    parser.add_argument("--csv", type=Path, default=Path("RailIncidentData.csv"), help="Path to CSV file")
    parser.add_argument("--db-path", type=Path, default=Path("./qdrant_db"), help="Local Qdrant DB path")
    parser.add_argument("--collection", type=str, default=DEFAULT_COLLECTION, help="Collection name")
    parser.add_argument("--limit", type=int, default=500, help="Limit number of rows to ingest")
    parser.add_argument("--batch-size", type=int, default=100, help="Upsert batch size")

    args = parser.parse_args(argv)

    # Prefer files next to the script for defaults so repo consumers get consistent behavior
    script_dir = Path(__file__).parent.resolve()

    # If user didn't pass an absolute path for the default CSV name, prefer script dir copy
    if not args.csv.is_absolute() and args.csv.name == "RailIncidentData.csv":
        candidate = script_dir / args.csv.name
        if candidate.exists():
            args.csv = candidate
            logger.info("Using CSV from script directory: %s", args.csv)
        else:
            logger.debug("CSV not found in script directory; will try other locations. script_dir=%s", script_dir)

    # Normalize DB path to be inside the script dir when it's the relative default
    if not args.db_path.is_absolute() and args.db_path == Path("./qdrant_db"):
        args.db_path = script_dir / args.db_path
        logger.info("Using DB path in script directory: %s", args.db_path)

    try:
        df = load_data(args.csv, limit=args.limit)

        # Initialize Gemini API
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            logger.error("GEMINI_API_KEY environment variable is required")
            raise ValueError("GEMINI_API_KEY not set. Export it before running: export GEMINI_API_KEY='your-key'")
        
        genai.configure(api_key=api_key)
        logger.info("Configured Gemini API with model: %s", GEMINI_EMBEDDING_MODEL)

        client = init_vector_store(args.db_path)
        create_collection_safe(client, args.collection)

        strategies = [
            {"action": "REVERSE_MANEUVER", "desc": "Initiated retrograde movement to nearest switch.", "delay": 45},
            {"action": "REROUTE_FAST_TRACK", "desc": "Diverted following traffic to High-Speed Line B.", "delay": 10},
            {"action": "SINGLE_LINE_WORKING", "desc": "Established bidirectional flow on remaining open track.", "delay": 25},
            {"action": "BUS_BRIDGE", "desc": "Track impassable. Deployed emergency bus fleet.", "delay": 120},
        ]

        points = build_points(df, strategies)
        upsert_in_batches(client, args.collection, points, batch_size=args.batch_size)

        logger.info("✅ Database Initialized Locally!")
        return 0

    except Exception as exc:
        logger.exception("Ingestion failed: %s", exc)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())