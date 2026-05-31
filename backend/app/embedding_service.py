import hashlib
import json
import random
import urllib.request
import numpy as np
import threading

# Cache flag: None = chưa kiểm tra, True = Ollama sẵn sàng, False = không có
_ollama_available = None
_ollama_check_lock = threading.Lock()

def _check_ollama_once():
    """Kiểm tra Ollama chỉ 1 lần rồi cache kết quả, tránh timeout lặp lại mỗi chunk."""
    global _ollama_available
    if _ollama_available is not None:
        return _ollama_available
    with _ollama_check_lock:
        if _ollama_available is not None:
            return _ollama_available
        try:
            req = urllib.request.Request(
                "http://127.0.0.1:11434/api/tags",
                headers={"Content-Type": "application/json"},
                method="GET"
            )
            with urllib.request.urlopen(req, timeout=0.5):
                _ollama_available = True
                print("[Embedding] Ollama detected – will use nomic-embed-text.")
        except Exception:
            _ollama_available = False
            print("[Embedding] Ollama not available – using deterministic fallback.")
    return _ollama_available

def generate_deterministic_embedding(text, dimensions=1536):
    """
    Sinh một vector embedding 1536 chiều ổn định và độc lập offline bằng cách sử dụng hashing.
    Rất hữu ích khi chạy hoàn toàn offline không cần các thư viện transformer cồng kềnh.
    """
    if not text:
        return [0.0] * dimensions
    
    # Chuẩn hóa văn bản cơ bản
    text_clean = str(text).strip().lower()
    
    # Sử dụng seed dựa trên hash SHA-256 của văn bản để tạo số ngẫu nhiên lặp lại được
    hasher = hashlib.sha256(text_clean.encode('utf-8'))
    hash_bytes = hasher.digest()
    
    # Khởi tạo trạng thái ngẫu nhiên độc lập dựa trên hash
    seed = int.from_bytes(hash_bytes[:4], byteorder='big')
    rng = random.Random(seed)
    
    # Tạo vector 1536 chiều
    vector = [rng.gauss(0.0, 1.0) for _ in range(dimensions)]
    
    # Phân tích một số từ khóa đặc trưng trong văn bản để tạo cấu trúc ngữ nghĩa bổ sung
    keywords = ["sinh học", "toán học", "vật lý", "mendel", "quang hợp", "tiến hóa", "adg", "adn", "hệ sinh thái", "lớp 10", "lớp 11", "lớp 12"]
    for i, kw in enumerate(keywords):
        if kw in text_clean:
            # Gây nhiễu có hướng dựa trên từ khóa để các văn bản cùng từ khóa xích lại gần nhau hơn
            kw_seed = i * 1000
            kw_rng = random.Random(kw_seed)
            for d in range(dimensions):
                vector[d] += kw_rng.uniform(-0.5, 0.5)
                
    # Chuẩn hóa vector về dạng unit vector (độ dài = 1.0) để tính tương đồng cosine bằng tích vô hướng
    norm = sum(x * x for x in vector) ** 0.5
    if norm > 0:
        vector = [x / norm for x in vector]
    else:
        vector = [0.0] * dimensions
        vector[0] = 1.0
        
    return vector

def get_embedding(text, api_key=None, provider="local"):
    """
    Lấy vector embedding 1536 chiều.
    Hỗ trợ:
      - provider='api' và api_key: Gọi OpenAI Embeddings API (text-embedding-3-small)
      - provider='local': Kiểm tra Ollama, nếu chạy thì gọi Ollama, không thì dùng Deterministic Generator.
    """
    if not text:
        return [0.0] * 1536

    # 1. Nếu có API Key và chọn provider là API -> Gọi OpenAI Embeddings
    if provider == "api" and api_key:
        try:
            url = "https://api.openai.com/v1/embeddings"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            data = json.dumps({
                "model": "text-embedding-3-small",
                "input": text
            }).encode('utf-8')
            
            req = urllib.request.Request(url, data=data, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=5) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                return res_data["data"][0]["embedding"]
        except Exception as e:
            print(f"Error calling OpenAI Embedding: {e}. Falling back to deterministic embedding.")

    # 2. Kiểm tra Ollama cục bộ nếu ở chế độ 'local' – chỉ thử nếu đã confirm có Ollama
    if provider == "local" and _check_ollama_once():
        try:
            url = "http://127.0.0.1:11434/api/embeddings"
            data = json.dumps({
                "model": "nomic-embed-text",
                "prompt": text
            }).encode('utf-8')
            req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=5) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                embedding = res_data["embedding"]
                if len(embedding) == 1536:
                    return embedding
                elif len(embedding) < 1536:
                    return embedding + [0.0] * (1536 - len(embedding))
                else:
                    return embedding[:1536]
        except Exception:
            pass

    # 3. Fallback mặc định 100% thành công và ổn định offline
    return generate_deterministic_embedding(text)
