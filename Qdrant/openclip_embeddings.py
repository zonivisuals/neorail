"""
OpenCLIP Embedding Service

Provides local multimodal embeddings for text and images using OpenCLIP.
No API rate limits - runs entirely locally on CPU/GPU.

Models available:
- ViT-B-32: 512 dimensions, fast (recommended for development)
- ViT-L-14: 768 dimensions, better quality
- ViT-H-14: 1024 dimensions, best quality (requires more RAM)
"""

import os
import logging
from typing import List, Optional, Union
from pathlib import Path
import requests
from io import BytesIO

# IMPORTANT: Force CPU mode BEFORE importing torch if OPENCLIP_DEVICE=cpu
# This prevents PyTorch from even trying to initialize CUDA
if os.environ.get("OPENCLIP_DEVICE", "").lower() == "cpu":
    os.environ["CUDA_VISIBLE_DEVICES"] = ""  # Hide all GPUs from PyTorch

import torch
import open_clip
from PIL import Image

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Model configuration - can be changed based on requirements
# ViT-L-14 gives 768 dimensions (same as Gemini text-embedding-004)
MODEL_NAME = "ViT-L-14"
PRETRAINED = "openai"  # or "laion2b_s32b_b82k" for LAION-trained

# Global model cache
_model = None
_preprocess = None
_tokenizer = None
_device = None


def get_device() -> str:
    """Determine the best available device"""
    # Check for environment override
    force_device = os.environ.get("OPENCLIP_DEVICE", "").lower()
    if force_device == "cpu":
        return "cpu"
    if force_device in ("cuda", "mps"):
        return force_device
    
    # Auto-detect, but verify CUDA compatibility
    if torch.cuda.is_available():
        try:
            # Test if CUDA actually works with a simple operation
            capability = torch.cuda.get_device_capability()
            # PyTorch typically requires compute capability >= 7.0
            if capability[0] >= 7:
                return "cuda"
            else:
                logger.warning(f"GPU compute capability {capability} is too low. Using CPU.")
                return "cpu"
        except Exception as e:
            logger.warning(f"CUDA check failed: {e}. Using CPU.")
            return "cpu"
    elif torch.backends.mps.is_available():
        return "mps"  # Apple Silicon
    return "cpu"


def load_model():
    """Load OpenCLIP model (cached globally)"""
    global _model, _preprocess, _tokenizer, _device
    
    if _model is not None:
        return _model, _preprocess, _tokenizer
    
    _device = get_device()
    logger.info(f"Loading OpenCLIP model {MODEL_NAME} on {_device}...")
    
    _model, _, _preprocess = open_clip.create_model_and_transforms(
        MODEL_NAME,
        pretrained=PRETRAINED,
        device=_device
    )
    _tokenizer = open_clip.get_tokenizer(MODEL_NAME)
    
    _model.eval()  # Set to evaluation mode
    
    logger.info(f"OpenCLIP model loaded. Embedding dimension: {_model.visual.output_dim}")
    
    return _model, _preprocess, _tokenizer


def embed_text(text: str) -> List[float]:
    """
    Generate embedding for text.
    
    Args:
        text: Input text to embed
        
    Returns:
        List of floats representing the embedding vector
    """
    model, _, tokenizer = load_model()
    
    with torch.no_grad():
        tokens = tokenizer([text]).to(_device)
        text_features = model.encode_text(tokens)
        # Normalize for cosine similarity
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)
        
    return text_features[0].cpu().numpy().tolist()


def embed_texts(texts: List[str], batch_size: int = 32) -> List[List[float]]:
    """
    Generate embeddings for multiple texts (batched for efficiency).
    
    Args:
        texts: List of texts to embed
        batch_size: Number of texts to process at once
        
    Returns:
        List of embedding vectors
    """
    model, _, tokenizer = load_model()
    all_embeddings = []
    
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        
        with torch.no_grad():
            tokens = tokenizer(batch).to(_device)
            text_features = model.encode_text(tokens)
            text_features = text_features / text_features.norm(dim=-1, keepdim=True)
            
        all_embeddings.extend(text_features.cpu().numpy().tolist())
        
        if (i + batch_size) % 100 == 0:
            logger.info(f"Processed {min(i + batch_size, len(texts))}/{len(texts)} texts")
    
    return all_embeddings


