# Hướng Dẫn Thuyết Minh Sơ Đồ Kiến Trúc Hệ Thống (ERP HTQL_TT)

Tài liệu này giải thích chi tiết **từng khối cấu phần (Node)**, **từng mũi tên kết nối (Edge)** và **luồng hoạt động chính** trong sơ đồ kiến trúc hệ thống quản lý tri thức của bạn (file `erp.json` / `erp.drawio`). 

Tài liệu này được biên soạn để bạn có thể trực tiếp làm báo cáo hoặc tài liệu thuyết trình trước hội đồng chấm đồ án.

---

## 🗺️ 1. Giải Thích Từng Khối Cấu Phần (Diagram Components)

Sơ đồ được chia làm 6 lớp (Layers) chính, mỗi lớp đảm nhận một vai trò cụ thể:

### 👥 1.1. Access Layer (Tầng Người Dùng)
*   **Quản trị viên (Admin):** Tài khoản quản trị cấp cao nhất, cấu hình hệ thống AI, theo dõi hoạt động và phân quyền người dùng.
*   **Người dùng (User):** Học sinh, sinh viên, độc giả truy cập để tra cứu và học hỏi tri thức.
*   **Giáo viên (Teacher):** Người cung cấp nội dung, biên soạn, đăng tải giáo án lên hệ thống.

### 🎨 1.2. Presentation Layer (Tầng Giao Diện Người Dùng)
*   **Admin Config Dashboard:** Giao diện quản lý cấu hình các tham số AI (độ dài chunk, độ trùng lặp, khóa API, model sử dụng).
*   **Chatbot Workspace Widget:** Khung chat AI nổi trên trang web để người dùng hỏi đáp về kiến thức giáo án.
*   **Dashboard & Library View:** Giao diện thư viện bài giảng, hiển thị danh sách giáo án dưới dạng thẻ.
*   **Interactive Portal Grid (Bộ Ba Giao Diện Trực Quan):**
    *   *Symmetrical Mindmap Canvas:* Giao diện vẽ sơ đồ tư duy phân cấp bài dạy bằng ReactFlow.
    *   *Knowledge Graph Canvas 2D:* Đồ thị mạng lưới liên kết tri thức 2D (vis-graph) kết nối bài giảng và từ khóa.
    *   *Premium WikiNotes Split-Pane:* Khung hiển thị ghi chú chia đôi, phân tích liên kết chéo `[[WikiLinks]]` tự động của Obsidian.

### 🛡️ 1.3. Security & Integration Layer (Tầng Bảo Mật & Tích Hợp)
*   **Axios Request Interceptor:** Bộ lọc yêu cầu HTTP từ frontend, tự động nhúng mã xác thực Token JWT vào mọi gói tin.
*   **Keycloak / Local Auth Provider:** Máy chủ xác thực (Identity Provider) quản lý đăng nhập SSO (Keycloak) và đăng nhập dự phòng cục bộ.
*   **API Gateways & Routers:** Cổng định tuyến API của Django (`urls.py`), kiểm tra quyền truy cập hợp lệ trước khi đưa vào lớp xử lý nghiệp vụ.

### ⚙️ 1.4. Business Logic Layer (Tầng Xử Lý Nghiệp Vụ)
*   **User & Account Controller:** Điều phối luồng xử lý đăng ký, đăng nhập, phân quyền và sửa thông tin cá nhân.
*   **Vault Synchronization Engine:** Động cơ đồng bộ hóa ghi chú Markdown vật lý trên ổ đĩa.
*   **Document Lifecycle Manager:** Quản lý vòng đời giáo án (Soạn thảo ➔ Duyệt ➔ Xuất bản công khai) và lưu lịch sử chỉnh sửa.
*   **Pedagogical & Word Parser:** Thư viện đọc cấu trúc tệp tin Word (`.docx`), trích xuất văn bản thô phục vụ xử lý AI.

