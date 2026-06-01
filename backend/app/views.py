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
                    subj_queries |= Q(**{"attributes__Môn học__icontains": s_clean})
            queryset = queryset.filter(subj_queries)

        # 4.5. New Filters: Experiential Curriculum Schema
        # A. Mạch kiến thức (track)
        tracks = self.request.query_params.getlist('track')
        if len(tracks) == 1 and ',' in tracks[0]:
            tracks = tracks[0].split(',')
        if tracks:
            track_queries = Q()
            for t in tracks:
                t_clean = t.strip()
                if t_clean:
                    track_queries |= Q(**{"attributes__Mạch kiến thức__icontains": t_clean})
            queryset = queryset.filter(track_queries)

        # B. Chủ đề (topic)
        topics = self.request.query_params.getlist('topic')
        if len(topics) == 1 and ',' in topics[0]:
            topics = topics[0].split(',')
        if topics:
            topic_queries = Q()
            for tp in topics:
                tp_clean = tp.strip()
                if tp_clean:
                    topic_queries |= Q(**{"attributes__Chủ đề__icontains": tp_clean})
            queryset = queryset.filter(topic_queries)

        # C. Kiến thức sinh học liên quan (biology)
        biologies = self.request.query_params.getlist('biology')
        if len(biologies) == 1 and ',' in biologies[0]:
            biologies = biologies[0].split(',')
        if biologies:
            bio_queries = Q()
            for bio in biologies:
                bio_clean = bio.strip()
                if bio_clean:
                    bio_queries |= Q(**{"attributes__Kiến thức sinh học liên quan__icontains": bio_clean})
            queryset = queryset.filter(bio_queries)

        # D. Đối tượng giảng dạy (target_student)
        target_students = self.request.query_params.getlist('target_student')
        if len(target_students) == 1 and ',' in target_students[0]:
            target_students = target_students[0].split(',')
        if target_students:
            ts_queries = Q()
            for ts in target_students:
                ts_clean = ts.strip()
                if ts_clean:
                    ts_queries |= Q(target_student__icontains=ts_clean)
            queryset = queryset.filter(ts_queries)

        # E. Địa điểm / Phòng thiết bị (location)
        locations = self.request.query_params.getlist('location')
        if len(locations) == 1 and ',' in locations[0]:
            locations = locations[0].split(',')
        if locations:
            loc_queries = Q()
            for loc in locations:
                loc_clean = loc.strip()
                if loc_clean:
                    loc_queries |= Q(**{"attributes__Địa điểm__icontains": loc_clean})
            queryset = queryset.filter(loc_queries)

        # 5. Directory Filter
        if dir_id:
            queryset = queryset.filter(directories__id=dir_id)
            
        # 6. User Access Scope (PUBLISHED vs Owner LOCAL/DRAFT)
        if user_id:
            try:
                from .models import User
                requesting_user = User.objects.get(id=user_id)
                if requesting_user.role == 'ADMIN':
                    pass
                else:
                    queryset = queryset.filter(Q(status='PUBLISHED') | Q(creator_id=user_id))
            except User.DoesNotExist:
                queryset = queryset.filter(status='PUBLISHED')
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
            file_name = file_obj.name.lower()
            if file_name.endswith('.docx'):
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
            elif file_name.endswith(('.md', '.markdown', '.txt')):
                try:
                    content_bytes = b"".join(file_obj.chunks())
                    save_kwargs['content_preview'] = content_bytes.decode('utf-8', errors='replace')
                except Exception as e:
                    print(f"Error reading direct md/txt on update: {e}")

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
                                save_kwargs['status'] = 'PUBLISHED'
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
        # LOCAL uploads check against the SAME user's LOCAL documents and their own public/pending documents
        if not user:
            return None, None
        candidates = LessonPlan.objects.filter(creator=user)

    if exclude_id:
        candidates = candidates.exclude(id=exclude_id)

    # 1. Exact title check
    title_str = str(title).strip()
    title_query = candidates.filter(title__iexact=title_str)
    if title_query.exists():
        existing = title_query.first()
        dir_path = ""
        if existing.directories.exists():
            directory = existing.directories.first()
            path_components = []
            curr = directory
            while curr:
                path_components.insert(0, curr.name)
                curr = curr.parent
            full_path = " / ".join(path_components)
            dir_path = f" tại thư mục '{full_path}'"
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
                            directory = cand.directories.first()
                            path_components = []
                            curr = directory
                            while curr:
                                path_components.insert(0, curr.name)
                                curr = curr.parent
                            full_path = " / ".join(path_components)
                            dir_path = f" tại thư mục '{full_path}'"
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
        # Enforce status based on user role and target directory permissions
        resolved_status = 'LOCAL'
        directory = None
        dir_id = request.data.get('directory_id')
        if dir_id:
            try:
                directory = Directory.objects.get(id=dir_id)
                if directory.is_public:
                    has_permission = False
                    if user and user.role == 'ADMIN':
                        has_permission = True
                    elif user and user.role == 'TEACHER':
                        managed_ids = get_user_managed_directories(user)
                        if directory.id in managed_ids:
                            has_permission = True
                    resolved_status = 'PUBLISHED' if has_permission else 'PENDING'
                else:
                    resolved_status = 'LOCAL'
            except Directory.DoesNotExist:
                resolved_status = 'LOCAL'
        else:
            resolved_status = 'LOCAL'

        status_val = resolved_status
        
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
        if file_obj:
            file_name = file_obj.name.lower()
            if file_name.endswith('.docx'):
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
            elif file_name.endswith(('.md', '.markdown', '.txt')):
                try:
                    content_bytes = b"".join(file_obj.chunks())
                    content_preview = content_bytes.decode('utf-8', errors='replace')
                except Exception as e:
                    print(f"Error reading direct md/txt upload: {e}")

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
        if directory:
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
            # Đảm bảo bài giảng chỉ thuộc về 1 thư mục công khai (xóa thư mục cá nhân cũ)
            lp.directories.clear()
            lp.directories.add(req.target_directory)
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
                'is_active': u.is_active,
                'managed_directories': managed_dirs
            })
        return Response(data)

    def post(self, request):
        admin_id = request.data.get('admin_id')
        if not admin_id:
            return Response({'error': 'Unauthorized'}, status=403)
        try:
            admin = User.objects.get(id=admin_id)
            if admin.role != 'ADMIN':
                return Response({'error': 'Unauthorized'}, status=403)
        except User.DoesNotExist:
            return Response({'error': 'Unauthorized'}, status=403)

        username = request.data.get('username')
        password = request.data.get('password')
        full_name = request.data.get('full_name', '')
        role = request.data.get('role', 'USER')

        if not username or not password:
            return Response({'error': 'Username và password là bắt buộc.'}, status=400)

        if User.objects.filter(username__iexact=username).exists():
            return Response({'error': 'Tên tài khoản này đã tồn tại.'}, status=400)

        user = User.objects.create_user(
            username=username,
            password=password,
            full_name=full_name,
            role=role
        )
        return Response({
            'message': 'Đã tạo người dùng mới thành công!',
            'user': {
                'id': user.id,
                'username': user.username,
                'full_name': user.full_name,
                'role': user.role,
                'is_active': user.is_active,
                'managed_directories': []
            }
        }, status=201)

