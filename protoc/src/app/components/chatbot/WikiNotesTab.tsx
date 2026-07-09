import React from 'react';
import { FolderOpen, BookOpen } from 'lucide-react';

interface WikiNotesTabProps {
  isMobile: boolean;
  selectedObsidianNote: any;
  setSelectedObsidianNote: (note: any) => void;
  currentNotes: any[];
  wikiFilterMode: 'lesson' | 'all';
  setWikiFilterMode: (mode: 'lesson' | 'all') => void;
  wikiSearchQuery: string;
  setWikiSearchQuery: (query: string) => void;
  fetchNoteContent: (note: any) => void;
  parsedSubject: string | null;
  checkHasEditPermission: () => boolean;
  isEditingWiki: boolean;
  setIsEditingWiki: (editing: boolean) => void;
  wikiEditText: string;
  setWikiEditText: (text: string) => void;
  handleSaveWikiNote: () => void;
  savingWiki: boolean;
  obsidianNoteContent: string;
  handleRegenerateWikiNote: () => void;
  regeneratingWiki: boolean;
  handleFetchWikiHistory: () => void;
  loadingNote: boolean;
  renderWikiContent: (contentStr: string) => React.ReactNode;
  cleanContentStr: (content: string) => string;
  focusLessonId: number | null;
}

