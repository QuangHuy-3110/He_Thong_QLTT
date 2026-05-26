import os
import django
import docx

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kms_core.settings')
django.setup()

from app.models import LessonPlan, Directory, User, LessonPlanDirectory

# 1. Clean up
print("Deleting old data...")
LessonPlan.objects.all().delete()
Directory.objects.all().delete()

# 2. Get/create admin
print("Creating admin...")
admin, created = User.objects.get_or_create(
    username='admin',
    defaults={'role': 'ADMIN', 'full_name': 'Admin'}
)
if created:
    admin.set_password('admin')
    admin.save()

# Ensure media directory exists
media_dir = os.path.join('media', 'lesson_plans')
os.makedirs(media_dir, exist_ok=True)

# 3. Create directories
print("Creating directories...")
sinh_hoc = Directory.objects.create(name='Sinh học', is_public=True, user=admin)
thuc_vat = Directory.objects.create(name='Thực vật', parent=sinh_hoc, is_public=True, user=admin)
vi_sinh = Directory.objects.create(name='Vi sinh vật', parent=sinh_hoc, is_public=True, user=admin)
sinh_thai = Directory.objects.create(name='Sinh thái', parent=sinh_hoc, is_public=True, user=admin)
con_nguoi = Directory.objects.create(name='Con người', parent=sinh_hoc, is_public=True, user=admin)
cong_nghe = Directory.objects.create(name='Công nghệ sinh học', parent=sinh_hoc, is_public=True, user=admin)

toan_hoc = Directory.objects.create(name='Toán học', is_public=True, user=admin)
luong_giac = Directory.objects.create(name='Lượng giác', parent=toan_hoc, is_public=True, user=admin)

vat_ly = Directory.objects.create(name='Vật lý', is_public=True, user=admin)
song_dung = Directory.objects.create(name='Sóng dừng', parent=vat_ly, is_public=True, user=admin)
chuyen_dong = Directory.objects.create(name='Chuyển động đều', parent=vat_ly, is_public=True, user=admin)

# Helper function to generate dummy DOCX
def generate_docx_file(filename, title, content):
    filepath = os.path.join(media_dir, filename)
    doc = docx.Document()
    doc.add_heading(title, 0)
    for p in content.split('\n'):
        if p.strip():
            doc.add_paragraph(p.strip())
    doc.save(filepath)
    # Return path relative to MEDIA_ROOT
    return os.path.join('lesson_plans', filename)

# 4. Create sample lessons with actual physical files and rich Markdown previews
print("Creating seed lessons...")

# Lesson 1: Nutrition (Sinh học -> Con người)
desc1 = "Bài giảng cung cấp kiến thức toàn diện về dinh dưỡng học đường, vitamin, protein và cách xây dựng thực đơn cân bằng calo cho học sinh THPT tránh béo phì."
content1 = """
KẾ HOẠCH BÀI DẠY: DINH DƯỠNG HỌC ĐƯỜNG VÀ SỨC KHỎE
Môn học: Sinh học - Lớp 10
Thời lượng: 2 tiết (90 phút)

I. MỤC TIÊU BÀI HỌC:
- Trình bày được tầm quan trọng của dinh dưỡng đối với cơ thể lứa tuổi học sinh THPT.
- Kể tên các nhóm chất dinh dưỡng chính: carbohydrate, protein, lipid, vitamin, chất xơ và khoáng chất.
- Biết cách tính toán lượng calo cần thiết hàng ngày để tránh nguy cơ béo phì.
- Tự thiết kế một thực đơn ăn uống khoa học, lành mạnh phục vụ phát triển thể chất.

II. HOẠT ĐỘNG DẠY HỌC:
1. Hoạt động 1: Khởi động (10 phút)
- Giáo viên cho học sinh xem clip ngắn về thực trạng béo phì học đường và thói quen ăn đồ ăn nhanh của giới trẻ.
- Học sinh thảo luận nhóm về các nguồn thực phẩm ăn uống hàng ngày.
2. Hoạt động 2: Hình thành kiến thức về chất dinh dưỡng (30 phút)
- Giáo viên thuyết giảng về vitamin A, B, C, D và vai trò của chất xơ, protein, nước.
- Hướng dẫn học sinh phân tích hàm lượng dinh dưỡng trên bao bì sản phẩm.
3. Hoạt động 3: Thực hành xây dựng thực đơn (40 phút)
- Nhóm học sinh tự lập bảng tính calo và thảo luận đề xuất một thực đơn hoàn hảo cho cả tuần.
"""
file_rel_1 = generate_docx_file('dinh_duong_hoc_duong.docx', 'Dinh dưỡng học đường', content1)
lp1 = LessonPlan.objects.create(
    title='Chủ đề 1: Dinh dưỡng học đường - Xây dựng thực đơn khỏe mạnh',
    description=desc1,
    target_student='Học sinh thành thị',
    status='PUBLISHED',
    creator=admin,
    file_path=file_rel_1,
    content_preview=content1,
    attributes={
        'Môn học': 'Sinh học',
        'Loại hình': 'Lý thuyết',
        'Tiết dạy': '2 tiết',
        'lop': ['Lớp 10', 'Lớp 11'],
        'Cấp học': 'THPT'
    }
)
LessonPlanDirectory.objects.create(lesson_plan=lp1, directory=sinh_hoc)
LessonPlanDirectory.objects.create(lesson_plan=lp1, directory=con_nguoi)


