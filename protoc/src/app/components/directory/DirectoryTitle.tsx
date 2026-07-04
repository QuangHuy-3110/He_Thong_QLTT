import React, { useState } from 'react';

interface DirectoryTitleProps {
  name: string;
  className?: string;
  onClick?: () => void;
}

export const DirectoryTitle: React.FC<DirectoryTitleProps> = ({
  name,
  className,
  onClick
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    setPos({ x: e.clientX, y: e.clientY - 35 });
  };

  return (
    <>
      <span
        className={className}
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onMouseMove={handleMouseMove}
      >
        {name}
      </span>

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
          <div className="relative font-semibold text-left">
            {name}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
          </div>
        </div>
      )}
    </>
  );
};

export default DirectoryTitle;
