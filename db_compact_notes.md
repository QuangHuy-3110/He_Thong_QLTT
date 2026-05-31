# Nhật ký Tinh giản và Thu hẹp Cơ sở Dữ liệu KMS (Database Compact Notes)

Tài liệu này ghi nhận quá trình rà soát, đánh giá các bảng dữ liệu thực tế và thực hiện tinh giản cơ sở dữ liệu PostgreSQL chéo hệ thống để tối ưu hóa hiệu năng, loại bỏ các thành phần dư thừa.

---

## 📊 1. Danh sách các Bảng dữ liệu TRƯỚC khi Tinh giản

Trước khi thực hiện tinh giản, cơ sở dữ liệu hệ thống sở hữu tổng cộng **11 bảng dữ liệu chính** được định nghĩa trong `models.py`:

| STT | Tên Model | Tên Bảng tương ứng (DB) | Chức năng & Vai trò | Trạng thái sử dụng |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `User` | `app_user` | Quản lý thông tin tài khoản, mật khẩu, họ tên, avatar và phân quyền người dùng (`ADMIN`, `TEACHER`, `USER`). | **Đang sử dụng tích cực** |
| 2 | `Directory` | `app_directory` | Lưu trữ cấu trúc cây thư mục (cá nhân/công khai) và các siêu thuộc tính mặc định của thư mục. | **Đang sử dụng tích cực** |
| 3 | **`DirectoryPermission`** | `app_directorypermission` | *(Mô hình cũ)* Dự kiến dùng để cấp quyền chi tiết cho từng thư mục riêng lẻ cho giáo viên/thành viên. | ⚠️ **Dư thừa, KHÔNG sử dụng** |
| 4 | `LessonPlan` | `app_lessonplan` | Lưu trữ bài giảng chính, trạng thái phê duyệt, nội dung tóm tắt, tệp tin tải lên và siêu dữ liệu thuộc tính. | **Đang sử dụng tích cực** |
| 5 | `LessonPlanRating` | `app_lessonplanrating` | Lưu trữ nhận xét, đánh giá bằng số sao của người dùng đối với các bài giảng công khai. | **Đang sử dụng tích cực** |
| 6 | `ApprovalRequest` | `app_approvalrequest` | Quản lý tiến trình gửi và phê duyệt bài giảng công khai từ giáo viên đến ban quản trị. | **Đang sử dụng tích cực** |
| 7 | `DocumentChunk` | `app_documentchunk` | Phục vụ Graph RAG: Lưu trữ các đoạn phân mảnh văn bản cấu trúc kèm cột Vector nhúng 1536 chiều (`pgvector`). | **Đang sử dụng tích cực** |
| 8 | `SystemSetting` | `app_systemsetting` | Lưu trữ cấu hình phân mảnh (chunking strategy) và động cơ AI dành cho Admin. | **Đang sử dụng tích cực** |
| 9 | `AIChatSession` | `app_aichatsession` | Quản lý phiên trò chuyện chéo giữa giáo viên và Trợ lý AI (có thể bind với bài giảng focus). | **Đang sử dụng tích cực** |
| 10 | `AIChatMessage` | `app_aichatmessage` | Lưu trữ lịch sử tin nhắn hỏi-đáp RAG chi tiết trong mỗi phiên trò chuyện. | **Đang sử dụng tích cực** |
| 11 | `LessonPlanDirectory` | `app_lessonplan_directories` | Bảng trung gian liên kết Many-to-Many giữa Bài giảng (`LessonPlan`) và Thư mục (`Directory`). | **Đang sử dụng tích cực** |

---

## ✂️ 2. Tiến trình Thực hiện Tinh giản & Xóa bảng thừa

Qua rà soát mã nguồn toàn hệ thống (`views.py`, `serializers.py` và Frontend React), tôi phát hiện bảng **`DirectoryPermission`** là hoàn toàn dư thừa vì hệ thống phân quyền thư mục của chúng ta đã được nâng cấp đệ quy trực tiếp qua trường `user` trong bảng `Directory` và hàm an toàn `get_user_managed_directories` tại `views.py`.

### 🛠️ Các bước thực thi kỹ thuật:
1.  **Chỉnh sửa File Model:** Loại bỏ hoàn toàn định nghĩa class `DirectoryPermission` trong `models.py`.
2.  **Khởi tạo Migrations Drop Table:** Chạy lệnh tạo migration xóa model:
    ```bash
    python manage.py makemigrations
    ```
    *Hệ thống tạo thành công file migration:* `backend/app/migrations/0006_delete_directorypermission.py`
3.  **Áp dụng CSDL thực tế (PostgreSQL):** Thực thi migrate để xóa vật lý bảng `app_directorypermission` ra khỏi PostgreSQL:
    ```bash
    python manage.py migrate
    ```
    *Kết quả chạy lệnh thành công:* `Applying app.0006_delete_directorypermission... OK`

---

## 💎 3. Danh sách các Bảng dữ liệu SAU khi Tinh giản

Cơ sở dữ liệu hệ thống hiện tại đã trở nên vô cùng **gọn nhẹ, tối ưu và sạch sẽ** với đúng **10 bảng hoạt động chính thức**:

1.  `app_user` - Hoạt động tích cực.
2.  `app_directory` - Hoạt động tích cực.
3.  `app_lessonplan` - Hoạt động tích cực.
4.  `app_lessonplan_directories` - Hoạt động tích cực.
5.  `app_lessonplanrating` - Hoạt động tích cực.
6.  `app_approvalrequest` - Hoạt động tích cực.
7.  `app_documentchunk` - Hoạt động tích cực.
8.  `app_systemsetting` - Hoạt động tích cực.
9.  `app_aichatsession` - Hoạt động tích cực.
10. `app_aichatmessage` - Hoạt động tích cực.
11. `django_migrations`, `django_session` (Bảng hệ thống Django mặc định).

Hệ thống cơ sở dữ liệu đã được tinh gọn hoàn mỹ!
