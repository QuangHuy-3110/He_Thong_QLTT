# Bản đồ liên kết hệ thống (System Blueprint) - Hệ thống QLTT

Tài liệu này đóng vai trò là **Bản đồ liên kết** giúp lập trình viên và AI hiểu nhanh cấu trúc hệ thống, sơ đồ luồng dữ liệu, và danh sách các tệp cùng hàm quan trọng trong dự án, bao gồm cấu trúc Tái thiết kế AI Knowledge Hub, Graph RAG và Obsidian Integration.

---

## 1. Sơ đồ Cấu trúc Dự án (Project File Tree)

Dưới đây là sơ đồ cây thư mục chi tiết thể hiện đầy đủ các tệp tin mã nguồn cốt lõi trong hệ thống:

```text
He_Thong_QLTT/
├── backend/                      # Mã nguồn Backend (Django, DRF, PostgreSQL)
│   ├── app/                      # Django App chính (Quản lý nghiệp vụ & AI RAG)
│   │   ├── models.py             # Định nghĩa bảng Database (gồm pre_delete Vault Cleanup signals)
│   │   ├── views.py              # Xử lý REST API (an toàn tham số lesson_id query params)
│   │   ├── serializers.py        # Serializers chuyển đổi CSDL sang JSON
│   │   ├── urls.py               # Định tuyến API Route chính
│   │   │
│   │   %% Các tệp tin Core AI Rebuild %%
│   │   ├── bg_processor.py       # Thread chạy ngầm 5 bước (12 thực thể, tối ưu đa mục tiêu)
│   │   ├── embedding_service.py  # Dịch vụ sinh vector nhúng (Ollama / Deterministic Hash fallback)
│   │   ├── graph_rag_service.py  # Thuật toán kết hợp Vector Search & Graph Traversal (RAG Retrieval)
│   │   ├── llm_runner.py         # Cổng suy luận LLM (Thread Lock, n_ctx=4096, Qwen GGUF, APIs)
│   │   └── docx_parser.py        # Bóc tách metadata tự động từ file giáo án Word (.docx)
│   │
│   ├── kms_core/                 # Thiết lập Django Project
│   │   └── settings.py           # Kết nối database, biến môi trường (.env)
│   ├── manage.py                 # File quản trị Django chính
│   └── seed_advanced.py          # Script seed 9 bài giảng mẫu chuyên sâu và tệp tin thực tế
│
├── protoc/                       # Giao diện Frontend (React + Vite + TypeScript)
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx           # Component gốc kiểm soát bố cục và Modal chi tiết 60/40
│   │   │   ├── UploadPage.tsx     # Trang đăng bài giảng (Cây thư mục đệ quy TreeNode)
│   │   │   └── components/       
│   │   │       ├── AuthPage.tsx             # Giao diện Đăng nhập / Đăng ký
│   │   │       ├── UserManagementPage.tsx   # Quản trị tài khoản & Phân quyền đệ quy (ADMIN)
│   │   │       ├── ChatbotWorkspace.tsx     # Chatbot Workspace (Gồm WikiNotes Split-pane & WikiLinks parser)
│   │   └── styles/               # default_shadcn_theme.css
```

---

## 2. Sơ đồ Luồng Dữ liệu (Data Flow Diagram)

### 2.1. Luồng xử lý AI Chạy ngầm (Asynchronous AI Processing Roadmap Flow)
Ngay khi một bài giảng được tải lên thành công, Backend tự động kích hoạt luồng xử lý AI chạy ngầm 5 bước tuần tự:

