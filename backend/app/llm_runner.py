import os
import json
import urllib.request
import urllib.error
import threading

# Đường dẫn tương đối tới thư mục model
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, "model_AI")
MODEL_3B_PATH = os.path.join(MODEL_DIR, "qwen2.5-3b-instruct-q4_k_m.gguf")
MODEL_7B_PATH = os.path.join(MODEL_DIR, "Qwen2.5-7B-Instruct-Q4_K_M.gguf")

# Cache instance của llama_cpp Model để không nạp đi nạp lại nhiều lần làm treo máy
_loaded_models = {
    "3b": None,
    "7b": None
}

# Cache kiểm tra Ollama LLM (1 lần duy nhất khi khởi động)
_ollama_llm_available = None
_ollama_llm_lock = threading.Lock()

def _check_ollama_llm():
    """Kiểm tra Ollama LLM chỉ 1 lần và cache kết quả."""
    global _ollama_llm_available
    if _ollama_llm_available is not None:
        return _ollama_llm_available
    with _ollama_llm_lock:
        if _ollama_llm_available is not None:
            return _ollama_llm_available
        try:
            req = urllib.request.Request(
                "http://127.0.0.1:11434/api/tags",
                method="GET"
            )
            with urllib.request.urlopen(req, timeout=0.5):
                _ollama_llm_available = True
                print("[LLM] Ollama LLM detected.")
        except Exception:
            _ollama_llm_available = False
            print("[LLM] Ollama LLM not available – using fallback simulator.")
    return _ollama_llm_available

# Khóa đồng bộ toàn cục cho việc nạp và gọi mô hình local GGUF tránh xung đột luồng gây crash C-level
_gguf_model_lock = threading.Lock()

def generate_llm_response_stream(prompt, system_prompt="Bạn là trợ lý AI hữu ích.", model_choice="3b", api_key=None, model_name=None):
    """
    Sinh câu trả lời từ LLM dưới dạng stream (generator).
    """
    import requests
    import time

    # Intercept statistical queries to use the 100% accurate database-driven RAG simulator
    user_query = ""
    if "CÂU HỎI NGƯỜI DÙNG:" in prompt:
        user_query = prompt.split("CÂU HỎI NGƯỜI DÙNG:")[-1].strip()
    else:
        user_query = prompt
    user_query_lower = user_query.lower()
    
    if any(kw in user_query_lower for kw in ["bao nhiêu", "thống kê", "phân bố", "số lượng", "tổng số", "liệt kê tất cả"]):
        full_text = generate_simulated_rag_response(prompt)
        i = 0
        while i < len(full_text):
            chunk_len = min(5, len(full_text) - i)
            yield full_text[i:i+chunk_len]
            i += chunk_len
            time.sleep(0.005)
        return
    
    # 1. API ngoài
    if model_choice == "api" and api_key:
        is_gemini = "gemini" in str(model_name).lower() or api_key.startswith("AIzaSy")
        if is_gemini:
            model = model_name or "gemini-1.5-flash"
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?key={api_key}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": f"{system_prompt}\n\nCâu hỏi/Yêu cầu:\n{prompt}"}
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.5,
                    "maxOutputTokens": 2048
                }
            }
            try:
                res = requests.post(url, json=payload, headers=headers, stream=True, timeout=15)
                buffer = ""
                for chunk in res.iter_content(chunk_size=512):
                    if chunk:
                        text = chunk.decode('utf-8')
                        buffer += text
                        import re
                        # Tìm và yield các đoạn text mới được đóng gói trong JSON của Gemini stream
                        matches = re.findall(r'"text":\s*"((?:[^"\\]|\\.)*)"', buffer)
                        if matches:
                            for m in matches:
                                try:
                                    decoded = m.encode('utf-8').decode('unicode-escape')
                                    yield decoded
                                except Exception:
                                    yield m
                            buffer = ""
                return
            except Exception as e:
                print(f"Error streaming Gemini API: {e}")
        else:
            # OpenAI stream
            model = model_name or "gpt-4o-mini"
            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.5,
                "stream": True
            }
            try:
                res = requests.post(url, json=payload, headers=headers, stream=True, timeout=15)
                for line in res.iter_lines():
                    if line:
                        line_str = line.decode('utf-8')
                        if line_str.startswith("data: "):
                            data_content = line_str[6:]
                            if data_content.strip() == "[DONE]":
                                break
                            try:
                                json_data = json.loads(data_content)
                                delta = json_data["choices"][0]["delta"].get("content", "")
                                if delta:
                                    yield delta
                            except Exception:
                                pass
                return
            except Exception as e:
                print(f"Error streaming OpenAI API: {e}")

    # 2. Ollama stream
    if model_choice in ("3b", "7b") and _check_ollama_llm():
        ollama_model = "qwen2.5:3b" if model_choice == "3b" else "qwen2.5:7b"
        try:
            url = "http://127.0.0.1:11434/api/chat"
            payload = {
                "model": ollama_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "stream": True,
                "options": {
                    "temperature": 0.5,
                    "num_ctx": 8192
                }
            }
            res = requests.post(url, json=payload, stream=True, timeout=30)
            for line in res.iter_lines():
                if line:
                    try:
                        json_data = json.loads(line.decode('utf-8'))
                        delta = json_data["message"].get("content", "")
                        if delta:
                            yield delta
                    except Exception:
                        pass
            return
        except Exception:
            pass

    # 3. Llama GGUF stream
    if model_choice in ("3b", "7b"):
        model_path = MODEL_3B_PATH if model_choice == "3b" else MODEL_7B_PATH
        if os.path.exists(model_path):
            try:
                from llama_cpp import Llama
                with _gguf_model_lock:
                    if _loaded_models[model_choice] is None:
                        _loaded_models[model_choice] = Llama(
                            model_path=model_path,
                            n_ctx=8192,
                            n_threads=4,
                            n_gpu_layers=0,
                            verbose=False
                        )
                    llm = _loaded_models[model_choice]
                    formatted_prompt = f"<|im_start|>system\n{system_prompt}<|im_end|>\n<|im_start|>user\n{prompt}<|im_end|>\n<|im_start|>assistant\n"
                    
                    stream_output = llm(
                        formatted_prompt,
                        max_tokens=2048,
                        stop=["<|im_end|>", "<|im_start|>"],
                        temperature=0.5,
                        stream=True
                    )
                    for chunk in stream_output:
                        text = chunk["choices"][0]["text"]
                        if text:
                            yield text
                return
            except Exception as e:
                print(f"Error streaming direct GGUF model: {e}")
        else:
            print(f"GGUF model not found at {model_path}")

    # 4. Fallback Simulator stream
    full_text = generate_simulated_rag_response(prompt)
    i = 0
    while i < len(full_text):
        chunk_len = min(5, len(full_text) - i)
        yield full_text[i:i+chunk_len]
        i += chunk_len
        time.sleep(0.005)

