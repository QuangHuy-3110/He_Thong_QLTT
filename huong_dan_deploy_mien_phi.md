# Hướng Dẫn Deploy Hệ Thống Quản Lý Tri Thức (KMS) Hoàn Toàn Miễn Phí (100% Free)

Tài liệu này hướng dẫn chi tiết cách triển khai (deploy) toàn bộ hệ thống của bạn lên các môi trường cloud miễn phí, tối ưu hóa cấu hình để chạy ổn định mà không tốn bất kỳ khoản chi phí nào.

---

## 🗺️ 1. Tổng Quan Kiến Trúc Deploy

Hệ thống của bạn bao gồm 3 thành phần chính và sẽ được phân bổ deploy như sau:

1. **Database (PostgreSQL + pgvector)**: **Supabase** (Đã cấu hình xong). Supabase cung cấp gói miễn phí trọn đời (500MB database) và hỗ trợ sẵn tiện ích mở rộng `pgvector` phục vụ lưu trữ Vector nhúng.
2. **Backend (Django API)**: **Render.com** (Web Service Free) hoặc **Koyeb.com**. Dùng để xử lý các logic API, trích xuất dữ liệu giáo án và đồng bộ Obsidian.
3. **Frontend (React + Vite)**: **Vercel** hoặc **Netlify**. Đây là các nền tảng hosting tĩnh (Static Site) tốt nhất hiện nay, hoàn toàn miễn phí, hỗ trợ CDN toàn cầu tốc độ cao và không bao giờ bị ngủ (sleep).

---

## ⚙️ 2. Chiến Lược Tối Ưu Hóa Tài Nguyên Cho Gói Miễn Phí (Rất Quan Trọng)

Các máy chủ Cloud miễn phí (Render/Koyeb) giới hạn bộ nhớ RAM ở mức **512MB**. Với cấu hình mặc định chạy ở local, hệ thống Django của bạn sẽ bị sập ngay lập tức (lỗi Out of Memory - OOM). Để khắc phục, bạn bắt buộc phải cấu hình các biến môi trường để tối ưu hóa tài nguyên như sau:

*   **Tắt Keycloak (`USE_KEYCLOAK=False`)**:
    Keycloak chạy trên nền tảng Java Virtual Machine (JVM) yêu cầu tối thiểu **1GB - 2GB RAM** để khởi động. Trên các máy chủ free 512MB RAM, Keycloak không thể chạy được.
    *   *Giải pháp:* Hệ thống của bạn đã tích hợp sẵn cơ chế **Local Fallback** tự động xác thực bằng CSDL Django cục bộ khi tắt Keycloak. Hãy thiết lập `USE_KEYCLOAK=False` để tiết kiệm 100% tài nguyên Keycloak.
*   **Không chạy LLM & Embedding cục bộ**:
    Việc tải mô hình Qwen 2.5 (3B/7B) hoặc SentenceTransformer trực tiếp vào RAM máy chủ sẽ ngốn hàng GB RAM.
    *   *Giải pháp:* Sử dụng **Google Gemini API Key** (Gemini 1.5 Flash có gói miễn phí cực kỳ lớn: 15 yêu cầu/phút, 1 triệu token/phút, hỗ trợ cả API sinh nội dung lẫn API sinh Vector nhúng). Bạn chỉ cần lấy API Key miễn phí từ Google AI Studio và cấu hình vào hệ thống.
*   **Bộ Hashing Vector Ngữ Nghĩa Deterministic**:
    Nếu không muốn dùng API Key của OpenAI/Gemini, hệ thống của bạn đã tích hợp sẵn bộ sinh vector nhúng offline (`generate_deterministic_embedding` trong `embedding_service.py`) tự động chạy khi không phát hiện Ollama/API Key. Bộ sinh này chạy offline bằng thuật toán băm (hashing), tiêu tốn **0MB RAM**!

---

## 🛠️ 3. Các Bước Chuẩn Bị & Deploy Chi Tiết

