from django.db.models import Q
from django.core.cache import cache
from .models import LessonPlan, Directory, User, DocumentChunk, remove_vietnamese_accents
from .embedding_service import get_embedding
import re

# Pre-compiled Regex Patterns for Performance
INVALID_FILE_CHARS = re.compile(r'[\/:*?"<>|\r\n\t]')
YAML_PATTERN = re.compile(r'^---\n.+?\n---\n*', re.DOTALL)
WORD_PATTERN = re.compile(r'\w+')
CODE_BLOCK_START = re.compile(r"^```(?:json)?\n")
CODE_BLOCK_END = re.compile(r"\n```$")

class GraphCacheManager:
    CACHE_KEY_PREFIX = "kms_knowledge_graph"

    @classmethod
    def get_cache_key(cls, user_id=None):
        if not user_id:
            return f"{cls.CACHE_KEY_PREFIX}_public"
        try:
            user = User.objects.get(id=user_id)
            if user.role == 'ADMIN':
                return f"{cls.CACHE_KEY_PREFIX}_admin"
            else:
                return f"{cls.CACHE_KEY_PREFIX}_user_{user_id}"
        except Exception:
            return f"{cls.CACHE_KEY_PREFIX}_public"

    @classmethod
    def get_graph(cls, user_id=None):
        key = cls.get_cache_key(user_id)
        return cache.get(key)

    @classmethod
    def set_graph(cls, graph_data, user_id=None):
        key = cls.get_cache_key(user_id)
        cache.set(key, graph_data, timeout=86400)

    @classmethod
    def invalidate_all(cls):
        cache.clear()

