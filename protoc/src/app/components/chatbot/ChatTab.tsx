import React from 'react';
import { Plus, Layers, Check, Sparkles, X, Edit2, Trash2, Copy, CheckCheck, Send } from 'lucide-react';
import axios from 'axios';
import { Popover } from 'antd';

interface ChatMessage {
  id: number;
  sender_role: 'USER' | 'AI';
  content: string;
  created_at: string;
}

interface ChatSession {
  id: number;
  title: string;
  created_at: string;
  messages: ChatMessage[];
}

interface ChatTabProps {
  showHistorySidebar: boolean;
  setShowHistorySidebar: (show: boolean) => void;
  historySidebarWidth: number;
  handleSidebarResizeMouseDown: (e: React.MouseEvent) => void;
  sessions: ChatSession[];
  activeSession: ChatSession | null;
  loadSessionDetails: (id: number) => void;
  handleCreateSession: (lessonId?: number) => void;
  handleDeleteSession: (id: number, e: React.MouseEvent) => void;
  editingSessionId: number | null;
  setEditingSessionId: (id: number | null) => void;
  editingTitleText: string;
  setEditingTitleText: (text: string) => void;
  handleSaveTitle: (id: number, newTitle: string) => void;
  handleAutoName: (id: number) => void;
  namingLoaderId: number | null;
  loadingHistory: boolean;
  sending: boolean;
  inputMessage: string;
  setInputMessage: (msg: string) => void;
  handleSendMessage: (messageText?: string) => void;
  handleStopResponse: () => void;
  currentUser: any;
  focusLesson: any;
  suggestedQuestions: string[];
  copiedMsgId: number | null;
  handleCopyMessage: (id: number, content: string) => void;
  editingMessageId: number | null;
  setEditingMessageId: (id: number | null) => void;
  editingMessageText: string;
  setEditingMessageText: (text: string) => void;
  handleSaveAndResubmit: (id: number, content: string) => void;
  handleRemakePreviousQuestion: () => void;
  lessonPlans: any[];
  onViewLessonDetail: any;
  setIsOpen: (open: boolean) => void;
  pushCurrentViewToHistory: () => void;
  setActiveTab: (tab: 'chat' | 'graph' | 'wiki' | 'settings') => void;
  pendingSyncLessonId?: number | null;
  showSyncBanner?: boolean;
  handleSyncContext?: () => void;
}

