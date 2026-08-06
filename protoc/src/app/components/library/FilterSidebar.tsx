import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Card, Tree, Checkbox, Button, Collapse, Space, Drawer } from 'antd';
import { 
  FilterOutlined, 
  FolderOutlined, 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  GlobalOutlined,
  LockOutlined,
  HomeOutlined
} from '@ant-design/icons';
import { User } from '../../utils/types';
import { STANDARD_DURATIONS, normalizeDuration } from '../../utils/helpers';

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
}

interface FilterSidebarProps {
  directories: Directory[];
  selectedDirs: number[];
  onToggleDir: (id: number) => void;
  allLessons: LessonPlan[];
  currentUser: User | null;
  onAddChildDir: (parentId: string) => void;
  onDeleteDir: (id: number, name: string) => void;
  onRenameDir: (id: number, name: string) => void;
  onTogglePublicDir: (id: number, isPublic: boolean) => void;
  setSelectedLessonForDetail: (lesson: LessonPlan) => void;
  
  setDirParentId: (id: string) => void;
  setDirName: (name: string) => void;
  setDirAttrs: (attrs: string) => void;
  setDirIsPublic: (isPub: boolean) => void;
  setShowDirModal: (s: boolean) => void;
  
  selectedTargetStudents: string[];
  setSelectedTargetStudents: React.Dispatch<React.SetStateAction<string[]>>;
  selectedClasses: string[];
  setSelectedClasses: React.Dispatch<React.SetStateAction<string[]>>;
  selectedTypes: string[];
  setSelectedTypes: React.Dispatch<React.SetStateAction<string[]>>;
  selectedTietDay?: string[];
  setSelectedTietDay?: React.Dispatch<React.SetStateAction<string[]>>;
  selectedLocations: string[];
  setSelectedLocations: React.Dispatch<React.SetStateAction<string[]>>;
  availableSubjects: string[];
  selectedSubjects: string[];
  setSelectedSubjects: React.Dispatch<React.SetStateAction<string[]>>;
  handleFilterChange: (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string, checked: boolean) => void;
  LOCATIONS: string[];
  onCloseSidebar?: () => void;
  sidebarWidth?: number;
  setSidebarWidth?: (w: number) => void;
}

// Helper functions copied from App.tsx
function getDescendantIds(dirId: number, directories: any[]): number[] {
  const result: number[] = [];
  const findChildren = (id: number) => {
    directories.forEach((d: any) => {
      if (d.parent === id) {
        result.push(d.id);
        findChildren(d.id);
      }
    });
  };
  findChildren(dirId);
  return result;
}

function countLessonsInDir(dirId: number, directories: any[], allLessons: any[]): number {
  return getLessonsInDir(dirId, directories, allLessons).length;
}

function getLessonsInDir(dirId: number, directories: any[], allLessons: any[]): any[] {
  const childIds = directories.filter((d: any) => d.parent === dirId).map((d: any) => d.id);
  const direct = allLessons.filter((l: any) => l.directory_ids?.includes(dirId));
  const childLessons = childIds.flatMap((cid: number) => getLessonsInDir(cid, directories, allLessons));
  const seen = new Set<number>();
  return [...direct, ...childLessons].filter((l: any) => { if (seen.has(l.id)) return false; seen.add(l.id); return true; });
}

const FileTreeItem = ({ file, onFileClick }: any) => {
  return (
    <div
      onClick={() => onFileClick && onFileClick(file)}
      className="flex items-center gap-2 py-1 px-3 ml-6 rounded-md hover:bg-blue-50/70 text-gray-700 hover:text-blue-700 cursor-pointer text-xs transition-colors"
    >
      <span>📄</span>
      <span className="whitespace-nowrap">{file.title || file.name}</span>
    </div>
  );
};

