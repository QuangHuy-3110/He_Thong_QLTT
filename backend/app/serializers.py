from rest_framework import serializers
from .models import LessonPlan, User, Directory, ApprovalRequest

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'full_name', 'email', 'username', 'role']

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
        fields = ['id', 'title', 'description', 'target_student', 'status', 'creator', 'created_at', 'file_path', 'attributes', 'directory_ids', 'directory_names', 'latest_feedback']

class ApprovalRequestSerializer(serializers.ModelSerializer):
    lesson_plan_title = serializers.ReadOnlyField(source='lesson_plan.title')
    lesson_plan_description = serializers.ReadOnlyField(source='lesson_plan.description')
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
            'lesson_plan_file_url', 'requester', 'requester_name', 
            'target_directory', 'target_directory_name', 'status', 'feedback', 'created_at'
        ]