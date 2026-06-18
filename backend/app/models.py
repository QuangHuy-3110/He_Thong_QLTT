from django.db import models
from django.contrib.auth.models import AbstractUser
from pgvector.django import VectorField, HnswIndex
from django.contrib.postgres.indexes import GinIndex

class User(AbstractUser):
    role = models.CharField(max_length=50, choices=[('ADMIN', 'Quản trị viên'), ('TEACHER', 'Giáo viên'), ('USER', 'Người dùng bình thường')], default='USER')
    full_name = models.CharField(max_length=255, blank=True)
    avatar = models.FileField(upload_to='avatars/', null=True, blank=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    password_reset_temp = models.BooleanField(default=False)
    password_reset_at = models.DateTimeField(null=True, blank=True)
    otp_code = models.CharField(max_length=10, null=True, blank=True)
    otp_created_at = models.DateTimeField(null=True, blank=True)


class Directory(models.Model):
    name = models.CharField(max_length=255)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='subdirectories')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_directories')
    is_public = models.BooleanField(default=False)
    attributes = models.JSONField(default=dict, blank=True, help_text="Lưu trữ các thuộc tính linh hoạt của thư mục (VD: môn học, cấp học...)")

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
    ai_processing_step = models.CharField(max_length=255, blank=True, null=True)
    attributes = models.JSONField(default=dict, blank=True, help_text="Thuộc tính được kế thừa hoặc chọn lúc tải lên")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    directories = models.ManyToManyField(Directory, through='LessonPlanDirectory', related_name='lesson_plans')

    class Meta:
        indexes = [
            models.Index(fields=['status']),
            GinIndex(fields=['title'], name='lp_title_trgm_idx', opclasses=['gin_trgm_ops']),
            GinIndex(fields=['content_preview'], name='lp_content_trgm_idx', opclasses=['gin_trgm_ops']),
        ]

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
    heading = models.CharField(max_length=255, blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            HnswIndex(
                name='chunk_vector_hnsw_idx',
                fields=['embedding'],
                opclasses=['vector_cosine_ops'],
                m=16,
                ef_construction=64
            )
        ]

class SystemSetting(models.Model):
    key = models.CharField(max_length=50, unique=True)
    value = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

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

class LessonPlanEditHistory(models.Model):
    lesson_plan = models.ForeignKey(LessonPlan, on_delete=models.CASCADE, related_name='edit_histories')
    edited_by = models.ForeignKey(User, on_delete=models.CASCADE)
    title_before = models.CharField(max_length=255)
    title_after = models.CharField(max_length=255)
    description_before = models.TextField(blank=True, null=True)
    description_after = models.TextField(blank=True, null=True)
    target_student_before = models.CharField(max_length=100)
    target_student_after = models.CharField(max_length=100)
    attributes_before = models.JSONField(default=dict, blank=True)
    attributes_after = models.JSONField(default=dict, blank=True)
    file_name_before = models.CharField(max_length=255, blank=True, null=True)
    file_name_after = models.CharField(max_length=255, blank=True, null=True)
    edited_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-edited_at']

class WikiNoteEditHistory(models.Model):
    filename = models.CharField(max_length=255)
    edited_by = models.ForeignKey(User, on_delete=models.CASCADE)
    content_before = models.TextField()
    content_after = models.TextField()
    change_type = models.CharField(max_length=50, default='MANUAL') # 'MANUAL' or 'AI_REGEN'
    edited_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-edited_at']

class LessonPlanDirectory(models.Model):
    lesson_plan = models.ForeignKey(LessonPlan, on_delete=models.CASCADE)
    directory = models.ForeignKey(Directory, on_delete=models.CASCADE)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('lesson_plan', 'directory')

import os
from django.db.models.signals import pre_delete, pre_save, post_save
from django.dispatch import receiver