class AdminUserDetailAPIView(APIView):
    def patch(self, request, pk):
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
            user = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response({'error': 'Người dùng không tồn tại.'}, status=404)

        if user.id == admin.id:
            return Response({'error': 'Không thể tự thay đổi thông tin/vai trò hoặc khóa tài khoản của bản thân tại trang quản trị.'}, status=400)

        if user.role == 'ADMIN':
            return Response({'error': 'Không được phép thay đổi thông tin hoặc khóa/mở khóa tài khoản Quản trị viên khác.'}, status=400)

        username = request.data.get('username')
        password = request.data.get('password')
        full_name = request.data.get('full_name')
        role = request.data.get('role')
        is_active = request.data.get('is_active')

        if username and username.lower() != user.username.lower():
            if User.objects.filter(username__iexact=username).exists():
                return Response({'error': 'Tên tài khoản này đã tồn tại.'}, status=400)
            user.username = username

        if password:
            user.set_password(password)

        if full_name is not None:
            user.full_name = full_name

        if role:
            user.role = role

        if is_active is not None:
            user.is_active = bool(is_active)

        user.save()
        managed_dirs = list(Directory.objects.filter(user=user).values_list('id', flat=True))
        return Response({
            'message': 'Cập nhật thông tin thành công!',
            'user': {
                'id': user.id,
                'username': user.username,
                'full_name': user.full_name,
                'role': user.role,
                'is_active': user.is_active,
                'managed_directories': managed_dirs
            }
        })

    def delete(self, request, pk):
        admin_id = request.query_params.get('admin_id') or request.data.get('admin_id')
        if not admin_id:
            return Response({'error': 'Unauthorized'}, status=403)
        try:
            admin = User.objects.get(id=admin_id)
            if admin.role != 'ADMIN':
                return Response({'error': 'Unauthorized'}, status=403)
        except User.DoesNotExist:
            return Response({'error': 'Unauthorized'}, status=403)

        try:
            user = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response({'error': 'Người dùng không tồn tại.'}, status=404)

        if user.id == admin.id:
            return Response({'error': 'Không thể tự xóa chính mình.'}, status=400)

        if user.role == 'ADMIN':
            return Response({'error': 'Không được phép xóa tài khoản Quản trị viên khác.'}, status=400)

        user.delete()
        return Response({'message': 'Xóa tài khoản thành công!'})

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
            
        # Check if the user is ADMIN or a TEACHER with permission in the target directory
        has_permission = False
        if user.role == 'ADMIN':
            has_permission = True
        elif user.role == 'TEACHER':
            managed_ids = get_user_managed_directories(user)
            if directory.id in managed_ids:
                has_permission = True

        target_status = 'PUBLISHED' if has_permission else 'PENDING'

        # Check duplicate before proposing
        dup_error, dup_id = check_duplicate_lesson_plan(lesson.title, lesson.content_preview, target_status, user, exclude_id=lesson.id)
        if dup_error:
            return Response({'error': dup_error, 'duplicate_id': dup_id}, status=status.HTTP_400_BAD_REQUEST)

        # Một file giáo án chỉ được tồn tại trong 1 địa chỉ thư mục (xóa thư mục cá nhân cũ khi chuyển sang công khai)
        lesson.directories.clear()
        lesson.directories.add(directory)
        
        # Cập nhật trạng thái bài giảng
        lesson.status = target_status
        lesson.save()
        
        if has_permission:
            # Nếu có quyền: Duyệt tự động và thành công ngay lập tức!
            ApprovalRequest.objects.update_or_create(
                lesson_plan=lesson,
                defaults={
                    'requester': user,
                    'target_directory': directory,
                    'status': 'APPROVED',
                    'feedback': 'Tự động duyệt do người đăng có quyền quản trị thư mục.'
                }
            )
            return Response({
                'message': 'Đã xuất bản tài liệu công khai thành công (Tự động duyệt)!',
                'published': True
            })
        else:
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
            return Response({
                'message': 'Đề xuất công khai tài liệu thành công, đang chờ phê duyệt!',
                'published': False
            })

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
        avatar_file = request.FILES.get('avatar')
        avatar_base64 = request.data.get('avatar_base64')

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

        if avatar_file:
            user.avatar = avatar_file
        elif avatar_base64 and 'data' in avatar_base64:
            import base64
            from django.core.files.base import ContentFile
            format, imgstr = avatar_base64['data'].split(';base64,')
            user.avatar = ContentFile(base64.b64decode(imgstr), name=avatar_base64['name'])

        user.save()
        serializer = UserSerializer(user, context={'request': request})
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