### 🤖 1.5. AI Processing Layer (Tầng Xử Lý Trí Tuệ Nhân Tạo)
*   **Asynchronous Task Manager:** Quản lý luồng chạy ngầm bất đồng bộ (Background Tasks) để chạy RAG 5 Phase mà không làm chậm trang web.
*   **Graph RAG Retrieval Engine:** Động cơ tìm kiếm tri thức kết hợp: đối chiếu vector (Semantic) + duyệt mối quan hệ đồ thị (Graph Traversal).
*   **LLM Inference Bridge:** Cầu nối trung gian gọi đến các mô hình ngôn ngữ lớn (gọi local Qwen qua Ollama hoặc GPT qua OpenAI API).
*   **Embedding Service:** Hàm sinh vector nhúng cho câu từ (1536 chiều).

### 💾 1.6. Data Storage Layer (Tầng Lưu Trữ Dữ Liệu)
*   **PostgreSQL DB (CSDL quan hệ):**
    *   *Bảng Quan Hệ Hệ Thống Thường:* Lưu các bảng dữ liệu có cấu trúc (Users, LessonPlans, Ratings, History).
    *   *pgvector Extension:* Thành phần mở rộng cài trong Postgres để lưu trữ và truy vấn nhanh các vector nhúng ngữ nghĩa của văn bản.
*   **Obsidian Vault Store:** Thư mục lưu trữ vật lý trên ổ cứng của server chứa các file ghi chú Markdown `.md` theo chuẩn Obsidian.

---

## 🔗 2. Giải Thích Ý Nghĩa Từng Mũi Tên Kết Nối (Edges & Data Flow)

Sơ đồ thể hiện luồng giao tiếp rất chi tiết thông qua các mũi tên có nhãn:

### 2.1. Kết nối điều hướng người dùng (Access ➔ Presentation)
*   **Quản trị hệ thống:** Admin gọi trực tiếp đến `Admin Config Dashboard`.
*   **Tra cứu thư viện / Trao đổi với Chatbot:** User mở giao diện thư viện hoặc khung chat.
*   **Tải lên giáo án / Đề xuất công khai:** Teacher thực hiện tải lên tài liệu ở màn hình thư viện.

### 2.2. Kết nối API Xác thực (Presentation ➔ Security)
*   **Gọi API RESTful kèm JWT:** Mọi giao diện khi muốn gọi dữ liệu đều phải đi qua `Axios Interceptor` để gán token xác thực.

### 2.3. Kết nối Xử lý AI chạy ngầm (Business Logic ➔ AI Processing)
*   **Tải lên thành công:** Khi file giáo án được parser phân tích thành công, nó gửi tín hiệu kích hoạt `Asynchronous Task Manager` để bắt đầu xử lý ngầm.
*   **Phase 1-2: Cắt Chunk:** Task Manager yêu cầu `Document Lifecycle Manager` chia nhỏ văn bản bài giảng thành các đoạn văn bản (chunks) nhỏ hơn (ví dụ 500 ký tự).
*   **Phase 3: Nhúng Vector:** Task Manager gửi các chunk văn bản qua `Embedding Service` để chuyển thành vector.
*   **Phase 4: LLM trích xuất 12 Thực thể:** Task Manager gửi toàn bộ văn bản qua `LLM Inference Bridge` nhờ LLM trích xuất từ 8 đến 12 khái niệm cốt lõi.
*   **Phase 5: Đồng bộ ghi tệp:** Task Manager gọi đến `Vault Synchronization Engine` để tiến hành tạo file ghi chú.

### 2.4. Kết nối Lưu trữ và Truy vấn CSDL (Tầng trên ➔ Data Storage Layer)
*   **SQL Queries (Đọc/Ghi):** 
    *   Từ `User Controller`, `Document Manager`, `Pedagogical Parser` trỏ xuống **`Bảng Quan Hệ Hệ Thống Thường`** để đọc/ghi thông tin người dùng, trạng thái duyệt giáo án và lưu metadata tệp tin.
