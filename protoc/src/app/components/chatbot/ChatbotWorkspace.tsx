import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Drawer } from 'antd';
import { 
  Bot, X, MessageSquare, GripVertical, FileText, Settings, Network, Minus
} from 'lucide-react';

import ChatTab from './ChatTab';
import GraphTab from './GraphTab';
import WikiNotesTab from './WikiNotesTab';
import SettingsTab from './SettingsTab';
import WikiHistoryModal from './WikiHistoryModal';

interface ChatMessage {
  id: number;
  sender_role: 'USER' | 'AI';
  content: string;
  created_at: string;
}

interface ChatSession {
  id: number;
  title: string;
  lesson_plan?: number | null;
  lesson_plan_title?: string | null;
  created_at: string;
  messages?: ChatMessage[];
}

interface ChatbotWorkspaceProps {
  directories: any[];
  currentUser: any;
  onBack: () => void;
  onSuccess: () => void;
  onRefreshDirs: () => void;
  lessonPlans: any[];
  focusLessonId?: number | null;
  setFocusLessonId?: (id: number | null) => void;
  onViewLessonDetail?: (lesson: any, highlightQuery?: string) => void;
  isDetailOpen?: boolean;
  chatbotOpenTrigger?: number;
  onSelectDirectory?: (dirId: number) => void;
}

interface ChatContainerProps {
  children: React.ReactNode;
  isMobile: boolean;
  isOpen: boolean;
  onClose: () => void;
  widgetSize: { width: number; height: number };
}

const ChatContainer = ({ children, isMobile, isOpen, onClose, widgetSize }: ChatContainerProps) => {
  if (isMobile) {
    return (
      <Drawer
        placement="right"
        closable={false}
        onClose={onClose}
        open={isOpen}
        width="100%"
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#fff' }}>
          {children}
        </div>
      </Drawer>
    );
  }
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9998,
        width: `${widgetSize.width}px`,
        height: `${widgetSize.height}px`,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 80px)',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'chatSlideUp 0.25s ease-out',
      }}
    >
      {children}
    </div>
  );
};