class AIChatSessionListCreateAPIView(APIView):
    """
    API View để xem danh sách phiên trò chuyện của một người dùng (GET) 
    hoặc tạo mới phiên trò chuyện (POST).
    """
    def get(self, request):
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response({'error': 'Vui lòng cung cấp user_id.'}, status=status.HTTP_400_BAD_REQUEST)
        
        from .models import AIChatSession
        from .serializers import AIChatSessionSerializer
        
        sessions = AIChatSession.objects.filter(user_id=user_id).order_by('-created_at')
        serializer = AIChatSessionSerializer(sessions, many=True)
        return Response(serializer.data)

    def post(self, request):
        user_id = request.data.get('user_id')
        lesson_plan_id = request.data.get('lesson_plan_id')
        title = request.data.get('title')
        
        if not user_id:
            return Response({'error': 'Vui lòng cung cấp user_id.'}, status=status.HTTP_400_BAD_REQUEST)
            
        from .models import User, LessonPlan, AIChatSession
        from .serializers import AIChatSessionSerializer
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'Người dùng không tồn tại.'}, status=status.HTTP_404_NOT_FOUND)
            
        lesson = None
        if lesson_plan_id:
            try:
                lesson = LessonPlan.objects.get(id=lesson_plan_id)
                if not title:
                    title = f"Hỏi đáp: {lesson.title}"
            except LessonPlan.DoesNotExist:
                pass
                
        if not title:
            title = "Cuộc trò chuyện mới"
            
        session = AIChatSession.objects.create(
            user=user,
            lesson_plan=lesson,
            title=title
        )
        
        # Thêm câu chào mặc định từ AI vào phiên chat
        from .models import AIChatMessage
        default_greeting = "Xin chào! Tôi là Trợ lý AI hỗ trợ Quản lý Tri thức (Graph RAG). Tôi sẵn sàng giúp bạn tìm kiếm tài liệu, tóm tắt giáo án, đề xuất tài liệu và giải đáp mọi thắc mắc xoay quanh kho tri thức của hệ thống."
        if lesson:
            default_greeting = f"Xin chào! Tôi đã phân tích kế hoạch bài giảng \"{lesson.title}\". Tôi sẵn sàng hỗ trợ bạn tóm tắt hoạt động, đề xuất phương pháp sư phạm tối ưu, hoặc tìm kiếm các tài liệu liên quan trong hệ thống."
            
        AIChatMessage.objects.create(
            session=session,
            sender_role='AI',
            content=default_greeting
        )
        
        serializer = AIChatSessionSerializer(session)
        from .graph_rag_service import retrieve_graph_rag_context
        rag_data = retrieve_graph_rag_context(
            query="",
            user_id=session.user.id,
            focus_lesson_id=session.lesson_plan.id if session.lesson_plan else None
        )
        res_data = dict(serializer.data)
        res_data['suggested_questions'] = rag_data['suggested_questions']
        return Response(res_data, status=status.HTTP_201_CREATED)


