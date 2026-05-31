# Kiến trúc Hệ thống QLTT (He_Thong_QLTT)

Tài liệu này mô tả cấu trúc tổng thể và kiến trúc công nghệ của Hệ thống Quản lý Tri thức Học tập (KMS - Knowledge Management System), đặc biệt tập trung vào giải pháp nâng cấp AI Knowledge Hub, Graph RAG và Obsidian Sync cao cấp.

## 1. Sơ đồ Kiến trúc Tổng thể (System Architecture Diagram)

Hệ thống được thiết kế theo mô hình **Client-Server** ba lớp (3-tier) tối ưu hóa khả năng chạy offline mượt mà:

```mermaid
graph TD
    %% Frontend Components
    subgraph Frontend [UI/UX Client: Vite + React + TS]
        A[Dashboard & Library] <-->|Đèn báo Roadmap động| B[AI Processing Hub]
        A <-->|Liên kết thông minh| C[Chatbot Workspace]
        C -->|Force Graph Canvas| D[Interactive Knowledge Graph]
        C -->|Split-Pane Reader & WikiLinks| W[Premium WikiNotes Tab]
        C <-->|Config Settings| E[Admin Chunking Panel]
    end

    %% Django Backend Lớp trung gian
    subgraph Backend [Server: Django REST Framework]
        F[API Gateways & Routers] <-->|Asynchronous Signaling| G[Background Process Manager]
        G -->|Step 1: Extract| H[minerU / python-docx Parser]
        G -->|Step 2: Split| I{Admin Chunking Strategy}
        I -->|Heading Split| I1[Semantic H1/H2/H3]
        I -->|Fixed Size| I2[Fixed Window + Overlap]
        G -->|Step 3: Vector| J[Embedding Service]
        G -->|Step 4: Extract Graph| K[LLM 12 Concepts Extractor]
        G -->|Step 5: Synced Notes| L[Obsidian Vault Writer]
        
        M[Graph RAG Hybrid Engine] <-->|Vector + Graph Traversal| F
        F <-->|Vault Signals Cleanup| O1[Pre Delete Receiver]
    end

    %% Database Lớp dữ liệu
    subgraph Database [Storage: PostgreSQL + Docker]
        N[(PostgreSQL DB)]
        O[(pgvector nomic-embed)]
        P[(Knowledge Graph DB)]
        
        Backend <-->|SQL / Vector Query| Database
    end

    %% AI Model Engines
    subgraph AIEngines [AI Inference Engines]
        Q{Qwen 2.5 Local 7B GGUF + Thread Lock}
        R{External APIs: Gemini / OpenAI}
    end

    G <-->|Offline Extraction| Q
    M <-->|Hybrid Retrieval Reasoning| Q
    M <-->|Premium Reasoning Fallback| R
```

---

## 2. Chi tiết các thành phần Công nghệ

### 2.1. Phía Frontend (`protoc/`)
*   **Công nghệ cốt lõi:** React 18 (TypeScript), Vite 6.
*   **Thư viện UI/UX cao cấp:**
    *   **shadcn/ui** (dựa trên Radix UI & Tailwind CSS) cho các thành phần UI tinh tế, nhất quán.
    *   **Material UI (MUI)** và **Lucide React** cho hệ thống Icons phong phú.
    *   **Framer Motion / Motion** cho các hiệu ứng chuyển động và micro-animations cao cấp.
*   **Các thành phần giao diện đột phá mới:**
    *   **AI Processing Hub Timeline:** Một widget tuyệt đẹp hiển thị danh sách hàng chờ xử lý ngầm, tỉ lệ phần trăm tiến trình và sơ đồ Roadmap 5 bước nhấp nháy đèn LED động (Phase 1: Parse -> Phase 2: Chunking -> Phase 3: Embedding -> Phase 4: Concept Extraction -> Phase 5: Obsidian Sync). Polling dữ liệu tự động mỗi 3 giây từ API backend.
    *   **Chatbot Workspace Floating Widget:** Hộp thoại bong bóng trò chuyện hỗ trợ kéo giãn kích thước linh hoạt (Resizable Widget), lưu trữ lịch sử session, tự động chuyển đổi tab chat khi có focus. Tích hợp **Conversational Focus Synchronization** ngầm để bind ngữ cảnh mà không tự động pop-up mở rộng gây phiền hà.
    *   **Premium WikiNotes Tab View (Split-Pane)**: Tab thứ nhất cấp mới thay thế phần tích hợp ẩn trong cấu hình. Chia tách không gian thành 35% danh sách note và 65% trình đọc kính mờ cao cấp. Tích hợp bộ chuyển đổi **WikiLinks Obsidian** `[[Khái niệm]]` tương tác sang các Purple-glass Badges có khả năng nhấp để chuyển nhanh ghi chú vô cùng mượt mà.
    *   **Custom Interactive Knowledge Graph Canvas:** Bộ vẽ đồ thị 2D Force-Directed trên thẻ Canvas hiệu năng cao. Hỗ trợ cuộn phóng to/thu nhỏ (Zoom & Pan), kéo thả các nút, tự động thu gọn nhánh phụ đề giáo án khi có focus, bôi sáng đường dẫn các nút (highlight nodes/edges) tương ứng với tài liệu được truy xuất bởi thuật toán Graph RAG.
    *   **Admin Chunking Config:** Bảng điều khiển dành riêng cho ADMIN để chọn chiến lược chia chunk (Heading-based vs Fixed size + overlap) và lưu trực tiếp xuống database qua API.

