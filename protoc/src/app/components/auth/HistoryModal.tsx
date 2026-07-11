import React from 'react';
import { Modal, Button, Avatar } from 'antd';
import { CheckCircleFilled, CloseCircleFilled, ClockCircleFilled, EditOutlined } from '@ant-design/icons';

interface HistoryModalProps {
  open: boolean;
  onCancel: () => void;
  historyLoading: boolean;
  editHistory: any[];
}

/** Badge trạng thái xét duyệt
 * - Ẩn hoàn toàn nếu ADMIN/TEACHER tự chỉnh sửa (auto-approved bởi chính mình)
 * - Chỉ hiển thị khi có người khác xét duyệt hoặc đang CHờ
 */
function StatusBadge({ status, reviewedByName, reviewedAt, editorRole, editedById, reviewedById }: {
  status?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  editorRole?: string;
  editedById?: number;
  reviewedById?: number | null;
}) {
  // ADMIN / TEACHER tự chỉnh sửa → auto-approved bởi chính mình → không cần hiển thị
  const isPrivileged = editorRole === 'ADMIN' || editorRole === 'TEACHER';
  const isSelfApproved = isPrivileged && status === 'APPROVED' && (reviewedById === editedById || reviewedById == null);
  if (isSelfApproved) return null;

  if (!status || status === 'PENDING') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
        style={{ background: '#fef9c3', color: '#a16207', border: '1px solid #fde68a' }}
      >
        <ClockCircleFilled style={{ fontSize: 11 }} />
        Chờ duyệt
      </span>
    );
  }
  if (status === 'APPROVED') {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
          style={{ background: '#dcfce7', color: '#166534', border: '1px solid #86efac' }}
        >
          <CheckCircleFilled style={{ fontSize: 11 }} />
          Đã chấp nhận
        </span>
        {reviewedByName && (
          <span className="text-[11px] text-slate-400">
            bởi <strong className="text-slate-600">{reviewedByName}</strong>
            {reviewedAt && <> · {new Date(reviewedAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</>}
          </span>
        )}
      </div>
    );
  }
  if (status === 'REJECTED') {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
          style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}
        >
          <CloseCircleFilled style={{ fontSize: 11 }} />
          Đã từ chối
        </span>
        {reviewedByName && (
          <span className="text-[11px] text-slate-400">
            bởi <strong className="text-slate-600">{reviewedByName}</strong>
            {reviewedAt && <> · {new Date(reviewedAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</>}
          </span>
        )}
      </div>
    );
  }
  return null;
}