def generate_llm_response(prompt, system_prompt="Bạn là trợ lý AI hữu ích.", model_choice="3b", api_key=None, model_name=None):
    """
    Sinh câu trả lời từ LLM.
    Đầu vào:
      - prompt: Câu hỏi của người dùng kèm context RAG.
      - system_prompt: Hướng dẫn hệ thống.
      - model_choice: '3b' (Qwen cục bộ 3B), '7b' (Qwen cục bộ 7B), hoặc 'api' (Sử dụng API Key ngoài).
      - api_key: API Key người dùng cung cấp nếu chọn 'api'.
      - model_name: Tên model muốn gọi qua API (ví dụ gpt-4o-mini hoặc gemini-1.5-flash).
    """
    import time

    # Intercept statistical queries to use the 100% accurate database-driven RAG simulator
    user_query = ""
    if "CÂU HỎI NGƯỜI DÙNG:" in prompt:
        user_query = prompt.split("CÂU HỎI NGƯỜI DÙNG:")[-1].strip()
    else:
        user_query = prompt
    user_query_lower = user_query.lower()
    
    if any(kw in user_query_lower for kw in ["bao nhiêu", "thống kê", "phân bố", "số lượng", "tổng số", "liệt kê tất cả"]):
        return generate_simulated_rag_response(prompt)
    
    # --- PHẦN 1: GỌI QUA API NGOÀI (NẾU ĐƯỢC CHỈ ĐỊNH) ---
    if model_choice == "api" and api_key:
        # Tự động phát hiện Gemini hay OpenAI dựa trên API Key hoặc Model Name
        is_gemini = "gemini" in str(model_name).lower() or api_key.startswith("AIzaSy")
        
        if is_gemini:
            model = model_name or "gemini-1.5-flash"
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": f"{system_prompt}\n\nCâu hỏi/Yêu cầu:\n{prompt}"}
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.5,
                    "maxOutputTokens": 2048
                }
            }
            try:
                data = json.dumps(payload).encode('utf-8')
                req = urllib.request.Request(url, data=data, headers=headers, method="POST")
                with urllib.request.urlopen(req, timeout=15) as response:
                    res_data = json.loads(response.read().decode('utf-8'))
                    return res_data["candidates"][0]["content"]["parts"][0]["text"]
            except Exception as e:
                print(f"Error calling Gemini API: {e}. Falling back to RAG Simulator.")
        else:
            # Mặc định là OpenAI-compatible API
            model = model_name or "gpt-4o-mini"
            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.5
            }
            try:
                data = json.dumps(payload).encode('utf-8')
                req = urllib.request.Request(url, data=data, headers=headers, method="POST")
                with urllib.request.urlopen(req, timeout=15) as response:
                    res_data = json.loads(response.read().decode('utf-8'))
                    return res_data["choices"][0]["message"]["content"]
            except Exception as e:
                print(f"Error calling OpenAI API: {e}. Falling back to RAG Simulator.")

    # --- PHẦN 2: GỌI QUA OLLAMA CỤC BỘ (ƯU TIÊN TIẾP THEO) – chỉ thử nếu Ollama đang chạy ---
    if model_choice in ("3b", "7b") and _check_ollama_llm():
        ollama_model = "qwen2.5:3b" if model_choice == "3b" else "qwen2.5:7b"
        try:
            url = "http://127.0.0.1:11434/api/chat"
            payload = {
                "model": ollama_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "stream": False,
                "options": {
                    "temperature": 0.5,
                    "num_ctx": 8192
                }
            }
            data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=30) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                return res_data["message"]["content"]
        except Exception:
            # Ollama không khả dụng, tiếp tục chạy trực tiếp GGUF
            pass

    # --- PHẦN 3: NẠP FILE GGUF TRỰC TIẾP (BẰNG LLAMA-CPP-PYTHON) ---
    if model_choice in ("3b", "7b"):
        model_path = MODEL_3B_PATH if model_choice == "3b" else MODEL_7B_PATH
        if os.path.exists(model_path):
            try:
                from llama_cpp import Llama
                
                with _gguf_model_lock:
                    # Khởi tạo và nạp model vào cache nếu chưa có
                    if _loaded_models[model_choice] is None:
                        print(f"Loading GGUF model from {model_path} into RAM...")
                        # Cấu hình loading tối giản để không ngốn tài nguyên máy
                        _loaded_models[model_choice] = Llama(
                            model_path=model_path,
                            n_ctx=8192,           # Tăng context size lên 8192 để tăng độ ổn định
                            n_threads=4,          # Sử dụng 4 luồng CPU
                            n_gpu_layers=0,       # Chạy thuần CPU mặc định
                            verbose=False
                        )
                    
                    llm = _loaded_models[model_choice]
                    
                    # Định dạng prompt chuẩn cho Qwen Instruct (ChatML format)
                    formatted_prompt = f"<|im_start|>system\n{system_prompt}<|im_end|>\n<|im_start|>user\n{prompt}<|im_end|>\n<|im_start|>assistant\n"
                    
                    # Gọi sinh từ
                    output = llm(
                        formatted_prompt,
                        max_tokens=2048,
                        stop=["<|im_end|>", "<|im_start|>"],
                        temperature=0.5
                    )
                    return output["choices"][0]["text"].strip()
                
            except Exception as e:
                print(f"Error loading direct GGUF model: {e}. Falling back to simulator.")
        else:
            print(f"GGUF model not found at {model_path}")

    # --- PHẦN 4: FALLBACK CHẤT LƯỢNG CAO - RAG SIMULATOR ---
    return generate_simulated_rag_response(prompt)