class AIChatSessionDetailAPIView(APIView):
    """
    API View để xem thông tin chi tiết một phiên chat (GET) hoặc xóa phiên chat (DELETE).
    """
    def get(self, request, pk):
        from .models import AIChatSession
        from .serializers import AIChatSessionSerializer
        try:
            session = AIChatSession.objects.get(id=pk)
            serializer = AIChatSessionSerializer(session, context={'request': request})
            from .graph_rag_service import retrieve_graph_rag_context
            rag_data = retrieve_graph_rag_context(
                query="",
                user_id=session.user.id,
                focus_lesson_id=session.lesson_plan.id if session.lesson_plan else None
            )
            res_data = dict(serializer.data)
            res_data['suggested_questions'] = rag_data['suggested_questions']
            return Response(res_data)
        except AIChatSession.DoesNotExist:
            return Response({'error': 'Phiên trò chuyện không tồn tại.'}, status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, pk):
        from .models import AIChatSession
        try:
            session = AIChatSession.objects.get(id=pk)
            session.delete()
            return Response({'message': 'Xóa phiên hội thoại thành công!'}, status=status.HTTP_200_OK)
        except AIChatSession.DoesNotExist:
            return Response({'error': 'Phiên trò chuyện không tồn tại.'}, status=status.HTTP_404_NOT_FOUND)


class KeycloakMockLoginAPIView(APIView):
    """
    API giả lập xác thực Keycloak (OIDC SSO Portal Simulation).
    Dành riêng cho việc kiểm thử và trình diễn trước Hội đồng chấm điểm khi không có máy chủ Keycloak thật.
    Tự động đồng bộ và trả về JWT Token cùng User dữ liệu đồng bộ.
    """
    def post(self, request):
        username = request.data.get('username')
        email = request.data.get('email', '')
        full_name = request.data.get('full_name', '')
        role = request.data.get('role', 'USER') # 'ADMIN', 'TEACHER', 'USER'

        if not username:
            return Response({'error': 'Vui lòng cung cấp username Keycloak.'}, status=400)

        # Đồng bộ hoặc tạo User trong CSDL cục bộ như luồng Keycloak thật
        try:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': email,
                    'full_name': full_name,
                    'role': role,
                    'is_active': True
                }
            )
            if not created:
                user.role = role
                user.full_name = full_name
                user.save(update_fields=['role', 'full_name'])
                
            serializer = UserSerializer(user)
            
            # Tạo JWT Token giả lập có chữ ký (để frontend có thể dùng nếu cần)
            import jwt
            from django.conf import settings
            mock_payload = {
                "sub": user.username,
                "preferred_username": user.username,
                "email": user.email,
                "name": user.full_name,
                "iss": "http://localhost:8080/realms/kms_realm",
                "aud": "kms-web-client",
                "resource_access": {
                    "kms-web-client": {
                        "roles": [f"KMS_{role}", role.lower()]
                    }
                }
            }
            # Ký tạm bằng chuỗi mã hóa đơn giản để phục vụ mock
            jwt_token = jwt.encode(mock_payload, 'mock-secret-key-1234', algorithm='HS256')
            
            return Response({
                'message': 'Đăng nhập giả lập OIDC Keycloak thành công!',
                'user': serializer.data,
                'token': jwt_token,
                'is_simulated': True
            }, status=200)
        except Exception as e:
            return Response({'error': f'Lỗi đồng bộ Keycloak: {str(e)}'}, status=500)