### Bước 1: Lấy API Key Gemini Miễn Phí (Để chạy AI)
1. Truy cập vào [Google AI Studio](https://aistudio.google.com/).
2. Nhấn **Get API Key** và tạo một khóa API mới (miễn phí).
3. Lưu lại khóa này để cấu hình ở bước Backend.

### Bước 2: Đẩy Mã Nguồn Lên GitHub
1. Tạo một repository (kho lưu trữ) trên GitHub (ở chế độ Private để bảo mật file `.env`).
2. Đẩy toàn bộ thư mục dự án của bạn lên GitHub.

---

### 🗄️ Bước 3: Cấu hình Database & Storage trên Supabase

#### A. Database (Đã Hoàn Thành)
Trong file cấu hình `.env` cục bộ của bạn, bạn đã kết nối thành công tới cơ sở dữ liệu Supabase:
`DATABASE_URL=postgresql://postgres.awlhzbfknpvzzgdfoyea:...@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require`

CSDL này đã được kích hoạt sẵn extension `pgvector` và sẵn sàng sử dụng trong sản xuất.

#### B. Cấu hình Supabase Storage (Lưu trữ file vĩnh viễn miễn phí)
Để lưu trữ file Word/PDF vĩnh viễn không bị mất khi deploy Render Free:
1. Truy cập [Supabase Dashboard](https://supabase.com/) -> Chọn dự án của bạn.
2. Vào mục **Storage** (ở thanh menu bên trái) -> Chọn **New Bucket**.
   * **Name**: Nhập `kms-media` (hoặc tên bất kỳ).
   * **Public bucket**: **Bật** (Rất quan trọng để mọi người có thể xem/tải file).
   * Nhấn **Save**.
3. Vào **Project Settings** (biểu tượng bánh răng ở góc dưới bên trái) -> Chọn **Storage**.
   * Tại phần **S3 Compatibility**, nhấn nút **Generate new credentials** (Tạo thông tin xác thực mới).
   * Lưu lại **Access Key ID** và **Secret Access Key** được hiển thị (bạn sẽ điền các giá trị này vào biến môi trường trên Render ở Bước 4).
   * Endpoint S3 của bạn sẽ có định dạng: `https://awlhzbfknpvzzgdfoyea.supabase.co/storage/v1/s3` (với `awlhzbfknpvzzgdfoyea` là Project Ref của bạn).

---

### 🐍 Bước 4: Deploy Backend (Django) lên Render.com

Render là nền tảng dễ sử dụng nhất để deploy ứng dụng Python Django.

1. Truy cập [Render.com](https://render.com/) và đăng nhập bằng tài khoản GitHub của bạn.
2. Click **New +** ở góc phải màn hình -> Chọn **Web Service**.
3. Kết nối với repository GitHub chứa dự án của bạn.
4. Cấu hình các thông số Deploy:
    *   **Name**: `he-thong-qltt-backend` (hoặc tên bất kỳ).
    *   **Region**: Chọn **Singapore** (Gần Việt Nam nhất để tối ưu hóa độ trễ).
    *   **Branch**: Chọn branch chính chứa code sạch của bạn (ví dụ: `main`).
    *   **Root Directory**: Điền `backend` *(Rất quan trọng, để Render nhận diện đúng thư mục chứa file manage.py và requirements.txt)*.
    *   **Runtime**: Chọn `Python`.
    *   **Build Command**:
        ```bash
        pip install -r requirements.txt && python manage.py collectstatic --noinput
        ```
    *   **Start Command**:
        ```bash
        gunicorn kms_core.wsgi:application --bind 0.0.0.0:$PORT
        ```
    *   **Instance Type**: Chọn **Free** ($0/month).

5. Nhấp vào mục **Advanced** để cấu hình **Environment Variables (Biến môi trường)**:
    Thêm các key-value sau để cấu hình Django chạy ở chế độ Production an toàn và tối giản RAM:

    | Tên Biến (Key) | Giá Trị (Value) | Giải Thích |
    | :--- | :--- | :--- |
    | `DEBUG` | `False` | Tắt chế độ debug để bảo mật hệ thống và tăng hiệu năng. |
    | `SECRET_KEY` | *Nhập một chuỗi ký tự ngẫu nhiên bất kỳ* | Dùng để mã hóa phiên đăng nhập của Django. |
    | `DATABASE_URL` | *Đường dẫn kết nối database Supabase của bạn* | Liên kết trực tiếp tới database Cloud đã cấu hình. |
    | `USE_KEYCLOAK` | `False` | **Bắt buộc**. Chuyển sang xác thực nội bộ để tránh sập RAM máy chủ. |
    | `USE_AI_RAG` | `True` | Bật tính năng AI RAG phục vụ chat sư phạm. |
    | `ALLOWED_HOSTS` | `*` | Cho phép mọi domain truy cập API (hoặc điền domain Render sau khi hoàn tất). |
    | `USE_S3` | `True` | Bật tính năng lưu trữ file lên đám mây (Supabase Storage). |
    | `AWS_ACCESS_KEY_ID` | *Access Key ID vừa lấy từ Supabase* | Mã định danh truy cập S3. |
    | `AWS_SECRET_ACCESS_KEY` | *Secret Access Key vừa lấy từ Supabase* | Mật khẩu truy cập bảo mật S3. |
    | `AWS_STORAGE_BUCKET_NAME` | `kms-media` | Tên Bucket bạn tạo ở Supabase Storage. |
    | `AWS_S3_ENDPOINT_URL` | `https://awlhzbfknpvzzgdfoyea.supabase.co/storage/v1/s3` | S3 Endpoint của dự án Supabase. |
    | `AWS_S3_REGION_NAME` | `ap-southeast-1` | Vùng lưu trữ (mặc định cho khu vực Đông Nam Á). |
    | `AWS_S3_CUSTOM_DOMAIN` | `awlhzbfknpvzzgdfoyea.supabase.co/storage/v1/object/public/kms-media` | URL công khai của Bucket (để frontend tải ảnh/file trực tiếp không cần ký khóa bảo mật). |

6. Click **Create Web Service**. Render sẽ tiến hành build và khởi động Django API. 

> [!NOTE]
> **Hạn chế của Render Free:** Máy chủ sẽ tự động đi vào trạng thái ngủ (sleep) sau 15 phút không có yêu cầu nào gửi đến. Khi có người dùng truy cập lại, Render cần khoảng 40-50 giây để khởi động lại máy chủ (Cold Start). Sau khi thức dậy, hệ thống sẽ phản hồi nhanh bình thường.

---

### ⚛️ Bước 5: Deploy Frontend (React/Vite) lên Vercel

Vercel là nền tảng tối ưu nhất cho các ứng dụng Frontend.

1. Truy cập [Vercel.com](https://vercel.com/) và đăng nhập bằng tài khoản GitHub.
2. Click **Add New...** -> Chọn **Project**.
3. Chọn repository của bạn từ danh sách.
4. Cấu hình thông số Deploy:
    *   **Project Name**: `he-thong-qltt-web`
    *   **Framework Preset**: Chọn **Vite**.
    *   **Root Directory**: Điền `protoc` *(Rất quan trọng, để Vercel build đúng React project)*.
    *   **Build Command**: `npm run build` (hoặc `pnpm build` / `yarn build`).
    *   **Output Directory**: `dist`.
    *   **Environment Variables**:
        Thêm biến môi trường để React Client biết cách gọi tới Backend API vừa deploy:
        *   **Key**: `VITE_API_BASE_URL`
        *   **Value**: *Đường dẫn URL của backend Render vừa deploy xong* (Ví dụ: `https://he-thong-qltt-backend.onrender.com`).
5. Click **Deploy**. Vercel sẽ build và cung cấp cho bạn một domain miễn phí dạng `he-thong-qltt-web.vercel.app` hoạt động 24/7 và không bao giờ bị ngủ.

---

## ⚡ 4. Khởi Tạo Cơ Sở Dữ Liệu Ban Đầu (Migrations & Seeding)

Sau khi Backend trên Render đã được deploy thành công, bạn cần chạy các câu lệnh Django để tạo bảng CSDL và nạp dữ liệu mẫu ban đầu:

1. Vào trang quản trị dịch vụ Web Service của bạn trên Render.
2. Nhấp vào mục **Shell** ở thanh công cụ bên trái (đây là terminal kết nối trực tiếp vào container đang chạy).
3. Lần lượt chạy các lệnh sau:
    *   **Tạo cấu trúc bảng CSDL (Migrations):**
        ```bash
        python manage.py migrate
        ```
    *   **Tạo tài khoản Admin hệ thống:**
        ```bash
        python manage.py createsuperuser
        ```
        *(Nhập username, email và password của bạn để đăng nhập trang Admin)*.
    *   **Nạp dữ liệu mẫu ban đầu (Nếu cần):**
        ```bash
        python seed.py
        ```
        hoặc nạp dữ liệu mẫu nâng cao:
        ```bash
        python seed_advanced.py
        ```

---

## 🧠 5. Hướng Dẫn Cấu Hình Và Sử Dụng AI Trên Giao Diện Web

Khi bạn đăng nhập vào website đã deploy, hãy thực hiện cấu hình AI như sau:

1. Khi thực hiện **Tải tài liệu mới lên** hoặc **Reprocess (Xử lý lại bài giảng)**:
    *   Tại mục cấu hình AI Engine: chọn chế độ **AI Mode** là `api`.
    *   Điền **API Key** là khóa Gemini API miễn phí bạn đã lấy ở Bước 1.
    *   Chọn tên mô hình (**AI Model**): `gemini-1.5-flash` (đối với Gemini) hoặc `gpt-4o-mini` (nếu dùng OpenAI API Key).
2. Hệ thống backend sẽ tự động chuyển hướng các tác vụ trích xuất thực thể, sinh mô tả học thuật và sinh Vector nhúng thông qua API Cloud của Google. 
3. Quá trình xử lý sẽ diễn ra cực kỳ nhanh chóng (chỉ mất 3-5 giây cho mỗi tài liệu), tiêu thụ **0MB RAM** trên máy chủ Render của bạn và hoàn toàn miễn phí!
