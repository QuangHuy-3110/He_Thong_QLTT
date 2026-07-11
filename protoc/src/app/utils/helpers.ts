import { saveAs } from 'file-saver';
import { LessonPlan } from './types';

export const getFallbackApiBase = (defaultLocal: string = '') => {
  if (typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1') {
    return 'https://he-thong-qltt-backend.onrender.com';
  }
  return defaultLocal;
};

// Force Vite cache refresh
export const getFileUrl = (url: string | undefined | null) => {
  if (!url) return '';

  const apiBase = localStorage.getItem('kms_api_base_url') || import.meta.env.VITE_API_BASE_URL || getFallbackApiBase('http://127.0.0.1:8000');
  const cleanBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;

  // If the URL is already absolute and pointing to a remote storage (like Supabase), return it as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    if (url.includes('.supabase.co') || url.includes('/storage/v1/object/')) {
      return url;
    }
    try {
      const parsedUrl = new URL(url);
      const parsedBase = new URL(cleanBase);
      // If it is not localhost/127.0.0.1, and not our backend domain, it's a remote URL
      if (parsedUrl.hostname !== 'localhost' &&
        parsedUrl.hostname !== '127.0.0.1' &&
        parsedUrl.hostname !== parsedBase.hostname) {
        return url;
      }
    } catch {
      // If URL parsing fails, return as-is
      return url;
    }
  }

  let path = url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url);
      path = parsed.pathname + parsed.search + parsed.hash;
    } catch {
      path = url;
    }
  }

  let mediaPath = path;
  if (path.startsWith('/media/')) {
    mediaPath = path;
  } else if (path.startsWith('media/')) {
    mediaPath = '/' + path;
  } else {
    mediaPath = '/media/' + path;
  }

  return cleanBase + mediaPath;
};

export const getLessonFileUrl = (lesson: LessonPlan) => {
  return getFileUrl(lesson.file_url || lesson.file_path);
};

export const getFileName = (url: string | undefined | null) => {
  if (!url) return 'download';
  try {
    const parsed = new URL(url, window.location.href);
    const pathname = parsed.pathname;
    return decodeURIComponent(pathname.split('/').filter(Boolean).pop() || 'download');
  } catch {
    return decodeURIComponent(url.split('/').filter(Boolean).pop() || 'download');
  }
};

