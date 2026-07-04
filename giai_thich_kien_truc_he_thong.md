# Tài Liệu Giải Thích Kiến Trúc Hệ Thống Quản Lý Tri Thức (KMS)

Tài liệu này giải thích chi tiết toàn bộ các tầng kiến trúc trong sơ đồ hệ thống **ERP HTQL_TT.drawio** và làm rõ các điểm hiệu chỉnh sơ đồ để phản ánh chính xác luồng hoạt động trong mã nguồn thực tế của bạn.

---

## 🗺️ 1. Giải Thích Toàn Bộ Các Tầng Kiến Trúc (5 Layers)

Kiến trúc hệ thống được thiết kế theo mô hình phân lớp tiêu chuẩn (Tiered Architecture) từ trên xuống dưới, đảm bảo tính cô lập, bảo mật và dễ mở rộng.

```
       [ Access Layer ]  (Người dùng, Giáo viên, Admin)
              │
       [ Presentation Layer ]  (React/Vite Frontend, Canvas, Graphs, WikiNotes)
              │
       [ Security & Integration Layer ]  (Keycloak Identity Provider, JWT Interceptors)
              │
       [ Business Logic Layer ]  (Django MVC, Controllers, Parsers, Sync Engine)
              │
       [ AI Processing Layer ]  (Asynchronous Task, Graph RAG, Embedding, LLMs)
              │
       [ Data Storage Layer ]  (PostgreSQL, pgvector, Obsidian Vault Store)
```

---

### 👥 Tầng 1: Access Layer (Tầng Truy Cập)
Định nghĩa 3 vai trò người dùng (Roles) chính truy cập vào hệ thống với các quyền hạn và mục đích khác nhau:
1.  **Quản trị viên (Admin):** Quản trị hệ thống, thiết lập tham số AI (chọn model API/Local, kích thước cắt chunk, mức độ trùng lặp), theo dõi log hệ thống.
2.  **Giáo viên (Teacher):** Tải lên các tài liệu giáo án (file `.docx`, `.pdf`, `.md`), chỉnh sửa thông tin cá nhân và đề xuất công khai các giáo án cho thư viện chung.
3.  **Người dùng (User - Học sinh/Sinh viên):** Tra cứu thư viện giáo án dùng chung, xem mạng lưới tri thức và tương tác hỏi đáp trực tiếp với Chatbot AI.

---

### 🎨 Tầng 2: Presentation Layer (Tầng Giao Diện)
Phát triển trên nền tảng **React + Vite**, chịu trách nhiệm hiển thị và tương tác trực quan với người dùng.
*   **Các Module điều hướng chính:**
    *   `Admin Config Dashboard`: Giao diện quản lý cấu hình AI dành riêng cho Admin.
    *   `Chatbot Workspace Widget`: Hộp thoại chat nổi đa năng hỗ trợ hỏi đáp RAG.
    *   `Dashboard & Library View`: Thư viện hiển thị danh sách giáo án dạng lưới (Grid), hỗ trợ tìm kiếm và phân loại.
*   **Ba Giao diện Tri thức tương tác nâng cao (Interactive Portal Grid):**
    *   `Symmetrical Mindmap Canvas`: Bản đồ tư duy trực quan hiển thị mối quan hệ phân cấp của giáo án (dùng ReactFlow).
    *   `Knowledge Graph Canvas 2D`: Đồ thị tri thức mạng lưới 2D kết nối các bài giảng và khái niệm (dùng Force Graph).
    *   `Premium WikiNotes Split-Pane`: Giao diện chia đôi màn hình độc đáo: bên trái là mục lục danh sách ghi chú, bên phải là khung đọc nội dung Markdown với các liên kết chéo `[[Khái niệm]]` dạng WikiLinks tựa như Obsidian.

---