# Lesson 2: Photosynthesis (Sinh học -> Thực vật)
desc2 = "Khám phá quá trình quang hợp ở thực vật, tìm hiểu vai trò của ánh sáng, diệp lục và sự chuyển hóa khí cacbonic thành oxy giải phóng ra ngoài tự nhiên."
content2 = """
KẾ HOẠCH DẠY HỌC: QUANG HỢP Ở THỰC VẬT
Môn học: Sinh học - Lớp 11
Thời lượng: 3 tiết (135 phút)

I. MỤC TIÊU BÀI DẠY:
- Nắm vững phương trình tổng quát của quá trình quang hợp ở lá cây.
- Giải thích vai trò của hệ sắc tố diệp lục, lạp thể lục lạp hấp thụ ánh sáng.
- Phân tích mối liên hệ mật thiết giữa cường độ quang hợp và nồng độ khí cacbonic (CO2).

II. TIẾN TRÌNH HOẠT ĐỘNG:
1. Hoạt động 01: Nhận diện bào quan lục lạp dưới kính hiển vi quang học.
2. Hoạt động 02: Thực hành chiết rút diệp lục tố từ lá cây tươi bằng cồn 90 độ.
3. Hoạt động 03: Thí nghiệm chứng minh sự giải phóng khí oxy khi có ánh sáng chiếu vào.
"""
file_rel_2 = generate_docx_file('quang_hop_thuc_vat.docx', 'Quang hợp ở thực vật', content2)
lp2 = LessonPlan.objects.create(
    title='Chủ đề 2: Quang hợp và hô hấp ở thực vật',
    description=desc2,
    target_student='Học sinh nông thôn',
    status='PUBLISHED',
    creator=admin,
    file_path=file_rel_2,
    content_preview=content2,
    attributes={
        'Môn học': 'Sinh học',
        'Loại hình': 'Thực hành',
        'Tiết dạy': '3 tiết',
        'lop': ['Lớp 11'],
        'Cấp học': 'THPT'
    }
)
LessonPlanDirectory.objects.create(lesson_plan=lp2, directory=sinh_hoc)
LessonPlanDirectory.objects.create(lesson_plan=lp2, directory=thuc_vat)


