import React, { useMemo, useState } from 'react';
import { Button, Card, Rate, Progress, Select, Input, Tag, Space, Alert, Empty, Spin, Tabs } from 'antd';
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
  availableClasses = []
}: DetailViewProps) {



  const fileUrl = getLessonFileUrl(lesson);
  const isPdfFile = fileUrl ? fileUrl.toLowerCase().endsWith('.pdf') : false;
  const isDocx = fileUrl ? (fileUrl.toLowerCase().endsWith('.docx') || fileUrl.toLowerCase().endsWith('.doc')) : false;
  const isMd = fileUrl ? (fileUrl.toLowerCase().endsWith('.md') || fileUrl.toLowerCase().endsWith('.markdown') || fileUrl.toLowerCase().endsWith('.txt')) : !!lesson.content_preview;

  const currentTeacherOwnsThis = currentUser && (
    currentUser.role === 'ADMIN' || 
    lesson.creator?.id === currentUser.id
  );

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
          {/* Action: Toggle Comments */}
          <Button
            type="default"
            icon={<CommentOutlined />}
            onClick={() => setShowComments(!showComments)}
            className="rounded-xl border-blue-500 hover:border-blue-600 text-blue-600 hover:text-blue-700 font-semibold"
          >
            {showComments ? 'Ẩn bình luận' : 'Hiện bình luận'}
          </Button>

          {/* Action: Propose to public */}
          {lesson.status === 'LOCAL' && currentUser && onProposeToPublic && (
            <Button
              type="primary"
              icon={<CloudUploadOutlined />}
              onClick={() => onProposeToPublic(lesson)}
              className="bg-sky-600 hover:bg-sky-700 border-none rounded-xl"
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
              className="rounded-xl border-yellow-500 hover:border-yellow-600 text-yellow-600 hover:text-yellow-700"
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
              className="rounded-xl"
            >
              Xóa tài liệu
            </Button>
          )}

          {/* Action: View Edit History */}
          {currentUser && (
            <Button
              icon={<HistoryOutlined />}
              onClick={() => fetchEditHistory(lesson.id)}
              className="rounded-xl"
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
              className="bg-blue-650 hover:bg-blue-700 border-none rounded-xl"
            >
              Tải Word
            </Button>
          )}
        </div>
      </div>

      <div className={"grid grid-cols-1 " + (showComments ? "lg:grid-cols-[1fr_400px]" : "lg:grid-cols-1") + " gap-6 items-start"}>
        
        {/* Left Column: Document Previews & Interactive Mindmaps */}
        <div className="space-y-6">
          {/* Horizontal metadata header */}
          {isInlineEditingDetail ? (
            <Card className="shadow-sm rounded-3xl border-purple-200 mb-6 bg-purple-50/10" bodyStyle={{ padding: '24px' }}>
              <form onSubmit={submitEdit} className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-purple-700 m-0 mb-4">✍️ Chỉnh sửa thông tin bài giảng</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Tiêu đề bài giảng</label>
                    <Input
                      required
                      value={editTitle}
                      onChange={(e) => setEditTitle && setEditTitle(e.target.value)}
                      className="rounded-xl px-4 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Đối tượng học sinh (Khối)</label>
                    <Input
                      value={editGrade}
                      onChange={(e) => setEditGrade && setEditGrade(e.target.value)}
                      placeholder="Khối 10, Khối 11..."
                      className="rounded-xl px-4 py-2 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Mô tả chi tiết</label>
                  <Input.TextArea
                    value={editDesc}
                    onChange={(e) => setEditDesc && setEditDesc(e.target.value)}
                    placeholder="Mô tả tóm tắt nội dung bài học..."
                    rows={3}
                    className="rounded-xl px-4 py-2 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Lớp dạy</label>
                    <Select
                      mode="tags"
                      value={editLops}
                      onChange={(val) => setEditLops && setEditLops(val)}
                      className="w-full text-xs"
                      placeholder="Nhập lớp (ví dụ: 10A1, 10A2)..."
                      size="large"
                      style={{ borderRadius: 12 }}
                      options={availableClasses}
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
              className="shadow-sm rounded-3xl border-gray-150 mb-6 bg-gradient-to-r from-white to-slate-50/50"
              bodyStyle={{ padding: '24px' }}
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b border-gray-100 pb-4">
                <div>
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block mb-1">TIÊU ĐỀ GIÁO ÁN</span>
                  <h1 className="text-xl font-extrabold text-gray-900 m-0 leading-tight">{lesson.title}</h1>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Tag color="purple" className="text-xs font-bold px-3 py-1 rounded-lg">📖 {lesson.target_student || 'Giáo án'}</Tag>
                  {lesson.status === 'PUBLISHED' ? (
                    <Tag color="success" className="text-xs font-bold px-3 py-1 rounded-lg">Công khai</Tag>
                  ) : (
                    <Tag color="default" className="text-xs font-bold px-3 py-1 rounded-lg">Cá nhân</Tag>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
                {/* Col 1: Directory */}
                {lesson.directory_ids && lesson.directory_ids.length > 0 && (
                  <div>
                    <span className="text-gray-400 font-bold block mb-1.5">📂 THƯ MỤC HỆ THỐNG</span>
                    <div className="flex flex-wrap gap-1">
                      {lesson.directory_ids.map(dirId => (
                        <Tag color="blue" key={dirId} className="m-0 max-w-full truncate" title={getDirectoryFullPath(dirId, directories)}>
                          {getDirectoryFullPath(dirId, directories)}
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Col 2: Subject & Grade */}
                {lesson.attributes && (lesson.attributes['Môn học'] || lesson.attributes['lop']) && (
                  <div>
                    <span className="text-gray-400 font-bold block mb-1.5">📚 MÔN HỌC & LỚP</span>
                    <div className="space-y-1">
                      {lesson.attributes['Môn học'] && (
                        <p className="m-0 text-gray-800 font-semibold">Môn: {lesson.attributes['Môn học']}</p>
                      )}
                      {lesson.attributes['lop'] && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(Array.isArray(lesson.attributes['lop']) ? lesson.attributes['lop'] : [lesson.attributes['lop']]).map((l: string) => (
                            <Tag color="cyan" key={l} className="m-0">{l}</Tag>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Col 3: Knowledge Track & Location */}
                {lesson.attributes && (lesson.attributes['Mạch kiến thức'] || lesson.attributes['Chủ đề'] || lesson.attributes['Địa điểm']) && (
                  <div>
                    <span className="text-gray-400 font-bold block mb-1.5">📍 THÔNG TIN GIẢNG DẠY</span>
                    <div className="space-y-1">
                      {lesson.attributes['Mạch kiến thức'] && (
                        <p className="m-0 text-gray-750">Mạch: <span className="font-semibold text-gray-800">{lesson.attributes['Mạch kiến thức']}</span></p>
                      )}
                      {lesson.attributes['Chủ đề'] && (
                        <p className="m-0 text-gray-755">Chủ đề: <span className="font-semibold text-gray-800">{lesson.attributes['Chủ đề']}</span></p>
                      )}
                      {lesson.attributes['Địa điểm'] && (
                        <p className="m-0 text-gray-755">Địa điểm: <span className="font-semibold text-gray-800">{lesson.attributes['Địa điểm']}</span></p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Col 4: Integrated Knowledge */}
                {lesson.attributes && lesson.attributes['Kiến thức sinh học liên quan'] && (
                  <div>
                    <span className="text-gray-400 font-bold block mb-1.5">✨ KIẾN THỨC TÍCH HỢP</span>
                    <div className="flex flex-wrap gap-1">
                      {String(lesson.attributes['Kiến thức sinh học liên quan']).split(',').map((t, idx) => (
                        <Tag color="emerald" key={idx} className="m-0 text-[10px]">{t.trim()}</Tag>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card className="shadow-sm rounded-3xl overflow-hidden border-gray-150 p-2">
            <Tabs 
              activeKey={detailActiveTab} 
              onChange={key => setDetailActiveTab(key as any)}
              size="large"
              tabBarExtraContent={null}
            >
              <Tabs.TabPane tab="📄 Bản xem trước bài giảng" key="document">
                {isPdfFile ? (
                  <div className="h-[75vh] border border-gray-100 rounded-xl overflow-hidden">
                    <iframe src={fileUrl} className="w-full h-full border-none" title="PDF Preview" />
                  </div>
                ) : isMd ? (
                  <div className="pt-2">
                    <MarkdownViewer markdown={lesson.content_preview} highlightQuery={lessonHighlightQuery} />
                  </div>
                ) : isDocx ? (
                  <div className="pt-2">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-150">
                      <h4 className="text-sm font-bold text-gray-800 m-0">Nội dung chi tiết giáo án Word</h4>
                      <Space>
                        <Button 
                          type={previewMode === 'markdown' ? 'primary' : 'default'} 
                          onClick={() => setPreviewMode('markdown')}
                          size="small"
                        >
                          Bản trích xuất
                        </Button>
                        <Button 
                          type={previewMode === 'docx' ? 'primary' : 'default'} 
                          onClick={() => setPreviewMode('docx')}
                          size="small"
                        >
                          Bản gốc Word
                        </Button>
                      </Space>
                    </div>

                    {previewMode === 'docx' ? (
                      <div className="bg-white border border-gray-100 rounded-xl p-1 shadow-sm">
                        <DocxPreview fileUrl={fileUrl} />
                      </div>
                    ) : (
                      <MarkdownViewer markdown={lesson.content_preview} highlightQuery={lessonHighlightQuery} />
                    )}
                  </div>
                ) : (
                  <Empty description="Không có tệp đính kèm nào được hiển thị trực tuyến." />
                )}
              </Tabs.TabPane>

              <Tabs.TabPane tab="🧠 Sơ đồ tư duy sư phạm" key="mindmap">
                <InteractiveLessonMindmap lesson={lesson} />
              </Tabs.TabPane>
            </Tabs>
          </Card>
        </div>

        {/* Right Column: Ratings/Comments (Only shown if showComments is true) */}
        {showComments && (
          <div className="space-y-6">
            {/* Ratings & Comments Panel */}
            <Card
            title={<span className="font-bold text-gray-800">Đánh giá sư phạm ({ratingTotal})</span>}
            className="shadow-sm rounded-3xl border-gray-150"
            size="small"
            extra={
              <Button 
                type="text" 
                size="small" 
                onClick={() => setShowComments(!showComments)}
                className="text-xs text-blue-650 font-bold hover:text-blue-800"
              >
                {showComments ? 'Ẩn bình luận 👁️' : 'Hiện bình luận 👁️‍🗨️'}
              </Button>
            }
          >
            {showComments && (
              <div className="p-2 space-y-5">
              
              {/* Rating Stats Summary */}
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="text-center">
                  <span className="text-3xl font-black text-amber-500 block leading-none">
                    {ratingAvg > 0 ? ratingAvg.toFixed(1) : '0.0'}
                  </span>
                  <Rate disabled allowHalf value={ratingAvg} className="text-xs text-amber-450 mt-1" />
                  <span className="text-[10px] text-gray-400 block mt-1">({ratingTotal} đánh giá)</span>
                </div>
                
                <DividerVertical className="h-16" />

                <div className="flex-grow space-y-1 text-[10px] text-gray-500">
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
            )}
          </Card>
        </div>
        )}

    </div>

    </div>
    </div>
  );
}

const DividerVertical = ({ className }: { className?: string }) => (
  <div className={`w-[1px] bg-gray-250 h-5 self-center ${className || ''}`} />
);
