import React, { useState, useRef } from 'react';
import axios from 'axios';
import { 
  ArrowLeftOutlined, 
  InboxOutlined, 
  FolderOutlined, 
  BookOutlined, 
  InfoCircleOutlined,
  SaveOutlined,
  SendOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  GlobalOutlined,
  LockOutlined,
  CheckOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { Card, Select, Input, Button, Tag, Space, Upload, message, Progress, Divider, Alert } from 'antd';
import type { UploadProps } from 'antd';

const getFallbackApiBase = (defaultLocal: string = '') => {
  if (typeof window !== 'undefined' && 
      window.location.hostname !== 'localhost' && 
      window.location.hostname !== '127.0.0.1') {
    return 'https://he-thong-qltt-backend.onrender.com';
  }
  return defaultLocal;
};

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
  managedDirectoryIds?: number[];
  uploadMode?: 'personal' | 'public';
  onViewDuplicate?: (id: number) => void;
  initialDirId?: number | null;
}

export default function UploadPage({
  directories,
  currentUser,
  onBack,
  onSuccess,
  onRefreshDirs,
  managedDirectoryIds = [],
  uploadMode = 'public',
  onViewDuplicate,
  initialDirId = null
}: UploadPageProps) {
  const [selectedDirId, setSelectedDirId] = useState<number | null>(initialDirId);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const getAllDescendants = (rootId: number): number[] => {
    const children = directories.filter(d => d.parent === rootId);
    return [rootId, ...children.flatMap(c => getAllDescendants(c.id))];
  };

  const modeFilteredDirs: Directory[] = (() => {
    if (uploadMode === 'personal') {
      return directories.filter(d => !d.is_public && (currentUser ? d.user === currentUser.id : false));
    }
    return directories.filter(d => d.is_public);
  })();

  const allowedDirIds: Set<number> = (() => {
    if (uploadMode === 'personal') {
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

  // Tag inputs & Personal directory creation states
  const [tagInput, setTagInput] = useState('');
  const [newPersonalDirName, setNewPersonalDirName] = useState('');
  const [creatingDir, setCreatingDir] = useState(false);
  const [showInlineCreateDir, setShowInlineCreateDir] = useState(false);
  const [newPersonalDirParentId, setNewPersonalDirParentId] = useState<number | null>(null);

  // Upload Form states
  const [parsing, setParsing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
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

  const [selectedTrack, setSelectedTrack] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [selectedBiologyConnections, setSelectedBiologyConnections] = useState<string[]>([]);
  const [biologySearch, setBiologySearch] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [duration, setDuration] = useState<string>('');

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
      message.success('Tạo thư mục cá nhân thành công!');
      setNewPersonalDirName('');
      setNewPersonalDirParentId(null);
      setShowInlineCreateDir(false);
      await onRefreshDirs();
      if (response.data && response.data.id) {
        setSelectedDirId(response.data.id);
      }
    } catch (err) {
      message.error('Lỗi tạo thư mục cá nhân.');
    } finally {
      setCreatingDir(false);
    }
  };

  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    if (selectedFile.name.endsWith('.docx')) {
      setParsing(true);
      setUploadError(null);
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        const apiBase = localStorage.getItem('kms_api_base_url') || import.meta.env.VITE_API_BASE_URL || getFallbackApiBase('');
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
          const mappedTargets: string[] = [];
          data.target_students.forEach((t: string) => {
            if (t.toLowerCase().includes('thành thị') && !mappedTargets.includes('Học sinh thành thị')) {
              mappedTargets.push('Học sinh thành thị');
            }
            if (t.toLowerCase().includes('nông thôn') && !mappedTargets.includes('Học sinh nông thôn')) {
              mappedTargets.push('Học sinh nông thôn');
            }
          });
          if (mappedTargets.length > 0) {
            setSelectedTargets(mappedTargets);
          }
        }
        if (data.grade) {
          setSelectedLops([data.grade]);
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
        if (data.duration) setDuration(data.duration);
        if (data.attributes) {
          if (data.attributes['Thời gian thực hiện'] || data.attributes['Thời gian'] || data.attributes['Số tiết']) {
            setDuration(data.attributes['Thời gian thực hiện'] || data.attributes['Thời gian'] || data.attributes['Số tiết']);
          }
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
        message.success('Đã tự động trích xuất và điền thông tin từ file Word!');
      } catch (err) {
        console.error('Auto-extraction error:', err);
        message.warning('Không thể tự động đọc file Word, vui lòng điền các thông tin thủ công.');
      } finally {
        setParsing(false);
      }
    } else if (selectedFile.name.endsWith('.md') || selectedFile.name.endsWith('.markdown') || selectedFile.name.endsWith('.txt')) {
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

  const currentDir = directories.find(d => d.id === selectedDirId) || null;

  const allKnowledgeTags: { tag: string; path: string }[] = [];
  directories.forEach(dir => {
    const tags: string[] = dir.attributes?.knowledge_tags || [];
    const buildPath = (d: Directory): string => {
      const parent = directories.find(p => p.id === d.parent);
      return parent ? buildPath(parent) + ' / ' + d.name : d.name;
    };
    tags.forEach(tag => allKnowledgeTags.push({ tag, path: buildPath(dir) }));
  });

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
    const seen = new Set<string>();
    return result.filter(r => { if (seen.has(r.tag)) return false; seen.add(r.tag); return true; });
  };

  const availableTags = getTagsForDir(selectedDirId).filter(
    ({ tag }) => !knowledgeSearch || tag.toLowerCase().includes(knowledgeSearch.toLowerCase())
  );

  const canManageTags = currentUser && (
    currentUser.role === 'ADMIN' ||
    (currentUser.role === 'TEACHER' && currentDir && currentDir.user === currentUser.id)
  );

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
      message.success('Đã thêm kiến thức vào thư mục');
    } catch { message.error('Lỗi thêm kiến thức.'); }
  };

  const handleRemoveTag = async (dirId: number, tag: string) => {
    const dir = directories.find(d => d.id === dirId);
    if (!dir) return;
    const newTags = (dir.attributes?.knowledge_tags || []).filter((t: string) => t !== tag);
    try {
      await axios.patch(`/api/directories/${dirId}/`, {
        attributes: { ...dir.attributes, knowledge_tags: newTags }
      });
      onRefreshDirs();
      message.success('Đã xóa kiến thức khỏi thư mục');
    } catch { message.error('Lỗi xóa kiến thức.'); }
  };

  const toggleTarget = (val: string) => {
    setSelectedTargets(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const toggleLop = (val: string) => {
    setSelectedLops(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const handleSubmit = async () => {
    if (!file || !title.trim() || !currentUser) {
      setUploadError('Vui lòng điền tiêu đề và chọn file.');
      return;
    }
    
    if (uploadMode === 'personal') {
      if (modeFilteredDirs.length === 0) {
        setUploadError('Bạn chưa có thư mục cá nhân nào. Hãy tạo thư mục cá nhân mới trước khi lưu.');
        return;
      }
      if (!selectedDirId) {
        setUploadError('Vui lòng chọn thư mục cá nhân để lưu tài liệu.');
        return;
      }
    } else {
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
      
      let defaultStatus: string;
      if (uploadMode === 'personal') {
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
        'Thời gian thực hiện': duration,
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

      const apiBase = localStorage.getItem('kms_api_base_url') || import.meta.env.VITE_API_BASE_URL || getFallbackApiBase('');
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
      message.success('Đã tải lên bài giảng thành công!');
      onSuccess(data);
    } catch (err: any) {
      setUploadError('Lỗi khi tải lên bài giảng. Vui lòng thử lại.');
      message.error('Tải lên bài giảng thất bại.');
    } finally {
      setUploading(false);
    }
  };

  const tagsForCurrentDir: string[] = currentDir?.attributes?.knowledge_tags || [];

  const rootDirs = modeFilteredDirs
    .filter(d => !d.parent)
    .filter(d => uploadMode !== 'public' || currentUser?.role !== 'TEACHER' || allowedDirIds.has(d.id));

  // Recursive Tree Node Renderer using Ant Design styling
  const renderTreeNode = (dir: Directory, depth: number) => {
    const children = modeFilteredDirs
      .filter(d => d.parent === dir.id)
      .filter(d => uploadMode !== 'public' || currentUser?.role !== 'TEACHER' || allowedDirIds.has(d.id));
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(dir.id);
    const isSelected = selectedDirId === dir.id;
    const isAllowed = uploadMode === 'personal' ? true : (currentUser?.role !== 'TEACHER' || allowedDirIds.has(dir.id));
    const isManaged = managedDirectoryIds.includes(dir.id);

    return (
      <div key={dir.id} className="mt-1">
        <div
          onClick={() => isAllowed && selectDir(dir)}
          className={`flex items-center gap-2 py-2 px-3 rounded-lg transition-all cursor-pointer ${
            isSelected
              ? 'bg-blue-50 text-blue-600 font-semibold border-l-4 border-blue-600'
              : 'hover:bg-gray-100 text-gray-700'
          }`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {hasChildren && (
            <span
              onClick={(e) => toggleExpand(dir.id, e)}
              className="text-xs text-gray-400 hover:text-gray-600 w-4 h-4 flex items-center justify-center"
            >
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          {!hasChildren && <span className="w-4"></span>}
          <FolderOutlined className={isSelected ? 'text-blue-500' : 'text-gray-400'} />
          <span className="flex-grow truncate text-sm">{dir.name}</span>
          {isManaged && <Tag color="blue" className="text-[10px]">Quản lý</Tag>}
          {dir.is_public && <Tag color="green" className="text-[10px]">Công khai</Tag>}
        </div>
        {hasChildren && isExpanded && (
          <div className="ml-2">
            {children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const uploadProps: UploadProps = {
    accept: '.docx,.pdf,.ppt,.pptx',
    beforeUpload: (file) => {
      handleFileChange(file);
      return false; // Stop auto upload
    },
    showUploadList: false,
  };

  return (
    <div className="min-h-screen bg-slate-50 text-gray-800 font-sans pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />} 
            onClick={onBack}
            className="hover:text-blue-600"
          >
            Trang chủ
          </Button>
          <Divider type="vertical" className="bg-gray-200 h-6" />
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <BookOutlined className="text-blue-600" />
            {uploadMode === 'personal' ? 'Lưu vào Thư viện Cá nhân' : 'Đăng bài giảng mới'}
          </h1>
          {uploadMode === 'personal' && (
            <Tag color="cyan" className="font-bold">Cá nhân</Tag>
          )}
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* Left Side: Directory Tree */}
        <div className="flex flex-col gap-5">
          <Card 
            title={<span className="text-sm font-bold text-gray-700">CHỌN THƯ MỤC LƯU TRỮ</span>}
            size="small"
            className="shadow-sm rounded-xl"
          >
            <div className="mb-4">
              {selectedDirId && currentDir ? (
                <Alert
                  message={<span className="font-semibold text-blue-700">{currentDir.name}</span>}
                  type="info"
                  showIcon
                  icon={<FolderOutlined />}
                  action={
                    <Button size="small" type="text" danger onClick={() => setSelectedDirId(null)}>
                      Bỏ chọn
                    </Button>
                  }
                />
              ) : (
                <Alert message="Chưa chọn thư mục" type="warning" showIcon />
              )}
            </div>

            <div className="border border-gray-100 rounded-lg p-2 max-h-[360px] overflow-y-auto bg-gray-50/50">
              {rootDirs.length === 0 ? (
                <div className="py-6 text-center text-gray-400 italic text-sm">
                  Không có thư mục nào phù hợp.
                </div>
              ) : (
                rootDirs.map(dir => renderTreeNode(dir, 0))
              )}
            </div>

            {uploadMode === 'personal' && (
              <div className="mt-3">
                <Button
                  type="dashed"
                  block
                  icon={<PlusOutlined />}
                  onClick={() => setShowInlineCreateDir(!showInlineCreateDir)}
                >
                  {showInlineCreateDir ? 'Hủy tạo' : 'Thêm thư mục cá nhân gốc'}
                </Button>

                {showInlineCreateDir && (
                  <Card className="mt-3 bg-gray-50 border-gray-250 p-1" size="small">
                    <Space direction="vertical" className="w-full" size="middle">
                      <Input
                        placeholder="Tên thư mục cá nhân..."
                        value={newPersonalDirName}
                        onChange={e => setNewPersonalDirName(e.target.value)}
                        className="rounded-lg"
                      />
                      <div>
                        <span className="text-[11px] text-gray-450 block mb-1">Thư mục cha:</span>
                        <Select
                          className="w-full"
                          value={newPersonalDirParentId || ''}
                          onChange={val => setNewPersonalDirParentId(val ? Number(val) : null)}
                          options={[
                            { value: '', label: '-- Thư mục gốc --' },
                            ...getDirectoriesAsTreeOptions(selectableDirs).map(d => ({
                              value: d.id,
                              label: `${d.visualPrefix}${d.name}`
                            }))
                          ]}
                        />
                      </div>
                      <Button
                        type="primary"
                        block
                        onClick={handleCreatePersonalDirInline}
                        loading={creatingDir}
                        disabled={!newPersonalDirName.trim()}
                      >
                        Tạo & Chọn
                      </Button>
                    </Space>
                  </Card>
                )}
              </div>
            )}
          </Card>

          {/* Directory Knowledge Management */}
          {currentDir && (
            <Card
              title={<span className="text-sm font-bold text-gray-700">KIẾN THỨC THƯ MỤC</span>}
              size="small"
              className="shadow-sm rounded-xl"
            >
              {canManageTags && (
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="Thêm kiến thức mới..."
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onPressEnter={handleAddTag}
                  />
                  <Button type="primary" onClick={handleAddTag}>Thêm</Button>
                </div>
              )}

              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                {tagsForCurrentDir.length === 0 ? (
                  <span className="text-xs text-gray-400 italic">Chưa có kiến thức nào.</span>
                ) : (
                  tagsForCurrentDir.map(tag => (
                    <div key={tag} className="flex items-center justify-between border border-gray-150 rounded-lg p-2 bg-white">
                      <span className="text-xs font-semibold text-gray-800">{tag}</span>
                      <Space>
                        <Tag color="blue" className="m-0 text-[10px]">{currentDir.name}</Tag>
                        {canManageTags && (
                          <Button 
                            type="text" 
                            danger 
                            size="small" 
                            icon={<span className="font-bold">✕</span>} 
                            onClick={() => handleRemoveTag(currentDir.id, tag)} 
                          />
                        )}
                      </Space>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Right Side: Upload Form */}
        <div className="flex flex-col gap-5">
          {/* File Upload Zone */}
          <Card className="shadow-sm rounded-xl p-0 overflow-hidden border-none">
            <Upload.Dragger {...uploadProps} className="antd-custom-dragger">
              {parsing ? (
                <div className="py-6 flex flex-col items-center justify-center">
                  <ReloadOutlined spin className="text-3xl text-blue-600 mb-3" />
                  <p className="font-bold text-blue-600 text-sm">⚡ Đang tự động trích xuất thông tin giáo án...</p>
                  <p className="text-xs text-gray-400 mt-1">AI đang phân tích các thành phần trong tài liệu...</p>
                </div>
              ) : file ? (
                <div className="py-4">
                  <span className="text-4xl block mb-2">📄</span>
                  <p className="font-bold text-gray-800 text-base">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  <Button type="link" danger onClick={(e) => { e.stopPropagation(); setFile(null); }} className="mt-2">
                    Xóa file
                  </Button>
                </div>
              ) : (
                <div className="py-6">
                  <InboxOutlined className="text-4xl text-gray-300 mb-3" />
                  <p className="ant-upload-text font-semibold text-gray-600">Kéo thả file vào đây hoặc nhấp chuột để chọn</p>
                  <p className="ant-upload-hint text-xs text-gray-400 mt-1">Hỗ trợ file Word (.docx), PDF, PowerPoint (.ppt, .pptx)</p>
                </div>
              )}
            </Upload.Dragger>
          </Card>

          {/* Form Details */}
          <Card className="shadow-sm rounded-xl" title={<span className="font-bold text-gray-800">Thông tin bài giảng</span>}>
            <div className="space-y-5">
              {/* Select Directory */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Thư mục đích <span className="text-red-500">*</span>
                </label>
                <Select
                  showSearch
                  placeholder="-- Chọn thư mục lưu trữ --"
                  className="w-full"
                  size="large"
                  value={selectedDirId || undefined}
                  onChange={val => setSelectedDirId(val ? Number(val) : null)}
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={getDirectoriesAsTreeOptions(selectableDirs).map(d => ({
                    value: d.id,
                    label: `${d.visualPrefix}${d.name} ${d.is_public ? '👥' : '🔒'}`
                  }))}
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Tiêu đề bài giảng <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="Nhập tiêu đề..."
                  size="large"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="rounded-lg"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mô tả / Tóm tắt</label>
                <Input.TextArea
                  placeholder="Mô tả nội dung bài giảng..."
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="rounded-lg resize-none"
                />
              </div>

              {/* Duration / Số tiết */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Thời gian thực hiện (Số tiết)</label>
                <Input
                  placeholder="Ví dụ: 02 tiết (90 phút) hoặc 2 tiết..."
                  size="large"
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                  className="rounded-lg"
                />
              </div>

              {/* Targets, Classes & Types */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Đối tượng học sinh</label>
                  <Space wrap>
                    {['Học sinh thành thị', 'Học sinh nông thôn'].map(target => {
                      const isSelected = selectedTargets.includes(target);
                      return (
                        <Button
                          key={target}
                          type={isSelected ? 'primary' : 'default'}
                          onClick={() => toggleTarget(target)}
                          className="rounded-full"
                          size="small"
                        >
                          {target}
                        </Button>
                      );
                    })}
                  </Space>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Lớp áp dụng</label>
                  <Space wrap>
                    {['Lớp 10', 'Lớp 11', 'Lớp 12'].map(lop => {
                      const isSelected = selectedLops.includes(lop);
                      return (
                        <Button
                          key={lop}
                          type={isSelected ? 'primary' : 'default'}
                          onClick={() => toggleLop(lop)}
                          className="rounded-full"
                          size="small"
                        >
                          {lop}
                        </Button>
                      );
                    })}
                  </Space>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Loại hình tiết dạy</label>
                  <Space wrap>
                    {['Lý thuyết', 'Thực hành'].map(type => {
                      const isSelected = selectedType === type;
                      return (
                        <Button
                          key={type}
                          type={isSelected ? 'primary' : 'default'}
                          onClick={() => setSelectedType(isSelected ? '' : type)}
                          className="rounded-full"
                          size="small"
                        >
                          {type}
                        </Button>
                      );
                    })}
                  </Space>
                </div>
              </div>

              <Divider />

              {/* Taxonomy select boxes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mạch kiến thức</label>
                  <Select
                    className="w-full"
                    placeholder="Chọn Mạch kiến thức"
                    value={selectedTrack || undefined}
                    onChange={val => {
                      setSelectedTrack(val);
                      setSelectedTopic('');
                    }}
                    options={KNOWLEDGE_TRACKS.map(t => ({ value: t, label: t }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Chủ đề</label>
                  <Select
                    className="w-full"
                    placeholder="Chọn chủ đề"
                    disabled={!selectedTrack}
                    value={selectedTopic || undefined}
                    onChange={val => setSelectedTopic(val)}
                    options={selectedTrack ? TRACK_TO_TOPICS[selectedTrack]?.map(t => ({ value: t, label: t })) : []}
                  />
                </div>
              </div>

              {/* Biology Connections */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <span>🧬</span> Kiến thức sinh học liên quan <span className="text-red-500">*</span>
                </label>

                {currentDir && tagsForCurrentDir.length > 0 && (
                  <div className="mb-3 bg-blue-50/40 p-3 rounded-lg border border-blue-100">
                    <p className="text-xs font-bold text-blue-700 mb-2">💡 Gợi ý Kiến thức từ thư mục [{currentDir.name}]:</p>
                    <Space size={[4, 8]} wrap>
                      {tagsForCurrentDir.map(tag => {
                        const isSelected = selectedBiologyConnections.includes(tag);
                        return (
                          <Tag.CheckableTag
                            key={tag}
                            checked={isSelected}
                            onChange={(checked) => {
                              setSelectedBiologyConnections(prev =>
                                checked ? [...prev, tag] : prev.filter(t => t !== tag)
                              );
                            }}
                          >
                            {tag}
                          </Tag.CheckableTag>
                        );
                      })}
                    </Space>
                  </div>
                )}

                <div className="mb-3">
                  <Input
                    prefix="🔍"
                    placeholder="Tìm mạch kiến thức sinh học liên quan..."
                    value={biologySearch}
                    onChange={e => setBiologySearch(e.target.value)}
                  />
                </div>

                {biologySearch.trim() && !BIOLOGY_CONNECTIONS.some(bio => bio.toLowerCase() === biologySearch.trim().toLowerCase()) && (
                  <button
                    type="button"
                    onClick={() => {
                      const newTag = biologySearch.trim();
                      if (!selectedBiologyConnections.includes(newTag)) {
                        setSelectedBiologyConnections(prev => [...prev, newTag]);
                      }
                      setBiologySearch('');
                    }}
                    className="w-full mb-3 flex items-center justify-center gap-2 p-2 bg-emerald-50 text-emerald-700 border border-dashed border-emerald-300 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors"
                  >
                    <span>➕ Thêm "{biologySearch.trim()}" làm kiến thức sinh học liên quan</span>
                  </button>
                )}

                <div className="border border-gray-250 rounded-lg p-2 max-h-[160px] overflow-y-auto bg-white flex flex-col gap-1.5">
                  {BIOLOGY_CONNECTIONS.filter(b => b.toLowerCase().includes(biologySearch.toLowerCase())).map(bio => {
                    const isSelected = selectedBiologyConnections.includes(bio);
                    return (
                      <div
                        key={bio}
                        onClick={() => setSelectedBiologyConnections(prev =>
                          prev.includes(bio) ? prev.filter(b => b !== bio) : [...prev, bio]
                        )}
                        className={`text-xs p-2 rounded cursor-pointer transition-colors flex items-center gap-2 ${
                          isSelected ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        <CheckOutlined className={isSelected ? 'opacity-100' : 'opacity-0'} />
                        <span>{bio}</span>
                      </div>
                    );
                  })}
                </div>

                {selectedBiologyConnections.length > 0 && (
                  <div className="mt-3">
                    <Space wrap>
                      {selectedBiologyConnections.map(bio => (
                        <Tag 
                          color="success" 
                          closable 
                          onClose={() => setSelectedBiologyConnections(prev => prev.filter(t => t !== bio))} 
                          key={bio}
                        >
                          {bio}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                )}
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Địa điểm / Phòng thiết bị</label>
                <Select
                  className="w-full"
                  placeholder="Chọn địa điểm..."
                  value={selectedLocation || undefined}
                  onChange={val => setSelectedLocation(val)}
                  options={LOCATIONS.map(l => ({ value: l, label: l }))}
                />
              </div>

              {/* Error messages */}
              {uploadError && (
                <Alert
                  message={uploadError}
                  type="error"
                  showIcon
                  action={
                    duplicateId && onViewDuplicate && (
                      <Space>
                        <Button size="small" type="primary" onClick={() => onViewDuplicate(duplicateId)}>
                          Xem tài liệu đã có
                        </Button>
                      </Space>
                    )
                  }
                />
              )}

              {/* Info advice */}
              {uploadMode === 'personal' ? (
                <Alert message="Tài liệu sẽ được lưu dưới dạng riêng tư trong thư viện của bạn." type="info" showIcon />
              ) : (
                currentUser?.role === 'USER' && (
                  <Alert message="Bài giảng sẽ được lưu ở trạng thái chờ duyệt của giáo viên hoặc quản trị viên." type="warning" showIcon />
                )
              )}

              {/* Submit Buttons */}
              <Button
                type="primary"
                size="large"
                block
                icon={uploadMode === 'personal' ? <SaveOutlined /> : <SendOutlined />}
                loading={uploading}
                onClick={handleSubmit}
                disabled={!file || !title.trim()}
                className={`h-12 text-base font-semibold ${
                  uploadMode === 'personal' ? 'bg-sky-600 hover:bg-sky-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {uploading ? 'Đang tải lên...' : uploadMode === 'personal' ? 'Lưu vào thư viện cá nhân' : 'Đăng tải bài giảng'}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
