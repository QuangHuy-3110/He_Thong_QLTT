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
        if not os.path.exists(vault_dir):
            try:
                os.makedirs(vault_dir, exist_ok=True)
            except Exception as e:
                print(f"[get_vault_path] Error creating vault directory: {e}")
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

        # Danh sách các bài giảng bị lỗi (FAILED)
        failed_lessons = []
        failed_objs = LessonPlan.objects.filter(ai_processing_status='FAILED').only('id', 'title', 'ai_processing_step', 'updated_at')
        for flp in failed_objs:
            failed_lessons.append({
                'id': flp.id,
                'title': flp.title,
                'error': flp.ai_processing_step or 'Lỗi không xác định',
                'updated_at': flp.updated_at.isoformat() if flp.updated_at else ''
            })

        # Danh sách tóm tắt tất cả bài giảng để Admin chọn chạy lại
        all_lessons = []
        for l_obj in LessonPlan.objects.only('id', 'title', 'ai_processing_status').order_by('-id'):
            all_lessons.append({
                'id': l_obj.id,
                'title': l_obj.title,
                'ai_processing_status': l_obj.ai_processing_status
            })

        # Đếm tổng thể trong database
        total = LessonPlan.objects.count()
        completed = LessonPlan.objects.filter(ai_processing_status='COMPLETED').count()
        failed = LessonPlan.objects.filter(ai_processing_status='FAILED').count()
        pending = LessonPlan.objects.filter(ai_processing_status__in=['PENDING', 'PROCESSING']).count()

        return {
            'active_task': current_task,
            'pending_queue': pending_list,
            'failed_lessons': failed_lessons,
            'all_lessons': all_lessons,
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
        # Quét và xếp hàng các bài giảng chưa xử lý trong background thread khi worker vừa khởi chạy
        try:
            cls.scan_and_queue_unprocessed()
        except Exception as e:
            print(f"[BG Process] Startup scan error in worker thread: {e}")

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
            markdown_content = ""
            if lp.file_path:
                has_local_path = False
                try:
                    file_path = lp.file_path.path
                    if os.path.exists(file_path):
                        has_local_path = True
                except (NotImplementedError, AttributeError, ValueError):
                    has_local_path = False

                if has_local_path:
                    file_path = lp.file_path.path
                    if file_path.lower().endswith(('.md', '.markdown', '.txt')):
                        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                            markdown_content = f.read()
                    else:
                        markdown_content = convert_docx_to_markdown(file_path)
                else:
                    # Nếu file được lưu trên Remote Storage, đọc file và bọc vào tempfile cục bộ
                    import tempfile
                    suffix = '.docx'
                    if lp.file_path.name.lower().endswith(('.md', '.markdown', '.txt')):
                        suffix = '.md'
                    
                    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
                        temp_file.write(lp.file_path.read())
                        temp_path = temp_file.name
                    
                    try:
                        if suffix == '.md':
                            with open(temp_path, 'r', encoding='utf-8', errors='replace') as f:
                                markdown_content = f.read()
                        else:
                            markdown_content = convert_docx_to_markdown(temp_path)
                    finally:
                        if os.path.exists(temp_path):
                            os.remove(temp_path)
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
                # Triển khai Heading-based Semantic Chunking (tách theo tiêu đề & chia nhỏ nếu phần quá dài)
                lines = markdown_content.split('\n')
                current_heading = "Mở đầu / Giới thiệu"
                current_lines = []
                
                raw_sections = []
                for line in lines:
                    match = HEADER_PATTERN.match(line)
                    if match:
                        if current_lines:
                            raw_sections.append({
                                'heading': current_heading,
                                'content': '\n'.join(current_lines).strip()
                            })
                            current_lines = []
                        current_heading = match.group(2).strip()
                    current_lines.append(line)
                
                if current_lines:
                    raw_sections.append({
                        'heading': current_heading,
                        'content': '\n'.join(current_lines).strip()
                    })

                # Đảm bảo mỗi chunk không vượt quá max chunk_size
                for sec in raw_sections:
                    sec_content = sec['content']
                    sec_heading = sec['heading']
                    if not sec_content:
                        continue
                    if len(sec_content) <= chunk_size:
                        chunks_to_create.append({
                            'heading': sec_heading,
                            'content': sec_content
                        })
                    else:
                        # Tách theo đoạn văn nếu phần mục quá dài
                        sub_paragraphs = [p for p in sec_content.split('\n\n') if p.strip()]
                        accum_text = ""
                        sub_idx = 1
                        for p in sub_paragraphs:
                            if len(accum_text) + len(p) + 2 <= chunk_size:
                                accum_text = (accum_text + "\n\n" + p).strip()
                            else:
                                if accum_text:
                                    chunks_to_create.append({
                                        'heading': f"{sec_heading} (Phần {sub_idx})",
                                        'content': accum_text
                                    })
                                    sub_idx += 1
                                accum_text = p
                        if accum_text:
                            chunks_to_create.append({
                                'heading': f"{sec_heading} (Phần {sub_idx})" if sub_idx > 1 else sec_heading,
                                'content': accum_text
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
                chk_heading = (chk['heading'] or '')[:250]
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
                # Lọc các chunk chứa kiến thức cốt lõi (bỏ qua khởi động, củng cố, dặn dò...)
                saved_chunks = DocumentChunk.objects.filter(lesson_plan=lp).order_by('chunk_index')
                selected_contents = []
                
                pos_keywords = ["tìm hiểu", "kiến thức", "khái niệm", "nội dung", "thực hành", "luyện tập", "thí nghiệm", "phân tích", "đặc điểm", "cấu tạo", "chức năng", "mục tiêu", "yêu cầu cần đạt"]
                neg_keywords = ["khởi động", "dẫn dắt", "dặn dò", "về nhà", "củng cố", "giao nhiệm vụ", "remind", "warm up", "wrap up"]
                
                char_budget = 4000
                current_chars = 0
                
                for chk in saved_chunks:
                    heading_lower = chk.heading.lower()
                    is_core = False
                    
                    # Luôn chọn chunk đầu tiên chứa mục tiêu dạy học
                    if chk.chunk_index == 0:
                        is_core = True
                    else:
                        has_pos = any(pos in heading_lower for pos in pos_keywords)
                        has_neg = any(neg in heading_lower for neg in neg_keywords)
                        if has_pos and not has_neg:
                            is_core = True
                            
                    if is_core:
                        chunk_text = f"### Mục: {chk.heading}\n{chk.content}\n"
                        if current_chars + len(chunk_text) <= char_budget:
                            selected_contents.append(chunk_text)
                            current_chars += len(chunk_text)
                        else:
                            remaining = char_budget - current_chars
                            if remaining > 500:
                                selected_contents.append(f"### Mục: {chk.heading}\n{chk.content[:remaining]}\n")
                            break
                            
                # Fallback nếu không có chunk nào được chọn lọc
                if not selected_contents:
                    core_content_text = markdown_content[:3500]
                else:
                    core_content_text = "\n".join(selected_contents)

                # Tạo prompt tối ưu để bóc tách đúng 5 đến 8 thực thể/khái niệm cốt lõi, loại bỏ từ lan man
                prompt_extract = (
                    f"Dưới đây là nội dung văn bản cốt lõi của tài liệu bài giảng \"{lp.title}\":\n"
                    f"Mô tả: {lp.description or 'Không có mô tả'}\n"
                    f"Nội dung văn bản lọc chọn:\n{core_content_text}\n\n"
                    f"Nhiệm vụ: Hãy phân tích kỹ văn bản trên và trích xuất đúng từ 5 đến 8 khái niệm/thuật ngữ/thực thể trọng tâm và quan trọng nhất.\n"
                    f"YÊU CẦU NGHIÊM NGẶT:\n"
                    f"1. CHỈ trích xuất các khái niệm chuyên môn hoặc thuộc tính cốt lõi XUẤT HIỆN TRỰC TIẾP hoặc liên quan mật thiết nhất trong bài giảng (Ví dụ: 'BMI', 'Dopamine', 'Nhịp sinh học', 'Độ phì đất', 'Vi khuẩn có ích', 'Năng lực giao tiếp'...). Bỏ qua các khái niệm ngoài lề không quan trọng.\n"
                    f"2. Tuyệt đối TRÁNH các từ ngữ lan man, chung chung hoặc từ hoạt động như: 'Thảo luận', 'Trò chơi', 'Hình ảnh', 'Hoạt động', 'Thực hành', 'Giáo án', 'Học sinh', 'Giáo viên', 'Đại diện', 'Báo cáo', 'Poster', 'Tài liệu', 'Bài học'.\n"
                    f"3. Trả về kết quả dưới dạng MỘT danh sách JSON duy nhất gồm từ 5 đến 8 chuỗi (Ví dụ: [\"Khái niệm 1\", \"Khái niệm 2\", ...]). Không thêm bất kỳ lời giải thích nào khác."
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

                # Loại bỏ các ký tự xuống dòng không hợp lệ bên trong chuỗi JSON nếu có
                cleaned_res = re.sub(r'[\r\n\t]+', ' ', llm_response.strip())
                # Tìm mảng JSON dạng [...] nếu LLM có trả về thêm văn bản xung quanh
                json_match = re.search(r'\[.*\]', cleaned_res)
                if json_match:
                    cleaned_res = json_match.group(0)

                parsed_tags = json.loads(cleaned_res, strict=False)
                if isinstance(parsed_tags, list) and len(parsed_tags) > 0:
                    extracted_tags = [str(t).strip() for t in parsed_tags[:8]]
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
                            
            # Lưu lại vào attributes của bài giảng để vẽ đồ thị (Tối đa 8 thực thể trọng tâm)
            lp.attributes["Từ khóa kiến thức"] = extracted_tags[:8]
            lp.attributes["knowledge_tags"] = extracted_tags[:8]
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

            # 2. Tạo note khái niệm chéo (Concept Notes) và lưu trực tiếp vào Bảng ConceptNote trên Supabase DB
            from .models import ConceptNote

            for tag in extracted_tags:
                tag_name = tag.strip()
                if not tag_name:
                    continue

                concept_obj, created = ConceptNote.objects.get_or_create(
                    name=tag_name,
                    defaults={'subject': lp.attributes.get('Môn học', '')}
                )
                concept_obj.lessons.add(lp)

                # Nếu chưa có định nghĩa (hoặc mới khởi tạo), gọi LLM để tạo và lưu trực tiếp vào CSDL Supabase
                if created or not concept_obj.description:
                    concept_description = ""
                    try:
                        subject = lp.attributes.get('Môn học', 'giáo dục')
                        prompt_concept = (
                            f"Viết 2-3 câu mô tả học thuật súc tích về khái niệm \"{tag_name}\" "
                            f"trong bối cảnh môn học \"{subject}\" và bài học \"{lp.title}\". "
                            f"Chỉ mô tả bản chất/định nghĩa của khái niệm, không giải thích bài giảng. "
                            f"Bắt buộc viết 100% bằng tiếng Việt chuẩn, học thuật, ngắn gọn, không dùng gạch đầu dòng. "
                            f"Tuyệt đối không sử dụng bất kỳ từ ngữ hay ký tự tiếng nước ngoài nào (đặc biệt là chữ Hán/tiếng Trung như 硅藻门, tiếng Anh...)."
                        )
                        
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
                            concept_description = get_wikipedia_academic_definition(tag_name, subject, lp.title)

                        for prefix in ["Khái niệm:", "Định nghĩa:", f"{tag_name}:", "**", "*"]:
                            if concept_description.lower().startswith(prefix.lower()):
                                concept_description = concept_description[len(prefix):].strip()
                    except Exception as e:
                        print(f"[BG Process] Concept description generation failed for '{tag_name}': {e}")
                        concept_description = get_wikipedia_academic_definition(tag_name, subject, lp.title)

                    concept_obj.description = concept_description
                    concept_obj.save(update_fields=['description'])

                # Đồng bộ thêm file .md vật lý cục bộ nếu có thư mục vault
                concept_filename = f"{INVALID_FILE_CHARS.sub('_', tag_name).strip()}.md"
                concept_path = os.path.join(vault_dir, concept_filename)
                try:
                    with open(concept_path, 'w', encoding='utf-8') as f:
                        f.write(
                            f"---\n"
                            f"type: \"concept\"\n"
                            f"name: \"{tag_name}\"\n"
                            f"subject: \"{lp.attributes.get('Môn học', '')}\"\n"
                            f"---\n\n"
                            f"# {tag_name}\n\n"
                            f"{concept_obj.description or 'Định nghĩa khái niệm'}\n\n"
                            f"## Các bài học liên quan:\n"
                            f"- 📚 [[{lp.title}]]\n"
                        )
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
