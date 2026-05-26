# Bản đồ liên kết hệ thống (System Blueprint) - Hệ thống QLTT

Tài liệu này đóng vai trò là **Bản đồ liên kết** giúp lập trình viên và AI hiểu nhanh cấu trúc hệ thống, sơ đồ luồng dữ liệu, và danh sách các tệp cùng hàm quan trọng trong dự án mà không cần phải đọc lại toàn bộ mã nguồn.

---

## 1. Sơ đồ Cấu trúc Dự án
Dưới đây là sơ đồ thư mục chính của dự án thể hiện vị trí các thành phần cốt lõi:

```text
He_Thong_QLTT/
├── backend/                  # Mã nguồn Backend (Django, DRF, PostgreSQL)
│   ├── app/                  # Django App chính (Quản lý nghiệp vụ)
│   │   ├── models.py         # Định nghĩa các bảng Database (PostgreSQL + pgvector)
│   │   ├── views.py          # Logic xử lý API / Controller
│   │   ├── serializers.py    # Serializers chuyển đổi dữ liệu Model <=> JSON
│   │   └── urls.py           # Định tuyến các API Endpoint
│   ├── kms_core/             # Cấu hình chính của Django project
│   │   └── settings.py       # Thiết lập kết nối DB, Middleware, Installed Apps
│   ├── manage.py             # Script quản trị Django
│   └── seed.py               # Script tạo dữ liệu mẫu ban đầu
│
├── protoc/                   # Giao diện Frontend (React + Vite + TypeScript)
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx       # Component cốt lõi điều khiển toàn bộ ứng dụng
│   │   │   ├── UploadPage.tsx # Trang đăng bài giảng mới (gồm Tree View chọn thư mục)
│   │   │   ├── context.tsx   # React Context lưu trữ trạng thái chia sẻ (nếu có)
│   │   │   └── components/   # Các trang và thành phần giao diện phụ trợ
│   │   │       ├── AuthPage.tsx             # Giao diện Đăng nhập / Đăng ký
│   │   │       ├── DetailPage.tsx           # Giao diện xem chi tiết & Trò chuyện với AI (RAG)
│   │   │       ├── LessonPlanListPage.tsx   # Danh sách và lưới hiển thị giáo án
│   │   │       ├── SearchPage.tsx           # Thanh tìm kiếm & bộ lọc nâng cao
│   │   │       ├── WorkspacePage.tsx        # Cây thư mục bên trái (Sidebar)
│   │   │       └── UserManagementPage.tsx   # Quản lý người dùng & phân quyền (Chỉ cho Admin)
│   │   ├── main.tsx          # Điểm khởi đầu khởi chạy ứng dụng React
│   │   └── styles/           # CSS và theme giao diện (gồm default_shadcn_theme.css)
```

---

## 2. Sơ đồ Luồng Dữ liệu (Data Flow)

### 2.1. Luồng Tải lên Giáo án và Phê duyệt (Lesson Plan Upload & Approval Flow)
Luồng này điều khiển việc tải giáo án mới lên thư mục và kiểm soát trạng thái xuất bản dựa trên vai trò của người dùng:

```text
[User / Teacher] 
   └──(Chọn file & nhập Metadata)──> [Frontend: App.tsx / UploadPage.tsx]
                                               │
                                   (POST /api/lesson-plans/upload/)
                                               ▼
                                [Backend: LessonPlanUploadAPIView]
                                               │
                       ┌───────────────────────┴───────────────────────┐
             (Nếu status == 'PENDING')                           (Nếu status == 'LOCAL' / 'DRAFT')
                       │                                               │
                       ▼                                               ▼
         [Tạo mới ApprovalRequest]                             [Lưu trực tiếp LessonPlan]
         [Trạng thái LessonPlan = 'PENDING']                   [Trạng thái LessonPlan = 'LOCAL']
                       │                                               │
                       └───────────────────────┬───────────────────────┘
                                               │
                                               ▼
                                    [Database (PostgreSQL)] 
                                               ▲
                                               │
                                   (Yêu cầu duyệt / Phê duyệt)
                                               │
[Admin / Teacher] ──(Review & Duyệt)──> [Backend: ApprovalRequestDetailAPIView]
                                               │
                                               └──> Đổi trạng thái LessonPlan -> 'PUBLISHED'
```

