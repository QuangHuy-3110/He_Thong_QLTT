import React from 'react';
import { Modal } from 'antd';
import { Creator } from '../../utils/types';

interface CreatorProfileModalProps {
  open: boolean;
  onCancel: () => void;
  creator: Creator | null;
  getFileUrl: (path: string) => string;
}

export default function CreatorProfileModal({
  open,
  onCancel,
  creator,
  getFileUrl
}: CreatorProfileModalProps) {
  if (!open || !creator) return null;

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title="Thông tin người đóng góp"
      footer={null}
      centered
      className="rounded-3xl"
    >
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-650 flex items-center justify-center text-white text-2xl font-black shadow-md overflow-hidden">
          {creator.avatar_url ? (
            <img 
              src={getFileUrl(creator.avatar_url)} 
              alt="Avatar" 
              className="w-full h-full object-cover" 
            />
          ) : (
            (creator.full_name || creator.username || 'U').charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <h3 className="text-lg font-black text-gray-900">{creator.full_name || creator.username}</h3>
          <p className="text-xs text-gray-400 font-semibold mt-0.5">@{creator.username}</p>
        </div>
        <div className="w-full border-t border-gray-150 pt-4 mt-2 text-left space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400 font-medium">Họ và tên:</span>
            <span className="text-gray-800 font-bold">{creator.full_name || 'Không rõ'}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400 font-medium">Email liên hệ:</span>
            <span className="text-gray-800 font-bold">{creator.email || 'Chưa cập nhật'}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400 font-medium">Chức vụ:</span>
            <span className="text-gray-800 font-bold">
              {creator.role === 'ADMIN' 
                ? 'Quản trị viên' 
                : creator.role === 'TEACHER' 
                  ? 'Giáo viên' 
                  : creator.role === 'STUDENT' 
                    ? 'Học sinh' 
                    : 'Thành viên'}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
