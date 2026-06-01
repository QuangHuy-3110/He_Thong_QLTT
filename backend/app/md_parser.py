import os
import re

def parse_md_content(content: str) -> dict:
    lines = [line.strip() for line in content.split('\n')]
    non_empty_lines = [l for l in lines if l]
    combined_text_lower = content.lower()
    
    title = ''
    for line in lines:
        if line.startswith('# '):
            title = line[2:].strip().replace('**', '').replace('*', '')
            break
            
    if not title and non_empty_lines:
        title = non_empty_lines[0].replace('**', '').replace('*', '')
        
    subject = ''
    for line in lines:
        match = re.search(r'môn\s*:\s*([^;,\n]+)', line, re.IGNORECASE)
        if match:
            subject = match.group(1).strip().replace('**', '').replace('*', '')
            break
            
    grade = ''
    for line in lines:
        match = re.search(r'lớp\s*:\s*([^;,\n]+)', line, re.IGNORECASE)
        if match:
            grade = match.group(1).strip().replace('**', '').replace('*', '')
            break
            
    duration = ''
    for line in lines:
        match = re.search(r'thời gian thực hiện[^:]*:\s*([^;\n]+)', line, re.IGNORECASE)
        if match:
            duration = match.group(1).strip().replace('**', '').replace('*', '')
            break
            
    target_students = []
    urban_keywords = ['thành thị', 'đô thị', 'phố', 'siêu thị', 'trà sữa', 'đồ ăn nhanh', 'fast food', 'sức khỏe học đường', 'ít vận động']
    rural_keywords = ['nông thôn', 'làng', 'bản', 'ruộng', 'vườn', 'nông nghiệp']
    
    if any(kw in combined_text_lower for kw in urban_keywords):
        target_students.append('Học sinh thành thị')
    if any(kw in combined_text_lower for kw in rural_keywords):
        target_students.append('Học sinh nông thôn')
        
    lesson_type = ''
    if 'lý thuyết' in combined_text_lower:
        lesson_type = 'Lý thuyết'
    elif 'ôn tập' in combined_text_lower:
        lesson_type = 'Ôn tập'
    elif 'kiểm tra' in combined_text_lower:
        lesson_type = 'Kiểm tra'
    elif 'thực hành' in combined_text_lower or 'trải nghiệm' in combined_text_lower:
        lesson_type = 'Thực hành'
        
    activities = []
    table_rows = []
    for line in lines:
        if line.startswith('|') and line.endswith('|'):
            cells = [c.strip() for c in line.split('|')[1:-1]]
            if cells:
                table_rows.append(cells)
                
    timeline_table_found = False
    for idx, row in enumerate(table_rows):
        if idx == 0:
            headers_lower = [c.lower() for c in row]
            is_timeline = any('hoạt động' in h or 'hđ' in h or 'tiến trình' in h for h in headers_lower)
            if is_timeline:
                timeline_table_found = True
                continue
                
        if not timeline_table_found:
            continue
            
        if len(row) >= 2:
            raw_name = row[0]
            act_desc = row[1] if len(row) > 1 else ''
            
            if '---' in raw_name or '---' in act_desc:
                continue
                
            time_match = re.search(r'(\d+\s*phút)', raw_name + ' ' + act_desc, re.IGNORECASE)
            act_time = time_match.group(1) if time_match else '15 phút'
            
            act_name = re.sub(r'\(\s*\d+\s*phút\s*\)', '', raw_name, flags=re.IGNORECASE).strip()
            act_name = re.sub(r'\d+\s*phút', '', act_name, flags=re.IGNORECASE).strip()
            act_name = re.sub(r'[\s\-:]+$', '', act_name).strip()
            
            if not act_name:
                act_name = raw_name
                
            if act_desc:
                act_desc_clean = act_desc.strip()
                if len(act_desc_clean) > 250:
                    sentences = re.split(r'(?<=[.!?])\s+', act_desc_clean)
                    act_desc_clean = ' '.join(sentences[:2]).strip()
            else:
                act_desc_clean = 'Hoạt động dạy học chi tiết.'
                
            activities.append({
                'ten_hoat_dong': act_name,
                'thoi_gian': act_time,
                'tom_tat': act_desc_clean
            })
            if len(activities) >= 5:
                break
                
    if not activities:
        for idx, line in enumerate(lines):
            match = re.match(r'^#{2,4}\s*(Hoạt động\s+\d+|HĐ\s*\d+|[0-9]+\.\s+)(.*)', line, re.IGNORECASE)
            if match:
                act_name = line.replace('#', '').strip()
                act_time = '10 phút'
                act_desc = ''
                
                for j in range(1, 6):
                    if idx + j < len(lines):
                        next_line = lines[idx + j]
                        if not next_line:
                            continue
                        time_match = re.search(r'(\d+\s*phút)', next_line, re.IGNORECASE)
                        if time_match:
                            act_time = time_match.group(1).strip()
                        if not act_desc and len(next_line) > 20 and not next_line.startswith('#'):
                            act_desc = next_line
                            
                if act_desc:
                    sentences = re.split(r'(?<=[.!?])\s+', act_desc)
                    act_desc = ' '.join(sentences[:2]).strip()
                else:
                    act_desc = 'Tổ chức hoạt động giảng dạy trải nghiệm thực tế.'
                    
                activities.append({
                    'ten_hoat_dong': act_name,
                    'thoi_gian': act_time,
                    'tom_tat': act_desc
                })
                if len(activities) >= 5:
                    break
                    
    knowledge_tags = []
    common_tags = ['Dinh dưỡng học đường', 'Thực đơn khỏe mạnh', 'Nhóm chất dinh dưỡng', 'Hoạt động trải nghiệm', 'Sức khỏe học đường', 'Chế độ ăn uống', 'Vận động', 'Thói quen ăn uống', 'Thiết kế thực đơn', 'Trò chơi trải nghiệm']
    for tag in common_tags:
        if tag.lower() in combined_text_lower:
            knowledge_tags.append(tag)
    knowledge_tags = knowledge_tags[:5]
    
    description_parts = []
    if subject:
        description_parts.append(f'Bài giảng môn {subject}')
    if grade:
        description_parts.append(f'dành cho {grade}')
    if duration:
        description_parts.append(f'Thời gian thực hiện: {duration}')
        
    description = ', '.join(description_parts)
    if activities:
        act_details = [f"{a['ten_hoat_dong']}: {a['tom_tat']}" for a in activities]
        description += '. Gồm các hoạt động chính: ' + '; '.join(act_details) + '.'
    elif not description:
        description = 'Bài giảng dạy học giáo án được tải lên hệ thống từ file Markdown.'
        
    return {
        'title': title,
        'description': description,
        'subject': subject,
        'grade': grade,
        'duration': duration,
        'target_students': target_students,
        'lesson_type': lesson_type,
        'activities': activities,
        'knowledge_tags': knowledge_tags
    }

def parse_md_lesson_plan(file_path: str) -> dict:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found at {file_path}")
        
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    return parse_md_content(content)