### 2.2. Luồng Đề xuất Công khai tài liệu cá nhân (Propose Public Flow)
Luồng này cho phép chuyển đổi một giáo án cá nhân (`LOCAL` / `REJECTED`) sang chế độ chờ duyệt công khai trên thư viện chung:

```text
[User / Creator] 
   └──(Bấm đề xuất & Chọn thư mục công khai)──> [Frontend: App.tsx (Propose Modal)]
                                                           │
                                            (POST /api/lesson-plans/<id>/propose/)
                                                           ▼
                                            [Backend: LessonPlanProposeAPIView]
                                                           │
                                   ┌───────────────────────┴───────────────────────┐
                     (Cập nhật status -> 'PENDING')                 (Cập nhật liên kết Directory công khai)
                                   │                                               │
                                   ▼                                               ▼
                             [Lưu LessonPlan]                              [Tạo/Cập nhật ApprovalRequest]
                                   │                                               │
                                   └───────────────────────┬───────────────────────┘
                                                           │
                                                           ▼
                                                [Database (PostgreSQL)]
```


### 2.3. Luồng Quản trị và Phân quyền Thư mục (Admin Users & Directory Permission Flow)
Luồng này cho phép `ADMIN` có toàn quyền điều hành quản lý tài khoản người dùng khác, cấp quyền quản trị các cây thư mục công khai và khóa/mở khóa tài khoản:

```text
                  [Admin] ──(Click 'Quản lý người dùng')──> [currentView = 'admin'] (Toàn màn hình)
                                                                 │
       ┌──────────────────────────────────┬───────────────────────┼──────────────────────────────────┬──────────────────────┐
       ▼                                  ▼                       ▼                                  ▼                      ▼
 [Thêm tài khoản]                 [Chọn tài khoản]        [Chỉnh sửa thông tin]              [Xóa tài khoản]         [Khóa / Mở khóa]
 (POST /api/admin/users/)                 │               (PATCH /api/admin/users/<id>/)     (DELETE /...)          (PATCH is_active)
                                          ▼
                         [📁 Quản lý thư mục & Phân quyền]
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
     [Tab: Thư mục cá nhân]                           [Tab: Thư mục public] (Ẩn với Thành viên)
     (Xem cây thư mục riêng tư                        (Tích chọn phân quyền đệ quy
      do người dùng sở hữu)                            POST /api/admin/users/<id>/permissions/)
```

---

## 3. Bản đồ các File và Hàm quan trọng

### 3.1. Phía Backend (`backend/app/`)

#### A. File `backend/app/models.py` (Mô hình Dữ liệu)
Chứa các định nghĩa cấu trúc dữ liệu cho Database (PostgreSQL + pgvector).
*   **User**: Người dùng trong hệ thống (vai trò: `ADMIN`, `TEACHER`, `USER`).
*   **Directory**: Cây thư mục lưu trữ giáo án. Có liên kết đệ quy `parent` (cha-con) để tạo cấu trúc cây.
*   **DirectoryPermission**: Cấu hình chi tiết quyền truy cập trên thư mục (Viewer, Editor).
*   **LessonPlan**: Thông tin bài giảng/giáo án, đường dẫn tệp đính kèm, thuộc tính bổ sung (`attributes` dưới dạng JSON).
*   **LessonPlanRating**: Lưu trữ điểm đánh giá (1–5 sao) và nhận xét (bình luận) từ người dùng cho từng giáo án. Ràng buộc **1 user 1 rating** trên mỗi bài giảng (có thể cập nhật). `average_rating` và `total_ratings` trên `LessonPlan` được tính lại tự động sau mỗi thao tác POST.
*   **ApprovalRequest**: Yêu cầu phê duyệt giáo án do `USER` thường gửi lên trước khi xuất bản công khai.
*   **DocumentChunk**: Các đoạn nội dung giáo án sau khi bóc tách văn bản, lưu kèm vector embedding (`1536` chiều) để tìm kiếm ngữ nghĩa (RAG).
*   **AIChatSession / AIChatMessage**: Quản lý lịch sử các phiên trò chuyện giữa người dùng và AI xoay quanh một giáo án cụ thể.

#### B. File `backend/app/views.py` (API Views xử lý Logic)