*   **Ghi tệp tin vật lý / Dọn dẹp:** Mũi tên từ `Vault Synchronization Engine` trỏ xuống **`Obsidian Vault Store`** để tạo mới, chỉnh sửa hoặc xóa file `.md` vật lý khi giáo án bị xóa.
*   **Direct File I/O Read:** Mũi tên từ `Graph RAG Engine` trỏ xuống **`Obsidian Vault Store`** để đọc nội dung file văn bản khái niệm lấy định nghĩa.
*   **Sinh & Ghi Vector:** Mũi tên từ `Embedding Service` trỏ xuống **`pgvector Extension`** để ghi lưu các vector nhúng của chunk.
*   **Vector Similarity Search:** Mũi tên từ `Graph RAG Engine` trỏ xuống **`pgvector Extension`** để gửi câu lệnh tìm kiếm tương đồng vector.
*   **Yêu cầu hỏi đáp chat:** `Document Lifecycle Manager` chuyển tiếp câu hỏi từ người dùng sang `Graph RAG Retrieval Engine`.
*   **Truy vấn Vector & Graph:** `Graph RAG Engine` gọi `Embedding Service` (để sinh vector câu hỏi) và gọi `LLM Inference Bridge` (để gửi prompt sinh câu trả lời).

---

## 📈 3. Giải Thích Luồng Hoạt Động Theo Trải Nghiệm Giao Diện (UI/UX Workflows)

Dưới đây là mô tả chi tiết cách dữ liệu di chuyển từ các nút bấm, ô nhập liệu trên **Giao diện Frontend (React)** xuống **Bộ xử lý AI** và **Lớp lưu trữ (PostgreSQL / pgvector / Obsidian)**:

---

### Luồng 1: Quy trình Tải lên và Xử lý AI Giáo án (Upload & Ingress Flow)

*Luồng này mô tả trải nghiệm của Giáo viên khi muốn đưa một tài liệu giáo án Word mới lên hệ thống.*

```
   [GIAO DIỆN THƯ VIỆN] ➔ Click "Tải lên" ➔ [POPUP UPLOAD] ➔ Chọn file .docx ➔ Click "Xác nhận"
                                                                                 │
   [HIỂN THỊ TIẾN TRÌNH AI] ➔ Nhận phản hồi "Hoàn thành!" ➔ Giáo án xuất hiện ở [DASHBOARD GRID]
```

*   **Bước 1 - Giao diện chọn file:** Giáo viên truy cập vào **Dashboard & Library View**, nhấp vào nút **`Tải lên giáo án`**. Một hộp thoại **Upload Modal** xuất hiện. Giáo viên chọn file Word (`.docx`) từ máy tính cá nhân và bấm **`Xác nhận`**.
*   **Bước 2 - Gửi file và Xác thực:** Frontend gọi hàm gửi file bằng Axios đi qua **Axios Request Interceptor** (tự động gắn token JWT để kiểm tra quyền Giáo viên). Cổng **API Gateways** (Django `urls.py`) nhận yêu cầu và chuyển file vào bộ điều phối.
*   **Bước 3 - Phân tách cấu trúc file:** Thành phần **Pedagogical & Word Parser** trên Backend lập tức mở file Word, trích xuất văn bản thô cùng tiêu đề, môn học. Sau đó, nó ghi thông tin cơ bản này xuống **Bảng Quan Hệ PostgreSQL** bằng một lệnh `SQL Queries (Đọc/Ghi)`.
*   **Bước 4 - Khởi chạy tiến trình AI ngầm (Hiển thị Loader trên UI):**
    *   Hệ thống trả về mã `200 OK` cho Frontend. Giao diện Thư viện lúc này sẽ hiển thị một **AI Loader (vòng xoay tiến trình)** trên thẻ bài giảng với các trạng thái cập nhật thời gian thực.
    *   Phía Backend, **Asynchronous Task Manager** được kích hoạt để chạy ngầm chuỗi 5 Phase:
        1.  *Phase 1-2 (Cắt Chunk):* Văn bản được cắt nhỏ và ghi vào bảng `DocumentChunk` trong **PostgreSQL DB**.
        2.  *Phase 3 (Nhúng Vector):* Gọi **Embedding Service** để sinh vector ➔ Lưu đè vào cột `embedding` của **pgvector Extension**.
        3.  *Phase 4 (Trích thực thể):* Gọi **LLM Inference Bridge** để bóc tách 8-12 khái niệm ➔ Ghi lưu vào bảng `knowledge_tags` trong **PostgreSQL DB**.
        4.  *Phase 5 (Đồng bộ Obsidian):* Gọi **Vault Synchronization Engine** tạo các file ghi chú Markdown `.md` ➔ Ghi thẳng xuống **Obsidian Vault Store** trên đĩa.
