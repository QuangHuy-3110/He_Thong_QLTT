import os
from django.core.management.base import BaseCommand
from django.conf import settings
from app.models import LessonPlan

class Command(BaseCommand):
    help = 'Cleans up orphaned physical files in the media/lesson_plans directory'

    def handle(self, *args, **options):
        # Lấy tất cả file_path hiện có trong CSDL
        active_files = set()
        for lp in LessonPlan.objects.all():
            if lp.file_path:
                active_files.add(os.path.normpath(lp.file_path.name))

        media_root = settings.MEDIA_ROOT
        lesson_plans_dir = os.path.join(media_root, 'lesson_plans')

        if not os.path.exists(lesson_plans_dir):
            self.stdout.write(self.style.WARNING(f"Directory {lesson_plans_dir} does not exist."))
            return

        deleted_count = 0
        total_files = 0

        for root, dirs, files in os.walk(lesson_plans_dir):
            for file in files:
                total_files += 1
                file_abs_path = os.path.join(root, file)
                # Lấy path tương đối so với MEDIA_ROOT (ví dụ: 'lesson_plans/abc.docx')
                rel_path = os.path.relpath(file_abs_path, media_root)
                rel_path_normalized = os.path.normpath(rel_path)

                if rel_path_normalized not in active_files:
                    try:
                        os.remove(file_abs_path)
                        # Tránh lỗi encoding khi print ký tự tiếng Việt lên Console của Windows
                        safe_print_path = rel_path_normalized.encode('ascii', errors='ignore').decode('ascii')
                        self.stdout.write(self.style.SUCCESS(f"Deleted orphan file: {safe_print_path}"))
                        deleted_count += 1
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f"Could not delete file: {e}"))

        self.stdout.write(self.style.SUCCESS(
            f"Done! Scanned {total_files} files. Cleared {deleted_count} orphaned files."
        ))
