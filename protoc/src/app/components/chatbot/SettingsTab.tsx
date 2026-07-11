import React from 'react';
import { Activity, Server, Cpu, Check, Compass, Settings } from 'lucide-react';

interface SettingsTabProps {
  currentUser: any;
  bgTasksStatus: any;
  focusLessonId: number | null;
  focusLesson: any;
  aiMode: 'local' | 'api';
  setAiMode: (mode: 'local' | 'api') => void;
  localModel: '3b' | '7b';
  setLocalModel: (model: '3b' | '7b') => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  apiModel: string;
  setApiModel: (model: string) => void;
  ragDepth: number;
  setRagDepth: (depth: number) => void;
  apiBaseUrl: string;
  setApiBaseUrl: (url: string) => void;
  chunkingConfig: any;
  setChunkingConfig: React.Dispatch<React.SetStateAction<any>>;
  savingConfig: boolean;
  handleSaveChunkingConfig: (config: any) => void;
  handleReprocess: (all: boolean) => void;
  handleResume: () => void;
  handleStopTask: (lessonId: number) => void;
}

export default function SettingsTab({
  currentUser,
  bgTasksStatus,
  focusLessonId,
  focusLesson,
  aiMode,
  setAiMode,
  localModel,
  setLocalModel,
  apiKey,
  setApiKey,
  apiModel,
  setApiModel,
  ragDepth,
  setRagDepth,
  apiBaseUrl,
  setApiBaseUrl,
  chunkingConfig,
  setChunkingConfig,
  savingConfig,
  handleSaveChunkingConfig,
  handleReprocess,
  handleResume,
  handleStopTask,
}: SettingsTabProps) {

  const getStepStatus = (stepIndex: number, currentStepStr: string): 'pending' | 'active' | 'completed' => {
    if (!currentStepStr) return 'pending';
    const cleanStep = currentStepStr.toLowerCase();
    const phaseKeywords = [
      ['word', 'docx', 'convert', 'parse'],
      ['chunk', 'split', 'semantic'],
      ['embed', 'vector', 'metadata'],
      ['extract', 'entity', 'relation', 'concept'],
      ['obsidian', 'sync', 'vault', 'note']
    ];
    let activeIdx = -1;
    for (let i = 0; i < phaseKeywords.length; i++) {
      if (phaseKeywords[i].some(kw => cleanStep.includes(kw))) {
        activeIdx = i;
        break;
      }
    }
    if (activeIdx === -1) {
      if (cleanStep.includes('done') || cleanStep.includes('finish') || cleanStep.includes('success')) {
        return 'completed';
      }
      return 'pending';
    }
    if (stepIndex < activeIdx) return 'completed';
    if (stepIndex === activeIdx) return 'active';
    return 'pending';
  };

  return (
    <div style={{ flexGrow: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '14px', fontSize: '12px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      
      {/* SECTION 1: AI PROCESSING HUB */}
      <div style={{
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
      }}>
        <h3 style={{ fontSize: '11px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 10px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
          <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
          AI Processing Hub & Dashboard
        </h3>

        {bgTasksStatus ? (
          <div>
            {/* Metric Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px', marginBottom: '10px' }}>
              {[
                { label: 'Tổng số', val: bgTasksStatus.stats?.total_lessons || 0, color: '#475569', bg: '#f1f5f9' },
                { label: 'Đã xong', val: bgTasksStatus.stats?.completed || 0, color: '#16a34a', bg: '#dcfce7' },
                { label: 'Chờ/Lỗi', val: `${bgTasksStatus.stats?.pending || 0}/${bgTasksStatus.stats?.failed || 0}`, color: '#d97706', bg: '#fef3c7' },
                { label: 'Tỷ lệ', val: `${bgTasksStatus.stats?.success_rate_percent || 100}%`, color: '#2563eb', bg: '#dbeafe' },
              ].map((m, idx) => (
                <div key={idx} style={{ background: m.bg, borderRadius: '8px', padding: '6px 4px', textAlign: 'center', border: '1px solid rgba(0,0,0,0.02)' }}>
                  <span style={{ display: 'block', fontSize: '8px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{m.label}</span>
                  <span style={{ fontSize: '11px', fontWeight: 900, color: m.color }}>{m.val}</span>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyBetween: 'space-between', fontSize: '9px', fontWeight: 700, color: '#64748b', marginBottom: '3px' }}>
                <span>Tiến trình xử lý tri thức hệ thống</span>
                <span>{bgTasksStatus.stats?.success_rate_percent || 100}%</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  width: `${bgTasksStatus.stats?.success_rate_percent || 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
                  borderRadius: '3px',
                  boxShadow: '0 0 8px rgba(99, 102, 241, 0.4)',
                  transition: 'width 0.5s ease-out'
                }} />
              </div>
            </div>

            {/* Active Task Timeline Roadmap */}
            {bgTasksStatus.active_task ? (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      border: '2px solid #3b82f6',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      flexShrink: 0
                    }} />
                    <p style={{ margin: 0, fontSize: '10px', color: '#1e293b', lineHeight: 1.3, fontWeight: 700 }}>
                      🎯 Đang xử lý: <span style={{ color: '#2563eb' }}>{bgTasksStatus.active_task.title}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStopTask(bgTasksStatus.active_task.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      padding: '3px 8px',
                      background: '#fee2e2',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      color: '#dc2626',
                      fontSize: '8.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      flexShrink: 0
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fca5a5'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fee2e2'; }}
                  >
                    🛑 Dừng
                  </button>
                </div>
                
                <div style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  padding: '6px 8px',
                  fontSize: '9px',
                  color: '#1d4ed8',
                  marginBottom: '10px',
                  fontWeight: 600,
                  lineHeight: 1.4,
                  wordBreak: 'break-word',
                  display: 'flex',
                  gap: '4px',
                  alignItems: 'flex-start'
                }}>
                  <span>⚙️</span>
                  <span>{bgTasksStatus.active_task.step}</span>
                </div>

                {/* Roadmap steps */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative', paddingLeft: '16px' }}>
                  <div style={{ position: 'absolute', left: '6px', top: '4px', bottom: '12px', width: '1.5px', background: '#e2e8f0', zIndex: 0 }} />
                  
                  {[
                    { label: 'Phase 1: Parse & Convert', desc: 'Trích xuất văn bản Word sang Markdown' },
                    { label: 'Phase 2: Semantic Chunking', desc: 'Chia nhỏ tài liệu theo headings' },
                    { label: 'Phase 3: Embedding Generation', desc: 'Ghép Metadata và nhúng vector' },
                    { label: 'Phase 4: Concept Extraction', desc: 'LLM bóc tách thực thể & quan hệ' },
                    { label: 'Phase 5: Obsidian Sync', desc: 'Đồng bộ WikiNotes chéo vào Vault' }
                  ].map((step, sIdx) => {
                    const stepStatus = getStepStatus(sIdx, bgTasksStatus.active_task.step);
                    const isCompleted = stepStatus === 'completed';
                    const isActive = stepStatus === 'active';

                    return (
                      <div key={sIdx} style={{ display: 'flex', gap: '8px', position: 'relative', zIndex: 1 }}>
                        <div style={{
                          position: 'absolute',
                          left: '-14px',
                          top: '2px',
                          width: '9px',
                          height: '9px',
                          borderRadius: '50%',
                          background: isCompleted ? '#22c55e' : isActive ? '#3b82f6' : '#cbd5e1',
                          border: `2px solid ${isCompleted ? '#dcfce7' : isActive ? '#dbeafe' : '#f1f5f9'}`,
                          boxShadow: isActive ? '0 0 8px #3b82f6' : 'none',
                          animation: isActive ? 'pulseDot 1.2s infinite' : 'none',
                        }} />
                        <div style={{ minWidth: 0 }}>
                          <span style={{
                            display: 'block',
                            fontSize: '9px',
                            fontWeight: (isActive || isCompleted) ? 800 : 500,
                            color: isCompleted ? '#16a34a' : isActive ? '#2563eb' : '#94a3b8',
                          }}>
                            {step.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (bgTasksStatus.pending_queue && bgTasksStatus.pending_queue.length > 0) || (bgTasksStatus.stats?.pending > 0) ? (
              <div style={{
                background: '#fef3c7',
                border: '1px solid #fde68a',
                borderRadius: '10px',
                padding: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#b45309'
              }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  border: '2px solid #b45309',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  flexShrink: 0
                }} />
                <span style={{ fontSize: '10px', fontWeight: 650 }}>Đang chuẩn bị xử lý tác vụ tiếp theo trong hàng chờ...</span>
              </div>
            ) : (
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '10px',
                padding: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#15803d'
              }}>
                <Check className="w-4 h-4 flex-shrink-0" />
                <span style={{ fontSize: '10px', fontWeight: 650 }}>Hệ thống nhàn rỗi. Tất cả tài liệu đã được xử lý xong!</span>
              </div>
            )}

            {/* Reprocess Controls Panel */}
            <div style={{
              marginTop: '12px',
              padding: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <span style={{ fontSize: '8.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>
                ⚡️ Công cụ chạy lại (Reprocess AI RAG)
              </span>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
                {focusLessonId && (
                  <button
                    type="button"
                    onClick={() => handleReprocess(false)}
                    style={{
                      padding: '6px 8px',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '6px',
                      color: '#2563eb',
                      fontSize: '9px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '3px',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#dbeafe'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#eff6ff'; }}
                  >
                    🔄 Chạy lại bài đang xem
                  </button>
                )}
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleReprocess(true)}
                    style={{
                      padding: '6px 8px',
                      background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '9px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '3px',
                      boxShadow: '0 2px 6px rgba(99, 102, 241, 0.2)',
                      transition: 'opacity 0.15s'
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                  >
                    🚀 Chạy lại toàn hệ thống
                  </button>

                  <button
                    type="button"
                    onClick={handleResume}
                    style={{
                      padding: '6px 8px',
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '6px',
                      color: '#16a34a',
                      fontSize: '9px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '3px',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#dcfce7'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f0fdf4'; }}
                  >
                    ▶️ Tiếp tục chạy từ điểm dừng
                  </button>
                </div>
              </div>
            </div>

            {/* Pending queue */}
            {bgTasksStatus.pending_queue && bgTasksStatus.pending_queue.length > 0 && (
              <div style={{ marginTop: '10px' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Hàng chờ xử lý ({bgTasksStatus.pending_queue.length})
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '60px', overflowY: 'auto', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '4px' }}>
                  {bgTasksStatus.pending_queue.slice(0, 5).map((q: any, qIdx: number) => (
                    <div key={qIdx} style={{ fontSize: '9px', color: '#64748b', display: 'flex', justifyContent: 'space-between', padding: '2px 4px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>⏱ {q.title}</span>
                      <span style={{ fontSize: '8px', color: '#cbd5e1' }}>{new Date(q.queued_at).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '12px' }}>
            <div style={{ width: '12px', height: '12px', border: '2px solid #3b82f6', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          </div>
        )}
      </div>

      {/* SECTION 1.5: SYSTEM CONFIGURATION */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
        marginBottom: '10px'
      }}>
        <h3 style={{ fontSize: '11px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 10px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
          <Server className="w-4 h-4 text-blue-500" />
          Cấu hình kết nối Backend
        </h3>
        <div>
          <label style={{ display: 'block', fontSize: '8px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>URL Backend API (Render)</label>
          <input
            type="text"
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            placeholder="Trống: Tự động dùng URL build của Vercel"
            style={{
              width: '100%', padding: '5px 8px',
              background: '#f8fafc', border: '1px solid #e2e8f0',
              borderRadius: '6px', fontSize: '10px', color: '#1e293b',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          <p style={{ fontSize: '8px', color: '#94a3b8', margin: '3px 0 0 0', lineHeight: '1.2' }}>
            Ví dụ: <code>https://he-thong-qltt-backend.onrender.com</code>. Thay đổi này sẽ được áp dụng ngay lập tức cho upload, chatbot và đồ thị.
          </p>
        </div>
      </div>

      {/* SECTION 2: AI ENGINE CONFIGURATION */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
      }}>
        <h3 style={{ fontSize: '11px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 10px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
          <Cpu className="w-4 h-4 text-blue-500" />
          Cấu hình mô hình AI mặc định
        </h3>

        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Lựa chọn AI Engine</label>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px',
            background: '#f1f5f9', padding: '2px', borderRadius: '8px',
          }}>
            <button
              type="button"
              onClick={() => setAiMode('local')}
              style={{
                padding: '5px', borderRadius: '6px', border: 'none',
                fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                background: aiMode === 'local' ? '#3b82f6' : 'transparent',
                color: aiMode === 'local' ? '#fff' : '#64748b',
                transition: 'all 0.15s',
              }}
            >
              Qwen Local (Offline)
            </button>
            <button
              type="button"
              onClick={() => setAiMode('api')}
              style={{
                padding: '5px', borderRadius: '6px', border: 'none',
                fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                background: aiMode === 'api' ? '#3b82f6' : 'transparent',
                color: aiMode === 'api' ? '#fff' : '#64748b',
                transition: 'all 0.15s',
              }}
            >
              External API Key
            </button>
          </div>
        </div>

        {aiMode === 'local' && (
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Mô hình Qwen cục bộ</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                { key: '3b' as const, name: 'Qwen 2.5 3B (Mặc định)', desc: 'Chạy cực mượt trên CPU' },
                { key: '7b' as const, name: 'Qwen 2.5 7B (Nâng cao)', desc: 'Cần RAM lớn hoặc GPU' },
              ].map(m => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setLocalModel(m.key)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyBetween: 'space-between',
                    padding: '6px 8px', borderRadius: '8px',
                    border: `1px solid ${localModel === m.key ? '#3b82f6' : '#e2e8f0'}`,
                    background: localModel === m.key ? '#eff6ff' : '#fff',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ flexGrow: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: '10px', color: localModel === m.key ? '#1d4ed8' : '#475569', margin: 0 }}>{m.name}</p>
                    <p style={{ fontSize: '8px', color: '#94a3b8', margin: '1px 0 0 0' }}>{m.desc}</p>
                  </div>
                  {localModel === m.key && <Check className="w-3.5 h-3.5 text-blue-500" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {aiMode === 'api' && (
          <div style={{ marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '8px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>Tên mô hình</label>
              <input
                type="text"
                value={apiModel}
                onChange={(e) => setApiModel(e.target.value)}
                placeholder="gemini-1.5-flash hoặc gpt-4o-mini..."
                style={{
                  width: '100%', padding: '5px 8px',
                  background: '#f8fafc', border: '1px solid #e2e8f0',
                  borderRadius: '6px', fontSize: '10px', color: '#1e293b',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '8px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>Mã API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-proj-xxx hoặc AIzaSy..."
                style={{
                  width: '100%', padding: '5px 8px',
                  background: '#f8fafc', border: '1px solid #e2e8f0',
                  borderRadius: '6px', fontSize: '10px', color: '#1e293b',
                  outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        )}

        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', marginBottom: '3px' }}>
            <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Compass className="w-3.5 h-3.5 text-blue-500" /> Độ sâu Graph RAG
            </span>
            <strong style={{ color: '#1e293b', fontWeight: 800 }}>{ragDepth} hops</strong>
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={1}
            value={ragDepth}
            onChange={(e) => setRagDepth(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: '#3b82f6', height: '4px', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* SECTION 3: ADMIN CHUNKING CONFIGURATION */}
      {currentUser?.role === 'ADMIN' && (
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
        }}>
          <h3 style={{ fontSize: '11px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 10px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
            <Settings className="w-4 h-4 text-purple-500" />
            Cấu hình cắt nhỏ (Chunking) - Admin
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '8px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '3px' }}>Chiến lược phân mảnh</label>
              <select
                value={chunkingConfig.chunk_strategy}
                onChange={(e) => setChunkingConfig((prev: any) => ({ ...prev, chunk_strategy: e.target.value }))}
                style={{
                  width: '100%', padding: '5px 8px',
                  background: '#f8fafc', border: '1px solid #e2e8f0',
                  borderRadius: '6px', fontSize: '10px', color: '#1e293b', outline: 'none',
                }}
              >
                <option value="heading">Heading Strategy (Chia theo Tiêu đề)</option>
                <option value="fixed">Fixed Character Strategy (Cắt kích thước cố định)</option>
              </select>
            </div>

            {chunkingConfig.chunk_strategy === 'fixed' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '8px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>Kích thước chunk (Ký tự)</label>
                  <input
                    type="number"
                    value={chunkingConfig.chunk_size}
                    onChange={(e) => setChunkingConfig((prev: any) => ({ ...prev, chunk_size: parseInt(e.target.value) || 1000 }))}
                    style={{
                      width: '100%', padding: '5px 8px',
                      background: '#f8fafc', border: '1px solid #e2e8f0',
                      borderRadius: '6px', fontSize: '10px', color: '#1e293b', outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '8px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>Chồng lặp overlap (Ký tự)</label>
                  <input
                    type="number"
                    value={chunkingConfig.chunk_overlap}
                    onChange={(e) => setChunkingConfig((prev: any) => ({ ...prev, chunk_overlap: parseInt(e.target.value) || 200 }))}
                    style={{
                      width: '100%', padding: '5px 8px',
                      background: '#f8fafc', border: '1px solid #e2e8f0',
                      borderRadius: '6px', fontSize: '10px', color: '#1e293b', outline: 'none',
                    }}
                  />
                </div>
              </div>
            )}

            {/* TOGGLE LLM AI RAG IMPORT */}
            <div style={{
              background: chunkingConfig.use_ai_rag !== false
                ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
                : 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
              border: `1.5px solid ${chunkingConfig.use_ai_rag !== false ? '#86efac' : '#fdba74'}`,
              borderRadius: '10px',
              padding: '10px 12px',
              marginTop: '2px',
              transition: 'all 0.3s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '14px' }}>{chunkingConfig.use_ai_rag !== false ? '🧠' : '⚡'}</span>
                  <div>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#1e293b', display: 'block' }}>
                      LLM & AI RAG khi nhập liệu
                    </span>
                    <span style={{
                      display: 'inline-block',
                      fontSize: '7px',
                      fontWeight: 800,
                      padding: '1px 5px',
                      borderRadius: '4px',
                      marginTop: '1px',
                      background: chunkingConfig.use_ai_rag !== false ? '#bbf7d0' : '#fed7aa',
                      color: chunkingConfig.use_ai_rag !== false ? '#15803d' : '#c2410c',
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                    }}>
                      {chunkingConfig.use_ai_rag !== false ? '● ĐANG BẬT' : '○ ĐÃ TẮT'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  id="llm-import-toggle"
                  onClick={() => {
                    const newVal = chunkingConfig.use_ai_rag === false ? true : false;
                    setChunkingConfig((prev: any) => ({ ...prev, use_ai_rag: newVal }));
                  }}
                  style={{
                    position: 'relative',
                    width: '40px',
                    height: '22px',
                    borderRadius: '11px',
                    border: 'none',
                    cursor: 'pointer',
                    background: chunkingConfig.use_ai_rag !== false
                      ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                      : '#cbd5e1',
                    transition: 'background 0.3s ease',
                    boxShadow: chunkingConfig.use_ai_rag !== false
                      ? '0 0 10px rgba(34, 197, 94, 0.4)'
                      : '0 1px 3px rgba(0,0,0,0.1)',
                    flexShrink: 0,
                    padding: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute',
                    top: '3px',
                    left: chunkingConfig.use_ai_rag !== false ? '21px' : '3px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.25s ease',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                    display: 'block',
                  }} />
                </button>
              </div>

              <div style={{
                fontSize: '8.5px',
                color: chunkingConfig.use_ai_rag !== false ? '#166534' : '#9a3412',
                lineHeight: 1.45,
                borderTop: `1px solid ${chunkingConfig.use_ai_rag !== false ? '#bbf7d0' : '#fed7aa'}`,
                paddingTop: '5px',
                marginTop: '2px',
              }}>
                {chunkingConfig.use_ai_rag !== false ? (
                  <>
                    ✅ <strong>Đang bật:</strong> Khi thầy cô tải lên giáo án, hệ thống sẽ tự động chạy AI để phân tích, tạo embedding vector, trích xuất từ khóa và đồng bộ Obsidian Vault.
                  </>
                ) : (
                  <>
                    ⚠️ <strong>Đã tắt:</strong> Khi tải lên, hệ thống <strong>chỉ lưu file</strong> — không chạy LLM, không tạo embedding, không xử lý ngầm. Phù hợp máy chủ yếu. Tắt chat AI RAG bên dưới nếu cần.
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSaveChunkingConfig(chunkingConfig)}
              disabled={savingConfig}
              style={{
                width: '100%',
                padding: '7px',
                background: savingConfig
                  ? '#e2e8f0'
                  : chunkingConfig.use_ai_rag !== false
                    ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                    : 'linear-gradient(135deg, #f97316, #ea580c)',
                color: savingConfig ? '#94a3b8' : '#fff',
                fontWeight: 800,
                borderRadius: '8px',
                border: 'none',
                fontSize: '10px',
                cursor: savingConfig ? 'not-allowed' : 'pointer',
                marginTop: '4px',
                boxShadow: savingConfig ? 'none' : '0 2px 8px rgba(0,0,0,0.15)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
              onMouseEnter={e => { if (!savingConfig) (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            >
              {savingConfig ? (
                <>
                  <div style={{ width: '10px', height: '10px', border: '2px solid #94a3b8', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  Đang lưu...
                </>
              ) : (
                <>
                  {chunkingConfig.use_ai_rag !== false ? '💾 Lưu cấu hình (AI BẬT)' : '💾 Lưu cấu hình (AI TẮT)'}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