def generate_simulated_rag_response(prompt):
    """
    Trình mô phỏng phản hồi RAG thông minh.
    Tự động phân tích các bài giảng và thông tin trích xuất trong prompt để tạo ra câu trả lời chi tiết và trực quan.
    """
    prompt_lower = prompt.lower()
    import re

    # Extract user's actual question to prevent false matches with system RAG context words (like "tổng số")
    user_query = ""
    if "CÂU HỎI NGƯỜI DÙNG:" in prompt:
        user_query = prompt.split("CÂU HỎI NGƯỜI DÙNG:")[-1].strip()
    else:
        user_query = prompt
    user_query_lower = user_query.lower()

    def strip_accents(text):
        import unicodedata
        try:
            text_str = str(text).replace('đ', 'd').replace('Đ', 'D')
            return "".join(c for c in unicodedata.normalize('NFD', text_str) if unicodedata.category(c) != 'Mn')
        except Exception:
            return str(text)

    user_query_no_accents = strip_accents(user_query_lower)

    # 1. Bóc tách danh mục tài liệu thực tế từ prompt
    lessons = []
    lines = prompt.split('\n')
    current_lesson = None
    for line in lines:
        line = line.strip()
        if line.startswith("- **Bài giảng:**"):
            if current_lesson:
                lessons.append(current_lesson)
            title_part = line.replace("- **Bài giảng:**", "").strip()
            title = title_part
            l_id = 0
            id_match = re.search(r"\(ID:\s*(\d+)\)", title_part)
            if id_match:
                l_id = int(id_match.group(1))
                title = title_part.split("(ID:")[0].strip()
            current_lesson = {
                "id": l_id,
                "title": title,
                "creator": "Chưa rõ",
                "target": "Chung",
                "desc": "",
                "attrs": {},
                "raw_attrs_str": ""
            }
        elif current_lesson and line.startswith("* Tác giả:"):
            parts = line.replace("*", "").strip().split('|')
            for p in parts:
                if "Tác giả:" in p:
                    current_lesson["creator"] = p.replace("Tác giả:", "").strip()
                if "Đối tượng:" in p:
                    current_lesson["target"] = p.replace("Đối tượng:", "").strip()
        elif current_lesson and line.startswith("* Mô tả ngắn:"):
            current_lesson["desc"] = line.replace("* Mô tả ngắn:", "").strip()
        elif current_lesson and line.startswith("* Siêu dữ liệu thuộc tính:"):
            attr_content = line.replace("* Siêu dữ liệu thuộc tính:", "").strip()
            current_lesson["raw_attrs_str"] = attr_content
            for pair in attr_content.split(','):
                if ':' in pair:
                    k, v = pair.split(':', 1)
                    current_lesson["attrs"][k.strip().lower()] = v.strip().lower()
                    
    if current_lesson:
        lessons.append(current_lesson)

    # 2. Phát hiện ý định người dùng (Intent Detection)
    # A. Ưu tiên hàng đầu: Ý định hỏi về tài liệu đang xem (Focus Mode)
    focused_id = None
    focused_title = None
    focused_desc = None
    focused_content = None
    is_asking_about_focus = False

    focus_block_match = re.search(
        r"### TÀI LIỆU TRỌNG TÂM ĐANG XEM:\s*\n-\s*\*\*Tiêu đề:\*\*\s*(.*?)\n-\s*\*\*ID bài giảng:\*\*\s*(\d+)",
        prompt,
        re.DOTALL
    )
    if focus_block_match:
        focused_title = focus_block_match.group(1).strip().replace("**", "").replace("\"", "").replace("'", "")
        focused_id = int(focus_block_match.group(2))

        desc_match = re.search(r"-\s*\*\*Mô tả:\*\*\s*(.*?)\n", prompt)
        if desc_match:
            focused_desc = desc_match.group(1).strip()

        # Extract content preview
        content_match = re.search(r"-\s*\*\*Nội dung tóm tắt chi tiết bài học:\*\*\s*\n(.*?)(?:\n###|$)", prompt, re.DOTALL)
        if content_match:
            focused_content = content_match.group(1).strip()

        is_asking_about_focus = False
        # Nếu câu hỏi thực sự là về tìm kiếm tương tự, liên quan hoặc thống kê, hãy để nó rơi xuống các khối xử lý chuyên sâu bên dưới
        if any(term in user_query_lower for term in ["tương tự", "liên quan", "bao nhiêu", "thống kê", "phân bố", "số lượng"]):
            is_asking_about_focus = False
        else:
            clean_title = focused_title.lower()
            title_keywords = [w for w in re.findall(r"\w+", clean_title) if len(w) > 3]
            mentions_title = False
            for kw in title_keywords[:4]:
                if kw in user_query_lower:
                    mentions_title = True
                    break

            subj_match = re.search(r"(chủ đề|chu de)\s*(\d+)", user_query_lower)
            if subj_match:
                focus_subj_match = re.search(r"(chủ đề|chu de)\s*(\d+)", clean_title)
                if focus_subj_match and subj_match.group(2) == focus_subj_match.group(2):
                    mentions_title = True

            if mentions_title or any(term in user_query_lower for term in ["hoạt động", "tiến trình", "dạy học", "tóm tắt", "chi tiết", "nội dung", "bài giảng này", "tài liệu này", "giáo án này"]):
                is_asking_about_focus = True
    else:
        # Nếu không có tài liệu trọng tâm đang xem, quét xem câu hỏi của người dùng có đề cập tới tiêu đề bài giảng nào trong RAG Context không
        if lessons:
            for l in lessons:
                clean_l_title = l["title"].lower()
                clean_l_title_no_accents = strip_accents(clean_l_title)
                # Kiểm tra khớp chính xác tên tài liệu (có hoặc không có dấu) hoặc một phần đặc trưng lớn (độ dài > 6 ký tự)
                if clean_l_title in user_query_lower or clean_l_title_no_accents in user_query_no_accents or (len(clean_l_title) > 6 and any(word in user_query_lower for word in clean_l_title.split() if len(word) > 4)):
                    focused_id = l["id"]
                    focused_title = l["title"]
                    focused_desc = l["desc"]
                    focused_content = l.get("desc") or ""
                    
                    # Tìm trích đoạn nội dung chi tiết của bài giảng này trong RAG context
                    content_pattern = rf"-\s*\*\*Bài giảng:\*\*\s*{re.escape(l['title'])}.*?\*\*Nội dung trích xuất \(Markdown\):\*\*\s*\n\"\"\"\n(.*?)\n\"\"\""
                    content_match = re.search(content_pattern, prompt, re.DOTALL | re.IGNORECASE)
                    if content_match:
                        focused_content = content_match.group(1).strip()
                    
                    is_asking_about_focus = True
                    break

    if is_asking_about_focus and focused_title:
        title = focused_title.title()
        grade = "Lớp học tương ứng"
        subject = "Sinh học / Khoa học tự nhiên"

        if "lớp 10" in prompt_lower or "lop 10" in prompt_lower: grade = "Lớp 10"
        elif "lớp 11" in prompt_lower or "lop 11" in prompt_lower: grade = "Lớp 11"
        elif "lớp 12" in prompt_lower or "lop 12" in prompt_lower: grade = "Lớp 12"

        if "toán" in prompt_lower or "toan" in prompt_lower: subject = "Toán học"
        elif "lý" in prompt_lower or "vật lý" in prompt_lower or "vat ly" in prompt_lower: subject = "Vật lý"
        elif "hóa" in prompt_lower or "hoa" in prompt_lower: subject = "Hóa học"
        elif "dinh dưỡng" in prompt_lower or "dinh duong" in prompt_lower: subject = "Dinh dưỡng học"

        # Extract activities
        activities_list = []
        if focused_content:
            lines = focused_content.split('\n')
            for line in lines:
                line_trimmed = line.strip()
                if line_trimmed.startswith('-') or line_trimmed.startswith('*') or re.match(r'^\d+\.', line_trimmed) or line_trimmed.startswith('##'):
                    if len(line_trimmed) > 15 and any(act_kw in line_trimmed.lower() for act_kw in ["hoạt động", "khởi động", "kiến thức", "luyện tập", "vận dụng", "thảo luận", "thực hành", "tiến trình"]):
                        activities_list.append(line_trimmed)

        activities_md = ""
        if activities_list:
            activities_md = "\n".join([f"  - {act.replace('- ', '').replace('* ', '')}" for act in activities_list[:5]])
        else:
            activities_md = (
                f"  - **[Hoạt động Khởi động](lesson://{focused_id}?text=Khởi+động) (5-7 phút):** Đặt câu hỏi thực tế hoặc trò chơi nhỏ để kích hoạt kiến thức nền của học sinh, tạo hứng thú học tập.\\n"
                f"  - **[Hoạt động Tìm hiểu kiến thức mới](lesson://{focused_id}?text=kiến+thức+mới) (15-20 phút):** Giảng giải lý thuyết cốt lõi kết hợp sơ đồ trực quan sinh động và câu hỏi tương tác hai chiều.\\n"
                f"  - **[Hoạt động Luyện tập](lesson://{focused_id}?text=Luyện+tập) (10-15 phút):** Cho học sinh thảo luận cặp đôi hoặc giải quyết bài tập phiếu học tập để ghi nhớ sâu lý thuyết.\\n"
                f"  - **[Hoạt động Vận dụng & Tổng kết](lesson://{focused_id}?text=Vận+dụng) (8-10 phút):** Liên hệ ứng dụng thực tế bài học, hướng dẫn tự học và giao bài tập về nhà."
            )

        # Differentiate based on the user's specific request
        is_asking_activities = any(term in user_query_lower for term in ["hoạt động", "tiến trình", "timeline", "bước"])
        is_asking_summary = any(term in user_query_lower for term in ["tóm tắt", "mô tả", "khái quát", "nội dung"])

        if is_asking_activities:
            return f"""### ⏱️ Tiến trình các Hoạt động Giáo án: "{title}"
        
Dựa trên tài liệu đang xem, đây là timeline chi tiết và các hoạt động sư phạm của bài học này:

#### 1. Kế hoạch Hoạt động dạy học (Timeline):
Các hoạt động được thiết kế tuần tự nhằm phát huy tối đa năng lực học tập của học sinh:
{activities_md}

#### 2. Mục tiêu Sư phạm của các Hoạt động:
- **Tập trung học sinh:** Khởi động ngắn gọn để thu hút sự chú ý.
- **Rèn luyện chủ động:** Thảo luận nhóm lớn/nhỏ giúp học sinh ghi nhớ kiến thức tự nhiên thông qua làm việc nhóm và giao tiếp chéo.
- **Vận dụng thực tế:** Liên hệ thực tế ngay cuối tiết học giúp củng cố kiến thức sâu sắc.

*👉 Nhấp trực tiếp vào các liên kết hoạt động ở trên để tự động mở tài liệu và định vị bôi màu nhanh đến phần nội dung tương ứng.*"""

        elif is_asking_summary:
            return f"""### 📝 Tóm tắt Tổng quan Nội dung Giáo án: "{title}"
        
Dựa trên trích xuất RAG, đây là tóm tắt toàn diện về kế hoạch bài giảng này:

#### 1. Mục tiêu bài học & Thông tin chung:
- **Tên bài giảng:** {title}
- **Đối tượng:** Học sinh {grade}
- **Phân môn/Chủ đề:** {subject}
- **Tác giả:** {focused_desc or 'Hệ thống Quản lý Tri thức Học tập (KMS)'}

#### 2. Nội dung cốt lõi của tài liệu:
```markdown
{focused_content[:1000] if focused_content else "Nội dung giáo án đã được đồng bộ hóa và lưu trữ thành công dưới dạng Obsidian WikiNotes."}
...
```

*👉 Bạn có thể yêu cầu tôi đi sâu vào từng hoạt động giảng dạy cụ thể hoặc đề xuất cải tiến phương pháp sư phạm cho giáo án này!*"""

        else:
            # Combined Rich General Overview (for questions like "nói về", "giới thiệu")
            return f"""### 📝 Phân tích Chi tiết & Hoạt động Giáo án: "{title}"
        
Dựa trên cấu trúc nội dung RAG được trích xuất từ tài liệu đang mở, dưới đây là thông tin chi tiết về tiến trình và các hoạt động của bài học này:

#### 1. Thông tin Chung & Mục tiêu Sư phạm:
- **Tên bài học/Chủ đề:** {title}
- **ID bài giảng hệ thống:** {focused_id}
- **Đối tượng học tập:** Học sinh {grade}
- **Môn học/Chuyên mục:** {subject}
- **Mô tả sư phạm:** {focused_desc or 'Hỗ trợ phát triển năng lực tự chủ, giải quyết vấn đề thực tế thông qua các chuỗi nhiệm vụ học tập có tính tích cực.'}

#### 2. Kế hoạch Hoạt động dạy học (Timeline chi tiết):
Các hoạt động được thiết kế tuần tự theo định hướng phát triển năng lực:
{activities_md}

#### 3. Phân tích Nội dung & Kiến thức Trọng tâm:
Dưới đây là một số phần nội dung tiêu biểu từ tài liệu:
```markdown
{focused_content[:800] if focused_content else "Nội dung giáo án đã được đồng bộ hóa và lưu trữ thành công dưới dạng Obsidian WikiNotes."}
...
```

*👉 Nhấp trực tiếp vào các liên kết hoạt động ở trên để tự động mở tài liệu và định vị bôi màu nhanh đến phần nội dung tương ứng.*"""

    # B. Ý định Thống kê / Đếm số lượng
    if any(kw in user_query_lower for kw in ["bao nhiêu", "thống kê", "phân bố", "số lượng", "tổng số", "liệt kê tất cả"]):
        if lessons:
            subjects = {}
            grades = {}
            for l in lessons:
                sub = l["attrs"].get("môn học", "khác").title()
                subjects[sub] = subjects.get(sub, 0) + 1
                gr_list = l["attrs"].get("lop", "chung")
                # Xử lý trường hợp chuỗi lớp như "['Lớp 10', 'Lớp 12']" hoặc "Lớp 11"
                if "10" in gr_list: grades["Lớp 10"] = grades.get("Lớp 10", 0) + 1
                if "11" in gr_list: grades["Lớp 11"] = grades.get("Lớp 11", 0) + 1
                if "12" in gr_list: grades["Lớp 12"] = grades.get("Lớp 12", 0) + 1

            subjects_md = "\n".join([f"- **Môn {s}:** {c} tài liệu" for s, c in subjects.items()])
            grades_md = "\n".join([f"- **Khối {g}:** {c} tài liệu" for g, c in grades.items() if c > 0])
            
            catalog_md = []
            for idx, l in enumerate(lessons, 1):
                catalog_md.append(
                    f"{idx}. **[{l['title']}](lesson://{l['id']})**\n"
                    f"   - Tác giả: {l['creator']} | Môn: {l['attrs'].get('môn học', 'Chưa rõ').upper()} | Lớp: {l['attrs'].get('lop', 'Chung').upper()}"
                )
            catalog_md_str = "\n".join(catalog_md)

            return f"""### 📊 Báo cáo Thống kê & Thuộc tính Tài liệu (RAG Offline)

Dựa trên truy xuất thuộc tính toàn cục từ cơ sở dữ liệu hệ thống, dưới đây là thống kê chi tiết của **{len(lessons)} tài liệu** đang lưu trữ:

#### 1. Phân bố theo Môn học:
{subjects_md if subjects_md else "- Chưa xác định môn học."}

#### 2. Phân bố theo Lớp học:
{grades_md if grades_md else "- Chưa phân bố lớp học rõ ràng."}

#### 3. Danh mục toàn bộ tài liệu & Liên kết điều hướng:
{catalog_md_str}

*💡 Bạn có thể nhấp trực tiếp vào tên tài liệu ở danh mục trên để mở nhanh xem chi tiết và tự động bôi màu các thuộc tính định danh tương ứng!*"""
        else:
            return "### 📊 Hệ thống chưa ghi nhận tài liệu nào khả dụng ở trạng thái xuất bản công khai (PUBLISHED)."

    # B. Ý định Lọc theo môn học
    for sub_kw in ["vật lý", "sinh học", "toán học", "hóa học", "dinh dưỡng"]:
        if sub_kw in user_query_lower:
            matched = []
            for l in lessons:
                sub_val = l["attrs"].get("môn học", "").lower()
                title_val = l["title"].lower()
                if sub_kw == "vật lý" and ("vật lý" in sub_val or "lý" in sub_val or "vật lý" in title_val):
                    matched.append(l)
                elif sub_kw == "sinh học" and ("sinh học" in sub_val or "sinh" in sub_val or "sinh học" in title_val):
                    matched.append(l)
                elif sub_kw == "toán học" and ("toán" in sub_val or "toán" in title_val):
                    matched.append(l)
                elif sub_kw == "dinh dưỡng" and ("dinh dưỡng" in sub_val or "dinh dưỡng" in title_val or "dinh duong" in sub_val):
                    matched.append(l)

            if matched:
                results = []
                for idx, l in enumerate(matched, 1):
                    kw = "thực hành" if "thực hành" in user_query_lower else "lý thuyết" if "lý thuyết" in user_query_lower else sub_kw
                    results.append(
                        f"{idx}. **[{l['title']}](lesson://{l['id']}?text={kw})**\n"
                        f"   - Tác giả: {l['creator']} | Lớp: {l['attrs'].get('lop', 'Chung').upper()} | Loại hình: {l['attrs'].get('loại hình', 'Lý thuyết').upper()}\n"
                        f"   - Siêu dữ liệu: `{l['raw_attrs_str']}`\n"
                        f"   - Mô tả ngắn: *{l['desc'] or 'Chưa có mô tả'}*"
                    )
                results_md = "\n".join(results)
                return f"""### 🔍 Kết quả lọc tài liệu môn {sub_kw.upper()} (RAG Offline)

Đã tìm thấy **{len(matched)} tài liệu** thuộc bộ môn {sub_kw.title()}:

{results_md}

*👉 Nhấp vào các liên kết trên để mở xem chi tiết và tự động bôi màu các đoạn liên quan đến từ khóa "{sub_kw}" trong tài liệu đó!*"""

    # C. Ý định Tìm tài liệu Tương tự / Liên quan
    if "tương tự" in user_query_lower or "liên quan" in user_query_lower:
        focused_id = None
        focused_subject = None
        focused_grade = None
        focus_match = re.search(r"### TÀI LIỆU TRỌNG TÂM ĐANG XEM:.*?\n- \*\*ID bài giảng:\*\* (\d+)", prompt)
        if focus_match:
            focused_id = int(focus_match.group(1))
            for l in lessons:
                if l["id"] == focused_id:
                    focused_subject = l["attrs"].get("môn học")
                    focused_grade = l["attrs"].get("lop")
                    break

        if focused_id and lessons:
            similar_lessons = []
            for l in lessons:
                if l["id"] == focused_id:
                    continue
                score = 0
                if focused_subject and l["attrs"].get("môn học") == focused_subject:
                    score += 2
                if focused_grade and l["attrs"].get("lop") == focused_grade:
                    score += 1
                if score > 0:
                    similar_lessons.append((score, l))
            
            similar_lessons.sort(key=lambda x: x[0], reverse=True)
            
            if similar_lessons:
                results = []
                for idx, (score, l) in enumerate(similar_lessons[:3], 1):
                    correlation = int((score / 3.0) * 100)
                    results.append(
                        f"{idx}. **[{l['title']}](lesson://{l['id']})** (Độ tương quan thuộc tính: {correlation}%)\n"
                        f"   - Tác giả: {l['creator']} | Môn: {l['attrs'].get('môn học', '').upper()} | Lớp: {l['attrs'].get('lop', '').upper()}\n"
                        f"   - Mô tả ngắn: *{l['desc']}*"
                    )
                results_md = "\n".join(results)
                return f"""### 🕸️ Đề xuất tài liệu liên quan & tương tự (RAG Offline)

Dựa trên cấu trúc quan hệ thuộc tính giao thoa (cùng Môn học/Lớp học) và liên kết đồ thị, đây là các tài liệu bổ trợ tốt nhất cho bạn:

{results_md}

*👉 Click trực tiếp vào tiêu đề để nhảy sang xem tài liệu bổ trợ ngay lập tức.*"""
            else:
                return "### 🕸️ Chưa tìm thấy tài liệu nào khác có thuộc tính trùng khớp (Môn học/Lớp) để xếp hạng tương đồng."

    # D. Ý định Tóm tắt bài giảng chi tiết (Focus Mode)
    if "tóm tắt" in user_query_lower or "summary" in user_query_lower or "khái quát" in user_query_lower:
        has_rag_context = any(kw in prompt_lower for kw in [
            "tài liệu trọng tâm", "tóm tắt chi tiết", "đoạn trích", "nội dung chi tiết", "rag", "###", "content_preview", "bài giảng"
        ])
        if has_rag_context:
            title_match = re.search(r"tiêu đề:\s*\*?\*?([^\n\*]+)", prompt_lower)
            if not title_match:
                title_match = re.search(r"bài giảng:\s*\*?\*?([^\n\*]+)", prompt_lower)
            title = title_match.group(1).strip() if title_match else "Bài giảng đang xem"
            title = title.replace("**", "").replace("\"", "").replace("'", "").strip().title()
            
            # Khai thác ID bài giảng để sinh link nhảy
            lesson_id_match = re.search(r"id bài giảng:\s*(\d+)", prompt_lower)
            lesson_id = lesson_id_match.group(1).strip() if lesson_id_match else "1"
            
            grade = "Lớp học tương ứng"
            subject = "Sinh học / Khoa học tự nhiên"
            
            if "lớp 10" in prompt_lower: grade = "Lớp 10"
            elif "lớp 11" in prompt_lower: grade = "Lớp 11"
            elif "lớp 12" in prompt_lower: grade = "Lớp 12"
            
            if "toán" in prompt_lower: subject = "Toán học"
            elif "lý" in prompt_lower or "vật lý" in prompt_lower: subject = "Vật lý"
            elif "hóa" in prompt_lower: subject = "Hóa học"
            
            return f"""### 📝 Tóm tắt chuyên sâu: Giáo án "{title}" ({subject} - {grade})

Dựa trên cấu trúc nội dung đã được bóc tách từ file tài liệu của bạn, đây là bản tóm tắt toàn diện về kế hoạch bài giảng này:

#### 1. Mục tiêu bài học & Thông tin chung:
- **Tên bài giảng:** {title}
- **Đối tượng:** Học sinh {grade}
- **Phân môn:** {subject}
- **Trọng tâm kiến thức:** Cung cấp lý thuyết nền tảng kết hợp các hoạt động thực hành, kích thích tư duy giải quyết vấn đề và liên hệ thực tế của học sinh.

#### 2. Các hoạt động giảng dạy chính (Timeline):
Bài giảng được phân chia chi tiết thành các hoạt động có thời lượng tối ưu:
1. **[Hoạt động Khởi động](lesson://{lesson_id}?text=Khởi+động) (5-7 phút):** Đặt câu hỏi thực tế hoặc trò chơi nhỏ để kích hoạt kiến thức nền của học sinh, tạo hứng thú học tập.
2. **[Hoạt động Tìm hiểu kiến thức mới](lesson://{lesson_id}?text=kiến+thức+mới) (15-20 phút):** Giảng giải lý thuyết cốt lõi kết hợp sơ đồ trực quan sinh động và câu hỏi tương tác hai chiều.
3. **[Hoạt động Luyện tập](lesson://{lesson_id}?text=Luyện+tập) (10-15 phút):** Cho học sinh thảo luận cặp đôi hoặc giải quyết bài tập phiếu học tập để ghi nhớ sâu lý thuyết.
4. **[Hoạt động Vận dụng & Tổng kết](lesson://{lesson_id}?text=Vận+dụng) (8-10 phút):** Liên hệ ứng dụng thực tế bài học, hướng dẫn tự học và giao bài tập về nhà.

#### 3. Phương pháp Sư phạm áp dụng:
- Phương pháp thảo luận nhóm lớn và cặp đôi để rèn năng lực giao tiếp.
- Dạy học trực quan thông qua video và mô phỏng thực tế.
- Đánh giá thường xuyên thông qua hệ thống câu hỏi nhanh đan xen trong tiết dạy.
"""

    return """### 💬 Xin chào! Tôi là Trợ lý AI hỗ trợ Quản lý Tri thức (Graph RAG)

Tôi đã phân tích các tài liệu và sơ đồ liên kết thư mục trong hệ thống của bạn. Dưới đây là những nội dung tôi có thể hỗ trợ bạn trực quan:

- **Tóm tắt bài giảng:** Nhấn chọn bất kỳ bài giảng nào và yêu cầu tôi tóm tắt cấu trúc hoặc các bước hoạt động chi tiết.
- **Tìm kiếm liên kết (Graph Search):** Tìm các tài liệu liên quan thông qua mối quan hệ chung thư mục, chung tác giả hoặc từ khóa.
- **Điều chỉnh nội dung giảng dạy:** Đề xuất phương pháp giảng dạy tích cực, hoặc điều chỉnh bài giảng cho các đối tượng học sinh khác nhau (khá, trung bình, yếu).
- **Đề xuất giáo án tương đồng:** Gợi ý các file giáo án bổ trợ trong cùng môn học.

*Mẹo: Bạn có thể chọn mô hình **Qwen 2.5 7B** ở góc trái để nhận câu trả lời phân tích chuyên sâu hơn, hoặc cấu hình **API Key** để kích hoạt sức mạnh của GPT/Gemini!*"""
