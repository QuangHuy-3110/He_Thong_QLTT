# Hướng Dẫn Triển Khai & Kiểm Thử Backend & Database KMS (Knowledge Management System)

Tài liệu này hướng dẫn chi tiết các bước thiết lập, cấu hình, chạy cơ sở dữ liệu và kiểm thử Backend của Hệ thống Quản lý Tri thức Học tập (KMS) từ đầu trên một máy chủ mới hoàn toàn.

---

## 📋 1. Các Yêu Cầu Tối Thiểu (Prerequisites)

Trước khi bắt đầu, hãy đảm bảo máy chủ của bạn đã cài đặt các công cụ sau:
*   **Python**: Phiên bản `3.10` trở lên.
*   **Cơ sở dữ liệu**: PostgreSQL (phiên bản `14` trở lên) hoặc một tài khoản dịch vụ đám mây **Supabase** (khuyên dùng).
*   **Công cụ đi kèm**: `pip`, `virtualenv` (để tạo môi trường ảo).

---

## ⚙️ 2. Các Bước Triển Khai Trên Máy Chủ Mới

### Bước 1: Tải mã nguồn và Di chuyển vào thư mục dự án
Mở terminal và di chuyển vào thư mục backend của dự án:
```bash
cd backend
```

### Bước 2: Khởi tạo và kích hoạt Môi trường ảo (Virtual Environment)
Môi trường ảo giúp cô lập các thư viện của dự án, tránh xung đột hệ thống.
*   **Trên Linux / macOS:**
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```
*   **Trên Windows (Command Prompt hoặc PowerShell):**
    ```cmd
    python -m venv venv
    venv\Scripts\activate
    ```

### Bước 3: Cài đặt các thư viện phụ thuộc (Dependencies)
Nâng cấp `pip` và cài đặt các thư viện định nghĩa sẵn trong `requirements.txt`:
```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### Bước 4: Thiết lập tệp cấu hình môi trường (`.env`)
Tạo một file `.env` mới trong thư mục `backend/` (dựa trên mẫu `.env.example`):

```bash
cp .env.example .env
```

Mở tệp `.env` vừa tạo và cập nhật các thông số kết nối cơ sở dữ liệu và bảo mật của bạn:
```ini
# Cấu hình bảo mật và chế độ Debug của Django
SECRET_KEY=nhap_mot_chuoi_chu_va_so_ngau_nhien_o_day
DEBUG=True

# Cấu hình kết nối Cơ sở dữ liệu (Cách 1: Sử dụng URL đầy đủ - Khuyên dùng cho Supabase)
DATABASE_URL=postgresql://<username>:<password>@<host>:<port>/<db_name>?sslmode=require

# Hoặc Cấu hình kết nối CSDL riêng lẻ (Cách 2)
# DB_NAME=kms_db
# DB_USER=postgres
# DB_PASSWORD=your_password
# DB_HOST=127.0.0.1
# DB_PORT=5432

# Cấu hình tính năng AI RAG & SSO Keycloak
USE_KEYCLOAK=False
USE_AI_RAG=True
```

> [!IMPORTANT]
> Nếu bạn sử dụng **Supabase**, hãy lấy chuỗi kết nối URI tại mục `Project Settings -> Database -> Connection string (URI)` và dán trực tiếp vào trường `DATABASE_URL`.

---

## ⚡ 3. Thiết Lập Cơ Sở Dữ Liệu Ban Đầu

Sau khi đã kết nối thành công tới Database ở bước 2, bạn cần chạy tuần tự các lệnh sau để khởi tạo cấu trúc bảng và nạp dữ liệu mẫu:

### 1. Tạo cấu trúc bảng CSDL (Migrations)
Áp dụng các định nghĩa thực thể vào database thực tế:
```bash
python manage.py migrate
```

### 2. Tạo tài khoản Quản trị viên (Superuser)
Tài khoản này dùng để đăng nhập vào trang quản trị Admin và cấu hình hệ thống:
```bash
python manage.py createsuperuser
```
*Nhập Username, Email và Mật khẩu theo yêu cầu hiển thị trên màn hình.*

### 3. Nạp dữ liệu mẫu để trải nghiệm (Seeding)
Hệ thống hỗ trợ 2 bộ dữ liệu mẫu, hãy chọn một trong hai:
*   **Dữ liệu mẫu cơ bản:**
    ```bash
    python seed.py
    ```
