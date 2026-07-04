import React from 'react';
import { LessonPlan, User } from '../../utils/types';

interface HistoryTabProps {
  allLessonPlans: LessonPlan[];
  currentUser: User;
  debouncedSearchQuery: string;
  removeAccents: (s: string) => string;
  renderSnippet: (text: string, query: string) => React.ReactNode;
  setSelectedLessonForDetail: (l: LessonPlan) => void;
  setFocusLessonIdForChat: (id: number) => void;
  setChatbotOpenTrigger: React.Dispatch<React.SetStateAction<number>>;
  useAiRag: boolean;
  openEditModal: (l: LessonPlan) => void;
  handleWithdrawLesson: (id: number, action: 'retract' | 'delete') => void;
  setCurrentView: (v: 'home' | 'upload' | 'admin') => void;
}

export default function HistoryTab({
  allLessonPlans,
  currentUser,
  debouncedSearchQuery,
  removeAccents,
  renderSnippet,
  setSelectedLessonForDetail,
  setFocusLessonIdForChat,
  setChatbotOpenTrigger,
  useAiRag,
  openEditModal,
  handleWithdrawLesson,
  setCurrentView
}: HistoryTabProps) {
  const myLessons = allLessonPlans
    .filter(l => l.creator?.id === currentUser.id && l.status !== 'LOCAL')
    .filter(l => {
      const q = debouncedSearchQuery.trim().toLowerCase();
      if (!q) return true;
      const qClean = removeAccents(q);
      const title = (l.title || '').toLowerCase();
      const desc = (l.description || '').toLowerCase();
      const content = (l.content_preview || '').toLowerCase();
      return (
        title.includes(q) || desc.includes(q) || content.includes(q) ||
        removeAccents(title).includes(qClean) || removeAccents(desc).includes(qClean) || removeAccents(content).includes(qClean)
      );
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Lịch sử đóng góp của tôi</h2>
          <p className="text-sm text-gray-500 mt-1">Tất cả bài giảng bạn đã đăng tải lên hệ thống</p>
        </div>
        <span className="text-sm bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1.5 rounded-full font-semibold">
          {myLessons.length} bài giảng
        </span>
      </div>

      {myLessons.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <div className="text-5xl mb-4">📭</div>
          <p className="text-gray-500 font-medium">Bạn chưa đăng bài giảng nào.</p>
          <button onClick={() => setCurrentView('upload')} className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
            + Đăng bài giảng đầu tiên
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {myLessons.map(lesson => (
            <div key={lesson.id} className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${
              lesson.status === 'REJECTED' ? 'border-rose-200 bg-rose-50/20' :
              lesson.status === 'PENDING' ? 'border-amber-200 bg-amber-50/20' :
              lesson.status === 'PUBLISHED' ? 'border-emerald-200' : 'border-gray-200'
            }`}>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-grow min-w-0">
                  <h3 className="font-bold text-gray-900 text-base leading-snug">{lesson.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    📅 {new Date(lesson.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {lesson.status === 'PUBLISHED' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">✅ Đã duyệt & xuất bản</span>
                  )}
                  {lesson.status === 'PENDING' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 border border-amber-200 rounded-full text-xs font-bold animate-pulse">⏳ Đang chờ duyệt</span>
                  )}
                  {lesson.status === 'REJECTED' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-100 text-rose-700 border border-rose-200 rounded-full text-xs font-bold">❌ Bị từ chối</span>
                  )}
                </div>
              </div>

              {lesson.description && (
                <p className="text-sm text-gray-600 line-clamp-2 mb-3">{lesson.description}</p>
              )}

              {debouncedSearchQuery.trim() && renderSnippet(lesson.content_preview || '', debouncedSearchQuery)}

              {lesson.status === 'REJECTED' && lesson.latest_feedback && (
                <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                  <p className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-1">💬 Lý do từ chối:</p>
                  <p className="text-sm text-rose-800 leading-relaxed">{lesson.latest_feedback}</p>
                </div>
              )}

              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 flex-wrap">
                <button
                  onClick={() => setSelectedLessonForDetail(lesson)}
                  className="px-4 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors"
                >
                  ↗ Xem chi tiết
                </button>
                {useAiRag && (
                  <button
                    onClick={() => {
                      setFocusLessonIdForChat(lesson.id);
                      setChatbotOpenTrigger(prev => prev + 1);
                    }}
                    className="px-4 py-1.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-lg text-xs font-bold hover:bg-violet-100 transition-colors flex items-center gap-1 hover:scale-105 active:scale-95 duration-100"
                    title="Hỏi Trợ lý AI về bài học này"
                  >
                    ✨ Hỏi AI
                  </button>
                )}
                {lesson.status === 'REJECTED' && (
                  <button
                    onClick={() => openEditModal(lesson)}
                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm shadow-amber-200"
                  >
                    ✏ Sửa & Gửi duyệt lại
                  </button>
                )}
                {lesson.status !== 'REJECTED' && (
                  <button
                    onClick={() => openEditModal(lesson)}
                    className="px-4 py-1.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg text-xs font-semibold hover:bg-yellow-100 transition-colors"
                  >
                    ✏ Chỉnh sửa
                  </button>
                )}
                {lesson.status === 'PUBLISHED' && (
                  <button
                    onClick={() => handleWithdrawLesson(lesson.id, 'retract')}
                    title="Thu hồi về thư viện cá nhân"
                    className="px-4 py-1.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-lg text-xs font-semibold hover:bg-violet-100 transition-colors"
                  >
                    ↓ Thu hồi về cá nhân
                  </button>
                )}
                {lesson.status === 'PENDING' && (
                  <button
                    onClick={() => handleWithdrawLesson(lesson.id, 'retract')}
                    title="Hủy gửi duyệt, đưa về thư viện cá nhân"
                    className="px-4 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-xs font-semibold hover:bg-orange-100 transition-colors"
                  >
                    ↩ Hủy chờ duyệt
                  </button>
                )}

                <button
                  onClick={() => handleWithdrawLesson(lesson.id, 'delete')}
                  className="px-4 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors ml-auto"
                >
                  🗑 Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
