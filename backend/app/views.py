from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import authenticate
from .models import LessonPlan, User, Directory, ApprovalRequest, LessonPlanRating
from .serializers import LessonPlanSerializer, UserSerializer, DirectorySerializer, ApprovalRequestSerializer, LessonPlanRatingSerializer
from django.db.models import Q, Avg
import json

def get_user_managed_directories(user):
    if user.role == 'ADMIN':
        return list(Directory.objects.values_list('id', flat=True))
    directly_owned = Directory.objects.filter(user=user)
    managed_ids = set(directly_owned.values_list('id', flat=True))
    all_dirs = list(Directory.objects.all())
    def has_managed_ancestor(dir_obj):
        curr = dir_obj.parent
        while curr:
            if curr.id in managed_ids:
                return True
            curr = curr.parent
        return False
    descendant_ids = [d.id for d in all_dirs if has_managed_ancestor(d)]
    return list(managed_ids.union(descendant_ids))

class LessonPlanListAPIView(generics.ListAPIView):
    serializer_class = LessonPlanSerializer

    def get_queryset(self):
        queryset = LessonPlan.objects.all()
        q = self.request.query_params.get('q', None)
        user_id = self.request.query_params.get('user_id', None)
        dir_id = self.request.query_params.get('directory_id', None)
        
        # 1. PostgreSQL Full-Text Search (FTS)
        if q:
            from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank
            vector = SearchVector('title', weight='A') + SearchVector('content_preview', weight='B')
            query = SearchQuery(q)
            queryset = queryset.annotate(rank=SearchRank(vector, query)).filter(rank__gte=0.01).order_by('-rank')
        else:
            queryset = queryset.order_by('-created_at')
            
        # 2. JSONField Array Filtering (attributes__lop)
        classes = self.request.query_params.getlist('lop')
        if len(classes) == 1 and ',' in classes[0]:
            classes = classes[0].split(',')
        if classes:
            class_queries = Q()
            for cls in classes:
                cls_clean = cls.strip()
                if cls_clean:
                    class_queries |= Q(attributes__lop__contains=[cls_clean])
            queryset = queryset.filter(class_queries)

        # 3. Dynamic Attribute Filtering (Type / Loại hình)
        types = self.request.query_params.getlist('type')
        if len(types) == 1 and ',' in types[0]:
            types = types[0].split(',')
        if types:
            type_queries = Q()
            for t in types:
                t_clean = t.strip()
                if t_clean:
                    type_queries |= Q(attributes__contains={"Loại hình": t_clean})
            queryset = queryset.filter(type_queries)

        # 4. Dynamic Attribute Filtering (Subject / Môn học)
        subjects = self.request.query_params.getlist('subject')
        if len(subjects) == 1 and ',' in subjects[0]:
            subjects = subjects[0].split(',')
        if subjects:
            subj_queries = Q()
            for s in subjects:
                s_clean = s.strip()
                if s_clean:
                    subj_queries |= Q(attributes__contains={"Môn học": s_clean})
            queryset = queryset.filter(subj_queries)

        # 5. Directory Filter
        if dir_id:
            queryset = queryset.filter(directories__id=dir_id)
            
        # 6. User Access Scope (PUBLISHED vs Owner LOCAL/DRAFT)
        if user_id:
            queryset = queryset.filter(Q(status='PUBLISHED') | Q(creator_id=user_id))
        else:
            queryset = queryset.filter(status='PUBLISHED')
            
        return queryset

from rest_framework.exceptions import PermissionDenied

class LessonPlanDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = LessonPlan.objects.all()
    serializer_class = LessonPlanSerializer

    def perform_update(self, serializer):
        user_id = self.request.data.get('user_id') or self.request.query_params.get('user_id')
        lesson = self.get_object()
        
        if not user_id:
            raise PermissionDenied("Vui lòng cung cấp user_id người thực hiện cập nhật.")
            
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise PermissionDenied("Không tìm thấy thông tin người dùng chỉnh sửa.")
            
        if lesson.creator != user and user.role != 'ADMIN':
            raise PermissionDenied("Chỉ chủ sở hữu mới có quyền chỉnh sửa bài giảng này.")

        attrs = self.request.data.get('attributes', None)
        
        file_base64 = self.request.data.get('file_base64', None)
        file_obj = None
        if file_base64 and 'data' in file_base64:
            import base64
            from django.core.files.base import ContentFile
            format, imgstr = file_base64['data'].split(';base64,') 
            file_obj = ContentFile(base64.b64decode(imgstr), name=file_base64['name'])
        else:
            file_obj = self.request.FILES.get('file_path')

        save_kwargs = {}
        if attrs is not None:
            if isinstance(attrs, str):
                import json
                try:
                    attrs = json.loads(attrs)
                except:
                    pass
            save_kwargs['attributes'] = attrs
            
        if file_obj:
            save_kwargs['file_path'] = file_obj
            if file_obj.name.endswith('.docx'):
                import tempfile
                import os
                from .docx_parser import convert_docx_to_markdown
                with tempfile.NamedTemporaryFile(delete=False, suffix='.docx') as temp_file:
                    for chunk in file_obj.chunks():
                        temp_file.write(chunk)
                    temp_path = temp_file.name
                try:
                    save_kwargs['content_preview'] = convert_docx_to_markdown(temp_path)
                except Exception as e:
                    print(f"Error converting docx to markdown on update: {e}")
                finally:
                    if os.path.exists(temp_path):
                        os.remove(temp_path)

        # Xử lý cập nhật thư mục lưu tài liệu
        dir_id = self.request.data.get('directory_id')
        if dir_id is not None:
            if str(dir_id).strip() == '':
                lesson.directories.clear()
            else:
                try:
                    target_directory = Directory.objects.get(id=dir_id)
                    current_directory = lesson.directories.first()
                    
                    if current_directory != target_directory:
                        if target_directory.is_public:
                            # Thư mục công khai
                            managed_ids = get_user_managed_directories(user)
                            if user.role == 'ADMIN' or target_directory.id in managed_ids:
                                # Có quyền quản trị thư mục đích -> Cập nhật trực tiếp
                                lesson.directories.clear()
                                lesson.directories.add(target_directory)
                                current_attrs = attrs if attrs is not None else lesson.attributes
                                save_kwargs['attributes'] = {**target_directory.attributes, **current_attrs}
                            else:
                                # Không có quyền quản trị thư mục đích -> Cần xét duyệt
                                lesson.directories.clear()
                                lesson.directories.add(target_directory)
                                current_attrs = attrs if attrs is not None else lesson.attributes
                                save_kwargs['attributes'] = {**target_directory.attributes, **current_attrs}
                                save_kwargs['status'] = 'PENDING'
                                
                                # Tự động tạo/cập nhật yêu cầu xét duyệt
                                ApprovalRequest.objects.update_or_create(
                                    lesson_plan=lesson,
                                    defaults={
                                        'requester': user,
                                        'target_directory': target_directory,
                                        'status': 'PENDING',
                                        'feedback': ''
                                    }
                                )
                        else:
                            # Thư mục cá nhân -> Cập nhật trực tiếp, đổi trạng thái thành LOCAL
                            lesson.directories.clear()
                            lesson.directories.add(target_directory)
                            current_attrs = attrs if attrs is not None else lesson.attributes
                            save_kwargs['attributes'] = {**target_directory.attributes, **current_attrs}
                            save_kwargs['status'] = 'LOCAL'
                except Directory.DoesNotExist:
                    pass

        # Check duplicate on update
        title_for_dup = self.request.data.get('title') or lesson.title
        content_for_dup = save_kwargs.get('content_preview') or lesson.content_preview
        status_for_dup = save_kwargs.get('status') or lesson.status
        dup_error, dup_id = check_duplicate_lesson_plan(title_for_dup, content_for_dup, status_for_dup, user, exclude_id=lesson.id)
        if dup_error:
            from rest_framework.exceptions import APIException
            class DuplicateException(APIException):
                status_code = 400
                default_detail = 'Duplicate document.'
            raise DuplicateException({'error': dup_error, 'duplicate_id': dup_id})

        if user.role == 'USER' and save_kwargs.get('status') != 'LOCAL':
            # Bắt buộc phê duyệt lại cho người dùng bình thường
            save_kwargs['status'] = 'PENDING'
            serializer.save(**save_kwargs)
            
            # Tự động tạo/cập nhật yêu cầu phê duyệt
            directory = lesson.directories.first()
            if directory:
                ApprovalRequest.objects.update_or_create(
                    lesson_plan=lesson,
                    defaults={
                        'requester': user,
                        'target_directory': directory,
                        'status': 'PENDING',
                        'feedback': ''
                    }
                )
        else:
            serializer.save(**save_kwargs)

class DirectoryListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = DirectorySerializer

    def get_queryset(self):
        user_id = self.request.query_params.get('user_id')
        if user_id:
            try:
                user = User.objects.get(id=user_id)
                if user.role == 'ADMIN':
                    return Directory.objects.all()
                else:
                    managed_ids = get_user_managed_directories(user)
                    return Directory.objects.filter(Q(is_public=True) | Q(id__in=managed_ids))
            except User.DoesNotExist:
                pass
        return Directory.objects.filter(is_public=True)

    def perform_create(self, serializer):
        user_id = self.request.data.get('user_id')
        user = User.objects.get(id=user_id) if user_id else None
        
        parent_id = self.request.data.get('parent')
        attrs = self.request.data.get('attributes', {})
        if isinstance(attrs, str):
            attrs = json.loads(attrs)
            
        if parent_id:
            parent = Directory.objects.get(id=parent_id)
            attrs = {**parent.attributes, **attrs}
            
        serializer.save(user=user, attributes=attrs)

class DirectoryDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Directory.objects.all()
    serializer_class = DirectorySerializer

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        # Only update fields that were sent in the request
        data = {}
        for field in ['name', 'is_public', 'attributes', 'parent']:
            if field in request.data:
                data[field] = request.data[field]
        serializer = self.get_serializer(instance, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


def check_duplicate_lesson_plan(title, content_preview, status_val, user, exclude_id=None):
    from difflib import SequenceMatcher
    from .models import LessonPlan
    from django.db.models import Q

    if not title:
        return None, None

    # Determine candidates filter based on destination status
    if status_val in ['PUBLISHED', 'PENDING']:
        candidates = LessonPlan.objects.filter(status__in=['PUBLISHED', 'PENDING'])
    else:
        # LOCAL uploads only check against the SAME user's LOCAL documents
        if not user:
            return None, None
        candidates = LessonPlan.objects.filter(creator=user, status='LOCAL')

    if exclude_id:
        candidates = candidates.exclude(id=exclude_id)

    # 1. Exact title check
    title_str = str(title).strip()
    title_query = candidates.filter(title__iexact=title_str)
    if title_query.exists():
        existing = title_query.first()
        dir_path = ""
        if existing.directories.exists():
            dir_name = existing.directories.first().name
            dir_path = f" tại thư mục '{dir_name}'"
        scope = "công khai" if existing.status in ['PUBLISHED', 'PENDING'] else "cá nhân"
        return f'Tài liệu này đã tồn tại {scope}{dir_path} với tên "{title_str}".', existing.id

    # 2. Near-duplicate content check
    if content_preview and str(content_preview).strip():
        uploaded_cleaned = str(content_preview).strip()
        len_uploaded = len(uploaded_cleaned)
        
        content_candidates = candidates.exclude(content_preview="").exclude(content_preview__isnull=True)
        for cand in content_candidates:
            if not cand.content_preview:
                continue
            cand_cleaned = str(cand.content_preview).strip()
            len_cand = len(cand_cleaned)
            # Only compare if lengths are within 5% tolerance
            if abs(len_cand - len_uploaded) <= len_uploaded * 0.05:
                # Fast upper bound check
                quick_ratio = SequenceMatcher(None, uploaded_cleaned, cand_cleaned).real_quick_ratio()
                if quick_ratio > 0.95:
                    # Accurate check
                    ratio = SequenceMatcher(None, uploaded_cleaned, cand_cleaned).ratio()
                    if ratio > 0.95:
                        dir_path = ""
                        if cand.directories.exists():
                            dir_name = cand.directories.first().name
                            dir_path = f" tại thư mục '{dir_name}'"
                        scope = "công khai" if cand.status in ['PUBLISHED', 'PENDING'] else "cá nhân"
                        return f'Nội dung tài liệu trùng lặp {int(ratio*100)}% với bài giảng "{cand.title}" trong thư viện {scope}{dir_path}.', cand.id
    return None, None

class LessonPlanUploadAPIView(APIView):
    def post(self, request):
        user_id = request.data.get('user_id')
        user = User.objects.get(id=user_id) if user_id else None
        
        title = request.data.get('title')
        description = request.data.get('description', '')
        target_student = request.data.get('target_student', '')
        status_val = request.data.get('status', 'LOCAL')
        
        file_base64 = request.data.get('file_base64', None)
        file_obj = None
        if file_base64 and 'data' in file_base64:
            import base64
            from django.core.files.base import ContentFile
            format, imgstr = file_base64['data'].split(';base64,') 
            file_obj = ContentFile(base64.b64decode(imgstr), name=file_base64['name'])
        else:
            file_obj = request.FILES.get('file') # fallback
        
        attrs = request.data.get('attributes', '{}')
        if isinstance(attrs, str):
            attrs = json.loads(attrs)
            
        content_preview = ""
        if file_obj and file_obj.name.lower().endswith('.docx'):
            import tempfile
            import os
            from .docx_parser import convert_docx_to_markdown
            with tempfile.NamedTemporaryFile(delete=False, suffix='.docx') as temp_file:
                for chunk in file_obj.chunks():
                    temp_file.write(chunk)
                temp_path = temp_file.name
            try:
                content_preview = convert_docx_to_markdown(temp_path)
            except Exception as e:
                print(f"Error converting docx to markdown: {e}")
            finally:
                if os.path.exists(temp_path):
                    os.remove(temp_path)

        # Check duplicate
        dup_error, dup_id = check_duplicate_lesson_plan(title, content_preview, status_val, user)
        if dup_error:
            return Response({'error': dup_error, 'duplicate_id': dup_id}, status=status.HTTP_400_BAD_REQUEST)

        lp = LessonPlan.objects.create(
            creator=user,
            title=title,
            description=description,
            target_student=target_student,
            status=status_val,
            file_path=file_obj,
            content_preview=content_preview,
            attributes=attrs
        )
        
        # If directory specified, add to it
        dir_id = request.data.get('directory_id')
        if dir_id:
            directory = Directory.objects.get(id=dir_id)
            lp.directories.add(directory)
            # Kế thừa thuộc tính thư mục nếu có
            lp.attributes = {**directory.attributes, **lp.attributes}
            lp.save()
            
            # Tự động tạo yêu cầu xét duyệt nếu trạng thái là PENDING
            if status_val == 'PENDING':
                ApprovalRequest.objects.create(
                    lesson_plan=lp,
                    requester=user,
                    target_directory=directory,
                    status='PENDING'
                )

        return Response(LessonPlanSerializer(lp).data, status=status.HTTP_201_CREATED)

class ApprovalRequestListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = ApprovalRequestSerializer

    def get_queryset(self):
        user_id = self.request.query_params.get('user_id')
        if not user_id:
            return ApprovalRequest.objects.none()
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return ApprovalRequest.objects.none()

        if user.role == 'ADMIN':
            # Admin sees all pending requests
            return ApprovalRequest.objects.filter(status='PENDING').order_by('-created_at')
        elif user.role == 'TEACHER':
            # Teachers see pending requests for directories they manage recursively
            managed_ids = get_user_managed_directories(user)
            return ApprovalRequest.objects.filter(
                target_directory_id__in=managed_ids,
                status='PENDING'
            ).order_by('-created_at')
        
        return ApprovalRequest.objects.none()

class ApprovalRequestDetailAPIView(APIView):
    def patch(self, request, pk):
        user_id = request.data.get('user_id')
        action = request.data.get('action') # 'APPROVE' or 'REJECT'
        feedback = request.data.get('feedback', '')

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            req = ApprovalRequest.objects.get(id=pk)
        except ApprovalRequest.DoesNotExist:
            return Response({'error': 'Request not found'}, status=status.HTTP_404_NOT_FOUND)

        # Quyền hạn: Phải là Admin hoặc là người quản trị thư mục chứa bài viết đó đệ quy
        managed_ids = get_user_managed_directories(user)
        if user.role != 'ADMIN' and req.target_directory.id not in managed_ids:
            return Response({'error': 'Bạn không có quyền xét duyệt yêu cầu này.'}, status=status.HTTP_403_FORBIDDEN)

        if action == 'APPROVE':
            req.status = 'APPROVED'
            req.approver = user
            req.save()
            # Cập nhật trạng thái bài giảng
            lp = req.lesson_plan
            lp.status = 'PUBLISHED'
            lp.save()
            return Response({'message': 'Duyệt bài giảng thành công!'})
        elif action == 'REJECT':
            req.status = 'REJECTED'
            req.approver = user
            req.feedback = feedback
            req.save()
            # Cập nhật trạng thái bài giảng
            lp = req.lesson_plan
            lp.status = 'REJECTED'
            lp.save()
            return Response({'message': 'Từ chối bài giảng thành công!'})
        else:
            return Response({'error': 'Thao tác không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

class RegisterAPIView(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        full_name = request.data.get('full_name', '')
        
        if not username or not password:
            return Response({'error': 'Vui lòng cung cấp username và password.'}, status=status.HTTP_400_BAD_REQUEST)
        
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username đã tồn tại.'}, status=status.HTTP_400_BAD_REQUEST)
        
        user = User.objects.create_user(username=username, password=password, full_name=full_name, role='USER')
        serializer = UserSerializer(user)
        return Response({'message': 'Đăng ký thành công!', 'user': serializer.data}, status=status.HTTP_201_CREATED)

class LoginAPIView(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        
        user = authenticate(username=username, password=password)
        if user is not None:
            serializer = UserSerializer(user)
            data = serializer.data
            data['role'] = user.role
            return Response({'message': 'Đăng nhập thành công!', 'user': data}, status=status.HTTP_200_OK)
        else:
            return Response({'error': 'Sai tên đăng nhập hoặc mật khẩu.'}, status=status.HTTP_401_UNAUTHORIZED)

class AdminUserListAPIView(APIView):
    def get(self, request):
        admin_id = request.query_params.get('admin_id')
        if not admin_id:
            return Response({'error': 'Unauthorized'}, status=403)
        try:
            admin = User.objects.get(id=admin_id)
            if admin.role != 'ADMIN':
                return Response({'error': 'Unauthorized'}, status=403)
        except User.DoesNotExist:
            return Response({'error': 'Unauthorized'}, status=403)

        users = User.objects.all().order_by('username')
        data = []
        for u in users:
            managed_dirs = list(Directory.objects.filter(user=u).values_list('id', flat=True))
            data.append({
                'id': u.id,
                'username': u.username,
                'full_name': u.full_name,
                'role': u.role,
                'managed_directories': managed_dirs
            })
        return Response(data)

class UserSelfPermissionsAPIView(APIView):
    """Allows any logged-in user (including Teachers) to fetch their own managed directory IDs."""
    def get(self, request):
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response({'error': 'user_id required'}, status=400)
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)
        # Return explicit direct ownership + recursively inherited IDs
        managed_ids = get_user_managed_directories(user)
        return Response({'managed_directories': managed_ids})

class AdminAssignPermissionAPIView(APIView):
    def post(self, request, pk):
        admin_id = request.data.get('admin_id')
        if not admin_id:
            return Response({'error': 'Unauthorized'}, status=403)
        try:
            admin = User.objects.get(id=admin_id)
            if admin.role != 'ADMIN':
                return Response({'error': 'Unauthorized'}, status=403)
        except User.DoesNotExist:
            return Response({'error': 'Unauthorized'}, status=403)

        try:
            target_user = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)

        directory_ids = request.data.get('directory_ids', [])
        
        # 1. Any directories that this user currently manages but are NOT in the new list,
        # assign them back to the Admin
        current_dirs = Directory.objects.filter(user=target_user)
        for d in current_dirs:
            if d.id not in directory_ids:
                d.user = admin
                d.save()
                
        # 2. Assign the new directories to the target user
        for d_id in directory_ids:
            try:
                d = Directory.objects.get(id=d_id)
                d.user = target_user
                d.save()
            except Directory.DoesNotExist:
                pass

        # 3. Update the target user's role:
        # "người dùng chỉ là giáo viên khi được cấp quyền quản trị một thư mục hoặc nhiều thư mục."
        if target_user.role != 'ADMIN':
            owns_any = Directory.objects.filter(user=target_user).exists()
            new_role = 'TEACHER' if owns_any else 'USER'
            if target_user.role != new_role:
                target_user.role = new_role
                target_user.save()

        return Response({'message': 'Cấp quyền thành công!'})

class LessonPlanProposeAPIView(APIView):
    def post(self, request, pk):
        user_id = request.data.get('user_id')
        directory_id = request.data.get('directory_id')
        
        if not user_id or not directory_id:
            return Response({'error': 'Vui lòng cung cấp đầy đủ user_id và directory_id.'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            user = User.objects.get(id=user_id)
            lesson = LessonPlan.objects.get(id=pk)
            directory = Directory.objects.get(id=directory_id)
        except (User.DoesNotExist, LessonPlan.DoesNotExist, Directory.DoesNotExist):
            return Response({'error': 'Thông tin người dùng, bài giảng hoặc thư mục không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if lesson.creator != user and user.role != 'ADMIN':
            return Response({'error': 'Bạn không có quyền đề xuất tài liệu này.'}, status=status.HTTP_403_FORBIDDEN)
            
        # Check duplicate before proposing
        dup_error, dup_id = check_duplicate_lesson_plan(lesson.title, lesson.content_preview, 'PENDING', user, exclude_id=lesson.id)
        if dup_error:
            return Response({'error': dup_error, 'duplicate_id': dup_id}, status=status.HTTP_400_BAD_REQUEST)

        # Liên kết bài giảng với thư mục công khai được chọn
        lesson.directories.clear()
        lesson.directories.add(directory)
        
        # Chuyển trạng thái bài giảng sang PENDING để chờ duyệt
        lesson.status = 'PENDING'
        lesson.save()
        
        # Tạo mới/Cập nhật yêu cầu xét duyệt (ApprovalRequest)
        ApprovalRequest.objects.update_or_create(
            lesson_plan=lesson,
            defaults={
                'requester': user,
                'target_directory': directory,
                'status': 'PENDING',
                'feedback': ''
            }
        )
        
        return Response({'message': 'Đề xuất công khai tài liệu thành công, đang chờ phê duyệt!'})

class LessonPlanCheckDuplicateAPIView(APIView):
    def post(self, request, pk):
        user_id = request.data.get('user_id')
        status_val = request.data.get('status', 'PENDING')
        
        try:
            lesson = LessonPlan.objects.get(id=pk)
            user = User.objects.get(id=user_id) if user_id else None
        except (LessonPlan.DoesNotExist, User.DoesNotExist):
            return Response({'error': 'Thông tin không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)
            
        dup_error, dup_id = check_duplicate_lesson_plan(
            lesson.title, 
            lesson.content_preview, 
            status_val, 
            user, 
            exclude_id=lesson.id
        )
        return Response({
            'is_duplicate': dup_error is not None,
            'error': dup_error,
            'duplicate_id': dup_id
        })

class LessonPlanRatingAPIView(APIView):
    """GET: Lấy danh sách đánh giá của bài giảng. POST: Tạo hoặc cập nhật đánh giá."""

    def get(self, request, pk):
        try:
            lesson = LessonPlan.objects.get(id=pk)
        except LessonPlan.DoesNotExist:
            return Response({'error': 'Bài giảng không tồn tại.'}, status=status.HTTP_404_NOT_FOUND)
        ratings = LessonPlanRating.objects.filter(lesson_plan=lesson).order_by('-created_at')
        serializer = LessonPlanRatingSerializer(ratings, many=True)
        return Response({
            'ratings': serializer.data,
            'average_rating': lesson.average_rating,
            'total_ratings': lesson.total_ratings,
        })

    def post(self, request, pk):
        user_id = request.data.get('user_id')
        rating_val = request.data.get('rating')
        comment = request.data.get('comment', '')

        if not user_id or rating_val is None:
            return Response({'error': 'Vui lòng cung cấp user_id và rating.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            rating_val = int(rating_val)
            if not (1 <= rating_val <= 5):
                raise ValueError
        except (ValueError, TypeError):
            return Response({'error': 'Rating phải là số nguyên từ 1 đến 5.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'Người dùng không tồn tại.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            lesson = LessonPlan.objects.get(id=pk)
        except LessonPlan.DoesNotExist:
            return Response({'error': 'Bài giảng không tồn tại.'}, status=status.HTTP_404_NOT_FOUND)

        import html
        escaped_comment = html.escape(comment.strip())

        # Tạo mới hoặc cập nhật (mỗi user chỉ được đánh giá 1 lần)
        obj, created = LessonPlanRating.objects.update_or_create(
            user=user,
            lesson_plan=lesson,
            defaults={'rating': rating_val, 'comment': escaped_comment}
        )

        # Tính lại average_rating và total_ratings
        agg = LessonPlanRating.objects.filter(lesson_plan=lesson).aggregate(avg=Avg('rating'))
        lesson.average_rating = round(agg['avg'] or 0, 2)
        lesson.total_ratings = LessonPlanRating.objects.filter(lesson_plan=lesson).count()
        lesson.save(update_fields=['average_rating', 'total_ratings'])

        serializer = LessonPlanRatingSerializer(obj)
        return Response({
            'rating': serializer.data,
            'average_rating': lesson.average_rating,
            'total_ratings': lesson.total_ratings,
            'created': created,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

class UserProfileUpdateAPIView(APIView):
    def post(self, request):
        user_id = request.data.get('user_id')
        full_name = request.data.get('full_name')
        new_password = request.data.get('new_password')
        current_password = request.data.get('current_password')

        if not user_id:
            return Response({'error': 'Vui lòng cung cấp user_id.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'Người dùng không tồn tại.'}, status=status.HTTP_404_NOT_FOUND)

        # Nếu muốn đổi mật khẩu, bắt buộc kiểm tra mật khẩu cũ
        if new_password:
            if not current_password:
                return Response({'error': 'Vui lòng cung cấp mật khẩu cũ để thay đổi mật khẩu mới.'}, status=status.HTTP_400_BAD_REQUEST)
            if not user.check_password(current_password):
                return Response({'error': 'Mật khẩu cũ không chính xác.'}, status=status.HTTP_400_BAD_REQUEST)
            user.set_password(new_password)

        if full_name is not None:
            user.full_name = full_name

        user.save()
        serializer = UserSerializer(user)
        return Response({
            'message': 'Cập nhật thông tin cá nhân thành công!',
            'user': serializer.data
        }, status=status.HTTP_200_OK)


class LessonPlanWithdrawAPIView(APIView):
    """Cho phép chủ tài liệu gỡ bài PUBLISHED/PENDING xuống.
    
    action='delete' → Xóa hoàn toàn bài giảng.
    action='retract' → Thu hồi về thư viện cá nhân (status=LOCAL, xóa khỏi thư mục công khai).
    """
    def post(self, request, pk):
        user_id = request.data.get('user_id')
        action = request.data.get('action')  # 'delete' or 'retract'

        if not user_id or action not in ('delete', 'retract'):
            return Response(
                {'error': 'Vui lòng cung cấp user_id và action (delete/retract).'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'Người dùng không tồn tại.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            lesson = LessonPlan.objects.get(id=pk)
        except LessonPlan.DoesNotExist:
            return Response({'error': 'Bài giảng không tồn tại.'}, status=status.HTTP_404_NOT_FOUND)

        # Chỉ chủ sở hữu hoặc ADMIN mới được thao tác
        if lesson.creator != user and user.role != 'ADMIN':
            return Response({'error': 'Bạn không có quyền thao tác với bài giảng này.'}, status=status.HTTP_403_FORBIDDEN)

        if action == 'delete':
            lesson.delete()
            return Response({'message': 'Đã xóa bài giảng thành công!'}, status=status.HTTP_200_OK)

        elif action == 'retract':
            # Thu hồi: xóa khỏi thư mục công khai, đổi status về LOCAL
            lesson.directories.clear()
            lesson.status = 'LOCAL'
            lesson.save(update_fields=['status'])
            # Hủy các yêu cầu duyệt đang chờ (nếu có)
            ApprovalRequest.objects.filter(lesson_plan=lesson, status='PENDING').update(status='REJECTED', feedback='Tác giả thu hồi tài liệu.')
            return Response({'message': 'Đã thu hồi bài giảng về thư viện cá nhân!'}, status=status.HTTP_200_OK)

class LessonPlanParseDocxAPIView(APIView):
    def post(self, request):
        import os
        import tempfile
        from django.core.files.base import ContentFile
        from .docx_parser import parse_docx_lesson_plan

        file_obj = request.FILES.get('file')
        file_base64 = request.data.get('file_base64')

        if not file_obj and not file_base64:
            return Response({'error': 'Vui lòng cung cấp tệp tin.'}, status=status.HTTP_400_BAD_REQUEST)

        # Handle Base64 file format if supplied
        if file_base64 and 'data' in file_base64:
            import base64
            try:
                format, imgstr = file_base64['data'].split(';base64,')
                file_data = base64.b64decode(imgstr)
                file_name = file_base64.get('name', 'temp_lesson.docx')
                file_obj = ContentFile(file_data, name=file_name)
            except Exception as e:
                return Response({'error': f'Lỗi giải mã Base64: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        # Write to temporary file for parsing
        with tempfile.NamedTemporaryFile(delete=False, suffix='.docx') as temp_file:
            for chunk in file_obj.chunks():
                temp_file.write(chunk)
            temp_path = temp_file.name

        try:
            parsed_data = parse_docx_lesson_plan(temp_path)
            return Response(parsed_data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': f'Lỗi phân tích file Word: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)


