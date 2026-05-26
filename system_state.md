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

*   **2026-05-26**: Nâng cấp **Trang Quản trị Tài khoản Toàn màn hình & Phân quyền Thư mục (Full-Screen Admin Workspace & Cascading Permissions)**:
    - **Dashboard Toàn màn hình**: Thay thế hoàn toàn modal quản lý người dùng cũ chật hẹp bằng một Dashboard độc lập full-screen (`currentView === 'admin'`) mang phong cách giao diện sáng (Light Theme) cao cấp, hài hòa đồng bộ với toàn bộ giao diện hệ thống (sử dụng tông nền xám nhạt gray-50 và sắc trắng sang trọng bg-white).
    - **Sidebar Danh sách & Tìm kiếm**: Sidebar bên trái hiển thị danh sách người dùng, tích hợp bộ tìm kiếm và bộ lọc vai trò trực quan cùng nút "Thêm mới" tài khoản.
    - **Workspace 2 Tab Chức năng**:
        * *Tab Hồ sơ & Bảo mật:* Hỗ trợ chỉnh sửa thông tin (Username, Full Name, Vai trò) và cho phép Admin đặt mật khẩu mới trực tiếp cho người dùng. Tích hợp nút "Xóa tài khoản" (vĩnh viễn) kèm theo cơ chế xác thực an toàn.
        * *Tab Phân quyền thư mục:* Được phân mảnh thành **2 sub-tabs** hoạt động cực kỳ linh hoạt và mượt mà:
            - **Thư mục cá nhân (Personal Directories)**: Hiển thị danh sách cây thư mục cá nhân thuộc sở hữu riêng của người dùng đó. Tích hợp các hộp kiểm phân quyền thông minh cùng nút "Lưu phân quyền thư mục", cho phép Quản trị viên có quyền hạn tối cao thu hồi hoặc cấp thêm quyền quản trị trực tiếp trên chính các thư mục cá nhân của họ.
            - **Thư mục public (Public Directories)**: Hiển thị cây thư mục public đệ quy tích hợp checkbox kế thừa (Cascading Checkboxes) mượt mà để phân quyền quản trị cao nhất.
            - **Cơ chế ẩn hiện nhạy bén realtime**: Cây thư mục public tự động ẩn an toàn **ngay lập tức** khi Admin thay đổi nút chọn vai trò (ROLE) của người dùng thành Thành viên (USER) trong tab Hồ sơ & Bảo mật, không cần phải bấm lưu tài khoản rồi mới có hiệu lực. Tự động chuyển sub-tab về Thư mục cá nhân nếu đang đứng ở tab public.
            - **Xem File và Chi tiết Giáo án của Người dùng khác**: Tích hợp danh sách tệp tin giáo án (`LessonPlan`) thực tế hiển thị thụt lề như các nút lá dạng tài liệu (`📄 [Tên File]`) kèm nhãn trạng thái (`Public` / `Pending` / `Local`) trực tiếp trong các cây thư mục cá nhân và công cộng. Admin có thể click chuột vào tiêu đề tệp tin để **mở xem chi tiết giáo án toàn màn hình** (Split-pane detail modal) của bất kỳ giáo viên nào ngay tại Dashboard quản trị.
    - **Chức năng Khóa/Mở khóa tài khoản (User Lockout)**: Tích hợp nút khóa và mở khóa tài khoản trực tiếp trong Hero Panel quản trị của từng tài khoản dựa trên trường `is_active` mặc định của Django, cập nhật đồng bộ trạng thái badge `🔒 Khóa` trong danh sách tài khoản bên trái.
    - **Bộ API CRUD Backend**: Tích hợp các view `AdminUserListAPIView` (GET/POST) và `AdminUserDetailAPIView` (PATCH/DELETE) để xử lý dữ liệu an toàn, mã hóa mật khẩu bằng thuật toán Django, đồng thời nâng cấp `LessonPlanListAPIView` cho phép tài khoản Admin có quyền truy cập tối cao truy vấn và xem toàn bộ kho tệp tin riêng tư/local của tất cả giáo viên khác trên hệ thống.
    - **Chính sách Bảo vệ Quản trị viên (Mutual Protection Guard)**: 
        * *Bảo vệ lẫn nhau*: Thắt chặt phân quyền ở cả Backend và Frontend, ngăn chặn hoàn toàn việc một tài khoản Admin thực hiện xóa hoặc khóa/mở khóa tài khoản của một Admin khác.
        * *Bảo vệ bản thân*: Ngăn chặn Admin tự khóa hoặc tự xóa tài khoản của chính mình để tránh làm hỏng cấu trúc phân quyền hệ thống.
        * *Giao diện Tinh tế*: Ẩn các nút "Xóa tài khoản" và "Khóa tài khoản" trên Hero Panel khi chọn một tài khoản Admin, thay thế bằng badge trạng thái bảo vệ đặc biệt `🛡️ Tài khoản Admin được bảo vệ` nhằm tăng tính chuyên nghiệp.*   **2026-05-26**: Nâng cấp **Hiển thị File trực tiếp trong cây Thư mục ở Thư viện chung & Thư viện cá nhân (Directory Tree File Visibility)**:
    - **Hiển thị File đệ quy**: Tích hợp danh sách tệp tin giáo án (`LessonPlan`) thực tế hiển thị thụt lề dạng file tài liệu (`📄 [Tên File]`) ngay bên dưới các thư mục tương ứng trong cả hai Tab **Thư viện chung** và **Thư viện cá nhân** trên màn hình chính.
    - **Tương tác nhanh**: Người dùng có thể click vào bất kỳ file nào hiển thị trong cây thư mục để mở trực tiếp cửa sổ xem chi tiết giáo án (Split-pane detail modal) vô cùng tiện lợi.
    - **Hiệu ứng thu gọn thông minh**: Cải tiến nút thu gọn/mở rộng (`▼` / `▶`) để tự động hiển thị linh hoạt khi thư mục có chứa tệp tin hoặc thư mục con, mang lại trải nghiệm mượt mà và trực quan giống hệ thống quản lý tệp tin chuyên nghiệp.
    - **Ràng buộc Đơn Thư Mục (Single Directory Constraint)**:
        * *Logic Chuyển Thư Mục*: Điều chỉnh logic ghi đè của hệ thống để đảm bảo một file giáo án **chỉ được phép tồn tại duy nhất ở một thư mục** tại mọi thời điểm. Khi một bài giảng được phê duyệt hoặc xuất bản trực tiếp lên thư mục công khai, hệ thống sẽ tự động dọn sạch (`clear()`) liên kết tới thư mục cá nhân cũ, giải quyết triệt để tình trạng trùng lặp file hiển thị ở nhiều nơi.
        * *Làm sạch Dữ liệu Phân phối (Seeding & Live DB)*: Cập nhật các tệp tin `seed.py` và `seed_advanced.py` để loại bỏ liên kết thư mục thừa, đồng thời thực thi thành công script làm sạch toàn bộ dữ liệu trùng lặp trên cơ sở dữ liệu Supabase thực tế.
    - **Thắt chặt Bảo mật & Riêng tư (Shared Library Privacy Filter)**: 
        * *Lọc trạng thái Public*: Tại Tab **Thư viện chung**, hệ thống thực hiện bộ lọc nghiêm ngặt ở cả cây thư mục và danh sách lưới. Chỉ các tệp tin có trạng thái công khai **`PUBLISHED`** mới được phép hiển thị.
        * *Ẩn hoàn toàn tệp tin riêng tư*: Mọi tệp tin cá nhân (`LOCAL`) hoặc đang chờ duyệt (`PENDING`) sẽ bị ẩn hoàn toàn để bảo vệ tính bảo mật và riêng tư, chỉ hiển thị đầy đủ khi người dùng chuyển sang Tab **Thư viện cá nhân**.
    - **Nâng cấp Hệ thống Đánh giá & Nhận xét Chuyên môn (Professional Review System Overhaul)**:
        * *Phần Nhận Xét Của Bạn (My Highlighted Review)*: Tách biệt hoàn toàn nhận xét của tài khoản đang đăng nhập lên một phân vùng riêng nổi bật phía trên danh sách chung. Tích hợp nút *"✏️ Chỉnh sửa lại bình luận"* để chuyển đổi động sang giao diện chỉnh sửa inline ngay tại chỗ thay vì cuộn trang; khi chưa có nhận xét, form gửi mới sẽ được hiển thị độc lập.
        * *Thống kê Số Sao (Rating Statistics Chart)*: Thiết kế biểu đồ cột nằm ngang hiển thị trực quan tỷ lệ % số sao (từ 1 đến 5 sao) và số lượng đánh giá thực tế dưới dạng các dải tiến trình (`progress bars`) màu vàng hổ phách bắt mắt, mang lại trải nghiệm giống như các kho ứng dụng chuyên nghiệp.
        * *Bộ lọc Số Sao Linh Hoạt (Star Ratings Filter)*: Tích hợp thanh lọc bằng các nút thuốc viên (`pills`) tương tác động (`Tất cả`, `5 ★`, `4 ★`...). Cho phép người dùng lọc danh sách nhận xét của các đồng nghiệp theo số lượng sao mong muốn chỉ với 1 lượt bấm.
    - **Cải tiến Cây Thư mục & Thanh cuộn (Sidebar Tree Navigation Optimization)**:
        * *Thanh cuộn mỏng cao cấp*: Giới hạn chiều cao tối đa của cây thư mục bằng lớp CSS `.scrollbar-thin` thanh mảnh màu xám dịu tại cả sidebar Thư viện chung và Thư viện cá nhân, giúp tối ưu hóa không gian hiển thị khi danh mục thư mục phình to.
        * *Mặc định hiển thị cấp 2*: Tự động thu gọn các thư mục sâu từ cấp thứ 3 trở đi (`depth >= 2`), giữ cho giao diện luôn gọn gàng, thông thoáng khi mới truy cập và cho phép người dùng tự click để mở rộng các nhánh sâu hơn khi cần.


