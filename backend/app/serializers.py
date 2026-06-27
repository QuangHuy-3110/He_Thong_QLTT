from rest_framework import serializers
from .models import LessonPlan, User, Directory, ApprovalRequest, LessonPlanRating, AIChatSession, AIChatMessage, LessonPlanEditHistory

class UserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    def get_avatar_url(self, obj):
        if not obj.avatar:
            return None
        request = self.context.get('request')
        try:
            url = obj.avatar.url
        except ValueError:
            return None
        if request is not None:
            return request.build_absolute_uri(url)
        return url

    class Meta:
        model = User
        fields = ['id', 'full_name', 'email', 'username', 'role', 'avatar', 'avatar_url', 'is_active', 'phone_number']

class DirectorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Directory
        fields = ['id', 'name', 'parent', 'user', 'is_public', 'attributes']
        read_only_fields = ['user']

class LessonPlanSerializer(serializers.ModelSerializer):
    creator = UserSerializer(read_only=True)
    directory_ids = serializers.SerializerMethodField()
    directory_names = serializers.SerializerMethodField()
    file_path = serializers.SerializerMethodField()
    storage_path = serializers.SerializerMethodField()
    latest_feedback = serializers.SerializerMethodField()
    content_preview = serializers.SerializerMethodField()

    def get_directory_ids(self, obj):
        return list(obj.directories.values_list('id', flat=True))

    def get_directory_names(self, obj):
        return list(obj.directories.values_list('name', flat=True))

    def get_file_path(self, obj):
        if not obj.file_path:
            return None
        request = self.context.get('request')
        try:
            url = obj.file_path.url
        except ValueError:
            return None
        if request is not None:
            return request.build_absolute_uri(url)
        return url

    def get_storage_path(self, obj):
        if not obj.file_path:
            return None
        try:
            return obj.file_path.path
        except (ValueError, NotImplementedError, AttributeError):
            return obj.file_path.name

    def get_latest_feedback(self, obj):
        req = ApprovalRequest.objects.filter(lesson_plan=obj).order_by('-created_at').first()
        return req.feedback if req else None

    def get_content_preview(self, obj):
        if obj.content_preview and ("## " in obj.content_preview or "# " in obj.content_preview):
            return obj.content_preview
        # Fallback for existing or seeded documents: parse on-the-fly and save back
        if obj.file_path and obj.file_path.name.endswith('.docx'):
            import os
            from .docx_parser import convert_docx_to_markdown
            try:
                has_local_path = False
                try:
                    file_path = obj.file_path.path
                    if os.path.exists(file_path):
                        has_local_path = True
                except (NotImplementedError, AttributeError, ValueError):
                    has_local_path = False

                if has_local_path:
                    file_path = obj.file_path.path
                    markdown = convert_docx_to_markdown(file_path)
                    if markdown:
                        obj.content_preview = markdown
                        obj.save(update_fields=['content_preview'])
                        return markdown
                else:
                    # Nếu file được lưu trên Remote Storage, đọc file qua memory/tempfile
                    import tempfile
                    with tempfile.NamedTemporaryFile(delete=False, suffix='.docx') as temp_file:
                        temp_file.write(obj.file_path.read())
                        temp_path = temp_file.name
                    try:
                        markdown = convert_docx_to_markdown(temp_path)
                        if markdown:
                            obj.content_preview = markdown
                            obj.save(update_fields=['content_preview'])
                            return markdown
                    finally:
                        if os.path.exists(temp_path):
                            os.remove(temp_path)
            except Exception as e:
                print(f"Error parsing fallback docx: {e}")
        return obj.content_preview or ""

    class Meta:
        model = LessonPlan
        fields = ['id', 'title', 'description', 'target_student', 'status', 'creator', 'created_at', 'file_path', 'storage_path', 'attributes', 'directory_ids', 'directory_names', 'latest_feedback', 'average_rating', 'total_ratings', 'content_preview']