export default function WikiNotesTab({
  isMobile,
  selectedObsidianNote,
  setSelectedObsidianNote,
  currentNotes,
  wikiFilterMode,
  setWikiFilterMode,
  wikiSearchQuery,
  setWikiSearchQuery,
  fetchNoteContent,
  parsedSubject,
  checkHasEditPermission,
  isEditingWiki,
  setIsEditingWiki,
  wikiEditText,
  setWikiEditText,
  handleSaveWikiNote,
  savingWiki,
  obsidianNoteContent,
  handleRegenerateWikiNote,
  regeneratingWiki,
  handleFetchWikiHistory,
  loadingNote,
  renderWikiContent,
  cleanContentStr,
  focusLessonId,
}: WikiNotesTabProps) {
  return (
    <div style={{ flexGrow: 1, display: 'flex', overflow: 'hidden', height: '100%', minHeight: 0 }}>
      {/* Left Side: Wiki Notes List */}
      {(!isMobile || !selectedObsidianNote) && (
        <div style={{
          width: isMobile ? '100%' : '35%',
          borderRight: isMobile ? 'none' : '1px solid #e2e8f0',
          background: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 10px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
            <h3 style={{ fontSize: '10px', fontWeight: 850, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <FolderOpen className="w-4 h-4 text-blue-500" /> Tài liệu RAG ({currentNotes.length})
            </h3>
            
            {/* Permanent 2 sub-tabs */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              background: '#f1f5f9',
              padding: '2px',
              borderRadius: '6px',
              marginBottom: '8px'
            }}>
              <button
                type="button"
                onClick={() => {
                  if (focusLessonId) {
                    setWikiFilterMode('lesson');
                  } else {
                    alert("Vui lòng chọn một bài giảng để xem các ghi chú liên quan!");
                  }
                }}
                style={{
                  padding: '5px',
                  borderRadius: '4px',
                  border: 'none',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: focusLessonId ? 'pointer' : 'not-allowed',
                  background: (wikiFilterMode === 'lesson' && focusLessonId) ? '#fff' : 'transparent',
                  color: (wikiFilterMode === 'lesson' && focusLessonId) ? '#3b82f6' : '#64748b',
                  opacity: focusLessonId ? 1 : 0.6,
                  boxShadow: (wikiFilterMode === 'lesson' && focusLessonId) ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                Bài giảng này
              </button>
              <button
                type="button"
                onClick={() => setWikiFilterMode('all')}
                style={{
                  padding: '5px',
                  borderRadius: '4px',
                  border: 'none',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: wikiFilterMode === 'all' || !focusLessonId ? '#fff' : 'transparent',
                  color: wikiFilterMode === 'all' || !focusLessonId ? '#3b82f6' : '#64748b',
                  boxShadow: wikiFilterMode === 'all' || !focusLessonId ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                Toàn hệ thống
              </button>
            </div>

            {/* Real-time Search input */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Tìm ghi chú (real-time)..."
                value={wikiSearchQuery}
                onChange={(e) => setWikiSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 28px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '11px',
                  background: '#ffffff',
                  color: '#334155',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', pointerEvents: 'none' }}>🔍</span>
              {wikiSearchQuery && (
                <button
                  type="button"
                  onClick={() => setWikiSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '10px',
                    padding: 0
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <div style={{ flexGrow: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {!focusLessonId && wikiFilterMode === 'lesson' ? (
              <div style={{ padding: '24px 8px', textAlign: 'center', fontSize: '11px', color: '#94a3b8', lineHeight: 1.5 }}>
                💡 Hãy chọn một bài giảng ở danh sách ngoài để xem ghi chú tương ứng.
              </div>
            ) : currentNotes.length === 0 ? (
              <div style={{ padding: '24px 8px', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>
                Không có ghi chú nào phù hợp.
              </div>
            ) : (
              currentNotes.map((note, nIdx) => {
                const isSelected = selectedObsidianNote?.filename === note.filename;
                return (
                  <button
                    key={nIdx}
                    type="button"
                    onClick={() => fetchNoteContent(note)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      background: isSelected 
                        ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' 
                        : '#ffffff',
                      border: isSelected ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                      borderRadius: '10px',
                      fontSize: '11.5px',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? '#1e40af' : '#334155',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.01)',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#ffffff'; }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', display: 'block' }}>
                      📄 {note.title}
                    </span>
                    <span style={{ fontSize: '9px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <span>⚡ Size:</span>
                      <strong>{(note.size / 1024).toFixed(1)} KB</strong>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Right Side: Premium Glassmorphic Reader */}
      {(!isMobile || selectedObsidianNote) && (
        <div style={{
          width: isMobile ? '100%' : '65%',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          height: '100%',
          overflow: 'hidden',
        }}>
          {selectedObsidianNote ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Reader Header */}
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                flexShrink: 0
              }}>
                {isMobile && (
                  <button
                    type="button"
                    onClick={() => setSelectedObsidianNote(null)}
                    style={{
                      marginRight: '8px',
                      padding: '5px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      color: '#334155',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    ⬅️ Danh sách
                  </button>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flexGrow: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>📖</span>
                    <h2 style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={selectedObsidianNote.title}>
                      {selectedObsidianNote.title}
                    </h2>
                  </div>
                  {parsedSubject && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginTop: '4px',
                      marginLeft: '24px',
                      fontSize: '9.5px',
                      fontWeight: 700,
                      color: '#0284c7',
                      background: '#e0f2fe',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      width: 'fit-content'
                    }}>
                      <span>📚 Môn học:</span>
                      <span>{parsedSubject}</span>
                    </div>
                  )}
                </div>

                {/* Edit & Action Controls */}
                {checkHasEditPermission() && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px', flexShrink: 0 }}>
                    {isEditingWiki ? (
                      <>
                        <button
                          type="button"
                          onClick={handleSaveWikiNote}
                          disabled={savingWiki}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                            color: '#fff',
                            fontSize: '10px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          {savingWiki ? 'Đang lưu...' : '💾 Lưu'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingWiki(false);
                            setWikiEditText(obsidianNoteContent);
                          }}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#fff',
                            color: '#64748b',
                            fontSize: '10px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          ❌ Hủy
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setWikiEditText(obsidianNoteContent);
                            setIsEditingWiki(true);
                          }}
                          style={{
                            padding: '5px 8px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#fff',
                            color: '#475569',
                            fontSize: '10px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}
                        >
                          ✏️ Sửa
                        </button>
                        <button
                          type="button"
                          onClick={handleRegenerateWikiNote}
                          disabled={regeneratingWiki}
                          style={{
                            padding: '5px 8px',
                            borderRadius: '6px',
                            border: '1px solid #bfdbfe',
                            background: '#eff6ff',
                            color: '#2563eb',
                            fontSize: '10px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}
                        >
                          {regeneratingWiki ? 'Đang tạo...' : '🧠 AI Tạo lại'}
                        </button>
                        <button
                          type="button"
                          onClick={handleFetchWikiHistory}
                          style={{
                            padding: '5px 8px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc',
                            color: '#64748b',
                            fontSize: '10px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}
                        >
                          ⏳ Lịch sử
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Content Reading Pane */}
              <div style={{
                flexGrow: 1,
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                padding: '18px 24px',
                fontSize: '13px',
                lineHeight: 1.65,
                color: '#334155',
                background: '#fff',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
              }}>
                {loadingNote ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px' }}>
                    <div style={{ width: '28px', height: '28px', border: '3px solid #f3f3f3', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Đang nạp ghi chú Wiki...</span>
                  </div>
                ) : isEditingWiki ? (
                  <textarea
                    value={wikiEditText}
                    onChange={(e) => setWikiEditText(e.target.value)}
                    style={{
                      width: '100%',
                      height: '100%',
                      minHeight: '200px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '12px',
                      fontSize: '12.5px',
                      lineHeight: 1.5,
                      color: '#334155',
                      fontFamily: 'monospace',
                      outline: 'none',
                      resize: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                ) : (
                  <div style={{ 
                    whiteSpace: 'pre-wrap', 
                    wordBreak: 'break-word',
                    background: 'rgba(255,255,255,0.7)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: '12px',
                  }}>
                    {renderWikiContent(cleanContentStr(obsidianNoteContent))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              padding: '24px',
              background: '#ffffff'
            }}>
              <div style={{
                width: '56px', height: '56px',
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.08)'
              }}>
                <BookOpen className="w-6 h-6 text-blue-500" />
              </div>
              <h3 style={{ fontSize: '13.5px', fontWeight: 800, color: '#1e293b', margin: '0 0 6px 0' }}>Trình đọc WikiNotes RAG</h3>
              <p style={{ fontSize: '11px', color: '#94a3b8', maxWidth: '220px', margin: 0, lineHeight: 1.5 }}>
                Chọn một tài liệu trong danh sách bên trái để đọc nội dung ghi chú Obsidian chuẩn WikiLinks liên kết chéo tự động.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