class KeycloakLoginAPIView(APIView):
    """
    API xác thực Keycloak thực tế (Authorization Code Exchange).
    Nhận 'code' từ Frontend React, gửi yêu cầu đổi lấy Access Token từ máy chủ Keycloak,
    xác thực chữ ký JWT, đồng bộ người dùng và đăng nhập.
    """
    def post(self, request):
        code = request.data.get('code')
        redirect_uri = request.data.get('redirect_uri', 'http://localhost:5173/')
        if not code:
            return Response({'error': 'Vui lòng cung cấp authorization code từ Keycloak.'}, status=400)

        from django.conf import settings
        import requests
        import jwt
        
        try:
            # 1. Gửi yêu cầu đổi code lấy tokens lên Keycloak (Server-to-Server)
            token_url = f"{settings.KEYCLOAK_SERVER_URL}/protocol/openid-connect/token"
            data = {
                'grant_type': 'authorization_code',
                'client_id': settings.KEYCLOAK_CLIENT_ID,
                'code': code,
                'redirect_uri': redirect_uri
            }
            # Lấy chứng chỉ certs không an toàn cho localhost trong dev
            token_res = requests.post(token_url, data=data, timeout=10)
            if token_res.status_code != 200:
                return Response({
                    'error': f"Keycloak Server từ chối đổi token (Mã lỗi: {token_res.status_code})",
                    'details': token_res.text
                }, status=400)
                
            token_data = token_res.json()
            access_token = token_data.get('access_token')
            
            # 2. Giải mã và xác thực chữ ký JWT (JWKS offline)
            jwks_url = f"{settings.KEYCLOAK_SERVER_URL}/protocol/openid-connect/certs"
            jwks = requests.get(jwks_url, timeout=10).json()
            
            unverified_header = jwt.get_unverified_header(access_token)
            kid = unverified_header.get('kid')
            
            public_key = None
            for key in jwks['keys']:
                if key['kid'] == kid:
                    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
                    break
                    
            if not public_key:
                return Response({'error': 'Chữ ký JWT của Keycloak không hợp lệ.'}, status=400)

            # Giải mã JWT payload (Bỏ qua xác minh aud để tránh lỗi Keycloak Access Token mặc định)
            payload = jwt.decode(
                access_token,
                public_key,
                algorithms=['RS256'],
                options={"verify_signature": True, "verify_aud": False}
            )
            
            # 3. Đồng bộ User (Auto-provisioning)
            username = payload.get('preferred_username') or payload.get('sub')
            email = payload.get('email', '')
            full_name = payload.get('name', '')
            
            roles = []
            resource_access = payload.get('resource_access', {})
            client_access = resource_access.get(settings.KEYCLOAK_CLIENT_ID, {})
            roles = client_access.get('roles', [])
            
            resolved_role = 'USER'
            if 'admin' in roles or 'KMS_ADMIN' in roles:
                resolved_role = 'ADMIN'
            elif 'teacher' in roles or 'KMS_TEACHER' in roles:
                resolved_role = 'TEACHER'
                
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': email,
                    'full_name': full_name,
                    'role': resolved_role,
                    'is_active': True
                }
            )
            if not created:
                user.role = resolved_role
                user.full_name = full_name
                user.save(update_fields=['role', 'full_name'])
                
            serializer = UserSerializer(user)
            return Response({
                'message': 'Đăng nhập Keycloak SSO thực tế thành công!',
                'user': serializer.data,
                'token': access_token
            }, status=200)
            
        except Exception as e:
            return Response({'error': f"Lỗi trong quá trình đổi token: {str(e)}"}, status=500)


