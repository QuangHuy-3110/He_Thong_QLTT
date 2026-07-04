from django.contrib import admin
from django.urls import path, include
from django.conf import settings
import os
from django.shortcuts import redirect
from django.views.static import serve
from django.urls import re_path

def custom_serve_media(request, path, document_root=None, **kwargs):
    # Check if the file exists locally
    local_file_path = os.path.join(document_root or settings.MEDIA_ROOT, path)
    if os.path.exists(local_file_path):
        return serve(request, path, document_root=document_root, **kwargs)
    else:
        # Fallback to the production web server media directory
        prod_media_url = "https://he-thong-qltt-backend.onrender.com/media/" + path
        return redirect(prod_media_url)

urlpatterns = [
    path('admin/', admin.site.urls),
    # Báo cho Django biết mọi đường dẫn bắt đầu bằng 'api/' sẽ chạy vào app
    path('api/', include('app.urls')), 
]

# Phục vụ file media trong mọi môi trường với cơ chế fallback tự động về Server Web
urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', custom_serve_media, {'document_root': settings.MEDIA_ROOT}),
]