### 🛡️ Tầng 3: Security & Integration Layer (Tầng Bảo Mật & Tích Hợp)
Lớp trung gian bảo vệ tài nguyên hệ thống, đứng trước Backend Django.
*   **Axios Request Interceptor:** Tự động đính kèm Token xác thực JWT vào tiêu đề (Header) của mỗi yêu cầu gửi từ Frontend lên Backend.
*   **Keycloak / Local Auth Provider:** Hỗ trợ đăng nhập tập trung (Single Sign-On SSO) qua Keycloak Identity Provider kết hợp cơ chế đăng nhập dự phòng bằng cơ sở dữ liệu cục bộ.
*   **API Gateways & Routers:** Định tuyến luồng URL và phân quyền API truy cập từ ngoài vào.

---

### ⚙️ Tầng 4: Business Logic Layer (Tầng Nghiệp Vụ)
Thành phần xử lý nghiệp vụ chính viết bằng **Django Web Framework**.
*   **User & Account Controller:** Quản lý đăng ký, đăng nhập, thông tin hồ sơ cá nhân và phân quyền.
*   **Document Lifecycle Manager:** Quản lý vòng đời tài liệu (Draft ➔ Pending ➔ Published) và lưu vết lịch sử chỉnh sửa bài giảng.
*   **Pedagogical & Word Parser:** Bộ phân tách mã nguồn tự động đọc và trích xuất cấu trúc văn bản từ các file Word (.docx) tải lên.
*   **Vault Synchronization Engine:** Đồng bộ hóa ghi chú. Khi có giáo án mới hoặc khi có yêu cầu xóa/sửa, engine này sẽ trực tiếp ghi/xóa file vật lý `.md` và dọn dẹp các ghi chú liên đới trong Obsidian Vault.

---

### 🤖 Tầng 5: AI Processing Layer (Tầng Xử Lý AI)
Tầng chịu trách nhiệm về trí tuệ nhân tạo, phân tích ngữ nghĩa và tìm kiếm nâng cao.
*   **Asynchronous Task Manager:** Bộ quản lý tác vụ bất đồng bộ (chạy ngầm). Khi tải giáo án thành công, Task Manager sẽ thực thi chuỗi 5 Phase chạy ngầm độc lập để không làm nghẽn luồng chính của website:
    *   *Phase 1-2:* Cắt nhỏ văn bản thành các đoạn (Chunks).
    *   *Phase 3:* Gọi dịch vụ Embedding để nhúng đoạn văn bản thành vector.
    *   *Phase 4:* Gọi LLM trích xuất 8 đến 12 khái niệm cốt lõi (Entities) của bài học.
    *   *Phase 5:* Gọi Sync Engine ghi file `.md` vào Obsidian Vault.
*   **Embedding Service:** Chuyển đổi văn bản thành chuỗi số vector tương đồng (hỗ trợ OpenAI API hoặc Ollama local).
*   **LLM Inference Bridge:** Cầu nối điều phối câu hỏi đến mô hình ngôn ngữ lớn (Qwen local hoặc các GPT API tùy cấu hình).
*   **Graph RAG Retrieval Engine:** Công cụ cốt lõi khi chat. Khi người dùng hỏi, engine này sẽ thực hiện tìm kiếm vector tương đồng trên pgvector kết hợp duyệt đồ thị tri thức để tổng hợp ngữ cảnh chính xác nhất đưa vào LLM trả lời.

---

### 💾 Tầng 6: Data Storage Layer (Tầng Lưu Trữ Dữ Liệu)
*   **PostgreSQL DB (chứa pgvector Extension):** CSDL chính lưu trữ các bảng quan hệ (tài khoản, bài giảng, lịch sử chat) đồng thời kích hoạt extension `pgvector` để lưu các vector nhúng phục vụ tìm kiếm ngữ nghĩa.
*   **Obsidian Vault Store:** Thư mục lưu trữ vật lý chứa các ghi chú dạng file `.md` tĩnh đồng bộ theo cấu trúc Obsidian.

---

## 🛠️ 2. Giải Thích Chi Tiết Các Phần Đã Chỉnh Sửa Sơ Đồ

Dưới đây là lý do kỹ thuật và chi tiết 5 điểm cải tiến tôi đã chỉnh sửa trong tệp sơ đồ **`ERP HTQL_TT.drawio`** của bạn:

