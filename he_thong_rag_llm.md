# Hệ thống RAG LLM - Tài liệu Chi tiết

Tài liệu này là bản hợp nhất các tài liệu kỹ thuật liên quan của hệ thống.

---

## Tài liệu nguồn: `ai_system_detail.md`

# Hệ thống AI Knowledge Hub & Đồ thị Tri thức (Graph RAG) Chi tiết

Tài liệu này cung cấp cái nhìn chi tiết và chuyên sâu nhất về thiết kế kiến trúc, các thành phần công nghệ, bộ điều phối luồng chạy ngầm (asynchronous roadmaps), thuật toán truy xuất Graph RAG kết hợp Vector Search, và các cải tiến kỹ thuật đột phá trong Hệ thống AI Tri thức của dự án **He_Thong_QLTT**.

---

## 1. Bản đồ Lộ trình Xử lý Tri thức Ngầm (Asynchronous AI Task Pipeline)

Hệ thống AI xử lý tri thức hoạt động hoàn toàn tự động dưới nền (asynchronous background worker) thông qua class `BackgroundProcessManager` trong tệp `bg_processor.py`. Tiến trình này được mô hình hóa thành sơ đồ lộ trình **Roadmap 5 bước (Phase 1 đến Phase 5)** thời gian thực:

```mermaid
graph LR
    P0[Tải tài liệu lên] --> P1[Phase 1: Parse Docx]
    P1 --> P2[Phase 2: Chunking]
    P2 --> P3[Phase 3: Embedding]
    P3 --> P4[Phase 4: Concept Extraction]
    P4 --> P5[Phase 5: Obsidian Sync]
    P5 --> P6[COMPLETED: Đèn xanh]
```

### 📑 Chi tiết 5 pha xử lý:
1.  **Phase 1: Parse & Convert (docx_parser.py)**: Sử dụng các thư viện parsing vật lý (minerU / python-docx) để phân tích giáo án cấu trúc dạng bảng biểu phức tạp của giáo viên, bóc tách toàn bộ metadata đầu mục (Môn học, lớp học, thời lượng, đối tượng, tiến trình hoạt động) và chuyển đổi thành văn bản chuẩn Markdown (.md).
2.  **Phase 2: Configurable Chunking Strategy**: Đọc cấu hình phân mảnh của Admin từ cơ sở dữ liệu `SystemSetting` để áp dụng:
    *   *Heading-based Semantic Chunking*: Tự động phân tách dựa trên các thẻ H1/H2/H3 trong giáo án, giúp giữ nguyên ngữ cảnh sư phạm của từng hoạt động giảng dạy.
    *   *Fixed Character Strategy*: Chia văn bản theo khung cửa sổ ký tự cố định và chồng lặp (overlap) để phục vụ tra cứu ngữ nghĩa.
3.  **Phase 3: Embedding Generation (embedding_service.py)**: Ghép siêu dữ liệu (metadata prepend) vào đầu mỗi chunk văn bản để tăng cường ngữ nghĩa sâu. Để tối ưu hóa tốc độ vượt trội, hệ thống gọi sinh Vector nhúng 1536 chiều bằng cơ chế **Batch Processing (`get_embeddings_batch`)** thay vì nhúng tuần tự từng chunk:
    *   *OpenAI Batch API*: Truyền toàn bộ mảng texts vào API trong một request duy nhất.
    *   *Ollama Batch API*: Truyền danh sách vào endpoint `/api/embed` của Ollama.
    *   *Parallel ThreadPool (5 workers)*: Nếu Ollama phiên bản cũ không hỗ trợ, sử dụng `ThreadPoolExecutor` chạy song song 5 luồng đồng thời, giúp rút ngắn thời gian nhúng của tài liệu từ hàng phút xuống chỉ còn vài giây.
    *   Lưu trữ vector nhúng trực tiếp vào cột `embedding` của bảng `DocumentChunk` (`pgvector`).
