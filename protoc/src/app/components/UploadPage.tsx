import { useState, useRef } from 'react';
import { CloudUpload, FileText, Zap, X, CheckCircle2, ChevronDown, ChevronRight, FolderPlus, Edit2, Trash2, Move, Search } from 'lucide-react';

import { Folder, FileItem, useAppContext, studentTypes, lessonTypes } from '../context';

export default function UploadPage() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [selectedKnowledge, setSelectedKnowledge] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(false);

  // Folder tree state from context
  const { folders, setFolders, currentUser } = useAppContext();
  const [expandedFolders, setExpandedFolders] = useState<string[]>(['root']);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('root');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [newKnowledgeItem, setNewKnowledgeItem] = useState('');
  const [showKnowledgeSuggestions, setShowKnowledgeSuggestions] = useState(false);
  const [editingKnowledgeItem, setEditingKnowledgeItem] = useState<string | null>(null);
  const [editingKnowledgeValue, setEditingKnowledgeValue] = useState('');
  const [selectedStudentType, setSelectedStudentType] = useState<string>('');
  const [selectedLessonType, setSelectedLessonType] = useState<string>('');
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const toggleFolderExpand = (folderId: string) => {
    setExpandedFolders(prev =>
      prev.includes(folderId)
        ? prev.filter(id => id !== folderId)
        : [...prev, folderId]
    );
  };

  const addFolder = (parentId: string) => {
    const updateFolders = (folderList: Folder[]): Folder[] => {
      return folderList.map(folder => {
        if (folder.id === parentId) {
          const newFolder: Folder = {
            id: `folder_${Date.now()}`,
            name: 'Thư mục mới',
            knowledge: [],
            children: [],
            files: [],
          };
          return { ...folder, children: [...folder.children, newFolder] };
        }
        return { ...folder, children: updateFolders(folder.children) };
      });
    };
    setFolders(updateFolders(folders));
  };

  const deleteFolder = (folderId: string) => {
    const updateFolders = (folderList: Folder[]): Folder[] => {
      return folderList
        .filter(folder => folder.id !== folderId)
        .map(folder => ({
          ...folder,
          children: updateFolders(folder.children),
        }));
    };
    setFolders(updateFolders(folders));
    if (selectedFolderId === folderId) {
      setSelectedFolderId('root');
    }
  };

  const startEditFolder = (folderId: string, folderName: string) => {
    setEditingFolderId(folderId);
    setEditingFolderName(folderName);
  };

  const saveEditFolder = (folderId: string) => {
    const updateFolders = (folderList: Folder[]): Folder[] => {
      return folderList.map(folder => {
        if (folder.id === folderId) {
          return { ...folder, name: editingFolderName };
        }
        return { ...folder, children: updateFolders(folder.children) };
      });
    };
    setFolders(updateFolders(folders));
    setEditingFolderId(null);
  };

  const addFileToFolder = (folderId: string, file: File) => {
    const updateFolders = (folderList: Folder[]): Folder[] => {
      return folderList.map(folder => {
        if (folder.id === folderId) {
          const newFile: FileItem = {
            id: `file_${Date.now()}`,
            name: file.name,
            size: file.size,
            uploadDate: new Date(),
            studentType: selectedStudentType,
            lessonType: selectedLessonType,
            knowledge: selectedKnowledge,
          };
          return { ...folder, files: [...folder.files, newFile] };
        }
        return { ...folder, children: updateFolders(folder.children) };
      });
    };
    setFolders(updateFolders(folders));
  };

  const moveFile = (fileId: string, fromFolderId: string, toFolderId: string) => {
    let fileToMove: FileItem | null = null;

    const removeFile = (folderList: Folder[]): Folder[] => {
      return folderList.map(folder => {
        if (folder.id === fromFolderId) {
          const file = folder.files.find(f => f.id === fileId);
          if (file) fileToMove = file;
          return { ...folder, files: folder.files.filter(f => f.id !== fileId) };
        }
        return { ...folder, children: removeFile(folder.children) };
      });
    };

    const addFile = (folderList: Folder[]): Folder[] => {
      return folderList.map(folder => {
        if (folder.id === toFolderId && fileToMove) {
          return { ...folder, files: [...folder.files, fileToMove] };
        }
        return { ...folder, children: addFile(folder.children) };
      });
    };

    setFolders(prev => addFile(removeFile(prev)));
  };

  const deleteFile = (fileId: string, folderId: string) => {
    const updateFolders = (folderList: Folder[]): Folder[] => {
      return folderList.map(folder => {
        if (folder.id === folderId) {
          return { ...folder, files: folder.files.filter(f => f.id !== fileId) };
        }
        return { ...folder, children: updateFolders(folder.children) };
      });
    };
    setFolders(updateFolders(folders));
  };

  const findFolderById = (folderId: string, folderList: Folder[] = folders): Folder | null => {
    for (const folder of folderList) {
      if (folder.id === folderId) return folder;
      const found = findFolderById(folderId, folder.children);
      if (found) return found;
    }
    return null;
  };

  const simulateAIAnalysis = () => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);

    const interval = setInterval(() => {
      setAnalysisProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsAnalyzing(false);
          setSelectedKnowledge(['Quá trình quang hợp', 'Cấu trúc tế bào', 'Hệ sinh thái']);
          setAiSuggested(true);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const docxFile = files.find(file =>
      file.name.endsWith('.docx') || file.name.endsWith('.doc')
    );

    if (docxFile) {
      setUploadedFile(docxFile);
      simulateAIAnalysis();
    } else {
      alert('Vui lòng chỉ tải lên file Word (.docx)');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.name.endsWith('.docx') || file.name.endsWith('.doc'))) {
      setUploadedFile(file);
      simulateAIAnalysis();
    } else {
      alert('Vui lòng chỉ tải lên file Word (.docx)');
    }
  };

  const toggleKnowledge = (item: string) => {
    setSelectedKnowledge(prev =>
      prev.includes(item)
        ? prev.filter(k => k !== item)
        : [...prev, item]
    );
  };

  const removeKnowledge = (item: string) => {
    setSelectedKnowledge(prev => prev.filter(k => k !== item));
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setIsAnalyzing(false);
    setAnalysisProgress(0);
    setSelectedKnowledge([]);
    setAiSuggested(false);
  };

  const getBreadcrumbPath = (targetId: string, folderList: Folder[] = folders, path: Folder[] = []): Folder[] => {
    for (const folder of folderList) {
      if (folder.id === targetId) {
        return [...path, folder];
      }
      const found = getBreadcrumbPath(targetId, folder.children, [...path, folder]);
      if (found.length > path.length) return found;
    }
    return [];
  };

  const checkPermission = (folderId: string) => {
    if (!currentUser) return false;
    if (currentUser.role === 'super_admin') return true;
    if (currentUser.role === 'folder_admin') {
      const path = getBreadcrumbPath(folderId);
      return path.some(f => currentUser.allowedFolders.includes(f.id));
    }
    return false;
  };

  const hasPermission = checkPermission(selectedFolderId);

  const handleUploadToFolder = () => {
    if (!hasPermission) {
      alert('Bạn không có quyền đăng tải vào thư mục này. Vui lòng chọn thư mục mà bạn được cấp quyền.');
      return;
    }
    if (!uploadedFile) {
      alert('Vui lòng chọn file để tải lên');
      return;
    }

    if (!selectedStudentType) {
      alert('Vui lòng chọn đối tượng giảng dạy');
      return;
    }

    if (!selectedLessonType) {
      alert('Vui lòng chọn loại hình tiết dạy');
      return;
    }

    if (selectedKnowledge.length === 0) {
      alert('Vui lòng chọn ít nhất một kiến thức sinh học');
      return;
    }

    addFileToFolder(selectedFolderId, uploadedFile);
    handleRemoveFile();
    setSelectedStudentType('');
    setSelectedLessonType('');
    alert('File đã được lưu vào thư mục thành công!');
  };

  const selectedFolder = findFolderById(selectedFolderId);

  const getFolderKnowledge = (folder: Folder | null): string[] => {
    if (!folder) return [];
    const descendantKnowledge = folder.children.flatMap(child => getFolderKnowledge(child));
    return Array.from(new Set([...folder.knowledge, ...descendantKnowledge]));
  };

  const getAllKnowledge = (folderList: Folder[] = folders): string[] => {
    return Array.from(
      new Set(folderList.flatMap(folder => [...folder.knowledge, ...getAllKnowledge(folder.children)]))
    );
  };
  const allKnowledgeItems = getAllKnowledge();

  const folderKnowledge = getFolderKnowledge(selectedFolder);

  const getKnowledgeSourcePaths = (knowledgeItem: string, folderList: Folder[] = folders, currentPath: string[] = []): string[] => {
    let sources: string[] = [];
    for (const folder of folderList) {
      const path = [...currentPath, folder.name];
      if (folder.knowledge.includes(knowledgeItem)) {
        sources.push(path.join(' / '));
      }
      sources = [...sources, ...getKnowledgeSourcePaths(knowledgeItem, folder.children, path)];
    }
    return sources;
  };

  const getKnowledgeSourceText = (knowledgeItem: string): string => {
    const sources = getKnowledgeSourcePaths(knowledgeItem);
    return sources.length > 0 ? sources[0] : 'Thư mục khác';
  };

  const updateFolderKnowledge = (folderId: string, updater: (knowledge: string[]) => string[]) => {
    const updateFolders = (folderList: Folder[]): Folder[] => {
      return folderList.map(folder => {
        if (folder.id === folderId) {
          return { ...folder, knowledge: updater(folder.knowledge) };
        }
        return { ...folder, children: updateFolders(folder.children) };
      });
    };
    setFolders(updateFolders(folders));
  };

  const addKnowledgeToFolder = (folderId: string, knowledge: string) => {
    if (!knowledge.trim()) return;
    updateFolderKnowledge(folderId, current => Array.from(new Set([...current, knowledge.trim()])));
    setNewKnowledgeItem('');
  };

  const deleteKnowledgeFromFolder = (folderId: string, knowledge: string) => {
    updateFolderKnowledge(folderId, current => current.filter(item => item !== knowledge));
    if (selectedKnowledge.includes(knowledge)) {
      setSelectedKnowledge(prev => prev.filter(item => item !== knowledge));
    }
  };

  const startEditKnowledge = (knowledge: string) => {
    setEditingKnowledgeItem(knowledge);
    setEditingKnowledgeValue(knowledge);
  };

  const saveEditKnowledge = (folderId: string) => {
    if (!editingKnowledgeItem) return;
    const newValue = editingKnowledgeValue.trim();
    if (!newValue) return;
    updateFolderKnowledge(folderId, current => current.map(item => item === editingKnowledgeItem ? newValue : item));
    setEditingKnowledgeItem(null);
    setEditingKnowledgeValue('');
    setSelectedKnowledge(prev => prev.map(item => item === editingKnowledgeItem ? newValue : item));
  };

  const breadcrumb = getBreadcrumbPath(selectedFolderId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl text-gray-800 mb-2">Quản lý Tài liệu Bài giảng</h1>
          <p className="text-gray-600">Tổ chức kế hoạch bài giảng theo cây thư mục và tải lên file</p>
        </div>

        {/* Main Content Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-200">
            <button
              onClick={() => setSelectedFolderId('root')}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 underline"
            >
              Trang chủ
            </button>
            {breadcrumb.slice(1).map(folder => (
              <div key={folder.id} className="flex items-center gap-2">
                <span className="text-gray-400">/</span>
                <button
                  onClick={() => setSelectedFolderId(folder.id)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 underline"
                >
                  {folder.name}
                </button>
              </div>
            ))}
          </div>

          {/* Content Area */}
          <div className="grid grid-cols-2 gap-6">
            {/* Left - Folder Structure (50%) */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📁</span>
                  {selectedFolder && editingFolderId === selectedFolder.id ? (
                    <input
                      type="text"
                      value={editingFolderName}
                      onChange={(e) => setEditingFolderName(e.target.value)}
                      onBlur={() => saveEditFolder(selectedFolder.id)}
                      onKeyPress={(e) => e.key === 'Enter' && saveEditFolder(selectedFolder.id)}
                      autoFocus
                      className="px-2 py-1 border border-blue-500 rounded text-lg font-semibold text-gray-800"
                    />
                  ) : (
                    <h2 className="text-lg text-gray-800 font-semibold">
                      {selectedFolder?.name}
                    </h2>
                  )}
                </div>
                {selectedFolder && selectedFolder.id !== 'root' && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => startEditFolder(selectedFolder.id, selectedFolder.name)}
                      className="p-1.5 hover:bg-yellow-100 rounded-lg text-yellow-600 transition-colors"
                      title="Sửa tên"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteFolder(selectedFolder.id)}
                      className="p-1.5 hover:bg-red-100 rounded-lg text-red-600 transition-colors"
                      title="Xóa thư mục"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Subfolder List */}
              {selectedFolder && (() => {
                  let visibleChildren = selectedFolder.children;
                  let isRootForAdmin = false;
                  
                  if (currentUser?.role === 'folder_admin' && selectedFolder.id === 'root') {
                    isRootForAdmin = true;
                    visibleChildren = currentUser.allowedFolders
                      .map(id => findFolderById(id))
                      .filter(Boolean) as Folder[];
                  }

                  if (visibleChildren.length === 0) return null;

                  return (
                    <div className="space-y-2 mb-6">
                      <p className="text-xs font-semibold text-gray-600 uppercase">
                        {isRootForAdmin ? 'Các thư mục được phân quyền' : 'Thư mục con'}
                      </p>
                      {visibleChildren.map(folder => {
                        const displayName = isRootForAdmin 
                          ? getBreadcrumbPath(folder.id).map(f => f.name).join(' / ')
                          : folder.name;

                        return (
                          <div
                            key={folder.id}
                            className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200 hover:border-blue-400 hover:bg-blue-100 transition-colors cursor-pointer group"
                            onClick={() => setSelectedFolderId(folder.id)}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="text-lg">📁</span>
                              {editingFolderId === folder.id ? (
                                <input
                                  type="text"
                                  value={editingFolderName}
                                  onChange={(e) => setEditingFolderName(e.target.value)}
                                  onBlur={() => saveEditFolder(folder.id)}
                                  onKeyPress={(e) => e.key === 'Enter' && saveEditFolder(folder.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  autoFocus
                                  className="flex-1 px-2 py-1 border border-blue-500 rounded text-sm"
                                />
                              ) : (
                                <span className="text-sm font-medium text-gray-800 truncate">
                                  {displayName}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditFolder(folder.id, folder.name);
                                }}
                                className="p-1 hover:bg-yellow-200 rounded"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteFolder(folder.id);
                                }}
                                className="p-1 hover:bg-red-200 rounded"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
              })()}
              {/* Add Folder Button */}
              <button
                type="button"
                onClick={() => addFolder(selectedFolderId)}
                className="w-full py-2.5 rounded-lg text-blue-600 border border-blue-300 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              >
                <FolderPlus className="w-4 h-4" />
                Thêm thư mục con
              </button>

              {/* Knowledge Management */}
              {selectedFolder && (
                <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Kiến thức thư mục</p>
                      <p className="text-xs text-gray-500">Thêm, sửa, xóa kiến thức cho thư mục này</p>
                    </div>
                  </div>

                  <div className="relative flex gap-2 mb-3">
                    <div className="flex-1 relative">
                      <input
                        value={newKnowledgeItem}
                        onChange={(e) => {
                          setNewKnowledgeItem(e.target.value);
                          setShowKnowledgeSuggestions(true);
                        }}
                        onFocus={() => setShowKnowledgeSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowKnowledgeSuggestions(false), 200)}
                        type="text"
                        placeholder="Nhập hoặc tìm kiếm kiến thức..."
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                      {showKnowledgeSuggestions && newKnowledgeItem && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {allKnowledgeItems
                            .filter(k => k.toLowerCase().includes(newKnowledgeItem.toLowerCase()) && !selectedFolder.knowledge.includes(k))
                            .map(item => (
                              <div
                                key={item}
                                className="px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setNewKnowledgeItem(item);
                                  setShowKnowledgeSuggestions(false);
                                }}
                              >
                                {item}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => addKnowledgeToFolder(selectedFolder.id, newKnowledgeItem)}
                      className="px-4 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 whitespace-nowrap"
                    >
                      Thêm
                    </button>
                  </div>

                  {getFolderKnowledge(selectedFolder).length > 0 ? (
                    <div className="space-y-2">
                      {getFolderKnowledge(selectedFolder).map(item => {
                        const isInherited = !selectedFolder.knowledge.includes(item);
                        return (
                        <div key={item} className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-gray-200">
                          {editingKnowledgeItem === item && !isInherited ? (
                            <input
                              value={editingKnowledgeValue}
                              onChange={(e) => setEditingKnowledgeValue(e.target.value)}
                              onBlur={() => saveEditKnowledge(selectedFolder.id)}
                              onKeyPress={(e) => e.key === 'Enter' && saveEditKnowledge(selectedFolder.id)}
                              className="flex-1 rounded-lg border border-blue-300 px-2 py-1 text-sm"
                              autoFocus
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-700">{item}</span>
                              {isInherited && (
                                <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                  {getKnowledgeSourceText(item)}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            {!isInherited && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startEditKnowledge(item)}
                                  className="p-1 rounded hover:bg-yellow-100 text-yellow-600"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteKnowledgeFromFolder(selectedFolder.id, item)}
                                  className="p-1 rounded hover:bg-red-100 text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )})}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Thư mục này chưa có kiến thức nào.</p>
                  )}
                </div>
              )}

              {/* File List */}
              {selectedFolder && selectedFolder.files.length > 0 ? (
                <div className="mt-6">
                  <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Tệp tin</p>
                  <div className="space-y-2">
                    {selectedFolder.files.map(file => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors group"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {file.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {(file.size / 1024).toFixed(2)} KB • {file.uploadDate.toLocaleDateString('vi-VN')}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteFile(file.id, selectedFolderId)}
                          className="p-1 hover:bg-red-200 rounded text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Right - Upload Form (50%) */}
            <div>
              <h2 className="text-lg text-gray-800 font-semibold mb-4">Tải lên tài liệu</h2>

              {/* Upload Area */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`
                  relative border-2 border-dashed rounded-xl p-8 text-center transition-all mb-6
                  ${isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-blue-400 bg-gray-50'
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".doc,.docx"
                  onChange={handleFileInput}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isAnalyzing}
                />

                {uploadedFile ? (
                  <div className="flex flex-col items-center">
                    <FileText className="w-16 h-16 text-green-500 mb-3" />
                    <p className="text-base text-gray-800 mb-1 font-medium">{uploadedFile.name}</p>
                    <p className="text-xs text-gray-500 mb-4">
                      {(uploadedFile.size / 1024).toFixed(2)} KB
                    </p>

                    {isAnalyzing && (
                      <div className="w-full mt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="w-4 h-4 text-yellow-500 animate-pulse" />
                          <p className="text-xs text-gray-700">AI đang phân tích...</p>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full transition-all duration-300"
                            style={{ width: `${analysisProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {!isAnalyzing && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile();
                        }}
                        className="mt-3 text-sm text-red-600 hover:text-red-700"
                      >
                        Xóa và chọn file khác
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <CloudUpload className="w-16 h-16 text-gray-400 mb-3" />
                    <p className="text-base text-gray-700 font-medium mb-1">Kéo thả file vào đây</p>
                    <p className="text-xs text-gray-500 mb-3">hoặc click để chọn file</p>
                    <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                      .docx
                    </div>
                  </div>
                )}
              </div>

              <div className="mb-6 grid gap-4">
                <div>
                  <p className="text-sm text-gray-700 mb-2 font-medium">Đối tượng giảng dạy <span className="text-red-500">*</span></p>
                  <div className="grid grid-cols-2 gap-2">
                    {studentTypes.map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setSelectedStudentType(type)}
                        className={`rounded-lg px-3 py-2 text-sm text-left border transition ${selectedStudentType === type ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-700 mb-2 font-medium">Loại hình tiết dạy <span className="text-red-500">*</span></p>
                  <div className="grid grid-cols-2 gap-2">
                    {lessonTypes.map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setSelectedLessonType(type)}
                        className={`rounded-lg px-3 py-2 text-sm text-left border transition ${selectedLessonType === type ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Knowledge Tags */}
              <div className="mb-6">
                <label className="flex items-center gap-2 text-sm text-gray-700 mb-3 font-medium">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  Kiến thức môn học <span className="text-red-500">*</span>
                </label>

                <div className="relative mb-3">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={tagSearchQuery}
                    onChange={(e) => {
                      setTagSearchQuery(e.target.value);
                      setShowTagSuggestions(true);
                    }}
                    onFocus={() => setShowTagSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                    placeholder="Tìm kiếm kiến thức từ tất cả thư mục..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                  {showTagSuggestions && tagSearchQuery && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {allKnowledgeItems
                        .filter(k => k.toLowerCase().includes(tagSearchQuery.toLowerCase()) && !selectedKnowledge.includes(k))
                        .map(item => (
                          <div
                            key={item}
                            className="px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer flex items-center justify-between"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              toggleKnowledge(item);
                              setTagSearchQuery('');
                              setShowTagSuggestions(false);
                            }}
                          >
                            <span>{item}</span>
                            {!folderKnowledge.includes(item) && (
                              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                                {getKnowledgeSourceText(item)}
                              </span>
                            )}
                          </div>
                        ))}
                      {allKnowledgeItems.filter(k => k.toLowerCase().includes(tagSearchQuery.toLowerCase()) && !selectedKnowledge.includes(k)).length === 0 && (
                         <div className="px-3 py-2 text-sm text-gray-500 text-center">Không tìm thấy kiến thức nào.</div>
                      )}
                    </div>
                  )}
                </div>

                {selectedKnowledge.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
                    {selectedKnowledge.map(item => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded-full text-xs"
                      >
                        {item}
                        <button
                          type="button"
                          onClick={() => removeKnowledge(item)}
                          className="ml-0.5 hover:bg-blue-700 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-white">
                  {folderKnowledge.length > 0 ? folderKnowledge.map(item => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleKnowledge(item)}
                      className={`px-2 py-1.5 rounded text-xs text-left transition-all ${selectedKnowledge.includes(item) ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'}`}
                    >
                      {item}
                    </button>
                  )) : (
                    <div className="col-span-2 text-sm text-gray-500">Thư mục này chưa có kiến thức được cấu hình.</div>
                  )}
                </div>
              </div>

              {/* Upload Button */}
              {!hasPermission && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 flex items-start gap-2">
                  <X className="w-4 h-4 shrink-0 mt-0.5" />
                  Bạn không được cấp quyền đăng tải tài liệu vào thư mục này.
                </div>
              )}
              <button
                type="button"
                onClick={handleUploadToFolder}
                disabled={!uploadedFile || selectedKnowledge.length === 0 || isAnalyzing || !hasPermission}
                className={`
                  w-full py-2.5 rounded-lg text-white transition-all flex items-center justify-center gap-2 text-sm font-medium
                  ${uploadedFile && selectedKnowledge.length > 0 && !isAnalyzing && hasPermission
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                    : 'bg-gray-400 cursor-not-allowed'
                  }
                `}
              >
                <CheckCircle2 className="w-4 h-4" />
                Lưu vào thư mục
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
