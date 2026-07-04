import os
import sys
import django
import json

# Setup Django
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

from app.models import LessonPlan, DocumentChunk
from app.graph_rag_service import retrieve_graph_rag_context

# 1. GROUND TRUTH DEFINITIONS FOR EVALUATION
# Ground truth concepts for each of the seeded lesson plans using exact DB titles
GROUND_TRUTH_CONCEPTS = {
    "Dinh dưỡng học đường – Thiết kế thực đơn cân đối calo cho học sinh THPT": {
        "dinh dưỡng", "glucid", "lipid", "protein", "vitamin", "chuyển hóa năng lượng", "calo", "khẩu phần ăn", "sức khỏe", "tiêu hóa"
    },
    "DINH DƯỠNG HỌC ĐƯỜNG": {
        "dinh dưỡng", "glucid", "lipid", "protein", "vitamin", "chuyển hóa năng lượng", "calo", "khẩu phần ăn", "sức khỏe", "tiêu hóa"
    },
    "Tham quan vườn thực vật – Phân loại đa dạng sinh học và tiến hóa thực vật": {
        "đa dạng sinh học", "phân loại thực vật", "tiến hóa", "ngành thực vật", "khóa lưỡng phân", "bảo tồn", "rêu", "dương xỉ", "hạt trần", "hạt kín"
    },
    "Công nghệ gen và ứng dụng y học – Định hướng nghề nghiệp Sinh học phân tử": {
        "công nghệ sinh học", "công nghệ gen", "sinh học phân tử", "y học", "nông nghiệp", "adn tái tổ hợp", "thực phẩm biến đổi gen", "gmo", "vacxin", "liệu pháp gen"
    },
    "Chăm sóc vườn rau gia đình – Sinh lý thực vật và phòng trừ sâu bệnh an toàn": {
        "dinh dưỡng thực vật", "sinh lý động vật", "bệnh học cây trồng", "chăn nuôi", "phân bón vi sinh", "sâu bệnh", "nông nghiệp sạch", "trồng trọt"
    },
    "Rèn luyện thể chất – Sinh học vận động và cơ chế tổng hợp ATP trong cơ bắp": {
        "quang hợp", "hô hấp thực vật", "sinh thái học", "hệ sinh thái", "chăm chỉ", "oxy", "co2", "môi trường xanh", "chuỗi thức ăn"
    },
    "Chiến dịch vệ sinh cộng đồng nông thôn – Vi sinh vật rác thải và phòng bệnh truyền nhiễm": {
        "vi sinh vật", "rác thải", "ô nhiễm môi trường", "sức khỏe cộng đồng", "trách nhiệm", "tái chế", "ủ phân compost", "biogas", "bệnh truyền nhiễm"
    },
    "Thực hành nông nghiệp công nghệ cao – Nuôi cấy mô, thủy canh và chọn giống di truyền": {
        "nuôi cấy mô", "sinh lý thực vật", "di truyền chọn giống", "phòng thí nghiệm", "môi trường nhân tạo", "phát sinh nhân tạo", "nhân giống vô tính"
    }
}

# Ground truth RAG queries and their expected target lesson plans (Hit Rate evaluation)
RAG_TEST_QUERIES = [
    {
        "query": "Làm thế nào để thiết kế thực đơn 3 bữa cân đối năng lượng calo?",
        "expected_lesson": "Dinh dưỡng học đường – Thiết kế thực đơn cân đối calo cho học sinh THPT"
    },
    {
        "query": "Làm thế nào để phân biệt các ngành thực vật bằng khóa lưỡng phân?",
        "expected_lesson": "Tham quan vườn thực vật – Phân loại đa dạng sinh học và tiến hóa thực vật"
    },
    {
        "query": "Ứng dụng của ADN tái tổ hợp và công nghệ gen trong y học sản xuất insulin?",
        "expected_lesson": "Công nghệ gen và ứng dụng y học – Định hướng nghề nghiệp Sinh học phân tử"
    },
    {
        "query": "Quy trình ủ phân compost hữu cơ bằng chế phẩm sinh học EM từ rác thải?",
        "expected_lesson": "Chiến dịch vệ sinh cộng đồng nông thôn – Vi sinh vật rác thải và phòng bệnh truyền nhiễm"
    },
    {
        "query": "Phương pháp nuôi cấy mô tế bào thực vật và nhân giống vô tính?",
        "expected_lesson": "Thực hành nông nghiệp công nghệ cao – Nuôi cấy mô, thủy canh và chọn giống di truyền"
    },
    {
        "query": "Làm sao để nhận diện triệu chứng thiếu nguyên tố khoáng vi lượng trên lá cây?",
        "expected_lesson": "Chăm sóc vườn rau gia đình – Sinh lý thực vật và phòng trừ sâu bệnh an toàn"
    }
]

def clean_tag(tag):
    return tag.strip().lower().replace("-", " ")