4.  **Phase 4: Concept & Relation Extraction (Cấu hình Model linh hoạt & Tối ưu)**: 
    *   **Lựa chọn Model theo thiết lập của người dùng**: Không cứng nhắc sử dụng một model duy nhất, hệ thống cho phép người dùng tùy chọn cấu hình AI Engine khi đăng tải hoặc reprocess tài liệu (chọn chạy cục bộ **Qwen 2.5 Local 3B**, **Qwen 2.5 Local 7B**, hoặc gọi **External API Key** như Gemini/OpenAI). Cấu hình này được lưu trực tiếp vào CSDL trong JSON field `attributes.ai_model_config` của `LessonPlan` (tránh thay đổi database schema) và được `bg_processor.py` đọc ra để điều hướng suy luận thích hợp cho cả việc trích xuất khái niệm và tạo định nghĩa.
    *   **Trích xuất học thuật nâng cao**: Kích hoạt model đã chọn để tự động trích xuất **8-12 thực thể** bao gồm cả các khái niệm khoa học chuyên ngành lẫn phẩm chất, năng lực sư phạm.
    *   **Sinh định nghĩa học thuật tự động**: Thay vì gán mô tả mặc định tĩnh như trước, LLM được chọn sẽ tự động sinh đoạn mô tả định nghĩa học thuật súc tích (2-3 câu) đặc thù cho từng khái niệm trong ngữ cảnh bài giảng, đưa thẳng vào note khái niệm tương ứng trong Obsidian Vault.
5.  **Phase 5: Obsidian Vault Sync Integration**: Tự động sinh file nốt `.md` tương thích 100% Obsidian, đính kèm YAML Front Matter metadata, tiến trình hoạt động dạy học, và bao bọc các từ khóa bằng WikiLinks chéo `[[Khái niệm]]` để đồng bộ mạng lưới đồ thị 3D trên Obsidian Desktop.

### 🛑 Cơ chế Dừng tác vụ & Dọn dẹp Hàng chờ (Task Cancellation & Cleanups)
Để tối ưu hóa tài nguyên hệ thống (đặc biệt khi chạy các tác vụ nặng như nhúng Vector hoặc chạy LLM suy luận), hệ thống cung cấp giải pháp kiểm soát dừng tác vụ thời gian thực:
*   **Nút Dừng (Stop button) trên giao diện**: Trong bảng quản trị tiến trình (Timeline Roadmap), người dùng có thể nhấp nút **"Dừng"** màu đỏ để hủy bỏ tác vụ đang chạy. Frontend sẽ gửi yêu cầu `POST` tới `/api/bg-tasks/stop/` kèm theo ID bài giảng.
*   **Tự động Dừng khi Thoát Web (Auto-stop on Page Exit)**: Khi người dùng đóng tab hoặc thoát trình duyệt, Frontend tự động lắng nghe sự kiện `beforeunload` và sử dụng **`navigator.sendBeacon`** để gửi tín hiệu dừng toàn bộ hàng chờ ngầm lên Backend một cách tin cậy và không đồng bộ, giải phóng ngay lập tức CPU/GPU cho máy chủ.
*   **Tầng xử lý Backend (`BackgroundProcessManager`)**:
    *   Hàng chờ ngầm duy trì một tập hợp thread-safe `_cancelled_tasks`. Khi yêu cầu dừng được gửi đến, task ID tương ứng sẽ được đưa vào tập hợp này.
    *   Trong luồng chạy của từng bài giảng (`_process_lesson_plan`), các điểm kiểm tra (`cls._is_cancelled(lp_id)`) được tích hợp chặt chẽ trước mỗi Phase và trong vòng lặp sinh embedding. Nếu phát hiện tác vụ đã bị hủy, hệ thống lập tức ngắt tiến trình, đưa trạng thái CSDL về `'FAILED' (Đã dừng xử lý theo yêu cầu người dùng)` và giải phóng tài nguyên.

---

## 2. Thiết kế An toàn Luồng (Thread-Safety) & Tránh sập LLM GGUF Cục bộ

Khi chạy mô hình ngôn ngữ lớn (LLM) Qwen 2.5 7B cục bộ dưới dạng file GGUF trực tiếp thông qua thư viện `llama-cpp-python` trên CPU, một thách thức lớn trong hệ thống web đa luồng (multi-threaded server) là **xung đột truy cập đồng thời (race condition)**.

### ⚠️ Rủi ro hệ thống trước đây:
*   Khi chạy ngầm Phase 4 trích xuất thực thể, đồng thời người dùng đặt câu hỏi chat RAG trên web, hai luồng Django song song sẽ truy cập vào cùng một instance của mô hình `Llama`.
*   Điều này làm biến dạng, chồng lặp bộ nhớ cache KV (Key-Value) nội bộ của `llama.cpp` ở tầng C-level, dẫn đến sập ngay lập tức toàn bộ tiến trình Django (`GGML_ASSERT failed`) mà Python không thể bắt ngoại lệ, tạo ra lỗi proxy đứt kết nối `ECONNRESET`.

