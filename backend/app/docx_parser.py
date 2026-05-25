import os
import re
import docx

def parse_docx_lesson_plan(file_path):
    """
    Parses a lesson plan Word document (.docx) and extracts core metadata.
    If any fields (subject, grade, duration, target students, type, activities, tags)
    are missing, it returns empty strings/lists so the user can fill them manually.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found at {file_path}")

    doc = docx.Document(file_path)
    
    # Extract all paragraph texts
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    full_text = "\n".join(paragraphs).lower()
    
    # Extract all table cells
    table_texts = []
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                txt = cell.text.strip()
                if txt and txt not in table_texts:
                    table_texts.append(txt)
    full_table_text = "\n".join(table_texts).lower()
    combined_text = (full_text + "\n" + full_table_text)

    # Detect if the document is actually a lesson plan (Kế hoạch bài dạy / Giáo án)
    lesson_plan_keywords = [
        "giáo án", "kế hoạch bài dạy", "kế hoạch dạy học", "mục tiêu dạy học", 
        "thiết bị dạy học", "học liệu", "tiến trình dạy học", "tiến trình dạy",
        "hoạt động 1", "hoạt động 01", "yêu cầu cần đạt", "sản phẩm trải nghiệm"
    ]
    is_lesson_plan = any(kw in combined_text for kw in lesson_plan_keywords)

    # 1. Extract Title
    title = ""
    if paragraphs:
        first_p = paragraphs[0]
        if len(paragraphs) > 1 and (first_p.upper().startswith("CHỦ ĐỀ") or first_p.upper().startswith("BÀI")):
            second_p = paragraphs[1]
            if not second_p.startswith("Môn:") and not second_p.startswith("Thời gian") and len(second_p) < 100:
                title = f"{first_p} – {second_p}"
            else:
                title = first_p
        else:
            title = first_p
            
    # 2. Extract Subject (Môn học)
    subject = ""
    for p in paragraphs:
        match = re.search(r"môn\s*:\s*([^;,\n]+)", p, re.IGNORECASE)
        if match:
            subject = match.group(1).strip()
            break

    # 3. Extract Grade/Class (Cấp lớp)
    grade = ""
    for p in paragraphs:
        match = re.search(r"lớp\s*:\s*([^;,\n]+)", p, re.IGNORECASE)
        if match:
            grade = match.group(1).strip()
            break

    # 4. Extract Duration (Thời gian)
    duration = ""
    for p in paragraphs:
        match = re.search(r"thời gian thực hiện[^:]*:\s*([^;\n]+)", p, re.IGNORECASE)
        if match:
            duration = match.group(1).strip()
            break

    # 5. Determine Target Students (Đối tượng)
    target_students = []
    urban_keywords = ["thành thị", "đô thị", "phố", "siêu thị", "trà sữa", "đồ ăn nhanh", "fast food", "sức khỏe học đường", "ít vận động"]
    rural_keywords = ["nông thôn", "làng", "bản", "ruộng", "vườn", "nông nghiệp"]
    
    has_urban = any(kw in combined_text for kw in urban_keywords)
    has_rural = any(kw in combined_text for kw in rural_keywords)
    
    if has_urban:
        target_students.append("Học sinh thành thị")
    if has_rural:
        target_students.append("Học sinh nông thôn")

    # 6. Determine Lesson Type (Loại hình tiết dạy)
    lesson_type = ""
    if "lý thuyết" in combined_text:
        lesson_type = "Lý thuyết"
    elif "ôn tập" in combined_text:
        lesson_type = "Ôn tập"
    elif "kiểm tra" in combined_text:
        lesson_type = "Kiểm tra"
    elif "thực hành" in combined_text or "trải nghiệm" in combined_text:
        lesson_type = "Thực hành"

    # 7. Extract Activities (Tiến trình dạy học)
    activities = []
    for i, p in enumerate(doc.paragraphs):
        text = p.text.strip()
        match = re.match(r"^(Hoạt động\s+\d+|HĐ\s*\d+)\s*:\s*(.*)", text, re.IGNORECASE)
        if match:
            act_name = match.group(0).strip()
            act_time = "10 phút"
            act_desc = ""
            
            for j in range(1, 6):
                if i + j < len(doc.paragraphs):
                    next_text = doc.paragraphs[i + j].text.strip()
                    if not next_text:
                        continue
                    time_match = re.search(r"(\d+\s*phút)", next_text, re.IGNORECASE)
                    if time_match:
                        act_time = time_match.group(1).strip()
                    if not act_desc and len(next_text) > 20 and "Mục tiêu" not in next_text and "Tổ chức" not in next_text:
                        act_desc = next_text
            
            if not act_desc:
                for j in range(1, 10):
                    if i + j < len(doc.paragraphs):
                        t = doc.paragraphs[i + j].text.strip()
                        if t and len(t) > 30 and "Hoạt động" not in t:
                            act_desc = t
                            break
            
            if act_desc:
                sentences = re.split(r'(?<=[.!?])\s+', act_desc)
                act_desc = " ".join(sentences[:2]).strip()
            else:
                act_desc = "Tổ chức hoạt động giảng dạy trải nghiệm thực tế."
            
            activities.append({
                "ten_hoat_dong": act_name,
                "thoi_gian": act_time,
                "tom_tat": act_desc
            })
            if len(activities) >= 5:
                break
                
    # Table fallback
    if not activities:
        for table in doc.tables:
            headers = [cell.text.strip().lower() for cell in table.rows[0].cells]
            is_timeline_table = any("hoạt động" in h or "hđ" in h for h in headers)
            if is_timeline_table and len(table.rows) > 1:
                for row in table.rows[1:6]:
                    cells = [c.text.strip() for c in row.cells]
                    if len(cells) >= 2:
                        act_name = cells[0]
                        act_desc = cells[1] if len(cells) > 1 else ""
                        time_match = re.search(r"(\d+\s*phút)", act_name + " " + act_desc, re.IGNORECASE)
                        act_time = time_match.group(1) if time_match else "15 phút"
                        
                        sentences = re.split(r'(?<=[.!?])\s+', act_desc)
                        act_desc = " ".join(sentences[:2]).strip() if act_desc else "Hoạt động dạy học chi tiết."
                        
                        activities.append({
                            "ten_hoat_dong": act_name,
                            "thoi_gian": act_time,
                            "tom_tat": act_desc
                        })
                break

    # 8. Extract Knowledge Tags (Từ khóa)
    knowledge_tags = []
    common_tags = [
        "Dinh dưỡng học đường", "Thực đơn khỏe mạnh", "Nhóm chất dinh dưỡng",
        "Hoạt động trải nghiệm", "Sức khỏe học đường", "Chế độ ăn uống",
        "Vận động", "Thói quen ăn uống", "Thiết kế thực đơn", "Trò chơi trải nghiệm"
    ]
    for tag in common_tags:
        if tag.lower() in combined_text:
            knowledge_tags.append(tag)
    knowledge_tags = knowledge_tags[:5]

    # 9. Create Description / Summary
    if is_lesson_plan:
        description_parts = []
        if subject:
            description_parts.append(f"Bài giảng môn {subject}")
        if grade:
            description_parts.append(f"dành cho {grade}")
        if duration:
            description_parts.append(f"Thời gian thực hiện: {duration}")
            
        description = ", ".join(description_parts)
        if activities:
            act_titles = [a["ten_hoat_dong"] for a in activities]
            description += ". Gồm các hoạt động chính: " + ", ".join(act_titles) + "."
        elif not description:
            description = "Bài giảng dạy học giáo án được tải lên hệ thống."
    else:
        # Fallback for general documents: Extract the first 2-3 paragraphs (cleaned up) as description
        desc_parts = []
        for p in paragraphs[1:4]:
            if len(p) > 20 and not p.startswith("Môn:") and not p.startswith("Thời gian"):
                desc_parts.append(p)
        if desc_parts:
            description = " ".join(desc_parts)[:250] + "..."
        else:
            description = "Tài liệu văn bản tổng hợp được tải lên hệ thống."

    return {
        "title": title,
        "description": description,
        "subject": subject,
        "grade": grade,
        "duration": duration,
        "target_students": target_students,
        "lesson_type": lesson_type,
        "activities": activities,
        "knowledge_tags": knowledge_tags
    }

def convert_docx_to_markdown(file_path):
    """
    Reads a Word Document (.docx) sequentially and outputs its content as beautifully
    formatted Markdown, preserving lists, styles, and full tabular structures.
    """
    import docx
    from docx.text.paragraph import Paragraph
    from docx.table import Table
    import re

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found at {file_path}")

    doc = docx.Document(file_path)
    md_parts = []
    
    # Iterate through docx body elements sequentially
    for child in doc.element.body:
        if child.tag.endswith('p'):
            p = Paragraph(child, doc)
            text = p.text.strip()
            if not text:
                continue
                
            # Formulate headings
            if text.upper().startswith("CHỦ ĐỀ") or text.upper().startswith("BÀI HỌC:"):
                md_parts.append(f"\n# {text}\n")
            elif re.match(r"^[IVXLCDM]+\.\s+", text):
                md_parts.append(f"\n## {text}\n")
            elif re.match(r"^(Hoạt động\s+\d+|HĐ\s*\d+|[0-9]+\.\s+)", text, re.IGNORECASE):
                md_parts.append(f"\n### {text}\n")
            elif text.startswith("-") or text.startswith("*") or text.startswith("•"):
                # Normalize list item
                clean_item = re.sub(r"^[-*•]\s*", "", text)
                md_parts.append(f"- {clean_item}")
            else:
                md_parts.append(text + "\n")
                
        elif child.tag.endswith('tbl'):
            t = Table(child, doc)
            if not t.rows:
                continue
                
            table_md = []
            
            # Formulate Table Header
            header_cells = t.rows[0].cells
            header_texts = []
            seen_headers = []
            for c in header_cells:
                ct = c.text.strip().replace('\n', ' ')
                # Avoid duplicate cell references in merged cells
                if not seen_headers or seen_headers[-1] != ct or ct == "":
                    header_texts.append(ct)
                    seen_headers.append(ct)
            
            # If all empty, skip
            if not any(header_texts):
                header_texts = [f"Cột {i+1}" for i in range(len(header_cells))]

            table_md.append("| " + " | ".join(header_texts) + " |")
            table_md.append("| " + " | ".join("---" for _ in header_texts) + " |")
            
            # Formulate Table Rows
            for row in t.rows[1:]:
                row_cells = row.cells
                row_texts = []
                seen_row = []
                for c in row_cells:
                    ct = c.text.strip().replace('\n', ' ')
                    # Avoid duplications from merged cells
                    if not seen_row or seen_row[-1] != ct or ct == "":
                        row_texts.append(ct)
                        seen_row.append(ct)
                # Pad row_texts if it is shorter than header
                while len(row_texts) < len(header_texts):
                    row_texts.append("")
                # Truncate if longer
                row_texts = row_texts[:len(header_texts)]
                
                table_md.append("| " + " | ".join(row_texts) + " |")
                
            md_parts.append("\n" + "\n".join(table_md) + "\n")

    return "\n".join(md_parts)

