import React, { useState } from 'react';
import DirectoryNode from '../directory/DirectoryNode';
import { LessonPlan, Directory, User } from '../../utils/types';

interface PersonalTabProps {
  allLessonPlans: LessonPlan[];
  directories: Directory[];
  currentUser: User;
  removeAccents: (s: string) => string;
  renderSnippet: (text: string, query: string) => React.ReactNode;
  setSelectedLessonForDetail: (l: LessonPlan) => void;
  setFocusLessonIdForChat: (id: number) => void;
  setChatbotOpenTrigger: React.Dispatch<React.SetStateAction<number>>;
  useAiRag: boolean;
  debouncedSearchQuery: string;
  
  // Navigation / mode actions
  setUploadMode: (mode: 'personal' | 'shared') => void;
  setUpDirId: (id: string) => void;
  setCurrentView: (view: 'home' | 'upload' | 'admin') => void;
  
  // Directory modal actions
  setDirParentId: (id: string) => void;
  setDirName: (name: string) => void;
  setDirAttrs: (attrs: string) => void;
  setDirIsPublic: (isPub: boolean) => void;
  setShowDirModal: (show: boolean) => void;
  
  handleAddChildDir: (parentDirId: number) => void;
  handleDeleteDir: (dirId: number, name: string) => void;
  handleRenameDir: (dirId: number) => void;
  handleTogglePublicDir: (dirId: number) => void;
  
  getDirectoryFullPath: (dirId: number, dirs: Directory[]) => string;
}