*   **Bước 5 - Kết quả hiển thị:** Sau khi Phase 5 hoàn tất, trạng thái trên thẻ bài giảng trên giao diện web chuyển sang *"Hoàn thành xử lý AI và đồng bộ Obsidian Vault!"*. Giáo án mới chính thức hiển thị trên lưới bài giảng (**Dashboard Grid**) ở trạng thái sẵn sàng để tra cứu hoặc vẽ đồ thị.

---

### Luồng 2: Quy trình Xem Bản đồ tư duy và Đồ thị tri thức (Mindmap & Graph Visualization Flow)

*Luồng này mô tả trải nghiệm của Người dùng khi khám phá mạng lưới kiến thức của tài liệu giáo án.*

```
   [LƯỚI BÀI GIẢNG] ➔ Click chọn 1 giáo án ➔ [WORKSPACE PORTAL GRID]
                                                         │
         ┌───────────────────────────────────────────────┼───────────────────────────────────────────────┐
         ▼                                               ▼                                               ▼
   [Tab Symmetrical Mindmap]                       [Tab Knowledge Graph]                           [Tab Premium WikiNotes]
   (ReactFlow hiển thị sơ đồ)                       (3D/2D Force-Graph)                             (Sidebar note + Badges)
```

*   **Bước 1 - Truy cập Workspace:** Người dùng nhấp chọn một thẻ giáo án trên giao diện **Library View**. Hệ thống chuyển hướng người dùng sang trang **Interactive Portal Grid** (Không gian làm việc tri thức chuyên sâu).
*   **Bước 2 - Vẽ Bản đồ tư duy (Mindmap Tab):**
    *   Nếu chọn tab **Symmetrical Mindmap**, Frontend gửi yêu cầu lấy cấu trúc bài học.
    *   Backend thực hiện truy vấn `SQL Queries (Đọc/Ghi)` vào **Bảng Quan Hệ PostgreSQL** lấy danh sách các đề mục của giáo án đó.
    *   Frontend dùng thư viện ReactFlow vẽ một bản đồ tư duy dạng cây đối xứng, cho phép người dùng nhấp đúp để phóng to/thu nhỏ.
*   **Bước 3 - Vẽ Đồ thị mạng lưới 2D (Knowledge Graph Tab):**
    *   Nếu chọn tab **Knowledge Graph 2D**, hệ thống sẽ dựng một đồ thị lực nút liên kết (Force Graph).
    *   Backend thực hiện lệnh đọc các từ khóa khái niệm được liên kết từ **PostgreSQL DB**, đồng thời mở **Obsidian Vault Store** để kiểm tra các tệp khái niệm liên quan.
    *   Đồ thị 2D hiển thị trên giao diện các chấm tròn (nút bài giảng màu xanh, nút khái niệm màu vàng) kết nối với nhau bằng các đường vẽ chỉ mối quan hệ.
