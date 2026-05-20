import { useState, useRef } from 'react';
import { Folder as FolderIcon, FileText, Share2, Search, Plus, MoreVertical, XCircle, Send, CheckCircle, Upload, Edit2, Trash2, Eye } from 'lucide-react';
import { useAppContext, studentTypes, lessonTypes } from '../context';

interface PrivateFile {
  id: string;
  name: string;
  size: string;
  date: string;
  status: 'private' | 'pending_approval' | 'published';
}

interface PrivateFolder {
  id: string;
  name: string;
  files: PrivateFile[];
  children: PrivateFolder[];
}

const mockPrivateFolders: PrivateFolder[] = [
  {
    id: 'pf1',
    name: 'Tài liệu nháp của tôi',
    files: [
      { id: 'f1', name: 'Giáo án sinh học kỳ 2 (Bản nháp).docx', size: '2.4 MB', date: '2024-03-22', status: 'private' },
      { id: 'f2', name: 'Đề kiểm tra 15 phút.pdf', size: '1.1 MB', date: '2024-03-21', status: 'private' },
    ],
    children: [
      {
        id: 'pf1_1',
        name: 'Tuần 1',
        files: [],
        children: []
      }
    ]
  },
  {
    id: 'pf2',
    name: 'Sưu tầm cá nhân',
    files: [
      { id: 'f3', name: 'Hình ảnh cấu trúc ADN.png', size: '4.5 MB', date: '2024-03-18', status: 'published' },
      { id: 'f4', name: 'Video minh họa quang hợp.mp4', size: '15.2 MB', date: '2024-03-10', status: 'pending_approval' },
    ],
    children: []
  }
];