export default function PersonalTab({
  allLessonPlans,
  directories,
  currentUser,
  removeAccents,
  renderSnippet,
  setSelectedLessonForDetail,
  setFocusLessonIdForChat,
  setChatbotOpenTrigger,
  useAiRag,
  debouncedSearchQuery,
  setUploadMode,
  setUpDirId,
  setCurrentView,
  setDirParentId,
  setDirName,
  setDirAttrs,
  setDirIsPublic,
  setShowDirModal,
  handleAddChildDir,
  handleDeleteDir,
  handleRenameDir,
  handleTogglePublicDir,
  getDirectoryFullPath
}: PersonalTabProps) {
  const [selectedPersonalDirs, setSelectedPersonalDirs] = useState<number[]>([]);
  const [personalSearchQuery, setPersonalSearchQuery] = useState('');
  const [personalSortBy, setPersonalSortBy] = useState('date_desc');

  const personalRootDirs = Array.isArray(directories)
    ? directories.filter(d => !d.is_public && !d.parent && d.user === currentUser.id)
    : [];

  const myPersonalLessons = allLessonPlans.filter(l => {
    if (l.creator?.id !== currentUser.id) return false;
    if (l.status === 'LOCAL') return true;
    if (!Array.isArray(directories)) return false;
    const hasPersonalDir = l.directory_ids?.some(dirId => {
      const dObj = directories.find(d => d.id === dirId);
      return dObj && !dObj.is_public && dObj.user === currentUser.id;
    });
    return hasPersonalDir;
  });

  const dirFilteredPersonalLessons = selectedPersonalDirs.length === 0
    ? myPersonalLessons
    : myPersonalLessons.filter(l =>
      l.directory_ids?.some(dirId => selectedPersonalDirs.includes(dirId))
    );

  const searchedPersonalLessons = (() => {
    const q = personalSearchQuery.trim().toLowerCase();
    if (!q) return dirFilteredPersonalLessons;
    const qClean = removeAccents(q);
    return dirFilteredPersonalLessons.filter(l => {
      const title = (l.title || '').toLowerCase();
      const desc = (l.description || '').toLowerCase();
      const content = (l.content_preview || '').toLowerCase();
      return (
        title.includes(q) || desc.includes(q) || content.includes(q) ||
        removeAccents(title).includes(qClean) || removeAccents(desc).includes(qClean) || removeAccents(content).includes(qClean)
      );
    });
  })();

  const sortedPersonalLessons = (() => {
    const list = [...searchedPersonalLessons];
    list.sort((a, b) => {
      if (personalSortBy === 'date_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (personalSortBy === 'date_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (personalSortBy === 'title_asc') return (a.title || '').localeCompare(b.title || '', 'vi');
      if (personalSortBy === 'title_desc') return (b.title || '').localeCompare(a.title || '', 'vi');
      return 0;
    });
    return list;
  })();

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[500px]">
      {/* Left: Personal Folder Tree */}
      <div className="w-full lg:w-[260px] border-r border-gray-100 lg:pr-6 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-bold">Cây thư mục cá nhân</h3>
        </div>

        {/* Local Search inside Personal Library */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Tìm trong thư viện cá nhân..."
            value={personalSearchQuery}
            onChange={e => setPersonalSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-sky-500/20 focus:bg-white"
          />
        </div>

        <div className="text-sm mt-2 max-h-[45vh] overflow-y-auto pr-1 scrollbar-thin">
          <div
            className={`flex items-center gap-2 cursor-pointer py-1.5 px-2 rounded-md transition-colors mb-1 ${
              selectedPersonalDirs.length === 0 ? 'bg-sky-50 text-sky-700 font-semibold' : 'text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => setSelectedPersonalDirs([])}
          >
            <span className="w-4"></span>
            <span className="text-sky-500">📁</span>
            <span className="flex-grow truncate text-xs">Tất cả tài liệu cá nhân</span>
            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{myPersonalLessons.length}</span>
          </div>

          {personalRootDirs.map(dir => (
            <DirectoryNode
              key={dir.id}
              dir={dir}
              directories={directories}
              selectedDirs={selectedPersonalDirs}
              onToggleDir={(id: number) => {
                setSelectedPersonalDirs(prev => prev.includes(id) ? prev.filter(d => d !== id) : [id]);
              }}
              allLessons={allLessonPlans}
              currentUser={currentUser}
              onAddChild={handleAddChildDir}
              onDelete={handleDeleteDir}
              onRename={handleRenameDir}
              onTogglePublic={handleTogglePublicDir}
              onFileClick={setSelectedLessonForDetail}
              depth={0}
            />
          ))}
        </div>

        <button
          onClick={() => {
            setDirParentId('');
            setDirName('');
            setDirAttrs('{}');
            setDirIsPublic(false);
            setShowDirModal(true);
          }}
          className="mt-3 w-full flex items-center justify-center gap-2 px-2 py-1.5 rounded-md text-xs text-sky-600 hover:bg-sky-50 transition-colors border border-dashed border-sky-300 font-bold"
        >
          <span>+ Thêm thư mục cá nhân gốc</span>
        </button>
      </div>

      {/* Right: Personal Lessons list */}
      <div className="flex-grow min-w-0">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Thư viện cá nhân</h2>
            <p className="text-sm text-gray-500 mt-1">Tài liệu riêng tư và thư mục cá nhân của bạn.</p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Sắp xếp:</span>
              <select
                value={personalSortBy}
                onChange={e => setPersonalSortBy(e.target.value)}
                className="text-xs font-bold bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all hover:bg-slate-50 cursor-pointer"
              >
                <option value="date_desc">📅 Mới nhất</option>
                <option value="date_asc">📅 Cũ nhất</option>
                <option value="title_asc">🔤 Tên A→Z</option>
                <option value="title_desc">🔤 Tên Z→A</option>
              </select>
            </div>

            <span className="text-xs bg-sky-50 text-sky-700 border border-sky-100 px-3 py-2 rounded-xl font-bold whitespace-nowrap">
              {sortedPersonalLessons.length} tài liệu
            </span>
            <button
              onClick={() => {
                setUploadMode('personal');
                if (selectedPersonalDirs.length > 0) {
                  setUpDirId(selectedPersonalDirs[0].toString());
                } else {
                  setUpDirId('');
                }
                setCurrentView('upload');
              }}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors whitespace-nowrap shadow-sm hover:shadow"
            >
              + Thêm mới
            </button>
          </div>
        </div>

        {personalSearchQuery && (
          <p className="text-xs text-gray-500 mb-3 font-medium">
            🔍 Tìm thấy <span className="text-sky-600 font-bold">{sortedPersonalLessons.length}</span> tài liệu
          </p>
        )}

        {sortedPersonalLessons.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <div className="text-5xl mb-4">💾</div>
            <p className="text-gray-500 font-medium">
              {personalSearchQuery ? 'Không tìm thấy tài liệu phù hợp.' : 'Không tìm thấy tài liệu nào.'}
            </p>
            {!personalSearchQuery && (
              <button
                onClick={() => {
                  setUploadMode('personal');
                  if (selectedPersonalDirs.length > 0) {
                    setUpDirId(selectedPersonalDirs[0].toString());
                  } else {
                    setUpDirId('');
                  }
                  setCurrentView('upload');
                }}
                className="mt-4 px-5 py-2 bg-sky-600 text-white rounded-xl text-sm font-semibold hover:bg-sky-700"
              >
                + Tải tài liệu lên
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {sortedPersonalLessons.map(lesson => (
              <div
                key={lesson.id}
                onClick={() => setSelectedLessonForDetail(lesson)}
                className="bg-white rounded-2xl border border-sky-100/60 p-5 shadow-sm hover:shadow-md hover:border-sky-300 transition-all cursor-pointer flex flex-col relative group"
              >
                <div className="flex justify-between items-start gap-3 mb-3">
                  <h3 className="text-base font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-sky-700 transition-colors flex-grow">
                    {lesson.title}
                  </h3>
                  <span className="text-xs font-semibold text-sky-500 whitespace-nowrap bg-sky-50 px-2.5 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    Xem chi tiết ↗
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {lesson.target_student && (
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-md flex items-center gap-1">
                      📖 {lesson.target_student}
                    </span>
                  )}
                  {lesson.status === 'LOCAL' ? (
                    <span className="px-2 py-1 bg-sky-50 text-sky-700 border border-sky-100 text-xs font-medium rounded-md">💾 Cá nhân</span>
                  ) : lesson.status === 'PENDING' ? (
                    <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-100 text-xs font-medium rounded-md animate-pulse">⏳ Chờ duyệt</span>
                  ) : (
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-medium rounded-md">👥 Công khai</span>
                  )}
                  {lesson.total_ratings > 0 ? (
                    <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold rounded-md flex items-center gap-1">
                      ⭐ {Number(lesson.average_rating || 0).toFixed(1)} ({lesson.total_ratings} đánh giá)
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-slate-50 text-slate-400 border border-slate-200 text-xs font-medium rounded-md flex items-center gap-1">
                      ⭐ Chưa có đánh giá
                    </span>
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
                        <span key={i} className="px-2 py-1 bg-violet-50 text-violet-700 border border-violet-100 text-xs font-medium rounded-md flex items-center gap-1 max-w-[220px] truncate" title={getDirectoryFullPath(dirId, directories)}>
                          📂 {getDirectoryFullPath(dirId, directories)}
                        </span>
                      ));
                    })()
                  ) : (
                    <span className="px-2 py-1 bg-gray-50 text-gray-400 border border-gray-100 text-xs font-medium rounded-md">📄 Chưa phân thư mục</span>
                  )}
                </div>

                <p className="text-sm text-gray-600 mb-3 line-clamp-3 flex-grow">{lesson.description || 'Chưa có mô tả.'}</p>
                {debouncedSearchQuery.trim() && renderSnippet(lesson.content_preview || '', debouncedSearchQuery)}

                {lesson.latest_feedback && (
                  <div className="mb-3 p-2 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-700">
                    <strong>💬 Phản hồi duyệt:</strong> {lesson.latest_feedback}
                  </div>
                )}

                <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50 text-xs text-gray-400">
                  <span>📅 {new Date(lesson.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  <div className="flex items-center gap-3">
                    {useAiRag && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFocusLessonIdForChat(lesson.id);
                          setChatbotOpenTrigger(prev => prev + 1);
                        }}
                        className="text-blue-600 hover:text-blue-700 font-extrabold flex items-center gap-1 transition-all px-2.5 py-1 bg-blue-50 hover:bg-blue-100 rounded-xl text-[11px] border border-blue-100 shadow-sm"
                      >
                        ✨ Hỏi AI
                      </button>
                    )}
                    {lesson.file_path || lesson.file_url ? (
                      <span className="text-emerald-600 font-bold">↓ Tải tài liệu</span>
                    ) : (
                      <span className="text-gray-300">Không có file</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
