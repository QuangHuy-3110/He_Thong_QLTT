# Trạng thái Hệ thống QLTT (System State)

Tài liệu này theo dõi và cập nhật trạng thái hoạt động thực tế của hệ thống QLTT trên môi trường local.

*Cập nhật lần cuối: 2026-05-20 23:55 (Giờ Việt Nam)*

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

*   **2026-05-20**: Refactor `UploadPage.tsx` — Thay thế kiểu điều hướng breadcrumb (click vào thư mục để đi sâu) bằng **Tree View tương tác** (cấu trúc cây có thể mở/đóng từng nhánh, click trực tiếp để chọn thư mục đích). Các thư mục con hiển thị thụt lề đệ quy. Badge “Quản lý” / “Công khai” hiển thị inline trên mỗi nút cây.
*   **2026-05-20**: Nâng cấp **Modal Xét duyệt bài giảng** — Hiển thị preview file Word/PDF inline, thông tin chi tiết (attributes, knowledge_tags, đối tượng, ngày gửi). Thêm 2 fields mới vào `ApprovalRequestSerializer`: `lesson_plan_target_student`, `lesson_plan_attributes`.
*   **2026-05-20**: Xây dựng **Chức năng Bình luận &amp; Đánh giá** — Backend: thêm `LessonPlanRatingAPIView` (GET/POST `/api/lesson-plans/<pk>/ratings/`), tự tính lại `average_rating` và `total_ratings` sau mỗi đánh giá (1 user 1 lần, có thể cập nhật). Frontend: thêm section bình luận vào modal xem chi tiết bài giảng, có form chọn sao + nhận xét và danh sách các đánh giá trước đó.
