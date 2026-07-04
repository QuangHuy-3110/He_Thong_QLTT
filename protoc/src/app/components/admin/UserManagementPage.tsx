import React, { useState } from 'react';
import { 
  TeamOutlined, 
  SafetyCertificateOutlined, 
  FolderOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  EditOutlined, 
  FileTextOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useAppContext } from '../../context';
import { Table, Tabs, Tag, Button, Modal, Tooltip, message, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'folder_admin' | 'user';
  allowedFolders: string[]; // Folder IDs they can manage/upload directly to
}

const mockUsers: User[] = [
  { id: '1', name: 'Nguyễn Văn Admin', email: 'admin@edu.vn', role: 'super_admin', allowedFolders: ['root'] },
  { id: '2', name: 'Trần Giáo Viên', email: 'giaovien@edu.vn', role: 'folder_admin', allowedFolders: ['thuc_vat', 'vi_sinh_vat'] },
  { id: '3', name: 'Lê Học Sinh', email: 'hocsinh@edu.vn', role: 'user', allowedFolders: [] },
];

interface PendingUpload {
  id: string;
  fileName: string;
  uploadedBy: string;
  targetFolderId: string;
  targetFolderPath: string; // Breadcrumb path
  studentType: string;
  lessonType: string;
  knowledge: string[];
  summary: string;
  status: 'pending' | 'approved' | 'rejected';
  date: string;
}

const mockPendingUploads: PendingUpload[] = [
  {
    id: 'p1',
    fileName: 'Bài giảng hệ sinh thái.docx',
    uploadedBy: 'Lê Học Sinh',
    targetFolderId: 'sinh_thai',
    targetFolderPath: 'Sinh học / Sinh thái',
    studentType: 'Học sinh thành thị',
    lessonType: 'Lý thuyết',
    knowledge: ['Hệ sinh thái', 'Chu trình sinh địa hóa'],
    summary: 'Bài giảng tổng hợp về hệ sinh thái và ứng dụng thực tiễn.',
    status: 'pending',
    date: '2024-03-20'
  },
  {
    id: 'p2',
    fileName: 'Đề cương vi sinh vật.pdf',
    uploadedBy: 'Lê Học Sinh',
    targetFolderId: 'vi_sinh_vat',
    targetFolderPath: 'Sinh học / Vi sinh vật',
    studentType: 'Học sinh nông thôn',
    lessonType: 'Thực tế',
    knowledge: ['Vi khuẩn', 'Nấm'],
    summary: 'Tài liệu hướng dẫn thực hành quan sát vi sinh vật.',
    status: 'pending',
    date: '2024-03-21'
  },
];

