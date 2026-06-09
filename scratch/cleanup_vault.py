import os
import sys
import re
import django

# Override print to prevent Windows CP1252 encoding crashes
_original_print = print
def print(*args, **kwargs):
    try:
        encoding = sys.stdout.encoding or 'utf-8'
        new_args = []
        for arg in args:
            arg_str = str(arg)
            new_args.append(arg_str.encode(encoding, errors='replace').decode(encoding, errors='replace'))
        _original_print(*new_args, **kwargs)
    except Exception:
        try:
            fallback_args = [str(arg).encode('ascii', errors='replace').decode('ascii') for arg in args]
            _original_print(*fallback_args, **kwargs)
        except Exception:
            pass

# Add backend directory to python search path
app_dir = os.path.dirname(os.path.abspath(__file__))  # scratch
workspace_dir = os.path.dirname(app_dir)  # workspace root
backend_dir = os.path.join(workspace_dir, "backend")
sys.path.append(backend_dir)

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kms_core.settings')
django.setup()

from app.models import LessonPlan
from app.bg_processor import BackgroundProcessManager

def run_vault_cleanup():
    vault_dir = BackgroundProcessManager.get_vault_path()
    if not os.path.exists(vault_dir):
        print("Vault directory does not exist.")
        return

    print(f"Starting clean sweep of Obsidian Vault: {vault_dir}")
    
    # 1. Get all active lesson titles in DB and their clean filenames
    active_lessons = LessonPlan.objects.all()
    active_titles = set(lp.title for lp in active_lessons)
    active_clean_titles = set()
    for lp in active_lessons:
        clean = re.sub(r'[\/:*?"<>|\r\n\t]', '_', lp.title).strip()
        active_clean_titles.add(clean)

    files_deleted = 0
    files_modified = 0

    # 2. Scan vault directory
    for filename in os.listdir(vault_dir):
        if not filename.lower().endswith('.md'):
            continue
            
        file_path = os.path.join(vault_dir, filename)
        title = filename[:-3]  # strip .md

        # Read content to check type
        try:
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
        except Exception as e:
            print(f"Error reading {filename}: {e}")
            continue

        # Check type in YAML front matter
        note_type = "lesson"
        yaml_match = re.search(r'^---\n(.+?)\n---', content, re.DOTALL)
        if yaml_match:
            yaml_content = yaml_match.group(1)
            type_match = re.search(r'type:\s*["\']?([^"\' \n]+)', yaml_content)
            if type_match:
                note_type = type_match.group(1).strip()

        if note_type != "concept":
            # This is a lesson plan note. If it's not active in DB, delete it!
            if title not in active_clean_titles:
                try:
                    os.remove(file_path)
                    print(f"Deleted legacy/inactive lesson note: {filename}")
                    files_deleted += 1
                except Exception as e:
                    print(f"Error deleting lesson note {filename}: {e}")
        else:
            # This is a concept note. Let's check its links
            links = re.findall(r'- \[\[(.*?)\]\]', content)
            active_links = []
            
            for link in links:
                if link in active_titles:
                    active_links.append(link)
            
            if not active_links:
                # No active lessons link to this concept note. Delete it!
                try:
                    os.remove(file_path)
                    print(f"Deleted orphaned concept note: {filename}")
                    files_deleted += 1
                except Exception as e:
                    print(f"Error deleting concept note {filename}: {e}")
            elif len(active_links) < len(links):
                # Some links are inactive. Let's rewrite the file to keep only active links
                try:
                    # First, extract front matter and body description
                    desc_match = re.search(r'^---\n.+?\n---\n\n# .*?\n\n(.*?)\n\n## Các bài học liên quan:', content, re.DOTALL)
                    if desc_match:
                        description = desc_match.group(1).strip()
                    else:
                        # Fallback if structure is different
                        lines = content.splitlines()
                        desc_lines = []
                        in_yaml = False
                        yaml_count = 0
                        for line in lines:
                            if line.strip() == "---":
                                yaml_count += 1
                                continue
                            if yaml_count < 2:
                                continue
                            if line.startswith("# "):
                                continue
                            if "## Các bài học liên quan:" in line:
                                break
                            desc_lines.append(line)
                        description = "\n".join(desc_lines).strip()

                    # Rewrite the file
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(
                            f"---\n"
                            f"type: \"concept\"\n"
                            f"name: \"{title}\"\n"
                            f"---\n\n"
                            f"# {title}\n\n"
                            f"{description}\n\n"
                            f"## Các bài học liên quan:\n"
                        )
                        for link in active_links:
                            f.write(f"- [[{link}]]\n")
                    
                    print(f"Updated concept note (removed dead links): {filename}")
                    files_modified += 1
                except Exception as e:
                    print(f"Error updating concept note {filename}: {e}")

    print(f"Clean sweep finished. Deleted: {files_deleted} files, Updated: {files_modified} files.")

if __name__ == '__main__':
    run_vault_cleanup()
