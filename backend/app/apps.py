from django.apps import AppConfig


import sys

class AppConfig(AppConfig):
    name = 'app'

    def ready(self):
        # Tự động quét và chạy ngầm các bài giảng chưa hoàn thành khi server khởi động
        if 'runserver' in sys.argv:
            import os
            if os.environ.get('RUN_MAIN') == 'true':
                try:
                    from .bg_processor import BackgroundProcessManager
                    BackgroundProcessManager.ensure_worker_running()
                    BackgroundProcessManager.scan_and_queue_unprocessed()
                except Exception as e:
                    print(f"Lỗi khi quét và chạy ngầm lúc khởi động: {e}")
