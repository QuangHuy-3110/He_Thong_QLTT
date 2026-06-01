# Trạng thái Hệ thống QLTT (System State)

Tài liệu này theo dõi và cập nhật trạng thái hoạt động thực tế của hệ thống QLTT trên môi trường local, đặc biệt ghi nhận tiến độ sau pha nâng cấp AI Knowledge Hub, Graph RAG và đồng bộ Obsidian.

*Cập nhật lần cuối: 2026-05-31 20:50 (Giờ Việt Nam)*

---

## 1. Trạng thái Môi trường Local

### 1.1. Cơ sở dữ liệu (PostgreSQL + pgvector)
*   **Cách thức triển khai:** Chạy qua Docker Container.
*   **Tên Container:** `kms-pgvector`
*   **Cổng kết nối:** Ánh xạ từ cổng `5432` của Container ra cổng **`5433`** trên máy Host.
*   **Thông tin kết nối:**
    *   `NAME`: `kms_db`
    *   `USER`: `postgres`
    *   `PASSWORD`: `05112004`
    *   `HOST`: `127.0.0.1`
    *   `PORT`: `5433`
*   **Trạng thái pgvector:** Hoạt động hoàn hảo. Đã migrate đầy đủ bảng `DocumentChunk` chứa vector nhúng 1536 chiều và bảng cấu hình `SystemSetting`.

### 1.2. Môi trường ảo Backend (Python venv)
*   **Đường dẫn:** `backend/venv/`
*   **Hệ điều hành tương thích:** Windows (tương thích chạy đa nền tảng tốt).
*   **Trạng thái kiểm tra mã nguồn (`check`):** Hệ thống Django hoàn toàn sạch lỗi (`0 issues`).
*   **Lệnh chạy:** `python manage.py runserver` (đang hoạt động liên tục tại cổng `8000`).

### 1.3. Mô hình AI Cục bộ (Local AI GGUF Models)
*   **Thư mục lưu trữ:** `backend/model_AI/`
*   **Các tệp tin mô hình thực tế hiện có:**
    *   `qwen2.5-3b-instruct-q4_k_m.gguf` (Kích thước: **2.10 GB**) — Chạy mặc định cho Qwen Local 3B.
    *   `Qwen2.5-7B-Instruct-Q4_K_M.gguf` (Kích thước: **4.68 GB**) — Chạy mặc định cho Qwen Local 7B.
*   **Thư viện LLM:** Biên dịch và cài đặt thành công `llama-cpp-python` trong venv. Qwen Local chạy trực tiếp GGUF trên CPU cực kỳ ổn định.
*   **Cơ chế Thread-Safety & Tối ưu hóa Ngữ cảnh**: Đã tích hợp khóa đồng bộ luồng toàn cục `_gguf_model_lock` và nâng `n_ctx` an toàn lên `4096` trong `llm_runner.py` giúp ngăn chặn triệt để lỗi sập luồng C-level `GGML_ASSERT` khi có truy vấn song song, giải quyết hoàn toàn lỗi `ECONNRESET`. Đồng thời, tối ưu hóa kích thước prompt trong `graph_rag_service.py` bằng cách loại bỏ danh mục toàn hệ thống khi ở chế độ `FOCUS_QA` để nén ngữ cảnh từ 14,874 ký tự xuống còn 4,103 ký tự, triệt tiêu nguy cơ tràn cửa sổ ngữ cảnh 4096 tokens của Qwen 7B Local.

### 1.4. Thư mục Frontend (Node.js)
*   **Thư mục:** `protoc/`
*   **Lệnh chạy:** `npm run dev` (đang hoạt động ổn định trên Vite cổng `5173`).
*   **Trạng thái Build:** Chạy biên dịch sản xuất `npm run build` thành công xuất sắc 100%, bundle sinh ra gọn nhẹ và sạch lỗi TypeScript.

---

## 2. Trạng thái Cơ sở dữ liệu & Tài khoản Mẫu

