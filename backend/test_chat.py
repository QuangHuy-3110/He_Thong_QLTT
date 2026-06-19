import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kms_core.settings')
django.setup()

from app.models import User, AIChatSession, AIChatMessage
from app.llm_runner import generate_llm_response_stream

print("Django setup completed successfully!")

# Let's see if we have any users
users = User.objects.all()
print(f"Total users: {users.count()}")
if users.exists():
    user = users.first()
    print(f"First user: {user.username} (ID: {user.id})")
    
    # Try simulating sending a message with api_key as empty string
    prompt = "NGỮ CẢNH GRAPH RAG TRUY XUẤT:\n===================================\n[]\n===================================\n\nCÂU HỎI NGƯỜI DÙNG: Tìm tài liệu môn Vật lý thuộc lớp 10?"
    system_prompt = "Bạn là trợ lý AI hữu ích."
    
    print("\n--- Test generate_llm_response_stream with model_choice='api' and api_key='' ---")
    try:
        generator = generate_llm_response_stream(
            prompt=prompt,
            system_prompt=system_prompt,
            model_choice="api",
            api_key="", # empty string
            model_name="gemini-1.5-flash"
        )
        for chunk in generator:
            print(chunk, end="", flush=True)
        print("\n--- Stream completed ---")
    except Exception as e:
        print(f"\nError running stream: {e}")
        
    print("\n--- Test generate_llm_response_stream with model_choice='api' and api_key=None ---")
    try:
        generator = generate_llm_response_stream(
            prompt=prompt,
            system_prompt=system_prompt,
            model_choice="api",
            api_key=None,
            model_name="gemini-1.5-flash"
        )
        for chunk in generator:
            print(chunk, end="", flush=True)
        print("\n--- Stream completed ---")
    except Exception as e:
        print(f"\nError running stream: {e}")
else:
    print("No users found in database.")
