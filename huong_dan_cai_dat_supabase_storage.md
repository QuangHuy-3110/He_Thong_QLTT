# Hướng Dẫn Chi Tiết Cấu Hình Supabase Storage Cho Lưu Trữ Giáo Án

Tài liệu này hướng dẫn từng bước (Step-by-Step) cách cấu hình dịch vụ **Supabase Storage** (kho lưu trữ tệp tin đám mây) và lấy các thông tin kết nối (S3 Credentials) để điền vào cấu hình trên Render, giúp hệ thống lưu trữ file Word (.docx) vĩnh viễn và không bị mất khi deploy hoặc khởi động lại server.

## Bước 1: Tạo Storage Bucket `media` trên Supabase

1. Truy cập vào **[Supabase Dashboard](https://supabase.com/dashboard)** và đăng nhập.
2. Chọn dự án của bạn từ danh sách dự án.
3. Ở thanh menu bên trái màn hình, tìm và nhấp vào biểu tượng chiếc hộp (hoặc chữ **Storage**).
4. Nhấp vào nút **New bucket** (nút màu xanh lá ở góc trên bên trái khu vực nội dung).
5. Một hộp thoại pop-up xuất hiện:
   * **Bucket Name:** Điền chính xác chữ `media` (hoặc tên bất kỳ bạn tự chọn, nhưng phải trùng khớp với biến cấu hình sau này).
   * **Allowed MIME types:** Để trống (cho phép tải lên mọi định dạng file) hoặc điền `.docx, .md, .txt` để giới hạn.
   * **Max file size:** Giới hạn kích thước file (ví dụ: `50MB`).
   * **Public bucket:** **[BẮT BUỘC]** Hãy **Bật (Toggle ON)** tùy chọn này. Nếu chọn Public, mọi người dùng đều có thể tải xuống file của bạn trực tiếp thông qua đường dẫn URL mà không cần mã token xác thực hết hạn.
6. Nhấp nút **Save** để hoàn tất việc tạo Bucket.

---

## Bước 2: Lấy thông tin kết nối S3 từ Supabase

Để Django trên Render có thể gửi file trực tiếp vào Bucket `media` vừa tạo, bạn cần lấy 4 thông số kết nối S3.

1. Tại góc dưới cùng bên trái của Supabase Dashboard, nhấp vào biểu tượng bánh răng **Project Settings**.
2. Trong danh sách menu Settings, tìm và nhấp chọn mục **Storage**.
3. Tại giao diện cấu hình Storage, cuộn xuống phần **S3 Connection** hoặc **S3 API**:
   * **S3 URL / Endpoint:** Bạn sẽ thấy một đường dẫn có định dạng:
     `https://<project-ref>.supabase.co/storage/v1/s3`
     *(Trong đó `<project-ref>` là mã ký hiệu duy nhất của dự án của bạn).* **-> Hãy sao chép URL này.**
4. Nhấp vào nút **Generate new S3 Access Key** (Tạo khóa truy cập S3 mới):
   * Sau khi nhấp, hệ thống sẽ sinh ra cho bạn một cặp khóa bao gồm:
     * **Access Key ID:** Một chuỗi ký tự in hoa và số ngẫu nhiên.
     * **Secret Access Key:** Một chuỗi ký tự mật khẩu phức tạp.
   * > [!IMPORTANT]
     > **Lưu ý cực kỳ quan trọng:** Secret Access Key chỉ hiển thị **một lần duy nhất** lúc khởi tạo. Bạn hãy sao chép cả hai giá trị này và lưu lại vào một file ghi chú an toàn trên máy tính của bạn trước khi tắt hộp thoại.

---

## Bước 3: Cập nhật biến môi trường trên Render Dashboard

Bây giờ bạn đã có đầy đủ 4 thông số kết nối. Hãy truy cập vào tài khoản quản trị **Render.com** (nơi bạn deploy Backend):

1. Tìm dịch vụ Backend Web Service của bạn trên Render và nhấp chọn.
2. Ở thanh menu trái của dịch vụ, chọn mục **Environment** (Biến môi trường).
3. Nhấp vào nút **Add Environment Variable** để thêm lần lượt 4 biến môi trường sau:

| Tên biến (Key) | Giá trị (Value) | Giải thích mẫu |
| :--- | :--- | :--- |
| `AWS_ACCESS_KEY_ID` | *Access Key ID của bạn* | Ví dụ: `785d9c223403a749f99e3...` |
| `AWS_SECRET_ACCESS_KEY` | *Secret Access Key của bạn* | Ví dụ: `a48bc952f4c9c10...` |
| `AWS_STORAGE_BUCKET_NAME` | `media` | Tên của bucket bạn đã tạo ở Bước 1. |
| `AWS_S3_ENDPOINT_URL` | *Endpoint URL của bạn* | Ví dụ: `https://awlhzbfknpvzzgdfoyea.supabase.co/storage/v1/s3` |

1. Nhấp **Save Changes** ở phía cuối trang.
2. Render sẽ tự động tiến hành build lại và Deploy lại (Re-deploy) Backend với các biến cấu hình mới này.

---

## Kiểm Tra Hoạt Động

Sau khi Render báo deploy thành công (`Deploy Live`):

1. Truy cập vào trang web của bạn trên Vercel.
2. Đi tới chức năng tải lên bài giảng.
3. Chọn một file Word (`.docx`) mới và thực hiện upload.
4. Nếu upload thành công:
   * Hãy quay lại **Supabase Storage Dashboard** -> Nhấp vào bucket `media` -> Bạn sẽ thấy một thư mục tên là `lesson_plans` được tạo tự động và file Word của bạn nằm trong đó.
   * Truy cập vào trang chi tiết bài giảng trên frontend và thử nhấp nút **Tải tài liệu về máy** để xác nhận file tải về bình thường qua URL có dạng `https://<project-ref>.supabase.co/storage/v1/s3/media/...`.
5. Đợi 15 phút hoặc bấm restart Web Service trên Render để kiểm tra: file của bạn vẫn tồn tại vĩnh viễn và không bao giờ bị mất nữa!