*   **2026-05-26**: Nâng cấp **Hồ Sơ Cá Nhân & Ảnh Đại Diện (User Avatars & Profile Editing)**:
    - **Thêm trường avatar vào User model**: Bổ sung trường `avatar = models.FileField(...)` vào User model và tạo thành công Django database migrations.
    - **Hỗ trợ Upload đa phương thức**: Cập nhật `UserProfileUpdateAPIView` hỗ trợ cập nhật avatar của người dùng thông qua cả `multipart/form-data` và Base64 raw encoding.
    - **Hiển thị Avatar trong Serializer**: Cập nhật `UserSerializer` và `LessonPlanRatingSerializer` để tự động trả về `avatar_url` và `user_avatar_url` (sử dụng absolute uri), giúp đồng bộ ảnh đại diện trên toàn hệ thống.
    - **Nâng cấp UI Header Profile Modal**: Thiết kế ô tròn hiển thị ảnh đại diện với hiệu ứng hover edit camera overlay cao cấp. Hỗ trợ preview tức thì ngay khi chọn ảnh mới ở máy khách trước khi nhấn Lưu.
    - **Tối ưu hóa Name Card ở Top Navbar**: Tái thiết kế khối thông tin cá nhân ở góc phải thanh điều hướng sang Flex Row chuyên nghiệp, hiển thị Avatar nhỏ gọn bo tròn tinh tế bên cạnh Họ tên & Vai trò.
    - **Hiển thị Avatar trong danh sách Nhận xét**: Tích hợp hiển thị ảnh đại diện thực tế của tác giả bình luận cạnh mỗi nhận xét/đánh giá sao trong Split-pane Detail Modal, tăng độ tin cậy và cá nhân hóa.

