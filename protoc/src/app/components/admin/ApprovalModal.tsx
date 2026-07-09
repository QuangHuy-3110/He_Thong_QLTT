import React, { useEffect, useState } from 'react';
import axios from 'axios';
import DocxPreview from '../viewer/DocxPreview';
import MarkdownViewer from '../viewer/MarkdownViewer';
import { getFallbackApiBase, getLessonFileUrl, getFileName } from '../../utils/helpers';
import { User, Directory, LessonPlan } from '../../utils/types';

interface ApprovalModalProps {
  open: boolean;
  onCancel: () => void;
  currentUser: User | null;
  directories: Directory[];
  allLessonPlans: LessonPlan[];
  fetchLessonPlans: (query?: string) => Promise<void>;
  setSelectedLessonForDetail: (lesson: LessonPlan | null) => void;
  pendingApprovals: any[];
  setPendingApprovals: React.Dispatch<React.SetStateAction<any[]>>;
  allEditHistories: any[];
  setAllEditHistories: React.Dispatch<React.SetStateAction<any[]>>;
  loadingPendingApprovals: boolean;
  loadingEditHistories: boolean;
  fetchPendingApprovals: (force?: boolean) => Promise<void>;
  fetchAllEditHistories: (force?: boolean) => Promise<void>;
}

