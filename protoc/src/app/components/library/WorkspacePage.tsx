import React, { useState, useRef } from 'react';
import { 
  FolderOutlined, 
  FileTextOutlined, 
  ShareAltOutlined, 
  SearchOutlined, 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  EyeOutlined,
  UploadOutlined,
  SendOutlined
} from '@ant-design/icons';
import { useAppContext, studentTypes, lessonTypes } from '../context';
import { Table, Modal, Button, Input, Select, Space, Tag, Tooltip, message, Card } from 'antd';
import type { ColumnsType } from 'antd/es/table';

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
    message.success('Đã tạo thư mục mới!');
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
      message.success('Đã cập nhật tên thư mục!');
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
      message.success('Đã xóa thư mục!');
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
      message.success('Tải lên tài liệu cá nhân thành công!');
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
      message.success('Đã xóa tài liệu!');
    }
  };

  const handleViewFile = (file: PrivateFile) => {
    message.info(`Đang mở trình xem tài liệu: ${file.name}`);
  };

  const handleShareSubmit = () => {
    if (!shareTargetFolder || !shareStudentType || !shareLessonType) {
      message.error('Vui lòng chọn đầy đủ thư mục đích, đối tượng và loại hình!');
      return;
    }
    
    if (sharingFile) {
      const updatedFolders = privateFolders.map(folder => ({
        ...folder,
        files: folder.files.map(file => 
          file.id === sharingFile.id ? { ...file, status: 'pending_approval' as const } : file
        )
      }));
      setPrivateFolders(updatedFolders);
    }

    message.success('Đã gửi yêu cầu đăng tải! Vui lòng chờ phê duyệt.');
    setSharingFile(null);
  };

  const renderPublicFolderOptions = (folderList: any[], depth = 0) => {
    let options: { value: string; label: string }[] = [];
    for (const folder of folderList) {
      options.push({
        value: folder.id,
        label: `${' '.repeat(depth * 4)}${folder.children.length > 0 ? '📂' : '📄'} ${folder.name}`
      });
      if (folder.children.length > 0) {
        options = [...options, ...renderPublicFolderOptions(folder.children, depth + 1)];
      }
    }
    return options;
  };

  const fileColumns: ColumnsType<PrivateFile> = [
    {
      title: 'Tên tài liệu',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => (
        <Space>
          <FileTextOutlined className="text-blue-500 text-lg" />
          <Button type="link" onClick={() => handleViewFile(record)} className="p-0 font-medium text-gray-900 hover:text-blue-600">
            {record.name}
          </Button>
        </Space>
      )
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'date',
      key: 'date',
      render: (text) => <span className="text-gray-500">{text}</span>
    },
    {
      title: 'Kích thước',
      dataIndex: 'size',
      key: 'size',
      render: (text) => <span className="text-gray-500">{text}</span>
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        if (status === 'private') return <Tag color="default">Riêng tư</Tag>;
        if (status === 'pending_approval') return <Tag color="warning">Đang chờ duyệt</Tag>;
        return <Tag color="success">Đã đăng cộng đồng</Tag>;
      }
    },
    {
      title: 'Thao tác',
      key: 'action',
      align: 'right',
      render: (_, record) => (
        <Space>
          {record.status === 'private' && (
            <Button 
              type="primary" 
              size="small" 
              icon={<ShareAltOutlined />} 
              onClick={() => setSharingFile(record)}
              className="bg-blue-600 hover:bg-blue-700 text-xs rounded-lg"
            >
              Đăng cộng đồng
            </Button>
          )}
          <Tooltip title="Xem">
            <Button type="text" icon={<EyeOutlined className="text-gray-400" />} onClick={() => handleViewFile(record)} />
          </Tooltip>
          <Tooltip title="Xóa">
            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDeleteFile(record.id)} />
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - Personal Folders */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-[calc(100vh-64px)] sticky top-16">
        <div className="p-4 border-b border-gray-150 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Không gian của tôi</h2>
          <Button 
            type="text" 
            size="small" 
            icon={<PlusOutlined />} 
            onClick={() => handleCreateFolder()} 
            title="Thêm thư mục mới" 
          />
        </div>
        <div className="p-2 flex-1 overflow-y-auto space-y-1">
          {(() => {
            const renderTree = (folders: PrivateFolder[], depth = 0): React.ReactNode => {
              return folders.map(folder => (
                <div key={folder.id}>
                  <div className="group flex items-center justify-between p-1 rounded-lg hover:bg-gray-50">
                    <Button
                      type="text"
                      className={`flex-1 flex items-center gap-2 text-left justify-start border-none h-9 text-sm font-medium ${
                        activeFolderId === folder.id 
                          ? 'bg-blue-50 text-blue-700 font-bold' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      onClick={() => setActiveFolderId(folder.id)}
                    >
                      <FolderOutlined className={activeFolderId === folder.id ? 'text-blue-600' : 'text-gray-400'} />
                      <span className="truncate flex-1">{folder.name}</span>
                      <span className="text-[10px] text-gray-400 font-normal ml-1">({folder.files.length})</span>
                    </Button>
                    
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 pr-1">
                      <Button size="small" type="text" icon={<PlusOutlined className="text-xs" />} onClick={() => handleCreateFolder(folder.id)} title="Thêm thư mục con" />
                      <Button size="small" type="text" icon={<EditOutlined className="text-xs" />} onClick={() => handleEditFolder(folder.id)} title="Đổi tên" />
                      <Button size="small" type="text" danger icon={<DeleteOutlined className="text-xs" />} onClick={() => handleDeleteFolder(folder.id)} title="Xóa" />
                    </div>
                  </div>
                  {folder.children.length > 0 && (
                    <div className="mt-1 space-y-1 border-l border-gray-150 ml-4">
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

      {/* Main Workspace */}
      <main className="flex-grow p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FolderOutlined className="text-blue-500" />
              {activeFolder?.name || 'Vui lòng chọn thư mục'}
            </h1>
            
            <Space size="middle">
              <Input
                prefix={<SearchOutlined className="text-gray-400" />}
                placeholder="Tìm kiếm tài liệu..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-64 rounded-lg"
              />

              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload}
                className="hidden" 
              />
              <Button
                type="primary"
                icon={<UploadOutlined />}
                disabled={!activeFolder}
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600 hover:bg-blue-700 border-none rounded-lg"
              >
                Tải lên
              </Button>
            </Space>
          </div>

          <Card className="shadow-sm rounded-xl overflow-hidden border-gray-150">
            <Table
              columns={fileColumns}
              dataSource={filteredFiles}
              rowKey="id"
              pagination={false}
              locale={{ emptyText: 'Không có tài liệu nào trong thư mục này.' }}
            />
          </Card>
        </div>
      </main>

      {/* Share Community Modal */}
      <Modal
        title={<span className="text-lg font-bold text-gray-800">Đăng tài liệu lên cộng đồng</span>}
        open={!!sharingFile}
        onCancel={() => setSharingFile(null)}
        footer={[
          <Button key="back" onClick={() => setSharingFile(null)}>
            Hủy
          </Button>,
          <Button key="submit" type="primary" icon={<SendOutlined />} onClick={handleShareSubmit} className="bg-blue-600 hover:bg-blue-700 border-none">
            Gửi yêu cầu đăng
          </Button>
        ]}
        className="rounded-xl overflow-hidden"
      >
        {sharingFile && (
          <div className="py-4 space-y-4">
            <div>
              <span className="text-gray-400 text-xs block font-semibold mb-1">TÀI LIỆU CHỌN</span>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 flex items-center gap-2">
                <FileTextOutlined className="text-blue-500" />
                {sharingFile.name}
              </div>
            </div>

            <div>
              <span className="text-gray-400 text-xs block font-semibold mb-1">CHỌN THƯ MỤC ĐÍCH *</span>
              <Select
                className="w-full"
                placeholder="-- Chọn thư mục trên hệ thống --"
                value={shareTargetFolder || undefined}
                onChange={val => setShareTargetFolder(val)}
                options={renderPublicFolderOptions(folders)}
              />
              <p className="text-[11px] text-gray-450 mt-1">Quản trị viên của thư mục đích sẽ xem xét phê duyệt bài giảng.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-400 text-xs block font-semibold mb-1">ĐỐI TƯỢNG GIẢNG DẠY *</span>
                <Select
                  className="w-full"
                  placeholder="Chọn đối tượng"
                  value={shareStudentType || undefined}
                  onChange={val => setShareStudentType(val)}
                  options={studentTypes.map(t => ({ value: t, label: t }))}
                />
              </div>
              <div>
                <span className="text-gray-400 text-xs block font-semibold mb-1">LOẠI HÌNH TIẾT DẠY *</span>
                <Select
                  className="w-full"
                  placeholder="Chọn loại hình"
                  value={shareLessonType || undefined}
                  onChange={val => setShareLessonType(val)}
                  options={lessonTypes.map(t => ({ value: t, label: t }))}
                />
              </div>
            </div>

            <div>
              <span className="text-gray-400 text-xs block font-semibold mb-1">TÓM TẮT NỘI DUNG</span>
              <Input.TextArea
                rows={3}
                placeholder="Mô tả tóm tắt giới thiệu tài liệu..."
                value={shareSummary}
                onChange={e => setShareSummary(e.target.value)}
                className="rounded-lg resize-none"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