def build_virtual_knowledge_graph(user_id=None, focus_lesson_id=None, hop_depth=2):
    """
    Xây dựng toàn bộ Đồ thị Tri thức dưới dạng danh sách Nodes và Edges.
    - Nếu focus_lesson_id được truyền vào: Trả về đồ thị sơ đồ tư duy (mindmap) của riêng tài liệu đó theo hop_depth.
    - Nếu không: Trả về toàn bộ đồ thị tri thức hệ thống.
    """
    # Nếu đang ở chế độ focus bài giảng, lấy đồ thị đầy đủ của user (từ cache nếu có) rồi chạy BFS
    if focus_lesson_id:
        full_graph = build_virtual_knowledge_graph(user_id=user_id)
        nodes = full_graph.get("nodes", [])
        edges = full_graph.get("edges", [])
        
        target_id = f"lesson_{focus_lesson_id}"
        # Đảm bảo bài giảng focus tồn tại
        if not any(n["id"] == target_id for n in nodes):
            return {"nodes": [], "edges": []}
            
        visited = {target_id}
        for _ in range(hop_depth):
            next_nodes = set()
            for edge in edges:
                if edge["source"] in visited:
                    next_nodes.add(edge["target"])
                if edge["target"] in visited:
                    next_nodes.add(edge["source"])
            visited.update(next_nodes)
            
        filtered_nodes = []
        for node in nodes:
            if node["id"] in visited:
                node_copy = dict(node)
                if node["id"] == target_id:
                    node_copy["val"] = 35 # Nút trung tâm nổi bật nhất
                    node_copy["details"] = f"Tài liệu trọng tâm | " + node_copy.get("details", "")
                filtered_nodes.append(node_copy)
                
        filtered_edges = [edge for edge in edges if edge["source"] in visited and edge["target"] in visited]
        return {"nodes": filtered_nodes, "edges": filtered_edges}

    # Nếu truy vấn toàn bộ đồ thị, thử lấy từ cache trước
    cached_graph = GraphCacheManager.get_graph(user_id)
    if cached_graph is not None:
        return cached_graph

    nodes = []
    edges = []
    
    # 1. Thu thập Nodes Thư mục
    dirs = Directory.objects.all()
    for d in dirs:
        nodes.append({
            "id": f"dir_{d.id}",
            "label": d.name,
            "type": "directory",
            "val": 20,
            "color": "#3b82f6", # Blue
            "details": f"Thư mục {'Công khai' if d.is_public else 'Cá nhân'}"
        })
        if d.parent:
            edges.append({
                "source": f"dir_{d.parent.id}",
                "target": f"dir_{d.id}",
                "type": "SUB_DIR",
                "color": "#93c5fd"
            })

    # 2. Thu thập Nodes Giáo án (Bài giảng)
    lps = LessonPlan.objects.all()
    if user_id:
        try:
            req_user = User.objects.get(id=user_id)
            if req_user.role != 'ADMIN':
                lps = lps.filter(Q(status='PUBLISHED') | Q(creator=req_user))
        except (User.DoesNotExist, ValueError, TypeError):
            lps = lps.filter(status='PUBLISHED')
    else:
        lps = lps.filter(status='PUBLISHED')
        
    tags_seen = set()
    
    for lp in lps:
        nodes.append({
            "id": f"lesson_{lp.id}",
            "label": lp.title,
            "type": "lesson",
            "val": 25,
            "color": "#f59e0b", # Amber
            "details": f"Môn: {lp.attributes.get('Môn học', 'Chưa rõ')} | Lớp: {', '.join(lp.attributes.get('lop', [])) if isinstance(lp.attributes.get('lop'), list) else lp.attributes.get('lop', 'Chưa rõ')}"
        })
        
        for d in lp.directories.all():
            edges.append({
                "source": f"dir_{d.id}",
                "target": f"lesson_{lp.id}",
                "type": "CONTAINS_FILE",
                "color": "#fcd34d"
            })
            
        raw_tags = lp.attributes.get("Từ khóa kiến thức", []) or lp.attributes.get("knowledge_tags", [])
        if isinstance(raw_tags, str):
            raw_tags = [t.strip() for t in raw_tags.split(",") if t.strip()]
            
        if not raw_tags:
            keywords = ["trải nghiệm", "hướng nghiệp", "kỹ năng", "tự học", "hợp tác", "môi trường", "xã hội", "bản thân", "dinh dưỡng", "sinh học", "công nghệ"]
            for kw in keywords:
                if kw in lp.title.lower():
                    raw_tags.append(kw.title())
                    
        for tag in raw_tags:
            tag_slug = tag.strip().lower()
            if not tag_slug:
                continue
            if tag_slug not in tags_seen:
                tags_seen.add(tag_slug)
                
                sanitized_tag = re.sub(r'[^a-zA-Z0-9_\-]', '', remove_vietnamese_accents(tag_slug).replace(' ', '_'))
                concept_cache_key = f"concept_desc_{sanitized_tag}"
                details = cache.get(concept_cache_key)
                if details is None:
                    details = "Khái niệm kiến thức / Chủ đề"
                    try:
                        from .bg_processor import BackgroundProcessManager
                        import os
                        vault_dir = BackgroundProcessManager.get_vault_path()
                        concept_filename = f"{INVALID_FILE_CHARS.sub('_', tag.strip()).strip()}.md"
                        concept_path = os.path.join(vault_dir, concept_filename)
                        if os.path.exists(concept_path):
                            with open(concept_path, 'r', encoding='utf-8', errors='replace') as f:
                                note_content = f.read()
                            # Loại bỏ YAML front matter
                            content_no_yaml = YAML_PATTERN.sub('', note_content).strip()
                            # Lấy phần mô tả (bỏ phần tiêu đề # và phần các bài học liên quan)
                            desc_lines = []
                            for line in content_no_yaml.splitlines():
                                line_stripped = line.strip()
                                if line_stripped.startswith('#'):
                                    continue
                                if 'các bài học liên quan' in line_stripped.lower() or line_stripped.startswith('-') or line_stripped.startswith('*'):
                                    break
                                if line_stripped:
                                    desc_lines.append(line_stripped)
                            if desc_lines:
                                details = ' '.join(desc_lines)
                    except Exception as e:
                        print(f"Error reading concept details for graph: {e}")
                    cache.set(concept_cache_key, details, timeout=86400)

                nodes.append({
                    "id": f"tag_{tag_slug}",
                    "label": tag.strip(),
                    "type": "tag",
                    "val": 12,
                    "color": "#8b5cf6", # Purple
                    "details": details
                })
            edges.append({
                "source": f"lesson_{lp.id}",
                "target": f"tag_{tag_slug}",
                "type": "HAS_TAG",
                "color": "#c084fc"
            })
            
    graph_data = {"nodes": nodes, "edges": edges}
    GraphCacheManager.set_graph(graph_data, user_id)
    return graph_data


