import React, { useState, useRef } from 'react';
import axios from 'axios';

interface Directory {
  id: number;
  name: string;
  is_public: boolean;
  attributes: any;
  parent: number | null;
}

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
  onSuccess: () => void;
  onRefreshDirs: () => void;
  managedDirectoryIds?: number[]; // IDs explicitly granted to current teacher
}

export default function UploadPage({ directories, currentUser, onBack, onSuccess, onRefreshDirs, managedDirectoryIds = [] }: UploadPageProps) {
  // Navigation state - which directory is selected in left panel
  const [selectedDirId, setSelectedDirId] = useState<number | null>(null);
  const [dirPath, setDirPath] = useState<{ id: number; name: string }[]>([]);

  // ── Compute which directories the Teacher is allowed to see ──
  // For Admin: all dirs. For Teacher: granted dirs + all descendants. For User: all (upload restricted separately).
  const getAllDescendants = (rootId: number): number[] => {
    const children = directories.filter(d => d.parent === rootId);
    return [rootId, ...children.flatMap(c => getAllDescendants(c.id))];
  };

  const allowedDirIds: Set<number> = (() => {
    if (!currentUser || currentUser.role !== 'TEACHER') return new Set(directories.map(d => d.id));
    const ids = new Set<number>();
    managedDirectoryIds.forEach(id => getAllDescendants(id).forEach(did => ids.add(did)));
    return ids;
  })();

  // Knowledge tag management
  const [tagInput, setTagInput] = useState('');

  // Upload form state (right side)
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState('');
  const [selectedKnowledge, setSelectedKnowledge] = useState<string[]>([]);
  const [knowledgeSearch, setKnowledgeSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine the currently viewed directory
  const currentDir = directories.find(d => d.id === selectedDirId) || null;
  // For Teacher: only show subdirectories that are in their allowedDirIds
  const childDirs = directories
    .filter(d => d.parent === selectedDirId)
    .filter(d => currentUser?.role !== 'TEACHER' || allowedDirIds.has(d.id));

  // Root dirs (for when selectedDirId is null)
  const rootDirs = directories
    .filter(d => !d.parent)
    .filter(d => currentUser?.role !== 'TEACHER' || allowedDirIds.has(d.id));

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

  // Navigate into a subdirectory
  const navigateInto = (dir: Directory) => {
    // Only navigate into allowed dirs
    if (currentUser?.role === 'TEACHER' && !allowedDirIds.has(dir.id)) return;
    setSelectedDirId(dir.id);
    setDirPath(prev => [...prev, { id: dir.id, name: dir.name }]);
  };

  // Navigate to breadcrumb
  const navigateTo = (idx: number) => {
    if (idx < 0) {
      setSelectedDirId(null);
      setDirPath([]);
    } else {
      const target = dirPath[idx];
      setSelectedDirId(target.id);
      setDirPath(prev => prev.slice(0, idx + 1));
    }
  };

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
    if (dropped) setFile(dropped);
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
    
    // Only regular users must select a directory (their upload goes to PENDING)
    if (currentUser.role === 'USER' && !selectedDirId) {
      setUploadError('Bạn phải chọn một thư mục trước khi tải bài giảng lên để gửi duyệt.');
      return;
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
      // - ADMIN → always PUBLISHED
      // - TEACHER + manages target dir (or no dir selected → LOCAL personal) → PUBLISHED
      // - TEACHER + no managed dirs or uploading to unmanaged dir → PENDING
      // - USER → always PENDING (needs approval)
      let defaultStatus: string;
      if (currentUser.role === 'ADMIN') {
        defaultStatus = selectedDirId ? 'PUBLISHED' : 'LOCAL';
      } else if (currentUser.role === 'TEACHER') {
        if (!selectedDirId) {
          // No directory chosen: save as personal LOCAL
          defaultStatus = 'LOCAL';
        } else if (allowedDirIds.has(selectedDirId)) {
          // Teacher manages this directory → publish directly
          defaultStatus = 'PUBLISHED';
        } else {
          // Teacher doesn't manage target dir → needs approval
          defaultStatus = 'PENDING';
        }
      } else {
        // Regular USER → always needs approval
        defaultStatus = 'PENDING';
      }
      formData.append('status', defaultStatus);
      
      formData.append('attributes', JSON.stringify({
        'Loại hình': selectedType,
        'Môn học': selectedKnowledge.join(', '),
        knowledge_tags: selectedKnowledge
      }));
      if (selectedDirId) formData.append('directory_id', selectedDirId.toString());
      formData.append('file', file);

      const res = await fetch('/api/lesson-plans/upload/', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      onSuccess();
    } catch {
      setUploadError('Lỗi khi tải lên. Vui lòng thử lại.');
    } finally {
      setUploading(false);
    }
  };

  const tagsForCurrentDir: string[] = currentDir?.attributes?.knowledge_tags || [];

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center gap-4">
        <button onClick={onBack} className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1">
          ← Trang chủ
        </button>
        <span className="text-gray-300">|</span>
        <h1 className="text-lg font-bold text-gray-900">Đăng bài giảng mới</h1>
      </div>

      <div className="max-w-[1400px] mx-auto p-6 grid grid-cols-[380px_1fr] gap-6">
        {/* Left Panel */}
        <div className="flex flex-col gap-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm text-gray-500 flex-wrap">
            <button onClick={() => navigateTo(-1)} className="text-blue-600 hover:underline font-medium">Tất cả thư mục</button>
            {dirPath.map((p, i) => (
              <React.Fragment key={p.id}>
                <span className="text-gray-300">/</span>
                <button onClick={() => navigateTo(i)} className="text-blue-600 hover:underline">{p.name}</button>
              </React.Fragment>
            ))}
          </div>

          {/* Current Directory Header */}
          {currentDir && (
            <div className="flex items-center gap-2">
              <span className="text-2xl">📁</span>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{currentDir.name}</h2>
                {currentDir.is_public && <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">Công khai</span>}
              </div>
            </div>
          )}

          {/* Subdirectories */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {currentDir ? 'Thư mục con' : 'Tất cả thư mục'}
              </p>
              {currentUser?.role === 'TEACHER' && !selectedDirId && managedDirectoryIds.length > 0 && (
                <p className="text-[10px] text-blue-500 mt-0.5">🔒 Chỉ hiển thị {allowedDirIds.size} thư mục bạn có quyền</p>
              )}
            </div>
            {(selectedDirId ? childDirs : rootDirs).length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-400 italic">
                {currentUser?.role === 'TEACHER' ? 'Không có thư mục nào bạn được cấp quyền.' : 'Không có thư mục con.'}
              </p>
            ) : (
              (selectedDirId ? childDirs : rootDirs).map(dir => (
                <button
                  key={dir.id}
                  onClick={() => navigateInto(dir)}
                  className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-blue-50/50 transition-colors text-left ${selectedDirId === dir.id ? 'bg-blue-50' : ''}`}
                >
                  <span className="text-lg">{dir.is_public ? '📂' : '📁'}</span>
                  <span className="text-sm font-medium text-gray-800 flex-grow">{dir.name}</span>
                  <span className="text-gray-400 text-xs">→</span>
                </button>
              ))
            )}
          </div>

          {/* Knowledge Tags Panel */}
          {currentDir && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-1">Kiến thức thư mục</h3>
              <p className="text-xs text-gray-500 mb-3">Thêm, sửa, xóa kiến thức cho thư mục này</p>

              {canManageTags && (
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                    placeholder="Nhập hoặc tìm kiếm kiến thức..."
                    className="flex-grow text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                  >Thêm</button>
                </div>
              )}

              <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto">
                {tagsForCurrentDir.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Chưa có kiến thức nào.</p>
                ) : (
                  tagsForCurrentDir.map(tag => (
                    <div key={tag} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2 hover:bg-gray-50">
                      <span className="text-sm font-medium text-gray-800">{tag}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">{dirPath.length > 0 ? dirPath.map(p=>p.name).join(' / ') : currentDir.name}</span>
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
            className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'}`}
          >
            <input ref={fileInputRef} type="file" accept=".docx,.pdf,.ppt,.pptx" className="hidden" onChange={e => e.target.files && setFile(e.target.files[0])} />
            {file ? (
              <>
                <div className="text-4xl mb-2">📄</div>
                <p className="font-semibold text-gray-800">{file.name}</p>
                <p className="text-sm text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                <button onClick={e => { e.stopPropagation(); setFile(null); }} className="mt-3 text-xs text-red-500 hover:text-red-700">Xóa file</button>
              </>
            ) : (
              <>
                <div className="text-5xl mb-3 text-gray-300">☁️</div>
                <p className="font-medium text-gray-600">Kéo thả file vào đây</p>
                <p className="text-sm text-gray-400 mb-3">hoặc click để chọn file</p>
                <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full border border-gray-200">.docx &nbsp; .pdf &nbsp; .ppt</span>
              </>
            )}
          </div>

          {/* Title */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Tiêu đề bài giảng <span className="text-red-500">*</span></label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Nhập tiêu đề bài giảng..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          {/* Description */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Mô tả / Tóm tắt</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Mô tả ngắn về nội dung bài giảng..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
          </div>

          {/* Target Student */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-3">Đối tượng giảng dạy <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              {['Học sinh thành thị', 'Học sinh nông thôn'].map(val => (
                <button
                  key={val}
                  onClick={() => toggleTarget(val)}
                  className={`py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors ${selectedTargets.includes(val) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50'}`}
                >{val}</button>
              ))}
            </div>
          </div>

          {/* Lesson Type */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-3">Loại hình tiết dạy <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              {['Thực hành', 'Lý thuyết', 'Ôn tập', 'Kiểm tra'].map(val => (
                <button
                  key={val}
                  onClick={() => setSelectedType(val === selectedType ? '' : val)}
                  className={`py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors ${selectedType === val ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50'}`}
                >{val}</button>
              ))}
            </div>
          </div>

          {/* Knowledge Multi-select */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
              <span className="text-yellow-500">⚡</span> Kiến thức môn học <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-400 mb-3">Chọn các kiến thức liên quan đến bài giảng</p>
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input
                type="text"
                value={knowledgeSearch}
                onChange={e => setKnowledgeSearch(e.target.value)}
                placeholder="Tìm kiếm kiến thức từ tất cả thư mục..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            {availableTags.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                <p>Chưa có kiến thức nào.</p>
                <p className="text-xs mt-1">Chọn thư mục bên trái và thêm kiến thức trước.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                {availableTags.map(({ tag, path }) => (
                  <button
                    key={tag}
                    onClick={() => toggleKnowledge(tag)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-sm transition-colors ${selectedKnowledge.includes(tag) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-100 hover:border-blue-200 hover:bg-blue-50'}`}
                  >
                    <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center text-xs ${selectedKnowledge.includes(tag) ? 'bg-white border-white text-blue-600' : 'border-gray-300'}`}>
                      {selectedKnowledge.includes(tag) && '✓'}
                    </span>
                    <span className="truncate font-medium">{tag}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedKnowledge.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selectedKnowledge.map(t => (
                  <span key={t} className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                    {t}
                    <button onClick={() => toggleKnowledge(t)} className="text-blue-400 hover:text-blue-700">✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          {uploadError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{uploadError}</div>}

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
            <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 text-sm text-sky-700">
              💾 Không chọn thư mục → bài giảng sẽ được lưu vào <strong>Thư viện cá nhân</strong> của bạn (LOCAL).
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={uploading || !file || !title.trim()}
            className={`w-full py-4 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2 ${
              uploading || !file || !title.trim()
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 hover:shadow-blue-300'
            }`}
          >
            {uploading ? (
              <><span className="animate-spin">⟳</span> Đang tải lên...</>
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