export default function UserManagementPage() {
  const { folders } = useAppContext();
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>(mockPendingUploads);
  const [selectedUpload, setSelectedUpload] = useState<PendingUpload | null>(null);

  const handleApprove = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPendingUploads(prev => prev.filter(p => p.id !== id));
    if (selectedUpload?.id === id) setSelectedUpload(null);
    message.success('Đã duyệt bài giảng!');
  };

  const handleReject = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPendingUploads(prev => prev.filter(p => p.id !== id));
    if (selectedUpload?.id === id) setSelectedUpload(null);
    message.warning('Đã từ chối bài giảng!');
  };

  const getRoleBadge = (role: User['role']) => {
    switch (role) {
      case 'super_admin':
        return <Tag color="purple" className="px-2 py-0.5 font-medium">Quản trị viên cấp cao</Tag>;
      case 'folder_admin':
        return <Tag color="blue" className="px-2 py-0.5 font-medium">Quản trị viên thư mục</Tag>;
      case 'user':
        return <Tag color="default" className="px-2 py-0.5 font-medium">Người dùng thường</Tag>;
    }
  };

  // Columns for Users Table
  const userColumns: ColumnsType<User> = [
    {
      title: 'Người dùng',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => (
        <div>
          <div className="font-semibold text-gray-900">{record.name}</div>
          <div className="text-gray-500 text-xs">{record.email}</div>
        </div>
      ),
    },
    {
      title: 'Vai trò',
      dataIndex: 'role',
      key: 'role',
      render: (role: User['role']) => getRoleBadge(role),
    },
    {
      title: 'Quyền thư mục',
      dataIndex: 'allowedFolders',
      key: 'allowedFolders',
      render: (_, record) => {
        if (record.role === 'super_admin') {
          return <span className="text-gray-500 italic">Tất cả thư mục</span>;
        }
        if (record.allowedFolders.length > 0) {
          return (
            <Space size={[4, 8]} wrap>
              {record.allowedFolders.map(fId => (
                <Tag icon={<FolderOutlined />} color="cyan" key={fId} className="m-0">
                  {fId}
                </Tag>
              ))}
            </Space>
          );
        }
        return <span className="text-gray-400 italic">Không có quyền (Chờ duyệt khi đăng)</span>;
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      align: 'right',
      render: () => (
        <Space size="middle">
          <Tooltip title="Phân quyền">
            <Button 
              type="text" 
              icon={<SafetyCertificateOutlined className="text-gray-400 hover:text-blue-600" />} 
              onClick={(e) => { e.stopPropagation(); message.info('Tính năng đang phát triển'); }} 
            />
          </Tooltip>
          <Tooltip title="Sửa">
            <Button 
              type="text" 
              icon={<EditOutlined className="text-gray-400 hover:text-yellow-600" />} 
              onClick={(e) => { e.stopPropagation(); message.info('Tính năng đang phát triển'); }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Columns for Pending Uploads Table
  const uploadColumns: ColumnsType<PendingUpload> = [
    {
      title: 'Tên tài liệu',
      dataIndex: 'fileName',
      key: 'fileName',
      render: (text) => <span className="font-semibold text-gray-900">{text}</span>,
    },
    {
      title: 'Người đăng',
      dataIndex: 'uploadedBy',
      key: 'uploadedBy',
    },
    {
      title: 'Thư mục đích',
      dataIndex: 'targetFolderPath',
      key: 'targetFolderPath',
      render: (text) => (
        <Tag icon={<FolderOutlined />} color="blue">
          {text}
        </Tag>
      ),
    },
    {
      title: 'Ngày gửi',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: 'Thao tác',
      key: 'action',
      align: 'right',
      render: (_, record) => (
        <Space onClick={(e) => e.stopPropagation()}>
          <Button
            type="primary"
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={(e) => handleApprove(record.id, e)}
            className="bg-green-600 hover:bg-green-700 border-none"
          >
            Duyệt
          </Button>
          <Button
            type="primary"
            danger
            size="small"
            icon={<CloseCircleOutlined />}
            onClick={(e) => handleReject(record.id, e)}
          >
            Từ chối
          </Button>
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'users',
      label: (
        <span className="flex items-center gap-2">
          <TeamOutlined />
          Danh sách người dùng
        </span>
      ),
      children: (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <Table 
            columns={userColumns} 
            dataSource={users} 
            rowKey="id" 
            pagination={false}
            className="antd-custom-table"
          />
        </div>
      ),
    },
    {
      key: 'approvals',
      label: (
        <span className="flex items-center gap-2">
          <SafetyCertificateOutlined />
          Xét duyệt bài giảng
          {pendingUploads.length > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {pendingUploads.length}
            </span>
          )}
        </span>
      ),
      children: (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {pendingUploads.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <ExclamationCircleOutlined className="text-3xl mb-2 block" />
              Không có bài giảng nào đang chờ duyệt.
            </div>
          ) : (
            <Table 
              columns={uploadColumns} 
              dataSource={pendingUploads} 
              rowKey="id" 
              pagination={false}
              onRow={(record) => ({
                onClick: () => setSelectedUpload(record),
              })}
              className="antd-custom-table cursor-pointer"
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý người dùng & Xét duyệt</h1>
          <p className="text-gray-500 mt-1">Phân quyền thư mục và xét duyệt tài liệu tải lên</p>
        </div>
      </div>

      <Tabs defaultActiveKey="users" items={tabItems} size="large" className="antd-custom-tabs" />

      {/* Ant Design Modal for document details */}
      <Modal
        title={<span className="text-lg font-bold text-gray-800">Chi tiết bài giảng chờ duyệt</span>}
        open={!!selectedUpload}
        onCancel={() => setSelectedUpload(null)}
        width={720}
        footer={[
          <Button key="back" onClick={() => setSelectedUpload(null)}>
            Đóng
          </Button>,
          <Button key="reject" type="primary" danger icon={<CloseCircleOutlined />} onClick={() => selectedUpload && handleReject(selectedUpload.id)}>
            Từ chối
          </Button>,
          <Button key="approve" type="primary" icon={<CheckCircleOutlined />} onClick={() => selectedUpload && handleApprove(selectedUpload.id)} className="bg-green-600 hover:bg-green-700 border-none">
            Duyệt bài này
          </Button>
        ]}
        className="rounded-xl overflow-hidden"
      >
        {selectedUpload && (
          <div className="py-4 space-y-6 max-h-[60vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-400 text-xs block font-medium">TÊN TÀI LIỆU</span>
                <span className="text-sm font-semibold text-gray-900">{selectedUpload.fileName}</span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block font-medium">NGƯỜI ĐĂNG</span>
                <span className="text-sm text-gray-800 font-semibold">{selectedUpload.uploadedBy}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-400 text-xs block font-medium mb-1">THƯ MỤC ĐÍCH</span>
                <Tag icon={<FolderOutlined />} color="blue">
                  {selectedUpload.targetFolderPath}
                </Tag>
              </div>
              <div>
                <span className="text-gray-400 text-xs block font-medium">ĐỐI TƯỢNG GIẢNG DẠY</span>
                <span className="text-sm text-gray-800 font-semibold">{selectedUpload.studentType}</span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block font-medium">LOẠI HÌNH TIẾT DẠY</span>
                <span className="text-sm text-gray-800 font-semibold">{selectedUpload.lessonType}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-400 text-xs block font-medium mb-2">KIẾN THỨC MÔN HỌC</span>
                <Space size={[4, 8]} wrap>
                  {selectedUpload.knowledge.map(k => (
                    <Tag color="geekblue" key={k}>
                      {k}
                    </Tag>
                  ))}
                </Space>
              </div>
              <div className="col-span-2">
                <span className="text-gray-400 text-xs block font-medium mb-1">TÓM TẮT</span>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm text-gray-700 leading-relaxed">
                  {selectedUpload.summary}
                </div>
              </div>
            </div>

            <div>
              <span className="text-gray-400 text-xs block font-medium mb-2">XEM TRƯỚC NỘI DUNG</span>
              <div className="w-full h-48 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center flex-col text-gray-400 text-sm">
                <FileTextOutlined className="text-3xl mb-2 opacity-50 text-blue-500" />
                <p>Trình xem trước tài liệu ({selectedUpload.fileName.split('.').pop()})</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