class AIChatSendMessageAPIView(APIView):
    """
    API View xử lý việc gửi tin nhắn từ người dùng, thực thi Graph RAG truy xuất
    ngữ cảnh, và gọi LLM (Qwen 2.5 local hoặc API ngoài) để sinh câu trả lời.
    """
    def post(self, request, pk):
        from .models import AIChatSession, AIChatMessage
        from .serializers import AIChatMessageSerializer
        
        try:
            session = AIChatSession.objects.get(id=pk)
        except AIChatSession.DoesNotExist:
            return Response({'error': 'Phiên trò chuyện không tồn tại.'}, status=status.HTTP_404_NOT_FOUND)
            
        user_message_content = request.data.get('message')
        if not user_message_content or not str(user_message_content).strip():
            return Response({'error': 'Tin nhắn không được để trống.'}, status=status.HTTP_400_BAD_REQUEST)
            
        model_choice = request.data.get('model_choice', '3b') # '3b', '7b', hoặc 'api'
        api_key = request.data.get('api_key')
        model_name = request.data.get('model_name')
        focus_lesson_id = request.data.get('focus_lesson_id')
        
        # Nếu phiên chat có đính kèm giáo án cụ thể, ưu tiên focus vào giáo án đó
        if session.lesson_plan and not focus_lesson_id:
            focus_lesson_id = session.lesson_plan.id
            
        # Nếu đang chat ở view chung nhưng người dùng nhắc tên tài liệu cụ thể trong câu hỏi, tự động bind focus_lesson_id!
        if not focus_lesson_id:
            from .models import LessonPlan
            for lp in LessonPlan.objects.all():
                if len(lp.title) > 5 and lp.title.lower() in user_message_content.lower():
                    focus_lesson_id = lp.id
                    break
                    
        # 1. Lưu tin nhắn của User vào Database
        AIChatMessage.objects.create(
            session=session,
            sender_role='USER',
            content=user_message_content
        )
        
        # 2. Gọi dịch vụ Graph RAG truy xuất ngữ cảnh & Nodes đồ thị
        from .graph_rag_service import retrieve_graph_rag_context
        
        rag_data = retrieve_graph_rag_context(
            query=user_message_content,
            user_id=session.user.id,
            focus_lesson_id=focus_lesson_id,
            api_key=api_key
        )
        
        # --- PHẦN 3: BỘ PHÂN LOẠI Ý ĐỊNH TRUY VẤN NÂNG CAO (QUERY INTENT CLASSIFIER) ---
        query_lower = user_message_content.lower()
        intent = "GENERAL_KMS" # Ý định mặc định
        
        # Phân loại ý định
        if focus_lesson_id:
            intent = "FOCUS_QA"
        elif any(kw in query_lower for kw in ["bao nhiêu", "tổng số", "thống kê", "danh sách bài", "tất cả tài liệu", "liệt kê"]):
            intent = "STATISTICAL"
        elif any(kw in query_lower for kw in ["khác nhau", "so sánh", "tương tự", "giống nhau", "khác gì", "đối chiếu"]):
            intent = "COMPARATIVE"
            
        # Xác định System Prompt chuyên biệt cho từng ý định
        if intent == "FOCUS_QA":
            try:
                from .models import LessonPlan
                lesson_obj = LessonPlan.objects.get(id=focus_lesson_id)
                
                # Trích xuất sơ đồ tư duy (mindmap) chuyên sâu để AI phân tích
                mindmap_tags = lesson_obj.attributes.get("Từ khóa kiến thức", []) or lesson_obj.attributes.get("knowledge_tags", [])
                mindmap_str = ", ".join(mindmap_tags) if isinstance(mindmap_tags, list) else str(mindmap_tags)
                
                system_prompt = (
                    f"Bạn là Trợ lý AI chuyên gia phân tích sư phạm trong Hệ thống Quản lý Tri thức Học tập (KMS).\n"
                    f"Hiện tại người dùng đang xem tài liệu cụ thể: \"{lesson_obj.title}\" (ID bài giảng: {lesson_obj.id}) và bật khung chat hỗ trợ.\n"
                    f"ĐỒ THỊ SƠ ĐỒ TƯ DUY (MINDMAP) CỦA RIÊNG TÀI LIỆU NÀY GỒM CÁC PHÂN NHÁNH TRỌNG TÂM: [[{lesson_obj.title}]] -> {mindmap_str}.\n\n"
                    f"Nhiệm vụ của bạn là tập trung THIÊN VỀ tài liệu \"{lesson_obj.title}\" này để giải đáp thắc mắc, tóm tắt hoạt động, phân tích phương pháp sư phạm, hoặc điều chỉnh giáo án theo yêu cầu.\n"
                    f"Hãy trả lời bằng Tiếng Việt lịch sự, cấu trúc Markdown rõ ràng (sử dụng tiêu đề, bảng biểu, danh sách để cực kỳ trực quan).\n"
                    f"Bắt buộc phải đính kèm liên kết nhảy nhanh theo cú pháp markdown đặc biệt: `[Tên hiển thị liên kết](lesson://<lesson_id>?text=<từ_khóa_ngắn_tìm_kiếm>)` (hoặc `[Tên hiển thị](lesson://<lesson_id>)` nếu không có từ khóa cụ thể)."
                )
            except LessonPlan.DoesNotExist:
                intent = "GENERAL_KMS"

        if intent == "STATISTICAL":
            system_prompt = (
                "Bạn là Trợ lý AI chuyên gia thống kê tri thức hệ thống KMS.\n"
                "Người dùng đang yêu cầu THỐNG KÊ, LIỆT KÊ hoặc ĐO LƯỜNG toàn bộ tài liệu trong hệ thống.\n"
                "Nhiệm vụ của bạn là dựa vào Ngữ cảnh RAG (đặc biệt là danh mục và thuộc tính của tất cả các bài giảng công khai) để tổng hợp ra các bảng biểu trực quan, phân tích tỉ lệ môn học, phân loại theo lớp, loại hình, địa điểm, từ khóa một cách khoa học.\n"
                "Hãy trả lời bằng Tiếng Việt, trình bày dạng BẢNG BIỂU (Table) Markdown để so sánh định lượng trực quan, rõ ràng.\n"
                "Bắt buộc phải đính kèm liên kết nhảy nhanh cho mỗi tài liệu được liệt kê: `[Tên bài học](lesson://<lesson_id>)`."
            )
            
        elif intent == "COMPARATIVE":
            system_prompt = (
                "Bạn là Trợ lý AI chuyên gia phân tích so sánh và liên kết tri thức hệ thống KMS.\n"
                "Người dùng đang yêu cầu SO SÁNH, ĐỐI CHIẾU hoặc TÌM KIẾM LIÊN QUAN giữa các tài liệu khác nhau.\n"
                "Nhiệm vụ của bạn là phân tích sâu các điểm tương đồng, khác biệt về mặt cấu trúc hoạt động dạy học, phương pháp sư phạm, đối tượng học sinh, từ khóa kiến thức của các tài liệu tìm thấy trong Ngữ cảnh Graph RAG.\n"
                "Hãy trình bày câu trả lời rõ ràng dưới dạng So sánh đa chiều (sử dụng bảng biểu đối chiếu và bullet points rõ ràng).\n"
                "Bắt buộc phải đính kèm liên kết nhảy nhanh khi so sánh: `[Tên bài học](lesson://<lesson_id>)`."
            )
            
        elif intent == "GENERAL_KMS":
            system_prompt = (
                "Bạn là Trợ lý AI hữu ích, chuyên gia phân tích sư phạm trong Hệ thống Quản lý Tri thức Học tập (KMS).\n"
                "Nhiệm vụ của bạn là hỗ trợ người dùng tìm kiếm tài liệu giáo án, tóm tắt hoạt động giảng dạy, đề xuất cải tiến và giải đáp kiến thức sư phạm chung.\n"
                "Hãy trả lời một cách lịch sự, cấu trúc Markdown rõ ràng (sử dụng tiêu đề, bảng biểu, danh sách thụt lề để cực kỳ trực quan).\n"
                "Hãy dựa vào Ngữ cảnh Graph RAG được cung cấp bên dưới để trả lời trung thực, chính xác. Nếu ngữ cảnh không có thông tin, hãy trả lời linh hoạt dựa trên kiến thức của bạn nhưng nêu rõ là không tìm thấy trong tài liệu cụ thể của hệ thống.\n"
                "Để hỗ trợ điều hướng thông minh, khi bạn trích dẫn hoặc nhắc tới bất kỳ tài liệu/bài giảng nào từ Ngữ cảnh RAG, bạn BẮT BUỘC phải đính kèm liên kết nhảy nhanh theo cú pháp markdown đặc biệt: `[Tên hiển thị liên kết](lesson://<lesson_id>?text=<từ_khóa_ngắn_tìm_kiếm>)` (hoặc `[Tên hiển thị](lesson://<lesson_id>)` nếu không có từ khóa cụ thể)."
            )
        
        # Format nội dung gửi đến mô hình LLM bao gồm context trích xuất
        prompt_with_context = (
            f"NGỮ CẢNH GRAPH RAG TRUY XUẤT:\n"
            f"===================================\n"
            f"{rag_data['context']}\n"
            f"===================================\n\n"
            f"CÂU HỎI NGƯỜI DÙNG: {user_message_content}"
        )
        
        # 4. Thực thi nạp và gọi LLM thông qua LLM Runner
        from .llm_runner import generate_llm_response
        
        ai_response_content = generate_llm_response(
            prompt=prompt_with_context,
            system_prompt=system_prompt,
            model_choice=model_choice,
            api_key=api_key,
            model_name=model_name
        )
        
        # 5. Lưu tin nhắn trả lời của AI vào Database
        ai_message = AIChatMessage.objects.create(
            session=session,
            sender_role='AI',
            content=ai_response_content
        )
        
        # 6. Trả về kết quả cho client
        return Response({
            'message': AIChatMessageSerializer(ai_message).data,
            'retrieved_graph': rag_data['retrieved_graph'],
            'suggested_questions': rag_data['suggested_questions']
        }, status=status.HTTP_200_OK)