# Lesson 3: Trigonometry (Toán học -> Lượng giác)
desc3 = "Hướng dẫn giải các phương trình lượng giác cơ bản dạng sin x = a, cos x = a và ứng dụng của đồ thị lượng giác trong bài toán dao động điều hòa."
content3 = """
GIÁO ÁN PHƯƠNG TRÌNH LƯỢNG GIÁC CƠ BẢN
Môn học: Toán học - Lớp 11
Thời lượng: 1 tiết (45 phút)

I. YÊU CẦU CẦN ĐẠT:
- Học sinh giải thành thạo phương trình lượng giác cơ bản chứa hàm sin, cos, tan và cotan.
- Vẽ đồ thị hàm số và xác định chu kỳ biến thiên tuần hoàn.
- Áp dụng các góc lượng giác đặc biệt trong vòng tròn lượng giác toán học.

II. HOẠT ĐỘNG LÊN LỚP:
- Hoạt động 1: Ôn tập vòng tròn lượng giác và định nghĩa các giá trị lượng giác.
- Hoạt động 2: Xây dựng công thức nghiệm tổng quát cho phương trình lượng giác.
- Hoạt động 3: Luyện tập giải đề thi trắc nghiệm phương trình bậc hai đối với một hàm số lượng giác.
"""
file_rel_3 = generate_docx_file('phuong_trinh_luong_giac.docx', 'Phương trình lượng giác', content3)
lp3 = LessonPlan.objects.create(
    title='Chủ đề 3: Phương trình lượng giác và ứng dụng thực tiễn',
    description=desc3,
    target_student='Học sinh thành thị',
    status='PUBLISHED',
    creator=admin,
    file_path=file_rel_3,
    content_preview=content3,
    attributes={
        'Môn học': 'Toán học',
        'Loại hình': 'Lý thuyết',
        'Tiết dạy': '1 tiết',
        'lop': ['Lớp 11', 'Lớp 12'],
        'Cấp học': 'THPT'
    }
)
LessonPlanDirectory.objects.create(lesson_plan=lp3, directory=toan_hoc)
LessonPlanDirectory.objects.create(lesson_plan=lp3, directory=luong_giac)


# Lesson 4: Gravitational Force (Vật lý -> Chuyển động đều)
desc4 = "Bài giảng giới thiệu về lực hấp dẫn giữa các thiên thể, phát biểu định luật vạn vật hấp dẫn của Isaac Newton và cách tính gia tốc trọng trường của Trái Đất."
content4 = """
KẾ HOẠCH BÀI DẠY: ĐỊNH LUẬT VẠN VẬT HẤP DẪN
Môn học: Vật lý - Lớp 10
Thời lượng: 2 tiết (90 phút)

I. MỤC TIÊU:
- Phát biểu và viết công thức tính lực hấp dẫn giữa hai chất điểm bất kỳ trong vũ trụ.
- Hiểu rõ hằng số hấp dẫn G được đo bằng thí nghiệm cân xoắn Cavendish.
- Giải thích chuyển động của Trái Đất quanh Mặt Trời và vệ tinh nhân tạo xung quanh hành tinh.

II. NỘI DUNG CHÍNH:
1. Định nghĩa trường hấp dẫn và trọng lực.
2. Công thức tính lực hấp dẫn tỉ lệ nghịch với bình phương khoảng cách.
3. Ví dụ minh họa tính toán lực hút giữa Trái Đất và Mặt Trăng.
"""
file_rel_4 = generate_docx_file('luc_hap_dan_newton.docx', 'Lực hấp dẫn Newton', content4)
lp4 = LessonPlan.objects.create(
    title='Chủ đề 4: Lực hấp dẫn và định luật vạn vật hấp dẫn Newton',
    description=desc4,
    target_student='Học sinh thành thị',
    status='PUBLISHED',
    creator=admin,
    file_path=file_rel_4,
    content_preview=content4,
    attributes={
        'Môn học': 'Vật lý',
        'Loại hình': 'Lý thuyết',
        'Tiết dạy': '2 tiết',
        'lop': ['Lớp 10'],
        'Cấp học': 'THPT'
    }
)
LessonPlanDirectory.objects.create(lesson_plan=lp4, directory=vat_ly)
LessonPlanDirectory.objects.create(lesson_plan=lp4, directory=chuyen_dong)


