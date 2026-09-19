"""Local CLIP embeddings and a durable SQLite vector store.

Images and search text use the same 512-dimensional space. Filenames and notes
are deliberately excluded: results are based on what is visible in the image.
"""
import threading
import numpy as np

MODEL_ID = 'openai/clip-vit-base-patch32'
_model = None
_processor = None
_lock = threading.Lock()


def load_model():
    global _model, _processor
    if _model is None:
        import torch
        from transformers import CLIPModel, CLIPProcessor
        torch.set_num_threads(4)
        # Download once into Hugging Face's local cache, then reuse on every run.
        _processor = CLIPProcessor.from_pretrained(MODEL_ID, use_fast=False)
        _model = CLIPModel.from_pretrained(MODEL_ID, use_safetensors=True).eval()
    return _model, _processor


def embed(value, image=False):
    import torch
    # Serialize model loading/inference to avoid duplicate model allocations.
    with _lock, torch.inference_mode():
        model, processor = load_model()
        if image:
            inputs = processor(images=value, return_tensors='pt')
            features = model.get_image_features(**inputs)
        else:
            inputs = processor(text=[value], return_tensors='pt', padding=True,
                               truncation=True, max_length=77)
            features = model.get_text_features(**inputs)
        vector = features[0].float().numpy()
        vector /= np.linalg.norm(vector)
        return vector.astype(np.float32).tobytes()
