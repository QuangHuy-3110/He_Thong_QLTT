import os
import re
import queue
import json
import threading
import traceback
from datetime import datetime
from django.utils import timezone
from django.db.models import Q

# Pre-compiled Regex Patterns for Performance
INVALID_FILE_CHARS = re.compile(r'[\/:*?"<>|\r\n\t]')
HEADER_PATTERN = re.compile(r'^(#{1,6})\s+(.*)$')
YAML_PATTERN = re.compile(r'^---\n(.+?)\n---', re.DOTALL)
TAGS_SECTION_PATTERN = re.compile(r'tags:\s*\n((?:\s*-\s*.*?\n)+)')
TAG_ITEM_PATTERN = re.compile(r'-\s*["\']?([^"\']+)["\']?')
WIKILINK_CLEAN_PATTERN = re.compile(r'- \[\[(.*?)\]\]')

import sys
_original_print = print
def print(*args, **kwargs):
    try:
        encoding = sys.stdout.encoding or 'utf-8'
        new_args = []
        for arg in args:
            arg_str = str(arg)
            new_args.append(arg_str.encode(encoding, errors='replace').decode(encoding, errors='replace'))
        _original_print(*new_args, **kwargs)
    except Exception:
        # Fallback to pure ASCII replacement printing to never crash
        try:
            fallback_args = [str(arg).encode('ascii', errors='replace').decode('ascii') for arg in args]
            _original_print(*fallback_args, **kwargs)
        except Exception:
            pass

def get_wikipedia_academic_definition(tag, subject, lesson_title):
    import requests
    import urllib.parse
    
    tag_clean = tag.strip()
    url = f"https://vi.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&titles={urllib.parse.quote(tag_clean)}"
    try:
        headers = {'User-Agent': 'KMS-App/1.0 (contact@example.com)'}
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            data = res.json()
            pages = data.get('query', {}).get('pages', {})
            for page_id, page_data in pages.items():
                if page_id != "-1":
                    extract = page_data.get('extract', '').strip()
                    if extract:
                        sentences = [s.strip() for s in extract.split('.') if s.strip()]
                        brief = ". ".join(sentences[:3])
                        if not brief.endswith('.'):
                            brief += '.'
                        return brief
    except Exception as e:
        print(f"[Wikipedia Fallback] Failed for '{tag}': {e}")
        
    return (
        f"Trong khoa học và giảng dạy học thuật, \"{tag_clean}\" đại diện cho một khái niệm, thực thể hoặc cơ chế "
        f"được nghiên cứu chi tiết nhằm giải thích các hiện tượng liên quan trong phân môn \"{subject}\". "
        f"Kiến thức này đóng vai trò cơ sở lý thuyết giúp định hình nhận thức khoa học của học sinh, "
        f"tạo tiền đề giải quyết các câu hỏi thực tiễn được đặt ra trong bài giảng \"{lesson_title}\"."
    )