/** Một row thay đổi dạng diff */
function DiffRow({ icon, label, before, after }: { icon: string; label: string; before: string; after: string }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid #f1f5f9' }}
    >
      <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
        <span className="text-sm">{icon}</span>
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>{label}</span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-slate-100">
        <div className="px-3 py-2.5" style={{ background: '#fff5f5' }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#f87171' }}>Trước</p>
          <p className="text-xs line-through m-0" style={{ color: '#ef4444' }}>{before}</p>
        </div>
        <div className="px-3 py-2.5" style={{ background: '#f0fdf4' }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#4ade80' }}>Sau</p>
          <p className="text-xs font-semibold m-0" style={{ color: '#16a34a' }}>{after}</p>
        </div>
      </div>
    </div>
  );
}

export default function HistoryModal({ open, onCancel, historyLoading, editHistory }: HistoryModalProps) {

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      width={860}
      closable={false}
      footer={null}
      styles={{ body: { padding: 0, borderRadius: 20, overflow: 'hidden' } }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.4)' }}
          >
            <EditOutlined style={{ color: '#a5b4fc', fontSize: 16 }} />
          </div>
          <div>
            <h3 className="text-white font-black m-0 text-base leading-tight">Lịch sử chỉnh sửa tài liệu</h3>
            <p className="text-slate-400 text-[11px] m-0 mt-0.5">{editHistory.length} bản ghi thay đổi</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="primary"
            onClick={onCancel}
            style={{ borderRadius: 10, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', fontWeight: 600 }}
          >
            Đóng
          </Button>
        </div>
      </div>

      {/* Body */}
      <div style={{ background: '#f8fafc', maxHeight: '72vh', overflowY: 'auto', padding: '20px 24px' }}>
        {historyLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-slate-400 text-sm mt-4 font-medium">Đang tải lịch sử chỉnh sửa...</p>
          </div>
        ) : editHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: '#e2e8f0', border: '2px dashed #cbd5e1' }}>
              <span className="text-3xl">📂</span>
            </div>
            <p className="text-slate-500 font-bold m-0">Chưa có lịch sử chỉnh sửa nào</p>
            <p className="text-slate-400 text-xs mt-1">Tài liệu này chưa được chỉnh sửa kể từ khi đăng tải.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {editHistory.map((h, idx) => {
              const isTitleChanged   = h.title_before !== h.title_after;
              const isDescChanged    = h.description_before !== h.description_after;
              const isStudentChanged = h.target_student_before !== h.target_student_after;
              const isFileChanged    = h.file_name_before !== h.file_name_after;

              const beforeAttrs = h.attributes_before || {};
              const afterAttrs  = h.attributes_after  || {};
              const changedAttrs: string[] = [];
              Array.from(new Set([...Object.keys(beforeAttrs), ...Object.keys(afterAttrs)])).forEach(k => {
                if (JSON.stringify(beforeAttrs[k]) !== JSON.stringify(afterAttrs[k])) changedAttrs.push(k);
              });

              const totalChanges = [isTitleChanged, isDescChanged, isStudentChanged, isFileChanged, changedAttrs.length > 0].filter(Boolean).length;

              // Left border color:
              //   ADMIN/TEACHER → nét tím (luôn auto-approved, không cần phân biệt)
              //   PENDING → vàng âu (cần xét duyệt)
              //   APPROVED → xanh lá
              //   REJECTED → đỏ
              const isPrivilegedEdit = h.edited_by_role === 'ADMIN' || h.edited_by_role === 'TEACHER';
              const borderAccent = isPrivilegedEdit
                ? '#6366f1'
                : h.status === 'APPROVED' ? '#22c55e'
                : h.status === 'REJECTED' ? '#ef4444'
                : '#f59e0b';

              return (
                <div
                  key={h.id}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: 'white',
                    border: '1px solid #e8edf5',
                    borderLeft: `4px solid ${borderAccent}`,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                  }}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between px-4 py-3" style={{ background: '#fafbff', borderBottom: '1px solid #f1f5f9' }}>
                    <div className="flex items-center gap-3">
                      {/* Index badge */}
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                        style={{ background: '#e0e7ff', color: '#4338ca' }}
                      >
                        #{editHistory.length - idx}
                      </div>

                      {/* Avatar */}
                      {h.edited_by_avatar ? (
                        <Avatar src={h.edited_by_avatar} size={34} style={{ border: '2px solid #e0e7ff' }} />
                      ) : (
                        <Avatar size={34} style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', fontWeight: 900, fontSize: 14, border: '2px solid #e0e7ff' }}>
                          {(h.edited_by_name || h.edited_by_username || 'U')[0].toUpperCase()}
                        </Avatar>
                      )}

                      <div>
                        <p className="text-sm font-bold text-slate-800 m-0">{h.edited_by_name || h.edited_by_username || 'Người dùng'}</p>
                        <p className="text-[11px] text-slate-400 m-0">
                          {new Date(h.edited_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          <span className="mx-1">·</span>
                          <span className="font-semibold text-indigo-500">{totalChanges} thay đổi</span>
                        </p>
                      </div>
                    </div>

                    {/* Status badge — ẩn nếu ADMIN/TEACHER tự chỉnh sửa */}
                    <StatusBadge
                      status={h.status}
                      reviewedByName={h.reviewed_by_name}
                      reviewedAt={h.reviewed_at}
                      editorRole={h.edited_by_role}
                      editedById={h.edited_by}
                      reviewedById={h.reviewed_by}
                    />
                  </div>

                  {/* Changes */}
                  <div className="p-4 space-y-3">
                    {/* Display feedback if present */}
                    {h.review_feedback && (
                      <div className="mb-3 bg-slate-55 border border-slate-200 p-3 rounded-xl text-xs flex flex-col gap-1">
                        <span className="font-bold text-slate-500 uppercase tracking-widest text-[9px]">Phản hồi xét duyệt:</span>
                        <span className="text-slate-700 font-medium">{h.review_feedback}</span>
                      </div>
                    )}

                    {isTitleChanged && (
                      <DiffRow icon="📝" label="Tiêu đề" before={h.title_before} after={h.title_after} />
                    )}
                    {isDescChanged && (
                      <DiffRow
                        icon="💬" label="Mô tả"
                        before={h.description_before || '(trống)'}
                        after={h.description_after || '(trống)'}
                      />
                    )}
                    {isStudentChanged && (
                      <DiffRow icon="👥" label="Đối tượng học sinh" before={h.target_student_before} after={h.target_student_after} />
                    )}
                    {isFileChanged && (
                      <div
                        className="rounded-xl overflow-hidden"
                        style={{ border: '1px solid #f1f5f9' }}
                      >
                        <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                          <span className="text-sm">📁</span>
                          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Tệp tài liệu</span>
                        </div>
                        <div className="grid grid-cols-2 divide-x divide-slate-100">
                          <div className="px-3 py-2.5 bg-red-50/20">
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-red-500">Trước</p>
                            {h.file_path_before ? (
                              <a
                                href={h.file_path_before}
                                download={h.file_name_before}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 font-bold px-2 py-1 rounded-lg border border-rose-200 inline-flex items-center gap-1"
                              >
                                📥 Tải file cũ ({h.file_name_before})
                              </a>
                            ) : (
                              <p className="text-xs text-rose-500 line-through m-0">{h.file_name_before || 'Không có file'}</p>
                            )}
                          </div>
                          <div className="px-3 py-2.5 bg-emerald-50/20">
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-emerald-500">Sau</p>
                            {h.file_path_after ? (
                              <a
                                href={h.file_path_after}
                                download={h.file_name_after}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-bold px-2 py-1 rounded-lg border border-emerald-200 inline-flex items-center gap-1"
                              >
                                📥 Tải file mới ({h.file_name_after})
                              </a>
                            ) : (
                              <p className="text-xs text-emerald-600 font-semibold m-0">{h.file_name_after || 'Không có file'}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {changedAttrs.length > 0 && (
                      <div
                        className="rounded-xl overflow-hidden"
                        style={{ border: '1px solid #f1f5f9' }}
                      >
                        <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                          <span className="text-sm">⚙️</span>
                          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Thuộc tính bổ sung</span>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {changedAttrs.map(k => (
                            <div key={k} className="grid grid-cols-2 divide-x divide-slate-100">
                              <div className="px-3 py-2.5" style={{ background: '#fff5f5' }}>
                                <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider m-0 mb-1">{k} — Trước</p>
                                <p className="text-xs line-through text-red-500 m-0">{JSON.stringify(beforeAttrs[k]) || '(trống)'}</p>
                              </div>
                              <div className="px-3 py-2.5" style={{ background: '#f0fdf4' }}>
                                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider m-0 mb-1">{k} — Sau</p>
                                <p className="text-xs font-semibold text-emerald-600 m-0">{JSON.stringify(afterAttrs[k]) || '(trống)'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
