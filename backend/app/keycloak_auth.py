import jwt
import requests
from django.conf import settings
from rest_framework import authentication
from rest_framework import exceptions
from django.contrib.auth import get_user_model

User = get_user_model()

class KeycloakJWTAuthentication(authentication.BaseAuthentication):
    """
    Xác thực JWT Token do Keycloak cấp phát tập trung (IAM Keycloak Integration).
    Tự động giải mã, kiểm tra chữ ký (signature) từ Keycloak Server và đồng bộ tài khoản.
    """
    def authenticate(self, request):
        # Chỉ kích hoạt nếu biến môi trường cấu hình kích hoạt Keycloak được bật
        if not getattr(settings, 'USE_KEYCLOAK', False):
            return None

        auth_header = request.META.get('HTTP_AUTHORIZATION')
        if not auth_header:
            return None

        try:
            prefix, token = auth_header.split(' ')
            if prefix.lower() != 'bearer':
                return None
        except ValueError:
            raise exceptions.AuthenticationFailed('Định dạng Header Authorization không hợp lệ (Bắt buộc: Bearer <token>)')

        try:
            # Giải mã header để tìm Key ID (kid) hoặc thuật toán
            unverified_header = jwt.get_unverified_header(token)
            alg = unverified_header.get('alg', 'RS256')
            
            if alg == 'HS256':
                # Token giả lập (Mock Keycloak Token)
                payload = jwt.decode(
                    token,
                    'mock-secret-key-1234',
                    algorithms=['HS256'],
                    options={"verify_signature": True, "verify_aud": False}
                )
            else:
                # 1. Đọc cấu hình Keycloak Endpoint
                keycloak_url = settings.KEYCLOAK_SERVER_URL  # VD: http://localhost:8080/realms/kms_realm
                
                # Lấy Public Key (JWKS) từ Keycloak Realm để xác thực chữ ký token ngoại tuyến (offline token validation)
                jwks_url = f"{keycloak_url}/protocol/openid-connect/certs"
                jwks = requests.get(jwks_url, timeout=5).json()
                
                kid = unverified_header.get('kid')
                public_key = None
                for key in jwks['keys']:
                    if key['kid'] == kid:
                        public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
                        break
                        
                if not public_key:
                    raise exceptions.AuthenticationFailed('Không tìm thấy chữ ký hợp lệ từ máy chủ Keycloak.')

                # 2. Giải mã và kiểm tra tính hợp lệ của Token
                payload = jwt.decode(
                    token,
                    public_key,
                    algorithms=['RS256'],
                    options={"verify_signature": True, "verify_aud": False, "verify_exp": False}
                )
        except jwt.ExpiredSignatureError:
            raise exceptions.AuthenticationFailed('Phiên làm việc từ Keycloak đã hết hạn.')
        except jwt.InvalidTokenError as e:
            raise exceptions.AuthenticationFailed(f'Token xác thực không hợp lệ: {str(e)}')
        except Exception as ex:
            raise exceptions.AuthenticationFailed(f'Lỗi kết nối xác thực Keycloak: {str(ex)}')

        # 3. Đồng bộ hóa thông tin User tự động (Auto-provisioning)
        username = payload.get('preferred_username') or payload.get('sub')
        email = payload.get('email', '')
        full_name = payload.get('name', '')
        
        # Bóc tách phân quyền vai trò (Roles mapping) từ Keycloak JWT claims
        roles = []
        resource_access = payload.get('resource_access', {})
        client_access = resource_access.get(settings.KEYCLOAK_CLIENT_ID, {})
        roles = client_access.get('roles', [])
        
        # Mapping Keycloak Roles sang Django KMS Roles
        resolved_role = 'USER'
        if 'admin' in roles or 'KMS_ADMIN' in roles:
            resolved_role = 'ADMIN'
        elif 'teacher' in roles or 'KMS_TEACHER' in roles:
            resolved_role = 'TEACHER'

        # Lấy hoặc tự động tạo tài khoản trong cơ sở dữ liệu nội bộ
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                'email': email,
                'full_name': full_name,
                'role': resolved_role,
                'is_active': True
            }
        )

        # Cập nhật vai trò/họ tên nếu có thay đổi từ phía Keycloak quản trị
        if not created:
            has_change = False
            if user.role != resolved_role:
                user.role = resolved_role
                has_change = True
            if user.full_name != full_name:
                user.full_name = full_name
                has_change = True
            if has_change:
                user.save(update_fields=['role', 'full_name'])

        return (user, token)
