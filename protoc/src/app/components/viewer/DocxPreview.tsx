import React, { useEffect, useState } from 'react';
import { renderAsync } from 'docx-preview';

interface DocxPreviewProps {
  fileUrl: string;
}

export const DocxPreview: React.FC<DocxPreviewProps> = ({ fileUrl }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const loadDocx = async () => {
      try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error('Không thể tải file tài liệu.');
        const blob = await response.blob();

        if (active && containerRef.current) {
          containerRef.current.innerHTML = '';
          // Render docx directly into the div container locally & offline!
          await renderAsync(blob, containerRef.current, undefined, {
            className: "docx",
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
            experimental: true,
          });
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Docx rendering error for URL:', fileUrl, err);
        if (active) {
          setError(err.message || 'Lỗi khi hiển thị tài liệu Word.');
          setLoading(false);
        }
      }
    };

    loadDocx();

    return () => {
      active = false;
    };
  }, [fileUrl]);

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {loading && (
        <div className="flex flex-col items-center justify-center p-20 text-gray-500">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-sm font-medium animate-pulse">Đang tải và xử lý tài liệu Word offline...</p>
        </div>
      )}
      {error && (
        <div className="p-8 text-center text-red-600 bg-red-50 rounded-xl border border-red-100 m-4">
          ⚠️ {error}
        </div>
      )}
      <div
        ref={containerRef}
        className="flex-grow overflow-auto p-6 bg-gray-50/50 docx-preview-container rounded-xl shadow-inner border border-gray-200/50"
        style={{ minHeight: '500px', maxHeight: '650px' }}
      />
    </div>
  );
};

export default DocxPreview;