### 1. Hợp nhất pgvector vào trong PostgreSQL DB
*   *Lý do:* Ở sơ đồ cũ, `pgvector Extension` được vẽ như một cơ sở dữ liệu riêng nằm độc lập với `PostgreSQL DB`. Về mặt bản chất, pgvector là một phần mở rộng chạy hoàn toàn **bên trong** PostgreSQL.
*   *Cách sửa:* Gom `pgvector Extension` và `Bảng Quan Hệ Hệ Thống` vào chung một khung hình chữ nhật lớn đại diện cho **PostgreSQL DB** để phản ánh đúng cấu trúc hạ tầng vật lý.

### 2. Sửa hướng mũi tên của `Vault Synchronization Engine`
*   *Lý do:* Ở sơ đồ cũ, mũi tên ghi tệp của `Vault Synchronization Engine` lại chỉ vào PostgreSQL. Thực tế, nhiệm vụ của engine này là ghi tệp tin markdown `.md` trực tiếp vào **Obsidian Vault Store** nằm trên ổ đĩa máy chủ.
*   *Cách sửa:* Kéo mũi tên kết nối từ `Vault Synchronization Engine` trỏ trực tiếp sang **`Obsidian Vault Store`** (nhãn *"Ghi tệp tin vật lý / Dọn dẹp"*).

### 3. Xóa bỏ mũi tên trực tiếp từ `Asynchronous Task Manager` xuống `Obsidian Vault Store`
*   *Lý do:* Tiến trình chạy ngầm không trực tiếp ghi tệp mà phải ủy thác thông qua `Vault Synchronization Engine` ở lớp Logic (qua đường *"Phase 5: Đồng bộ ghi tệp"*). Mũi tên trực tiếp từ Task Manager xuống Vault ở sơ đồ cũ là bị thừa và phá vỡ cấu trúc phân lớp.
*   *Cách sửa:* Xóa bỏ hoàn toàn mũi tên nối thẳng này.

### 4. Xóa bỏ kết nối giữa `Embedding Service` và `Obsidian Vault Store`
*   *Lý do:* `Embedding Service` chỉ là một thư viện sinh vector nhúng (Cosine, L2...). Nó không có nhiệm vụ tìm kiếm tương đồng vector hay đọc/ghi file trực tiếp trên thư mục Obsidian Vault tĩnh.
*   *Cách sửa:* Xóa bỏ hoàn toàn đường nối này để tránh gây hiểu nhầm về chức năng.

### 5. Sửa nhãn kết nối từ `Graph RAG Retrieval Engine` sang `Obsidian Vault Store`
*   *Lý do:* Ở sơ đồ cũ, mũi tên từ Graph RAG chỉ sang Obsidian ghi là *"Vector Similarity Search"*. Thực tế, Obsidian Vault là thư mục file tĩnh không có chỉ mục vector, hệ thống đọc file trực tiếp bằng lệnh Python IO (`open()`) để lấy nội dung khái niệm. Việc tìm kiếm vector thực chất diễn ra ở `pgvector` bên trong PostgreSQL DB.
*   *Cách sửa:* Thay đổi nhãn mũi tên này thành **`Direct File I/O Read`** (Đọc file trực tiếp).

### 6. Thêm đường nối từ `Embedding Service` trỏ vào `pgvector Extension`
*   *Lý do:* Sơ đồ cũ bị thiếu kết nối này khiến `pgvector Extension` mồ côi. Thực tế, khi `Embedding Service` tính toán xong vector nhúng cho các đoạn văn bản (Phase 3), các vector này phải được lưu trực tiếp vào CSDL để dùng về sau.
*   *Cách sửa:* Thêm mũi tên hướng từ `Embedding Service` xuống `pgvector Extension` với nhãn **`Sinh & Ghi Vector`**.

### 7. Thêm đường nối từ `Graph RAG Retrieval Engine` trỏ vào `pgvector Extension`
*   *Lý do:* Sơ đồ cũ bị thiếu luồng truy vấn vector. Khi người dùng chat hỏi đáp, `Graph RAG Retrieval Engine` bắt buộc phải thực hiện phép đối sánh tương đồng vector ngữ nghĩa trên pgvector để tìm các chunk liên quan.
*   *Cách sửa:* Thêm mũi tên hướng từ `Graph RAG Retrieval Engine` xuống `pgvector Extension` với nhãn **`Vector Similarity Search`**.