export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  open,
  onCancel,
  currentUser,
  directories,
  allLessonPlans,
  fetchLessonPlans,
  setSelectedLessonForDetail,
  pendingApprovals,
  setPendingApprovals,
  allEditHistories,
  setAllEditHistories,
  loadingPendingApprovals,
  loadingEditHistories,
  fetchPendingApprovals,
  fetchAllEditHistories
}) => {
  const [approvalActiveTab, setApprovalActiveTab] = useState<'pending' | 'history'>('pending');
  const [selectedApproval, setSelectedApproval] = useState<any | null>(null);
  const [selectedEditHistory, setSelectedEditHistory] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [editHistoryFeedback, setEditHistoryFeedback] = useState<string>('');

  const handleActionApproval = async (reqId: number, action: 'APPROVE' | 'REJECT', currentFeedback: string = '') => {
    if (!currentUser) return;
    try {
      await axios.patch(`/api/approval-requests/${reqId}/`, {
        user_id: currentUser.id,
        action: action,
        feedback: currentFeedback
      });
      alert(action === 'APPROVE' ? 'Đã duyệt bài giảng thành công!' : 'Đã từ chối bài giảng!');
      setSelectedApproval(null);
      setFeedback('');
      fetchPendingApprovals(true);
      fetchLessonPlans(); // Refresh list
    } catch (err) {
      alert('Lỗi xét duyệt bài giảng.');
    }
  };

  const handleActionEditHistory = async (histId: number, action: 'APPROVE' | 'REJECT', feedbackText: string = '') => {
    if (!currentUser) return;
    try {
      const res = await axios.patch(`/api/lesson-plans/edit-histories/${histId}/review/`, {
        user_id: currentUser.id,
        action: action,
        feedback: feedbackText
      });
      // Update only the specific record in state
      setAllEditHistories(prev =>
        prev.map(h => (h.id === histId ? res.data : h))
      );
      setSelectedEditHistory((prev: any) =>
        prev && prev.id === histId ? res.data : prev
      );
      alert(action === 'APPROVE' ? 'Đã duyệt chỉnh sửa thành công!' : 'Đã từ chối chỉnh sửa tài liệu!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Lỗi khi xét duyệt lịch sử chỉnh sửa.');
    }
  };

  useEffect(() => {
    if (open) {
      fetchPendingApprovals(false);
      fetchAllEditHistories(false);
    }
  }, [open, currentUser, fetchPendingApprovals, fetchAllEditHistories]);

  if (!open) return null;

  return (
    <div className="fixed z-50 inset-0 flex items-center justify-center p-3 bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl overflow-hidden border border-gray-100 flex flex-col" style={{ height: '92vh' }}>
        {/* Modal Header */}
        <div className="bg-amber-700 text-white px-6 py-4 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛡️</span>
            <div>
              <h3 className="text-xl font-bold">Xét duyệt & Lịch sử thay đổi</h3>
              <p className="text-amber-200 text-xs mt-0.5">Duyệt bài giảng mới hoặc đối chiếu các phiên bản lịch sử chỉnh sửa bài giảng</p>
            </div>
          </div>
          <button
            onClick={() => { onCancel(); setSelectedApproval(null); setSelectedEditHistory(null); }}
            className="text-white hover:text-amber-100 text-2xl transition-colors font-bold"
          >
            &times;
          </button>
        </div>

        {/* Tab Navigation & Refresh */}
        <div className="flex justify-between items-center border-b border-gray-150 px-6 bg-gray-50 flex-shrink-0">
          <div className="flex">
            <button
              type="button"
              onClick={() => setApprovalActiveTab('pending')}
              className={`px-6 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                approvalActiveTab === 'pending'
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📂 Yêu cầu chờ duyệt ({pendingApprovals.length})
            </button>
            <button
              type="button"
              onClick={() => setApprovalActiveTab('history')}
              className={`px-6 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                approvalActiveTab === 'history'
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📜 Lịch sử chỉnh sửa ({allEditHistories.length})
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              fetchPendingApprovals(true);
              fetchAllEditHistories(true);
            }}
            disabled={loadingPendingApprovals || loadingEditHistories}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
          >
            <span className={`inline-block ${(loadingPendingApprovals || loadingEditHistories) ? 'animate-spin' : ''}`}>🔄</span>
            Làm mới
          </button>
        </div>

        {/* Modal Body — 2 columns */}
        <div className="flex flex-row flex-grow overflow-hidden min-h-0">
          {approvalActiveTab === 'pending' ? (
            <>
              {/* LEFT: Request list */}
              <div className={`w-full lg:w-80 flex-shrink-0 lg:border-r border-gray-100 flex flex-col overflow-hidden ${selectedApproval ? 'hidden lg:flex' : 'flex'}`}>
                <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                  <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Chờ duyệt ({pendingApprovals.length})
                  </h4>
                </div>
                <div className="overflow-y-auto flex-grow p-3 space-y-2 relative min-h-[150px]">
                  {loadingPendingApprovals && pendingApprovals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-gray-500 gap-2 absolute inset-0 bg-white/70">
                      <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs font-semibold">Đang tải yêu cầu...</span>
                    </div>
                  ) : pendingApprovals.length === 0 ? (
                    <p className="text-sm text-gray-400 italic py-8 text-center">Không có bài giảng nào đang chờ duyệt.</p>
                  ) : (
                    pendingApprovals.map((req: any) => {
                      const isSelected = selectedApproval && selectedApproval.id === req.id;
                      return (
                        <div
                          key={req.id}
                          onClick={() => { setSelectedApproval(req); setFeedback(req.feedback || ''); }}
                          className={`p-3 rounded-xl border transition-all cursor-pointer ${isSelected
                              ? 'border-amber-500 bg-amber-50 shadow-sm'
                              : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/30'
                            }`}
                        >
                          <p className="font-semibold text-gray-900 text-sm truncate">{req.lesson_plan_title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">👤 {req.requester_name || 'Người dùng'}</p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 text-gray-600 border border-gray-200 rounded text-[10px] font-medium truncate max-w-[140px]">
                              📁 {req.target_directory_name}
                            </span>
                            <span className="text-[10px] text-gray-400 flex-shrink-0">
                              {new Date(req.created_at).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* RIGHT: Detail + Preview */}
              <div className={`flex-grow flex flex-col overflow-hidden min-w-0 ${selectedApproval ? 'flex' : 'hidden lg:flex'}`}>
                {selectedApproval ? (
                  <>
                    {/* Info section (scrollable) */}
                    <div className="flex-grow overflow-y-auto p-5 space-y-4">
                      {/* Mobile Back Button */}
                      <button
                        onClick={() => setSelectedApproval(null)}
                        className="lg:hidden mb-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold flex items-center gap-1.5 self-start cursor-pointer border border-gray-200"
                      >
                        ← Quay lại danh sách
                      </button>
                      {/* Title & meta */}
                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Chi tiết yêu cầu xét duyệt</p>
                        <h5 className="font-bold text-gray-900 text-lg leading-snug">{selectedApproval.lesson_plan_title}</h5>
                        <p className="text-sm text-gray-500 mt-1">
                          Gửi bởi: <strong className="text-gray-700">{selectedApproval.requester_name}</strong>
                          {' '}vào thư mục <strong className="text-gray-700">{selectedApproval.target_directory_name}</strong>
                          {' '}· {new Date(selectedApproval.created_at).toLocaleDateString('vi-VN')}
                        </p>
                      </div>

                      {/* Info grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white border border-gray-100 rounded-xl p-3">
                          <p className="text-xs text-gray-400 font-medium mb-1">Đối tượng giảng dạy</p>
                          <p className="text-sm font-semibold text-gray-800">{selectedApproval.lesson_plan_target_student || 'Không rõ'}</p>
                        </div>
                        <div className="bg-white border border-gray-100 rounded-xl p-3">
                          <p className="text-xs text-gray-400 font-medium mb-1">Ngày gửi duyệt</p>
                          <p className="text-sm font-semibold text-gray-800">{new Date(selectedApproval.created_at).toLocaleString('vi-VN')}</p>
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <h6 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Mô tả bài giảng</h6>
                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100 whitespace-pre-line leading-relaxed">
                          {selectedApproval.lesson_plan_description || 'Không có mô tả.'}
                        </p>
                      </div>

                      {/* Attributes */}
                      {selectedApproval.lesson_plan_attributes && Object.keys(selectedApproval.lesson_plan_attributes).filter(k => k !== 'knowledge_tags').length > 0 && (
                        <div>
                          <h6 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Thông tin bổ sung</h6>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(selectedApproval.lesson_plan_attributes)
                              .filter(([k]) => k !== 'knowledge_tags')
                              .map(([key, val]) => (
                                <span key={key} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-100">
                                  {key}: {String(val)}
                                </span>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Knowledge tags */}
                      {selectedApproval.lesson_plan_attributes?.knowledge_tags?.length > 0 && (
                        <div>
                          <h6 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Kiến thức môn học</h6>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedApproval.lesson_plan_attributes.knowledge_tags.map((tag: string) => (
                              <span key={tag} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium border border-indigo-100">
                                ⚡ {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* File preview */}
                      {selectedApproval.lesson_plan_file_url && (() => {
                        const fileUrl = selectedApproval.lesson_plan_file_url;
                        const isDocx = fileUrl.toLowerCase().endsWith('.docx') || fileUrl.toLowerCase().endsWith('.doc');
                        const isPdf = fileUrl.toLowerCase().endsWith('.pdf');
                        if (isPdf) {
                          return (
                            <div className="h-[50vh] border border-gray-200 rounded-xl overflow-hidden mt-3">
                              <iframe src={fileUrl} className="w-full h-full border-none" title="PDF Preview" />
                            </div>
                          );
                        }
                        if (isDocx) {
                          return (
                            <div className="mt-3 bg-white border border-gray-150 rounded-xl p-1 shadow-inner">
                              <DocxPreview fileUrl={fileUrl} />
                            </div>
                          );
                        }
                        return (
                          <div className="mt-3">
                            <MarkdownViewer markdown={selectedApproval.lesson_plan_content_preview} />
                          </div>
                        );
                      })()}
                    </div>

                    {/* Action Bar (sticky bottom) */}
                    <div className="border-t border-gray-150 bg-slate-50 px-5 py-4 flex flex-col gap-3 flex-shrink-0">
                      <div>
                        <label className="block text-xs font-extrabold text-gray-500 uppercase mb-1.5 tracking-wider">Ý kiến phản hồi / Nhận xét của người duyệt:</label>
                        <textarea
                          rows={2}
                          value={feedback}
                          onChange={e => setFeedback(e.target.value)}
                          placeholder="Nhập nhận xét hoặc lý do từ chối (bắt buộc nếu từ chối)..."
                          className="w-full bg-white border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-none shadow-sm"
                        />
                      </div>
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => handleActionApproval(selectedApproval.id, 'REJECT', feedback)}
                          className="px-5 py-2.5 bg-rose-50 border border-rose-250 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-black shadow-sm"
                        >
                          Từ chối yêu cầu
                        </button>
                        <button
                          onClick={() => handleActionApproval(selectedApproval.id, 'APPROVE', feedback)}
                          className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:opacity-90 text-white rounded-xl text-xs font-black shadow-md shadow-amber-200"
                        >
                          Phê duyệt & Xuất bản
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-grow flex flex-col items-center justify-center text-center p-8 bg-gray-50 text-gray-400">
                    <span className="text-5xl mb-3">📁</span>
                    <p className="text-sm font-semibold">Chọn một giáo án cần phê duyệt từ danh sách bên trái.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* HISTORIES VIEW */}
              {/* LEFT: History requests list */}
              <div className={`w-full lg:w-80 flex-shrink-0 lg:border-r border-gray-100 flex flex-col overflow-hidden ${selectedEditHistory ? 'hidden lg:flex' : 'flex'}`}>
                <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                  <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Yêu cầu chỉnh sửa ({allEditHistories.filter(h => h.status === 'PENDING').length})
                  </h4>
                </div>
                <div className="overflow-y-auto flex-grow p-3 space-y-2 bg-slate-50/50 relative min-h-[150px]">
                  {loadingEditHistories && allEditHistories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-gray-500 gap-2 absolute inset-0 bg-white/70">
                      <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs font-semibold">Đang tải lịch sử...</span>
                    </div>
                  ) : allEditHistories.length === 0 ? (
                    <p className="text-sm text-gray-400 italic py-8 text-center">Không có lịch sử chỉnh sửa nào.</p>
                  ) : (
                    allEditHistories.map((hist: any) => {
                      const isSelected = selectedEditHistory && selectedEditHistory.id === hist.id;
                      return (
                        <div
                          key={hist.id}
                          onClick={() => { setSelectedEditHistory(hist); setEditHistoryFeedback(hist.feedback || ''); }}
                          className={`p-3 rounded-xl border transition-all cursor-pointer ${isSelected
                              ? 'border-amber-500 bg-amber-50 shadow-sm'
                              : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/20'
                            }`}
                        >
                          <p className="font-semibold text-gray-900 text-sm truncate">{hist.lesson_plan_title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">👤 {hist.editor_name || 'Người sửa'}</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className={`px-1.5 py-0.5 text-[8px] rounded uppercase font-black border tracking-wider ${
                              hist.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              hist.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                              'bg-amber-50 text-amber-700 border-amber-100 animate-pulse'
                            }`}>
                              {hist.status === 'APPROVED' ? 'Đã duyệt' : hist.status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt'}
                            </span>
                            <span className="text-[9px] text-gray-400">
                              {new Date(hist.created_at).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* RIGHT: Detail + Comparison diff */}
              <div className={`flex-grow flex flex-col overflow-hidden min-w-0 ${selectedEditHistory ? 'flex' : 'hidden lg:flex'}`}>
                {selectedEditHistory ? (
                  <div className="flex-grow flex flex-col overflow-hidden">
                    <div className="flex-grow overflow-y-auto p-5 space-y-4">
                      {/* Mobile Back Button */}
                      <button
                        onClick={() => setSelectedEditHistory(null)}
                        className="lg:hidden mb-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-250 text-gray-700 rounded-lg text-xs font-bold flex items-center gap-1.5 self-start cursor-pointer border border-gray-200"
                      >
                        ← Quay lại danh sách
                      </button>
                      {/* Title & meta */}
                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                        <span className="text-xs font-semibold text-amber-750 uppercase tracking-wider block mb-1">So sánh lịch sử chỉnh sửa</span>
                        <h5 className="font-bold text-gray-900 text-base leading-snug">{selectedEditHistory.lesson_plan_title}</h5>
                        <p className="text-xs text-gray-500 mt-1">
                          Người sửa: <strong className="text-gray-700">{selectedEditHistory.edited_by_name || selectedEditHistory.edited_by_username}</strong>
                          {' '}· Ngày sửa: {new Date(selectedEditHistory.edited_at).toLocaleString('vi-VN')}
                          {' '}· Trạng thái duyệt hiện tại: <span className="font-bold text-amber-700">{selectedEditHistory.status}</span>
                        </p>
                      </div>

                      {/* Side-by-side comparison */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Old Version */}
                        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                          <h6 className="font-bold text-rose-700 text-xs uppercase mb-3 pb-1 border-b border-rose-100 flex justify-between">
                            <span>🔴 Phiên bản CŨ</span>
                            <span className="text-[10px] text-gray-400">Trước chỉnh sửa</span>
                          </h6>
                          <div className="space-y-3">
                            <div>
                              <p className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Tiêu đề</p>
                              <p className="text-sm font-semibold text-gray-800">{selectedEditHistory.title_before}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Mô tả</p>
                              <p className="text-xs text-gray-650 bg-white border border-gray-150 p-2.5 rounded-lg whitespace-pre-wrap">{selectedEditHistory.description_before || '(Không có)'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Đối tượng</p>
                              <p className="text-xs text-gray-750 font-medium">{selectedEditHistory.target_student_before || '(Không rõ)'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Tệp đính kèm cũ</p>
                              {selectedEditHistory.file_path_before ? (
                                <a
                                  href={selectedEditHistory.file_path_before}
                                  download={selectedEditHistory.file_name_before}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 font-bold px-3 py-1.5 rounded-lg border border-rose-200 inline-flex items-center gap-1.5"
                                >
                                  📥 Tải file cũ ({selectedEditHistory.file_name_before})
                                </a>
                              ) : (
                                <span className="text-xs text-gray-400">Không có file cũ</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* New Version */}
                        <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/10">
                          <h6 className="font-bold text-emerald-700 text-xs uppercase mb-3 pb-1 border-b border-emerald-150 flex justify-between">
                            <span>🟢 Phiên bản MỚI</span>
                            <span className="text-[10px] text-amber-600 font-bold">Yêu cầu thay đổi</span>
                          </h6>
                          <div className="space-y-3">
                            <div>
                              <p className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Tiêu đề</p>
                              <p className={`text-sm font-bold ${selectedEditHistory.title_before !== selectedEditHistory.title_after ? 'text-emerald-700 bg-emerald-50 rounded px-1' : 'text-gray-800'}`}>
                                {selectedEditHistory.title_after}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Mô tả</p>
                              <p className={`text-xs p-2.5 rounded-lg border whitespace-pre-wrap ${selectedEditHistory.description_before !== selectedEditHistory.description_after ? 'text-emerald-800 bg-emerald-50/50 border-emerald-200' : 'text-gray-650 bg-white border-gray-150'}`}>
                                {selectedEditHistory.description_after || '(Không có)'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Đối tượng</p>
                              <p className={`text-xs font-bold rounded px-1 inline-block ${selectedEditHistory.target_student_before !== selectedEditHistory.target_student_after ? 'text-emerald-700 bg-emerald-50' : 'text-gray-750'}`}>
                                {selectedEditHistory.target_student_after || '(Không rõ)'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Tệp đính kèm mới</p>
                              {selectedEditHistory.file_path_after ? (
                                <a
                                  href={selectedEditHistory.file_path_after}
                                  download={selectedEditHistory.file_name_after}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-bold px-3 py-1.5 rounded-lg border border-emerald-200 inline-flex items-center gap-1.5"
                                >
                                  📥 Tải file mới ({selectedEditHistory.file_name_after})
                                </a>
                              ) : (
                                <span className="text-xs text-gray-400">Không thay đổi file</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Bar (sticky bottom) */}
                    <div className="border-t border-gray-150 bg-slate-50 px-5 py-4 flex flex-col gap-3 flex-shrink-0">
                      <div>
                        <label className="block text-xs font-extrabold text-gray-500 uppercase mb-1.5 tracking-wider">Nhận xét hoặc phản hồi thay đổi:</label>
                        {selectedEditHistory.status === 'PENDING' ? (
                          <textarea
                            rows={2}
                            value={editHistoryFeedback}
                            onChange={e => setEditHistoryFeedback(e.target.value)}
                            placeholder="Nhập nhận xét hoặc lý do từ chối (bắt buộc nếu từ chối)..."
                            className="w-full bg-white border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-none shadow-sm"
                          />
                        ) : (
                          <p className="text-sm text-gray-700 bg-gray-100 border border-gray-200 p-2.5 rounded-xl">
                            <strong>Ý kiến phản hồi:</strong> {selectedEditHistory.review_feedback || '(Không có nhận xét)'}
                          </p>
                        )}
                      </div>
                      {selectedEditHistory.status === 'PENDING' && (
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => handleActionEditHistory(selectedEditHistory.id, 'REJECT', editHistoryFeedback)}
                            className="px-5 py-2.5 bg-rose-50 border border-rose-250 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-black shadow-sm"
                          >
                            Từ chối thay đổi
                          </button>
                          <button
                            onClick={() => handleActionEditHistory(selectedEditHistory.id, 'APPROVE', editHistoryFeedback)}
                            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:opacity-90 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-200"
                          >
                            Duyệt & Ghi đè phiên bản mới
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-grow flex flex-col items-center justify-center text-center p-8 bg-gray-50 text-gray-400">
                    <span className="text-5xl mb-3">📜</span>
                    <p className="text-sm font-semibold">Chọn một yêu cầu chỉnh sửa từ danh sách bên trái để đối chiếu phiên bản.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApprovalModal;
