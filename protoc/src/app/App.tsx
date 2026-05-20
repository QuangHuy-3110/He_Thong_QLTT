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

interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
}

// Count lessons in a directory and all its descendants
function countLessonsInDir(dirId: number, directories: Directory[], allLessons: LessonPlan[]): number {
  const childIds = directories.filter(d => d.parent === dirId).map(d => d.id);
  const directCount = allLessons.filter(l => l.directory_ids?.includes(dirId)).length;
  const childCount = childIds.reduce((sum, cid) => sum + countLessonsInDir(cid, directories, allLessons), 0);
  return directCount + childCount;
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

const DirectoryNode = ({
  dir: dirProp, directories, selectedDirs, onToggleDir,
  allLessons, currentUser, onAddChild, onDelete, onRename, onTogglePublic
}: any) => {
  // Always use the latest version of this dir from the directories array
  const dir = directories.find((d: any) => d.id === dirProp.id) || dirProp;
  const children = directories.filter((d: any) => d.parent === dir.id);
  const isSelected = selectedDirs.includes(dir.id);
  const [expanded, setExpanded] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(dir.name);

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
          className={`w-4 h-4 flex items-center justify-center text-xs text-gray-400 hover:text-gray-700 flex-shrink-0 ${children.length === 0 ? 'opacity-0 pointer-events-none' : ''}`}
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

      {expanded && children.length > 0 && (
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
            />
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
  dir, directories, selectedIds, onToggle, depth
}: { dir: Directory; directories: Directory[]; selectedIds: number[]; onToggle: (id: number, descendants: number[], checked: boolean) => void; depth: number }) => {
  const children = directories.filter(d => d.parent === dir.id);
  const isChecked = selectedIds.includes(dir.id);
  const [expanded, setExpanded] = useState(true);
  const descendants = getAllDescendantIds(dir.id, directories).slice(1); // exclude self

  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div className={`flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors ${ isChecked ? 'bg-purple-50' : 'hover:bg-gray-50' }`}>
        <button
          onClick={() => setExpanded(e => !e)}
          className={`w-4 h-4 flex items-center justify-center text-[10px] text-gray-400 hover:text-gray-600 flex-shrink-0 ${children.length === 0 ? 'invisible' : ''}`}
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
      {expanded && children.length > 0 && (
        <div className="border-l-2 border-purple-100 ml-4 pl-1">
          {children.map(child => (
            <PermissionDirTreeNode
              key={child.id}
              dir={child}
              directories={directories}
              selectedIds={selectedIds}
              onToggle={onToggle}
              depth={0}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [directories, setDirectories] = useState<Directory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'home' | 'upload'>('home');
  const [homeTab, setHomeTab] = useState<'library' | 'history' | 'personal'>('library');
  
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

  // Current teacher's own managed directory IDs (fetched on login)
  const [myManagedDirIds, setMyManagedDirIds] = useState<number[]>([]);

  // Lesson plan approval states
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [selectedApproval, setSelectedApproval] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<string>('');

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
      setSelectedUserForPerms(null);
      fetchAdminUsers();
      // Refetch directories to update locked/unlocked folder ownership in real-time
      const url = currentUser ? `/api/directories/?user_id=${currentUser.id}` : '/api/directories/';
      const freshRes = await axios.get(url);
      setDirectories(freshRes.data);
    } catch (err) {
      alert('Lỗi cập nhật phân quyền.');
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
  
  // States for Proposing to Public
  const [showProposeModal, setShowProposeModal] = useState<boolean>(false);
  const [lessonToPropose, setLessonToPropose] = useState<LessonPlan | null>(null);
  const [targetPublicDirId, setTargetPublicDirId] = useState<string>('');
  
  const [selectedTargetStudents, setSelectedTargetStudents] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

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

  // All lessons (unfiltered) for counting and client-side filtering
  const [allLessonPlans, setAllLessonPlans] = useState<LessonPlan[]>([]);

  const fetchLessonPlans = async (query: string = '') => {
    setLoading(true);
    try {
      // Always fetch all lesson plans to perform instant client-side searching & filtering
      let url = '/api/lesson-plans/';
      if (currentUser) url += `?user_id=${currentUser.id}`;
      const response = await axios.get(url);
      setAllLessonPlans(response.data);
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

  useEffect(() => {
    fetchLessonPlans(searchQuery);
  }, [currentUser]);

  useEffect(() => {
    fetchDirectories();
  }, [currentUser]);

  useEffect(() => {
    fetchPendingApprovals();
  }, [currentUser]);

  useEffect(() => {
    fetchMyPermissions();
  }, [currentUser]);

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
      if (!response.ok) throw new Error('Edit failed with status ' + response.status);

      const msg = currentUser.role === 'USER'
        ? 'Đã gửi bản chỉnh sửa để chờ duyệt lại!'
        : 'Cập nhật thành công!';
      alert(msg);
      setEditingLesson(null);
      setEditFile(null);
      fetchLessonPlans(searchQuery);
    } catch (err) {
      console.error('Edit Error:', err);
      alert('Lỗi cập nhật tài liệu. Vui lòng kiểm tra console.');
    }
  };

  const openProposeModal = (lesson: LessonPlan) => {
    setLessonToPropose(lesson);
    setTargetPublicDirId('');
    setShowProposeModal(true);
  };

  const handleProposePublic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonToPropose || !targetPublicDirId || !currentUser) return;
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
      alert('Lỗi gửi đề xuất: ' + (err.response?.data?.error || err.message));
    }
  };

  // Filter root directories (only public ones for the main Shared Library)
  const rootDirs = directories.filter(d => !d.parent && d.is_public);

  // Derive base lesson pool: filtered by selected directories (client-side)
  const dirFilteredLessons = useMemo(() => {
    if (selectedDirs.length === 0) return allLessonPlans;
    const result = new Map<number, LessonPlan>();
    selectedDirs.forEach(dirId => {
      getLessonsInDir(dirId, directories, allLessonPlans).forEach(l => result.set(l.id, l));
    });
    return Array.from(result.values());
  }, [selectedDirs, directories, allLessonPlans]);

  // Dynamic subject list from current dir-filtered pool
  const availableSubjects = useMemo(() => {
    const subjects = new Set<string>();
    dirFilteredLessons.forEach(l => {
      const s = l.attributes?.['Môn học'];
      if (s) subjects.add(s);
    });
    return Array.from(subjects).sort();
  }, [dirFilteredLessons]);

  // Apply remaining checkbox filters AND dynamic approximate search query
  const filteredLessonPlans = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const queryClean = removeAccents(query);

    return dirFilteredLessons.filter(lesson => {
      // 1. Dynamic Approximate/Sub-string Search (Title & Description, case & accent insensitive)
      if (query) {
        const title = (lesson.title || '').toLowerCase();
        const desc = (lesson.description || '').toLowerCase();
        const titleClean = removeAccents(title);
        const descClean = removeAccents(desc);

        const matchesQuery = 
          title.includes(query) || 
          desc.includes(query) || 
          titleClean.includes(queryClean) || 
          descClean.includes(queryClean);

        if (!matchesQuery) return false;
      }

      // 2. Check Target Student
      if (selectedTargetStudents.length > 0 && !selectedTargetStudents.includes(lesson.target_student || '')) {
        return false;
      }

      // 3. Check Type
      const type = lesson.attributes?.['Loại hình'] || '';
      if (selectedTypes.length > 0 && !selectedTypes.includes(type)) {
        return false;
      }

      // 4. Check Subject
      const subject = lesson.attributes?.['Môn học'] || '';
      if (selectedSubjects.length > 0 && !selectedSubjects.includes(subject)) {
        return false;
      }

      return true;
    });
  }, [dirFilteredLessons, searchQuery, selectedTargetStudents, selectedTypes, selectedSubjects]);


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
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center gap-2 cursor-pointer" onClick={() => { setCurrentView('home'); setSelectedDirs([]); }}>
                <div className="bg-blue-600 rounded text-white p-1 font-bold text-xl leading-none">📚</div>
                <span className="font-bold text-xl text-gray-900 hidden sm:block">Hệ thống quản lý tri thức</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4 flex-grow max-w-2xl mx-12">
               <form onSubmit={handleSearch} className="flex-grow flex shadow-sm rounded-full bg-gray-50 border border-gray-200 overflow-hidden">
                 <div className="px-4 py-2 text-gray-400">🔍</div>
                 <input
                   type="text"
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="w-full bg-transparent focus:outline-none text-sm text-gray-700 placeholder-gray-500 py-2"
                   placeholder="Tìm kiếm kế hoạch bài giảng theo tên hoặc nội dung..."
                 />
                 <button type="submit" className="px-4 bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700 transition-colors">
                   Tìm
                 </button>
               </form>
            </div>

            <div className="flex items-center">
              {currentUser ? (
                <div className="flex items-center gap-4">
                  <div className="flex gap-2 mr-4">
                    {currentUser.role === 'ADMIN' && (
                      <button
                        onClick={() => setShowAdminModal(true)}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
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
                    <button onClick={() => setCurrentView('upload')} className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-md text-sm font-semibold transition-colors flex items-center gap-1">
                      <span>+</span> Đăng bài giảng
                    </button>
                  </div>
                  <div className="text-right hidden md:block">
                    <div className="text-sm font-semibold text-gray-900">{currentUser.full_name || currentUser.username}</div>
                    <div className="text-xs text-gray-500 font-medium">
                      {currentUser.role === 'ADMIN' ? (
                        <span className="text-red-600 font-bold">Admin</span>
                      ) : currentUser.role === 'TEACHER' ? (
                        <span className="text-blue-600 font-bold">Giáo viên</span>
                      ) : (
                        <span className="text-gray-500 font-medium">Người dùng thường</span>
                      )}
                    </div>
                  </div>
                  <button onClick={handleLogout} className="ml-2 px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
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
              <div className="text-sm">
                <div 
                  className={`flex items-center gap-2 cursor-pointer py-1.5 px-2 rounded-md transition-colors mb-1 ${selectedDirs.length === 0 ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
                  onClick={() => setSelectedDirs([])}
                >
                  <span className="w-4"></span>
                  <span className="text-gray-400">🏠</span>
                  <span className="flex-grow">Tất cả tài liệu</span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{allLessonPlans.length}</span>
                </div>
                {rootDirs.map(dir => (
                  <DirectoryNode
                    key={dir.id}
                    dir={dir}
                    directories={directories}
                    selectedDirs={selectedDirs}
                    onToggleDir={handleToggleDir}
                    allLessons={allLessonPlans}
                    currentUser={currentUser}
                    onAddChild={handleAddChildDir}
                    onDelete={handleDeleteDir}
                    onRename={handleRenameDir}
                    onTogglePublic={handleTogglePublicDir}
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
                <div className="mb-6">
                  <p className="text-sm text-gray-500 font-medium">
                    Tìm thấy {filteredLessonPlans.length} kết quả
                    {selectedDirs.length > 0 && <span className="ml-1 text-blue-600">(trong {selectedDirs.length} thư mục đã chọn)</span>}
                  </p>
                </div>

                {loading ? (
                  <div className="flex justify-center py-20"><div className="text-blue-600 animate-pulse font-medium">Đang tải dữ liệu...</div></div>
                ) : error ? (
                  <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
                ) : filteredLessonPlans.length === 0 ? (
                  <div className="text-center py-20 text-gray-500 bg-gray-50 rounded-xl border border-gray-200">Không có tài liệu nào trong mục này.</div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredLessonPlans.map((lesson) => (
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
                          {/* Directory full path breadcrumb badge */}
                          {lesson.directory_ids && lesson.directory_ids.length > 0 ? (
                            lesson.directory_ids.map((dirId, i) => (
                              <span key={i} className="px-2 py-1 bg-violet-50 text-violet-700 border border-violet-100 text-xs font-medium rounded-md flex items-center gap-1 max-w-[250px] truncate" title={getDirectoryFullPath(dirId, directories)}>
                                📂 {getDirectoryFullPath(dirId, directories)}
                              </span>
                            ))
                          ) : (
                            <span className="px-2 py-1 bg-gray-50 text-gray-400 border border-gray-100 text-xs font-medium rounded-md">📄 Không có thư mục</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-4 line-clamp-3 flex-grow">{lesson.description || 'Chưa có mô tả.'}</p>
                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50 text-xs text-gray-400">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-700">{lesson.creator?.full_name || lesson.creator?.username || 'Ẩn danh'}</span>
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
              </>
            )}

            {/* ══ HISTORY TAB ══ */}
            {homeTab === 'history' && currentUser && (() => {
              const myLessons = allLessonPlans
                .filter(l => l.creator?.id === currentUser.id && l.status !== 'LOCAL')
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
                              {lesson.status === 'LOCAL' && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-sky-100 text-sky-700 border border-sky-200 rounded-full text-xs font-bold">💾 Lưu cục bộ</span>
                              )}
                            </div>
                          </div>

                          {/* Description */}
                          {lesson.description && (
                            <p className="text-sm text-gray-600 line-clamp-2 mb-3">{lesson.description}</p>
                          )}

                          {/* Rejection Feedback Box */}
                          {lesson.status === 'REJECTED' && lesson.latest_feedback && (
                            <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                              <p className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-1">💬 Lý do từ chối:</p>
                              <p className="text-sm text-rose-800 leading-relaxed">{lesson.latest_feedback}</p>
                            </div>
                          )}

                          {/* Action Row */}
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
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
                            <button
                              onClick={() => handleDeleteLesson(lesson.id)}
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

              return (
                <div className="flex flex-col lg:flex-row gap-6 min-h-[500px]">
                  {/* Left: Personal Folder Tree */}
                  <div className="w-full lg:w-[260px] border-r border-gray-100 lg:pr-6 flex-shrink-0">
                    <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider font-bold">Cây thư mục cá nhân</h3>
                    <div className="text-sm mt-2">
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
                  <div className="flex-grow">
                    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">Thư viện cá nhân</h2>
                        <p className="text-sm text-gray-500 mt-1">Tài liệu riêng tư và thư mục cá nhân của bạn.</p>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="text-sm bg-sky-50 text-sky-700 border border-sky-100 px-3 py-1.5 rounded-full font-semibold">{dirFilteredPersonalLessons.length} tài liệu</span>
                        <button 
                          onClick={() => {
                            if (selectedPersonalDirs.length > 0) {
                              setUpDirId(selectedPersonalDirs[0].toString());
                            } else {
                              setUpDirId('');
                            }
                            setCurrentView('upload');
                          }} 
                          className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors"
                        >
                          + Thêm mới
                        </button>
                      </div>
                    </div>

                    {dirFilteredPersonalLessons.length === 0 ? (
                      <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <div className="text-5xl mb-4">💾</div>
                        <p className="text-gray-500 font-medium">Không tìm thấy tài liệu nào.</p>
                        <p className="text-sm text-gray-400 mt-1">Hãy tải tệp lên hoặc tạo thư mục cá nhân để bắt đầu quản lý.</p>
                        <button 
                          onClick={() => {
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
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {dirFilteredPersonalLessons.map(lesson => (
                          <div 
                            key={lesson.id} 
                            onClick={() => setSelectedLessonForDetail(lesson)}
                            className="bg-white rounded-2xl border border-sky-100/60 p-5 shadow-sm hover:shadow-md hover:border-sky-300 transition-all cursor-pointer flex flex-col justify-between group"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <h3 className="font-bold text-gray-900 text-base leading-snug flex-grow group-hover:text-sky-700 transition-colors">{lesson.title}</h3>
                                {lesson.status === 'LOCAL' ? (
                                  <span className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-full text-[10px] font-bold">🔒 Riêng tư</span>
                                ) : lesson.status === 'PENDING' ? (
                                  <span className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold">⏳ Chờ duyệt</span>
                                ) : lesson.status === 'REJECTED' ? (
                                  <span className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-[10px] font-bold">❌ Bị từ chối</span>
                                ) : (
                                  <span className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-[10px] font-bold">🌐 Công khai</span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                {lesson.directory_ids && lesson.directory_ids.length > 0 ? (
                                  lesson.directory_ids.map((dirId, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-violet-50 text-violet-700 border border-violet-100 text-xs rounded-md max-w-[220px] truncate" title={getDirectoryFullPath(dirId, directories)}>
                                      📂 {getDirectoryFullPath(dirId, directories)}
                                    </span>
                                  ))
                                ) : (
                                  <span className="px-2 py-0.5 bg-gray-50 text-gray-400 border border-gray-100 text-xs rounded-md">📄 Chưa phân thư mục</span>
                                )}
                                {lesson.target_student && (
                                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs rounded-md">📖 {lesson.target_student}</span>
                                )}
                              </div>
                              {lesson.description && <p className="text-sm text-gray-600 line-clamp-2 mb-3">{lesson.description}</p>}
                              {lesson.latest_feedback && (
                                <div className="mb-3 p-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
                                  <strong>Phản hồi duyệt:</strong> {lesson.latest_feedback}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-auto text-xs text-gray-400">
                              <span>📅 {new Date(lesson.created_at).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
                              <span className="text-xs font-bold text-sky-600 group-hover:underline">Xem chi tiết ↗</span>
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
                <select value={dirParentId} onChange={e=>setDirParentId(e.target.value)} className="w-full border rounded-lg p-2 text-sm">
                  <option value="">-- Cấp cao nhất --</option>
                  {directories.map(d => <option key={d.id} value={d.id}>{d.name} ({d.is_public ? 'Public' : 'Local'})</option>)}
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
                <select value={upDirId} onChange={e=>setUpDirId(e.target.value)} className="w-full border rounded-lg p-2 text-sm">
                  <option value="">-- Không chọn --</option>
                  {directories.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
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
            <form onSubmit={handleProposePublic} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Chọn thư mục công khai muốn đưa tài liệu vào:
                </label>
                <select 
                  required
                  value={targetPublicDirId} 
                  onChange={e => setTargetPublicDirId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chọn thư mục công khai --</option>
                  {directories.filter(d => d.is_public).map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
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
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Giữ nguyên / Chưa phân thư mục --</option>
                  {directories.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.is_public ? '🌐 [Công khai] ' : '🔒 [Riêng tư] '} {getDirectoryFullPath(d.id, directories)}
                    </option>
                  ))}
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
        <div className="fixed z-50 inset-0 flex items-center justify-center p-4 sm:p-6 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-start p-6 border-b border-gray-100">
               <div>
                 <h2 className="text-2xl font-bold text-gray-900 mb-2 leading-tight">{selectedLessonForDetail.title}</h2>
                 <div className="flex items-center gap-3 text-sm text-gray-500">
                   <span className="flex items-center gap-1">👤 {selectedLessonForDetail.creator?.full_name || selectedLessonForDetail.creator?.username || 'Không xác định'}</span>
                   <span>•</span>
                   <span className="flex items-center gap-1">📅 {new Date(selectedLessonForDetail.created_at).toLocaleDateString('vi-VN')}</span>
                 </div>
               </div>
               <button onClick={() => setSelectedLessonForDetail(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                  ✕
               </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-grow bg-gray-50/30">
               <div className="mb-6">
                 <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Tóm tắt / Mô tả</h4>
                 <div className="bg-white border border-gray-200 rounded-xl p-4 text-gray-600 leading-relaxed text-sm">
                   {selectedLessonForDetail.description || 'Tài liệu này hiện chưa có mô tả chi tiết trong cơ sở dữ liệu.'}
                 </div>
               </div>

               <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <span className="block text-xs text-gray-500 font-medium mb-1">Đối tượng / Lớp</span>
                    <span className="font-semibold text-gray-800">{selectedLessonForDetail.target_student || 'Chung'}</span>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <span className="block text-xs text-gray-500 font-medium mb-1">Trạng thái phát hành</span>
                    <span className={`font-semibold flex items-center gap-1 ${
                      selectedLessonForDetail.status === 'PUBLISHED' ? 'text-green-600' :
                      selectedLessonForDetail.status === 'PENDING' ? 'text-amber-600 animate-pulse' :
                      selectedLessonForDetail.status === 'REJECTED' ? 'text-red-600' : 'text-sky-600'
                    }`}>
                      {selectedLessonForDetail.status === 'PUBLISHED' ? '🌐 Đã xuất bản (Public)' :
                       selectedLessonForDetail.status === 'PENDING' ? '⏳ Chờ phê duyệt' :
                       selectedLessonForDetail.status === 'REJECTED' ? '❌ Bị từ chối' : '🔒 Nội bộ (Local)'}
                    </span>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <span className="block text-xs text-gray-500 font-medium mb-1">Thư mục lưu trữ</span>
                    <span className="font-semibold text-violet-700 block truncate" title={
                      selectedLessonForDetail.directory_ids && selectedLessonForDetail.directory_ids.length > 0
                        ? getDirectoryFullPath(selectedLessonForDetail.directory_ids[0], directories)
                        : 'Chưa phân thư mục'
                    }>
                      📂 {
                        selectedLessonForDetail.directory_ids && selectedLessonForDetail.directory_ids.length > 0
                          ? getDirectoryFullPath(selectedLessonForDetail.directory_ids[0], directories)
                          : 'Chưa phân thư mục'
                      }
                    </span>
                  </div>
               </div>

               {selectedLessonForDetail.attributes && Object.keys(selectedLessonForDetail.attributes).length > 0 && (
                 <div className="mb-6">
                   <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Thông tin bổ sung</h4>
                   <div className="flex flex-wrap gap-2">
                     {Object.entries(selectedLessonForDetail.attributes).map(([key, val]) => (
                       <span key={key} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-100">
                         {key}: {String(val)}
                       </span>
                     ))}
                   </div>
                 </div>
               )}

               {(selectedLessonForDetail.file_path || selectedLessonForDetail.file_url) && (() => {
                 const fileUrl = getLessonFileUrl(selectedLessonForDetail);
                 const fileName = getFileName(selectedLessonForDetail.file_url || selectedLessonForDetail.file_path);
                 const isPdfFile = fileUrl.toLowerCase().endsWith('.pdf');
                 
                 if (isPdfFile) {
                   return (
                     <div className="mt-6 border-t border-gray-200 pt-6">
                       <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Xem tài liệu trực tuyến</h4>
                       <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-inner h-[600px]">
                         <iframe 
                           src={fileUrl} 
                           className="w-full h-full border-0" 
                           title="PDF Preview"
                         />
                       </div>
                     </div>
                   );
                 } else {
                   const isDocx = fileUrl.toLowerCase().endsWith('.docx') || fileUrl.toLowerCase().endsWith('.doc');
                   
                   if (isDocx) {
                     return (
                       <div className="mt-6 border-t border-gray-200 pt-6">
                         <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Xem chi tiết tài liệu Word (Offline)</h4>
                         <DocxPreview fileUrl={fileUrl} />
                       </div>
                     );
                   }

                   const isPptx = fileUrl.toLowerCase().endsWith('.pptx') || fileUrl.toLowerCase().endsWith('.ppt');
                   const fileTypeLabel = isPptx ? 'Microsoft PowerPoint' : 'Tài liệu';
                   const fileIcon = isPptx ? '📊' : '📄';

                   return (
                     <div className="mt-6 border-t border-gray-200 pt-6">
                       <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Tài liệu đính kèm</h4>
                       <div className="border border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-gray-50/50">
                         <div className="text-6xl mb-4">{fileIcon}</div>
                         <h5 className="font-bold text-gray-900 text-lg mb-1 leading-snug break-all max-w-lg">{fileName}</h5>
                         <p className="text-sm text-gray-500 mb-6">Định dạng: <span className="font-semibold text-gray-700">{fileTypeLabel}</span></p>
                         
                         <div className="max-w-md bg-white border border-gray-200 rounded-xl p-4 text-left text-sm text-gray-600 mb-6 shadow-sm">
                           💡 <strong>Hướng dẫn:</strong> Vì bạn đang chạy hệ thống dưới quyền máy chủ nội bộ (Localhost Offline), tài liệu {fileTypeLabel} cần được tải về máy tính để mở bằng Word/PowerPoint (tránh gửi tài liệu ra internet).
                         </div>

                         <a 
                           href={fileUrl} 
                           download={fileName}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md shadow-blue-200 transition-all flex items-center gap-2"
                         >
                           📥 Tải tài liệu về máy ngay
                         </a>
                       </div>
                     </div>
                   );
                 }
               })()}
            </div>

            <div className="p-6 border-t border-gray-100 bg-white flex items-center justify-end gap-3">
               {currentUser && (selectedLessonForDetail.creator?.id === currentUser.id || currentUser.role === 'ADMIN') && (
                 <button 
                   onClick={() => {
                     const id = selectedLessonForDetail.id;
                     setSelectedLessonForDetail(null);
                     handleDeleteLesson(id);
                   }} 
                   className="px-5 py-2.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 font-bold transition-colors mr-auto"
                 >
                   🗑️ Xóa tài liệu
                 </button>
               )}
               
               <button onClick={() => setSelectedLessonForDetail(null)} className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors">
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
                     className="px-5 py-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 font-bold hover:bg-amber-100 transition-colors"
                   >
                     ✏️ Chỉnh sửa
                   </button>
                   {(selectedLessonForDetail.status === 'LOCAL' || selectedLessonForDetail.status === 'REJECTED') && (
                     <button 
                       onClick={() => {
                         const l = selectedLessonForDetail;
                         setSelectedLessonForDetail(null);
                         openProposeModal(l);
                       }} 
                       className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:opacity-90 text-white font-bold transition-all"
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
                    className="px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    ↓ Tải tài liệu về máy
                  </a>
                ) : (
                  <button disabled className="px-5 py-2.5 rounded-xl bg-gray-200 text-gray-500 font-bold cursor-not-allowed">
                    Không có file đính kèm
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Admin User Management Modal */}
      {showAdminModal && currentUser && currentUser.role === 'ADMIN' && (
        <div className="fixed z-50 inset-0 flex items-center justify-center p-4 bg-gray-900/60 overflow-y-auto backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-gray-100 flex flex-col my-8 max-h-[85vh]">
            {/* Modal Header */}
            <div className="bg-purple-800 text-white p-6 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-2xl">👥</span>
                <div>
                  <h3 className="text-xl font-bold">Quản trị người dùng & Phân quyền hệ thống</h3>
                  <p className="text-purple-200 text-xs mt-0.5">Admin toàn quyền quản lý tài khoản và giao quyền thư mục</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowAdminModal(false); setSelectedUserForPerms(null); }}
                className="text-white hover:text-purple-100 text-2xl transition-colors font-bold animate-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-grow grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[400px]">
              {/* User List Panel */}
              <div className="border-r border-gray-100 pr-0 md:pr-6">
                <h4 className="font-bold text-gray-800 text-base mb-4 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                  Danh sách tài khoản ({adminUsers.length})
                </h4>
                <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2">
                  {adminUsers.map((u: any) => {
                    const isSelected = selectedUserForPerms && selectedUserForPerms.id === u.id;
                    return (
                      <div 
                        key={u.id}
                        onClick={() => {
                          setSelectedUserForPerms(u);
                          setSelectedUserDirIds(u.managed_directories || []);
                        }}
                        className={`p-4 rounded-xl border transition-all cursor-pointer flex justify-between items-center ${
                          isSelected 
                            ? 'border-purple-600 bg-purple-50/50 shadow-sm' 
                            : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/10'
                        }`}
                      >
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{u.full_name || u.username}</p>
                          <p className="text-xs text-gray-400 mt-0.5">Username: {u.username}</p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              u.role === 'ADMIN' 
                                ? 'bg-red-50 text-red-700 border-red-100' 
                                : u.role === 'TEACHER' 
                                ? 'bg-blue-50 text-blue-700 border-blue-100'
                                : 'bg-gray-50 text-gray-600 border-gray-200'
                            }`}>
                              {u.role === 'ADMIN' ? 'Admin' : u.role === 'TEACHER' ? 'Giáo viên' : 'Người dùng'}
                            </span>
                            <span className="text-xs text-gray-500">
                              • Đang quản lý {u.managed_directories?.length || 0} thư mục
                            </span>
                          </div>
                        </div>
                        <span className="text-purple-600 font-bold text-lg">➔</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Folder Permissions Config Panel */}
              <div className="flex flex-col h-full justify-between">
                {selectedUserForPerms ? (
                  <div className="flex flex-col h-full">
                    <div className="bg-purple-50 border border-purple-100/50 rounded-xl p-4 mb-4">
                      <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Đang phân quyền cho</p>
                      <h5 className="font-bold text-gray-950 text-base mt-1">{selectedUserForPerms.full_name || selectedUserForPerms.username}</h5>
                      <p className="text-xs text-gray-500 mt-1">
                        💡 Tích chọn các thư mục người dùng này được phép quản trị cao nhất (thêm, sửa, xóa, đổi tên).
                      </p>
                    </div>

                    <h4 className="font-bold text-gray-800 text-sm mb-2">Lựa chọn thư mục quản lý:</h4>
                    <div className="border border-gray-200 rounded-xl p-3 overflow-y-auto max-h-[320px] flex-grow bg-gray-50/30">
                      {directories.length === 0 ? (
                        <p className="text-sm text-gray-400 italic p-2">Hệ thống chưa có thư mục nào.</p>
                      ) : (
                        <div className="space-y-0.5">
                          {directories.filter(d => !d.parent).map((dir: Directory) => (
                            <PermissionDirTreeNode
                              key={dir.id}
                              dir={dir}
                              directories={directories}
                              selectedIds={selectedUserDirIds}
                              onToggle={(id, descendants, checked) => {
                                // Cascading: select/deselect self + all children recursively
                                const allIds = [id, ...descendants];
                                if (checked) {
                                  setSelectedUserDirIds(prev => Array.from(new Set([...prev, ...allIds])));
                                } else {
                                  setSelectedUserDirIds(prev => prev.filter(x => !allIds.includes(x)));
                                }
                              }}
                              depth={0}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2 justify-end">
                      <button 
                        onClick={() => setSelectedUserForPerms(null)}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                      >
                        Hủy
                      </button>
                      <button 
                        onClick={handleSaveUserPermissions}
                        className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold shadow-md shadow-purple-100 transition-all"
                      >
                        Lưu phân quyền
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50 h-full">
                    <div className="text-5xl mb-3 text-purple-200">🔑</div>
                    <h5 className="font-bold text-gray-700 text-base">Cấu hình quyền thư mục</h5>
                    <p className="text-sm text-gray-400 mt-1 max-w-xs">
                      Chọn một người dùng từ danh sách bên trái để cấu hình quyền quản trị thư mục cho họ.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => { setShowAdminModal(false); setSelectedUserForPerms(null); }}
                className="px-6 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50 transition-colors text-sm shadow-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Requests Management Modal */}
      {showApprovalModal && currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'TEACHER') && (
        <div className="fixed z-50 inset-0 flex items-center justify-center p-4 bg-gray-900/60 overflow-y-auto backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden border border-gray-100 flex flex-col my-8 max-h-[85vh]">
            {/* Modal Header */}
            <div className="bg-amber-700 text-white p-6 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🛡️</span>
                <div>
                  <h3 className="text-xl font-bold">Xét duyệt bài giảng</h3>
                  <p className="text-amber-200 text-xs mt-0.5">Duyệt hoặc từ chối bài giảng được đăng bởi người dùng thường</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowApprovalModal(false); setSelectedApproval(null); }}
                className="text-white hover:text-amber-100 text-2xl transition-colors font-bold"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-grow grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[400px]">
              {/* Request List Panel */}
              <div className="border-r border-gray-100 pr-0 md:pr-6">
                <h4 className="font-bold text-gray-800 text-base mb-4 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                  Yêu cầu đang chờ duyệt ({pendingApprovals.length})
                </h4>
                <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2">
                  {pendingApprovals.length === 0 ? (
                    <p className="text-sm text-gray-400 italic py-8 text-center">Không có bài giảng nào đang chờ duyệt.</p>
                  ) : (
                    pendingApprovals.map((req: any) => {
                      const isSelected = selectedApproval && selectedApproval.id === req.id;
                      return (
                        <div 
                          key={req.id}
                          onClick={() => {
                            setSelectedApproval(req);
                            setFeedback(req.feedback || '');
                          }}
                          className={`p-4 rounded-xl border transition-all cursor-pointer flex justify-between items-center ${
                            isSelected 
                              ? 'border-amber-600 bg-amber-50/50 shadow-sm' 
                              : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/10'
                          }`}
                        >
                          <div className="flex-grow min-w-0 pr-2">
                            <p className="font-semibold text-gray-900 text-sm truncate">{req.lesson_plan_title}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Người gửi: {req.requester_name || 'Người dùng'}</p>
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 text-gray-600 border border-gray-200 rounded text-[10px] font-medium">
                                📁 {req.target_directory_name}
                              </span>
                              <span className="text-xs text-gray-400">
                                {new Date(req.created_at).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                          </div>
                          <span className="text-amber-600 font-bold text-lg flex-shrink-0">➔</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Request Detail & Action Panel */}
              <div className="flex flex-col h-full justify-between">
                {selectedApproval ? (
                  <div className="flex flex-col h-full">
                    <div className="bg-amber-50 border border-amber-100/50 rounded-xl p-4 mb-4">
                      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Chi tiết yêu cầu xét duyệt</p>
                      <h5 className="font-bold text-gray-950 text-base mt-1 leading-snug">{selectedApproval.lesson_plan_title}</h5>
                      <p className="text-xs text-gray-500 mt-1">
                        Gửi bởi: <strong className="text-gray-700">{selectedApproval.requester_name}</strong> trong thư mục <strong className="text-gray-700">{selectedApproval.target_directory_name}</strong>
                      </p>
                    </div>

                    <div className="flex-grow space-y-4 overflow-y-auto max-h-[300px] pr-2">
                      <div>
                        <h6 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Mô tả bài giảng:</h6>
                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100 whitespace-pre-line leading-relaxed">
                          {selectedApproval.lesson_plan_description || 'Không có mô tả.'}
                        </p>
                      </div>

                      {selectedApproval.lesson_plan_file_url && (
                        <div>
                          <h6 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tài liệu đính kèm:</h6>
                          <a 
                            href={selectedApproval.lesson_plan_file_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700 transition-colors shadow-sm w-full justify-center"
                          >
                            <span>📥</span> Tải xuống tệp đính kèm
                          </a>
                        </div>
                      )}

                      <div>
                        <h6 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Phản hồi / Góp ý (nếu từ chối):</h6>
                        <textarea
                          value={feedback}
                          onChange={e => setFeedback(e.target.value)}
                          placeholder="Nhập lý do từ chối hoặc góp ý chỉnh sửa bài giảng..."
                          className="w-full text-sm border border-gray-200 rounded-lg p-2.5 h-20 focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
                        />
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2 justify-end">
                      <button 
                        onClick={() => handleActionApproval(selectedApproval.id, 'REJECT', feedback)}
                        className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-xl text-sm font-medium transition-colors"
                      >
                        Từ chối
                      </button>
                      <button 
                        onClick={() => handleActionApproval(selectedApproval.id, 'APPROVE')}
                        className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold shadow-md shadow-green-100 transition-all"
                      >
                        Duyệt & Xuất bản
                      </button>
                    </div>
                  </div>
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

    </div>
  );
}