*   **`get_user_managed_directories`**
    *   **Nhiệm vụ chính**: Lấy toàn bộ danh sách ID của các thư mục mà một người dùng cụ thể có quyền quản trị trực tiếp hoặc kế thừa đệ quy từ thư mục cha.
    *   **Input**: `user` (Đối tượng User)
    *   **Output**: `list[int]` (Danh sách ID các thư mục được quyền quản lý)

*   **`LessonPlanListAPIView.get_queryset`**
    *   **Nhiệm vụ chính**: Lọc danh sách giáo án theo từ khóa tìm kiếm (`q`), thư mục (`directory_id`), trạng thái và vai trò của `user_id` thực hiện yêu cầu.
    *   **Input**: `self.request.query_params` (Chứa `q`, `user_id`, `directory_id`)
    *   **Output**: `QuerySet[LessonPlan]`

*   **`LessonPlanDetailAPIView.perform_update`**
    *   **Nhiệm vụ chính**: Cập nhật thông tin/tệp tin giáo án; tự động chuyển trạng thái về `PENDING` và tạo yêu cầu phê duyệt nếu người chỉnh sửa là `USER` thường.
    *   **Input**: `serializer` (Dữ liệu cập nhật), `self.request.data` (Chứa `user_id`, `file_base64`, `attributes`)
    *   **Output**: `None`

*   **`DirectoryListCreateAPIView.get_queryset`**
    *   **Nhiệm vụ chính**: Lấy danh sách thư mục công khai hoặc thư mục mà người dùng cụ thể có quyền quản trị.
    *   **Input**: `self.request.query_params` (Chứa `user_id`)
    *   **Output**: `QuerySet[Directory]`

*   **`DirectoryListCreateAPIView.perform_create`**
    *   **Nhiệm vụ chính**: Tạo mới một thư mục; kế thừa đè các thuộc tính (`attributes` JSON) từ thư mục cha nếu thư mục mới có chỉ định `parent`.
    *   **Input**: `serializer`, `self.request.data` (Chứa `user_id`, `parent`, `attributes`)
    *   **Output**: `None`

*   **`DirectoryDetailAPIView.partial_update`**
    *   **Nhiệm vụ chính**: Chỉnh sửa một phần thông tin của thư mục (tên, trạng thái công khai `is_public`, thuộc tính, hoặc đổi cha).
    *   **Input**: `request` (Chứa dữ liệu cập nhật đè)
    *   **Output**: `Response` (Dữ liệu thư mục sau khi cập nhật)

*   **`LessonPlanUploadAPIView.post`**
    *   **Nhiệm vụ chính**: Tải lên giáo án mới dưới dạng tệp hoặc mã hóa Base64; tự động kế thừa thuộc tính thư mục cha và tạo yêu cầu duyệt nếu trạng thái là `PENDING`.
    *   **Input**: `request` (Chứa `user_id`, `title`, `file_base64`/`file`, `directory_id`, `status`)
    *   **Output**: `Response` (Dữ liệu giáo án vừa tạo)

*   **`ApprovalRequestListCreateAPIView.get_queryset`**
    *   **Nhiệm vụ chính**: Trả về các yêu cầu phê duyệt đang chờ duyệt mà người dùng hiện tại có quyền xử lý (Admin thấy tất cả; Giáo viên thấy các yêu cầu thuộc thư mục họ quản lý đệ quy).
    *   **Input**: `self.request.query_params` (Chứa `user_id`)
    *   **Output**: `QuerySet[ApprovalRequest]`

*   **`ApprovalRequestDetailAPIView.patch`**
    *   **Nhiệm vụ chính**: Xử lý phê duyệt (`APPROVE` -> Đổi trạng thái giáo án thành `PUBLISHED`) hoặc từ chối (`REJECT` -> Ghi nhận feedback và đổi trạng thái giáo án thành `REJECTED`).
    *   **Input**: `request` (Chứa `user_id`, `action`, `feedback`), `pk` (ID yêu cầu)
    *   **Output**: `Response` (Thông báo kết quả)

*   **`RegisterAPIView.post`**
    *   **Nhiệm vụ chính**: Tạo mới tài khoản người dùng với vai trò mặc định là `USER`.
    *   **Input**: `request` (Chứa `username`, `password`, `full_name`)
    *   **Output**: `Response` (Thông báo đăng ký thành công + thông tin user)

