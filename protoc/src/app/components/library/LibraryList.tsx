import React, { useRef, useEffect } from 'react';
import { Card, Select, Button, Pagination, Tag, Space, Alert, Empty, Spin } from 'antd';
import { 
  BookOutlined, 
  MessageOutlined, 
  StarOutlined, 
  GlobalOutlined, 
  LockOutlined,
  FileWordOutlined,
  UserOutlined,
  SparklesOutlined
} from '@ant-design/icons';
import { User } from '../../context';

interface Directory {
  id: number;
  name: string;
  is_public: boolean;
  attributes: any;
  parent: number | null;
  user?: number | null;
}

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

interface LibraryListProps {
  filteredLessonPlans: LessonPlan[];
  paginatedLessonPlans: LessonPlan[];
  currentPage: number;
  setCurrentPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  debouncedSearchQuery: string;
  loading: boolean;
  error: string | null;
  setSelectedLessonForDetail: (lesson: LessonPlan) => void;
  directories: Directory[];
  currentUser: User | null;
  setSelectedCreatorForProfile: (user: any) => void;
  setFocusLessonIdForChat: (id: number | null) => void;
  setChatbotOpenTrigger: React.Dispatch<React.SetStateAction<number>>;
  useAiRag: boolean;
  
  getLessonFileUrl: (lesson: LessonPlan) => string;
  getFileName: (url: string | undefined | null) => string;
  getDirectoryFullPath: (dirId: number, dirs: Directory[]) => string;
  renderSnippet: (text: string | undefined, query: string) => React.ReactNode;
  selectedDirs: number[];
  isFilterSidebarOpen?: boolean;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text: string | null | undefined, query: string) {
  if (!text) return "";
  if (!query.trim()) return text;
  
  const queryClean = query.trim();
  const parts = text.split(new RegExp(`(${escapeRegExp(queryClean)})`, 'gi'));
  
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === queryClean.toLowerCase()
          ? <mark key={i} className="bg-yellow-200 text-yellow-900 font-bold px-0.5 rounded-sm shadow-sm">{part}</mark>
          : part
      )}
    </>
  );
}