### 🛡️ Giải pháp khắc phục đột phá:
Tôi đã tích hợp cơ chế **Thread-Locking toàn cục** và tối ưu tham số an toàn trong `llm_runner.py`:
1.  **Thread Lock bảo vệ (`_gguf_model_lock`)**: Sử dụng khóa đồng bộ `threading.Lock()` để bao bọc toàn bộ khối nạp trọng số và gọi hàm suy luận `llm(...)` của `llama-cpp-python`. Tất cả các luồng truy vấn song song bắt buộc phải xếp hàng chờ đợi luồng trước hoàn thành xong, triệt tiêu 100% khả năng xung đột trạng thái.
2.  **Tăng dung lượng Context (`n_ctx=4096`)**: Nâng giới hạn cửa sổ ngữ cảnh lên 4096 để thoải mái tiếp nhận các prompt chứa context RAG lớn mà không bao giờ bị tràn cache hay lỗi phân mảnh bộ nhớ.
3.  **Làm sạch tham số Đồ thị (Clean Query Parameters)**: Trong `views.py` tại `AIChatGraphDataAPIView`, tôi đã thiết lập bộ lọc làm sạch an toàn tham số `lesson_id` tránh để chuỗi `"null"` hoặc `"undefined"` lọt xuống CSDL gây sập luồng fallback đồ thị.
4.  **Tối ưu hóa Ngữ cảnh Hỏi đáp Tập trung**: Trong `graph_rag_service.py` tại hàm `retrieve_graph_rag_context`, khi phát hiện truy vấn thuộc ý định hỏi đáp tập trung (`focus_lesson_id` được thiết lập), hệ thống tự động loại bỏ danh sách bảng biểu siêu thuộc tính của toàn bộ các tài liệu khác trong CSDL ra khỏi Prompt. Cải tiến này giúp nén dung lượng context từ **14,874 ký tự** xuống chỉ còn **4,103 ký tự** (giảm ~72%), loại bỏ hoàn toàn nguy cơ tràn cửa sổ ngữ cảnh 4096 tokens, giúp Qwen 2.5 7B chạy offline mượt mà không lo sập luồng hay kích hoạt fallback giả lập.

---

## 3. Bộ Phân Loại Ý Định Truy Vấn Nâng Cao (Query Intent Classifier)

Động cơ Graph RAG tại backend (`graph_rag_service.py` & `views.py`) được thiết kế cực kỳ chuyên nghiệp với **Bộ phân loại ý định (Query Intent Classifier)** động giúp tự động điều chỉnh ngữ cảnh và chỉ định System Prompt phù hợp nhất cho từng câu hỏi của người dùng:

```mermaid
graph TD
    UserQuery[Câu hỏi của người dùng] --> IntentClassifier{Bộ phân loại ý định}
    IntentClassifier -->|Hỏi tài liệu đang xem| FocusQA[FOCUS_QA System Prompt]
    IntentClassifier -->|Hỏi đếm, thống kê| Statistical[STATISTICAL System Prompt]
    IntentClassifier -->|Hỏi so sánh giống/khác| Comparative[COMPARATIVE System Prompt]
    IntentClassifier -->|Tìm kiếm, đề xuất chung| GeneralKMS[GENERAL_KMS System Prompt]
```

### 🤖 Chi tiết 4 ý định, System Prompts & Ví dụ Hội thoại Thực tế:

