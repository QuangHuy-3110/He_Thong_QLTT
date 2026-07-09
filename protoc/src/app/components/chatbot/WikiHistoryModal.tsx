import React from 'react';

interface WikiHistory {
  edited_by: string;
  edited_at: string;
  change_type: 'AI_REGEN' | 'MANUAL';
  content_after: string;
}

interface WikiHistoryModalProps {
  open: boolean;
  onCancel: () => void;
  selectedObsidianNote: { title: string } | null;
  loadingWikiHistory: boolean;
  wikiHistory: WikiHistory[];
}

export default function WikiHistoryModal({
  open,
  onCancel,
  selectedObsidianNote,
  loadingWikiHistory,
  wikiHistory,
}: WikiHistoryModalProps) {
  if (!open) return null;

  const cleanContentStr = (content: string) => {
    if (!content) return '';
    return content.replace(/^---[\s\S]*?---\s*/, '');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        width: '90%',
        maxWidth: '550px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>⏳ Lịch sử chỉnh sửa: {selectedObsidianNote?.title}</h3>
          <button
            type="button"
            onClick={onCancel}
            style={{ border: 'none', background: 'none', color: '#94a3b8', fontSize: '16px', cursor: 'pointer', padding: 0 }}
          >
            ✕
          </button>
        </div>
        
        <div style={{ padding: '16px', overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loadingWikiHistory ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
              <div style={{ width: '20px', height: '20px', border: '2px solid #3b82f6', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : wikiHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8', fontSize: '11.5px' }}>
              Chưa có lịch sử chỉnh sửa nào cho ghi chú này.
            </div>
          ) : (
            wikiHistory.map((hist, idx) => (
              <div key={idx} style={{
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '12px',
                background: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px' }}>
                  <span style={{ fontWeight: 850, color: '#1e293b' }}>👤 {hist.edited_by}</span>
                  <span style={{
                    padding: '1px 5px',
                    borderRadius: '4px',
                    fontWeight: 800,
                    background: hist.change_type === 'AI_REGEN' ? '#eff6ff' : '#f0fdf4',
                    color: hist.change_type === 'AI_REGEN' ? '#2563eb' : '#16a34a'
                  }}>
                    {hist.change_type === 'AI_REGEN' ? 'AI Tự động' : 'Thủ công'}
                  </span>
                </div>
                
                <div style={{ fontSize: '9px', color: '#94a3b8' }}>
                  🕒 {new Date(hist.edited_at).toLocaleString('vi-VN')}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                  <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#64748b' }}>Nội dung sau khi sửa:</span>
                  <div style={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '8px',
                    maxHeight: '120px',
                    overflowY: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    whiteSpace: 'pre-wrap',
                    color: '#334155'
                  }}>
                    {cleanContentStr(hist.content_after)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '6px 14px',
              background: '#64748b',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