class AIChatGraphDataAPIView(APIView):
    """
    API View trả về Đồ thị tri thức (Knowledge Graph Nodes & Edges) dạng JSON.
    Nếu truyền thêm lesson_id, API sẽ trả về đồ thị sơ đồ tư duy (Mindmap) riêng cho tài liệu đó.
    Nếu không truyền, trả về toàn bộ đồ thị hệ thống.
    """
    def get(self, request):
        user_id = request.query_params.get('user_id')
        lesson_id = request.query_params.get('lesson_id')
        
        # Xử lý an toàn tham số để tránh chuỗi 'null', 'undefined' bị coi là ID hợp lệ
        if lesson_id in (None, '', 'null', 'undefined'):
            lesson_id = None
        else:
            try:
                lesson_id = int(lesson_id)
            except ValueError:
                lesson_id = None
                
        from .graph_rag_service import build_virtual_knowledge_graph
        graph_data = build_virtual_knowledge_graph(user_id=user_id, focus_lesson_id=lesson_id)
        return Response(graph_data)


class SystemSettingAPIView(APIView):
    """
    API View cho phép GET/POST cấu hình phân mảnh dữ liệu (chunking) dành cho Admin.
    """
    def get(self, request):
        from .models import SystemSetting
        try:
            config = SystemSetting.objects.get(key="chunking_config").value
        except SystemSetting.DoesNotExist:
            config = {
                "chunk_strategy": "heading",
                "chunk_size": 1000,
                "chunk_overlap": 200
            }
        return Response(config, status=status.HTTP_200_OK)

    def post(self, request):
        from .models import SystemSetting
        config = request.data
        setting_obj, created = SystemSetting.objects.update_or_create(
            key="chunking_config",
            defaults={"value": config}
        )
        return Response(setting_obj.value, status=status.HTTP_200_OK)