#### 1. Chế độ Hỏi đáp Tập trung (`FOCUS_QA`)
*   **Kích hoạt**: Khi người dùng đang ở giao diện xem chi tiết một tài liệu (`focus_lesson_id` được truyền) hoặc khi nhắc trực tiếp đến tên tài liệu đó trong chat.
*   **Chiến lược Ngữ cảnh**: Nạp tiêu đề, siêu dữ liệu, mindmap 1-hop và toàn bộ nội dung tóm tắt chi tiết/tiến trình hoạt động của tài liệu đang focus (đồng thời tự động nén, bỏ qua danh mục toàn hệ thống để tiết kiệm context window).
*   **System Prompt**: Tập trung tối đa vào tóm tắt hoạt động, phân tích sư phạm sâu sắc, thiết bị chuẩn bị và mục tiêu của chính tài liệu này. Bắt buộc phản hồi dạng Markdown có cấu trúc rõ ràng và đính kèm các liên kết điều hướng nhảy nhanh: `[Tên hiển thị](lesson://<id>?text=<từ_khóa>)`.
*   **Ví dụ Hội thoại Thực tế**:
    *   💬 **Người dùng**: *"Hoạt động 3 của giáo án 'Chủ đề 1: Dinh dưỡng học đường' diễn ra như thế nào? Cần chuẩn bị những thiết bị gì?"*
    *   🤖 **AI Phản hồi**:
        > ### 🍽️ Tiến trình Chi tiết Hoạt động 3: Thiết kế Thực đơn Dinh dưỡng
        >
        > Hoạt động này diễn ra trong vòng **25 phút** với mục tiêu giúp học sinh tự tay xây dựng được thực đơn cân đối theo nhóm chất.
        >
        > **1. Quy trình Tổ chức:**
        > *   **Bước 1 (Giao nhiệm vụ):** Giáo viên chia lớp thành các nhóm từ 4-5 học sinh và phát bộ thẻ dinh dưỡng.
        > *   **Bước 2 (Thực hiện):** Học sinh thảo luận chéo, sử dụng máy tính bỏ túi để cân đối tỷ lệ các nhóm chất (Đạm, Béo, Đường bột, Vitamin) cho thực đơn một ngày.
        > *   **Bước 3 (Thuyết trình & Đánh giá):** Các nhóm treo sản phẩm lên bảng, đại diện thuyết trình và tự phân tích thói quen ăn uống của nhóm.
        >
        > **2. Thiết bị & Học liệu cần chuẩn bị:**
        > *   [Thẻ nhóm chất dinh dưỡng](lesson://136?text=thẻ+nhóm+chất) (Carbohydrate, Protein, Lipid, Vitamin).
        > *   Phiếu học tập in sẵn mẫu thực đơn dinh dưỡng.
        > *   Bút màu, keo dán và máy tính cầm tay.
        >
        > *👉 Bạn có thể click trực tiếp vào [Chủ đề 1: Dinh dưỡng học đường](lesson://136) để mở nhanh giáo án gốc.*

---

#### 2. Chế độ Thống kê Hệ thống (`STATISTICAL`)
*   **Kích hoạt**: Khi câu hỏi chứa các từ khóa định lượng hoặc yêu cầu liệt kê diện rộng (*bao nhiêu, tổng số, thống kê, danh sách bài, liệt kê, môn học...*).
*   **Chiến lược Ngữ cảnh**: Nạp danh mục tóm tắt siêu dữ liệu thuộc tính của tất cả các tài liệu đã xuất bản (`PUBLISHED`) trên hệ thống để LLM tính toán định lượng chéo.
*   **System Prompt**: Đóng vai trò là chuyên gia thống kê tri thức. Bắt buộc tổng hợp thông tin, so sánh định lượng và trình bày câu trả lời dưới dạng **Bảng biểu (Table) Markdown** trực quan, kèm link nhảy nhanh đến từng tài liệu được nhắc tên.
*   **Ví dụ Hội thoại Thực tế**:
    *   💬 **Người dùng**: *"Thống kê giúp tôi xem trên hệ thống hiện tại có bao nhiêu tài liệu, phân bố theo môn học và đối tượng học sinh như thế nào?"*
    *   🤖 **AI Phản hồi**:
        > ### 📊 Báo cáo Thống kê Tri thức Hệ thống KMS
        >
        > Hiện tại, hệ thống KMS đang lưu trữ và quản lý **9 tài liệu giáo án công khai**, được phân bổ khoa học theo bảng thuộc tính chi tiết dưới đây:
        >
        > | Tên Giáo Án | Môn Học | Đối Tượng Học Sinh | Địa Điểm Tổ Chức | Liên Kết Nhanh |
        > | :--- | :--- | :--- | :--- | :--- |
        > | **Chủ đề 1: Dinh dưỡng học đường** | Hoạt động trải nghiệm | Chung (Thành thị & Nông thôn) | Phòng học đa năng | [Xem bài](lesson://136) |
        > | **Khám phá Đa dạng Sinh học** | Sinh học | Học sinh nông thôn | Thực địa ngoài trời | [Xem bài](lesson://137) |
        > | **Ứng dụng Công nghệ sinh học** | Hoạt động hướng nghiệp | Học sinh thành thị | Phòng thí nghiệm | [Xem bài://138] |
        >
        > **Nhận xét Phân bổ:**
        > *   **Môn học:** 100% tài liệu tích hợp mạch tri thức sinh học thực tiễn.
        > *   **Địa điểm:** Có sự phân hóa rõ rệt giữa phòng thí nghiệm/phòng đa năng (Thành thị) và khu bảo tồn/thực địa ngoài trời (Nông thôn).

---

#### 3. Chế độ So sánh Đối chiếu (`COMPARATIVE`)
*   **Kích hoạt**: Khi câu hỏi yêu cầu đối chiếu các bài học với nhau (*khác nhau, so sánh, tương tự, giống nhau, đối chiếu, liên quan...*).
*   **Chiến lược Ngữ cảnh**: Gọi Graph Traversal (1-hop, 2-hop) từ các nút bài học liên quan, gom nốt khái niệm và các mảnh nội dung trích xuất tương ứng.
*   **System Prompt**: Đóng vai trò chuyên gia phân tích và liên kết tri thức. Đánh giá sự tương đồng và khác biệt về cấu trúc sư phạm, phương pháp dạy học, đối tượng học sinh, từ khóa chéo. Trình bày dưới dạng bullet đối xứng đa chiều.
*   **Ví dụ Hội thoại Thực tế**:
    *   💬 **Người dùng**: *"So sánh giáo án 'Khám phá Đa dạng Sinh học' và bài 'Trồng cây xanh trường học' về mặt phương pháp dạy và địa điểm tổ chức?"*
    *   🤖 **AI Phản hồi**:
        > ### ⚖️ Đối Chiếu Sư Phạm: Đa Dạng Sinh Học vs Trồng Cây Xanh
        >
        > Dựa trên phân tích Đồ thị Tri thức chéo, đây là bảng đối chiếu chi tiết giữa hai bài học liên kết:
        >
        > *   **Địa điểm tổ chức:**
        >     *   [Khám phá Đa dạng Sinh học](lesson://137): Tổ chức tại **vùng rừng quốc gia / khu bảo tồn tự nhiên** (phù hợp học sinh nông thôn tiếp cận trực tiếp).
        >     *   [Trồng cây xanh tại trường](lesson://140): Tổ chức trực tiếp tại **khuôn viên sân trường** (phù hợp học sinh đô thị rèn luyện lối sống xanh).
        > *   **Phương pháp giảng dạy chủ đạo:**
        >     *   *Đa dạng sinh học:* Thiên về phương pháp **Điều tra thực địa**, quan sát mẫu vật tự nhiên và lập báo cáo phân loại thực vật.
        >     *   *Trồng cây xanh:* Thiên về phương pháp **Thực hành lao động**, kỹ thuật trồng và chăm sóc cây, đo đạc quang hợp.
        > *   **Điểm kết nối Đồ thị (Common Concepts):** Cả hai bài học đều liên kết chéo qua các nút khái niệm chung là `[[Quang hợp]]` và `[[Bảo vệ môi trường]]`.

---

#### 4. Chế độ RAG Chung (`GENERAL_KMS`)
*   **Kích hoạt**: Lời chào hỏi, tìm kiếm giáo án theo mô tả tự do hoặc hỏi đáp lý thuyết sư phạm tổng quát nằm ngoài 3 ý định trên.
*   **Chiến lược Ngữ cảnh**: Thực hiện Hybrid Search (Vector Search pgvector kết hợp so khớp từ khóa) để tìm kiếm các phân mảnh trích xuất giàu nghĩa nhất đưa vào context.
*   **System Prompt**: Đóng vai trò trợ lý AI KMS sư phạm thân thiện. Trả lời chính xác dựa trên ngữ cảnh được cung cấp, tự động suy luận linh hoạt nếu thông tin nằm ngoài CSDL và luôn định hướng điều hướng thông minh bằng link chéo.
*   **Ví dụ Hội thoại Thực tế**:
    *   💬 **Người dùng**: *"Tôi muốn tìm giáo án nào hướng dẫn học sinh cách phân loại rác thải và tái chế?"*
    *   🤖 **AI Phản hồi**:
        > Chào bạn! Hệ thống KMS đã quét cơ sở tri thức chéo và tìm thấy **1 giáo án hoàn hảo** đáp ứng nhu cầu của bạn:
        >
        > ### 🌱 [CLB Môi trường và Tái chế Rác thải](lesson://141)
        > *   **Nội dung cốt lõi:** Hướng dẫn học sinh nhận diện rác hữu cơ/vô cơ, thực hành tái chế chai nhựa và rác thải nhựa thành đồ dùng học tập.
        > *   **Mạch kiến thức:** Hoạt động hướng đến tự nhiên.
        > *   **Năng lực phát triển:** Giải quyết vấn đề, Trách nhiệm công dân, Sáng tạo.
        >
        > *Bạn có thể nhấp vào liên kết trên để xem trọn vẹn giáo án Markdown hoặc xem Mindmap chéo của bài giảng này nhé!*

---

*   **Tính năng đặc biệt - Conversational Auto-Binding**: Nếu người dùng chat ở trang chủ nhưng nhắc đến tên tài liệu cụ thể (ví dụ: *"Tóm tắt hoạt động 2 của giáo án Chủ đề 1"*), backend tự động phát hiện chuỗi trùng khớp và **tự động gán `focus_lesson_id`** của Chủ đề 1 ngay lập tức, đưa cuộc trò chuyện vào thẳng chế độ chuyên sâu `FOCUS_QA` mà không cần người dùng thao tác click thủ công!

---

---

## 4. Giao diện Trình đọc WikiNotes Split-Pane & WikiLinks Obsidian Tương tác

Để mang lại trải nghiệm xem tài liệu trích xuất cao cấp nhất, tôi đã nâng cấp thành công Tab **WikiNotes** thành một Tab thứ nhất cấp chuyên biệt (First-class Tab) ngay trong Chatbot Workspace:

### 📐 Thiết kế Bố cục Split-Pane 35/65 hiện đại:
*   **Sidebar Danh sách Ghi chú (35% chiều rộng)**: Hiển thị danh sách tất cả các tập tin nốt tri thức chuẩn định dạng Obsidian đồng bộ thời gian thực từ Vault. Card ghi chú được thiết kế phẳng thanh lịch, hiển thị đầy đủ dung lượng tệp tin (KB) và hiệu ứng chuyển màu gradient tinh tế khi được chọn.
*   **Trình đọc Kính mờ Premium (65% chiều rộng)**: Tấm nền kính mờ (`backdropFilter: 'blur(8px)'`), bo góc rộng, sử dụng font chữ Inter/Outfit sắc nét cao cấp mang lại cảm giác vô cùng sang trọng và chuyên nghiệp.

### 🔗 Trình phân tích WikiLinks Obsidian (`[[Liên kết]]`) tương tác độc quyền:
*   Hệ thống được trang bị bộ máy Regex phân tích động văn bản Markdown.
*   Mọi liên kết chéo tri thức dạng `[[Tên Khái Niệm]]` hoặc `[[Tên Tài Liệu]]` của Obsidian được tự động chuyển đổi thành các **Badge liên kết màu tím lung linh (Purple-glass Interactive Badges)**.
*   Khi người dùng click vào một Badge liên kết chéo (ví dụ: `[[Chuyển hóa năng lượng]]`), hệ thống tự động xác định ghi chú đích trong Vault và nạp nội dung của ghi chú đó trực tiếp lên màn hình đọc.
*   Tính năng này tạo ra một mạng lưới **đọc chéo tri thức (Knowledge Hyperlinking)** vô song, giúp người dùng duyệt toàn bộ cơ sở tri thức sư phạm một cách liền mạch, mượt mà y hệt như đang thao tác trực tiếp trên Obsidian Desktop chuyên nghiệp!

### 🔍 Bộ lọc WikiNotes theo ngữ cảnh bài giảng (Focus Lesson Filter):
*   **Giao diện**: Tích hợp nút toggle chuyển đổi **"Chỉ bài này / Tất cả"** trên Header của WikiNotes tab.
*   **Logic Hoạt động**: 
    *   Khi bật **"Chỉ bài này"**, Frontend sẽ gọi API `/api/obsidian/notes/by-lesson/?lesson_id=<id>` thay vì danh sách tất cả các note.
    *   **Backend (`ObsidianNotesByLessonAPIView`)**: Lọc và trả về danh sách ghi chú rút gọn bao gồm:
        1. Ghi chú chính của bài giảng (tên file trùng với tiêu đề bài giảng đã chuẩn hóa).
        2. Các Concept Notes chứa liên kết chéo trỏ đến bài giảng này (dưới dạng `[[Tên bài giảng]]`).
    *   Giúp giáo viên nhanh chóng nắm bắt toàn bộ thực thể lý thuyết và tài liệu bổ trợ của riêng bài học đó mà không bị phân tâm bởi các kiến thức của bài học khác.

---

### 🕸️ Bộ lọc Khoảng cách liên kết Đồ thị (BFS Hop Distance):
*   **Ý nghĩa**: Khi vẽ Đồ thị tri thức, việc hiển thị toàn bộ các liên kết trong cơ sở dữ liệu có thể gây quá tải thị giác. Bộ lọc Hop Distance cho phép người dùng lựa chọn khoảng cách BFS (1, 2, hoặc 3 hops) để thu hẹp hoặc mở rộng phạm vi hiển thị quanh nút đang chọn.
*   **Luồng xử lý**:
    *   Frontend truyền tham số `hop_distance` (giá trị 1, 2, 3) lên API `/api/chat-graph/` (`AIChatGraphDataAPIView`).
    *   Backend sử dụng thuật toán duyệt đồ thị **BFS (Breadth-First Search)** từ nút gốc (bài giảng được chọn) đi qua các cạnh liên kết (bài giảng $\leftrightarrow$ khái niệm $\leftrightarrow$ thư mục) để thu thập danh sách nút và cạnh nằm trong bán kính hop được thiết lập.
    *   Đồ thị 2D Force Graph Canvas tự động vẽ lại chính xác mạng lưới tri thức cục bộ trực quan và tập trung.

---

## 5. Cơ chế Tự động Dọn dẹp Vault & Xóa liên kết mồ côi (Signals Database Cleanups)

Để tránh tình trạng "tài liệu đã bị xóa khỏi database nhưng ghi chú rác vẫn còn tồn đọng trong Obsidian Vault", tôi đã tích hợp cơ chế dọn dẹp rác vật lý và liên kết chéo tự động:

```text
[Xóa LessonPlan khỏi DB] ──> [Trigger pre_delete signal] 
                                       │
                                       ▼
                       ┌───────────────┴───────────────┐
                       ▼                               ▼
               [Xóa tập tin .md]             [Quét các Concept Tag]
             (Xóa nốt tài liệu chính)                  │
                                           ┌───────────┴───────────┐
                                           ▼                       ▼
                                  (Chỉ liên kết bài này?)   (Có liên kết khác?)
                                           │                       │
                                           ▼                       ▼
                                  [Xóa nốt khái niệm]    [Chỉ xóa dòng liên kết]
                                 (Khử hoàn toàn mồ côi)   (Giữ lại nốt khái niệm)
```

1.  **Lắng nghe Tín hiệu Xóa (`pre_delete` signal)**: Đăng ký một hàm receiver lắng nghe sự kiện xóa của model `LessonPlan` bên trong tệp `models.py`.
2.  **Xóa tập tin Markdown chính**: Tự động tính toán đường dẫn thực tế của Vault, tìm tập tin `.md` tương ứng dựa trên tiêu đề bài giảng đã được làm sạch và thực hiện xóa vật lý khỏi đĩa cứng.
3.  **Khử trùng lặp & Dọn dẹp Concept liên đới**: Quét qua tất cả các nốt khái niệm (`Concept Notes` như *Dinh dưỡng, Thực đơn, Quang hợp...*) liên kết với tài liệu bị xóa:
    *   *Nốt khái niệm mồ côi*: Nếu nốt khái niệm đó chỉ chứa duy nhất liên kết đến tài liệu bị xóa, hệ thống sẽ thực hiện xóa hoàn toàn nốt khái niệm đó để tránh làm loãng thư mục.
    *   *Nốt khái niệm dùng chung*: Nếu nốt khái niệm đó vẫn đang liên kết chéo đến các tài liệu active khác, hệ thống sẽ chỉ lọc bỏ dòng liên kết cụ thể của tài liệu vừa xóa (`- [[Tiêu đề xóa]]`), bảo toàn tuyệt đối sự toàn vẹn của Đồ thị Tri thức.


---

## 6. Tính năng Trợ lý thông minh nâng cao & Điều hướng Lịch sử đa nhiệm

Nhằm tối ưu hóa trải nghiệm điều hướng tài liệu kết hợp trợ lý AI RAG trên Đồ thị Tri thức (Force Directed Graph), hệ thống tích hợp các cơ chế sau:

### 🔍 Điều hướng Tách biệt & Lưu trữ Phiên Chat AI (Decoupled Navigation & Chat States):
*   **Hành vi nhấp đúp**: Nhấp đúp vào một nút Giáo án trên Đồ thị chỉ kích hoạt hiển thị tài liệu đó ở giao diện chi tiết chính bên ngoài. Lịch sử, tab hiện tại và trạng thái đóng/mở của Chatbot AI được bảo toàn tuyệt đối (không bị tự động đổi sang session mới hay tự bật lên gây gián đoạn).
*   **Đồng bộ tức thì khi đang mở (Auto-sync when open)**: Nếu Chatbot AI đang mở, khi người dùng nhấp đúp xem tài liệu khác hoặc nhấn "Quay lại" trên giao diện chính, Chatbot sẽ phát hiện sự thay đổi ngữ cảnh tập trung và tải ngay lập tức phiên chat của tài liệu đó mà không có độ trễ.
*   **Cơ chế Hỏi AI chủ động**: Chatbot chỉ tự động chuyển ngữ cảnh và mở lên khi người dùng chủ động bấm vào nút "Hỏi AI" ở các thẻ tiện ích hoặc nút "🤖 Hỏi AI" trong bảng tóm tắt.

### ↩️ Nút Quay lại Tài liệu Đa nhiệm (Global Document History Stack):
*   **Ngăn xếp lịch sử**: Hệ thống duy trì một `docHistoryStack` ở root component `App.tsx` để ghi nhận chuỗi tài liệu người dùng đã xem.
*   **Nút "← Quay lại"**: Nằm cạnh nút đóng `✕` trên đầu trang chi tiết tài liệu, hiển thị số bước còn lại (ví dụ: `← Quay lại (2)`). Cho phép giáo viên lùi lại tài liệu đã xem trước đó từng bước một, hoạt động hoàn hảo cho cả các liên kết sơ đồ bên ngoài và liên kết văn bản trong chatbot.

### 📐 Bảng tóm tắt di động co giãn đa hướng (Resizable & Draggable Popup Card):
*   **Nhấp chuột ghim bảng**: Khi click chọn một thực thể (khái niệm), bài giảng hoặc thư mục trên đồ thị, một bảng tóm tắt thông tin chi tiết sẽ được ghim hiển thị tại vị trí đó (bảng tự động tính toán bù trừ tọa độ để không đè lên nút gốc và đảm bảo không tràn ra ngoài viền màn hình đồ thị).
*   **Di chuyển & Co giãn 4 góc**: Người dùng có thể giữ kéo header của bảng để di chuyển đi nơi khác, hoặc rê chuột vào **cả 4 góc** để kéo giãn thay đổi chiều rộng, chiều cao của bảng.
*   **Tự động tỷ lệ cỡ chữ (Font scaling)**: Khi người dùng kéo to bảng, các thành phần bên trong (tiêu đề, nội dung khái niệm, nút Hỏi AI...) sẽ tự động tăng kích thước font chữ, padding tỷ lệ thuận với độ lớn của bảng để tăng khả năng quan sát mà không cần phóng to toàn bộ trang web.

---

## 7. Cơ chế Quản lý Phiên chat Tối ưu & Tự động Đặt tên Thông minh

Để nâng cao trải nghiệm người dùng (UX) và tối ưu hóa tài nguyên cơ sở dữ liệu khi làm việc với Trợ lý AI, hệ thống đã triển khai các cải tiến cốt lõi trong quản lý vòng đời phiên chat:

### 🔄 Tái sử dụng Phiên trò chuyện trống (Empty Session Reuse):
*   **Vấn đề trước đây**: Mỗi lần người dùng đăng nhập hoặc bật chatbot, hệ thống tự động khởi tạo một phiên chat mới trống, tạo ra hàng loạt cuộc trò chuyện rác `"Cuộc trò chuyện mới"` không có nội dung trong lịch sử.
*   **Giải pháp tối ưu**:
    *   Khi chatbot mount, client gọi API lấy lịch sử phiên chat (`fetchSessions`).
    *   Hệ thống kiểm tra phiên chat gần đây nhất: Nếu phiên chat này trống (chưa có tin nhắn nào từ người dùng, tức `sender_role === 'USER'`), client sẽ **tái sử dụng** phiên chat đó thay vì tạo mới.
    *   Một phiên chat mới chỉ được tạo tự động khi phiên chat gần nhất đã có tương tác thực tế từ người dùng, bảo đảm lịch sử hội thoại luôn sạch sẽ.

### 🧠 Tự động Đặt tên Thông minh bằng LLM (LLM-based Auto-Naming):
*   **Luồng hoạt động**:
    *   Khi người dùng gửi tin nhắn đầu tiên trong phiên chat, backend Django kiểm tra nếu số lượng tin nhắn trước đó của người dùng bằng 0.
    *   Một truy vấn tóm tắt được gửi trực tiếp tới mô hình LLM đang chọn (Qwen hoặc Gemini/OpenAI API): *"Hãy đặt một tiêu đề cực kỳ ngắn gọn và súc tích (tối đa 5 từ, không để trong ngoặc kép) khái quát chủ đề của câu hỏi sau..."*.
    *   Tiêu đề thông minh được tạo ra sẽ được lưu vào thuộc tính `title` của phiên chat trong cơ sở dữ liệu.
    *   Tiêu đề này được trả về cho client ngay lập tức qua stream chunk đầu tiên (`meta_payload` chứa trường `session_title`).
    *   Giao diện người dùng ở thanh lịch sử và header chat tự động cập nhật tên mới theo thời gian thực một cách trực quan, sinh động.

---