*   **Trạng thái Migrations:** Đã chạy migrate hoàn tất toàn bộ cấu trúc bảng mở rộng tri thức (`0005_systemsetting_documentchunk_heading_and_more.py`).
*   **Dữ liệu mẫu (Seed Data):** Đã nạp thành công 9 bài giảng mẫu chuyên sâu và tệp tin thực tế bao phủ 100% các thư mục đệ quy qua `seed_advanced.py`.
*   **Tài khoản đăng nhập có sẵn:**
    *   **Username:** `admin`
    *   **Password:** `admin`
    *   **Quyền hạn:** `ADMIN`

---

## 3. Trạng thái Git & Version Control

*   **Tệp tin `.gitignore`:** Đã cấu hình bỏ qua `venv`, `node_modules`, `media/`, `model_AI/` (bảo vệ 7 GB mô hình không bị đẩy nhầm) và `obsidian_vault/` (bỏ qua tệp tin Markdown sinh ra tại runtime).
*   **Trạng thái Stage:** Toàn bộ mã nguồn cốt lõi mới đã được `git add` vào khu vực chuẩn bị commit (`staged changes`), sạch sẽ và ngăn nắp.

---

## 4. Lịch sử thay đổi UI & Kiến trúc gần nhất

*   **2026-05-31**: **Nâng cấp Đồ thị 12 Thực thể, Tab WikiNotes Cao cấp, Cải tiến Đa ý định & Dọn dẹp Vault tự động**:
    - **Trích xuất Đa mục tiêu & Tổng quát hóa Sư phạm (12 Thực thể)**:
        * Tối ưu hóa Prompt trích xuất trong `bg_processor.py` để Qwen Local 7B phân tích sâu sắc cấu trúc bài học một cách **tổng quát và subject-agnostic**.
        * Nâng giới hạn trích xuất lên **12 thực thể** bao gồm cả các khái niệm chuyên môn nội dung của bài học (khoa học, hướng nghiệp, xã hội, công nghệ...) và các năng lực/phẩm chất đặc thù sư phạm (*Năng lực tự học, Năng lực hợp tác, Giải quyết vấn đề, Trách nhiệm...*), hỗ trợ trọn vẹn toàn bộ các môn học và Hoạt động Trải nghiệm & Hướng nghiệp tổng quát thay vì bị giới hạn cứng ở môn Sinh học.
    - **Thiết kế Tab WikiNotes First-Class**:
        * Tách biệt hẳn Obsidian notes viewer ra khỏi tab cấu hình, tích hợp thành một Tab **WikiNotes** chuyên biệt thứ nhất cấp với thiết kế split-pane tinh tế (35% sidebar danh sách note, 65% trình đọc kính mờ cao cấp).
        * Xây dựng trình phân tích **WikiLinks Obsidian** `[[Liên kết]]` tương tác: Tự động biến các WikiLinks thành các Badge màu tím lung linh có hiệu ứng di chuột mượt mà, cho phép click để chuyển đổi ghi chú trực tiếp ngay trên trang web không cần rời khỏi màn hình.
    - **Sửa lỗi chatbot tự động mở & Đồng bộ focus khi hỏi đáp**:
        * Loại bỏ hoàn toàn hành vi tự động bật popup AI khi xem chi tiết tài liệu, đảm bảo không gian yên tĩnh cho người dùng.
        * Khi người dùng xem tài liệu và chủ động mở chat, hệ thống sẽ **giữ nguyên cuộc hội thoại hiện tại** và tự động gán ngữ cảnh liên kết focus ngầm mà không ép buộc tạo mới phiên chat.
        * Bổ sung cơ chế **Conversational Auto-Binding** tại backend `views.py`: Nếu người dùng chat ở màn hình trang chủ nhưng nhắc đến tên tài liệu cụ thể trong câu hỏi, hệ thống tự động nhận diện và bind ngữ cảnh bài học focus tương ứng lập tức!
    - **Dọn dẹp rác & Xóa liên kết đứt tự động trong Vault**:
        * Viết thêm bộ dọn dẹp trong tín hiệu `pre_delete` signal của model `LessonPlan` (`models.py`) để tự động xóa tập tin `.md` trong Obsidian Vault tương ứng khi xóa tài liệu khỏi database.
        * **Cực kỳ thông minh**: Tự động dọn dẹp các Note Khái niệm (`Concept Note`) liên quan: Xóa hoàn toàn nếu nốt khái niệm bị mồ côi (chỉ trỏ đến tài liệu vừa xóa), hoặc chỉ xóa dòng liên kết tương ứng nếu nốt khái niệm được chia sẻ bởi nhiều tài liệu khác.
        * Chạy thành công tập lệnh dọn dẹp diện rộng `cleanup_orphaned_notes.py` giải phóng sạch sẽ **10 ghi chú mồ côi** và **6 nốt khái niệm rác** trong thư mục vault thực tế.
    - **Khắc phục lỗi ECONNRESET, Mismatch Đồ thị & Tối ưu hóa Context RAG**:
        * Tích hợp Thread Lock `_gguf_model_lock` và tăng context an toàn `n_ctx=4096` trong `llm_runner.py` để bảo vệ tài nguyên GGUF khỏi xung đột truy cập song song.
