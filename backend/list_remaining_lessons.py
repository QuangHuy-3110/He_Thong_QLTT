import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kms_core.settings')
django.setup()

from app.models import LessonPlan

def remove_accents(input_str):
    import unicodedata
    s1 = ''.join(c for c in unicodedata.normalize('NFD', input_str) if unicodedata.category(c) != 'Mn')
    s1 = s1.replace('đ', 'd').replace('Đ', 'D')
    return s1

def main():
    lessons = LessonPlan.objects.all()
    print(f"=== DANH SACH {lessons.count()} BAI GIANG DUOC GIU LAI TRONG CSDL ===")
    for idx, lesson in enumerate(lessons, 1):
        clean_title = remove_accents(lesson.title)
        print(f"{idx}. ID: {lesson.id} | Tieu de: {clean_title} | File: {lesson.file_path}")

if __name__ == '__main__':
    main()