class LessonPlanListSerializer(serializers.ModelSerializer):
    creator = UserSerializer(read_only=True)
    directory_ids = serializers.SerializerMethodField()
    directory_names = serializers.SerializerMethodField()
    file_path = serializers.SerializerMethodField()
    latest_feedback = serializers.SerializerMethodField()

    def get_directory_ids(self, obj):
        return list(obj.directories.values_list('id', flat=True))

    def get_directory_names(self, obj):
        return list(obj.directories.values_list('name', flat=True))

    def get_file_path(self, obj):
        if not obj.file_path:
            return None
        request = self.context.get('request')
        try:
            url = obj.file_path.url
        except ValueError:
            return None
        if request is not None:
            return request.build_absolute_uri(url)
        return url

    def get_latest_feedback(self, obj):
        req = ApprovalRequest.objects.filter(lesson_plan=obj).order_by('-created_at').first()
        return req.feedback if req else None

    class Meta:
        model = LessonPlan
        fields = ['id', 'title', 'description', 'target_student', 'status', 'creator', 'created_at', 'file_path', 'attributes', 'directory_ids', 'directory_names', 'latest_feedback', 'average_rating', 'total_ratings']

class ApprovalRequestSerializer(serializers.ModelSerializer):
    lesson_plan_title = serializers.ReadOnlyField(source='lesson_plan.title')
    lesson_plan_description = serializers.ReadOnlyField(source='lesson_plan.description')
    lesson_plan_target_student = serializers.ReadOnlyField(source='lesson_plan.target_student')
    lesson_plan_attributes = serializers.ReadOnlyField(source='lesson_plan.attributes')
    lesson_plan_file_url = serializers.SerializerMethodField()
    requester_name = serializers.ReadOnlyField(source='requester.full_name')
    target_directory_name = serializers.ReadOnlyField(source='target_directory.name')

    def get_lesson_plan_file_url(self, obj):
        if obj.lesson_plan and obj.lesson_plan.file_path:
            request = self.context.get('request')
            try:
                url = obj.lesson_plan.file_path.url
            except ValueError:
                return None
            if request is not None:
                return request.build_absolute_uri(url)
            return url
        return None

    class Meta:
        model = ApprovalRequest
        fields = [
            'id', 'lesson_plan', 'lesson_plan_title', 'lesson_plan_description',
            'lesson_plan_target_student', 'lesson_plan_attributes',
            'lesson_plan_file_url', 'requester', 'requester_name',
            'target_directory', 'target_directory_name', 'status', 'feedback', 'created_at'
        ]

class LessonPlanRatingSerializer(serializers.ModelSerializer):
    user_full_name = serializers.ReadOnlyField(source='user.full_name')
    user_username = serializers.ReadOnlyField(source='user.username')
    user_id = serializers.ReadOnlyField(source='user.id')
    user_avatar_url = serializers.SerializerMethodField()

    def get_user_avatar_url(self, obj):
        if not obj.user or not obj.user.avatar:
            return None
        request = self.context.get('request')
        try:
            url = obj.user.avatar.url
        except ValueError:
            return None
        if request is not None:
            return request.build_absolute_uri(url)
        return url

    class Meta:
        model = LessonPlanRating
        fields = ['id', 'user_id', 'user_full_name', 'user_username', 'user_avatar_url', 'rating', 'comment', 'created_at']

class AIChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIChatMessage
        fields = ['id', 'session', 'sender_role', 'content', 'created_at']

class AIChatSessionSerializer(serializers.ModelSerializer):
    messages = AIChatMessageSerializer(many=True, read_only=True)
    lesson_plan_title = serializers.ReadOnlyField(source='lesson_plan.title', default=None)
    
    class Meta:
        model = AIChatSession
        fields = ['id', 'user', 'lesson_plan', 'lesson_plan_title', 'title', 'created_at', 'messages']

class LessonPlanEditHistorySerializer(serializers.ModelSerializer):
    edited_by_name = serializers.ReadOnlyField(source='edited_by.full_name')
    edited_by_username = serializers.ReadOnlyField(source='edited_by.username')
    edited_by_avatar = serializers.SerializerMethodField()

    def get_edited_by_avatar(self, obj):
        if not obj.edited_by or not obj.edited_by.avatar:
            return None
        request = self.context.get('request')
        try:
            url = obj.edited_by.avatar.url
        except ValueError:
            return None
        if request is not None:
            return request.build_absolute_uri(url)
        return url

    class Meta:
        model = LessonPlanEditHistory
        fields = [
            'id', 'lesson_plan', 'edited_by', 'edited_by_name', 'edited_by_username', 'edited_by_avatar',
            'title_before', 'title_after',
            'description_before', 'description_after',
            'target_student_before', 'target_student_after',
            'attributes_before', 'attributes_after',
            'file_name_before', 'file_name_after',
            'edited_at'
        ]