*   **2026-05-26**: Thắt chặt **Khử trùng lặp nội dung khi Đăng trực tiếp (Direct Publication)**:
    - **Sửa lỗi Bỏ qua Duplicate Check trong perform_update**: Điều chỉnh `perform_update` trong `LessonPlanDetailAPIView` của Django backend để khi một Admin hoặc Giáo viên có quyền tự động chuyển đổi thư mục lưu tài liệu từ Cá nhân (LOCAL) sang một thư mục công khai mà họ quản lý (PUBLISHED), trạng thái `status` của tài liệu sẽ được thiết lập thành `'PUBLISHED'`. Điều này đảm bảo `status_for_dup` chính xác là `'PUBLISHED'` và kích hoạt cơ chế `check_duplicate_lesson_plan` so khớp nội dung đệ quy chống trùng lặp so với toàn bộ kho dữ liệu công khai.
    - **Bảo mật & Đồng bộ hóa LessonPlanUploadAPIView**: Nâng cấp logic phân giải trạng thái (`resolved_status`) tại backend của `LessonPlanUploadAPIView` để tự động xác thực và gán đúng trạng thái thực tế dựa trên quyền hạn người dùng và loại thư mục đích trước khi gọi hàm chống trùng lặp, chặn hoàn toàn các nỗ lực vượt rào phê duyệt thủ công.
    - **Mở rộng phạm vi kiểm tra trùng lặp LOCAL**: Cập nhật hàm `check_duplicate_lesson_plan` để khi tải lên hoặc chỉnh sửa tài liệu trong thư viện cá nhân (`LOCAL`), hệ thống sẽ thực hiện kiểm tra trùng lặp nội dung không chỉ trong chính thư viện cá nhân của người dùng đó (các tài liệu `LOCAL` của họ) mà còn đối chiếu với cả các tài liệu họ đã đề xuất công khai hoặc đã xuất bản thành công (`PUBLISHED`/`PENDING` do họ tạo).
    - **Hiển thị Đường dẫn đầy đủ của Thư mục Trùng lặp**: Cải tiến cảnh báo trùng lặp trong cả trường hợp trùng tiêu đề lẫn nội dung gần đúng. Thay vì chỉ hiển thị tên thư mục chứa trực tiếp (ví dụ: 'Con người'), hệ thống tự động duyệt đệ quy lên gốc để tạo và hiển thị đường dẫn đầy đủ dạng breadcrumbs của thư mục (ví dụ: 'Sinh học / Động vật / Con người'), giúp giáo viên dễ dàng định vị tài liệu trùng lặp.
    - **Cảnh báo lỗi trực quan trên Frontend**: Nâng cấp hàm `submitEdit` trong `App.tsx` ở Frontend để bóc tách tệp JSON lỗi từ backend (như cảnh báo tài liệu trùng lặp) và hiển thị thông báo `alert` trực tiếp và chi tiết cho giáo viên thay vì thông báo lỗi chung chung.