export default function ChatTab({
  showHistorySidebar,
  setShowHistorySidebar,
  historySidebarWidth,
  handleSidebarResizeMouseDown,
  sessions,
  activeSession,
  loadSessionDetails,
  handleCreateSession,
  handleDeleteSession,
  editingSessionId,
  setEditingSessionId,
  editingTitleText,
  setEditingTitleText,
  handleSaveTitle,
  handleAutoName,
  namingLoaderId,
  loadingHistory,
  sending,
  inputMessage,
  setInputMessage,
  handleSendMessage,
  handleStopResponse,
  currentUser,
  focusLesson,
  suggestedQuestions,
  copiedMsgId,
  handleCopyMessage,
  editingMessageId,
  setEditingMessageId,
  editingMessageText,
  setEditingMessageText,
  handleSaveAndResubmit,
  handleRemakePreviousQuestion,
  lessonPlans,
  onViewLessonDetail,
  setIsOpen,
  pushCurrentViewToHistory,
  setActiveTab,
  pendingSyncLessonId,
  showSyncBanner,
  handleSyncContext,
}: ChatTabProps) {
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  
  const pendingSyncLesson = React.useMemo(() => {
    if (!pendingSyncLessonId || !lessonPlans) return null;
    return lessonPlans.find(l => l.id === pendingSyncLessonId) || null;
  }, [pendingSyncLessonId, lessonPlans]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, sending]);

  // Render rich text with custom jump links, bold formatting, and markdown-like block elements
  const renderMessageContent = (content: string, isUser: boolean) => {
    if (!content) return null;

    const linkRegex = /\[([^\]]+)\]\((lesson:\/\/(\d+)(?:\?text=([^)]+))?)\)/g;

    const renderRichInline = (text: string) => {
      const elements: React.ReactNode[] = [];
      let lastIndex = 0;
      let match;

      const renderTextWithBold = (txt: string, partKey: string) => {
        const boldRegex = /\*\*([^*]+)\*\*/g;
        const subElements: React.ReactNode[] = [];
        let subLastIdx = 0;
        let subMatch;

        while ((subMatch = boldRegex.exec(txt)) !== null) {
          if (subMatch.index > subLastIdx) {
            subElements.push(txt.substring(subLastIdx, subMatch.index));
          }
          subElements.push(
            <strong key={`bold-${subMatch.index}`} className={isUser ? "font-bold" : "font-bold text-blue-700"}>
              {subMatch[1]}
            </strong>
          );
          subLastIdx = boldRegex.lastIndex;
        }
        if (subLastIdx < txt.length) {
          subElements.push(txt.substring(subLastIdx));
        }
        return <span key={partKey}>{subElements}</span>;
      };

      let keyCounter = 0;
      while ((match = linkRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          const textSegment = text.substring(lastIndex, match.index);
          elements.push(renderTextWithBold(textSegment, `text-${keyCounter++}`));
        }

        const linkText = match[1];
        const lessonId = parseInt(match[3]);
        const searchText = match[4] ? decodeURIComponent(match[4].replace(/\+/g, ' ')) : undefined;

        const targetLesson = lessonPlans.find(lp => lp.id === lessonId);

        const popoverContent = (
          <div style={{ padding: '6px 8px', maxWidth: '250px', fontSize: '11px', fontFamily: 'sans-serif' }}>
            <p style={{ margin: '0 0 4px 0', fontWeight: 700, color: '#1e293b' }}>
              📄 Tài liệu liên kết: "{linkText}"
            </p>
            <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '10px', lineHeight: '1.4' }}>
              • Nhấp chuột trực tiếp để mở xem và tự động làm nổi bật từ khóa trong văn bản.<br/>
              • Hoặc nhấn nút dưới đây để hỏi Trợ lý AI giải thích chi tiết hơn.
            </p>
            <button
              onClick={() => {
                const queryText = focusLesson 
                  ? `Giải thích chi tiết cho tôi về thuật ngữ "${linkText}" trong bài học "${focusLesson.title}"?`
                  : `Giải thích chi tiết cho tôi về thuật ngữ "${linkText}"?`;
                handleSendMessage(queryText);
              }}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                color: '#fff',
                border: 'none',
                padding: '6px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '10px',
                textAlign: 'center',
                boxShadow: '0 2px 6px rgba(59, 130, 246, 0.25)',
                transition: 'all 0.15s'
              }}
            >
              💬 Hỏi AI về thuật ngữ này
            </button>
          </div>
        );

        elements.push(
          <Popover 
            key={`link-${match.index}`}
            content={popoverContent} 
            trigger="hover" 
            placement="top"
            overlayStyle={{ zIndex: 10000 }}
          >
            <button
              onClick={() => {
                if (targetLesson && onViewLessonDetail) {
                  pushCurrentViewToHistory();
                  onViewLessonDetail(targetLesson, searchText);
                  setIsOpen(true);
                } else if (!targetLesson) {
                  pushCurrentViewToHistory();
                  axios.get(`/api/lesson-plans/${lessonId}/?user_id=${currentUser?.id}`)
                    .then(res => {
                      if (onViewLessonDetail) {
                        onViewLessonDetail(res.data, searchText);
                        setIsOpen(true);
                      }
                    })
                    .catch(err => {
                      console.error("Lỗi khi tải chi tiết bài giảng:", err);
                      alert("Không thể tải tài liệu này.");
                    });
                }
              }}
              className={`inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 my-0.5 rounded-md border text-[10px] font-bold shadow-sm hover:scale-105 active:scale-95 transition-all ${
                isUser 
                  ? 'bg-white/20 text-white border-white/30 hover:bg-white/30' 
                  : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
              }`}
              title={targetLesson ? `Xem "${targetLesson.title}"` : "Xem tài liệu"}
            >
              <span>📄</span>
              <span className="underline decoration-dotted underline-offset-2">{linkText}</span>
              {searchText && <span className="text-[8px] opacity-70 italic">({searchText})</span>}
            </button>
          </Popover>
        );

        lastIndex = linkRegex.lastIndex;
      }

      if (lastIndex < text.length) {
        elements.push(renderTextWithBold(text.substring(lastIndex), `text-${keyCounter++}`));
      }

      return elements;
    };

    // Split content by newline to parse block elements
    const lines = content.split('\n');
    const renderedElements: React.ReactNode[] = [];
    let listItems: string[] = [];
    let inList = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];
    let inTable = false;

    const flushList = (key: string) => {
      if (listItems.length > 0) {
        renderedElements.push(
          <ul key={key} className="list-disc pl-5 my-2 space-y-1 text-xs text-inherit">
            {listItems.map((item, idx) => (
              <li key={idx} className="leading-relaxed">{renderRichInline(item)}</li>
            ))}
          </ul>
        );
        listItems = [];
        inList = false;
      }
    };

    const flushTable = (key: string) => {
      if (tableHeaders.length > 0 || tableRows.length > 0) {
        renderedElements.push(
          <div key={key} className="overflow-x-auto my-3 border border-gray-200 rounded-lg shadow-sm bg-white text-slate-800">
            <table className="min-w-full divide-y divide-gray-200 text-[11px] text-left">
              <thead className="bg-slate-50 font-bold text-slate-700">
                <tr>
                  {tableHeaders.map((h, idx) => (
                    <th key={idx} className="px-3 py-2 whitespace-nowrap">{renderRichInline(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {tableRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-slate-50 transition-colors">
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="px-3 py-2 max-w-xs break-words">{renderRichInline(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableHeaders = [];
        tableRows = [];
        inTable = false;
      }
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const key = `chat-line-${index}`;

      if (trimmed.startsWith('|')) {
        flushList(key + '-pre-tbl');
        inTable = true;
        const cells = trimmed
          .split('|')
          .map(c => c.trim())
          .filter((c, i, arr) => i > 0 && i < arr.length - 1);

        if (trimmed.includes('---')) {
          return;
        }

        if (tableHeaders.length === 0) {
          tableHeaders = cells;
        } else {
          tableRows.push(cells);
        }
        return;
      } else {
        flushTable(key + '-pre-non-tbl');
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
        inList = true;
        const cleanText = trimmed.replace(/^[-*•]\s*/, '');
        listItems.push(cleanText);
        return;
      } else {
        flushList(key + '-pre-non-list');
      }

      if (trimmed.startsWith('# ')) {
        renderedElements.push(<h1 key={key} className="text-base font-bold my-3 border-b pb-1 border-slate-200">{renderRichInline(trimmed.slice(2))}</h1>);
      } else if (trimmed.startsWith('## ')) {
        renderedElements.push(<h2 key={key} className="text-sm font-bold text-slate-800 my-2">{renderRichInline(trimmed.slice(3))}</h2>);
      } else if (trimmed.startsWith('### ')) {
        renderedElements.push(<h3 key={key} className="text-xs font-bold text-blue-600 my-2">{renderRichInline(trimmed.slice(4))}</h3>);
      } else if (trimmed === '---') {
        renderedElements.push(<hr key={key} className="my-3 border-slate-200" />);
      } else if (trimmed) {
        renderedElements.push(<p key={key} className="text-[12px] leading-relaxed my-1.5">{renderRichInline(trimmed)}</p>);
      }
    });

    flushList('final-list');
    flushTable('final-table');

    return <div className="leading-relaxed space-y-1">{renderedElements}</div>;
  };

  return (
    <div style={{ flexGrow: 1, display: 'flex', overflow: 'hidden', height: '100%', minHeight: 0 }}>
      {/* Session History Sidebar */}
      {showHistorySidebar && (
        <div style={{
          width: `${historySidebarWidth}px`,
          minWidth: '100px',
          borderRight: '1px solid #e2e8f0',
          background: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <div style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', flexShrink: 0, display: 'flex', gap: '6px' }}>
            <button
              onClick={() => handleCreateSession()}
              style={{
                flexGrow: 1,
                padding: '6px',
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                color: '#fff',
                fontWeight: 700,
                borderRadius: '8px',
                border: 'none',
                fontSize: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                transition: 'opacity 0.15s',
              }}
            >
              <Plus className="w-3 h-3" /> Tạo mới
            </button>
            <button
              onClick={() => setShowHistorySidebar(false)}
              style={{
                padding: '6px',
                background: '#f1f5f9',
                color: '#64748b',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s',
              }}
              title="Ẩn lịch sử"
            >
              <Layers className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
          <div style={{ flexGrow: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {loadingHistory ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                <div style={{
                  width: '16px', height: '16px',
                  border: '2px solid #3b82f6',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }} />
              </div>
            ) : sessions.length === 0 ? (
              <p style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'center', padding: '8px', fontStyle: 'italic' }}>Chưa có cuộc trò chuyện.</p>
            ) : (
              sessions.map(s => {
                const isActive = activeSession && activeSession.id === s.id;
                const isEditing = editingSessionId === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      if (!isEditing) {
                        loadSessionDetails(s.id);
                      }
                    }}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      border: `1px solid ${isActive ? '#3b82f6' : '#e2e8f0'}`,
                      background: isActive ? '#eff6ff' : '#fff',
                      cursor: isEditing ? 'default' : 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.15s',
                      position: 'relative',
                    }}
                  >
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '4px', width: '100%', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingTitleText}
                          onChange={e => setEditingTitleText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              handleSaveTitle(s.id, editingTitleText);
                            } else if (e.key === 'Escape') {
                              setEditingSessionId(null);
                            }
                          }}
                          style={{
                            fontSize: '10px',
                            padding: '2px 4px',
                            border: '1px solid #3b82f6',
                            borderRadius: '4px',
                            flexGrow: 1,
                            outline: 'none',
                            width: '0',
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveTitle(s.id, editingTitleText)}
                          style={{
                            background: '#22c55e',
                            border: 'none',
                            color: '#fff',
                            borderRadius: '4px',
                            padding: '2px',
                            cursor: 'pointer',
                            display: 'flex',
                          }}
                          title="Lưu"
                        >
                          <Check className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={() => handleAutoName(s.id)}
                          disabled={namingLoaderId === s.id}
                          style={{
                            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                            border: 'none',
                            color: '#fff',
                            borderRadius: '4px',
                            padding: '2px',
                            cursor: 'pointer',
                            display: 'flex',
                            opacity: namingLoaderId === s.id ? 0.6 : 1,
                          }}
                          title="Tự động đặt tên bằng AI"
                        >
                          <Sparkles className={`w-2.5 h-2.5 ${namingLoaderId === s.id ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          onClick={() => setEditingSessionId(null)}
                          style={{
                            background: '#ef4444',
                            border: 'none',
                            color: '#fff',
                            borderRadius: '4px',
                            padding: '2px',
                            cursor: 'pointer',
                            display: 'flex',
                          }}
                          title="Hủy"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? '#1d4ed8' : '#475569',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          paddingRight: '32px',
                          flexGrow: 1,
                        }}>{s.title}</span>
                        <div style={{ display: 'flex', gap: '4px', position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSessionId(s.id);
                              setEditingTitleText(s.title);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              padding: '2px',
                              borderRadius: '4px',
                              opacity: 0.5,
                              transition: 'opacity 0.15s',
                              display: 'flex',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.color = '#3b82f6'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.5'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
                            title="Sửa tên"
                          >
                            <Edit2 className="w-2.5 h-2.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteSession(s.id, e)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              padding: '2px',
                              borderRadius: '4px',
                              opacity: 0.5,
                              transition: 'opacity 0.15s',
                              display: 'flex',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.5'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
                            title="Xóa"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Sidebar Resizer drag handle */}
      {showHistorySidebar && (
        <div
          onMouseDown={handleSidebarResizeMouseDown}
          style={{
            width: '5px',
            cursor: 'col-resize',
            background: '#f1f5f9',
            alignSelf: 'stretch',
            position: 'relative',
            zIndex: 10,
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#3b82f6'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; }}
        />
      )}

      {/* Chat Messages Area */}
      <div style={{
        width: showHistorySidebar ? `calc(100% - ${historySidebarWidth}px - 5px)` : '100%',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {!showHistorySidebar && (
          <button
            onClick={() => setShowHistorySidebar(true)}
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 20,
              width: '14px',
              height: '48px',
              borderRadius: '0 8px 8px 0',
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '2px 0 8px rgba(99,102,241,0.2)',
              padding: 0,
              fontSize: '9px',
            }}
            title="Hiện lịch sử"
          >
            ▶
          </button>
        )}
        {showSyncBanner && (
          <div style={{
            background: '#eff6ff',
            borderBottom: '1px solid #bfdbfe',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            fontSize: '11px',
            color: '#1e40af',
            flexShrink: 0
          }}>
            <span style={{ textAlign: 'left' }}>
              {pendingSyncLesson ? (
                <span>💡 Bạn đang xem bài giảng <b>"{pendingSyncLesson.title}"</b>. Bạn có muốn đồng bộ chatbot với bài giảng này không?</span>
              ) : (
                <span>💡 Bạn đã quay lại thư viện. Bạn có muốn đồng bộ chatbot về cuộc trò chuyện chung không?</span>
              )}
            </span>
            <button 
              onClick={handleSyncContext}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '10px',
                whiteSpace: 'nowrap'
              }}
            >
              Đồng bộ chat
            </button>
          </div>
        )}
        <div style={{ flexGrow: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loadingHistory ? (
            <div style={{ display: 'flex', flexGrow: 1, height: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '12px' }}>
              <div style={{
                width: '32px', height: '32px',
                border: '3px solid #3b82f6',
                borderTop: '3px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Đang đồng bộ hội thoại...</p>
            </div>
          ) : activeSession && activeSession.messages && activeSession.messages.length > 0 ? (
            activeSession.messages.map(msg => {
              const isUser = msg.sender_role === 'USER';
              const isStreaming = sending && msg.content === '' && !isUser;
              const userInitials = currentUser
                ? (currentUser.full_name || currentUser.username || currentUser.email || 'U')
                    .split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
                : 'U';
              return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  gap: '8px',
                  flexDirection: isUser ? 'row-reverse' : 'row',
                }}
              >
                {/* Avatar */}
                {isUser ? (
                  currentUser?.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt="avatar"
                      style={{
                        width: '26px', height: '26px', borderRadius: '50%',
                        objectFit: 'cover', flexShrink: 0,
                        border: '2px solid #3b82f6',
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '26px', height: '26px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                      color: '#fff', fontSize: '9px', fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, border: '2px solid #bfdbfe',
                      letterSpacing: '-0.5px',
                    }}>
                      {userInitials}
                    </div>
                  )
                ) : (
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #e0e7ff, #ede9fe)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, border: '1px solid #c7d2fe',
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="6" width="18" height="13" rx="3" fill="#c7d2fe" stroke="#6366f1" strokeWidth="1.5"/>
                      <circle cx="8.5" cy="12.5" r="1.5" fill="#6366f1"/>
                      <circle cx="15.5" cy="12.5" r="1.5" fill="#6366f1"/>
                      <path d="M9 16c1-1 5-1 6 0" stroke="#6366f1" strokeWidth="1.2" strokeLinecap="round"/>
                      <path d="M9 3L12 6M15 3L12 6" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round"/>
                      <circle cx="12" cy="6" r="1" fill="#6366f1"/>
                    </svg>
                  </div>
                )}
                <div style={{
                  maxWidth: '85%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{
                    borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    lineHeight: 1.5,
                    background: isUser ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : '#f1f5f9',
                    color: isUser ? '#fff' : '#334155',
                    border: `1px solid ${isUser ? '#2563eb' : '#e2e8f0'}`,
                    wordBreak: 'break-word',
                  }}>
                    {editingMessageId === msg.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
                        <textarea
                          value={editingMessageText}
                          onChange={e => setEditingMessageText(e.target.value)}
                          style={{
                            width: '100%',
                            minHeight: '60px',
                            padding: '6px',
                            borderRadius: '6px',
                            border: '1px solid #bfdbfe',
                            fontSize: '11px',
                            color: '#334155',
                            outline: 'none',
                            fontFamily: 'inherit',
                            resize: 'none',
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSaveAndResubmit(msg.id, editingMessageText);
                            }
                          }}
                        />
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => { setEditingMessageId(null); setEditingMessageText(''); }}
                            style={{
                              fontSize: '9px', fontWeight: 650, padding: '3px 8px',
                              background: '#f1f5f9', border: 'none', borderRadius: '4px',
                              color: '#475569', cursor: 'pointer',
                            }}
                          >
                            Hủy
                          </button>
                          <button
                            onClick={() => handleSaveAndResubmit(msg.id, editingMessageText)}
                            style={{
                              fontSize: '9px', fontWeight: 700, padding: '3px 8px',
                              background: '#3b82f6', border: 'none', borderRadius: '4px',
                              color: '#fff', cursor: 'pointer',
                            }}
                          >
                            Lưu & Gửi
                          </button>
                        </div>
                      </div>
                    ) : isStreaming ? (
                      <div style={{ display: 'flex', gap: '4px', padding: '2px 0' }}>
                        <div style={{ width: '6px', height: '6px', background: '#6366f1', borderRadius: '50%', animation: 'bounce 1s infinite' }} />
                        <div style={{ width: '6px', height: '6px', background: '#6366f1', borderRadius: '50%', animation: 'bounce 1s infinite 0.2s' }} />
                        <div style={{ width: '6px', height: '6px', background: '#6366f1', borderRadius: '50%', animation: 'bounce 1s infinite 0.4s' }} />
                      </div>
                    ) : (
                      renderMessageContent(msg.content, isUser)
                    )}
                  </div>
                  {/* Action buttons below message */}
                  {!isUser && !isStreaming && msg.content && (
                    <button
                      onClick={() => handleCopyMessage(msg.id, msg.content)}
                      style={{
                        background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px',
                        color: copiedMsgId === msg.id ? '#10b981' : '#94a3b8',
                        cursor: 'pointer', padding: '2px 7px',
                        display: 'flex', alignItems: 'center', gap: '3px',
                        fontSize: '9px', fontWeight: 600,
                        transition: 'all 0.15s',
                        opacity: 0.7,
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '0.7'}
                      title="Sao chép nội dung"
                    >
                      {copiedMsgId === msg.id ? (
                        <><CheckCheck className="w-3 h-3" /> Đã sao chép</>
                      ) : (
                        <><Copy className="w-3 h-3" /> Sao chép</>
                      )}
                    </button>
                  )}
                </div>
                {isUser && editingMessageId !== msg.id && (
                  <button
                    onClick={() => {
                      setEditingMessageId(msg.id);
                      setEditingMessageText(msg.content);
                    }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      opacity: 0.35, fontSize: '10px', padding: '2px',
                      transition: 'opacity 0.15s, transform 0.15s',
                      alignSelf: 'center', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.transform = 'scale(1.15)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.35'; (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                    title="Chỉnh sửa câu hỏi này"
                  >
                    ✏️
                  </button>
                )}
              </div>
              );
            })
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '24px 16px',
              height: '100%',
            }}>
              {/* Bot Avatar */}
              <div style={{
                width: '52px', height: '52px',
                background: focusLesson
                  ? 'linear-gradient(135deg, #f59e0b, #f97316)'
                  : 'linear-gradient(135deg, #3b82f6, #6366f1)',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '10px',
                boxShadow: focusLesson
                  ? '0 4px 16px rgba(245,158,11,0.3)'
                  : '0 4px 16px rgba(99,102,241,0.25)',
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="6" width="18" height="13" rx="3" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5"/>
                  <circle cx="8.5" cy="12.5" r="1.5" fill="white"/>
                  <circle cx="15.5" cy="12.5" r="1.5" fill="white"/>
                  <path d="M9 16c1-1 5-1 6 0" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                  <path d="M9 3L12 6M15 3L12 6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="12" cy="6" r="1" fill="white"/>
                </svg>
              </div>

              {focusLesson ? (
                <>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    background: '#fffbeb', border: '1px solid #fde68a',
                    borderRadius: '20px', padding: '3px 10px',
                    fontSize: '9px', fontWeight: 700, color: '#b45309',
                    marginBottom: '6px', letterSpacing: '0.3px'
                  }}>
                    📄 Ngữ cảnh tài liệu
                  </div>
                  <h3 style={{ fontWeight: 800, color: '#1e293b', fontSize: '13px', margin: '0 0 4px 0', lineHeight: 1.3 }}>
                    Trợ lý AI đang tập trung vào:
                  </h3>
                  <p style={{
                    fontSize: '12px', fontWeight: 700, color: '#f59e0b',
                    margin: '0 0 6px 0', lineHeight: 1.3,
                    maxWidth: '220px',
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {focusLesson.title}
                  </p>
                  <p style={{ fontSize: '10px', color: '#94a3b8', maxWidth: '200px', margin: '0 0 14px 0', lineHeight: 1.4 }}>
                    Tôi đã phân tích bài giảng này. Hãy đặt câu hỏi về nội dung, phương pháp hoặc tìm tài liệu liên quan.
                  </p>
                </>
              ) : (
                <>
                  <h3 style={{ fontWeight: 800, color: '#1e293b', fontSize: '13px', margin: '0 0 4px 0' }}>Hỏi Trợ lý AI RAG!</h3>
                  <p style={{ fontSize: '11px', color: '#94a3b8', maxWidth: '200px', margin: '0 0 14px 0', lineHeight: 1.4 }}>
                    Đặt câu hỏi về bất kỳ tài liệu nào trong hệ thống.
                  </p>
                </>
              )}

              {/* Suggested Questions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                {(focusLesson
                  ? suggestedQuestions.length > 0
                    ? suggestedQuestions.slice(0, 3)
                    : [
                        `Tóm tắt hoạt động dạy học của bài "${focusLesson.title}"?`,
                        `Phương pháp sư phạm phù hợp cho bài "${focusLesson.title}"?`,
                        `Tìm tài liệu tương tự hoặc liên quan đến bài giảng này?`
                      ]
                  : suggestedQuestions.slice(0, 3)
                ).map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(q)}
                    style={{
                      fontSize: '10px',
                      padding: '8px 10px',
                      background: focusLesson ? '#fffbeb' : '#f8fafc',
                      border: `1px solid ${focusLesson ? '#fde68a' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      color: focusLesson ? '#92400e' : '#475569',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontWeight: 500,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = focusLesson ? '#fef3c7' : '#eff6ff';
                      (e.currentTarget as HTMLElement).style.borderColor = focusLesson ? '#f59e0b' : '#bfdbfe';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = focusLesson ? '#fffbeb' : '#f8fafc';
                      (e.currentTarget as HTMLElement).style.borderColor = focusLesson ? '#fde68a' : '#e2e8f0';
                    }}
                  >
                    {focusLesson ? '🎯' : '💡'} {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick suggestions */}
        {activeSession && activeSession.messages && activeSession.messages.length > 0 && (
          <div style={{
            padding: '6px 12px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', flexShrink: 0 }}>Gợi ý:</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: 1, justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {suggestedQuestions.slice(0, 2).map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(q)}
                    style={{
                      fontSize: '9px',
                      fontWeight: 600,
                      padding: '4px 8px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      color: '#3b82f6',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#eff6ff'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
                  >
                    {q}
                  </button>
                ))}
              </div>
              {activeSession.messages.filter(m => m.sender_role === 'USER').length > 0 && (
                <button
                  onClick={handleRemakePreviousQuestion}
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '4px 8px',
                    background: '#fff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '6px',
                    color: '#3b82f6',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    boxShadow: '0 1px 2px rgba(59, 130, 246, 0.05)',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#eff6ff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; }}
                  title="Làm lại câu hỏi trước đó"
                >
                  🔄 Làm lại câu trước
                </button>
              )}
            </div>
          </div>
        )}

        {/* Input */}
        <div style={{
          borderTop: '1px solid #e2e8f0',
          padding: '10px 12px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          flexShrink: 0,
          background: '#fff',
        }}>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={focusLesson ? `Hỏi về "${focusLesson.title}"...` : "Hỏi AI hoặc tìm kiếm RAG..."}
            disabled={!activeSession || sending}
            style={{
              flexGrow: 1,
              padding: '8px 12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              fontSize: '12px',
              color: '#1e293b',
              outline: 'none',
              transition: 'border-color 0.15s',
              fontWeight: 500,
              opacity: (!activeSession || sending) ? 0.5 : 1,
            }}
            onFocus={e => { (e.target as HTMLElement).style.borderColor = '#3b82f6'; }}
            onBlur={e => { (e.target as HTMLElement).style.borderColor = '#e2e8f0'; }}
          />
          {sending ? (
            <button
              onClick={handleStopResponse}
              style={{
                padding: '8px 12px',
                background: '#ef4444',
                color: '#fff',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 700,
                flexShrink: 0,
                transition: 'all 0.15s',
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                gap: '4px'
              }}
              title="Dừng câu trả lời"
            >
              <X className="w-3.5 h-3.5" /> Dừng
            </button>
          ) : (
            <button
              onClick={() => handleSendMessage()}
              disabled={!activeSession || !inputMessage.trim()}
              style={{
                padding: '8px',
                background: (!activeSession || !inputMessage.trim()) ? '#cbd5e1' : 'linear-gradient(135deg, #3b82f6, #6366f1)',
                color: '#fff',
                borderRadius: '10px',
                border: 'none',
                cursor: (!activeSession || !inputMessage.trim()) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.15s',
                boxShadow: (!activeSession || !inputMessage.trim()) ? 'none' : '0 2px 8px rgba(59, 130, 246, 0.3)',
              }}
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
