import React, { useState, useMemo } from 'react';
import DirectoryTitle from './DirectoryTitle';
import FileTreeItem from './FileTreeItem';
import { countLessonsInDir, getDescendantIds } from '../../utils/directoryHelpers';
import { Directory, LessonPlan, User } from '../../utils/types';

interface DirectoryNodeProps {
  dir: Directory;
  directories: Directory[];
  selectedDirs: number[];
  onToggleDir: (id: number) => void;
  allLessons: LessonPlan[];
  currentUser: User | null;
  onAddChild: (parentId: number) => void;
  onDelete: (id: number, name: string) => void;
  onRename: (id: number, newName: string) => void;
  onTogglePublic: (id: number, isPublic: boolean) => void;
  onFileClick: (file: LessonPlan) => void;
  depth?: number;
}

export const DirectoryNode: React.FC<DirectoryNodeProps> = ({
  dir: dirProp,
  directories,
  selectedDirs,
  onToggleDir,
  allLessons,
  currentUser,
  onAddChild,
  onDelete,
  onRename,
  onTogglePublic,
  onFileClick,
  depth = 0
}) => {
  // Always use the latest version of this dir from the directories array
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
      const hasDescendant = l.directory_ids.some((id: string) => descendantIds.includes(id));
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
        className={`flex items-center gap-1 py-1.5 px-2 rounded-md transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-100'
          }`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Expand/collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-4 h-4 flex items-center justify-center text-xs text-gray-400 hover:text-gray-700 flex-shrink-0 ${(children.length === 0 && dirFiles.length === 0) ? 'opacity-0 pointer-events-none' : ''}`}
        >
          {expanded ? '▼' : '▶'}
        </button>

        {/* Checkbox */}
        <input
          type="checkbox"
          className="rounded border-gray-400 text-blue-600 cursor-pointer flex-shrink-0 w-3.5 h-3.5"
          checked={isSelected}
          onChange={() => onToggleDir(dir.id)}
          onClick={e => e.stopPropagation()}
        />

        {/* Folder icon — shows lock if not allowed to manage, otherwise folder */}
        {(() => {
          const isAllowedToManage = currentUser && (currentUser.role === 'ADMIN' || dir.user === currentUser.id);
          if (currentUser && !isAllowedToManage) {
            return (
              <span className="flex-shrink-0 text-sm" title="Thư mục đã khóa (Không có quyền quản lý)">
                🔒
              </span>
            );
          }
          return (
            <span className="flex-shrink-0 text-sm" title={dir.is_public ? 'Thư mục công khai' : 'Thư mục riêng tư'}>
              {dir.is_public ? '📁' : '📁'}
            </span>
          );
        })()}

        {/* Name (or rename input) */}
        {renaming ? (
          <input
            autoFocus
            value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={e => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') { setRenaming(false); setRenameVal(dir.name); } }}
            className="flex-grow text-sm border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <DirectoryTitle
            name={dir.name}
            className={`text-sm truncate flex-grow cursor-pointer ${isSelected ? 'text-blue-700 font-semibold' : 'text-gray-700'}`}
            onClick={() => onToggleDir(dir.id)}
          />
        )}

        {/* Count badge */}
        {count > 0 && !renaming && (
          <span className="flex-shrink-0 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
            {count}
          </span>
        )}

        {/* Action buttons on hover */}
        {currentUser && hovered && !renaming && (currentUser.role === 'ADMIN' || dir.user === currentUser.id) && !(dir.name.toLowerCase() === 'public' && !dir.is_public && dir.parent === null) && (
          <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button
              title="Thêm thư mục con"
              onClick={() => onAddChild(dir.id)}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-blue-100 text-blue-500 text-xs font-bold"
            >+</button>
            <button
              title="Đổi tên"
              onClick={() => { setRenaming(true); setRenameVal(dir.name); }}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-yellow-100 text-yellow-600 text-xs"
            >✏</button>
            {/* Toggle public - ADMIN or owner TEACHER */}
            {(currentUser.role === 'ADMIN' || dir.user === currentUser.id) && (
              <button
                title={dir.is_public ? 'Chuyển sang riêng tư' : 'Xuất bản công khai'}
                onClick={() => {
                  if (typeof onTogglePublic === 'function') {
                    onTogglePublic(dir.id, dir.is_public);
                  }
                }}
                className={`w-5 h-5 flex items-center justify-center rounded text-xs transition-colors ${dir.is_public
                    ? 'hover:bg-orange-100 text-orange-500'
                    : 'hover:bg-green-100 text-green-600'
                  }`}
              >
                {dir.is_public ? '🔓' : '🌐'}
              </button>
            )}
            <button
              title="Xóa thư mục"
              onClick={() => onDelete(dir.id, dir.name)}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 text-red-500 text-xs"
            >✕</button>
          </div>
        )}

      </div>

      {expanded && (children.length > 0 || dirFiles.length > 0) && (
        <div className="border-l border-gray-200 ml-5 pl-1">
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
              hoverBgClass="hover:bg-blue-50/70"
              hoverTextClass="hover:text-blue-700"
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DirectoryNode;
