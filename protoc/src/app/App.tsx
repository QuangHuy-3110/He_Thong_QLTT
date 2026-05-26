import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import UploadPage from './UploadPage';
import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer";
import { saveAs } from 'file-saver';
import { renderAsync } from 'docx-preview';

const getFileUrl = (url: string | undefined | null) => {
  if (!url) return '';

  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.pathname.startsWith('/media/')) {
      return parsed.pathname + parsed.search + parsed.hash;
    }

    if (parsed.href.startsWith('http://') || parsed.href.startsWith('https://')) {
      return parsed.pathname + parsed.search + parsed.hash;
    }
  } catch {
    // Ignore invalid URL objects and continue falling back to relative handling
  }

  if (url.startsWith('/media/')) return url;
  if (url.startsWith('media/')) return '/' + url;
  return '/media/' + url;
};

const getLessonFileUrl = (lesson: LessonPlan) => {
  return getFileUrl(lesson.file_url || lesson.file_path);
};

const getFileName = (url: string | undefined | null) => {
  if (!url) return 'download';
  try {
    const parsed = new URL(url, window.location.href);
    const pathname = parsed.pathname;
    return decodeURIComponent(pathname.split('/').filter(Boolean).pop() || 'download');
  } catch {
    return decodeURIComponent(url.split('/').filter(Boolean).pop() || 'download');
  }
};

