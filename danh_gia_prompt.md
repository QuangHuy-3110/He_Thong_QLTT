# Báo cáo Đánh giá Prompt Hệ thống KMS & Kế hoạch Cải tiến

Báo cáo này liệt kê chi tiết các file chứa prompt, phân tích cấu trúc, đánh giá chất lượng hiện tại và đề xuất kế hoạch nâng cấp tối ưu hóa cho AI RAG và bóc tách dữ liệu.

---

## 1. Danh sách các File chứa Prompt & Chi tiết Mã nguồn

### 1.1. Các Prompt Trích xuất Thông tin & Khái niệm
Nằm tại tệp [bg_processor.py](file:///d:/He_Thong_QLTT/backend/app/bg_processor.py).

#### A. Prompt Bóc tách Thực thể/Khái niệm (Concept Extraction - Phase 4)
* **Vị trí:** [bg_processor.py L510-519](file:///d:/He_Thong_QLTT/backend/app/bg_processor.py#L510-L519)
* **Mã nguồn:**
```python
prompt_extract = (
    f"Dưới đây là nội dung văn bản của tài liệu \"{lp.title}\":\n"
    f"Mô tả: {lp.description or 'Không có mô tả'}\n"
    f"Nội dung văn bản:\n{markdown_content[:3500]}\n\n"
    f"Nhiệm vụ: Hãy phân tích sâu sắc văn bản trên và trích xuất đúng từ 8 đến 12 khái niệm/thuật ngữ/thực thể cốt lõi và đặc trưng nhất của bài học này.\n"
    f"YÊU CẦU NGHIÊM NGẶT:\n"
    f"1. Hãy trích xuất đa dạng cả khái niệm chuyên môn nội dung của bài học (ví dụ: các chủ đề khoa học, xã hội, hướng nghiệp, đời sống như 'Dinh dưỡng học đường', 'Khẩu phần ăn', 'Bảo vệ môi trường', 'Hướng nghiệp', 'Kế hoạch học tập', 'Kỹ năng sinh tồn', 'Nhịp sinh học', 'Giao tiếp xã hội'...) lẫn các mục tiêu năng lực/phẩm chất đặc thù cốt lõi đi kèm (ví dụ: 'Năng lực tự học', 'Năng lực hợp tác', 'Giải quyết vấn đề', 'Trung thực', 'Trách nhiệm', 'Chăm chỉ').\n"
    f"2. Tuyệt đối TRÁNH các từ chung chung hoặc các hoạt động/phương pháp chung như: 'Thảo luận', 'Trò chơi', 'Hình ảnh', 'Hoạt động', 'Thực hành', 'Giáo án', 'Học sinh', 'Giáo viên', 'Đại diện', 'Báo cáo', 'Poster'.\n"
    f"3. Trả về kết quả dưới dạng MỘT danh sách JSON duy nhất chứa các chuỗi (ví dụ: [\"Khái niệm 1\", \"Khái niệm 2\", ...]). Không viết thêm bất kỳ văn bản giải thích nào khác."
)
```

#### B. Prompt Sinh định nghĩa Khái niệm học thuật (Concept Note Definition)
* **Vị trí:** [bg_processor.py L666-672](file:///d:/He_Thong_QLTT/backend/app/bg_processor.py#L666-L672)
* **Mã nguồn:**
```python
prompt_concept = (
    f"Viết 2-3 câu mô tả học thuật súc tích về khái niệm \"{tag}\" "
    f"trong bối cảnh môn học \"{subject}\" và bài học \"{lp.title}\". "
    f"Chỉ mô tả bản chất/định nghĩa của khái niệm, không giải thích bài giảng. "
    f"Bắt buộc viết 100% bằng tiếng Việt chuẩn, học thuật, ngắn gọn, không dùng gạch đầu dòng. "
    f"Tuyệt đối không sử dụng bất kỳ từ ngữ hay ký tự tiếng nước ngoài nào (đặc biệt là chữ Hán/tiếng Trung như 硅藻门, tiếng Anh...)."
)
```

---

### 1.2. Các Prompt xử lý Chatbot RAG (System Prompts)
Nằm tại tệp [views.py](file:///d:/He_Thong_QLTT/backend/app/views.py). Các prompt hệ thống được quyết định động thông qua bộ phân loại ý định ở [views.py L2462-2520](file:///d:/He_Thong_QLTT/backend/app/views.py#L2462-L2520).

#### A. Trò chuyện Trọng tâm (FOCUS_QA)
* **Vị trí:** [views.py L2484-2491](file:///d:/He_Thong_QLTT/backend/app/views.py#L2484-L2491)
* **Mã nguồn:**
```python
system_prompt = (
    f"Bạn là Trợ lý AI chuyên gia phân tích sư phạm trong Hệ thống Quản lý Tri thức Học tập (KMS).\n"
    f"Hiện tại người dùng đang xem tài liệu cụ thể: \"{lesson_obj.title}\" (ID bài giảng: {lesson_obj.id}) và bật khung chat hỗ trợ.\n"
    f"ĐỒ THỊ SƠ ĐỒ TƯ DUY (MINDMAP) CỦA RIÊNG TÀI LIỆU NÀY GỒM CÁC PHÂN NHÁNH TRỌNG TÂM: [[{lesson_obj.title}]] -> {mindmap_str}.\n\n"
    f"Nhiệm vụ của bạn là tập trung THIÊN VỀ tài liệu \"{lesson_obj.title}\" này để giải đáp thắc mắc, tóm tắt hoạt động, phân tích phương pháp sư phạm, hoặc điều chỉnh giáo án theo yêu cầu.\n"
    f"Hãy trả lời bằng Tiếng Việt lịch sự, cấu trúc Markdown rõ ràng (sử dụng tiêu đề, bảng biểu, danh sách để cực kỳ trực quan).\n"
    f"Bắt buộc phải đính kèm liên kết nhảy nhanh theo cú pháp markdown đặc biệt: `[Tên hiển thị liên kết](lesson://<lesson_id>?text=<từ_khóa_ngắn_tìm_kiếm>)` (hoặc `[Tên hiển thị](lesson://<lesson_id>)` nếu không có từ khóa cụ thể)."
)
```

#### B. Thống kê & Liệt kê dữ liệu (STATISTICAL)
* **Vị trí:** [views.py L2496-2502](file:///d:/He_Thong_QLTT/backend/app/views.py#L2496-L2502)
* **Mã nguồn:**
```python
system_prompt = (
    "Bạn là Trợ lý AI chuyên gia thống kê tri thức hệ thống KMS.\n"
    "Người dùng đang yêu cầu THỐNG KÊ, LIỆT KÊ hoặc ĐO LƯỜNG toàn bộ tài liệu trong hệ thống.\n"
    "Nhiệm vụ của bạn là dựa vào Ngữ cảnh RAG (đặc biệt là danh mục và thuộc tính của tất cả các bài giảng công khai) để tổng hợp ra các bảng biểu trực quan, phân tích tỉ lệ môn học, phân loại theo lớp, loại hình, địa điểm, từ khóa một cách khoa học.\n"
    "Hãy trả lời bằng Tiếng Việt, trình bày dạng BẢNG BIỂU (Table) Markdown để so sánh định lượng trực quan, rõ ràng.\n"
    "Bắt buộc phải đính kèm liên kết nhảy nhanh cho mỗi tài liệu được liệt kê: `[Tên bài học](lesson://<lesson_id>)`."
)
```

#### C. So sánh đối chiếu bài giảng (COMPARATIVE)
* **Vị trí:** [views.py L2505-2511](file:///d:/He_Thong_QLTT/backend/app/views.py#L2505-L2511)
* **Mã nguồn:**
```python
system_prompt = (
    "Bạn là Trợ lý AI chuyên gia phân tích so sánh và liên kết tri thức hệ thống KMS.\n"
    "Người dùng đang yêu cầu SO SÁNH, ĐỐI CHIẾU hoặc TÌM KIẾM LIÊN QUAN giữa các tài liệu khác nhau.\n"
    "Nhiệm vụ của bạn là phân tích sâu các điểm tương đồng, khác biệt về mặt cấu trúc hoạt động dạy học, phương pháp sư phạm, đối tượng học sinh, từ khóa kiến thức của các tài liệu tìm thấy trong Ngữ cảnh Graph RAG.\n"
    "Hãy trình bày câu trả lời rõ ràng dưới dạng So sánh đa chiều (sử dụng bảng biểu đối chiếu và bullet points rõ ràng).\n"
    "Bắt buộc phải đính kèm liên kết nhảy nhanh khi so sánh: `[Tên bài học](lesson://<lesson_id>)`."
)
```

#### D. Trợ lý Chung (GENERAL_KMS)
* **Vị trí:** [views.py L2514-2520](file:///d:/He_Thong_QLTT/backend/app/views.py#L2514-L2520)
* **Mã nguồn:**
```python
system_prompt = (
    "Bạn là Trợ lý AI hữu ích, chuyên gia phân tích sư phạm trong Hệ thống Quản lý Tri thức Học tập (KMS).\n"
    "Nhiệm vụ của bạn là hỗ trợ người dùng tìm kiếm tài liệu giáo án, tóm tắt hoạt động giảng dạy, đề xuất cải tiến và giải đáp kiến thức sư phạm chung.\n"
    "Hãy trả lời một cách lịch sự, cấu trúc Markdown rõ ràng (sử dụng tiêu đề, bảng biểu, danh sách thụt lề để cực kỳ trực quan).\n"
    "Hãy dựa vào Ngữ cảnh Graph RAG được cung cấp bên dưới để trả lời trung thực, chính xác. Nếu ngữ cảnh không có thông tin, hãy trả lời linh hoạt dựa trên kiến thức của bạn nhưng nêu rõ là không tìm thấy trong tài liệu cụ thể của hệ thống.\n"
    "Để hỗ trợ điều hướng thông minh, khi bạn trích dẫn hoặc nhắc tới bất kỳ tài liệu/bài giảng nào từ Ngữ cảnh RAG, bạn BẮT BUỘC phải đính kèm liên kết nhảy nhanh theo cú pháp markdown đặc biệt: `[Tên hiển thị liên kết](lesson://<lesson_id>?text=<từ_khóa_ngắn_tìm_kiếm>)` (hoặc `[Tên hiển thị](lesson://<lesson_id>)` nếu không có từ khóa cụ thể)."
)
```

---

## 2. Đánh giá & Kết luận về Hệ thống Prompt Hiện tại

### 2.1. Điểm mạnh (Ưu điểm)
1. **Thiết kế định hướng cụ thể (Intent-driven):** Việc phân tách prompt hệ thống chatbot thành 4 lớp ý định (`FOCUS_QA`, `STATISTICAL`, `COMPARATIVE`, `GENERAL_KMS`) giúp câu trả lời của mô hình tối ưu theo đúng mong đợi của người dùng (ví dụ: yêu cầu thống kê sẽ tự động ép cấu trúc markdown bảng biểu).
2. **Quy tắc đầu ra chặt chẽ:** Tất cả các chatbot system prompt đều nhấn mạnh quy định định dạng liên kết thông minh `[Tên hiển thị](lesson://<id>)`. Điều này giúp Frontend bắt được chuỗi và chuyển đổi thành tương tác click cực kỳ mượt mà.
3. **Các bộ lọc tiêu cực tốt (Negative Constraints):** Prompt trích xuất khái niệm có chặn cứng các từ ngữ chung chung như "hoạt động", "giáo án", "trò chơi", tránh việc làm rác Đồ thị Tri thức.
4. **Xử lý các lỗi mô hình cục bộ tốt:** Prompt sinh định nghĩa khái niệm chặn chặt chẽ việc chèn chữ Hán/tiếng Trung (lỗi rất phổ biến của các dòng Qwen 3B/7B GGUF khi xử lý tiếng Việt y khoa/sinh học).

### 2.2. Điểm yếu & Giới hạn cần cải thiện
1. **Trích xuất JSON dễ bị lỗi cú pháp:** Prompt trích xuất khái niệm yêu cầu trả về định dạng mảng JSON `["A", "B", ...]` nhưng đôi khi các LLM cỡ nhỏ (như Qwen-3B-Chat) vẫn thêm phần rườm rà như: *"Dưới đây là danh sách: ..."* hoặc trả về JSON lỗi, khiến đoạn mã `json.loads` bị crash và phải chạy fallback chéo sang Keyword search.
2. **Thiếu Few-shot Examples (Học qua ví dụ):** Các prompt bóc tách khái niệm và sinh định nghĩa hiện tại hoàn toàn là zero-shot (không có ví dụ mẫu). Việc này làm giảm độ chính xác của LLM, đặc biệt là khi hoạt động cục bộ (Offline local GGUF).
3. **Cấu trúc RAG Context hơi thô sơ:** Chuỗi `context_str` chỉ ghép thô các đoạn văn bản mà không tối ưu cấu trúc phân cấp xml (ví dụ: sử dụng `<document id="...">...</document>`). Điều này khiến LLM khó nhận diện ranh giới giữa các bài giảng khác nhau khi thực hiện so sánh chéo.

---

## 3. Kế hoạch Cải thiện & Nâng cấp Prompt

Nhằm tối ưu hóa hiệu quả hoạt động, nâng cao độ chính xác của Graph RAG và quá trình đồng bộ Obsidian Note, kế hoạch cải tiến bao gồm 3 bước cụ thể sau:

* **Bước 1: Nâng cấp Prompt Trích xuất Khái niệm (Few-Shot & JSON Enforcement)** để đảm bảo tính chuẩn xác JSON và định nghĩa học thuật cao hơn khi dùng mô hình local.
* **Bước 2: Tái cấu trúc RAG Context dạng Phân cấp (XML-Tagged Context)** giúp phân định rõ ranh giới các tài liệu trong context RAG.
* **Bước 3: Chuẩn hóa Định dạng Trích dẫn trong Chatbot** với ví dụ cú pháp liên kết chéo chi tiết.
