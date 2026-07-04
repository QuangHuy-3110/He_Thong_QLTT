import React, { useState } from 'react';

interface FileTreeItemProps {
  file: any;
  onFileClick: (file: any) => void;
  hoverBgClass?: string;
  hoverTextClass?: string;
}

export const FileTreeItem: React.FC<FileTreeItemProps> = ({
  file,
  onFileClick,
  hoverBgClass = "hover:bg-blue-50/70",
  hoverTextClass = "hover:text-blue-700"
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    setPos({ x: e.clientX, y: e.clientY - 35 });
  };

  return (
    <>
      <div
        onClick={() => onFileClick && onFileClick(file)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onMouseMove={handleMouseMove}
        className={`flex items-center gap-2 py-1.5 px-3 rounded-xl cursor-pointer transition-colors text-xs text-gray-600 font-medium my-0.5 mr-2 ${hoverBgClass}`}
        style={{ marginLeft: 20 }}
      >
        <span className="flex-shrink-0 text-sm">📄</span>
        <span className={`truncate flex-grow hover:underline font-semibold text-gray-750 ${hoverTextClass}`}>
          {file.title}
        </span>
        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black border uppercase tracking-wider flex-shrink-0 ${
          file.status === 'PUBLISHED'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
            : file.status === 'PENDING'
              ? 'bg-amber-50 text-amber-700 border-amber-100'
              : 'bg-sky-50 text-sky-700 border-sky-100'
        }`}>
          {file.status === 'PUBLISHED' ? 'Public' : file.status === 'PENDING' ? 'Pending' : 'Local'}
        </span>
      </div>

      {showTooltip && (
        <div
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            transform: 'translate(-50%, -100%)',
            zIndex: 99999,
            pointerEvents: 'none',
          }}
          className="bg-slate-900 text-white text-xs rounded-lg py-2 px-3 shadow-xl max-w-xs whitespace-normal break-words transition-all duration-75"
        >
          <div className="relative font-semibold">
            {file.title}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
          </div>
        </div>
      )}
    </>
  );
};

export default FileTreeItem;