*   **2026-05-26**: Tinh chỉnh UI/UX, Hợp nhất Tìm kiếm & Khử trùng lặp dữ liệu:
    - **Tìm kiếm đa nhiệm hợp nhất (Unified Contextual Search)**: Mở rộng ô tìm kiếm chính ở Navigation Bar tự động đồng bộ và thực hiện lọc tương ứng ở cả 3 tab (Thư viện chung, Thư viện cá nhân và Lịch sử đóng góp). Tự động thay đổi placeholder theo ngữ cảnh.
    - **Căn giữa name card & SVG edit pen**: Tái thiết kế khu vực hiển thị Tên & Vai trò người dùng ở Navigation Bar sang Flex Column căn giữa (`items-center justify-center text-center`) hoàn hảo. Sử dụng absolute positioning cho icon chỉnh sửa bút chì để loại bỏ hoàn toàn sự xê dịch khi rê chuột.
    - **Tối ưu hóa hiển thị Thư mục trên Card**: Áp dụng bộ lọc thuật toán tìm nút lá (`Leaf directories filter`) ở Frontend để loại bỏ các thư mục cha trung gian và chỉ hiển thị duy nhất tag chứa đường dẫn chi tiết nhất.
    - **Sửa lỗi đếm trùng lặp thư mục**: Sửa đổi hàm đếm số lượng bài giảng trong cây thư mục bằng cơ chế lọc và đếm mảng ID độc bản, đưa các con số hiển thị về chính xác tuyệt đối.
    - **Loại bỏ rác & Seed dữ liệu nâng cao**: Thiết lập tập lệnh `seed_advanced.py` xóa bỏ toàn bộ dữ liệu bài giảng cũ bị thiếu tệp tin, tự động tạo mới 9 bài giảng mẫu chất lượng cao phủ kín 100% tất cả các thư mục con trong hệ thống kèm tệp Word thực tế.
    - **Khử trùng lặp yêu cầu phê duyệt**: Điều chỉnh `update_or_create` của ApprovalRequest trong Django backend chỉ truy vấn dựa trên `lesson_plan=lesson` để tránh nhân bản yêu cầu duyệt rác khi người dùng cập nhật bài giảng.