# Lesson 5: Free Fall Physics (Vật lý -> Chuyển động đều)
desc5 = "Thực hành đo đạc gia tốc rơi tự do của vật thể bằng thiết bị cổng quang điện và bộ đếm thời gian kỹ thuật số, xử lý số liệu tính toán sai số đo lường."
content5 = """
GIÁO ÁN THỰC HÀNH: ĐO GIA TỐC RƠI TỰ DO
Môn học: Vật lý - Lớp 10
Thời lượng: 2 tiết (90 phút)

I. YÊU CẦU CẦN ĐẠT:
- Học sinh lắp đặt đúng bộ thí nghiệm đo rơi tự do bằng máng đứng và máng chéo.
- Tiến hành ghi lại thời gian rơi giữa hai cổng quang điện tương ứng với độ cao h khác nhau.
- Tính toán chính xác gia tốc g trung bình và viết kết quả kèm sai số đo lường.

II. TIẾN TRÌNH THỰC HÀNH:
- Hoạt động 1: Kiểm tra lý thuyết về chuyển động rơi tự do không vận tốc đầu.
- Hoạt động 2: Nhóm học sinh thực hiện đo đạc và lập bảng số liệu.
- Hoạt động 3: Vẽ đồ thị s theo t bình phương và viết báo cáo thực hành hoàn chỉnh.
"""
file_rel_5 = generate_docx_file('do_gia_toc_roi_tu_do.docx', 'Đo gia tốc rơi tự do', content5)
lp5 = LessonPlan.objects.create(
    title='Chủ đề 5: Thí nghiệm thực hành đo gia tốc rơi tự do',
    description=desc5,
    target_student='Học sinh nông thôn',
    status='PUBLISHED',
    creator=admin,
    file_path=file_rel_5,
    content_preview=content5,
    attributes={
        'Môn học': 'Vật lý',
        'Loại hình': 'Thực hành',
        'Tiết dạy': '2 tiết',
        'lop': ['Lớp 10', 'Lớp 12'],
        'Cấp học': 'THPT'
    }
)
LessonPlanDirectory.objects.create(lesson_plan=lp5, directory=vat_ly)
LessonPlanDirectory.objects.create(lesson_plan=lp5, directory=chuyen_dong)


# Lesson 6: Microorganisms (Sinh học -> Vi sinh vật)
desc6 = "Bài giảng khảo sát cấu trúc tế bào nhân sơ của vi khuẩn, các dạng hình học cơ bản của virus và cơ chế lây nhiễm hệ thống."
content6 = """
KẾ HOẠCH BÀI DẠY: CẤU TRÚC VIRUS VÀ VI KHUẨN
Môn học: Sinh học - Lớp 10
Thời lượng: 2 tiết (90 phút)

I. YÊU CẦU CẦN ĐẠT:
- Phân biệt cấu tạo tế bào vi khuẩn (nhân sơ) và hạt virus (chưa có cấu tạo tế bào).
- Vẽ và chú thích được các bộ phận chính của virus: vỏ protein capsid, lõi axit nucleic.
- Trình bày vòng đời nhân lên của vi sinh vật trong tế bào chủ.
"""
file_rel_6 = generate_docx_file('cau_truc_vi_sinh_vat.docx', 'Cấu trúc vi sinh vật', content6)
lp6 = LessonPlan.objects.create(
    title='Chủ đề 6: Cấu trúc của các loại Virus và vi khuẩn',
    description=desc6,
    target_student='Học sinh thành thị',
    status='PUBLISHED',
    creator=admin,
    file_path=file_rel_6,
    content_preview=content6,
    attributes={
        'Môn học': 'Sinh học',
        'Loại hình': 'Lý thuyết',
        'Tiết dạy': '2 tiết',
        'lop': ['Lớp 10'],
        'Cấp học': 'THPT'
    }
)
LessonPlanDirectory.objects.create(lesson_plan=lp6, directory=sinh_hoc)
LessonPlanDirectory.objects.create(lesson_plan=lp6, directory=vi_sinh)


# Lesson 7: Ecology (Sinh học -> Sinh thái)
desc7 = "Khảo sát dòng năng lượng trong chuỗi thức ăn sinh thái, sự phân bố sinh khối và chu trình chuyển hóa nito sinh học."
content7 = """
GIÁO ÁN: HỆ SINH THÁI VÀ MÔI TRƯỜNG
Môn học: Sinh học - Lớp 12
Thời lượng: 2 tiết (90 phút)

I. MỤC TIÊU BÀI HỌC:
- Định nghĩa hệ sinh thái, quần xã sinh vật và quần thể sinh vật.
- Vẽ sơ đồ lưới thức ăn phức tạp trong một khu rừng nhiệt đới.
- Hiểu được tầm quan trọng của đa dạng sinh học trong việc bảo vệ môi trường toàn cầu.
"""
file_rel_7 = generate_docx_file('he_sinh_thai_moi_truong.docx', 'Hệ sinh thái và môi trường', content7)
lp7 = LessonPlan.objects.create(
    title='Chủ đề 7: Hệ sinh thái và chu trình tuần hoàn vật chất',
    description=desc7,
    target_student='Học sinh nông thôn',
    status='PUBLISHED',
    creator=admin,
    file_path=file_rel_7,
    content_preview=content7,
    attributes={
        'Môn học': 'Sinh học',
        'Loại hình': 'Lý thuyết',
        'Tiết dạy': '2 tiết',
        'lop': ['Lớp 12'],
        'Cấp học': 'THPT'
    }
)
LessonPlanDirectory.objects.create(lesson_plan=lp7, directory=sinh_hoc)
LessonPlanDirectory.objects.create(lesson_plan=lp7, directory=sinh_thai)