@receiver(pre_delete, sender=LessonPlan)
def delete_lesson_plan_file(sender, instance, **kwargs):
    """
    Xóa file vật lý tương ứng và tệp .md trong Obsidian Vault khi bản ghi bị xóa.
    """
    # 1. Xóa file vật lý đã upload
    if instance.file_path:
        try:
            if os.path.exists(instance.file_path.path):
                os.remove(instance.file_path.path)
        except Exception as e:
            print(f"Error deleting physical file {instance.file_path}: {e}")
            
    # 2. Xóa nốt Obsidian tương ứng và dọn dẹp các ghi chú khái niệm mồ côi
    try:
        import re
        app_dir = os.path.dirname(os.path.abspath(__file__))  # backend/app
        backend_dir = os.path.dirname(app_dir)  # backend
        workspace_dir = os.path.dirname(backend_dir)  # workspace root (He_Thong_QLTT)
        vault_dir = os.path.join(workspace_dir, "obsidian_vault")
        
        clean_filename = re.sub(r'[\/:*?"<>|\r\n\t]', '_', instance.title).strip()
        note_path = os.path.join(vault_dir, f"{clean_filename}.md")
        
        if os.path.exists(note_path):
            os.remove(note_path)
            print(f"[Signal] Deleted Obsidian note: {note_path}")
            
        # Dọn dẹp liên kết trong các Note khái niệm (Concept Notes)
        raw_tags = instance.attributes.get("Từ khóa kiến thức", []) or instance.attributes.get("knowledge_tags", [])
        if isinstance(raw_tags, list):
            for tag in raw_tags:
                concept_filename = f"{re.sub(r'[\/:*?\"<>|\r\n\t]', '_', tag).strip()}.md"
                concept_path = os.path.join(vault_dir, concept_filename)
                if os.path.exists(concept_path):
                    with open(concept_path, 'r', encoding='utf-8') as f:
                        concept_content = f.read()
                    
                    link_line = f"- [[{instance.title}]]"
                    links = re.findall(r'- \[\[(.*?)\]\]', concept_content)
                    
                    # Nếu note khái niệm chỉ chứa liên kết đến bài giảng này (hoặc mồ côi), xóa hoàn toàn
                    if len(links) <= 1 and (len(links) == 0 or links[0] == instance.title):
                        os.remove(concept_path)
                        print(f"[Signal] Deleted orphan concept note: {concept_path}")
                    else:
                        # Ngược lại, chỉ dọn dẹp dòng liên kết đến bài giảng vừa xóa
                        updated_lines = [line for line in concept_content.splitlines() if link_line not in line]
                        with open(concept_path, 'w', encoding='utf-8') as f:
                            f.write('\n'.join(updated_lines) + '\n')
                        print(f"[Signal] Removed link to deleted lesson from concept: {tag}")
    except Exception as ex:
        print(f"Error cleaning up Obsidian note in signal: {ex}")

@receiver(pre_save, sender=LessonPlan)
def delete_old_lesson_plan_file_on_update(sender, instance, **kwargs):
    """
    Xóa file vật lý cũ khi cập nhật LessonPlan với file mới.
    """
    if not instance.pk:
        return False

    try:
        old_instance = LessonPlan.objects.get(pk=instance.pk)
    except LessonPlan.DoesNotExist:
        return False

    old_file = old_instance.file_path
    new_file = instance.file_path

    if old_file and old_file != new_file:
        try:
            if os.path.exists(old_file.path):
                os.remove(old_file.path)
        except Exception as e:
            print(f"Error deleting old physical file {old_file}: {e}")

