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

const formatAttrValue = (v: any): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    return v.map(item => (typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item))).join(', ');
  }
  if (typeof v === 'object') {
    return JSON.stringify(v);
  }
  return String(v);
};

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
  }, [open, currentUser?.id]);

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
                      {selectedApproval.lesson_plan_attributes && Object.keys(selectedApproval.lesson_plan_attributes).filter(k => k !== 'knowledge_tags' && k !== 'ai_model_config' && k !== 'tien_trinh_day_hoc').length > 0 && (
                        <div>
                          <h6 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Thông tin bổ sung</h6>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(selectedApproval.lesson_plan_attributes)
                              .filter(([k]) => k !== 'knowledge_tags' && k !== 'ai_model_config' && k !== 'tien_trinh_day_hoc')
                              .map(([key, val]) => (
                                <span key={key} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-100">
                                  {key}: {formatAttrValue(val)}
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
                      const dateStr = hist.edited_at
                        ? new Date(hist.edited_at).toLocaleString('vi-VN')
                        : hist.created_at
                        ? new Date(hist.created_at).toLocaleString('vi-VN')
                        : 'Vừa xong';
                      
                      const editorStr = hist.edited_by_name || hist.edited_by_username || 'Giáo viên';

                      // Compute changed fields list
                      const changedFields: string[] = [];
                      if (hist.title_before !== hist.title_after) changedFields.push('Tiêu đề');
                      if ((hist.description_before || '') !== (hist.description_after || '')) changedFields.push('Mô tả');
                      if ((hist.target_student_before || '') !== (hist.target_student_after || '')) changedFields.push('Đối tượng');
                      if (hist.file_name_before !== hist.file_name_after) changedFields.push('File');

                      const attrs1 = hist.attributes_before || {};
                      const attrs2 = hist.attributes_after || {};
                      if (JSON.stringify(attrs1) !== JSON.stringify(attrs2)) {
                        if ((attrs1['Thời gian thực hiện'] || attrs1['Số tiết']) !== (attrs2['Thời gian thực hiện'] || attrs2['Số tiết'])) {
                          changedFields.push('Số tiết');
                        }
                        if (attrs1['Loại hình'] !== attrs2['Loại hình']) changedFields.push('Loại hình');
                        if (attrs1['Địa điểm'] !== attrs2['Địa điểm']) changedFields.push('Địa điểm');
                        if (JSON.stringify(attrs1['lop']) !== JSON.stringify(attrs2['lop'])) changedFields.push('Lớp');
                      }

                      return (
                        <div
                          key={hist.id}
                          onClick={() => { setSelectedEditHistory(hist); setEditHistoryFeedback(hist.review_feedback || hist.feedback || ''); }}
                          className={`p-3 rounded-xl border transition-all cursor-pointer ${isSelected
                              ? 'border-amber-500 bg-amber-50 shadow-sm'
                              : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/20'
                            }`}
                        >
                          <p className="font-bold text-gray-900 text-sm truncate">{hist.lesson_plan_title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                            <span>👤 {editorStr}</span>
                          </p>
                          
                          {changedFields.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {changedFields.map((f, idx) => (
                                <span key={idx} className="bg-amber-100/80 text-amber-800 text-[9px] font-bold px-1.5 py-0.2 rounded">
                                  ✏️ {f}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-gray-100">
                            <span className={`px-1.5 py-0.5 text-[8px] rounded uppercase font-black border tracking-wider ${
                              hist.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              hist.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                              'bg-amber-50 text-amber-700 border-amber-100 animate-pulse'
                            }`}>
                              {hist.status === 'APPROVED' ? 'Đã duyệt' : hist.status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt'}
                            </span>
                            <span className="text-[10px] font-medium text-gray-400">
                              🕒 {dateStr}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* RIGHT: Detail + Visual Diff Summary + 2-Column Comparison */}
              <div className={`flex-grow flex flex-col overflow-hidden min-w-0 ${selectedEditHistory ? 'flex' : 'hidden lg:flex'}`}>
                {selectedEditHistory ? (
                  <div className="flex-grow flex flex-col overflow-hidden">
                    <div className="flex-grow overflow-y-auto p-5 space-y-5">
                      {/* Mobile Back Button */}
                      <button
                        onClick={() => setSelectedEditHistory(null)}
                        className="lg:hidden mb-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-250 text-gray-700 rounded-lg text-xs font-bold flex items-center gap-1.5 self-start cursor-pointer border border-gray-200"
                      >
                        ← Quay lại danh sách
                      </button>

                      {/* Header meta */}
                      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 shadow-xs">
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <span className="text-xs font-black text-amber-800 uppercase tracking-wider block">
                            📜 Lịch sử chỉnh sửa bài giảng
                          </span>
                          <span className={`px-2.5 py-0.5 text-xs rounded-full uppercase font-black border tracking-wider ${
                            selectedEditHistory.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                            selectedEditHistory.status === 'REJECTED' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                            'bg-amber-100 text-amber-800 border-amber-200 animate-pulse'
                          }`}>
                            {selectedEditHistory.status === 'APPROVED' ? 'Đã phê duyệt' : selectedEditHistory.status === 'REJECTED' ? 'Đã từ chối' : 'Chờ xét duyệt'}
                          </span>
                        </div>
                        <h5 className="font-black text-gray-900 text-lg leading-snug">{selectedEditHistory.lesson_plan_title}</h5>
                        <p className="text-xs text-gray-600 mt-1 flex flex-wrap items-center gap-2">
                          <span>👤 Người thực hiện: <strong className="text-gray-900">{selectedEditHistory.edited_by_name || selectedEditHistory.edited_by_username || 'Giáo viên'}</strong></span>
                          <span>•</span>
                          <span>🕒 Thời gian: <strong className="text-gray-900">{selectedEditHistory.edited_at ? new Date(selectedEditHistory.edited_at).toLocaleString('vi-VN') : (selectedEditHistory.created_at ? new Date(selectedEditHistory.created_at).toLocaleString('vi-VN') : 'Vừa xong')}</strong></span>
                        </p>
                      </div>

                      {/* SECTION 1: VISUAL DIFF SUMMARY CARD (TỔNG HỢP CÁC THAY ĐỔI) */}
                      {(() => {
                        const hist = selectedEditHistory;
                        const diffItems: { label: string; icon: string; oldVal: string; newVal: string }[] = [];

                        if (hist.title_before !== hist.title_after) {
                          diffItems.push({ label: 'Tiêu đề bài giảng', icon: '📝', oldVal: hist.title_before, newVal: hist.title_after });
                        }

                        if ((hist.description_before || '') !== (hist.description_after || '')) {
                          diffItems.push({ label: 'Mô tả tóm tắt', icon: '📄', oldVal: hist.description_before || '(Trống)', newVal: hist.description_after || '(Trống)' });
                        }

                        if ((hist.target_student_before || '') !== (hist.target_student_after || '')) {
                          diffItems.push({ label: 'Đối tượng học sinh', icon: '👥', oldVal: hist.target_student_before || '(Chưa chọn)', newVal: hist.target_student_after || '(Chưa chọn)' });
                        }

                        const attrs1 = hist.attributes_before || {};
                        const attrs2 = hist.attributes_after || {};
                        const keys = Array.from(new Set([...Object.keys(attrs1), ...Object.keys(attrs2)]));

                        keys.forEach(k => {
                          if (k === 'ai_model_config' || k === 'tien_trinh_day_hoc' || k === 'knowledge_tags') return;
                          if ((k === 'Thời gian' || k === 'Số tiết') && (attrs1['Thời gian thực hiện'] || attrs2['Thời gian thực hiện'])) return;
                          
                          const v1 = attrs1[k];
                          const v2 = attrs2[k];
                          const s1 = formatAttrValue(v1);
                          const s2 = formatAttrValue(v2);

                          if (s1 !== s2) {
                            let icon = '🏷️';
                            if (k.includes('Thời gian') || k.includes('Số tiết')) icon = '⏱️';
                            else if (k.includes('Loại hình')) icon = '📌';
                            else if (k.includes('Mạch')) icon = '🧭';
                            else if (k.includes('Chủ đề')) icon = '📚';
                            else if (k.includes('Địa điểm')) icon = '📍';
                            else if (k.includes('lop') || k.includes('Lớp')) icon = '🎓';

                            diffItems.push({ label: k, icon, oldVal: s1 || '(Trống)', newVal: s2 || '(Trống)' });
                          }
                        });

                        if (hist.file_name_before || hist.file_name_after) {
                          if (hist.file_name_before !== hist.file_name_after) {
                            diffItems.push({
                              label: 'Tệp đính kèm',
                              icon: '📎',
                              oldVal: hist.file_name_before || '(Không có tệp)',
                              newVal: hist.file_name_after || '(Không có tệp)'
                            });
                          }
                        }

                        return (
                          <div className="bg-white border-2 border-purple-200 rounded-2xl p-4 shadow-sm space-y-3">
                            <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                              <h6 className="font-extrabold text-purple-900 text-sm m-0 flex items-center gap-2">
                                <span>⚡</span> NỘI DUNG THAY ĐỔI TRỰC QUAN ({diffItems.length} mục thay đổi)
                              </h6>
                              <span className="text-[11px] text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded-full">
                                Cũ ➔ Mới
                              </span>
                            </div>

                            {diffItems.length === 0 ? (
                              <p className="text-xs text-gray-400 italic m-0">Không ghi nhận thay đổi nào ở thuộc tính cơ bản.</p>
                            ) : (
                              <div className="space-y-2.5">
                                {diffItems.map((item, idx) => (
                                  <div key={idx} className="bg-purple-50/30 border border-purple-100 rounded-xl p-3 text-xs space-y-1.5">
                                    <span className="font-extrabold text-purple-950 block">
                                      {item.icon} {item.label}
                                    </span>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                                      <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 text-rose-900">
                                        <span className="text-[10px] font-bold text-rose-500 uppercase block mb-0.5">Trước:</span>
                                        <span className="line-through font-medium">{item.oldVal}</span>
                                      </div>
                                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-emerald-900">
                                        <span className="text-[10px] font-bold text-emerald-600 uppercase block mb-0.5">Sau khi sửa:</span>
                                        <span className="font-bold">{item.newVal}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* SECTION 2: 2-COLUMN SIDE-BY-SIDE COMPARISON */}
                      <div>
                        <h6 className="font-extrabold text-gray-800 text-xs uppercase mb-3 tracking-wider flex items-center gap-1.5">
                          <span>🔍</span> SO SÁNH ĐỐI CHIẾU CHI TIẾT 2 PHIÊN BẢN
                        </h6>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Old Version */}
                          <div className="border border-rose-200 rounded-2xl p-4 bg-rose-50/20 space-y-3">
                            <h6 className="font-black text-rose-700 text-xs uppercase pb-2 border-b border-rose-200 flex justify-between items-center m-0">
                              <span>🔴 PHIÊN BẢN CŨ</span>
                              <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-bold">Trước khi sửa</span>
                            </h6>
                            <div className="space-y-3">
                              <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Tiêu đề</p>
                                <p className="text-sm font-semibold text-gray-800">{selectedEditHistory.title_before}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Mô tả tóm tắt</p>
                                <p className="text-xs text-gray-650 bg-white border border-gray-150 p-2.5 rounded-xl whitespace-pre-wrap leading-relaxed">{selectedEditHistory.description_before || '(Không có)'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Đối tượng học sinh</p>
                                <p className="text-xs text-gray-750 font-medium">{selectedEditHistory.target_student_before || '(Chưa chọn)'}</p>
                              </div>

                              {/* Attributes Before */}
                              {selectedEditHistory.attributes_before && Object.keys(selectedEditHistory.attributes_before).filter(k => k !== 'ai_model_config' && k !== 'tien_trinh_day_hoc' && k !== 'knowledge_tags' && k !== 'Thời gian' && k !== 'Số tiết').length > 0 && (
                                <div className="border-t border-rose-150 pt-2.5 space-y-1.5 text-xs">
                                  <p className="text-[10px] text-rose-700 font-bold uppercase mb-1">Thuộc tính chi tiết cũ:</p>
                                  {Object.entries(selectedEditHistory.attributes_before)
                                    .filter(([k]) => k !== 'ai_model_config' && k !== 'tien_trinh_day_hoc' && k !== 'knowledge_tags' && k !== 'Thời gian' && k !== 'Số tiết')
                                    .map(([k, v]: [string, any]) => (
                                      <div key={k} className="flex justify-between gap-2 text-[11px] bg-white p-1.5 rounded border border-gray-150">
                                        <span className="font-bold text-gray-500">{k}:</span>
                                        <span className="font-medium text-gray-800 truncate">{formatAttrValue(v)}</span>
                                      </div>
                                    ))}
                                </div>
                              )}

                              <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Tệp đính kèm cũ</p>
                                {selectedEditHistory.file_path_before ? (
                                  <a
                                    href={selectedEditHistory.file_path_before}
                                    download={selectedEditHistory.file_name_before}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 font-bold px-3 py-1.5 rounded-xl border border-rose-250 inline-flex items-center gap-1.5"
                                  >
                                    📥 Tải tệp cũ ({selectedEditHistory.file_name_before})
                                  </a>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">Không có tệp đính kèm cũ</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* New Version */}
                          <div className="border border-emerald-200 rounded-2xl p-4 bg-emerald-50/20 space-y-3">
                            <h6 className="font-black text-emerald-700 text-xs uppercase pb-2 border-b border-emerald-200 flex justify-between items-center m-0">
                              <span>🟢 PHIÊN BẢN MỚI</span>
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">Yêu cầu cập nhật</span>
                            </h6>
                            <div className="space-y-3">
                              <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Tiêu đề</p>
                                <p className={`text-sm font-bold ${selectedEditHistory.title_before !== selectedEditHistory.title_after ? 'text-emerald-700 bg-emerald-100/60 p-1 rounded-lg' : 'text-gray-800'}`}>
                                  {selectedEditHistory.title_after}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Mô tả tóm tắt</p>
                                <p className={`text-xs p-2.5 rounded-xl border whitespace-pre-wrap leading-relaxed ${selectedEditHistory.description_before !== selectedEditHistory.description_after ? 'text-emerald-900 bg-emerald-100/40 border-emerald-300 font-medium' : 'text-gray-650 bg-white border-gray-150'}`}>
                                  {selectedEditHistory.description_after || '(Không có)'}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Đối tượng học sinh</p>
                                <p className={`text-xs font-bold p-1 rounded-lg inline-block ${selectedEditHistory.target_student_before !== selectedEditHistory.target_student_after ? 'text-emerald-800 bg-emerald-100/60' : 'text-gray-750'}`}>
                                  {selectedEditHistory.target_student_after || '(Chưa chọn)'}
                                </p>
                              </div>

                              {/* Attributes After */}
                              {selectedEditHistory.attributes_after && Object.keys(selectedEditHistory.attributes_after).filter(k => k !== 'ai_model_config' && k !== 'tien_trinh_day_hoc' && k !== 'knowledge_tags' && k !== 'Thời gian' && k !== 'Số tiết').length > 0 && (
                                <div className="border-t border-emerald-150 pt-2.5 space-y-1.5 text-xs">
                                  <p className="text-[10px] text-emerald-700 font-bold uppercase mb-1">Thuộc tính chi tiết mới:</p>
                                  {Object.entries(selectedEditHistory.attributes_after)
                                    .filter(([k]) => k !== 'ai_model_config' && k !== 'tien_trinh_day_hoc' && k !== 'knowledge_tags' && k !== 'Thời gian' && k !== 'Số tiết')
                                    .map(([k, v]: [string, any]) => {
                                      const v1 = selectedEditHistory.attributes_before ? selectedEditHistory.attributes_before[k] : undefined;
                                      const s1 = formatAttrValue(v1);
                                      const s2 = formatAttrValue(v);
                                      const isChanged = s1 !== s2;

                                      return (
                                        <div key={k} className={`flex justify-between gap-2 text-[11px] p-1.5 rounded border ${isChanged ? 'bg-emerald-100/60 border-emerald-300 font-bold text-emerald-900' : 'bg-white border-gray-150 text-gray-800'}`}>
                                          <span className="font-bold text-gray-600">{k}:</span>
                                          <span className="truncate">{s2}</span>
                                        </div>
                                      );
                                    })}
                                </div>
                              )}

                              <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Tệp đính kèm mới</p>
                                {selectedEditHistory.file_path_after ? (
                                  <a
                                    href={selectedEditHistory.file_path_after}
                                    download={selectedEditHistory.file_name_after}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-bold px-3 py-1.5 rounded-xl border border-emerald-250 inline-flex items-center gap-1.5"
                                  >
                                    📥 Tải tệp mới ({selectedEditHistory.file_name_after})
                                  </a>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">Không thay đổi tệp</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Bar (sticky bottom) */}
                    <div className="border-t border-gray-150 bg-slate-50 px-5 py-4 flex flex-col gap-3 flex-shrink-0">
                      <div>
                        <label className="block text-xs font-extrabold text-gray-600 uppercase mb-1.5 tracking-wider">Nhận xét hoặc ý kiến phản hồi về bản chỉnh sửa:</label>
                        {selectedEditHistory.status === 'PENDING' ? (
                          <textarea
                            rows={2}
                            value={editHistoryFeedback}
                            onChange={e => setEditHistoryFeedback(e.target.value)}
                            placeholder="Nhập nhận xét hoặc lý do từ chối (bắt buộc nếu từ chối)..."
                            className="w-full bg-white border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-none shadow-sm"
                          />
                        ) : (
                          <p className="text-xs text-gray-800 bg-white border border-gray-200 p-3 rounded-xl font-medium m-0">
                            <strong>Ý kiến phản hồi:</strong> {selectedEditHistory.review_feedback || '(Không có nhận xét)'}
                          </p>
                        )}
                      </div>
                      {selectedEditHistory.status === 'PENDING' && (
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => handleActionEditHistory(selectedEditHistory.id, 'REJECT', editHistoryFeedback)}
                            className="px-5 py-2.5 bg-rose-50 border border-rose-250 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-black shadow-sm cursor-pointer"
                          >
                            Từ chối chỉnh sửa
                          </button>
                          <button
                            onClick={() => handleActionEditHistory(selectedEditHistory.id, 'APPROVE', editHistoryFeedback)}
                            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:opacity-90 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-200 cursor-pointer"
                          >
                            Phê duyệt thay đổi
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