# Lesson 8: Biotechnology (Sinh học -> Công nghệ sinh học)
desc8 = "Khái quát các kỹ thuật cấy gen biến đổi ADN phục vụ tạo ra các giống cây trồng kháng sâu bệnh và nâng cao năng suất."
content8 = """
KẾ HOẠCH GIÁO DỤC: CÔNG NGHỆ GEN NÔNG NGHIỆP
Môn học: Sinh học - Lớp 12
Thời lượng: 1 tiết (45 phút)

I. YÊU CẦU CẦN ĐẠT:
- Nêu định nghĩa về công nghệ sinh học và kỹ thuật chuyển gen nhân tạo.
- Kể tên các thành tựu biến đổi gen vượt trội ở cây ngô, lúa nước kháng mặn.
- Thảo luận về vấn đề an toàn sinh học của thực phẩm biến đổi gen GMO.
"""
file_rel_8 = generate_docx_file('cong_nghe_sinh_hoc.docx', 'Công nghệ sinh học', content8)
lp8 = LessonPlan.objects.create(
    title='Chủ đề 8: Ứng dụng công nghệ gen trong nông nghiệp hiện đại',
    description=desc8,
    target_student='Học sinh thành thị',
    status='PUBLISHED',
    creator=admin,
    file_path=file_rel_8,
    content_preview=content8,
    attributes={
        'Môn học': 'Sinh học',
        'Loại hình': 'Lý thuyết',
        'Tiết dạy': '1 tiết',
        'lop': ['Lớp 12'],
        'Cấp học': 'THPT'
    }
)
LessonPlanDirectory.objects.create(lesson_plan=lp8, directory=sinh_hoc)
LessonPlanDirectory.objects.create(lesson_plan=lp8, directory=cong_nghe)


# Lesson 9: Standing Waves (Vật lý -> Sóng dừng)
desc9 = "Thực hành quan sát hiện tượng giao thoa sóng cơ học trên sợi dây đàn hồi, xác định vị trí các nút sóng và bụng sóng cực đại."
content9 = """
GIÁO ÁN THỰC HÀNH: HIỆN TƯỢNG SÓNG DỰNG
Môn học: Vật lý - Lớp 11
Thời lượng: 3 tiết (135 phút)

I. MỤC TIÊU BÀI DẠY:
- Học sinh tạo được sóng dừng ổn định trên sợi dây đàn hồi bằng máy phát tần số.
- Chỉ ra các nút sóng (vị trí đứng yên) và bụng sóng (vị trí dao động cực đại).
- Tính toán chính xác bước sóng và tốc độ truyền sóng cơ học dựa vào tần số dao động.
"""
file_rel_9 = generate_docx_file('hien_tuong_song_dung.docx', 'Hiện tượng sóng dừng', content9)
lp9 = LessonPlan.objects.create(
    title='Chủ đề 9: Khảo sát hiện tượng sóng dừng trên sợi dây đàn hồi',
    description=desc9,
    target_student='Học sinh thành thị',
    status='PUBLISHED',
    creator=admin,
    file_path=file_rel_9,
    content_preview=content9,
    attributes={
        'Môn học': 'Vật lý',
        'Loại hình': 'Thực hành',
        'Tiết dạy': '3 tiết',
        'lop': ['Lớp 11', 'Lớp 12'],
        'Cấp học': 'THPT'
    }
)
LessonPlanDirectory.objects.create(lesson_plan=lp9, directory=vat_ly)
LessonPlanDirectory.objects.create(lesson_plan=lp9, directory=song_dung)

print("Seeding completed successfully with physical docx files and full markdown previews!")
