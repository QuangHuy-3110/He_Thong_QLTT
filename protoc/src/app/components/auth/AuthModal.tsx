import React from 'react';
import { Modal, Input, Button, Form, Select, Alert, Space } from 'antd';
import { 
  UserOutlined, 
  LockOutlined, 
  MailOutlined, 
  SafetyCertificateOutlined,
  KeyOutlined,
  InfoCircleOutlined,
  UnlockOutlined
} from '@ant-design/icons';

interface AuthModalProps {
  open: boolean;
  onCancel: () => void;
  authMode: 'LOGIN' | 'REGISTER' | 'FIND_ACCOUNT' | 'FORGOT_PASSWORD';
  setAuthMode: (mode: 'LOGIN' | 'REGISTER' | 'FIND_ACCOUNT' | 'FORGOT_PASSWORD') => void;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  
  username: string;
  setUsername: (u: string) => void;
  password: string;
  setPassword: (p: string) => void;
  fullName: string;
  setFullName: (n: string) => void;
  email: string;
  setEmail: (e: string) => void;
  identity: string;
  setIdentity: (i: string) => void;
  foundAccount: any;
  setFoundAccount: (a: any) => void;
  resetResult: any;
  setResetResult: (r: any) => void;
  otpCode: string;
  setOtpCode: (c: string) => void;
  otpNewPassword: string;
  setOtpNewPassword: (p: string) => void;
  otpConfirmPassword: string;
  setOtpConfirmPassword: (p: string) => void;
  otpCountdown: number;
  

  handleLogin: (e: React.FormEvent) => void;
  handleRegister: (e: React.FormEvent) => void;
  handleFindAccount: (e: React.FormEvent) => void;
  handleForgotPassword: (e: React.FormEvent) => void;
  handleVerifyOtpAndReset: (e: React.FormEvent) => void;
  handleResendOtp: () => void;

  showKeycloakMockModal: boolean;
  setShowKeycloakMockModal: (s: boolean) => void;
  kcUsername: string;
  setKcUsername: (u: string) => void;
  kcFullName: string;
  setKcFullName: (n: string) => void;
  kcEmail: string;
  setKcEmail: (e: string) => void;
  kcRole: 'ADMIN' | 'TEACHER' | 'USER';
  setKcRole: (r: 'ADMIN' | 'TEACHER' | 'USER') => void;
  handleKeycloakMockLogin: (e: React.FormEvent) => void;
}

