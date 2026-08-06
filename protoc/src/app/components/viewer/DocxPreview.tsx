import React, { useEffect, useState } from 'react';
import { renderAsync } from 'docx-preview';
import MarkdownViewer from './MarkdownViewer';
import { getFallbackApiBase } from '../../utils/helpers';

interface DocxPreviewProps {
  fileUrl: string;
  lessonId?: number;
  fallbackContent?: string;
}

export const DocxPreview: React.FC<DocxPreviewProps> = ({ fileUrl, lessonId, fallbackContent }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useFallbackMarkdown, setUseFallbackMarkdown] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setUseFallbackMarkdown(false);

    const loadDocx = async () => {
      let fetchedBlob: Blob | null = null;

      // 1. Thử fetch qua API Download tương đối (/api/...) để sử dụng Vite proxy tránh CORS
      if (lessonId) {
        try {
          const downloadApiUrl = `/api/lesson-plans/${lessonId}/download/`;
          const response = await fetch(downloadApiUrl);
          if (response.ok) {
            const blob = await response.blob();
            if (blob.size > 0) {
              fetchedBlob = blob;
            }
          }
        } catch (err) {
          console.warn('DocxPreview: Relative download API fetch failed:', err);
        }
      }

      // 2. Thử fetch từ fileUrl (chuyển về tương đối /media/... nếu có)
      if (!fetchedBlob && fileUrl) {
        try {
          let fetchTarget = fileUrl;
          if (fileUrl.includes('/media/')) {
            const mediaIndex = fileUrl.indexOf('/media/');
            fetchTarget = fileUrl.substring(mediaIndex);
          }
          const response = await fetch(fetchTarget);
          if (response.ok) {
            const blob = await response.blob();
            if (blob.size > 0) {
              fetchedBlob = blob;
            }
          }
        } catch (err) {
          console.warn('DocxPreview: Direct fileUrl fetch failed:', err);
        }
      }

      // 3. Thử fetch qua URL API tuyệt đối nếu chưa lấy được
      if (!fetchedBlob && lessonId) {
        try {
          const apiBase = localStorage.getItem('kms_api_base_url') || import.meta.env.VITE_API_BASE_URL || getFallbackApiBase('');
          const cleanApiBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
          if (cleanApiBase) {
            const downloadApiUrl = `${cleanApiBase}/api/lesson-plans/${lessonId}/download/`;
            const response = await fetch(downloadApiUrl);
            if (response.ok) {
              const blob = await response.blob();
              if (blob.size > 0) {
                fetchedBlob = blob;
              }
            }
          }
        } catch (err) {
          console.warn('DocxPreview: Absolute download API fetch failed:', err);
        }
      }

      if (!active) return;

      // 3. Nếu lấy được blob file Word nhị phân, tiến hành render qua docx-preview
      if (fetchedBlob && containerRef.current) {
        try {
          containerRef.current.innerHTML = '';
          await renderAsync(fetchedBlob, containerRef.current, undefined, {
            className: "docx",
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
            experimental: true,
          });
          if (active) {
            setLoading(false);
          }
          return;
        } catch (renderErr) {
          console.warn('DocxPreview: docx-preview rendering error:', renderErr);
        }
      }

      // 4. Fallback: Nếu không tải/render được file nhị phân nhưng có fallbackContent (Markdown)
      if (fallbackContent && active) {
        setUseFallbackMarkdown(true);
        setLoading(false);
        return;
      }

      if (active) {
        setError('Không thể tải file tài liệu Word gốc.');
        setLoading(false);
      }
    };

    loadDocx();

    return () => {
      active = false;
    };
  }, [fileUrl, lessonId, fallbackContent]);

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {loading && (
        <div className="flex flex-col items-center justify-center p-20 text-gray-500">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-sm font-medium animate-pulse">Đang tải và xử lý tài liệu Word...</p>
        </div>
      )}

      {error && !useFallbackMarkdown && (
        <div className="p-8 text-center text-red-600 bg-red-50 rounded-xl border border-red-100 m-4">
          ⚠️ {error}
        </div>
      )}

      {useFallbackMarkdown ? (
        <div className="flex-grow overflow-auto p-6 bg-gray-50/50 rounded-xl shadow-inner border border-gray-200/50" style={{ minHeight: '500px', maxHeight: '650px' }}>
          <div className="mb-3 px-3 py-2 bg-blue-50/80 border border-blue-200/60 rounded-lg text-xs font-semibold text-blue-700 flex items-center gap-2">
            <span>ℹ️ Đang hiển thị bản xem trước văn bản chuẩn Word của giáo án.</span>
          </div>
          <MarkdownViewer markdown={fallbackContent || ''} />
        </div>
      ) : (
        <div
          ref={containerRef}
          className={`flex-grow overflow-auto p-6 bg-gray-50/50 docx-preview-container rounded-xl shadow-inner border border-gray-200/50 ${loading ? 'hidden' : 'block'}`}
          style={{ minHeight: '500px', maxHeight: '650px' }}
        />
      )}
    </div>
  );
};

export default DocxPreview;
