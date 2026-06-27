from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import authenticate
from .models import LessonPlan, User, Directory, ApprovalRequest, LessonPlanRating, LessonPlanEditHistory
from .serializers import LessonPlanSerializer, UserSerializer, DirectorySerializer, ApprovalRequestSerializer, LessonPlanRatingSerializer, LessonPlanEditHistorySerializer, LessonPlanListSerializer
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
    serializer_class = LessonPlanListSerializer

    def list(self, request, *args, **kwargs):
        import traceback
        from rest_framework.response import Response
        from rest_framework import status
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            tb = traceback.format_exc()
            return Response({"error": str(e), "traceback": tb}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
                    bio_queries |= (
                        Q(**{"attributes__Kiến thức sinh học liên quan__icontains": bio_clean}) |
                        Q(attributes__knowledge_tags__contains=[bio_clean]) |
                        Q(**{"attributes__Từ khóa kiến thức__contains": [bio_clean]})
                    )
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
                    if 'nông thôn' in ts_clean.lower() or 'nong thon' in ts_clean.lower():
                        ts_queries |= Q(target_student__icontains='nông thôn') | Q(target_student__icontains='HS nông thôn') | Q(target_student__icontains='Tat ca') | Q(target_student__icontains='Tất cả')
                    elif 'thành thị' in ts_clean.lower() or 'thanh thi' in ts_clean.lower():
                        ts_queries |= Q(target_student__icontains='thành thị') | Q(target_student__icontains='HS thành thị') | Q(target_student__icontains='Tat ca') | Q(target_student__icontains='Tất cả')
                    else:
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
                    if 'ngoài trời' in loc_clean.lower() or 'ngoai troi' in loc_clean.lower():
                        loc_queries |= Q(**{"attributes__Địa điểm__icontains": "Ngoài trời"})
                    elif 'thực địa' in loc_clean.lower() or 'thuc dia' in loc_clean.lower() or 'nông trại' in loc_clean.lower():
                        loc_queries |= Q(**{"attributes__Địa điểm__icontains": "Thực địa"}) | Q(**{"attributes__Địa điểm__icontains": "Nông trại"})
                    else:
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

        # Standardize target_student in validated_data if present
        if 'target_student' in serializer.validated_data:
            ts = serializer.validated_data['target_student']
            if ts:
                serializer.validated_data['target_student'] = ts.replace('HS thành thị', 'Học sinh thành thị').replace('HS nông thôn', 'Học sinh nông thôn')

        import os
        title_before = lesson.title
        description_before = lesson.description or ""
        target_student_before = lesson.target_student
        attributes_before = lesson.attributes or {}
        file_name_before = os.path.basename(lesson.file_path.name) if lesson.file_path else ""

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

        # Ghi nhận lịch sử chỉnh sửa
        lesson.refresh_from_db()
        title_after = lesson.title
        description_after = lesson.description or ""
        target_student_after = lesson.target_student
        attributes_after = lesson.attributes or {}
        file_name_after = os.path.basename(lesson.file_path.name) if lesson.file_path else ""

        has_changed = (
            title_before != title_after or
            description_before != description_after or
            target_student_before != target_student_after or
            attributes_before != attributes_after or
            file_name_before != file_name_after
        )

        if has_changed:
            from .models import LessonPlanEditHistory
            LessonPlanEditHistory.objects.create(
                lesson_plan=lesson,
                edited_by=user,
                title_before=title_before,
                title_after=title_after,
                description_before=description_before,
                description_after=description_after,
                target_student_before=target_student_before,
                target_student_after=target_student_after,
                attributes_before=attributes_before,
                attributes_after=attributes_after,
                file_name_before=file_name_before,
                file_name_after=file_name_after
            )

class LessonPlanEditHistoryAPIView(generics.ListAPIView):
    serializer_class = LessonPlanEditHistorySerializer

    def get_queryset(self):
        lesson_plan_id = self.kwargs.get('pk')
        user_id = self.request.query_params.get('user_id')
        if not user_id:
            raise PermissionDenied("Vui lòng cung cấp user_id người thực hiện truy vấn.")
            
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise PermissionDenied("Không tìm thấy thông tin người dùng.")
            
        try:
            lesson = LessonPlan.objects.get(id=lesson_plan_id)
        except LessonPlan.DoesNotExist:
            raise PermissionDenied("Không tìm thấy thông tin bài giảng.")
            
        # Chỉ ADMIN hoặc chủ sở hữu bài đăng mới có quyền xem lịch sử chỉnh sửa
        if lesson.creator != user and user.role != 'ADMIN':
            raise PermissionDenied("Bạn không có quyền xem lịch sử chỉnh sửa của bài giảng này.")
            
        from .models import LessonPlanEditHistory
        return LessonPlanEditHistory.objects.filter(lesson_plan=lesson)

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
        import traceback
        from rest_framework.response import Response
        from rest_framework import status
        try:
            return self._post(request)
        except Exception as e:
            tb = traceback.format_exc()
            return Response({"error": str(e), "traceback": tb}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _post(self, request):
        user_id = request.data.get('user_id')
        user = User.objects.get(id=user_id) if user_id else None
        
        title = request.data.get('title')
        description = request.data.get('description', '')
        target_student = request.data.get('target_student', '')
        if target_student:
            target_student = target_student.replace('HS thành thị', 'Học sinh thành thị').replace('HS nông thôn', 'Học sinh nông thôn')
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

def get_keycloak_admin_token():
    import requests
    from django.conf import settings
    import os
    admin_user = os.environ.get('KEYCLOAK_ADMIN_USER') or getattr(settings, 'KEYCLOAK_ADMIN_USER', None)
    admin_password = os.environ.get('KEYCLOAK_ADMIN_PASSWORD') or getattr(settings, 'KEYCLOAK_ADMIN_PASSWORD', None)
    if not admin_user or not admin_password:
        return None
    
    server_url = settings.KEYCLOAK_SERVER_URL
    base_url = server_url.split('/realms/')[0] if '/realms/' in server_url else server_url
    token_url = f"{base_url}/realms/master/protocol/openid-connect/token"
    payload = {
        'client_id': 'admin-cli',
        'username': admin_user,
        'password': admin_password,
        'grant_type': 'password'
    }
    try:
        response = requests.post(token_url, data=payload, timeout=5)
        if response.status_code == 200:
            return response.json().get('access_token')
    except Exception as e:
        print(f"Error fetching Keycloak admin token: {e}")
    return None

def create_keycloak_user(username, email, full_name, password):
    import requests
    from django.conf import settings
    token = get_keycloak_admin_token()
    if not token:
        return False, "Thiếu hoặc sai cấu hình quản trị Keycloak."
        
    server_url = settings.KEYCLOAK_SERVER_URL
    base_url = server_url.split('/realms/')[0] if '/realms/' in server_url else server_url
    realm = server_url.split('/realms/')[-1] if '/realms/' in server_url else 'kms_realm'
    
    create_url = f"{base_url}/admin/realms/{realm}/users"
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    names = full_name.split(' ')
    first_name = names[-1] if names else ''
    last_name = ' '.join(names[:-1]) if len(names) > 1 else ''
    
    user_payload = {
        'username': username,
        'email': email,
        'firstName': first_name,
        'lastName': last_name,
        'enabled': True,
        'credentials': [{
            'type': 'password',
            'value': password,
            'temporary': False
        }]
    }
    
    try:
        res = requests.post(create_url, json=user_payload, headers=headers, timeout=5)
        if res.status_code == 201:
            return True, "Tạo tài khoản Keycloak thành công."
        else:
            return False, f"Keycloak response: {res.text}"
    except Exception as e:
        return False, str(e)

def send_keycloak_reset_email(username):
    import requests
    from django.conf import settings
    token = get_keycloak_admin_token()
    if not token:
        return False, "Thiếu hoặc sai cấu hình quản trị Keycloak."
        
    server_url = settings.KEYCLOAK_SERVER_URL
    base_url = server_url.split('/realms/')[0] if '/realms/' in server_url else server_url
    realm = server_url.split('/realms/')[-1] if '/realms/' in server_url else 'kms_realm'
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    search_url = f"{base_url}/admin/realms/{realm}/users"
    try:
        res = requests.get(f"{search_url}?username={username}", headers=headers, timeout=5)
        users = res.json() if res.status_code == 200 else []
        if not users:
            return False, "Không tìm thấy người dùng trên Keycloak."
            
        user_id = users[0]['id']
        execute_url = f"{base_url}/admin/realms/{realm}/users/{user_id}/execute-actions-email"
        res = requests.put(execute_url, json=["UPDATE_PASSWORD"], headers=headers, timeout=5)
        if res.status_code == 204:
            return True, "Đã gửi email khôi phục mật khẩu từ Keycloak."
        else:
            return False, f"Keycloak response: {res.text}"
    except Exception as e:
        return False, str(e)

def update_keycloak_password(username, new_password):
    import requests
    from django.conf import settings
    token = get_keycloak_admin_token()
    if not token:
        return False, "Thiếu hoặc sai cấu hình quản trị Keycloak."
        
    server_url = settings.KEYCLOAK_SERVER_URL
    base_url = server_url.split('/realms/')[0] if '/realms/' in server_url else server_url
    realm = server_url.split('/realms/')[-1] if '/realms/' in server_url else 'kms_realm'
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    search_url = f"{base_url}/admin/realms/{realm}/users"
    try:
        res = requests.get(f"{search_url}?username={username}", headers=headers, timeout=5)
        users = res.json() if res.status_code == 200 else []
        if not users:
            return False, "Không tìm thấy người dùng trên Keycloak."
            
        user_id = users[0]['id']
        reset_pwd_url = f"{base_url}/admin/realms/{realm}/users/{user_id}/reset-password"
        payload = {
            'type': 'password',
            'value': new_password,
            'temporary': False
        }
        res = requests.put(reset_pwd_url, json=payload, headers=headers, timeout=5)
        if res.status_code == 204:
            return True, "Cập nhật mật khẩu Keycloak thành công."
        else:
            return False, f"Keycloak response: {res.text}"
    except Exception as e:
        return False, str(e)

def delete_keycloak_user(username):
    import requests
    from django.conf import settings
    token = get_keycloak_admin_token()
    if not token:
        return False, "Thiếu hoặc sai cấu hình quản trị Keycloak."
        
    server_url = settings.KEYCLOAK_SERVER_URL
    base_url = server_url.split('/realms/')[0] if '/realms/' in server_url else server_url
    realm = server_url.split('/realms/')[-1] if '/realms/' in server_url else 'kms_realm'
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    search_url = f"{base_url}/admin/realms/{realm}/users"
    try:
        res = requests.get(f"{search_url}?username={username}", headers=headers, timeout=5)
        users = res.json() if res.status_code == 200 else []
        exact_user = next((u for u in users if u['username'].lower() == username.lower()), None)
        if not exact_user:
            return False, "Không tìm thấy người dùng trên Keycloak."
            
        user_id = exact_user['id']
        delete_url = f"{base_url}/admin/realms/{realm}/users/{user_id}"
        res = requests.delete(delete_url, headers=headers, timeout=5)
        if res.status_code == 204:
            return True, "Xóa tài khoản Keycloak thành công."
        else:
            return False, f"Keycloak response: {res.text}"
    except Exception as e:
        return False, str(e)

def update_keycloak_user_details(old_username, new_username=None, email=None, full_name=None, is_active=None):
    import requests
    from django.conf import settings
    token = get_keycloak_admin_token()
    if not token:
        return False, "Thiếu hoặc sai cấu hình quản trị Keycloak."
        
    server_url = settings.KEYCLOAK_SERVER_URL
    base_url = server_url.split('/realms/')[0] if '/realms/' in server_url else server_url
    realm = server_url.split('/realms/')[-1] if '/realms/' in server_url else 'kms_realm'
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    search_url = f"{base_url}/admin/realms/{realm}/users"
    try:
        res = requests.get(f"{search_url}?username={old_username}", headers=headers, timeout=5)
        users = res.json() if res.status_code == 200 else []
        exact_user = next((u for u in users if u['username'].lower() == old_username.lower()), None)
        if not exact_user:
            return False, "Không tìm thấy người dùng trên Keycloak."
            
        user_id = exact_user['id']
        update_url = f"{base_url}/admin/realms/{realm}/users/{user_id}"
        
        payload = {}
        if new_username:
            payload['username'] = new_username
        if email:
            payload['email'] = email
        if full_name:
            names = full_name.split(' ')
            first_name = names[-1] if names else ''
            last_name = ' '.join(names[:-1]) if len(names) > 1 else ''
            payload['firstName'] = first_name
            payload['lastName'] = last_name
        if is_active is not None:
            payload['enabled'] = bool(is_active)
            
        res = requests.put(update_url, json=payload, headers=headers, timeout=5)
        if res.status_code == 204:
            return True, "Cập nhật tài khoản Keycloak thành công."
        else:
            return False, f"Keycloak response: {res.text}"
    except Exception as e:
        return False, str(e)

def sync_keycloak_to_local_db():
    import requests
    from django.conf import settings
    if not getattr(settings, 'USE_KEYCLOAK', False):
        return False, "Chưa bật Keycloak."
    token = get_keycloak_admin_token()
    if not token:
        return False, "Thiếu hoặc sai cấu hình quản trị Keycloak."
        
    server_url = settings.KEYCLOAK_SERVER_URL
    base_url = server_url.split('/realms/')[0] if '/realms/' in server_url else server_url
    realm = server_url.split('/realms/')[-1] if '/realms/' in server_url else 'kms_realm'
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    users_url = f"{base_url}/admin/realms/{realm}/users"
    try:
        res = requests.get(f"{users_url}?max=1000", headers=headers, timeout=5)
        if res.status_code != 200:
            return False, f"Lỗi lấy danh sách từ Keycloak: {res.text}"
            
        keycloak_users = res.json()
        keycloak_usernames = set()
        
        for ku in keycloak_users:
            username = ku.get('username')
            if not username:
                continue
            if username.lower() == 'admin':
                continue
                
            keycloak_usernames.add(username.lower())
            email = ku.get('email', '')
            enabled = ku.get('enabled', True)
            first_name = ku.get('firstName', '')
            last_name = ku.get('lastName', '')
            full_name = f"{last_name} {first_name}".strip() if (first_name or last_name) else username
            
            local_user = User.objects.filter(username__iexact=username).first()
            if local_user:
                changed = False
                if local_user.email != email:
                    local_user.email = email
                    changed = True
                if local_user.full_name != full_name:
                    local_user.full_name = full_name
                    changed = True
                if local_user.is_active != enabled:
                    local_user.is_active = enabled
                    changed = True
                if changed:
                    local_user.save()
            else:
                from django.utils.crypto import get_random_string
                User.objects.create_user(
                    username=username,
                    email=email,
                    full_name=full_name,
                    password=get_random_string(32),
                    role='USER',
                    is_active=enabled
                )
                
        # Optional: delete local users that are no longer in Keycloak
        local_users = User.objects.exclude(username__iexact='admin')
        for lu in local_users:
            if lu.username.lower() not in keycloak_usernames:
                lu.delete()
                
        return True, "Đồng bộ Keycloak sang CSDL thành công."
    except Exception as e:
        return False, str(e)

class RegisterAPIView(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        email = request.data.get('email', '')
        full_name = request.data.get('full_name', '')
        
        if not username or not password:
            return Response({'error': 'Vui lòng cung cấp username và password.'}, status=status.HTTP_400_BAD_REQUEST)
        
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username đã tồn tại.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if email and User.objects.filter(email=email).exists():
            return Response({'error': 'Email đã tồn tại.'}, status=status.HTTP_400_BAD_REQUEST)
            
        from django.conf import settings
        keycloak_msg = "Chế độ Local/Mock (Không tích hợp Keycloak)."
        if getattr(settings, 'USE_KEYCLOAK', False):
            import os
            admin_user = os.environ.get('KEYCLOAK_ADMIN_USER') or getattr(settings, 'KEYCLOAK_ADMIN_USER', None)
            if admin_user:
                success, msg = create_keycloak_user(username, email, full_name, password)
                if not success:
                    return Response({'error': f"Lỗi tạo tài khoản trên Keycloak: {msg}"}, status=status.HTTP_400_BAD_REQUEST)
                keycloak_msg = "Đã tạo tài khoản đồng bộ trên Keycloak."
            else:
                keycloak_msg = "Tạo tài khoản cục bộ (Keycloak Admin chưa được cấu hình)."
        
        user = User.objects.create_user(username=username, password=password, email=email, full_name=full_name, role='USER')
        serializer = UserSerializer(user)
        return Response({
            'message': 'Đăng ký thành công!',
            'keycloak': keycloak_msg,
            'user': serializer.data
        }, status=status.HTTP_201_CREATED)

class FindAccountAPIView(APIView):
    def post(self, request):
        identity = request.data.get('identity')
        if not identity:
            return Response({'error': 'Vui lòng cung cấp username, email hoặc số điện thoại.'}, status=status.HTTP_400_BAD_REQUEST)
            
        user = User.objects.filter(Q(username__iexact=identity) | Q(email__iexact=identity) | Q(phone_number=identity)).first()
        if not user:
            return Response({'error': 'Không tìm thấy tài khoản tương ứng trên hệ thống.'}, status=status.HTTP_404_NOT_FOUND)
            
        masked_email = ""
        if user.email:
            parts = user.email.split('@')
            if len(parts) == 2:
                name, domain = parts
                masked_name = name[0] + '*' * (len(name) - 1) if len(name) > 1 else name + '*'
                masked_email = f"{masked_name}@{domain}"
                
        masked_phone = ""
        if user.phone_number:
            phone = user.phone_number
            if len(phone) > 4:
                masked_phone = phone[:3] + '*' * (len(phone) - 6) + phone[-3:]
            else:
                masked_phone = '*' * len(phone)

        return Response({
            'username': user.username,
            'full_name': user.full_name,
            'email_masked': masked_email,
            'phone_masked': masked_phone,
            'role': user.role,
            'is_active': user.is_active
        }, status=status.HTTP_200_OK)

class ForgotPasswordAPIView(APIView):
    def post(self, request):
        identity = request.data.get('identity')
        if not identity:
            return Response({'error': 'Vui lòng cung cấp username, email hoặc số điện thoại.'}, status=status.HTTP_400_BAD_REQUEST)
            
        user = User.objects.filter(Q(username__iexact=identity) | Q(email__iexact=identity) | Q(phone_number=identity)).first()
        if not user:
            return Response({'error': 'Không tìm thấy tài khoản tương ứng trên hệ thống.'}, status=status.HTTP_404_NOT_FOUND)
            
        from django.conf import settings
        from django.utils import timezone
        import random
        import string
        from django.core.mail import send_mail
        import os
        
        # Generate 6-digit numeric OTP code
        otp_code = ''.join(random.choices(string.digits, k=6))
        
        # Update user OTP locally
        user.otp_code = otp_code
        user.otp_created_at = timezone.now()
        user.save(update_fields=['otp_code', 'otp_created_at'])
        
        # Simulated send mail or SMS
        email_sent = False
        email_error = ""
        subject = "[KMS System] Mã OTP khôi phục mật khẩu tài khoản"
        message = (
            f"Xin chào {user.full_name or user.username},\n\n"
            f"Chúng tôi nhận được yêu cầu khôi phục mật khẩu cho tài khoản của bạn.\n"
            f"Mã OTP xác thực của bạn là: {otp_code}\n\n"
            f"LƯU Ý: Mã OTP có hiệu lực tối đa trong vòng 5 phút. Vui lòng nhập mã này trên giao diện web để thiết lập mật khẩu mới.\n\n"
            f"Trân trọng,\nKMS Administration"
        )
        
        # 1. Send Email if user has email
        if user.email:
            try:
                send_mail(
                    subject,
                    message,
                    settings.DEFAULT_FROM_EMAIL or 'noreply@kms.edu.vn',
                    [user.email],
                    fail_silently=False,
                )
                email_sent = True
            except Exception as e:
                email_error = f" (Không thể gửi email thực tế: {str(e)})"

        # 2. Send SMS if user has phone number
        sms_sent = False
        if user.phone_number:
            try:
                # Ghi nhan ra Console Server (hoac tich hop gateway SMS o moi truong production)
                print(f"\n=======================================================")
                print(f"[SMS GATEWAY SIMULATOR] Gui toi SDT: {user.phone_number}")
                print(f"Noi dung: KMS System - Ma OTP khoi phuc mat khau cua ban la: {otp_code}. Co hieu luc trong 5 phut.")
                print(f"=======================================================\n")
                sms_sent = True
            except Exception as e:
                print(f"Loi gui SMS simulator: {e}")

        details_msg = "Mã OTP khôi phục mật khẩu đã được tạo. "
        if email_sent and sms_sent:
            details_msg += f"Hệ thống đã gửi mã OTP qua Email ({user.email}) và SMS tới số điện thoại ({user.phone_number})."
        elif email_sent:
            details_msg += f"Hệ thống đã gửi mã OTP qua Email ({user.email})."
        elif sms_sent:
            details_msg += f"Hệ thống đã gửi mã OTP qua SMS tới số điện thoại ({user.phone_number})."
        else:
            details_msg += "Hệ thống đã cấp phát mã OTP mới. Vui lòng liên hệ quản trị viên."
            
        details_msg += " Mã OTP này chỉ có hiệu lực trong vòng 5 phút." + email_error
                
        return Response({
            'message': 'Đã gửi mã OTP thành công!',
            'details': details_msg,
            'simulation': {
                'username': user.username,
                'email': user.email,
                'phone': user.phone_number,
                'otp_code': otp_code,
                'expires_at': (user.otp_created_at + timezone.timedelta(minutes=5)).isoformat(),
                'email_sent': email_sent,
                'sms_sent': sms_sent
            }
        }, status=status.HTTP_200_OK)

class VerifyOTPResetAPIView(APIView):
    def post(self, request):
        identity = request.data.get('identity')
        otp_code = request.data.get('otp_code')
        new_password = request.data.get('new_password')
        
        if not identity or not otp_code or not new_password:
            return Response({'error': 'Vui lòng cung cấp đầy đủ thông tin xác thực, mã OTP và mật khẩu mới.'}, status=status.HTTP_400_BAD_REQUEST)
            
        user = User.objects.filter(Q(username__iexact=identity) | Q(email__iexact=identity) | Q(phone_number=identity)).first()
        if not user:
            return Response({'error': 'Không tìm thấy tài khoản tương ứng.'}, status=status.HTTP_404_NOT_FOUND)
            
        from django.utils import timezone
        from datetime import timedelta
        
        # Check if OTP matches and is not expired (5 minutes)
        if not user.otp_code or user.otp_code != otp_code:
            return Response({'error': 'Mã OTP không chính xác.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if timezone.now() > user.otp_created_at + timedelta(minutes=5):
            return Response({'error': 'Mã OTP đã hết hạn hiệu lực (tối đa 5 phút). Vui lòng yêu cầu mã mới.'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Update user password locally
        user.set_password(new_password)
        user.otp_code = None
        user.otp_created_at = None
        user.password_reset_temp = False
        user.password_reset_at = None
        user.is_active = True  # Kích hoạt lại tài khoản nếu bị khóa trước đó
        user.save()
        
        keycloak_msg = ""
        # Sync to Keycloak if active
        from django.conf import settings
        import os
        if getattr(settings, 'USE_KEYCLOAK', False):
            admin_user = os.environ.get('KEYCLOAK_ADMIN_USER') or getattr(settings, 'KEYCLOAK_ADMIN_USER', None)
            if admin_user:
                success, msg = update_keycloak_password(user.username, new_password)
                if success:
                    keycloak_msg = "Đồng bộ mật khẩu mới lên Keycloak thành công."
                else:
                    keycloak_msg = f"Lỗi đồng bộ Keycloak: {msg}"
            else:
                keycloak_msg = "Chưa cấu hình Keycloak Admin (Đã đổi mật khẩu cục bộ)."
                    
        return Response({
            'message': 'Đặt lại mật khẩu thành công!',
            'details': 'Mật khẩu của bạn đã được cập nhật thành công. Vui lòng đăng nhập bằng mật khẩu mới.',
            'keycloak_sync': keycloak_msg
        }, status=status.HTTP_200_OK)



class LoginAPIView(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        
        # Check if the user is disabled because of expired password reset
        from django.utils import timezone
        from datetime import timedelta
        
        user_obj = User.objects.filter(username=username).first()
        if user_obj and user_obj.password_reset_temp and user_obj.password_reset_at:
            if timezone.now() > user_obj.password_reset_at + timedelta(hours=24):
                if user_obj.is_active:
                    user_obj.is_active = False
                    user_obj.save(update_fields=['is_active'])
                return Response({
                    'error': 'Tài khoản của bạn đã bị vô hiệu hóa do không đổi mật khẩu tạm thời trong vòng 24 giờ. Vui lòng gửi yêu cầu đặt lại mật khẩu mới để kích hoạt lại tài khoản.'
                }, status=status.HTTP_403_FORBIDDEN)
                
        if user_obj and not user_obj.is_active and user_obj.password_reset_temp:
            return Response({
                'error': 'Tài khoản đã bị khóa do hết hạn đổi mật khẩu tạm thời. Vui lòng gửi lại yêu cầu Đặt lại mật khẩu để kích hoạt lại.'
            }, status=status.HTTP_403_FORBIDDEN)
            
        # 1. Keycloak Direct Authentication (ROPC password grant) if active
        from django.conf import settings
        import requests
        import jwt
        
        keycloak_login_success = False
        keycloak_user = None
        access_token = None
        
        if getattr(settings, 'USE_KEYCLOAK', False):
            try:
                token_url = f"{settings.KEYCLOAK_SERVER_URL}/protocol/openid-connect/token"
                payload = {
                    'grant_type': 'password',
                    'client_id': settings.KEYCLOAK_CLIENT_ID,
                    'username': username,
                    'password': password
                }
                token_res = requests.post(token_url, data=payload, timeout=5)
                if token_res.status_code == 200:
                    token_data = token_res.json()
                    access_token = token_data.get('access_token')
                    
                    # Validate and decode access token
                    jwks_url = f"{settings.KEYCLOAK_SERVER_URL}/protocol/openid-connect/certs"
                    jwks = requests.get(jwks_url, timeout=5).json()
                    
                    unverified_header = jwt.get_unverified_header(access_token)
                    kid = unverified_header.get('kid')
                    
                    public_key = None
                    for key in jwks['keys']:
                        if key['kid'] == kid:
                            public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
                            break
                            
                    if public_key:
                        jwt_payload = jwt.decode(
                            access_token,
                            public_key,
                            algorithms=['RS256'],
                            options={"verify_signature": True, "verify_aud": False}
                        )
                        
                        # Sync user
                        username_kc = jwt_payload.get('preferred_username') or jwt_payload.get('sub')
                        email_kc = jwt_payload.get('email', '')
                        full_name_kc = jwt_payload.get('name', '')
                        
                        roles_kc = []
                        resource_access = jwt_payload.get('resource_access', {})
                        client_access = resource_access.get(settings.KEYCLOAK_CLIENT_ID, {})
                        roles_kc = client_access.get('roles', [])
                        
                        resolved_role = 'USER'
                        if 'admin' in roles_kc or 'KMS_ADMIN' in roles_kc:
                            resolved_role = 'ADMIN'
                        elif 'teacher' in roles_kc or 'KMS_TEACHER' in roles_kc:
                            resolved_role = 'TEACHER'
                            
                        # Get or create locally
                        user, created = User.objects.get_or_create(
                            username=username_kc,
                            defaults={
                                'email': email_kc,
                                'full_name': full_name_kc,
                                'role': resolved_role,
                                'is_active': True
                            }
                        )
                        if not created:
                            user.role = resolved_role
                            user.full_name = full_name_kc
                            user.save(update_fields=['role', 'full_name'])
                            
                        keycloak_user = user
                        keycloak_login_success = True
            except Exception as e:
                print(f"Keycloak ROPC direct auth failed, falling back to local Django auth: {e}")
                
        # 2. Local fallback if Keycloak auth didn't succeed
        if keycloak_login_success and keycloak_user:
            serializer = UserSerializer(keycloak_user)
            data = serializer.data
            data['role'] = keycloak_user.role
            # Ensure is_active status
            if not keycloak_user.is_active:
                return Response({'error': 'Tài khoản đã bị vô hiệu hóa.'}, status=status.HTTP_403_FORBIDDEN)
            # Sync temporary pass flags if any (Keycloak direct user resets password via web)
            if keycloak_user.password_reset_temp:
                data['must_change_password'] = True
            return Response({
                'message': 'Đăng nhập Keycloak trực tiếp thành công!',
                'user': data,
                'token': access_token
            }, status=status.HTTP_200_OK)
            
        # Standard local auth
        user = authenticate(username=username, password=password)
        if user is not None:
            serializer = UserSerializer(user)
            data = serializer.data
            data['role'] = user.role
            if user.password_reset_temp:
                data['must_change_password'] = True
            
            # Generate mock JWT token for local authentication to unify auth headers
            import jwt
            mock_payload = {
                "sub": user.username,
                "preferred_username": user.username,
                "email": user.email,
                "name": user.full_name,
                "iss": "http://localhost:8080/realms/kms_realm",
                "aud": "kms-web-client",
                "resource_access": {
                    "kms-web-client": {
                        "roles": [f"KMS_{user.role}", user.role.lower()]
                    }
                }
            }
            jwt_token = jwt.encode(mock_payload, 'mock-secret-key-1234', algorithm='HS256')
            
            return Response({'message': 'Đăng nhập thành công!', 'user': data, 'token': jwt_token}, status=status.HTTP_200_OK)
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

        # Sync from Keycloak first
        from django.conf import settings
        if getattr(settings, 'USE_KEYCLOAK', False):
            sync_keycloak_to_local_db()

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

        # Create on Keycloak if enabled
        from django.conf import settings
        if getattr(settings, 'USE_KEYCLOAK', False):
            success, msg = create_keycloak_user(username, '', full_name, password)
            if not success:
                return Response({'error': f"Lỗi tạo tài khoản trên Keycloak: {msg}"}, status=400)

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

        original_username = user.username
        if username and username.lower() != user.username.lower():
            if User.objects.filter(username__iexact=username).exists():
                return Response({'error': 'Tên tài khoản này đã tồn tại.'}, status=400)
            from django.conf import settings
            if getattr(settings, 'USE_KEYCLOAK', False):
                success, msg = update_keycloak_user_details(
                    old_username=original_username,
                    new_username=username,
                    email=None,
                    full_name=full_name,
                    is_active=is_active
                )
                if not success:
                    return Response({'error': f"Lỗi cập nhật tài khoản trên Keycloak: {msg}"}, status=400)
            user.username = username
        else:
            from django.conf import settings
            if getattr(settings, 'USE_KEYCLOAK', False):
                if full_name is not None or is_active is not None:
                    success, msg = update_keycloak_user_details(
                        old_username=original_username,
                        new_username=None,
                        email=None,
                        full_name=full_name,
                        is_active=is_active
                    )
                    if not success:
                        return Response({'error': f"Lỗi cập nhật tài khoản trên Keycloak: {msg}"}, status=400)

        if password:
            from django.conf import settings
            if getattr(settings, 'USE_KEYCLOAK', False):
                success, msg = update_keycloak_password(username or original_username, password)
                if not success:
                    return Response({'error': f"Lỗi cập nhật mật khẩu trên Keycloak: {msg}"}, status=400)
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

        # Delete on Keycloak if enabled
        from django.conf import settings
        if getattr(settings, 'USE_KEYCLOAK', False):
            delete_keycloak_user(user.username)

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
                'published': True,
                'lesson': LessonPlanSerializer(lesson, context={'request': request}).data
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
                'published': False,
                'lesson': LessonPlanSerializer(lesson, context={'request': request}).data
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
        email = request.data.get('email')
        phone_number = request.data.get('phone_number')

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
            user.password_reset_temp = False
            user.password_reset_at = None
            
            # Sync to Keycloak if active
            from django.conf import settings
            if getattr(settings, 'USE_KEYCLOAK', False):
                import os
                admin_user = os.environ.get('KEYCLOAK_ADMIN_USER') or getattr(settings, 'KEYCLOAK_ADMIN_USER', None)
                if admin_user:
                    success, msg = update_keycloak_password(user.username, new_password)
                    if not success:
                        return Response({'error': f"Đổi mật khẩu trên Keycloak thất bại: {msg}"}, status=status.HTTP_400_BAD_REQUEST)

        if email is not None:
            # Check unique email
            if User.objects.filter(email=email).exclude(id=user_id).exists():
                return Response({'error': 'Email này đã được sử dụng bởi tài khoản khác.'}, status=status.HTTP_400_BAD_REQUEST)
            from django.conf import settings
            if getattr(settings, 'USE_KEYCLOAK', False):
                update_keycloak_user_details(old_username=user.username, email=email)
            user.email = email

        if phone_number is not None:
            user.phone_number = phone_number

        if full_name is not None:
            from django.conf import settings
            if getattr(settings, 'USE_KEYCLOAK', False):
                update_keycloak_user_details(old_username=user.username, full_name=full_name)
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
            return Response({
                'message': 'Đã thu hồi bài giảng về thư viện cá nhân!',
                'lesson': LessonPlanSerializer(lesson, context={'request': request}).data
            }, status=status.HTTP_200_OK)

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
    API View để xem thông tin chi tiết một phiên chat (GET), cập nhật tiêu đề (PATCH) hoặc xóa phiên chat (DELETE).
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

    def patch(self, request, pk):
        """Cập nhật tiêu đề phiên hội thoại (dùng để tự động đặt tên từ câu hỏi đầu tiên)."""
        from .models import AIChatSession
        from .serializers import AIChatSessionSerializer
        try:
            session = AIChatSession.objects.get(id=pk)
            title = request.data.get('title')
            if title:
                session.title = title[:100]
                session.save(update_fields=['title'])
            serializer = AIChatSessionSerializer(session)
            return Response(serializer.data)
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


class AIChatSessionAutoNameAPIView(APIView):
    """
    API View để tự động đặt tên cho cuộc hội thoại bằng AI dựa trên toàn bộ nội dung trò chuyện hiện có.
    """
    def post(self, request, pk):
        from .models import AIChatSession, AIChatMessage
        from .serializers import AIChatSessionSerializer
        try:
            session = AIChatSession.objects.get(id=pk)
            # Lấy tất cả tin nhắn của người dùng để hiểu ngữ cảnh
            user_messages = AIChatMessage.objects.filter(session=session, sender_role='USER').order_by('created_at')
            if not user_messages.exists():
                return Response({'error': 'Không có tin nhắn nào từ người dùng để đặt tên.'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Kết hợp các tin nhắn đầu tiên của người dùng
            context_text = "\n".join([m.content for m in user_messages[:3]])
            
            title_prompt = (
                f"Hãy đặt một tiêu đề cực kỳ ngắn gọn và súc tích (tối đa 5 từ, không để trong ngoặc kép, không thêm bất kỳ từ giải thích nào khác) "
                f"khái quát chủ đề của cuộc hội thoại sau:\n"
                f"\"{context_text}\""
            )
            
            model_choice = request.data.get('model_choice', '3b')
            api_key = request.data.get('api_key')
            model_name = request.data.get('model_name')
            
            from .llm_runner import generate_llm_response
            try:
                generated_title = generate_llm_response(
                    prompt=title_prompt,
                    system_prompt="Bạn là trợ lý đặt tên tiêu đề ngắn gọn cho cuộc hội thoại bằng tiếng Việt.",
                    model_choice=model_choice,
                    api_key=api_key,
                    model_name=model_name
                )
                generated_title = generated_title.strip().strip('"').strip("'").strip('“').strip('”').strip('.').strip()
                if generated_title and len(generated_title) <= 60 and not generated_title.startswith("###"):
                    session.title = generated_title
                else:
                    first_msg = user_messages[0].content
                    session.title = first_msg[:47] + "..." if len(first_msg) > 50 else first_msg
            except Exception:
                first_msg = user_messages[0].content
                session.title = first_msg[:47] + "..." if len(first_msg) > 50 else first_msg
            
            session.save(update_fields=['title'])
            serializer = AIChatSessionSerializer(session)
            return Response(serializer.data)
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
                    
        # 1. Tự động đặt tên tiêu đề cho phiên chat dựa trên tin nhắn đầu tiên của người dùng (Chạy bất đồng bộ trong background thread để tránh treo stream)
        user_msg_count = AIChatMessage.objects.filter(session=session, sender_role='USER').count()
        if user_msg_count == 0 or session.title == "Cuộc trò chuyện mới":
            # Đặt tiêu đề tạm thời nhanh chóng bằng câu hỏi của người dùng
            temp_title = user_message_content[:47] + "..." if len(user_message_content) > 50 else user_message_content
            session.title = temp_title
            session.save(update_fields=['title'])
            
            import threading
            def run_background_title_generation(session_id, message_content, m_choice, a_key, m_name):
                try:
                    from .models import AIChatSession
                    from .llm_runner import generate_llm_response
                    title_prompt = (
                        f"Hãy đặt một tiêu đề cực kỳ ngắn gọn và súc tích (tối đa 5 từ, không để trong ngoặc kép, không thêm bất kỳ từ giải thích nào khác) "
                        f"khái quát chủ đề của câu hỏi sau:\n"
                        f"\"{message_content}\""
                    )
                    generated_title = generate_llm_response(
                        prompt=title_prompt,
                        system_prompt="Bạn là trợ lý đặt tên tiêu đề ngắn gọn cho cuộc hội thoại bằng tiếng Việt.",
                        model_choice=m_choice,
                        api_key=a_key,
                        model_name=m_name
                    )
                    generated_title = generated_title.strip().strip('"').strip("'").strip('“').strip('”').strip('.').strip()
                    if generated_title and len(generated_title) <= 60 and not generated_title.startswith("###"):
                        AIChatSession.objects.filter(id=session_id).update(title=generated_title)
                except Exception as e:
                    print(f"Background title generation error: {e}")

            threading.Thread(
                target=run_background_title_generation,
                args=(session.id, user_message_content, model_choice, api_key, model_name)
            ).start()

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
        
        # 4. Thực thi nạp và gọi LLM dưới dạng Stream thông qua LLM Runner
        from .llm_runner import generate_llm_response_stream
        from django.http import StreamingHttpResponse
        import json

        def event_stream():
            # Bước 1: Gửi siêu dữ liệu RAG (graph, câu hỏi gợi ý) cho Client
            meta_payload = {
                'type': 'meta',
                'retrieved_graph': rag_data['retrieved_graph'],
                'suggested_questions': rag_data['suggested_questions'],
                'session_title': session.title
            }
            yield f"data: {json.dumps(meta_payload, ensure_ascii=False)}\n\n"

            # Bước 2: Stream câu trả lời của AI
            ai_response_chunks = []
            for chunk in generate_llm_response_stream(
                prompt=prompt_with_context,
                system_prompt=system_prompt,
                model_choice=model_choice,
                api_key=api_key,
                model_name=model_name
            ):
                ai_response_chunks.append(chunk)
                text_payload = {
                    'type': 'text',
                    'content': chunk
                }
                yield f"data: {json.dumps(text_payload, ensure_ascii=False)}\n\n"

            # Bước 3: Lưu tin nhắn đầy đủ vào database và gửi tín hiệu Hoàn thành
            full_response = "".join(ai_response_chunks)
            ai_message = AIChatMessage.objects.create(
                session=session,
                sender_role='AI',
                content=full_response
            )

            from .serializers import AIChatMessageSerializer
            
            # Đọc lại session từ DB để lấy tiêu đề mới nhất được cập nhật từ background thread
            try:
                session.refresh_from_db(fields=['title'])
                latest_title = session.title
            except Exception:
                latest_title = session.title

            done_payload = {
                'type': 'done',
                'message': AIChatMessageSerializer(ai_message).data,
                'session_title': latest_title
            }
            yield f"data: {json.dumps(done_payload, ensure_ascii=False)}\n\n"

        return StreamingHttpResponse(event_stream(), content_type='text/event-stream')


class AIChatGraphDataAPIView(APIView):
    """
    API View trả về Đồ thị tri thức (Knowledge Graph Nodes & Edges) dạng JSON.
    Nếu truyền thêm lesson_id, API sẽ trả về đồ thị sơ đồ tư duy (Mindmap) riêng cho tài liệu đó.
    Nếu không truyền, trả về toàn bộ đồ thị hệ thống.
    """
    def get(self, request):
        user_id = request.query_params.get('user_id')
        lesson_id = request.query_params.get('lesson_id')
        hop_depth = request.query_params.get('hop_depth', '2')
        try:
            hop_depth = int(hop_depth)
        except ValueError:
            hop_depth = 2
        
        # Xử lý an toàn tham số để tránh chuỗi 'null', 'undefined' bị coi là ID hợp lệ
        if lesson_id in (None, '', 'null', 'undefined'):
            lesson_id = None
        else:
            try:
                lesson_id = int(lesson_id)
            except ValueError:
                lesson_id = None
                
        from .graph_rag_service import build_virtual_knowledge_graph
        graph_data = build_virtual_knowledge_graph(user_id=user_id, focus_lesson_id=lesson_id, hop_depth=hop_depth)
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
        from django.conf import settings
        if "use_ai_rag" not in config:
            config["use_ai_rag"] = getattr(settings, 'USE_AI_RAG', True)
        return Response(config, status=status.HTTP_200_OK)

    def post(self, request):
        if not request.user or not request.user.is_authenticated or request.user.role != 'ADMIN':
            return Response({"error": "Chỉ Quản trị viên (Admin) mới có quyền chỉnh sửa cấu hình hệ thống."}, status=status.HTTP_403_FORBIDDEN)
            
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
        ai_mode = request.data.get('ai_mode')
        local_model = request.data.get('local_model')
        api_key = request.data.get('api_key')
        api_model = request.data.get('api_model')

        model_config = {}
        if ai_mode:
            model_config['ai_mode'] = ai_mode
        if local_model:
            model_config['local_model'] = local_model
        if api_key:
            model_config['api_key'] = api_key
        if api_model:
            model_config['api_model'] = api_model

        from .models import LessonPlan, DocumentChunk
        from .bg_processor import BackgroundProcessManager
        import os, re

        def clear_lesson_plan_rag_data(lp):
            # 1. Xóa các database chunks phục vụ RAG
            lp.chunks.all().delete()
            
            # 2. Xóa các tag trong attributes để Graph lập tức cập nhật
            if isinstance(lp.attributes, dict):
                lp.attributes["Từ khóa kiến thức"] = []
                lp.attributes["knowledge_tags"] = []
            else:
                lp.attributes = {"Từ khóa kiến thức": [], "knowledge_tags": []}
            lp.save(update_fields=['attributes'])
            
            # 3. Xóa các note trong Obsidian Vault & dọn dẹp concept notes liên đới
            vault_dir = BackgroundProcessManager.get_vault_path()
            if os.path.exists(vault_dir):
                clean_filename = re.sub(r'[\/:*?"<>|\r\n\t]', '_', lp.title).strip()
                note_path = os.path.join(vault_dir, f"{clean_filename}.md")
                
                # Xóa note chính nếu tồn tại
                if os.path.exists(note_path):
                    try:
                        os.remove(note_path)
                        print(f"[Clear RAG] Deleted main lesson note: {note_path}")
                    except Exception as e:
                        print(f"[Clear RAG] Error deleting note: {e}")
                        
                # Quét toàn bộ thư mục vault để tìm và làm sạch các concept note chứa liên kết đến bài giảng này
                lesson_link_variants = [f"[[{lp.title}]]", f"[[{clean_filename}]]"]
                try:
                    for filename in os.listdir(vault_dir):
                        if not filename.lower().endswith('.md'):
                            continue
                        if filename == f"{clean_filename}.md":
                            continue
                            
                        file_path = os.path.join(vault_dir, filename)
                        if not os.path.exists(file_path):
                            continue
                            
                        try:
                            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                                content = f.read()
                            
                            # Nếu file concept note này chứa liên kết tới bài học
                            if any(variant in content for variant in lesson_link_variants):
                                # Lấy tất cả các liên kết trong note
                                links = re.findall(r'- \[\[(.*?)\]\]', content)
                                # Nếu chỉ liên kết tới bài học này (hoặc mồ côi), xóa hẳn note concept
                                if len(links) <= 1 and (len(links) == 0 or links[0] in [lp.title, clean_filename]):
                                    os.remove(file_path)
                                    print(f"[Clear RAG] Deleted orphan concept note: {file_path}")
                                else:
                                    # Ngược lại, chỉ loại bỏ dòng liên kết tới bài học này
                                    lines = content.splitlines()
                                    updated_lines = []
                                    for line in lines:
                                        if not any(variant in line for variant in lesson_link_variants):
                                            updated_lines.append(line)
                                    with open(file_path, 'w', encoding='utf-8') as f:
                                        f.write('\n'.join(updated_lines) + '\n')
                                    print(f"[Clear RAG] Removed link to {lp.title} from concept note: {filename}")
                        except Exception as e:
                            print(f"[Clear RAG] Error checking/cleaning concept file {filename}: {e}")
                except Exception as e:
                    print(f"[Clear RAG] Error scanning vault directory: {e}")

        if lesson_id:
            try:
                lp = LessonPlan.objects.get(id=lesson_id)
                # Kiểm tra quyền: Chỉ Admin hoặc người tạo bài giảng mới có quyền chạy lại
                if not request.user or not request.user.is_authenticated:
                    return Response({"error": "Bạn cần đăng nhập để thực hiện tác vụ này."}, status=status.HTTP_401_UNAUTHORIZED)
                if request.user.role != 'ADMIN' and lp.creator != request.user:
                    return Response({"error": "Bạn không có quyền yêu cầu chạy lại xử lý cho bài giảng này."}, status=status.HTTP_403_FORBIDDEN)
                    
                # Dọn dẹp sạch sẽ dữ liệu cũ trước khi đưa vào hàng chờ
                clear_lesson_plan_rag_data(lp)
                
                # Lưu cấu hình model của người dùng vào attributes
                if model_config:
                    if not isinstance(lp.attributes, dict):
                        lp.attributes = {}
                    lp.attributes['ai_model_config'] = model_config
                
                # Đưa trạng thái về PENDING
                lp.ai_processing_status = 'PENDING'
                lp.ai_processing_step = 'Đang xếp hàng chạy lại xử lý ngầm...'
                lp.save(update_fields=['ai_processing_status', 'ai_processing_step', 'attributes'])
                BackgroundProcessManager.queue_task(lp.id)
                return Response({"message": f"Đã clear sạch dữ liệu cũ và đưa bài học '{lp.title}' vào hàng chờ chạy lại thành công!"}, status=status.HTTP_200_OK)
            except LessonPlan.DoesNotExist:
                return Response({"error": "Không tìm thấy bài học tương ứng"}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Tái xử lý toàn bộ tài liệu trên hệ thống (Chỉ Admin được làm việc này)
            if not request.user or not request.user.is_authenticated or request.user.role != 'ADMIN':
                return Response({"error": "Chỉ Quản trị viên (Admin) mới có quyền tái xử lý toàn bộ hệ thống."}, status=status.HTTP_403_FORBIDDEN)
                
            # 1. Xóa toàn bộ database chunks phục vụ RAG
            DocumentChunk.objects.all().delete()
            
            # 2. Xóa sạch toàn bộ ghi chú markdown trong Obsidian Vault
            vault_dir = BackgroundProcessManager.get_vault_path()
            if os.path.exists(vault_dir):
                for filename in os.listdir(vault_dir):
                    if filename.lower().endswith('.md'):
                        file_path = os.path.join(vault_dir, filename)
                        try:
                            os.remove(file_path)
                        except Exception as e:
                            print(f"[Clear All RAG] Error deleting file {file_path}: {e}")
                print("[Clear All RAG] Cleared all markdown files in Obsidian Vault.")
                
            lps = LessonPlan.objects.all()
            count = lps.count()
            for lp in lps:
                # 3. Xóa các tag trong attributes để Graph lập tức cập nhật
                if isinstance(lp.attributes, dict):
                    lp.attributes["Từ khóa kiến thức"] = []
                    lp.attributes["knowledge_tags"] = []
                else:
                    lp.attributes = {"Từ khóa kiến thức": [], "knowledge_tags": []}
                
                # Lưu cấu hình model của người dùng vào attributes
                if model_config:
                    lp.attributes['ai_model_config'] = model_config
                
                lp.ai_processing_status = 'PENDING'
                lp.ai_processing_step = 'Đang xếp hàng chạy lại xử lý ngầm...'
                lp.save(update_fields=['ai_processing_status', 'ai_processing_step', 'attributes'])
                BackgroundProcessManager.queue_task(lp.id)
            return Response({"message": f"Đã clear sạch toàn bộ hệ thống và đưa toàn bộ {count} bài học vào hàng chờ chạy lại thành công!"}, status=status.HTTP_200_OK)


class BackgroundTasksStopAPIView(APIView):
    """
    API View cho phép dừng một bài học cụ thể đang chạy
    hoặc dừng tất cả (khi thoát web).
    """
    def post(self, request):
        lesson_id = request.data.get('lesson_id')
        stop_all = request.data.get('all') or request.query_params.get('all') == 'true'

        from .bg_processor import BackgroundProcessManager
        
        if stop_all:
            if not request.user or not request.user.is_authenticated or request.user.role != 'ADMIN':
                return Response({"error": "Chỉ Quản trị viên (Admin) mới có quyền dừng toàn bộ tiến trình hệ thống."}, status=status.HTTP_403_FORBIDDEN)
            BackgroundProcessManager.cancel_all_tasks()
            return Response({"message": "Đã dừng toàn bộ các tiến trình AI RAG ngầm thành công!"}, status=status.HTTP_200_OK)
            
        if lesson_id:
            try:
                from .models import LessonPlan
                lp = LessonPlan.objects.get(id=lesson_id)
                # Chỉ Admin hoặc người tạo bài giảng mới có quyền dừng
                if not request.user or not request.user.is_authenticated:
                    return Response({"error": "Bạn cần đăng nhập để thực hiện tác vụ này."}, status=status.HTTP_401_UNAUTHORIZED)
                if request.user.role != 'ADMIN' and lp.creator != request.user:
                    return Response({"error": "Bạn không có quyền dừng tiến trình của bài học này."}, status=status.HTTP_403_FORBIDDEN)
                    
                BackgroundProcessManager.cancel_task(int(lesson_id))
                return Response({"message": f"Đã gửi yêu cầu dừng xử lý bài học ID {lesson_id} thành công!"}, status=status.HTTP_200_OK)
            except LessonPlan.DoesNotExist:
                return Response({"error": "Không tìm thấy bài học tương ứng"}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                return Response({"error": f"Lỗi khi dừng: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        return Response({"error": "Vui lòng cung cấp lesson_id hoặc tham số all=true"}, status=status.HTTP_400_BAD_REQUEST)


class BackgroundTasksResumeAPIView(APIView):
    """
    API View cho phép tiếp tục chạy các bài giảng bị dừng hoặc bị lỗi, 
    bắt đầu tại điểm đã dừng mà không xóa dữ liệu các bài giảng đã COMPLETED.
    """
    def post(self, request):
        if not request.user or not request.user.is_authenticated or request.user.role != 'ADMIN':
            return Response({"error": "Chỉ Quản trị viên (Admin) mới có quyền tiếp tục các tiến trình chạy ngầm toàn hệ thống."}, status=status.HTTP_403_FORBIDDEN)
            
        ai_mode = request.data.get('ai_mode')
        local_model = request.data.get('local_model')
        api_key = request.data.get('api_key')
        api_model = request.data.get('api_model')

        model_config = {}
        if ai_mode:
            model_config['ai_mode'] = ai_mode
        if local_model:
            model_config['local_model'] = local_model
        if api_key:
            model_config['api_key'] = api_key
        if api_model:
            model_config['api_model'] = api_model

        from .models import LessonPlan
        from .bg_processor import BackgroundProcessManager

        # Tìm các bài chưa xử lý hoàn tất (không phải COMPLETED)
        unprocessed_lps = LessonPlan.objects.filter(~Q(ai_processing_status='COMPLETED'))
        count = unprocessed_lps.count()
        
        if count == 0:
            return Response({"message": "Không có bài học nào cần xử lý tiếp tục!"}, status=status.HTTP_200_OK)

        for lp in unprocessed_lps:
            # Lưu cấu hình model mới nếu người dùng thay đổi
            if model_config:
                if not isinstance(lp.attributes, dict):
                    lp.attributes = {}
                lp.attributes['ai_model_config'] = model_config
            
            lp.ai_processing_status = 'PENDING'
            lp.ai_processing_step = 'Đang xếp hàng tiếp tục xử lý...'
            lp.save(update_fields=['ai_processing_status', 'ai_processing_step', 'attributes'])
            BackgroundProcessManager.queue_task(lp.id)

        return Response({"message": f"Đã khôi phục và đưa {count} bài học chưa hoàn thành vào hàng chờ tiếp tục chạy!"}, status=status.HTTP_200_OK)


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


class ObsidianNotesByLessonAPIView(APIView):
    """
    API trả về danh sách các note Obsidian liên quan đến một bài giảng cụ thể:
    - Note chính của bài giảng (có tên trùng title)
    - Các concept note chứa [[{lesson_title}]]
    """
    def get(self, request):
        import os, re
        from .bg_processor import BackgroundProcessManager

        lesson_id = request.query_params.get('lesson_id')
        if not lesson_id:
            return Response({"error": "Vui lòng cung cấp lesson_id"}, status=400)

        try:
            lesson = LessonPlan.objects.get(id=lesson_id)
        except LessonPlan.DoesNotExist:
            return Response({"error": "Không tìm thấy bài giảng"}, status=404)

        vault_path = BackgroundProcessManager.get_vault_path()
        if not os.path.exists(vault_path):
            return Response({"error": "Không tìm thấy thư mục Vault"}, status=400)

        clean_title = re.sub(r'[\/:*?"<>|\r\n\t]', '_', lesson.title).strip()
        lesson_link_variants = [
            f"[[{lesson.title}]]",
            f"[[{clean_title}]]",
        ]

        notes = []
        for file in os.listdir(vault_path):
            if not file.lower().endswith('.md'):
                continue

            file_path = os.path.join(vault_path, file)
            title = file[:-3]  # strip .md

            # Điều kiện 1: Note chính của bài giảng (filename trùng title)
            if title == clean_title:
                notes.append({
                    "filename": file,
                    "title": title,
                    "type": "lesson",
                    "size": os.path.getsize(file_path)
                })
                continue

            # Điều kiện 2: Concept note chứa liên kết đến bài giảng này
            try:
                with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()

                if any(link in content for link in lesson_link_variants):
                    # Đọc type từ YAML front matter
                    note_type = "concept"
                    yaml_match = re.search(r'^---\n(.+?)\n---', content, re.DOTALL)
                    if yaml_match:
                        yaml_content = yaml_match.group(1)
                        type_match = re.search(r'type:\s*["\']?([^"\' \n]+)', yaml_content)
                        if type_match:
                            note_type = type_match.group(1).strip()

                    notes.append({
                        "filename": file,
                        "title": title,
                        "type": note_type,
                        "size": os.path.getsize(file_path)
                    })
            except Exception:
                continue

        # Sắp xếp: note chính lên đầu, concept notes theo tên
        notes.sort(key=lambda x: (0 if x['type'] == 'lesson' else 1, x['title'].lower()))
        return Response(notes, status=200)


def get_wikipedia_academic_definition(tag, subject, lesson_title):
    import requests
    import urllib.parse
    
    tag_clean = tag.strip()
    url = f"https://vi.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&titles={urllib.parse.quote(tag_clean)}"
    try:
        headers = {'User-Agent': 'KMS-App/1.0 (contact@example.com)'}
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            data = res.json()
            pages = data.get('query', {}).get('pages', {})
            for page_id, page_data in pages.items():
                if page_id != "-1":
                    extract = page_data.get('extract', '').strip()
                    if extract:
                        sentences = [s.strip() for s in extract.split('.') if s.strip()]
                        brief = ". ".join(sentences[:3])
                        if not brief.endswith('.'):
                            brief += '.'
                        return brief
    except Exception as e:
        print(f"[Wikipedia Fallback] Failed for '{tag}': {e}")
        
    return (
        f"Trong khoa học và giảng dạy học thuật, \"{tag_clean}\" đại diện cho một khái niệm, thực thể hoặc cơ chế "
        f"được nghiên cứu chi tiết nhằm giải thích các hiện tượng liên quan trong phân môn \"{subject}\". "
        f"Kiến thức này đóng vai trò cơ sở lý thuyết giúp định hình nhận thức khoa học của học sinh, "
        f"tạo tiền đề giải quyết các câu hỏi thực tiễn được đặt ra trong bài giảng \"{lesson_title}\"."
    )


def check_note_edit_permission(user, filename):
    if user.role == 'ADMIN':
        return True

    import re, os
    from .bg_processor import BackgroundProcessManager
    
    vault_path = BackgroundProcessManager.get_vault_path()
    file_path = os.path.join(vault_path, filename)
    if not os.path.exists(file_path):
        return False
        
    title = filename[:-3] if filename.lower().endswith('.md') else filename
    
    managed_dir_ids = get_user_managed_directories(user)
    user_allowed_lessons = LessonPlan.objects.filter(
        Q(creator=user) | Q(directories__id__in=managed_dir_ids)
    ).distinct()
    
    # Check matching title
    for lesson in user_allowed_lessons:
        clean_title = re.sub(r'[\/:*?"<>|\r\n\t]', '_', lesson.title).strip()
        if clean_title == title:
            return True
            
    # Check if lesson references are in the file content
    try:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
    except Exception:
        content = ""
        
    for lesson in user_allowed_lessons:
        clean_title = re.sub(r'[\/:*?"<>|\r\n\t]', '_', lesson.title).strip()
        if f"[[{lesson.title}]]" in content or f"[[{clean_title}]]" in content:
            return True
            
    return False


class ObsidianNoteSaveAPIView(APIView):
    """
    API lưu nội dung chỉnh sửa thủ công của WikiNote và ghi nhận lịch sử.
    """
    def post(self, request):
        import os
        from .bg_processor import BackgroundProcessManager
        from .models import WikiNoteEditHistory
        
        filename = request.data.get('filename')
        content = request.data.get('content')
        user_id = request.data.get('user_id')
        
        if not filename or content is None or not user_id:
            return Response({"error": "Thiếu các tham số bắt buộc (filename, content, user_id)"}, status=400)
            
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "Không tìm thấy người dùng"}, status=400)
            
        if not check_note_edit_permission(user, filename):
            return Response({"error": "Bạn không có quyền chỉnh sửa ghi chú này"}, status=403)
            
        vault_path = BackgroundProcessManager.get_vault_path()
        file_path = os.path.join(vault_path, filename)
        
        if not os.path.exists(file_path):
            return Response({"error": "Ghi chú không tồn tại"}, status=404)
            
        try:
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                content_before = f.read()
                
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
                
            # Ghi lại lịch sử
            WikiNoteEditHistory.objects.create(
                filename=filename,
                edited_by=user,
                content_before=content_before,
                content_after=content,
                change_type='MANUAL'
            )
            return Response({"success": True, "message": "Đã lưu ghi chú thành công!"}, status=200)
        except Exception as e:
            return Response({"error": f"Lỗi lưu ghi chú: {str(e)}"}, status=500)


class ObsidianNoteRegenerateAPIView(APIView):
    """
    API gọi AI sinh lại định nghĩa cho ghi chú khái niệm và ghi nhận lịch sử.
    """
    def post(self, request):
        import os, re
        from .bg_processor import BackgroundProcessManager
        from .llm_runner import generate_llm_response
        from .models import WikiNoteEditHistory
        
        filename = request.data.get('filename')
        user_id = request.data.get('user_id')
        
        # AI Configs
        ai_mode = request.data.get('ai_mode', 'local')
        local_model = request.data.get('local_model', '3b')
        api_key = request.data.get('api_key', None)
        api_model = request.data.get('api_model', None)
        
        if not filename or not user_id:
            return Response({"error": "Thiếu các tham số bắt buộc (filename, user_id)"}, status=400)
            
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "Không tìm thấy người dùng"}, status=400)
            
        if not check_note_edit_permission(user, filename):
            return Response({"error": "Bạn không có quyền chỉnh sửa ghi chú này"}, status=403)
            
        vault_path = BackgroundProcessManager.get_vault_path()
        file_path = os.path.join(vault_path, filename)
        
        if not os.path.exists(file_path):
            return Response({"error": "Ghi chú không tồn tại"}, status=404)
            
        try:
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                content_before = f.read()
                
            # Trích xuất khái niệm từ filename
            tag = filename[:-3] if filename.lower().endswith('.md') else filename
            tag = tag.replace('_', ' ').strip()
            
            # Tìm kiếm lesson liên kết đầu tiên trong content_before để lấy ngữ cảnh môn học
            lesson_links = re.findall(r'\[\[(.*?)\]\]', content_before)
            lp = None
            if lesson_links:
                for link in lesson_links:
                    clean_link = re.sub(r'[\/:*?"<>|\r\n\t]', '_', link).strip()
                    try:
                        lp = LessonPlan.objects.filter(Q(title=link) | Q(title=clean_link)).first()
                        if lp:
                            break
                    except Exception:
                        pass
            
            subject = lp.attributes.get('Môn học', 'giáo dục') if (lp and isinstance(lp.attributes, dict)) else 'giáo dục'
            lesson_title = lp.title if lp else 'bài học liên quan'
            
            prompt_concept = (
                f"Viết 2-3 câu mô tả học thuật súc tích về khái niệm \"{tag}\" "
                f"trong bối cảnh môn học \"{subject}\" và bài học \"{lesson_title}\". "
                f"Chỉ mô tả bản chất/định nghĩa của khái niệm, không giải thích bài giảng. "
                f"Bắt buộc viết 100% bằng tiếng Việt chuẩn, học thuật, ngắn gọn, không dùng gạch đầu dòng. "
                f"Tuyệt đối không sử dụng bất kỳ từ ngữ hay ký tự tiếng nước ngoài nào (đặc biệt là chữ Hán/tiếng Trung như 硅藻门, tiếng Anh...)."
            )
            
            model_choice = 'api' if ai_mode == 'api' else local_model
            
            concept_description = generate_llm_response(
                prompt=prompt_concept,
                system_prompt=(
                    "Bạn là chuyên gia học thuật Việt Nam. Nhiệm vụ: viết định nghĩa/mô tả học thuật "
                    "ngắn gọn (2-3 câu) cho một khái niệm khoa học/giáo dục. "
                    "Bắt buộc trả về câu trả lời hoàn toàn bằng tiếng Việt phổ thông. "
                    "Tuyệt đối không chèn chữ Hán, tiếng Trung, tiếng Anh hay ký tự lạ. "
                    "Không dùng bullet points. Chỉ trả về đoạn văn mô tả, không thêm tiêu đề hay giải thích."
                ),
                model_choice=model_choice,
                api_key=api_key if ai_mode == 'api' else None,
                model_name=api_model if ai_mode == 'api' else None
            ).strip()

            if concept_description.startswith("### 💬 Xin chào!") or "Trợ lý AI" in concept_description or not concept_description.strip():
                concept_description = get_wikipedia_academic_definition(tag, subject, lesson_title)
            
            for prefix in ["Khái niệm:", "Định nghĩa:", f"{tag}:", "**", "*"]:
                if concept_description.lower().startswith(prefix.lower()):
                    concept_description = concept_description[len(prefix):].strip()
                    
            # Dựng lại cấu trúc file Obsidian Note
            yaml_block = "---\ntype: \"concept\"\nname: \"{}\"\nsubject: \"{}\"\n---".format(tag, subject)
            yaml_match = re.search(r'^---\n(.+?)\n---', content_before, re.DOTALL)
            if yaml_match:
                yaml_block = f"---\n{yaml_match.group(1)}\n---"
                
            related_lessons_block = "## Các bài học liên quan:\n"
            lessons_match = re.search(r'## Các bài học liên quan:\n(.*)', content_before, re.DOTALL)
            if lessons_match:
                related_lessons_block += lessons_match.group(1).strip()
            elif lp:
                related_lessons_block += f"- 📚 [[{lp.title}]]\n"
                
            new_content = f"{yaml_block}\n\n# {tag}\n\n{concept_description}\n\n{related_lessons_block}\n"
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
                
            # Ghi lịch sử
            WikiNoteEditHistory.objects.create(
                filename=filename,
                edited_by=user,
                content_before=content_before,
                content_after=new_content,
                change_type='AI_REGEN'
            )
            return Response({"success": True, "content": new_content, "message": "Đã tạo lại ghi chú bằng AI thành công!"}, status=200)
        except Exception as e:
            return Response({"error": f"Lỗi sinh lại bằng AI: {str(e)}"}, status=500)


class ObsidianNoteHistoryAPIView(APIView):
    """
    API trả về danh sách lịch sử chỉnh sửa của một ghi chú.
    """
    def get(self, request):
        from .models import WikiNoteEditHistory
        filename = request.query_params.get('filename')
        if not filename:
            return Response({"error": "Vui lòng cung cấp filename"}, status=400)
            
        histories = WikiNoteEditHistory.objects.filter(filename=filename).order_by('-edited_at')
        data = []
        for h in histories:
            data.append({
                "id": h.id,
                "filename": h.filename,
                "edited_by": h.edited_by.full_name or h.edited_by.username,
                "content_before": h.content_before,
                "content_after": h.content_after,
                "change_type": h.change_type,
                "edited_at": h.edited_at.isoformat()
            })
        return Response(data, status=200)