export default function AuthModal({
  open,
  onCancel,
  authMode,
  setAuthMode,
  authError,
  setAuthError,
  username,
  setUsername,
  password,
  setPassword,
  fullName,
  setFullName,
  email,
  setEmail,
  identity,
  setIdentity,
  foundAccount,
  setFoundAccount,
  resetResult,
  setResetResult,
  otpCode,
  setOtpCode,
  otpNewPassword,
  setOtpNewPassword,
  otpConfirmPassword,
  setOtpConfirmPassword,
  otpCountdown,
  handleLogin,
  handleRegister,
  handleFindAccount,
  handleForgotPassword,
  handleVerifyOtpAndReset,
  handleResendOtp,
  showKeycloakMockModal,
  setShowKeycloakMockModal,
  kcUsername,
  setKcUsername,
  kcFullName,
  setKcFullName,
  kcEmail,
  setKcEmail,
  kcRole,
  setKcRole,
  handleKeycloakMockLogin
}: AuthModalProps) {

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <>
      {/* Local Credentials Auth Modal */}
      <Modal
        open={open && !showKeycloakMockModal}
        onCancel={onCancel}
        footer={null}
        width={400}
        closable={false}
        styles={{ content: { padding: 0, borderRadius: '24px', overflow: 'hidden' } }}
      >
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-center text-white">
          <span className="text-3xl block mb-2">🔐</span>
          <h3 className="text-lg font-bold text-white m-0">Xác thực hệ thống KMS</h3>
          <p className="text-xs text-blue-100/80 mt-1">Cổng đăng nhập và quản lý tài khoản</p>
        </div>

        <div className="p-6">
          {authError && (
            <Alert
              message={authError}
              type={authError.includes('thành công') ? 'success' : 'error'}
              showIcon
              className="mb-4 rounded-xl"
            />
          )}

          {authMode === 'LOGIN' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">Tên đăng nhập</label>
                <Input
                  prefix={<UserOutlined className="text-gray-400" />}
                  placeholder="Tên đăng nhập của bạn..."
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  size="large"
                  className="rounded-xl"
                />
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">Mật khẩu</label>
                <Input.Password
                  prefix={<LockOutlined className="text-gray-400" />}
                  placeholder="Mật khẩu của bạn..."
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  size="large"
                  className="rounded-xl"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  block
                  className="bg-blue-600 hover:bg-blue-700 border-none rounded-xl h-11 text-sm font-bold shadow-md shadow-blue-500/10"
                >
                  Đăng nhập
                </Button>
              </div>

              <div className="flex justify-between items-center text-xs font-bold text-blue-600 border-t border-gray-100 pt-4 mt-2">
                <Button type="link" onClick={() => { setAuthMode('REGISTER'); setAuthError(null); }} className="p-0 text-xs">Đăng ký mới</Button>
                <Button type="link" onClick={() => { setAuthMode('FIND_ACCOUNT'); setAuthError(null); setFoundAccount(null); setIdentity(''); }} className="p-0 text-xs">Tìm tài khoản</Button>
                <Button type="link" danger onClick={() => { setAuthMode('FORGOT_PASSWORD'); setAuthError(null); setResetResult(null); setIdentity(''); }} className="p-0 text-xs">Quên mật khẩu?</Button>
              </div>

              <div className="pt-2 border-t border-gray-100 text-center">
                <Button
                  type="link"
                  size="small"
                  className="text-gray-400 hover:text-gray-600 text-[10px]"
                  onClick={() => {
                    setShowKeycloakMockModal(true);
                  }}
                >
                  🧪 Chạy Giả lập Keycloak Offline
                </Button>
              </div>
            </form>
          )}

          {authMode === 'REGISTER' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">Họ và tên</label>
                <Input
                  prefix={<UserOutlined className="text-gray-400" />}
                  placeholder="Nguyễn Văn A"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">Email</label>
                <Input
                  prefix={<MailOutlined className="text-gray-400" />}
                  type="email"
                  placeholder="email@school.edu.vn"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">Tên đăng nhập</label>
                <Input
                  prefix={<UserOutlined className="text-gray-400" />}
                  placeholder="Username đăng nhập..."
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">Mật khẩu</label>
                <Input.Password
                  prefix={<LockOutlined className="text-gray-400" />}
                  placeholder="Mật khẩu tài khoản..."
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="rounded-lg"
                />
              </div>
              <div className="pt-2 space-y-2">
                <Button type="primary" htmlType="submit" block className="rounded-lg bg-blue-600 hover:bg-blue-700 h-10 font-bold">
                  Tạo tài khoản mới
                </Button>
                <Button type="link" block onClick={() => { setAuthMode('LOGIN'); setAuthError(null); }} className="text-xs">
                  Đã có tài khoản? Đăng nhập
                </Button>
              </div>
            </form>
          )}

          {authMode === 'FIND_ACCOUNT' && (
            <form onSubmit={handleFindAccount} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">Tên đăng nhập, Email hoặc SĐT</label>
                <Input
                  placeholder="Nhập username, email hoặc SĐT..."
                  value={identity}
                  onChange={e => setIdentity(e.target.value)}
                  className="rounded-lg"
                />
              </div>
              {foundAccount && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-800 space-y-1">
                  <p className="font-bold border-b border-emerald-200 pb-1 mb-1">🔍 Kết quả tìm kiếm:</p>
                  <p><strong>Họ tên:</strong> {foundAccount.full_name || 'N/A'}</p>
                  <p><strong>Username:</strong> {foundAccount.username}</p>
                  {foundAccount.email_masked && <p><strong>Email:</strong> {foundAccount.email_masked}</p>}
                  {foundAccount.phone_masked && <p><strong>SĐT:</strong> {foundAccount.phone_masked}</p>}
                  <p><strong>Vai trò:</strong> {foundAccount.role}</p>
                  <p><strong>Trạng thái:</strong> {foundAccount.is_active ? '🔓 Hoạt động' : '🔒 Đã khóa'}</p>
                </div>
              )}
              <div className="pt-2 space-y-2">
                <Button type="primary" htmlType="submit" block className="rounded-lg bg-blue-600 hover:bg-blue-700 h-10 font-bold">
                  Tìm kiếm tài khoản
                </Button>
                <Button type="link" block onClick={() => { setAuthMode('LOGIN'); setAuthError(null); setFoundAccount(null); }} className="text-xs">
                  Quay lại Đăng nhập
                </Button>
              </div>
            </form>
          )}

          {authMode === 'FORGOT_PASSWORD' && (
            <div className="space-y-4">
              {!resetResult ? (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">Tên đăng nhập, Email hoặc SĐT</label>
                    <Input
                      placeholder="Nhập username, email hoặc SĐT..."
                      value={identity}
                      onChange={e => setIdentity(e.target.value)}
                      className="rounded-lg"
                    />
                  </div>
                  <Button type="primary" htmlType="submit" block className="rounded-lg bg-blue-600 hover:bg-blue-700 h-10 font-bold">
                    Gửi mã xác thực OTP
                  </Button>
                  <Button type="link" block onClick={() => { setAuthMode('LOGIN'); setAuthError(null); }} className="text-xs text-center">
                    Quay lại Đăng nhập
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtpAndReset} className="space-y-4">
                  <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-xs text-sky-850">
                    <p className="font-bold flex items-center gap-1">
                      <InfoCircleOutlined /> Mã OTP giả lập đã gửi:
                    </p>
                    <p className="text-base font-black text-center text-blue-600 my-1 bg-white p-2 rounded-lg tracking-widest">{resetResult.otp_mock}</p>
                    <p className="text-[10px] text-gray-400">Dùng mã 6 số này để tiến hành cập nhật mật khẩu mới.</p>
                  </div>
                  
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">Mã xác thực OTP (6 số)</label>
                    <Input
                      placeholder="Nhập 6 số..."
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value)}
                      maxLength={6}
                      className="rounded-lg text-center font-bold tracking-wider"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">Mật khẩu mới</label>
                    <Input.Password
                      placeholder="Nhập mật khẩu mới..."
                      value={otpNewPassword}
                      onChange={e => setOtpNewPassword(e.target.value)}
                      className="rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">Xác nhận mật khẩu mới</label>
                    <Input.Password
                      placeholder="Xác nhận mật khẩu mới..."
                      value={otpConfirmPassword}
                      onChange={e => setOtpConfirmPassword(e.target.value)}
                      className="rounded-lg"
                    />
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    {otpCountdown > 0 ? (
                      <span className="text-gray-400">Gửi lại mã sau {formatCountdown(otpCountdown)}</span>
                    ) : (
                      <Button type="link" onClick={handleResendOtp} className="p-0 text-xs">Gửi lại mã OTP</Button>
                    )}
                  </div>

                  <Button type="primary" htmlType="submit" block className="rounded-lg bg-blue-600 hover:bg-blue-700 h-10 font-bold">
                    Cập nhật mật khẩu
                  </Button>
                  
                  <Button type="link" block onClick={() => { setAuthMode('FORGOT_PASSWORD'); setResetResult(null); setAuthError(null); }} className="text-xs text-center text-gray-500">
                    Quay lại bước trước
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Keycloak SSO Mock Modal */}
      <Modal
        title={<span className="text-lg font-bold text-gray-800 flex items-center gap-2"><SafetyCertificateOutlined className="text-red-500" /> Cổng SSO Giả lập (Keycloak)</span>}
        open={showKeycloakMockModal}
        onCancel={() => setShowKeycloakMockModal(false)}
        footer={null}
        width={420}
        className="rounded-xl overflow-hidden"
      >
        <div className="py-4 space-y-4">
          <Alert
            message="Chế độ giả lập Keycloak Offline"
            description="Cho phép chạy và đăng nhập nhanh không cần kết nối Server SSO thật ngoài internet."
            type="warning"
            showIcon
          />

          <form onSubmit={handleKeycloakMockLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Username (Keycloak)</label>
              <Input
                prefix={<UserOutlined />}
                value={kcUsername}
                onChange={e => setKcUsername(e.target.value)}
                className="rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Họ và tên</label>
              <Input
                prefix={<UserOutlined />}
                value={kcFullName}
                onChange={e => setKcFullName(e.target.value)}
                className="rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Email</label>
              <Input
                prefix={<MailOutlined />}
                type="email"
                value={kcEmail}
                onChange={e => setKcEmail(e.target.value)}
                className="rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Vai trò hệ thống</label>
              <Select
                className="w-full"
                value={kcRole}
                onChange={val => setKcRole(val)}
                options={[
                  { value: 'ADMIN', label: 'Quản trị viên (ADMIN)' },
                  { value: 'TEACHER', label: 'Giáo viên (TEACHER)' },
                  { value: 'USER', label: 'Người dùng thường (USER)' }
                ]}
              />
            </div>

            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              icon={<UnlockOutlined />}
              className="bg-red-650 hover:bg-red-700 border-none rounded-lg font-bold"
            >
              Đồng bộ & Đăng nhập ngay
            </Button>
            
            <Button
              type="link"
              block
              onClick={() => {
                setShowKeycloakMockModal(false);
                setAuthMode('LOGIN');
              }}
              className="text-xs text-center"
            >
              Quay lại Đăng nhập thường
            </Button>
          </form>
        </div>
      </Modal>
    </>
  );
}
