import React from 'react';
import { Activity } from '../../utils/types';

interface LessonActivitiesTimelineProps {
  activities?: Activity[];
}

export const LessonActivitiesTimeline: React.FC<LessonActivitiesTimelineProps> = ({ activities }) => {
  if (!activities || !Array.isArray(activities) || activities.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="relative border-l-2 border-blue-100 ml-3 pl-6 space-y-6 py-2">
        {activities.map((act, index) => (
          <div key={index} className="relative">
            {/* Connector Dot */}
            <span className="absolute -left-[31px] top-1 bg-white border-2 border-blue-500 rounded-full w-4.5 h-4.5 flex items-center justify-center shadow-sm">
              <span className="bg-blue-500 rounded-full w-2 h-2"></span>
            </span>

            {/* Node content */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1 justify-between">
              <h5 className="font-bold text-gray-800 text-sm leading-snug">{act.ten_hoat_dong}</h5>
              <span className="inline-flex self-start sm:self-auto items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-100/60 shadow-sm whitespace-nowrap">
                ⏱️ {act.thoi_gian || '10 phút'}
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed font-medium">
              {act.tom_tat || 'Tổ chức hoạt động giảng dạy trải nghiệm thực tế.'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LessonActivitiesTimeline;
