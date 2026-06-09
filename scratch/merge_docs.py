import os

workspace_dir = r"d:\He_Thong_QLTT"

# File 1: Hệ thống RAG LLM
rag_files = ["ai_system_detail.md"]
rag_output = "he_thong_rag_llm.md"

# File 2: Hệ thống (General System)
system_files = [
    "system_architecture.md",
    "system_blueprint.md",
    "system_state.md",
    "db_compact_notes.md",
    "keycloak_integration_blueprint.md"
]
system_output = "he_thong.md"

def merge_and_delete(files, output_name, title):
    output_path = os.path.join(workspace_dir, output_name)
    print(f"Creating {output_name}...")
    
    with open(output_path, "w", encoding="utf-8") as outfile:
        outfile.write(f"# {title}\n\n")
        outfile.write(f"Tài liệu này là bản hợp nhất các tài liệu kỹ thuật liên quan của hệ thống.\n\n---\n\n")
        
        for fname in files:
            fpath = os.path.join(workspace_dir, fname)
            if os.path.exists(fpath):
                print(f"Reading {fname}...")
                with open(fpath, "r", encoding="utf-8") as infile:
                    content = infile.read()
                    # Strip top heading if it has one
                    outfile.write(f"## Tài liệu nguồn: `{fname}`\n\n")
                    outfile.write(content)
                    outfile.write("\n\n---\n\n")
            else:
                print(f"Warning: {fname} does not exist")
                
    # Delete source files
    for fname in files:
        fpath = os.path.join(workspace_dir, fname)
        if os.path.exists(fpath):
            print(f"Deleting {fname}...")
            os.remove(fpath)

merge_and_delete(rag_files, rag_output, "Hệ thống RAG LLM - Tài liệu Chi tiết")
merge_and_delete(system_files, system_output, "Hệ thống KMS - Tài liệu Tổng quan & Kiến trúc")

print("Merge completed successfully!")