def evaluate_entity_extraction():
    print("\n=== Evaluating Concept/Entity Extraction Quality ===")
    results = []
    total_precision = 0.0
    total_recall = 0.0
    total_f1 = 0.0
    count = 0
    
    for lp in LessonPlan.objects.all():
        # Find matching ground truth key
        matched_gt_key = None
        for gt_key in GROUND_TRUTH_CONCEPTS.keys():
            if gt_key.lower() in lp.title.lower() or lp.title.lower() in gt_key.lower():
                matched_gt_key = gt_key
                break
        
        if not matched_gt_key:
            continue
            
        gt_set = {clean_tag(t) for t in GROUND_TRUTH_CONCEPTS[matched_gt_key]}
        
        # Get AI extracted tags
        extracted_tags = lp.attributes.get("Từ khóa kiến thức", []) or lp.attributes.get("knowledge_tags", [])
        if isinstance(extracted_tags, str):
            extracted_tags = [t.strip() for t in extracted_tags.split(",") if t.strip()]
        
        ext_set = {clean_tag(t) for t in extracted_tags}
        
        if not ext_set:
            continue
            
        # Compute overlap
        # Since tags are semantic, we also consider partial matches (e.g. "dinh dưỡng học" matches "dinh dưỡng")
        true_positives = 0
        for ext in ext_set:
            is_tp = False
            for gt in gt_set:
                if ext in gt or gt in ext:
                    is_tp = True
                    break
            if is_tp:
                true_positives += 1
                
        precision = true_positives / len(ext_set) if len(ext_set) > 0 else 0.0
        
        # Recall
        recall_hits = 0
        for gt in gt_set:
            is_recalled = False
            for ext in ext_set:
                if ext in gt or gt in ext:
                    is_recalled = True
                    break
            if is_recalled:
                recall_hits += 1
                
        recall = recall_hits / len(gt_set) if len(gt_set) > 0 else 0.0
        
        f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
        
        total_precision += precision
        total_recall += recall
        total_f1 += f1
        count += 1
        
        results.append({
            "title": lp.title,
            "extracted": list(extracted_tags),
            "ground_truth": list(GROUND_TRUTH_CONCEPTS[matched_gt_key]),
            "precision": precision,
            "recall": recall,
            "f1": f1
        })
        
        print(f"Lesson: {lp.title}")
        print(f"  Extracted ({len(ext_set)}): {list(extracted_tags)}")
        print(f"  Ground Truth ({len(gt_set)}): {list(GROUND_TRUTH_CONCEPTS[matched_gt_key])}")
        print(f"  Precision: {precision:.2f} | Recall: {recall:.2f} | F1: {f1:.2f}\n")
        
    avg_precision = total_precision / count if count > 0 else 0.0
    avg_recall = total_recall / count if count > 0 else 0.0
    avg_f1 = total_f1 / count if count > 0 else 0.0
    
    print(f"Average Precision: {avg_precision:.4f}")
    print(f"Average Recall: {avg_recall:.4f}")
    print(f"Average F1-score: {avg_f1:.4f}")
    
    return {
        "detailed": results,
        "summary": {
            "precision": avg_precision,
            "recall": avg_recall,
            "f1": avg_f1
        }
    }

def evaluate_rag_retrieval():
    print("\n=== Evaluating RAG Context Retrieval ===")
    hits_top_1 = 0
    hits_top_3 = 0
    mrr_total = 0.0
    results = []
    
    for test in RAG_TEST_QUERIES:
        query = test["query"]
        expected_title = test["expected_lesson"]
        
        # Retrieve context
        ret_data = retrieve_graph_rag_context(query=query)
        retrieved_node_ids = ret_data.get("retrieved_node_ids", [])
        
        # Find position of expected lesson plan
        rank = 0
        found = False
        
        # Check which lesson plans are retrieved
        # retrieved_node_ids can contain 'lesson_{id}'
        retrieved_lesson_titles = []
        for node_id in retrieved_node_ids:
            if node_id.startswith("lesson_"):
                try:
                    lp_id = int(node_id.split("_")[1])
                    lp = LessonPlan.objects.get(id=lp_id)
                    retrieved_lesson_titles.append(lp.title)
                except Exception:
                    pass
                    
        # Calculate rank
        for idx, title in enumerate(retrieved_lesson_titles, 1):
            if expected_title.lower() in title.lower() or title.lower() in expected_title.lower():
                rank = idx
                found = True
                break
                
        reciprocal_rank = 1.0 / rank if found else 0.0
        mrr_total += reciprocal_rank
        
        if found:
            if rank == 1:
                hits_top_1 += 1
            if rank <= 3:
                hits_top_3 += 1
                
        results.append({
            "query": query,
            "expected": expected_title,
            "retrieved": retrieved_lesson_titles,
            "found": found,
            "rank": rank if found else -1,
            "mrr": reciprocal_rank
        })
        
        print(f"Query: '{query}'")
        print(f"  Expected: {expected_title}")
        print(f"  Retrieved: {retrieved_lesson_titles}")
        print(f"  Rank: {rank if found else 'Not found'} | Reciprocal Rank: {reciprocal_rank:.2f}\n")
        
    num_queries = len(RAG_TEST_QUERIES)
    hit_rate_top_1 = hits_top_1 / num_queries if num_queries > 0 else 0.0
    hit_rate_top_3 = hits_top_3 / num_queries if num_queries > 0 else 0.0
    mrr = mrr_total / num_queries if num_queries > 0 else 0.0
    
    print(f"Hit Rate @ 1: {hit_rate_top_1:.4f}")
    print(f"Hit Rate @ 3: {hit_rate_top_3:.4f}")
    print(f"Mean Reciprocal Rank (MRR): {mrr:.4f}")
    
    return {
        "detailed": results,
        "summary": {
            "hit_rate_top_1": hit_rate_top_1,
            "hit_rate_top_3": hit_rate_top_3,
            "mrr": mrr
        }
    }

if __name__ == "__main__":
    entity_eval = evaluate_entity_extraction()
    rag_eval = evaluate_rag_retrieval()
    
    # Save results to a json file in scratch
    report_data = {
        "entity_extraction": entity_eval,
        "rag_retrieval": rag_eval
    }
    with open("evaluate_results.json", "w", encoding="utf-8") as f:
        json.dump(report_data, f, ensure_ascii=False, indent=2)
    print("Evaluation completed! Saved results to evaluate_results.json")