*   **Dữ liệu mẫu nâng cao (Chi tiết và nhiều danh mục hơn):**
    ```bash
    python seed_advanced.py
    ```

---

## 🚀 4. Khởi Chạy Ứng Dụng

### Môi trường Phát triển (Development)
Chạy server phát triển tích hợp sẵn của Django:
```bash
python manage.py runserver 0.0.0.0:8000
```
Server sẽ lắng nghe tại cổng `8000`. Bạn có thể truy cập qua: `http://localhost:8000/`.

### Môi trường Production (Sản phẩm)
Trên máy chủ Production thực tế (như Ubuntu/Debian server), hãy sử dụng Gunicorn để tăng tính ổn định và hiệu năng:
```bash
gunicorn kms_core.wsgi:application --bind 0.0.0.0:8000 --workers 3
```

---

## 🧪 5. Kiểm Thử Hệ Thống (Testing & Health Verification)

Sau khi khởi chạy Backend, bạn có thể thực hiện kiểm thử xem hệ thống có đang hoạt động tốt hay không qua 2 mức độ:

### Mức độ 1: Kiểm thử nhanh thông qua Dòng lệnh tự động (Script Test)
Hệ thống đã chuẩn bị sẵn một file script Python tự động thực hiện gửi các truy vấn API giả lập để kiểm tra tính toàn vẹn của Backend.

Chạy lệnh kiểm thử tự động:
```bash
python test_api_connection.py
```

*   **Nếu thành công**: Terminal sẽ in ra bảng báo cáo `[OK] Backend: ĐANG HOẠT ĐỘNG HOÀN HẢO` cùng trạng thái chi tiết của Cơ sở dữ liệu và cấu hình hệ thống.
*   **Nếu thất bại**: Script sẽ in ra nguyên nhân (ví dụ: mất kết nối, database offline) và hướng dẫn khắc phục chi tiết.

### Mức độ 2: Kiểm thử thủ công qua API Endpoint công khai
Sử dụng công cụ (như Postman, Insomnia) hoặc trình duyệt web để gửi yêu cầu `GET` tới các URL sau:

1.  **API Health Check:** `GET http://localhost:8000/api/health/`
    *   *Mục đích:* Kiểm tra trạng thái máy chủ và kết nối DB trực tiếp (`SELECT 1`).
    *   *Kết quả mong đợi:* HTTP Code `200 OK` kèm JSON:
        ```json
        {
          "status": "ok",
          "database": { "status": "healthy", "error": null },
          "message": "Backend KMS đang hoạt động bình thường!"
        }
        ```
2.  **Trang Admin Panel:** `GET http://localhost:8000/admin/`
    *   *Mục đích:* Đảm bảo trang đăng nhập của Django hiển thị bình thường.
3.  **API Cấu hình Chunking:** `GET http://localhost:8000/api/system-settings/`
    *   *Kết quả mong đợi:* Trả về JSON cấu hình cắt nhỏ văn bản phục vụ RAG.
4.  **API Danh sách Giáo án:** `GET http://localhost:8000/api/lesson-plans/`
    *   *Kết quả mong đợi:* Danh sách giáo án dạng JSON đã được nạp từ bước `seed.py`.

---

## 🛠️ 6. Khắc Phục Các Sự Cố Thường Gặp (Troubleshooting)

| Lỗi gặp phải | Nguyên nhân | Cách khắc phục |
| :--- | :--- | :--- |
| **Error: connection refused / database offline** | Cấu hình `DATABASE_URL` trong `.env` chưa đúng hoặc database thực tế chưa được mở cổng. | Kiểm tra lại thông tin đăng nhập DB trong `.env`. Chạy lệnh `ping` hoặc kiểm tra tường lửa của cổng kết nối DB. |
| **Lỗi thư viện bị thiếu khi chạy lệnh** | Một số thư viện cài đặt lỗi hoặc chưa kích hoạt môi trường ảo. | Đảm bảo bạn đã chạy lệnh kích hoạt venv (`source venv/bin/activate`) trước khi chạy `pip install -r requirements.txt`. |
| **Port 8000 already in use** | Cổng `8000` của máy chủ đang bị một ứng dụng khác chiếm giữ. | Đổi sang cổng khác bằng cách chạy lệnh: `python manage.py runserver 8080`. |