export default function LibraryList({
  filteredLessonPlans,
  paginatedLessonPlans,
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize,
  sortBy,
  setSortBy,
  debouncedSearchQuery,
  loading,
  error,
  setSelectedLessonForDetail,
  directories,
  currentUser,
  setSelectedCreatorForProfile,
  setFocusLessonIdForChat,
  setChatbotOpenTrigger,
  useAiRag,
  getLessonFileUrl,
  getFileName,
  getDirectoryFullPath,
  renderSnippet,
  selectedDirs,
  isFilterSidebarOpen = true
}: LibraryListProps) {

  const listRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Scroll list container to the top of viewport smoothly when page or sorting changes
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [currentPage, sortBy, pageSize]);

  return (
    <div ref={listRef} className="min-h-[650px] flex flex-col">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50 border border-gray-150 p-4 rounded-2xl shadow-sm">
        <div>
          <p className="text-sm text-gray-600 font-semibold m-0">
            🔍 Tìm thấy <span className="text-blue-600 font-extrabold">{filteredLessonPlans.length}</span> tài liệu
            {selectedDirs.length > 0 && <span className="ml-1 text-slate-500 font-normal">(trong {selectedDirs.length} thư mục đã chọn)</span>}
          </p>
          {filteredLessonPlans.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5 m-0">
              Hiển thị từ {((currentPage - 1) * pageSize) + 1} đến {Math.min(currentPage * pageSize, filteredLessonPlans.length)}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Sort Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sắp xếp:</span>
            <Select
              value={sortBy}
              onChange={val => { setSortBy(val); setCurrentPage(1); }}
              size="small"
              className="w-48 text-xs font-semibold"
              options={[
                ...(debouncedSearchQuery.trim() ? [{ value: 'relevance', label: '🎯 Mức độ tương đồng' }] : []),
                { value: 'date_desc', label: '📅 Mới nhất' },
                { value: 'date_asc', label: '📅 Cũ nhất' },
                { value: 'rating_desc', label: '⭐ Đánh giá cao nhất' },
                { value: 'rating_asc', label: '⭐ Đánh giá thấp nhất' },
                { value: 'total_desc', label: '💬 Nhiều đánh giá nhất' },
                { value: 'total_asc', label: '💬 Ít đánh giá nhất' }
              ]}
            />
          </div>

          {/* Page Size Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Hiển thị:</span>
            <Select
              value={pageSize}
              onChange={val => { setPageSize(val); setCurrentPage(1); }}
              size="small"
              className="w-36 text-xs font-semibold"
              options={[
                { value: 10, label: '10 tài liệu / trang' },
                { value: 15, label: '15 tài liệu / trang' },
                { value: 20, label: '20 tài liệu / trang' }
              ]}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spin tip="Đang tải dữ liệu..." size="large" />
        </div>
      ) : error ? (
        <Alert message={error} type="error" className="rounded-xl" />
      ) : filteredLessonPlans.length === 0 ? (
        <Empty description="Không có tài liệu nào trong mục này." className="py-12" />
      ) : (
        <div className={`grid grid-cols-1 md:grid-cols-2 ${isFilterSidebarOpen ? 'lg:grid-cols-2' : 'lg:grid-cols-3'} gap-6`}>
          {paginatedLessonPlans.map((lesson) => (
            <Card
              key={lesson.id}
              onClick={() => setSelectedLessonForDetail(lesson)}
              hoverable
              className="rounded-2xl border-gray-200 shadow-sm transition-all group flex flex-col cursor-pointer"
            >
              <div className="flex justify-between items-start gap-4 mb-3">
                <h3 className="text-base font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors m-0">
                  {highlightText(lesson.title, debouncedSearchQuery)}
                </h3>
                <span className="text-xs font-bold text-blue-500 whitespace-nowrap bg-blue-50 px-2.5 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  Xem chi tiết ↗
                </span>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-3">
                <Tag color="purple">📖 {lesson.target_student || 'Giáo án'}</Tag>
                
                {lesson.status === 'PUBLISHED' ? (
                  <Tag color="success" icon={<GlobalOutlined />}>Công khai</Tag>
                ) : lesson.status === 'PENDING' ? (
                  <Tag color="warning" className="animate-pulse">Chờ duyệt</Tag>
                ) : lesson.status === 'REJECTED' ? (
                  <Tag color="error">Bị từ chối</Tag>
                ) : (
                  <Tag color="default" icon={<LockOutlined />}>Cá nhân</Tag>
                )}

                {lesson.total_ratings && lesson.total_ratings > 0 ? (
                  <Tag color="gold" icon={<StarOutlined />}>
                    {Number(lesson.average_rating || 0).toFixed(1)} ({lesson.total_ratings} đánh giá)
                  </Tag>
                ) : (
                  <Tag color="default">⭐ Chưa có đánh giá</Tag>
                )}

                {lesson.directory_ids && lesson.directory_ids.length > 0 ? (
                  (() => {
                    const leafDirIds = lesson.directory_ids.filter(dirId => {
                      const hasChildInList = lesson.directory_ids.some(otherId => {
                        if (otherId === dirId) return false;
                        const otherDir = directories.find(d => d.id === otherId);
                        return otherDir && otherDir.parent === dirId;
                      });
                      return !hasChildInList;
                    });
                    return leafDirIds.map((dirId, i) => (
                      <Tag color="cyan" key={i} className="max-w-[200px] truncate" title={getDirectoryFullPath(dirId, directories)}>
                        📂 {getDirectoryFullPath(dirId, directories)}
                      </Tag>
                    ));
                  })()
                ) : null}
              </div>

              <p className="text-xs text-gray-500 mb-4 line-clamp-3 leading-relaxed">
                {lesson.description ? highlightText(lesson.description, debouncedSearchQuery) : 'Chưa có mô tả.'}
              </p>

              {debouncedSearchQuery.trim() && renderSnippet(lesson.content_preview, debouncedSearchQuery)}

              <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100 text-[11px] text-gray-400">
                <div className="flex items-center gap-2">
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      if (lesson.creator) {
                        setSelectedCreatorForProfile(lesson.creator);
                      }
                    }}
                    className="font-bold text-blue-650 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded transition-all"
                  >
                    <UserOutlined /> {lesson.creator?.full_name || lesson.creator?.username || 'Ẩn danh'}
                  </span>
                  <span>•</span>
                  <span>{new Date(lesson.created_at).toLocaleDateString('vi-VN')}</span>
                </div>
                <div className="flex items-center gap-3">
                  {useAiRag && (
                    <Button
                      type="link"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFocusLessonIdForChat(lesson.id);
                        setChatbotOpenTrigger(prev => prev + 1);
                      }}
                      className="text-blue-600 hover:text-blue-700 font-extrabold flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-2 rounded-xl text-[10px] h-6"
                    >
                      ✨ Hỏi AI
                    </Button>
                  )}
                  {lesson.file_path || lesson.file_url ? (
                    <a
                      href={getLessonFileUrl(lesson)}
                      download={getFileName(lesson.file_url || lesson.file_path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1"
                    >
                      <FileWordOutlined /> Tải Word
                    </a>
                  ) : (
                    <span className="text-gray-300">Không có file</span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {filteredLessonPlans.length > pageSize && (
        <div className="mt-auto pt-8 flex justify-end">
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={filteredLessonPlans.length}
            onChange={page => setCurrentPage(page)}
            showSizeChanger={false}
            className="antd-custom-pagination"
          />
        </div>
      )}
    </div>
  );
}
