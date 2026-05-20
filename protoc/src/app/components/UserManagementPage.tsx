import { useState } from 'react';
import { Users, Shield, FolderGit2, CheckCircle, XCircle, Edit2, Trash2, FileText } from 'lucide-react';
import { useAppContext, Folder } from '../context';

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
  const [activeTab, setActiveTab] = useState<'users' | 'approvals'>('users');
  const [selectedUpload, setSelectedUpload] = useState<PendingUpload | null>(null);

  const handleApprove = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPendingUploads(prev => prev.filter(p => p.id !== id));
    if (selectedUpload?.id === id) setSelectedUpload(null);
    alert('Đã duyệt bài giảng!');
  };

  const handleReject = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPendingUploads(prev => prev.filter(p => p.id !== id));
    if (selectedUpload?.id === id) setSelectedUpload(null);
    alert('Đã từ chối bài giảng!');
  };

  const getRoleBadge = (role: User['role']) => {
    switch (role) {
      case 'super_admin':
        return <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-md text-xs font-medium">Quản trị viên cấp cao</span>;
      case 'folder_admin':
        return <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium">Quản trị viên thư mục</span>;
      case 'user':
        return <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">Người dùng thường</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý người dùng & Xét duyệt</h1>
          <p className="text-gray-500 mt-1">Phân quyền thư mục và xét duyệt tài liệu tải lên</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 mb-8">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-4 px-2 font-medium text-sm transition-colors relative ${activeTab === 'users' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Danh sách người dùng
          </div>
          {activeTab === 'users' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />}
        </button>
        <button
          onClick={() => setActiveTab('approvals')}
          className={`pb-4 px-2 font-medium text-sm transition-colors relative ${activeTab === 'approvals' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Xét duyệt bài giảng
            {pendingUploads.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingUploads.length}</span>
            )}
          </div>
          {activeTab === 'approvals' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />}
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Người dùng</th>
                <th className="px-6 py-4">Vai trò</th>
                <th className="px-6 py-4">Quyền thư mục</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{user.name}</div>
                    <div className="text-gray-500 text-xs">{user.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    {getRoleBadge(user.role)}
                  </td>
                  <td className="px-6 py-4">
                    {user.role === 'super_admin' ? (
                      <span className="text-gray-500 italic">Tất cả thư mục</span>
                    ) : user.allowedFolders.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {user.allowedFolders.map(fId => (
                          <span key={fId} className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-xs">
                            <FolderGit2 className="w-3 h-3" />
                            {fId}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Không có quyền (Chờ duyệt khi đăng)</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Phân quyền">
                        <Shield className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors" title="Sửa">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'approvals' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {pendingUploads.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Không có bài giảng nào đang chờ duyệt.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">Tên tài liệu</th>
                  <th className="px-6 py-4">Người đăng</th>
                  <th className="px-6 py-4">Thư mục đích</th>
                  <th className="px-6 py-4">Ngày gửi</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingUploads.map(upload => (
                  <tr
                    key={upload.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedUpload(upload)}
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">{upload.fileName}</td>
                    <td className="px-6 py-4 text-gray-600">{upload.uploadedBy}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                        <FolderGit2 className="w-3 h-3" />
                        {upload.targetFolderPath}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{upload.date}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleApprove(upload.id, e)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-md transition-colors font-medium text-xs"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Duyệt
                        </button>
                        <button
                          onClick={(e) => handleReject(upload.id, e)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-md transition-colors font-medium text-xs"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Từ chối
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal for viewing document details before approval */}
      {selectedUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-800">Chi tiết bài giảng chờ duyệt</h2>
              <button
                onClick={() => setSelectedUpload(null)}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Tên tài liệu</h3>
                  <p className="text-base font-medium text-gray-900">{selectedUpload.fileName}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Người đăng</h3>
                  <p className="text-base text-gray-900">{selectedUpload.uploadedBy}</p>
                </div>
                <div className="col-span-2">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Thư mục đích</h3>
                  <p className="text-base text-gray-900 inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-md">
                    <FolderGit2 className="w-4 h-4 text-gray-500" />
                    {selectedUpload.targetFolderPath}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Đối tượng giảng dạy</h3>
                  <p className="text-base text-gray-900">{selectedUpload.studentType}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Loại hình tiết dạy</h3>
                  <p className="text-base text-gray-900">{selectedUpload.lessonType}</p>
                </div>
                <div className="col-span-2">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Kiến thức môn học</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedUpload.knowledge.map(k => (
                      <span key={k} className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-sm">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Tóm tắt</h3>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    {selectedUpload.summary}
                  </p>
                </div>
              </div>

              {/* Document Preview Placeholder */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Xem trước nội dung</h3>
                <div className="w-full h-64 bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center flex-col text-gray-400">
                  <FileText className="w-12 h-12 mb-2 opacity-50" />
                  <p>Trình xem trước tài liệu ({selectedUpload.fileName.split('.').pop()})</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3 rounded-b-xl">
              <button
                onClick={() => setSelectedUpload(null)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Đóng
              </button>
              <button
                onClick={() => handleReject(selectedUpload.id)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Từ chối
              </button>
              <button
                onClick={() => handleApprove(selectedUpload.id)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Duyệt bài này
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
