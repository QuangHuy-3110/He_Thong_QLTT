import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Card, Rate, Progress, Select, Input, Tag, Space, Alert, Empty, Spin, Tabs, Tooltip } from 'antd';
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
  InfoCircleOutlined
} from '@ant-design/icons';
import { User } from '../../context';
import InteractiveLessonMindmap from '../viewer/InteractiveLessonMindmap';
import DocxPreview from '../viewer/DocxPreview';
import MarkdownViewer from '../viewer/MarkdownViewer';
import { getLessonMindmapData, getLessonActivitiesTimeline } from '../../utils/helpers';

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
  editTrack?: string;
  setEditTrack?: (s: string) => void;
  editTopic?: string;
  setEditTopic?: (s: string) => void;
  editType?: string;
  setEditType?: (s: string) => void;
  editBiologyConnections?: string[];
  setEditBiologyConnections?: (s: string[]) => void;
  availableClasses?: { value: string; label: string }[];
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
  editTrack = '',
  setEditTrack,
  editTopic = '',
  setEditTopic,
  editType = '',
  setEditType,
  editBiologyConnections = [],
  setEditBiologyConnections,
  availableClasses = []
}: DetailViewProps) {



  const [selectedActivityModal, setSelectedActivityModal] = useState<any | null>(null);

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

  const parsedMindmapData = useMemo(() => getLessonMindmapData(lesson), [lesson]);
  const activitiesTimeline = useMemo(() => getLessonActivitiesTimeline(parsedMindmapData), [parsedMindmapData]);

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
                    <Input
                      value={editDuration}
                      onChange={(e) => setEditDuration && setEditDuration(e.target.value)}
                      placeholder="Ví dụ: 02 tiết (90 phút) hoặc 2 tiết..."
                      className="rounded-xl px-4 py-2 text-xs"
                    />
                  </div>
                </div>

                {/* Row 2: Target Students & Lesson Type & Location */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Đối tượng học sinh</label>
                    <Input
                      value={editGrade}
                      onChange={(e) => setEditGrade && setEditGrade(e.target.value)}
                      placeholder="Học sinh thành thị, Học sinh nông thôn..."
                      className="rounded-xl px-4 py-2 text-xs"
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
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Địa điểm giảng dạy</label>
                    <Select
                      value={editLocation}
                      onChange={(val) => setEditLocation && setEditLocation(val)}
                      className="w-full text-xs"
                      size="large"
                      style={{ borderRadius: 12 }}
                      options={LOCATIONS.map(loc => ({ value: loc, label: loc }))}
                    />
                  </div>
                </div>

                {/* Row 3: Knowledge Track & Topic & Classes */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                {/* Row 4: Description & File */}
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
                          <p className="m-0 text-gray-600 pt-0.5">⏱️ Thời gian: <span className="font-black text-blue-700">{lesson.attributes['Thời gian thực hiện'] || lesson.attributes['Thời gian'] || lesson.attributes['Số tiết']}</span></p>
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
                        {String(lesson.attributes['Kiến thức sinh học liên quan']).split(',').map((t, idx) => (
                          <Tag color="emerald" key={idx} className="m-0 text-xs px-3 py-1 rounded-xl font-medium shadow-2xs hover:scale-105 transition-transform">{t.trim()}</Tag>
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
                </div>
              }
              className="shadow-sm rounded-3xl border-gray-150"
              size="small"
            >
              <div className="p-4 relative">
                {/* Vertical Blue Connection Line */}
                <div className="absolute left-[23px] top-6 bottom-7 w-[2px] bg-blue-300 rounded-full" />

                <div className="space-y-6 relative">
                  {activitiesTimeline.map((act: any, idx: number) => {
                    let stepLabel = `Hoạt động ${idx + 1}`;
                    let subTitle = act.title || '';

                    // Clean title from "Hoạt động 01:", "Hoạt động 01", "HĐ1:", "HĐ01"
                    const match = subTitle.match(/^(Hoạt\s*động|HĐ)\s*\d+[:\s\-]*/i);
                    if (match) {
                      subTitle = subTitle.slice(match[0].length).trim();
                    }

                    const durStr = act.duration || `${10 + (idx % 4) * 5} phút`;

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedActivityModal(act)}
                        className="relative pl-8 cursor-pointer group transition-all"
                      >
                        {/* Circle node icon matching Image 2 */}
                        <div className="absolute left-0 top-0.5 w-5 h-5 rounded-full bg-white border-2 border-blue-500 flex items-center justify-center shadow-2xs group-hover:scale-110 group-hover:border-blue-600 transition-all z-10">
                          <div className="w-2 h-2 rounded-full bg-blue-500 group-hover:bg-blue-600 transition-colors" />
                        </div>

                        {/* Node Content */}
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-extrabold text-blue-700 text-xs tracking-wide group-hover:text-blue-800 transition-colors">
                              {stepLabel}
                            </span>
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60 whitespace-nowrap">
                              ⏱️ {durStr}
                            </span>
                          </div>

                          <p className="text-xs font-semibold text-gray-800 group-hover:text-blue-900 transition-colors m-0 leading-snug">
                            {subTitle || act.title}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
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
                  <div className="pt-2 sm:pt-4 px-1 sm:px-2">
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
                          className="rounded-lg text-xs"
                        >
                          Bản trích xuất
                        </Button>
                        <Button 
                          type={previewMode === 'docx' ? 'primary' : 'default'} 
                          onClick={() => setPreviewMode('docx')}
                          size="small"
                          className="rounded-lg text-xs"
                        >
                          Bản gốc Word
                        </Button>
                      </Space>
                    </div>

                    {previewMode === 'docx' ? (
                      <div className="bg-white border border-gray-150 rounded-2xl p-2 shadow-inner">
                        <DocxPreview fileUrl={fileUrl} />
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
                            <UserOutlined /> {review.user_name || 'Người dùng'}
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

    {/* Interactive Modal for Activity Detail (Identical to Mindmap Modal Layout) */}
    {selectedActivityModal && createPortal(
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 999999,
          background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px',
        }}
        onClick={() => setSelectedActivityModal(null)}
      >
        <div
          style={{
            background: '#fff', borderRadius: 24, width: '94vw', maxWidth: 1100,
            maxHeight: '90vh',
            boxShadow: '0 25px 80px rgba(15,23,42,0.25)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
            animation: 'modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            borderTop: '6px solid #f59e0b',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ background: '#ffffff', padding: '20px 28px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 14px', borderRadius: 99,
                  background: '#fef3c7', border: '1px solid #fde68a',
                  fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase',
                  color: '#b45309', marginBottom: 8,
                }}>📂 {selectedActivityModal.category || 'TIẾN TRÌNH & HOẠT ĐỘNG GIẢNG DẠY'}</span>
                <div style={{ fontWeight: 900, fontSize: 20, lineHeight: 1.4, color: '#0f172a' }}>
                  {selectedActivityModal.title} {selectedActivityModal.duration ? `(${selectedActivityModal.duration})` : ''}
                </div>
              </div>
              <button
                onClick={() => setSelectedActivityModal(null)}
                style={{
                  background: '#f1f5f9', border: 'none', borderRadius: 99,
                  width: 36, height: 36, cursor: 'pointer', color: '#64748b', fontSize: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e2e8f0'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; }}
              >✕</button>
            </div>
          </div>

          {/* Body - Expanded Width & Scroll */}
          <div style={{
            padding: '24px 28px',
            overflowY: 'auto',
            background: '#fafbfc',
            flex: 1,
          }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#475569', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
              📝 MÔ TẢ CHI TIẾT NỘI DUNG & TIẾN TRÌNH
            </div>
            <div style={{
              background: '#ffffff',
              border: '1.5px solid #e2e8f0',
              borderRadius: 20,
              padding: '20px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
              fontSize: 14.5,
              lineHeight: 1.8,
              color: '#1e293b',
            }}>
              <MarkdownViewer markdown={selectedActivityModal.details || selectedActivityModal.summary} />
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '16px 28px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', background: '#fff', flexShrink: 0 }}>
            <button
              onClick={() => setSelectedActivityModal(null)}
              style={{
                background: '#0f172a', color: '#fff', border: 'none', borderRadius: 12,
                padding: '10px 28px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            >Đóng cửa sổ</button>
          </div>
        </div>
      </div>,
      document.body
    )}

    </div>
    </div>
  );
}

const DividerVertical = ({ className }: { className?: string }) => (
  <div className={`w-[1px] bg-gray-250 h-5 self-center ${className || ''}`} />
);
