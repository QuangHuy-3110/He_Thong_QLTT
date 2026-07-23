import React, { useMemo } from 'react';
import MindmapFlow from '../chatbot/MindmapFlow';
import { getLessonMindmapData } from '../../utils/helpers';
import { LessonPlan } from '../../utils/types';

interface InteractiveLessonMindmapProps {
  lesson: LessonPlan;
  isFullscreen?: boolean;
}

export const InteractiveLessonMindmap: React.FC<InteractiveLessonMindmapProps> = ({ lesson, isFullscreen }) => {
  const parsedData = useMemo(() => getLessonMindmapData(lesson), [lesson]);

  if (isFullscreen) {
    return (
      <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
        <MindmapFlow data={parsedData} />
      </div>
    );
  }

  return (
    <div className="mb-8 rounded-3xl border border-gray-200 shadow-lg bg-white" style={{ overflow: 'visible' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-3xl">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-white/20 text-white border border-white/30 mb-1">
            🧠 Sơ đồ tư duy tương tác
          </span>
          <h3 className="text-base font-black text-white">{parsedData.title}</h3>
          <p className="text-xs text-white/70 mt-0.5">Kéo node • Scroll để zoom</p>
        </div>
        <div className="flex gap-2 text-white/60 text-xs font-semibold">
          <span className="px-3 py-1 bg-white/10 rounded-xl border border-white/20">🖱️ Kéo thả</span>
          <span className="px-3 py-1 bg-white/10 rounded-xl border border-white/20">🔍 Zoom</span>
        </div>
      </div>

      {/* Canvas — explicit dimensions so ReactFlow renders correctly */}
      <div style={{ height: 640, width: '100%', borderRadius: '0 0 1.5rem 1.5rem', overflow: 'hidden', background: '#f8fafc' }}>
        <MindmapFlow data={parsedData} />
      </div>
    </div>
  );
};

export default InteractiveLessonMindmap;
