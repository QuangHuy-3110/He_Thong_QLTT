import React from 'react';
import axios from 'axios';
import { LessonPlan, Directory, User } from '../../utils/types';
import { getDirectoriesAsTreeOptions } from '../../utils/directoryHelpers';

interface ProposePublicModalProps {
  open: boolean;
  onCancel: () => void;
  lesson: LessonPlan | null;
  directories: Directory[];
  targetPublicDirId: string;
  setTargetPublicDirId: (id: string) => void;
  proposeError: string | null;
  setProposeError: (err: string | null) => void;
  proposeDuplicateId: number | null;
  setProposeDuplicateId: (id: number | null) => void;
  onSubmit: (e: React.FormEvent) => void;
  currentUser: User | null;
  allLessonPlans: LessonPlan[];
  setSelectedLessonForDetail: (l: LessonPlan) => void;
  setCurrentView: (v: 'home' | 'upload' | 'admin') => void;
}

export default function ProposePublicModal({
  open,
  onCancel,
  lesson,
  directories,
  targetPublicDirId,
  setTargetPublicDirId,
  proposeError,
  setProposeError,
  proposeDuplicateId,
  setProposeDuplicateId,
  onSubmit,
  currentUser,
  allLessonPlans,
  setSelectedLessonForDetail,
  setCurrentView
}: ProposePublicModalProps) {
  if (!open || !lesson) return null;

  return (
    <div className="fixed z-50 inset-0 flex items-center justify-center p-3 bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl border border-gray-150">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <span className="p-1 bg-sky-50 text-sky-600 rounded-lg">🌐</span>
            Yêu cầu duyệt công khai tài liệu
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold"
          >
            &times;
          </button>
        </div>

        <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 mb-4">
          <span className="text-[10px] font-black text-sky-750 block uppercase tracking-wider mb-1">Tài liệu đề xuất:</span>
          <p className="text-sm font-bold text-gray-900 leading-snug">{lesson.title}</p>
          <p className="text-xs text-gray-400 mt-1">
            Hệ thống sẽ gửi yêu cầu phê duyệt tới Giáo viên/Admin phụ trách thư mục đích để thẩm định chất lượng.
          </p>
        </div>

        {proposeError && (
          <div className="mb-4 bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-700">
            <p className="text-xs font-black uppercase tracking-wider mb-1">⚠️ LƯU Ý TRÙNG LẶP:</p>
            <p className="text-xs leading-relaxed font-semibold">{proposeError}</p>
            {proposeDuplicateId && (
              <button
                type="button"
                onClick={() => {
                  onCancel();
                  setCurrentView('home');
                  const dupe = allLessonPlans.find(l => l.id === proposeDuplicateId);
                  if (dupe) {
                    setSelectedLessonForDetail(dupe);
                  } else {
                    axios.get(`/api/lesson-plans/${proposeDuplicateId}/?user_id=${currentUser?.id}`)
                      .then(res => { setSelectedLessonForDetail(res.data); })
                      .catch(() => alert("Không thể xem tài liệu trùng lặp."));
                  }
                }}
                className="mt-2.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-extrabold transition-all"
              >
                Xem tài liệu trùng lặp đang chờ duyệt ➔
              </button>
            )}
          </div>
        )}

        {!proposeDuplicateId ? (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Chọn thư mục công khai muốn đưa tài liệu vào:
              </label>
              <select
                required
                value={targetPublicDirId}
                onChange={e => setTargetPublicDirId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm font-mono focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Chọn thư mục công khai --</option>
                {getDirectoriesAsTreeOptions(directories, d => d.is_public).map(d => (
                  <option key={d.id} value={d.id}>
                    {d.visualPrefix}{d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!targetPublicDirId}
                className="px-4 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                Gửi đề xuất
              </button>
            </div>
          </form>
        ) : (
          <div className="flex justify-end mt-6 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-755 rounded-lg text-sm font-bold shadow-sm transition-colors"
            >
              Đóng cửa sổ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