### 8. Chuẩn hóa tất cả các mũi tên CSDL thành một chiều hướng xuống dưới và đổi tên nhãn thành "SQL Queries (Đọc/Ghi)"
*   *Lý do:* Trong sơ đồ gốc, các mũi tên kết nối với CSDL và Obsidian Vault bị vẽ ngược hướng lên trên hoặc vẽ hai chiều. Về mặt kiến trúc hệ thống, CSDL (PostgreSQL, pgvector) và Vault Store là các thành phần lưu trữ dữ liệu bị động (Passive Storage). Chúng không bao giờ chủ động gọi ngược lên các Controller hay Service. Đồng thời nhãn *"SQL Queries"* cũ có thể gây hiểu lầm là chỉ truy vấn (đọc) mà không ghi dữ liệu.
*   *Cách sửa:* 
    *   Chuyển đổi toàn bộ 7 đường kết nối CSDL và Vault thành **mũi tên một chiều hướng từ trên xuống dưới (đầu mũi tên trỏ vào PostgreSQL DB và Obsidian Vault Store)** để phản ánh chiều gửi yêu cầu (Request/Query).
    *   Đổi tên toàn bộ nhãn *"SQL Queries"* thành **`SQL Queries (Đọc/Ghi)`** để thể hiện rõ ràng PostgreSQL thực thi cả hai thao tác đọc dữ liệu (SELECT) và ghi dữ liệu (INSERT, UPDATE, DELETE).

---

## 📈 3. Luồng Dữ Liệu Thực Tế Khi Hệ Thống Vận Hành

### Luồng 1: Tải lên và xử lý giáo án (Ingress Flow)
```
[File .docx] ➔ [Pedagogical Parser] ➔ Lưu CSDL ➔ Kích hoạt [Task Manager]
                                                      │
                       ┌──────────────────────────────┼──────────────────────────────┐
                       ▼                              ▼                              ▼
             [Phase 1-2: Cắt Chunks]       [Phase 3: Nhúng Vector]        [Phase 4: LLM Trích Thực Thể]
                       │                              │                              │
                       ▼                              ▼                              ▼
            Lưu DB (DocumentChunk)         Lưu pgvector (Embedding)       Lưu DB (Knowledge Tags)
                       │
                       └──────────────────────────────┬──────────────────────────────┘
                                                      ▼
                                           [Phase 5: Đồng bộ ghi tệp]
                                                      │
                                                      ▼
                                        [Vault Synchronization Engine]
                                                      │
                                                      ▼
                                       Ghi file .md vào [Obsidian Vault]
```

### Luồng 2: Hỏi đáp thông minh với Chatbot (RAG Egress Flow)
1.  Người dùng gửi câu hỏi từ **Chatbot Widget** ➔ đi qua **Axios Interceptor** xác thực ➔ chuyển tới **Document Lifecycle Manager**.
2.  Yêu cầu được chuyển tiếp sang **Graph RAG Retrieval Engine**.
3.  Engine gọi **Embedding Service** để vector hóa câu hỏi của người dùng.
4.  Engine gửi vector câu hỏi thực hiện **Vector Similarity Search** trên **pgvector Extension** để lấy ra các đoạn văn bản (chunks) liên quan nhất.
5.  Engine truy vấn các mối quan hệ đồ thị liên kết trong **PostgreSQL DB** để dựng đồ thị con (subgraph).
6.  Đối với mỗi nút khái niệm trong đồ thị con, Engine thực hiện **Direct File I/O Read** vào **Obsidian Vault Store** để đọc mô tả chi tiết của khái niệm đó.
7.  Engine tổng hợp toàn bộ thông tin (chunks + thông tin đồ thị + mô tả khái niệm từ Obsidian) đưa vào prompt gửi qua **LLM Inference Bridge** để sinh câu trả lời cuối cùng gửi lại người dùng.