# Thread-safe global processor queue
class BackgroundProcessManager:
    _queue = queue.Queue()
    _lock = threading.Lock()
    _worker_thread = None
    _active_tasks = {}  # {lp_id: {'step': str, 'queued_at': datetime}}
    _stats = {'success': 0, 'failed': 0}
    _cancelled_tasks = set()  # Lưu các task id bị yêu cầu dừng

    @classmethod
    def cancel_task(cls, lesson_plan_id):
        """
        Dừng một tác vụ AI RAG đang chạy hoặc đang chờ.
        """
        with cls._lock:
            cls._cancelled_tasks.add(lesson_plan_id)
        
        # Cập nhật database ngay lập tức
        from .models import LessonPlan
        try:
            lp = LessonPlan.objects.get(id=lesson_plan_id)
            if lp.ai_processing_status in ['PENDING', 'PROCESSING']:
                lp.ai_processing_status = 'FAILED'
                lp.ai_processing_step = 'Đã dừng xử lý theo yêu cầu người dùng.'
                lp.save(update_fields=['ai_processing_status', 'ai_processing_step'])
        except Exception as e:
            print(f"[BG Process] Error updating DB for cancelled task {lesson_plan_id}: {e}")
            
        # Nếu task chưa chạy (đang chờ trong queue), xóa khỏi active tasks ngay
        with cls._lock:
            if lesson_plan_id in cls._active_tasks and cls._active_tasks[lesson_plan_id]['step'] == 'Đang chờ...':
                del cls._active_tasks[lesson_plan_id]
                if lesson_plan_id in cls._cancelled_tasks:
                    cls._cancelled_tasks.remove(lesson_plan_id)

    @classmethod
    def cancel_all_tasks(cls):
        """
        Dừng toàn bộ các tác vụ AI RAG đang chạy và trong hàng chờ.
        """
        active_ids = list(cls._active_tasks.keys())
        for lp_id in active_ids:
            cls.cancel_task(lp_id)
            
        # Xóa sạch queue
        try:
            while not cls._queue.empty():
                cls._queue.get_nowait()
                cls._queue.task_done()
        except Exception:
            pass

    @classmethod
    def _is_cancelled(cls, lp_id):
        with cls._lock:
            return lp_id in cls._cancelled_tasks

    @classmethod
    def _handle_cancellation(cls, lp_id):
        with cls._lock:
            if lp_id in cls._active_tasks:
                del cls._active_tasks[lp_id]
            if lp_id in cls._cancelled_tasks:
                cls._cancelled_tasks.remove(lp_id)
        print(f"[BG Process] Task {lp_id} successfully stopped & cleaned up.")

    @classmethod
    def get_vault_path(cls):
        """
        Trả về đường dẫn tới thư mục obsidian_vault ở gốc dự án.
        """
        app_dir = os.path.dirname(os.path.abspath(__file__))  # backend/app
        backend_dir = os.path.dirname(app_dir)  # backend
        workspace_dir = os.path.dirname(backend_dir)  # workspace root (He_Thong_QLTT)
        vault_dir = os.path.join(workspace_dir, "obsidian_vault")
        return vault_dir

    @classmethod
    def ensure_worker_running(cls):
        with cls._lock:
            if cls._worker_thread is None or not cls._worker_thread.is_alive():
                print("Starting KMS Background Processor thread...")
                cls._worker_thread = threading.Thread(target=cls._worker_loop, daemon=True)
                cls._worker_thread.start()

    @classmethod
    def queue_task(cls, lesson_plan_id):
        """
        Đẩy bài giảng vào hàng chờ xử lý ngầm.
        """
        # Tránh trùng lặp tác vụ nếu đã có trong hàng chờ hoặc đang chạy
        if lesson_plan_id in cls._active_tasks:
            return

        from .models import LessonPlan
        try:
            lp = LessonPlan.objects.get(id=lesson_plan_id)
            lp.ai_processing_status = 'PENDING'
            lp.ai_processing_step = 'Đang xếp hàng chờ xử lý ngầm...'
            lp.save(update_fields=['ai_processing_status', 'ai_processing_step'])
        except LessonPlan.DoesNotExist:
            return

        cls._active_tasks[lesson_plan_id] = {
            'step': 'Đang chờ...',
            'title': lp.title,
            'queued_at': timezone.now()
        }
        cls._queue.put(lesson_plan_id)
        cls.ensure_worker_running()

    @classmethod
    def get_status(cls):
        """
        Trả về tiến độ thời gian thực của hàng chờ.
        """
        from .models import LessonPlan
        
        pending_list = []
        for lp_id, info in list(cls._active_tasks.items()):
            if info['step'] == 'Đang chờ...':
                pending_list.append({
                    'id': lp_id,
                    'title': info['title'],
                    'queued_at': info['queued_at'].isoformat()
                })

        current_task = None
        for lp_id, info in list(cls._active_tasks.items()):
            if info['step'] != 'Đang chờ...':
                current_task = {
                    'id': lp_id,
                    'title': info['title'],
                    'step': info['step'],
                    'queued_at': info['queued_at'].isoformat()
                }
                break

        # Đếm tổng thể trong database
        total = LessonPlan.objects.count()
        completed = LessonPlan.objects.filter(ai_processing_status='COMPLETED').count()
        failed = LessonPlan.objects.filter(ai_processing_status='FAILED').count()
        pending = LessonPlan.objects.filter(ai_processing_status__in=['PENDING', 'PROCESSING']).count()

        return {
            'active_task': current_task,
            'pending_queue': pending_list,
            'stats': {
                'total_lessons': total,
                'completed': completed,
                'failed': failed,
                'pending': pending,
                'success_rate_percent': int((completed / total * 100) if total > 0 else 100)
            },
            'vault_path': cls.get_vault_path()
        }

    @classmethod
    def scan_and_queue_unprocessed(cls):
        """
        Quét database khi startup để tự động queue các bài giảng chưa hoàn thành.
        Bỏ qua nếu Admin đã tắt AI RAG.
        """
        from .models import LessonPlan, SystemSetting
        # Kiểm tra cấu hình bật/tắt AI RAG trước khi quét
        try:
            config = SystemSetting.objects.get(key="chunking_config").value
            use_ai_rag = config.get("use_ai_rag", True)
        except Exception:
            use_ai_rag = True

        if not use_ai_rag:
            print("[BG Process] scan_and_queue_unprocessed: AI RAG đang tắt, bỏ qua quét startup.")
            return

        unprocessed = LessonPlan.objects.filter(~Q(ai_processing_status='COMPLETED'))
        count = unprocessed.count()
        if count > 0:
            print(f"Found {count} unprocessed lesson plans. Queueing them for background processing...")
            for lp in unprocessed:
                cls.queue_task(lp.id)

    @classmethod
    def _run_task_wrapper(cls, lp_id):
        try:
            cls._process_lesson_plan(lp_id)
        except Exception as e:
            print(f"Error processing lesson plan {lp_id} in background: {e}")
            traceback.print_exc()
        finally:
            cls._queue.task_done()

    @classmethod
    def _worker_loop(cls):
        from concurrent.futures import ThreadPoolExecutor
        # Sử dụng ThreadPool với tối đa 2 workers để chạy song song an toàn
        with ThreadPoolExecutor(max_workers=2) as executor:
            while True:
                try:
                    # Đợi có task trong queue
                    lp_id = cls._queue.get()
                    if lp_id is None:
                        break
                    
                    # Submit tác vụ vào ThreadPool để chạy song song
                    executor.submit(cls._run_task_wrapper, lp_id)
                except Exception as e:
                    print(f"Error in background worker loop: {e}")
                    traceback.print_exc()

    @classmethod
    def _process_lesson_plan(cls, lp_id):
        from .models import LessonPlan, DocumentChunk, SystemSetting
        from .embedding_service import get_embedding
        from .llm_runner import generate_llm_response
        from .docx_parser import convert_docx_to_markdown

        try:
            lp = LessonPlan.objects.get(id=lp_id)
        except LessonPlan.DoesNotExist:
            if lp_id in cls._active_tasks:
                del cls._active_tasks[lp_id]
            return

        if cls._is_cancelled(lp_id):
            cls._handle_cancellation(lp_id)
            return

        # ── Kiểm tra cài đặt bật/tắt LLM/AI RAG toàn cục TRƯỚC KHI xử lý ──
        # Dù task đã vào hàng chờ, nếu Admin tắt thì bỏ qua hoàn toàn
        try:
            setting_check = SystemSetting.objects.get(key="chunking_config").value
            use_ai_rag = setting_check.get("use_ai_rag", True)
        except Exception:
            use_ai_rag = True

        if not use_ai_rag:
            print(f"[BG Process] SKIPPED (AI RAG tắt) for: {lp.title} (ID: {lp_id})")
            # Đánh dấu COMPLETED để không lặp lại, không cần LLM/embedding
            LessonPlan.objects.filter(id=lp_id).update(
                ai_processing_status='COMPLETED',
                ai_processing_step='AI RAG đã tắt — bỏ qua xử lý ngầm.'
            )
            if lp_id in cls._active_tasks:
                del cls._active_tasks[lp_id]
            return

        print(f"[BG Process] Starting processing for: {lp.title} (ID: {lp_id})")
        cls._active_tasks[lp_id]['step'] = 'Đang chuyển đổi văn bản .docx sang Markdown (Phase 1)...'
        
        lp.ai_processing_status = 'PROCESSING'
        lp.ai_processing_step = 'Đang chuyển đổi văn bản .docx sang Markdown (Phase 1)...'
        lp.save(update_fields=['ai_processing_status', 'ai_processing_step'])

        try:
            # --- PHASE 1: Parse & Convert DOCX to Markdown ---
            # Sử dụng file vật lý thực tế nếu có
            if lp.file_path and os.path.exists(lp.file_path.path):
                file_path = lp.file_path.path
                if file_path.lower().endswith(('.md', '.markdown', '.txt')):
                    with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                        markdown_content = f.read()
                else:
                    markdown_content = convert_docx_to_markdown(file_path)
                lp.content_preview = markdown_content
                lp.save(update_fields=['content_preview'])
            else:
                markdown_content = lp.content_preview or ""

            if not markdown_content.strip():
                raise ValueError("Tài liệu trống, không thể trích xuất nội dung Markdown.")

            if cls._is_cancelled(lp_id):
                cls._handle_cancellation(lp_id)
                return

            # --- PHASE 2: Semantic Chunking ---
            cls._active_tasks[lp_id]['step'] = 'Đang chia nhỏ văn bản (Phase 2: Semantic Chunking)...'
            lp.ai_processing_step = 'Đang chia nhỏ văn bản (Phase 2: Semantic Chunking)...'
            lp.save(update_fields=['ai_processing_step'])

            # Lấy cấu hình chia chunk của Admin từ SystemSetting
            try:
                setting_obj = SystemSetting.objects.get(key="chunking_config")
                config = setting_obj.value
            except SystemSetting.DoesNotExist:
                config = {
                    "chunk_strategy": "heading",
                    "chunk_size": 1000,
                    "chunk_overlap": 200
                }

            strategy = config.get("chunk_strategy", "heading")
            chunk_size = int(config.get("chunk_size", 1000))
            chunk_overlap = int(config.get("chunk_overlap", 200))

            chunks_to_create = []

            # Xóa sạch các chunk cũ
            lp.chunks.all().delete()

            if strategy == "heading":
                # Triển khai Heading-based Semantic Chunking
                lines = markdown_content.split('\n')
                current_heading = "Mở đầu / Giới thiệu"
                current_lines = []
                
                for line in lines:
                    match = HEADER_PATTERN.match(line)
                    if match:
                        if current_lines:
                            chunks_to_create.append({
                                'heading': current_heading,
                                'content': '\n'.join(current_lines).strip()
                            })
                            current_lines = []
                        current_heading = match.group(2).strip()
                    current_lines.append(line)
                
                if current_lines:
                    chunks_to_create.append({
                        'heading': current_heading,
                        'content': '\n'.join(current_lines).strip()
                    })
            else:
                # Fallback: Fixed character window
                text = str(markdown_content).strip()
                start = 0
                idx = 0
                while start < len(text):
                    end = start + chunk_size
                    chunk_text = text[start:end]
                    chunks_to_create.append({
                        'heading': f"Đoạn văn số {idx + 1}",
                        'content': chunk_text
                    })
                    start += (chunk_size - chunk_overlap)
                    idx += 1

            if cls._is_cancelled(lp_id):
                cls._handle_cancellation(lp_id)
                return

            # --- PHASE 3: Embedding Generation with Metadata Prepend ---
            total_chunks = len(chunks_to_create)
            cls._active_tasks[lp_id]['step'] = f'Đang chuẩn bị dữ liệu RAG (Phase 3: Khởi tạo... 0/{total_chunks} chunks)'
            lp.ai_processing_step = f'Đang chuẩn bị dữ liệu RAG (Phase 3: Khởi tạo... 0/{total_chunks} chunks)'
            lp.save(update_fields=['ai_processing_step'])

            # Chuẩn bị toàn bộ enriched texts để batch nhúng
            enriched_texts = []
            for chk in chunks_to_create:
                chk_content = chk['content']
                chk_heading = chk['heading']
                prepend_text = f"Tài liệu: {lp.title} | Môn: {lp.attributes.get('Môn học', 'Chưa rõ')} | Mục: {chk_heading}\n\n"
                enriched_texts.append(prepend_text + chk_content)

            # Cập nhật tiến độ gọi batch nhúng
            progress_step = f'Đang sinh Vector nhúng RAG bằng Batch API (Phase 3: Nhúng {total_chunks} chunks)...'
            cls._active_tasks[lp_id]['step'] = progress_step
            lp.ai_processing_step = progress_step
            lp.save(update_fields=['ai_processing_step'])

            # Gọi service nhúng hàng loạt
            from .embedding_service import get_embeddings_batch
            # Đọc cấu hình model của người dùng từ attributes nếu có
            model_config = lp.attributes.get('ai_model_config', {}) if isinstance(lp.attributes, dict) else {}
            ai_mode = model_config.get('ai_mode', 'local')
            api_key = model_config.get('api_key', None)
            provider = "api" if ai_mode == "api" else "local"

            emb_vectors = get_embeddings_batch(enriched_texts, api_key=api_key if ai_mode == 'api' else None, provider=provider)

            for idx, chk in enumerate(chunks_to_create):
                if cls._is_cancelled(lp_id):
                    cls._handle_cancellation(lp_id)
                    return
                chk_content = chk['content']
                chk_heading = chk['heading']
                emb_vector = emb_vectors[idx] if idx < len(emb_vectors) else [0.0] * 1536
                
                DocumentChunk.objects.create(
                    lesson_plan=lp,
                    chunk_index=idx,
                    content=chk_content,
                    heading=chk_heading,
                    embedding=emb_vector,
                    metadata={
                        'filename': os.path.basename(lp.file_path.name) if lp.file_path else lp.title,
                        'heading_path': f"{lp.title} > {chk_heading}",
                        'char_length': len(chk_content),
                        'timestamp': datetime.now().isoformat()
                    }
                )

            if cls._is_cancelled(lp_id):
                cls._handle_cancellation(lp_id)
                return

            # --- PHASE 4: Concept & Relation Extraction ---
            cls._active_tasks[lp_id]['step'] = 'Đang trích xuất thực thể đồ thị tri thức (Phase 4: Concept Extraction)...'
            lp.ai_processing_step = 'Đang trích xuất thực thể đồ thị tri thức (Phase 4: Concept Extraction)...'
            lp.save(update_fields=['ai_processing_step'])

            extracted_tags = []
            try:
                # Tạo prompt tối ưu để Qwen local bóc tách khái niệm chính xác, tránh từ chung chung
                prompt_extract = (
                    f"Dưới đây là nội dung văn bản của tài liệu \"{lp.title}\":\n"
                    f"Mô tả: {lp.description or 'Không có mô tả'}\n"
                    f"Nội dung văn bản:\n{markdown_content[:3500]}\n\n"
                    f"Nhiệm vụ: Hãy phân tích sâu sắc văn bản trên và trích xuất đúng từ 8 đến 12 khái niệm/thuật ngữ/thực thể cốt lõi và đặc trưng nhất của bài học này.\n"
                    f"YÊU CẦU NGHIÊM NGẶT:\n"
                    f"1. Hãy trích xuất đa dạng cả khái niệm chuyên môn nội dung của bài học (ví dụ: các chủ đề khoa học, xã hội, hướng nghiệp, đời sống như 'Dinh dưỡng học đường', 'Khẩu phần ăn', 'Bảo vệ môi trường', 'Hướng nghiệp', 'Kế hoạch học tập', 'Kỹ năng sinh tồn', 'Nhịp sinh học', 'Giao tiếp xã hội'...) lẫn các mục tiêu năng lực/phẩm chất đặc thù cốt lõi đi kèm (ví dụ: 'Năng lực tự học', 'Năng lực hợp tác', 'Giải quyết vấn đề', 'Trung thực', 'Trách nhiệm', 'Chăm chỉ').\n"
                    f"2. Tuyệt đối TRÁNH các từ chung chung hoặc các hoạt động/phương pháp chung như: 'Thảo luận', 'Trò chơi', 'Hình ảnh', 'Hoạt động', 'Thực hành', 'Giáo án', 'Học sinh', 'Giáo viên', 'Đại diện', 'Báo cáo', 'Poster'.\n"
                    f"3. Trả về kết quả dưới dạng MỘT danh sách JSON duy nhất chứa các chuỗi (ví dụ: [\"Khái niệm 1\", \"Khái niệm 2\", ...]). Không viết thêm bất kỳ văn bản giải thích nào khác."
                )

                # Đọc cấu hình model của người dùng từ attributes
                model_config = lp.attributes.get('ai_model_config', {}) if isinstance(lp.attributes, dict) else {}
                ai_mode = model_config.get('ai_mode', 'local')
                local_model = model_config.get('local_model', '7b') # Mặc định là 7b cho bóc tách
                api_key = model_config.get('api_key', None)
                api_model = model_config.get('api_model', None)
                
                model_choice = 'api' if ai_mode == 'api' else local_model

                llm_response = generate_llm_response(
                    prompt=prompt_extract,
                    system_prompt="Bạn là chuyên gia sư phạm và bóc tách thực thể RAG tri thức chuyên nghiệp.",
                    model_choice=model_choice,
                    api_key=api_key if ai_mode == 'api' else None,
                    model_name=api_model if ai_mode == 'api' else None
                )

                cleaned_res = llm_response.strip()
                if cleaned_res.startswith("```"):
                    cleaned_res = re.sub(r"^```(?:json)?\n", "", cleaned_res)
                    cleaned_res = re.sub(r"\n```$", "", cleaned_res)
                cleaned_res = cleaned_res.strip()
                
                parsed_tags = json.loads(cleaned_res)
                if isinstance(parsed_tags, list) and len(parsed_tags) > 0:
                    extracted_tags = [str(t).strip() for t in parsed_tags[:12]]
            except Exception as e:
                print(f"[BG Process] LLM concept extraction failed: {e}. Falling back to keyword analyzer.")

            # Fallback nếu LLM lỗi hoặc offline
            if not extracted_tags:
                common_keywords = ["trải nghiệm", "hướng nghiệp", "kỹ năng", "năng lực", "phẩm chất", "tự học", "hợp tác", "môi trường", "xã hội", "bản thân", "dinh dưỡng", "sức khỏe", "sinh học", "công nghệ"]
                for kw in common_keywords:
                    if kw in markdown_content.lower() or kw in lp.title.lower():
                        extracted_tags.append(kw.title())
                
                # Bổ sung các tag từ attributes cũ nếu có
                old_tags = lp.attributes.get("Từ khóa kiến thức", []) or lp.attributes.get("knowledge_tags", [])
                if isinstance(old_tags, list):
                    for ot in old_tags:
                        if ot not in extracted_tags:
                            extracted_tags.append(ot)
                            
            # Lưu lại vào attributes của bài giảng để vẽ đồ thị (Cho phép tối đa 12 thực thể)
            lp.attributes["Từ khóa kiến thức"] = extracted_tags[:12]
            lp.attributes["knowledge_tags"] = extracted_tags[:12]
            lp.save(update_fields=['attributes'])

            if cls._is_cancelled(lp_id):
                cls._handle_cancellation(lp_id)
                return

            # --- PHASE 5: Obsidian Vault Sync ---
            cls._active_tasks[lp_id]['step'] = 'Đang đồng bộ dữ liệu vào Obsidian Vault (Phase 5)...'
            lp.ai_processing_step = 'Đang đồng bộ dữ liệu vào Obsidian Vault (Phase 5)...'
            lp.save(update_fields=['ai_processing_step'])

            vault_dir = cls.get_vault_path()
            os.makedirs(vault_dir, exist_ok=True)

            # 1. Tạo note bài giảng .md chuẩn Obsidian với WikiLinks
            # Tự động thay các khái niệm bằng [[Khái niệm]] liên kết trong Obsidian
            linked_markdown = markdown_content
            for tag in extracted_tags:
                # Tránh lặp và bọc Wiki-links cho các từ khóa xuất hiện trong văn bản
                pattern = re.compile(re.escape(tag), re.IGNORECASE)
                linked_markdown = pattern.sub(f"[[{tag}]]", linked_markdown)

            clean_filename = re.sub(r'[\/:*?"<>|\r\n\t]', '_', lp.title).strip()
            note_filename = f"{clean_filename}.md"
            note_path = os.path.join(vault_dir, note_filename)

            # Dọn dẹp các tag cũ không còn sử dụng trong lượt trích xuất này
            old_tags = []
            if os.path.exists(note_path):
                try:
                    with open(note_path, 'r', encoding='utf-8', errors='replace') as f:
                        old_content = f.read()
                    yaml_match = YAML_PATTERN.search(old_content)
                    if yaml_match:
                        yaml_content = yaml_match.group(1)
                        tags_section_match = TAGS_SECTION_PATTERN.search(yaml_content)
                        if tags_section_match:
                            for tag_line in tags_section_match.group(1).splitlines():
                                t_match = TAG_ITEM_PATTERN.search(tag_line)
                                if t_match:
                                    old_tags.append(t_match.group(1).strip())
                except Exception as e:
                    print(f"[BG Process] Error reading old tags: {e}")

            # Tìm các tag cũ không còn trong extracted_tags mới để dọn dẹp các ghi chú mồ côi
            for old_tag in old_tags:
                if old_tag not in extracted_tags:
                    old_concept_filename = f"{INVALID_FILE_CHARS.sub('_', old_tag).strip()}.md"
                    old_concept_path = os.path.join(vault_dir, old_concept_filename)
                    if os.path.exists(old_concept_path):
                        try:
                            with open(old_concept_path, 'r', encoding='utf-8') as f:
                                concept_content = f.read()
                            
                            link_line = f"- [[{lp.title}]]"
                            links = WIKILINK_CLEAN_PATTERN.findall(concept_content)
                            
                            # Nếu note khái niệm chỉ liên kết đến bài giảng này, xóa hoàn toàn để tránh mồ côi
                            if len(links) <= 1 and (len(links) == 0 or links[0] == lp.title):
                                os.remove(old_concept_path)
                                print(f"[BG Process] Deleted old orphan concept note: {old_concept_path}")
                            else:
                                # Ngược lại, chỉ xóa dòng liên kết đến bài giảng này
                                updated_lines = [line for line in concept_content.splitlines() if link_line not in line]
                                with open(old_concept_path, 'w', encoding='utf-8') as f:
                                    f.write('\n'.join(updated_lines) + '\n')
                                print(f"[BG Process] Removed link to reprocessed lesson from old concept: {old_tag}")
                        except Exception as e:
                            print(f"[BG Process] Error cleaning old tag {old_tag}: {e}")

            # YAML Front Matter
            front_matter = (
                f"---\n"
                f"title: \"{lp.title}\"\n"
                f"author: \"{lp.creator.full_name or lp.creator.username}\"\n"
                f"subject: \"{lp.attributes.get('Môn học', 'Chưa rõ')}\"\n"
                f"grade: \"{lp.attributes.get('lop', 'Chung')}\"\n"
                f"status: \"{lp.status}\"\n"
                f"type: \"{lp.target_student}\"\n"
                f"created_at: \"{lp.created_at.isoformat() if lp.created_at else timezone.now().isoformat()}\"\n"
                f"tags:\n"
            )
            for t in extracted_tags:
                front_matter += f"  - \"{t}\"\n"
            front_matter += "---\n\n"

            with open(note_path, 'w', encoding='utf-8') as f:
                f.write(front_matter + linked_markdown)

            # 2. Tạo note khái niệm chéo (Concept Notes) để tạo Knowledge Graph hoàn chỉnh
            for tag in extracted_tags:
                concept_filename = f"{INVALID_FILE_CHARS.sub('_', tag.strip()).strip()}.md"
                concept_path = os.path.join(vault_dir, concept_filename)
                
                if not os.path.exists(concept_path):
                    # Dùng LLM tạo mô tả học thuật ngắn gọn cho khái niệm
                    concept_description = ""
                    try:
                        subject = lp.attributes.get('Môn học', 'giáo dục')
                        prompt_concept = (
                            f"Viết 2-3 câu mô tả học thuật súc tích về khái niệm \"{tag}\" "
                            f"trong bối cảnh môn học \"{subject}\" và bài học \"{lp.title}\". "
                            f"Chỉ mô tả bản chất/định nghĩa của khái niệm, không giải thích bài giảng. "
                            f"Bắt buộc viết 100% bằng tiếng Việt chuẩn, học thuật, ngắn gọn, không dùng gạch đầu dòng. "
                            f"Tuyệt đối không sử dụng bất kỳ từ ngữ hay ký tự tiếng nước ngoài nào (đặc biệt là chữ Hán/tiếng Trung như 硅藻门, tiếng Anh...)."
                        )
                        
                        # Đọc cấu hình model của người dùng từ attributes
                        model_config = lp.attributes.get('ai_model_config', {}) if isinstance(lp.attributes, dict) else {}
                        ai_mode = model_config.get('ai_mode', 'local')
                        local_model = model_config.get('local_model', '3b')
                        api_key = model_config.get('api_key', None)
                        api_model = model_config.get('api_model', None)
                        
                        model_choice = 'api' if ai_mode == 'api' else local_model

                        concept_description = generate_llm_response(
                            prompt=prompt_concept,
                            system_prompt=(
                                "Bạn là chuyên gia học thuật Việt Nam. Nhiệm vụ: viết định nghĩa/mô tả học thuật "
                                "ngắn gọn (2-3 câu) cho một khái niệm khoa học/giáo dục. "
                                "Bắt buộc trả về câu trả lời hoàn toàn bằng tiếng Việt phổ thông. "
                                "Tuyệt đối không chèn chữ Hán, tiếng Trung, tiếng Anh hay ký tự lạ. "
                                "Không dùng bullet points. Chỉ trả về đoạn văn mô tả, không thêm tiêu đề hay giải thích."
                            ),
                            model_choice=model_choice,
                            api_key=api_key if ai_mode == 'api' else None,
                            model_name=api_model if ai_mode == 'api' else None
                        ).strip()

                        if concept_description.startswith("### 💬 Xin chào!") or "Trợ lý AI" in concept_description or not concept_description.strip():
                            concept_description = get_wikipedia_academic_definition(tag, subject, lp.title)

                        # Loại bỏ các prefix không cần thiết
                        for prefix in ["Khái niệm:", "Định nghĩa:", f"{tag}:", "**", "*"]:
                            if concept_description.lower().startswith(prefix.lower()):
                                concept_description = concept_description[len(prefix):].strip()
                    except Exception as e:
                        print(f"[BG Process] Concept description generation failed for '{tag}': {e}")
                        concept_description = get_wikipedia_academic_definition(tag, subject, lp.title)

                    with open(concept_path, 'w', encoding='utf-8') as f:
                        f.write(
                            f"---\n"
                            f"type: \"concept\"\n"
                            f"name: \"{tag}\"\n"
                            f"subject: \"{lp.attributes.get('Môn học', '')}\"\n"
                            f"---\n\n"
                            f"# {tag}\n\n"
                            f"{concept_description}\n\n"
                            f"## Các bài học liên quan:\n"
                            f"- 📚 [[{lp.title}]]\n"
                        )
                else:
                    # Nếu note khái niệm đã có, đọc và append thêm bài giảng mới liên quan
                    try:
                        with open(concept_path, 'r', encoding='utf-8') as f:
                            concept_content = f.read()
                        
                        link_line = f"- [[{lp.title}]]"
                        if link_line not in concept_content:
                            with open(concept_path, 'a', encoding='utf-8') as f:
                                f.write(f"{link_line}\n")
                    except Exception:
                        pass

            # Hoàn thành xử lý AI RAG
            lp.ai_processing_status = 'COMPLETED'
            lp.ai_processing_step = 'Hoàn thành xử lý AI & đồng bộ Obsidian Vault!'
            lp.save(update_fields=['ai_processing_status', 'ai_processing_step'])
            cls._stats['success'] += 1
            print(f"[BG Process] Successfully processed: {lp.title}")

        except Exception as e:
            print(f"[BG Process] Processing FAILED for {lp_id}: {e}")
            traceback.print_exc()
            lp.ai_processing_status = 'FAILED'
            lp.ai_processing_step = f"Lỗi: {str(e)}"
            lp.save(update_fields=['ai_processing_status', 'ai_processing_step'])
            cls._stats['failed'] += 1

        finally:
            if lp_id in cls._active_tasks:
                del cls._active_tasks[lp_id]
