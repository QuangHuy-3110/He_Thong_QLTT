#!/usr/bin/env python
# -*- coding: utf-8 -*-

import urllib.request
import urllib.error
import json
import sys

BASE_URL = "http://localhost:8000"
HEALTH_URL = f"{BASE_URL}/api/health/"
SETTINGS_URL = f"{BASE_URL}/api/system-settings/"
LESSON_PLANS_URL = f"{BASE_URL}/api/lesson-plans/"
MOCK_LOGIN_URL = f"{BASE_URL}/api/keycloak-mock-login/"
PERMISSIONS_URL = f"{BASE_URL}/api/users/me/permissions/"
DIRECTORIES_URL = f"{BASE_URL}/api/directories/"
CHAT_SESSIONS_URL = f"{BASE_URL}/api/chat-sessions/"
BG_TASKS_URL = f"{BASE_URL}/api/bg-tasks/status/"
OBSIDIAN_STATUS_URL = f"{BASE_URL}/api/obsidian/status/"
OBSIDIAN_NOTES_URL = f"{BASE_URL}/api/obsidian/notes/"

def print_banner(title):
    print("=" * 60)
    print(f" {title:^58} ")
    print("=" * 60)

def test_endpoint(url, name, method="GET", data=None, token=None):
    print(f"\n[*] Đang gửi yêu cầu kiểm tra {name}...")
    print(f"    Phương thức: {method} | URL: {url}")
    try:
        headers = {
            "User-Agent": "KMS-API-Tester/1.0",
            "Accept": "application/json"
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
            print(f"    [i] Sử dụng Token xác thực (Bearer Auth)")
            
        post_data = None
        if data is not None:
            headers["Content-Type"] = "application/json"
            post_data = json.dumps(data).encode('utf-8')
            print(f"    [i] Payload gửi đi: {json.dumps(data)}")
            
        req = urllib.request.Request(
            url, 
            data=post_data,
            headers=headers,
            method=method
        )
        with urllib.request.urlopen(req, timeout=30) as response:
            status_code = response.getcode()
            body = response.read().decode('utf-8')
            res_data = json.loads(body) if body.strip() else {}
            print(f"    [+] Kết nối THÀNH CÔNG (HTTP {status_code})")
            return True, res_data
    except urllib.error.HTTPError as e:
        status_code = e.code
        try:
            body = e.read().decode('utf-8')
            res_data = json.loads(body) if body.strip() else {}
            print(f"    [-] Máy chủ phản hồi LỖI (HTTP {status_code})")
            return False, res_data
        except Exception:
            print(f"    [-] Máy chủ phản hồi LỖI (HTTP {status_code}) nhưng không thể đọc JSON.")
            return False, None
    except urllib.error.URLError as e:
        print(f"    [!] KHÔNG THỂ KẾT NỐI tới Server: {e.reason}")
        return False, None
    except Exception as e:
        print(f"    [!] Lỗi không xác định: {e}")
        return False, None

def main():
    print_banner("KỊCH BẢN KIỂM TRA ĐA ENDPOINT API BACKEND KMS")
    
    # === PHẦN 1: KIỂM TRA CÁC API CÔNG KHAI (PUBLIC APIS) ===
    print("\n" + "=" * 20 + " PHẦN 1: API CÔNG KHAI " + "=" * 20)
    
    # 1. Test Health API
    success_health, health_data = test_endpoint(HEALTH_URL, "API Health Check")
    if not success_health:
        print("\n" + "!" * 60)
        print(" LỖI KẾT NỐI: Backend chưa được khởi chạy hoặc sai cổng!")
        print(" Vui lòng khởi động backend bằng lệnh: python manage.py runserver")
        print("!" * 60 + "\n")
        sys.exit(1)
        
    print("\n" + "-" * 50)
    print(" BÁO CÁO TRẠNG THÁI HỆ THỐNG:")
    print("-" * 50)
    status = health_data.get("status", "unknown")
    db_info = health_data.get("database", {})
    features = health_data.get("features", {})
    
    if status == "ok":
        print(" [OK] Backend: ĐANG HOẠT ĐỘNG HOÀN HẢO")
    else:
        print(" [!] Backend: CÓ LỖI (Vui lòng kiểm tra DB hoặc Cấu hình)")
        
    db_status = db_info.get("status", "unknown")
    if db_status == "healthy":
        print(" [OK] Cơ sở dữ liệu: ĐÊM LẠI KẾT NỐI THÀNH CÔNG")
    else:
        print(f" [ERR] Cơ sở dữ liệu: LỖI (Chi tiết: {db_info.get('error')})")
    print("-" * 50)

    # 2. Test system settings
    test_endpoint(SETTINGS_URL, "API Cấu hình Chunking (GET)")
    
    # 3. Test lesson plans list
    test_endpoint(LESSON_PLANS_URL, "API Danh sách Giáo án (GET)")
    
    # === PHẦN 2: ĐĂNG NHẬP GIẢ LẬP ĐỂ LẤY JWT TOKEN (AUTHENTICATION) ===
    print("\n" + "=" * 18 + " PHẦN 2: XÁC THỰC NGƯỜI DÙNG " + "=" * 18)
    
    login_payload = {
        "username": "admin",
        "role": "ADMIN"
    }
    success_login, login_data = test_endpoint(
        MOCK_LOGIN_URL, 
        "Đăng nhập giả lập Keycloak (Mock SSO)", 
        method="POST", 
        data=login_payload
    )
    
    token = None
    if success_login and login_data:
        token = login_data.get("token")
        user_info = login_data.get("user", {})
        print(f"    [+] Lấy Token JWT thành công!")
        print(f"        - Tên tài khoản: {user_info.get('username')}")
        print(f"        - Vai trò: {user_info.get('role')}")
    else:
        print("    [!] Đăng nhập thất bại. Bỏ qua các API yêu cầu xác thực.")
        
    # === PHẦN 3: KIỂM TRA CÁC API YÊU CẦU XÁC THỰC (AUTHENTICATED APIS) ===
    if token:
        print("\n" + "=" * 16 + " PHẦN 3: API YÊU CẦU ĐĂNG NHẬP " + "=" * 16)
        
        user_id = user_info.get("id") if user_info else None
        
        # 1. Test user permissions API
        perm_url = f"{PERMISSIONS_URL}?user_id={user_id}" if user_id else PERMISSIONS_URL
        test_endpoint(perm_url, "API Quyền hạn người dùng hiện tại", token=token)
        
        # 2. Test directories list API
        test_endpoint(DIRECTORIES_URL, "API Danh sách thư mục (Directories)", token=token)
        
        # 3. Test chat sessions list API
        chat_url = f"{CHAT_SESSIONS_URL}?user_id={user_id}" if user_id else CHAT_SESSIONS_URL
        test_endpoint(chat_url, "API Danh sách phiên Chat AI", token=token)
        
        # 4. Test background tasks status API
        test_endpoint(BG_TASKS_URL, "API Trạng thái tác vụ chạy ngầm AI RAG", token=token)
        
        # 5. Test Obsidian status API
        test_endpoint(OBSIDIAN_STATUS_URL, "API Trạng thái Obsidian Vault", token=token)
        
        # 6. Test Obsidian notes list API
        test_endpoint(OBSIDIAN_NOTES_URL, "API Danh sách ghi chú Obsidian (.md)", token=token)

    print("\n" + "=" * 60)
    print(" HOÀN TẤT KIỂM TRA TOÀN BỘ API ".center(60, "="))
    print("=" * 60)

if __name__ == "__main__":
    main()