### 2.2. Phía Backend (`backend/`)
*   **Công nghệ cốt lõi:** Django 6.0.5 và Django REST Framework (DRF) 3.17.1.
*   **Các thành phần dịch vụ thông minh:**
    *   **Bộ xử lý chạy ngầm (Asynchronous Task Manager - `bg_processor.py`):** Triển khai một Thread-based Background Queue tuần tự để chạy ngầm toàn bộ 5 bước của lộ trình xử lý tri thức ngay khi tài liệu được tải lên.
    *   **Startup Auto-Scan:** Tự động quét toàn bộ cơ sở dữ liệu khi hệ thống khởi động để queue lại các tài liệu chưa hoàn thành (`ai_processing_status = 'PENDING'`).
    *   **Windows Safe Encoding Logger:** Hàm ghi log an toàn mã hóa CP1252 trên Windows, tự động lọc và chuyển đổi ký tự tiếng Việt Unicode lạ thành ký hiệu an toàn để tránh gây ra lỗi `UnicodeEncodeError` làm sập luồng nền.
    *   **Embedding Service (`embedding_service.py`):** Sinh vector 1536 chiều bằng cách gọi Ollama (`nomic-embed-text`) hoặc tự sinh vector ổn định độc lập offline bằng thuật toán Hashing đặc trưng (`Deterministic Hashing generator`) nếu chạy hoàn toàn offline không cần thư viện cồng kềnh.
    *   **LLM Runner (`llm_runner.py`):** Cung cấp giao thức gọi suy luận linh hoạt kết hợp: (1) Mô hình Qwen Local 7B thông qua Ollama hoặc nạp file GGUF trực tiếp bằng `llama-cpp-python` tích hợp khóa đồng bộ **`_gguf_model_lock = threading.Lock()`** và cấu hình `n_ctx=4096` giải quyết triệt để lỗi sập luồng song song; (2) Các API key thương mại bên ngoài (Gemini/OpenAI); (3) Bộ RAG Simulator thông minh tự bóc tách ngữ cảnh khi chạy offline thuần túy.
    *   **Conversational Auto-Binding Engine (`views.py`)**: Tự động phát hiện và ánh xạ tên bài giảng được nhắc tới trong cuộc hội thoại chung ở trang chủ để liên kết focus ngay lập tức mà không cần chuyển view.
    *   **Automated Vault Cleanup Handler (`models.py`)**: Đăng ký tín hiệu `pre_delete` của model `LessonPlan` để tự động dọn dẹp các tệp tin `.md` và dọn dẹp note khái niệm liên đới, tránh để lại rác mồ côi trong Obsidian Vault khi xóa tài liệu.

### 2.3. Obsidian Vault Sync Integration (`obsidian_vault/`)
*   **Giao thức đồng bộ:** Tạo thư mục `obsidian_vault` tại gốc dự án làm Obsidian Vault.
*   **Markdown Notes Auto-Generator:** Với mỗi tài liệu đã hoàn thành xử lý tri thức (Phase 5), hệ thống tự động sinh tệp ghi chú `.md` chuẩn định dạng Obsidian chứa đầy đủ metadata, tiến trình hoạt động, và liên kết WikiLinks chéo `[[Khái niệm]]` dựa trên các thực thể và từ khóa trích xuất được bởi LLM. Người dùng chỉ cần mở vault này trên Obsidian Desktop để xem bản đồ mạng lưới 3D Knowledge Graph cực kỳ trực quan.

### 2.4. Cơ sở dữ liệu (`Database`)
*   **Hệ quản trị:** PostgreSQL 16 tích hợp tiện ích mở rộng **pgvector** chạy trên Docker.
*   **Thiết lập thực thể mới:**
    *   `DocumentChunk`: Lưu trữ nội dung phân mảnh của giáo án, kèm theo trường `heading` định danh và trường `embedding` (`VectorField(1536)`).
    *   `SystemSetting`: Cấu hình hệ thống dạng key-value lưu trữ chiến lược chia nhỏ của Admin.
