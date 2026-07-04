import os
import sys
import django
import json
import time

# Reconfigure stdout/stderr encoding for Windows
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# Append backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_path = os.path.join(backend_dir, "backend")
if backend_path not in sys.path:
    sys.path.append(backend_path)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kms_core.settings')
try:
    django.setup()
except Exception as e:
    print(f"Error setting up Django: {e}")
    sys.exit(1)

from app.llm_runner import generate_llm_response

# 1. DEFINE TEST CASES (WITH CORRECT AND INCORRECT ANSWERS)
TEST_CASES = [
    {
        "id": 1,
        "query": "Làm thế nào để thiết kế thực đơn 3 bữa cân đối năng lượng calo cho học sinh THPT?",
        "context": (
            "Học sinh THPT (15-17 tuổi) cần nhu cầu dinh dưỡng từ 2000-2200 kcal/ngày. "
            "Một thực đơn cân đối cần phân chia tỉ lệ năng lượng giữa 3 nhóm chất: Glucid (55-65%), Lipid (20-30%), Protein (12-15%). "
            "Thực đơn nên chia làm 3 bữa chính: Bữa sáng cung cấp 30% calo, bữa trưa cung cấp 40% calo, bữa tối cung cấp 30% calo. "
            "Cần tăng cường bổ sung Vitamin B, C (tan trong nước) và Vitamin A, D (tan trong dầu) thông qua rau xanh và trái cây chín."
        ),
        "accurate_answer": (
            "Để thiết kế thực đơn 3 bữa cân đối cho học sinh THPT (nhu cầu 2000-2200 kcal/ngày), "
            "bạn cần chia năng lượng theo tỉ lệ: bữa sáng 30%, bữa trưa 40%, bữa tối 30%. "
            "Đồng thời, cân đối tỷ lệ các chất dinh dưỡng gồm Glucid (55-65%), Lipid (20-30%), và Protein (12-15%), "
            "kết hợp bổ sung các loại vitamin A, D, B, C từ rau xanh và trái cây."
        ),
        "incorrect_answer": (
            "Để thiết kế thực đơn cho học sinh THPT, bạn nên cho các em ăn kiêng với lượng calo dưới 1000 kcal/ngày. "
            "Nên loại bỏ hoàn toàn Lipid ra khỏi bữa ăn để tránh béo phì và chỉ uống sữa tươi thay bữa sáng. "
            "Ngoài ra, học sinh cần bổ sung nhân sâm và yến sào mỗi ngày để tăng cường trí nhớ."
        )
    },
    {
        "id": 2,
        "query": "ADN tái tổ hợp là gì và ứng dụng của nó trong y học sản xuất insulin?",
        "context": (
            "ADN tái tổ hợp là phân tử ADN được tạo thành từ việc kết hợp các đoạn ADN từ các nguồn sinh vật khác nhau. "
            "Trong sản xuất insulin y học, gen mã hóa insulin người được ghép vào plasmid của vi khuẩn E. coli. "
            "Vi khuẩn E. coli tái tổ hợp này sau đó được nuôi cấy trong môi trường công nghiệp để nhân đôi nhanh chóng và "
            "dịch mã sản sinh ra protein insulin người tinh khiết với số lượng lớn, giúp điều trị bệnh tiểu đường hiệu quả."
        ),
        "accurate_answer": (
            "ADN tái tổ hợp là phân tử ADN lai ghép từ các nguồn sinh vật khác nhau. "
            "Trong y học, người ta ứng dụng nó để sản xuất insulin bằng cách ghép gen insulin người vào plasmid của vi khuẩn E. coli. "
            "Khi nuôi cấy vi khuẩn này, chúng sẽ nhân lên nhanh chóng và sản sinh lượng lớn insulin tinh khiết để điều trị bệnh tiểu đường."
        ),
        "incorrect_answer": (
            "ADN tái tổ hợp là công nghệ biến đổi gen của con người trực tiếp bằng sóng vô tuyến. "
            "Trong y học sản xuất insulin, người ta tiêm trực tiếp tế bào tụy heo vào máu của bệnh nhân tiểu đường "
            "để tế bào tự sản sinh insulin mà không cần thông qua bất kỳ loại vi khuẩn nào."
        )
    }
]

def evaluate_faithfulness(query, context, answer):
    prompt = (
        "Nhiệm vụ của bạn là chấm điểm độ TRUNG THỰC (Faithfulness) của câu trả lời dựa trên ngữ cảnh được cung cấp.\n"
        "Độ trung thực đo lường xem câu trả lời có hoàn toàn dựa vào ngữ cảnh hay không, không được có thông tin ảo giác hay tự bịa ra.\n\n"
        f"Ngữ cảnh:\n{context}\n\n"
        f"Câu hỏi:\n{query}\n\n"
        f"Câu trả lời cần đánh giá:\n{answer}\n\n"
        "Hãy phân tích chi tiết từng ý trong câu trả lời so với ngữ cảnh.\n"
        "YÊU CẦU ĐẦU RA:\n"
        "Trả về một đối tượng JSON duy nhất có cấu trúc sau, không viết thêm bất kỳ từ giải thích nào ngoài khối JSON:\n"
        "{\n"
        "  \"score\": <điểm số từ 0.0 đến 1.0 (ví dụ 1.0 nếu hoàn toàn chính xác, 0.0 nếu bịa đặt hoàn toàn hoặc mâu thuẫn)>\n"
        "  \"reason\": \"<lý do giải thích chi tiết bằng tiếng Việt>\"\n"
        "}"
    )
    
    # Sử dụng local LLM (hoặc simulator nếu offline) để chấm điểm
    response = generate_llm_response(
        prompt=prompt,
        system_prompt="Bạn là giám khảo chấm điểm RAG AI khách quan, trung thực và chính xác.",
        model_choice="3b"
    )
    
    # Parse JSON
    try:
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.replace("```json", "").replace("```", "").strip()
        data = json.loads(cleaned)
        return data.get("score", 0.0), data.get("reason", "Không rõ lý do.")
    except Exception as e:
        # Fallback parsing
        print(f"[Warn] Failed to parse JSON response: {response}. Error: {e}")
        # Hướng giải quyết fallback thủ công dựa trên nội dung response
        if "1.0" in response or "0.9" in response:
            return 1.0, "Câu trả lời hoàn toàn phù hợp với ngữ cảnh."
        return 0.0, "Phát hiện thông tin mâu thuẫn hoặc không có trong ngữ cảnh."

