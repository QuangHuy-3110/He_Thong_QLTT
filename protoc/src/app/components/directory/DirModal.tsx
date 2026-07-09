import React from 'react';
import { User } from '../../utils/types';

interface DirModalProps {
  open: boolean;
  onClose: () => void;
  currentUser: User | null;
  dirName: string;
  setDirName: (name: string) => void;
  dirIsPublic: boolean;
  setDirIsPublic: (pub: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  homeTab?: string;
}

export default function DirModal({
  open,
  onClose,
  currentUser,
  dirName,
  setDirName,
  dirIsPublic,
  setDirIsPublic,
  onSubmit,
  homeTab
}: DirModalProps) {
  if (!open) return null;

  return (
    <div className="fixed z-50 inset-0 flex items-center justify-center p-3 bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-gray-150 transform transition-all scale-100">
        <h3 className="text-lg font-black text-gray-900 mb-2 flex items-center gap-2">
          <span className="p-1 bg-blue-50 text-blue-600 rounded-lg">📁</span>
          Tạo thư mục mới
        </h3>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Tên thư mục</label>
            <input
              type="text"
              required
              value={dirName}
              onChange={e => setDirName(e.target.value)}
              placeholder="Nhập tên thư mục..."
              className="w-full bg-gray-50 border border-gray-250 rounded-xl px-4 py-2.5 text-sm text-gray-950 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
            />
          </div>

          {currentUser?.role === 'ADMIN' && homeTab !== 'personal' && (
            <div className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                id="dir-is-public"
                checked={dirIsPublic}
                onChange={e => setDirIsPublic(e.target.checked)}
                className="rounded text-blue-600 border-gray-300 focus:ring-blue-500 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="dir-is-public" className="text-xs font-bold text-gray-650 cursor-pointer select-none">
                Công khai với tất cả thành viên (Public)
              </label>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-250 hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-500 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-650 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-colors shadow-md shadow-blue-150"
            >
              Xác nhận tạo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
