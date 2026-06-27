import React, { useState, useRef } from 'react';
import axios from 'axios';

export const KNOWLEDGE_TRACKS = [
  'Hoạt động hướng vào bản thân',
  'Hoạt động hướng đến xã hội',
  'Hoạt động hướng đến tự nhiên',
  'Hoạt động hướng nghiệp'
];

export const TRACK_TO_TOPICS: Record<string, string[]> = {
  'Hoạt động hướng vào bản thân': ['Khám phá bản thân', 'Rèn luyện bản thân'],
  'Hoạt động hướng đến xã hội': ['Chăm sóc gia đình', 'Xây dựng nhà trường', 'Xây dựng cộng đồng'],
  'Hoạt động hướng đến tự nhiên': ['Tìm hiểu và bảo tồn cảnh quan thiên nhiên', 'Tìm hiểu và bảo vệ môi trường'],
  'Hoạt động hướng nghiệp': [
    'Tìm hiểu nghề nghiệp',
    'Rèn luyện phẩm chất, năng lực phù hợp với định hướng nghề nghiệp',
    'Lựa chọn hướng nghề nghiệp và lập kế hoạch học tập theo định hướng nghề nghiệp'
  ]
};

export const LOCATIONS = [
  'Lớp học tiêu chuẩn',
  'Phòng thí nghiệm Sinh học',
  'Phòng máy tính / AI',
  'Phòng đa năng / Nhà ăn',
  'Ngoài trời / Sân trường',
  'Thực địa / Nông trại',
  'Hội trường / Sân khấu',
  'Nông nghiệp công nghệ cao / Thực địa'
];

export const BIOLOGY_CONNECTIONS = [
  'Hệ cơ – xương – khớp, tim mạch, hô hấp, năng lượng ATP',
  'Dinh dưỡng học, chuyển hóa năng lượng, vai trò vitamin/khoáng chất',
  'Hệ thần kinh, hormone (serotonin, adrenaline), cơ sở sinh học của cảm xúc',
  'Cân bằng nước, sinh học giấc ngủ, nhịp sinh học',
  'Cấu tạo cơ thể, tuần hoàn máu, hô hấp nhân tạo, nguyên lý đông máu',
  'Sinh học thần kinh: trí nhớ, sự hình thành thói quen, ảnh hưởng giấc ngủ và dinh dưỡng đến tập trung',
  'Hệ miễn dịch, bệnh truyền nhiễm, vệ sinh cá nhân, nguyên tắc phòng bệnh',
  'Sinh học hành vi: hormone tuổi dậy thì, sức khỏe tâm – sinh lý',
  'Phản xạ thần kinh, tác động rượu/bia đến hệ thần kinh và tim mạch, sinh học giấc ngủ',
  'Cơ chế nghe – nhìn, ảnh hưởng âm nhạc đến não bộ, sinh học vận động',
  'Sinh lý thực vật (quang hợp, dinh dưỡng cây trồng), bệnh học cây trồng',
  'Vi sinh vật gây bệnh trong rác thải, ảnh hưởng ô nhiễm đến sức khỏe cộng đồng',
  'Dịch tễ học cơ bản, sức khỏe sinh sản vị thành niên, phòng chống bệnh truyền nhiễm',
  'Hormone oxytocin, dopamine trong quan hệ xã hội, sức khỏe tinh thần',
  'Hệ hô hấp người, tác động khí độc, sinh thái đô thị',
  'Phân loại thực vật, đa dạng sinh học, tiến hóa',
  'Vòng tuần hoàn vật chất, vi sinh vật phân hủy, sinh thái học',
  'Quang hợp, hô hấp thực vật, sinh thái rừng',
  'Vi sinh vật nước, chu trình nitơ, ảnh hưởng ô nhiễm đến sinh vật thủy sinh',
  'Hệ sinh thái nông nghiệp, đa dạng sinh học địa phương',
  'Công nghệ gen, sinh học phân tử, ứng dụng y học/nông nghiệp',
  'Quy trình sản xuất thuốc, an toàn sinh học, nghiên cứu tế bào',
  'Sinh lý thực vật, nuôi cấy mô, di truyền chọn giống',
  'Dinh dưỡng thực vật, sinh lý động vật, bệnh học cây trồng/vật nuôi'
];

interface Directory {
  id: number;
  name: string;
  is_public: boolean;
  attributes: any;
  parent: number | null;
  user?: number | null;
}

interface DirectoryOption {
  id: number;
  name: string;
  is_public: boolean;
  depth: number;
  visualPrefix: string;
}

const getDirectoriesAsTreeOptions = (
  dirs: Directory[]
): DirectoryOption[] => {
  const childrenMap = new Map<number | null, Directory[]>();
  dirs.forEach(d => {
    const parentId = d.parent;
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(d);
  });

  const result: DirectoryOption[] = [];

  const traverse = (parentId: number | null, depth: number, prefix: string) => {
    const children = childrenMap.get(parentId) || [];
    children.sort((a, b) => a.name.localeCompare(b.name));

    children.forEach((child, index) => {
      const isLast = index === children.length - 1;
      const currentPrefix = prefix + (isLast ? '└─ ' : '├─ ');
      const nextPrefix = prefix + (isLast ? '   ' : '│  ');

      result.push({
        id: child.id,
        name: child.name,
        is_public: child.is_public,
        depth: depth,
        visualPrefix: currentPrefix
      });

      traverse(child.id, depth + 1, nextPrefix);
    });
  };

  const filteredIds = new Set(dirs.map(d => d.id));
  const roots = dirs.filter(d => d.parent === null || !filteredIds.has(d.parent));
  roots.sort((a, b) => a.name.localeCompare(b.name));

  roots.forEach((root, index) => {
    const isLast = index === roots.length - 1;
    const currentPrefix = isLast ? '└─ ' : '├─ ';
    const nextPrefix = isLast ? '   ' : '│  ';

    result.push({
      id: root.id,
      name: root.name,
      is_public: root.is_public,
      depth: 0,
      visualPrefix: currentPrefix
    });

    traverse(root.id, 1, nextPrefix);
  });

  return result;
};

interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
}

interface UploadPageProps {
  directories: Directory[];
  currentUser: User | null;
  onBack: () => void;
  onSuccess: (newPlan?: any) => void;
  onRefreshDirs: () => void;
  managedDirectoryIds?: number[]; // IDs explicitly granted to current teacher
  uploadMode?: 'personal' | 'public'; // Controls which directories are shown
  onViewDuplicate?: (id: number) => void;
}

export default function UploadPage({ directories, currentUser, onBack, onSuccess, onRefreshDirs, managedDirectoryIds = [], uploadMode = 'public', onViewDuplicate }: UploadPageProps) {
  // Selected directory for upload target
  const [selectedDirId, setSelectedDirId] = useState<number | null>(null);
  // Tree expanded nodes
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // ── Compute which directories the Teacher is allowed to see ──
  const getAllDescendants = (rootId: number): number[] => {
    const children = directories.filter(d => d.parent === rootId);
    return [rootId, ...children.flatMap(c => getAllDescendants(c.id))];
  };

  // ── Filter directories by mode ──
  // personal mode: only show private dirs owned by currentUser
  // public mode: show all public dirs (+ teacher's managed dirs as before)
  const modeFilteredDirs: Directory[] = (() => {
    if (uploadMode === 'personal') {
      return directories.filter(d => !d.is_public && (currentUser ? d.user === currentUser.id : false));
    }
    // public mode: show only public directories
    return directories.filter(d => d.is_public);
  })();

  const allowedDirIds: Set<number> = (() => {
    if (uploadMode === 'personal') {
      // All personal dirs of user are selectable
      return new Set(modeFilteredDirs.map(d => d.id));
    }
    if (!currentUser || currentUser.role !== 'TEACHER') return new Set(modeFilteredDirs.map(d => d.id));
    const ids = new Set<number>();
    managedDirectoryIds.forEach(id => getAllDescendants(id).forEach(did => ids.add(did)));
    return ids;
  })();

  const selectableDirs = modeFilteredDirs.filter(d => allowedDirIds.has(d.id));

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectDir = (dir: Directory) => {
    if (uploadMode === 'public' && currentUser?.role === 'TEACHER' && !allowedDirIds.has(dir.id)) return;
    setSelectedDirId(prev => prev === dir.id ? null : dir.id);
  };

  // Recursive tree node component — only shows dirs matching current mode
  const TreeNode = ({ dir, depth }: { dir: Directory; depth: number }) => {
    const children = modeFilteredDirs
      .filter(d => d.parent === dir.id)
      .filter(d => uploadMode !== 'public' || currentUser?.role !== 'TEACHER' || allowedDirIds.has(d.id));
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(dir.id);
    const isSelected = selectedDirId === dir.id;
    const isAllowed = uploadMode === 'personal' ? true : (currentUser?.role !== 'TEACHER' || allowedDirIds.has(dir.id));
    const isManaged = managedDirectoryIds.includes(dir.id);

    const [hovered, setHovered] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [renameVal, setRenameVal] = useState(dir.name);

    const isAllowedToManage = currentUser && (
      currentUser.role === 'ADMIN' ||
      dir.user === currentUser.id ||
      managedDirectoryIds.includes(dir.id)
    );

    const handleRenameSubmit = async () => {
      if (renameVal.trim() && renameVal.trim() !== dir.name) {
        try {
          await axios.patch(`/api/directories/${dir.id}/`, { name: renameVal.trim() });
          await onRefreshDirs();
        } catch (err) {
          alert('Lỗi đổi tên thư mục.');
        }
      }
      setRenaming(false);
    };

    const handleDeleteDir = async () => {
      if (!window.confirm(`Xóa thư mục "${dir.name}"? Tài liệu bên trong sẽ không bị xóa nhưng sẽ mất liên kết.`)) return;
      try {
        await axios.delete(`/api/directories/${dir.id}/`);
        if (selectedDirId === dir.id) {
          setSelectedDirId(null);
        }
        await onRefreshDirs();
      } catch (err) {
        alert('Lỗi xóa thư mục.');
      }
    };

    const handleTogglePublicDir = async () => {
      const action = dir.is_public ? 'chuyển sang riêng tư' : 'xuất bản công khai';
      if (!window.confirm(`Bạn có chắc muốn ${action} thư mục này?`)) return;
      try {
        await axios.patch(`/api/directories/${dir.id}/`, { is_public: !dir.is_public });
        await onRefreshDirs();
      } catch (err) {
        alert('Lỗi cập nhật trạng thái thư mục.');
      }
    };

    const handleAddChildClick = () => {
      setNewPersonalDirParentId(dir.id);
      setShowInlineCreateDir(true);
      if (!isExpanded) {
        setExpandedIds(prev => {
          const next = new Set(prev);
          next.add(dir.id);
          return next;
        });
      }
    };

    return (
      <div className="mt-0.5">
        <div
          onClick={() => isAllowed && selectDir(dir)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={`flex items-center gap-1.5 py-1.5 px-2 rounded-md transition-colors cursor-pointer ${
            isSelected
              ? 'bg-blue-50 text-blue-700 font-semibold'
              : isAllowed
              ? 'hover:bg-gray-100 text-gray-700 dark:text-slate-200'
              : 'text-gray-400 dark:text-slate-500 cursor-not-allowed'
          }`}
          style={{ paddingLeft: `${8 + depth * 18}px` }}
        >
          {/* Expand/collapse toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(dir.id, e);
            }}
            className={`w-4 h-4 flex items-center justify-center text-xs text-gray-400 hover:text-gray-700 flex-shrink-0 ${
              !hasChildren ? 'opacity-0 pointer-events-none' : ''
            }`}
          >
            {isExpanded ? '▼' : '▶'}
          </button>

          {/* Checkbox */}
          <input
            type="checkbox"
            className="rounded border-gray-400 text-blue-600 cursor-pointer flex-shrink-0 w-3.5 h-3.5"
            checked={isSelected}
            disabled={!isAllowed}
            onChange={() => selectDir(dir)}
            onClick={e => e.stopPropagation()}
          />

          {/* Folder Icon */}
          <span className="flex-shrink-0 text-sm">
            📁
          </span>

          {/* Folder Name */}
          {renaming ? (
            <input
              autoFocus
              value={renameVal}
              onChange={e => setRenameVal(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') {
                  setRenaming(false);
                  setRenameVal(dir.name);
                }
              }}
              className="flex-grow text-xs border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-900 bg-white"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className="flex-grow font-medium truncate text-sm">
              {dir.name}
            </span>
          )}

          {/* Action buttons on hover */}
          {hovered && !renaming && isAllowedToManage && (
            <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
              {uploadMode === 'personal' && (
                <button
                  type="button"
                  title="Thêm thư mục con"
                  onClick={handleAddChildClick}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-blue-100 text-blue-500 text-xs font-bold"
                >+</button>
              )}
              <button
                type="button"
                title="Đổi tên"
                onClick={() => { setRenaming(true); setRenameVal(dir.name); }}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-yellow-100 text-yellow-600 text-xs"
              >✏</button>
              <button
                type="button"
                title={dir.is_public ? 'Chuyển sang riêng tư' : 'Xuất bản công khai'}
                onClick={handleTogglePublicDir}
                className={`w-5 h-5 flex items-center justify-center rounded text-xs transition-colors ${
                  dir.is_public ? 'hover:bg-orange-100 text-orange-500' : 'hover:bg-green-100 text-green-600'
                }`}
              >
                {dir.is_public ? '🔓' : '🌐'}
              </button>
              <button
                type="button"
                title="Xóa thư mục"
                onClick={handleDeleteDir}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 text-red-500 text-xs"
              >✕</button>
            </div>
          )}

          {isManaged && !hovered && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
              isSelected ? 'bg-blue-200 text-blue-800' : 'bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
            }`}>Quản lý</span>
          )}
          {dir.is_public && !hovered && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
              isSelected ? 'bg-green-200 text-green-800' : 'bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400'
            }`}>Công khai</span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div>
            {children.map(child => (
              <TreeNode key={child.id} dir={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const rootDirs = modeFilteredDirs
    .filter(d => !d.parent)
    .filter(d => uploadMode !== 'public' || currentUser?.role !== 'TEACHER' || allowedDirIds.has(d.id));

  // Knowledge tag management
  const [tagInput, setTagInput] = useState('');

  // Personal mode folder creation states
  const [newPersonalDirName, setNewPersonalDirName] = useState('');
  const [creatingDir, setCreatingDir] = useState(false);
  const [showInlineCreateDir, setShowInlineCreateDir] = useState(false);
  const [newPersonalDirParentId, setNewPersonalDirParentId] = useState<number | null>(null);

  const handleCreatePersonalDirInline = async () => {
    if (!newPersonalDirName.trim() || !currentUser) return;
    setCreatingDir(true);
    try {
      const response = await axios.post('/api/directories/', {
        user_id: currentUser.id,
        name: newPersonalDirName.trim(),
        is_public: false,
        attributes: '{}',
        parent: newPersonalDirParentId
      });
      alert('Tạo thư mục cá nhân thành công!');
      setNewPersonalDirName('');
      setNewPersonalDirParentId(null);
      setShowInlineCreateDir(false);
      
      // Refresh directories list
      await onRefreshDirs();
      
      // Select the newly created directory if we got the id back from backend
      if (response.data && response.data.id) {
        setSelectedDirId(response.data.id);
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi tạo thư mục cá nhân.');
    } finally {
      setCreatingDir(false);
    }
  };

  // Upload form state (right side)
  const [parsing, setParsing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [selectedLops, setSelectedLops] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState('');
  const [selectedKnowledge, setSelectedKnowledge] = useState<string[]>([]);
  const [parsedActivities, setParsedActivities] = useState<any[]>([]);
  const [knowledgeSearch, setKnowledgeSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedTrack, setSelectedTrack] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [selectedBiologyConnections, setSelectedBiologyConnections] = useState<string[]>([]);
  const [biologySearch, setBiologySearch] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');

  const toggleLop = (val: string) => {
    setSelectedLops(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    if (selectedFile.name.endsWith('.docx')) {
      setParsing(true);
      setUploadError(null);
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        const apiBase = localStorage.getItem('kms_api_base_url') || import.meta.env.VITE_API_BASE_URL || '';
        const cleanApiBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
        const res = await fetch(`${cleanApiBase}/api/lesson-plans/parse-docx/`, {
          method: 'POST',
          body: formData
        });
        if (!res.ok) throw new Error('Parsing failed');
        const data = await res.json();
        
        if (data.title) setTitle(data.title);
        if (data.description) setDescription(data.description);
        if (data.target_students && Array.isArray(data.target_students)) {
          // Map backend strings to exact frontend options
          const mappedTargets: string[] = [];
          data.target_students.forEach((t: string) => {
            if (t.toLowerCase().includes('thành thị')) mappedTargets.push('Học sinh thành thị');
            else if (t.toLowerCase().includes('nông thôn')) mappedTargets.push('Học sinh nông thôn');
            else mappedTargets.push(t);
          });
          setSelectedTargets(mappedTargets);
        }
        if (data.lesson_type) {
          setSelectedType(data.lesson_type);
        }
        if (data.knowledge_tags && Array.isArray(data.knowledge_tags)) {
          setSelectedKnowledge(data.knowledge_tags);
        }
        if (data.activities && Array.isArray(data.activities)) {
          setParsedActivities(data.activities);
        }
        if (data.attributes) {
          if (data.attributes['Mạch kiến thức']) setSelectedTrack(data.attributes['Mạch kiến thức']);
          if (data.attributes['Chủ đề']) setSelectedTopic(data.attributes['Chủ đề']);
          if (data.attributes['Kiến thức sinh học liên quan']) {
            const bioVal = data.attributes['Kiến thức sinh học liên quan'];
            setSelectedBiologyConnections(
              Array.isArray(bioVal) ? bioVal : (typeof bioVal === 'string' ? bioVal.split(',').map(s => s.trim()) : [])
            );
          }
          if (data.attributes['Địa điểm']) setSelectedLocation(data.attributes['Địa điểm']);
          if (data.attributes['lop'] || data.attributes['Lớp']) {
            const lopVal = data.attributes['lop'] || data.attributes['Lớp'];
            setSelectedLops(Array.isArray(lopVal) ? lopVal : [lopVal]);
          }
        }
      } catch (err) {
        console.error('Auto-extraction error:', err);
      } finally {
        setParsing(false);
      }
    } else if (selectedFile.name.endsWith('.md') || selectedFile.name.endsWith('.markdown') || selectedFile.name.endsWith('.txt')) {
      // Auto-prefill the title with the file name (excluding the extension) for Markdown/text documents!
      const baseName = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.'));
      setTitle(baseName);
      if (selectedTargets.length === 0) {
        setSelectedTargets(['Học sinh thành thị']);
      }
      if (selectedLops.length === 0) {
        setSelectedLops(['Lớp 10']);
      }
      if (!selectedType) {
        setSelectedType('Lý thuyết');
      }
    }
  };

  // Determine the currently selected directory
  const currentDir = directories.find(d => d.id === selectedDirId) || null;

  // All knowledge tags from all directories (for search)
  const allKnowledgeTags: { tag: string; path: string }[] = [];
  directories.forEach(dir => {
    const tags: string[] = dir.attributes?.knowledge_tags || [];
    const buildPath = (d: Directory): string => {
      const parent = directories.find(p => p.id === d.parent);
      return parent ? buildPath(parent) + ' / ' + d.name : d.name;
    };
    tags.forEach(tag => allKnowledgeTags.push({ tag, path: buildPath(dir) }));
  });

  // Knowledge tags from selected directory and ancestors
  const getTagsForDir = (dirId: number | null): { tag: string; path: string }[] => {
    if (!dirId) return allKnowledgeTags;
    const result: { tag: string; path: string }[] = [];
    const visit = (id: number) => {
      const dir = directories.find(d => d.id === id);
      if (!dir) return;
      const tags: string[] = dir.attributes?.knowledge_tags || [];
      const buildPath = (d: Directory): string => {
        const parent = directories.find(p => p.id === d.parent);
        return parent ? buildPath(parent) + ' / ' + d.name : d.name;
      };
      tags.forEach(tag => result.push({ tag, path: buildPath(dir) }));
      if (dir.parent) visit(dir.parent);
    };
    // Also include all child directories
    const visitChildren = (id: number) => {
      directories.filter(d => d.parent === id).forEach(d => {
        const tags: string[] = d.attributes?.knowledge_tags || [];
        const buildPath = (dd: Directory): string => {
          const parent = directories.find(p => p.id === dd.parent);
          return parent ? buildPath(parent) + ' / ' + dd.name : dd.name;
        };
        tags.forEach(tag => result.push({ tag, path: buildPath(d) }));
        visitChildren(d.id);
      });
    };
    visit(dirId);
    visitChildren(dirId);
    // Deduplicate
    const seen = new Set<string>();
    return result.filter(r => { if (seen.has(r.tag)) return false; seen.add(r.tag); return true; });
  };

  const availableTags = getTagsForDir(selectedDirId).filter(
    ({ tag }) => !knowledgeSearch || tag.toLowerCase().includes(knowledgeSearch.toLowerCase())
  );

  // Check if current user can manage tags in selected dir
  const canManageTags = currentUser && (
    currentUser.role === 'ADMIN' ||
    (currentUser.role === 'TEACHER' && currentDir && currentDir.user === currentUser.id)
  );

  // Add knowledge tag to current directory
  const handleAddTag = async () => {
    if (!tagInput.trim() || !selectedDirId || !currentDir) return;
    const existingTags: string[] = currentDir.attributes?.knowledge_tags || [];
    if (existingTags.includes(tagInput.trim())) { setTagInput(''); return; }
    const newTags = [...existingTags, tagInput.trim()];
    try {
      await axios.patch(`/api/directories/${selectedDirId}/`, {
        attributes: { ...currentDir.attributes, knowledge_tags: newTags }
      });
      onRefreshDirs();
      setTagInput('');
    } catch { alert('Lỗi thêm kiến thức.'); }
  };

  // Remove knowledge tag from directory
  const handleRemoveTag = async (dirId: number, tag: string) => {
    const dir = directories.find(d => d.id === dirId);
    if (!dir) return;
    const newTags = (dir.attributes?.knowledge_tags || []).filter((t: string) => t !== tag);
    try {
      await axios.patch(`/api/directories/${dirId}/`, {
        attributes: { ...dir.attributes, knowledge_tags: newTags }
      });
      onRefreshDirs();
    } catch { alert('Lỗi xóa kiến thức.'); }
  };

  // File drop handling
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileChange(dropped);
  };

  const toggleTarget = (val: string) => {
    setSelectedTargets(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const toggleKnowledge = (tag: string) => {
    setSelectedKnowledge(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  // Submit upload
  const handleSubmit = async () => {
    if (!file || !title.trim() || !currentUser) {
      setUploadError('Vui lòng điền tiêu đề và chọn file.');
      return;
    }
    
    if (uploadMode === 'personal') {
      if (modeFilteredDirs.length === 0) {
        setUploadError('Bạn chưa có thư mục cá nhân nào. Hãy tạo thư mục cá nhân mới ở phần chọn thư mục trước khi lưu.');
        return;
      }
      if (!selectedDirId) {
        setUploadError('Vui lòng chọn thư mục cá nhân để lưu tài liệu.');
        return;
      }
    } else {
      // Only regular users must select a directory (their upload goes to PENDING)
      if (currentUser.role === 'USER' && !selectedDirId) {
        setUploadError('Bạn phải chọn một thư mục trước khi tải bài giảng lên để gửi duyệt.');
        return;
      }
    }

    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('user_id', currentUser.id.toString());
      formData.append('title', title.trim());
      formData.append('description', description);
      formData.append('target_student', selectedTargets.join(', '));
      
      // Status logic:
      // PERSONAL MODE:
      //   - Always save as LOCAL (personal library)
      // PUBLIC MODE:
      //   - ADMIN → always PUBLISHED
      //   - TEACHER + manages target dir → PUBLISHED
      //   - TEACHER + no managed dirs or uploading to unmanaged dir → PENDING
      //   - USER → always PENDING (needs approval)
      let defaultStatus: string;
      if (uploadMode === 'personal') {
        // Personal mode: always save as LOCAL regardless of role
        defaultStatus = 'LOCAL';
      } else if (currentUser.role === 'ADMIN') {
        defaultStatus = selectedDirId ? 'PUBLISHED' : 'LOCAL';
      } else if (currentUser.role === 'TEACHER') {
        if (!selectedDirId) {
          defaultStatus = 'LOCAL';
        } else if (allowedDirIds.has(selectedDirId)) {
          defaultStatus = 'PUBLISHED';
        } else {
          defaultStatus = 'PENDING';
        }
      } else {
        defaultStatus = 'PENDING';
      }
      formData.append('status', defaultStatus);
      
      formData.append('attributes', JSON.stringify({
        'lop': selectedLops,
        'Mạch kiến thức': selectedTrack,
        'Chủ đề': selectedTopic,
        'Kiến thức sinh học liên quan': selectedBiologyConnections.join(', '),
        'Loại hình': selectedType,
        'Môn học': 'Hoạt động trải nghiệm Sinh học',
        'Địa điểm': selectedLocation,
        knowledge_tags: selectedBiologyConnections,
        tien_trinh_day_hoc: parsedActivities,
        ai_model_config: {
          ai_mode: localStorage.getItem('kms_ai_mode') || 'local',
          local_model: localStorage.getItem('kms_local_model') || '3b',
          api_key: localStorage.getItem('kms_api_key') || '',
          api_model: localStorage.getItem('kms_api_model') || 'gemini-1.5-flash'
        }
      }));
      if (selectedDirId) formData.append('directory_id', selectedDirId.toString());
      formData.append('file', file);

      const apiBase = localStorage.getItem('kms_api_base_url') || import.meta.env.VITE_API_BASE_URL || '';
      const cleanApiBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
      const res = await fetch(`${cleanApiBase}/api/lesson-plans/upload/`, { method: 'POST', body: formData });
      if (!res.ok) {
        try {
          const errData = await res.json();
          if (errData.error) {
            setUploadError(errData.error);
            if (errData.duplicate_id) {
              setDuplicateId(errData.duplicate_id);
            }
            setUploading(false);
            return;
          }
        } catch {}
        throw new Error('Upload failed');
      }
      const data = await res.json();
      onSuccess(data);
    } catch (err: any) {
      setUploadError('Lỗi khi tải lên bài giảng. Vui lòng thử lại.');
    } finally {
      setUploading(false);
    }
  };

  const tagsForCurrentDir: string[] = currentDir?.attributes?.knowledge_tags || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-800 dark:text-slate-200 font-sans transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-8 py-4 flex items-center gap-4 transition-colors">
        <button onClick={onBack} className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1">
          ← Trang chủ
        </button>
        <span className="text-gray-300">|</span>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">
          {uploadMode === 'personal' ? '💾 Lưu vào Thư viện Cá nhân' : '📢 Đăng bài giảng mới'}
        </h1>
        {uploadMode === 'personal' && (
          <span className="ml-2 px-2.5 py-0.5 bg-sky-100 text-sky-700 text-xs font-bold rounded-full border border-sky-200">Chế độ cá nhân</span>
        )}
      </div>

      <div className="max-w-[1400px] mx-auto p-6 grid grid-cols-[380px_1fr] gap-6">
        {/* Left Panel - Directory Tree */}
        <div className="flex flex-col gap-4">
          {/* Selected directory info */}
          <div className={`rounded-xl border px-4 py-3 flex items-center gap-2 transition-all ${
            selectedDirId ? 'border-blue-200 bg-blue-50' : 'border-dashed border-gray-200 bg-white'
          }`}>
            <span className="text-xl">{selectedDirId ? '📂' : '📁'}</span>
            <div className="flex-grow min-w-0">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Thư mục đích</p>
              {selectedDirId && currentDir ? (
                <p className="text-sm font-semibold text-blue-700 truncate">{currentDir.name}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">Chưa chọn thư mục</p>
              )}
            </div>
            {selectedDirId && (
              <button
                onClick={() => setSelectedDirId(null)}
                className="text-gray-400 hover:text-gray-600 text-xs px-2 py-1 rounded hover:bg-gray-100"
              >✕ Bỏ chọn</button>
            )}
          </div>

          {/* Directory Tree */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-850 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider font-bold">
                {uploadMode === 'personal' ? 'CÂY THƯ MỤC CÁ NHÂN' : 'CÂY THƯ MỤC CÔNG KHAI'}
              </p>
              {uploadMode === 'public' && currentUser?.role === 'TEACHER' && managedDirectoryIds.length > 0 && (
                <p className="text-[10px] text-blue-500">🔒 {allowedDirIds.size} thư mục có quyền</p>
              )}
            </div>
            <div className="p-2 max-h-[380px] overflow-y-auto">
              {uploadMode === 'personal' && (
                <div className="flex items-center gap-2 py-1.5 px-2 rounded-md mb-1 text-gray-400 dark:text-slate-500 italic select-none">
                  <span className="w-4"></span>
                  <span className="text-sky-500">📁</span>
                  <span className="flex-grow truncate text-sm">Tất cả tài liệu cá nhân</span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{modeFilteredDirs.length}</span>
                </div>
              )}

              {rootDirs.length === 0 ? (
                <div className="px-2 py-4 text-center">
                  <p className="text-sm text-gray-400 italic mb-3">
                    {uploadMode === 'personal'
                      ? 'Bạn chưa có thư mục cá nhân nào.'
                      : currentUser?.role === 'TEACHER' ? 'Không có thư mục nào bạn được cấp quyền.' : 'Chưa có thư mục nào.'}
                  </p>
                </div>
              ) : (
                rootDirs.map(dir => (
                  <TreeNode key={dir.id} dir={dir} depth={0} />
                ))
              )}

              {uploadMode === 'personal' && (
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-850">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInlineCreateDir(!showInlineCreateDir);
                      setNewPersonalDirParentId(null);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-2 py-1.5 rounded-md text-xs text-sky-600 hover:bg-sky-50 transition-colors border border-dashed border-sky-300 font-bold"
                  >
                    <span>{showInlineCreateDir ? '✕ Hủy tạo' : '+ Thêm thư mục cá nhân gốc'}</span>
                  </button>

                  {showInlineCreateDir && (
                    <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-850 rounded-xl space-y-3">
                      <p className="text-xs font-bold text-gray-600 dark:text-slate-400">Tạo thư mục cá nhân mới</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Tên thư mục..."
                          value={newPersonalDirName}
                          onChange={e => setNewPersonalDirName(e.target.value)}
                          className="flex-grow text-xs border border-gray-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-850 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                        <button
                          type="button"
                          onClick={handleCreatePersonalDirInline}
                          disabled={!newPersonalDirName.trim() || creatingDir}
                          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                        >
                          Tạo
                        </button>
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-400 mb-0.5">Thư mục cha (tùy chọn):</label>
                        <select
                          value={newPersonalDirParentId || ''}
                          onChange={e => setNewPersonalDirParentId(e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full text-xs bg-white dark:bg-slate-850 border border-gray-200 dark:border-slate-750 text-gray-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
                        >
                          <option value="">-- Thư mục gốc --</option>
                          {getDirectoriesAsTreeOptions(selectableDirs).map(d => (
                            <option key={d.id} value={d.id}>
                              {d.visualPrefix}{d.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Knowledge Tags Panel */}
          {currentDir && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 transition-colors">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Kiến thức thư mục</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">Thêm, sửa, xóa kiến thức cho thư mục này</p>

              {canManageTags && (
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                    placeholder="Nhập hoặc tìm kiếm kiến thức..."
                    className="flex-grow text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                  >Thêm</button>
                </div>
              )}

              <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto">
                {tagsForCurrentDir.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Chưa có kiến thức nào.</p>
                ) : (
                  tagsForCurrentDir.map(tag => (
                    <div key={tag} className="flex items-center justify-between border border-gray-100 dark:border-slate-850 rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
                      <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{tag}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-900/30">{currentDir.name}</span>
                        {canManageTags && (
                          <button onClick={() => handleRemoveTag(currentDir.id, tag)} className="text-red-400 hover:text-red-600 text-xs w-4 h-4 flex items-center justify-center">✕</button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="flex flex-col gap-5">
          {/* File Drop Zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${dragOver ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/40' : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 hover:bg-blue-50/30 dark:hover:bg-blue-950/10'}`}
          >
            <input ref={fileInputRef} type="file" accept=".docx,.pdf,.ppt,.pptx" className="hidden" onChange={e => e.target.files && handleFileChange(e.target.files[0])} />
            {parsing ? (
              <div className="flex flex-col items-center justify-center py-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
                <p className="font-semibold text-blue-600 dark:text-blue-400 text-sm">⚡ Đang tự động trích xuất thông tin giáo án...</p>
                <p className="text-xs text-gray-400 dark:text-slate-450 mt-1">Hệ thống đang bóc tách tiêu đề, mục tiêu, hoạt động...</p>
              </div>
            ) : file ? (
              <>
                <div className="text-4xl mb-2">📄</div>
                <p className="font-semibold text-gray-800 dark:text-slate-200">{file.name}</p>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                <button onClick={e => { e.stopPropagation(); setFile(null); }} className="mt-3 text-xs text-red-500 hover:text-red-700">Xóa file</button>
              </>
            ) : (
              <>
                <div className="text-5xl mb-3 text-gray-300 dark:text-slate-650">☁️</div>
                <p className="font-medium text-gray-600 dark:text-slate-350">Kéo thả file vào đây</p>
                <p className="text-sm text-gray-400 dark:text-slate-450 mb-3">hoặc click để chọn file</p>
                <span className="text-xs bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-350 px-3 py-1 rounded-full border border-gray-200 dark:border-slate-700">.docx &nbsp; .pdf &nbsp; .ppt</span>
              </>
            )}
          </div>

          {/* Destination Directory Selector */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 transition-colors">
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-350 mb-2 flex items-center justify-between">
              <span>
                {uploadMode === 'personal' ? '📁 Thư mục cá nhân lưu trữ' : '📂 Thư mục công khai lưu trữ'}
                <span className="text-red-500"> *</span>
              </span>
              {uploadMode === 'personal' && modeFilteredDirs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowInlineCreateDir(!showInlineCreateDir)}
                  className="text-xs text-blue-600 hover:text-blue-800 dark:text-sky-400 dark:hover:text-sky-300 font-bold"
                >
                  {showInlineCreateDir ? '✕ Hủy tạo' : '➕ Tạo thư mục mới'}
                </button>
              )}
            </label>

            {uploadMode === 'personal' && (modeFilteredDirs.length === 0 || showInlineCreateDir) ? (
              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl space-y-3">
                <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">
                  {modeFilteredDirs.length === 0 
                    ? '⚠️ Bạn chưa có thư mục cá nhân nào. Hãy nhập tên bên dưới để tạo thư mục cá nhân mới bắt buộc.' 
                    : 'Tạo thư mục cá nhân mới:'}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nhập tên thư mục mới..."
                    value={newPersonalDirName}
                    onChange={e => setNewPersonalDirName(e.target.value)}
                    className="flex-grow text-xs border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-850 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <button
                    type="button"
                    onClick={handleCreatePersonalDirInline}
                    disabled={!newPersonalDirName.trim() || creatingDir}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 whitespace-nowrap"
                  >
                    {creatingDir ? 'Đang tạo...' : 'Tạo & Chọn'}
                  </button>
                </div>
                {modeFilteredDirs.length > 0 && (
                  <div className="flex flex-col">
                    <label className="text-[10px] text-gray-500 dark:text-slate-400 mb-1">Thư mục cha (tùy chọn):</label>
                    <select
                      value={newPersonalDirParentId || ''}
                      onChange={e => setNewPersonalDirParentId(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full text-xs bg-white dark:bg-slate-850 border border-gray-200 dark:border-slate-750 text-gray-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
                    >
                      <option value="">-- Thư mục gốc --</option>
                      {getDirectoriesAsTreeOptions(selectableDirs).map(d => (
                        <option key={d.id} value={d.id}>
                          {d.visualPrefix}{d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <select
                value={selectedDirId || ''}
                onChange={e => setSelectedDirId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full bg-white dark:bg-slate-850 border border-gray-200 dark:border-slate-750 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
              >
                <option value="">-- Chọn thư mục lưu trữ --</option>
                {getDirectoriesAsTreeOptions(selectableDirs).map(d => (
                  <option key={d.id} value={d.id}>
                    {d.visualPrefix}{d.name} {d.is_public ? '👥' : '🔒'}
                  </option>
                ))}
              </select>
            )}

            {file && !selectedDirId && uploadMode === 'personal' && (
              <p className="text-xs text-red-500 mt-2 font-medium">⚠️ Bạn phải chọn hoặc tạo một thư mục cá nhân để lưu tài liệu này.</p>
            )}
          </div>

          {/* Title */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 transition-colors">
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-350 mb-2">Tiêu đề bài giảng <span className="text-red-500">*</span></label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Nhập tiêu đề bài giảng..." className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          {/* Description */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 transition-colors">
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-350 mb-2">Mô tả / Tóm tắt</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Mô tả ngắn về nội dung bài giảng..." className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
          </div>

          {/* Target Student */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 transition-colors">
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-350 mb-3">Đối tượng giảng dạy <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              {['Học sinh thành thị', 'Học sinh nông thôn'].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => toggleTarget(val)}
                  className={`py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors ${selectedTargets.includes(val) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-350 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800'}`}
                >{val}</button>
              ))}
            </div>
          </div>

          {/* Lớp học */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 transition-colors">
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-350 mb-3">Lớp học (Áp dụng) <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-3 gap-3">
              {['Lớp 10', 'Lớp 11', 'Lớp 12'].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => toggleLop(val)}
                  className={`py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors ${selectedLops.includes(val) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-350 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800'}`}
                >{val}</button>
              ))}
            </div>
          </div>

          {/* Mạch kiến thức */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 transition-colors">
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-350 mb-2">Mạch kiến thức <span className="text-red-500">*</span></label>
            <select
              value={selectedTrack}
              onChange={e => {
                const track = e.target.value;
                setSelectedTrack(track);
                setSelectedTopic(''); // Reset topic when track changes
              }}
              className="w-full bg-white dark:bg-slate-850 border border-gray-200 dark:border-slate-750 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
            >
              <option value="">-- Chọn Mạch kiến thức --</option>
              {KNOWLEDGE_TRACKS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Chủ đề */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 transition-colors">
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-350 mb-2">Chủ đề <span className="text-red-500">*</span></label>
            <select
              value={selectedTopic}
              onChange={e => setSelectedTopic(e.target.value)}
              disabled={!selectedTrack}
              className="w-full bg-white dark:bg-slate-850 border border-gray-200 dark:border-slate-750 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <option value="">-- {selectedTrack ? 'Chọn Chủ đề' : 'Vui lòng chọn Mạch kiến thức trước' } --</option>
              {selectedTrack && TRACK_TO_TOPICS[selectedTrack]?.map(topic => (
                <option key={topic} value={topic}>{topic}</option>
              ))}
            </select>
          </div>

          {/* Kiến thức sinh học liên quan */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 transition-colors">
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-350 mb-1 flex items-center gap-1">
              <span>🧬</span> Kiến thức sinh học liên quan <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-400 dark:text-slate-450 mb-3 font-medium">Chọn các kiến thức sinh học liên quan tích hợp</p>

            {/* Suggested from Selected Directory */}
            {currentDir && tagsForCurrentDir.length > 0 && (
              <div className="mb-4 bg-blue-50/50 dark:bg-blue-950/20 p-3.5 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <p className="text-xs font-bold text-blue-750 dark:text-blue-400 mb-2 flex items-center gap-1.5">
                  <span>💡</span> Gợi ý Kiến thức thư mục [{currentDir.name}]:
                </p>
                <div className="flex flex-wrap gap-2">
                  {tagsForCurrentDir.map(tag => {
                    const isSelected = selectedBiologyConnections.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setSelectedBiologyConnections(prev => 
                            prev.includes(tag) ? prev.filter(b => b !== tag) : [...prev, tag]
                          );
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-left text-xs transition-all font-medium ${
                          isSelected 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20' 
                            : 'bg-white dark:bg-slate-800 border-blue-200 hover:border-blue-300 dark:border-slate-700 text-gray-700 dark:text-slate-350 hover:bg-blue-50/50 dark:hover:bg-slate-750'
                        }`}
                      >
                        <span className="text-[10px]">{isSelected ? '✓' : '+'}</span>
                        <span>{tag}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input
                type="text"
                value={biologySearch}
                onChange={e => setBiologySearch(e.target.value)}
                placeholder="Tìm kiếm mạch kiến thức sinh học..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-850 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            
            <div className="grid grid-cols-1 gap-2 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin">
              {BIOLOGY_CONNECTIONS.filter(bio => bio.toLowerCase().includes(biologySearch.toLowerCase())).map(bio => {
                const isSelected = selectedBiologyConnections.includes(bio);
                return (
                  <button
                    key={bio}
                    type="button"
                    onClick={() => {
                      setSelectedBiologyConnections(prev => 
                        prev.includes(bio) ? prev.filter(b => b !== bio) : [...prev, bio]
                      );
                    }}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-100 dark:border-slate-800 hover:border-blue-200 hover:bg-blue-50 dark:hover:bg-slate-800'}`}
                  >
                    <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center text-[10px] ${isSelected ? 'bg-white border-white text-blue-600' : 'border-gray-300'}`}>
                      {isSelected && '✓'}
                    </span>
                    <span className="break-words font-medium">{bio}</span>
                  </button>
                );
              })}
            </div>
            {selectedBiologyConnections.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selectedBiologyConnections.map(b => (
                  <span key={b} className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs px-2.5 py-1 rounded-full border border-emerald-200/30">
                    {b}
                    <button type="button" onClick={() => setSelectedBiologyConnections(prev => prev.filter(x => x !== b))} className="text-emerald-400 hover:text-emerald-700 transition-colors font-bold">✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Lesson Type */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 transition-colors">
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-350 mb-3">Loại hình tiết dạy <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              {['Thực hành', 'Lý thuyết'].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setSelectedType(val === selectedType ? '' : val)}
                  className={`py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors ${selectedType === val ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-350 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800'}`}
                >{val}</button>
              ))}
            </div>
          </div>

          {/* Địa điểm / Phòng thiết bị */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 transition-colors">
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-350 mb-2">Địa điểm / Phòng thiết bị <span className="text-red-500">*</span></label>
            <select
              value={selectedLocation}
              onChange={e => setSelectedLocation(e.target.value)}
              className="w-full bg-white dark:bg-slate-850 border border-gray-200 dark:border-slate-750 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
            >
              <option value="">-- Chọn Địa điểm / Phòng thiết bị --</option>
              {LOCATIONS.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Submit */}
          {uploadError && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 rounded-xl px-5 py-4 text-sm flex flex-col gap-3">
              <p className="font-semibold flex items-center gap-1.5 leading-relaxed">
                <span>⚠️</span> {uploadError}
              </p>
              {duplicateId && onViewDuplicate && (
                <div className="flex flex-wrap gap-2.5 mt-1 border-t border-red-100 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadError(null);
                      setDuplicateId(null);
                    }}
                    className="px-4 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    ✏️ Chỉnh sửa thông tin
                  </button>
                  <button
                    type="button"
                    onClick={() => onViewDuplicate(duplicateId)}
                    className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-100"
                  >
                    👁️ Xem tài liệu đã có
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Notice based on upload mode */}
          {uploadMode === 'personal' ? (
            <div className="bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/30 rounded-xl px-4 py-3 text-sm text-sky-700 dark:text-sky-400">
              💾 Tài liệu sẽ được lưu vào <strong>Thư viện cá nhân</strong> của bạn (LOCAL). Chỉ bạn mới xem được.
            </div>
          ) : (
            <>
              {/* Notice for regular users */}
              {currentUser && currentUser.role === 'USER' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
                  ⚠️ Bài giảng của bạn sẽ được lưu ở trạng thái <strong>Chờ duyệt</strong>. Giáo viên hoặc Admin có thẩm quyền sẽ xem xét và phê duyệt.
                </div>
              )}
              {/* Notice for Teacher uploading to unmanaged dir */}
              {currentUser && currentUser.role === 'TEACHER' && selectedDirId && !allowedDirIds.has(selectedDirId) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
                  ⚠️ Thư mục này không thuộc quyền quản lý của bạn. Bài giảng sẽ ở trạng thái <strong>Chờ duyệt</strong>.
                </div>
              )}
              {/* Notice for Teacher with no dir selected */}
              {currentUser && currentUser.role === 'TEACHER' && !selectedDirId && (
                <div className="bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/30 rounded-xl px-4 py-3 text-sm text-sky-700 dark:text-sky-400">
                  💾 Không chọn thư mục → bài giảng sẽ được lưu vào <strong>Thư viện cá nhân</strong> của bạn (LOCAL).
                </div>
              )}
            </>
          )}

          <button
            onClick={handleSubmit}
            disabled={uploading || !file || !title.trim()}
            className={`w-full py-4 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2 ${
              uploading || !file || !title.trim()
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : uploadMode === 'personal'
                ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-lg shadow-sky-200'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 hover:shadow-blue-300'
            }`}
          >
            {uploading ? (
              <><span className="animate-spin">⟳</span> Đang tải lên...</>
            ) : uploadMode === 'personal' ? (
              <><span>💾</span> Lưu vào thư viện cá nhân</>
            ) : currentUser?.role === 'ADMIN' ? (
              <><span>📢</span> Đăng bài giảng công khai</>
            ) : currentUser?.role === 'TEACHER' && selectedDirId && allowedDirIds.has(selectedDirId) ? (
              <><span>📢</span> Đăng bài giảng</>
            ) : currentUser?.role === 'TEACHER' && !selectedDirId ? (
              <><span>💾</span> Lưu vào thư viện cá nhân</>
            ) : (
              <><span>📨</span> Gửi để duyệt</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
