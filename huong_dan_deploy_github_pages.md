# Hướng Dẫn Deploy Frontend (Vite/React) lên GitHub Pages (Chạy Song Song Với Vercel)

Tài liệu này hướng dẫn chi tiết cách cấu hình và triển khai (deploy) ứng dụng Frontend React (nằm trong thư mục `protoc/` của dự án) lên **GitHub Pages**, hoạt động song song cùng với bản deploy **Vercel** hiện tại mà không gây xung đột.

---

## 🗺️ Quy Trình Tổng Quan

Khi chạy song song cả hai nền tảng:
*   **Vercel**: Tự động lắng nghe nhánh chính (`main`) và build tự động với đường dẫn gốc `/`.
*   **GitHub Pages**: Sử dụng **GitHub Actions** tự động chạy quy trình build khi push code mới, thiết lập đường dẫn gốc theo tên repository `/he-thong-qltt/` và đẩy bản build vào nhánh phụ `gh-pages`.

---

## 🛠️ Bước 1: Cấu hình `vite.config.ts` (Sửa lỗi màn hình trắng)

Vì GitHub Pages lưu trữ dự án của bạn tại đường dẫn `https://<username>.github.io/<tên-repo>/` chứ không phải ở gốc tên miền, bạn cần cập nhật `vite.config.ts` để Vite nhận diện đúng đường dẫn tải file tĩnh (`base` path).

1. Mở file `protoc/vite.config.ts`.
2. Chỉnh sửa cấu hình thuộc tính `base` như sau:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Hãy thay 'He_Thong_QLTT' bằng tên chính xác của repository của bạn trên GitHub
const repoName = 'He_Thong_QLTT' 

export default defineConfig({
  plugins: [react()],
  // Tự động sử dụng path của repo khi build production cho GitHub Pages, giữ nguyên '/' cho môi trường dev và Vercel
  base: process.env.GITHUB_ACTIONS === 'true' ? `/${repoName}/` : '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Các cấu hình khác của bạn...
})
```

---

## 🔀 Bước 2: Xử lý lỗi tải lại trang 404 (SPA Router Fallback)

GitHub Pages là hệ thống hosting tĩnh thuần túy, không tự động chuyển hướng các route ảo (như `/dashboard`, `/lesson-plans`) về `index.html`. Nếu người dùng F5 tải lại trang, họ sẽ nhận lỗi 404 từ GitHub Pages.

Hãy chọn **một trong hai** phương án giải quyết dưới đây:

### 👉 Cách 1: Chuyển sang dùng `HashRouter` (Dễ nhất & Khuyên dùng)
Thay vì sử dụng `BrowserRouter`, bạn hãy sử dụng `HashRouter` trong file cấu hình định tuyến của React (thường ở `src/app/App.tsx` hoặc `src/main.tsx`).

*   **Trước đây:**
    ```typescript
    import { BrowserRouter } from 'react-router-dom';
    // ...
    <BrowserRouter>
      <App />
    </BrowserRouter>
    ```
*   **Chuyển thành:**
    ```typescript
    import { HashRouter } from 'react-router-dom';
    // ...
    <HashRouter>
      <App />
    </HashRouter>
    ```
> [!NOTE]
> Đường dẫn trên trình duyệt của bạn lúc này sẽ thêm một dấu `#` ở giữa (Ví dụ: `https://quanghuy.github.io/He_Thong_QLTT/#/dashboard`). Đây là cơ chế chạy an toàn nhất trên mọi nền tảng hosting tĩnh mà không cần cấu hình server-side.

---

### 👉 Cách 2: Sử dụng Script Hack chuyển hướng (Giữ nguyên `BrowserRouter`)
Nếu bạn muốn giữ đường dẫn đẹp không có dấu `#`, hãy sử dụng thủ thuật tự động chuyển hướng lỗi 404:

1.  Tạo một tệp tin tên là `404.html` đặt trong thư mục **`protoc/public/`** với nội dung sau:
    ```html
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>KMS System Redirect</title>
        <script type="text/javascript">
          // Script chuyển hướng route ảo về trang index.html kèm tham số query
          var pathSegmentsToKeep = 1; // Đặt là 1 nếu trang chạy trên subpath repo github
          var l = window.location;
          l.replace(
            l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
            l.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/') +
            '/?/redirect=' +
            l.pathname.slice(1).split('/').slice(pathSegmentsToKeep).join('/').replace(/&/g, '~and~') +
            (l.search ? '&' + l.search.slice(1).replace(/&/g, '~and~') : '') +
            l.hash
          );
        </script>
      </head>
      <body>
      </body>
    </html>
    ```
2.  Thêm đoạn mã xử lý sau vào phần đầu của tệp tin **`protoc/index.html`** (trong thẻ `<head>`):
    ```html
    <script type="text/javascript">
      // Đọc tham số chuyển hướng từ 404.html và ghi đè lại history route
      (function(l) {
        if (l.search[1] === '/' ) {
          var decoded = l.search.slice(1).split('&').map(function(s) {
            return s.replace(/~and~/g, '&')
          }).join('?');
          window.history.replaceState(null, null,
              l.pathname.slice(0, -1) + decoded + l.hash
          );
        }
      }(window.location));
    </script>
    ```

---

## 🤖 Bước 3: Tạo File Cấu hình Tự Động Triển Khai (GitHub Actions)

Để tự động build và deploy lên GitHub Pages mỗi khi push code lên nhánh chính (`main`), bạn hãy tạo một tệp tin workflow cho GitHub Actions:

1. Tạo thư mục cấu hình tại gốc dự án: `.github/workflows/` (nếu chưa có).
2. Tạo tệp tin tên là **`deploy-pages.yml`** trong thư mục đó:
   *   *Đường dẫn đầy đủ:* `.github/workflows/deploy-pages.yml`
3. Dán nội dung cấu hình sau vào tệp tin:

```yaml
name: Deploy Frontend to GitHub Pages

on:
  push:
    branches:
      - main # Tự động chạy khi có code mới push lên nhánh main
    paths:
      - 'protoc/**' # Chỉ chạy khi có thay đổi trong thư mục frontend protoc

permissions:
  contents: write

jobs:
  build-and-deploy:
    concurrency: ci-${{ github.ref }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout mã nguồn
        uses: actions/checkout@v4

      - name: Cài đặt Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'npm'
          cache-dependency-path: 'protoc/package-lock.json'

      - name: Cài đặt dependencies
        run: |
          cd protoc
          npm ci

      - name: Build ứng dụng React (Vite)
        env:
          # Cấu hình biến môi trường trỏ tới link API Backend của bạn (Ví dụ Render URL)
          VITE_API_BASE_URL: https://he-thong-qltt-backend.onrender.com
        run: |
          cd protoc
          npm run build

      - name: Triển khai lên GitHub Pages (Branch: gh-pages)
        uses: JamesIves/github-pages-deploy-action@v4
        with:
          folder: protoc/dist # Thư mục build đầu ra của Vite
          branch: gh-pages # Nhánh đích chứa bản build để host lên Pages
```

---

## ⚙️ Bước 4: Thiết lập trên GitHub Repository của bạn

Sau khi đã commit và push các thay đổi trên lên GitHub:

1. Truy cập vào Repository của bạn trên website GitHub.
2. Đi tới mục **Settings (Cài đặt)** -> **Pages** ở danh sách tùy chọn bên trái.
3. Tại phần **Build and deployment**:
   *   **Source**: Chọn `Deploy from a branch`.
   *   **Branch**: Chọn nhánh **`gh-pages`** và thư mục gốc **`/ (root)`**.
4. Nhấn **Save (Lưu)**.
5. Đợi khoảng 1-2 phút, GitHub sẽ hiển thị đường link trang web của bạn tại phần đầu trang Pages (Ví dụ: `Your site is live at https://<username>.github.io/He_Thong_QLTT/`).

Giờ đây, bạn đã triển khai thành công song song frontend lên cả Vercel và GitHub Pages!