def embed_image_from_url(url: str) -> Optional[List[float]]:
    """
    Generate embedding for an image from URL.
    
    Args:
        url: Public URL of the image
        
    Returns:
        Embedding vector or None if failed
    """
    model, preprocess, _ = load_model()
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        image = Image.open(BytesIO(response.content)).convert("RGB")
        
        with torch.no_grad():
            image_tensor = preprocess(image).unsqueeze(0).to(_device)
            image_features = model.encode_image(image_tensor)
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            
        return image_features[0].cpu().numpy().tolist()
        
    except Exception as e:
        logger.error(f"Failed to embed image from {url}: {e}")
        return None


def embed_image_from_path(path: Union[str, Path]) -> Optional[List[float]]:
    """
    Generate embedding for a local image file.
    
    Args:
        path: Path to the image file
        
    Returns:
        Embedding vector or None if failed
    """
    model, preprocess, _ = load_model()
    
    try:
        image = Image.open(path).convert("RGB")
        
        with torch.no_grad():
            image_tensor = preprocess(image).unsqueeze(0).to(_device)
            image_features = model.encode_image(image_tensor)
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            
        return image_features[0].cpu().numpy().tolist()
        
    except Exception as e:
        logger.error(f"Failed to embed image from {path}: {e}")
        return None


def embed_multimodal(
    text: str, 
    image_urls: Optional[List[str]] = None,
    text_weight: float = 0.6
) -> List[float]:
    """
    Generate a combined embedding for text and images using weighted fusion.
    
    This creates a unified representation in the same embedding space by:
    1. Encoding the text (always included)
    2. Encoding each image and averaging them
    3. Combining with weighted fusion: (text_weight * text) + (image_weight * avg_images)
    
    Args:
        text: Text content (description, location, urgency, etc.)
        image_urls: Optional list of image URLs from the report
        text_weight: Weight for text embedding (0.0-1.0), images get (1 - text_weight)
                     Default 0.6 prioritizes text since KB is text-only
        
    Returns:
        Combined embedding vector (768 dimensions for ViT-L-14)
    """
    import numpy as np
    
    # Always get text embedding
    text_emb = np.array(embed_text(text))
    
    # If no images, return text-only embedding
    if not image_urls or len(image_urls) == 0:
        logger.info("[embed_multimodal] No images provided, using text-only embedding")
        return text_emb.tolist()
    
    # Encode images (limit to 3 to avoid long processing times)
    image_embeddings = []
    for url in image_urls[:3]:
        try:
            img_emb = embed_image_from_url(url)
            if img_emb:
                image_embeddings.append(np.array(img_emb))
                logger.info(f"[embed_multimodal] Encoded image: {url[:50]}...")
        except Exception as e:
            logger.warning(f"[embed_multimodal] Failed to encode image {url}: {e}")
    
    # If all images failed, return text-only
    if len(image_embeddings) == 0:
        logger.warning("[embed_multimodal] All image encodings failed, using text-only")
        return text_emb.tolist()
    
    # Average all image embeddings into one
    avg_image_emb = np.mean(image_embeddings, axis=0)
    
    # Weighted fusion: prioritize text since KB is text-only
    image_weight = 1.0 - text_weight
    fused = (text_weight * text_emb) + (image_weight * avg_image_emb)
    
    # Re-normalize for cosine similarity
    fused = fused / np.linalg.norm(fused)
    
    logger.info(f"[embed_multimodal] Fused {len(image_embeddings)} images with text "
                f"(weights: text={text_weight}, images={image_weight})")
    
    return fused.tolist()


def get_embedding_dimension() -> int:
    """Get the embedding dimension of the loaded model"""
    model, _, _ = load_model()
    return model.visual.output_dim


if __name__ == "__main__":
    # Test the embeddings
    print("Testing OpenCLIP embeddings...")
    
    # Test text embedding
    test_text = "Train derailment due to track obstruction near station"
    embedding = embed_text(test_text)
    print(f"Text embedding dimension: {len(embedding)}")
    
    # Test similarity
    similar_text = "Railway accident caused by debris on tracks"
    different_text = "The weather today is sunny and warm"
    
    emb1 = embed_text(test_text)
    emb2 = embed_text(similar_text)
    emb3 = embed_text(different_text)
    
    import numpy as np
    sim_12 = np.dot(emb1, emb2)
    sim_13 = np.dot(emb1, emb3)
    
    print(f"Similarity (train-railway): {sim_12:.3f}")
    print(f"Similarity (train-weather): {sim_13:.3f}")
    print("✓ OpenCLIP is working correctly!" if sim_12 > sim_13 else "✗ Something is wrong")
