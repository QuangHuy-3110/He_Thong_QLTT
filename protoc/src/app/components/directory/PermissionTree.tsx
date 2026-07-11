import React, { useState } from 'react';
import DirectoryTitle from './DirectoryTitle';
import FileTreeItem from './FileTreeItem';
import { getAllDescendantIds, getDirectoryFullPath } from '../../utils/directoryHelpers';
import { Directory, LessonPlan } from '../../utils/types';

interface PermissionDirTreeNodeProps {
  dir: Directory;
  directories: Directory[];
  selectedIds: number[];
  onToggle: (id: number, descendants: number[], checked: boolean) => void;
  depth: number;
  allLessonPlans?: LessonPlan[];
  onFileClick?: (file: LessonPlan) => void;
}

export const PermissionDirTreeNode: React.FC<PermissionDirTreeNodeProps> = ({
  dir,
  directories,
  selectedIds,
  onToggle,
  depth,
  allLessonPlans = [],
  onFileClick
}) => {
  const children = directories.filter(d => d.parent === dir.id);
  const isChecked = selectedIds.includes(dir.id);
  const [expanded, setExpanded] = useState(true);
  const descendants = getAllDescendantIds(dir.id, directories).slice(1); // exclude self
  const dirFiles = allLessonPlans.filter(l => l.directory_ids?.includes(dir.id));

  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div className={`flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors ${isChecked ? 'bg-purple-50' : 'hover:bg-gray-50'}`}>
        <button
          onClick={() => setExpanded(e => !e)}
          className={`w-4 h-4 flex items-center justify-center text-[10px] text-gray-400 hover:text-gray-600 flex-shrink-0 ${(children.length === 0 && dirFiles.length === 0) ? 'invisible' : ''}`}
        >
          {expanded ? '▼' : '▶'}
        </button>
        <input
          type="checkbox"
          checked={isChecked}
          onChange={e => onToggle(dir.id, descendants, e.target.checked)}
          className="rounded border-gray-300 text-purple-600 focus:ring-purple-400 w-4 h-4 cursor-pointer flex-shrink-0"
        />
        <span className="text-sm flex-shrink-0">{dir.is_public ? '📂' : '📁'}</span>
        <DirectoryTitle
          name={dir.name}
          className={`text-sm truncate flex-grow ${isChecked ? 'font-semibold text-purple-800' : 'text-gray-700'}`}
        />
        {isChecked && descendants.length > 0 && (
          <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">+{descendants.length} con</span>
        )}
      </div>
      {expanded && (children.length > 0 || dirFiles.length > 0) && (
        <div className="border-l-2 border-purple-100 ml-4 pl-1">
          {children.map(child => (
            <PermissionDirTreeNode
              key={child.id}
              dir={child}
              directories={directories}
              selectedIds={selectedIds}
              onToggle={onToggle}
              depth={0}
              allLessonPlans={allLessonPlans}
              onFileClick={onFileClick}
            />
          ))}
          {dirFiles.map(file => (
            <FileTreeItem
              key={file.id}
              file={file}
              onFileClick={onFileClick}
              hoverBgClass="hover:bg-purple-50/50"
              hoverTextClass="hover:text-purple-700"
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface PersonalDirTreeNodeProps {
  dir: Directory;
  directories: Directory[];
  depth: number;
}

export const PersonalDirTreeNode: React.FC<PersonalDirTreeNodeProps> = ({
  dir,
  directories,
  depth
}) => {
  const children = directories.filter(d => d.parent === dir.id);
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50/50">
        <button
          onClick={() => setExpanded(e => !e)}
          className={`w-4 h-4 flex items-center justify-center text-[10px] text-gray-400 hover:text-gray-600 flex-shrink-0 ${children.length === 0 ? 'invisible' : ''}`}
        >
          {expanded ? '▼' : '▶'}
        </button>
        <span className="text-sm flex-shrink-0">📁</span>
        <DirectoryTitle
          name={dir.name}
          className="text-sm truncate text-gray-700 font-medium"
        />
      </div>
      {expanded && children.length > 0 && (
        <div className="border-l border-gray-200 ml-4 pl-1">
          {children.map(child => (
            <PersonalDirTreeNode
              key={child.id}
              dir={child}
              directories={directories}
              depth={0}
            />
          ))}
        </div>
      )}
    </div>
  );
};