class BackgroundTasksStatusAPIView(APIView):
    """
    API View trả về trạng thái tiến độ thời gian thực của các tác vụ chạy ngầm.
    """
    def get(self, request):
        from .bg_processor import BackgroundProcessManager
        return Response(BackgroundProcessManager.get_status(), status=status.HTTP_200_OK)


class BackgroundTasksReprocessAPIView(APIView):
    """
    API View cho phép kích hoạt chạy lại (tái xử lý) AI RAG cho một bài học cụ thể
    hoặc toàn bộ các bài học trong hệ thống.
    """
    def post(self, request):
        lesson_id = request.data.get('lesson_id')
        from .models import LessonPlan
        from .bg_processor import BackgroundProcessManager
        
        if lesson_id:
            try:
                lp = LessonPlan.objects.get(id=lesson_id)
                # Đưa trạng thái về PENDING
                lp.ai_processing_status = 'PENDING'
                lp.ai_processing_step = 'Đang xếp hàng chạy lại xử lý ngầm...'
                lp.save(update_fields=['ai_processing_status', 'ai_processing_step'])
                BackgroundProcessManager.queue_task(lp.id)
                return Response({"message": f"Đã đưa bài học '{lp.title}' vào hàng chờ chạy lại thành công!"}, status=status.HTTP_200_OK)
            except LessonPlan.DoesNotExist:
                return Response({"error": "Không tìm thấy bài học tương ứng"}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Tái xử lý toàn bộ tài liệu trên hệ thống
            lps = LessonPlan.objects.all()
            count = lps.count()
            for lp in lps:
                lp.ai_processing_status = 'PENDING'
                lp.ai_processing_step = 'Đang xếp hàng chạy lại xử lý ngầm...'
                lp.save(update_fields=['ai_processing_status', 'ai_processing_step'])
                BackgroundProcessManager.queue_task(lp.id)
            return Response({"message": f"Đã đưa toàn bộ {count} bài học vào hàng chờ chạy lại thành công!"}, status=status.HTTP_200_OK)


class ObsidianStatusAPIView(APIView):
    """
    API View trả về đường dẫn Obsidian Vault đồng bộ trên máy chủ.
    """
    def get(self, request):
        import os
        from .bg_processor import BackgroundProcessManager
        return Response({
            "vault_path": BackgroundProcessManager.get_vault_path(),
            "exists": os.path.exists(BackgroundProcessManager.get_vault_path())
        }, status=status.HTTP_200_OK)


class ObsidianNotesListAPIView(APIView):
    """
    API View trả về danh sách các note .md trong Obsidian Vault trên máy chủ.
    """
    def get(self, request):
        import os
        from .bg_processor import BackgroundProcessManager
        vault_path = BackgroundProcessManager.get_vault_path()
        if not os.path.exists(vault_path):
            return Response({"error": "Không tìm thấy thư mục Vault"}, status=400)
            
        notes = []
        for file in os.listdir(vault_path):
            if file.lower().endswith('.md'):
                notes.append({
                    "filename": file,
                    "title": file[:-3], # Cắt .md đi
                    "size": os.path.getsize(os.path.join(vault_path, file))
                })
        # Sắp xếp theo tên
        notes = sorted(notes, key=lambda x: x["title"].lower())
        return Response(notes, status=200)


class ObsidianNoteContentAPIView(APIView):
    """
    API View đọc trực tiếp nội dung chi tiết của một note trong Vault.
    """
    def get(self, request):
        import os
        from .bg_processor import BackgroundProcessManager
        filename = request.query_params.get('filename')
        if not filename:
            return Response({"error": "Vui lòng cung cấp tên file"}, status=400)
            
        vault_path = BackgroundProcessManager.get_vault_path()
        file_path = os.path.join(vault_path, filename)
        if not os.path.exists(file_path):
            return Response({"error": "Không tìm thấy file ghi chú"}, status=400)
            
        try:
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
            return Response({"filename": filename, "content": content}, status=200)
        except Exception as e:
            return Response({"error": f"Lỗi đọc file: {str(e)}"}, status=500)



