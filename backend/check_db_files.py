import os
import django
import urllib.request
import urllib.error

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kms_core.settings')
django.setup()

from app.models import LessonPlan

def remove_accents(input_str):
    import unicodedata
    s1 = ''.join(c for c in unicodedata.normalize('NFD', input_str) if unicodedata.category(c) != 'Mn')
    s1 = s1.replace('đ', 'd').replace('Đ', 'D')
    return s1

def check_file_exists_remote(url):
    try:
        req = urllib.request.Request(url, method='HEAD')
        req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status == 200
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return False
        return True
    except Exception:
        return True

def main():
    lessons = LessonPlan.objects.all()
    to_delete = []
    
    print(f"Quet {lessons.count()} bai giang...")
    
    for idx, lesson in enumerate(lessons, 1):
        file_path = str(lesson.file_path) if lesson.file_path else ''
        if not file_path:
            to_delete.append(lesson)
            continue
            
        # 1. Check local file
        local_exists = False
        try:
            if lesson.file_path and lesson.file_path.path:
                local_exists = os.path.exists(lesson.file_path.path)
        except Exception:
            local_exists = False
            
        if local_exists:
            continue
            
        # 2. Check remote file
        remote_url = "https://he-thong-qltt-backend.onrender.com/media/" + file_path
        remote_exists = check_file_exists_remote(remote_url)
        
        if not remote_exists:
            to_delete.append(lesson)
            
    print(f"Tim thay: {len(to_delete)} bai giang mo coi. Bat dau xoa...")
    for idx, lesson in enumerate(to_delete, 1):
        clean_title = remove_accents(lesson.title)
        print(f"Dang xoa {idx}/{len(to_delete)} - ID: {lesson.id} ({clean_title})...")
        lesson.delete()
        
    print("Da hoan thanh xoa tat ca bai giang mo coi khoi CSDL!")

if __name__ == '__main__':
    main()