*   **`LoginAPIView.post`**
    *   **Nhiệm vụ chính**: Xác thực tên tài khoản và mật khẩu, trả về thông tin người dùng và vai trò (`role`) tương ứng.
    *   **Input**: `request` (Chứa `username`, `password`)
    *   **Output**: `Response` (Thông tin người dùng đăng nhập thành công)

*   **`AdminUserListAPIView.get`**
    *   **Nhiệm vụ chính**: Lấy danh sách toàn bộ người dùng trong hệ thống kèm danh sách ID thư mục mà họ đang quản trị trực tiếp (chỉ cho phép Admin gọi).
    *   **Input**: `request` (Chứa `admin_id` trong query_params)
    *   **Output**: `Response` (Danh sách thông tin người dùng)

*   **`UserSelfPermissionsAPIView.get`**
    *   **Nhiệm vụ chính**: Lấy danh sách tất cả ID thư mục mà người dùng hiện tại có quyền quản lý (trực tiếp + đệ quy).
    *   **Input**: `request` (Chứa `user_id` trong query_params)
    *   **Output**: `Response` (Danh sách ID thư mục)

*   **`AdminAssignPermissionAPIView.post`**
    *   **Nhiệm vụ chính**: Phân chia lại quyền sở hữu thư mục cho giáo viên; tự động chuyển đổi vai trò (`TEACHER` <-> `USER`) dựa trên việc họ có quản lý thư mục nào hay không; trả các thư mục không được phân về cho Admin.
    *   **Input**: `request` (Chứa `admin_id`, `directory_ids`), `pk` (ID người dùng đích)
    *   **Output**: `Response` (Thông báo phân quyền thành công)

*   **`LessonPlanProposeAPIView.post`**
    *   **Nhiệm vụ chính**: Đề xuất công khai một bài giảng cá nhân (`LOCAL` / `REJECTED`) lên thư mục công khai được chỉ định; đổi trạng thái thành `PENDING` và tạo/cập nhật yêu cầu xét duyệt `ApprovalRequest`.
    *   **Input**: `request` (Chứa `user_id`, `directory_id`), `pk` (ID bài giảng)
    *   **Output**: `Response` (Thông điệp đề xuất thành công)

*   **`LessonPlanRatingAPIView`** *(mới - 2026-05-20)*
    *   **Nhiệm vụ chính**: 
        *   `GET`: Trả về danh sách đánh giá, `average_rating`, `total_ratings` của bài giảng.
        *   `POST`: Tạo mới hoặc cập nhật đánh giá (1 user 1 lần); tự tính lại `average_rating` bằng `Avg` query Django ORM.
    *   **Input**: `pk` (ID bài giảng). POST body: `user_id`, `rating` (1–5), `comment` (tùy chọn).
    *   **Output**: `Response` (danh sách đánh giá hoặc đánh giá vừa tạo + thống kê mới nhất)
    *   **URL**: `GET/POST /api/lesson-plans/<pk>/ratings/`

*   **`LessonPlanParseDocxAPIView`** *(mới - 2026-05-25)*
    *   **Nhiệm vụ chính**: Phân tích tệp giáo án `.docx` được tải lên, bóc tách cấu trúc để trích xuất metadata và tự động điền form.
    *   **Input**: POST body: `file` hoặc `file_base64`
    *   **Output**: `Response` chứa JSON các trường trích xuất (title, description, grade, subject, duration, target_students, lesson_type, knowledge_tags, activities)
    *   **URL**: `POST /api/lesson-plans/parse-docx/`

---

### 3.2. Phía Frontend (`protoc/src/`)

#### A. File `protoc/src/app/App.tsx` (Component cốt lõi của Frontend)

*   **`countLessonsInDir`**
    *   **Nhiệm vụ chính**: Đếm đệ quy tổng số giáo án nằm trong một thư mục và tất cả các thư mục con của nó.
    *   **Input**: `dirId` (ID thư mục), `directories` (Mảng thư mục), `allLessons` (Mảng giáo án)
    *   **Output**: `number` (Tổng số lượng giáo án đệ quy)

