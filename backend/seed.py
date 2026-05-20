import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kms_core.settings')
django.setup()

from app.models import LessonPlan, Directory, User, LessonPlanDirectory

print("Deleting old data...")
LessonPlan.objects.all().delete()
Directory.objects.all().delete()

print("Creating admin...")
admin, created = User.objects.get_or_create(
    username='admin',
    defaults={'role': 'ADMIN', 'full_name': 'Admin'}
)
if created:
    admin.set_password('admin')
    admin.save()

print("Creating directories...")
sinh_hoc = Directory.objects.create(name='Sinh học', is_public=True, user=admin)
thuc_vat = Directory.objects.create(name='Thực vật', parent=sinh_hoc, is_public=True, user=admin)
vi_sinh = Directory.objects.create(name='Vi sinh vật', parent=sinh_hoc, is_public=True, user=admin)
sinh_thai = Directory.objects.create(name='Sinh thái', parent=sinh_hoc, is_public=True, user=admin)
con_nguoi = Directory.objects.create(name='Con người', parent=sinh_hoc, is_public=True, user=admin)
cong_nghe = Directory.objects.create(name='Công nghệ sinh học', parent=sinh_hoc, is_public=True, user=admin)

toan_hoc = Directory.objects.create(name='Toán học', is_public=True, user=admin)

print("Creating sample lessons...")

lp1 = LessonPlan.objects.create(
    title='Di truyền học Mendel: Quy luật phân li',
    description='Bài giảng giới thiệu về quy luật phân li của Mendel, bao gồm các khái niệm cơ bản về gen trội, gen lặn và cách tính tỷ lệ phân li. Học sinh sẽ thực hành giải bài tập sơ đồ Punnett.',
    target_student='Học sinh thành thị',
    status='PUBLISHED',
    creator=admin,
    attributes={'Môn học': 'Di truyền học', 'Cấp học': 'THPT'}
)
LessonPlanDirectory.objects.create(lesson_plan=lp1, directory=sinh_hoc)
LessonPlanDirectory.objects.create(lesson_plan=lp1, directory=thuc_vat)

lp2 = LessonPlan.objects.create(
    title='Quá trình quang hợp ở thực vật',
    description='Khám phá cơ chế quang hợp, vai trò của diệp lục và sự chuyển hóa năng lượng ánh sáng thành năng lượng hóa học. Bài học kết hợp thí nghiệm quan sát lá cây.',
    target_student='Học sinh nông thôn',
    status='PUBLISHED',
    creator=admin,
    attributes={'Môn học': 'Sinh học tế bào', 'Loại hình': 'Thực hành'}
)
LessonPlanDirectory.objects.create(lesson_plan=lp2, directory=thuc_vat)

lp3 = LessonPlan.objects.create(
    title='Hệ sinh thái và chu trình dinh dưỡng',
    description='Phân tích mối quan hệ giữa các sinh vật trong hệ sinh thái, chu trình carbon, nitơ và vai trò của sinh vật phân giải.',
    target_student='Học sinh thành thị',
    status='PUBLISHED',
    creator=admin,
    attributes={'Môn học': 'Sinh thái học', 'Loại hình': 'Lý thuyết'}
)
LessonPlanDirectory.objects.create(lesson_plan=lp3, directory=sinh_thai)

lp4 = LessonPlan.objects.create(
    title='Cấu trúc và chức năng của ADN',
    description='Giới thiệu về cấu trúc xoắn kép của ADN, các nucleotide và vai trò lưu trữ thông tin di truyền.',
    target_student='Học sinh thành thị',
    status='PUBLISHED',
    creator=admin,
    attributes={'Môn học': 'Sinh học phân tử', 'Loại hình': 'Lý thuyết'}
)
LessonPlanDirectory.objects.create(lesson_plan=lp4, directory=vi_sinh)

print("Seeding completed!")