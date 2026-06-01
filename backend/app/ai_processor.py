import re
from .models import LessonPlan, DocumentChunk
from .embedding_engine import get_embedding
from .llm_client import generate_mindmap_via_llm

def chunk_markdown_content(text: str, max_chunk_size: int = 600, overlap: int = 100) -> list:
    if not text or not text.strip():
        return []
        
    sections = re.split(r'\n(?=#{1,4}\s)', text)
    chunks = []
    
    for sec in sections:
        sec = sec.strip()
        if not sec:
            continue
            
        if len(sec) <= max_chunk_size:
            chunks.append(sec)
            continue
            
        start = 0
        while start < len(sec):
            end = start + max_chunk_size
            chunk = sec[start:end]
            chunks.append(chunk)
            start += max_chunk_size - overlap
            
    return chunks

def process_lesson_plan_ai(lesson_plan: LessonPlan):
    try:
        print(f'[AI Processor] Starting AI processing for LessonPlan ID: {lesson_plan.id} ({lesson_plan.title})...')
        lesson_plan.ai_processing_status = 'PROCESSING'
        lesson_plan.save(update_fields=['ai_processing_status'])
        
        content = lesson_plan.content_preview if lesson_plan.content_preview else ''
        
        print('[AI Processor] Generating Mind Map...')
        mindmap_json = generate_mindmap_via_llm(lesson_plan.title, content)
        lesson_plan.mindmap = mindmap_json
        
        print('[AI Processor] Chunking content and generating embeddings...')
        lesson_plan.chunks.all().delete()
        
        chunks = chunk_markdown_content(content)
        for idx, chunk_text in enumerate(chunks):
            embedding_vector = get_embedding(chunk_text)
            DocumentChunk.objects.create(
                lesson_plan=lesson_plan,
                chunk_index=idx,
                content=chunk_text,
                embedding=embedding_vector,
                metadata={}
            )
            
        print(f'[AI Processor] Successfully created {len(chunks)} chunks and embeddings in database.')
        lesson_plan.ai_processing_status = 'COMPLETED'
        lesson_plan.save()
        print(f'[AI Processor] Processing completed successfully for LessonPlan ID: {lesson_plan.id}!')
    except Exception as e:
        print(f'[AI Processor] Critical error in AI processing for LessonPlan {lesson_plan.id}: {e}')
        lesson_plan.ai_processing_status = 'FAILED'
        lesson_plan.save(update_fields=['ai_processing_status'])
        raise
