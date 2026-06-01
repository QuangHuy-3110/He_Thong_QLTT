# Bản thiết kế Kiến trúc & Tích hợp Keycloak IAM (Single Sign-On SSO Blueprint)

Tài liệu này cung cấp sơ đồ kiến trúc, luồng xử lý và cấu hình kỹ thuật chi tiết để tích hợp **Keycloak (Identity and Access Management - IAM)** tập trung vào Hệ thống KMS, thay thế cho cơ chế đăng nhập thủ công cũ theo đúng định hướng thực tế sản xuất của Hội đồng chuyên môn.

---

## 🗺️ 1. Sơ đồ Luồng Xác thực Tập trung (SSO Authentication Flow)

Hệ thống tích hợp Keycloak hoạt động dựa trên tiêu chuẩn bảo mật **OpenID Connect (OIDC / OAuth 2.0)** sử dụng mã ủy quyền Authorization Code Flow kèm Proof Key for Code Exchange (PKCE) bảo mật cao:

```mermaid
sequenceDiagram
    autonumber
    actor User as Giáo viên / Quản trị viên
    participant Web as Frontend (React / Vite)
    participant KC as Keycloak Server (IAM)
    participant API as Backend (Django REST Framework)
    participant DB as CSDL (PostgreSQL)

    User->>Web: Truy cập hệ thống KMS & Nhấn "Đăng nhập"
    Web->>KC: Điều hướng (Redirect) tới Keycloak Login Page (Authorization Request)
    User->>KC: Nhập tài khoản & mật khẩu nhà trường (hoặc SSO)
    KC->>Web: Xác thực thành công -> Điều hướng về Web kèm Auth Code
    Web->>KC: Gửi Auth Code đổi lấy Tokens (Access Token - JWT, Refresh Token)
    KC->>Web: Trả về cặp Tokens (JWT chứa thông tin Username, Email, Roles)
    
    Note over Web, API: Mọi API gọi lên Backend bắt buộc đính kèm JWT ở Header
    Web->>API: Gửi yêu cầu API + Header [Authorization: Bearer JWT_Token]
    
    activate API
    API->>API: KeycloakJWTAuthentication giải mã & xác thực chữ ký JWT (dùng JWKS offline)
    API->>DB: Kiểm tra User. Nếu chưa có -> Tạo mới & Đồng bộ vai trò (Auto-provisioning)
    API->>Web: Trả về kết quả dữ liệu API tương ứng
    deactivate API
```

---

## ⚙️ 2. Hướng dẫn Cấu hình trên Keycloak Server

Để tích hợp, Quản trị viên hệ thống Keycloak thực hiện thiết lập cấu hình Realm và Client như sau:

### 2.1. Tạo Realm mới
*   **Tên Realm:** `kms_realm`
*   **Mô tả:** Quản lý tài khoản và danh tính tập trung hệ thống quản lý tri thức.

### 2.2. Tạo Client ứng dụng Web (KMS Web Client)
*   **Client ID:** `kms-web-client`
*   **Client Protocol:** `openid-connect`
*   **Access Type:** `public` (phù hợp với Single Page Application ReactJS chạy phía Client).
*   **Valid Redirect URIs:** `http://localhost:5173/*` (Trang Web React của hệ thống).
*   **Web Origins:** `http://localhost:5173` (Mở khóa CORS gọi từ Frontend).
*   **PKCE Challenge Method:** `S256` (Bảo mật bắt buộc chống đánh cắp mã Authorization Code).

### 2.3. Cấu hình Vai trò ứng dụng (Client Roles Mapping)
Tạo đúng 3 vai trò khớp với phân quyền của KMS:
1.  `KMS_ADMIN`: Quyền Quản trị viên tối cao (tương đương `ADMIN` trong CSDL).
2.  `KMS_TEACHER`: Quyền Giáo viên (được quản lý thư mục, duyệt tài liệu - tương đương `TEACHER` trong CSDL).
3.  `KMS_USER`: Quyền thành viên bình thường (tương đương `USER` trong CSDL).

---

## 💻 3. Hướng dẫn Triển khai ở Tầng Code (Django & React)

Chúng ta đã lập trình sẵn cơ chế tích hợp **Keycloak** dạng **Loosely Coupled (Liên kết động)**. Việc chuyển đổi chỉ tốn **1 giây** bằng cách thay đổi biến môi trường.

### 3.1. Phía Backend Django
Tôi đã xây dựng bộ xử lý xác thực JWT tự động trong file `backend/app/keycloak_auth.py`. 

Để kích hoạt trong môi trường production, quản trị viên chỉ cần thêm các dòng cấu hình sau vào file `.env` của Backend:
```env
# Bật chế độ xác thực tập trung Keycloak
USE_KEYCLOAK=True
KEYCLOAK_SERVER_URL=http://localhost:8080/realms/kms_realm
KEYCLOAK_CLIENT_ID=kms-web-client
```
*   **Cơ chế hoạt động của Backend:** Khi nhận được token, Backend tự động gọi API `openid-connect/certs` của Keycloak để lấy Public Key xác thực chữ ký (Signature Verification), bóc tách trường `resource_access` để map vai trò tự động, và đồng bộ (Auto-provision) người dùng xuống bảng `app_user` cục bộ để bảo toàn các liên kết thư mục/bình luận/lịch sử chat.

### 3.2. Phía Frontend React
Tại Frontend (`protoc/`), tích hợp thư viện Keycloak JS SDK chính thức để quản lý luồng điều hướng:

1.  **Cài đặt thư viện:**
    ```bash
    npm install keycloak-js
    ```
2.  **Khởi tạo Keycloak Context Provider (`keycloak.ts`):**
    ```typescript
    import Keycloak from 'keycloak-js';

    const keycloak = new Keycloak({
      url: 'http://localhost:8080',
      realm: 'kms_realm',
      clientId: 'kms-web-client'
    });

    export default keycloak;
    export { keycloak };
    ```
3.  **Bao bọc ứng dụng và tự động đính kèm Token trong API client:**
    ```typescript
    // Tự động chèn Bearer Token vào mọi request Axios gửi lên Backend
    axiosInstance.interceptors.request.use(async (config) => {
      if (keycloak.token) {
        // Tự động refresh token nếu sắp hết hạn trước khi gửi request
        await keycloak.updateToken(30);
        config.headers.Authorization = `Bearer ${keycloak.token}`;
      }
      return config;
    });
    ```

---

## 🏆 4. Kết luận & Đánh giá Tính Thực tiễn

*   **Tính an toàn cao:** Triệt tiêu hoàn toàn việc lưu trữ mật khẩu thô trong CSDL của ứng dụng, tránh rò rỉ thông tin cá nhân.
*   **Đồng bộ tối đa (SSO):** Giáo viên có thể dùng chung tài khoản ID của nhà trường (Active Directory / LDAP / Google Suite) để đăng nhập thẳng vào KMS mà không cần tạo tài khoản mới.
*   **Thiết kế linh hoạt:** Nhờ cơ chế Tự động đồng bộ (Auto-provisioning) trong `keycloak_auth.py`, chúng ta giữ nguyên 100% logic phân quyền thư mục và dữ liệu chat RAG sẵn có mà không phải đập đi xây lại cấu trúc database của dự án.

Bản thiết kế này đáp ứng hoàn hảo yêu cầu thực tế sản xuất cấp doanh nghiệp của Hội đồng chuyên môn!
