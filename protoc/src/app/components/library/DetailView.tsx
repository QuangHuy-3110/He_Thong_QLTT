import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Card, Rate, Progress, Select, Input, Tag, Space, Alert, Empty, Spin, Tabs, Tooltip, Modal } from 'antd';
import axios from 'axios';
import { 
  ArrowLeftOutlined, 
  DownloadOutlined, 
  EyeOutlined, 
  HistoryOutlined, 
  CloudUploadOutlined,
  DeleteOutlined,
  EditOutlined,
  CommentOutlined,
  StarOutlined,
  UserOutlined,
  FolderOpenOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  ScissorOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { message } from 'antd';
import { User } from '../../context';
import InteractiveLessonMindmap from '../viewer/InteractiveLessonMindmap';
import DocxPreview from '../viewer/DocxPreview';
import MarkdownViewer from '../viewer/MarkdownViewer';
import { getLessonMindmapData, getLessonActivitiesTimeline, STANDARD_DURATIONS, normalizeDuration, DEFAULT_STANDARD_ACTIVITIES, DEFAULT_BIO_INTEGRATION_DETAILS, getFallbackApiBase, extractActivitiesFromMarkdown, getMarkdownHeadings, extractTextBetweenLines } from '../../utils/helpers';

interface Directory {
  id: number;
  name: string;
  is_public: boolean;
  attributes: any;
  parent: number | null;
  user?: number | null;
}

interface DirectoryOption {
  id: number;
  name: string;
  is_public: boolean;
  depth: number;
  visualPrefix: string;
}

const getDirectoriesAsTreeOptions = (
  dirs: Directory[],
  filterFn?: (d: Directory) => boolean
): DirectoryOption[] => {
  const baseDirs = filterFn ? dirs.filter(filterFn) : dirs;
  const childrenMap = new Map<number | null, Directory[]>();
  baseDirs.forEach(d => {
    const parentId = d.parent;
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(d);
  });

  const result: DirectoryOption[] = [];

  const traverse = (parentId: number | null, depth: number, prefix: string) => {
    const children = childrenMap.get(parentId) || [];
    children.sort((a, b) => a.name.localeCompare(b.name));

    children.forEach((child, index) => {
      const isLast = index === children.length - 1;
      const currentPrefix = prefix + (isLast ? '└─ ' : '├─ ');
      const nextPrefix = prefix + (isLast ? '   ' : '│  ');

      result.push({
        id: child.id,
        name: child.name,
        is_public: child.is_public,
        depth: depth,
        visualPrefix: currentPrefix
      });

      traverse(child.id, depth + 1, nextPrefix);
    });
  };

  const activeIds = new Set(baseDirs.map(d => d.id));
  const roots = baseDirs.filter(d => !d.parent || !activeIds.has(d.parent));
  roots.sort((a, b) => a.name.localeCompare(b.name));

  roots.forEach((root, index) => {
    const isLast = index === roots.length - 1;
    const currentPrefix = isLast ? '└─ ' : '├─ ';
    const nextPrefix = isLast ? '   ' : '│  ';

    result.push({
      id: root.id,
      name: root.name,
      is_public: root.is_public,
      depth: 0,
      visualPrefix: currentPrefix
    });

    traverse(root.id, 1, nextPrefix);
  });

  return result;
};

interface LessonPlan {
  id: number;
  title: string;
  description: string;
  target_student: string;
  status: string;
  creator: any;
  created_at: string;
  file_path?: string;
  file_url?: string;
  attributes?: any;
  directory_ids?: number[];
  directory_names?: string[];
  total_ratings?: number;
  average_rating?: number;
  content_preview?: string;
}

interface DetailViewProps {
  lesson: LessonPlan;
  onBack: () => void;
  currentUser: User | null;
  directories: Directory[];
  getLessonFileUrl: (lesson: LessonPlan) => string;
  getFileName: (url: string | undefined | null) => string;
  downloadFile: (lesson: LessonPlan) => void;
  downloadMarkdownFile: (title: string, content: string) => void;
  previewMode: 'docx' | 'markdown';
  setPreviewMode: (mode: 'docx' | 'markdown') => void;
  setIsDocumentFullScreen: (s: boolean) => void;
  setIsMindmapFullScreen: (s: boolean) => void;
  detailActiveTab: 'document' | 'mindmap';
  setDetailActiveTab: (tab: 'document' | 'mindmap') => void;
  lessonHighlightQuery: string;
  fetchEditHistory: (lessonId: number) => void;
  
  lessonRatings: any[];
  ratingAvg: number;
  ratingTotal: number;
  myRating: number;
  setMyRating: (rating: number) => void;
  myComment: string;
  setMyComment: (comment: string) => void;
  ratingSubmitting: boolean;
  ratingLoading: boolean;
  showRatingSection: boolean;
  setShowRatingSection: (s: boolean) => void;
  selectedStarFilter: string;
  setSelectedStarFilter: (filter: string) => void;
  editingMyReview: boolean;
  setEditingMyReview: (s: boolean) => void;
  showComments: boolean;
  setShowComments: (s: boolean) => void;
  handleSaveReview: (e: React.FormEvent) => void;
  handleDeleteReview: () => void;
  
  starStats: any;
  otherReviews: any[];
  docHistoryStack: LessonPlan[];
  handleGoBackDoc: () => void;
  
  onProposeToPublic?: (lesson: LessonPlan) => void;
  onDeleteLesson?: (lesson: LessonPlan) => void;
  onStartEditLesson?: (lesson: LessonPlan) => void;

  isInlineEditingDetail?: boolean;
  setIsInlineEditingDetail?: (s: boolean) => void;
  editingLesson?: LessonPlan | null;
  setEditingLesson?: (l: LessonPlan | null) => void;
  editTitle?: string;
  setEditTitle?: (s: string) => void;
  editDesc?: string;
  setEditDesc?: (s: string) => void;
  editGrade?: string;
  setEditGrade?: (s: string) => void;
  editLops?: string[];
  setEditLops?: (s: string[]) => void;
  editDirId?: string;
  setEditDirId?: (s: string) => void;
  editAttrs?: string;
  setEditAttrs?: (s: string) => void;
  editFile?: File | null;
  setEditFile?: (f: File | null) => void;
  submitEdit?: (e: any) => Promise<void>;
  LOCATIONS?: string[];
  editLocation?: string;
  setEditLocation?: (s: string) => void;
  editDuration?: string;
  setEditDuration?: (s: string) => void;
  editSubject?: string;
  setEditSubject?: (s: string) => void;
  editTrack?: string;
  setEditTrack?: (s: string) => void;
  editTopic?: string;
  setEditTopic?: (s: string) => void;
  editType?: string;
  setEditType?: (s: string) => void;
  editBiologyConnections?: string[];
  setEditBiologyConnections?: (s: string[]) => void;
  availableClasses?: { value: string; label: string }[];
  availableSubjects?: string[];
}

export default function DetailView({
  lesson,
  onBack,
  currentUser,
  directories,
  getLessonFileUrl,
  getFileName,
  downloadFile,
  downloadMarkdownFile,
  previewMode,
  setPreviewMode,
  setIsDocumentFullScreen,
  setIsMindmapFullScreen,
  detailActiveTab,
  setDetailActiveTab,
  lessonHighlightQuery,
  fetchEditHistory,
  lessonRatings,
  ratingAvg,
  ratingTotal,
  myRating,
  setMyRating,
  myComment,
  setMyComment,
  ratingSubmitting,
  ratingLoading,
  showRatingSection,
  setShowRatingSection,
  selectedStarFilter,
  setSelectedStarFilter,
  editingMyReview,
  setEditingMyReview,
  showComments,
  setShowComments,
  handleSaveReview,
  handleDeleteReview,
  starStats,
  otherReviews,
  docHistoryStack,
  handleGoBackDoc,
  onProposeToPublic,
  onDeleteLesson,
  onStartEditLesson,
  isInlineEditingDetail = false,
  setIsInlineEditingDetail,
  editingLesson,
  setEditingLesson,
  editTitle = '',
  setEditTitle,
  editDesc = '',
  setEditDesc,
  editGrade = '',
  setEditGrade,
  editLops = [],
  setEditLops,
  editDirId = '',
  setEditDirId,
  editAttrs = '{}',
  setEditAttrs,
  editFile = null,
  setEditFile,
  submitEdit,
  LOCATIONS = [],
  editLocation = '',
  setEditLocation,
  editDuration = '',
  setEditDuration,
  editSubject = '',
  setEditSubject,
  editTrack = '',
  setEditTrack,
  editTopic = '',
  setEditTopic,
  editType = '',
  setEditType,
  editBiologyConnections = [],
  setEditBiologyConnections,
  availableClasses = [],
  availableSubjects = []
}: DetailViewProps) {



  const [selectedActivityModal, setSelectedActivityModal] = useState<any | null>(null);
  const [isEditingActivities, setIsEditingActivities] = useState(false);
  const [editingActivitiesList, setEditingActivitiesList] = useState<any[]>([]);
  const [savingActivities, setSavingActivities] = useState(false);

  const handleOpenEditActivities = () => {
    const cleanList = (list: any[]) => list.map(a => {
      const name = a.ten_hoat_dong || a.title || a.name || '';
      const cleanName = name.replace(/^(Hoạt\s*động|HĐ)\s*\d+[\s:\-]*/i, '').trim();
      return {
        ...a,
        ten_hoat_dong: cleanName || name
      };
    });

    const existing = lesson.attributes?.tien_trinh_day_hoc;
    if (Array.isArray(existing) && existing.length > 0) {
      setEditingActivitiesList(cleanList(existing));
    } else if (lesson.content_preview) {
      const extracted = extractActivitiesFromMarkdown(lesson.content_preview);
      if (extracted.length > 0) {
        setEditingActivitiesList(cleanList(extracted));
      } else {
        setEditingActivitiesList([
          { ten_hoat_dong: '', thoi_gian: '15 phút', tom_tat: '' }
        ]);
      }
    } else {
      setEditingActivitiesList([
        { ten_hoat_dong: '', thoi_gian: '15 phút', tom_tat: '' }
      ]);
    }
    setIsEditingActivities(true);
  };

  const handleSaveActivities = async () => {
    setSavingActivities(true);
    try {
      const apiBase = localStorage.getItem('kms_api_base_url') || import.meta.env.VITE_API_BASE_URL || getFallbackApiBase('');
      const cleanApiBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
      const updatedAttrs = {
        ...(currentLessonAttrs || {}),
        tien_trinh_day_hoc: editingActivitiesList
      };
      
      const formData = new FormData();
      formData.append('attributes', JSON.stringify(updatedAttrs));
      if (currentUser) {
        formData.append('user_id', String(currentUser.id));
      }

      const res = await axios.patch(`${cleanApiBase}/api/lesson-plans/${lesson.id}/?user_id=${currentUser?.id || ''}`, formData);
      if (res.status === 200) {
        setCurrentLessonAttrs(updatedAttrs);
        lesson.attributes = updatedAttrs;
        setIsEditingActivities(false);
        message.success('Đã lưu tiến trình hoạt động!');
      }
    } catch (err) {
      console.error('Error saving activities:', err);
      message.error('Lỗi khi lưu tiến trình hoạt động.');
    } finally {
      setSavingActivities(false);
    }
  };

  const handleExtractAndMapFromMarkdown = async () => {
    if (!lesson.content_preview) {
      message.warning('Tài liệu chưa có bản xem trước văn bản (Markdown).');
      return;
    }
    const extracted = extractActivitiesFromMarkdown(lesson.content_preview);
    if (extracted.length === 0) {
      message.info('Không tự động tìm thấy các đề mục Hoạt động trong văn bản.');
      setIsEditingActivities(true);
      return;
    }

    setSavingActivities(true);
    try {
      const apiBase = localStorage.getItem('kms_api_base_url') || import.meta.env.VITE_API_BASE_URL || getFallbackApiBase('');
      const cleanApiBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
      const updatedAttrs = {
        ...(currentLessonAttrs || {}),
        tien_trinh_day_hoc: extracted
      };
      
      const formData = new FormData();
      formData.append('attributes', JSON.stringify(updatedAttrs));
      if (currentUser) {
        formData.append('user_id', String(currentUser.id));
      }

      const res = await axios.patch(`${cleanApiBase}/api/lesson-plans/${lesson.id}/?user_id=${currentUser?.id || ''}`, formData);
      if (res.status === 200) {
        setCurrentLessonAttrs(updatedAttrs);
        lesson.attributes = updatedAttrs;
        setEditingActivitiesList(extracted);
        setIsEditingActivities(false);
        message.success(`🎯 Đã trích xuất ${extracted.length} hoạt động từ Markdown và cập nhật Sơ đồ tư duy!`);
      }
    } catch (err) {
      console.error('Error auto-mapping activities from markdown:', err);
      message.error('Lỗi khi lưu tiến trình trích xuất.');
    } finally {
      setSavingActivities(false);
    }
  };

  const [currentLessonAttrs, setCurrentLessonAttrs] = useState<any>(lesson.attributes || {});

  React.useEffect(() => {
    setCurrentLessonAttrs(lesson.attributes || {});
  }, [lesson]);

  const activeLesson = useMemo(() => ({
    ...lesson,
    attributes: currentLessonAttrs
  }), [lesson, currentLessonAttrs]);

  const [showRangePickerModal, setShowRangePickerModal] = useState(false);
  const [customRangeText, setCustomRangeText] = useState('');
  const [previewExtractedActivities, setPreviewExtractedActivities] = useState<any[]>([]);

  const handleOpenRangePickerModal = () => {
    const text = lesson.content_preview || '';
    setCustomRangeText('');
    const initialExtracted = extractActivitiesFromMarkdown(text);
    setPreviewExtractedActivities(initialExtracted);
    setShowRangePickerModal(true);
  };

  const handleMouseUpInWordView = () => {
    const selection = window.getSelection();
    if (selection) {
      const text = selection.toString().trim();
      if (text.length > 10) {
        setCustomRangeText(text);
        const extracted = extractActivitiesFromMarkdown(text);
        setPreviewExtractedActivities(extracted);
        if (extracted.length > 0) {
          message.success(`🎯 Đã trích xuất ${extracted.length} hoạt động từ đoạn bôi đen!`);
        }
      }
    }
  };

  const handleApplyWordSelection = async () => {
    if (previewExtractedActivities.length === 0) {
      message.warning('Vui lòng bôi đen chọn đoạn văn bản chứa các Hoạt động dạy học.');
      return;
    }
    setSavingActivities(true);
    try {
      const apiBase = localStorage.getItem('kms_api_base_url') || import.meta.env.VITE_API_BASE_URL || getFallbackApiBase('');
      const cleanApiBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
      const updatedAttrs = {
        ...(currentLessonAttrs || {}),
        tien_trinh_day_hoc: previewExtractedActivities
      };
      
      const formData = new FormData();
      formData.append('attributes', JSON.stringify(updatedAttrs));
      if (currentUser) {
        formData.append('user_id', String(currentUser.id));
      }

      const res = await axios.patch(`${cleanApiBase}/api/lesson-plans/${lesson.id}/?user_id=${currentUser?.id || ''}`, formData);
      if (res.status === 200) {
        setCurrentLessonAttrs(updatedAttrs);
        lesson.attributes = updatedAttrs;
        setEditingActivitiesList(previewExtractedActivities);
        setShowRangePickerModal(false);
        setIsEditingActivities(false);
        message.success(`⚡ Đã lưu ${previewExtractedActivities.length} hoạt động từ đoạn bôi đen và tự động cập nhật Sơ đồ tư duy!`);
      }
    } catch (err) {
      console.error('Error applying word selection:', err);
      message.error('Lỗi khi lưu tiến trình trích xuất.');
    } finally {
      setSavingActivities(false);
    }
  };

  const fileUrl = getLessonFileUrl(lesson);
  const isPdfFile = fileUrl ? fileUrl.toLowerCase().endsWith('.pdf') : false;
  const isDocx = fileUrl ? (fileUrl.toLowerCase().endsWith('.docx') || fileUrl.toLowerCase().endsWith('.doc')) : false;
  const isMd = fileUrl ? (fileUrl.toLowerCase().endsWith('.md') || fileUrl.toLowerCase().endsWith('.markdown') || fileUrl.toLowerCase().endsWith('.txt')) : !!lesson.content_preview;

  const currentTeacherOwnsThis = currentUser && (
    currentUser.role === 'ADMIN' || 
    lesson.creator?.id === currentUser.id
  );

  React.useEffect(() => {
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = origOverflow;
    };
  }, []);

  const getPedagogyTipText = (cat: string, label: string): string => {
    const n = (cat + ' ' + label).toLowerCase();
    if (n.includes('khởi động') || n.includes('kích hoạt')) return '### 💡 Gợi ý phương pháp & kĩ thuật dạy học – CTGDPT 2018\n• **Mục tiêu**: Kết nối kiến thức cũ – kích thích tò mò – tạo nhu cầu học.\n• **Kĩ thuật hiệu quả**: Trò chơi nhanh, câu đố tình huống, video ngắn 60 giây, ảnh bí ẩn.\n• **Phương pháp đánh giá**: Quan sát thái độ tích cực và khả năng nhận diện vấn đề thực tế.';
    if (n.includes('khám phá') || n.includes('tìm hiểu')) return '### 💡 Gợi ý phương pháp & kĩ thuật dạy học – CTGDPT 2018\n• **Mục tiêu**: HS tự khám phá, hình thành kiến thức mới qua tài liệu và thảo luận nhóm.\n• **Kĩ thuật hiệu quả**: Mảnh ghép (Jigsaw), Think-Pair-Share, sơ đồ tư duy.\n• **Phương pháp đánh giá**: Đánh giá quá trình qua phiếu học tập và tương tác nhóm.';
    if (n.includes('luyện tập') || n.includes('thực hành')) return '### 💡 Gợi ý phương pháp & kĩ thuật dạy học – CTGDPT 2018\n• **Mục tiêu**: Vận dụng trực tiếp kiến thức vào bài tập ngữ cảnh thực tế.\n• **Kĩ thuật hiệu quả**: Dạy học theo trạm, dự án mini, đóng vai xử lý tình huống.\n• **Phương pháp đánh giá**: Chấm sản phẩm thực hành theo bảng tiêu chí Rubric.';
    if (n.includes('chia sẻ') || n.includes('báo cáo')) return '### 💡 Gợi ý phương pháp & kĩ thuật dạy học – CTGDPT 2018\n• **Mục tiêu**: Thuyết trình sản phẩm, phản biện và hoàn thiện bài học.\n• **Kĩ thuật hiệu quả**: Đánh giá đồng đẳng (Peer Assessment), phản hồi chéo.\n• **Phương pháp đánh giá**: Đánh giá năng lực giao tiếp, hợp tác và tự tin thuyết trình.';
    if (n.includes('vận dụng') || n.includes('liên hệ')) return '### 💡 Gợi ý phương pháp & kĩ thuật dạy học – CTGDPT 2018\n• **Mục tiêu**: Chuyển hóa bài học thành hành động cụ thể trong đời sống gia đình và cộng đồng.\n• **Kĩ thuật hiệu quả**: Nhật ký 7 ngày trải nghiệm, bản cam kết kế hoạch cá nhân.\n• **Phương pháp đánh giá**: Tự đánh giá bản thân và phản hồi đồng hành của phụ huynh.';
    return '### 💡 Gợi ý phương pháp & kĩ thuật dạy học – CTGDPT 2018\n• **Mục tiêu**: Phát triển năng lực đặc thù và phẩm chất học sinh.\n• **Kĩ thuật hiệu quả**: Dạy học tích cực, cá thể hóa theo năng lực học sinh.';
  };

  const parsedMindmapData = useMemo(() => getLessonMindmapData({ ...lesson, attributes: currentLessonAttrs }), [lesson, currentLessonAttrs]);

  // Build timeline directly from saved attributes.tien_trinh_day_hoc if present
  // Also enrich with chi_tiet from content_preview (detailed Word content)
  const activitiesTimeline = useMemo(() => {
    const acts = currentLessonAttrs?.tien_trinh_day_hoc;

    // Pre-extract chi_tiet blocks from content_preview
    const chiTietBlocksMap: Record<number, string> = {};
    if (lesson.content_preview) {
      // Find "2. Tiến trình dạy học chi tiết" section
      const detailSectionMatch = lesson.content_preview.match(/(?:2\.\s*Tiến\s*trình\s*dạy\s*học\s*chi\s*tiết|Tiến\s*trình\s*dạy\s*học\s*chi\s*tiết)([\s\S]*)/i);
      if (detailSectionMatch) {
        let detailText = detailSectionMatch[1];
        // Cut off at major section IV. ĐÁNH GIÁ or V. ĐÁNH GIÁ
        const cutoffMatch = detailText.match(/(?:\r?\n|\r|^)\s*(?:##|#)?\s*(?:IV|V|4|5)[\.\)]\s*(?:ĐÁNH\s*GIÁ|MỞ\s*RỘNG|PHỤ\s*LỤC|HƯỚNG\s*DẪN)/i);
        if (cutoffMatch && cutoffMatch.index !== undefined) {
          detailText = detailText.slice(0, cutoffMatch.index);
        }

        // Split by Heading 3 Activity titles: ### Hoạt động 01:, ### Hoạt động 1:, etc.
        const rawBlocks = detailText.split(/(?=(?:\r?\n|\r|^)\s*###?\s*Hoạt\s*động\s*0?\d+)/i);
        rawBlocks.forEach(b => {
          const trimmed = b.trim();
          const numMatch = trimmed.match(/^(?:###?\s*)?Hoạt\s*động\s*0?(\d+)/i);
          if (numMatch) {
            const actNum = parseInt(numMatch[1], 10);
            chiTietBlocksMap[actNum] = trimmed;
          }
        });
      }
    }

    // Clean any trailing sections like IV, V, MỞ RỘNG, ĐÁNH GIÁ from chi_tiet content string
    const sanitizeChiTiet = (text: string): string => {
      if (!text) return '';
      const cutRegex = /(?:\r?\n|\r)\s*(?:#+\s*)?(?:IV|V|VI|VII|VIII|\d+)\.[\s\S]*$/i;
      let cleaned = text.replace(cutRegex, '').trim();
      const keywordCut = cleaned.match(/(?:\r?\n|\r|^)\s*(?:#+\s*)?(?:V|IV|VI)\.\s*(?:MỞ\s*RỘNG|ĐÁNH\s*GIÁ|PHỤ\s*LỤC|HƯỚNG\s*DẪN)/i);
      if (keywordCut && keywordCut.index !== undefined && keywordCut.index > 30) {
        cleaned = cleaned.slice(0, keywordCut.index).trim();
      }
      return cleaned;
    };

    // Function to search for an activity block dynamically in content_preview by activity index
    const findChiTietForActivity = (index: number) => {
      const actNum = index + 1;
      let blockText = chiTietBlocksMap[actNum] || '';
      if (!blockText && lesson.content_preview) {
        const reg = new RegExp(`(?:\r?\n|\r|^)\\s*###?\\s*Hoạt\\s*động\\s*0?${actNum}[:\\s][\\s\\S]*?(?=(?:\r?\n|\r|^)\\s*###?\\s*Hoạt\\s*động\\s*0?\\d+|(?:\\r?\\n|\\r|^)\\s*(?:##|#)?\\s*(?:IV|V)[\\.\\)]\\s*ĐÁNH\\s*GIÁ|$)`, 'i');
        const m = lesson.content_preview.match(reg);
        if (m) blockText = m[0].trim();
      }
      return sanitizeChiTiet(blockText);
    };

    if (Array.isArray(acts) && acts.length > 0) {
      return acts.map((a: any, idx: number) => {
        const rawTitle = a.ten_hoat_dong || a.title || a.name || '';
        const cleanName = rawTitle.replace(/^(Hoạt\s*động|HĐ)\s*\d+[\s:\-]*/i, '').trim();
        const chiTietContent = sanitizeChiTiet(a.chi_tiet) || findChiTietForActivity(idx);
        return {
          title: cleanName || rawTitle || `Hoạt động ${idx + 1}`,
          duration: a.thoi_gian || a.time || a.duration || `${15 + (idx % 3) * 10} phút`,
          summary: a.tom_tat || a.muc_tieu || a.summary || '',
          chi_tiet: chiTietContent,
          details: chiTietContent || `### 📌 ${cleanName || rawTitle} — ⏱️ ${a.thoi_gian || '15 phút'}\n\n${a.tom_tat ? `### 📝 Nội dung\n${a.tom_tat}` : ''}`,
          category: 'TIẾN TRÌNH & HOẠT ĐỘNG DẠY HỌC'
        };
      });
    }
    return getLessonActivitiesTimeline(parsedMindmapData).map((item: any, idx: number) => {
      const cleanName = (item.title || '').replace(/^(Hoạt\s*động|HĐ)\s*\d+[\s:\-]*/i, '').trim();
      const chiTietContent = sanitizeChiTiet(item.chi_tiet) || findChiTietForActivity(idx);
      return {
        ...item,
        title: cleanName || item.title,
        chi_tiet: chiTietContent,
        details: chiTietContent || item.details
      };
    });
  }, [currentLessonAttrs, parsedMindmapData, lesson.content_preview]);

  const getDirectoryFullPath = (dirId: number, dirs: Directory[]): string => {
    const path: string[] = [];
    let currentId: number | null = dirId;
    const visited = new Set<number>();
    while (currentId !== null && currentId !== undefined) {
      if (visited.has(currentId)) break;
      visited.add(currentId);
      const found = dirs.find(d => d.id === currentId);
      if (found) {
        path.unshift(found.name);
        currentId = found.parent;
      } else break;
    }
    return path.join(' / ');
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50/95 backdrop-blur-sm overflow-y-auto">
    <div className="w-full max-w-[1650px] mx-auto p-4 md:p-6 lg:p-8 animate-in fade-in duration-300">
      
      {/* Detail View Header Navbar */}
      <div className="bg-white border border-gray-150 rounded-2xl p-4 mb-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={handleGoBackDoc}
            className="hover:text-blue-600 font-bold"
          >
            Quay lại {docHistoryStack.length > 0 ? 'tài liệu trước' : 'danh sách'}
          </Button>
          <DividerVertical />
          <span className="text-gray-500 font-medium text-xs">
            {lesson.status === 'LOCAL' ? (
              <Tag color="cyan">Thư viện cá nhân</Tag>
            ) : (
              <Tag color="success">Thư viện chung</Tag>
            )}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Action: Propose to public */}
          {lesson.status === 'LOCAL' && currentUser && onProposeToPublic && (
            <Button
              type="primary"
              icon={<CloudUploadOutlined />}
              onClick={() => onProposeToPublic(lesson)}
              className="bg-sky-600 hover:bg-sky-700 border-none rounded-xl text-xs"
            >
              Đăng lên cộng đồng
            </Button>
          )}

          {/* Action: Edit lesson */}
          {currentTeacherOwnsThis && onStartEditLesson && (
            <Button
              type="default"
              icon={<EditOutlined />}
              onClick={() => onStartEditLesson(lesson)}
              className="rounded-xl border-yellow-500 hover:border-yellow-600 text-yellow-600 hover:text-yellow-700 text-xs"
            >
              Chỉnh sửa
            </Button>
          )}

          {/* Action: Delete lesson */}
          {currentTeacherOwnsThis && onDeleteLesson && (
            <Button
              type="default"
              danger
              icon={<DeleteOutlined />}
              onClick={() => onDeleteLesson(lesson)}
              className="rounded-xl text-xs"
            >
              Xóa tài liệu
            </Button>
          )}

          {/* Action: View Edit History */}
          {currentUser && (
            <Button
              icon={<HistoryOutlined />}
              onClick={() => fetchEditHistory(lesson.id)}
              className="rounded-xl text-xs"
            >
              Lịch sử chỉnh sửa
            </Button>
          )}

          {/* Action: Download */}
          {(lesson.file_path || lesson.file_url) && (
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => downloadFile(lesson)}
              className="bg-blue-650 hover:bg-blue-700 border-none rounded-xl text-xs"
            >
              Tải Word
            </Button>
          )}

          {/* Vertical Separator */}
          <div className="h-6 w-[1px] bg-gray-250 mx-1 hidden sm:block" />

          {/* Action: Toggle Sidebar (Far Right End / Ở bên phải cuối cùng) */}
          <Tooltip title={showComments ? "Ẩn tiện ích (Khung tiến trình & Đánh giá)" : "Hiện tiện ích (Khung tiến trình & Đánh giá)"} placement="bottomRight">
            <button
              type="button"
              onClick={() => setShowComments(!showComments)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-slate-250 hover:border-blue-500 hover:bg-blue-50/50 flex items-center justify-center shadow-xs hover:shadow-md transition-all group cursor-pointer active:scale-95 ml-0.5"
              aria-label={showComments ? "Ẩn tiện ích" : "Hiện tiện ích"}
            >
              {showComments ? (
                /* Arrow points RIGHT to hide/collapse sidebar to the right */
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 group-hover:text-blue-600 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="4" ry="4" />
                  <line x1="15" y1="3" x2="15" y2="21" />
                  <path d="M8 10l2 2-2 2" />
                </svg>
              ) : (
                /* Arrow points LEFT to expand/pull sidebar out from the right */
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 group-hover:text-blue-600 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="4" ry="4" />
                  <line x1="15" y1="3" x2="15" y2="21" />
                  <path d="M10 10l-2 2 2 2" />
                </svg>
              )}
            </button>
          </Tooltip>
        </div>
      </div>

      <div className={"grid grid-cols-1 " + (showComments ? "lg:grid-cols-[1fr_380px]" : "lg:grid-cols-1") + " gap-6 items-start"}>
        
        {/* Card 1: Horizontal Metadata Header Card */}
        <div className="order-1 lg:order-none lg:col-start-1 lg:row-start-1">
          {isInlineEditingDetail ? (
            <Card className="shadow-sm rounded-3xl border-purple-200 bg-purple-50/10" style={{ marginBottom: '0px' }} bodyStyle={{ padding: '24px' }}>
              <form onSubmit={submitEdit} className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-purple-700 m-0 mb-4">✍️ Chỉnh sửa thông tin bài giảng</h3>
                
                {/* Row 1: Title, Directory, Duration */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Tiêu đề bài giảng *</label>
                    <Input
                      required
                      value={editTitle}
                      onChange={(e) => setEditTitle && setEditTitle(e.target.value)}
                      className="rounded-xl px-4 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Thư mục lưu trữ *</label>
                    <Select
                      value={editDirId || undefined}
                      onChange={(val) => setEditDirId && setEditDirId(val)}
                      placeholder="-- Chọn thư mục --"
                      className="w-full text-xs"
                      size="large"
                      style={{ borderRadius: 12 }}
                      options={getDirectoriesAsTreeOptions(directories).map(d => ({
                        value: d.id.toString(),
                        label: `${d.visualPrefix}${d.name} ${d.is_public ? '👥' : '🔒'}`
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Thời gian thực hiện (Số tiết)</label>
                    <Select
                      showSearch
                      allowClear
                      value={editDuration ? normalizeDuration(editDuration) : undefined}
                      onChange={(value) => setEditDuration && setEditDuration(value || '')}
                      placeholder="Chọn số tiết..."
                      className="w-full text-xs"
                      options={STANDARD_DURATIONS.map(d => ({ label: `⏱️ ${d}`, value: d }))}
                    />
                  </div>
                </div>

                {/* Row 2: Môn học & Loại hình tiết dạy */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">
                      Môn học <span className="text-gray-400 font-normal lowercase">(chọn hoặc gõ thêm mới)</span>
                    </label>
                    <Select
                      showSearch
                      allowClear
                      popupMatchSelectWidth={false}
                      value={editSubject || undefined}
                      onChange={(val) => setEditSubject && setEditSubject(val || '')}
                      onSearch={(text) => {
                        if (text && text.trim()) setEditSubject && setEditSubject(text.trim());
                      }}
                      className="w-full text-xs"
                      size="large"
                      placeholder="Chọn hoặc nhập tên môn..."
                      style={{ borderRadius: 12 }}
                      options={Array.from(new Set([
                        'Hoạt động trải nghiệm Sinh học',
                        'Sinh học',
                        'Hoạt động trải nghiệm, hướng nghiệp',
                        'Khoa học tự nhiên',
                        ...(availableSubjects || []).filter(s => s && s.length < 40),
                        ...(editSubject ? [editSubject] : [])
                      ])).map(s => ({ value: s, label: s }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Loại hình tiết dạy</label>
                    <Input
                      value={editType}
                      onChange={(e) => setEditType && setEditType(e.target.value)}
                      placeholder="Hoạt động giáo dục theo chủ đề, Thực hành..."
                      className="rounded-xl px-4 py-2 text-xs"
                    />
                  </div>
                </div>

                {/* Row 3: Đối tượng học sinh & Mạch kiến thức & Chủ đề */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Đối tượng học sinh</label>
                    <Select
                      mode="tags"
                      value={editGrade ? editGrade.split(',').map(s => s.trim()).filter(Boolean) : []}
                      onChange={(val) => setEditGrade && setEditGrade(Array.isArray(val) ? val.join(', ') : val)}
                      className="w-full text-xs"
                      size="large"
                      placeholder="Chọn đối tượng..."
                      style={{ borderRadius: 12 }}
                      options={[
                        { value: 'Học sinh thành thị', label: '🏫 Học sinh thành thị' },
                        { value: 'Học sinh nông thôn', label: '🌾 Học sinh nông thôn' }
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Mạch kiến thức</label>
                    <Input
                      value={editTrack}
                      onChange={(e) => setEditTrack && setEditTrack(e.target.value)}
                      placeholder="Hoạt động hướng vào bản thân..."
                      className="rounded-xl px-4 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Chủ đề</label>
                    <Input
                      value={editTopic}
                      onChange={(e) => setEditTopic && setEditTopic(e.target.value)}
                      placeholder="Tên chủ đề..."
                      className="rounded-xl px-4 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Lớp dạy</label>
                    <Select
                      mode="tags"
                      value={editLops}
                      onChange={(val) => setEditLops && setEditLops(val)}
                      className="w-full text-xs"
                      placeholder="Nhập lớp (ví dụ: 10A1, Lớp 10)..."
                      size="large"
                      style={{ borderRadius: 12 }}
                      options={availableClasses}
                    />
                  </div>
                </div>

                {/* Row 4: 🧬 Kiến thức sinh học liên quan (Gợi ý thư mục + Tìm kiếm CSDL + Thêm mới) */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">
                    🧬 Kiến thức sinh học liên quan <span className="text-purple-600 font-semibold lowercase">(chọn từ gợi ý thư mục, tìm kiếm CSDL hoặc gõ từ khóa mới)</span>
                  </label>
                  <Select
                    mode="tags"
                    allowClear
                    value={editBiologyConnections}
                    onChange={(val) => setEditBiologyConnections && setEditBiologyConnections(val)}
                    className="w-full text-xs"
                    size="large"
                    placeholder="🔍 Chọn hoặc gõ tìm kiếm từ khóa kiến thức..."
                    style={{ borderRadius: 12 }}
                    options={Array.from(new Set([
                      ...(editBiologyConnections || []),
                      ...(directories.flatMap(d => d.attributes?.knowledge_tags || [])),
                      ...(directories.find(d => d.id.toString() === editDirId)?.attributes?.knowledge_tags || []),
                      'Chuyển hóa năng lượng',
                      'Cân bằng nước, sinh học giấc ngủ, nhịp sinh học',
                      'Công nghệ gen, sinh học phân tử, ứng dụng di truyền',
                      'Cơ chế nghe – nhìn, ảnh hưởng âm nhạc đến tâm lý',
                      'Cơ chế thèm ăn, dinh dưỡng cân bằng và chuyển hóa năng lượng',
                      'Đa dạng sinh học, sinh thái học bảo tồn, ô nhiễm môi trường',
                      'Hệ miễn dịch, bệnh truyền nhiễm, vắc xin',
                      'Hệ thần kinh, phản xạ, ứng phó căng thẳng',
                      'Hệ tuần hoàn, hệ hô hấp, thể dục thể thao'
                    ])).map(tag => ({ value: tag, label: `🧬 ${tag}` }))}
                  />
                </div>

                {/* Row 5: Description & File */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Mô tả chi tiết / Tóm tắt</label>
                  <Input.TextArea
                    value={editDesc}
                    onChange={(e) => setEditDesc && setEditDesc(e.target.value)}
                    placeholder="Mô tả tóm tắt nội dung bài học..."
                    rows={3}
                    className="rounded-xl px-4 py-2 text-xs resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Thay đổi tệp đính kèm (Word / PDF)</label>
                  <input
                    type="file"
                    accept=".doc,.docx,.pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setEditFile && setEditFile(e.target.files[0]);
                      }
                    }}
                    className="text-xs w-full border border-gray-250 rounded-xl px-3 py-1.5 bg-white"
                  />
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                  <Button
                    onClick={() => setIsInlineEditingDetail && setIsInlineEditingDetail(false)}
                    className="rounded-xl font-bold"
                  >
                    Hủy bỏ
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    className="bg-purple-650 hover:bg-purple-700 border-none rounded-xl font-extrabold"
                  >
                    Lưu thay đổi
                  </Button>
                </div>
              </form>
            </Card>
          ) : (
            <Card
              className="shadow-sm rounded-3xl border-gray-150 bg-white"
              bodyStyle={{ padding: '24px' }}
            >
              {/* Lesson Title & Header Bar */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-gray-150 pb-5">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-black uppercase tracking-widest bg-blue-100/80 text-blue-800 border border-blue-200 mb-2">
                    📌 TIÊU ĐỀ GIÁO ÁN
                  </span>
                  <h1 className="text-xl sm:text-2xl font-black text-gray-900 m-0 leading-snug">{lesson.title}</h1>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Tag color="purple" className="text-xs sm:text-sm font-bold px-3 py-1.5 rounded-xl shadow-2xs">📖 {lesson.target_student || 'Giáo án'}</Tag>
                  {lesson.status === 'PUBLISHED' ? (
                    <Tag color="success" className="text-xs sm:text-sm font-bold px-3 py-1.5 rounded-xl shadow-2xs">Công khai</Tag>
                  ) : (
                    <Tag color="default" className="text-xs sm:text-sm font-bold px-3 py-1.5 rounded-xl shadow-2xs">Cá nhân</Tag>
                  )}
                </div>
              </div>
              
              {/* 3 Spacious Grid Cards for Metadata (Combined Directory & Subject + Expanded Integrated Knowledge) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_1.1fr_1.5fr] gap-5 sm:gap-6 text-xs">
                {/* Block 1: Combined System Directory + Subject & Grade */}
                <div className="p-4 bg-slate-50/80 border border-slate-200/90 rounded-2xl space-y-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
                  <div className="space-y-3.5">
                    {/* Sub-section A: System Directory */}
                    {lesson.directory_ids && lesson.directory_ids.length > 0 && (
                      <div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/80 mb-2">
                          📂 THƯ MỤC HỆ THỐNG
                        </span>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {lesson.directory_ids.map(dirId => (
                            <Tag color="blue" key={dirId} className="m-0 text-xs px-2.5 py-1 rounded-xl font-medium max-w-full truncate shadow-2xs" title={getDirectoryFullPath(dirId, directories)}>
                              {getDirectoryFullPath(dirId, directories)}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Sub-section B: Subject & Grade */}
                    {lesson.attributes && (lesson.attributes['Môn học'] || lesson.attributes['lop']) && (
                      <div className={lesson.directory_ids && lesson.directory_ids.length > 0 ? "pt-3 border-t border-slate-200/70" : ""}>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/80 mb-2">
                          📚 MÔN HỌC & LỚP
                        </span>
                        <div className="space-y-1.5 pt-0.5 text-xs">
                          {lesson.attributes['Môn học'] && (
                            <p className="m-0 text-gray-700 font-semibold">Môn: <span className="font-extrabold text-indigo-900">{lesson.attributes['Môn học']}</span></p>
                          )}
                          {lesson.attributes['lop'] && (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {(Array.isArray(lesson.attributes['lop']) ? lesson.attributes['lop'] : [lesson.attributes['lop']]).map((l: string) => (
                                <Tag color="cyan" key={l} className="m-0 text-xs px-2.5 py-0.5 rounded-xl font-bold">{l}</Tag>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Block 2: Teaching Info */}
                {lesson.attributes && (lesson.attributes['Mạch kiến thức'] || lesson.attributes['Chủ đề'] || lesson.attributes['Địa điểm']) && (
                  <div className="p-4 bg-slate-50/80 border border-slate-200/90 rounded-2xl space-y-3 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-extrabold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200/80 mb-2">
                        📍 THÔNG TIN GIẢNG DẠY
                      </span>
                      <div className="space-y-2 pt-1 text-xs">
                        {lesson.attributes['Mạch kiến thức'] && (
                          <p className="m-0 text-gray-600">Mạch: <span className="font-bold text-gray-900">{lesson.attributes['Mạch kiến thức']}</span></p>
                        )}
                        {lesson.attributes['Chủ đề'] && (
                          <p className="m-0 text-gray-600">Chủ đề: <span className="font-bold text-gray-900">{lesson.attributes['Chủ đề']}</span></p>
                        )}
                        {lesson.attributes['Địa điểm'] && (
                          <p className="m-0 text-gray-600">Địa điểm: <span className="font-bold text-gray-900">{lesson.attributes['Địa điểm']}</span></p>
                        )}
                        {(lesson.attributes['Thời gian thực hiện'] || lesson.attributes['Thời gian'] || lesson.attributes['Số tiết']) && (
                          <p className="m-0 text-gray-600 pt-0.5">⏱️ Thời gian: <span className="font-black text-blue-700">{normalizeDuration(lesson.attributes['Thời gian thực hiện'] || lesson.attributes['Thời gian'] || lesson.attributes['Số tiết'])}</span></p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Block 3: Expanded Integrated Knowledge Space */}
                {lesson.attributes && lesson.attributes['Kiến thức sinh học liên quan'] && (
                  <div className="p-4 bg-slate-50/80 border border-slate-200/90 rounded-2xl space-y-3 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200/80 mb-2">
                        ✨ KIẾN THỨC TÍCH HỢP LIÊN QUAN
                      </span>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {(Array.isArray(lesson.attributes['Kiến thức sinh học liên quan'])
                          ? lesson.attributes['Kiến thức sinh học liên quan']
                          : String(lesson.attributes['Kiến thức sinh học liên quan']).split(',')
                        ).map((t: any, idx: number) => (
                          <Tag color="emerald" key={idx} className="m-0 text-xs px-3 py-1 rounded-xl font-medium shadow-2xs hover:scale-105 transition-transform">{String(t).trim()}</Tag>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Description / Summary Block */}
              {lesson.description && (
                <div className="mt-6 pt-5 border-t border-gray-200/80 space-y-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200/80 mb-1">
                    📝 MÔ TẢ TÓM TẮT BÀI GIẢNG
                  </span>
                  <p className="text-xs sm:text-sm text-gray-800 bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-gray-200 leading-relaxed whitespace-pre-wrap m-0 shadow-2xs">
                    {lesson.description}
                  </p>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Card 2: Activity Timeline Panel (Khung Tiến trình hoạt động giảng dạy) */}
        {/* MOBILE: order-2 (HIỂN THỊ TRƯỚC XEM FILE) | DESKTOP: lg:col-start-2 lg:row-start-1 */}
        {showComments && (
          <div className="order-2 lg:order-none lg:col-start-2 lg:row-start-1 w-full">
            <Card
              title={
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-gray-800 text-xs uppercase tracking-wider flex items-center gap-1.5">⚡ TIẾN TRÌNH HOẠT ĐỘNG GIẢNG DẠY</span>
                  {currentTeacherOwnsThis && (
                    <Tooltip title={isEditingActivities ? "Đóng chỉnh sửa" : "Chỉnh sửa tiến trình"}>
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined className="text-gray-500 hover:text-blue-600 text-sm" />}
                        onClick={() => {
                          if (isEditingActivities) {
                            setIsEditingActivities(false);
                          } else {
                            handleOpenEditActivities();
                          }
                        }}
                        className="p-1 rounded-lg flex items-center justify-center hover:bg-slate-100"
                      />
                    </Tooltip>
                  )}
                </div>
              }
              className="shadow-sm rounded-3xl border-gray-150"
              size="small"
            >
              {isEditingActivities ? (
                /* EDITING MODE */
                <div className="p-4 space-y-4 bg-slate-50/70 rounded-2xl">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-gray-200">
                    <span className="text-xs font-extrabold text-blue-800 uppercase">✍️ Chỉnh sửa các Hoạt động:</span>
                    {lesson.content_preview && (
                      <Button
                        type="dashed"
                        size="small"
                        icon={<ScissorOutlined />}
                        onClick={handleOpenRangePickerModal}
                        className="text-[11px] font-bold text-blue-700 border-blue-300 bg-blue-50 hover:bg-blue-100"
                      >
                        ✂️ Chọn vị trí trong văn bản
                      </Button>
                    )}
                  </div>

                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {editingActivitiesList.map((act, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 space-y-2 shadow-2xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-blue-700">Hoạt động {idx + 1}</span>
                          <div className="flex items-center gap-1.5">
                            <Input
                              size="small"
                              placeholder="Thời gian"
                              value={act.thoi_gian}
                              onChange={e => {
                                const val = e.target.value;
                                setEditingActivitiesList(prev => prev.map((a, i) => i === idx ? { ...a, thoi_gian: val } : a));
                              }}
                              className="w-28 text-xs font-bold text-blue-700 text-center rounded-lg"
                            />
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => setEditingActivitiesList(prev => prev.filter((_, i) => i !== idx))}
                            />
                          </div>
                        </div>

                        <Input
                          placeholder="Tên hoạt động..."
                          value={act.ten_hoat_dong}
                          onChange={e => {
                            const val = e.target.value;
                            setEditingActivitiesList(prev => prev.map((a, i) => i === idx ? { ...a, ten_hoat_dong: val } : a));
                          }}
                          className="font-bold text-xs rounded-lg"
                        />
                      </div>
                    ))}

                    <Button
                      type="dashed"
                      block
                      icon={<PlusOutlined />}
                      onClick={() => setEditingActivitiesList(prev => [
                        ...prev,
                        { ten_hoat_dong: '', thoi_gian: '15 phút', tom_tat: '' }
                      ])}
                      className="rounded-xl text-xs font-bold text-slate-700"
                    >
                      ➕ Thêm hoạt động mới
                    </Button>
                  </div>

                  <div className="pt-2 border-t border-gray-200 flex justify-end gap-2">
                    <Button size="small" onClick={() => setIsEditingActivities(false)} className="rounded-xl text-xs font-bold">
                      Hủy
                    </Button>
                    <Button
                      type="primary"
                      size="small"
                      loading={savingActivities}
                      onClick={handleSaveActivities}
                      className="rounded-xl text-xs font-bold bg-blue-650 hover:bg-blue-700"
                    >
                      Lưu Tiến Trình
                    </Button>
                  </div>
                </div>
              ) : activitiesTimeline.length === 0 ? (
                /* EMPTY TIMELINE STATE FOR UNFORMATTED FILES */
                <div className="p-5 text-center space-y-3 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs text-gray-500 font-medium m-0 leading-relaxed">
                    Tài liệu này chưa có tiến trình hoạt động theo cấu trúc chuẩn.
                  </p>
                  {currentTeacherOwnsThis && (
                    <Button
                      type="default"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={handleOpenEditActivities}
                      className="rounded-xl font-bold text-xs text-blue-600 border-blue-300 bg-blue-50 hover:bg-blue-100"
                    >
                      ✍️ Bấm cây bút ✏️ góc phải để chọn vị trí & tạo tiến trình
                    </Button>
                  )}
                </div>
              ) : (
                /* NORMAL TIMELINE DISPLAY */
                <div className="p-4 relative">
                  {/* Vertical Blue Connection Line */}
                  <div className="absolute left-[23px] top-6 bottom-7 w-[2px] bg-blue-300 rounded-full" />

                  <div className="space-y-6 relative">
                    {activitiesTimeline.map((act: any, idx: number) => {
                      const rawTitle = act.title || '';
                      const durStr = act.duration || `${10 + (idx % 4) * 5} phút`;

                      // Clean title: remove any leading "Hoạt động X:", "Hoạt động X", "HĐ X:", "HĐ X"
                      let cleanTitle = rawTitle.replace(/^(Hoạt\s*động|HĐ)\s*\d+[\s:\-]*/i, '').trim();
                      if (!cleanTitle) cleanTitle = rawTitle;
                      
                      const displayTitle = `Hoạt động ${idx + 1}: ${cleanTitle}`;

                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedActivityModal(act)}
                          className="relative pl-8 cursor-pointer group transition-all"
                        >
                          {/* Circle node */}
                          <div className="absolute left-0 top-0.5 w-5 h-5 rounded-full bg-white border-2 border-blue-500 flex items-center justify-center shadow-2xs group-hover:scale-110 group-hover:border-blue-600 transition-all z-10">
                            <div className="w-2 h-2 rounded-full bg-blue-500 group-hover:bg-blue-600 transition-colors" />
                          </div>

                          {/* Node Content */}
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-extrabold text-blue-700 text-xs tracking-wide group-hover:text-blue-800 transition-colors leading-snug">
                                {displayTitle}
                              </span>
                              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60 whitespace-nowrap flex-shrink-0">
                                ⏱️ {durStr}
                              </span>
                            </div>

                            {act.summary && act.summary.trim() !== cleanTitle.trim() && (
                              <p className="text-[11px] text-gray-500 m-0 leading-snug line-clamp-2">
                                {act.summary}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Card 3: Document Preview & Mindmap Card (Xem trước file & Sơ đồ tư duy) */}
        {/* MOBILE: order-3 (XEM FILE) | DESKTOP: lg:col-start-1 lg:row-start-2 */}
        <div className="order-3 lg:order-none lg:col-start-1 lg:row-start-2 w-full">
          <Card className="shadow-sm rounded-3xl overflow-hidden border-gray-150 p-2 sm:p-4 bg-white">
            <Tabs 
              activeKey={detailActiveTab} 
              onChange={key => setDetailActiveTab(key as any)}
              size="large"
              tabBarExtraContent={null}
            >
              <Tabs.TabPane tab="📄 Bản xem trước bài giảng" key="document">
                {isPdfFile ? (
                  <div className="h-[60vh] sm:h-[75vh] border border-gray-100 rounded-2xl overflow-hidden mt-2">
                    <iframe src={fileUrl} className="w-full h-full border-none" title="PDF Preview" />
                  </div>
                ) : isMd ? (
                  <div className="pt-2 sm:pt-4 px-1 sm:px-2 space-y-3">
                    <MarkdownViewer markdown={lesson.content_preview} highlightQuery={lessonHighlightQuery} />
                  </div>
                ) : isDocx ? (
                  <div className="pt-2">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-3 border-b border-gray-150">
                      <h4 className="text-sm font-extrabold text-gray-800 m-0">Nội dung chi tiết giáo án Word</h4>
                      <Space>
                        <Button 
                          type={previewMode === 'markdown' ? 'primary' : 'default'} 
                          onClick={() => setPreviewMode('markdown')}
                          size="small"
                          className="rounded-lg text-xs font-bold"
                        >
                          Bản trích xuất
                        </Button>
                        <Button 
                          type={previewMode === 'docx' ? 'primary' : 'default'} 
                          onClick={() => setPreviewMode('docx')}
                          size="small"
                          className="rounded-lg text-xs font-bold"
                        >
                          Bản gốc Word
                        </Button>
                      </Space>
                    </div>

                    {previewMode === 'docx' ? (
                      <div className="bg-white border border-gray-150 rounded-2xl p-2 shadow-inner">
                        <DocxPreview fileUrl={fileUrl} lessonId={lesson.id} fallbackContent={lesson.content_preview} />
                      </div>
                    ) : (
                      <div className="px-1 sm:px-2 pt-2">
                        <MarkdownViewer markdown={lesson.content_preview} highlightQuery={lessonHighlightQuery} />
                      </div>
                    )}
                  </div>
                ) : (
                  <Empty description="Không có tệp đính kèm nào được hiển thị trực tuyến." />
                )}
              </Tabs.TabPane>

              <Tabs.TabPane tab="🧠 Sơ đồ tư duy sư phạm" key="mindmap">
                <div className="pt-2">
                  <InteractiveLessonMindmap lesson={lesson} />
                </div>
              </Tabs.TabPane>
            </Tabs>
          </Card>
        </div>

        {/* Card 4: Ratings & Comments Panel (Đánh giá sư phạm & Nhận xét) */}
        {/* MOBILE: order-4 (BÌNH LUẬN Ở CUỐI CÙNG) | DESKTOP: lg:col-start-2 lg:row-start-2 */}
        {showComments && (
          <div className="order-4 lg:order-none lg:col-start-2 lg:row-start-2 w-full">
            <Card
              title={<span className="font-bold text-gray-800 text-xs uppercase tracking-wider">💬 ĐÁNH GIÁ SƯ PHẠM ({ratingTotal})</span>}
              className="shadow-sm rounded-3xl border-gray-150"
              size="small"
            >
              <div className="p-2 space-y-5">
              
              {/* Rating Stats Summary */}
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-100">
                <div className="text-center">
                  <span className="text-3xl font-black text-amber-500 block leading-none">
                    {ratingAvg > 0 ? ratingAvg.toFixed(1) : '0.0'}
                  </span>
                  <Rate disabled allowHalf value={ratingAvg} className="text-xs text-amber-450 mt-1" />
                  <span className="text-[10px] text-gray-400 block mt-1">({ratingTotal} đánh giá)</span>
                </div>
                
                <DividerVertical className="hidden sm:block h-16" />

                <div className="w-full sm:flex-grow space-y-1 text-[10px] text-gray-500">
                  {[5, 4, 3, 2, 1].map(stars => (
                    <div key={stars} className="flex items-center gap-2">
                      <span className="w-3 font-semibold">{stars}⭐</span>
                      <Progress 
                        percent={starStats.percentages[stars]} 
                        showInfo={false} 
                        size="small"
                        strokeColor="#f59e0b"
                        className="m-0 flex-grow"
                      />
                      <span className="w-6 text-right font-medium">{starStats.counts[stars]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* My Review Form */}
              {currentUser && (
                <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                  <h4 className="text-xs font-bold text-gray-600 mb-2">Đánh giá của bạn</h4>
                  {ratingLoading ? (
                    <div className="text-center py-2"><Spin size="small" /></div>
                  ) : (
                    <form onSubmit={handleSaveReview} className="space-y-3">
                      <div>
                        <Rate value={myRating} onChange={val => setMyRating(val)} className="text-base text-amber-400" />
                      </div>
                      <Input.TextArea
                        rows={2}
                        value={myComment}
                        onChange={e => setMyComment(e.target.value)}
                        placeholder="Để lại nhận xét hoặc ý kiến của bạn..."
                        className="rounded-lg text-xs resize-none"
                      />
                      <div className="flex justify-between items-center pt-1">
                        {editingMyReview ? (
                          <Button type="text" danger size="small" onClick={handleDeleteReview} className="text-xs">
                            Xóa đánh giá
                          </Button>
                        ) : <span />}
                        <Button
                          type="primary"
                          htmlType="submit"
                          size="small"
                          loading={ratingSubmitting}
                          disabled={myRating === 0}
                          className="bg-blue-600 hover:bg-blue-700 border-none rounded-lg"
                        >
                          Lưu đánh giá
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Comments/Reviews List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <span className="text-xs font-bold text-gray-500">NHẬN XÉT CỘNG ĐỒNG</span>
                  <Select
                    value={selectedStarFilter}
                    onChange={val => setSelectedStarFilter(val)}
                    size="small"
                    className="w-24 text-[10px]"
                    options={[
                      { value: 'all', label: 'Tất cả sao' },
                      { value: '5', label: '5 ⭐' },
                      { value: '4', label: '4 ⭐' },
                      { value: '3', label: '3 ⭐' },
                      { value: '2', label: '2 ⭐' },
                      { value: '1', label: '1 ⭐' }
                    ]}
                  />
                </div>

                <div className="max-h-[300px] overflow-y-auto space-y-3 pr-1">
                  {otherReviews.length === 0 ? (
                    <p className="text-xs text-gray-400 italic text-center py-4 m-0">Chưa có nhận xét nào phù hợp.</p>
                  ) : (
                    otherReviews.map((review: any) => (
                      <div key={review.id} className="border-b border-gray-50 pb-2.5 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-gray-800 text-[11px] flex items-center gap-1">
                            <UserOutlined /> {review.user_full_name || review.user_username || 'Người dùng'}
                          </span>
                          <span className="text-[9px] text-gray-400">
                            {new Date(review.created_at).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                        <Rate disabled value={review.rating} className="text-[10px] text-amber-400 block" />
                        <p className="text-xs text-gray-650 m-0 leading-relaxed pl-1">
                          {review.comment || '(Không có bình luận)'}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            </Card>
          </div>
        )}

      </div>

    {/* Modal Range Picker for Progress Activities */}
    <Modal
      title={
        <div className="flex items-center gap-2">
          <FileTextOutlined className="text-blue-600 text-base" />
          <span className="font-extrabold text-slate-800 text-sm">Bôi đen chọn trực tiếp đoạn Tiến trình trên File Word / Giáo án gốc</span>
        </div>
      }
      open={showRangePickerModal}
      onCancel={() => setShowRangePickerModal(false)}
      footer={null}
      width={900}
      style={{ top: 20 }}
      className="rounded-3xl overflow-hidden"
    >
      <div className="space-y-4 pt-1">
        <Alert
          type="info"
          showIcon
          message={<span className="font-bold text-xs">💡 Hướng dẫn chọn trực tiếp trên tệp Word:</span>}
          description={<span className="text-xs">Dùng chuột <b>bôi đen (quét chọn)</b> đoạn văn bản chứa các Hoạt động dạy học bên trong khung trắng dưới đây. Hệ thống sẽ tự động trích xuất các hoạt động.</span>}
          className="rounded-2xl text-xs"
        />

        {/* Word Document Interactive View Container */}
        <div
          onMouseUp={handleMouseUpInWordView}
          className="max-h-[50vh] overflow-y-auto p-5 bg-white border-2 border-slate-200 rounded-2xl shadow-inner select-text text-xs leading-relaxed font-sans cursor-text space-y-3"
        >
          {isDocx && previewMode === 'docx' ? (
            <DocxPreview fileUrl={fileUrl} lessonId={lesson.id} fallbackContent={lesson.content_preview} />
          ) : (
            <MarkdownViewer markdown={lesson.content_preview || ''} />
          )}
        </div>

        {/* Selected Text & Live Extracted Activities Preview */}
        {customRangeText ? (
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider">
                ⚡ Đoạn văn bản bôi đen ({previewExtractedActivities.length} Hoạt động nhận dạng được):
              </span>
              <Button
                type="text"
                size="small"
                onClick={() => {
                  setCustomRangeText('');
                  setPreviewExtractedActivities([]);
                }}
                className="text-[10px] text-gray-500 font-bold"
              >
                Xóa chọn
              </Button>
            </div>

            <div className="text-[11px] font-mono bg-white p-2.5 rounded-xl border border-emerald-200 max-h-24 overflow-y-auto text-slate-700">
              {customRangeText}
            </div>

            {previewExtractedActivities.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 pt-1 border-t border-emerald-200/60">
                {previewExtractedActivities.map((act, idx) => (
                  <div key={idx} className="bg-white p-2 rounded-lg border border-emerald-200 text-xs flex items-center justify-between gap-2 shadow-2xs">
                    <span className="font-bold text-slate-800 truncate">{act.ten_hoat_dong}</span>
                    <Tag color="emerald" className="m-0 text-[10px] font-bold">{act.thoi_gian}</Tag>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-gray-500 italic">
            Hãy dùng chuột quét (bôi đen) đoạn văn bản bài giảng trong khung ở trên để hệ thống trích xuất.
          </div>
        )}

        <div className="pt-3 border-t border-gray-200 flex justify-end gap-2">
          <Button onClick={() => setShowRangePickerModal(false)} className="rounded-xl text-xs font-bold">
            Hủy
          </Button>
          <Button
            type="primary"
            loading={savingActivities}
            disabled={previewExtractedActivities.length === 0}
            onClick={handleApplyWordSelection}
            className="rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 px-5"
          >
            🚀 Lưu Tiến trình & Cập nhật Sơ đồ
          </Button>
        </div>
      </div>
    </Modal>

    {/* ── Activity Detail Modal ── */}
    <Modal
      open={!!selectedActivityModal}
      onCancel={() => setSelectedActivityModal(null)}
      footer={null}
      closable={false}
      width={850}
      centered
      styles={{ body: { padding: 0 } }}
      className="rounded-2xl overflow-hidden"
    >
      {selectedActivityModal && (() => {
        const actIdx = activitiesTimeline.findIndex((a: any) => a === selectedActivityModal);
        const rawTitle = selectedActivityModal.title || '';
        let displayTitle = rawTitle;
        if (!rawTitle.match(/^Hoạt\s*động\s*\d+/i)) {
          displayTitle = `Hoạt động ${actIdx + 1}: ${rawTitle}`;
        }
        displayTitle = displayTitle.replace(/Hoạt\s*động\s*0?(\d+)/i, (_, n) => `Hoạt động ${parseInt(n)}`);

        const chiTiet = selectedActivityModal.chi_tiet || '';

        return (
          <div className="flex flex-col max-h-[85vh] overflow-hidden bg-white">
            {/* Clean Header */}
            <div className="bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-4 flex-shrink-0">
              <div className="min-w-0">
                <span className="text-blue-600 text-[11px] font-bold uppercase tracking-wider block mb-0.5">
                  ⚡ Tiến trình dạy học chi tiết
                </span>
                <h3 className="text-slate-900 font-extrabold text-base md:text-lg m-0 leading-snug">
                  {displayTitle}
                </h3>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                {selectedActivityModal.duration && (
                  <span className="bg-blue-50 text-blue-700 font-bold text-xs px-3 py-1 rounded-full border border-blue-200 whitespace-nowrap">
                    ⏱️ {selectedActivityModal.duration}
                  </span>
                )}
                <button
                  onClick={() => setSelectedActivityModal(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 flex items-center justify-center text-sm font-bold transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Clean Content Body - Rendered directly without nested cards */}
            <div className="flex-1 overflow-y-auto p-6 bg-white">
              {chiTiet ? (
                <div className="prose prose-slate max-w-none text-slate-800 text-sm leading-relaxed">
                  <MarkdownViewer markdown={chiTiet} />
                </div>
              ) : selectedActivityModal.details ? (
                <div className="prose prose-slate max-w-none text-slate-800 text-sm leading-relaxed">
                  <MarkdownViewer markdown={selectedActivityModal.details} />
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400 space-y-2">
                  <p className="text-sm font-medium m-0">Chưa có nội dung chi tiết cho hoạt động này.</p>
                </div>
              )}
            </div>

            {/* Footer Navigation */}
            <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex justify-between items-center flex-shrink-0">
              <button
                disabled={actIdx <= 0}
                onClick={() => setSelectedActivityModal(activitiesTimeline[actIdx - 1])}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-blue-600 bg-white border border-blue-200 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                ← Hoạt động trước
              </button>
              <span className="text-xs text-gray-500 font-semibold">
                {actIdx + 1} / {activitiesTimeline.length}
              </span>
              <button
                disabled={actIdx >= activitiesTimeline.length - 1}
                onClick={() => setSelectedActivityModal(activitiesTimeline[actIdx + 1])}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-blue-600 bg-white border border-blue-200 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Hoạt động sau →
              </button>
            </div>
          </div>
        );
      })()}
    </Modal>

    </div>
    </div>
  );
}
const DividerVertical = ({ className }: { className?: string }) => (
  <div className={`w-[1px] bg-gray-250 h-5 self-center ${className || ''}`} />
);
