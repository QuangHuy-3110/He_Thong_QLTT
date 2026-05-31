import os
import re
import queue
import json
import threading
import traceback
from datetime import datetime
from django.utils import timezone
from django.db.models import Q

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

# Thread-safe global processor queue
class BackgroundProcessManager:
    _queue = queue.Queue()
    _lock = threading.Lock()
    _worker_thread = None
    _active_tasks = {}  # {lp_id: {'step': str, 'queued_at': datetime}}
    _stats = {'success': 0, 'failed': 0}

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
        """
        from .models import LessonPlan
        unprocessed = LessonPlan.objects.filter(~Q(ai_processing_status='COMPLETED'))
        count = unprocessed.count()
        if count > 0:
            print(f"Found {count} unprocessed lesson plans. Queueing them for background processing...")
            for lp in unprocessed:
                cls.queue_task(lp.id)

    @classmethod
    def _worker_loop(cls):
        while True:
            try:
                # Đợi có task trong queue
                lp_id = cls._queue.get()
                if lp_id is None:
                    break

                cls._process_lesson_plan(lp_id)
                cls._queue.task_done()
            except Exception as e:
                print(f"Error in background worker thread: {e}")
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
                header_pattern = re.compile(r'^(#{1,6})\s+(.*)$')
                
                for line in lines:
                    match = header_pattern.match(line)
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

            # --- PHASE 3: Embedding Generation with Metadata Prepend ---
            total_chunks = len(chunks_to_create)
            cls._active_tasks[lp_id]['step'] = f'Đang sinh Vector nhúng RAG (Phase 3: Khởi tạo... 0/{total_chunks} chunks)'
            lp.ai_processing_step = f'Đang sinh Vector nhúng RAG (Phase 3: Khởi tạo... 0/{total_chunks} chunks)'
            lp.save(update_fields=['ai_processing_step'])

            for idx, chk in enumerate(chunks_to_create):
                chk_content = chk['content']
                chk_heading = chk['heading']

                # Cập nhật tiến độ chi tiết từng chunk cho frontend thấy
                progress_step = f'Đang sinh Vector nhúng RAG (Phase 3: Đang nhúng chunk {idx + 1}/{total_chunks} - {chk_heading[:30]}...)'
                cls._active_tasks[lp_id]['step'] = progress_step
                lp.ai_processing_step = progress_step
                lp.save(update_fields=['ai_processing_step'])

                # Metadata Prepend: Nạp context tài liệu vào đầu văn bản để embedding giàu nghĩa
                prepend_text = f"Tài liệu: {lp.title} | Môn: {lp.attributes.get('Môn học', 'Chưa rõ')} | Mục: {chk_heading}\n\n"
                enriched_text = prepend_text + chk_content

                # Gọi service sinh embedding vector 1536 chiều
                emb_vector = get_embedding(enriched_text, provider="local")
                
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

                llm_response = generate_llm_response(
                    prompt=prompt_extract,
                    system_prompt="Bạn là chuyên gia sư phạm và bóc tách thực thể RAG tri thức chuyên nghiệp.",
                    model_choice="7b"  # Sử dụng model Qwen 2.5 7B mạnh mẽ để bóc tách thực thể tối ưu
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
                concept_filename = f"{re.sub(r'[\/:*?\"<>|\r\n\t]', '_', tag).strip()}.md"
                concept_path = os.path.join(vault_dir, concept_filename)
                
                if not os.path.exists(concept_path):
                    with open(concept_path, 'w', encoding='utf-8') as f:
                        f.write(
                            f"---\n"
                            f"type: \"concept\"\n"
                            f"name: \"{tag}\"\n"
                            f"---\n\n"
                            f"# Khái niệm: {tag}\n\n"
                            f"Khái niệm tri thức sư phạm được trích xuất tự động từ hệ thống KMS.\n\n"
                            f"## Các bài học liên quan:\n"
                            f"- [[{lp.title}]]\n"
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
