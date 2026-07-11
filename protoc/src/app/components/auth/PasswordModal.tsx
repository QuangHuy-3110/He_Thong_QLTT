import React from 'react';
import { Modal, Input, Button, Alert } from 'antd';
import { 
  LockOutlined
} from '@ant-design/icons';
import { User } from '../../context';

interface PasswordModalProps {
  open: boolean;
  onCancel: () => void;
  currentUser: User | null;
  profileNewPassword: string;
  setProfileNewPassword: (p: string) => void;
  profileConfirmNewPassword: string;
  setProfileConfirmNewPassword: (p: string) => void;
  profileCurrentPassword: string;
  setProfileCurrentPassword: (p: string) => void;
  profileSuccess: string | null;
  profileError: string | null;
  profileSaving: boolean;
  handleSaveProfile: (e: React.FormEvent) => void;
}

export default function PasswordModal({
  open,
  onCancel,
  currentUser,
  profileNewPassword,
  setProfileNewPassword,
  profileConfirmNewPassword,
  setProfileConfirmNewPassword,
  profileCurrentPassword,
  setProfileCurrentPassword,
  profileSuccess,
  profileError,
  profileSaving,
  handleSaveProfile
}: PasswordModalProps) {

  if (!currentUser) return null;

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      width={440}
      footer={null}
      closable={false}
      className="password-modal-premium"
      styles={{ content: { padding: 0, borderRadius: '24px', overflow: 'hidden', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' } }}
    >
      {/* HEADER */}
      <div
        style={{
          background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
          padding: '28px 28px 32px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative elements */}
        <div style={{ position: 'absolute', top: '-15px', right: '-15px', width: '90px', height: '90px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', filter: 'blur(5px)' }} />

        <div className="flex items-start justify-between relative z-10">
          <div>
            <p className="text-red-100/80 text-[10px] font-bold tracking-widest uppercase m-0 mb-1.5">Bảo mật & Xác thực</p>
            <h2 className="text-white text-xl font-black m-0 leading-tight tracking-tight">
              Thay đổi mật khẩu
            </h2>
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

      {/* FORM */}
      <form onSubmit={handleSaveProfile} style={{ padding: '28px' }} className="space-y-5">
        {profileSuccess && <Alert message={profileSuccess} type="success" showIcon className="rounded-xl text-xs font-semibold" />}
        {profileError   && <Alert message={profileError}   type="error"   showIcon className="rounded-xl text-xs font-semibold" />}

        <div className="space-y-4">
          {/* Mật khẩu hiện tại */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
              Mật khẩu hiện tại <span className="text-red-500">*</span>
            </label>
            <Input.Password
              prefix={<LockOutlined style={{ color: '#ef4444' }} />}
              value={profileCurrentPassword}
              onChange={e => setProfileCurrentPassword(e.target.value)}
              placeholder="Nhập mật khẩu cũ..."
              size="large"
              autoComplete="new-password"
              style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
            />
          </div>

          <div style={{ borderTop: '1px dashed #e2e8f0', margin: '16px 0' }} />

          {/* Mật khẩu mới */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
              Mật khẩu mới <span className="text-red-500">*</span>
            </label>
            <Input.Password
              prefix={<LockOutlined style={{ color: '#64748b' }} />}
              value={profileNewPassword}
              onChange={e => setProfileNewPassword(e.target.value)}
              placeholder="Nhập mật khẩu mới..."
              size="large"
              autoComplete="new-password"
              style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
            />
          </div>

          {/* Xác nhận mật khẩu mới */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
              Xác nhận mật khẩu mới <span className="text-red-500">*</span>
            </label>
            <Input.Password
              prefix={<LockOutlined style={{ color: '#64748b' }} />}
              value={profileConfirmNewPassword}
              onChange={e => setProfileConfirmNewPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới..."
              size="large"
              autoComplete="new-password"
              style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end pt-2 border-t border-gray-55/60">
          <Button onClick={onCancel} size="large" style={{ borderRadius: 12, fontWeight: 600 }}>
            Hủy bỏ
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            loading={profileSaving}
            disabled={!profileCurrentPassword || !profileNewPassword || !profileConfirmNewPassword}
            style={{
              borderRadius: 12,
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              border: 'none',
              boxShadow: '0 4px 12px rgba(220,38,38,0.3)',
              fontWeight: 700,
            }}
          >
            Cập nhật mật khẩu
          </Button>
        </div>
      </form>
    </Modal>
  );
}