export default function WorkspacePage() {
  const { folders } = useAppContext();
  const [privateFolders, setPrivateFolders] = useState<PrivateFolder[]>(mockPrivateFolders);
  const [activeFolderId, setActiveFolderId] = useState<string>('pf1');
  const [searchQuery, setSearchQuery] = useState('');

  // Share Modal State
  const [sharingFile, setSharingFile] = useState<PrivateFile | null>(null);
  const [shareTargetFolder, setShareTargetFolder] = useState('');
  const [shareStudentType, setShareStudentType] = useState('');
  const [shareLessonType, setShareLessonType] = useState('');
  const [shareSummary, setShareSummary] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const findFolderById = (id: string, folders: PrivateFolder[] = privateFolders): PrivateFolder | null => {
    for (const folder of folders) {
      if (folder.id === id) return folder;
      const found = findFolderById(id, folder.children);
      if (found) return found;
    }
    return null;
  };

  const activeFolder = findFolderById(activeFolderId);
  const filteredFiles = activeFolder?.files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())) || [];

  const handleCreateFolder = (parentId?: string) => {
    const name = prompt('Nhập tên thư mục mới:');
    if (!name) return;
    
    const newFolder: PrivateFolder = {
      id: `pf${Date.now()}`,
      name,
      files: [],
      children: []
    };

    if (!parentId) {
      setPrivateFolders([...privateFolders, newFolder]);
      setActiveFolderId(newFolder.id);
      return;
    }

    const updateFolders = (folders: PrivateFolder[]): PrivateFolder[] => {
      return folders.map(folder => {
        if (folder.id === parentId) {
          return { ...folder, children: [...folder.children, newFolder] };
        }
        return { ...folder, children: updateFolders(folder.children) };
      });
    };
    setPrivateFolders(updateFolders(privateFolders));
    setActiveFolderId(newFolder.id);
  };

  const handleEditFolder = (folderId: string) => {
    const folder = findFolderById(folderId);
    if (!folder) return;
    const name = prompt('Đổi tên thư mục:', folder.name);
    if (name) {
      const updateFolders = (folders: PrivateFolder[]): PrivateFolder[] => {
        return folders.map(f => {
          if (f.id === folderId) return { ...f, name };
          return { ...f, children: updateFolders(f.children) };
        });
      };
      setPrivateFolders(updateFolders(privateFolders));
    }
  };

  const handleDeleteFolder = (folderId: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa thư mục này và toàn bộ nội dung bên trong?')) {
      const updateFolders = (folders: PrivateFolder[]): PrivateFolder[] => {
        return folders.filter(f => f.id !== folderId).map(f => ({
          ...f,
          children: updateFolders(f.children)
        }));
      };
      setPrivateFolders(updateFolders(privateFolders));
      if (activeFolderId === folderId) {
        setActiveFolderId(privateFolders[0]?.id || '');
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeFolder) {
      const newFile: PrivateFile = {
        id: `f${Date.now()}`,
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        date: new Date().toISOString().split('T')[0],
        status: 'private'
      };
      const updateFolders = (folders: PrivateFolder[]): PrivateFolder[] => {
        return folders.map(f => {
          if (f.id === activeFolderId) return { ...f, files: [...f.files, newFile] };
          return { ...f, children: updateFolders(f.children) };
        });
      };
      setPrivateFolders(updateFolders(privateFolders));
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = (fileId: string) => {
    if (window.confirm('Xóa tài liệu này khỏi không gian làm việc?')) {
      const updateFolders = (folders: PrivateFolder[]): PrivateFolder[] => {
        return folders.map(f => ({
          ...f,
          files: f.files.filter(file => file.id !== fileId),
          children: updateFolders(f.children)
        }));
      };
      setPrivateFolders(updateFolders(privateFolders));
    }
  };

  const handleViewFile = (file: PrivateFile) => {
    alert(`Đang mở trình xem tài liệu: ${file.name}`);
  };

  const handleShareSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareTargetFolder || !shareStudentType || !shareLessonType) {
      alert('Vui lòng chọn đầy đủ thư mục đích, đối tượng và loại hình!');
      return;
    }
    
    // Update local status to pending
    if (sharingFile) {
      const updatedFolders = privateFolders.map(folder => ({
        ...folder,
        files: folder.files.map(file => 
          file.id === sharingFile.id ? { ...file, status: 'pending_approval' as const } : file
        )
      }));
      setPrivateFolders(updatedFolders);
    }

    alert('Đã gửi yêu cầu đăng tải lên cộng đồng! Vui lòng chờ quản trị viên phê duyệt.');
    setSharingFile(null);
  };

  const renderPublicFolderOptions = (folderList: any[], depth = 0) => {
    let options: React.ReactNode[] = [];
    for (const folder of folderList) {
      options.push(
        <option key={folder.id} value={folder.id}>
          {' '.repeat(depth * 4)}{folder.children.length > 0 ? '📂' : '📄'} {folder.name}
        </option>
      );
      if (folder.children.length > 0) {
        options = [...options, ...renderPublicFolderOptions(folder.children, depth + 1)];
      }
    }
    return options;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Sidebar - Private Folders */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-[calc(100vh-64px)] sticky top-16">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Không gian của tôi</h2>
          <button onClick={handleCreateFolder} className="p-1 hover:bg-gray-100 rounded text-gray-500 transition-colors" title="Thêm thư mục mới">
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <div className="p-2 flex-1 overflow-y-auto space-y-1">
          {(() => {
            const renderTree = (folders: PrivateFolder[], depth = 0): React.ReactNode => {
              return folders.map(folder => (
                <div key={folder.id}>
                  <div className="group flex items-center relative" style={{ paddingLeft: `${depth * 12}px` }}>
                    <button
                      onClick={() => setActiveFolderId(folder.id)}
                      className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeFolderId === folder.id 
                          ? 'bg-blue-50 text-blue-700' 
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <FolderIcon className={`w-4 h-4 shrink-0 ${activeFolderId === folder.id ? 'fill-blue-100 text-blue-600' : 'text-gray-400'}`} />
                      <span className="flex-1 text-left truncate">{folder.name}</span>
                      <span className="text-xs text-gray-400 font-normal ml-1">{folder.files.length}</span>
                    </button>
                    
                    {/* Folder Actions (Hover) */}
                    <div className="absolute right-2 opacity-0 group-hover:opacity-100 flex items-center bg-white shadow-sm border border-gray-100 rounded-md">
                      <button onClick={() => handleCreateFolder(folder.id)} className="p-1.5 text-gray-400 hover:text-emerald-600 transition-colors" title="Thêm thư mục con">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleEditFolder(folder.id)} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors" title="Đổi tên">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteFolder(folder.id)} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors" title="Xóa">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {folder.children.length > 0 && (
                    <div className="mt-1 space-y-1 border-l-2 border-gray-100 ml-4">
                      {renderTree(folder.children, depth + 1)}
                    </div>
                  )}
                </div>
              ));
            };
            return renderTree(privateFolders);
          })()}
        </div>
      </aside>

      {/* Main Content - Workspace */}
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-gray-900">{activeFolder?.name || 'Vui lòng chọn thư mục'}</h1>
            
            <div className="flex items-center gap-4">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm trong không gian này..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>

              {/* Tải lên nút ẩn */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload}
                className="hidden" 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={!activeFolder}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                Tải lên
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-sm text-gray-600 font-medium">
                <tr>
                  <th className="px-6 py-4">Tên tài liệu</th>
                  <th className="px-6 py-4">Ngày tạo</th>
                  <th className="px-6 py-4">Kích thước</th>
                  <th className="px-6 py-4">Trạng thái</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredFiles.map(file => (
                  <tr key={file.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                        <button onClick={() => handleViewFile(file)} className="font-medium text-gray-900 hover:text-blue-600 transition-colors text-left line-clamp-1">
                          {file.name}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{file.date}</td>
                    <td className="px-6 py-4 text-gray-500">{file.size}</td>
                    <td className="px-6 py-4">
                      {file.status === 'private' && (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">Riêng tư</span>
                      )}
                      {file.status === 'pending_approval' && (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700">Đang chờ duyệt</span>
                      )}
                      {file.status === 'published' && (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">Đã đăng cộng đồng</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {file.status === 'private' && (
                          <button 
                            onClick={() => setSharingFile(file)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md transition-colors font-medium text-xs"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            Đăng lên cộng đồng
                          </button>
                        )}
                        <button 
                          onClick={() => handleViewFile(file)}
                          className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded transition-colors" 
                          title="Xem"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteFile(file.id)}
                          className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded transition-colors" 
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredFiles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      Không có tài liệu nào trong thư mục này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Share to Community Modal */}
      {sharingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">Đăng tài liệu lên cộng đồng</h2>
              <button 
                onClick={() => setSharingFile(null)}
                className="p-1 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleShareSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tài liệu</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  {sharingFile.name}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chọn thư mục đích <span className="text-red-500">*</span></label>
                <select 
                  required
                  value={shareTargetFolder}
                  onChange={e => setShareTargetFolder(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chọn thư mục trên hệ thống --</option>
                  {renderPublicFolderOptions(folders)}
                </select>
                <p className="text-xs text-gray-500 mt-1">Quản trị viên của thư mục này sẽ xét duyệt tài liệu của bạn.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Đối tượng giảng dạy <span className="text-red-500">*</span></label>
                  <select 
                    required
                    value={shareStudentType}
                    onChange={e => setShareStudentType(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Chọn --</option>
                    {studentTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loại hình tiết dạy <span className="text-red-500">*</span></label>
                  <select 
                    required
                    value={shareLessonType}
                    onChange={e => setShareLessonType(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Chọn --</option>
                    {lessonTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tóm tắt nội dung (Không bắt buộc)</label>
                <textarea 
                  value={shareSummary}
                  onChange={e => setShareSummary(e.target.value)}
                  placeholder="Vài dòng giới thiệu về tài liệu này..."
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setSharingFile(null)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors text-sm"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors text-sm"
                >
                  <Send className="w-4 h-4" />
                  Gửi yêu cầu đăng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