```text
[Giáo viên / Admin] 
    └──(Tải lên tài liệu .docx / .md)──> [Views.py: Upload/Update API]
                                                   │
                                       (Lưu DB, status: 'PENDING')
                                                   │
                                     (Gửi tín hiệu post_save signal)
                                                   ▼
                                    [bg_processor.py: BackgroundQueue]
                                                   │
                         ┌──────────────────────────┴──────────────────────────┐
                         ▼                                                     ▼
              [Step 1: Parse & Convert]                               [Báo lỗi Windows CP1252?]
           (Chuyển đổi Word sang Markdown)                                     │
                         │                                             (Mã hóa an toàn thay ?)
              [Step 2: Configurable Chunking]                                  │
           (Cắt nhỏ Markdown: Heading/Fixed)                                   ▼
                         │                                          [Tránh sập luồng nền]
              [Step 3: Embedding Generation]
           (Ghép metadata, sinh vector nhúng)
                         │
              [Step 4: LLM Concept Extraction]
           (LLM bóc tách 12 thực thể đa mục tiêu)
                         │
              [Step 5: Obsidian Sync]
           (Tự động ghi tệp .md chéo WikiLinks)
                         │
                         ▼
            [Đổi status -> 'COMPLETED'] ──> (Hiển thị đèn xanh tích trên Roadmap)
```

### 2.2. Luồng truy xuất Graph RAG (Graph RAG Hybrid Retrieval Flow)
Khi người dùng đặt câu hỏi trong khung chat, thuật toán thực hiện truy xuất đa chiều kết hợp:

```text
[Người dùng hỏi Chatbot] 
    └──(Gửi câu hỏi + focus_lesson_id)──> [Views.py: AIChatSendMessageAPIView]
                                                    │
                                        (Kiểm tra nhắc tên tài liệu?)
                                        (Auto-bind focus_lesson_id động)
                                                    │
                                                    ▼
                                    [graph_rag_service.py: Hybrid Search]
                                                    │
               ┌────────────────────────────────────┴────────────────────────────────────┐
               ▼                                                                         ▼
        (Chế độ Focus Mode)                                                      (Chế độ Toàn cục)
     (Trích xuất 4000 ký tự đầu                                               (Vector Search tương đồng top 3)
      bài giảng đang xem trực tiếp)                                                       │
               │                                                                         ▼
               │                                                             (Fallback chéo Keyword Search)
               │                                                                         │
               └────────────────────────────────────┬────────────────────────────────────┘
                                                    │
                                                    ▼
                                    [Graph Traversal (1-hop / 2-hop)]
                                 (Duyệt đồ thị tìm các thư mục chứa,
                                  bài giảng liên quan cùng thư mục, từ khóa)
                                                    │
                                                    ▼
                                         [Tạo chuỗi Context RAG]
                                 (Nạp kèm câu hỏi gửi tới llm_runner.py)
                                                    │
                                                    ▼
                                    [Local GGUF (Thread Lock bảo vệ)]
                                                    │
                                                    ▼
                                         [Trả về Câu trả lời AI]
                               (Highlight các Nodes/Edges trên Graph Canvas)
```

---

## 3. Bản đồ các File và Hàm quan trọng (AI Rebuild Focus)

### 3.1. Phía Backend (`backend/app/`)

#### A. File `backend/app/bg_processor.py` (Asynchronous Roadmaps)
*   **`BackgroundProcessManager.queue_task(lesson_plan_id)`**
    *   **Nhiệm vụ:** Đẩy ID bài giảng vào hàng chờ tiến trình để xử lý ngầm.
*   **`BackgroundProcessManager._process_loop()`**
    *   **Nhiệm vụ:** Vòng lặp tuần tự chạy ngầm trên Thread riêng biệt; đọc cấu hình chia chunk của Admin, thực thi tuần tự 5 bước xử lý và cập nhật tiến độ `ai_processing_step` từng giây.
*   **`Concept Extraction (Phase 4)`**
    *   **Nhiệm vụ:** Gọi mô hình Qwen 2.5 7B với Prompt tối ưu hóa sâu sắc đa mục tiêu để trích xuất **8-12 thực thể** bao gồm cả khái niệm khoa học chuyên ngành lẫn phẩm chất, năng lực sư phạm, lưu trực tiếp vào CSDL để làm giàu Đồ thị Tri thức.

