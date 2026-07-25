from django.apps import AppConfig
import sys

class AppConfig(AppConfig):
    name = 'app'

    def ready(self):
        # Tự động quét và chạy ngầm các bài giảng chưa hoàn thành khi server khởi động
        # Đảm bảo chỉ khởi chạy worker thread mà không gọi trực tiếp các truy vấn DB tại đây (tránh RuntimeWarning)
        if 'runserver' in sys.argv:
            import os
            if os.environ.get('RUN_MAIN') == 'true':
                try:
                    from .bg_processor import BackgroundProcessManager
                    BackgroundProcessManager.ensure_worker_running()
                except Exception as e:
                    print(f"Lỗi khi khởi tạo background worker thread: {e}")

