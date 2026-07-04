import React from 'react';
import { Modal, Input, Button, Alert } from 'antd';
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  CameraOutlined,
} from '@ant-design/icons';
import { User } from '../../context';

interface ProfileModalProps {
  open: boolean;
  onCancel: () => void;
  currentUser: User | null;
  profileFullName: string;
  setProfileFullName: (name: string) => void;
  profileEmail: string;
  setProfileEmail: (email: string) => void;
  profilePhoneNumber: string;
  setProfilePhoneNumber: (phone: string) => void;
  profileAvatarPreview: string;
  profileSuccess: string | null;
  profileError: string | null;
  profileSaving: boolean;
  handleSaveProfile: (e: React.FormEvent) => void;
  handleAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ADMIN: { label: 'Quản trị viên', color: '#7c3aed', bg: '#f5f3ff' },
  TEACHER: { label: 'Giáo viên', color: '#0369a1', bg: '#e0f2fe' },
  STUDENT: { label: 'Học sinh', color: '#065f46', bg: '#d1fae5' },
};

export default function ProfileModal({
  open,
  onCancel,
  currentUser,
  profileFullName,
  setProfileFullName,
  profileEmail,
  setProfileEmail,
  profilePhoneNumber,
  setProfilePhoneNumber,
  profileAvatarPreview,
  profileSuccess,
  profileError,
  profileSaving,
  handleSaveProfile,
  handleAvatarChange
}: ProfileModalProps) {

  if (!currentUser) return null;

  const role = ROLE_CONFIG[currentUser.role] ?? { label: currentUser.role, color: '#64748b', bg: '#f1f5f9' };

  const avatarContent = profileAvatarPreview ? (
    <img src={profileAvatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
  ) : currentUser.avatar_url ? (
    <img src={currentUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
  ) : (
    <span className="text-3xl font-black text-white">
      {(profileFullName || currentUser.username).charAt(0).toUpperCase()}
    </span>
  );

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      width={480}
      footer={null}
      closable={false}
      className="profile-modal-premium"
      styles={{ content: { padding: 0, borderRadius: '24px', overflow: 'hidden', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' } }}
    >
      {/* ── HEADER HERO ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 50%, #1e3a8a 100%)',
          padding: '32px 32px 64px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative background gradients */}
        <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', filter: 'blur(10px)' }} />
        <div style={{ position: 'absolute', bottom: '-10px', left: '10px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', filter: 'blur(5px)' }} />

        <div className="flex items-start justify-between relative z-10">
          <div>
            <p className="text-blue-100/80 text-[10px] font-bold tracking-widest uppercase m-0 mb-1.5">Thông tin tài khoản</p>
            <h2 className="text-white text-2xl font-black m-0 leading-tight tracking-tight">
              {profileFullName || currentUser.username}
            </h2>
            <div className="flex items-center gap-2 mt-2.5">
              <span className="text-blue-200/90 text-xs font-semibold">@{currentUser.username}</span>
              <span
                className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
                style={{ background: 'rgba(255,255,255,0.2)', color: '#ffffff', backdropFilter: 'blur(4px)' }}
              >
                {role.label}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all text-xl font-light"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── AVATAR (overlapping header) ── */}
      <div className="flex justify-center" style={{ marginTop: '-48px', position: 'relative', zIndex: 10 }}>
        <div className="relative">
          <div
            className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center bg-white p-1"
            style={{
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
            }}
          >
            <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-blue-600">
              {avatarContent}
            </div>
          </div>
          <label
            className="absolute bottom-0.5 right-0.5 w-7.5 h-7.5 rounded-full cursor-pointer flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
            style={{ background: '#3b82f6', border: '3px solid white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
            title="Đổi ảnh đại diện"
          >
            <CameraOutlined style={{ fontSize: 11, color: 'white' }} />
            <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </label>
        </div>
      </div>

      {/* ── BODY ── */}
      <form onSubmit={handleSaveProfile} style={{ padding: '24px 32px 32px' }} className="space-y-6">

        {profileSuccess && <Alert message={profileSuccess} type="success" showIcon className="rounded-xl text-xs font-semibold" />}
        {profileError && <Alert message={profileError} type="error" showIcon className="rounded-xl text-xs font-semibold" />}

        <div className="space-y-4">
          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Họ và tên hiển thị</label>
            <Input
              prefix={<UserOutlined style={{ color: '#3b82f6' }} />}
              value={profileFullName}
              onChange={e => setProfileFullName(e.target.value)}
              placeholder="Nhập họ và tên đầy đủ..."
              size="large"
              style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Email liên hệ</label>
            <Input
              prefix={<MailOutlined style={{ color: '#3b82f6' }} />}
              type="email"
              value={profileEmail}
              onChange={e => setProfileEmail(e.target.value)}
              placeholder="Nhập địa chỉ email..."
              size="large"
              style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Số điện thoại</label>
            <Input
              prefix={<PhoneOutlined style={{ color: '#3b82f6' }} />}
              value={profilePhoneNumber}
              onChange={e => setProfilePhoneNumber(e.target.value)}
              placeholder="Nhập số điện thoại..."
              size="large"
              style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
            />
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex gap-3 justify-end pt-2 border-t border-gray-55/60">
          <Button onClick={onCancel} size="large" style={{ borderRadius: 12, fontWeight: 600 }}>
            Hủy bỏ
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            loading={profileSaving}
            style={{
              borderRadius: 12,
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              border: 'none',
              boxShadow: '0 4px 12px rgba(29,78,216,0.3)',
              fontWeight: 700,
            }}
          >
            Lưu thay đổi
          </Button>
        </div>
      </form>
    </Modal>
  );
}