export const downloadFile = async (lesson: LessonPlan) => {
  const fileUrl = getLessonFileUrl(lesson);
  if (!fileUrl) {
    alert('Không tìm thấy đường dẫn tệp.');
    return;
  }

  const fileName = getFileName(lesson.file_url || lesson.file_path);
  try {
    // Vanilla fetch is clean and bypasses Axios custom authorization headers/CORS blocks!
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error('Không thể tải file.');
    const blob = await response.blob();
    // Save to device using the file-saver library!
    saveAs(blob, fileName);
  } catch (err) {
    console.error('Download error, falling back:', err);
    // Secure fallback: Trigger browser standard same-origin download click
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export function removeAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

// Helper to download content as Markdown (.md) file locally
export function downloadMarkdownFile(title: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeTitle = title.replace(/[\s/\\?%*:|"<>]+/g, '_');
  link.setAttribute('download', `${safeTitle}.md`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function escapeRegExp(string: string) {
  if (!string || typeof string !== "string") return "";
  return string.replace(/[.*+?^${}()|[\\\]]/g, "\\$&");
}

// ─── Dynamic Markdown Parser for Lesson Plans ───────────────────────────────
export function parseMarkdownLessonPlan(markdown?: string, titleFallback?: string) {
  if (!markdown) return null;

  const mucTieu = {
    kiến_thức: [] as string[],
    năng_lực: [] as string[],
    phẩm_chất: [] as string[]
  };

  const hocLieu = {
    giáo_viên: [] as string[],
    học_sing: [] as string[], // match typo if any
    học_sinh: [] as string[]
  };

  const tienTrinh: { ten: string; time: string; tom_tat: string }[] = [];
  const hoatDong: { ten: string; muc_tieu: string; thuc_hien: string }[] = [];

  const lines = markdown.split('\n');
  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Detect section headers
    if (line.startsWith('#')) {
      const cleanHeader = line.replace(/#/g, '').trim().toLowerCase();
      if (cleanHeader.includes('mục tiêu') || cleanHeader.includes('muc tieu')) {
        currentSection = 'OBJECTIVES';
        continue;
      } else if (cleanHeader.includes('thiết bị') || cleanHeader.includes('học liệu') || cleanHeader.includes('hoc lieu')) {
        currentSection = 'MATERIALS';
        continue;
      } else if (cleanHeader.includes('tiến trình') || cleanHeader.includes('tien trinh')) {
        if (cleanHeader.includes('chi tiết') || cleanHeader.includes('chi tiet')) {
          currentSection = 'DETAILS';
        } else {
          currentSection = 'TIMELINE';
        }
        continue;
      }
    }

    // Parse depending on active section
    if (currentSection === 'OBJECTIVES') {
      if (line.startsWith('|') && !line.includes('---') && !line.toLowerCase().includes('tiêu chí')) {
        const parts = line.split('|').map(p => p.trim());
        const cells = parts.slice(1, -1);
        if (cells.length >= 2) {
          const typeStr = cells[0].toLowerCase();
          const desc = cells[1].replace(/[\[\]]/g, '');
          const code = cells[2] ? cells[2].replace(/[\[\]]/g, '').trim() : '';
          const fullLabel = code ? `${code}: ${desc}` : desc;

          if (typeStr.includes('kiến thức') || typeStr.includes('kienthuc')) {
            mucTieu.kiến_thức.push(fullLabel);
          } else if (typeStr.includes('năng lực') || typeStr.includes('nang luc')) {
            mucTieu.năng_lực.push(fullLabel);
          } else if (typeStr.includes('phẩm chất') || typeStr.includes('pham chat')) {
            mucTieu.phẩm_chất.push(fullLabel);
          }
        }
      } else {
        const match = line.match(/^[-*•]\s*(KT|NL|PC)\d+[:\s]+(.*)/i);
        if (match) {
          const code = match[1].toUpperCase();
          const desc = match[2].replace(/[\[\]]/g, '').trim();
          const fullLabel = `${code}: ${desc}`;
          if (code.startsWith('KT')) mucTieu.kiến_thức.push(fullLabel);
          else if (code.startsWith('NL')) mucTieu.năng_lực.push(fullLabel);
          else if (code.startsWith('PC')) mucTieu.phẩm_chất.push(fullLabel);
        } else if (line.startsWith('-') || line.startsWith('*') || line.startsWith('•')) {
          const cleanText = line.replace(/^[-*•]\s*/, '').replace(/[\[\]]/g, '').trim();
          if (cleanText) {
            mucTieu.kiến_thức.push(cleanText);
          }
        }
      }
    } else if (currentSection === 'MATERIALS') {
      if (line.startsWith('|') && !line.includes('---') && !line.toLowerCase().includes('chuẩn bị') && !line.toLowerCase().includes('giáo viên')) {
        const parts = line.split('|').map(p => p.trim());
        const cells = parts.slice(1, -1);
        if (cells.length >= 3) {
          const actName = cells[0].replace(/[\[\]]/g, '');
          const gvMat = cells[1].replace(/[\[\]]/g, '');
          const hsMat = cells[2].replace(/[\[\]]/g, '');

          if (gvMat && gvMat !== '—' && gvMat !== '-') {
            hocLieu.giáo_viên.push(`[${actName}] GV: ${gvMat}`);
          }
          if (hsMat && hsMat !== '—' && hsMat !== '-') {
            hocLieu.học_sinh.push(`[${actName}] HS: ${hsMat}`);
          }
        }
      } else if (line && !line.startsWith('#') && !line.startsWith('---') && !line.startsWith('|')) {
        const cleanText = line.replace(/^[-*•]\s*/, '').replace(/[\[\]]/g, '').trim();
        if (cleanText) {
          hocLieu.giáo_viên.push(cleanText);
        }
      }
    } else if (currentSection === 'TIMELINE') {
      if (line.startsWith('|') && !line.includes('---') && !line.toLowerCase().includes('hoạt động') && !line.toLowerCase().includes('nội dung')) {
        const parts = line.split('|').map(p => p.trim());
        const cells = parts.slice(1, -1);
        if (cells.length >= 2) {
          const actTime = cells[0].replace(/[\[\]]/g, '');
          const focus = cells[1].replace(/[\[\]]/g, '');
          const method = cells[2] ? cells[2].replace(/[\[\]]/g, '') : '';
          const evalMethod = cells[3] ? cells[3].replace(/[\[\]]/g, '') : '';

          let name = actTime;
          let time = "10 phút";
          const match = actTime.match(/(.*?)\((.*?)\)/);
          if (match) {
            name = match[1].trim();
            time = match[2].trim();
          }

          tienTrinh.push({
            ten: name,
            time: time,
            tom_tat: `• Nội dung trọng tâm: ${focus}\n\n• Phương pháp: ${method || 'Đàm thoại, thực hành nhóm'}\n\n• Đánh giá: ${evalMethod || 'Quan sát, nhận xét của GV'}`
          });
        }
      }
    }
  }

  // Parse detailed Activities (Hoạt động chi tiết)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('### Hoạt động') || line.startsWith('### HĐ') || line.startsWith('## Hoạt động')) {
      const actTitle = line.replace(/#/g, '').replace(/:/g, '').trim();

      const objectivesLines: string[] = [];
      const executionLines: string[] = [];
      let captureState = 'EXEC';

      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j].trim();
        if (nextLine.startsWith('#')) {
          if (nextLine.startsWith('### Hoạt động') || nextLine.startsWith('### HĐ') || nextLine.startsWith('## Hoạt động') || nextLine.startsWith('## I') || nextLine.startsWith('## V')) {
            break;
          }
        }

        const lowerLine = nextLine.toLowerCase();
        if (!nextLine.startsWith('|') && (lowerLine.includes('mục tiêu') || lowerLine.includes('yêu cầu cần đạt'))) {
          captureState = 'OBJ';
          continue;
        } else if (!nextLine.startsWith('|') && (lowerLine.includes('tổ chức thực hiện') || lowerLine.includes('hoạt động giáo viên'))) {
          captureState = 'EXEC';
          continue;
        }

        if (captureState === 'OBJ' && nextLine) {
          objectivesLines.push(nextLine);
        } else if (captureState === 'EXEC' && nextLine) {
          executionLines.push(nextLine);
        }
      }

      // Format Objectives & Execution nicely
      const cleanObj = objectivesLines.length > 0
        ? objectivesLines.join('\n').replace(/[\[\]]/g, '').trim()
        : 'Hình thành và phát triển năng lực tự học, tự chủ cho học sinh.';

      const cleanExec = executionLines.length > 0
        ? executionLines.join('\n').replace(/[\[\]]/g, '').trim()
        : 'Tổ chức lớp học thảo luận, phát biểu ý kiến cá nhân và phản biện.';

      hoatDong.push({
        ten: actTitle,
        muc_tieu: cleanObj,
        thuc_hien: cleanExec
      });
    }
  }

  // If absolutely nothing was parsed, return null to use mock fallback
  if (mucTieu.kiến_thức.length === 0 && mucTieu.năng_lực.length === 0 && tienTrinh.length === 0 && hoatDong.length === 0) {
    return null;
  }

  // Cross-population fallbacks
  const finalTienTrinh = tienTrinh.length > 0 ? tienTrinh : hoatDong.map((h) => {
    let time = "15 phút";
    const timeMatch = h.ten.match(/(\d+\s*phút)/i);
    if (timeMatch) {
      time = timeMatch[1];
    }
    return {
      ten: h.ten,
      time: time,
      tom_tat: `• Nội dung trọng tâm: ${h.muc_tieu}\n\n• Phương pháp: Đàm thoại, thực hành nhóm\n\n• Đánh giá: Quan sát, nhận xét của GV`
    };
  });

  const finalHoatDong = hoatDong.length > 0 ? hoatDong : tienTrinh.map((t, idx) => ({
    ten: `Hoạt động ${String(idx + 1).padStart(2, '0')}: ${t.ten}`,
    muc_tieu: 'Kích hoạt hứng thú và rèn luyện tư duy thực tiễn cho học sinh.',
    thuc_hien: t.tom_tat
  }));

  return {
    title: titleFallback || 'Kế hoạch bài dạy chi tiết',
    mục_tiêu: {
      kiến_thức: mucTieu.kiến_thức.length > 0 ? mucTieu.kiến_thức : ['Nắm vững kiến thức trọng tâm của bài học.'],
      năng_lực: mucTieu.năng_lực.length > 0 ? mucTieu.năng_lực : ['Rèn luyện năng lực tự học và làm việc nhóm.'],
      phẩm_chất: mucTieu.phẩm_chất.length > 0 ? mucTieu.phẩm_chất : ['Tôn trọng ý kiến bạn bè và trung thực.']
    },
    học_liệu: {
      giáo_viên: hocLieu.giáo_viên.length > 0 ? hocLieu.giáo_viên : ['Giáo án chi tiết, slide giảng bài', 'Phiếu đánh giá Rubric'],
      học_sinh: hocLieu.học_sinh.length > 0 ? hocLieu.học_sinh : ['Vở ghi chép, tài liệu học tập', 'Giấy màu làm việc nhóm']
    },
    tiến_trình: finalTienTrinh,
    hoạt_động: finalHoatDong
  };
}