#### B. File `backend/app/models.py` (Vault Automated Cleanups)
*   **`delete_lesson_plan_file(sender, instance, **kwargs)`**
    *   **Nhiệm vụ:** Bộ dọn dẹp Vault tự động khi xóa tài liệu (`pre_delete` signal). Tự động tìm và xóa note `.md` tương ứng trong Obsidian, đồng thời dọn dẹp các ghi chú khái niệm mồ côi hoặc chỉ lọc bỏ dòng liên kết chéo của tài liệu bị xóa, bảo toàn tính toàn vẹn của Knowledge Graph.

#### C. File `backend/app/graph_rag_service.py` (Knowledge Graphs)
*   **`build_virtual_knowledge_graph(user_id)`**
    *   **Nhiệm vụ:** Biên tập toàn bộ mạng lưới bài giảng, thư mục, từ khóa hệ thống thành định dạng đồ thị JSON (Nodes & Edges) để frontend vẽ Graph Canvas. (Đã loại bỏ node tác giả theo yêu cầu).
*   **`retrieve_graph_rag_context(query, user_id, focus_lesson_id, depth)`**
    *   **Nhiệm vụ:** Động cơ cốt lõi thực thi Hybrid Search kết hợp Vector Search pgvector, FTS Keyword Fallback, Graph Traversal và sinh các câu hỏi gợi ý thông minh phù hợp ngữ cảnh.

#### D. File `backend/app/llm_runner.py` (Inference Bridge)
*   **`_gguf_model_lock = threading.Lock()`**
    *   **Nhiệm vụ:** Khóa đồng bộ Thread Lock toàn cục đảm bảo các luồng Django song song không bao giờ truy cập LLM cùng lúc gây crash bộ nhớ cache của llama.cpp.
*   **`generate_llm_response(prompt, system_prompt, model_choice, api_key)`**
    *   **Nhiệm vụ:** Cổng kết nối LLM thông minh; chạy cục bộ GGUF an toàn cao với `n_ctx=4096` tránh tràn ngữ cảnh.

### 3.2. Phía Frontend (`protoc/src/`)

#### A. File `protoc/src/app/components/ChatbotWorkspace.tsx` (Advanced Workspace)
*   **`activeTab: 'wiki'`**: Tab WikiNotes thứ nhất cấp mới.
*   **`WikiNotes Split-Pane Layout`**: Phân chia không gian thành 35% danh sách note và 65% trình đọc kính mờ cao cấp hiển thị nội dung Obsidian Markdown cực kỳ scannable và scrolly-friendly.
*   **`renderWikiContent` (Obsidian WikiLinks Parser)**: Tự động phát hiện định dạng `[[Khái niệm]]` của Obsidian và chuyển chúng thành các nút badge liên kết chéo màu tím tương tác đẹp mắt, hỗ trợ click chuyển ghi chú trực tiếp mượt mà.
*   **`Synchronized Focus System`**: Đồng bộ focus ngầm không tự động bật popup AI khi người dùng xem tài liệu, duy trì phiên chat và bind context tự động.

#### B. File `backend/app/serializers.py` (On-the-fly Parser Extraction)
*   **`LessonPlanSerializer.get_content_preview(obj)`**
    *   **Nhiệm vụ:** Tối ưu hóa chuyển đổi thực tế: Nếu `content_preview` của giáo án là chuỗi tóm tắt ngắn từ seed, tự động gọi `convert_docx_to_markdown` để chuyển đổi tệp Word gốc (.docx) thành Markdown hoàn chỉnh tại thời điểm truy vấn và cập nhật lại Database.

#### C. File `protoc/src/app/components/MindmapFlow.tsx` (Interactive Mindmap Zoom & Fit Controls)
*   **`useReactFlow()` & `fitView`**
    *   **Nhiệm vụ:** Cung cấp nút **🎯 Về giữa** nằm cạnh nút **🔄 Reset** trong sơ đồ tư duy, kích hoạt bộ zoom mượt mà (`duration: 800`, `padding: 0.15`) đưa toàn bộ cấu trúc đồ thị 4 nhánh về trung tâm khung nhìn của giáo viên.