*   **`getLessonsInDir`**
    *   **Nhiệm vụ chính**: Thu thập danh sách đệ quy và loại bỏ trùng lặp tất cả các giáo án thuộc về thư mục chỉ định và các thư mục con của nó.
    *   **Input**: `dirId` (ID thư mục), `directories` (Mảng thư mục), `allLessons` (Mảng giáo án)
    *   **Output**: `LessonPlan[]` (Mảng đối tượng giáo án)

*   **`getDirectoryFullPath`**
    *   **Nhiệm vụ chính**: Truy vết ngược dòng cây thư mục cha để tạo chuỗi đường dẫn đệ quy đầy đủ (e.g., "Sinh học / Vi sinh vật").
    *   **Input**: `dirId` (ID thư mục đích), `dirs` (Mảng tất cả thư mục hệ thống)
    *   **Output**: `string` (Chuỗi đường dẫn breadcrumb phân tách bởi dấu " / ")

*   **`getDirectoriesAsTreeOptions`**
    *   **Nhiệm vụ chính**: Đệ quy duyệt cây thư mục theo thứ tự tiền tố (DFS Pre-order) để xuất ra danh sách phẳng có căn lề thụt đầu dòng dạng cây trực quan (ví dụ: `├─`, `└─`, `📂`) dùng trong các select box.
    *   **Input**: `dirs` (Mảng thư mục hệ thống), `filterFn` (Hàm lọc điều kiện tùy chọn)
    *   **Output**: `DirectoryOption[]` (Mảng chứa id, name và visualPrefix thụt dòng dạng cây)

*   **`DirectoryNode`**
    *   **Nhiệm vụ chính**: Component hiển thị một thư mục trên thanh bên cây thư mục, xử lý việc đóng/mở, đổi tên, xóa, gán công khai/riêng tư, và hiển thị trạng thái khóa.
    *   **Input**: Props (`dir`, `directories`, `selectedDirs`, `onToggleDir`, `allLessons`, `currentUser`, `onAddChild`, `onDelete`, `onRename`, `onTogglePublic`)
    *   **Output**: `JSX.Element` (Nút cây thư mục)

*   **`DocxPreview`**
    *   **Nhiệm vụ chính**: Tải tệp tài liệu Word (`.docx`) và kết xuất hiển thị giao diện trực tiếp ngoại tuyến (offline) bằng thư viện `docx-preview`.
    *   **Input**: `fileUrl` (Đường dẫn tệp tài liệu)
    *   **Output**: `JSX.Element` (Khu vực xem trước tệp)

*   **`PermissionDirTreeNode`**
    *   **Nhiệm vụ chính**: Hiển thị nút cây thư mục phân quyền trong Modal quản trị phân quyền của Admin (hỗ trợ chọn hộp kiểm xếp chồng).
    *   **Input**: Props (`dir`, `directories`, `selectedIds`, `onToggle`, `depth`)
    *   **Output**: `JSX.Element` (Thành phần gán quyền thư mục)

*   **`openProposeModal`**
    *   **Nhiệm vụ chính**: Thiết lập trạng thái và mở Modal chọn thư mục dùng chung để gửi yêu cầu phê duyệt xuất bản giáo án cá nhân.
    *   **Input**: `lesson` (Mục giáo án cá nhân)
    *   **Output**: `None`

*   **`handleProposePublic`**
    *   **Nhiệm vụ chính**: Gửi yêu cầu API đề xuất công khai giáo án đến Backend, làm mới danh sách giáo án và đóng Modal.
    *   **Input**: `e` (React Form Event)
    *   **Output**: `None`