@receiver(pre_save, sender=LessonPlan)
def clean_old_obsidian_note_on_title_change(sender, instance, **kwargs):
    """
    Nếu tiêu đề bài giảng thay đổi, xóa nốt Obsidian cũ và các liên kết khái niệm tương ứng.
    """
    if not instance.pk:
        return

    try:
        old_instance = LessonPlan.objects.get(pk=instance.pk)
        if old_instance.title != instance.title:
            import re
            app_dir = os.path.dirname(os.path.abspath(__file__))
            backend_dir = os.path.dirname(app_dir)
            workspace_dir = os.path.dirname(backend_dir)
            vault_dir = os.path.join(workspace_dir, "obsidian_vault")
            
            old_clean_filename = re.sub(r'[\/:*?"<>|\r\n\t]', '_', old_instance.title).strip()
            old_note_path = os.path.join(vault_dir, f"{old_clean_filename}.md")
            
            if os.path.exists(old_note_path):
                os.remove(old_note_path)
                print(f"[Signal] Deleted old title Obsidian note: {old_note_path}")
                
            # Dọn dẹp liên kết trong các Note khái niệm (Concept Notes) của tiêu đề cũ
            raw_tags = old_instance.attributes.get("Từ khóa kiến thức", []) or old_instance.attributes.get("knowledge_tags", [])
            if isinstance(raw_tags, list):
                for tag in raw_tags:
                    concept_filename = f"{re.sub(r'[\/:*?\"<>|\r\n\t]', '_', tag).strip()}.md"
                    concept_path = os.path.join(vault_dir, concept_filename)
                    if os.path.exists(concept_path):
                        with open(concept_path, 'r', encoding='utf-8') as f:
                            concept_content = f.read()
                        
                        link_line = f"- [[{old_instance.title}]]"
                        links = re.findall(r'- \[\[(.*?)\]\]', concept_content)
                        
                        # Nếu note khái niệm chỉ chứa liên kết đến bài giảng này, xóa hoàn toàn để tránh mồ côi
                        if len(links) <= 1 and (len(links) == 0 or links[0] == old_instance.title):
                            os.remove(concept_path)
                            print(f"[Signal] Deleted orphan concept note for old title: {concept_path}")
                        else:
                            # Chỉ dọn dẹp dòng liên kết đến bài giảng này
                            updated_lines = [line for line in concept_content.splitlines() if link_line not in line]
                            with open(concept_path, 'w', encoding='utf-8') as f:
                                f.write('\n'.join(updated_lines) + '\n')
                            print(f"[Signal] Removed old title link from concept: {tag}")
    except Exception as e:
        print(f"[Signal] Error cleaning old title Obsidian note: {e}")

@receiver(post_save, sender=LessonPlan)
def index_lesson_plan_chunks(sender, instance, created, **kwargs):
    """
    Tự động đẩy giáo án vào hàng chờ xử lý RAG & Obsidian chạy ngầm.
    """
    # Kiểm tra cấu hình bật/tắt AI RAG toàn cục từ cơ sở dữ liệu (do Admin chỉnh trực tiếp trên giao diện)
    try:
        config = SystemSetting.objects.get(key="chunking_config").value
        use_ai_rag = config.get("use_ai_rag", True)
    except Exception:
        use_ai_rag = True

    if not use_ai_rag:
        if instance.ai_processing_status != 'COMPLETED':
            sender.objects.filter(id=instance.id).update(ai_processing_status='COMPLETED')
        return

    # Không xếp hàng lại nếu đã hoàn thành xử lý
    if instance.ai_processing_status == 'COMPLETED':
        return

    # Tránh đệ quy vô hạn khi cập nhật các trường trạng thái AI/RAG
    update_fields = kwargs.get('update_fields')
    if update_fields:
        ai_fields = {'ai_processing_status', 'ai_processing_step', 'attributes', 'content_preview'}
        if any(f in update_fields for f in ai_fields):
            return

    # Chỉ đẩy vào hàng chờ khi có preview nội dung khả dụng
    if not instance.content_preview or not str(instance.content_preview).strip():
        return

    try:
        from .bg_processor import BackgroundProcessManager
        BackgroundProcessManager.queue_task(instance.id)
    except Exception as e:
        print(f"Error queueing lesson plan to bg processor: {e}")

@receiver(post_save, sender=LessonPlan)
@receiver(pre_delete, sender=LessonPlan)
@receiver(post_save, sender=Directory)
@receiver(pre_delete, sender=Directory)
@receiver(post_save, sender=LessonPlanDirectory)
@receiver(pre_delete, sender=LessonPlanDirectory)
def invalidate_graph_cache(sender, instance, **kwargs):
    """
    Tự động xóa cache đồ thị tri thức khi có thay đổi về bài giảng, thư mục hoặc liên kết.
    """
    try:
        from .graph_rag_service import GraphCacheManager
        GraphCacheManager.invalidate_all()
    except Exception as e:
        print(f"[Signal] Error invalidating graph cache: {e}")