def retrieve_graph_rag_context(query, user_id=None, focus_lesson_id=None, depth=2, api_key=None):
    """
    Hàm truy xuất Hybrid Search kết hợp:
      - Vector Search trên pgvector (hoặc Keyword Search dự phòng).
      - Graph Traversal (1-hop / 2-hop) từ các nút kết quả.
      - Chế độ tập trung vào tài liệu chi tiết (focus_lesson_id) nếu được chỉ định.
    Trả về:
      - context: Chuỗi văn bản để đưa vào prompt cho LLM.
      - retrieved_graph: Tập hợp con của đồ thị (Nodes & Edges liên quan) để Frontend highlight.
      - suggested_questions: Mảng các câu hỏi gợi ý phù hợp ngữ cảnh.
    """
    retrieved_node_ids = set()
    retrieved_chunks = []
    focused_lesson = None
    sister_lessons = []
    
    # --- CHẾ ĐỘ 1: TẬP TRUNG TÀI LIỆU CHỈ ĐỊNH (FOCUS MODE) ---
    if focus_lesson_id:
        try:
            focused_lesson = LessonPlan.objects.get(id=focus_lesson_id)
            retrieved_node_ids.add(f"lesson_{focused_lesson.id}")
            
            # Lấy các thư mục chứa bài giảng
            for d in focused_lesson.directories.all():
                retrieved_node_ids.add(f"dir_{d.id}")
                
                # Tìm kiếm bài giảng cùng thư mục (Sister Lessons)
                sisters = d.lesson_plans.exclude(id=focused_lesson.id).filter(status='PUBLISHED')[:3]
                for sister in sisters:
                    sister_lessons.append(sister)
                    retrieved_node_ids.add(f"lesson_{sister.id}")
                    
            # Phân tích nội dung chi tiết bài giảng focus
            preview = focused_lesson.content_preview or ""
            retrieved_chunks.append({
                "title": focused_lesson.title,
                "content": preview[:4000],  # Lấy tối đa 4000 ký tự đầu để tránh tràn ngữ cảnh
                "type": "focus"
            })
        except LessonPlan.DoesNotExist:
            pass

    # --- CHẾ ĐỘ 2: TRUY VẤN TOÀN CỤC HOẶC TÌM KIẾM BỔ TRỢ ---
    # Chạy tìm kiếm ngữ nghĩa/toàn văn để tìm các tài liệu khớp
    candidates = LessonPlan.objects.filter(status='PUBLISHED')
    if user_id:
        try:
            req_user = User.objects.get(id=user_id)
            if req_user.role != 'ADMIN':
                candidates = LessonPlan.objects.filter(Q(status='PUBLISHED') | Q(creator=req_user))
        except (User.DoesNotExist, ValueError, TypeError):
            pass
            
    matched_lessons = []
    
    # Nếu có query tìm kiếm cụ thể (không phải lời chào đơn thuần)
    is_genuine_query = len(query.strip()) > 3 and not any(greet in query.lower() for greet in ["hello", "hi", "xin chào", "chào bạn"])
    
    if is_genuine_query:
        # A. Thử tìm kiếm Vector tương đồng nếu pgvector hoạt động
        try:
            query_vector = get_embedding(query, api_key=api_key, provider="api" if api_key else "local")
            # Truy vấn Vector tương đồng top 3
            chunks = DocumentChunk.objects.filter(lesson_plan__in=candidates).annotate(
                distance=1 - DocumentChunk.embedding.cosine_similarity(query_vector) # Cosine Distance
            ).order_by('distance')[:3]
            
            for chunk in chunks:
                if chunk.lesson_plan not in matched_lessons:
                    matched_lessons.append(chunk.lesson_plan)
                retrieved_chunks.append({
                    "title": chunk.lesson_plan.title,
                    "content": chunk.content,
                    "type": "vector"
                })
        except Exception:
            # Nếu pgvector chưa cấu hình hoặc lỗi, fallback qua PostgreSQL Full-Text Search hoặc text matching
            pass

        # B. Fallback Keyword Match nếu Vector tìm kiếm ra ít kết quả
        if len(matched_lessons) < 2:
            try:
                from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank
                # Sử dụng PostgreSQL Full-Text Search (FTS) với trọng số: title quan trọng hơn content_preview
                vector = SearchVector('title', weight='A') + SearchVector('content_preview', weight='B')
                search_query = SearchQuery(query)
                
                k_matches = candidates.annotate(
                    rank=SearchRank(vector, search_query)
                ).filter(rank__gte=0.05).exclude(id=focus_lesson_id if focus_lesson_id else -1).order_by('-rank')[:3]
                
                for match in k_matches:
                    if match not in matched_lessons:
                        matched_lessons.append(match)
                        retrieved_chunks.append({
                            "title": match.title,
                            "content": match.content_preview[:2000] if match.content_preview else "",
                            "type": "keyword"
                        })
            except Exception as e:
                # Fallback nếu không dùng PostgreSQL (ví dụ SQLite khi test) hoặc lỗi FTS
                words = [w.lower() for w in WORD_PATTERN.findall(query) if len(w) > 2]
                if words:
                    keyword_q = Q()
                    for word in words[:4]:
                        keyword_q |= Q(title__icontains=word) | Q(content_preview__icontains=word)
                    k_matches = candidates.filter(keyword_q).exclude(id=focus_lesson_id if focus_lesson_id else -1)[:3]
                    for match in k_matches:
                        if match not in matched_lessons:
                            matched_lessons.append(match)
                            retrieved_chunks.append({
                                "title": match.title,
                                "content": match.content_preview[:2000] if match.content_preview else "",
                                "type": "keyword"
                            })
                        
    # Thêm các bài giảng tìm thấy vào danh sách nút được kích hoạt
    for lp in matched_lessons[:3]:
        retrieved_node_ids.add(f"lesson_{lp.id}")
        for d in lp.directories.all():
            retrieved_node_ids.add(f"dir_{d.id}")

    # --- CHẠY GRAPH TRAVERSAL ĐỂ GOM TIẾP CÁC NÚT LIÊN QUAN (1-hop / 2-hop) ---
    all_graph = build_virtual_knowledge_graph(user_id)
    retrieved_nodes = []
    retrieved_edges = []
    
    # Tạo set các slug từ khóa có trong tiêu đề các bài giảng đã gom
    relevant_tag_slugs = set()
    for node_id in list(retrieved_node_ids):
        if node_id.startswith("lesson_"):
            title = next((n["label"] for n in all_graph["nodes"] if n["id"] == node_id), "").lower()
            for kw in ["trải nghiệm", "hướng nghiệp", "kỹ năng", "tự học", "hợp tác", "môi trường", "xã hội", "bản thân", "dinh dưỡng", "sinh học", "công nghệ"]:
                if kw in title:
                    relevant_tag_slugs.add(f"tag_{kw}")

    # Thêm từ khóa vào các nút cần lấy
    for tag_id in relevant_tag_slugs:
        retrieved_node_ids.add(tag_id)

    # Lọc danh sách Nodes & Edges thuộc về tập hợp nút được kích hoạt
    for node in all_graph["nodes"]:
        if node["id"] in retrieved_node_ids:
            # Highlight các nút này lên
            highlighted_node = dict(node)
            highlighted_node["highlighted"] = True
            highlighted_node["val"] = node["val"] * 1.5 # Phóng to nút RAG
            retrieved_nodes.append(highlighted_node)
            
    for edge in all_graph["edges"]:
        if edge["source"] in retrieved_node_ids and edge["target"] in retrieved_node_ids:
            highlighted_edge = dict(edge)
            highlighted_edge["highlighted"] = True
            retrieved_edges.append(highlighted_edge)

    # --- XÂY DỰNG CHUỖI CONTEXT PROMPT ---
    context_parts = []
    
    if focused_lesson:
        context_parts.append(f"### TÀI LIỆU TRỌNG TÂM ĐANG XEM:\n- **Tiêu đề:** {focused_lesson.title}\n- **ID bài giảng:** {focused_lesson.id}\n- **Tác giả:** {focused_lesson.creator.full_name or focused_lesson.creator.username}\n- **Mô tả:** {focused_lesson.description or 'Chưa có mô tả'}\n- **Lớp/Môn:** {focused_lesson.attributes.get('Môn học', 'Sinh học')} | Lớp {', '.join(focused_lesson.attributes.get('lop', [])) if isinstance(focused_lesson.attributes.get('lop'), list) else focused_lesson.attributes.get('lop', '')}\n- **Nội dung tóm tắt chi tiết bài học:**\n{focused_lesson.content_preview[:3000]}\n")
        
        if sister_lessons:
            context_parts.append("### CÁC TÀI LIỆU CÙNG DANH MỤC LIÊN QUAN (Graph 1-hop):")
            for sis in sister_lessons:
                context_parts.append(f"- Bài giảng \"{sis.title}\" của tác giả {sis.creator.full_name or sis.creator.username} (ID: {sis.id}) (Trạng thái: {sis.status})")
                
    # Thống kê & Thuộc tính của tất cả tài liệu PUBLISHED hệ thống để LLM trả lời so sánh, thống kê chéo (chỉ nạp khi không ở chế độ Focus tài liệu để tối ưu hóa ngữ cảnh)
    if not focus_lesson_id:
        all_lessons = LessonPlan.objects.filter(status='PUBLISHED').select_related('creator')
        if all_lessons.exists():
            catalog_lines = []
            catalog_lines.append("### DANH MỤC & THUỘC TÍNH TẤT CẢ TÀI LIỆU TRÊN HỆ THỐNG (Dùng cho truy vấn thống kê, tìm kiếm chéo theo thuộc tính):")
            catalog_lines.append(f"- **Tổng số tài liệu công khai trên hệ thống:** {all_lessons.count()}")
            for lp in all_lessons:
                # Filter clean attributes
                clean_attrs = {}
                for k, v in lp.attributes.items():
                    if k not in ["tien_trinh_day_hoc", "knowledge_tags"]:
                        clean_attrs[k] = v
                attrs_str = ", ".join([f"{k}: {v}" for k, v in clean_attrs.items()]) if clean_attrs else "Không có thuộc tính định danh"
                catalog_lines.append(
                    f"- **Bài giảng:** {lp.title} (ID: {lp.id})\n"
                    f"  * Tác giả: {lp.creator.full_name or lp.creator.username} | Đối tượng: {lp.target_student or 'Chưa rõ'}\n"
                    f"  * Mô tả ngắn: {lp.description or 'Chưa có mô tả'}\n"
                    f"  * Siêu dữ liệu thuộc tính: {attrs_str}"
                )
            context_parts.append("\n".join(catalog_lines) + "\n")


    if retrieved_chunks:
        context_parts.append("### CÁC TÀI LIỆU TRÍCH XUẤT LIÊN QUAN TỪ HỆ THỐNG (Vector Search & Graph RAG):")
        # Gom nhóm các đoạn trích theo tài liệu để hiển thị gộp thông tin thuộc tính & nội dung
        from collections import defaultdict
        lesson_chunks = defaultdict(list)
        for chunk in retrieved_chunks:
            if chunk["type"] == "focus":
                continue
            lesson_chunks[chunk["title"]].append(chunk["content"])
            
        for title, contents in lesson_chunks.items():
            # Tìm đối tượng bài giảng tương ứng để lấy attributes
            try:
                lesson_obj = LessonPlan.objects.filter(title=title).first()
            except Exception:
                lesson_obj = None
                
            attr_str = ""
            desc_str = ""
            creator_str = ""
            id_str = ""
            if lesson_obj:
                id_str = f" (ID: {lesson_obj.id})"
                creator_str = f" - Tác giả: {lesson_obj.creator.full_name or lesson_obj.creator.username}"
                desc_str = f" - Mô tả: {lesson_obj.description or 'Chưa có mô tả'}\n"
                
                # Format các thuộc tính
                attrs = []
                for k, v in lesson_obj.attributes.items():
                    if k not in ["tien_trinh_day_hoc", "knowledge_tags"]:
                        attrs.append(f"**{k}:** {v}")
                if attrs:
                    attr_str = f" - Thuộc tính: {', '.join(attrs)}\n"
            
            combined_content = "\n[Đoạn trích]:\n".join([c[:1200] for c in contents])
            
            context_parts.append(
                f"- **Bài giảng:** {title}{id_str}{creator_str}\n"
                f"{desc_str}"
                f"{attr_str}"
                f" - **Nội dung trích xuất (Markdown):**\n\"\"\"\n{combined_content}\n\"\"\"\n"
            )

    context_str = "\n".join(context_parts)

    # --- TỰ ĐỘNG SINH CÂU HỎI GỢI Ý PHÙ HỢP NGỮ CẢNH ---
    suggested_questions = []
    if focused_lesson:
        try:
            from .llm_runner import generate_llm_response
            import json
            
            prompt_suggest = (
                f"Dưới đây là phần mô tả tóm tắt của tài liệu: \"{focused_lesson.title}\":\n"
                f"Mô tả: {focused_lesson.description or 'Không có mô tả'}\n"
                f"Lớp/Môn: {focused_lesson.attributes.get('Môn học', 'Sinh học')} | Lớp {focused_lesson.attributes.get('lop', '')}\n"
                f"Nội dung tóm tắt: {focused_lesson.content_preview[:1500] if focused_lesson.content_preview else 'Không có nội dung'}\n\n"
                f"Hãy phân tích nội dung trên và đề xuất đúng 3 câu hỏi gợi ý ngắn gọn (mỗi câu không quá 15 từ) để giáo viên có thể click hỏi thêm về bài giảng này. "
                f"Ví dụ: 'Tóm tắt hoạt động 1 của bài?', 'Đề xuất trò chơi khởi động phù hợp?', 'Mục tiêu kiến thức trọng tâm là gì?'\n"
                f"Trả về kết quả dưới dạng danh sách JSON chứa đúng 3 chuỗi. Bắt buộc phải là định dạng JSON hợp lệ, ví dụ: [\"câu hỏi 1\", \"câu hỏi 2\", \"câu hỏi 3\"]. "
                f"Không trả về bất kỳ từ giải thích nào khác."
            )
            
            provider = "api" if api_key else "3b"
            llm_res = generate_llm_response(
                prompt=prompt_suggest,
                system_prompt="Bạn là trợ lý AI sư phạm, chuyên môn phân tích giáo án và gợi ý câu hỏi thảo luận.",
                model_choice=provider,
                api_key=api_key
            )
            
            cleaned_res = llm_res.strip()
            if cleaned_res.startswith("```"):
                cleaned_res = CODE_BLOCK_START.sub("", cleaned_res)
                cleaned_res = CODE_BLOCK_END.sub("", cleaned_res)
            cleaned_res = cleaned_res.strip()
            
            parsed_questions = json.loads(cleaned_res)
            if isinstance(parsed_questions, list) and len(parsed_questions) >= 3:
                suggested_questions = [str(q).strip() for q in parsed_questions[:3]]
        except Exception as e:
            print(f"Error generating suggestions via LLM: {e}. Falling back to default suggestions.")
            
        if not suggested_questions:
            suggested_questions = [
                f"Tóm tắt hoạt động dạy học của bài {focused_lesson.title}?",
                f"Tìm kiếm các tài liệu tương tự hoặc liên quan đến bài {focused_lesson.title}?",
                f"Phương pháp sư phạm áp dụng cho giáo án {focused_lesson.title}?"
            ]
    else:
        suggested_questions = [
            "Hệ thống có bao nhiêu tài liệu và phân bố môn học như thế nào?",
            "Tìm tài liệu môn Vật lý thuộc lớp 10?",
            "Đề xuất giáo án về Quy luật Mendel?"
        ]

    return {
        "context": context_str,
        "retrieved_graph": {"nodes": retrieved_nodes, "edges": retrieved_edges},
        "suggested_questions": suggested_questions,
        "retrieved_node_ids": list(retrieved_node_ids)
    }