def evaluate_answer_relevance(query, answer):
    prompt = (
        "Nhiệm vụ của bạn là chấm điểm độ LIÊN QUAN (Answer Relevance) của câu trả lời đối với câu hỏi.\n"
        "Độ liên quan đo lường xem câu trả lời có trả lời đúng trọng tâm của câu hỏi hay không, không quan tâm nội dung đó đúng hay sai.\n\n"
        f"Câu hỏi:\n{query}\n\n"
        f"Câu trả lời cần đánh giá:\n{answer}\n\n"
        "Hãy phân tích mức độ trực diện và đầy đủ của câu trả lời đối với câu hỏi.\n"
        "YÊU CẦU ĐẦU RA:\n"
        "Trả về một đối tượng JSON duy nhất có cấu trúc sau, không viết thêm bất kỳ từ giải thích nào ngoài khối JSON:\n"
        "{\n"
        "  \"score\": <điểm số từ 0.0 đến 1.0>\n"
        "  \"reason\": \"<lý do giải thích chi tiết bằng tiếng Việt>\"\n"
        "}"
    )
    
    response = generate_llm_response(
        prompt=prompt,
        system_prompt="Bạn là giám khảo chấm điểm RAG AI khách quan, trung thực và chính xác.",
        model_choice="3b"
    )
    
    try:
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.replace("```json", "").replace("```", "").strip()
        data = json.loads(cleaned)
        return data.get("score", 0.0), data.get("reason", "Không rõ lý do.")
    except Exception as e:
        if "1.0" in response or "0.9" in response:
            return 1.0, "Câu trả lời đúng trọng tâm câu hỏi."
        return 0.0, "Câu trả lời không đi vào trọng tâm câu hỏi."

if __name__ == "__main__":
    print("=====================================================================")
    print("   CHƯƠNG TRÌNH ĐÁNH GIÁ RAG BẰNG PHƯƠNG PHÁP LLM-AS-A-JUDGE   ")
    print("=====================================================================")
    
    results = []
    
    for case in TEST_CASES:
        print(f"\nEvaluating Case {case['id']}: '{case['query'][:50]}...'")
        
        # Test Accurate Answer
        print("  - Chấm điểm Câu trả lời ĐÚNG (Accurate Answer)...")
        f_score_acc, f_reason_acc = evaluate_faithfulness(case["query"], case["context"], case["accurate_answer"])
        r_score_acc, r_reason_acc = evaluate_answer_relevance(case["query"], case["accurate_answer"])
        
        results.append({
            "case_id": case["id"],
            "type": "Accurate (Câu trả lời ĐÚNG)",
            "query": case["query"],
            "faithfulness": f_score_acc,
            "f_reason": f_reason_acc,
            "relevance": r_score_acc,
            "r_reason": r_reason_acc
        })
        
        # Test Incorrect Answer
        print("  - Chấm điểm Câu trả lời SAI/ẢO GIÁC (Incorrect Answer)...")
        f_score_inc, f_reason_inc = evaluate_faithfulness(case["query"], case["context"], case["incorrect_answer"])
        r_score_inc, r_reason_inc = evaluate_answer_relevance(case["query"], case["incorrect_answer"])
        
        results.append({
            "case_id": case["id"],
            "type": "Incorrect (Câu trả lời SAI/ẢO GIÁC)",
            "query": case["query"],
            "faithfulness": f_score_inc,
            "f_reason": f_reason_inc,
            "relevance": r_score_inc,
            "r_reason": r_reason_inc
        })
        
    print("\n\n================ KẾT QUẢ ĐÁNH GIÁ CHẤT LƯỢNG LLM-AS-A-JUDGE ================")
    print(f"{'ID':<3} | {'Loại câu trả lời':<30} | {'Faithfulness':<12} | {'Answer Relevance':<16}")
    print("-" * 70)
    for res in results:
        print(f"{res['case_id']:<3} | {res['type']:<30} | {res['faithfulness']:<12.2f} | {res['relevance']:<16.2f}")
        print(f"    * Lý do Faithfulness: {res['f_reason']}")
        print(f"    * Lý do Relevance: {res['r_reason']}")
        print("-" * 70)
        
    # Ghi kết quả ra file JSON
    with open("llm_judge_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print("\nSaved evaluation results to llm_judge_results.json")
