# Trạng thái Hệ thống QLTT (System State)

Tài liệu này theo dõi và cập nhật trạng thái hoạt động thực tế của hệ thống QLTT trên môi trường local.

*Cập nhật lần cuối: 2026-05-25 12:50 (Giờ Việt Nam)*

---

## 1. Trạng thái Môi trường Local

### 1.1. Cơ sở dữ liệu (PostgreSQL + pgvector)
*   **Cách thức triển khai:** Chạy qua Docker Container.
*   **Tên Container:** `kms-pgvector`
*   **Cổng kết nối:** Ánh xạ từ cổng `5432` của Container ra cổng **`5433`** trên máy Host.
*   **Thông tin kết nối (mật khẩu/user):**
    *   `NAME`: `kms_db`
    *   `USER`: `postgres`
    *   `PASSWORD`: `05112004`
    *   `HOST`: `127.0.0.1`
    *   `PORT`: `5433`
*   **Trạng thái pgvector:** Hoạt động tốt. Đã được cấu hình tự động kích hoạt thông qua migration của Django.

### 1.2. Môi trường ảo Backend (Python venv)
*   **Đường dẫn:** `backend/venv/`
*   **Hệ điều hành tương thích:** Linux (Ubuntu/Debian). *(Môi trường ảo Windows cũ đã được xóa bỏ hoàn toàn).*
*   **Thư viện cài đặt:** Đầy đủ theo [requirements.txt](file:///home/quanghuy/DaiHoc/TTTT/He_Thong_QLTT/backend/requirements.txt) (Django, DRF, psycopg2-binary, pgvector, numpy).
*   **Trạng thái kiểm tra mã nguồn (`check`):** Sạch lỗi (`0 issues`).
*   **Lệnh chạy:** `python manage.py runserver` (đang hoạt động).

### 1.3. Thư mục Frontend (Node.js)
*   **Thư mục:** `protoc/`
*   **Quyền chạy tệp tin (`permissions`):** Đã được cấp quyền thực thi đầy đủ cho thư mục nhị phân (`chmod +x node_modules/.bin/*`).
*   **Lệnh chạy:** `npm run dev` (đang hoạt động ổn định trên Vite).

---

## 2. Trạng thái Cơ sở dữ liệu & Tài khoản Mẫu

*   **Trạng thái Migrations:** Đã di cư hoàn tất tất cả các bảng cơ sở dữ liệu (`auth`, `contenttypes`, `sessions`, `app`...).
*   **Dữ liệu mẫu (Seed Data):** Đã nạp thành công các danh mục cây môn học (Sinh học, Toán học) và các bài giảng mẫu.
*   **Tài khoản đăng nhập có sẵn:**
    *   **Username:** `admin`
    *   **Password:** `admin`
    *   **Quyền hạn:** `ADMIN`

---

## 3. Trạng thái Git & Version Control

*   **Tệp tin `.gitignore`:** Đã khởi tạo hoàn tất ở thư mục gốc để loại bỏ `venv`, `node_modules`, `media/` và `.pnpm-store` (tiết kiệm 2.5 GB bộ nhớ không đẩy lên Git).
*   **Repository:** Đã khởi tạo, commit và đẩy thành công toàn bộ mã nguồn sạch lên GitHub tại link: [https://github.com/QuangHuy-3110/He_Thong_QLTT.git](https://github.com/QuangHuy-3110/He_Thong_QLTT.git) (nhánh `main`).

---

## 4. Lịch sử thay đổi UI gần nhất

*   **2026-05-25**: Tích hợp **Bộ lọc Sắp xếp & Hiển thị ngoại quan số sao** — Xác nhận tính năng sắp xếp theo số sao (Rating) và lượt đánh giá (Total Ratings) hoạt động hoàn hảo dựa trên cơ chế `useMemo` ở Frontend. Đồng thời, đã bổ sung thêm badge **⭐ Số sao trung bình (Số lượt đánh giá)** hiển thị trực quan ở ngoại quan card của cả Thư viện chung và Thư viện cá nhân.
*   **2026-05-25**: Thêm **Bảo mật chống Code Injection cho Bình luận** — Tích hợp thư viện `html` ở Backend Django, tự động escape toàn bộ nội dung bình luận (`html.escape(comment)`) trước khi lưu trữ vào Database để ngăn chặn triệt để các cuộc tấn công XSS / chèn mã độc.
*   **2026-05-25**: Sửa lỗi **Nút Tải tài liệu lên trong Empty State của Cá nhân** — Nút "+ Tải tài liệu lên" xuất hiện khi thư viện cá nhân trống đã được sửa đổi để set đúng `uploadMode='personal'` trước khi chuyển trang, đảm bảo cây thư mục hiển thị đúng chỉ là các thư mục cá nhân riêng tư chứ không bị lẫn thư mục công khai của publish.
*   **2026-05-25**: Sửa **Click biểu tượng logo** quay về **Tab Thư viện chung** — Bổ sung `setHomeTab('library')` vào `onClick` của biểu tượng hệ thống (logo 📚) trên Navigation Bar, đảm bảo khi bấm biểu tượng sẽ luôn quay về tab **Thư viện chung** (không còn bị kẹt ở tab cá nhân/lịch sử nếu đang xem chúng).
*   **2026-05-25**: Đồng bộ **layout card Tư viện cá nhân** — Tái cấu trúc card hiển thị tài liệu trong tab **Thư viện cá nhân** để thống nhất và nhất quán với card trong tab **Thư viện chung**: (1) Thay thế badge trạng thái dạng pill nhỏ bằng badge dạng `rounded-md` đồng bộ màu sắc (sky/amber/rose/emerald); (2) Thêm badge hover **"Xem chi tiết ↗"** ở header card; (3) Thêm nút **"↓ Tải tài liệu"** vào footer (chuyển sang liên kết tải file tương tự thư viện chung); (4) Sắp xếp lại thứ tự badge: đối tượng HS → trạng thái → đường dẫn thư mục; giữ nguyên hộp phản hồi từ chối.
*   **2026-05-25**: Sửa lỗi **dropdown "Lưu vào thư mục" trong Edit Modal** — Khi chỉnh sửa tài liệu cá nhân (`LOCAL`), dropdown thư mục chỉ hiển thị thư mục riêng của người dùng hiện tại (`!is_public && user === currentUser.id`), không còn hiện lẫn thư mục công khai hay thư mục private của người khác. ADMIN được phép thấy tất cả thư mục private để tiện quản trị.
*   **2026-05-25**: Bổ sung **Thanh tìm kiếm & Bộ lọc sắp xếp cho Thư viện cá nhân** — Thêm 2 state mới `personalSearchQuery` và `personalSortBy`. Trong tab Thư viện cá nhân, bổ sung: ô tìm kiếm realtime theo tên/mô tả (có nút xóa ✕), dropdown sắp xếp (Mới nhất/Cũ nhất/Tên A→Z/Tên Z→A), dòng thông tin kết quả tìm kiếm, và trạng thái empty state riêng khi tìm không thấy.
*   **2026-05-25**: Tách biệt **Chế độ Thêm Tài liệu (uploadMode)** — Thêm prop `uploadMode: 'personal' | 'public'` vào `UploadPage.tsx`. Khi bấm "+ Thêm mới" ở Tab Thư viện cá nhân sẽ hiển thị **chỉ thư mục riêng** của người dùng (`!is_public && user === currentUser.id`); khi bấm "Đăng bài giảng" ở Navigation Bar sẽ hiển thị **chỉ thư mục công khai**. Tiêu đề, màu nút, thông báo hướng dẫn đều thay đổi theo mode.
*   **2026-05-21**: Xây dựng **Giao diện Thay đổi Thông tin Cá nhân Chuyên nghiệp (UserProfile Modal)** — Thiết kế hộp thoại hồ sơ cá nhân hiện đại hỗ trợ thay đổi họ tên hiển thị và đổi mật khẩu bảo mật. Hỗ trợ xác thực bằng mật khẩu hiện tại khi thay đổi mật khẩu mới để đảm bảo tính an toàn tối đa cho giáo viên. Tích hợp trực tiếp nút kích hoạt "⚙️ Cá nhân" phong cách trên Navigation Bar.
*   **2026-05-21**: Xây dựng **Bộ lọc Sắp xếp & Phân trang tài liệu (Pagination & Sorting)** — Bổ sung thanh điều khiển đầu danh sách tài liệu thư viện chung cho phép sắp xếp theo: Ngày tải (mới nhất/cũ nhất), Số sao đánh giá (cao nhất/thấp nhất), và Tổng số lượt nhận xét (nhiều/ít). Đồng thời hỗ trợ phân trang động tùy chọn kích thước (10, 15, hoặc 20 tài liệu/trang) với thanh phân trang cao cấp tự động căn chỉnh số lượng trang, hiển thị dấu ba chấm (`...`) khi có quá nhiều trang.
*   **2026-05-21**: Tái cấu trúc giao diện **Chi tiết Bài giảng (Lesson Detail)** thành **Full-screen Split-Pane Layout** — Thay thế modal cũ bằng giao diện toàn màn hình cực kỳ hiện đại, chia đôi theo tỷ lệ 60% bên trái (xem trước tài liệu trực tiếp Word/PDF và Metadata) và 40% bên phải (phần Bình luận & Đánh giá). 
*   **2026-05-21**: Tích hợp **Auto-load feedback/ratings** — Loại bỏ hoàn toàn nút bấm thủ công "Xem bình luận". Giờ đây, khi mở bất kỳ bài giảng nào, hệ thống sẽ tự động kích hoạt `useEffect` tải ngay danh sách nhận xét thời gian thực từ Backend và cập nhật form đánh giá của người dùng hiện tại lên UI.
*   **2026-05-20**: Refactor `UploadPage.tsx` — Thay thế kiểu điều hướng breadcrumb (click vào thư mục để đi sâu) bằng **Tree View tương tác** (cấu trúc cây có thể mở/đóng từng nhánh, click trực tiếp để chọn thư mục đích). Các thư mục con hiển thị thụt lề đệ quy. Badge “Quản lý” / “Công khai” hiển thị inline trên mỗi nút cây.
*   **2026-05-20**: Nâng cấp **Modal Xét duyệt bài giảng** — Hiển thị preview file Word/PDF inline, thông tin chi tiết (attributes, knowledge_tags, đối tượng, ngày gửi). Thêm 2 fields mới vào `ApprovalRequestSerializer`: `lesson_plan_target_student`, `lesson_plan_attributes`.
*   **2026-05-20**: Xây dựng **Chức năng Bình luận &amp; Đánh giá** — Backend: thêm `LessonPlanRatingAPIView` (GET/POST `/api/lesson-plans/<pk>/ratings/`), tự tính lại `average_rating` và `total_ratings` sau mỗi đánh giá (1 user 1 lần, có thể cập nhật). Frontend: thêm section bình luận vào modal xem chi tiết bài giảng, có form chọn sao + nhận xét và danh sách các đánh giá trước đó.
