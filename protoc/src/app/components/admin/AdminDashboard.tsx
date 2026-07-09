import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getDirectoriesAsTreeOptions } from '../../utils/directoryHelpers';
import { PermissionDirTreeNode } from '../directory/PermissionTree';
import { User, Directory, LessonPlan } from '../../utils/types';

interface AdminDashboardProps {
  currentUser: User | null;
  directories: Directory[];
  setDirectories: React.Dispatch<React.SetStateAction<Directory[]>>;
  unfilteredLessons: LessonPlan[];
  setSelectedLessonForDetail: (lesson: LessonPlan | null) => void;
  setCurrentView: (view: 'home' | 'upload' | 'admin') => void;
  fetchDirectories: () => Promise<void>;
  adminUsers: any[];
  setAdminUsers: React.Dispatch<React.SetStateAction<any[]>>;
  loadingAdminUsers: boolean;
  fetchAdminUsers: (force?: boolean) => Promise<void>;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  directories,
  setDirectories,
  unfilteredLessons,
  setSelectedLessonForDetail,
  setCurrentView,
  fetchDirectories,
  adminUsers,
  setAdminUsers,
  loadingAdminUsers,
  fetchAdminUsers
}) => {
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
    fetchAdminUsers(false);
  }, [currentUser, fetchAdminUsers]);

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
    }
  }, [selectedUserForPerms]);

  useEffect(() => {
    if (editRole === 'USER') {
      setAdminPermissionSubTab('personal');
    }
  }, [editRole]);

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
      fetchAdminUsers(true);
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
      fetchAdminUsers(true);
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
      fetchAdminUsers(true);
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
      fetchAdminUsers(true);
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
      fetchAdminUsers(true);
    } catch (err: any) {
      alert(err.response?.data?.error || `Lỗi khi ${actionText} tài khoản.`);
    }
  };

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
              <div className="bg-purple-650 rounded-xl text-white p-2 font-bold text-xl leading-none shadow-lg shadow-purple-500/20">🛡️</div>
              <div>
                <span className="font-extrabold text-lg tracking-tight text-gray-900">Bảng Điều Hướng Quản Trị</span>
                <p className="text-[10px] text-gray-500 font-semibold tracking-wider uppercase">Hệ thống quản lý tri thức</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchAdminUsers(true)}
                disabled={loadingAdminUsers}
                className="px-4 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                <span className={`inline-block ${loadingAdminUsers ? 'animate-spin' : ''}`}>🔄</span>
                Làm mới
              </button>
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
              className="px-2.5 py-1.5 bg-purple-650 hover:bg-purple-750 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-md shadow-purple-500/10"
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
              className="w-full bg-gray-50 border border-gray-200 hover:border-gray-350 rounded-xl px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-medium"
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

          <div className="flex-grow space-y-2.5 overflow-y-auto pr-1 relative min-h-[150px]">
            {loadingAdminUsers && adminUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-gray-500 gap-2 absolute inset-0 bg-white/70">
                <div className="w-6 h-6 border-2 border-purple-650 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs font-semibold">Đang tải tài khoản...</span>
              </div>
            ) : filteredAdminUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs italic">
                Không tìm thấy tài khoản phù hợp.
              </div>
            ) : (
              filteredAdminUsers.map((u: any) => {
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
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex justify-between items-center relative group ${isSelected
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
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border tracking-wide uppercase ${u.role === 'ADMIN'
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
              })
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
                        className={`p-3 rounded-2xl border cursor-pointer transition-all text-center flex flex-col justify-center items-center ${newRole === rOption.value
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
                    className="px-6 py-2.5 bg-purple-650 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-purple-250/20"
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
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border tracking-wide uppercase ${selectedUserForPerms.role === 'ADMIN'
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
                    <span className="text-[10px] font-black px-3 py-2 rounded-xl border border-purple-200 bg-purple-50 text-purple-750 uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                      🛡️ Tài khoản Admin được bảo vệ
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => handleToggleLockUser(selectedUserForPerms)}
                        className={`px-4 py-2 border rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${selectedUserForPerms.is_active
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
                        className="px-4 py-2 border border-red-200 hover:bg-red-50 text-red-650 hover:text-red-700 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5"
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
                  className={`px-6 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${adminActiveTab === 'profile'
                    ? 'border-purple-600 text-purple-650 font-bold'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                >
                  <span>👤</span> Hồ sơ & Bảo mật
                </button>
                <button
                  onClick={() => setAdminActiveTab('permissions')}
                  className={`px-6 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${adminActiveTab === 'permissions'
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
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-semibold"
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
                              className={`p-3 rounded-2xl border cursor-pointer transition-all text-center flex flex-col justify-center items-center ${editRole === rOption.value
                                ? 'border-purple-655 bg-purple-50 text-purple-705 font-bold'
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
                        className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${adminPermissionSubTab === 'personal'
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
                          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${adminPermissionSubTab === 'public'
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
};

export default AdminDashboard;
