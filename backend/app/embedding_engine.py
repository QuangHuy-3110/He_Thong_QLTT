import os
import numpy as np

_transformer_model = None

def get_embedding(text: str) -> list:
    if not text or not text.strip():
        return [0.0] * 1536
        
    api_key = os.environ.get('OPENAI_API_KEY')
    if api_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key)
            response = client.embeddings.create(
                input=text,
                model='text-embedding-3-small'
            )
            return response.data[0].embedding
        except Exception as e:
            print(f'[Embedding Engine] OpenAI Embedding Error: {e}. Falling back to local model.')
            
    global _transformer_model
    try:
        if _transformer_model is None:
            from sentence_transformers import SentenceTransformer
            print('[Embedding Engine] Loading local sentence-transformer model (paraphrase-multilingual-MiniLM-L12-v2)...')
            _transformer_model = SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
            
        local_vector = _transformer_model.encode(text).tolist()
        padded_vector = local_vector + [0.0] * (1536 - len(local_vector))
        return padded_vector
    except Exception as e:
        print(f'[Embedding Engine] Local Embedding Error: {e}')
        return [0.0] * 1536