const DirectoryNode = ({
  dir: dirProp, directories, selectedDirs, onToggleDir,
  allLessons, currentUser, onAddChild, onDelete, onRename, onTogglePublic, onFileClick, depth = 0
}: any) => {
  const dir = directories.find((d: any) => d.id === dirProp.id) || dirProp;
  const children = directories.filter((d: any) => d.parent === dir.id);
  const isSelected = selectedDirs.includes(dir.id);
  const [expanded, setExpanded] = useState(depth < 2);
  const [hovered, setHovered] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(dir.name);

  const dirFiles = useMemo(() => {
    const descendantIds = getDescendantIds(dir.id, directories);
    return (allLessons || []).filter((l: any) => {
      if (!l.directory_ids?.includes(dir.id)) return false;
      const hasDescendant = l.directory_ids.some((id: number) => descendantIds.includes(id));
      return !hasDescendant;
    });
  }, [dir.id, allLessons, directories]);

  const count = useMemo(() => countLessonsInDir(dir.id, directories, allLessons), [dir.id, directories, allLessons]);

  const handleRenameSubmit = () => {
    if (renameVal.trim() && renameVal.trim() !== dir.name) {
      onRename(dir.id, renameVal.trim());
    }
    setRenaming(false);
  };

  return (
    <div className="mt-0.5">
      <div
        className={`flex items-center gap-1 py-1.5 px-2 rounded-md transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-100'}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-4 h-4 flex items-center justify-center text-xs text-gray-400 hover:text-gray-700 flex-shrink-0 ${(children.length === 0 && dirFiles.length === 0) ? 'opacity-0 pointer-events-none' : ''}`}
        >
          {expanded ? '▼' : '▶'}
        </button>

        <input
          type="checkbox"
          className="rounded border-gray-400 text-blue-600 cursor-pointer flex-shrink-0 w-3.5 h-3.5"
          checked={isSelected}
          onChange={() => onToggleDir(dir.id)}
          onClick={e => e.stopPropagation()}
        />

        {(() => {
          const isAllowedToManage = currentUser && (currentUser.role === 'ADMIN' || dir.user === currentUser.id);
          if (currentUser && !isAllowedToManage) {
            return (
              <span className="flex-shrink-0 text-sm" title="Thư mục đã khóa">
                🔒
              </span>
            );
          }
          return (
            <span className="flex-shrink-0 text-sm">
              📁
            </span>
          );
        })()}

        {renaming ? (
          <input
            autoFocus
            value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={e => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') { setRenaming(false); setRenameVal(dir.name); } }}
            className="flex-grow text-xs border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span 
            className={`text-sm whitespace-nowrap cursor-pointer ${isSelected ? 'text-blue-700 font-semibold' : 'text-gray-750'}`}
            onClick={() => onToggleDir(dir.id)}
          >
            {dir.name}
          </span>
        )}

        {count > 0 && !renaming && (
          <span className="flex-shrink-0 text-[10px] bg-gray-150 text-gray-500 px-1.5 py-0.5 rounded-full font-bold">
            {count}
          </span>
        )}

        {currentUser && hovered && !renaming && (currentUser.role === 'ADMIN' || dir.user === currentUser.id) && (
          <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <Button
              size="small"
              type="text"
              icon={<PlusOutlined className="text-[10px]" />}
              onClick={() => onAddChild(dir.id)}
              className="w-4 h-4 p-0 text-blue-500 hover:bg-blue-100 flex items-center justify-center"
            />
            <Button
              size="small"
              type="text"
              icon={<EditOutlined className="text-[10px]" />}
              onClick={() => { setRenaming(true); setRenameVal(dir.name); }}
              className="w-4 h-4 p-0 text-yellow-600 hover:bg-yellow-100 flex items-center justify-center"
            />
            <Button
              size="small"
              type="text"
              icon={dir.is_public ? <GlobalOutlined className="text-orange-500" /> : <LockOutlined className="text-green-600" />}
              onClick={() => onTogglePublic && onTogglePublic(dir.id, dir.is_public)}
              className="w-4 h-4 p-0 hover:bg-gray-100 flex items-center justify-center"
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined className="text-[10px]" />}
              onClick={() => onDelete(dir.id, dir.name)}
              className="w-4 h-4 p-0 flex items-center justify-center"
            />
          </div>
        )}
      </div>

      {expanded && (children.length > 0 || dirFiles.length > 0) && (
        <div className="border-l border-gray-150 ml-5 pl-1">
          {children.map((child: any) => (
            <DirectoryNode
              key={child.id}
              dir={child}
              directories={directories}
              selectedDirs={selectedDirs}
              onToggleDir={onToggleDir}
              allLessons={allLessons}
              currentUser={currentUser}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onRename={onRename}
              onTogglePublic={onTogglePublic}
              onFileClick={onFileClick}
              depth={depth + 1}
            />
          ))}
          {dirFiles.map((file: any) => (
            <FileTreeItem
              key={file.id}
              file={file}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function FilterSidebar({
  directories,
  selectedDirs,
  onToggleDir,
  allLessons,
  currentUser,
  onAddChildDir,
  onDeleteDir,
  onRenameDir,
  onTogglePublicDir,
  setSelectedLessonForDetail,
  setDirParentId,
  setDirName,
  setDirAttrs,
  setDirIsPublic,
  setShowDirModal,
  selectedTargetStudents,
  setSelectedTargetStudents,
  selectedClasses,
  setSelectedClasses,
  selectedTypes,
  setSelectedTypes,
  selectedTietDay = [],
  setSelectedTietDay,
  selectedLocations,
  setSelectedLocations,
  availableSubjects,
  selectedSubjects,
  setSelectedSubjects,
  handleFilterChange,
  LOCATIONS,
  onCloseSidebar,
  sidebarWidth = 300,
  setSidebarWidth
}: FilterSidebarProps) {

  const publicDirs = useMemo(() => {
    return Array.isArray(directories) ? directories.filter(d => d.is_public) : [];
  }, [directories]);

  const rootDirs = useMemo(() => {
    return publicDirs.filter(d => !d.parent);
  }, [publicDirs]);
  const isResizing = useRef(false);
  const [isMobile, setIsMobile] = useState(false);

  const availableDurations = useMemo(() => {
    const set = new Set<string>();
    STANDARD_DURATIONS.forEach(s => set.add(s));
    (allLessons || []).forEach(l => {
      const dur = l.attributes?.['Thời gian thực hiện'] || l.attributes?.['Thời gian'] || l.attributes?.['Số tiết'];
      const norm = normalizeDuration(dur);
      if (norm) {
        set.add(norm);
      }
    });
    return Array.from(set);
  }, [allLessons]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [directories]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current || !setSidebarWidth) return;
      // Giới hạn chiều rộng từ 250px đến 600px
      const newWidth = Math.max(250, Math.min(600, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setSidebarWidth]);

  const renderSidebarContent = () => {
    return (
      <div className="p-6 overflow-y-auto flex-grow">
        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FilterOutlined className="text-blue-500" />
            <span>Bộ lọc</span>
            <button
              type="button"
              onClick={() => {
                onToggleDir(-1);
                setSelectedTargetStudents([]);
                setSelectedClasses([]);
                setSelectedTypes([]);
                setSelectedLocations([]);
                setSelectedSubjects([]);
                if (setSelectedTietDay) setSelectedTietDay([]);
              }}
              className="text-blue-600 hover:text-blue-800 font-bold bg-transparent border-none cursor-pointer text-xs ml-3 transition-colors"
            >
              Xóa bộ lọc
            </button>
          </div>
          {onCloseSidebar && (
            <button
              onClick={onCloseSidebar}
              title="Đóng thanh bên"
              className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-400 hover:text-gray-700 hover:bg-gray-50 active:scale-95 shadow-sm transition-all duration-250 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <path d="M17 16l-4-4 4-4" />
              </svg>
            </button>
          )}
        </h2>

        {/* Directory Category Tree */}
        <div className="mb-6 pb-6 border-b border-gray-100">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Cây thư mục bài giảng</h3>
          <div className="text-sm max-h-[65vh] overflow-y-auto overflow-x-auto pr-1 pb-2 custom-horizontal-scrollbar">
            <div className="min-w-full w-max pr-4">
              <div
                className={`flex items-center gap-2 cursor-pointer py-2 px-3 rounded-lg transition-colors mb-1 ${
                  selectedDirs.length === 0 ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => onToggleDir(-1)} // Clear selection
              >
                <HomeOutlined />
                <span className="flex-grow">Tất cả tài liệu</span>
                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-bold">
                  {allLessons.filter(l => l.status === 'PUBLISHED').length}
                </span>
              </div>
              {rootDirs.map(dir => (
                <DirectoryNode
                  key={dir.id}
                  dir={dir}
                  directories={publicDirs}
                  selectedDirs={selectedDirs}
                  onToggleDir={onToggleDir}
                  allLessons={allLessons.filter(l => l.status === 'PUBLISHED')}
                  currentUser={currentUser}
                  onAddChild={onAddChildDir}
                  onDelete={onDeleteDir}
                  onRename={onRenameDir}
                  onTogglePublic={onTogglePublicDir}
                  onFileClick={setSelectedLessonForDetail}
                  depth={0}
                />
              ))}
            </div>
          </div>
          {currentUser && currentUser.role !== 'USER' && (
            <Button
              type="dashed"
              block
              icon={<PlusOutlined />}
              onClick={() => { setDirParentId(''); setDirName(''); setDirAttrs('{}'); setDirIsPublic(true); setShowDirModal(true); }}
              className="mt-3 text-xs"
            >
              Thêm thư mục gốc
            </Button>
          )}
        </div>

        <Collapse defaultActiveKey={['targets', 'classes', 'types']} ghost size="small" className="antd-custom-collapse">
          <Collapse.Panel header={<span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Đối tượng</span>} key="targets">
            <Space direction="vertical" className="w-full">
              <Checkbox 
                checked={selectedTargetStudents.includes('Học sinh thành thị')} 
                onChange={e => handleFilterChange(setSelectedTargetStudents, 'Học sinh thành thị', e.target.checked)}
              >
                Học sinh thành thị
              </Checkbox>
              <Checkbox 
                checked={selectedTargetStudents.includes('Học sinh nông thôn')} 
                onChange={e => handleFilterChange(setSelectedTargetStudents, 'Học sinh nông thôn', e.target.checked)}
              >
                Học sinh nông thôn
              </Checkbox>
            </Space>
          </Collapse.Panel>

          <Collapse.Panel header={<span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Lớp học</span>} key="classes">
            <Space direction="vertical" className="w-full">
              {['Lớp 10', 'Lớp 11', 'Lớp 12'].map(cls => (
                <Checkbox 
                  key={cls}
                  checked={selectedClasses.includes(cls)} 
                  onChange={e => handleFilterChange(setSelectedClasses, cls, e.target.checked)}
                >
                  {cls}
                </Checkbox>
              ))}
            </Space>
          </Collapse.Panel>

          <Collapse.Panel header={<span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Loại hình</span>} key="types">
            <Space direction="vertical" className="w-full">
              <Checkbox 
                checked={selectedTypes.includes('Thực hành')} 
                onChange={e => handleFilterChange(setSelectedTypes, 'Thực hành', e.target.checked)}
              >
                Thực hành
              </Checkbox>
              <Checkbox 
                checked={selectedTypes.includes('Lý thuyết')} 
                onChange={e => handleFilterChange(setSelectedTypes, 'Lý thuyết', e.target.checked)}
              >
                Lý thuyết
              </Checkbox>
            </Space>
          </Collapse.Panel>

          <Collapse.Panel header={<span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Số tiết / Thời gian</span>} key="durations">
            <div className="max-h-[160px] overflow-y-auto pr-1 flex flex-col gap-2">
              {availableDurations.map(dur => (
                <Checkbox 
                  key={dur}
                  checked={selectedTietDay.includes(dur)} 
                  onChange={e => setSelectedTietDay && handleFilterChange(setSelectedTietDay, dur, e.target.checked)}
                >
                  ⏱️ {dur}
                </Checkbox>
              ))}
            </div>
          </Collapse.Panel>

          <Collapse.Panel header={<span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Địa điểm</span>} key="locations">
            <div className="max-h-[160px] overflow-y-auto pr-1 flex flex-col gap-2">
              {LOCATIONS.map(loc => (
                <Checkbox 
                  key={loc}
                  checked={selectedLocations.includes(loc)} 
                  onChange={e => handleFilterChange(setSelectedLocations, loc, e.target.checked)}
                >
                  {loc}
                </Checkbox>
              ))}
            </div>
          </Collapse.Panel>

          <Collapse.Panel header={<span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Kiến thức</span>} key="subjects">
            {availableSubjects.length === 0 ? (
              <p className="text-[10px] text-gray-400 italic">Không có môn học nào trong mục này.</p>
            ) : (
              <div className="max-h-[180px] overflow-y-auto pr-1 flex flex-col gap-2">
                {availableSubjects.map(subj => (
                  <Checkbox 
                    key={subj}
                    checked={selectedSubjects.includes(subj)} 
                    onChange={e => handleFilterChange(setSelectedSubjects, subj, e.target.checked)}
                  >
                    {subj}
                  </Checkbox>
                ))}
              </div>
            )}
          </Collapse.Panel>
        </Collapse>
      </div>
    );
  };

  if (isMobile) {
    return (
      <Drawer
        placement="left"
        closable={false}
        onClose={onCloseSidebar}
        open={true}
        width={320}
        styles={{ body: { padding: 0 } }}
      >
        <div className="h-full bg-white flex flex-col">
          {renderSidebarContent()}
        </div>
      </Drawer>
    );
  }

  return (
    <div 
      className="relative bg-white border-r border-gray-200 flex flex-col flex-shrink-0"
      style={{ width: `${sidebarWidth}px` }}
    >
      {/* Vạch kéo thả resize handle */}
      {setSidebarWidth && (
        <div
          onMouseDown={handleMouseDown}
          className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-500/30 active:bg-blue-600/50 transition-colors z-50 group"
          title="Kéo thả để thay đổi kích thước"
        >
          <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-[2px] h-8 bg-gray-300 rounded group-hover:bg-blue-400 group-active:bg-blue-600 transition-colors"></div>
        </div>
      )}
      {renderSidebarContent()}
    </div>
  );
}