const downloadFile = async (lesson: LessonPlan) => {
  const fileUrl = getLessonFileUrl(lesson);
  if (!fileUrl) {
    alert('Không tìm thấy đường dẫn tệp.');
    return;
  }

  const fileName = getFileName(lesson.file_url || lesson.file_path);
  try {
    // Vanilla fetch is clean and bypasses Axios custom authorization headers/CORS blocks!
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error('Không thể tải file.');
    const blob = await response.blob();
    // Save to device using the file-saver library!
    saveAs(blob, fileName);
  } catch (err) {
    console.error('Download error, falling back:', err);
    // Secure fallback: Trigger browser standard same-origin download click
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

function removeAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

interface Creator {
  id: number;
  full_name: string;
  username: string;
  email: string;
}

interface Directory {
  id: number;
  name: string;
  is_public: boolean;
  attributes: any;
  parent: number | null;
  user?: number;
}

interface LessonPlan {
  id: number;
  title: string;
  description: string;
  target_student: string;
  status: string;
  creator: Creator;
  created_at: string;
  file_path?: string;
  file_url?: string;
  attributes?: any;
  directory_ids?: number[];
  directory_names?: string[];
  latest_feedback?: string | null;
}

interface Activity {
  ten_hoat_dong: string;
  thoi_gian: string;
  tom_tat: string;
}

interface LessonActivitiesTimelineProps {
  activities?: Activity[];
}

const LessonActivitiesTimeline: React.FC<LessonActivitiesTimelineProps> = ({ activities }) => {
  if (!activities || !Array.isArray(activities) || activities.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tiến trình dạy học (Tóm tắt hoạt động)</h4>
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="relative border-l-2 border-blue-100 ml-3 pl-6 space-y-6 py-2">
          {activities.map((act, index) => (
            <div key={index} className="relative">
              {/* Connector Dot */}
              <span className="absolute -left-[31px] top-1 bg-white border-2 border-blue-500 rounded-full w-4.5 h-4.5 flex items-center justify-center shadow-sm">
                <span className="bg-blue-500 rounded-full w-2 h-2"></span>
              </span>
              
              {/* Node content */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1 justify-between">
                <h5 className="font-bold text-gray-800 text-sm leading-snug">{act.ten_hoat_dong}</h5>
                <span className="inline-flex self-start sm:self-auto items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-100/60 shadow-sm whitespace-nowrap">
                  ⏱️ {act.thoi_gian || '10 phút'}
                </span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed font-medium">
                {act.tom_tat || 'Tổ chức hoạt động giảng dạy trải nghiệm thực tế.'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
}

// Count lessons in a directory and all its descendants (deduplicated)
function countLessonsInDir(dirId: number, directories: Directory[], allLessons: LessonPlan[]): number {
  return getLessonsInDir(dirId, directories, allLessons).length;
}

// Collect all lesson IDs in a directory and its descendants
function getLessonsInDir(dirId: number, directories: Directory[], allLessons: LessonPlan[]): LessonPlan[] {
  const childIds = directories.filter(d => d.parent === dirId).map(d => d.id);
  const direct = allLessons.filter(l => l.directory_ids?.includes(dirId));
  const childLessons = childIds.flatMap(cid => getLessonsInDir(cid, directories, allLessons));
  // Deduplicate
  const seen = new Set<number>();
  return [...direct, ...childLessons].filter(l => { if (seen.has(l.id)) return false; seen.add(l.id); return true; });
}

// Get the full breadcrumb path of a directory (e.g., "Sinh học / Vi sinh vật")
function getDirectoryFullPath(dirId: string | number, dirs: Directory[]): string {
  const path: string[] = [];
  let currentId: string | number | null = dirId;
  const visited = new Set<string | number>();

  while (currentId !== null && currentId !== undefined && currentId !== '') {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    
    const found = dirs.find(d => d.id.toString() === currentId!.toString());
    if (found) {
      path.unshift(found.name);
      currentId = found.parent || null;
    } else {
      break;
    }
  }
  return path.join(' / ');
}

interface DirectoryOption {
  id: number;
  name: string;
  is_public: boolean;
  depth: number;
  visualPrefix: string;
}

const getDirectoriesAsTreeOptions = (
  dirs: Directory[], 
  filterFn?: (d: Directory) => boolean
): DirectoryOption[] => {
  const baseDirs = filterFn ? dirs.filter(filterFn) : dirs;
  const childrenMap = new Map<number | null, Directory[]>();
  baseDirs.forEach(d => {
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

  const activeIds = new Set(baseDirs.map(d => d.id));
  const roots = baseDirs.filter(d => !d.parent || !activeIds.has(d.parent));
  roots.sort((a, b) => a.name.localeCompare(b.name));
  
  roots.forEach((root, index) => {
    result.push({
      id: root.id,
      name: root.name,
      is_public: root.is_public,
      depth: 0,
      visualPrefix: '📂 '
    });
    traverse(root.id, 1, '');
  });

  return result;
};

const DirectoryNode = ({
  dir: dirProp, directories, selectedDirs, onToggleDir,
  allLessons, currentUser, onAddChild, onDelete, onRename, onTogglePublic, onFileClick, depth = 0
}: any) => {
  // Always use the latest version of this dir from the directories array
  const dir = directories.find((d: any) => d.id === dirProp.id) || dirProp;
  const children = directories.filter((d: any) => d.parent === dir.id);
  const isSelected = selectedDirs.includes(dir.id);
  const [expanded, setExpanded] = useState(depth < 2);
  const [hovered, setHovered] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(dir.name);

  const dirFiles = useMemo(() => {
    return (allLessons || []).filter((l: any) => l.directory_ids?.includes(dir.id));
  }, [dir.id, allLessons]);

  const count = useMemo(() => countLessonsInDir(dir.id, directories, allLessons), [dir.id, directories, allLessons]);

  const handleRenameSubmit = () => {
    if (renameVal.trim() && renameVal.trim() !== dir.name) {
      onRename(dir.id, renameVal.trim());
    }
    setRenaming(false);
  };

  return (
    <div className="mt-0.5">
      <div
        className={`flex items-center gap-1 py-1.5 px-2 rounded-md transition-colors ${
          isSelected ? 'bg-blue-50' : 'hover:bg-gray-100'
        }`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Expand/collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-4 h-4 flex items-center justify-center text-xs text-gray-400 hover:text-gray-700 flex-shrink-0 ${(children.length === 0 && dirFiles.length === 0) ? 'opacity-0 pointer-events-none' : ''}`}
        >
          {expanded ? '▼' : '▶'}
        </button>

        {/* Checkbox */}
        <input
          type="checkbox"
          className="rounded border-gray-400 text-blue-600 cursor-pointer flex-shrink-0 w-3.5 h-3.5"
          checked={isSelected}
          onChange={() => onToggleDir(dir.id)}
          onClick={e => e.stopPropagation()}
        />

        {/* Folder icon — shows lock if not allowed to manage, otherwise folder */}
        {(() => {
          const isAllowedToManage = currentUser && (currentUser.role === 'ADMIN' || dir.user === currentUser.id);
          if (currentUser && !isAllowedToManage) {
            return (
              <span className="flex-shrink-0 text-sm" title="Thư mục đã khóa (Không có quyền quản lý)">
                🔒
              </span>
            );
          }
          return (
            <span className="flex-shrink-0 text-sm" title={dir.is_public ? 'Thư mục công khai' : 'Thư mục riêng tư'}>
              {dir.is_public ? '📁' : '📁'}
            </span>
          );
        })()}

        {/* Name (or rename input) */}
        {renaming ? (
          <input
            autoFocus
            value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={e => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') { setRenaming(false); setRenameVal(dir.name); } }}
            className="flex-grow text-sm border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span
            className={`text-sm truncate flex-grow cursor-pointer ${isSelected ? 'text-blue-700 font-semibold' : 'text-gray-700'}`}
            onClick={() => onToggleDir(dir.id)}
          >
            {dir.name}
          </span>
        )}

        {/* Count badge */}
        {count > 0 && !renaming && (
          <span className="flex-shrink-0 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
            {count}
          </span>
        )}

        {/* Action buttons on hover */}
        {currentUser && hovered && !renaming && (currentUser.role === 'ADMIN' || dir.user === currentUser.id) && (
          <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button
              title="Thêm thư mục con"
              onClick={() => onAddChild(dir.id)}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-blue-100 text-blue-500 text-xs font-bold"
            >+</button>
            <button
              title="Đổi tên"
              onClick={() => { setRenaming(true); setRenameVal(dir.name); }}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-yellow-100 text-yellow-600 text-xs"
            >✏</button>
            {/* Toggle public - ADMIN or owner TEACHER */}
            {(currentUser.role === 'ADMIN' || dir.user === currentUser.id) && (
              <button
                title={dir.is_public ? 'Chuyển sang riêng tư' : 'Xuất bản công khai'}
                onClick={() => {
                  if (typeof onTogglePublic === 'function') {
                    onTogglePublic(dir.id, dir.is_public);
                  }
                }}
                className={`w-5 h-5 flex items-center justify-center rounded text-xs transition-colors ${
                  dir.is_public
                    ? 'hover:bg-orange-100 text-orange-500'
                    : 'hover:bg-green-100 text-green-600'
                }`}
              >
                {dir.is_public ? '🔓' : '🌐'}
              </button>
            )}
            <button
              title="Xóa thư mục"
              onClick={() => onDelete(dir.id, dir.name)}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 text-red-500 text-xs"
            >✕</button>
          </div>
        )}
      </div>

      {expanded && (children.length > 0 || dirFiles.length > 0) && (
        <div className="border-l border-gray-200 ml-5 pl-1">
          {children.map((child: any) => (
            <DirectoryNode
              key={child.id}
              dir={child}
              directories={directories}
              selectedDirs={selectedDirs}
              onToggleDir={onToggleDir}
              allLessons={allLessons}
              currentUser={currentUser}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onRename={onRename}
              onTogglePublic={onTogglePublic}
              onFileClick={onFileClick}
              depth={depth + 1}
            />
          ))}
          {dirFiles.map((file: any) => (
            <div
              key={file.id}
              onClick={() => onFileClick && onFileClick(file)}
              className="flex items-center gap-2 py-1.5 px-3 rounded-xl hover:bg-blue-50/70 cursor-pointer transition-colors text-xs text-gray-600 font-medium my-0.5 mr-2"
              style={{ marginLeft: 20 }}
            >
              <span className="flex-shrink-0 text-sm">📄</span>
              <span className="truncate flex-grow hover:underline hover:text-blue-700 font-semibold text-gray-750">{file.title}</span>
              <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black border uppercase tracking-wider flex-shrink-0 ${
                file.status === 'PUBLISHED'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : file.status === 'PENDING'
                  ? 'bg-amber-50 text-amber-700 border-amber-100'
                  : 'bg-sky-50 text-sky-700 border-sky-100'
              }`}>
                {file.status === 'PUBLISHED' ? 'Public' : file.status === 'PENDING' ? 'Pending' : 'Local'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DocxPreview: React.FC<{ fileUrl: string }> = ({ fileUrl }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const loadDocx = async () => {
      try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error('Không thể tải file tài liệu.');
        const blob = await response.blob();
        
        if (active && containerRef.current) {
          containerRef.current.innerHTML = '';
          // Render docx directly into the div container locally & offline!
          await renderAsync(blob, containerRef.current, undefined, {
            className: "docx",
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
            experimental: true,
          });
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Docx rendering error:', err);
        if (active) {
          setError(err.message || 'Lỗi khi hiển thị tài liệu Word.');
          setLoading(false);
        }
      }
    };

    loadDocx();

    return () => {
      active = false;
    };
  }, [fileUrl]);

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {loading && (
        <div className="flex flex-col items-center justify-center p-20 text-gray-500">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-sm font-medium animate-pulse">Đang tải và xử lý tài liệu Word offline...</p>
        </div>
      )}
      {error && (
        <div className="p-8 text-center text-red-600 bg-red-50 rounded-xl border border-red-100 m-4">
          ⚠️ {error}
        </div>
      )}
      <div 
        ref={containerRef} 
        className="flex-grow overflow-auto p-6 bg-gray-50/50 docx-preview-container rounded-xl shadow-inner border border-gray-200/50"
        style={{ minHeight: '500px', maxHeight: '650px' }}
      />
    </div>
  );
};


// ─── Recursive helper: collect all dir IDs a user can manage (by explicit grant + children) ───
function getAllDescendantIds(dirId: number, directories: Directory[]): number[] {
  const children = directories.filter(d => d.parent === dirId);
  return [dirId, ...children.flatMap(c => getAllDescendantIds(c.id, directories))];
}

// ─── Permission Tree Node for Admin Modal (cascading check) ───
const PermissionDirTreeNode = ({
  dir, directories, selectedIds, onToggle, depth, allLessonPlans = [], onFileClick
}: {
  dir: Directory;
  directories: Directory[];
  selectedIds: number[];
  onToggle: (id: number, descendants: number[], checked: boolean) => void;
  depth: number;
  allLessonPlans?: LessonPlan[];
  onFileClick?: (file: LessonPlan) => void;
}) => {
  const children = directories.filter(d => d.parent === dir.id);
  const isChecked = selectedIds.includes(dir.id);
  const [expanded, setExpanded] = useState(true);
  const descendants = getAllDescendantIds(dir.id, directories).slice(1); // exclude self
  const dirFiles = allLessonPlans.filter(l => l.directory_ids?.includes(dir.id));

  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div className={`flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors ${ isChecked ? 'bg-purple-50' : 'hover:bg-gray-50' }`}>
        <button
          onClick={() => setExpanded(e => !e)}
          className={`w-4 h-4 flex items-center justify-center text-[10px] text-gray-400 hover:text-gray-600 flex-shrink-0 ${(children.length === 0 && dirFiles.length === 0) ? 'invisible' : ''}`}
        >
          {expanded ? '▼' : '▶'}
        </button>
        <input
          type="checkbox"
          checked={isChecked}
          onChange={e => onToggle(dir.id, descendants, e.target.checked)}
          className="rounded border-gray-300 text-purple-600 focus:ring-purple-400 w-4 h-4 cursor-pointer flex-shrink-0"
        />
        <span className="text-sm flex-shrink-0">{dir.is_public ? '📂' : '📁'}</span>
        <span className={`text-sm truncate flex-grow ${ isChecked ? 'font-semibold text-purple-800' : 'text-gray-700' }`}>{dir.name}</span>
        {isChecked && descendants.length > 0 && (
          <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">+{descendants.length} con</span>
        )}
      </div>
      {expanded && (children.length > 0 || dirFiles.length > 0) && (
        <div className="border-l-2 border-purple-100 ml-4 pl-1">
          {children.map(child => (
            <PermissionDirTreeNode
              key={child.id}
              dir={child}
              directories={directories}
              selectedIds={selectedIds}
              onToggle={onToggle}
              depth={0}
              allLessonPlans={allLessonPlans}
              onFileClick={onFileClick}
            />
          ))}
          {dirFiles.map(file => (
            <div
              key={file.id}
              onClick={() => onFileClick && onFileClick(file)}
              className="flex items-center gap-2 py-1.5 px-3 rounded-xl hover:bg-purple-50/50 cursor-pointer transition-colors text-xs text-gray-600 font-medium my-0.5"
              style={{ marginLeft: 20 }}
            >
              <span className="flex-shrink-0 text-sm">📄</span>
              <span className="truncate flex-grow hover:underline hover:text-purple-705 font-semibold text-gray-750">{file.title}</span>
              <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black border uppercase tracking-wider ${
                file.status === 'PUBLISHED'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : file.status === 'PENDING'
                  ? 'bg-amber-50 text-amber-700 border-amber-100'
                  : 'bg-sky-50 text-sky-700 border-sky-100'
              }`}>
                {file.status === 'PUBLISHED' ? 'Public' : file.status === 'PENDING' ? 'Pending' : 'Local'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Personal Directory Tree Node for Admin Modal (read-only list) ───
const PersonalDirTreeNode = ({
  dir, directories, depth
}: { dir: Directory; directories: Directory[]; depth: number }) => {
  const children = directories.filter(d => d.parent === dir.id);
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50/50">
        <button
          onClick={() => setExpanded(e => !e)}
          className={`w-4 h-4 flex items-center justify-center text-[10px] text-gray-400 hover:text-gray-600 flex-shrink-0 ${children.length === 0 ? 'invisible' : ''}`}
        >
          {expanded ? '▼' : '▶'}
        </button>
        <span className="text-sm flex-shrink-0">📁</span>
        <span className="text-sm truncate text-gray-700 font-medium">{dir.name}</span>
      </div>
      {expanded && children.length > 0 && (
        <div className="border-l border-gray-200 ml-4 pl-1">
          {children.map(child => (
            <PersonalDirTreeNode
              key={child.id}
              dir={child}
              directories={directories}
              depth={0}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const MarkdownViewer: React.FC<{ markdown: string }> = ({ markdown }) => {
  if (!markdown) {
    return <div className="text-gray-400 italic p-6 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">Không có nội dung Markdown được trích xuất cho giáo án này.</div>;
  }

  const lines = markdown.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let inList = false;
  let listItems: string[] = [];
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  const flushList = (key: string) => {
    if (listItems.length > 0) {
      renderedElements.push(
        <ul key={key} className="list-disc pl-6 my-4 space-y-2 text-gray-700 text-sm">
          {listItems.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const flushTable = (key: string) => {
    if (tableHeaders.length > 0 || tableRows.length > 0) {
      renderedElements.push(
        <div key={key} className="overflow-x-auto my-5 border border-gray-200 rounded-xl shadow-sm bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm text-left">
            <thead className="bg-slate-50 font-semibold text-slate-700 border-b border-gray-200">
              <tr>
                {tableHeaders.map((h, idx) => (
                  <th key={idx} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150 text-gray-600 bg-white">
              {tableRows.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-slate-50/50 transition-colors">
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="px-4 py-3 max-w-xs break-words" title={cell}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableHeaders = [];
      tableRows = [];
      inTable = false;
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const key = `line-${index}`;

    if (trimmed.startsWith('|')) {
      flushList(key + '-pre-tbl');
      inTable = true;
      const cells = trimmed
        .split('|')
        .map(c => c.trim())
        .filter((c, i, arr) => i > 0 && i < arr.length - 1);
      
      if (trimmed.includes('---')) {
        return;
      }
      
      if (tableHeaders.length === 0) {
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      return;
    } else {
      flushTable(key + '-pre-non-tbl');
    }

    if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('•')) {
      inList = true;
      const cleanText = trimmed.replace(/^[-*•]\s*/, '');
      listItems.push(cleanText);
      return;
    } else {
      flushList(key + '-pre-non-list');
    }

    if (trimmed.startsWith('# ')) {
      renderedElements.push(<h1 key={key} className="text-xl sm:text-2xl font-bold text-gray-900 mt-6 mb-4 border-b pb-2 border-slate-100">{trimmed.slice(2)}</h1>);
    } else if (trimmed.startsWith('## ')) {
      renderedElements.push(<h2 key={key} className="text-lg font-bold text-slate-800 mt-5 mb-3">{trimmed.slice(3)}</h2>);
    } else if (trimmed.startsWith('### ')) {
      renderedElements.push(<h3 key={key} className="text-sm sm:text-base font-bold text-blue-600 mt-4 mb-2.5">{trimmed.slice(4)}</h3>);
    } else if (trimmed === '---') {
      renderedElements.push(<hr key={key} className="my-6 border-slate-200" />);
    } else if (trimmed) {
      let text = trimmed;
      const parts = text.split('**');
      if (parts.length > 1) {
        const lineContent: React.ReactNode[] = [];
        parts.forEach((part, pIdx) => {
          if (pIdx % 2 === 1) {
            lineContent.push(<strong key={pIdx} className="font-semibold text-gray-900">{part}</strong>);
          } else {
            lineContent.push(part);
          }
        });
        renderedElements.push(<p key={key} className="text-sm text-gray-650 leading-relaxed my-2.5">{lineContent}</p>);
      } else {
        renderedElements.push(<p key={key} className="text-sm text-gray-650 leading-relaxed my-2.5">{trimmed}</p>);
      }
    }
  });

  flushList('final-list');
  flushTable('final-table');

  return (
    <div className="bg-slate-50/50 rounded-2xl border border-gray-150 p-6 leading-relaxed max-w-none text-slate-800 shadow-inner">
      <div className="bg-white rounded-xl border border-gray-200/80 p-6 shadow-sm">
        {renderedElements}
      </div>
    </div>
  );
};

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderSnippet(content: string | undefined | null, query: string): React.ReactNode {
  if (!content || !query.trim()) return null;
  
  const queryClean = query.trim().toLowerCase();
  const contentLower = content.toLowerCase();
  const idx = contentLower.indexOf(queryClean);
  
  let snippet = "";
  let startIdx = 0;
  let endIdx = 0;
  
  if (idx !== -1) {
    startIdx = Math.max(0, idx - 40);
    endIdx = Math.min(content.length, idx + queryClean.length + 80);
    snippet = content.slice(startIdx, endIdx);
    if (startIdx > 0) snippet = "..." + snippet;
    if (endIdx < content.length) snippet = snippet + "...";
  } else {
    // Fallback if not found in content body
    snippet = content.slice(0, 100);
    if (content.length > 100) snippet += "...";
  }
  
  const parts = snippet.split(new RegExp(`(${escapeRegExp(queryClean)})`, 'gi'));
  return (
    <div className="text-[11px] text-slate-500 bg-amber-50/20 border border-amber-100/50 rounded-xl p-3 my-3 leading-relaxed max-w-none shadow-sm">
      <span className="text-[9px] font-extrabold text-amber-600 block uppercase mb-1 tracking-wider">🎯 Kết quả tìm thấy trong nội dung:</span>
      <p className="line-clamp-2 italic text-gray-650">
        {parts.map((part, i) => 
          part.toLowerCase() === queryClean
            ? <mark key={i} className="bg-yellow-200 text-yellow-900 font-bold px-1 rounded-sm shadow-sm">{part}</mark>
            : part
        )}
      </p>
    </div>
  );
}

export default function App() {
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [directories, setDirectories] = useState<Directory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'home' | 'upload' | 'admin'>('home');
  const [homeTab, setHomeTab] = useState<'library' | 'history' | 'personal'>('library');
  const [uploadMode, setUploadMode] = useState<'personal' | 'public'>('public');
  
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = sessionStorage.getItem('currentUser');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return null; }
    }
    return null;
  });
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Admin user management and folder permission states
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [selectedUserForPerms, setSelectedUserForPerms] = useState<any | null>(null);
  const [selectedUserDirIds, setSelectedUserDirIds] = useState<number[]>([]);

  // Admin CRUD states
  const [showCreateUserForm, setShowCreateUserForm] = useState<boolean>(false);
  const [newUsername, setNewUsername] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newFullName, setNewFullName] = useState<string>('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'TEACHER' | 'USER'>('TEACHER');

  const [editUsername, setEditUsername] = useState<string>('');
  const [editPassword, setEditPassword] = useState<string>('');
  const [editFullName, setEditFullName] = useState<string>('');
  const [editRole, setEditRole] = useState<'ADMIN' | 'TEACHER' | 'USER'>('TEACHER');

  const [adminSearchQuery, setAdminSearchQuery] = useState<string>('');
  const [adminRoleFilter, setAdminRoleFilter] = useState<string>('ALL');
  const [adminActiveTab, setAdminActiveTab] = useState<'profile' | 'permissions'>('profile');
  const [adminPermissionSubTab, setAdminPermissionSubTab] = useState<'personal' | 'public'>('personal');

  useEffect(() => {
    if (selectedUserForPerms) {
      setEditUsername(selectedUserForPerms.username || '');
      setEditFullName(selectedUserForPerms.full_name || '');
      setEditRole(selectedUserForPerms.role || 'TEACHER');
      setEditPassword('');
      if (selectedUserForPerms.role === 'USER') {
        setAdminPermissionSubTab('personal');
      }
      fetchDirectories();
      fetchLessonPlans();
    }
  }, [selectedUserForPerms]);

  useEffect(() => {
    if (editRole === 'USER') {
      setAdminPermissionSubTab('personal');
    }
  }, [editRole]);

  // Current teacher's own managed directory IDs (fetched on login)
  const [myManagedDirIds, setMyManagedDirIds] = useState<number[]>([]);

  // Lesson plan approval states
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [selectedApproval, setSelectedApproval] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<string>('');

  // Rating & Comment states
  const [lessonRatings, setLessonRatings] = useState<any[]>([]);
  const [ratingAvg, setRatingAvg] = useState<number>(0);
  const [ratingTotal, setRatingTotal] = useState<number>(0);
  const [myRating, setMyRating] = useState<number>(0);
  const [myComment, setMyComment] = useState<string>('');
  const [ratingLoading, setRatingLoading] = useState<boolean>(false);
  const [ratingSubmitting, setRatingSubmitting] = useState<boolean>(false);
  const [showRatingSection, setShowRatingSection] = useState<boolean>(false);
  const [selectedStarFilter, setSelectedStarFilter] = useState<string>('all');
  const [editingMyReview, setEditingMyReview] = useState<boolean>(false);

  const starStats = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    lessonRatings.forEach((r: any) => {
      const rating = Number(r.rating);
      if (rating >= 1 && rating <= 5) {
        counts[rating as keyof typeof counts] += 1;
      }
    });
    const total = lessonRatings.length;
    return {
      counts,
      total,
      percentages: {
        5: total > 0 ? Math.round((counts[5] / total) * 100) : 0,
        4: total > 0 ? Math.round((counts[4] / total) * 100) : 0,
        3: total > 0 ? Math.round((counts[3] / total) * 100) : 0,
        2: total > 0 ? Math.round((counts[2] / total) * 100) : 0,
        1: total > 0 ? Math.round((counts[1] / total) * 100) : 0,
      }
    };
  }, [lessonRatings]);

  const otherReviews = useMemo(() => {
    let list = lessonRatings;
    if (currentUser) {
      list = list.filter((r: any) => r.user_id !== currentUser.id);
    }
    if (selectedStarFilter !== 'all') {
      list = list.filter((r: any) => String(r.rating) === selectedStarFilter);
    }
    return list;
  }, [lessonRatings, currentUser, selectedStarFilter]);

  const fetchAdminUsers = async () => {
    if (!currentUser || currentUser.role !== 'ADMIN') return;
    try {
      const res = await axios.get(`/api/admin/users/?admin_id=${currentUser.id}`);
      setAdminUsers(res.data);
    } catch (err) {
      console.error('Error fetching admin users:', err);
    }
  };

  // Fetch the current teacher's own managed directory IDs
  const fetchMyPermissions = async () => {
    if (!currentUser || currentUser.role !== 'TEACHER') { setMyManagedDirIds([]); return; }
    try {
      const res = await axios.get(`/api/users/me/permissions/?user_id=${currentUser.id}`);
      setMyManagedDirIds(res.data.managed_directories || []);
    } catch {
      setMyManagedDirIds([]);
    }
  };

  const fetchPendingApprovals = async () => {
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'TEACHER')) return;
    try {
      const res = await axios.get(`/api/approval-requests/?user_id=${currentUser.id}`);
      setPendingApprovals(res.data);
    } catch (err) {
      console.error('Error fetching pending approvals:', err);
    }
  };

  const handleActionApproval = async (reqId: number, action: 'APPROVE' | 'REJECT', currentFeedback: string = '') => {
    if (!currentUser) return;
    try {
      await axios.patch(`/api/approval-requests/${reqId}/`, {
        user_id: currentUser.id,
        action: action,
        feedback: currentFeedback
      });
      alert(action === 'APPROVE' ? 'Đã duyệt bài giảng thành công!' : 'Đã từ chối bài giảng!');
      setSelectedApproval(null);
      setFeedback('');
      fetchPendingApprovals();
      fetchLessonPlans(searchQuery); // Refresh list
    } catch (err) {
      alert('Lỗi xét duyệt bài giảng.');
    }
  };

  useEffect(() => {
    if (showAdminModal) {
      fetchAdminUsers();
    }
  }, [showAdminModal]);

  useEffect(() => {
    if (showApprovalModal) {
      fetchPendingApprovals();
    }
  }, [showApprovalModal]);

  const handleSaveUserPermissions = async () => {
    if (!currentUser || !selectedUserForPerms) return;
    try {
      await axios.post(`/api/admin/users/${selectedUserForPerms.id}/permissions/`, {
        admin_id: currentUser.id,
        directory_ids: selectedUserDirIds
      });
      alert('Cập nhật quyền quản trị thư mục thành công!');
      // Refetch directories to update locked/unlocked folder ownership in real-time
      const url = currentUser ? `/api/directories/?user_id=${currentUser.id}` : '/api/directories/';
      const freshRes = await axios.get(url);
      setDirectories(freshRes.data);
      fetchAdminUsers();
    } catch (err) {
      alert('Lỗi cập nhật phân quyền.');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.role !== 'ADMIN') return;
    if (!newUsername || !newPassword) {
      alert('Tên tài khoản và mật khẩu là bắt buộc.');
      return;
    }
    try {
      await axios.post('/api/admin/users/', {
        admin_id: currentUser.id,
        username: newUsername,
        password: newPassword,
        full_name: newFullName,
        role: newRole
      });
      alert('Tạo tài khoản thành công!');
      setShowCreateUserForm(false);
      // Reset fields
      setNewUsername('');
      setNewPassword('');
      setNewFullName('');
      setNewRole('TEACHER');
      fetchAdminUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Lỗi khi tạo tài khoản.');
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedUserForPerms) return;
    try {
      const response = await axios.patch(`/api/admin/users/${selectedUserForPerms.id}/`, {
        admin_id: currentUser.id,
        username: editUsername,
        password: editPassword || undefined,
        full_name: editFullName,
        role: editRole
      });
      alert('Cập nhật thông tin tài khoản thành công!');
      setEditPassword('');
      // Update local state for selected user
      setSelectedUserForPerms(response.data.user);
      fetchAdminUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Lỗi khi cập nhật tài khoản.');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!currentUser) return;
    const targetUser = adminUsers.find(u => u.id === userId);
    if (targetUser && targetUser.role === 'ADMIN') {
      alert('Không được phép xóa tài khoản Quản trị viên (bao gồm bản thân và quản trị viên khác).');
      return;
    }
    if (!window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản này không? Mọi dữ liệu liên quan sẽ bị ảnh hưởng.')) {
      return;
    }
    try {
      await axios.delete(`/api/admin/users/${userId}/?admin_id=${currentUser.id}`);
      alert('Đã xóa tài khoản thành công!');
      setSelectedUserForPerms(null);
      fetchAdminUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Lỗi khi xóa tài khoản.');
    }
  };

  const handleToggleLockUser = async (user: any) => {
    if (!currentUser) return;
    if (user.role === 'ADMIN') {
      alert('Không được phép khóa/mở khóa tài khoản Quản trị viên (bao gồm bản thân và quản trị viên khác).');
      return;
    }
    const actionText = user.is_active ? 'khóa' : 'mở khóa';
    if (!window.confirm(`Bạn có chắc chắn muốn ${actionText} tài khoản @${user.username} không?`)) {
      return;
    }
    try {
      const response = await axios.patch(`/api/admin/users/${user.id}/`, {
        admin_id: currentUser.id,
        is_active: !user.is_active
      });
      alert(`Đã ${actionText} tài khoản thành công!`);
      setSelectedUserForPerms(response.data.user);
      fetchAdminUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || `Lỗi khi ${actionText} tài khoản.`);
    }
  };
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDirs, setSelectedDirs] = useState<number[]>([]);
  const [selectedPersonalDirs, setSelectedPersonalDirs] = useState<number[]>([]);

  // Personal Library Search & Sort
  const [personalSearchQuery, setPersonalSearchQuery] = useState('');
  const [personalSortBy, setPersonalSortBy] = useState<string>('date_desc');
  
  // States for Proposing to Public
  const [showProposeModal, setShowProposeModal] = useState<boolean>(false);
  const [lessonToPropose, setLessonToPropose] = useState<LessonPlan | null>(null);
  const [targetPublicDirId, setTargetPublicDirId] = useState<string>('');
  const [proposeError, setProposeError] = useState<string | null>(null);
  const [proposeDuplicateId, setProposeDuplicateId] = useState<number | null>(null);
  
  const [selectedTargetStudents, setSelectedTargetStudents] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedTietDay, setSelectedTietDay] = useState<string[]>([]);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState<boolean>(false);

  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string, checked: boolean) => {
    if (checked) setter(prev => [...prev, value]);
    else setter(prev => prev.filter(v => v !== value));
  };

  const handleToggleDir = (dirId: number) => {
    setSelectedDirs(prev => prev.includes(dirId) ? prev.filter(d => d !== dirId) : [...prev, dirId]);
  };

  // UI States for Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDirModal, setShowDirModal] = useState(false);
  const [selectedLessonForDetail, setSelectedLessonForDetail] = useState<LessonPlan | null>(null);
  const [previewMode, setPreviewMode] = useState<'docx' | 'markdown'>('docx');
  const [selectedCreatorForProfile, setSelectedCreatorForProfile] = useState<User | null>(null);

  // Profile Settings States
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [profileFullName, setProfileFullName] = useState<string>('');
  const [profileCurrentPassword, setProfileCurrentPassword] = useState<string>('');
  const [profileNewPassword, setProfileNewPassword] = useState<string>('');
  const [profileConfirmNewPassword, setProfileConfirmNewPassword] = useState<string>('');
  const [profileAvatar, setProfileAvatar] = useState<File | null>(null);
  const [profileAvatarPreview, setProfileAvatarPreview] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState<boolean>(false);

  useEffect(() => {
    if (showProfileModal && currentUser) {
      setProfileFullName(currentUser.full_name || '');
      setProfileCurrentPassword('');
      setProfileNewPassword('');
      setProfileConfirmNewPassword('');
      setProfileAvatar(null);
      setProfileAvatarPreview(null);
      setProfileError(null);
      setProfileSuccess(null);
    }
  }, [showProfileModal, currentUser]);

  // Upload Form
  const [upTitle, setUpTitle] = useState('');
  const [upDesc, setUpDesc] = useState('');
  const [upGrade, setUpGrade] = useState('');
  const [upDirId, setUpDirId] = useState('');
  const [upAttrs, setUpAttrs] = useState('{}');
  const [upFile, setUpFile] = useState<File | null>(null);

  // Edit Form
  const [editingLesson, setEditingLesson] = useState<LessonPlan | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editGrade, setEditGrade] = useState('');
  const [editDirId, setEditDirId] = useState('');
  const [editAttrs, setEditAttrs] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);


  // Dir Form
  const [dirName, setDirName] = useState('');
  const [dirParentId, setDirParentId] = useState('');
  const [dirIsPublic, setDirIsPublic] = useState(false);
  const [dirAttrs, setDirAttrs] = useState('{}');

  // Pagination & Sorting States
  const [sortBy, setSortBy] = useState<string>('date_desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // All lessons (unfiltered) for counting and client-side filtering
  const [allLessonPlans, setAllLessonPlans] = useState<LessonPlan[]>([]);
  const [unfilteredLessons, setUnfilteredLessons] = useState<LessonPlan[]>([]);

  const fetchLessonPlans = async (query: string = '') => {
    setLoading(true);
    try {
      let url = '/api/lesson-plans/';
      const params = new URLSearchParams();
      if (currentUser) params.append('user_id', currentUser.id.toString());
      if (query.trim()) params.append('q', query.trim());
      
      selectedClasses.forEach(c => params.append('lop', c));
      selectedTypes.forEach(t => params.append('type', t));
      selectedSubjects.forEach(s => params.append('subject', s));
      
      const paramStr = params.toString();
      if (paramStr) url += `?${paramStr}`;
      
      const response = await axios.get(url);
      setAllLessonPlans(response.data);

      // Fetch unfiltered lessons to keep the filter sidebar properties stable
      let unfilteredUrl = '/api/lesson-plans/';
      if (currentUser) unfilteredUrl += `?user_id=${currentUser.id}`;
      const unfilteredResponse = await axios.get(unfilteredUrl);
      setUnfilteredLessons(unfilteredResponse.data);

      setError(null);
    } catch (err) {
      setError('Lỗi khi tải dữ liệu từ máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDirectories = async () => {
    try {
      let url = '/api/directories/';
      if (currentUser) url += `?user_id=${currentUser.id}`;
      const response = await axios.get(url);
      setDirectories(response.data);
    } catch (err) {
      console.error('Lỗi tải thư mục:', err);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfileAvatar(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setProfileAvatarPreview(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (profileNewPassword && profileNewPassword !== profileConfirmNewPassword) {
      setProfileError('Mật khẩu mới và xác nhận mật khẩu không khớp.');
      return;
    }

    setProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const formData = new FormData();
      formData.append('user_id', currentUser.id.toString());
      formData.append('full_name', profileFullName);
      if (profileNewPassword) {
        formData.append('new_password', profileNewPassword);
      }
      if (profileCurrentPassword) {
        formData.append('current_password', profileCurrentPassword);
      }
      if (profileAvatar) {
        formData.append('avatar', profileAvatar);
      }

      const response = await axios.post('/api/users/me/profile/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setProfileSuccess(response.data.message || 'Cập nhật thông tin cá nhân thành công!');
      
      // Update local storage and currentUser state
      const updatedUser = response.data.user;
      setCurrentUser(updatedUser);
      sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
      
      // Clear password fields
      setProfileCurrentPassword('');
      setProfileNewPassword('');
      setProfileConfirmNewPassword('');
      setProfileAvatar(null);
      setProfileAvatarPreview(null);
    } catch (err: any) {
      console.error(err);
      setProfileError(err.response?.data?.error || 'Có lỗi xảy ra khi cập nhật thông tin.');
    } finally {
      setProfileSaving(false);
    }
  };

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    fetchLessonPlans(debouncedSearchQuery);
  }, [currentUser, debouncedSearchQuery, selectedClasses, selectedTypes, selectedSubjects, selectedTietDay]);

  useEffect(() => {
    setPersonalSearchQuery(debouncedSearchQuery);
  }, [debouncedSearchQuery]);

  useEffect(() => {
    fetchDirectories();
  }, [currentUser]);

  useEffect(() => {
    fetchPendingApprovals();
  }, [currentUser]);

  useEffect(() => {
    fetchMyPermissions();
  }, [currentUser]);

  useEffect(() => {
    if (selectedLessonForDetail) {
      setPreviewMode('docx');
      setRatingLoading(true);
      setSelectedStarFilter('all');
      setEditingMyReview(false);
      axios.get(`/api/lesson-plans/${selectedLessonForDetail.id}/ratings/`)
        .then(res => {
          setLessonRatings(res.data.ratings);
          setRatingAvg(res.data.average_rating);
          setRatingTotal(res.data.total_ratings);
          if (currentUser) {
            const mine = res.data.ratings.find((r: any) => r.user_id === currentUser.id);
            if (mine) {
              setMyRating(mine.rating);
              setMyComment(mine.comment || '');
            } else {
              setMyRating(0);
              setMyComment('');
            }
          }
        })
        .catch(err => {
          console.error("Lỗi khi tải bình luận:", err);
        })
        .finally(() => {
          setRatingLoading(false);
        });
    } else {
      setLessonRatings([]);
      setMyRating(0);
      setMyComment('');
      setSelectedStarFilter('all');
      setEditingMyReview(false);
    }
  }, [selectedLessonForDetail, currentUser]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/login/', { username, password });
      sessionStorage.setItem('currentUser', JSON.stringify(response.data.user));
      setCurrentUser(response.data.user);
      setShowAuthModal(false);
      setAuthError(null);
    } catch (err) {
      setAuthError('Đăng nhập thất bại. Kiểm tra lại thông tin.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/register/', { username, password, full_name: fullName, role: 'USER' });
      setAuthError('Đăng ký thành công! Đang chuyển sang đăng nhập...');
      setTimeout(() => setAuthMode('LOGIN'), 1500);
    } catch (err) {
      setAuthError('Lỗi đăng ký. Tên người dùng có thể đã tồn tại.');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('currentUser');
    setCurrentUser(null);
    setSearchQuery('');
    setSelectedDirs([]);
    setHomeTab('library');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleCreateDir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    try {
      await axios.post('/api/directories/', {
        user_id: currentUser.id,
        name: dirName,
        is_public: currentUser.role === 'ADMIN' ? dirIsPublic : false,
        attributes: dirAttrs,
        parent: dirParentId || null
      });
      alert('Tạo thư mục thành công!');
      setShowDirModal(false);
      setDirName('');
      setDirParentId('');
      setDirAttrs('{}');
      setDirIsPublic(false);
      fetchDirectories();
    } catch (err) {
      alert('Lỗi tạo thư mục.');
    }
  };

  const handleAddChildDir = (parentId: number) => {
    setDirParentId(parentId.toString());
    setDirName('');
    setDirAttrs('{}');
    setDirIsPublic(false);
    setShowDirModal(true);
  };

  const handleDeleteDir = async (id: number, name: string) => {
    if (!window.confirm(`Xóa thư mục "${name}"? Tài liệu bên trong sẽ không bị xóa nhưng sẽ mất liên kết.`)) return;
    try {
      await axios.delete(`/api/directories/${id}/`);
      setSelectedDirs(prev => prev.filter(d => d !== id));
      fetchDirectories();
    } catch (err) {
      alert('Lỗi xóa thư mục.');
    }
  };

  const getBase64 = (file: File): Promise<{name: string, data: string}> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve({ name: file.name, data: reader.result as string });
      reader.onerror = error => reject(error);
    });
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !upFile) return;
    
    try {
      const formData = new FormData();
      formData.append('user_id', currentUser.id.toString());
      formData.append('title', upTitle);
      formData.append('description', upDesc);
      formData.append('target_student', upGrade);
      formData.append('status', 'LOCAL');
      formData.append('attributes', upAttrs);
      if (upDirId) formData.append('directory_id', upDirId);
      formData.append('file', upFile);

      const response = await fetch('/api/lesson-plans/upload/', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error('Upload failed with status ' + response.status);
      
      alert('Tải lên thành công (Lưu cục bộ)!');
      setShowUploadModal(false);
      setUpFile(null);
      fetchLessonPlans(searchQuery);
    } catch (err) {
      console.error('Upload Error:', err);
      alert('Lỗi khi tải lên. Vui lòng kiểm tra console.');
    }
  };

  const handleDeleteLesson = async (id: number) => {
    if (!window.confirm('Bạn có chắc muốn xóa tài liệu này?')) return;
    try {
      await fetch(`/api/lesson-plans/${id}/`, { method: 'DELETE' });
      alert('Xóa thành công!');
      fetchLessonPlans(searchQuery);
    } catch (err) {
      alert('Lỗi khi xóa.');
    }
  };

  const handleRenameDir = async (id: number, newName: string) => {
    // Optimistic update
    setDirectories(prev => prev.map(d => d.id === id ? { ...d, name: newName } : d));
    try {
      await axios.patch(`/api/directories/${id}/`, { name: newName });
      // Refresh from server to confirm
      const url = currentUser ? `/api/directories/?user_id=${currentUser.id}` : '/api/directories/';
      const res = await axios.get(url);
      setDirectories(res.data);
    } catch (err) {
      console.error('Rename dir error:', err);
      fetchDirectories(); // Rollback
      alert('Lỗi đổi tên thư mục.');
    }
  };

  const handleTogglePublicDir = async (id: number, currentIsPublic: boolean) => {
    console.log("handleTogglePublicDir called with id:", id, "currentIsPublic:", currentIsPublic);
    const action = currentIsPublic ? 'chuyển sang riêng tư' : 'xuất bản công khai';
    if (!window.confirm(`Bạn có chắc muốn ${action} thư mục này?`)) {
      console.log("User cancelled confirm dialog");
      return;
    }
    console.log("User confirmed. Performing optimistic update...");
    // Optimistic update
    setDirectories(prev => prev.map(d => d.id === id ? { ...d, is_public: !currentIsPublic } : d));
    try {
      const res = await axios.patch(
        `/api/directories/${id}/`,
        { is_public: !currentIsPublic }
      );
      console.log('Toggle public API success:', res.data);
      // Refresh from server
      const url = currentUser ? `/api/directories/?user_id=${currentUser.id}` : '/api/directories/';
      const freshRes = await axios.get(url);
      setDirectories(freshRes.data);
    } catch (err: any) {
      console.error('Toggle public error:', err?.response?.data || err);
      fetchDirectories(); // Rollback
      alert('Lỗi cập nhật trạng thái thư mục: ' + (err?.response?.data ? JSON.stringify(err.response.data) : err.message));
    }
  };

  const openEditModal = (lesson: LessonPlan) => {
    setEditingLesson(lesson);
    setEditTitle(lesson.title);
    setEditDesc(lesson.description);
    setEditGrade(lesson.target_student);
    setEditDirId(lesson.directory_ids && lesson.directory_ids.length > 0 ? lesson.directory_ids[0].toString() : '');
    setEditAttrs(JSON.stringify(lesson.attributes));
    setEditFile(null);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLesson || !currentUser) return;
    
    try {
      const formData = new FormData();
      // Send user_id so backend can determine role-based approval rules
      formData.append('user_id', currentUser.id.toString());
      formData.append('title', editTitle);
      formData.append('description', editDesc);
      formData.append('target_student', editGrade);
      formData.append('directory_id', editDirId);
      formData.append('attributes', editAttrs);
      if (editFile) {
        formData.append('file_path', editFile);
      }

      const response = await fetch(`/api/lesson-plans/${editingLesson.id}/`, {
        method: 'PATCH',
        body: formData
      });
      if (!response.ok) {
        try {
          const errData = await response.json();
          if (errData.error) {
            alert(errData.error);
            return;
          }
        } catch {}
        throw new Error('Edit failed with status ' + response.status);
      }

      const msg = currentUser.role === 'USER'
        ? 'Đã gửi bản chỉnh sửa để chờ duyệt lại!'
        : 'Cập nhật thành công!';
      alert(msg);
      setEditingLesson(null);
      setEditFile(null);
      fetchLessonPlans(searchQuery);
    } catch (err: any) {
      console.error('Edit Error:', err);
      alert('Lỗi cập nhật tài liệu: ' + err.message);
    }
  };

  const openProposeModal = (lesson: LessonPlan) => {
    setLessonToPropose(lesson);
    setTargetPublicDirId('');
    setProposeError(null);
    setProposeDuplicateId(null);
    setShowProposeModal(true);

    if (currentUser) {
      axios.post(`/api/lesson-plans/${lesson.id}/check-duplicate/`, {
        user_id: currentUser.id,
        status: 'PENDING'
      })
      .then(res => {
        if (res.data.is_duplicate) {
          setProposeError(res.data.error);
          setProposeDuplicateId(res.data.duplicate_id);
        }
      })
      .catch(err => {
        console.error("Lỗi kiểm tra trùng lặp tự động:", err);
      });
    }
  };

  const handleProposePublic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonToPropose || !targetPublicDirId || !currentUser) return;
    setProposeError(null);
    setProposeDuplicateId(null);
    try {
      const res = await axios.post(`/api/lesson-plans/${lessonToPropose.id}/propose/`, {
        user_id: currentUser.id,
        directory_id: parseInt(targetPublicDirId)
      });
      alert(res.data.message || 'Đã gửi đề xuất công khai thành công!');
      setShowProposeModal(false);
      setLessonToPropose(null);
      setTargetPublicDirId('');
      fetchLessonPlans(searchQuery);
    } catch (err: any) {
      if (err.response?.data?.error) {
        setProposeError(err.response.data.error);
        if (err.response.data.duplicate_id) {
          setProposeDuplicateId(err.response.data.duplicate_id);
        }
      } else {
        setProposeError('Lỗi gửi đề xuất: ' + err.message);
      }
    }
  };

  const handleWithdrawLesson = async (lessonId: number, action: 'delete' | 'retract') => {
    if (!currentUser) return;
    const labels = {
      delete: { confirm: 'Xóa vĩnh viễn bài giảng này? Không thể khôi phục lại.', success: 'Đã xóa bài giảng thành công!' },
      retract: { confirm: 'Thu hồi bài giảng về thư viện cá nhân? Bài sẽ biến mất khỏi thư viện chung và lịch sử đóng góp.', success: 'Đã thu hồi bài giảng về thư viện cá nhân!' }
    };
    if (!window.confirm(labels[action].confirm)) return;
    try {
      const res = await axios.post(`/api/lesson-plans/${lessonId}/withdraw/`, {
        user_id: currentUser.id,
        action
      });
      alert(res.data.message || labels[action].success);
      fetchLessonPlans(searchQuery);
    } catch (err: any) {
      alert('Lỗi: ' + (err.response?.data?.error || err.message));
    }
  };

  // Filter root directories (only public ones for the main Shared Library)
  const rootDirs = directories.filter(d => !d.parent && d.is_public);

  // Derive base lesson pool: filtered by selected directories (client-side) - Only show PUBLISHED plans in the Shared Library
  const dirFilteredLessons = useMemo(() => {
    const basePlans = (allLessonPlans || []).filter(l => l.status === 'PUBLISHED');
    if (selectedDirs.length === 0) return basePlans;
    const result = new Map<number, LessonPlan>();
    selectedDirs.forEach(dirId => {
      getLessonsInDir(dirId, directories, basePlans).forEach(l => result.set(l.id, l));
    });
    return Array.from(result.values());
  }, [selectedDirs, directories, allLessonPlans]);

  // Stable directory-only filtered pool for calculating available subjects in the sidebar
  const dirUnfilteredLessons = useMemo(() => {
    const basePlans = (unfilteredLessons || []).filter(l => l.status === 'PUBLISHED');
    if (selectedDirs.length === 0) return basePlans;
    const result = new Map<number, LessonPlan>();
    selectedDirs.forEach(dirId => {
      getLessonsInDir(dirId, directories, basePlans).forEach(l => result.set(l.id, l));
    });
    return Array.from(result.values());
  }, [selectedDirs, directories, unfilteredLessons]);

  // Dynamic subject list from current dir-filtered pool (stable when checking boxes)
  const availableSubjects = useMemo(() => {
    const subjects = new Set<string>();
    dirUnfilteredLessons.forEach(l => {
      const s = l.attributes?.['Môn học'];
      if (s) subjects.add(s);
    });
    return Array.from(subjects).sort();
  }, [dirUnfilteredLessons]);

  // Search & dynamic filters are fully executed on PostgreSQL Server-side.
  // We only apply the directory folder scope client-side here.
  const filteredLessonPlans = useMemo(() => {
    return dirFilteredLessons;
  }, [dirFilteredLessons]);

  // Auto-switch sort to Relevance when FTS query is active, and revert to Newest when empty
  useEffect(() => {
    if (debouncedSearchQuery.trim()) {
      setSortBy('relevance');
    } else {
      setSortBy('date_desc');
    }
  }, [debouncedSearchQuery]);

  // Sort the filtered plans based on current sort settings
  const sortedLessonPlans = useMemo(() => {
    const list = [...filteredLessonPlans];
    
    // Relevance order is already sorted by SearchRank at PostgreSQL server-side level
    if (sortBy === 'relevance') {
      return list;
    }
    
    list.sort((a, b) => {
      if (sortBy === 'date_desc') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'date_asc') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'rating_desc') {
        return (b.average_rating || 0) - (a.average_rating || 0);
      }
      if (sortBy === 'rating_asc') {
        return (a.average_rating || 0) - (b.average_rating || 0);
      }
      if (sortBy === 'total_desc') {
        return (b.total_ratings || 0) - (a.total_ratings || 0);
      }
      if (sortBy === 'total_asc') {
        return (a.total_ratings || 0) - (b.total_ratings || 0);
      }
      return 0;
    });
    return list;
  }, [filteredLessonPlans, sortBy]);

  // Paginate the sorted plans
  const paginatedLessonPlans = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedLessonPlans.slice(startIndex, startIndex + pageSize);
  }, [sortedLessonPlans, currentPage, pageSize]);

  // Reset page to 1 when filters or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDirs, selectedTargetStudents, selectedTypes, selectedSubjects, pageSize]);


  // Resolve managed directory IDs for the current teacher
  const currentUserManagedDirIds: number[] = myManagedDirIds;

  if (currentView === 'upload') {
    return (
      <UploadPage
        directories={directories}
        currentUser={currentUser}
        onBack={() => setCurrentView('home')}
        onSuccess={() => { setCurrentView('home'); fetchLessonPlans(searchQuery); }}
        onRefreshDirs={fetchDirectories}
        managedDirectoryIds={currentUserManagedDirIds}
        uploadMode={uploadMode}
        onViewDuplicate={(lessonId) => {
          const existing = lessonPlans.find(l => l.id === lessonId);
          if (existing) {
            setCurrentView('home');
            setSelectedLessonForDetail(existing);
          } else {
            axios.get(`/api/lesson-plans/${lessonId}/?user_id=${currentUser?.id}`)
              .then(res => {
                setCurrentView('home');
                setSelectedLessonForDetail(res.data);
              })
              .catch(err => {
                console.error("Lỗi khi tải tài liệu trùng lặp:", err);
                alert("Không thể tải thông tin chi tiết của tài liệu trùng lặp.");
              });
          }
        }}
      />
    );
  }

  if (currentView === 'admin') {
    if (!currentUser || currentUser.role !== 'ADMIN') {
      setCurrentView('home');
      return null;
    }

    // Filter admin users client-side based on search query and role filter
    const filteredAdminUsers = adminUsers.filter((u: any) => {
      const matchSearch = (u.full_name || '').toLowerCase().includes(adminSearchQuery.toLowerCase()) || 
                          (u.username || '').toLowerCase().includes(adminSearchQuery.toLowerCase());
      const matchRole = adminRoleFilter === 'ALL' || u.role === adminRoleFilter;
      return matchSearch && matchRole;
    });

    return (
      <div className="min-h-screen bg-gray-50 text-gray-800 font-sans flex flex-col">
        {/* Admin Navigation Bar */}
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="w-full px-6">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setCurrentView('home'); setSelectedUserForPerms(null); }}>
                <div className="bg-purple-600 rounded-xl text-white p-2 font-bold text-xl leading-none shadow-lg shadow-purple-500/20">🛡️</div>
                <div>
                  <span className="font-extrabold text-lg tracking-tight text-gray-900">Bảng Điều Hướng Quản Trị</span>
                  <p className="text-[10px] text-gray-500 font-semibold tracking-wider uppercase">Hệ thống quản lý tri thức</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setCurrentView('home'); setSelectedUserForPerms(null); }}
                  className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                >
                  <span>←</span> Quay lại trang chủ
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Layout Area */}
        <div className="flex-grow flex flex-col md:flex-row overflow-hidden max-h-[calc(100vh-4rem)]">
          {/* Sidebar / Left Column: Users List */}
          <div className="w-full md:w-80 border-r border-gray-200 bg-white p-5 flex flex-col space-y-4 overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-wider text-gray-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                Tài khoản ({filteredAdminUsers.length})
              </h3>
              <button
                onClick={() => {
                  setShowCreateUserForm(true);
                  setSelectedUserForPerms(null);
                }}
                className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-md shadow-purple-500/10"
              >
                <span>+</span> Thêm mới
              </button>
            </div>

            {/* Search and Filters */}
            <div className="space-y-2">
              <input
                type="text"
                value={adminSearchQuery}
                onChange={(e) => setAdminSearchQuery(e.target.value)}
                placeholder="Tìm kiếm tài khoản..."
                className="w-full bg-gray-50 border border-gray-200 hover:border-gray-350 rounded-xl px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-medium animate-none"
              />
              <select
                value={adminRoleFilter}
                onChange={(e) => setAdminRoleFilter(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 hover:border-gray-350 rounded-xl px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-medium"
              >
                <option value="ALL">Tất cả vai trò</option>
                <option value="ADMIN">Quản trị viên (Admin)</option>
                <option value="TEACHER">Giáo viên (Teacher)</option>
                <option value="USER">Người dùng (User)</option>
              </select>
            </div>

            {/* Scrollable list of accounts */}
            <div className="flex-grow space-y-2.5 overflow-y-auto pr-1">
              {filteredAdminUsers.map((u: any) => {
                const isSelected = selectedUserForPerms && selectedUserForPerms.id === u.id;
                return (
                  <div
                    key={u.id}
                    onClick={() => {
                      setSelectedUserForPerms(u);
                      setSelectedUserDirIds(u.managed_directories || []);
                      setShowCreateUserForm(false);
                      setAdminActiveTab('profile');
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex justify-between items-center relative group ${
                      isSelected
                        ? 'border-purple-650 bg-purple-50/50 shadow-sm'
                        : 'border-gray-250 bg-white hover:border-purple-300 hover:bg-purple-50/10'
                    }`}
                  >
                    <div className="space-y-1">
                      <p className="font-bold text-sm text-gray-900 leading-tight group-hover:text-purple-600 transition-colors">
                        {u.full_name || u.username}
                      </p>
                      <p className="text-[10px] text-gray-400 font-semibold">@{u.username}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border tracking-wide uppercase ${
                          u.role === 'ADMIN'
                            ? 'bg-red-50 text-red-700 border-red-100'
                            : u.role === 'TEACHER'
                            ? 'bg-blue-50 text-blue-700 border-blue-100'
                            : 'bg-gray-50 text-gray-600 border-gray-200'
                        }`}>
                          {u.role === 'ADMIN' ? 'Admin' : u.role === 'TEACHER' ? 'Giáo viên' : 'Thành viên'}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">
                          • {u.managed_directories?.length || 0} thư mục
                        </span>
                        {u.is_active === false && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full border border-amber-250 bg-amber-50 text-amber-700 uppercase tracking-wide flex items-center gap-0.5">
                            🔒 Khóa
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-gray-400 group-hover:text-purple-600 transition-colors font-bold text-sm">➔</span>
                  </div>
                );
              })}

              {filteredAdminUsers.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-xs italic">
                  Không tìm thấy tài khoản phù hợp.
                </div>
              )}
            </div>
          </div>
          {/* Right Column / Content Area: Workspaces */}
          <div className="flex-grow p-6 overflow-y-auto bg-gray-50/50 flex flex-col min-h-0">
            {showCreateUserForm ? (
              /* CREATE NEW USER WORKSPACE */
              <div className="max-w-2xl mx-auto w-full bg-white border border-gray-200/80 rounded-3xl p-8 shadow-lg space-y-6">
                <div>
                  <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                    <span className="p-1.5 bg-purple-600/20 text-purple-650 rounded-lg text-sm">👤</span>
                    Tạo tài khoản người dùng mới
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">Khởi tạo thông tin, thiết lập vai trò và cấp quyền mật khẩu ban đầu cho thành viên.</p>
                </div>

                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Tên đăng nhập (Username)</label>
                      <input
                        type="text"
                        required
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="Tên tài khoản (không dấu, viết liền)..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Mật khẩu ban đầu</label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Đặt mật khẩu bảo mật..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Họ và tên hiển thị</label>
                    <input
                      type="text"
                      required
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      placeholder="Nhập họ và tên đầy đủ..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Vai trò hệ thống (Role)</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: 'USER', label: 'Thành viên', desc: 'Chỉ xem tài liệu công khai' },
                        { value: 'TEACHER', label: 'Giáo viên', desc: 'Có thư mục riêng, tự đăng bài' },
                        { value: 'ADMIN', label: 'Quản trị viên', desc: 'Toàn quyền điều hành hệ thống' }
                      ].map((rOption) => (
                        <div
                          key={rOption.value}
                          onClick={() => setNewRole(rOption.value as any)}
                          className={`p-3 rounded-2xl border cursor-pointer transition-all text-center flex flex-col justify-center items-center ${
                            newRole === rOption.value
                              ? 'border-purple-650 bg-purple-50 text-purple-700 font-bold'
                              : 'border-gray-200 bg-white hover:border-gray-300 text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <span className="font-extrabold text-xs">{rOption.label}</span>
                          <span className="text-[9px] text-gray-400 mt-1 leading-tight">{rOption.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateUserForm(false)}
                      className="px-5 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-500 rounded-xl text-xs font-bold transition-all"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-purple-250/20"
                    >
                      Xác nhận tạo tài khoản
                    </button>
                  </div>
                </form>
              </div>
            ) : selectedUserForPerms ? (
              /* DETAILED VIEW & OPERATIONS ON CHOSEN USER */
              <div className="flex-grow flex flex-col space-y-6">
                {/* User Hero Panel */}
                <div className="bg-white border border-gray-200/80 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-700 flex items-center justify-center text-white text-xl font-black shadow-md">
                      {selectedUserForPerms.avatar_url ? (
                        <img src={selectedUserForPerms.avatar_url} alt="Avatar" className="w-full h-full object-cover rounded-2xl" />
                      ) : (
                        (selectedUserForPerms.full_name || selectedUserForPerms.username || 'U').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-black text-gray-900">{selectedUserForPerms.full_name || selectedUserForPerms.username}</h2>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border tracking-wide uppercase ${
                          selectedUserForPerms.role === 'ADMIN'
                            ? 'bg-red-50 text-red-700 border-red-100'
                            : selectedUserForPerms.role === 'TEACHER'
                            ? 'bg-blue-50 text-blue-700 border-blue-100'
                            : 'bg-gray-50 text-gray-600 border-gray-200'
                        }`}>
                          {selectedUserForPerms.role === 'ADMIN' ? 'Admin' : selectedUserForPerms.role === 'TEACHER' ? 'Giáo viên' : 'Thành viên'}
                        </span>
                        {selectedUserForPerms.is_active === false ? (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full border border-amber-250 bg-amber-50 text-amber-700 uppercase tracking-wide flex items-center gap-0.5">
                            🔒 Đã khóa tài khoản
                          </span>
                        ) : (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full border border-emerald-250 bg-emerald-50 text-emerald-700 uppercase tracking-wide flex items-center gap-0.5">
                            ✅ Đang hoạt động
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 font-semibold mt-0.5">Tên đăng nhập: @{selectedUserForPerms.username}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedUserForPerms.role === 'ADMIN' ? (
                      <span className="text-[10px] font-black px-3 py-2 rounded-xl border border-purple-200 bg-purple-50 text-purple-700 uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                        🛡️ Tài khoản Admin được bảo vệ
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleToggleLockUser(selectedUserForPerms)}
                          className={`px-4 py-2 border rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                            selectedUserForPerms.is_active
                              ? 'border-amber-200 hover:bg-amber-50 text-amber-650 hover:text-amber-700'
                              : 'border-emerald-200 hover:bg-emerald-50 text-emerald-650 hover:text-emerald-700'
                          }`}
                        >
                          {selectedUserForPerms.is_active ? (
                            <><span>🔒</span> Khóa tài khoản</>
                          ) : (
                            <><span>🔓</span> Mở khóa tài khoản</>
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(selectedUserForPerms.id)}
                          className="px-4 py-2 border border-red-200 hover:bg-red-50 text-red-650 hover:text-red-700 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 animate-none"
                        >
                          <span>🗑️</span> Xóa tài khoản
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Workspace Navigation Tabs */}
                <div className="flex border-b border-gray-200">
                  <button
                    onClick={() => setAdminActiveTab('profile')}
                    className={`px-6 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
                      adminActiveTab === 'profile'
                        ? 'border-purple-600 text-purple-650 font-bold'
                        : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    <span>👤</span> Hồ sơ & Bảo mật
                  </button>
                  <button
                    onClick={() => setAdminActiveTab('permissions')}
                    className={`px-6 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
                      adminActiveTab === 'permissions'
                        ? 'border-purple-600 text-purple-650 font-bold'
                        : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    <span>📁</span> Phân quyền thư mục
                  </button>
                </div>

                {/* Tab Contents */}
                <div className="flex-grow min-h-0 overflow-y-auto">
                  {adminActiveTab === 'profile' ? (
                    <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 space-y-6 max-w-2xl shadow-sm">
                      <div>
                        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Hiệu chỉnh tài khoản</h3>
                        <p className="text-xs text-gray-500 mt-1">Thay đổi họ tên hiển thị, mật khẩu bảo mật hoặc nâng cấp vai trò hệ thống.</p>
                      </div>

                      <form onSubmit={handleEditUser} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Tên đăng nhập (Username)</label>
                            <input
                              type="text"
                              required
                              value={editUsername}
                              onChange={(e) => setEditUsername(e.target.value)}
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-semibold animate-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Mật khẩu mới (Bỏ trống nếu giữ nguyên)</label>
                            <input
                              type="password"
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                              placeholder="Nhập mật khẩu mới tại đây..."
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-medium"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Họ và tên hiển thị</label>
                          <input
                            type="text"
                            required
                            value={editFullName}
                            onChange={(e) => setEditFullName(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Vai trò hệ thống (Role)</label>
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { value: 'USER', label: 'Thành viên', desc: 'Chỉ xem tài liệu công khai' },
                              { value: 'TEACHER', label: 'Giáo viên', desc: 'Có thư mục riêng, tự đăng bài' },
                              { value: 'ADMIN', label: 'Quản trị viên', desc: 'Toàn quyền điều hành hệ thống' }
                            ].map((rOption) => (
                              <div
                                key={rOption.value}
                                onClick={() => setEditRole(rOption.value as any)}
                                className={`p-3 rounded-2xl border cursor-pointer transition-all text-center flex flex-col justify-center items-center ${
                                  editRole === rOption.value
                                    ? 'border-purple-650 bg-purple-50 text-purple-700 font-bold'
                                    : 'border-gray-200 bg-white hover:border-gray-300 text-gray-500 hover:text-gray-700'
                                }`}
                              >
                                <span className="font-extrabold text-xs">{rOption.label}</span>
                                <span className="text-[9px] text-gray-400 mt-1 leading-tight">{rOption.desc}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
                          <button
                            type="submit"
                            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-purple-200/20"
                          >
                            Lưu thông tin hồ sơ
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    /* PERMISSIONS TAB */
                    <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 space-y-4 max-w-3xl shadow-sm">
                      <div>
                        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-1.5">
                          📁 Quản lý thư mục & Phân quyền
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Cấu hình và xem chi tiết không gian lưu trữ cá nhân hoặc phân quyền quản trị thư mục công khai (public).
                        </p>
                      </div>

                      {/* Sub-tabs inside Permissions Tab */}
                      <div className="flex border-b border-gray-200">
                        <button
                          type="button"
                          onClick={() => setAdminPermissionSubTab('personal')}
                          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                            adminPermissionSubTab === 'personal'
                              ? 'border-purple-650 text-purple-700 font-black'
                              : 'border-transparent text-gray-500 hover:text-gray-850'
                          }`}
                        >
                          <span>📁</span> Thư mục cá nhân
                        </button>
                        {editRole !== 'USER' && (
                          <button
                            type="button"
                            onClick={() => setAdminPermissionSubTab('public')}
                            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                              adminPermissionSubTab === 'public'
                                ? 'border-purple-650 text-purple-700 font-black'
                                : 'border-transparent text-gray-500 hover:text-gray-850'
                            }`}
                          >
                            <span>🌐</span> Thư mục public
                          </button>
                        )}
                      </div>

                      {adminPermissionSubTab === 'personal' ? (
                        /* PERSONAL DIRECTORIES VIEW WITH PERMISSION MANAGEMENT */
                        <div className="space-y-4">
                          <p className="text-xs text-gray-500">
                            💡 Các thư mục cá nhân thuộc sở hữu riêng của người dùng này. Quản trị viên có thể thu hồi hoặc cấp thêm quyền quản trị trực tiếp trên các thư mục này.
                          </p>
                          <div className="border border-gray-200 bg-gray-50/50 rounded-2xl p-4 overflow-y-auto max-h-[350px]">
                            {(() => {
                              const personalDirs = directories.filter(d => !d.is_public && d.user === selectedUserForPerms.id);
                              const rootPersonalDirs = personalDirs.filter(d => !d.parent || !personalDirs.some(p => p.id === d.parent));
                              if (rootPersonalDirs.length === 0) {
                                return <p className="text-sm text-gray-405 italic p-2">Người dùng này chưa khởi tạo thư mục cá nhân nào.</p>;
                              }
                              return (
                                <div className="space-y-0.5 text-gray-700">
                                  {rootPersonalDirs.map((dir: Directory) => (
                                    <PermissionDirTreeNode
                                      key={dir.id}
                                      dir={dir}
                                      directories={directories}
                                      selectedIds={selectedUserDirIds}
                                      onToggle={(id, descendants, checked) => {
                                        const allIds = [id, ...descendants];
                                        if (checked) {
                                          setSelectedUserDirIds(prev => Array.from(new Set([...prev, ...allIds])));
                                        } else {
                                          setSelectedUserDirIds(prev => prev.filter(x => !allIds.includes(x)));
                                        }
                                      }}
                                      depth={0}
                                      allLessonPlans={unfilteredLessons}
                                      onFileClick={setSelectedLessonForDetail}
                                    />
                                  ))}
                                </div>
                              );
                            })()}
                          </div>

                          <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
                            <button
                              onClick={handleSaveUserPermissions}
                              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-purple-250/20"
                            >
                              Lưu phân quyền thư mục
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* PUBLIC DIRECTORIES PERMISSION VIEW */
                        <div className="space-y-4">
                          <p className="text-xs text-gray-500">
                            💡 Tích chọn các thư mục công khai (public) mà giáo viên này có quyền quản trị cao nhất (thêm, sửa, xóa, duyệt giáo án).
                          </p>
                          <div className="border border-gray-200 bg-gray-50/50 rounded-2xl p-4 overflow-y-auto max-h-[350px]">
                            {(() => {
                              const publicDirs = directories.filter(d => d.is_public);
                              const rootPublicDirs = publicDirs.filter(d => !d.parent || !publicDirs.some(p => p.id === d.parent));
                              if (rootPublicDirs.length === 0) {
                                return <p className="text-sm text-gray-405 italic p-2">Hệ thống chưa có thư mục public nào.</p>;
                              }
                              return (
                                <div className="space-y-0.5 text-gray-700">
                                  {rootPublicDirs.map((dir: Directory) => (
                                    <PermissionDirTreeNode
                                      key={dir.id}
                                      dir={dir}
                                      directories={directories}
                                      selectedIds={selectedUserDirIds}
                                      onToggle={(id, descendants, checked) => {
                                        const allIds = [id, ...descendants];
                                        if (checked) {
                                          setSelectedUserDirIds(prev => Array.from(new Set([...prev, ...allIds])));
                                        } else {
                                          setSelectedUserDirIds(prev => prev.filter(x => !allIds.includes(x)));
                                        }
                                      }}
                                      depth={0}
                                      allLessonPlans={unfilteredLessons}
                                      onFileClick={setSelectedLessonForDetail}
                                    />
                                  ))}
                                </div>
                              );
                            })()}
                          </div>

                          <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
                            <button
                              onClick={handleSaveUserPermissions}
                              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-purple-250/20"
                            >
                              Lưu phân quyền thư mục
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* EMPTY CHOSEN USER WORKSPACE */
              <div className="flex-grow flex flex-col items-center justify-center text-center p-8 border border-dashed border-gray-300 rounded-3xl bg-white shadow-sm">
                <div className="text-6xl mb-4 text-purple-300">👥</div>
                <h4 className="font-black text-gray-800 text-base">Trung tâm Quản trị Tài khoản</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-sm">
                  Chọn một người dùng từ danh sách bên trái hoặc nhấn nút "Thêm mới" để bắt đầu thao tác quản trị viên.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="w-full px-6">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center gap-2 cursor-pointer" onClick={() => { setCurrentView('home'); setSelectedDirs([]); setHomeTab('library'); }}>
                <div className="bg-blue-600 rounded text-white p-1 font-bold text-xl leading-none">📚</div>
                <span className="font-bold text-xl text-gray-900 hidden sm:block">Hệ thống quản lý tri thức</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-grow max-w-3xl mx-8 relative">
               <form onSubmit={handleSearch} className="flex-grow flex items-center pr-1 shadow-sm rounded-full bg-gray-50 border border-gray-200 overflow-hidden">
                 <div className="pl-4 text-gray-400">🔍</div>
                 <input
                   type="text"
                   value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPersonalSearchQuery(e.target.value);
                    }}
                   className="w-full bg-transparent focus:outline-none text-sm text-gray-700 placeholder-gray-550 py-2 px-2"
                   placeholder={
                     homeTab === 'library'
                       ? "Tìm kiếm tên bài, nội dung giáo án..."
                       : homeTab === 'personal'
                       ? "Tìm kiếm tài liệu cá nhân..."
                       : "Tìm kiếm trong lịch sử đóng góp..."
                   }
                 />
                 
                 {/* Integrated Filter Icon Trigger */}
                 <button 
                   type="button"
                   onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
                   className={`p-2 rounded-full transition-all mr-1.5 flex items-center justify-center ${
                     showAdvancedFilter || selectedTietDay.length > 0 || selectedSubjects.length > 0
                       ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                       : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200/50'
                   }`}
                   title="Bộ lọc nâng cao"
                 >
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                     <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path>
                   </svg>
                 </button>
                 
                 <button type="submit" className="px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors mr-0.5 shadow-sm">
                   Tìm
                 </button>
               </form>
               
               {/* Popover Dropdown Panel */}
               {showAdvancedFilter && (
                 <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-gray-200 shadow-xl p-5 z-40 animate-in fade-in slide-in-from-top-3 duration-250">
                     <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
                       <h4 className="font-extrabold text-sm text-gray-900">🎛️ Bộ lọc nâng cao</h4>
                       <button 
                         onClick={() => { setSelectedTietDay([]); setSelectedSubjects([]); }} 
                         className="text-xs text-blue-600 hover:text-blue-800 font-bold"
                       >
                         Xóa bộ lọc
                       </button>
                     </div>
                     
                     {/* Filter by Duration / Tiết dạy */}
                     <div className="mb-4">
                       <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Số tiết học (Tiết dạy)</label>
                       <div className="grid grid-cols-3 gap-2">
                         {['1 tiết', '2 tiết', '3 tiết'].map(tiet => {
                           const isSelected = selectedTietDay.includes(tiet);
                           return (
                             <button
                               key={tiet}
                               type="button"
                               onClick={() => {
                                 setSelectedTietDay(prev => 
                                   prev.includes(tiet) ? prev.filter(p => p !== tiet) : [...prev, tiet]
                                 );
                               }}
                               className={`py-1.5 px-2 rounded-lg text-xs font-semibold border text-center transition-all ${
                                 isSelected 
                                   ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                   : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                               }`}
                             >
                               {tiet}
                             </button>
                           );
                         })}
                       </div>
                     </div>
                     
                     {/* Filter by Subject / Môn học */}
                     <div>
                       <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Môn học / Kiến thức</label>
                       <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                         {['Sinh học', 'Toán học', 'Vật lý', 'Hóa học', 'Tin học', 'Công nghệ', 'Địa lý'].map(subj => {
                           const isSelected = selectedSubjects.includes(subj);
                           return (
                             <button
                               key={subj}
                               type="button"
                               onClick={() => {
                                 setSelectedSubjects(prev => 
                                   prev.includes(subj) ? prev.filter(p => p !== subj) : [...prev, subj]
                                 );
                               }}
                               className={`py-1 px-2.5 rounded-full text-[11px] font-semibold border transition-all ${
                                 isSelected
                                   ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold shadow-sm'
                                   : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                               }`}
                             >
                               {subj}
                             </button>
                           );
                         })}
                       </div>
                     </div>
                   </div>
                 )}
            </div>

            <div className="flex items-center">
              {currentUser ? (
                <div className="flex items-center gap-4">
                  <div className="flex gap-2 mr-4">
                    {currentUser.role === 'ADMIN' && (
                      <button
                        onClick={() => { setCurrentView('admin'); fetchAdminUsers(); }}
                        className={`px-3 py-1.5 text-white rounded-md text-sm font-semibold transition-all flex items-center gap-1.5 shadow-sm ${
                          currentView === 'admin' ? 'bg-purple-800 ring-2 ring-purple-300' : 'bg-purple-600 hover:bg-purple-700'
                        }`}
                      >
                        <span>👥</span> Quản lý người dùng
                      </button>
                    )}
                    {(currentUser.role === 'ADMIN' || currentUser.role === 'TEACHER') && (
                      <button
                        onClick={() => setShowApprovalModal(true)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-sm relative"
                      >
                        <span>🛡️</span> Xét duyệt bài giảng
                        {pendingApprovals.length > 0 && (
                          <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1">
                            {pendingApprovals.length}
                          </span>
                        )}
                      </button>
                    )}
                    <button onClick={() => { setUploadMode('public'); setCurrentView('upload'); }} className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-md text-sm font-semibold transition-colors flex items-center gap-1">
                      <span>+</span> Đăng bài giảng
                    </button>
                  </div>
                  <div 
                    onClick={() => setShowProfileModal(true)}
                    className="flex items-center gap-2 cursor-pointer hover:bg-blue-50/80 border border-transparent hover:border-blue-100 p-1.5 px-3 rounded-2xl transition-all select-none group relative"
                    title="Chỉnh sửa thông tin cá nhân"
                  >
                    <div className="w-8 h-8 rounded-full border border-blue-100 overflow-hidden bg-blue-50 flex items-center justify-center text-xs font-black text-blue-600 group-hover:border-blue-200 transition-colors">
                      {currentUser.avatar_url ? (
                        <img src={currentUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        (currentUser.full_name || currentUser.username).charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex flex-col items-start justify-center">
                      <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 flex items-center justify-center gap-1 w-full relative pr-4">
                        <span>{currentUser.full_name || currentUser.username}</span>
                        <svg className="w-3.5 h-3.5 hidden group-hover:block text-blue-500 absolute right-0 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                        </svg>
                      </div>
                      <div className="text-[10px] text-gray-500 font-medium w-full text-left">
                        {currentUser.role === 'ADMIN' ? (
                          <span className="text-red-600 font-bold">Admin</span>
                        ) : currentUser.role === 'TEACHER' ? (
                          <span className="text-blue-600 font-bold">Giáo viên</span>
                        ) : (
                          <span className="text-gray-500 font-medium">Người dùng thường</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={handleLogout} className="ml-2 px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-colors">
                    Thoát
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowAuthModal(true)} className="px-5 py-2 flex items-center gap-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                  <span className="text-lg leading-none">→]</span> Đăng nhập
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="flex flex-grow max-w-[1600px] w-full mx-auto overflow-hidden">
        {/* Left Sidebar - Filters & Tree */}
        {homeTab === 'library' && (
          <div className="w-[300px] bg-white border-r border-gray-200 p-6 overflow-y-auto flex-shrink-0 hidden md:block">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Bộ lọc</h2>
            
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wider">Cây thư mục bài giảng</h3>
              <div className="text-sm max-h-[45vh] overflow-y-auto pr-1 scrollbar-thin">
                <div 
                  className={`flex items-center gap-2 cursor-pointer py-1.5 px-2 rounded-md transition-colors mb-1 ${selectedDirs.length === 0 ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
                  onClick={() => setSelectedDirs([])}
                >
                  <span className="w-4"></span>
                  <span className="text-gray-400">🏠</span>
                  <span className="flex-grow">Tất cả tài liệu</span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{allLessonPlans.filter(l => l.status === 'PUBLISHED').length}</span>
                </div>
                {rootDirs.map(dir => (
                  <DirectoryNode
                    key={dir.id}
                    dir={dir}
                    directories={directories}
                    selectedDirs={selectedDirs}
                    onToggleDir={handleToggleDir}
                    allLessons={allLessonPlans.filter(l => l.status === 'PUBLISHED')}
                    currentUser={currentUser}
                    onAddChild={handleAddChildDir}
                    onDelete={handleDeleteDir}
                    onRename={handleRenameDir}
                    onTogglePublic={handleTogglePublicDir}
                    onFileClick={setSelectedLessonForDetail}
                    depth={0}
                  />
                ))}
              </div>
              {currentUser && (
                <button
                  onClick={() => { setDirParentId(''); setDirName(''); setDirAttrs('{}'); setDirIsPublic(false); setShowDirModal(true); }}
                  className="mt-3 w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors border border-dashed border-gray-300"
                >
                  <span className="text-base leading-none">+</span>
                  <span>Thêm thư mục gốc</span>
                </button>
              )}
            </div>

            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wider">Lọc theo Đối tượng</h3>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" className="rounded border-gray-300" checked={selectedTargetStudents.includes('Học sinh thành thị')} onChange={e => handleFilterChange(setSelectedTargetStudents, 'Học sinh thành thị', e.target.checked)} /> Học sinh thành thị</label>
                <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" className="rounded border-gray-300" checked={selectedTargetStudents.includes('Học sinh nông thôn')} onChange={e => handleFilterChange(setSelectedTargetStudents, 'Học sinh nông thôn', e.target.checked)} /> Học sinh nông thôn</label>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wider">Lọc theo Lớp học</h3>
              <div className="flex flex-col gap-2">
                {['Lớp 10', 'Lớp 11', 'Lớp 12'].map(cls => (
                  <label key={cls} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                      checked={selectedClasses.includes(cls)} 
                      onChange={e => handleFilterChange(setSelectedClasses, cls, e.target.checked)} 
                    /> 
                    {cls}
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wider">Lọc theo Loại hình</h3>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" className="rounded border-gray-300" checked={selectedTypes.includes('Thực hành')} onChange={e => handleFilterChange(setSelectedTypes, 'Thực hành', e.target.checked)} /> Thực hành</label>
                <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" className="rounded border-gray-300" checked={selectedTypes.includes('Lý thuyết')} onChange={e => handleFilterChange(setSelectedTypes, 'Lý thuyết', e.target.checked)} /> Lý thuyết</label>
              </div>
            </div>
            
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wider">Lọc theo Kiến thức</h3>
              {availableSubjects.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Không có môn học nào trong mục này.</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-2">
                  {availableSubjects.map(subj => (
                    <label key={subj} className="flex items-center gap-2 text-sm text-gray-600">
                      <input type="checkbox" className="rounded border-gray-300" checked={selectedSubjects.includes(subj)} onChange={e => handleFilterChange(setSelectedSubjects, subj, e.target.checked)} /> {subj}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-grow overflow-y-auto bg-gray-50/50 flex flex-col">

          {/* ── Tab Selector (Segmented Pill Container) ── */}
          <div className="px-6 md:px-8 pt-6 pb-3">
            <div className="inline-flex p-1.5 bg-gray-200/60 backdrop-blur-md rounded-2xl border border-gray-300/40 shadow-sm">
              <button
                id="tab-library"
                onClick={() => setHomeTab('library')}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 ${
                  homeTab === 'library'
                    ? 'bg-white text-blue-700 shadow-sm border border-gray-200/50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
                }`}
              >
                <span>📚</span> Thư viện chung
              </button>
              {currentUser && (
                <>
                  <button
                    id="tab-personal"
                    onClick={() => setHomeTab('personal')}
                    className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 relative ml-1 ${
                      homeTab === 'personal'
                        ? 'bg-white text-sky-700 shadow-sm border border-gray-200/50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
                    }`}
                  >
                    <span>💾</span> Thư viện cá nhân
                    {allLessonPlans.filter(l => l.creator?.id === currentUser.id && (l.status === 'LOCAL')).length > 0 && (
                      <span className="ml-1 text-[10px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full font-bold">
                        {allLessonPlans.filter(l => l.creator?.id === currentUser.id && l.status === 'LOCAL').length}
                      </span>
                    )}
                  </button>
                  <button
                    id="tab-history"
                    onClick={() => setHomeTab('history')}
                    className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 relative ml-1 ${
                      homeTab === 'history'
                        ? 'bg-white text-emerald-700 shadow-sm border border-gray-200/50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
                    }`}
                  >
                    <span>📋</span> Lịch sử đóng góp
                    {allLessonPlans.filter(l => l.creator?.id === currentUser.id && l.status !== 'LOCAL').length > 0 && (
                      <span className="ml-1 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">
                        {allLessonPlans.filter(l => l.creator?.id === currentUser.id && l.status !== 'LOCAL').length}
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Tab Content ── */}
          <div className="flex-grow p-6 md:p-8 border-t border-gray-100 bg-white rounded-t-3xl shadow-sm">

            {/* ══ LIBRARY TAB ══ */}
            {homeTab === 'library' && (
              <>
                <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50/60 border border-slate-100 p-4 rounded-2xl shadow-sm">
                  <div>
                    <p className="text-sm text-gray-600 font-semibold">
                      🔍 Tìm thấy <span className="text-blue-600 font-extrabold">{filteredLessonPlans.length}</span> tài liệu
                      {selectedDirs.length > 0 && <span className="ml-1 text-slate-500 font-normal">(trong {selectedDirs.length} thư mục đã chọn)</span>}
                    </p>
                    {filteredLessonPlans.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Hiển thị từ {((currentPage - 1) * pageSize) + 1} đến {Math.min(currentPage * pageSize, filteredLessonPlans.length)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Sort Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sắp xếp:</span>
                      <select
                        value={sortBy}
                        onChange={e => { setSortBy(e.target.value); setCurrentPage(1); }}
                        className="text-xs font-semibold bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-slate-50 cursor-pointer"
                      >
                        {debouncedSearchQuery.trim() && (
                          <option value="relevance">🎯 Mức độ tương đồng (Relevance)</option>
                        )}
                        <option value="date_desc">📅 Mới nhất (Ngày tải)</option>
                        <option value="date_asc">📅 Cũ nhất (Ngày tải)</option>
                        <option value="rating_desc">⭐ Đánh giá cao nhất</option>
                        <option value="rating_asc">⭐ Đánh giá thấp nhất</option>
                        <option value="total_desc">💬 Nhiều đánh giá nhất</option>
                        <option value="total_asc">💬 Ít đánh giá nhất</option>
                      </select>
                    </div>

                    {/* Page Size Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Hiển thị:</span>
                      <select
                        value={pageSize}
                        onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                        className="text-xs font-semibold bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-slate-50 cursor-pointer"
                      >
                        <option value={10}>10 tài liệu / trang</option>
                        <option value={15}>15 tài liệu / trang</option>
                        <option value={20}>20 tài liệu / trang</option>
                      </select>
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="flex justify-center py-20"><div className="text-blue-600 animate-pulse font-medium">Đang tải dữ liệu...</div></div>
                ) : error ? (
                  <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
                ) : filteredLessonPlans.length === 0 ? (
                  <div className="text-center py-20 text-gray-500 bg-gray-50 rounded-xl border border-gray-200">Không có tài liệu nào trong mục này.</div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {paginatedLessonPlans.map((lesson) => (
                      <div 
                        key={lesson.id} 
                        onClick={() => setSelectedLessonForDetail(lesson)}
                        className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer relative group"
                      >
                        <div className="flex justify-between items-start gap-4 mb-3">
                          <h3 className="text-lg font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">{lesson.title}</h3>
                          <span className="text-xs font-semibold text-blue-500 whitespace-nowrap bg-blue-50 px-2.5 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">Xem chi tiết ↗</span>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-4">
                          <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-md flex items-center gap-1">📖 {lesson.target_student || 'Giáo án'}</span>
                          {lesson.status === 'PUBLISHED' ? (
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-medium rounded-md">👥 Công khai</span>
                          ) : lesson.status === 'PENDING' ? (
                            <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-100 text-xs font-medium rounded-md animate-pulse">⏳ Chờ duyệt</span>
                          ) : lesson.status === 'REJECTED' ? (
                            <span className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-100 text-xs font-medium rounded-md">❌ Bị từ chối</span>
                          ) : (
                            <span className="px-2 py-1 bg-sky-50 text-sky-700 border border-sky-100 text-xs font-medium rounded-md">📄 Cá nhân</span>
                          )}
                          {/* Rating & Total Comments Badge */}
                          {(lesson.total_ratings > 0 || (lesson.average_rating && lesson.average_rating > 0)) ? (
                            <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold rounded-md flex items-center gap-1">
                              ⭐ {Number(lesson.average_rating || 0).toFixed(1)} ({lesson.total_ratings} đánh giá)
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-slate-50 text-slate-400 border border-slate-200 text-xs font-medium rounded-md flex items-center gap-1">
                              ⭐ Chưa có đánh giá
                            </span>
                          )}
                          {/* Directory full path breadcrumb badge (Deepest/Leaf paths only to avoid parent redundancy) */}
                          {lesson.directory_ids && lesson.directory_ids.length > 0 ? (
                            (() => {
                              const leafDirIds = lesson.directory_ids.filter(dirId => {
                                const hasChildInList = lesson.directory_ids.some(otherId => {
                                  if (otherId === dirId) return false;
                                  const otherDir = directories.find(d => d.id === otherId);
                                  return otherDir && otherDir.parent === dirId;
                                });
                                return !hasChildInList;
                              });
                              return leafDirIds.map((dirId, i) => (
                                <span key={i} className="px-2 py-1 bg-violet-50 text-violet-700 border border-violet-100 text-xs font-medium rounded-md flex items-center gap-1 max-w-[250px] truncate" title={getDirectoryFullPath(dirId, directories)}>
                                  📂 {getDirectoryFullPath(dirId, directories)}
                                </span>
                              ));
                            })()
                          ) : (
                            <span className="px-2 py-1 bg-gray-50 text-gray-400 border border-gray-100 text-xs font-medium rounded-md">📄 Không có thư mục</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-4 line-clamp-3 flex-grow">{lesson.description || 'Chưa có mô tả.'}</p>
                        {debouncedSearchQuery.trim() && renderSnippet(lesson.content_preview, debouncedSearchQuery)}
                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50 text-xs text-gray-400">
                          <div className="flex items-center gap-2">
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (lesson.creator) {
                                  setSelectedCreatorForProfile(lesson.creator);
                                }
                              }}
                              className="font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1 bg-blue-50 px-2.5 py-0.5 rounded transition-all"
                              title="Nhấn xem thông tin người đăng"
                            >
                              👤 {lesson.creator?.full_name || lesson.creator?.username || 'Ẩn danh'}
                            </span>
                            <span>•</span>
                            <span>{new Date(lesson.created_at).toLocaleDateString('vi-VN')}</span>
                          </div>
                          {lesson.file_path || lesson.file_url ? (
                            <a 
                              href={getLessonFileUrl(lesson)} 
                              download={getFileName(lesson.file_url || lesson.file_path)} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 transition-colors"
                            >
                              ↓ Tải tài liệu
                            </a>
                          ) : (
                            <span className="text-gray-300">Không có file</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pagination Controls */}
                {filteredLessonPlans.length > pageSize && (
                  <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-6">
                    <div className="flex-1 flex justify-between sm:hidden">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className={`relative inline-flex items-center px-4 py-2 border border-gray-200 text-sm font-semibold rounded-xl bg-white text-gray-700 hover:bg-gray-50 transition-colors ${
                          currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        Trước
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredLessonPlans.length / pageSize)))}
                        disabled={currentPage === Math.ceil(filteredLessonPlans.length / pageSize)}
                        className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-200 text-sm font-semibold rounded-xl bg-white text-gray-700 hover:bg-gray-50 transition-colors ${
                          currentPage === Math.ceil(filteredLessonPlans.length / pageSize) ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        Sau
                      </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-500 font-medium">
                          Trang <span className="font-extrabold text-gray-800">{currentPage}</span> /{' '}
                          <span className="font-extrabold text-gray-800">
                            {Math.ceil(filteredLessonPlans.length / pageSize)}
                          </span>{' '}
                          (Tổng <span className="font-extrabold text-gray-800">{filteredLessonPlans.length}</span> tài liệu)
                        </p>
                      </div>
                      <div>
                        <nav className="relative z-0 inline-flex rounded-xl shadow-sm -space-x-px" aria-label="Pagination">
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className={`relative inline-flex items-center px-3 py-2 rounded-l-xl border border-gray-200 bg-white text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-all ${
                              currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          >
                            <span>◀</span>
                          </button>
                          
                          {/* Render page numbers */}
                          {(() => {
                            const totalPages = Math.ceil(filteredLessonPlans.length / pageSize);
                            const pageNumbers = [];
                            for (let i = 1; i <= totalPages; i++) {
                              if (totalPages > 7) {
                                if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
                                  pageNumbers.push(i);
                                } else if (i === currentPage - 3 || i === currentPage + 3) {
                                  pageNumbers.push('...');
                                }
                              } else {
                                pageNumbers.push(i);
                              }
                            }
                            const cleanPages = pageNumbers.filter((v, idx, arr) => v !== '...' || arr[idx - 1] !== '...');
                            
                            return cleanPages.map((pageNum, idx) => {
                              if (pageNum === '...') {
                                return (
                                  <span key={`ellipsis-${idx}`} className="relative inline-flex items-center px-4 py-2 border border-gray-200 bg-white text-sm font-semibold text-gray-400 select-none">
                                    ...
                                  </span>
                                );
                              }
                              return (
                                <button
                                  key={`page-${pageNum}`}
                                  onClick={() => setCurrentPage(Number(pageNum))}
                                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-bold transition-all ${
                                    currentPage === pageNum
                                      ? 'z-10 bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100'
                                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600'
                                  }`}
                                >
                                  {pageNum}
                                </button>
                               );
                            });
                          })()}

                          <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredLessonPlans.length / pageSize)))}
                            disabled={currentPage === Math.ceil(filteredLessonPlans.length / pageSize)}
                            className={`relative inline-flex items-center px-3 py-2 rounded-r-xl border border-gray-200 bg-white text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-all ${
                              currentPage === Math.ceil(filteredLessonPlans.length / pageSize) ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          >
                            <span>▶</span>
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ══ HISTORY TAB ══ */}
            {homeTab === 'history' && currentUser && (() => {
              const myLessons = allLessonPlans
                .filter(l => l.creator?.id === currentUser.id && l.status !== 'LOCAL')
                .filter(l => {
                  const q = debouncedSearchQuery.trim().toLowerCase();
                  if (!q) return true;
                  const qClean = removeAccents(q);
                  const title = (l.title || '').toLowerCase();
                  const desc = (l.description || '').toLowerCase();
                  const content = (l.content_preview || '').toLowerCase();
                  return (
                    title.includes(q) || desc.includes(q) || content.includes(q) ||
                    removeAccents(title).includes(qClean) || removeAccents(desc).includes(qClean) || removeAccents(content).includes(qClean)
                  );
                })
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              return (
                <div>
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Lịch sử đóng góp của tôi</h2>
                      <p className="text-sm text-gray-500 mt-1">Tất cả bài giảng bạn đã đăng tải lên hệ thống</p>
                    </div>
                    <span className="text-sm bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1.5 rounded-full font-semibold">
                      {myLessons.length} bài giảng
                    </span>
                  </div>

                  {myLessons.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                      <div className="text-5xl mb-4">📭</div>
                      <p className="text-gray-500 font-medium">Bạn chưa đăng bài giảng nào.</p>
                      <button onClick={() => setCurrentView('upload')} className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
                        + Đăng bài giảng đầu tiên
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {myLessons.map(lesson => (
                        <div key={lesson.id} className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${
                          lesson.status === 'REJECTED' ? 'border-rose-200 bg-rose-50/20' :
                          lesson.status === 'PENDING'  ? 'border-amber-200 bg-amber-50/20' :
                          lesson.status === 'PUBLISHED' ? 'border-emerald-200' : 'border-gray-200'
                        }`}>
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex-grow min-w-0">
                              <h3 className="font-bold text-gray-900 text-base leading-snug">{lesson.title}</h3>
                              <p className="text-xs text-gray-500 mt-1">📅 {new Date(lesson.created_at).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</p>
                            </div>
                            <div className="flex-shrink-0">
                              {lesson.status === 'PUBLISHED' && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">✅ Đã duyệt & xuất bản</span>
                              )}
                              {lesson.status === 'PENDING' && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 border border-amber-200 rounded-full text-xs font-bold animate-pulse">⏳ Đang chờ duyệt</span>
                              )}
                              {lesson.status === 'REJECTED' && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-100 text-rose-700 border border-rose-200 rounded-full text-xs font-bold">❌ Bị từ chối</span>
                              )}
                            </div>
                          </div>

                          {/* Description */}
                          {lesson.description && (
                            <p className="text-sm text-gray-600 line-clamp-2 mb-3">{lesson.description}</p>
                          )}

                          {debouncedSearchQuery.trim() && renderSnippet(lesson.content_preview, debouncedSearchQuery)}

                          {/* Rejection Feedback Box */}
                          {lesson.status === 'REJECTED' && lesson.latest_feedback && (
                            <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                              <p className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-1">💬 Lý do từ chối:</p>
                              <p className="text-sm text-rose-800 leading-relaxed">{lesson.latest_feedback}</p>
                            </div>
                          )}

                          {/* Action Row */}
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 flex-wrap">
                            <button
                              onClick={() => setSelectedLessonForDetail(lesson)}
                              className="px-4 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors"
                            >
                              ↗ Xem chi tiết
                            </button>
                            {/* Resubmit button for rejected lessons */}
                            {lesson.status === 'REJECTED' && (
                              <button
                                onClick={() => openEditModal(lesson)}
                                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm shadow-amber-200"
                              >
                                ✏ Sửa & Gửi duyệt lại
                              </button>
                            )}
                            {/* Edit for non-rejected */}
                            {lesson.status !== 'REJECTED' && (
                              <button
                                onClick={() => openEditModal(lesson)}
                                className="px-4 py-1.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg text-xs font-semibold hover:bg-yellow-100 transition-colors"
                              >
                                ✏ Chỉnh sửa
                              </button>
                            )}
                            {/* PUBLISHED: Retract to personal (remove from public) */}
                            {lesson.status === 'PUBLISHED' && (
                              <button
                                onClick={() => handleWithdrawLesson(lesson.id, 'retract')}
                                title="Thu hồi về thư viện cá nhân — bài sẽ biến mất khỏi thư viện chung"
                                className="px-4 py-1.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-lg text-xs font-semibold hover:bg-violet-100 transition-colors flex items-center gap-1"
                              >
                                ↓ Thu hồi về cá nhân
                              </button>
                            )}
                            {/* PENDING: Cancel submission */}
                            {lesson.status === 'PENDING' && (
                              <button
                                onClick={() => handleWithdrawLesson(lesson.id, 'retract')}
                                title="Hủy gửi duyệt, đưa về thư viện cá nhân"
                                className="px-4 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-xs font-semibold hover:bg-orange-100 transition-colors flex items-center gap-1"
                              >
                                ↩ Hủy chờ duyệt
                              </button>
                            )}

                            {/* Delete permanently — all statuses */}
                            <button
                              onClick={() => handleWithdrawLesson(lesson.id, 'delete')}
                              className="px-4 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors ml-auto"
                            >
                              🗑 Xóa
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
            {/* ══ PERSONAL LIBRARY TAB ══ */}
            {homeTab === 'personal' && currentUser && (() => {
              const personalRootDirs = directories.filter(d => !d.is_public && !d.parent && d.user === currentUser.id);
              
              // Filter personal lessons
              // 1. Must be created by current user
              // 2. If LOCAL, or belongs to a personal directory
              const myPersonalLessons = allLessonPlans.filter(l => {
                if (l.creator?.id !== currentUser.id) return false;
                if (l.status === 'LOCAL') return true;
                const hasPersonalDir = l.directory_ids?.some(dirId => {
                  const dObj = directories.find(d => d.id === dirId);
                  return dObj && !dObj.is_public && dObj.user === currentUser.id;
                });
                return hasPersonalDir;
              });

              // Filter by selected personal directories
              const dirFilteredPersonalLessons = selectedPersonalDirs.length === 0 
                ? myPersonalLessons 
                : myPersonalLessons.filter(l => 
                    l.directory_ids?.some(dirId => selectedPersonalDirs.includes(dirId))
                  );

              // Apply search query filter
              const searchedPersonalLessons = (() => {
                const q = personalSearchQuery.trim().toLowerCase();
                if (!q) return dirFilteredPersonalLessons;
                const qClean = removeAccents(q);
                return dirFilteredPersonalLessons.filter(l => {
                  const title = (l.title || '').toLowerCase();
                  const desc = (l.description || '').toLowerCase();
                  const content = (l.content_preview || '').toLowerCase();
                  return (
                    title.includes(q) || desc.includes(q) || content.includes(q) ||
                    removeAccents(title).includes(qClean) || removeAccents(desc).includes(qClean) || removeAccents(content).includes(qClean)
                  );
                });
              })();

              // Apply sort
              const sortedPersonalLessons = (() => {
                const list = [...searchedPersonalLessons];
                list.sort((a, b) => {
                  if (personalSortBy === 'date_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                  if (personalSortBy === 'date_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                  if (personalSortBy === 'title_asc') return (a.title || '').localeCompare(b.title || '', 'vi');
                  if (personalSortBy === 'title_desc') return (b.title || '').localeCompare(a.title || '', 'vi');
                  return 0;
                });
                return list;
              })();

              return (
                <div className="flex flex-col lg:flex-row gap-6 min-h-[500px]">
                  {/* Left: Personal Folder Tree */}
                  <div className="w-full lg:w-[260px] border-r border-gray-100 lg:pr-6 flex-shrink-0">
                    <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider font-bold">Cây thư mục cá nhân</h3>
                    <div className="text-sm mt-2 max-h-[45vh] overflow-y-auto pr-1 scrollbar-thin">
                      <div 
                        className={`flex items-center gap-2 cursor-pointer py-1.5 px-2 rounded-md transition-colors mb-1 ${selectedPersonalDirs.length === 0 ? 'bg-sky-50 text-sky-700 font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
                        onClick={() => setSelectedPersonalDirs([])}
                      >
                        <span className="w-4"></span>
                        <span className="text-sky-500">📁</span>
                        <span className="flex-grow truncate">Tất cả tài liệu cá nhân</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{myPersonalLessons.length}</span>
                      </div>
                      
                      {personalRootDirs.map(dir => (
                        <DirectoryNode
                          key={dir.id}
                          dir={dir}
                          directories={directories}
                          selectedDirs={selectedPersonalDirs}
                          onToggleDir={(id: number) => {
                            setSelectedPersonalDirs(prev => prev.includes(id) ? prev.filter(d => d !== id) : [id]);
                          }}
                          allLessons={allLessonPlans}
                          currentUser={currentUser}
                          onAddChild={handleAddChildDir}
                          onDelete={handleDeleteDir}
                          onRename={handleRenameDir}
                          onTogglePublic={handleTogglePublicDir}
                          onFileClick={setSelectedLessonForDetail}
                          depth={0}
                        />
                      ))}
                    </div>
                    
                    <button
                      onClick={() => { 
                        setDirParentId(''); 
                        setDirName(''); 
                        setDirAttrs('{}'); 
                        setDirIsPublic(false); // Force private for personal folder
                        setShowDirModal(true); 
                      }}
                      className="mt-3 w-full flex items-center justify-center gap-2 px-2 py-1.5 rounded-md text-xs text-sky-600 hover:bg-sky-50 transition-colors border border-dashed border-sky-300 font-bold"
                    >
                      <span>+ Thêm thư mục cá nhân gốc</span>
                    </button>
                  </div>

                  {/* Right: Personal Lessons list */}
                  <div className="flex-grow min-w-0">
                    {/* Header: title + count + add button with inline sort */}
                    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">Thư viện cá nhân</h2>
                        <p className="text-sm text-gray-500 mt-1">Tài liệu riêng tư và thư mục cá nhân của bạn.</p>
                      </div>
                      <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
                        {/* Sort Selector */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Sắp xếp:</span>
                          <select
                            value={personalSortBy}
                            onChange={e => setPersonalSortBy(e.target.value)}
                            className="text-xs font-bold bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all hover:bg-slate-50 cursor-pointer"
                          >
                            <option value="date_desc">📅 Mới nhất</option>
                            <option value="date_asc">📅 Cũ nhất</option>
                            <option value="title_asc">🔤 Tên A→Z</option>
                            <option value="title_desc">🔤 Tên Z→A</option>
                          </select>
                        </div>
                        
                        <span className="text-xs bg-sky-50 text-sky-700 border border-sky-100 px-3 py-2 rounded-xl font-bold whitespace-nowrap">{sortedPersonalLessons.length} tài liệu</span>
                        <button 
                          onClick={() => {
                            setUploadMode('personal');
                            if (selectedPersonalDirs.length > 0) {
                              setUpDirId(selectedPersonalDirs[0].toString());
                            } else {
                              setUpDirId('');
                            }
                            setCurrentView('upload');
                          }} 
                          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors whitespace-nowrap shadow-sm hover:shadow"
                        >
                          + Thêm mới
                        </button>
                      </div>
                    </div>

                    {/* Result info line */}
                    {personalSearchQuery && (
                      <p className="text-xs text-gray-500 mb-3 font-medium">
                        🔍 Tìm thấy <span className="text-sky-600 font-bold">{sortedPersonalLessons.length}</span> tài liệu{selectedPersonalDirs.length > 0 && <span className="text-slate-400"> (trong thư mục đã chọn)</span>}
                      </p>
                    )}

                    {sortedPersonalLessons.length === 0 ? (
                      <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <div className="text-5xl mb-4">💾</div>
                        <p className="text-gray-500 font-medium">{personalSearchQuery ? 'Không tìm thấy tài liệu phù hợp.' : 'Không tìm thấy tài liệu nào.'}</p>
                        <p className="text-sm text-gray-400 mt-1">{personalSearchQuery ? 'Thử từ khóa khác hoặc xóa bộ lọc.' : 'Hãy tải tệp lên hoặc tạo thư mục cá nhân để bắt đầu quản lý.'}</p>
                        {!personalSearchQuery && (
                          <button 
                            onClick={() => {
                              setUploadMode('personal');
                              if (selectedPersonalDirs.length > 0) {
                                setUpDirId(selectedPersonalDirs[0].toString());
                              } else {
                                setUpDirId('');
                              }
                              setCurrentView('upload');
                            }} 
                            className="mt-4 px-5 py-2 bg-sky-600 text-white rounded-xl text-sm font-semibold hover:bg-sky-700"
                          >
                            + Tải tài liệu lên
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {sortedPersonalLessons.map(lesson => (
                          <div 
                            key={lesson.id} 
                            onClick={() => setSelectedLessonForDetail(lesson)}
                            className="bg-white rounded-2xl border border-sky-100/60 p-5 shadow-sm hover:shadow-md hover:border-sky-300 transition-all cursor-pointer flex flex-col relative group"
                          >
                            {/* Card Header: Title + hover badge */}
                            <div className="flex justify-between items-start gap-3 mb-3">
                              <h3 className="text-base font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-sky-700 transition-colors flex-grow">{lesson.title}</h3>
                              <span className="text-xs font-semibold text-sky-500 whitespace-nowrap bg-sky-50 px-2.5 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">Xem chi tiết ↗</span>
                            </div>

                            {/* Badges row */}
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {/* Target Student */}
                              {lesson.target_student && (
                                <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-md flex items-center gap-1">📖 {lesson.target_student}</span>
                              )}
                              {/* Status Badge */}
                              {lesson.status === 'LOCAL' ? (
                                <span className="px-2 py-1 bg-sky-50 text-sky-700 border border-sky-100 text-xs font-medium rounded-md">💾 Cá nhân</span>
                              ) : lesson.status === 'PENDING' ? (
                                <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-100 text-xs font-medium rounded-md animate-pulse">⏳ Chờ duyệt</span>
                              ) : lesson.status === 'REJECTED' ? (
                                <span className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-100 text-xs font-medium rounded-md">❌ Bị từ chối</span>
                              ) : (
                                <span className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-medium rounded-md">👥 Công khai</span>
                              )}
                              {/* Rating & Total Comments Badge */}
                              {(lesson.total_ratings > 0 || (lesson.average_rating && lesson.average_rating > 0)) ? (
                                <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold rounded-md flex items-center gap-1">
                                  ⭐ {Number(lesson.average_rating || 0).toFixed(1)} ({lesson.total_ratings} đánh giá)
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-slate-50 text-slate-400 border border-slate-200 text-xs font-medium rounded-md flex items-center gap-1">
                                  ⭐ Chưa có đánh giá
                                </span>
                              )}
                              {/* Directory path badges (Deepest/Leaf paths only to avoid parent redundancy) */}
                              {lesson.directory_ids && lesson.directory_ids.length > 0 ? (
                                (() => {
                                  const leafDirIds = lesson.directory_ids.filter(dirId => {
                                    const hasChildInList = lesson.directory_ids.some(otherId => {
                                      if (otherId === dirId) return false;
                                      const otherDir = directories.find(d => d.id === otherId);
                                      return otherDir && otherDir.parent === dirId;
                                    });
                                    return !hasChildInList;
                                  });
                                  return leafDirIds.map((dirId, i) => (
                                    <span key={i} className="px-2 py-1 bg-violet-50 text-violet-700 border border-violet-100 text-xs font-medium rounded-md flex items-center gap-1 max-w-[220px] truncate" title={getDirectoryFullPath(dirId, directories)}>
                                      📂 {getDirectoryFullPath(dirId, directories)}
                                    </span>
                                  ));
                                })()
                              ) : (
                                <span className="px-2 py-1 bg-gray-50 text-gray-400 border border-gray-100 text-xs font-medium rounded-md">📄 Chưa phân thư mục</span>
                              )}
                            </div>

                            {/* Description */}
                            <p className="text-sm text-gray-600 mb-3 line-clamp-3 flex-grow">{lesson.description || 'Chưa có mô tả.'}</p>

                            {debouncedSearchQuery.trim() && renderSnippet(lesson.content_preview, debouncedSearchQuery)}

                            {/* Rejection feedback */}
                            {lesson.latest_feedback && (
                              <div className="mb-3 p-2 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-700">
                                <strong>💬 Phản hồi duyệt:</strong> {lesson.latest_feedback}
                              </div>
                            )}

                            {/* Footer: date + download */}
                            <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50 text-xs text-gray-400">
                              <div className="flex items-center gap-2">
                                <span>📅 {new Date(lesson.created_at).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' })}</span>
                              </div>
                              {lesson.file_path || lesson.file_url ? (
                                <a
                                  href={getLessonFileUrl(lesson)}
                                  download={getFileName(lesson.file_url || lesson.file_path)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 transition-colors"
                                >
                                  ↓ Tải tài liệu
                                </a>
                              ) : (
                                <span className="text-gray-300">Không có file</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      </div>

      {/* Modals from before */}
      {/* Auth Modal */}
      {showAuthModal && !currentUser && (
        <div className="fixed z-50 inset-0 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 text-center mb-6">
                {authMode === 'LOGIN' ? 'Đăng nhập hệ thống' : 'Đăng ký tài khoản'}
              </h3>
              {authError && <div className={`mb-4 p-3 rounded-md text-sm ${authError.includes('thành công') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>{authError}</div>}
              <form className="space-y-4" onSubmit={authMode === 'LOGIN' ? handleLogin : handleRegister}>
                {authMode === 'REGISTER' && (
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label><input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500" /></div>
                )}
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập</label><input type="text" required value={username} onChange={e => setUsername(e.target.value)} className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label><input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500" /></div>
                <div className="pt-2">
                  <button type="submit" className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-white text-sm font-medium hover:bg-blue-700">{authMode === 'LOGIN' ? 'Đăng nhập' : 'Tạo tài khoản'}</button>
                  <button type="button" onClick={() => { setAuthMode(authMode === 'LOGIN' ? 'REGISTER' : 'LOGIN'); setAuthError(null); }} className="w-full text-blue-600 text-sm font-medium hover:text-blue-700 mt-3">{authMode === 'LOGIN' ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}</button>
                  <button type="button" onClick={() => setShowAuthModal(false)} className="w-full text-gray-500 text-sm font-medium hover:text-gray-700 mt-2">Đóng</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Dir Modal */}
      {showDirModal && currentUser && (
        <div className="fixed z-50 inset-0 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Tạo Thư Mục Mới</h3>
            <form onSubmit={handleCreateDir} className="space-y-4">
              <div><label className="block text-sm mb-1">Tên thư mục</label><input type="text" required value={dirName} onChange={e=>setDirName(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
              <div>
                <label className="block text-sm mb-1">Thư mục cha</label>
                <select value={dirParentId} onChange={e=>setDirParentId(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-mono">
                  <option value="">-- Cấp cao nhất --</option>
                  {getDirectoriesAsTreeOptions(directories).map(d => (
                    <option key={d.id} value={d.id}>
                      {d.visualPrefix}{d.name} {d.is_public ? '👥' : '🔒'}
                    </option>
                  ))}
                </select>
              </div>
              {currentUser.role === 'ADMIN' && (
                <div className="flex items-center gap-2 bg-red-50 p-3 rounded-lg border border-red-100">
                  <input type="checkbox" checked={dirIsPublic} onChange={e=>setDirIsPublic(e.target.checked)} id="isPub" className="rounded text-red-600 focus:ring-red-500" />
                  <label htmlFor="isPub" className="text-sm font-medium text-red-700">Thư mục dùng chung (Public)</label>
                </div>
              )}
              <div className="flex gap-2 justify-end mt-6">
                <button type="button" onClick={()=>setShowDirModal(false)} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Tạo mới</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && currentUser && (
        <div className="fixed z-50 inset-0 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Tải lên Bài Giảng (Lưu Cục Bộ)</h3>
            <form onSubmit={handleUpload} className="space-y-4">
              <div><label className="block text-sm mb-1">Tên bài giảng</label><input type="text" required value={upTitle} onChange={e=>setUpTitle(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
              <div><label className="block text-sm mb-1">Mô tả</label><textarea value={upDesc} onChange={e=>setUpDesc(e.target.value)} className="w-full border rounded-lg p-2 text-sm h-20" /></div>
              <div><label className="block text-sm mb-1">Khối lớp / Đối tượng</label><input type="text" value={upGrade} onChange={e=>setUpGrade(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
              <div>
                <label className="block text-sm mb-1">Lưu vào thư mục</label>
                <select value={upDirId} onChange={e=>setUpDirId(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-mono">
                  <option value="">-- Không chọn --</option>
                  {getDirectoriesAsTreeOptions(directories).map(d => (
                    <option key={d.id} value={d.id}>
                      {d.visualPrefix}{d.name} {d.is_public ? '👥' : '🔒'}
                    </option>
                  ))}
                </select>
              </div>
              <div><label className="block text-sm mb-1">File tài liệu (.docx, .pdf)</label><input type="file" required onChange={e=> e.target.files && setUpFile(e.target.files[0])} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" /></div>
              
              <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-gray-100">
                <button type="button" onClick={()=>setShowUploadModal(false)} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Tải lên</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Propose Modal */}
      {showProposeModal && lessonToPropose && currentUser && (
        <div className="fixed z-50 inset-0 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">🌐 Đề xuất công khai giáo án</h3>
            <p className="text-sm text-gray-500 mb-4">
              Bạn đang đề xuất công khai tài liệu <strong>"{lessonToPropose.title}"</strong> lên thư viện chung của cộng đồng.
            </p>

            {proposeError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col gap-3 shadow-sm">
                <div className="flex items-start gap-2.5">
                  <span className="text-red-500 mt-0.5 text-base">⚠️</span>
                  <div className="text-xs text-red-700 font-medium leading-relaxed">
                    {proposeError}
                  </div>
                </div>
                {proposeDuplicateId && (
                  <div className="flex gap-2 justify-end mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProposeModal(false);
                        const lessonId = proposeDuplicateId;
                        setLessonToPropose(null);
                        setProposeError(null);
                        setProposeDuplicateId(null);

                        const existing = lessonPlans.find(l => l.id === lessonId);
                        if (existing) {
                          setCurrentView('home');
                          setSelectedLessonForDetail(existing);
                        } else {
                          axios.get(`/api/lesson-plans/${lessonId}/?user_id=${currentUser?.id}`)
                            .then(res => {
                              setCurrentView('home');
                              setSelectedLessonForDetail(res.data);
                            })
                            .catch(err => {
                              console.error("Lỗi khi tải tài liệu trùng lặp:", err);
                              alert("Không thể tải thông tin chi tiết của tài liệu trùng lặp.");
                            });
                        }
                      }}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1"
                    >
                      🔍 Xem tài liệu đã có
                    </button>
                  </div>
                )}
              </div>
            )}

            {!proposeDuplicateId ? (
              <form onSubmit={handleProposePublic} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Chọn thư mục công khai muốn đưa tài liệu vào:
                  </label>
                  <select 
                    required
                    value={targetPublicDirId} 
                    onChange={e => setTargetPublicDirId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm font-mono focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Chọn thư mục công khai --</option>
                    {getDirectoriesAsTreeOptions(directories, d => d.is_public).map(d => (
                      <option key={d.id} value={d.id}>
                        {d.visualPrefix}{d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-gray-100">
                  <button 
                    type="button" 
                    onClick={() => { setShowProposeModal(false); setLessonToPropose(null); }} 
                    className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit" 
                    disabled={!targetPublicDirId}
                    className="px-4 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    Gửi đề xuất
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex justify-end mt-6 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => { setShowProposeModal(false); setLessonToPropose(null); setProposeError(null); setProposeDuplicateId(null); }} 
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-750 rounded-lg text-sm font-bold shadow-sm transition-colors"
                >
                  Đóng cửa sổ
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingLesson && currentUser && (
        <div className="fixed z-50 inset-0 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Chỉnh sửa Tài liệu</h3>
            <form onSubmit={submitEdit} className="space-y-4">
              <div><label className="block text-sm mb-1">Tên bài giảng</label><input type="text" required value={editTitle} onChange={e=>setEditTitle(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
              <div><label className="block text-sm mb-1">Mô tả</label><textarea value={editDesc} onChange={e=>setEditDesc(e.target.value)} className="w-full border rounded-lg p-2 text-sm h-20" /></div>
              <div><label className="block text-sm mb-1">Khối lớp</label><input type="text" value={editGrade} onChange={e=>setEditGrade(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
              <div>
                <label className="block text-sm mb-1 font-semibold text-gray-700">Lưu vào thư mục</label>
                <select 
                  value={editDirId} 
                  onChange={e => setEditDirId(e.target.value)} 
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm font-mono focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Giữ nguyên / Chưa phân thư mục --</option>
                  {(() => {
                    // Determine if this lesson is public (published or in a public directory)
                    const isPublicLesson = editingLesson.status === 'PUBLISHED' || (() => {
                      if (editingLesson.directory_ids && editingLesson.directory_ids.length > 0) {
                        const firstDir = directories.find(d => d.id === editingLesson.directory_ids![0]);
                        return firstDir ? firstDir.is_public : false;
                      }
                      return false;
                    })();

                    if (isPublicLesson) {
                      // Show only public directories (for public/published lessons)
                      return getDirectoriesAsTreeOptions(directories, d => d.is_public).map(d => (
                        <option key={d.id} value={d.id}>
                          {d.visualPrefix}{d.name} 👥
                        </option>
                      ));
                    } else {
                      // Show only THIS user's personal (private) directories
                      return getDirectoriesAsTreeOptions(
                        directories,
                        d => !d.is_public && (currentUser.role === 'ADMIN' ? true : d.user === currentUser.id)
                      ).map(d => (
                        <option key={d.id} value={d.id}>
                          {d.visualPrefix}{d.name} 🔒
                        </option>
                      ));
                    }
                  })()}
                </select>
              </div>
              {(() => {
                if (!editDirId) return null;
                const targetDir = directories.find(d => d.id.toString() === editDirId);
                if (targetDir && targetDir.is_public && currentUser.role !== 'ADMIN' && targetDir.user !== currentUser.id) {
                  return (
                    <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 leading-normal flex flex-col gap-0.5">
                      <strong>⚠️ Yêu cầu kiểm duyệt:</strong> Bạn không có quyền quản trị trực tiếp thư mục công khai này. Hành động chuyển thư mục sẽ đưa tài liệu về trạng thái <strong>Chờ duyệt (Pending)</strong> để chờ duyệt.
                    </div>
                  );
                }
                return null;
              })()}
              <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
                <label className="block text-sm mb-1 font-medium text-yellow-800">Thay thế tài liệu đính kèm</label>
                <p className="text-xs text-yellow-600 mb-2">Bỏ trống nếu muốn giữ nguyên file cũ</p>
                <input type="file" onChange={e=> e.target.files && setEditFile(e.target.files[0])} className="w-full text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-yellow-100 file:text-yellow-700 hover:file:bg-yellow-200" />
              </div>
              
              <div className="flex gap-2 justify-end mt-6">
                <button type="button" onClick={()=>setEditingLesson(null)} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600">Lưu thay đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lesson Detail Modal (Xem chi tiết) */}
      {selectedLessonForDetail && (
        <div className="fixed z-50 inset-0 w-screen h-screen bg-slate-900/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white w-screen h-screen flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 flex-shrink-0 bg-white">
               <div>
                 <div className="flex items-center gap-2 mb-1">
                   <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wider border border-blue-100/50">
                     Chi tiết bài giảng
                   </span>
                   {selectedLessonForDetail.directory_ids && selectedLessonForDetail.directory_ids.length > 0 && (
                     <span className="text-xs font-semibold text-gray-400 truncate max-w-xs sm:max-w-md block" title={getDirectoryFullPath(selectedLessonForDetail.directory_ids[0], directories)}>
                       / {getDirectoryFullPath(selectedLessonForDetail.directory_ids[0], directories)}
                     </span>
                   )}
                 </div>
                 <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{selectedLessonForDetail.title}</h2>
               </div>
               <button 
                 onClick={() => { setSelectedLessonForDetail(null); setLessonRatings([]); setMyRating(0); setMyComment(''); }} 
                 className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors flex items-center justify-center"
                 title="Đóng cửa sổ"
               >
                 <span className="text-xl">✕</span>
               </button>
            </div>

            {/* Split Content */}
            <div className="flex-grow flex flex-col lg:flex-row overflow-hidden min-h-0 bg-slate-50/20">
               {/* Left Column - Lesson & Info */}
               <div className={`w-full flex flex-col h-full overflow-y-auto p-6 scrollbar-thin ${
                 selectedLessonForDetail.status === 'LOCAL'
                   ? 'w-full'
                   : 'lg:w-[60%] border-b lg:border-b-0 lg:border-r border-gray-200/80'
               }`}>
                 {/* Creator and general info banner */}
                 <div className="bg-white border border-gray-150 rounded-2xl p-5 mb-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                   <div className="flex items-center gap-3">
                     <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg font-bold shadow-md shadow-blue-500/10">
                       {(selectedLessonForDetail.creator?.full_name || selectedLessonForDetail.creator?.username || 'A')[0].toUpperCase()}
                     </div>
                     <div>
                       <span className="block text-xs text-gray-400 font-medium">Người đăng tải</span>
                       <span 
                         onClick={() => {
                           if (selectedLessonForDetail.creator) {
                             setSelectedCreatorForProfile(selectedLessonForDetail.creator);
                           }
                         }} 
                         className="font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors" 
                         title="Xem thông tin người đăng"
                       >
                         {selectedLessonForDetail.creator?.full_name || selectedLessonForDetail.creator?.username || 'Không xác định'}
                       </span>
                     </div>
                   </div>
                   <div className="flex items-center gap-4 text-sm text-gray-500">
                     <div className="bg-slate-100 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                       <span>📅</span>
                       <span className="font-semibold text-gray-700">{new Date(selectedLessonForDetail.created_at).toLocaleDateString('vi-VN')}</span>
                     </div>
                   </div>
                 </div>

                 {/* Description */}
                 <div className="mb-6">
                   <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tóm tắt / Mô tả</h4>
                   <div className="bg-white border border-gray-200 rounded-2xl p-5 text-gray-600 leading-relaxed text-sm shadow-sm">
                     {selectedLessonForDetail.description || 'Tài liệu này hiện chưa có mô tả chi tiết trong cơ sở dữ liệu.'}
                   </div>
                 </div>

                 {/* Key Metadata Cards */}
                 <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                      <div className="text-2xl">🎓</div>
                      <div>
                        <span className="block text-[11px] text-gray-400 font-bold uppercase">Đối tượng / Lớp</span>
                        <span className="font-bold text-gray-800 text-sm">{selectedLessonForDetail.target_student || 'Chung'}</span>
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                      <div className="text-2xl">🌍</div>
                      <div>
                        <span className="block text-[11px] text-gray-400 font-bold uppercase">Trạng thái phát hành</span>
                        <span className={`font-extrabold text-sm flex items-center gap-1 ${
                          selectedLessonForDetail.status === 'PUBLISHED' ? 'text-green-600' :
                          selectedLessonForDetail.status === 'PENDING' ? 'text-amber-600 animate-pulse' :
                          selectedLessonForDetail.status === 'REJECTED' ? 'text-red-600' : 'text-sky-600'
                        }`}>
                          {selectedLessonForDetail.status === 'PUBLISHED' ? 'Đã xuất bản (Public)' :
                           selectedLessonForDetail.status === 'PENDING' ? 'Chờ phê duyệt' :
                           selectedLessonForDetail.status === 'REJECTED' ? 'Bị từ chối' : 'Nội bộ (Local)'}
                        </span>
                      </div>
                    </div>
                 </div>

                 {/* Additional attributes */}
                  {selectedLessonForDetail.attributes && Object.keys(selectedLessonForDetail.attributes).filter(k => k !== 'tien_trinh_day_hoc' && k !== 'knowledge_tags').length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Thông tin bổ sung</h4>
                      <div className="flex flex-wrap gap-2 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                        {Object.entries(selectedLessonForDetail.attributes)
                          .filter(([key]) => key !== 'tien_trinh_day_hoc' && key !== 'knowledge_tags')
                          .map(([key, val]) => (
                            <span key={key} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-sm font-semibold border border-blue-100/50">
                              {key}: {String(val)}
                            </span>
                          ))
                        }
                      </div>
                    </div>
                  )}

                  {/* Render activities timeline if exists */}
                  <LessonActivitiesTimeline activities={selectedLessonForDetail.attributes?.tien_trinh_day_hoc} />

                 {/* Document Preview & Attachment */}
                 {(selectedLessonForDetail.file_path || selectedLessonForDetail.file_url) && (() => {
                   const fileUrl = getLessonFileUrl(selectedLessonForDetail);
                   const fileName = getFileName(selectedLessonForDetail.file_url || selectedLessonForDetail.file_path);
                   const isPdfFile = fileUrl.toLowerCase().endsWith('.pdf');
                   
                   if (isPdfFile) {
                     return (
                       <div className="mt-2 border-t border-gray-100 pt-6">
                         <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Xem tài liệu trực tuyến</h4>
                         <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm h-[600px] transition-all hover:shadow-md">
                           <iframe 
                             src={fileUrl} 
                             className="w-full h-full border-0" 
                             title="PDF Preview"
                           />
                         </div>
                       </div>
                     );
                   } else {
                     const isDocx = fileUrl.toLowerCase().endsWith('.docx') || fileUrl.toLowerCase().endsWith('.doc');                      if (isDocx) {
                        return (
                          <div className="mt-2 border-t border-gray-100 pt-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Xem chi tiết tài liệu</h4>
                              <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 shadow-sm self-start">
                                <button
                                  type="button"
                                  onClick={() => setPreviewMode('docx')}
                                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    previewMode === 'docx'
                                      ? 'bg-white text-blue-600 shadow-sm'
                                      : 'text-gray-500 hover:text-gray-900'
                                  }`}
                                >
                                  📝 Bản Word gốc (Offline)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPreviewMode('markdown')}
                                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    previewMode === 'markdown'
                                      ? 'bg-white text-blue-600 shadow-sm'
                                      : 'text-gray-500 hover:text-gray-900'
                                  }`}
                                >
                                  ⚡ Bản trích xuất Markdown
                                </button>
                              </div>
                            </div>
                            
                            {previewMode === 'docx' ? (
                              <div className="bg-white border border-gray-200 rounded-2xl p-1 shadow-sm transition-all hover:shadow-md">
                                <DocxPreview fileUrl={fileUrl} />
                              </div>
                            ) : (
                              <MarkdownViewer markdown={selectedLessonForDetail.content_preview} />
                            )}
                          </div>
                        );
                      }

                     const isPptx = fileUrl.toLowerCase().endsWith('.pptx') || fileUrl.toLowerCase().endsWith('.ppt');
                     const fileTypeLabel = isPptx ? 'Microsoft PowerPoint' : 'Tài liệu';
                     const fileIcon = isPptx ? '📊' : '📄';

                     return (
                       <div className="mt-2 border-t border-gray-100 pt-6">
                         <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tài liệu đính kèm</h4>
                         <div className="border border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-white shadow-sm">
                           <div className="text-6xl mb-4">{fileIcon}</div>
                           <h5 className="font-bold text-gray-900 text-lg mb-1 leading-snug break-all max-w-lg">{fileName}</h5>
                           <p className="text-sm text-gray-500 mb-6">Định dạng: <span className="font-semibold text-gray-700">{fileTypeLabel}</span></p>
                           
                           <div className="max-w-md bg-blue-50/40 border border-blue-100 rounded-xl p-4 text-left text-sm text-gray-600 mb-6 leading-relaxed">
                             💡 <strong>Hướng dẫn:</strong> Vì bạn đang chạy hệ thống dưới quyền máy chủ nội bộ (Localhost Offline), tài liệu {fileTypeLabel} cần được tải về máy tính để mở bằng Word/PowerPoint (tránh gửi tài liệu ra internet).
                           </div>

                           <a 
                             href={fileUrl} 
                             download={fileName}
                             target="_blank"
                             rel="noopener noreferrer"
                             className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md shadow-blue-200 hover:shadow-blue-300 transition-all flex items-center gap-2 hover:-translate-y-0.5 duration-150"
                           >
                             📥 Tải tài liệu về máy ngay
                           </a>
                         </div>
                       </div>
                     );
                   }
                 })()}
               </div>

               {/* Right Column - Ratings & Comments */}
               {selectedLessonForDetail.status !== 'LOCAL' && (
                 <div className="w-full lg:w-[40%] flex flex-col h-full bg-slate-50/50 overflow-y-auto p-6 scrollbar-thin">
                 {/* Rating Summary Card & Stats */}
                 <div className="bg-gradient-to-br from-amber-50 to-orange-50/20 border border-amber-100/60 rounded-2xl p-5 mb-6 shadow-sm">
                   <div className="flex items-center gap-6 mb-4">
                     <div className="text-center bg-white border border-amber-200/60 rounded-2xl px-5 py-4 shadow-sm flex-shrink-0">
                       <div className="text-4xl font-black text-amber-500">{ratingAvg > 0 ? ratingAvg.toFixed(1) : '0.0'}</div>
                       <div className="flex text-amber-400 text-xs my-1.5 justify-center">
                         {[1,2,3,4,5].map(star => (
                           <span key={star} className="text-lg leading-none">{star <= Math.round(ratingAvg) ? '★' : '☆'}</span>
                         ))}
                       </div>
                       <div className="text-xs text-gray-500 font-bold">{ratingTotal} đánh giá</div>
                     </div>
                     <div>
                       <h4 className="font-extrabold text-gray-900 text-base mb-1">Đánh giá chất lượng</h4>
                       <p className="text-sm text-gray-600 leading-normal text-slate-500">
                         {ratingTotal > 0 
                           ? 'Thống kê nhận xét chuyên môn từ hội đồng giáo viên và đồng nghiệp.' 
                           : 'Chưa có lượt đánh giá nào. Hãy chia sẻ nhận xét chuyên môn đầu tiên của bạn ở dưới!'}
                       </p>
                     </div>
                   </div>

                   {/* Horizonal Star Progress Bars (Statistics) */}
                   {ratingTotal > 0 && (
                     <div className="border-t border-amber-100/50 pt-4 space-y-2">
                       {[5, 4, 3, 2, 1].map(star => {
                         const percent = starStats.percentages[star as keyof typeof starStats.percentages] || 0;
                         const count = starStats.counts[star as keyof typeof starStats.counts] || 0;
                         return (
                           <div key={star} className="flex items-center gap-3 text-xs">
                             <span className="w-10 font-bold text-gray-600 flex items-center gap-0.5">{star} <span className="text-amber-500">★</span></span>
                             <div className="flex-grow h-2 bg-gray-100 rounded-full overflow-hidden">
                               <div 
                                 className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500" 
                                 style={{ width: `${percent}%` }}
                               ></div>
                             </div>
                             <span className="w-12 text-right text-gray-400 font-semibold">{percent}% ({count})</span>
                           </div>
                         );
                       })}
                     </div>
                   )}
                 </div>

                 {/* Interactive Star Filter */}
                 {ratingTotal > 0 && (
                   <div className="mb-6 bg-white border border-gray-150 rounded-2xl p-4 shadow-sm">
                     <div className="flex items-center justify-between mb-2.5">
                       <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Lọc theo số sao:</span>
                       {selectedStarFilter !== 'all' && (
                         <button 
                           onClick={() => setSelectedStarFilter('all')} 
                           className="text-xs text-blue-600 font-bold hover:underline"
                         >
                           Xóa bộ lọc
                         </button>
                       )}
                     </div>
                     <div className="flex flex-wrap gap-1.5">
                       <button
                         onClick={() => setSelectedStarFilter('all')}
                         className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                           selectedStarFilter === 'all'
                             ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                             : 'bg-slate-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                         }`}
                       >
                         Tất cả ({ratingTotal})
                       </button>
                       {[5, 4, 3, 2, 1].map(star => {
                         const count = starStats.counts[star as keyof typeof starStats.counts] || 0;
                         return (
                           <button
                             key={star}
                             onClick={() => setSelectedStarFilter(String(star))}
                             className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1 ${
                               selectedStarFilter === String(star)
                                 ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                                 : 'bg-slate-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                             }`}
                           >
                             {star} <span className={selectedStarFilter === String(star) ? 'text-white' : 'text-amber-500'}>★</span> ({count})
                           </button>
                         );
                       })}
                     </div>
                   </div>
                 )}

                 {/* My Highlighted Review (Nhận xét của bạn) — with integrated inline edit */}
                 {currentUser && lessonRatings.some((r: any) => r.user_id === currentUser.id) && (
                   (() => {
                     const myReview = lessonRatings.find((r: any) => r.user_id === currentUser.id);
                     if (!myReview) return null;
                     return (
                       <div className="bg-gradient-to-br from-blue-50 to-indigo-50/20 border border-blue-200/80 rounded-2xl p-5 shadow-sm mb-6">
                         <div className="flex items-center justify-between mb-3">
                           <h4 className="text-xs font-extrabold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                             <span>👤</span> Nhận xét của bạn
                           </h4>
                           <button
                             onClick={() => setEditingMyReview(!editingMyReview)}
                             className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 border ${
                               editingMyReview
                                 ? 'text-gray-600 bg-gray-100 hover:bg-gray-200 border-gray-200'
                                 : 'text-blue-700 bg-blue-100 hover:bg-blue-200 border-blue-200/50'
                             }`}
                           >
                             {editingMyReview ? '✕ Đóng chỉnh sửa' : '✏️ Chỉnh sửa lại bình luận'}
                           </button>
                         </div>

                         {/* Display mode */}
                         {!editingMyReview && (
                           <div className="bg-white border border-blue-100 rounded-xl p-4 shadow-sm">
                             <div className="flex items-center justify-between mb-2">
                               <span className="text-[10px] text-gray-400">📅 {new Date(myReview.created_at).toLocaleDateString('vi-VN')} {new Date(myReview.created_at).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</span>
                               <div className="flex bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                                 {[1,2,3,4,5].map(s => (
                                   <span key={s} className={`text-sm ${s <= myReview.rating ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                                 ))}
                               </div>
                             </div>
                             {myReview.comment ? (
                               <p className="text-sm text-gray-800 font-medium leading-relaxed whitespace-pre-wrap">{myReview.comment}</p>
                             ) : (
                               <p className="text-sm text-gray-400 italic font-medium">Bạn đã xếp hạng {myReview.rating} sao và không để lại bình luận viết.</p>
                             )}
                           </div>
                         )}

                         {/* Inline edit mode */}
                         {editingMyReview && (
                           <div className="bg-white border border-blue-100 rounded-xl p-4 shadow-sm">
                             <div className="flex items-center gap-2 mb-3">
                               {[1,2,3,4,5].map(star => (
                                 <button
                                   key={star}
                                   onClick={() => setMyRating(star)}
                                   type="button"
                                   className={`text-2xl transition-all duration-150 transform hover:scale-125 focus:outline-none ${
                                     star <= myRating ? 'text-amber-400 scale-110 drop-shadow-sm' : 'text-gray-200 hover:text-amber-200'
                                   }`}
                                 >
                                   ★
                                 </button>
                               ))}
                               {myRating > 0 && (
                                 <span className="ml-2 text-xs font-bold text-amber-700 px-2 py-0.5 bg-amber-50 rounded-lg border border-amber-100">
                                   {['','Rất tệ','Tệ','Bình thường','Tốt','Xuất sắc'][myRating]}
                                 </span>
                               )}
                             </div>

                             <textarea
                               value={myComment}
                               onChange={e => setMyComment(e.target.value)}
                               placeholder="Hãy đóng góp nhận xét chi tiết về bài giảng..."
                               rows={3}
                               className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none bg-slate-50/50 mb-3"
                             />
                             <div className="flex justify-end gap-2">
                               <button
                                 onClick={() => setEditingMyReview(false)}
                                 className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
                               >
                                 Hủy
                               </button>
                               <button
                                 disabled={myRating === 0 || ratingSubmitting}
                                 onClick={async () => {
                                   if (!currentUser || myRating === 0) return;
                                   setRatingSubmitting(true);
                                   try {
                                     const res = await axios.post(`/api/lesson-plans/${selectedLessonForDetail!.id}/ratings/`, {
                                       user_id: currentUser.id, rating: myRating, comment: myComment
                                     });
                                     setRatingAvg(res.data.average_rating);
                                     setRatingTotal(res.data.total_ratings);
                                     const res2 = await axios.get(`/api/lesson-plans/${selectedLessonForDetail!.id}/ratings/`);
                                     setLessonRatings(res2.data.ratings);
                                     fetchLessonPlans(searchQuery);
                                     setEditingMyReview(false);
                                   } catch { alert('Lỗi khi gửi đánh giá.'); }
                                     finally { setRatingSubmitting(false); }
                                 }}
                                 className={`px-5 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                                   myRating === 0 || ratingSubmitting
                                     ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                     : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20'
                                 }`}
                               >
                                 {ratingSubmitting ? '⟳ Đang gửi...' : '💾 Lưu thay đổi'}
                               </button>
                             </div>
                           </div>
                         )}
                       </div>
                     );
                   })()
                 )}

                 {/* New Rating Form — only shown when user has NOT reviewed yet */}
                 {currentUser && !lessonRatings.some((r: any) => r.user_id === currentUser.id) && (
                   <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm mb-6">
                     <h4 className="text-sm font-extrabold text-gray-900 mb-3 flex items-center gap-1.5">
                       ✍️ Gửi đánh giá & nhận xét
                     </h4>
                     
                     <div className="flex items-center gap-2 mb-3.5">
                       {[1,2,3,4,5].map(star => (
                         <button
                           key={star}
                           onClick={() => setMyRating(star)}
                           type="button"
                           className={`text-3xl transition-all duration-150 transform hover:scale-125 focus:outline-none ${
                             star <= myRating ? 'text-amber-400 scale-110 drop-shadow-sm' : 'text-gray-200 hover:text-amber-200'
                           }`}
                         >
                           ★
                         </button>
                       ))}
                       {myRating > 0 && (
                         <span className="ml-2 text-xs font-bold text-amber-700 px-2 py-0.5 bg-amber-50 rounded-lg border border-amber-100">
                           {['','Rất tệ','Tệ','Bình thường','Tốt','Xuất sắc'][myRating]}
                         </span>
                       )}
                     </div>

                     <textarea
                       value={myComment}
                       onChange={e => setMyComment(e.target.value)}
                       placeholder="Hãy đóng góp nhận xét chi tiết về bài giảng (phương pháp giảng dạy, nội dung, kiến thức học tập, cấu trúc bài giảng...)"
                       rows={3}
                       className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none bg-slate-50/50 mb-3"
                     />
                     <div className="flex justify-end">
                       <button
                         disabled={myRating === 0 || ratingSubmitting}
                         onClick={async () => {
                           if (!currentUser || myRating === 0) return;
                           setRatingSubmitting(true);
                           try {
                             const res = await axios.post(`/api/lesson-plans/${selectedLessonForDetail!.id}/ratings/`, {
                               user_id: currentUser.id, rating: myRating, comment: myComment
                             });
                             setRatingAvg(res.data.average_rating);
                             setRatingTotal(res.data.total_ratings);
                             const res2 = await axios.get(`/api/lesson-plans/${selectedLessonForDetail!.id}/ratings/`);
                             setLessonRatings(res2.data.ratings);
                             fetchLessonPlans(searchQuery);
                           } catch { alert('Lỗi khi gửi đánh giá.'); }
                             finally { setRatingSubmitting(false); }
                         }}
                         className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                           myRating === 0 || ratingSubmitting
                             ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                             : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 hover:-translate-y-0.5'
                         }`}
                       >
                         {ratingSubmitting ? '⟳ Đang gửi...' : '⭐ Gửi đánh giá'}
                       </button>
                     </div>
                   </div>
                 )}

                 {/* Comments list */}
                 <div className="flex flex-col flex-grow">
                   <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tất cả nhận xét</h4>
                   {ratingLoading ? (
                     <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-sm gap-2 bg-white border border-gray-150 rounded-2xl shadow-sm">
                       <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                       <span>Đang tải nhận xét...</span>
                     </div>
                   ) : otherReviews.length === 0 ? (
                     <div className="text-center py-12 text-gray-400 text-sm italic bg-white border border-gray-155 rounded-2xl shadow-sm">
                       {selectedStarFilter !== 'all' 
                         ? `Không có nhận xét nào đạt ${selectedStarFilter} sao.` 
                         : 'Chưa có nhận xét nào khác từ đồng nghiệp.'}
                     </div>
                   ) : (
                     <div className="space-y-4 pr-1 flex-grow">
                       {otherReviews.map((r: any) => (
                         <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm transition-all hover:shadow-md duration-200">
                           <div className="flex items-start justify-between mb-2">
                             <div className="flex items-center gap-3">
                               <div className="w-9 h-9 rounded-xl overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-extrabold shadow-sm flex-shrink-0">
                                 {r.user_avatar_url ? (
                                    <img src={r.user_avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                  ) : (
                                    (r.user_full_name || r.user_username || 'A')[0].toUpperCase()
                                  )}
                               </div>
                               <div>
                                 <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                                   {r.user_full_name || r.user_username}
                                 </p>
                                 <p className="text-[10px] text-gray-400">📅 {new Date(r.created_at).toLocaleDateString('vi-VN')} {new Date(r.created_at).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</p>
                               </div>
                             </div>
                             <div className="flex bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                               {[1,2,3,4,5].map(s => (
                                 <span key={s} className={`text-sm ${s <= r.rating ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                               ))}
                             </div>
                           </div>
                           {r.comment ? (
                             <p className="text-sm text-gray-700 leading-relaxed ml-12 whitespace-pre-wrap">{r.comment}</p>
                           ) : (
                             <p className="text-sm text-gray-400 italic leading-relaxed ml-12">Đã xếp hạng {r.rating} sao và không để lại nhận xét.</p>
                           )}
                         </div>
                       ))}
                     </div>
                   )}
                 </div>
               </div>
               )}
            </div>

            {/* Bottom Bar / Footer */}
            <div className="p-5 border-t border-gray-100 bg-white flex items-center justify-end gap-3 flex-shrink-0">
               {currentUser && (selectedLessonForDetail.creator?.id === currentUser.id || currentUser.role === 'ADMIN') && (
                 <button 
                   onClick={() => {
                     const id = selectedLessonForDetail.id;
                     setSelectedLessonForDetail(null);
                     handleDeleteLesson(id);
                   }} 
                   className="px-5 py-2.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 font-bold transition-all flex items-center gap-1.5 mr-auto hover:shadow-sm"
                 >
                   🗑️ Xóa tài liệu
                 </button>
               )}
               
               <button 
                 onClick={() => { setSelectedLessonForDetail(null); setLessonRatings([]); setMyRating(0); setMyComment(''); }} 
                 className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all hover:shadow-sm"
               >
                 Đóng
               </button>

               {currentUser && selectedLessonForDetail.creator?.id === currentUser.id && (
                 <>
                   <button 
                     onClick={() => {
                       const l = selectedLessonForDetail;
                       setSelectedLessonForDetail(null);
                       openEditModal(l);
                     }} 
                     className="px-5 py-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 font-bold hover:bg-amber-100 transition-all hover:shadow-sm"
                   >
                     ✏️ Chỉnh sửa thông tin
                   </button>
                   {(selectedLessonForDetail.status === 'LOCAL' || selectedLessonForDetail.status === 'REJECTED') && (
                     <button 
                       onClick={() => {
                         const l = selectedLessonForDetail;
                         setSelectedLessonForDetail(null);
                         openProposeModal(l);
                       }} 
                       className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:opacity-95 text-white font-bold transition-all shadow-md shadow-blue-500/10 hover:shadow-blue-500/20"
                     >
                       🌐 Đề xuất công khai
                     </button>
                   )}
                 </>
               )}

               {selectedLessonForDetail.file_path || selectedLessonForDetail.file_url ? (
                  <a
                    href={getLessonFileUrl(selectedLessonForDetail)}
                    download={getFileName(selectedLessonForDetail.file_url || selectedLessonForDetail.file_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold transition-all hover:shadow-md flex items-center justify-center gap-2"
                  >
                    ↓ Tải tài liệu về máy
                  </a>
                ) : (
                  <button disabled className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-455 font-bold cursor-not-allowed border border-gray-200">
                    Không có file đính kèm
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Creator Profile Modal */}
      {selectedCreatorForProfile && (
        <div className="fixed z-50 inset-0 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-100 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <span>👤</span> Thông tin tài khoản đăng tải
              </h3>
              <button 
                onClick={() => setSelectedCreatorForProfile(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Short Profile Intro */}
              <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
                <div className="w-16 h-16 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-2xl font-bold flex-shrink-0">
                  {(selectedCreatorForProfile.full_name || selectedCreatorForProfile.username || 'A')[0].toUpperCase()}
                </div>
                <div className="truncate">
                  <h4 className="text-base font-bold text-gray-900 truncate">
                    {selectedCreatorForProfile.full_name || 'Họ và tên chưa cập nhật'}
                  </h4>
                  <p className="text-sm text-gray-500 truncate">Tên tài khoản: @{selectedCreatorForProfile.username}</p>
                </div>
              </div>

              {/* Information Table/Grid */}
              <div className="space-y-3">
                {/* Email Info */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Địa chỉ Email</label>
                  <p className="text-sm font-semibold text-gray-800 bg-gray-50 px-3.5 py-2 rounded-xl border border-gray-150/60 truncate">
                    {selectedCreatorForProfile.email || 'Chưa cập nhật email'}
                  </p>
                </div>

                {/* Role Info */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Vai trò hệ thống</label>
                  <div>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-sm font-bold ${
                      selectedCreatorForProfile.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      selectedCreatorForProfile.role === 'TEACHER' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${
                        selectedCreatorForProfile.role === 'ADMIN' ? 'bg-purple-500' :
                        selectedCreatorForProfile.role === 'TEACHER' ? 'bg-blue-500' :
                        'bg-emerald-500'
                      }`}></span>
                      {selectedCreatorForProfile.role === 'ADMIN' ? 'Ban quản trị hệ thống' :
                       selectedCreatorForProfile.role === 'TEACHER' ? 'Giáo viên phụ trách môn' :
                       'Thành viên / Học sinh'}
                    </span>
                  </div>
                </div>

                {/* Statistics Info */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Đóng góp học liệu</label>
                  <p className="text-sm font-bold text-indigo-700 bg-indigo-50/50 px-3.5 py-2 rounded-xl border border-indigo-100 flex items-center gap-1.5">
                    📖 Đã đăng tải <strong>{allLessonPlans.filter(l => l.creator?.id === selectedCreatorForProfile.id).length}</strong> giáo án / tài liệu
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button 
                onClick={() => setSelectedCreatorForProfile(null)}
                className="w-full py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors shadow-sm"
              >
                Đóng hộp thoại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin User Management Modal */}


      {/* Approval Requests Management Modal */}
      {showApprovalModal && currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'TEACHER') && (
        <div className="fixed z-50 inset-0 flex items-center justify-center p-3 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl overflow-hidden border border-gray-100 flex flex-col" style={{height: '92vh'}}>
            {/* Modal Header */}
            <div className="bg-amber-700 text-white px-6 py-4 flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🛡️</span>
                <div>
                  <h3 className="text-xl font-bold">Xét duyệt bài giảng</h3>
                  <p className="text-amber-200 text-xs mt-0.5">Duyệt hoặc từ chối bài giảng được đăng bởi người dùng</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowApprovalModal(false); setSelectedApproval(null); }}
                className="text-white hover:text-amber-100 text-2xl transition-colors font-bold"
              >
                &times;
              </button>
            </div>

            {/* Modal Body — 2 columns */}
            <div className="flex flex-row flex-grow overflow-hidden min-h-0">
              {/* LEFT: Request list */}
              <div className="w-80 flex-shrink-0 border-r border-gray-100 flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                  <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Chờ duyệt ({pendingApprovals.length})
                  </h4>
                </div>
                <div className="overflow-y-auto flex-grow p-3 space-y-2">
                  {pendingApprovals.length === 0 ? (
                    <p className="text-sm text-gray-400 italic py-8 text-center">Không có bài giảng nào đang chờ duyệt.</p>
                  ) : (
                    pendingApprovals.map((req: any) => {
                      const isSelected = selectedApproval && selectedApproval.id === req.id;
                      return (
                        <div 
                          key={req.id}
                          onClick={() => { setSelectedApproval(req); setFeedback(req.feedback || ''); }}
                          className={`p-3 rounded-xl border transition-all cursor-pointer ${
                            isSelected 
                              ? 'border-amber-500 bg-amber-50 shadow-sm' 
                              : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/30'
                          }`}
                        >
                          <p className="font-semibold text-gray-900 text-sm truncate">{req.lesson_plan_title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">👤 {req.requester_name || 'Người dùng'}</p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 text-gray-600 border border-gray-200 rounded text-[10px] font-medium truncate max-w-[140px]">
                              📁 {req.target_directory_name}
                            </span>
                            <span className="text-[10px] text-gray-400 flex-shrink-0">
                              {new Date(req.created_at).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* RIGHT: Detail + Preview */}
              <div className="flex-grow flex flex-col overflow-hidden min-w-0">
                {selectedApproval ? (
                  <>
                    {/* Info section (scrollable) */}
                    <div className="flex-grow overflow-y-auto p-5 space-y-4">
                      {/* Title & meta */}
                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Chi tiết yêu cầu xét duyệt</p>
                        <h5 className="font-bold text-gray-900 text-lg leading-snug">{selectedApproval.lesson_plan_title}</h5>
                        <p className="text-sm text-gray-500 mt-1">
                          Gửi bởi: <strong className="text-gray-700">{selectedApproval.requester_name}</strong>
                          {' '}vào thư mục <strong className="text-gray-700">{selectedApproval.target_directory_name}</strong>
                          {' '}· {new Date(selectedApproval.created_at).toLocaleDateString('vi-VN')}
                        </p>
                      </div>

                      {/* Info grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white border border-gray-100 rounded-xl p-3">
                          <p className="text-xs text-gray-400 font-medium mb-1">Đối tượng giảng dạy</p>
                          <p className="text-sm font-semibold text-gray-800">{selectedApproval.lesson_plan_target_student || 'Không rõ'}</p>
                        </div>
                        <div className="bg-white border border-gray-100 rounded-xl p-3">
                          <p className="text-xs text-gray-400 font-medium mb-1">Ngày gửi duyệt</p>
                          <p className="text-sm font-semibold text-gray-800">{new Date(selectedApproval.created_at).toLocaleString('vi-VN')}</p>
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <h6 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Mô tả bài giảng</h6>
                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100 whitespace-pre-line leading-relaxed">
                          {selectedApproval.lesson_plan_description || 'Không có mô tả.'}
                        </p>
                      </div>

                      {/* Attributes */}
                      {selectedApproval.lesson_plan_attributes && Object.keys(selectedApproval.lesson_plan_attributes).filter(k => k !== 'knowledge_tags').length > 0 && (
                        <div>
                          <h6 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Thông tin bổ sung</h6>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(selectedApproval.lesson_plan_attributes)
                              .filter(([k]) => k !== 'knowledge_tags')
                              .map(([key, val]) => (
                                <span key={key} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-100">
                                  {key}: {String(val)}
                                </span>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Knowledge tags */}
                      {selectedApproval.lesson_plan_attributes?.knowledge_tags?.length > 0 && (
                        <div>
                          <h6 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Kiến thức môn học</h6>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedApproval.lesson_plan_attributes.knowledge_tags.map((tag: string) => (
                              <span key={tag} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium border border-indigo-100">
                                ⚡ {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* File preview */}
                      {selectedApproval.lesson_plan_file_url && (() => {
                        const fileUrl = selectedApproval.lesson_plan_file_url;
                        const isDocx = fileUrl.toLowerCase().endsWith('.docx') || fileUrl.toLowerCase().endsWith('.doc');
                        const isPdf = fileUrl.toLowerCase().endsWith('.pdf');
                        return (
                          <div>
                            <h6 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                              Xem trước tài liệu
                            </h6>
                            {isDocx && <DocxPreview fileUrl={fileUrl} />}
                            {isPdf && (
                              <div className="border border-gray-200 rounded-xl overflow-hidden h-[520px] shadow-inner">
                                <iframe src={fileUrl} className="w-full h-full border-0" title="PDF Preview" />
                              </div>
                            )}
                            {!isDocx && !isPdf && (
                              <div className="flex flex-col items-center justify-center gap-3 p-8 bg-gray-50 border border-gray-200 rounded-xl text-center">
                                <span className="text-5xl">📄</span>
                                <p className="text-sm text-gray-500">Định dạng này không hỗ trợ xem trực tuyến.</p>
                                <a href={fileUrl} download target="_blank" rel="noopener noreferrer"
                                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 flex items-center gap-2">
                                  📥 Tải tài liệu về máy
                                </a>
                              </div>
                            )}
                            <div className="mt-2 flex justify-end">
                              <a href={fileUrl} download target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700 transition-colors shadow-sm">
                                📥 Tải tài liệu về máy
                              </a>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Feedback textarea */}
                      <div>
                        <h6 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Phản hồi / Góp ý (nếu từ chối):</h6>
                        <textarea
                          value={feedback}
                          onChange={e => setFeedback(e.target.value)}
                          placeholder="Nhập lý do từ chối hoặc góp ý chỉnh sửa bài giảng..."
                          className="w-full text-sm border border-gray-200 rounded-xl p-3 h-24 focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
                        />
                      </div>
                    </div>

                    {/* Action footer */}
                    <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 bg-white flex gap-3 justify-end">
                      <button 
                        onClick={() => handleActionApproval(selectedApproval.id, 'REJECT', feedback)}
                        className="px-5 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-xl text-sm font-bold transition-colors"
                      >
                        ✕ Từ chối
                      </button>
                      <button 
                        onClick={() => handleActionApproval(selectedApproval.id, 'APPROVE')}
                        className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold shadow-md shadow-green-100 transition-all"
                      >
                        Duyệt & Xuất bản
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50 h-full">
                    <div className="text-5xl mb-3 text-amber-200">🛡️</div>
                    <h5 className="font-bold text-gray-700 text-base">Xem chi tiết bài giảng chờ duyệt</h5>
                    <p className="text-sm text-gray-400 mt-1 max-w-xs">
                      Chọn một bài giảng từ danh sách bên trái để phê duyệt xuất bản lên hệ thống.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => { setShowApprovalModal(false); setSelectedApproval(null); }}
                className="px-6 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50 transition-colors text-sm shadow-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Settings Modal */}
      {showProfileModal && currentUser && (
        <div className="fixed z-50 inset-0 flex items-center justify-center p-4 bg-slate-950/60 overflow-y-auto backdrop-blur-md transition-all">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100/80 flex flex-col my-8 transform transition-transform scale-100">
            {/* Header with gradient decoration */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-6 relative">
              <div className="absolute right-4 top-4">
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="text-white/80 hover:text-white transition-colors text-2xl font-bold p-1 leading-none rounded-full hover:bg-white/10"
                >
                  &times;
                </button>
              </div>
              <div className="flex items-center gap-4">
                {/* Visual Avatar display */}
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white flex items-center justify-center text-2xl font-black text-white shadow-md overflow-hidden flex-shrink-0">
                  {currentUser.avatar_url ? (
                    <img src={currentUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    profileFullName ? profileFullName.charAt(0).toUpperCase() : currentUser.username.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight">Hồ sơ cá nhân</h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs text-blue-100 font-semibold">@{currentUser.username}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-white/15 rounded-full font-bold uppercase tracking-wider text-white">
                      {currentUser.role === 'ADMIN' ? 'Quản trị viên' : currentUser.role === 'TEACHER' ? 'Giáo viên' : 'Người dùng'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveProfile} className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
              {profileSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold rounded-2xl flex items-center gap-2 shadow-sm animate-fade-in">
                  <span>✓</span> {profileSuccess}
                </div>
              )}

              {profileError && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold rounded-2xl flex items-center gap-2 shadow-sm">
                  <span>⚠</span> {profileError}
                </div>
              )}

              {/* Personal Info Card Section */}
              <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl space-y-4">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <span>👤</span> Thông tin cơ bản
                </h4>

                {/* Avatar Edit Section */}
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full border-4 border-slate-100 shadow-md overflow-hidden bg-slate-100 flex items-center justify-center text-4xl font-black text-slate-400">
                      {profileAvatarPreview ? (
                        <img src={profileAvatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                      ) : currentUser.avatar_url ? (
                        <img src={currentUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        profileFullName ? profileFullName.charAt(0).toUpperCase() : currentUser.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2.5 cursor-pointer shadow-md transition-colors border-2 border-white flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"></path>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"></path>
                      </svg>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <span className="text-xs text-slate-500 font-semibold">Tải ảnh đại diện mới</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Họ và tên hiển thị</label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      👤
                    </div>
                    <input
                      type="text"
                      required
                      value={profileFullName}
                      onChange={e => setProfileFullName(e.target.value)}
                      placeholder="Nhập họ và tên đầy đủ..."
                      className="block w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-700 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Password Change Card Section */}
              <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl space-y-4">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <span>🔑</span> Đổi mật khẩu bảo mật (Không bắt buộc)
                </h4>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Mật khẩu mới</label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        🔒
                      </div>
                      <input
                        type="password"
                        value={profileNewPassword}
                        onChange={e => setProfileNewPassword(e.target.value)}
                        placeholder="Nhập mật khẩu mới (nếu muốn đổi)..."
                        className="block w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-700 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Xác nhận mật khẩu mới</label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        🔄
                      </div>
                      <input
                        type="password"
                        value={profileConfirmNewPassword}
                        onChange={e => setProfileConfirmNewPassword(e.target.value)}
                        placeholder="Xác nhận lại mật khẩu mới..."
                        className="block w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-700 bg-white"
                      />
                    </div>
                  </div>
                </div>

                {profileNewPassword && (
                  <div className="border-t border-slate-200/60 pt-3">
                    <label className="block text-xs font-bold text-rose-600 mb-1.5 flex items-center gap-1">
                      <span>⚠</span> Xác thực mật khẩu cũ để lưu thay đổi
                    </label>
                    <div className="relative rounded-xl shadow-sm animate-pulse">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-rose-400">
                        🔑
                      </div>
                      <input
                        type="password"
                        required={!!profileNewPassword}
                        value={profileCurrentPassword}
                        onChange={e => setProfileCurrentPassword(e.target.value)}
                        placeholder="Nhập mật khẩu hiện tại..."
                        className="block w-full pl-10 pr-4 py-2.5 text-sm border border-rose-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-medium text-slate-700 bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Actions Footer inside form */}
              <div className="flex gap-3 justify-end border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-600 shadow-sm"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-md transition-all flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-100 ${
                    profileSaving ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {profileSaving ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Đang lưu...
                    </>
                  ) : (
                    'Lưu thay đổi'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}