*   **Bước 4 - Đọc ghi chú và Click WikiLinks (WikiNotes Tab):**
    *   Nếu chọn tab **Premium WikiNotes**, giao diện chia làm hai phần: Sidebar bên trái hiển thị danh sách các file `.md` trong Obsidian Vault (lấy từ API Backend đọc thư mục **Obsidian Vault Store**). Khung bên phải hiển thị nội dung chi tiết của ghi chú Markdown được chọn.
    *   Các liên kết dạng `[[Tên Khái Niệm]]` tự động được parser frontend chuyển thành các **Badge màu tím (Glassmorphism Purple Badges)**. Khi người dùng click vào một Badge, hệ thống sẽ thực hiện gọi API Backend đọc tệp (`Direct File I/O Read`) vào **Obsidian Vault Store** để tải nội dung của file khái niệm đó hiển thị đè lên khung đọc ghi chú bên phải ngay lập tức.

---

### Luồng 3: Quy trình Hỏi đáp RAG ngữ nghĩa của Chatbot (AI Chat RAG Flow)

*Luồng này mô tả trải nghiệm của Người dùng khi trò chuyện hỏi đáp trực tiếp với Chatbot AI về nội dung tài liệu.*

```
   [WIDGET CHATBOT] ➔ Nhập câu hỏi ➔ Click gửi ➔ [HIỂN THỊ TYPING LOADER]
                                                           │
   [AI TRẢ LỜI REAL-TIME] ➔ Hiện các [Citation Badges] + [Đồ thị con Subgraph thu nhỏ] dưới câu trả lời
```

*   **Bước 1 - Giao diện Chatbot:** Người dùng click vào biểu tượng Chatbot màu tím ở góc dưới bên phải màn hình để mở **Chatbot Workspace Widget**. Người dùng có thể click vào các câu hỏi gợi ý có sẵn hoặc tự nhập câu hỏi (ví dụ: *"Khẩu phần ăn của học sinh tiểu học cần những dinh dưỡng gì?"*) và nhấn **Gửi**.
*   **Bước 2 - Gửi câu hỏi:** Frontend hiển thị ngay bóng bong câu hỏi của người dùng và hiển thị **Typing Loader (AI đang suy nghĩ...)**. Tin nhắn được gửi lên Backend thông qua API `/api/chat-sessions/.../send/`.
*   **Bước 3 - Truy vấn RAG kết hợp dưới Backend:**
    1.  Backend nhận yêu cầu tại **Document Lifecycle Manager** ➔ Chuyển qua **Graph RAG Retrieval Engine**.
    2.  Engine gửi câu hỏi của user qua **Embedding Service** để đổi thành vector câu hỏi.
    3.  Engine gọi lệnh **Vector Similarity Search** xuống phân vùng **pgvector Extension** của PostgreSQL để lấy ra top các đoạn văn bản (chunks) liên quan nhất.
    4.  Engine truy vấn CSDL quan hệ **PostgreSQL DB** để tìm các nút thực thể liên quan và gọi lệnh đọc file tĩnh **Direct File I/O Read** vào **Obsidian Vault Store** để lấy các định nghĩa khái niệm tương ứng.
    5.  Engine tổng hợp toàn bộ ngữ cảnh thành một Prompt siêu ngữ cảnh và gửi tới mô hình thông qua **LLM Inference Bridge**.
*   **Bước 4 - Trả lời và Hiển thị nguồn trích dẫn:**
    *   LLM sinh câu trả lời và truyền phát (Stream) từng từ về cho Frontend. Giao diện Chatbot hiển thị câu trả lời chạy chữ thời gian thực (Real-time Streaming).
    *   Khi AI trả lời xong, dưới câu trả lời của AI sẽ hiển thị **Các Badge trích dẫn nguồn (Citation Badges)** ghi rõ câu trả lời được lấy từ file nào, đoạn số mấy. Người dùng có thể click vào Badge nguồn này để mở trực tiếp trang tài liệu đó.
    *   Bên cạnh câu trả lời còn hiển thị một **Đồ thị con thu nhỏ (Mini Subgraph Network)** trực quan hiển thị mối quan hệ giữa câu hỏi và các nút thực thể tri thức đã được RAG sử dụng để trả lời.