*   **`App`**
    *   **Nhiệm vụ chính**: Thành phần khởi chạy và quản lý chính: nắm giữ toàn bộ state quan trọng, thực hiện gọi API tương tác với Backend, và kết xuất toàn bộ bố cục trang Web QLTT.
    *   **Giao diện Chi tiết Bài giảng (Lesson Detail Modal - Refactored):** Được nâng cấp thành giao diện toàn màn hình dạng chia đôi (`split-pane` 60% trái / 40% phải). 
        *   Cột Trái (60%): Chứa thông tin tổng quan, thông tin người đăng, tóm tắt bài học, thuộc tính bổ sung (`attributes`), và trình đọc tài liệu (PDF inline hoặc Word preview).
        *   Cột Phải (40%): Tích hợp trực tiếp hệ thống phản hồi, đánh giá chất lượng (form đánh giá sao và nhập bình luận chi tiết), cùng danh sách các đánh giá thời gian thực từ đồng nghiệp.
        *   **Tích hợp State & Logic Tự động:** Tự động kích hoạt hiệu ứng tải dữ liệu bình luận (`useEffect` kích hoạt khi `selectedLessonForDetail` thay đổi) để hiển thị ngay lập tức danh sách nhận xét mà không yêu cầu người dùng nhấn nút thủ công.
    *   **Tính năng bổ sung khác:** 
        *   **Cơ chế Phân trang & Sắp xếp tài liệu:** Sử dụng các State `sortBy` (định nghĩa tiêu chí sắp xếp), `currentPage` (trang hiện tại) và `pageSize` (kích thước trang từ 10 đến 20). Bộ đôi `useMemo` (`sortedLessonPlans`, `paginatedLessonPlans`) giúp thực hiện sắp xếp nhanh theo 6 tiêu chí (Mới nhất, Cũ nhất, Điểm sao cao/thấp, Lượt đánh giá nhiều/ít) và chia nhỏ danh sách hiển thị mượt mà. Trang tự động reset về trang 1 khi thay đổi bộ lọc hoặc kích thước trang.
        *   **Hộp thoại chỉnh sửa thông tin cá nhân (UserProfile Modal):** Sử dụng các state kiểm soát hiển thị `showProfileModal` và các trường dữ liệu `profileFullName`, `profileCurrentPassword`, `profileNewPassword`, `profileConfirmNewPassword` kết hợp hàm `handleSaveProfile` gọi tới API `/api/users/me/profile/` để cập nhật đồng thời state `currentUser` và `sessionStorage` đồng bộ.
        *   Tự động ẩn sidebar bộ lọc/thư mục công khai khi không ở tab thư viện chung, sử dụng giao diện chọn tab dạng thanh trượt/pill (Segmented Pill Container) cực kỳ hiện đại. Quản lý lưu trữ trạng thái đăng nhập `currentUser` qua `sessionStorage` để không bị mất đăng nhập khi reload trang, đồng thời tự động đăng xuất khi tắt trình duyệt/tab. Tích hợp tính năng hiển thị Hộp thoại hồ sơ chi tiết người đăng (`selectedCreatorForProfile`) khi bấm vào tên của họ ở card bài giảng hoặc tiêu đề xem chi tiết. **Click biểu tượng logo 📚** trên nav bar sẽ đồng thời reset về `currentView='home'`, xóa bộ lọc `selectedDirs=[]` và chuyển `homeTab='library'`. **Card thư viện cá nhân** đã được đồng bộ layout (header/badges/description/footer) đồng nhất với card thư viện chung.
    *   **Input**: Không có
    *   **Output**: `JSX.Element` (Giao diện chính hệ thống)

---

### 3.3. File `protoc/src/app/UploadPage.tsx` (Trang Đăng Bài Giảng)

*   **`TreeNode`** *(mới - refactored 2026-05-20)*
    *   **Nhiệm vụ chính**: Component đệ quy hiển thị một nút trong cây thư mục trên trang đăng bài giảng; hỗ trợ mở/đóng nánh (expand/collapse), highlight thư mục được chọn, hiển thị badge "Quản lý" / "Công khai" inline, thụt lề theo chiều sâu.
    *   **Input**: `dir` (Đối tượng Directory), `depth` (Chiều sâu trong cây, dùng để thụt lề)
    *   **Output**: `JSX.Element` (Nút cây thư mục kèm các cây con nếu đối tượng được mở rộng)

*   **`toggleExpand`**
    *   **Nhiệm vụ chính**: Đảo trạng thái mở/đóng nánh cây của một thư mục trong `expandedIds` (Set các ID đang mở).
    *   **Input**: `id` (ID thư mục), `e` (MouseEvent, dừng bubble)
    *   **Output**: `void`

*   **`selectDir`**
    *   **Nhiệm vụ chính**: Chọn hoặc bỏ chọn thư mục làm đích tải lên; kiểm tra quyền cho Giáo viên trước khi cho phép chọn.
    *   **Input**: `dir` (Đối tượng Directory)
    *   **Output**: `void`
