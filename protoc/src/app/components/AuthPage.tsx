import { useState } from 'react';
import { useNavigate } from 'react-router';
import { BookOpen, User as UserIcon, Lock, Mail, ArrowRight } from 'lucide-react';
import { useAppContext, User } from '../context';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const { setCurrentUser } = useAppContext();
  const navigate = useNavigate();

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      alert('Vui lòng nhập đầy đủ thông tin!');
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
            <BookOpen className="w-8 h-8 text-white" />
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
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleAuth}>
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Họ và tên</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    required={!isLogin}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2.5 border"
                    placeholder="Nguyễn Văn A"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2.5 border"
                  placeholder="you@example.com"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">Mẹo: Dùng email có chứa "admin@" để làm Super Admin, hoặc "gv@" làm Folder Admin.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Mật khẩu</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2.5 border"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                {isLogin ? 'Đăng nhập' : 'Đăng ký'}
                <ArrowRight className="ml-2 w-4 h-4" />
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="w-full flex justify-center py-2.5 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                {isLogin ? 'Đăng ký tài khoản mới' : 'Quay lại đăng nhập'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
