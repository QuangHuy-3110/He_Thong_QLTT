import os
import re
import json

def get_llm_client():
    openai_key = os.environ.get('OPENAI_API_KEY')
    if openai_key:
        try:
            from openai import OpenAI
            return OpenAI(api_key=openai_key)
        except Exception:
            return None
    return None

def generate_mindmap_via_llm(title: str, markdown_content: str) -> dict:
    api_key = os.environ.get('OPENAI_API_KEY')
    if api_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key)
            
            prompt = f"""
            ### NHIỆM VỤ:
            Phân tích bài giáo án dưới đây và trích xuất cấu trúc Mindmap HOÀN CHỈNH VÀ ĐẦY ĐỦ NHẤT dưới dạng JSON.
            
            ### CẤU TRÚC JSON YÊU CẦU:
            {{
                "title": "{title}",
                "children": [
                    {{
                        "title": "Tên chương / mục lớn 1",
                        "children": [
                            {{"title": "Ý chính A"}},
                            {{"title": "Ý chính B"}}
                        ]
                    }},
                    {{
                        "title": "Tên chương / mục lớn 2",
                        "children": [
                            {{"title": "Ý chính C"}},
                            {{"title": "Ý chính D"}}
                        ]
                    }}
                ]
            }}

            ### YÊU CẦU CHI TIẾT:
            1. BẮT BUỘC TRÍCH XUẤT ĐẦY ĐỦ VÀ TOÀN DIỆN: Phải vẽ lại TOÀN BỘ các phần nội dung có trong file giáo án (bao gồm: Thông tin chung, Mục tiêu bài học, Thiết bị dạy học & học liệu, và TOÀN BỘ các Hoạt động tiến trình chi tiết HĐ1, HĐ2, HĐ3, HĐ4, HĐ5,...). Không được lược bỏ, tóm tắt chung chung hay bỏ sót bất kỳ chương mục lớn hay hoạt động nào.
            2. ĐỌC KỸ BẢNG BIỂU (TABLES): Trong các file giáo án Markdown, các nội dung hoạt động giảng dạy quan trọng nhất (như Hoạt động của Giáo viên, Hoạt động của Học sinh, Nội dung cần đạt) thường được định dạng dưới dạng BẢNG. Bạn phải đọc kỹ từng dòng, từng ô trong bảng, trích xuất tất cả các câu hỏi thảo luận, các bước thực hiện, sản phẩm dự kiến và tích hợp đầy đủ vào sơ đồ tư duy.
            3. Mỗi mục con (children) mô tả ý ngắn gọn, súc tích (dưới 20 từ) nhưng phải bao phủ hết các ý nhỏ trong giáo án.
            4. Trả về DUY NHẤT một chuỗi JSON hợp lệ. Không bao gồm markdown fence (như ```json) hay giải thích dông dài.

            ### GIÁO ÁN:
            {markdown_content}
            """
            
            response = client.chat.completions.create(
                model='gpt-4o-mini',
                messages=[
                    {'role': 'system', 'content': 'Bạn là chuyên gia thiết kế sơ đồ tư duy giáo dục học đường. Bạn luôn trả về chuỗi JSON chính xác bao quát toàn bộ nội dung giáo án.'},
                    {'role': 'user', 'content': prompt}
                ],
                temperature=0.2,
                max_tokens=4096
            )
            result_text = response.choices[0].message.content.strip()
            if result_text.startswith('```'):
                result_text = re.sub(r'^```[a-zA-Z]*\n', '', result_text)
                result_text = re.sub(r'\n```$', '', result_text)
            
            return json.loads(result_text.strip())
        except Exception as e:
            print(f"[LLM Client] LLM mindmap generation failed: {e}. Falling back to structural parser.")
            
    return build_mindmap_structurally(title, markdown_content)

def build_mindmap_structurally(title: str, markdown_content: str) -> dict:
    lines = [line.strip() for line in markdown_content.split('\n')]
    current_section = None
    sections = []
    
    for line in lines:
        if not line:
            continue
            
        h_match = re.match(r'^(#{2,3})\s+(.*)', line)
        if h_match:
            sec_title = h_match.group(2).strip().replace("**", "").replace("*", "")
            if len(sec_title) < 2:
                continue
            current_section = {
                "title": sec_title,
                "children": []
            }
            sections.append(current_section)
        elif line.startswith('-') or line.startswith('*') or line.startswith('•'):
            item_text = re.sub(r'^[-*•]\s*', '', line).strip().replace("**", "").replace("*", "")
            item_text = re.sub(r'[:\-\s]+$', '', item_text)
            if current_section is None:
                continue
            if not item_text:
                continue
            if len(item_text) < 350:
                current_section["children"].append({"title": item_text})
        elif line.startswith('|'):
            if '---' in line:
                continue
            cells = [c.strip().replace("**", "").replace("*", "") for c in line.split('|') if c.strip()]
            if current_section and cells:
                for cell in cells:
                    if len(cell) > 12 and len(cell) < 250:
                        cell_clean = re.sub(r'[:\-\s]+$', '', cell).strip()
                        if cell_clean and not cell_clean.startswith('Hoạt động') and not cell_clean.startswith('GV') and not cell_clean.startswith('HS') and not cell_clean.startswith('Giáo viên') and not cell_clean.startswith('Học sinh'):
                            current_section["children"].append({"title": cell_clean})
                
    if not sections:
        current_section = {
            "title": "Nội dung chính",
            "children": []
        }
        sections.append(current_section)
        for line in lines[:60]:
            if len(line) > 10 and len(line) < 150 and not line.startswith('|') and not line.startswith('#'):
                current_section["children"].append({"title": line})
                
    cleaned_sections = []
    for sec in sections:
        if not sec["children"]:
            continue
            
        seen_titles = set()
        dedup_children = []
        for child in sec["children"]:
            t = child["title"]
            if t.lower() not in seen_titles:
                seen_titles.add(t.lower())
                short_title = t if len(t) < 70 else t[:67] + '...'
                dedup_children.append({"title": short_title})
                
        sec["children"] = dedup_children
        cleaned_sections.append(sec)
        
    if not cleaned_sections or len(cleaned_sections[0]["children"]) == 0:
        cleaned_sections = [
            {
                "title": "Mục tiêu bài học",
                "children": [
                    {"title": "Kiến thức trọng tâm"},
                    {"title": "Kỹ năng cần đạt"},
                    {"title": "Phát triển năng lực"}
                ]
            },
            {
                "title": "Tiến trình dạy học",
                "children": [
                    {"title": "Khởi động & kết nối"},
                    {"title": "Hình thành kiến thức mới"},
                    {"title": "Luyện tập & vận dụng"}
                ]
            }
        ]
        
    return {
        "title": title if title else "Sơ đồ tư duy bài giảng",
        "children": cleaned_sections
    }
