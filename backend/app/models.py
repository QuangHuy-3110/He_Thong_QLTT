from django.db import models
from django.contrib.auth.models import AbstractUser
from pgvector.django import VectorField

class User(AbstractUser):
    role = models.CharField(max_length=50, choices=[('ADMIN', 'Quản trị viên'), ('TEACHER', 'Giáo viên'), ('USER', 'Người dùng bình thường')], default='USER')
    full_name = models.CharField(max_length=255, blank=True)

class Directory(models.Model):
    name = models.CharField(max_length=255)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='subdirectories')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_directories')
    is_public = models.BooleanField(default=False)
    attributes = models.JSONField(default=dict, blank=True, help_text="Lưu trữ các thuộc tính linh hoạt của thư mục (VD: môn học, cấp học...)")

class DirectoryPermission(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    directory = models.ForeignKey(Directory, on_delete=models.CASCADE)
    permission_type = models.CharField(max_length=50, choices=[('VIEWER', 'Chỉ xem'), ('EDITOR', 'Chỉnh sửa')])

class LessonPlan(models.Model):
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_lessons')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    file_path = models.FileField(upload_to='lesson_plans/')
    content_preview = models.TextField(blank=True, null=True)
    target_student = models.CharField(max_length=100)
    status = models.CharField(max_length=50, default='DRAFT')
    average_rating = models.FloatField(default=0.0)
    total_ratings = models.IntegerField(default=0)
    ai_summary = models.TextField(blank=True, null=True)
    ai_processing_status = models.CharField(max_length=50, default='PENDING')
    attributes = models.JSONField(default=dict, blank=True, help_text="Thuộc tính được kế thừa hoặc chọn lúc tải lên")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    directories = models.ManyToManyField(Directory, through='LessonPlanDirectory', related_name='lesson_plans')

class LessonPlanRating(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    lesson_plan = models.ForeignKey(LessonPlan, on_delete=models.CASCADE, related_name='ratings')
    rating = models.IntegerField()
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

class ApprovalRequest(models.Model):
    lesson_plan = models.ForeignKey(LessonPlan, on_delete=models.CASCADE)
    requester = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_requests')
    target_directory = models.ForeignKey(Directory, on_delete=models.CASCADE)
    approver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='approved_requests', null=True, blank=True)
    status = models.CharField(max_length=50, default='PENDING')
    feedback = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

class DocumentChunk(models.Model):
    lesson_plan = models.ForeignKey(LessonPlan, on_delete=models.CASCADE, related_name='chunks')
    chunk_index = models.IntegerField()
    content = models.TextField()
    embedding = VectorField(dimensions=1536) 

class AIChatSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    lesson_plan = models.ForeignKey(LessonPlan, on_delete=models.CASCADE, null=True, blank=True)
    title = models.CharField(max_length=255, default='Cuộc trò chuyện mới')
    created_at = models.DateTimeField(auto_now_add=True)

class AIChatMessage(models.Model):
    session = models.ForeignKey(AIChatSession, on_delete=models.CASCADE, related_name='messages')
    sender_role = models.CharField(max_length=10, choices=[('USER', 'Người dùng'), ('AI', 'AI')])
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

class LessonPlanDirectory(models.Model):
    lesson_plan = models.ForeignKey(LessonPlan, on_delete=models.CASCADE)
    directory = models.ForeignKey(Directory, on_delete=models.CASCADE)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('lesson_plan', 'directory')