import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { BookOutlined, UserOutlined, LockOutlined, MailOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useAppContext, User } from '../../context';
import { Card, Form, Input, Button, message } from 'antd';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const { setCurrentUser } = useAppContext();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const handleAuth = (values: any) => {
    const { email, password, name } = values;

    if (!email || !password) {
      message.error('Vui lòng nhập đầy đủ thông tin!');
      return;
    }

    // Mock Authentication Logic
    let role: User['role'] = 'user';
    let allowedFolders: string[] = [];
    
    // Quick testing logic based on email
    if (email.includes('admin@')) {
      role = 'super_admin';
      allowedFolders = ['root'];
    } else if (email.includes('gv@') || email.includes('giaovien@')) {
      role = 'folder_admin';
      allowedFolders = ['thuc_vat', 'vi_sinh_vat'];
    }

    const user: User = {
      id: `u${Date.now()}`,
      name: isLogin ? (email.split('@')[0] || 'User') : name,
      email,
      role,
      allowedFolders
    };

    setCurrentUser(user);
    message.success(isLogin ? 'Đăng nhập thành công!' : 'Đăng ký thành công!');
    
    // Redirect based on role
    if (role === 'super_admin' || role === 'folder_admin') {
      navigate('/');
    } else {
      navigate('/workspace');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
            <BookOutlined className="text-white text-3xl" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Edu-RAG System
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {isLogin ? 'Đăng nhập để truy cập không gian của bạn' : 'Tạo tài khoản mới'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="shadow-lg rounded-2xl border-gray-100/50 p-2">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleAuth}
            requiredMark={false}
            className="space-y-4"
          >
            {!isLogin && (
              <Form.Item
                label={<span className="text-sm font-medium text-gray-700">Họ và tên</span>}
                name="name"
                rules={[{ required: !isLogin, message: 'Vui lòng nhập họ tên!' }]}
              >
                <Input
                  prefix={<UserOutlined className="text-gray-400" />}
                  placeholder="Nguyễn Văn A"
                  size="large"
                  className="rounded-lg"
                />
              </Form.Item>
            )}

            <Form.Item
              label={<span className="text-sm font-medium text-gray-700">Email</span>}
              name="email"
              rules={[
                { required: true, message: 'Vui lòng nhập Email!' },
                { type: 'email', message: 'Email không hợp lệ!' }
              ]}
              extra={<span className="text-xs text-gray-400 block mt-1">Mẹo: Dùng email có chứa "admin@" để làm Super Admin, hoặc "gv@" làm Folder Admin.</span>}
            >
              <Input
                prefix={<MailOutlined className="text-gray-400" />}
                placeholder="you@example.com"
                size="large"
                className="rounded-lg"
              />
            </Form.Item>

            <Form.Item
              label={<span className="text-sm font-medium text-gray-700">Mật khẩu</span>}
              name="password"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-gray-400" />}
                placeholder="••••••••"
                size="large"
                className="rounded-lg"
              />
            </Form.Item>

            <Form.Item className="pt-2">
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                className="rounded-lg bg-blue-600 hover:bg-blue-700 border-none h-11 flex items-center justify-center font-semibold text-white shadow-sm"
              >
                <span>{isLogin ? 'Đăng nhập' : 'Đăng ký'}</span>
                <ArrowRightOutlined className="ml-2" />
              </Button>
            </Form.Item>
          </Form>

          <div className="mt-6 border-t border-gray-100 pt-6">
            <div className="text-center text-sm text-gray-500 mb-4">
              {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
            </div>
            <Button
              onClick={() => {
                setIsLogin(!isLogin);
                form.resetFields();
              }}
              size="large"
              block
              className="rounded-lg border-gray-300 hover:border-blue-500 text-gray-700 hover:text-blue-600 h-11"
            >
              {isLogin ? 'Đăng ký tài khoản mới' : 'Quay lại đăng nhập'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