*   **2026-05-26**: Nâng cấp **UX/UI Chống Trùng Lặp Tài Liệu theo Không Gian**:
    - **Logic chống trùng lặp theo ranh giới không gian (Scope)**: Tách biệt hoàn toàn ranh giới so khớp. Đăng tải Công khai (`PUBLISHED`/`PENDING`) so khớp với toàn bộ kho công khai. Đăng tải cá nhân (`LOCAL`) chỉ so khớp với kho cá nhân riêng tư của chính giáo viên đó (cho phép tồn tại bản cá nhân trùng với bản công khai).
    - **Interactive Warning UI (Tải lên & Đề xuất)**: Thay thế toàn bộ alert bằng Card cảnh báo đỏ Bo-góc Premium trực quan ngay trong form tải lên của `UploadPage.tsx` và Modal đề xuất công khai của `App.tsx`.
    - **Nút tương tác thông minh**: Thêm nút **"🔍 Xem tài liệu đã có"** giúp người dùng đóng nhanh modal/form và tự động chuyển hướng hiển thị ngay panel chi tiết bản gốc trùng lặp để đối chiếu tức thì.
    - **Bóc tách không phân biệt hoa thường**: Sửa đổi đuôi mở rộng thành `.lower().endswith('.docx')` tại Backend Django để tệp `.DOCX` (chữ in hoa) vẫn bóc tách và chạy chống trùng chuẩn xác.
    - **Tối ưu hóa Split-Pane khi xem tài liệu LOCAL**: Khi mở xem chi tiết một tài liệu cá nhân (`LOCAL`), hệ thống tự động ẩn hoàn toàn cột đánh giá & bình luận (do không có nhu cầu đánh giá tài liệu cá nhân), đồng thời kéo giãn cột thông tin tài liệu & preview bản Word/Markdown ra chiếm trọn 100% chiều rộng màn hình, tăng tối đa không gian hiển thị và độ tập trung cho giáo viên.
    - **Kiểm tra trùng lặp Đề xuất Công khai Tức thì**: Thay vì bắt người dùng chọn thư mục rồi mới chạy kiểm tra trùng lặp khi nhấn gửi, hệ thống giờ đây sẽ tự động kích hoạt tiến trình gọi API `/api/lesson-plans/<id>/check-duplicate/` ngay khi vừa bấm nút "Đề xuất công khai". Nếu phát hiện trùng lặp, Card cảnh báo đỏ và nút xem bản gốc trùng lặp sẽ lập tức hiển thị, mang lại trải nghiệm UX cực kỳ nhạy bén và rõ ràng.
    - **Tìm kiếm thông minh & Bộ lọc nâng cao (Hybrid Filter)**:
      * **Backend FTS & JSONField Query**: Triển khai `SearchVector` và `SearchRank` của PostgreSQL để tìm kiếm toàn văn trên cả trường `title` (weight='A') và `content_preview` (weight='B'). Sử dụng toán tử `__contains` của JSONField để lọc chính xác mảng Lớp học (`attributes__lop`).
      * **Top-bar Smart Search & Popover**: Nâng cấp ô tìm kiếm với placeholder tối giản, thêm Popover bộ lọc nhanh chứa Tiết dạy, Môn học.
      * **Sidebar Multi-select Checkbox**: Bổ sung khối "Lớp học" dạng Checkbox Multi-select (`Lớp 10`, `Lớp 11`, `Lớp 12`) trực quan ngay dưới phần "Lọc theo Đối tượng".
      * **Sắp xếp theo độ tương đồng (Relevance)**: Thêm tùy chọn Relevance và tự động chuyển đổi tiêu chí sắp xếp khi FTS query hoạt động.
      * **Card Snippet & Highlight**: Trích xuất đoạn text chứa từ khóa từ Markdown và highlight màu vàng rực rỡ để thu hút giáo viên.
*   **2026-05-25**: Tích hợp **Tự động trích xuất & Điền Form Giáo án Word (Auto-fill & Auto-extraction)** — Phát triển module bóc tách `docx_parser.py` (sử dụng `python-docx`) tại Backend và tích hợp API `/api/lesson-plans/parse-docx/`. Khi giáo viên tải lên giáo án `.docx` tại `UploadPage.tsx` ở Frontend, hệ thống sẽ hiển thị loader và tự động điền các trường: Tiêu đề bài học, Tóm tắt/Mô tả, Đối tượng học sinh (Thành thị/Nông thôn), Loại hình tiết học (Thực hành/Lý thuyết...) và trích xuất các Từ khóa kiến thức một cách nhanh chóng và chính xác.
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
