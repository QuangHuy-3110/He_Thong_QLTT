import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { 
  Send, Bot, User, Sparkles, Plus, Trash2, 
  X, Check, Layers, Compass, Cpu, MessageSquare,
  GripVertical, Activity, Settings, Link, FileText,
  BookOpen, FolderOpen, Copy, CheckCheck, RefreshCw
} from 'lucide-react';

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

interface GraphNode {
  id: string;
  label: string;
  type: 'lesson' | 'directory' | 'user' | 'tag';
  val: number;
  color: string;
  details: string;
  highlighted?: boolean;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
  color: string;
  highlighted?: boolean;
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
}

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
  isDetailOpen = false
}: ChatbotWorkspaceProps) {
  // --- STATES & REFS ---
  const [isOpen, setIsOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false); // Checking history before opening
  const [showContinueDialog, setShowContinueDialog] = useState<{ session: ChatSession } | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'graph' | 'wiki' | 'settings'>('chat');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([
    "Tóm tắt các tài liệu Sinh học lớp 10?",
    "Làm thế nào để tránh trùng lặp khi đăng giáo án?",
    "Đề xuất giáo án về Quy luật Mendel?"
  ]);

  // Focused Document States
  const [focusLessonId, setFocusLessonIdState] = useState<number | null>(initialFocusLessonId);
  const focusLesson = useMemo(() => {
    if (!focusLessonId) return null;
    return lessonPlans.find(l => l.id === focusLessonId) || null;
  }, [focusLessonId, lessonPlans]);

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
  // --- OBSIDIAN WIKINOTES VIEWER STATES ---
  const [obsidianNotes, setObsidianNotes] = useState<any[]>([]);
  const [selectedObsidianNote, setSelectedObsidianNote] = useState<any | null>(null);
  const [obsidianNoteContent, setObsidianNoteContent] = useState<string>('');
  const [loadingNote, setLoadingNote] = useState<boolean>(false);
  const [showObsidianViewer, setShowObsidianViewer] = useState<boolean>(false);

  // Graph state (Full system graph cached)
  const [fullGraph, setFullGraph] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });
  const [activeRetrievedNodeIds, setActiveRetrievedNodeIds] = useState<string[]>([]);
  const [clickedNodeId, setClickedNodeId] = useState<string | null>(null);
  
  // Canvas Graph rendering refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphNodesRef = useRef<GraphNode[]>([]);
  const graphEdgesRef = useRef<GraphEdge[]>([]);
  
  // Zoom & Pan state for Graph Canvas
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const [, setTransformTrigger] = useState(0);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const selectedNodeRef = useRef<GraphNode | null>(null);
  const hoveredNodeRef = useRef<GraphNode | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingMessageText, setEditingMessageText] = useState<string>('');

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
  }, [aiMode, localModel, apiKey, apiModel, ragDepth]);

  // Save widget size
  useEffect(() => {
    localStorage.setItem('kms_chat_size', JSON.stringify(widgetSize));
  }, [widgetSize]);

  // Listen for text selection custom event to trigger Quick QA
  useEffect(() => {
    const handleAskTextSelection = (e: Event) => {
      const text = (e as CustomEvent).detail;
      if (text) {
        setIsOpen(true);
        setActiveTab('chat');
        setInputMessage(`Giải thích giúp tôi đoạn này trong tài liệu: "${text}"`);
      }
    };
    window.addEventListener('ask-ai-text-selection', handleAskTextSelection);
    return () => {
      window.removeEventListener('ask-ai-text-selection', handleAskTextSelection);
    };
  }, []);

  // --- RESIZE HANDLERS ---
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    resizeStart.current = { x: e.clientX, y: e.clientY, w: widgetSize.width, h: widgetSize.height };
    
    const handleMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const dx = resizeStart.current.x - ev.clientX; // reversed because widget is anchored right
      const dy = resizeStart.current.y - ev.clientY; // reversed because widget is anchored bottom
      const newW = Math.min(Math.max(resizeStart.current.w + dx, 320), window.innerWidth - 40);
      const newH = Math.min(Math.max(resizeStart.current.h + dy, 400), window.innerHeight - 80);
      setWidgetSize({ width: newW, height: newH });
    };
    
    const handleMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [widgetSize]);

  // --- SIDEBAR RESIZE HANDLER ---
  const isSidebarResizing = useRef(false);
  const sidebarResizeStart = useRef({ x: 0, w: 0 });

  const handleSidebarResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isSidebarResizing.current = true;
    sidebarResizeStart.current = { x: e.clientX, w: historySidebarWidth };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isSidebarResizing.current) return;
      const dx = ev.clientX - sidebarResizeStart.current.x;
      const maxW = Math.floor(widgetSize.width * 0.6);
      const newW = Math.min(Math.max(sidebarResizeStart.current.w + dx, 100), Math.max(maxW, 150));
      setHistorySidebarWidth(newW);
    };

    const handleMouseUp = () => {
      isSidebarResizing.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [historySidebarWidth, widgetSize]);

  // Floating AI Button Drag & Snap Handlers
  const handleBtnMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || isInitializing) return;

    const target = e.currentTarget as HTMLElement;
    target.style.transition = 'none';

    const rect = target.getBoundingClientRect();
    const currentX = rect.left;
    const currentY = rect.top;

    isDraggingBtn.current = true;
    dragStartBtn.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      btnX: currentX,
      btnY: currentY,
      distance: 0
    };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingBtn.current) return;
      const dx = ev.clientX - dragStartBtn.current.mouseX;
      const dy = ev.clientY - dragStartBtn.current.mouseY;
      
      dragStartBtn.current.distance = Math.sqrt(dx * dx + dy * dy);

      const newX = dragStartBtn.current.btnX + dx;
      const newY = dragStartBtn.current.btnY + dy;

      const buttonSize = 56;
      const maxX = window.innerWidth - buttonSize;
      const maxY = window.innerHeight - buttonSize;
      const boundedX = Math.min(Math.max(0, newX), maxX);
      const boundedY = Math.min(Math.max(0, newY), maxY);

      setBtnPos({ x: boundedX, y: boundedY });
    };

    const handleMouseUp = () => {
      isDraggingBtn.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      target.style.transition = 'transform 0.2s, box-shadow 0.2s, left 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), top 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';

      if (dragStartBtn.current.distance < 5) {
        openWithContext(focusLessonId);
        return;
      }

      const buttonSize = 56;
      const padding = 24;
      const midPoint = window.innerWidth / 2;
      const rect = target.getBoundingClientRect();
      const currentX = rect.left;
      const currentY = rect.top;

      let finalX = padding;
      if (currentX + buttonSize / 2 > midPoint) {
        finalX = window.innerWidth - buttonSize - padding;
      }

      const minY = padding;
      const maxY = window.innerHeight - buttonSize - padding;
      const finalY = Math.min(Math.max(minY, currentY), maxY);

      const newPos = { x: finalX, y: finalY };
      setBtnPos(newPos);
      localStorage.setItem('kms_ai_btn_pos', JSON.stringify(newPos));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleBtnTouchStart = (e: React.TouchEvent) => {
    if (isInitializing) return;
    const touch = e.touches[0];
    const target = e.currentTarget as HTMLElement;
    target.style.transition = 'none';

    const rect = target.getBoundingClientRect();
    const currentX = rect.left;
    const currentY = rect.top;

    isDraggingBtn.current = true;
    dragStartBtn.current = {
      mouseX: touch.clientX,
      mouseY: touch.clientY,
      btnX: currentX,
      btnY: currentY,
      distance: 0
    };

    const handleTouchMove = (ev: TouchEvent) => {
      if (!isDraggingBtn.current) return;
      const t = ev.touches[0];
      const dx = t.clientX - dragStartBtn.current.mouseX;
      const dy = t.clientY - dragStartBtn.current.mouseY;
      
      dragStartBtn.current.distance = Math.sqrt(dx * dx + dy * dy);

      const newX = dragStartBtn.current.btnX + dx;
      const newY = dragStartBtn.current.btnY + dy;

      const buttonSize = 56;
      const maxX = window.innerWidth - buttonSize;
      const maxY = window.innerHeight - buttonSize;
      const boundedX = Math.min(Math.max(0, newX), maxX);
      const boundedY = Math.min(Math.max(0, newY), maxY);

      setBtnPos({ x: boundedX, y: boundedY });
    };

    const handleTouchEnd = () => {
      isDraggingBtn.current = false;
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);

      target.style.transition = 'transform 0.2s, box-shadow 0.2s, left 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), top 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';

      if (dragStartBtn.current.distance < 5) {
        openWithContext(focusLessonId);
        return;
      }

      const buttonSize = 56;
      const padding = 24;
      const midPoint = window.innerWidth / 2;
      const rect = target.getBoundingClientRect();
      const currentX = rect.left;
      const currentY = rect.top;

      let finalX = padding;
      if (currentX + buttonSize / 2 > midPoint) {
        finalX = window.innerWidth - buttonSize - padding;
      }

      const minY = padding;
      const maxY = window.innerHeight - buttonSize - padding;
      const finalY = Math.min(Math.max(minY, currentY), maxY);

      const newPos = { x: finalX, y: finalY };
      setBtnPos(newPos);
      localStorage.setItem('kms_ai_btn_pos', JSON.stringify(newPos));
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };

  // --- API CALLS ---
  // 1. Fetch Sessions
  const fetchSessions = async () => {
    if (!currentUser) return;
    setLoadingHistory(true);
    try {
      const res = await axios.get(`/api/chat-sessions/?user_id=${currentUser.id}`);
      const allSessions: ChatSession[] = res.data;
      setSessions(allSessions);
      if (allSessions.length > 0 && !activeSession) {
        // Nếu đang trong ngữ cảnh bài giảng, ưu tiên load session của bài giảng đó
        if (focusLessonId) {
          const lessonSession = allSessions.find(s => s.lesson_plan === focusLessonId);
          if (lessonSession) {
            loadSessionDetails(lessonSession.id);
          } else {
            // Không có session cho bài giảng này -> tạo mới với lessonId
            handleCreateSession(focusLessonId);
          }
        } else {
          loadSessionDetails(allSessions[0].id);
        }
      } else if (allSessions.length === 0) {
        // Tạo session mới, có thể kèm lessonId nếu đang trong card context
        handleCreateSession(focusLessonId || undefined);
      }
    } catch (err) {
      console.error('Error fetching chat sessions:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Helper: Open chat with smart context check (for card AI buttons)
  const openWithContext = useCallback(async (lessonId?: number | null) => {
    // If no lesson context or already open, just open normally
    if (!lessonId || !currentUser) {
      setIsOpen(true);
      return;
    }
    setIsInitializing(true);
    try {
      const res = await axios.get(`/api/chat-sessions/?user_id=${currentUser.id}`);
      const allSessions: ChatSession[] = res.data;
      setSessions(allSessions);
      const existing = allSessions.find(s => s.lesson_plan === lessonId);
      if (existing) {
        // Found prior session for this card — ask user to continue or start new
        setShowContinueDialog({ session: existing });
      } else {
        // No prior session — just open and let session creation proceed
        setIsOpen(true);
      }
    } catch {
      setIsOpen(true);
    } finally {
      setIsInitializing(false);
    }
  }, [currentUser]);

  // 2. Load Session details (with messages)
  const loadSessionDetails = async (sessionId: number) => {
    setLoadingHistory(true);
    try {
      const res = await axios.get(`/api/chat-sessions/${sessionId}/`);
      setActiveSession(res.data);
      if (res.data.suggested_questions) {
        setSuggestedQuestions(res.data.suggested_questions);
      }
      if (res.data.lesson_plan) {
        setFocusLessonIdState(res.data.lesson_plan);
        if (setFocusLessonId) setFocusLessonId(res.data.lesson_plan);
      }
    } catch (err) {
      console.error('Error loading session details:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // 3. Create Session
  const handleCreateSession = async (lessonId?: number) => {
    if (!currentUser) return;
    setLoadingHistory(true);
    try {
      const payload = {
        user_id: currentUser.id,
        lesson_plan_id: lessonId || focusLessonId || undefined,
        title: lessonId ? `Hỏi đáp về tài liệu` : undefined
      };
      const res = await axios.post('/api/chat-sessions/', payload);
      setSessions(prev => [res.data, ...prev]);
      setActiveSession(res.data);
      if (res.data.suggested_questions) {
        setSuggestedQuestions(res.data.suggested_questions);
      }
      if (lessonId) {
        setFocusLessonIdState(lessonId);
        if (setFocusLessonId) setFocusLessonId(lessonId);
      }
    } catch (err) {
      console.error('Error creating session:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Auto-rename session title based on first user message
  const autoRenameSession = useCallback(async (sessionId: number, firstMessage: string) => {
    const title = firstMessage.length > 50 ? firstMessage.slice(0, 50) + '…' : firstMessage;
    try {
      await axios.patch(`/api/chat-sessions/${sessionId}/`, { title });
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title } : s));
      setActiveSession(prev => prev && prev.id === sessionId ? { ...prev, title } : prev);
    } catch {
      // Silent fail — title rename is non-critical
    }
  }, []);

  // Copy AI message to clipboard
  const handleCopyMessage = useCallback((msgId: number, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId(null), 2000);
    });
  }, []);

  // 4. Delete Session
  const handleDeleteSession = async (sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc chắn muốn xóa phiên trò chuyện này không?')) return;
    try {
      await axios.delete(`/api/chat-sessions/${sessionId}/`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSession && activeSession.id === sessionId) {
        setActiveSession(null);
        setFocusLessonIdState(null);
        if (setFocusLessonId) setFocusLessonId(null);
      }
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  };

  // 5. Send Message (Streaming version)
  const handleSendMessage = async (msgText?: string) => {
    const textToSend = msgText || inputMessage;
    if (!textToSend.trim() || !activeSession || sending) return;

    // Auto-rename session if this is the very first message
    const isFirstMessage = !activeSession.messages || activeSession.messages.length === 0;
    if (isFirstMessage) {
      autoRenameSession(activeSession.id, textToSend);
    }

    setSending(true);
    setInputMessage('');
    
    // Add user message optimistically to UI
    const tempUserMsg: ChatMessage = {
      id: Date.now(),
      sender_role: 'USER',
      content: textToSend,
      created_at: new Date().toISOString()
    };

    // Add placeholder AI message for streaming
    const tempAiMsg: ChatMessage = {
      id: Date.now() + 1,
      sender_role: 'AI',
      content: '',
      created_at: new Date().toISOString()
    };
    
    setActiveSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        messages: [...(prev.messages || []), tempUserMsg, tempAiMsg]
      };
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const payload = {
        message: textToSend,
        model_choice: aiMode === 'api' ? 'api' : localModel,
        api_key: aiMode === 'api' ? apiKey : undefined,
        model_name: aiMode === 'api' ? apiModel : undefined,
        focus_lesson_id: focusLessonId || undefined
      };

      const response = await fetch(`/api/chat-sessions/${activeSession.id}/send/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.body) {
        throw new Error('Không hỗ trợ Streaming.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let buffer = '';
      let aiContent = '';

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          buffer += chunk;

          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(cleanLine.substring(6));
                
                if (parsed.type === 'meta') {
                  // Nhận gợi ý câu hỏi & đồ thị RAG
                  const sugQuestions = parsed.suggested_questions;
                  if (sugQuestions && sugQuestions.length > 0) {
                    setSuggestedQuestions(sugQuestions);
                  }

                  const retrievedGraph = parsed.retrieved_graph;
                  if (retrievedGraph && retrievedGraph.nodes) {
                    const nodeIds = retrievedGraph.nodes.map((n: any) => n.id);
                    setActiveRetrievedNodeIds(nodeIds);
                    
                    graphNodesRef.current.forEach(n => {
                      if (nodeIds.includes(n.id)) {
                        n.highlighted = true;
                        n.val = n.val * 1.5;
                      } else {
                        n.highlighted = false;
                        n.val = n.type === 'lesson' ? 25 : n.type === 'directory' ? 20 : n.type === 'user' ? 15 : 12;
                      }
                    });
                  }
                } else if (parsed.type === 'text') {
                  // Nhận từng từ/ký tự câu trả lời của AI
                  aiContent += parsed.content;
                  setActiveSession(prev => {
                    if (!prev || !prev.messages) return null;
                    return {
                      ...prev,
                      messages: prev.messages.map(m => 
                        m.id === tempAiMsg.id ? { ...m, content: aiContent } : m
                      )
                    };
                  });
                } else if (parsed.type === 'done') {
                  // Nhận tin nhắn đầy đủ được lưu vào CSDL
                  const finalMsg = parsed.message;
                  setActiveSession(prev => {
                    if (!prev || !prev.messages) return null;
                    return {
                      ...prev,
                      messages: prev.messages.map(m => 
                        m.id === tempAiMsg.id ? finalMsg : m
                      )
                    };
                  });
                }
              } catch (e) {
                // Incomplete JSON chunk, wait for next buffer
              }
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Chat request generation stopped by user.');
        return;
      }
      console.error('Error sending message:', err);
      // Clean up temp AI message and temp user message on error
      setActiveSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          messages: (prev.messages || []).filter(m => m.id !== tempUserMsg.id && m.id !== tempAiMsg.id)
        };
      });
      alert('Không thể gửi tin nhắn. Hãy kiểm tra lại kết nối mô hình của bạn.');
    } finally {
      setSending(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopResponse = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setSending(false);
      // Remove the optimistic temporary message or active message from UI state
      if (activeSession && activeSession.messages && activeSession.messages.length > 0) {
        // If the last message was a temp user message, clean it up
        const lastMsg = activeSession.messages[activeSession.messages.length - 1];
        if (lastMsg.sender_role === 'USER') {
          setActiveSession(prev => {
            if (!prev) return null;
            return {
              ...prev,
              messages: (prev.messages || []).slice(0, -1)
            };
          });
        }
      }
    }
  };

  const handleRemakePreviousQuestion = () => {
    if (!activeSession || !activeSession.messages || activeSession.messages.length === 0) return;
    
    // Find the last USER message in activeSession.messages
    const lastUserMsgIdx = activeSession.messages.findLastIndex(m => m.sender_role === 'USER');
    if (lastUserMsgIdx === -1) return;
    
    const lastUserMsg = activeSession.messages[lastUserMsgIdx];
    setInputMessage(lastUserMsg.content);
    
    // Remove the last USER message and any subsequent messages (like the AI reply)
    const updatedMessages = activeSession.messages.slice(0, lastUserMsgIdx);
    setActiveSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        messages: updatedMessages
      };
    });
  };

  const handleSaveAndResubmit = async (msgId: number, newText: string) => {
    if (!newText.trim() || !activeSession || sending) return;

    // Find the index of the message being edited
    const msgIdx = activeSession.messages.findIndex(m => m.id === msgId);
    if (msgIdx === -1) return;

    // Roll back the session's messages: keep everything before msgIdx
    const updatedMessages = activeSession.messages.slice(0, msgIdx);

    // Clear editing state
    setEditingMessageId(null);
    setEditingMessageText('');

    // Update UI state by rolling back
    setActiveSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        messages: updatedMessages
      };
    });

    // Resubmit the edited text as a new prompt
    await handleSendMessage(newText);
  };

  // 6. Fetch full graph data
  const fetchGraphData = async () => {
    try {
      let url = currentUser ? `/api/chat-graph/?user_id=${currentUser.id}` : '/api/chat-graph/';
      if (focusLessonId) {
        url += (url.includes('?') ? '&' : '?') + `lesson_id=${focusLessonId}`;
      }
      const res = await axios.get(url);
      setFullGraph(res.data);
    } catch (err) {
      console.error('Error loading graph data:', err);
    }
  };

  // Filter nodes and edges based on focusLessonId (Subgraph Filtering)
  const visibleGraph = useMemo(() => {
    // Khi có focusLessonId, fullGraph đã là đồ thị sơ đồ tư duy (mindmap) riêng của tài liệu do backend trả về
    return fullGraph;
  }, [fullGraph]);

  // Sync visibleGraph nodes into graphNodesRef and graphEdgesRef preserving positions
  useEffect(() => {
    const existingPositions = new Map<string, { x: number; y: number }>();
    graphNodesRef.current.forEach(n => {
      if (n.x !== undefined && n.y !== undefined) {
        existingPositions.set(n.id, { x: n.x, y: n.y });
      }
    });

    const width = 800;
    const height = 600;

    const newNodes = visibleGraph.nodes.map((node: any) => {
      const pos = existingPositions.get(node.id) || {
        x: width / 2 + (Math.random() - 0.5) * 300,
        y: height / 2 + (Math.random() - 0.5) * 300
      };
      return {
        ...node,
        x: pos.x,
        y: pos.y,
        vx: node.vx !== undefined ? node.vx : 0,
        vy: node.vy !== undefined ? node.vy : 0
      };
    });

    graphNodesRef.current = newNodes;
    graphEdgesRef.current = visibleGraph.edges;
  }, [visibleGraph]);

  // --- INITIALIZATION ---
  const fetchChunkingConfig = async () => {
    try {
      const res = await axios.get('/api/system-settings/');
      setChunkingConfig(res.data);
    } catch (err) {
      console.error('Error fetching chunking config:', err);
    }
  };

  const [obsidianStatus, setObsidianStatus] = useState<any>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchObsidianNotes = async () => {
    try {
      const res = await axios.get('/api/obsidian/notes/');
      setObsidianNotes(res.data);
    } catch (err) {
      console.error('Error fetching obsidian notes list:', err);
    }
  };

  const fetchNoteContent = async (note: any) => {
    setLoadingNote(true);
    try {
      const res = await axios.get(`/api/obsidian/notes/content/?filename=${encodeURIComponent(note.filename)}`);
      setObsidianNoteContent(res.data.content);
      setSelectedObsidianNote(note);
    } catch (err) {
      console.error('Error loading obsidian note content:', err);
      alert('Không thể tải nội dung ghi chú.');
    } finally {
      setLoadingNote(false);
    }
  };

  const fetchObsidianStatus = async () => {
    try {
      const res = await axios.get('/api/obsidian/status/');
      setObsidianStatus(res.data);
    } catch (err) {
      console.error('Error fetching obsidian status:', err);
    }
  };

  const handleSaveChunkingConfig = async (newConfig: any) => {
    setSavingConfig(true);
    try {
      const res = await axios.post('/api/system-settings/', newConfig);
      setChunkingConfig(res.data);
      alert('Đã cập nhật cấu hình phân mảnh thành công!');
    } catch (err) {
      console.error('Error saving chunking config:', err);
      alert('Không thể lưu cấu hình phân mảnh.');
    } finally {
      setSavingConfig(false);
    }
  };

  const getStepStatus = (stepIndex: number, currentStepText: string | null | undefined) => {
    if (!currentStepText) return 'pending';
    const text = currentStepText.toLowerCase();
    
    let activeIndex = -1;
    if (text.includes('phase 1') || text.includes('chuyển đổi') || text.includes('.docx')) activeIndex = 0;
    else if (text.includes('phase 2') || text.includes('chia nhỏ') || text.includes('chunking')) activeIndex = 1;
    else if (text.includes('phase 3') || text.includes('vector') || text.includes('nhúng') || text.includes('embedding')) activeIndex = 2;
    else if (text.includes('phase 4') || text.includes('trích xuất') || text.includes('concept') || text.includes('thực thể')) activeIndex = 3;
    else if (text.includes('phase 5') || text.includes('obsidian') || text.includes('đồng bộ')) activeIndex = 4;
    else if (text.includes('hoàn thành')) activeIndex = 5;

    if (stepIndex < activeIndex) return 'completed';
    if (stepIndex === activeIndex) return 'active';
    return 'pending';
  };

  useEffect(() => {
    fetchSessions();
    fetchGraphData();
    fetchChunkingConfig();
    fetchObsidianStatus();
    fetchObsidianNotes();
  }, [currentUser, focusLessonId]);

  // Polling for Asynchronous Background Tasks
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await axios.get('/api/bg-tasks/status/');
        setBgTasksStatus(res.data);
      } catch (err) {
        console.error('Error fetching background tasks status:', err);
      }
    };
    fetchTasks();

    // Poll every 3 seconds
    const interval = setInterval(() => {
      fetchTasks();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Synchronize focusLessonId from parent prop
  useEffect(() => {
    setFocusLessonIdState(initialFocusLessonId);
  }, [initialFocusLessonId]);

  // Synchronize active chat session when focusLessonId or isOpen changes
  useEffect(() => {
    if (focusLessonId && isOpen) {
      setActiveTab('chat');
      const existing = sessions.find(s => s.lesson_plan === focusLessonId);
      if (existing) {
        if (!activeSession || activeSession.id !== existing.id) {
          loadSessionDetails(existing.id);
        }
      } else {
        // Tự động tạo cuộc trò chuyện mới cho bài giảng này khi mở chatbot
        handleCreateSession(focusLessonId);
      }
    }
  }, [focusLessonId, isOpen, sessions.length]);

  // Auto-scroll chat area
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, sending]);

  // --- FORCE DIRECTED GRAPH SIMULATION ENGINE ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrameId: number;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const repulsion = 80;
    const attraction = 0.02;
    const gravity = 0.03;
    const friction = 0.78;

    const simulatePhysics = () => {
      const nodes = graphNodesRef.current;
      const edges = graphEdgesRef.current;
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dx = n2.x! - n1.x!;
          const dy = n2.y! - n1.y!;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;
          
          if (dist < 280) {
            const clampDist = Math.max(dist, 25);
            const force = (repulsion * repulsion) / (clampDist * clampDist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            n1.vx! -= fx;
            n1.vy! -= fy;
            n2.vx! += fx;
            n2.vy! += fy;
          }
        }
      }

      edges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          const dx = targetNode.x! - sourceNode.x!;
          const dy = targetNode.y! - sourceNode.y!;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;
          
          const force = attraction * (dist - 90);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          
          sourceNode.vx! += fx;
          sourceNode.vy! += fy;
          targetNode.vx! -= fx;
          targetNode.vy! -= fy;
        }
      });

      nodes.forEach(node => {
        node.vx! += (centerX - node.x!) * gravity;
        node.vy! += (centerY - node.y!) * gravity;

        if (node !== selectedNodeRef.current) {
          node.x! += node.vx!;
          node.y! += node.vy!;
          node.vx! *= friction;
          node.vy! *= friction;
        } else {
          node.vx = 0;
          node.vy = 0;
        }
      });
    };

    const drawGraph = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Light background
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.save();
      ctx.translate(transformRef.current.x, transformRef.current.y);
      ctx.scale(transformRef.current.scale, transformRef.current.scale);

      const nodes = graphNodesRef.current;
      const edges = graphEdgesRef.current;

      // Draw Edges
      edges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          ctx.beginPath();
          ctx.moveTo(sourceNode.x!, sourceNode.y!);
          ctx.lineTo(targetNode.x!, targetNode.y!);
          
          const isRelatedToClicked = clickedNodeId && (edge.source === clickedNodeId || edge.target === clickedNodeId);
          
          if (isRelatedToClicked) {
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 3.5;
            ctx.shadowColor = '#3b82f6';
            ctx.shadowBlur = 10;
          } else if (edge.highlighted || (activeRetrievedNodeIds.includes(edge.source) && activeRetrievedNodeIds.includes(edge.target))) {
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 3.5;
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 10;
          } else {
            ctx.strokeStyle = clickedNodeId ? 'rgba(226, 232, 240, 0.4)' : '#e2e8f0';
            ctx.lineWidth = 1.0;
            ctx.shadowBlur = 0;
          }
          ctx.stroke();
        }
      });
      ctx.shadowBlur = 0;

      // Draw Nodes
      nodes.forEach(node => {
        const isHighlighted = activeRetrievedNodeIds.includes(node.id);
        const isClicked = clickedNodeId === node.id;
        const isRelatedToClicked = clickedNodeId && edges.some(e => 
          (e.source === clickedNodeId && e.target === node.id) || 
          (e.target === clickedNodeId && e.source === node.id)
        );
        
        const r = node.type === 'lesson' ? 8 : node.type === 'directory' ? 6 : node.type === 'user' ? 5 : 4;
        
        ctx.beginPath();
        
        if (isClicked) {
          ctx.arc(node.x!, node.y!, r + 8 + Math.sin(Date.now() / 150) * 2, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
          ctx.fill();
          ctx.beginPath();
        } else if (isHighlighted) {
          ctx.arc(node.x!, node.y!, r + 6 + Math.sin(Date.now() / 200) * 3, 0, 2 * Math.PI);
          ctx.fillStyle = `${node.color}33`;
          ctx.fill();
          ctx.beginPath();
        }

        ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI);
        
        if (clickedNodeId && !isClicked && !isRelatedToClicked) {
          ctx.fillStyle = `${node.color}55`;
        } else {
          ctx.fillStyle = node.color;
        }
        ctx.fill();
        
        ctx.lineWidth = isClicked ? 2.5 : 1.5;
        ctx.strokeStyle = isClicked ? '#3b82f6' : '#ffffff';
        ctx.stroke();

        const labelIsHighlighted = isClicked || isRelatedToClicked || isHighlighted;
        ctx.font = labelIsHighlighted ? 'bold 11px sans-serif' : '9px sans-serif';
        
        if (clickedNodeId && !isClicked && !isRelatedToClicked) {
          ctx.fillStyle = '#cbd5e1';
        } else {
          ctx.fillStyle = labelIsHighlighted ? '#1e293b' : '#64748b';
        }
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        const labelText = node.label.length > 20 ? node.label.slice(0, 18) + '...' : node.label;
        ctx.fillText(labelText, node.x!, node.y! + r + 4);
      });

      // Highlight hovered node
      if (hoveredNodeRef.current) {
        const node = hoveredNodeRef.current;
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, 12, 0, 2 * Math.PI);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2.0;
        ctx.stroke();
      }

      ctx.restore();

      // Draw tooltip for hovered node in screen coordinates
      if (hoveredNodeRef.current) {
        const node = hoveredNodeRef.current;
        const scale = transformRef.current.scale;
        const screenX = node.x! * scale + transformRef.current.x;
        const screenY = node.y! * scale + transformRef.current.y;

        ctx.save();

        const text = node.label;
        ctx.font = 'bold 11px sans-serif';
        const textWidth = ctx.measureText(text).width;
        const paddingX = 10;
        const tooltipW = textWidth + paddingX * 2;
        const tooltipH = 24;
        const r = 6; // rounded corner radius

        const nodeRadius = (node.type === 'lesson' ? 8 : node.type === 'directory' ? 6 : node.type === 'user' ? 5 : 4) * scale;
        const rectX = screenX - tooltipW / 2;
        const rectY = screenY - nodeRadius - tooltipH - 8;

        // Draw shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;

        // Draw background box
        ctx.fillStyle = '#1e293b'; // dark slate
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(rectX, rectY, tooltipW, tooltipH, r);
        } else {
          ctx.rect(rectX, rectY, tooltipW, tooltipH);
        }
        ctx.fill();

        // Draw small arrow indicator pointing down
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.beginPath();
        ctx.moveTo(screenX - 5, rectY + tooltipH);
        ctx.lineTo(screenX + 5, rectY + tooltipH);
        ctx.lineTo(screenX, rectY + tooltipH + 5);
        ctx.closePath();
        ctx.fill();

        // Draw text
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, screenX, rectY + tooltipH / 2);

        ctx.restore();
      }
    };

    const updateLoop = () => {
      simulatePhysics();
      drawGraph();
      animationFrameId = requestAnimationFrame(updateLoop);
    };

    updateLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [visibleGraph, activeRetrievedNodeIds, clickedNodeId, activeTab, widgetSize]);

  // --- CANVAS EVENT HANDLERS ---
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const graphX = (clientX - transformRef.current.x) / transformRef.current.scale;
    const graphY = (clientY - transformRef.current.y) / transformRef.current.scale;

    let clickedNode: GraphNode | null = null;
    const nodes = graphNodesRef.current;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const dx = n.x! - graphX;
      const dy = n.y! - graphY;
      if (Math.sqrt(dx * dx + dy * dy) < 15) {
        clickedNode = n;
        break;
      }
    }

    if (clickedNode) {
      selectedNodeRef.current = clickedNode;
    } else {
      dragStart.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const graphX = (clientX - transformRef.current.x) / transformRef.current.scale;
    const graphY = (clientY - transformRef.current.y) / transformRef.current.scale;

    if (selectedNodeRef.current) {
      selectedNodeRef.current.x = graphX;
      selectedNodeRef.current.y = graphY;
    } else if (dragStart.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      
      transformRef.current = {
        ...transformRef.current,
        x: transformRef.current.x + dx,
        y: transformRef.current.y + dy
      };
      setTransformTrigger(p => p + 1);
      dragStart.current = { x: e.clientX, y: e.clientY };
    } else {
      let hoveredNode: GraphNode | null = null;
      const nodes = graphNodesRef.current;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const dx = n.x! - graphX;
        const dy = n.y! - graphY;
        if (Math.sqrt(dx * dx + dy * dy) < 12) {
          hoveredNode = n;
          break;
        }
      }
      hoveredNodeRef.current = hoveredNode;
    }
  };

  const handleCanvasMouseUp = () => {
    selectedNodeRef.current = null;
    dragStart.current = null;
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const zoomIntensity = 0.1;
    const scaleFactor = e.deltaY < 0 ? (1 + zoomIntensity) : (1 - zoomIntensity);
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newScale = Math.min(Math.max(transformRef.current.scale * scaleFactor, 0.2), 4.0);
    const graphX = (mouseX - transformRef.current.x) / transformRef.current.scale;
    const graphY = (mouseY - transformRef.current.y) / transformRef.current.scale;

    transformRef.current = {
      scale: newScale,
      x: mouseX - graphX * newScale,
      y: mouseY - graphY * newScale
    };
    setTransformTrigger(p => p + 1);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const graphX = (clientX - transformRef.current.x) / transformRef.current.scale;
    const graphY = (clientY - transformRef.current.y) / transformRef.current.scale;

    const nodes = graphNodesRef.current;
    let clickedAnyNode = false;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const dx = n.x! - graphX;
      const dy = n.y! - graphY;
      if (Math.sqrt(dx * dx + dy * dy) < 15) {
        setClickedNodeId(n.id);
        clickedAnyNode = true;
        if (n.type === 'tag') {
          setInputMessage(`Tìm kiếm tài liệu có từ khóa: ${n.label}`);
        } else if (n.type === 'directory') {
          setInputMessage(`Tìm tài liệu trong thư mục: ${n.label}`);
        }
        break;
      }
    }

    if (!clickedAnyNode) {
      setClickedNodeId(null);
    }
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const graphX = (clientX - transformRef.current.x) / transformRef.current.scale;
    const graphY = (clientY - transformRef.current.y) / transformRef.current.scale;

    const nodes = graphNodesRef.current;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const dx = n.x! - graphX;
      const dy = n.y! - graphY;
      if (Math.sqrt(dx * dx + dy * dy) < 15) {
        if (n.type === 'lesson') {
          const lessonId = parseInt(n.id.split('_')[1]);
          const targetLesson = lessonPlans.find(lp => lp.id === lessonId);
          if (targetLesson && onViewLessonDetail) {
            onViewLessonDetail(targetLesson);
            setIsOpen(false);
          }
        }
        break;
      }
    }
  };

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

        elements.push(
          <button
            key={`link-${match.index}`}
            onClick={() => {
              if (targetLesson && onViewLessonDetail) {
                onViewLessonDetail(targetLesson, searchText);
                setIsOpen(false);
              } else if (!targetLesson) {
                axios.get(`/api/lesson-plans/${lessonId}/?user_id=${currentUser?.id}`)
                  .then(res => {
                    if (onViewLessonDetail) {
                      onViewLessonDetail(res.data, searchText);
                      setIsOpen(false);
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

      // Table line parsing
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

      // List parsing
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
        inList = true;
        const cleanText = trimmed.replace(/^[-*•]\s*/, '');
        listItems.push(cleanText);
        return;
      } else {
        flushList(key + '-pre-non-list');
      }

      // Headings & paragraphs
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

  // Trình phân tích WikiLinks Obsidian [[Khái niệm]] sang nút bấm tương tác thông minh
  const renderWikiContent = (contentStr: string) => {
    if (!contentStr) return null;
    
    const parts = contentStr.split(/(\[\[.*?\]\])/g);
    
    return parts.map((part, idx) => {
      if (part.startsWith('[[') && part.endsWith(']]')) {
        const tag = part.slice(2, -2).trim();
        // Tìm kiếm note xem có tồn tại trong danh sách của Obsidian không
        const targetNote = obsidianNotes.find(n => n.title.toLowerCase() === tag.toLowerCase());
        
        return (
          <button
            key={idx}
            type="button"
            onClick={() => {
              if (targetNote) {
                fetchNoteContent(targetNote);
              } else {
                alert(`Không tìm thấy tài liệu "${tag}" liên kết.`);
              }
            }}
            style={{
              background: 'rgba(139, 92, 246, 0.06)',
              border: '1px solid rgba(139, 92, 246, 0.25)',
              borderRadius: '6px',
              padding: '2px 7px',
              fontSize: '11px',
              fontWeight: 700,
              color: '#8b5cf6',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              margin: '0 2px',
              verticalAlign: 'middle',
              transition: 'all 0.15s',
              boxShadow: '0 1px 2px rgba(139, 92, 246, 0.05)'
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(139, 92, 246, 0.12)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(139, 92, 246, 0.4)';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(139, 92, 246, 0.06)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(139, 92, 246, 0.25)';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            }}
            title={targetNote ? `Click để mở nhanh tài liệu [[${tag}]]` : `Liên kết đứt: [[${tag}]]`}
          >
            📚 {tag}
          </button>
        );
      }
      return part;
    });
  };

  // =====================================================
  //  RENDER
  // =====================================================
  return (
    <div className="font-sans">
      
      {/* 1. FLOATING CHAT TRIGGER BUTTON */}
      {!isOpen && !showContinueDialog && (
        <button
          onMouseDown={handleBtnMouseDown}
          onTouchStart={handleBtnTouchStart}
          style={{
            position: 'fixed',
            left: btnPos.x !== null ? `${btnPos.x}px` : 'auto',
            top: btnPos.y !== null ? `${btnPos.y}px` : 'auto',
            right: btnPos.x !== null ? 'auto' : '24px',
            bottom: btnPos.y !== null ? 'auto' : (isDetailOpen ? '96px' : '24px'),
            zIndex: 9999,
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            color: '#fff',
            border: 'none',
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isInitializing ? 'wait' : 'grab',
            transition: 'transform 0.2s, box-shadow 0.2s, left 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), top 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
            opacity: isInitializing ? 0.7 : 1,
            touchAction: 'none',
          }}
          onMouseEnter={e => {
            if (!isInitializing && !isDraggingBtn.current) {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 28px rgba(99, 102, 241, 0.5)';
            }
          }}
          onMouseLeave={e => {
            if (!isDraggingBtn.current) {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(99, 102, 241, 0.4)';
            }
          }}
          disabled={isInitializing}
          title="Kéo thả để di chuyển • Nhấp để mở Trợ lý AI"
        >
          {isInitializing ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="6" width="18" height="13" rx="3" fill="rgba(255,255,255,0.25)" stroke="white" strokeWidth="1.5"/>
              <circle cx="8.5" cy="12.5" r="1.5" fill="white"/>
              <circle cx="15.5" cy="12.5" r="1.5" fill="white"/>
              <path d="M9 16c1-1 5-1 6 0" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M9 3L12 6M15 3L12 6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="12" cy="6" r="1" fill="white"/>
            </svg>
          )}
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: '#ef4444',
            fontSize: '8px',
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #fff',
          }}>AI</span>
        </button>
      )}

      {/* CONTINUE OR NEW SESSION DIALOG */}
      {showContinueDialog && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          background: 'rgba(15,23,42,0.45)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'chatSlideUp 0.2s ease-out',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '20px',
            padding: '28px 32px',
            maxWidth: '380px',
            width: '90%',
            boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="6" width="18" height="13" rx="3" fill="rgba(255,255,255,0.25)" stroke="white" strokeWidth="1.5"/>
                  <circle cx="8.5" cy="12.5" r="1.5" fill="white"/>
                  <circle cx="15.5" cy="12.5" r="1.5" fill="white"/>
                  <path d="M9 16c1-1 5-1 6 0" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                  <path d="M9 3L12 6M15 3L12 6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="12" cy="6" r="1" fill="white"/>
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b', margin: 0 }}>Lịch sử trò chuyện</h3>
                <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0 0' }}>Bạn đã có cuộc trò chuyện trước với tài liệu này.</p>
              </div>
            </div>
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '10px 14px',
            }}>
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 2px 0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Cuộc trò chuyện gần nhất</p>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>💬 {showContinueDialog.session.title}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => {
                  setShowContinueDialog(null);
                  loadSessionDetails(showContinueDialog.session.id);
                  setIsOpen(true);
                }}
                style={{
                  padding: '11px',
                  background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.9'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
              >
                ▶ Tiếp tục cuộc trò chuyện cũ
              </button>
              <button
                onClick={() => {
                  const lid = initialFocusLessonId;
                  setShowContinueDialog(null);
                  setIsOpen(true);
                  handleCreateSession(lid || undefined);
                }}
                style={{
                  padding: '11px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#e2e8f0'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#f1f5f9'}
              >
                ✨ Bắt đầu cuộc trò chuyện mới
              </button>
              <button
                onClick={() => setShowContinueDialog(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', padding: '4px' }}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. FLOATING POPOVER WIDGET - LIGHT THEME */}
      {isOpen && (
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
          {/* Resize Handle (top-left corner) */}
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
            <GripVertical className="w-3 h-3 text-gray-300 rotate-45" />
          </div>

          {/* A. HEADER */}
          <header style={{
            padding: '10px 14px',
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                background: 'rgba(255,255,255,0.18)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.25)',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="6" width="18" height="13" rx="3" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5"/>
                  <circle cx="8.5" cy="12.5" r="1.5" fill="white"/>
                  <circle cx="15.5" cy="12.5" r="1.5" fill="white"/>
                  <path d="M9 16c1-1 5-1 6 0" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                  <path d="M9 3L12 6M15 3L12 6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="12" cy="6" r="1" fill="white"/>
                </svg>
              </div>
              <div>
                <h2 style={{ fontSize: '12px', fontWeight: 800, color: '#fff', letterSpacing: '0.5px', margin: 0, lineHeight: 1.2 }}>
                  Trợ lý AI RAG
                </h2>
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                  Graph RAG • Hỏi đáp thông minh
                </span>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  padding: '4px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'transparent',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                title="Thu nhỏ"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* B. FOCUS BANNER */}
          {focusLesson && (
            <div style={{
              background: '#eff6ff',
              borderBottom: '1px solid #bfdbfe',
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              fontSize: '11px',
              color: '#1e40af',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                <span>🎯</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Tập trung: <strong>{focusLesson.title}</strong>
                </span>
              </span>
              <button 
                onClick={() => { 
                  setFocusLessonIdState(null); 
                  if (setFocusLessonId) setFocusLessonId(null);
                  fetchSessions(); 
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#3b82f6',
                  cursor: 'pointer',
                  flexShrink: 0,
                  padding: '2px',
                  borderRadius: '4px',
                  display: 'flex',
                }}
                title="Đóng chế độ tập trung"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* C. TAB BAR */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '4px',
            flexShrink: 0,
          }}>
            {[
              { key: 'chat' as const, label: '💬 Trợ lý' },
              { key: 'graph' as const, label: '🕸️ Đồ thị' },
              { key: 'wiki' as const, label: '📚 WikiNotes' },
              { key: 'settings' as const, label: '⚙️ Cấu hình' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  if (tab.key === 'wiki') {
                    fetchObsidianNotes();
                  }
                }}
                style={{
                  padding: '6px 4px',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: activeTab === tab.key ? 800 : 600,
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  background: activeTab === tab.key ? '#fff' : 'transparent',
                  color: activeTab === tab.key ? '#3b82f6' : '#64748b',
                  boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* D. VIEW CONTENT */}
          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', position: 'relative' }}>
            
            {/* TAB 1: CHAT */}
            {activeTab === 'chat' && (
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
                    <div style={{ flexGrow: 1, overflowY: 'auto', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                          return (
                            <div
                              key={s.id}
                              onClick={() => loadSessionDetails(s.id)}
                              style={{
                                padding: '8px',
                                borderRadius: '8px',
                                border: `1px solid ${isActive ? '#3b82f6' : '#e2e8f0'}`,
                                background: isActive ? '#eff6ff' : '#fff',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.15s',
                                position: 'relative',
                              }}
                            >
                              <span style={{
                                fontSize: '10px',
                                fontWeight: isActive ? 700 : 500,
                                color: isActive ? '#1d4ed8' : '#475569',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                paddingRight: '16px',
                              }}>{s.title}</span>
                              <button
                                onClick={(e) => handleDeleteSession(s.id, e)}
                                style={{
                                  position: 'absolute',
                                  right: '6px',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
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
                  <div style={{ flexGrow: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                        // Get user avatar initials
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
                                      resize: 'vertical',
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
                      // Empty State — Context-aware greeting
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

                    {/* Note: streaming indicator is now handled inside the message bubble for the empty AI placeholder */}
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
                      overflowX: 'auto',
                      flexShrink: 0,
                    }}>
                      <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', flexShrink: 0 }}>Gợi ý:</span>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap', overflowX: 'auto' }}>
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
            )}

            {/* TAB 2: GRAPH */}
            {activeTab === 'graph' && (
              <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, position: 'relative' }}>
                <canvas
                  ref={canvasRef}
                  width={widgetSize.width}
                  height={widgetSize.height - 120}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                  onWheel={handleCanvasWheel}
                  onClick={handleCanvasClick}
                  onDoubleClick={handleCanvasDoubleClick}
                  style={{
                    width: '100%',
                    height: '100%',
                    cursor: 'grab',
                    background: '#f8fafc',
                  }}
                />
                
                {/* Legend */}
                <div style={{
                  position: 'absolute', top: '8px', left: '8px',
                  background: 'rgba(255,255,255,0.95)', border: '1px solid #e2e8f0',
                  borderRadius: '8px', padding: '8px', fontSize: '9px', color: '#64748b',
                  display: 'flex', flexDirection: 'column', gap: '3px',
                  pointerEvents: 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} /> Giáo án</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} /> Danh mục</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8b5cf6', display: 'inline-block' }} /> Từ khóa</div>
                </div>

                <div style={{
                  position: 'absolute', bottom: '8px', left: '8px',
                  background: 'rgba(255,255,255,0.95)', border: '1px solid #e2e8f0',
                  borderRadius: '8px', padding: '8px', fontSize: '9px', color: '#64748b',
                  pointerEvents: 'none',
                }}>
                  <p>🖰 Kéo để Pan | 🛞 Cuộn để Zoom</p>
                  <p>🖱 Nhấn đúp nút vàng để xem giáo án</p>
                </div>

                <button
                  onClick={() => {
                    transformRef.current = { x: 0, y: 0, scale: 1.0 };
                    setTransformTrigger(p => p + 1);
                  }}
                  style={{
                    position: 'absolute', top: '8px', right: '8px',
                    fontSize: '10px', background: '#fff', border: '1px solid #e2e8f0',
                    padding: '4px 10px', borderRadius: '6px', color: '#475569',
                    fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  Reset
                </button>
              </div>
            )}

            {/* TAB 2.5: WIKINOTES PREMIUM READER */}
            {activeTab === 'wiki' && (
              <div style={{ flexGrow: 1, display: 'flex', overflow: 'hidden', height: '100%', minHeight: 0 }}>
                {/* Left Side: Wiki Notes List (35% width, clean slate design) */}
                <div style={{
                  width: '35%',
                  borderRight: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}>
                  <div style={{ padding: '12px 10px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
                    <h3 style={{ fontSize: '10px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <FolderOpen className="w-4 h-4 text-blue-500" /> Tài liệu RAG ({obsidianNotes.length})
                    </h3>
                  </div>
                  <div style={{ flexGrow: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {obsidianNotes.length === 0 ? (
                      <div style={{ padding: '24px 8px', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>
                        Không có tài liệu nào trong vault.
                      </div>
                    ) : (
                      obsidianNotes.map((note, nIdx) => {
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

                {/* Right Side: Premium Glassmorphic Reader (65% width) */}
                <div style={{
                  width: '65%',
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
                        flexShrink: 0
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <span style={{ fontSize: '16px' }}>📖</span>
                          <h2 style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={selectedObsidianNote.title}>
                            {selectedObsidianNote.title}
                          </h2>
                        </div>
                      </div>

                      {/* Content Reading Pane */}
                      <div style={{
                        flexGrow: 1,
                        overflowY: 'auto',
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
                        ) : (
                          <div style={{ 
                            whiteSpace: 'pre-wrap', 
                            wordBreak: 'break-word',
                            background: 'rgba(255,255,255,0.7)',
                            backdropFilter: 'blur(8px)',
                            borderRadius: '12px',
                          }}>
                            {renderWikiContent(obsidianNoteContent)}
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
              </div>
            )}

            {/* TAB 3: SETTINGS */}
            {activeTab === 'settings' && (
              <div style={{ flexGrow: 1, overflowY: 'auto', padding: '14px', fontSize: '12px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                {/* SECTION 1: AI PROCESSING HUB (BACKGROUND PROCESS TASK MANAGER) */}
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 700, color: '#64748b', marginBottom: '3px' }}>
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div style={{
                              width: '14px',
                              height: '14px',
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
                            {/* Vertical Line */}
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
                                  {/* Dot */}
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

                                  {/* Text content */}
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
                        
                        <div style={{ display: 'grid', gridTemplateColumns: focusLessonId ? '1fr 1fr' : '1fr', gap: '6px' }}>
                          {focusLessonId && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (confirm(`Bạn có chắc chắn muốn chạy lại phân tích AI RAG cho riêng bài giảng "${focusLesson?.title}" này?`)) {
                                  try {
                                    await axios.post('/api/bg-tasks/reprocess/', { lesson_id: focusLessonId });
                                    alert('Đã đưa tài liệu này vào hàng chờ tái xử lý!');
                                  } catch (err) {
                                    alert('Chạy lại thất bại. Vui lòng kiểm tra kết nối.');
                                  }
                                }
                              }}
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
                          
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm('Bạn có chắc chắn muốn chạy lại phân tích AI RAG cho TOÀN BỘ tài liệu trong hệ thống?')) {
                                try {
                                  await axios.post('/api/bg-tasks/reprocess/', {});
                                  alert('Đã xếp hàng chạy lại toàn hệ thống thành công!');
                                } catch (err) {
                                  alert('Chạy lại thất bại. Vui lòng kiểm tra kết nối.');
                                }
                              }
                            }}
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

                {/* SECTION 2: AI ENGINE CONFIGURATION (LOCAL vs API) */}
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
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '6px 8px', borderRadius: '8px',
                              border: `1px solid ${localModel === m.key ? '#3b82f6' : '#e2e8f0'}`,
                              background: localModel === m.key ? '#eff6ff' : '#fff',
                              cursor: 'pointer', textAlign: 'left',
                              transition: 'all 0.15s',
                            }}
                          >
                            <div>
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

                {/* SECTION 3: ADMIN CHUNKING CONFIGURATION (SHOWN TO ADMIN ONLY) */}
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

                      {/* Bật tắt AI RAG toàn hệ thống dành cho Admin */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        marginTop: '2px'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', textAlign: 'left' }}>
                          <span style={{ fontSize: '9px', fontWeight: 800, color: '#1e293b' }}>🧠 Kích hoạt AI RAG</span>
                          <span style={{ fontSize: '7px', color: '#64748b' }}>Tắt AI nếu Server yếu để chạy tối ưu</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={chunkingConfig.use_ai_rag !== false}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setChunkingConfig((prev: any) => ({ ...prev, use_ai_rag: val }));
                          }}
                          style={{
                            width: '14px',
                            height: '14px',
                            cursor: 'pointer',
                            accentColor: '#6366f1'
                          }}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSaveChunkingConfig(chunkingConfig)}
                        disabled={savingConfig}
                        style={{
                          width: '100%',
                          padding: '6px',
                          background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                          color: '#fff',
                          fontWeight: 700,
                          borderRadius: '8px',
                          border: 'none',
                          fontSize: '10px',
                          cursor: 'pointer',
                          marginTop: '4px',
                          boxShadow: '0 2px 6px rgba(168, 85, 247, 0.25)',
                          transition: 'opacity 0.15s'
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                      >
                        {savingConfig ? 'Đang lưu...' : 'Lưu cấu hình hệ thống'}
                      </button>
                    </div>
                  </div>
                )}

                {/* SECTION 4: OBSIDIAN VAULT SYSTEM INTEGRATION */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                }}>
                  <h3 style={{ fontSize: '11px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 10px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                    <Link className="w-4 h-4 text-indigo-500" />
                    Obsidian Vault Integration
                  </h3>

                  {obsidianStatus ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', marginBottom: '6px' }}>
                        <span style={{ color: '#64748b' }}>Trạng thái Vault máy chủ</span>
                        <span style={{
                          color: obsidianStatus.exists ? '#16a34a' : '#ef4444',
                          fontWeight: 800,
                          background: obsidianStatus.exists ? '#dcfce7' : '#fee2e2',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}>
                          {obsidianStatus.exists ? '✓ Active (Đang đồng bộ)' : '✕ Not Found'}
                        </span>
                      </div>

                      <div style={{ marginBottom: '8px' }}>
                        <label style={{ display: 'block', fontSize: '8px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>Đường dẫn thư mục Vault</label>
                        <div style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '6px',
                          fontFamily: 'monospace',
                          fontSize: '8px',
                          wordBreak: 'break-all',
                          color: '#475569',
                          userSelect: 'all',
                        }}>
                          {obsidianStatus.vault_path}
                        </div>
                      </div>

                      <div style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '8px',
                        padding: '8px',
                        fontSize: '9px',
                        color: '#1e40af',
                        lineHeight: 1.45,
                        marginBottom: '10px'
                      }}>
                        ℹ <strong>Hướng dẫn liên kết Obsidian Desktop:</strong>
                        <ol style={{ margin: '4px 0 0 0', paddingLeft: '14px' }}>
                          <li>Tải & cài đặt Obsidian từ trang chủ.</li>
                          <li>Chọn <strong>Open folder as vault</strong>.</li>
                          <li>Dán đường dẫn thư mục phía trên vào.</li>
                          <li>Mở tab **Graph View** để xem đồ thị tri thức 3D đồng bộ thời gian thực siêu đẹp!</li>
                        </ol>
                      </div>

                      {/* Web-based WikiNotes Reader (Trình xem Wiki trực quan ngay trên giao diện Web) */}
                      <div style={{
                        borderTop: '1px solid #e2e8f0',
                        paddingTop: '10px',
                        marginTop: '10px'
                      }}>
                        <button
                          type="button"
                          onClick={() => {
                            setShowObsidianViewer(!showObsidianViewer);
                            if (!showObsidianViewer) fetchObsidianNotes();
                          }}
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            color: '#475569',
                            fontSize: '9.5px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            transition: 'all 0.15s'
                          }}
                        >
                          <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                          {showObsidianViewer ? 'Ẩn Trình xem Ghi chú Wiki' : '📂 Xem trực tiếp Obsidian WikiNotes trên Web'}
                        </button>

                        {showObsidianViewer && (
                          <div style={{
                            marginTop: '10px',
                            display: 'grid',
                            gridTemplateColumns: '1fr',
                            gap: '8px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            padding: '8px',
                          }}>
                            {/* Danh sách ghi chú */}
                            <div>
                              <span style={{ fontSize: '8.5px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                                Danh sách ghi chú RAG ({obsidianNotes.length})
                              </span>
                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '3px',
                                maxHeight: '120px',
                                overflowY: 'auto',
                                background: '#fff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                padding: '4px'
                              }}>
                                {obsidianNotes.length === 0 ? (
                                  <div style={{ padding: '8px', textAlign: 'center', fontSize: '9px', color: '#94a3b8' }}>
                                    Không có ghi chú nào trong vault.
                                  </div>
                                ) : (
                                  obsidianNotes.map((note, nIdx) => {
                                    const isSelected = selectedObsidianNote?.filename === note.filename;
                                    return (
                                      <button
                                        key={nIdx}
                                        type="button"
                                        onClick={() => fetchNoteContent(note)}
                                        style={{
                                          width: '100%',
                                          textAlign: 'left',
                                          padding: '5px 8px',
                                          background: isSelected ? '#eff6ff' : 'transparent',
                                          border: 'none',
                                          borderRadius: '6px',
                                          fontSize: '9.5px',
                                          fontWeight: isSelected ? 700 : 500,
                                          color: isSelected ? '#2563eb' : '#475569',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          transition: 'all 0.1s'
                                        }}
                                        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; }}
                                        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                      >
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>
                                          📄 {note.title}
                                        </span>
                                        <span style={{ fontSize: '8px', color: '#cbd5e1' }}>
                                          {(note.size / 1024).toFixed(1)} KB
                                        </span>
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </div>

                            {/* Trình đọc nội dung chi tiết */}
                            {selectedObsidianNote && (
                              <div style={{
                                borderTop: '1px solid #e2e8f0',
                                paddingTop: '8px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                  <span style={{ fontSize: '9px', fontWeight: 800, color: '#1e293b' }}>
                                    📖 Nội dung: {selectedObsidianNote.title}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedObsidianNote(null)}
                                    style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '10px' }}
                                  >
                                    Đóng
                                  </button>
                                </div>

                                {loadingNote ? (
                                  <div style={{ textAlign: 'center', padding: '12px' }}>
                                    <div style={{ width: '10px', height: '10px', border: '2px solid #3b82f6', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                                  </div>
                                ) : (
                                  <div style={{
                                    background: '#fff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    padding: '8px',
                                    maxHeight: '180px',
                                    overflowY: 'auto',
                                    fontFamily: 'monospace',
                                    fontSize: '9.5px',
                                    lineHeight: 1.4,
                                    color: '#334155',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    borderLeft: '3px solid #3b82f6'
                                  }}>
                                    {obsidianNoteContent}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '6px' }}>
                      <div style={{ width: '10px', height: '10px', border: '2px solid #3b82f6', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </div>
      )}

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