*   **2026-06-01**: **Sửa lỗi Phân tích Giáo án Word (Docx), Tự động chuyển đổi Markdown thời gian thực & Tích hợp nút Về giữa Sơ đồ tư duy**:
    - **Cập nhật Backend Serializer thông minh (On-the-fly Docx Sync)**:
        * Khắc phục lỗi trả về nội dung tóm tắt ngắn từ database thay vì nội dung tài liệu đầy đủ. Cập nhật `get_content_preview` trong `LessonPlanSerializer` (`backend/app/serializers.py`) để tự động kiểm tra nếu dữ liệu xem trước chỉ là tóm tắt ngắn seeded (không chứa `"## "` hoặc `"# "`), hệ thống sẽ **ép buộc chạy trình trích xuất ngầm tài liệu Word** (`convert_docx_to_markdown`) để phân tích tệp `.docx` thực tế tại chỗ, lưu cập nhật lại database và trả về bản Markdown chi tiết cho Frontend.
    - **Nâng cấp Bộ phân tích Sư phạm thích ứng (Adaptive Pedagogical Parser)**:
        * Tối ưu hóa bộ phân tích `parseMarkdownLessonPlan` trong `App.tsx` giúp nhận diện linh hoạt các cấu trúc tài liệu không có bảng biểu.
        * **Mục tiêu**: Nhận diện thông minh các dòng gạch đầu dòng tự do dưới mục tiêu dạy học (dù không có mã hóa `KT/NL/PC`) để tự động sắp xếp vào nhánh mục tiêu.
        * **Học liệu**: Tự động trích xuất các dòng mô tả thiết bị, đồ dùng dạy học tự do bên ngoài bảng biểu.
        * **Đồng bộ Tiến trình - Hoạt động**: Tích hợp cơ chế liên kết ngược song phương (`Cross-population fallbacks`). Nếu bảng tiến trình bị trống, Frontend tự động vẽ nhánh tiến trình dựa trên danh sách hoạt động chi tiết (và ngược lại), giúp sơ đồ luôn đầy đủ 4 nhánh nội dung thực tế.
    - **Nút "🎯 Về giữa" (Center View) cho Sơ đồ tư duy**:
        * Tích hợp hook `useReactFlow` từ `@xyflow/react` trong `MindmapFlow.tsx`.
        * Thêm nút **🎯 Về giữa** nằm bên cạnh nút **🔄 Reset** với hiệu ứng hover mượt mà và chuyển cảnh di chuyển `fitView` êm ái thời lượng **800ms**, nâng cao độ cao cấp và trải nghiệm tương tác trực quan cho người dùng.
    - **Sửa lỗi lặp tệp tin trong Cây Thư mục (Directory Tree Deduplication)**:
        * Khắc phục lỗi hiển thị tệp tin lặp lại ở cả thư mục cha và thư mục con khi một tệp thuộc về nhiều cấp thư mục.
        * Viết thêm hàm đệ quy `getDescendantIds` trong `App.tsx` để xác định toàn bộ các thư mục con (descendants) của thư mục hiện tại.
        * Cập nhật `dirFiles` của `DirectoryNode` để tự động lọc bỏ các tệp tin nếu chúng đã được xếp vào các thư mục con cụ thể bên dưới, giúp sơ đồ cây thư mục luôn sạch sẽ, chính xác theo cấu trúc chuẩn.