export default function ChatbotWorkspace({
  directories,
  currentUser,
  onBack,
  onSuccess,
  onRefreshDirs,
  lessonPlans,
  focusLessonId: initialFocusLessonId = null,
  setFocusLessonId,
  onViewLessonDetail,
  isDetailOpen = false,
  chatbotOpenTrigger = 0,
  onSelectDirectory
}: ChatbotWorkspaceProps) {
  // --- STATES & REFS ---
  const [isOpen, setIsOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [showContinueDialog, setShowContinueDialog] = useState<{ session: ChatSession } | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'graph' | 'wiki' | 'settings'>('chat');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editingTitleText, setEditingTitleText] = useState<string>('');
  const [namingLoaderId, setNamingLoaderId] = useState<number | null>(null);
  // Focused Document States
  const [focusLessonId, setFocusLessonIdState] = useState<number | null>(initialFocusLessonId);
  const focusLesson = useMemo(() => {
    if (!focusLessonId) return null;
    return lessonPlans.find(l => l.id === focusLessonId) || null;
  }, [focusLessonId, lessonPlans]);

  const [pendingSyncLessonId, setPendingSyncLessonId] = useState<number | null>(null);
  const [showSyncBanner, setShowSyncBanner] = useState<boolean>(false);

  // Context-aware dynamic suggested questions
  const suggestedQuestions = useMemo(() => {
    if (focusLesson) {
      return [
        `Tóm tắt nội dung bài học "${focusLesson.title}"?`,
        `Các mục tiêu kiến thức quan trọng của bài "${focusLesson.title}"?`,
        `Đề xuất phương pháp giảng dạy hiệu quả cho bài "${focusLesson.title}"?`
      ];
    }
    const publishedLessons = lessonPlans.filter(l => l.status === 'PUBLISHED');
    const totalCount = publishedLessons.length;
    const suggestions: string[] = [];
    suggestions.push(`Hệ thống hiện tại đang lưu trữ bao nhiêu tài liệu? (Thực tế: ${totalCount} giáo án đã xuất bản)`);
    if (totalCount > 0) {
      const firstLesson = publishedLessons[0];
      suggestions.push(`Tóm tắt nội dung giáo án "${firstLesson.title}"?`);
    } else {
      suggestions.push("AI có thể giúp tôi trả lời những thông tin gì về hệ thống tài liệu?");
    }
    if (totalCount > 1) {
      const secondLesson = publishedLessons[1];
      suggestions.push(`Có những tài liệu nào liên kết kiến thức với bài "${secondLesson.title}" không?`);
    } else {
      suggestions.push("Làm thế nào để tránh trùng lặp khi đăng tải giáo án mới lên hệ thống?");
    }
    return suggestions;
  }, [focusLesson, lessonPlans]);

  // Model & API Settings States
  const [aiMode, setAiMode] = useState<'local' | 'api'>(() => {
    return (localStorage.getItem('kms_ai_mode') as 'local' | 'api') || 'local';
  });
  const [localModel, setLocalModel] = useState<'3b' | '7b'>(() => {
    return (localStorage.getItem('kms_local_model') as '3b' | '7b') || '3b';
  });
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('kms_api_key') || '';
  });
  const [apiModel, setApiModel] = useState(() => {
    return localStorage.getItem('kms_api_model') || 'gemini-1.5-flash';
  });
  const [ragDepth, setRagDepth] = useState<number>(() => {
    return parseInt(localStorage.getItem('kms_rag_depth') || '2');
  });
  const [apiBaseUrl, setApiBaseUrl] = useState(() => {
    return localStorage.getItem('kms_api_base_url') || import.meta.env.VITE_API_BASE_URL || '';
  });

  // --- WIKINOTE EDIT & HISTORY STATES ---
  const [isEditingWiki, setIsEditingWiki] = useState(false);
  const [wikiEditText, setWikiEditText] = useState('');
  const [savingWiki, setSavingWiki] = useState(false);
  const [regeneratingWiki, setRegeneratingWiki] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [wikiHistory, setWikiHistory] = useState<any[]>([]);
  const [loadingWikiHistory, setLoadingWikiHistory] = useState(false);

  const [showHistorySidebar, setShowHistorySidebar] = useState(true);
  const [historySidebarWidth, setHistorySidebarWidth] = useState(() => {
    const saved = localStorage.getItem('kms_history_sidebar_width');
    return saved ? parseInt(saved, 10) : 180;
  });

  useEffect(() => {
    localStorage.setItem('kms_history_sidebar_width', String(historySidebarWidth));
  }, [historySidebarWidth]);

  // --- BACKGROUND PROCESS & SETTINGS STATES ---
  const [bgTasksStatus, setBgTasksStatus] = useState<any>(null);
  const [chunkingConfig, setChunkingConfig] = useState<any>({
    chunk_strategy: 'heading',
    chunk_size: 1000,
    chunk_overlap: 200
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // --- OBSIDIAN WIKINOTES VIEWER STATES ---
  const [obsidianNotes, setObsidianNotes] = useState<any[]>([]);
  const [obsidianLessonNotes, setObsidianLessonNotes] = useState<any[]>([]);
  const [loadingNotesList, setLoadingNotesList] = useState<boolean>(false);
  const [wikiFilterMode, setWikiFilterMode] = useState<'lesson' | 'all'>('lesson');
  const [wikiSearchQuery, setWikiSearchQuery] = useState<string>('');
  const currentNotes = useMemo(() => {
    let notes = (focusLessonId && wikiFilterMode === 'lesson') ? obsidianLessonNotes : obsidianNotes;
    if (wikiSearchQuery.trim()) {
      const q = wikiSearchQuery.toLowerCase();
      notes = notes.filter((n: any) => 
        (n.title && n.title.toLowerCase().includes(q))
      );
    }
    return notes;
  }, [focusLessonId, wikiFilterMode, obsidianNotes, obsidianLessonNotes, wikiSearchQuery]);
  const [selectedObsidianNote, setSelectedObsidianNote] = useState<any | null>(null);
  const [obsidianNoteContent, setObsidianNoteContent] = useState<string>('');
  const [loadingNote, setLoadingNote] = useState<boolean>(false);

  const parsedSubject = useMemo(() => {
    if (!obsidianNoteContent) return null;
    const match = obsidianNoteContent.match(/subject:\s*"(.*?)"/);
    return match ? match[1] : null;
  }, [obsidianNoteContent]);

  const cleanContentStr = useCallback((content: string) => {
    if (!content) return '';
    return content.replace(/^---[\s\S]*?---\s*/, '');
  }, []);

  const [activeRetrievedNodeIds, setActiveRetrievedNodeIds] = useState<string[]>([]);

  // Navigation history stack to go back (e.g. from WikiNote back to Chat or Graph)
  const [historyStack, setHistoryStack] = useState<Array<{ type: 'wiki' | 'lesson' | 'tab'; data: any }>>([]);

  const pushCurrentViewToHistory = useCallback(() => {
    if (selectedObsidianNote) {
      setHistoryStack(prev => {
        if (prev.length > 0 && prev[prev.length - 1].type === 'wiki' && prev[prev.length - 1].data.filename === selectedObsidianNote.filename) {
          return prev;
        }
        return [...prev, { type: 'wiki', data: selectedObsidianNote }];
      });
    } else if (focusLessonId) {
      setHistoryStack(prev => {
        if (prev.length > 0 && prev[prev.length - 1].type === 'lesson' && prev[prev.length - 1].data.id === focusLessonId) {
          return prev;
        }
        return [...prev, { type: 'lesson', data: { id: focusLessonId } }];
      });
    }
  }, [selectedObsidianNote, focusLessonId]);

  // Floating AI Button drag-and-drop state
  const [btnPos, setBtnPos] = useState<{ x: number | null; y: number | null }>(() => {
    const saved = localStorage.getItem('kms_ai_btn_pos');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return { x: null, y: null };
  });
  const isDraggingBtn = useRef(false);
  const dragStartBtn = useRef({ mouseX: 0, mouseY: 0, btnX: 0, btnY: 0, distance: 0 });

  // Save Settings to LocalStorage
  useEffect(() => {
    localStorage.setItem('kms_ai_mode', aiMode);
    localStorage.setItem('kms_local_model', localModel);
    localStorage.setItem('kms_api_key', apiKey);
    localStorage.setItem('kms_api_model', apiModel);
    localStorage.setItem('kms_rag_depth', String(ragDepth));
    localStorage.setItem('kms_api_base_url', apiBaseUrl);
  }, [aiMode, localModel, apiKey, apiModel, ragDepth, apiBaseUrl]);

  // Keep chatbot button within viewport bounds on resize
  useEffect(() => {
    const clampBtnPos = () => {
      setBtnPos(prev => {
        if (prev.x === null || prev.y === null) return prev;
        const maxX = window.innerWidth - 72;
        const maxY = window.innerHeight - 72;
        const clampedX = Math.min(Math.max(16, prev.x), maxX);
        const clampedY = Math.min(Math.max(16, prev.y), maxY);
        if (clampedX !== prev.x || clampedY !== prev.y) {
          return { x: clampedX, y: clampedY };
        }
        return prev;
      });
    };
    clampBtnPos();
    window.addEventListener('resize', clampBtnPos);
    return () => window.removeEventListener('resize', clampBtnPos);
  }, []);

  // Listen for text selection custom event to trigger Quick QA
  useEffect(() => {
    const handleAskTextSelection = (e: Event) => {
      const customEvent = e as CustomEvent;
      const text = customEvent.detail?.text;
      const lessonTitle = customEvent.detail?.lessonTitle;
      const lessonId = customEvent.detail?.lessonId;
      if (!text) return;

      if (lessonId) {
        setFocusLessonIdState(lessonId);
      }
      setIsOpen(true);
      setActiveTab('chat');
      
      const promptText = `Giải thích đoạn văn bản này trong bài giảng "${lessonTitle || 'đang chọn'}": "${text}"`;
      setInputMessage(promptText);
    };

    window.addEventListener('kms_ask_text_selection', handleAskTextSelection);
    return () => window.removeEventListener('kms_ask_text_selection', handleAskTextSelection);
  }, []);

  // Sync endpoint URLs for axios defaults dynamically
  useEffect(() => {
    if (apiBaseUrl) {
      axios.defaults.baseURL = apiBaseUrl;
    } else {
      axios.defaults.baseURL = '';
    }
  }, [apiBaseUrl]);

  // --- API CALL METHODS ---
  const fetchObsidianNotesList = useCallback(async () => {
    setLoadingNotesList(true);
    try {
      const res = await axios.get('/api/obsidian/notes/');
      setObsidianNotes(res.data);
    } catch (err) {
      console.error('Error fetching Obsidian notes list:', err);
    } finally {
      setLoadingNotesList(false);
    }
  }, []);

  const fetchObsidianLessonNotes = useCallback(async (lessonId: number) => {
    setLoadingNotesList(true);
    try {
      const res = await axios.get(`/api/obsidian/notes/by-lesson/?lesson_id=${lessonId}`);
      setObsidianLessonNotes(res.data);
    } catch (err) {
      console.error('Error fetching Obsidian lesson notes:', err);
    } finally {
      setLoadingNotesList(false);
    }
  }, []);

  const fetchNoteContent = useCallback(async (note: any, skipPush = false) => {
    if (!note) return;
    setLoadingNote(true);
    if (!skipPush) {
      pushCurrentViewToHistory();
    }
    setSelectedObsidianNote(note);
    setIsEditingWiki(false);
    try {
      const res = await axios.get(`/api/obsidian/notes/content/?filename=${encodeURIComponent(note.filename)}`);
      setObsidianNoteContent(res.data.content);
      setWikiEditText(res.data.content);
    } catch (err) {
      console.error('Error fetching Obsidian note content:', err);
      setObsidianNoteContent('Không thể tải nội dung ghi chú.');
    } finally {
      setLoadingNote(false);
    }
  }, [pushCurrentViewToHistory]);



  const loadSessionDetails = useCallback(async (sessionId: number) => {
    setLoadingHistory(true);
    try {
      const res = await axios.get(`/api/chat-sessions/${sessionId}/`);
      setActiveSession(res.data);
      // Cập nhật list session title nếu cần
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: res.data.title } : s));
    } catch (err) {
      console.error('Error loading session details:', err);
    } finally {
      setLoadingHistory(false);
      setIsInitializing(false);
    }
  }, []);

  const handleCreateSession = useCallback(async (lessonId?: number) => {
    if (!currentUser) return;
    try {
      const title = lessonId
        ? `Hỏi đáp về: ${lessonPlans.find(l => l.id === lessonId)?.title || 'Giáo án'}`
        : `Cuộc trò chuyện mới ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
      
      const res = await axios.post('/api/chat-sessions/', {
        user: currentUser.id,
        title,
        lesson_plan: lessonId || null
      });
      
      setSessions(prev => [res.data, ...prev]);
      setActiveSession(res.data);
      return res.data;
    } catch (err) {
      console.error('Error creating session:', err);
    }
  }, [currentUser, lessonPlans]);

  const handleDeleteSession = useCallback(async (sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc chắn muốn xóa cuộc hội thoại này không?')) return;
    try {
      await axios.delete(`/api/chat-sessions/${sessionId}/`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSession && activeSession.id === sessionId) {
        setActiveSession(null);
      }
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  }, [activeSession]);

  const handleSaveTitle = useCallback(async (sessionId: number, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      await axios.put(`/api/chat-sessions/${sessionId}/`, {
        title: newTitle,
        user: currentUser?.id
      });
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: newTitle } : s));
      if (activeSession && activeSession.id === sessionId) {
        setActiveSession(prev => prev ? { ...prev, title: newTitle } : null);
      }
      setEditingSessionId(null);
    } catch (err) {
      console.error('Error saving title:', err);
    }
  }, [currentUser, activeSession]);

  const handleAutoName = useCallback(async (sessionId: number) => {
    setNamingLoaderId(sessionId);
    try {
      const res = await axios.post(`/api/chat-sessions/${sessionId}/auto-name/`, {
        ai_mode: aiMode,
        local_model: localModel,
        api_key: apiKey,
        api_model: apiModel
      });
      const generatedTitle = res.data.title;
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: generatedTitle } : s));
      if (activeSession && activeSession.id === sessionId) {
        setActiveSession(prev => prev ? { ...prev, title: generatedTitle } : null);
      }
      setEditingSessionId(null);
    } catch (err) {
      alert('Không thể tự động đặt tên. Hãy chắc chắn cuộc hội thoại đã có tin nhắn.');
    } finally {
      setNamingLoaderId(null);
    }
  }, [aiMode, localModel, apiKey, apiModel, activeSession]);

  const handleFetchWikiHistory = async () => {
    if (!selectedObsidianNote) return;
    setLoadingWikiHistory(true);
    setShowHistoryModal(true);
    try {
      const res = await axios.get(`/api/obsidian/notes/history/?filename=${encodeURIComponent(selectedObsidianNote.filename)}`);
      setWikiHistory(res.data);
    } catch (err) {
      console.error('Error fetching wiki note history:', err);
    } finally {
      setLoadingWikiHistory(false);
    }
  };

  const handleGoBack = useCallback(() => {
    if (historyStack.length === 0) return;
    const last = historyStack[historyStack.length - 1];
    setHistoryStack(prev => prev.slice(0, -1));

    if (last.type === 'lesson') {
      if (onViewLessonDetail) {
        if (!last.data.title) {
          axios.get(`/api/lesson-plans/${last.data.id}/?user_id=${currentUser?.id}`)
            .then(res => {
              onViewLessonDetail(res.data);
            });
        } else {
          onViewLessonDetail(last.data);
        }
        setIsOpen(true);
      }
    } else if (last.type === 'wiki') {
      fetchNoteContent(last.data, true);
      setActiveTab('wiki');
      setIsOpen(true);
    } else if (last.type === 'tab') {
      setActiveTab(last.data);
      setIsOpen(true);
    }
  }, [historyStack, onViewLessonDetail, currentUser, fetchNoteContent]);

  // Load configuration on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await axios.get('/api/system-settings/');
        setChunkingConfig(res.data);
      } catch (err) {
        console.error('Error fetching chunking configuration:', err);
      }
    };
    fetchConfig();
  }, []);

  // Poll background process status every 2 seconds when open
  useEffect(() => {
    if (!isOpen) return;
    const fetchStatus = async () => {
      try {
        const res = await axios.get('/api/bg-tasks/status/');
        setBgTasksStatus(res.data);
      } catch (err) {
        console.error('Error fetching bg tasks status:', err);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Check user permission
  const checkHasEditPermission = () => {
    if (!currentUser) return false;
    return currentUser.role === 'ADMIN' || currentUser.role === 'TEACHER';
  };

  const wasOpenRef = useRef(false);

  // Sync internal focusLessonId state when the prop changes from the parent
  useEffect(() => {
    if (isOpen) {
      if (!wasOpenRef.current) {
        // If chatbot was closed/minimized and just opened, sync automatically to the active card context
        setFocusLessonIdState(initialFocusLessonId);
        setPendingSyncLessonId(null);
        setShowSyncBanner(false);
      } else {
        // If chatbot was already open and user switched cards, offer manual sync suggestion
        if (initialFocusLessonId !== focusLessonId) {
          setPendingSyncLessonId(initialFocusLessonId);
          setShowSyncBanner(true);
        } else {
          setPendingSyncLessonId(null);
          setShowSyncBanner(false);
        }
      }
    } else {
      // If chatbot is closed/hidden, sync immediately in background
      setFocusLessonIdState(initialFocusLessonId);
      setPendingSyncLessonId(null);
      setShowSyncBanner(false);
    }
    wasOpenRef.current = isOpen;
  }, [initialFocusLessonId, isOpen, focusLessonId]);

  const handleSyncContext = useCallback(() => {
    setFocusLessonIdState(pendingSyncLessonId);
    setPendingSyncLessonId(null);
    setShowSyncBanner(false);
  }, [pendingSyncLessonId]);

  // Synchronize active chat session with the focusLessonId state dynamically
  useEffect(() => {
    if (!isOpen || !currentUser) return;

    // Reset input message upon card entry/exit
    setInputMessage('');

    let active = true;

    const syncSession = async () => {
      setLoadingHistory(true);
      try {
        const res = await axios.get(`/api/chat-sessions/?user_id=${currentUser.id}`);
        if (!active) return;
        setSessions(res.data);

        const matching = res.data.find((s: any) => s.lesson_plan === focusLessonId);
        if (matching) {
          const detailRes = await axios.get(`/api/chat-sessions/${matching.id}/`);
          if (!active) return;
          setActiveSession(detailRes.data);
        } else {
          if (focusLessonId) {
            const lesson = lessonPlans.find(l => l.id === focusLessonId);
            const title = lesson ? `Hỏi đáp về: ${lesson.title}` : 'Cuộc trò chuyện mới';
            const createRes = await axios.post('/api/chat-sessions/', {
              user_id: currentUser.id,
              lesson_plan_id: focusLessonId,
              title: title
            });
            if (!active) return;
            setSessions(prev => [createRes.data, ...prev]);
            setActiveSession(createRes.data);
          } else {
            const generalSession = res.data.find((s: any) => !s.lesson_plan);
            if (generalSession) {
              const detailRes = await axios.get(`/api/chat-sessions/${generalSession.id}/`);
              if (!active) return;
              setActiveSession(detailRes.data);
            } else if (res.data.length > 0) {
              const detailRes = await axios.get(`/api/chat-sessions/${res.data[0].id}/`);
              if (!active) return;
              setActiveSession(detailRes.data);
            } else {
              const createRes = await axios.post('/api/chat-sessions/', {
                user_id: currentUser.id,
                title: 'Cuộc trò chuyện mới'
              });
              if (!active) return;
              setSessions([createRes.data]);
              setActiveSession(createRes.data);
            }
          }
        }
      } catch (err) {
        console.error('Error syncing chat sessions:', err);
      } finally {
        if (active) {
          setLoadingHistory(false);
          setIsInitializing(false);
        }
      }
    };

    syncSession();

    return () => {
      active = false;
    };
  }, [focusLessonId, isOpen, currentUser, lessonPlans]);

  // Fetch Obsidian WikiNotes lists when chatbot is open
  useEffect(() => {
    if (isOpen && currentUser) {
      fetchObsidianNotesList();
      if (focusLessonId) {
        fetchObsidianLessonNotes(focusLessonId);
      }
    }
  }, [isOpen, focusLessonId, currentUser, apiBaseUrl, fetchObsidianNotesList, fetchObsidianLessonNotes]);

  // Stop response stream
  const cancelSourceRef = useRef<any>(null);
  const handleStopResponse = () => {
    if (cancelSourceRef.current) {
      cancelSourceRef.current.cancel('User canceled response');
      setSending(false);
    }
  };

  // Send message
  const handleSendMessage = async (msgText?: string) => {
    const textToSend = msgText || inputMessage;
    if (!textToSend.trim() || !activeSession || sending) return;

    setInputMessage('');
    setSending(true);

    const userMsgTemp: ChatMessage = {
      id: Date.now(),
      sender_role: 'USER',
      content: textToSend,
      created_at: new Date().toISOString()
    };
    setActiveSession(prev => prev ? { ...prev, messages: [...(prev.messages || []), userMsgTemp] } : null);

    const aiMsgTemp: ChatMessage = {
      id: Date.now() + 1,
      sender_role: 'AI',
      content: '',
      created_at: new Date().toISOString()
    };
    setActiveSession(prev => prev ? { ...prev, messages: [...(prev.messages || []), aiMsgTemp] } : null);
    cancelSourceRef.current = axios.CancelToken.source();

    try {
      const res = await axios.post(`/api/chat-sessions/${activeSession.id}/send/`, {
        message: textToSend,
        model_choice: aiMode === 'api' ? 'api' : localModel,
        api_key: apiKey,
        model_name: apiModel,
        focus_lesson_id: focusLessonId
      }, {
        cancelToken: cancelSourceRef.current.token
      });

      let fullContent = '';
      let retrievedNodeIds: string[] = [];
      let sessionTitle = '';

      const lines = (res.data || '').split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.substring(6).trim();
            if (jsonStr) {
              const payload = JSON.parse(jsonStr);
              if (payload.type === 'text') {
                fullContent += payload.content;
              } else if (payload.type === 'meta') {
                sessionTitle = payload.session_title;
                if (payload.retrieved_node_ids) {
                  retrievedNodeIds = payload.retrieved_node_ids;
                } else if (payload.retrieved_graph && payload.retrieved_graph.nodes) {
                  retrievedNodeIds = payload.retrieved_graph.nodes.map((n: any) => n.id);
                }
              } else if (payload.type === 'done') {
                if (payload.message && payload.message.content) {
                  fullContent = payload.message.content;
                }
                sessionTitle = payload.session_title;
              }
            }
          } catch (e) {
            console.error('Error parsing SSE line:', e, line);
          }
        }
      }

      if (retrievedNodeIds.length > 0) {
        setActiveRetrievedNodeIds(retrievedNodeIds);
      }

      setActiveSession(prev => {
        if (!prev || !prev.messages) return prev;
        return {
          ...prev,
          title: sessionTitle || prev.title,
          messages: prev.messages.map(m => m.id === aiMsgTemp.id ? { ...m, content: fullContent } : m)
        };
      });

      // Reload notes list and history just in case RAG updated
      fetchObsidianNotesList();
      if (focusLessonId) {
        fetchObsidianLessonNotes(focusLessonId);
      }
    } catch (err) {
      if (axios.isCancel(err)) {
        console.log('Request canceled:', err.message);
      } else {
        setActiveSession(prev => {
          if (!prev || !prev.messages) return prev;
          return {
            ...prev,
            messages: prev.messages.map(m => m.id === aiMsgTemp.id ? { ...m, content: '❌ Lỗi kết nối AI hoặc hết thời gian chờ.' } : m)
          };
        });
      }
    } finally {
      setSending(false);
      cancelSourceRef.current = null;
    }
  };

  const handleSaveWikiNote = async () => {
    if (!selectedObsidianNote) return;
    setSavingWiki(true);
    try {
      await axios.put('/api/obsidian/notes/save/', {
        filename: selectedObsidianNote.filename,
        content: wikiEditText,
        edited_by: currentUser?.full_name || currentUser?.username || 'Giaovien'
      });
      setIsEditingWiki(false);
      setObsidianNoteContent(wikiEditText);
      fetchObsidianNotesList();
      if (focusLessonId) {
        fetchObsidianLessonNotes(focusLessonId);
      }
    } catch (err) {
      alert('Không thể lưu ghi chú. Vui lòng kiểm tra lại.');
    } finally {
      setSavingWiki(false);
    }
  };

  const handleRegenerateWikiNote = async () => {
    if (!selectedObsidianNote) return;
    if (!window.confirm('Bạn có chắc chắn muốn dùng AI để tự động sinh lại toàn bộ nội dung cho ghi chú khái niệm này không?')) return;
    setRegeneratingWiki(true);
    try {
      const res = await axios.post('/api/obsidian/notes/regenerate/', {
        filename: selectedObsidianNote.filename,
        ai_mode: aiMode,
        local_model: localModel,
        api_key: apiKey,
        api_model: apiModel,
        edited_by: currentUser?.full_name || currentUser?.username || 'AI RAG'
      });
      setObsidianNoteContent(res.data.content);
      setWikiEditText(res.data.content);
      fetchObsidianNotesList();
      if (focusLessonId) {
        fetchObsidianLessonNotes(focusLessonId);
      }
    } catch (err) {
      alert('Tạo lại bằng AI thất bại. Vui lòng kiểm tra API Key.');
    } finally {
      setRegeneratingWiki(false);
    }
  };

  const handleSaveChunkingConfig = async (newConfig: any) => {
    setSavingConfig(true);
    try {
      await axios.post('/api/system-settings/', newConfig);
      alert('Đã lưu cấu hình phân mảnh tri thức thành công!');
    } catch (err) {
      alert('Không thể lưu cấu hình. Vui lòng kiểm tra kết nối.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleStopTask = async (lessonId: number) => {
    if (window.confirm('Bạn có chắc chắn muốn dừng quá trình xử lý bài giảng này không?')) {
      try {
        await axios.post('/api/bg-tasks/stop/', { lesson_id: lessonId });
      } catch (err) {
        console.error('Error stopping task:', err);
      }
    }
  };

  const handleReprocess = async (all: boolean) => {
    const confirmMsg = all 
      ? 'Bạn có chắc chắn muốn chạy lại phân tích AI RAG cho TOÀN BỘ tài liệu trong hệ thống?'
      : `Bạn có chắc chắn muốn chạy lại phân tích AI RAG cho riêng bài giảng "${focusLesson?.title}" này?`;
    
    if (confirm(confirmMsg)) {
      try {
        await axios.post('/api/bg-tasks/reprocess/', {
          lesson_id: all ? undefined : focusLessonId,
          ai_mode: aiMode,
          local_model: localModel,
          api_key: apiKey,
          api_model: apiModel
        });
        alert('Đã đưa tài liệu vào hàng chờ tái xử lý!');
      } catch (err) {
        alert('Chạy lại thất bại. Vui lòng kiểm tra kết nối.');
      }
    }
  };

  const handleResume = async () => {
    try {
      await axios.post('/api/bg-tasks/resume/', {
        ai_mode: aiMode,
        local_model: localModel,
        api_key: apiKey,
        api_model: apiModel
      });
      alert('Đã xếp hàng tiếp tục xử lý RAG tại các điểm đã dừng!');
    } catch (err) {
      alert('Tiếp tục chạy thất bại. Vui lòng kiểm tra kết nối.');
    }
  };

  const handleRemakePreviousQuestion = () => {
    if (!activeSession || !activeSession.messages) return;
    const messages = [...activeSession.messages];
    let lastUserIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_role === 'USER') {
        lastUserIndex = i;
        break;
      }
    }
    if (lastUserIndex !== -1) {
      const lastQ = messages[lastUserIndex].content;
      setInputMessage(lastQ);
      const updatedMessages = messages.slice(0, lastUserIndex);
      setActiveSession({
        ...activeSession,
        messages: updatedMessages
      });
    }
  };

  const handleCopyMessage = (id: number, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 1500);
  };

  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingMessageText, setEditingMessageText] = useState<string>('');

  const handleSaveAndResubmit = async (msgId: number, newContent: string) => {
    if (!newContent.trim() || !activeSession || !activeSession.messages) return;
    setEditingMessageId(null);
    setEditingMessageText('');
    setSending(true);

    const messageIndex = activeSession.messages.findIndex(m => m.id === msgId);
    if (messageIndex === -1) return;

    const updatedMessages = activeSession.messages.slice(0, messageIndex + 1).map(m => 
      m.id === msgId ? { ...m, content: newContent } : m
    );

    const aiMsgTemp: ChatMessage = {
      id: Date.now() + 2,
      sender_role: 'AI',
      content: '',
      created_at: new Date().toISOString()
    };
    
    setActiveSession({
      ...activeSession,
      messages: [...updatedMessages, aiMsgTemp]
    });

    cancelSourceRef.current = axios.CancelToken.source();

    try {
      const res = await axios.post(`/api/chat-sessions/${activeSession.id}/send/`, {
        message: newContent,
        model_choice: aiMode === 'api' ? 'api' : localModel,
        api_key: apiKey,
        model_name: apiModel,
        resubmit_message_id: msgId,
        focus_lesson_id: focusLessonId
      }, {
        cancelToken: cancelSourceRef.current.token
      });

      let fullContent = '';
      let retrievedNodeIds: string[] = [];
      let sessionTitle = '';

      const lines = (res.data || '').split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.substring(6).trim();
            if (jsonStr) {
              const payload = JSON.parse(jsonStr);
              if (payload.type === 'text') {
                fullContent += payload.content;
              } else if (payload.type === 'meta') {
                sessionTitle = payload.session_title;
                if (payload.retrieved_node_ids) {
                  retrievedNodeIds = payload.retrieved_node_ids;
                } else if (payload.retrieved_graph && payload.retrieved_graph.nodes) {
                  retrievedNodeIds = payload.retrieved_graph.nodes.map((n: any) => n.id);
                }
              } else if (payload.type === 'done') {
                if (payload.message && payload.message.content) {
                  fullContent = payload.message.content;
                }
                sessionTitle = payload.session_title;
              }
            }
          } catch (e) {
            console.error('Error parsing SSE line:', e, line);
          }
        }
      }

      if (retrievedNodeIds.length > 0) {
        setActiveRetrievedNodeIds(retrievedNodeIds);
      }

      setActiveSession(prev => {
        if (!prev || !prev.messages) return prev;
        return {
          ...prev,
          title: sessionTitle || prev.title,
          messages: prev.messages.map(m => m.id === aiMsgTemp.id ? { ...m, content: fullContent } : m)
        };
      });

      fetchObsidianNotesList();
      if (focusLessonId) {
        fetchObsidianLessonNotes(focusLessonId);
      }
    } catch (err) {
      if (axios.isCancel(err)) {
        console.log('Request canceled:', err.message);
      } else {
        setActiveSession(prev => {
          if (!prev || !prev.messages) return prev;
          return {
            ...prev,
            messages: prev.messages.map(m => m.id === aiMsgTemp.id ? { ...m, content: '❌ Lỗi kết nối AI hoặc hết thời gian chờ.' } : m)
          };
        });
      }
    } finally {
      setSending(false);
      cancelSourceRef.current = null;
    }
  };

  // --- RESIZE STATE ---
  const [widgetSize, setWidgetSize] = useState(() => {
    const saved = localStorage.getItem('kms_chat_size');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { width: parsed.width || 420, height: parsed.height || 580 };
      } catch { /* ignore */ }
    }
    return { width: 420, height: 580 };
  });
  const isResizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    localStorage.setItem('kms_chat_size', JSON.stringify(widgetSize));
  }, [widgetSize]);

  // Floating AI Button drag-and-drop event handlers
  const handleBtnMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return;
    isDraggingBtn.current = true;
    const clientX = e.clientX;
    const clientY = e.clientY;
    const initialX = btnPos.x === null ? window.innerWidth - 72 : btnPos.x;
    const initialY = btnPos.y === null ? (isDetailOpen ? window.innerHeight - 152 : window.innerHeight - 72) : btnPos.y;
    
    dragStartBtn.current = {
      mouseX: clientX,
      mouseY: clientY,
      btnX: initialX,
      btnY: initialY,
      distance: 0
    };
    window.addEventListener('mousemove', handleBtnMouseMove);
    window.addEventListener('mouseup', handleBtnMouseUp);
  };

  const handleBtnMouseMove = (e: MouseEvent) => {
    if (!isDraggingBtn.current) return;
    const dx = e.clientX - dragStartBtn.current.mouseX;
    const dy = e.clientY - dragStartBtn.current.mouseY;
    dragStartBtn.current.distance = Math.sqrt(dx * dx + dy * dy);
    
    const targetX = dragStartBtn.current.btnX + dx;
    const targetY = dragStartBtn.current.btnY + dy;
    
    const maxX = window.innerWidth - 72;
    const maxY = window.innerHeight - 72;
    const clampedX = Math.min(Math.max(16, targetX), maxX);
    const clampedY = Math.min(Math.max(16, targetY), maxY);
    
    setBtnPos({ x: clampedX, y: clampedY });
  };

  const handleBtnMouseUp = () => {
    isDraggingBtn.current = false;
    window.removeEventListener('mousemove', handleBtnMouseMove);
    window.removeEventListener('mouseup', handleBtnMouseUp);
    
    if (dragStartBtn.current.distance < 6) {
      setIsInitializing(true);
      if (initialFocusLessonId) {
        openWithContext(initialFocusLessonId);
      } else {
        setIsOpen(true);
      }
    } else {
      localStorage.setItem('kms_ai_btn_pos', JSON.stringify(btnPos));
    }
  };

  const handleBtnTouchStart = (e: React.TouchEvent) => {
    setIsInitializing(true);
    if (initialFocusLessonId) {
      openWithContext(initialFocusLessonId);
    } else {
      setIsOpen(true);
    }
  };

  const openWithContext = useCallback((lessonId: number) => {
    setFocusLessonIdState(lessonId);
    setIsOpen(true);
  }, []);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      w: widgetSize.width,
      h: widgetSize.height
    };
    window.addEventListener('mousemove', handleResizeMouseMove);
    window.addEventListener('mouseup', handleResizeMouseUp);
  };

  const handleResizeMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const dx = resizeStart.current.x - e.clientX;
    const dy = resizeStart.current.y - e.clientY;
    
    const newW = Math.min(Math.max(340, resizeStart.current.w + dx), window.innerWidth - 48);
    const newH = Math.min(Math.max(480, resizeStart.current.h + dy), window.innerHeight - 100);
    
    setWidgetSize({ width: newW, height: newH });
  };

  const handleResizeMouseUp = () => {
    isResizing.current = false;
    window.removeEventListener('mousemove', handleResizeMouseMove);
    window.removeEventListener('mouseup', handleResizeMouseUp);
  };

  // Sidebar resizer drag event handlers
  const handleSidebarResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = historySidebarWidth;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.min(Math.max(120, startWidth + deltaX), 280);
      setHistorySidebarWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Render WikiLinks parser
  const renderWikiContent = (contentStr: string) => {
    if (!contentStr) return null;
    
    const wikiRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let index = 0;

    while ((match = wikiRegex.exec(contentStr)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`text-${index}`}>{contentStr.substring(lastIndex, match.index)}</span>);
      }

      const noteTitle = match[1].trim();
      const displayText = match[2] ? match[2].trim() : noteTitle;

      const matchedNote = obsidianNotes.find(
        (n) => n.title.toLowerCase() === noteTitle.toLowerCase()
      );

      if (matchedNote) {
        parts.push(
          <button
            key={`link-${index}`}
            type="button"
            onClick={() => fetchNoteContent(matchedNote)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              margin: '0 2px',
              color: '#2563eb',
              textDecoration: 'underline font-semibold',
              cursor: 'pointer',
              display: 'inline',
              fontSize: 'inherit',
            }}
          >
            {displayText}
          </button>
        );
      } else {
        parts.push(<span key={`missing-${index}`} style={{ color: '#94a3b8', fontStyle: 'italic' }}>{displayText}</span>);
      }

      lastIndex = wikiRegex.lastIndex;
      index++;
    }

    if (lastIndex < contentStr.length) {
      parts.push(<span key={`text-end`}>{contentStr.substring(lastIndex)}</span>);
    }

    return parts;
  };

  // --- RENDER ---
  return (
    <div className="font-sans">
      
      {/* 1. FLOATING CHAT TRIGGER BUTTON */}
      {!isOpen && !showContinueDialog && (
        <button
          onMouseDown={handleBtnMouseDown}
          onTouchStart={handleBtnTouchStart}
          onClick={() => {
            if (isMobile) {
              if (initialFocusLessonId) {
                openWithContext(initialFocusLessonId);
              } else {
                setIsOpen(true);
              }
            }
          }}
          style={{
            position: 'fixed',
            left: (isMobile || btnPos.x === null) ? 'auto' : `${btnPos.x}px`,
            top: (isMobile || btnPos.y === null) ? 'auto' : `${btnPos.y}px`,
            right: (isMobile || btnPos.x === null) ? '16px' : 'auto',
            bottom: (isMobile || btnPos.y === null) ? (isDetailOpen ? '96px' : '16px') : 'auto',
            zIndex: 9999,
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            color: '#fff',
            border: 'none',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4), 0 4px 8px rgba(0,0,0,0.1)',
            cursor: isMobile ? 'pointer' : 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => {
            if (!isMobile) {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 12px 28px rgba(99, 102, 241, 0.5), 0 6px 12px rgba(0,0,0,0.15)';
            }
          }}
          onMouseLeave={e => {
            if (!isMobile) {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(99, 102, 241, 0.4), 0 4px 8px rgba(0,0,0,0.1)';
            }
          }}
          title="Trò chuyện với Trợ lý AI"
        >
          {isInitializing ? (
            <div style={{ width: '20px', height: '20px', border: '2px solid #ffffff', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          ) : (
            <Bot className="w-6 h-6 animate-pulse" />
          )}
        </button>
      )}

      {/* 2. FLOATING POPOVER WIDGET */}
      {isOpen && (
        <ChatContainer
          isMobile={isMobile}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          widgetSize={widgetSize}
        >
          {/* Resize Handle (top-left corner) */}
          {!isMobile && (
            <div
              onMouseDown={handleResizeMouseDown}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '20px',
                height: '20px',
                cursor: 'nw-resize',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Kéo để thay đổi kích thước"
            >
              <GripVertical className="w-3.5 h-3.5 text-slate-350 opacity-40 hover:opacity-100 rotate-45" />
            </div>
          )}

          {/* A. HEADER */}
          <div style={{
            padding: '12px 14px',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
            position: 'relative',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: sending ? '#e0f2fe' : '#10b981',
                boxShadow: sending ? '0 0 10px #e0f2fe' : '0 0 10px #10b981',
              }} />
              <h2 style={{ fontSize: '13px', fontWeight: 800, margin: 0, letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                🧠 Hệ Tri thức Số <span style={{ fontSize: '9px', fontWeight: 850, padding: '1px 5px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', color: '#93c5fd' }}>AI RAG</span>
              </h2>
            </div>

            {/* Premium Tab Bar switcher */}
            <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.08)', padding: '2px', borderRadius: '8px', marginRight: '6px' }}>
              {[
                { key: 'chat' as const, label: 'Chat', icon: <MessageSquare className="w-3 h-3" /> },
                { key: 'graph' as const, label: 'Đồ thị', icon: <Network className="w-3 h-3" /> },
                { key: 'wiki' as const, label: 'Wiki', icon: <FileText className="w-3 h-3" /> },
                { key: 'settings' as const, label: 'Cài đặt', icon: <Settings className="w-3 h-3" /> }
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '9.5px',
                    fontWeight: 800,
                    background: activeTab === t.key ? '#3b82f6' : 'transparent',
                    color: activeTab === t.key ? '#fff' : '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    transition: 'all 0.15s',
                  }}
                >
                  {t.icon}
                  {!isMobile && t.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {historyStack.length > 0 && (
                <button
                  onClick={handleGoBack}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '5px',
                    padding: '3px 6px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontWeight: 700
                  }}
                  title="Quay lại trang trước"
                >
                  ↩ Lùi
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                }}
                title="Ẩn trợ lý"
              >
                <Minus className="w-4 h-4 hover:text-white" />
              </button>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setFocusLessonIdState(null);
                  if (setFocusLessonId) setFocusLessonId(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                }}
                title="Tắt hẳn"
              >
                <X className="w-4 h-4 hover:text-white" />
              </button>
            </div>
          </div>

          {/* B. TAB WORKSPACE */}
          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            {activeTab === 'chat' && (
              <ChatTab
                showHistorySidebar={showHistorySidebar}
                setShowHistorySidebar={setShowHistorySidebar}
                historySidebarWidth={historySidebarWidth}
                handleSidebarResizeMouseDown={handleSidebarResizeMouseDown}
                sessions={sessions}
                activeSession={activeSession}
                loadSessionDetails={loadSessionDetails}
                handleCreateSession={handleCreateSession}
                handleDeleteSession={handleDeleteSession}
                editingSessionId={editingSessionId}
                setEditingSessionId={setEditingSessionId}
                editingTitleText={editingTitleText}
                setEditingTitleText={setEditingTitleText}
                handleSaveTitle={handleSaveTitle}
                handleAutoName={handleAutoName}
                namingLoaderId={namingLoaderId}
                loadingHistory={loadingHistory}
                sending={sending}
                inputMessage={inputMessage}
                setInputMessage={setInputMessage}
                handleSendMessage={handleSendMessage}
                handleStopResponse={handleStopResponse}
                currentUser={currentUser}
                focusLesson={focusLesson}
                suggestedQuestions={suggestedQuestions}
                copiedMsgId={copiedMsgId}
                handleCopyMessage={handleCopyMessage}
                editingMessageId={editingMessageId}
                setEditingMessageId={setEditingMessageId}
                editingMessageText={editingMessageText}
                setEditingMessageText={setEditingMessageText}
                handleSaveAndResubmit={handleSaveAndResubmit}
                handleRemakePreviousQuestion={handleRemakePreviousQuestion}
                lessonPlans={lessonPlans}
                onViewLessonDetail={onViewLessonDetail}
                setIsOpen={setIsOpen}
                pushCurrentViewToHistory={pushCurrentViewToHistory}
                setActiveTab={setActiveTab}
                pendingSyncLessonId={pendingSyncLessonId}
                showSyncBanner={showSyncBanner}
                handleSyncContext={handleSyncContext}
              />
            )}

            {activeTab === 'graph' && (
              <GraphTab
                widgetSize={widgetSize}
                focusLessonId={focusLessonId}
                focusLesson={focusLesson}
                currentUser={currentUser}
                isMobile={isMobile}
                setInputMessage={setInputMessage}
                setActiveTab={setActiveTab}
                setIsOpen={setIsOpen}
                isDetailOpen={isDetailOpen}
                onSelectDirectory={onSelectDirectory}
                onViewLessonDetail={onViewLessonDetail}
                lessonPlans={lessonPlans}
                obsidianNotes={obsidianNotes}
                setObsidianNotes={setObsidianNotes}
                fetchNoteContent={fetchNoteContent}
                selectedObsidianNote={selectedObsidianNote}
                pushCurrentViewToHistory={pushCurrentViewToHistory}
                setHistoryStack={setHistoryStack}
                activeRetrievedNodeIds={activeRetrievedNodeIds}
              />
            )}

            {activeTab === 'wiki' && (
              <WikiNotesTab
                isMobile={isMobile}
                selectedObsidianNote={selectedObsidianNote}
                setSelectedObsidianNote={setSelectedObsidianNote}
                currentNotes={currentNotes}
                wikiFilterMode={wikiFilterMode}
                setWikiFilterMode={setWikiFilterMode}
                wikiSearchQuery={wikiSearchQuery}
                setWikiSearchQuery={setWikiSearchQuery}
                fetchNoteContent={fetchNoteContent}
                parsedSubject={parsedSubject}
                checkHasEditPermission={checkHasEditPermission}
                isEditingWiki={isEditingWiki}
                setIsEditingWiki={setIsEditingWiki}
                wikiEditText={wikiEditText}
                setWikiEditText={setWikiEditText}
                handleSaveWikiNote={handleSaveWikiNote}
                savingWiki={savingWiki}
                obsidianNoteContent={obsidianNoteContent}
                handleRegenerateWikiNote={handleRegenerateWikiNote}
                regeneratingWiki={regeneratingWiki}
                handleFetchWikiHistory={handleFetchWikiHistory}
                loadingNote={loadingNote}
                renderWikiContent={renderWikiContent}
                cleanContentStr={cleanContentStr}
                focusLessonId={focusLessonId}
                loadingNotesList={loadingNotesList}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsTab
                currentUser={currentUser}
                bgTasksStatus={bgTasksStatus}
                focusLessonId={focusLessonId}
                focusLesson={focusLesson}
                aiMode={aiMode}
                setAiMode={setAiMode}
                localModel={localModel}
                setLocalModel={setLocalModel}
                apiKey={apiKey}
                setApiKey={setApiKey}
                apiModel={apiModel}
                setApiModel={setApiModel}
                ragDepth={ragDepth}
                setRagDepth={setRagDepth}
                apiBaseUrl={apiBaseUrl}
                setApiBaseUrl={setApiBaseUrl}
                chunkingConfig={chunkingConfig}
                setChunkingConfig={setChunkingConfig}
                savingConfig={savingConfig}
                handleSaveChunkingConfig={handleSaveChunkingConfig}
                handleReprocess={handleReprocess}
                handleResume={handleResume}
                handleStopTask={handleStopTask}
              />
            )}
          </div>
        </ChatContainer>
      )}

      {/* WikiNote History Modal */}
      <WikiHistoryModal
        open={showHistoryModal}
        onCancel={() => setShowHistoryModal(false)}
        selectedObsidianNote={selectedObsidianNote}
        loadingWikiHistory={loadingWikiHistory}
        wikiHistory={wikiHistory}
      />

      {/* Keyframes for animations */}
      <style>{`
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes pulseDot {
          0% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
          70% { transform: scale(1.15); opacity: 0.8; box-shadow: 0 0 0 6px rgba(59, 130, 246, 0); }
          100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
      `}</style>
    </div>
  );
}
