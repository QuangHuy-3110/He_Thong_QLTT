# Hướng dẫn Kết nối Frontend (GitHub Pages) với Backend & Database chạy Local / Server Riêng

Tài liệu này hướng dẫn cách cấu hình khi **Backend và Database chạy trên máy Local** (hoặc server nội bộ) của bạn bạn, trong khi **Frontend đang chạy online trên GitHub Pages**.

---

## Trường hợp 1: Bạn của bạn tự dùng trang web trên máy của họ (Kết nối trực tiếp Localhost)

Nếu chỉ có **bạn của bạn** mở trang web GitHub Pages trên máy tính cá nhân của họ và kết nối với Backend đang chạy trên chính máy đó (`localhost:8000`).

### Cấu hình Frontend:
*   Mặc định trình duyệt bảo mật chặn các liên kết HTTP từ trang HTTPS (GitHub Pages). Tuy nhiên, **trình duyệt luôn cho phép ngoại lệ đối với địa chỉ `localhost` / `127.0.0.1`**.
*   Bạn của bạn chỉ cần truy cập trang GitHub Pages, mở **F12 Console** và gõ lệnh sau để trỏ về Backend local:
    ```javascript
    localStorage.setItem('kms_api_base_url', 'http://localhost:8000');
    ```
*   F5 lại trang web. Lúc này Frontend online sẽ gọi thẳng về Backend chạy dưới máy của bạn bạn.

---

## Trường hợp 2: Bạn của bạn muốn người khác (Người dùng bên ngoài) truy cập được Backend chạy Local

Nếu Backend và Database chạy trên máy local của bạn bạn (hoặc server nội bộ), nhưng họ muốn **người dùng ở internet** (qua GitHub Pages) có thể kết nối được. Trong trường hợp này, bạn của bạn bắt buộc phải **mở mạng (expose) local server ra internet**.

Có 2 cách phổ biến và an toàn nhất để làm việc này:

### Cách A: Sử dụng Cloudflare Tunnel (Miễn phí, Khuyên Dùng)
Đây là cách chuyên nghiệp nhất, giúp đưa server local ra internet qua HTTPS mà không cần cấu hình Router (mở port).

1.  Bạn của bạn đăng ký tài khoản Cloudflare (miễn phí).
2.  Tải và cài đặt công cụ `cloudflared` trên máy chạy Backend.
3.  Tạo Tunnel kết nối cổng `8000` của Django ra một subdomain của Cloudflare (ví dụ: `https://api.frienddomain.com`).
4.  Subdomain này tự động có **HTTPS** hợp lệ.
5.  **Cấu hình Frontend:**
    *   Tạo file `.env` trong thư mục `protoc/` của Frontend:
        ```env
        VITE_API_BASE_URL=https://api.frienddomain.com
        ```
    *   Deploy lại Frontend: `npm run deploy`.

### Cách B: Sử dụng Ngrok (Nhanh, Tiện Lợi cho Test)
Ngrok tạo ra một đường ống bảo mật HTTPS tạm thời từ máy local ra internet.

1.  Bạn của bạn cài đặt Ngrok từ `ngrok.com`.
2.  Mở Terminal trên máy chạy Backend và gõ lệnh:
    ```bash
    ngrok http 8000
    ```
3.  Ngrok sẽ trả về một đường link HTTPS công khai (ví dụ: `https://xxxx-xx-xx.ngrok-free.app`).
4.  **Cấu hình Frontend:**
    *   Người dùng (hoặc bạn của bạn) mở trang GitHub Pages, chạy lệnh Console:
        ```javascript
        localStorage.setItem('kms_api_base_url', 'https://xxxx-xx-xx.ngrok-free.app');
        ```
    *   Hoặc cấu hình cứng trong `.env` của `protoc/` và build lại.

---

## 3. Cấu hình CORS bắt buộc trên Backend Django

Dù chạy Localhost hay qua Ngrok/Cloudflare, Backend Django trên máy của bạn bạn **bắt buộc phải cho phép tên miền GitHub Pages truy cập**.

Trong file `settings.py` trên Backend của bạn bạn:
```python
# 1. Đảm bảo đã có 'corsheaders' trong INSTALLED_APPS
# 2. Đảm bảo 'corsheaders.middleware.CorsMiddleware' nằm trên cùng của MIDDLEWARE

# 3. Thêm domain GitHub Pages của bạn vào danh sách cho phép:
CORS_ALLOWED_ORIGINS = [
    "https://quanghuy-3110.github.io",
    "http://localhost:5173",  # Cho phép dev local
]
```

*Nếu muốn mở hoàn toàn cho kiểm thử nhanh (không khuyến khích khi production):*
```python
CORS_ALLOW_ALL_ORIGINS = True
```
