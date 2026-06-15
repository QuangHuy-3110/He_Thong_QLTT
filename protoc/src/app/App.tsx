import React, { useEffect, useState, useMemo, useRef } from 'react';
import MindmapFlow from './components/MindmapFlow';
import axios from 'axios';
import UploadPage, { KNOWLEDGE_TRACKS, TRACK_TO_TOPICS, BIOLOGY_CONNECTIONS, LOCATIONS } from './UploadPage';
import ChatbotWorkspace from './components/ChatbotWorkspace';
import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer";
import { saveAs } from 'file-saver';
import { renderAsync } from 'docx-preview';

// Force Vite cache refresh
const getFileUrl = (url: string | undefined | null) => {
  if (!url) return '';

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

  return 'http://127.0.0.1:8000' + mediaPath;
};

const getLessonFileUrl = (lesson: LessonPlan) => {
  return getFileUrl(lesson.file_url || lesson.file_path);
};

const getFileName = (url: string | undefined | null) => {
  if (!url) return 'download';
  try {
    const parsed = new URL(url, window.location.href);
    const pathname = parsed.pathname;
    return decodeURIComponent(pathname.split('/').filter(Boolean).pop() || 'download');
  } catch {
    return decodeURIComponent(url.split('/').filter(Boolean).pop() || 'download');
  }
};

const downloadFile = async (lesson: LessonPlan) => {
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

function removeAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

interface Creator {
  id: number;
  full_name: string;
  username: string;
  email: string;
}

interface Directory {
  id: number;
  name: string;
  is_public: boolean;
  attributes: any;
  parent: number | null;
  user?: number;
}

interface LessonPlan {
  id: number;
  title: string;
  description: string;
  target_student: string;
  status: string;
  creator: Creator;
  created_at: string;
  file_path?: string;
  file_url?: string;
  attributes?: any;
  directory_ids?: number[];
  directory_names?: string[];
  latest_feedback?: string | null;
  content_preview?: string;
}

interface Activity {
  ten_hoat_dong: string;
  thoi_gian: string;
  tom_tat: string;
}

interface LessonActivitiesTimelineProps {
  activities?: Activity[];
}

const LessonActivitiesTimeline: React.FC<LessonActivitiesTimelineProps> = ({ activities }) => {
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

// ─── Dynamic Markdown Parser for Lesson Plans ───────────────────────────────
function parseMarkdownLessonPlan(markdown?: string, titleFallback?: string) {
  if (!markdown) return null;

  const mucTieu = {
    kiến_thức: [] as string[],
    năng_lực: [] as string[],
    phẩm_chất: [] as string[]
  };

  const hocLieu = {
    giáo_viên: [] as string[],
    học_sing: [] as string[], // match typo if any, let's keep name clean
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
  const finalTienTrinh = tienTrinh.length > 0 ? tienTrinh : hoatDong.map((h, idx) => {
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

interface InteractiveLessonMindmapProps {
  lesson: LessonPlan;
  isFullscreen?: boolean;
}

const InteractiveLessonMindmap: React.FC<InteractiveLessonMindmapProps> = ({ lesson, isFullscreen }) => {
  // ── Dynamic parser + Fallback pre-authored data ────────────────────────────
  const parsedData = useMemo(() => {
    // Try dynamic markdown parser first!
    const parsed = parseMarkdownLessonPlan(lesson.content_preview, lesson.title);
    if (parsed) return parsed;

    const norm = lesson.title.toLowerCase();

    if (norm.includes('dinh dưỡng') || norm.includes('dinh duong') || norm.includes('thực đơn')) {
      return {
        title: 'Dinh dưỡng học đường',
        mục_tiêu: {
          kiến_thức: [
            'KT1: Phân tích vai trò của 4 nhóm chất dinh dưỡng thiết yếu (Glucid, Protid, Lipid, Vitamin & Khoáng chất).',
            'KT2: Giải thích nguyên tắc xây dựng thực đơn cân bằng calo và tháp dinh dưỡng.',
            'KT3: Nhận biết tác hại của đồ ăn nhanh và thức uống có ga.',
          ],
          năng_lực: [
            'NLĐT1: Thiết kế thực đơn 1 ngày cân đối năng lượng dựa trên BMR.',
            'NLĐT2: Đọc hiểu và phân tích thông số dinh dưỡng trên nhãn thực phẩm.',
            'NLC1: Hợp tác nhóm xây dựng cẩm nang ăn uống sạch.',
            'NLC2: Thuyết trình và phản biện giải pháp bữa ăn học đường.',
          ],
          phẩm_chất: [
            'PC1: Ý thức tự giác bảo vệ sức khỏe, thói quen ăn uống lành mạnh.',
            'PC2: Tinh thần trách nhiệm trong việc giảm thiểu lãng phí thực phẩm.',
          ],
        },
        học_liệu: {
          giáo_viên: [
            'Mô hình Tháp dinh dưỡng học đường 3D trực quan.',
            'Bộ thẻ trò chơi thực phẩm (60 loại nguyên liệu).',
            "Video ngắn 'Hành trình tiêu hóa và hấp thu chất dinh dưỡng'.",
          ],
          học_sinh: [
            'Bộ bút màu, giấy A1, kéo, hồ dán.',
            'Mẫu thực phẩm thật (bao bì sữa, đồ ăn vặt để phân tích nhãn).',
          ],
        },
        tiến_trình: [
          { ten: 'Khởi động: Chiếc giỏ bí mật', time: '10 phút', tom_tat: 'GV giấu các quả củ thật, HS dùng tay chạm đoán tên và phân loại nhóm chất.' },
          { ten: 'Khám phá: Siêu thị mini nhóm chất', time: '20 phút', tom_tat: 'HS nghiên cứu nhãn dinh dưỡng, phân tích 4 nhóm chất thông qua thảo luận.' },
          { ten: 'Luyện tập: Đầu bếp học đường', time: '25 phút', tom_tat: 'Thực hành thiết kế poster thực đơn bữa trưa cân đối calo.' },
          { ten: 'Chia sẻ: Hội chợ ẩm thực xanh', time: '15 phút', tom_tat: 'Trưng bày Poster, thuyết trình và chấm chéo điểm bằng Rubric.' },
          { ten: 'Vận dụng: Nhật ký 3 ngày khỏe mạnh', time: '10 phút', tom_tat: 'Ghi nhật ký dinh dưỡng gia đình, cam kết bữa sáng cân bằng.' },
        ],
        hoạt_động: [
          { ten: 'HĐ1: Trò chơi đoán thực phẩm', muc_tieu: 'Kích hoạt kiến thức nền', thuc_hien: 'HS bịt mắt sờ và đoán trái cây/rau quả thật, phân chia vào 2 giỏ.' },
          { ten: 'HĐ2: Trải nghiệm nhãn dinh dưỡng', muc_tieu: 'Nhận diện chất có hại', thuc_hien: 'Đọc hàm lượng đường, chất béo bão hòa trên lon nước ngọt.' },
          { ten: 'HĐ3: Thiết kế thực đơn', muc_tieu: 'Lập thực đơn đạt chuẩn calo', thuc_hien: 'Tính toán calo bữa ăn 600-700 kcal, vẽ minh họa trên giấy A1.' },
          { ten: 'HĐ4: Tọa đàm ẩm thực an toàn', muc_tieu: 'Phát triển kỹ năng phản biện', thuc_hien: 'Các nhóm đóng vai nhà dinh dưỡng nhận xét thực đơn nhóm bạn.' },
          { ten: "HĐ5: Chiến dịch 'Bữa sáng khỏe mạnh'", muc_tieu: 'Hình thành thói quen ăn sáng', thuc_hien: 'Tự tay làm 1 bữa sáng lành mạnh tại nhà, chụp ảnh báo cáo.' },
        ],
      };
    }

    if (norm.includes('cảm xúc') || norm.includes('nhật ký')) {
      return {
        title: 'Nhật ký cảm xúc',
        mục_tiêu: {
          kiến_thức: [
            'KT1: Định nghĩa 6 cảm xúc cơ bản của con người.',
            'KT2: Hiểu cơ chế sinh học phản ứng cảm xúc trên cơ thể.',
            'KT3: Nhận thức tầm quan trọng của quản lý cảm xúc.',
          ],
          năng_lực: [
            'NLĐT1: Nhận diện và gọi tên cảm xúc cá nhân.',
            'NLĐT2: Áp dụng phương pháp điều hòa cảm xúc (thở 4-7-8).',
            'NLC1: Lắng nghe tích cực và thấu cảm với bạn bè.',
            'NLC2: Giải quyết xung đột từ sự nóng giận.',
          ],
          phẩm_chất: [
            'PC1: Nhân ái, tôn trọng thế giới nội tâm của bản thân.',
            'PC2: Trung thực khi đối diện với cảm xúc tiêu cực.',
          ],
        },
        học_liệu: {
          giáo_viên: [
            "Bộ thẻ cảm xúc 'Emotional Cards'.",
            'Chuông chánh niệm để thực hành điều hòa nhịp thở.',
          ],
          học_sinh: [
            'Một cuốn sổ trơn (Sổ nhật ký cảm xúc cá nhân).',
            'Bút màu vẽ, sticker biểu cảm đa dạng.',
          ],
        },
        tiến_trình: [
          { ten: 'Khởi động: Gương mặt biểu cảm', time: '10 phút', tom_tat: 'GV đóng vai cảm xúc, HS đoán tên cảm xúc và bắt chước.' },
          { ten: 'Khám phá: Khí tượng học tâm hồn', time: '20 phút', tom_tat: "HS vẽ 'Bản đồ thời tiết cảm xúc' trong ngày." },
          { ten: 'Luyện tập: Chiếc hộp bình yên', time: '25 phút', tom_tat: 'Thực hành thở bụng và viết trang nhật ký đầu tiên.' },
          { ten: 'Chia sẻ: Vòng tròn thấu cảm', time: '15 phút', tom_tat: 'Chia sẻ câu chuyện cảm xúc, lắng nghe không phán xét.' },
          { ten: 'Vận dụng: Hành trình 7 ngày biết ơn', time: '10 phút', tom_tat: 'Ghi nhật ký cảm xúc liên tục 1 tuần, ghi 3 điều tích cực mỗi ngày.' },
        ],
        hoạt_động: [
          { ten: "HĐ1: 'Gương mặt điện ảnh'", muc_tieu: 'Nhận diện biểu cảm tức thì', thuc_hien: 'HS diễn xuất không lời các trạng thái cảm xúc.' },
          { ten: 'HĐ2: Vẽ bản đồ nội tâm', muc_tieu: 'Liên kết cảm xúc với hình ảnh', thuc_hien: 'Dùng hình ảnh mưa/nắng/bão để mô tả tâm lý cá nhân.' },
          { ten: 'HĐ3: Kỹ thuật hạ hỏa', muc_tieu: 'Làm chủ cơn giận', thuc_hien: 'GV hướng dẫn thở 4-7-8, nắm chặt tay rồi buông lỏng.' },
          { ten: 'HĐ4: Hộp thư ẩn danh', muc_tieu: 'Nói ra tâm tư khó nói', thuc_hien: 'Viết giấy note ẩn danh về nỗi sợ, bỏ vào hộp thư.' },
          { ten: "HĐ5: 'Góc bình yên'", muc_tieu: 'Tạo không gian phục hồi', thuc_hien: 'Thiết kế góc nhỏ có cây xanh, sách để thư giãn.' },
        ],
      };
    }

    // Generic fallback from lesson.attributes
    const acts = lesson.attributes?.tien_trinh_day_hoc ?? [];
    const tienTrinh = acts.map((a: any) => ({ ten: a.ten_hoat_dong, time: a.thoi_gian, tom_tat: a.tom_tat }));
    return {
      title: lesson.title,
      mục_tiêu: {
        kiến_thức: ['KT1: Tìm hiểu sâu khái niệm chuyên đề', 'KT2: Mở rộng kiến thức thực hành'],
        năng_lực: ['NLĐT1: Vận dụng tư duy thực tiễn', 'NLC1: Tự chủ, hợp tác nhóm'],
        phẩm_chất: ['PC1: Trung thực, chăm chỉ thực hành', 'PC2: Yêu thiên nhiên, trách nhiệm'],
      },
      học_liệu: {
        giáo_viên: ['Giáo án chi tiết, bài giảng trình chiếu', 'Phiếu đánh giá Rubric'],
        học_sinh: ['Vở ghi chép, tài liệu học tập', 'Giấy màu làm việc nhóm'],
      },
      tiến_trình: tienTrinh.length > 0 ? tienTrinh : [
        { ten: 'Khởi động', time: '10 phút', tom_tat: 'Kích hoạt năng lượng lớp học.' },
        { ten: 'Khám phá', time: '25 phút', tom_tat: 'Nghiên cứu lý thuyết kết hợp thực tiễn.' },
        { ten: 'Thực hành', time: '30 phút', tom_tat: 'Luyện tập kỹ năng qua dự án nhóm.' },
        { ten: 'Báo cáo', time: '15 phút', tom_tat: 'Thuyết trình kết quả và chấm điểm chéo.' },
        { ten: 'Vận dụng', time: '10 phút', tom_tat: 'Liên hệ thực tiễn đời sống.' },
      ],
      hoạt_động: acts.length > 0
        ? acts.map((a: any, idx: number) => ({
            ten: `HĐ${idx + 1}: ${a.ten_hoat_dong}`,
            muc_tieu: `Phát triển năng lực thực hành pha ${a.ten_hoat_dong}`,
            thuc_hien: a.tom_tat,
          }))
        : [
            { ten: 'HĐ1: Khởi động', muc_tieu: 'Kích hoạt nền tảng kiến thức', thuc_hien: 'Trò chơi nhỏ liên quan đến chủ đề bài học.' },
            { ten: 'HĐ2: Thực hành nhóm', muc_tieu: 'Rèn kỹ năng hợp tác', thuc_hien: 'Thảo luận và giải quyết bài toán tình huống.' },
            { ten: 'HĐ3: Báo cáo sản phẩm', muc_tieu: 'Trình bày kết quả', thuc_hien: 'Thuyết trình trước lớp và nhận phản hồi.' },
          ],
    };
  }, [lesson]);

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
          <p className="text-xs text-white/70 mt-0.5">Kéo node • Scroll để zoom • Click nút lá để xem chi tiết sư phạm</p>
        </div>
        <div className="flex gap-2 text-white/60 text-xs font-semibold">
          <span className="px-3 py-1 bg-white/10 rounded-xl border border-white/20">🖱️ Kéo thả</span>
          <span className="px-3 py-1 bg-white/10 rounded-xl border border-white/20">🔍 Zoom</span>
          <span className="px-3 py-1 bg-white/10 rounded-xl border border-white/20">👆 Click lá</span>
        </div>
      </div>

      {/* Canvas — explicit dimensions so ReactFlow renders correctly */}
      <div style={{ height: 640, width: '100%', borderRadius: '0 0 1.5rem 1.5rem', overflow: 'hidden', background: '#f8fafc' }}>
        <MindmapFlow data={parsedData} />
      </div>
    </div>
  );
};

interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
}

// Count lessons in a directory and all its descendants (deduplicated)
// Helper to download content as Markdown (.md) file locally
function downloadMarkdownFile(title: string, content: string) {
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

function countLessonsInDir(dirId: number, directories: Directory[], allLessons: LessonPlan[]): number {
  return getLessonsInDir(dirId, directories, allLessons).length;
}

// Collect all lesson IDs in a directory and its descendants
function getLessonsInDir(dirId: number, directories: Directory[], allLessons: LessonPlan[]): LessonPlan[] {
  const childIds = directories.filter(d => d.parent === dirId).map(d => d.id);
  const direct = allLessons.filter(l => l.directory_ids?.includes(dirId));
  const childLessons = childIds.flatMap(cid => getLessonsInDir(cid, directories, allLessons));
  // Deduplicate
  const seen = new Set<number>();
  return [...direct, ...childLessons].filter(l => { if (seen.has(l.id)) return false; seen.add(l.id); return true; });
}

// Get the full breadcrumb path of a directory (e.g., "Sinh học / Vi sinh vật")
function getDirectoryFullPath(dirId: string | number, dirs: Directory[]): string {
  const path: string[] = [];
  let currentId: string | number | null = dirId;
  const visited = new Set<string | number>();

  while (currentId !== null && currentId !== undefined && currentId !== '') {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const found = dirs.find(d => d.id.toString() === currentId!.toString());
    if (found) {
      path.unshift(found.name);
      currentId = found.parent || null;
    } else {
      break;
    }
  }
  return path.join(' / ');
}

interface DirectoryOption {
  id: number;
  name: string;
  is_public: boolean;
  depth: number;
  visualPrefix: string;
}

const getDirectoriesAsTreeOptions = (
  dirs: Directory[],
  filterFn?: (d: Directory) => boolean
): DirectoryOption[] => {
  const baseDirs = filterFn ? dirs.filter(filterFn) : dirs;
  const childrenMap = new Map<number | null, Directory[]>();
  baseDirs.forEach(d => {
    const parentId = d.parent;
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(d);
  });

  const result: DirectoryOption[] = [];

  const traverse = (parentId: number | null, depth: number, prefix: string) => {
    const children = childrenMap.get(parentId) || [];
    children.sort((a, b) => a.name.localeCompare(b.name));

    children.forEach((child, index) => {
      const isLast = index === children.length - 1;
      const currentPrefix = prefix + (isLast ? '└─ ' : '├─ ');
      const nextPrefix = prefix + (isLast ? '   ' : '│  ');

      result.push({
        id: child.id,
        name: child.name,
        is_public: child.is_public,
        depth: depth,
        visualPrefix: currentPrefix
      });

      traverse(child.id, depth + 1, nextPrefix);
    });
  };

  const activeIds = new Set(baseDirs.map(d => d.id));
  const roots = baseDirs.filter(d => !d.parent || !activeIds.has(d.parent));
  roots.sort((a, b) => a.name.localeCompare(b.name));

  roots.forEach((root, index) => {
    result.push({
      id: root.id,
      name: root.name,
      is_public: root.is_public,
      depth: 0,
      visualPrefix: '📂 '
    });
    traverse(root.id, 1, '');
  });

  return result;
};

const getDescendantIds = (dirId: string, directories: any[]): string[] => {
  const result: string[] = [];
  const findChildren = (id: string) => {
    directories.forEach((d: any) => {
      if (d.parent === id) {
        result.push(d.id);
        findChildren(d.id);
      }
    });
  };
  findChildren(dirId);
  return result;
};

const DirectoryTitle = ({
  name,
  className,
  onClick
}: {
  name: string;
  className?: string;
  onClick?: () => void;
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

const FileTreeItem = ({
  file,
  onFileClick,
  hoverBgClass = "hover:bg-blue-50/70",
  hoverTextClass = "hover:text-blue-700"
}: {
  file: any;
  onFileClick: any;
  hoverBgClass?: string;
  hoverTextClass?: string;
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

const DirectoryNode = ({
  dir: dirProp, directories, selectedDirs, onToggleDir,
  allLessons, currentUser, onAddChild, onDelete, onRename, onTogglePublic, onFileClick, depth = 0
}: any) => {
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
        {currentUser && hovered && !renaming && (currentUser.role === 'ADMIN' || dir.user === currentUser.id) && (
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

const DocxPreview: React.FC<{ fileUrl: string }> = ({ fileUrl }) => {
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
        console.error('Docx rendering error:', err);
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


// ─── Recursive helper: collect all dir IDs a user can manage (by explicit grant + children) ───
function getAllDescendantIds(dirId: number, directories: Directory[]): number[] {
  const children = directories.filter(d => d.parent === dirId);
  return [dirId, ...children.flatMap(c => getAllDescendantIds(c.id, directories))];
}

// ─── Permission Tree Node for Admin Modal (cascading check) ───
const PermissionDirTreeNode = ({
  dir, directories, selectedIds, onToggle, depth, allLessonPlans = [], onFileClick
}: {
  dir: Directory;
  directories: Directory[];
  selectedIds: number[];
  onToggle: (id: number, descendants: number[], checked: boolean) => void;
  depth: number;
  allLessonPlans?: LessonPlan[];
  onFileClick?: (file: LessonPlan) => void;
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

// ─── Personal Directory Tree Node for Admin Modal (read-only list) ───
const PersonalDirTreeNode = ({
  dir, directories, depth
}: { dir: Directory; directories: Directory[]; depth: number }) => {
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

function escapeRegExp(string: string) {
  if (!string || typeof string !== "string") return "";
  return string.replace(/[.*+?^${}()|[\\\]]/g, "\\$&");
}

export const MarkdownViewer: React.FC<{ markdown: string; highlightQuery?: string }> = ({ markdown, highlightQuery }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightQuery && containerRef.current) {
      setTimeout(() => {
        const firstMark = containerRef.current?.querySelector("mark");
        if (firstMark) {
          firstMark.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 350);
    }
  }, [markdown, highlightQuery]);

  if (!markdown || typeof markdown !== "string") {
    return <div className="text-gray-400 italic p-6 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">Không có nội dung Markdown được trích xuất cho giáo án này.</div>;
  }

  const renderTextWithHighlight = (text: string) => {
    if (!text || typeof text !== "string") return "";
    if (!highlightQuery || !highlightQuery.trim()) {
      return text;
    }

    try {
      const queryClean = highlightQuery.trim();
      const escapedQuery = escapeRegExp(queryClean);
      if (!escapedQuery) return text;
      const regex = new RegExp("(" + escapedQuery + ")", "gi");
      const parts = text.split(regex);
      if (parts.length > 1) {
        return parts.map((part, i) =>
          part.toLowerCase() === queryClean.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 border border-yellow-300 rounded px-1 text-slate-900 font-extrabold shadow-sm animate-pulse mx-0.5">
              {part}
            </mark>
          ) : (
            part
          )
        );
      }
    } catch (e) {
      console.error("Lỗi regex highlight:", e);
    }
    return text;
  };

  let renderedElements: React.ReactNode[] = [];
  try {
    const lines = markdown.split("\n");
    let inList = false;
    let listItems: string[] = [];
    let inTable = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];

    const flushList = (key: string) => {
      if (listItems.length > 0) {
        renderedElements.push(
          <ul key={key} className="list-disc pl-6 my-4 space-y-2 text-gray-700 text-sm">
            {listItems.map((item, idx) => (
              <li key={idx}>{renderTextWithHighlight(item)}</li>
            ))}
          </ul>
        );
        listItems = [];
        inList = false;
      }
    };

    const flushTable = (key: string) => {
      if (tableHeaders.length > 0 || tableRows.length > 0) {
        renderedElements.push(
          <div key={key} className="overflow-x-auto my-5 border border-gray-200 rounded-xl shadow-sm bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm text-left">
              <thead className="bg-slate-50 font-semibold text-slate-700 border-b border-gray-200">
                <tr>
                  {tableHeaders.map((h, idx) => (
                    <th key={idx} className="px-4 py-3 font-semibold whitespace-nowrap">{renderTextWithHighlight(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 text-gray-650 bg-white">
                {tableRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-slate-50/50 transition-colors">
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="px-4 py-3 max-w-xs break-words" title={cell}>{renderTextWithHighlight(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableHeaders = [];
        tableRows = [];
        inTable = false;
      }
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const key = "line-" + index;

      if (trimmed.startsWith("|")) {
        flushList(key + "-pre-tbl");
        inTable = true;
        const cells = trimmed
          .split("|")
          .map(c => c.trim())
          .filter((c, i, arr) => i > 0 && i < arr.length - 1);

        if (trimmed.includes("---")) {
          return;
        }

        if (tableHeaders.length === 0) {
          tableHeaders = cells;
        } else {
          tableRows.push(cells);
        }
        return;
      } else {
        flushTable(key + "-pre-non-tbl");
      }

      if (trimmed.startsWith("-") || trimmed.startsWith("*") || trimmed.startsWith("•")) {
        inList = true;
        const cleanText = trimmed.replace(/^[-*•]\s*/, "");
        listItems.push(cleanText);
        return;
      } else {
        flushList(key + "-pre-non-list");
      }

      if (trimmed.startsWith("# ")) {
        renderedElements.push(<h1 key={key} className="text-xl sm:text-2xl font-bold text-gray-900 mt-6 mb-4 border-b pb-2 border-slate-100">{renderTextWithHighlight(trimmed.slice(2))}</h1>);
      } else if (trimmed.startsWith("## ")) {
        renderedElements.push(<h2 key={key} className="text-lg font-bold text-slate-800 mt-5 mb-3">{renderTextWithHighlight(trimmed.slice(3))}</h2>);
      } else if (trimmed.startsWith("### ")) {
        renderedElements.push(<h3 key={key} className="text-sm sm:text-base font-bold text-blue-600 mt-4 mb-2.5">{renderTextWithHighlight(trimmed.slice(4))}</h3>);
      } else if (trimmed === "---") {
        renderedElements.push(<hr key={key} className="my-6 border-slate-200" />);
      } else if (trimmed) {
        let text = trimmed;
        const parts = text.split("**");
        if (parts.length > 1) {
          const lineContent: React.ReactNode[] = [];
          parts.forEach((part, pIdx) => {
            if (pIdx % 2 === 1) {
              lineContent.push(<strong key={pIdx} className="font-bold text-gray-950">{renderTextWithHighlight(part)}</strong>);
            } else {
              lineContent.push(renderTextWithHighlight(part));
            }
          });
          renderedElements.push(<p key={key} className="text-sm text-gray-650 leading-relaxed my-2.5">{lineContent}</p>);
        } else {
          renderedElements.push(<p key={key} className="text-sm text-gray-650 leading-relaxed my-2.5">{renderTextWithHighlight(trimmed)}</p>);
        }
      }
    });

    flushList("final-list");
    flushTable("final-table");
  } catch (err) {
    console.error("Lỗi parse markdown:", err);
    renderedElements = [<p key="err" className="text-sm text-red-500 italic">Đã xảy ra lỗi khi hiển thị nội dung tài liệu.</p>];
  }

  return (
    <div ref={containerRef} className="bg-slate-50/50 rounded-2xl border border-gray-150 p-6 leading-relaxed max-w-none text-slate-800 shadow-inner">
      <div className="bg-white rounded-xl border border-gray-200/80 p-6 shadow-sm">
        {renderedElements}
      </div>
    </div>
  );
};

function renderSnippet(content: string | undefined | null, query: string): React.ReactNode {
  if (!content || !query.trim()) return null;

  const queryClean = query.trim().toLowerCase();
  const contentLower = content.toLowerCase();
  const idx = contentLower.indexOf(queryClean);

  let snippet = "";
  let startIdx = 0;
  let endIdx = 0;

  if (idx !== -1) {
    startIdx = Math.max(0, idx - 40);
    endIdx = Math.min(content.length, idx + queryClean.length + 80);
    snippet = content.slice(startIdx, endIdx);
    if (startIdx > 0) snippet = "..." + snippet;
    if (endIdx < content.length) snippet = snippet + "...";
  } else {
    // Fallback if not found in content body
    snippet = content.slice(0, 100);
    if (content.length > 100) snippet += "...";
  }

  const parts = snippet.split(new RegExp(`(${escapeRegExp(queryClean)})`, 'gi'));
  return (
    <div className="text-[11px] text-slate-500 bg-amber-50/20 border border-amber-100/50 rounded-xl p-3 my-3 leading-relaxed max-w-none shadow-sm">
      <span className="text-[9px] font-extrabold text-amber-600 block uppercase mb-1 tracking-wider">🎯 Kết quả tìm thấy trong nội dung:</span>
      <p className="line-clamp-2 italic text-gray-650">
        {parts.map((part, i) =>
          part.toLowerCase() === queryClean
            ? <mark key={i} className="bg-yellow-200 text-yellow-900 font-bold px-1 rounded-sm shadow-sm">{part}</mark>
            : part
        )}
      </p>
    </div>
  );
}

export default function App() {
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  
  // Capture Keycloak SSO Redirect Callback (Production Flow via Backend Proxy to prevent CORS 403)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      // Clear query string from URL for clean interface
      window.history.replaceState({}, document.title, window.location.pathname);
      
      const exchangeCodeForToken = async () => {
        try {
          // Gửi mã authorization code lên Backend Django để đổi token
          const response = await axios.post('/api/keycloak-login/', {
            code: code,
            redirect_uri: 'http://localhost:5173/'
          });

          const { user, token } = response.data;

          sessionStorage.setItem('currentUser', JSON.stringify(user));
          sessionStorage.setItem('keycloakToken', token);
          sessionStorage.setItem('isMockLogin', 'false');
          setCurrentUser(user);
          alert(`🎉 Xác thực thành công qua Máy chủ Keycloak SSO!\nChào mừng ${user.full_name} (${user.username})\nVai trò: ${user.role} (Đã đồng bộ thành công)`);
        } catch (err: any) {
          console.error("SSO Token Exchange Error:", err);
          alert("Lỗi xác thực Keycloak SSO thực tế: " + (err.response?.data?.error || err.message));
        }
      };
      exchangeCodeForToken();
    }
  }, []);

  // Stop all active background tasks when exiting/closing the web page
  useEffect(() => {
    const handleUnload = () => {
      const data = new Blob([JSON.stringify({ all: true })], { type: 'application/json' });
      navigator.sendBeacon('/api/bg-tasks/stop/', data);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  const [directories, setDirectories] = useState<Directory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'home' | 'upload' | 'admin'>('home');
  const [homeTab, setHomeTab] = useState<'library' | 'history' | 'personal'>('library');
  const [focusLessonIdForChat, setFocusLessonIdForChat] = useState<number | null>(null);
  const [chatbotOpenTrigger, setChatbotOpenTrigger] = useState<number>(0);
  const [uploadMode, setUploadMode] = useState<'personal' | 'public'>('public');
  const [lessonHighlightQuery, setLessonHighlightQuery] = useState<string>('');



  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = sessionStorage.getItem('currentUser');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return null; }
    }
    return null;
  });
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [showDevOptions, setShowDevOptions] = useState<boolean>(false);
  const [useAiRag, setUseAiRag] = useState<boolean>(true);

  // Tải cấu hình hệ thống về bật/tắt AI RAG từ Backend
  useEffect(() => {
    const fetchSystemSettings = async () => {
      try {
        const res = await axios.get('/api/system-settings/');
        if (res.data && typeof res.data.use_ai_rag === 'boolean') {
          setUseAiRag(res.data.use_ai_rag);
        }
      } catch (err) {
        console.error('Lỗi tải cấu hình hệ thống:', err);
      }
    };
    fetchSystemSettings();
  }, []);

  // Keycloak simulated portal states
  const [showKeycloakMockModal, setShowKeycloakMockModal] = useState<boolean>(false);
  const [kcUsername, setKcUsername] = useState<string>('gv_nguyenvana');
  const [kcFullName, setKcFullName] = useState<string>('Nguyễn Văn A');
  const [kcEmail, setKcEmail] = useState<string>('nguyenvana@school.edu.vn');
  const [kcRole, setKcRole] = useState<'ADMIN' | 'TEACHER' | 'USER'>('TEACHER');

  const handleKeycloakMockLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/keycloak-mock-login/', {
        username: kcUsername,
        full_name: kcFullName,
        email: kcEmail,
        role: kcRole
      });
      sessionStorage.setItem('currentUser', JSON.stringify(response.data.user));
      sessionStorage.setItem('keycloakToken', response.data.token);
      sessionStorage.setItem('isMockLogin', 'true');
      setCurrentUser(response.data.user);
      setShowKeycloakMockModal(false);
      setShowAuthModal(false);
      setAuthError(null);
      alert(`🎉 Đăng nhập thành công qua Keycloak SSO!\nTài khoản: ${response.data.user.full_name} (${response.data.user.username})\nVai trò: ${response.data.user.role} (Đã đồng bộ CSDL thành công)`);
    } catch (err: any) {
      alert('Đăng nhập giả lập Keycloak thất bại: ' + (err.response?.data?.error || err.message));
    }
  };


  // Admin user management and folder permission states
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [selectedUserForPerms, setSelectedUserForPerms] = useState<any | null>(null);
  const [selectedUserDirIds, setSelectedUserDirIds] = useState<number[]>([]);

  // Admin CRUD states
  const [showCreateUserForm, setShowCreateUserForm] = useState<boolean>(false);
  const [newUsername, setNewUsername] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newFullName, setNewFullName] = useState<string>('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'TEACHER' | 'USER'>('TEACHER');

  const [editUsername, setEditUsername] = useState<string>('');
  const [editPassword, setEditPassword] = useState<string>('');
  const [editFullName, setEditFullName] = useState<string>('');
  const [editRole, setEditRole] = useState<'ADMIN' | 'TEACHER' | 'USER'>('TEACHER');

  const [adminSearchQuery, setAdminSearchQuery] = useState<string>('');
  const [adminRoleFilter, setAdminRoleFilter] = useState<string>('ALL');
  const [adminActiveTab, setAdminActiveTab] = useState<'profile' | 'permissions'>('profile');
  const [adminPermissionSubTab, setAdminPermissionSubTab] = useState<'personal' | 'public'>('personal');

  useEffect(() => {
    if (selectedUserForPerms) {
      setEditUsername(selectedUserForPerms.username || '');
      setEditFullName(selectedUserForPerms.full_name || '');
      setEditRole(selectedUserForPerms.role || 'TEACHER');
      setEditPassword('');
      if (selectedUserForPerms.role === 'USER') {
        setAdminPermissionSubTab('personal');
      }
      fetchDirectories();
      fetchLessonPlans();
    }
  }, [selectedUserForPerms]);

  useEffect(() => {
    if (editRole === 'USER') {
      setAdminPermissionSubTab('personal');
    }
  }, [editRole]);

  // Current teacher's own managed directory IDs (fetched on login)
  const [myManagedDirIds, setMyManagedDirIds] = useState<number[]>([]);

  // Lesson plan approval states
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [selectedApproval, setSelectedApproval] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<string>('');

  // Rating & Comment states
  const [lessonRatings, setLessonRatings] = useState<any[]>([]);
  const [ratingAvg, setRatingAvg] = useState<number>(0);
  const [ratingTotal, setRatingTotal] = useState<number>(0);
  const [myRating, setMyRating] = useState<number>(0);
  const [myComment, setMyComment] = useState<string>('');
  const [ratingLoading, setRatingLoading] = useState<boolean>(false);
  const [ratingSubmitting, setRatingSubmitting] = useState<boolean>(false);
  const [showRatingSection, setShowRatingSection] = useState<boolean>(false);
  const [selectedStarFilter, setSelectedStarFilter] = useState<string>('all');
  const [editingMyReview, setEditingMyReview] = useState<boolean>(false);
  const [showComments, setShowComments] = useState<boolean>(true);
  const [detailActiveTab, setDetailActiveTab] = useState<'document' | 'mindmap'>('document');
  const [isMindmapFullScreen, setIsMindmapFullScreen] = useState<boolean>(false);
  const [isDocumentFullScreen, setIsDocumentFullScreen] = useState<boolean>(false);

  const starStats = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    lessonRatings.forEach((r: any) => {
      const rating = Number(r.rating);
      if (rating >= 1 && rating <= 5) {
        counts[rating as keyof typeof counts] += 1;
      }
    });
    const total = lessonRatings.length;
    return {
      counts,
      total,
      percentages: {
        5: total > 0 ? Math.round((counts[5] / total) * 100) : 0,
        4: total > 0 ? Math.round((counts[4] / total) * 100) : 0,
        3: total > 0 ? Math.round((counts[3] / total) * 100) : 0,
        2: total > 0 ? Math.round((counts[2] / total) * 100) : 0,
        1: total > 0 ? Math.round((counts[1] / total) * 100) : 0,
      }
    };
  }, [lessonRatings]);

  const otherReviews = useMemo(() => {
    let list = lessonRatings;
    if (currentUser) {
      list = list.filter((r: any) => r.user_id !== currentUser.id);
    }
    if (selectedStarFilter !== 'all') {
      list = list.filter((r: any) => String(r.rating) === selectedStarFilter);
    }
    return list;
  }, [lessonRatings, currentUser, selectedStarFilter]);

  const fetchAdminUsers = async () => {
    if (!currentUser || currentUser.role !== 'ADMIN') return;
    try {
      const res = await axios.get(`/api/admin/users/?admin_id=${currentUser.id}`);
      setAdminUsers(res.data);
    } catch (err) {
      console.error('Error fetching admin users:', err);
    }
  };

  // Fetch the current teacher's own managed directory IDs
  const fetchMyPermissions = async () => {
    if (!currentUser || currentUser.role !== 'TEACHER') { setMyManagedDirIds([]); return; }
    try {
      const res = await axios.get(`/api/users/me/permissions/?user_id=${currentUser.id}`);
      setMyManagedDirIds(res.data.managed_directories || []);
    } catch {
      setMyManagedDirIds([]);
    }
  };

  const fetchPendingApprovals = async () => {
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'TEACHER')) return;
    try {
      const res = await axios.get(`/api/approval-requests/?user_id=${currentUser.id}`);
      setPendingApprovals(res.data);
    } catch (err) {
      console.error('Error fetching pending approvals:', err);
    }
  };

  const handleActionApproval = async (reqId: number, action: 'APPROVE' | 'REJECT', currentFeedback: string = '') => {
    if (!currentUser) return;
    try {
      await axios.patch(`/api/approval-requests/${reqId}/`, {
        user_id: currentUser.id,
        action: action,
        feedback: currentFeedback
      });
      alert(action === 'APPROVE' ? 'Đã duyệt bài giảng thành công!' : 'Đã từ chối bài giảng!');
      setSelectedApproval(null);
      setFeedback('');
      fetchPendingApprovals();
      fetchLessonPlans(searchQuery); // Refresh list
    } catch (err) {
      alert('Lỗi xét duyệt bài giảng.');
    }
  };

  useEffect(() => {
    if (showAdminModal) {
      fetchAdminUsers();
    }
  }, [showAdminModal]);

  useEffect(() => {
    if (showApprovalModal) {
      fetchPendingApprovals();
    }
  }, [showApprovalModal]);

  const handleSaveUserPermissions = async () => {
    if (!currentUser || !selectedUserForPerms) return;
    try {
      await axios.post(`/api/admin/users/${selectedUserForPerms.id}/permissions/`, {
        admin_id: currentUser.id,
        directory_ids: selectedUserDirIds
      });
      alert('Cập nhật quyền quản trị thư mục thành công!');
      // Refetch directories to update locked/unlocked folder ownership in real-time
      const url = currentUser ? `/api/directories/?user_id=${currentUser.id}` : '/api/directories/';
      const freshRes = await axios.get(url);
      setDirectories(freshRes.data);
      fetchAdminUsers();
    } catch (err) {
      alert('Lỗi cập nhật phân quyền.');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.role !== 'ADMIN') return;
    if (!newUsername || !newPassword) {
      alert('Tên tài khoản và mật khẩu là bắt buộc.');
      return;
    }
    try {
      await axios.post('/api/admin/users/', {
        admin_id: currentUser.id,
        username: newUsername,
        password: newPassword,
        full_name: newFullName,
        role: newRole
      });
      alert('Tạo tài khoản thành công!');
      setShowCreateUserForm(false);
      // Reset fields
      setNewUsername('');
      setNewPassword('');
      setNewFullName('');
      setNewRole('TEACHER');
      fetchAdminUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Lỗi khi tạo tài khoản.');
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedUserForPerms) return;
    try {
      const response = await axios.patch(`/api/admin/users/${selectedUserForPerms.id}/`, {
        admin_id: currentUser.id,
        username: editUsername,
        password: editPassword || undefined,
        full_name: editFullName,
        role: editRole
      });
      alert('Cập nhật thông tin tài khoản thành công!');
      setEditPassword('');
      // Update local state for selected user
      setSelectedUserForPerms(response.data.user);
      fetchAdminUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Lỗi khi cập nhật tài khoản.');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!currentUser) return;
    const targetUser = adminUsers.find(u => u.id === userId);
    if (targetUser && targetUser.role === 'ADMIN') {
      alert('Không được phép xóa tài khoản Quản trị viên (bao gồm bản thân và quản trị viên khác).');
      return;
    }
    if (!window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản này không? Mọi dữ liệu liên quan sẽ bị ảnh hưởng.')) {
      return;
    }
    try {
      await axios.delete(`/api/admin/users/${userId}/?admin_id=${currentUser.id}`);
      alert('Đã xóa tài khoản thành công!');
      setSelectedUserForPerms(null);
      fetchAdminUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Lỗi khi xóa tài khoản.');
    }
  };

  const handleToggleLockUser = async (user: any) => {
    if (!currentUser) return;
    if (user.role === 'ADMIN') {
      alert('Không được phép khóa/mở khóa tài khoản Quản trị viên (bao gồm bản thân và quản trị viên khác).');
      return;
    }
    const actionText = user.is_active ? 'khóa' : 'mở khóa';
    if (!window.confirm(`Bạn có chắc chắn muốn ${actionText} tài khoản @${user.username} không?`)) {
      return;
    }
    try {
      const response = await axios.patch(`/api/admin/users/${user.id}/`, {
        admin_id: currentUser.id,
        is_active: !user.is_active
      });
      alert(`Đã ${actionText} tài khoản thành công!`);
      setSelectedUserForPerms(response.data.user);
      fetchAdminUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || `Lỗi khi ${actionText} tài khoản.`);
    }
  };

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [identity, setIdentity] = useState('');
  const [foundAccount, setFoundAccount] = useState<any | null>(null);
  const [resetResult, setResetResult] = useState<any | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpNewPassword, setOtpNewPassword] = useState('');
  const [otpConfirmPassword, setOtpConfirmPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [otpCountdown, setOtpCountdown] = useState<number>(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showOtpNewPassword, setShowOtpNewPassword] = useState(false);
  const [showOtpConfirmPassword, setShowOtpConfirmPassword] = useState(false);

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setInterval(() => {
      setOtpCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCountdown]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDirs, setSelectedDirs] = useState<number[]>([]);
  const [selectedPersonalDirs, setSelectedPersonalDirs] = useState<number[]>([]);

  // Personal Library Search & Sort
  const [personalSearchQuery, setPersonalSearchQuery] = useState('');
  const [personalSortBy, setPersonalSortBy] = useState<string>('date_desc');

  // States for Proposing to Public
  const [showProposeModal, setShowProposeModal] = useState<boolean>(false);
  const [lessonToPropose, setLessonToPropose] = useState<LessonPlan | null>(null);
  const [targetPublicDirId, setTargetPublicDirId] = useState<string>('');
  const [proposeError, setProposeError] = useState<string | null>(null);
  const [proposeDuplicateId, setProposeDuplicateId] = useState<number | null>(null);

  const [selectedTargetStudents, setSelectedTargetStudents] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedTietDay, setSelectedTietDay] = useState<string[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedBiologies, setSelectedBiologies] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [advancedBiologySearch, setAdvancedBiologySearch] = useState<string>('');
  const [showAdvancedFilter, setShowAdvancedFilter] = useState<boolean>(false);

  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string, checked: boolean) => {
    if (checked) setter(prev => [...prev, value]);
    else setter(prev => prev.filter(v => v !== value));
  };

  const handleToggleDir = (dirId: number) => {
    setSelectedDirs(prev => prev.includes(dirId) ? prev.filter(d => d !== dirId) : [...prev, dirId]);
  };

  // UI States for Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDirModal, setShowDirModal] = useState(false);
  const [selectedLessonForDetail, setSelectedLessonForDetail] = useState<LessonPlan | null>(null);
  const [docHistoryStack, setDocHistoryStack] = useState<LessonPlan[]>([]);
  const prevLessonRef = useRef<LessonPlan | null>(null);
  const isGoingBackRef = useRef(false);

  useEffect(() => {
    if (selectedLessonForDetail) {
      if (isGoingBackRef.current) {
        isGoingBackRef.current = false;
      } else {
        if (prevLessonRef.current && prevLessonRef.current.id !== selectedLessonForDetail.id) {
          const prev = prevLessonRef.current;
          setDocHistoryStack(prevStack => {
            if (prevStack.length > 0 && prevStack[prevStack.length - 1].id === prev.id) {
              return prevStack;
            }
            return [...prevStack, prev];
          });
        }
      }
    } else {
      if (!isGoingBackRef.current) {
        setDocHistoryStack([]);
      }
      isGoingBackRef.current = false;
    }
    prevLessonRef.current = selectedLessonForDetail;
  }, [selectedLessonForDetail]);

  const handleGoBackDoc = () => {
    if (docHistoryStack.length === 0) {
      setSelectedLessonForDetail(null);
      setLessonRatings([]);
      setMyRating(0);
      setMyComment('');
      return;
    }
    isGoingBackRef.current = true;
    const prevStack = [...docHistoryStack];
    const prevLesson = prevStack.pop();
    setDocHistoryStack(prevStack);
    setSelectedLessonForDetail(prevLesson || null);
  };

  const [detailCache, setDetailCache] = useState<Record<number, LessonPlan>>({});
  // Session-level ratings cache: avoids re-fetching ratings from server when user revisits same card
  const [ratingsCache, setRatingsCache] = useState<Record<number, { ratings: any[]; average_rating: number; total_ratings: number }>>({});

  // Edit History States & Methods
  const [editHistory, setEditHistory] = useState<any[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchEditHistory = async (lessonId: number) => {
    if (!currentUser) return;
    setHistoryLoading(true);
    setShowHistoryModal(true);
    try {
      const res = await fetch(`http://localhost:8000/api/lesson-plans/${lessonId}/history/?user_id=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setEditHistory(data);
      } else {
        const err = await res.json();
        alert(err.detail || "Không thể tải lịch sử chỉnh sửa.");
      }
    } catch (e) {
      console.error(e);
      alert("Đã xảy ra lỗi khi kết nối tới máy chủ.");
    } finally {
      setHistoryLoading(false);
    }
  };

  // Tự động đồng bộ sơ đồ tư duy biệt lập của tài liệu khi xem chi tiết và reset khi đóng
  useEffect(() => {
    if (selectedLessonForDetail) {
      setFocusLessonIdForChat(selectedLessonForDetail.id);
    } else {
      setFocusLessonIdForChat(null);
    }
  }, [selectedLessonForDetail]);
  const [previewMode, setPreviewMode] = useState<'docx' | 'markdown'>('markdown');
  const [selectedCreatorForProfile, setSelectedCreatorForProfile] = useState<User | null>(null);

  // Profile Settings States
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [profileFullName, setProfileFullName] = useState<string>('');
  const [profileCurrentPassword, setProfileCurrentPassword] = useState<string>('');
  const [profileNewPassword, setProfileNewPassword] = useState<string>('');
  const [profileConfirmNewPassword, setProfileConfirmNewPassword] = useState<string>('');
  const [showProfileCurrentPassword, setShowProfileCurrentPassword] = useState<boolean>(false);
  const [showProfileNewPassword, setShowProfileNewPassword] = useState<boolean>(false);
  const [showProfileConfirmNewPassword, setShowProfileConfirmNewPassword] = useState<boolean>(false);
  const [profileAvatar, setProfileAvatar] = useState<File | null>(null);
  const [profileAvatarPreview, setProfileAvatarPreview] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState<boolean>(false);

  useEffect(() => {
    if (showProfileModal && currentUser) {
      setProfileFullName(currentUser.full_name || '');
      setProfileCurrentPassword('');
      setProfileNewPassword('');
      setProfileConfirmNewPassword('');
      setProfileAvatar(null);
      setProfileAvatarPreview(null);
      setProfileError(null);
      setProfileSuccess(null);
    }
  }, [showProfileModal, currentUser]);

  // Upload Form
  const [upTitle, setUpTitle] = useState('');
  const [upDesc, setUpDesc] = useState('');
  const [upGrade, setUpGrade] = useState('');
  const [upDirId, setUpDirId] = useState('');
  const [upAttrs, setUpAttrs] = useState('{}');
  const [upFile, setUpFile] = useState<File | null>(null);

  // Edit Form
  const [editingLesson, setEditingLesson] = useState<LessonPlan | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editGrade, setEditGrade] = useState('');
  const [editLops, setEditLops] = useState<string[]>([]);
  const [editDirId, setEditDirId] = useState('');
  const [editAttrs, setEditAttrs] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editLocation, setEditLocation] = useState<string>('');
  const [isInlineEditingDetail, setIsInlineEditingDetail] = useState(false);


  // Dir Form
  const [dirName, setDirName] = useState('');
  const [dirParentId, setDirParentId] = useState('');
  const [dirIsPublic, setDirIsPublic] = useState(false);
  const [dirAttrs, setDirAttrs] = useState('{}');

  // Pagination & Sorting States
  const [sortBy, setSortBy] = useState<string>('date_desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // All lessons (unfiltered) for counting and client-side filtering
  const [allLessonPlans, setAllLessonPlans] = useState<LessonPlan[]>([]);
  const [unfilteredLessons, setUnfilteredLessons] = useState<LessonPlan[]>([]);

  const fetchLessonPlans = async (query: string = '') => {
    setLoading(true);
    try {
      let url = '/api/lesson-plans/';
      const params = new URLSearchParams();
      if (currentUser) params.append('user_id', currentUser.id.toString());
      if (query.trim()) params.append('q', query.trim());

      selectedClasses.forEach(c => params.append('lop', c));
      selectedTypes.forEach(t => params.append('type', t));
      selectedSubjects.forEach(s => {
        if (s === 'Hoạt động trải nghiệm Sinh học' || s === 'Sinh học') {
          params.append('subject', s);
        } else {
          params.append('biology', s);
        }
      });
      selectedTargetStudents.forEach(ts => params.append('target_student', ts));
      selectedTracks.forEach(tr => params.append('track', tr));
      selectedTopics.forEach(tp => params.append('topic', tp));
      selectedBiologies.forEach(b => params.append('biology', b));
      selectedLocations.forEach(loc => params.append('location', loc));

      const paramStr = params.toString();
      if (paramStr) url += `?${paramStr}`;

      const response = await axios.get(url);
      setAllLessonPlans(response.data);

      // Fetch unfiltered lessons to keep the filter sidebar properties stable
      let unfilteredUrl = '/api/lesson-plans/';
      if (currentUser) unfilteredUrl += `?user_id=${currentUser.id}`;
      const unfilteredResponse = await axios.get(unfilteredUrl);
      setUnfilteredLessons(unfilteredResponse.data);

      setError(null);
    } catch (err) {
      setError('Lỗi khi tải dữ liệu từ máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDirectories = async () => {
    try {
      let url = '/api/directories/';
      if (currentUser) url += `?user_id=${currentUser.id}`;
      const response = await axios.get(url);
      setDirectories(response.data);
    } catch (err) {
      console.error('Lỗi tải thư mục:', err);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfileAvatar(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setProfileAvatarPreview(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (profileNewPassword && profileNewPassword !== profileConfirmNewPassword) {
      setProfileError('Mật khẩu mới và xác nhận mật khẩu không khớp.');
      return;
    }

    setProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const formData = new FormData();
      formData.append('user_id', currentUser.id.toString());
      formData.append('full_name', profileFullName);
      if (profileNewPassword) {
        formData.append('new_password', profileNewPassword);
      }
      if (profileCurrentPassword) {
        formData.append('current_password', profileCurrentPassword);
      }
      if (profileAvatar) {
        formData.append('avatar', profileAvatar);
      }

      const response = await axios.post('/api/users/me/profile/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setProfileSuccess(response.data.message || 'Cập nhật thông tin cá nhân thành công!');

      // Update local storage and currentUser state
      const updatedUser = response.data.user;
      setCurrentUser(updatedUser);
      sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));

      // Clear password fields
      setProfileCurrentPassword('');
      setProfileNewPassword('');
      setProfileConfirmNewPassword('');
      setProfileAvatar(null);
      setProfileAvatarPreview(null);
    } catch (err: any) {
      console.error(err);
      setProfileError(err.response?.data?.error || 'Có lỗi xảy ra khi cập nhật thông tin.');
    } finally {
      setProfileSaving(false);
    }
  };

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    fetchLessonPlans(debouncedSearchQuery);
  }, [
    currentUser,
    debouncedSearchQuery
  ]);

  useEffect(() => {
    setPersonalSearchQuery(debouncedSearchQuery);
  }, [debouncedSearchQuery]);

  useEffect(() => {
    fetchDirectories();
  }, [currentUser]);

  useEffect(() => {
    fetchPendingApprovals();
  }, [currentUser]);

  useEffect(() => {
    fetchMyPermissions();
  }, [currentUser]);

  useEffect(() => {
    if (selectedLessonForDetail) {
      setPreviewMode('markdown');
      setSelectedStarFilter('all');
      setEditingMyReview(false);
      if (!editingLesson || editingLesson.id !== selectedLessonForDetail.id) {
        setIsInlineEditingDetail(false);
      }

      // ── 1. Content detail cache (avoid re-fetching content_preview) ────────
      const cached = detailCache[selectedLessonForDetail.id];
      if (cached && cached.content_preview) {
        // Restore full detail from session cache — zero network request!
        if (selectedLessonForDetail.content_preview !== cached.content_preview) {
          setSelectedLessonForDetail(prev => {
            if (!prev || prev.id !== cached.id) return prev;
            return { ...prev, ...cached };
          });
        }
      } else {
        // First visit: fetch full lesson detail and store in cache
        axios.get(`/api/lesson-plans/${selectedLessonForDetail.id}/?user_id=${currentUser?.id}`)
          .then(res => {
            if (res.data) {
              setDetailCache(prev => ({ ...prev, [selectedLessonForDetail.id]: res.data }));
              if (res.data.content_preview !== selectedLessonForDetail.content_preview) {
                setSelectedLessonForDetail(prev => {
                  if (!prev || prev.id !== res.data.id) return prev;
                  return { ...prev, ...res.data };
                });
              }
            }
          })
          .catch(err => {
            console.error("Lỗi khi tải chi tiết giáo án từ API:", err);
          });
      }

      // ── 2. Ratings cache (avoid re-fetching ratings on revisit) ─────────────
      const cachedRatings = ratingsCache[selectedLessonForDetail.id];
      if (cachedRatings) {
        // Restore ratings from session cache — zero network request!
        setLessonRatings(cachedRatings.ratings);
        setRatingAvg(cachedRatings.average_rating);
        setRatingTotal(cachedRatings.total_ratings);
        if (currentUser) {
          const mine = cachedRatings.ratings.find((r: any) => r.user_id === currentUser.id);
          if (mine) { setMyRating(mine.rating); setMyComment(mine.comment || ''); }
          else { setMyRating(0); setMyComment(''); }
        }
        setRatingLoading(false);
      } else {
        // First visit: fetch ratings and store in cache
        setRatingLoading(true);
        axios.get(`/api/lesson-plans/${selectedLessonForDetail.id}/ratings/`)
          .then(res => {
            const ratingsData = { ratings: res.data.ratings, average_rating: res.data.average_rating, total_ratings: res.data.total_ratings };
            setRatingsCache(prev => ({ ...prev, [selectedLessonForDetail.id]: ratingsData }));
            setLessonRatings(res.data.ratings);
            setRatingAvg(res.data.average_rating);
            setRatingTotal(res.data.total_ratings);
            if (currentUser) {
              const mine = res.data.ratings.find((r: any) => r.user_id === currentUser.id);
              if (mine) { setMyRating(mine.rating); setMyComment(mine.comment || ''); }
              else { setMyRating(0); setMyComment(''); }
            }
          })
          .catch(err => {
            console.error("Lỗi khi tải bình luận:", err);
          })
          .finally(() => {
            setRatingLoading(false);
          });
      }
    } else {
      setLessonRatings([]);
      setMyRating(0);
      setMyComment('');
      setSelectedStarFilter('all');
      setEditingMyReview(false);
    }
  }, [selectedLessonForDetail?.id, currentUser]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/login/', { username, password });
      sessionStorage.setItem('currentUser', JSON.stringify(response.data.user));
      if (response.data.token) {
        sessionStorage.setItem('keycloakToken', response.data.token);
        sessionStorage.setItem('isMockLogin', 'false');
      } else {
        sessionStorage.setItem('isMockLogin', 'true');
      }
      setCurrentUser(response.data.user);
      setShowAuthModal(false);
      setAuthError(null);
      if (response.data.user.must_change_password) {
        alert('Tài khoản của bạn đang sử dụng mật khẩu tạm thời. Bắt buộc phải đổi mật khẩu ngay để kích hoạt chính thức tài khoản (Mật khẩu tạm thời hết hạn sau 24h).');
        setShowProfileModal(true);
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Đăng nhập thất bại. Kiểm tra lại thông tin.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const usernameRegex = /^[a-zA-Z0-9._-]{3,30}$/;

    if (!emailRegex.test(email)) {
      setAuthError('Email không hợp lệ (ví dụ: name@school.edu.vn).');
      return;
    }
    if (!usernameRegex.test(username)) {
      setAuthError('Tên đăng nhập không hợp lệ (từ 3-30 ký tự, chỉ chứa chữ, số, dấu chấm, gạch dưới, gạch ngang).');
      return;
    }

    try {
      const response = await axios.post('/api/register/', { username, password, email, full_name: fullName, role: 'USER' });
      setAuthError(`Đăng ký thành công! ${response.data.keycloak || ''} Đang chuyển sang đăng nhập...`);
      setTimeout(() => {
        setAuthMode('LOGIN');
        setAuthError(null);
      }, 2500);
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Lỗi đăng ký. Tên người dùng hoặc email có thể đã tồn tại.');
    }
  };

  const handleFindAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFoundAccount(null);
    setAuthError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^(0[3|5|7|8|9])[0-9]{8}$/;
    const usernameRegex = /^[a-zA-Z0-9._-]{3,30}$/;

    const isEmail = identity.includes('@');
    const isPhone = /^\d+$/.test(identity);

    if (isEmail && !emailRegex.test(identity)) {
      setAuthError('Email không hợp lệ.');
      return;
    } else if (isPhone && !phoneRegex.test(identity)) {
      setAuthError('Số điện thoại không hợp lệ (phải có 10 chữ số bắt đầu bằng 03, 05, 07, 08, 09).');
      return;
    } else if (!isEmail && !isPhone && !usernameRegex.test(identity)) {
      setAuthError('Tên đăng nhập không hợp lệ (từ 3-30 ký tự).');
      return;
    }

    try {
      const response = await axios.post('/api/find-account/', { identity });
      setFoundAccount(response.data);
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Không tìm thấy tài khoản tương thích.');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetResult(null);
    setAuthError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^(0[3|5|7|8|9])[0-9]{8}$/;
    const usernameRegex = /^[a-zA-Z0-9._-]{3,30}$/;

    const isEmail = identity.includes('@');
    const isPhone = /^\d+$/.test(identity);

    if (isEmail && !emailRegex.test(identity)) {
      setAuthError('Email không hợp lệ.');
      return;
    } else if (isPhone && !phoneRegex.test(identity)) {
      setAuthError('Số điện thoại không hợp lệ (phải có 10 chữ số bắt đầu bằng 03, 05, 07, 08, 09).');
      return;
    } else if (!isEmail && !isPhone && !usernameRegex.test(identity)) {
      setAuthError('Tên đăng nhập không hợp lệ (từ 3-30 ký tự).');
      return;
    }

    try {
      const response = await axios.post('/api/forgot-password/', { identity });
      setResetResult(response.data);
      setOtpCountdown(300); // 5 minutes countdown
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Không thể gửi yêu cầu đặt lại mật khẩu.');
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (otpCountdown <= 0) {
      setAuthError('Mã OTP đã hết hạn 5 phút. Vui lòng nhấn nút gửi lại mã OTP mới.');
      return;
    }

    if (otpNewPassword !== otpConfirmPassword) {
      setAuthError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }
    try {
      const response = await axios.post('/api/verify-otp-reset/', {
        identity,
        otp_code: otpCode,
        new_password: otpNewPassword
      });
      setAuthError(`🎉 ${response.data.message} Đang chuyển hướng về màn hình đăng nhập...`);
      setOtpCountdown(0); // Clear timer
      setTimeout(() => {
        setUsername(identity);
        setPassword(otpNewPassword);
        setShowPassword(true);
        setAuthMode('LOGIN');
        setAuthError(null);
        setResetResult(null);
        setOtpCode('');
        setOtpNewPassword('');
        setOtpConfirmPassword('');
      }, 2500);
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Mã OTP không chính xác hoặc đã hết hạn.');
    }
  };

  const handleLogout = () => {
    const isMock = sessionStorage.getItem('isMockLogin') === 'true';
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('keycloakToken');
    sessionStorage.removeItem('isMockLogin');
    setCurrentUser(null);
    setSearchQuery('');
    setSelectedDirs([]);
    setHomeTab('library');

    // Nếu là phiên đăng nhập thật, chuyển hướng sang cổng logout của Keycloak
    if (!isMock) {
      window.location.href = 'http://localhost:8080/realms/kms_realm/protocol/openid-connect/logout?client_id=kms-web-client&post_logout_redirect_uri=http://localhost:5173/';
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleCreateDir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      await axios.post('/api/directories/', {
        user_id: currentUser.id,
        name: dirName,
        is_public: currentUser.role === 'ADMIN' ? dirIsPublic : false,
        attributes: dirAttrs,
        parent: dirParentId || null
      });
      alert('Tạo thư mục thành công!');
      setShowDirModal(false);
      setDirName('');
      setDirParentId('');
      setDirAttrs('{}');
      setDirIsPublic(false);
      fetchDirectories();
    } catch (err) {
      alert('Lỗi tạo thư mục.');
    }
  };

  const handleAddChildDir = (parentId: number) => {
    setDirParentId(parentId.toString());
    setDirName('');
    setDirAttrs('{}');
    setDirIsPublic(false);
    setShowDirModal(true);
  };

  const handleDeleteDir = async (id: number, name: string) => {
    if (!window.confirm(`Xóa thư mục "${name}"? Tài liệu bên trong sẽ không bị xóa nhưng sẽ mất liên kết.`)) return;
    try {
      await axios.delete(`/api/directories/${id}/`);
      setSelectedDirs(prev => prev.filter(d => d !== id));
      fetchDirectories();
    } catch (err) {
      alert('Lỗi xóa thư mục.');
    }
  };

  const getBase64 = (file: File): Promise<{ name: string, data: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve({ name: file.name, data: reader.result as string });
      reader.onerror = error => reject(error);
    });
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !upFile) return;

    try {
      const formData = new FormData();
      formData.append('user_id', currentUser.id.toString());
      formData.append('title', upTitle);
      formData.append('description', upDesc);
      formData.append('target_student', upGrade);
      formData.append('status', 'LOCAL');
      
      let parsedAttrs = {};
      try {
        parsedAttrs = JSON.parse(upAttrs);
      } catch {
        parsedAttrs = {};
      }
      const mergedAttrs = {
        ...parsedAttrs,
        ai_model_config: {
          ai_mode: localStorage.getItem('kms_ai_mode') || 'local',
          local_model: localStorage.getItem('kms_local_model') || '3b',
          api_key: localStorage.getItem('kms_api_key') || '',
          api_model: localStorage.getItem('kms_api_model') || 'gemini-1.5-flash'
        }
      };
      formData.append('attributes', JSON.stringify(mergedAttrs));

      if (upDirId) formData.append('directory_id', upDirId);
      formData.append('file', upFile);

      const response = await fetch('/api/lesson-plans/upload/', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error('Upload failed with status ' + response.status);

      const newPlan = await response.json();
      alert('Tải lên thành công (Lưu cục bộ)!');
      setShowUploadModal(false);
      setUpFile(null);
      
      // Update local state directly to avoid full DB reload
      setAllLessonPlans(prev => [newPlan, ...prev]);
      setUnfilteredLessons(prev => [newPlan, ...prev]);
      setDetailCache(prev => ({ ...prev, [newPlan.id]: newPlan }));
    } catch (err) {
      console.error('Upload Error:', err);
      alert('Lỗi khi tải lên. Vui lòng kiểm tra console.');
    }
  };

  const handleDeleteLesson = async (id: number) => {
    if (!window.confirm('Bạn có chắc muốn xóa tài liệu này?')) return;
    try {
      await fetch(`/api/lesson-plans/${id}/`, { method: 'DELETE' });
      alert('Xóa thành công!');
      
      // Update local state directly to avoid full DB reload
      setAllLessonPlans(prev => prev.filter(p => p.id !== id));
      setUnfilteredLessons(prev => prev.filter(p => p.id !== id));
      setDetailCache(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (selectedLessonForDetail?.id === id) {
        setSelectedLessonForDetail(null);
      }
    } catch (err) {
      alert('Lỗi khi xóa.');
    }
  };

  const handleRenameDir = async (id: number, newName: string) => {
    // Optimistic update
    setDirectories(prev => prev.map(d => d.id === id ? { ...d, name: newName } : d));
    try {
      await axios.patch(`/api/directories/${id}/`, { name: newName });
      // Refresh from server to confirm
      const url = currentUser ? `/api/directories/?user_id=${currentUser.id}` : '/api/directories/';
      const res = await axios.get(url);
      setDirectories(res.data);
    } catch (err) {
      console.error('Rename dir error:', err);
      fetchDirectories(); // Rollback
      alert('Lỗi đổi tên thư mục.');
    }
  };

  const handleTogglePublicDir = async (id: number, currentIsPublic: boolean) => {
    console.log("handleTogglePublicDir called with id:", id, "currentIsPublic:", currentIsPublic);
    const action = currentIsPublic ? 'chuyển sang riêng tư' : 'xuất bản công khai';
    if (!window.confirm(`Bạn có chắc muốn ${action} thư mục này?`)) {
      console.log("User cancelled confirm dialog");
      return;
    }
    console.log("User confirmed. Performing optimistic update...");
    // Optimistic update
    setDirectories(prev => prev.map(d => d.id === id ? { ...d, is_public: !currentIsPublic } : d));
    try {
      const res = await axios.patch(
        `/api/directories/${id}/`,
        { is_public: !currentIsPublic }
      );
      console.log('Toggle public API success:', res.data);
      // Refresh from server
      const url = currentUser ? `/api/directories/?user_id=${currentUser.id}` : '/api/directories/';
      const freshRes = await axios.get(url);
      setDirectories(freshRes.data);
    } catch (err: any) {
      console.error('Toggle public error:', err?.response?.data || err);
      fetchDirectories(); // Rollback
      alert('Lỗi cập nhật trạng thái thư mục: ' + (err?.response?.data ? JSON.stringify(err.response.data) : err.message));
    }
  };

  const openEditModal = (lesson: LessonPlan) => {
    setSelectedLessonForDetail(lesson);
    setEditingLesson(lesson);
    setEditTitle(lesson.title);
    setEditDesc(lesson.description || '');
    setEditGrade(lesson.target_student || '');
    const lpLop = lesson.attributes?.['lop'] || lesson.attributes?.['Lớp'] || [];
    setEditLops(Array.isArray(lpLop) ? lpLop : [lpLop]);
    setEditDirId(lesson.directory_ids && lesson.directory_ids.length > 0 ? lesson.directory_ids[0].toString() : '');
    setEditAttrs(JSON.stringify(lesson.attributes || {}));
    setEditFile(null);
    const loc = lesson.attributes && lesson.attributes['Địa điểm'] ? lesson.attributes['Địa điểm'] : '';
    setEditLocation(loc);
    setIsInlineEditingDetail(true);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLesson || !currentUser) return;

    try {
      const formData = new FormData();
      // Send user_id so backend can determine role-based approval rules
      formData.append('user_id', currentUser.id.toString());
      formData.append('title', editTitle);
      formData.append('description', editDesc);
      formData.append('target_student', editGrade);
      formData.append('directory_id', editDirId);

      const attrsObj = JSON.parse(editAttrs || '{}');
      attrsObj['lop'] = editLops;
      attrsObj['Địa điểm'] = editLocation;
      formData.append('attributes', JSON.stringify(attrsObj));
      if (editFile) {
        formData.append('file_path', editFile);
      }

      const response = await fetch(`/api/lesson-plans/${editingLesson.id}/`, {
        method: 'PATCH',
        body: formData
      });
      if (!response.ok) {
        try {
          const errData = await response.json();
          if (errData.error) {
            alert(errData.error);
            return;
          }
        } catch { }
        throw new Error('Edit failed with status ' + response.status);
      }

      const updatedPlan = await response.json();
      const msg = currentUser.role === 'USER'
        ? 'Đã gửi bản chỉnh sửa để chờ duyệt lại!'
        : 'Cập nhật thành công!';
      alert(msg);
      if (selectedLessonForDetail && selectedLessonForDetail.id === editingLesson.id) {
        setSelectedLessonForDetail(updatedPlan);
      }
      setIsInlineEditingDetail(false);
      setEditingLesson(null);
      setEditFile(null);

      // Update local state directly to avoid full DB reload
      setAllLessonPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
      setUnfilteredLessons(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
      setDetailCache(prev => ({ ...prev, [updatedPlan.id]: updatedPlan }));
      if (selectedLessonForDetail?.id === updatedPlan.id) {
        setSelectedLessonForDetail(updatedPlan);
      }
    } catch (err: any) {
      console.error('Edit Error:', err);
      alert('Lỗi cập nhật tài liệu: ' + err.message);
    }
  };

  const openProposeModal = (lesson: LessonPlan) => {
    setLessonToPropose(lesson);
    setTargetPublicDirId('');
    setProposeError(null);
    setProposeDuplicateId(null);
    setShowProposeModal(true);

    if (currentUser) {
      axios.post(`/api/lesson-plans/${lesson.id}/check-duplicate/`, {
        user_id: currentUser.id,
        status: 'PENDING'
      })
        .then(res => {
          if (res.data.is_duplicate) {
            setProposeError(res.data.error);
            setProposeDuplicateId(res.data.duplicate_id);
          }
        })
        .catch(err => {
          console.error("Lỗi kiểm tra trùng lặp tự động:", err);
        });
    }
  };

  const handleProposePublic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonToPropose || !targetPublicDirId || !currentUser) return;
    setProposeError(null);
    setProposeDuplicateId(null);
    try {
      const res = await axios.post(`/api/lesson-plans/${lessonToPropose.id}/propose/`, {
        user_id: currentUser.id,
        directory_id: parseInt(targetPublicDirId)
      });
      alert(res.data.message || 'Đã gửi đề xuất công khai thành công!');
      setShowProposeModal(false);
      
      const updatedPlan = res.data.lesson;
      setLessonToPropose(null);
      setTargetPublicDirId('');
      
      if (updatedPlan) {
        // Update local state directly to avoid full DB reload
        setAllLessonPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
        setUnfilteredLessons(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
        setDetailCache(prev => ({ ...prev, [updatedPlan.id]: updatedPlan }));
        if (selectedLessonForDetail?.id === updatedPlan.id) {
          setSelectedLessonForDetail(updatedPlan);
        }
      } else {
        fetchLessonPlans(searchQuery);
      }
    } catch (err: any) {
      if (err.response?.data?.error) {
        setProposeError(err.response.data.error);
        if (err.response.data.duplicate_id) {
          setProposeDuplicateId(err.response.data.duplicate_id);
        }
      } else {
        setProposeError('Lỗi gửi đề xuất: ' + err.message);
      }
    }
  };

  const handleWithdrawLesson = async (lessonId: number, action: 'delete' | 'retract') => {
    if (!currentUser) return;
    const labels = {
      delete: { confirm: 'Xóa vĩnh viễn bài giảng này? Không thể khôi phục lại.', success: 'Đã xóa bài giảng thành công!' },
      retract: { confirm: 'Thu hồi bài giảng về thư viện cá nhân? Bài sẽ biến mất khỏi thư viện chung và lịch sử đóng góp.', success: 'Đã thu hồi bài giảng về thư viện cá nhân!' }
    };
    if (!window.confirm(labels[action].confirm)) return;
    try {
      const res = await axios.post(`/api/lesson-plans/${lessonId}/withdraw/`, {
        user_id: currentUser.id,
        action
      });
      alert(res.data.message || labels[action].success);

      if (action === 'delete') {
        setAllLessonPlans(prev => prev.filter(p => p.id !== lessonId));
        setUnfilteredLessons(prev => prev.filter(p => p.id !== lessonId));
        setDetailCache(prev => {
          const next = { ...prev };
          delete next[lessonId];
          return next;
        });
        if (selectedLessonForDetail?.id === lessonId) {
          setSelectedLessonForDetail(null);
        }
      } else {
        const updatedPlan = res.data.lesson;
        if (updatedPlan) {
          setAllLessonPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
          setUnfilteredLessons(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
          setDetailCache(prev => ({ ...prev, [updatedPlan.id]: updatedPlan }));
          if (selectedLessonForDetail?.id === updatedPlan.id) {
            setSelectedLessonForDetail(updatedPlan);
          }
        } else {
          fetchLessonPlans(searchQuery);
        }
      }
    } catch (err: any) {
      alert('Lỗi: ' + (err.response?.data?.error || err.message));
    }
  };

  // Filter root directories (only public ones for the main Shared Library)
  const rootDirs = directories.filter(d => !d.parent && d.is_public);

  // Derive base lesson pool: filtered by selected directories (client-side) - Only show PUBLISHED plans in the Shared Library
  const dirFilteredLessons = useMemo(() => {
    const basePlans = (allLessonPlans || []).filter(l => l.status === 'PUBLISHED');
    if (selectedDirs.length === 0) return basePlans;
    const result = new Map<number, LessonPlan>();
    selectedDirs.forEach(dirId => {
      getLessonsInDir(dirId, directories, basePlans).forEach(l => result.set(l.id, l));
    });
    return Array.from(result.values());
  }, [selectedDirs, directories, allLessonPlans]);

  // Stable directory-only filtered pool for calculating available subjects in the sidebar
  const dirUnfilteredLessons = useMemo(() => {
    const basePlans = (unfilteredLessons || []).filter(l => l.status === 'PUBLISHED');
    if (selectedDirs.length === 0) return basePlans;
    const result = new Map<number, LessonPlan>();
    selectedDirs.forEach(dirId => {
      getLessonsInDir(dirId, directories, basePlans).forEach(l => result.set(l.id, l));
    });
    return Array.from(result.values());
  }, [selectedDirs, directories, unfilteredLessons]);

  // Dynamic subject list from current dir-filtered pool (stable when checking boxes)
  const availableSubjects = useMemo(() => {
    const subjects = new Set<string>();

    // Inspect selected directories (or all directories if none selected) for dynamic knowledge tags
    const targetDirs = selectedDirs.length > 0
      ? selectedDirs.map(dirId => directories.find(d => d.id === dirId)).filter(Boolean) as Directory[]
      : directories;

    targetDirs.forEach(dirObj => {
      if (dirObj && dirObj.attributes) {
        const kt = dirObj.attributes['knowledge_tags'] || dirObj.attributes['Kiến thức'] || dirObj.attributes['subject'] || dirObj.attributes['subjects'] || dirObj.attributes['Môn học'];
        if (kt) {
          if (Array.isArray(kt)) {
            kt.forEach(k => subjects.add(k));
          } else if (typeof kt === 'string') {
            subjects.add(kt);
          }
        }
      }
    });

    // Also collect from current unfiltered lessons in the chosen directories to be fully comprehensive
    dirUnfilteredLessons.forEach(l => {
      const kt = l.attributes?.['knowledge_tags'] || l.attributes?.['Kiến thức sinh học liên quan'] || l.attributes?.['Môn học'];
      if (kt) {
        if (Array.isArray(kt)) {
          kt.forEach(k => subjects.add(k));
        } else if (typeof kt === 'string') {
          subjects.add(kt);
        }
      }
    });

    return Array.from(subjects).sort();
  }, [dirUnfilteredLessons, selectedDirs, directories]);

  const availableTopics = useMemo(() => {
    if (selectedTracks.length === 0) {
      return Object.values(TRACK_TO_TOPICS).flat();
    }
    return selectedTracks.flatMap(track => TRACK_TO_TOPICS[track] || []);
  }, [selectedTracks]);

  // Search & dynamic filters are fully executed on client-side React state for instant 0ms filtering
  // to avoid redundant database reloads when clicking sidebar checkboxes.
  const filteredLessonPlans = useMemo(() => {
    let list = [...dirFilteredLessons];

    // 1. Filter by Lớp học (selectedClasses) - Strict AND (every)
    if (selectedClasses.length > 0) {
      list = list.filter(l => {
        const lpLop = l.attributes?.['lop'] || l.attributes?.['Lớp'];
        if (!lpLop) return false;
        const lopList = Array.isArray(lpLop) ? lpLop : [lpLop];
        return selectedClasses.every(c => lopList.some((val: any) => String(val).toLowerCase().includes(c.toLowerCase())));
      });
    }

    // 2. Filter by Loại hình (selectedTypes) - Strict AND (every)
    if (selectedTypes.length > 0) {
      list = list.filter(l => {
        const lpType = l.attributes?.['Loại hình'] || l.attributes?.['loai_hinh'];
        if (!lpType) return false;
        return selectedTypes.every(t => String(lpType).toLowerCase().includes(t.toLowerCase()));
      });
    }

    // 3. Filter by Đối tượng (selectedTargetStudents) - Strict AND (every)
    if (selectedTargetStudents.length > 0) {
      list = list.filter(l => {
        const lpTarget = l.target_student;
        if (!lpTarget) return false;
        return selectedTargetStudents.every(ts => {
          if (ts === 'Học sinh nông thôn') {
            return lpTarget.toLowerCase().includes('nông thôn') || lpTarget.toLowerCase().includes('ns') || lpTarget.toLowerCase().includes('hs nông thôn') || lpTarget.toLowerCase().includes('tat ca') || lpTarget.toLowerCase().includes('tất cả');
          }
          if (ts === 'Học sinh thành thị') {
            return lpTarget.toLowerCase().includes('thành thị') || lpTarget.toLowerCase().includes('hs thành thị') || lpTarget.toLowerCase().includes('tat ca') || lpTarget.toLowerCase().includes('tất cả');
          }
          return lpTarget.toLowerCase().includes(ts.toLowerCase());
        });
      });
    }

    // 4. Filter by Địa điểm (selectedLocations) - Strict AND (every)
    if (selectedLocations.length > 0) {
      list = list.filter(l => {
        const lpLoc = l.attributes?.['Địa điểm'] || l.attributes?.['dia_diem'];
        if (!lpLoc) return false;
        return selectedLocations.every(loc => {
          if (loc.toLowerCase().includes('ngoài trời')) {
            return String(lpLoc).toLowerCase().includes('ngoài trời') || String(lpLoc).toLowerCase().includes('ngoai troi');
          }
          if (loc.toLowerCase().includes('thực địa')) {
            return String(lpLoc).toLowerCase().includes('thực địa') || String(lpLoc).toLowerCase().includes('thuc dia') || String(lpLoc).toLowerCase().includes('nông trại');
          }
          return String(lpLoc).toLowerCase().includes(loc.toLowerCase());
        });
      });
    }

    // 5. Filter by Kiến thức / Subjects (selectedSubjects) - Strict AND (every)
    if (selectedSubjects.length > 0) {
      list = list.filter(l => {
        const lpSub = l.attributes?.['Môn học'] || l.attributes?.['mon_hoc'];
        const tags = l.attributes?.['knowledge_tags'] || [];
        const tk = l.attributes?.['Từ khóa kiến thức'] || [];
        const bio = l.attributes?.['Kiến thức sinh học liên quan'] || '';

        return selectedSubjects.every(sub => {
          const lSubjMatches = lpSub && String(lpSub).toLowerCase().includes(sub.toLowerCase());
          const tagsMatches = Array.isArray(tags) && tags.some((t: any) => String(t).toLowerCase() === sub.toLowerCase());
          const tkMatches = Array.isArray(tk) && tk.some((t: any) => String(t).toLowerCase() === sub.toLowerCase());
          const bioMatches = String(bio).toLowerCase().includes(sub.toLowerCase());
          return lSubjMatches || tagsMatches || tkMatches || bioMatches;
        });
      });
    }

    // 6. Filter by Tiết dạy (selectedTietDay) - Strict AND (every)
    if (selectedTietDay.length > 0) {
      list = list.filter(l => {
        const lpTiet = l.attributes?.['Tiết dạy'] || l.attributes?.['tiet_day'];
        if (!lpTiet) return false;
        return selectedTietDay.every(td => String(lpTiet).toLowerCase().includes(td.toLowerCase()));
      });
    }

    // 7. Filter by Mạch kiến thức (selectedTracks) - Strict AND (every)
    if (selectedTracks.length > 0) {
      list = list.filter(l => {
        const lpTrack = l.attributes?.['Mạch kiến thức'] || l.attributes?.['mach_kien_thuc'];
        if (!lpTrack) return false;
        return selectedTracks.every(tr => String(lpTrack).toLowerCase().includes(tr.toLowerCase()));
      });
    }

    // 8. Filter by Chủ đề (selectedTopics) - Strict AND (every)
    if (selectedTopics.length > 0) {
      list = list.filter(l => {
        const lpTopic = l.attributes?.['Chủ đề'] || l.attributes?.['chu_de'];
        if (!lpTopic) return false;
        return selectedTopics.every(tp => String(lpTopic).toLowerCase().includes(tp.toLowerCase()));
      });
    }

    // 9. Filter by Liên kết sinh học (selectedBiologies) - Strict AND (every)
    if (selectedBiologies.length > 0) {
      list = list.filter(l => {
        const lpBio = l.attributes?.['Kiến thức sinh học liên quan'] || l.attributes?.['kien_thuc_sinh_hoc'];
        if (!lpBio) return false;
        return selectedBiologies.every(b => String(lpBio).toLowerCase().includes(b.toLowerCase()));
      });
    }

    return list;
  }, [
    dirFilteredLessons,
    selectedClasses,
    selectedTypes,
    selectedTargetStudents,
    selectedLocations,
    selectedSubjects,
    selectedTietDay,
    selectedTracks,
    selectedTopics,
    selectedBiologies
  ]);

  // Auto-switch sort to Relevance when FTS query is active, and revert to Newest when empty
  useEffect(() => {
    if (debouncedSearchQuery.trim()) {
      setSortBy('relevance');
    } else {
      setSortBy('date_desc');
    }
  }, [debouncedSearchQuery]);

  // Sort the filtered plans based on current sort settings
  const sortedLessonPlans = useMemo(() => {
    const list = [...filteredLessonPlans];

    // Relevance order is already sorted by SearchRank at PostgreSQL server-side level
    if (sortBy === 'relevance') {
      return list;
    }

    list.sort((a, b) => {
      if (sortBy === 'date_desc') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'date_asc') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'rating_desc') {
        // Primary: highest average rating first. Tiebreaker: more total ratings = higher priority
        const ratingDiff = (b.average_rating || 0) - (a.average_rating || 0);
        if (ratingDiff !== 0) return ratingDiff;
        return (b.total_ratings || 0) - (a.total_ratings || 0);
      }
      if (sortBy === 'rating_asc') {
        // Primary: lowest average rating first. Tiebreaker: fewer total ratings = lower priority
        const ratingDiff = (a.average_rating || 0) - (b.average_rating || 0);
        if (ratingDiff !== 0) return ratingDiff;
        return (a.total_ratings || 0) - (b.total_ratings || 0);
      }
      if (sortBy === 'total_desc') {
        return (b.total_ratings || 0) - (a.total_ratings || 0);
      }
      if (sortBy === 'total_asc') {
        return (a.total_ratings || 0) - (b.total_ratings || 0);
      }
      return 0;
    });
    return list;
  }, [filteredLessonPlans, sortBy]);

  // Paginate the sorted plans
  const paginatedLessonPlans = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedLessonPlans.slice(startIndex, startIndex + pageSize);
  }, [sortedLessonPlans, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    selectedDirs,
    selectedTargetStudents,
    selectedTypes,
    selectedSubjects,
    selectedTietDay,
    selectedTracks,
    selectedTopics,
    selectedBiologies,
    pageSize
  ]);


  // Resolve managed directory IDs for the current teacher
  const currentUserManagedDirIds: number[] = myManagedDirIds;

  if (currentView === 'upload') {
    return (
      <UploadPage
        directories={directories}
        currentUser={currentUser}
        onBack={() => setCurrentView('home')}
        onSuccess={(newPlan) => {
          setCurrentView('home');
          if (newPlan) {
            setAllLessonPlans(prev => [newPlan, ...prev]);
            setUnfilteredLessons(prev => [newPlan, ...prev]);
            setDetailCache(prev => ({ ...prev, [newPlan.id]: newPlan }));
          } else {
            fetchLessonPlans(searchQuery);
          }
        }}
        onRefreshDirs={fetchDirectories}
        managedDirectoryIds={currentUserManagedDirIds}
        uploadMode={uploadMode}
        onViewDuplicate={(lessonId) => {
          const existing = lessonPlans.find(l => l.id === lessonId);
          if (existing) {
            setCurrentView('home');
            setSelectedLessonForDetail(existing);
          } else {
            axios.get(`/api/lesson-plans/${lessonId}/?user_id=${currentUser?.id}`)
              .then(res => {
                setCurrentView('home');
                setSelectedLessonForDetail(res.data);
              })
              .catch(err => {
                console.error("Lỗi khi tải tài liệu trùng lặp:", err);
                alert("Không thể tải thông tin chi tiết của tài liệu trùng lặp.");
              });
          }
        }}
      />
    );
  }



  if (currentView === 'admin') {
    if (!currentUser || currentUser.role !== 'ADMIN') {
      setCurrentView('home');
      return null;
    }

    // Filter admin users client-side based on search query and role filter
    const filteredAdminUsers = adminUsers.filter((u: any) => {
      const matchSearch = (u.full_name || '').toLowerCase().includes(adminSearchQuery.toLowerCase()) ||
        (u.username || '').toLowerCase().includes(adminSearchQuery.toLowerCase());
      const matchRole = adminRoleFilter === 'ALL' || u.role === adminRoleFilter;
      return matchSearch && matchRole;
    });

    return (
      <div className="min-h-screen bg-gray-50 text-gray-800 font-sans flex flex-col">
        {/* Admin Navigation Bar */}
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="w-full px-6">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setCurrentView('home'); setSelectedUserForPerms(null); }}>
                <div className="bg-purple-600 rounded-xl text-white p-2 font-bold text-xl leading-none shadow-lg shadow-purple-500/20">🛡️</div>
                <div>
                  <span className="font-extrabold text-lg tracking-tight text-gray-900">Bảng Điều Hướng Quản Trị</span>
                  <p className="text-[10px] text-gray-500 font-semibold tracking-wider uppercase">Hệ thống quản lý tri thức</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setCurrentView('home'); setSelectedUserForPerms(null); }}
                  className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                >
                  <span>←</span> Quay lại trang chủ
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Layout Area */}
        <div className="flex-grow flex flex-col md:flex-row overflow-hidden max-h-[calc(100vh-4rem)]">
          {/* Sidebar / Left Column: Users List */}
          <div className="w-full md:w-80 border-r border-gray-200 bg-white p-5 flex flex-col space-y-4 overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-wider text-gray-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                Tài khoản ({filteredAdminUsers.length})
              </h3>
              <button
                onClick={() => {
                  setShowCreateUserForm(true);
                  setSelectedUserForPerms(null);
                }}
                className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-md shadow-purple-500/10"
              >
                <span>+</span> Thêm mới
              </button>
            </div>

            {/* Search and Filters */}
            <div className="space-y-2">
              <input
                type="text"
                value={adminSearchQuery}
                onChange={(e) => setAdminSearchQuery(e.target.value)}
                placeholder="Tìm kiếm tài khoản..."
                className="w-full bg-gray-50 border border-gray-200 hover:border-gray-350 rounded-xl px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-medium animate-none"
              />
              <select
                value={adminRoleFilter}
                onChange={(e) => setAdminRoleFilter(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 hover:border-gray-350 rounded-xl px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-medium"
              >
                <option value="ALL">Tất cả vai trò</option>
                <option value="ADMIN">Quản trị viên (Admin)</option>
                <option value="TEACHER">Giáo viên (Teacher)</option>
                <option value="USER">Người dùng (User)</option>
              </select>
            </div>

            {/* Scrollable list of accounts */}
            <div className="flex-grow space-y-2.5 overflow-y-auto pr-1">
              {filteredAdminUsers.map((u: any) => {
                const isSelected = selectedUserForPerms && selectedUserForPerms.id === u.id;
                return (
                  <div
                    key={u.id}
                    onClick={() => {
                      setSelectedUserForPerms(u);
                      setSelectedUserDirIds(u.managed_directories || []);
                      setShowCreateUserForm(false);
                      setAdminActiveTab('profile');
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex justify-between items-center relative group ${isSelected
                        ? 'border-purple-650 bg-purple-50/50 shadow-sm'
                        : 'border-gray-250 bg-white hover:border-purple-300 hover:bg-purple-50/10'
                      }`}
                  >
                    <div className="space-y-1">
                      <p className="font-bold text-sm text-gray-900 leading-tight group-hover:text-purple-600 transition-colors">
                        {u.full_name || u.username}
                      </p>
                      <p className="text-[10px] text-gray-400 font-semibold">@{u.username}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border tracking-wide uppercase ${u.role === 'ADMIN'
                            ? 'bg-red-50 text-red-700 border-red-100'
                            : u.role === 'TEACHER'
                              ? 'bg-blue-50 text-blue-700 border-blue-100'
                              : 'bg-gray-50 text-gray-600 border-gray-200'
                          }`}>
                          {u.role === 'ADMIN' ? 'Admin' : u.role === 'TEACHER' ? 'Giáo viên' : 'Thành viên'}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">
                          • {u.managed_directories?.length || 0} thư mục
                        </span>
                        {u.is_active === false && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full border border-amber-250 bg-amber-50 text-amber-700 uppercase tracking-wide flex items-center gap-0.5">
                            🔒 Khóa
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-gray-400 group-hover:text-purple-600 transition-colors font-bold text-sm">➔</span>
                  </div>
                );
              })}

              {filteredAdminUsers.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-xs italic">
                  Không tìm thấy tài khoản phù hợp.
                </div>
              )}
            </div>
          </div>
          {/* Right Column / Content Area: Workspaces */}
          <div className="flex-grow p-6 overflow-y-auto bg-gray-50/50 flex flex-col min-h-0">
            {showCreateUserForm ? (
              /* CREATE NEW USER WORKSPACE */
              <div className="max-w-2xl mx-auto w-full bg-white border border-gray-200/80 rounded-3xl p-8 shadow-lg space-y-6">
                <div>
                  <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                    <span className="p-1.5 bg-purple-600/20 text-purple-650 rounded-lg text-sm">👤</span>
                    Tạo tài khoản người dùng mới
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">Khởi tạo thông tin, thiết lập vai trò và cấp quyền mật khẩu ban đầu cho thành viên.</p>
                </div>

                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Tên đăng nhập (Username)</label>
                      <input
                        type="text"
                        required
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="Tên tài khoản (không dấu, viết liền)..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Mật khẩu ban đầu</label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Đặt mật khẩu bảo mật..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Họ và tên hiển thị</label>
                    <input
                      type="text"
                      required
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      placeholder="Nhập họ và tên đầy đủ..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Vai trò hệ thống (Role)</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: 'USER', label: 'Thành viên', desc: 'Chỉ xem tài liệu công khai' },
                        { value: 'TEACHER', label: 'Giáo viên', desc: 'Có thư mục riêng, tự đăng bài' },
                        { value: 'ADMIN', label: 'Quản trị viên', desc: 'Toàn quyền điều hành hệ thống' }
                      ].map((rOption) => (
                        <div
                          key={rOption.value}
                          onClick={() => setNewRole(rOption.value as any)}
                          className={`p-3 rounded-2xl border cursor-pointer transition-all text-center flex flex-col justify-center items-center ${newRole === rOption.value
                              ? 'border-purple-650 bg-purple-50 text-purple-700 font-bold'
                              : 'border-gray-200 bg-white hover:border-gray-300 text-gray-500 hover:text-gray-700'
                            }`}
                        >
                          <span className="font-extrabold text-xs">{rOption.label}</span>
                          <span className="text-[9px] text-gray-400 mt-1 leading-tight">{rOption.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateUserForm(false)}
                      className="px-5 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-500 rounded-xl text-xs font-bold transition-all"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-purple-250/20"
                    >
                      Xác nhận tạo tài khoản
                    </button>
                  </div>
                </form>
              </div>
            ) : selectedUserForPerms ? (
              /* DETAILED VIEW & OPERATIONS ON CHOSEN USER */
              <div className="flex-grow flex flex-col space-y-6">
                {/* User Hero Panel */}
                <div className="bg-white border border-gray-200/80 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-700 flex items-center justify-center text-white text-xl font-black shadow-md">
                      {selectedUserForPerms.avatar_url ? (
                        <img src={selectedUserForPerms.avatar_url} alt="Avatar" className="w-full h-full object-cover rounded-2xl" />
                      ) : (
                        (selectedUserForPerms.full_name || selectedUserForPerms.username || 'U').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-black text-gray-900">{selectedUserForPerms.full_name || selectedUserForPerms.username}</h2>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border tracking-wide uppercase ${selectedUserForPerms.role === 'ADMIN'
                            ? 'bg-red-50 text-red-700 border-red-100'
                            : selectedUserForPerms.role === 'TEACHER'
                              ? 'bg-blue-50 text-blue-700 border-blue-100'
                              : 'bg-gray-50 text-gray-600 border-gray-200'
                          }`}>
                          {selectedUserForPerms.role === 'ADMIN' ? 'Admin' : selectedUserForPerms.role === 'TEACHER' ? 'Giáo viên' : 'Thành viên'}
                        </span>
                        {selectedUserForPerms.is_active === false ? (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full border border-amber-250 bg-amber-50 text-amber-700 uppercase tracking-wide flex items-center gap-0.5">
                            🔒 Đã khóa tài khoản
                          </span>
                        ) : (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full border border-emerald-250 bg-emerald-50 text-emerald-700 uppercase tracking-wide flex items-center gap-0.5">
                            ✅ Đang hoạt động
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 font-semibold mt-0.5">Tên đăng nhập: @{selectedUserForPerms.username}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedUserForPerms.role === 'ADMIN' ? (
                      <span className="text-[10px] font-black px-3 py-2 rounded-xl border border-purple-200 bg-purple-50 text-purple-700 uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                        🛡️ Tài khoản Admin được bảo vệ
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleToggleLockUser(selectedUserForPerms)}
                          className={`px-4 py-2 border rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${selectedUserForPerms.is_active
                              ? 'border-amber-200 hover:bg-amber-50 text-amber-650 hover:text-amber-700'
                              : 'border-emerald-200 hover:bg-emerald-50 text-emerald-650 hover:text-emerald-700'
                            }`}
                        >
                          {selectedUserForPerms.is_active ? (
                            <><span>🔒</span> Khóa tài khoản</>
                          ) : (
                            <><span>🔓</span> Mở khóa tài khoản</>
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(selectedUserForPerms.id)}
                          className="px-4 py-2 border border-red-200 hover:bg-red-50 text-red-650 hover:text-red-700 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 animate-none"
                        >
                          <span>🗑️</span> Xóa tài khoản
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Workspace Navigation Tabs */}
                <div className="flex border-b border-gray-200">
                  <button
                    onClick={() => setAdminActiveTab('profile')}
                    className={`px-6 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${adminActiveTab === 'profile'
                        ? 'border-purple-600 text-purple-650 font-bold'
                        : 'border-transparent text-gray-500 hover:text-gray-800'
                      }`}
                  >
                    <span>👤</span> Hồ sơ & Bảo mật
                  </button>
                  <button
                    onClick={() => setAdminActiveTab('permissions')}
                    className={`px-6 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${adminActiveTab === 'permissions'
                        ? 'border-purple-600 text-purple-650 font-bold'
                        : 'border-transparent text-gray-500 hover:text-gray-800'
                      }`}
                  >
                    <span>📁</span> Phân quyền thư mục
                  </button>
                </div>

                {/* Tab Contents */}
                <div className="flex-grow min-h-0 overflow-y-auto">
                  {adminActiveTab === 'profile' ? (
                    <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 space-y-6 max-w-2xl shadow-sm">
                      <div>
                        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Hiệu chỉnh tài khoản</h3>
                        <p className="text-xs text-gray-500 mt-1">Thay đổi họ tên hiển thị, mật khẩu bảo mật hoặc nâng cấp vai trò hệ thống.</p>
                      </div>

                      <form onSubmit={handleEditUser} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Tên đăng nhập (Username)</label>
                            <input
                              type="text"
                              required
                              value={editUsername}
                              onChange={(e) => setEditUsername(e.target.value)}
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-semibold animate-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Mật khẩu mới (Bỏ trống nếu giữ nguyên)</label>
                            <input
                              type="password"
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                              placeholder="Nhập mật khẩu mới tại đây..."
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-medium"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Họ và tên hiển thị</label>
                          <input
                            type="text"
                            required
                            value={editFullName}
                            onChange={(e) => setEditFullName(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Vai trò hệ thống (Role)</label>
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { value: 'USER', label: 'Thành viên', desc: 'Chỉ xem tài liệu công khai' },
                              { value: 'TEACHER', label: 'Giáo viên', desc: 'Có thư mục riêng, tự đăng bài' },
                              { value: 'ADMIN', label: 'Quản trị viên', desc: 'Toàn quyền điều hành hệ thống' }
                            ].map((rOption) => (
                              <div
                                key={rOption.value}
                                onClick={() => setEditRole(rOption.value as any)}
                                className={`p-3 rounded-2xl border cursor-pointer transition-all text-center flex flex-col justify-center items-center ${editRole === rOption.value
                                    ? 'border-purple-650 bg-purple-50 text-purple-700 font-bold'
                                    : 'border-gray-200 bg-white hover:border-gray-300 text-gray-500 hover:text-gray-700'
                                  }`}
                              >
                                <span className="font-extrabold text-xs">{rOption.label}</span>
                                <span className="text-[9px] text-gray-400 mt-1 leading-tight">{rOption.desc}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
                          <button
                            type="submit"
                            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-purple-200/20"
                          >
                            Lưu thông tin hồ sơ
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    /* PERMISSIONS TAB */
                    <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 space-y-4 max-w-3xl shadow-sm">
                      <div>
                        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-1.5">
                          📁 Quản lý thư mục & Phân quyền
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Cấu hình và xem chi tiết không gian lưu trữ cá nhân hoặc phân quyền quản trị thư mục công khai (public).
                        </p>
                      </div>

                      {/* Sub-tabs inside Permissions Tab */}
                      <div className="flex border-b border-gray-200">
                        <button
                          type="button"
                          onClick={() => setAdminPermissionSubTab('personal')}
                          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${adminPermissionSubTab === 'personal'
                              ? 'border-purple-650 text-purple-700 font-black'
                              : 'border-transparent text-gray-500 hover:text-gray-850'
                            }`}
                        >
                          <span>📁</span> Thư mục cá nhân
                        </button>
                        {editRole !== 'USER' && (
                          <button
                            type="button"
                            onClick={() => setAdminPermissionSubTab('public')}
                            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${adminPermissionSubTab === 'public'
                                ? 'border-purple-650 text-purple-700 font-black'
                                : 'border-transparent text-gray-500 hover:text-gray-850'
                              }`}
                          >
                            <span>🌐</span> Thư mục public
                          </button>
                        )}
                      </div>

                      {adminPermissionSubTab === 'personal' ? (
                        /* PERSONAL DIRECTORIES VIEW WITH PERMISSION MANAGEMENT */
                        <div className="space-y-4">
                          <p className="text-xs text-gray-500">
                            💡 Các thư mục cá nhân thuộc sở hữu riêng của người dùng này. Quản trị viên có thể thu hồi hoặc cấp thêm quyền quản trị trực tiếp trên các thư mục này.
                          </p>
                          <div className="border border-gray-200 bg-gray-50/50 rounded-2xl p-4 overflow-y-auto max-h-[350px]">
                            {(() => {
                              const personalDirs = directories.filter(d => !d.is_public && d.user === selectedUserForPerms.id);
                              const rootPersonalDirs = personalDirs.filter(d => !d.parent || !personalDirs.some(p => p.id === d.parent));
                              if (rootPersonalDirs.length === 0) {
                                return <p className="text-sm text-gray-405 italic p-2">Người dùng này chưa khởi tạo thư mục cá nhân nào.</p>;
                              }
                              return (
                                <div className="space-y-0.5 text-gray-700">
                                  {rootPersonalDirs.map((dir: Directory) => (
                                    <PermissionDirTreeNode
                                      key={dir.id}
                                      dir={dir}
                                      directories={directories}
                                      selectedIds={selectedUserDirIds}
                                      onToggle={(id, descendants, checked) => {
                                        const allIds = [id, ...descendants];
                                        if (checked) {
                                          setSelectedUserDirIds(prev => Array.from(new Set([...prev, ...allIds])));
                                        } else {
                                          setSelectedUserDirIds(prev => prev.filter(x => !allIds.includes(x)));
                                        }
                                      }}
                                      depth={0}
                                      allLessonPlans={unfilteredLessons}
                                      onFileClick={setSelectedLessonForDetail}
                                    />
                                  ))}
                                </div>
                              );
                            })()}
                          </div>

                          <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
                            <button
                              onClick={handleSaveUserPermissions}
                              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-purple-250/20"
                            >
                              Lưu phân quyền thư mục
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* PUBLIC DIRECTORIES PERMISSION VIEW */
                        <div className="space-y-4">
                          <p className="text-xs text-gray-500">
                            💡 Tích chọn các thư mục công khai (public) mà giáo viên này có quyền quản trị cao nhất (thêm, sửa, xóa, duyệt giáo án).
                          </p>
                          <div className="border border-gray-200 bg-gray-50/50 rounded-2xl p-4 overflow-y-auto max-h-[350px]">
                            {(() => {
                              const publicDirs = directories.filter(d => d.is_public);
                              const rootPublicDirs = publicDirs.filter(d => !d.parent || !publicDirs.some(p => p.id === d.parent));
                              if (rootPublicDirs.length === 0) {
                                return <p className="text-sm text-gray-405 italic p-2">Hệ thống chưa có thư mục public nào.</p>;
                              }
                              return (
                                <div className="space-y-0.5 text-gray-700">
                                  {rootPublicDirs.map((dir: Directory) => (
                                    <PermissionDirTreeNode
                                      key={dir.id}
                                      dir={dir}
                                      directories={directories}
                                      selectedIds={selectedUserDirIds}
                                      onToggle={(id, descendants, checked) => {
                                        const allIds = [id, ...descendants];
                                        if (checked) {
                                          setSelectedUserDirIds(prev => Array.from(new Set([...prev, ...allIds])));
                                        } else {
                                          setSelectedUserDirIds(prev => prev.filter(x => !allIds.includes(x)));
                                        }
                                      }}
                                      depth={0}
                                      allLessonPlans={unfilteredLessons}
                                      onFileClick={setSelectedLessonForDetail}
                                    />
                                  ))}
                                </div>
                              );
                            })()}
                          </div>

                          <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
                            <button
                              onClick={handleSaveUserPermissions}
                              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-purple-250/20"
                            >
                              Lưu phân quyền thư mục
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* EMPTY CHOSEN USER WORKSPACE */
              <div className="flex-grow flex flex-col items-center justify-center text-center p-8 border border-dashed border-gray-300 rounded-3xl bg-white shadow-sm">
                <div className="text-6xl mb-4 text-purple-300">👥</div>
                <h4 className="font-black text-gray-800 text-base">Trung tâm Quản trị Tài khoản</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-sm">
                  Chọn một người dùng từ danh sách bên trái hoặc nhấn nút "Thêm mới" để bắt đầu thao tác quản trị viên.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="w-full px-6">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center gap-2 cursor-pointer" onClick={() => { setCurrentView('home'); setSelectedDirs([]); setHomeTab('library'); }}>
                <div className="bg-blue-600 rounded text-white p-1 font-bold text-xl leading-none">📚</div>
                <span className="font-bold text-xl text-gray-900 hidden sm:block">Hệ thống quản lý tri thức</span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-grow max-w-3xl mx-8 relative">
              <form onSubmit={handleSearch} className="flex-grow flex items-center pr-1 shadow-sm rounded-full bg-gray-50 border border-gray-200 overflow-hidden">
                <div className="pl-4 text-gray-400">🔍</div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPersonalSearchQuery(e.target.value);
                  }}
                  className="w-full bg-transparent focus:outline-none text-sm text-gray-700 placeholder-gray-550 py-2 px-2"
                  placeholder={
                    homeTab === 'library'
                      ? "Tìm kiếm tên bài, nội dung giáo án..."
                      : homeTab === 'personal'
                        ? "Tìm kiếm tài liệu cá nhân..."
                        : "Tìm kiếm trong lịch sử đóng góp..."
                  }
                />

                {/* Integrated Filter Icon Trigger */}
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
                  className={`p-2 rounded-full transition-all mr-1.5 flex items-center justify-center ${showAdvancedFilter || selectedTietDay.length > 0 || selectedSubjects.length > 0
                      ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200/50'
                    }`}
                  title="Bộ lọc nâng cao"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path>
                  </svg>
                </button>

                <button type="submit" className="px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors mr-0.5 shadow-sm">
                  Tìm
                </button>
              </form>

              {/* Popover Dropdown Panel */}
              {showAdvancedFilter && (
                <div className="absolute right-0 top-full mt-2 w-[420px] bg-white rounded-2xl border border-gray-200 shadow-xl p-5 z-40 animate-in fade-in slide-in-from-top-3 duration-250 max-h-[80vh] overflow-y-auto pr-3">
                  <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
                    <h4 className="font-extrabold text-sm text-gray-900">🎛️ Bộ lọc nâng cao</h4>
                    <button
                      onClick={() => {
                        setSelectedTietDay([]);
                        setSelectedSubjects([]);
                        setSelectedTracks([]);
                        setSelectedTopics([]);
                        setSelectedBiologies([]);
                        setSelectedLocations([]);
                        setSelectedTargetStudents([]);
                        setAdvancedBiologySearch('');
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-bold"
                    >
                      Xóa bộ lọc
                    </button>
                  </div>

                  {/* Filter by Duration / Tiết dạy */}
                  <div className="mb-4">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Số tiết học (Tiết dạy)</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['1 tiết', '2 tiết', '3 tiết'].map(tiet => {
                        const isSelected = selectedTietDay.includes(tiet);
                        return (
                          <button
                            key={tiet}
                            type="button"
                            onClick={() => {
                              setSelectedTietDay(prev =>
                                prev.includes(tiet) ? prev.filter(p => p !== tiet) : [...prev, tiet]
                              );
                            }}
                            className={`py-1.5 px-2 rounded-lg text-xs font-semibold border text-center transition-all ${isSelected
                                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                              }`}
                          >
                            {tiet}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Filter by Location inside Popover */}
                  <div className="mb-4">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">📍 Địa điểm (Nơi học / Thực hành)</label>
                    <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin">
                      {LOCATIONS.map(loc => {
                        const isSelected = selectedLocations.includes(loc);
                        return (
                          <button
                            key={loc}
                            type="button"
                            onClick={() => {
                              setSelectedLocations(prev =>
                                prev.includes(loc) ? prev.filter(p => p !== loc) : [...prev, loc]
                              );
                            }}
                            className={`py-1.5 px-3 rounded-xl text-left text-xs font-semibold border transition-all truncate flex-shrink-0 ${isSelected
                                ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold shadow-sm'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                              }`}
                            title={loc}
                          >
                            📍 {loc}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Filter by Track */}
                  <div className="mb-4">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">🗺️ Mạch kiến thức</label>
                    <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin">
                      {KNOWLEDGE_TRACKS.map(track => {
                        const isSelected = selectedTracks.includes(track);
                        return (
                          <button
                            key={track}
                            type="button"
                            onClick={() => {
                              setSelectedTracks(prev =>
                                prev.includes(track) ? prev.filter(p => p !== track) : [...prev, track]
                              );
                            }}
                            className={`py-1.5 px-3 rounded-xl text-left text-xs font-semibold border transition-all truncate flex-shrink-0 ${isSelected
                                ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold shadow-sm'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                              }`}
                            title={track}
                          >
                            🗺️ {track}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Filter by Topic */}
                  <div className="mb-4">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">📌 Chủ đề con gợi ý</label>
                    <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin">
                      {availableTopics.map(topic => {
                        const isSelected = selectedTopics.includes(topic);
                        return (
                          <button
                            key={topic}
                            type="button"
                            onClick={() => {
                              setSelectedTopics(prev =>
                                prev.includes(topic) ? prev.filter(p => p !== topic) : [...prev, topic]
                              );
                            }}
                            className={`py-1.5 px-3 rounded-xl text-left text-xs font-semibold border transition-all truncate flex-shrink-0 ${isSelected
                                ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold shadow-sm'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                              }`}
                            title={topic}
                          >
                            📌 {topic}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Filter by Biology Connection */}
                  <div className="mb-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">🧬 Kiến thức sinh học liên quan</label>
                    <input
                      type="text"
                      value={advancedBiologySearch}
                      onChange={e => setAdvancedBiologySearch(e.target.value)}
                      placeholder="Tìm kiến thức sinh học..."
                      className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                    />
                    <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin animate-in fade-in duration-200">
                      {BIOLOGY_CONNECTIONS.filter(b => b.toLowerCase().includes(advancedBiologySearch.toLowerCase())).map(bio => {
                        const isSelected = selectedBiologies.includes(bio);
                        return (
                          <button
                            key={bio}
                            type="button"
                            onClick={() => {
                              setSelectedBiologies(prev =>
                                prev.includes(bio) ? prev.filter(x => x !== bio) : [...prev, bio]
                              );
                            }}
                            className={`py-1.5 px-2.5 rounded-lg text-left text-xs transition-all border break-words flex-shrink-0 ${isSelected
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-semibold shadow-sm'
                                : 'bg-white border-gray-150 text-gray-600 hover:bg-gray-50'
                              }`}
                          >
                            🧬 {bio}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center">
              {currentUser ? (
                <div className="flex items-center gap-4">
                  <div className="flex gap-2 mr-4">

                    {currentUser.role === 'ADMIN' && (
                      <button
                        onClick={() => { setCurrentView('admin'); fetchAdminUsers(); }}
                        className={`px-3 py-1.5 text-white rounded-md text-sm font-semibold transition-all flex items-center gap-1.5 shadow-sm ${currentView === 'admin' ? 'bg-purple-800 ring-2 ring-purple-300' : 'bg-purple-600 hover:bg-purple-700'
                          }`}
                      >
                        <span>👥</span> Quản lý người dùng
                      </button>
                    )}
                    {(currentUser.role === 'ADMIN' || currentUser.role === 'TEACHER') && (
                      <button
                        onClick={() => setShowApprovalModal(true)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-sm relative"
                      >
                        <span>🛡️</span> Xét duyệt bài giảng
                        {pendingApprovals.length > 0 && (
                          <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1">
                            {pendingApprovals.length}
                          </span>
                        )}
                      </button>
                    )}
                    <button onClick={() => { setUploadMode('public'); setCurrentView('upload'); }} className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-md text-sm font-semibold transition-colors flex items-center gap-1">
                      <span>+</span> Đăng bài giảng
                    </button>
                  </div>
                  <div
                    onClick={() => setShowProfileModal(true)}
                    className="flex items-center gap-2 cursor-pointer hover:bg-blue-50/80 border border-transparent hover:border-blue-100 p-1.5 px-3 rounded-2xl transition-all select-none group relative"
                    title="Chỉnh sửa thông tin cá nhân"
                  >
                    <div className="w-8 h-8 rounded-full border border-blue-100 overflow-hidden bg-blue-50 flex items-center justify-center text-xs font-black text-blue-600 group-hover:border-blue-200 transition-colors">
                      {currentUser.avatar_url ? (
                        <img src={currentUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        (currentUser.full_name || currentUser.username).charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex flex-col items-start justify-center">
                      <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 flex items-center justify-center gap-1 w-full relative pr-4">
                        <span>{currentUser.full_name || currentUser.username}</span>
                        <svg className="w-3.5 h-3.5 hidden group-hover:block text-blue-500 absolute right-0 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                        </svg>
                      </div>
                      <div className="text-[10px] text-gray-500 font-medium w-full text-left">
                        {currentUser.role === 'ADMIN' ? (
                          <span className="text-red-600 font-bold">Admin</span>
                        ) : currentUser.role === 'TEACHER' ? (
                          <span className="text-blue-600 font-bold">Giáo viên</span>
                        ) : (
                          <span className="text-gray-500 font-medium">Người dùng thường</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={handleLogout} className="ml-2 px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-colors">
                    Thoát
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowAuthModal(true)} className="px-5 py-2 flex items-center gap-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                  <span className="text-lg leading-none">→]</span> Đăng nhập
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="flex flex-grow max-w-[1600px] w-full mx-auto overflow-hidden">
        {/* Left Sidebar - Filters & Tree */}
        {homeTab === 'library' && (
          <div className="w-[300px] bg-white border-r border-gray-200 p-6 overflow-y-auto flex-shrink-0 hidden md:block">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Bộ lọc</h2>

            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wider">Cây thư mục bài giảng</h3>
              <div className="text-sm max-h-[45vh] overflow-y-auto pr-1 scrollbar-thin">
                <div
                  className={`flex items-center gap-2 cursor-pointer py-1.5 px-2 rounded-md transition-colors mb-1 ${selectedDirs.length === 0 ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
                  onClick={() => setSelectedDirs([])}
                >
                  <span className="w-4"></span>
                  <span className="text-gray-400">🏠</span>
                  <span className="flex-grow">Tất cả tài liệu</span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{allLessonPlans.filter(l => l.status === 'PUBLISHED').length}</span>
                </div>
                {rootDirs.map(dir => (
                  <DirectoryNode
                    key={dir.id}
                    dir={dir}
                    directories={directories}
                    selectedDirs={selectedDirs}
                    onToggleDir={handleToggleDir}
                    allLessons={allLessonPlans.filter(l => l.status === 'PUBLISHED')}
                    currentUser={currentUser}
                    onAddChild={handleAddChildDir}
                    onDelete={handleDeleteDir}
                    onRename={handleRenameDir}
                    onTogglePublic={handleTogglePublicDir}
                    onFileClick={setSelectedLessonForDetail}
                    depth={0}
                  />
                ))}
              </div>
              {currentUser && (
                <button
                  onClick={() => { setDirParentId(''); setDirName(''); setDirAttrs('{}'); setDirIsPublic(false); setShowDirModal(true); }}
                  className="mt-3 w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors border border-dashed border-gray-300"
                >
                  <span className="text-base leading-none">+</span>
                  <span>Thêm thư mục gốc</span>
                </button>
              )}
            </div>

            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wider">Lọc theo Đối tượng</h3>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" className="rounded border-gray-300" checked={selectedTargetStudents.includes('Học sinh thành thị')} onChange={e => handleFilterChange(setSelectedTargetStudents, 'Học sinh thành thị', e.target.checked)} /> Học sinh thành thị</label>
                <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" className="rounded border-gray-300" checked={selectedTargetStudents.includes('Học sinh nông thôn')} onChange={e => handleFilterChange(setSelectedTargetStudents, 'Học sinh nông thôn', e.target.checked)} /> Học sinh nông thôn</label>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wider">Lọc theo Lớp học</h3>
              <div className="flex flex-col gap-2">
                {['Lớp 10', 'Lớp 11', 'Lớp 12'].map(cls => (
                  <label key={cls} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedClasses.includes(cls)}
                      onChange={e => handleFilterChange(setSelectedClasses, cls, e.target.checked)}
                    />
                    {cls}
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wider">Lọc theo Loại hình</h3>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" className="rounded border-gray-300" checked={selectedTypes.includes('Thực hành')} onChange={e => handleFilterChange(setSelectedTypes, 'Thực hành', e.target.checked)} /> Thực hành</label>
                <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" className="rounded border-gray-300" checked={selectedTypes.includes('Lý thuyết')} onChange={e => handleFilterChange(setSelectedTypes, 'Lý thuyết', e.target.checked)} /> Lý thuyết</label>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wider">Lọc theo Địa điểm</h3>
              <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-2 scrollbar-thin">
                {LOCATIONS.map(loc => (
                  <label key={loc} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedLocations.includes(loc)}
                      onChange={e => handleFilterChange(setSelectedLocations, loc, e.target.checked)}
                    />
                    {loc}
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wider">Lọc theo Kiến thức</h3>
              {availableSubjects.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Không có môn học nào trong mục này.</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-2">
                  {availableSubjects.map(subj => (
                    <label key={subj} className="flex items-center gap-2 text-sm text-gray-600">
                      <input type="checkbox" className="rounded border-gray-300" checked={selectedSubjects.includes(subj)} onChange={e => handleFilterChange(setSelectedSubjects, subj, e.target.checked)} /> {subj}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-grow overflow-y-auto bg-gray-50/50 flex flex-col">

          {/* ── Tab Selector (Segmented Pill Container) ── */}
          <div className="px-6 md:px-8 pt-6 pb-3">
            <div className="inline-flex p-1.5 bg-gray-200/60 backdrop-blur-md rounded-2xl border border-gray-300/40 shadow-sm">
              <button
                id="tab-library"
                onClick={() => setHomeTab('library')}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 ${homeTab === 'library'
                    ? 'bg-white text-blue-700 shadow-sm border border-gray-200/50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
                  }`}
              >
                <span>📚</span> Thư viện chung
              </button>
              {currentUser && (
                <>
                  <button
                    id="tab-personal"
                    onClick={() => setHomeTab('personal')}
                    className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 relative ml-1 ${homeTab === 'personal'
                        ? 'bg-white text-sky-700 shadow-sm border border-gray-200/50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
                      }`}
                  >
                    <span>💾</span> Thư viện cá nhân
                    {allLessonPlans.filter(l => l.creator?.id === currentUser.id && (l.status === 'LOCAL')).length > 0 && (
                      <span className="ml-1 text-[10px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full font-bold">
                        {allLessonPlans.filter(l => l.creator?.id === currentUser.id && l.status === 'LOCAL').length}
                      </span>
                    )}
                  </button>
                  <button
                    id="tab-history"
                    onClick={() => setHomeTab('history')}
                    className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 relative ml-1 ${homeTab === 'history'
                        ? 'bg-white text-emerald-700 shadow-sm border border-gray-200/50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
                      }`}
                  >
                    <span>📋</span> Lịch sử đóng góp
                    {allLessonPlans.filter(l => l.creator?.id === currentUser.id && l.status !== 'LOCAL').length > 0 && (
                      <span className="ml-1 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">
                        {allLessonPlans.filter(l => l.creator?.id === currentUser.id && l.status !== 'LOCAL').length}
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Tab Content ── */}
          <div className="flex-grow p-6 md:p-8 border-t border-gray-100 bg-white rounded-t-3xl shadow-sm">

            {/* ══ LIBRARY TAB ══ */}
            {homeTab === 'library' && (
              <>
                <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50/60 border border-slate-100 p-4 rounded-2xl shadow-sm">
                  <div>
                    <p className="text-sm text-gray-600 font-semibold">
                      🔍 Tìm thấy <span className="text-blue-600 font-extrabold">{filteredLessonPlans.length}</span> tài liệu
                      {selectedDirs.length > 0 && <span className="ml-1 text-slate-500 font-normal">(trong {selectedDirs.length} thư mục đã chọn)</span>}
                    </p>
                    {filteredLessonPlans.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Hiển thị từ {((currentPage - 1) * pageSize) + 1} đến {Math.min(currentPage * pageSize, filteredLessonPlans.length)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Sort Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sắp xếp:</span>
                      <select
                        value={sortBy}
                        onChange={e => { setSortBy(e.target.value); setCurrentPage(1); }}
                        className="text-xs font-semibold bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-slate-50 cursor-pointer"
                      >
                        {debouncedSearchQuery.trim() && (
                          <option value="relevance">🎯 Mức độ tương đồng (Relevance)</option>
                        )}
                        <option value="date_desc">📅 Mới nhất (Ngày tải)</option>
                        <option value="date_asc">📅 Cũ nhất (Ngày tải)</option>
                        <option value="rating_desc">⭐ Đánh giá cao nhất</option>
                        <option value="rating_asc">⭐ Đánh giá thấp nhất</option>
                        <option value="total_desc">💬 Nhiều đánh giá nhất</option>
                        <option value="total_asc">💬 Ít đánh giá nhất</option>
                      </select>
                    </div>

                    {/* Page Size Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Hiển thị:</span>
                      <select
                        value={pageSize}
                        onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                        className="text-xs font-semibold bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-slate-50 cursor-pointer"
                      >
                        <option value={10}>10 tài liệu / trang</option>
                        <option value={15}>15 tài liệu / trang</option>
                        <option value={20}>20 tài liệu / trang</option>
                      </select>
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="flex justify-center py-20"><div className="text-blue-600 animate-pulse font-medium">Đang tải dữ liệu...</div></div>
                ) : error ? (
                  <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
                ) : filteredLessonPlans.length === 0 ? (
                  <div className="text-center py-20 text-gray-500 bg-gray-50 rounded-xl border border-gray-200">Không có tài liệu nào trong mục này.</div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {paginatedLessonPlans.map((lesson) => (
                      <div
                        key={lesson.id}
                        onClick={() => setSelectedLessonForDetail(lesson)}
                        className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer relative group"
                      >
                        <div className="flex justify-between items-start gap-4 mb-3">
                          <h3 className="text-lg font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">{lesson.title}</h3>
                          <span className="text-xs font-semibold text-blue-500 whitespace-nowrap bg-blue-50 px-2.5 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">Xem chi tiết ↗</span>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-4">
                          <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-md flex items-center gap-1">📖 {lesson.target_student || 'Giáo án'}</span>
                          {lesson.status === 'PUBLISHED' ? (
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-medium rounded-md">👥 Công khai</span>
                          ) : lesson.status === 'PENDING' ? (
                            <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-100 text-xs font-medium rounded-md animate-pulse">⏳ Chờ duyệt</span>
                          ) : lesson.status === 'REJECTED' ? (
                            <span className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-100 text-xs font-medium rounded-md">❌ Bị từ chối</span>
                          ) : (
                            <span className="px-2 py-1 bg-sky-50 text-sky-700 border border-sky-100 text-xs font-medium rounded-md">📄 Cá nhân</span>
                          )}
                          {/* Rating & Total Comments Badge */}
                          {(lesson.total_ratings > 0 || (lesson.average_rating && lesson.average_rating > 0)) ? (
                            <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold rounded-md flex items-center gap-1">
                              ⭐ {Number(lesson.average_rating || 0).toFixed(1)} ({lesson.total_ratings} đánh giá)
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-slate-50 text-slate-400 border border-slate-200 text-xs font-medium rounded-md flex items-center gap-1">
                              ⭐ Chưa có đánh giá
                            </span>
                          )}
                          {/* Directory full path breadcrumb badge (Deepest/Leaf paths only to avoid parent redundancy) */}
                          {lesson.directory_ids && lesson.directory_ids.length > 0 ? (
                            (() => {
                              const leafDirIds = lesson.directory_ids.filter(dirId => {
                                const hasChildInList = lesson.directory_ids.some(otherId => {
                                  if (otherId === dirId) return false;
                                  const otherDir = directories.find(d => d.id === otherId);
                                  return otherDir && otherDir.parent === dirId;
                                });
                                return !hasChildInList;
                              });
                              return leafDirIds.map((dirId, i) => (
                                <span key={i} className="px-2 py-1 bg-violet-50 text-violet-700 border border-violet-100 text-xs font-medium rounded-md flex items-center gap-1 max-w-[250px] truncate" title={getDirectoryFullPath(dirId, directories)}>
                                  📂 {getDirectoryFullPath(dirId, directories)}
                                </span>
                              ));
                            })()
                          ) : (
                            <span className="px-2 py-1 bg-gray-50 text-gray-400 border border-gray-100 text-xs font-medium rounded-md">📄 Không có thư mục</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-4 line-clamp-3 flex-grow">{lesson.description || 'Chưa có mô tả.'}</p>
                        {debouncedSearchQuery.trim() && renderSnippet(lesson.content_preview, debouncedSearchQuery)}
                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50 text-xs text-gray-400">
                          <div className="flex items-center gap-2">
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                if (lesson.creator) {
                                  setSelectedCreatorForProfile(lesson.creator);
                                }
                              }}
                              className="font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1 bg-blue-50 px-2.5 py-0.5 rounded transition-all"
                              title="Nhấn xem thông tin người đăng"
                            >
                              👤 {lesson.creator?.full_name || lesson.creator?.username || 'Ẩn danh'}
                            </span>
                            <span>•</span>
                            <span>{new Date(lesson.created_at).toLocaleDateString('vi-VN')}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            {useAiRag && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFocusLessonIdForChat(lesson.id);
                                  setChatbotOpenTrigger(prev => prev + 1);
                                }}
                                className="text-blue-600 hover:text-blue-700 font-extrabold flex items-center gap-1 transition-all px-2.5 py-1 bg-blue-50 hover:bg-blue-100 rounded-xl text-[11px] border border-blue-100 shadow-sm shadow-blue-50/50 hover:scale-105 active:scale-95 duration-100"
                                title="Hỏi Trợ lý AI về bài học này"
                              >
                                ✨ Hỏi AI
                              </button>
                            )}
                            {lesson.file_path || lesson.file_url ? (
                              <a
                                href={getLessonFileUrl(lesson)}
                                download={getFileName(lesson.file_url || lesson.file_path)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 transition-colors"
                              >
                                ↓ Tải tài liệu
                              </a>
                            ) : (
                              <span className="text-gray-300">Không có file</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pagination Controls */}
                {filteredLessonPlans.length > pageSize && (
                  <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-6">
                    <div className="flex-1 flex justify-between sm:hidden">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className={`relative inline-flex items-center px-4 py-2 border border-gray-200 text-sm font-semibold rounded-xl bg-white text-gray-700 hover:bg-gray-50 transition-colors ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                      >
                        Trước
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredLessonPlans.length / pageSize)))}
                        disabled={currentPage === Math.ceil(filteredLessonPlans.length / pageSize)}
                        className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-200 text-sm font-semibold rounded-xl bg-white text-gray-700 hover:bg-gray-50 transition-colors ${currentPage === Math.ceil(filteredLessonPlans.length / pageSize) ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                      >
                        Sau
                      </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-500 font-medium">
                          Trang <span className="font-extrabold text-gray-800">{currentPage}</span> /{' '}
                          <span className="font-extrabold text-gray-800">
                            {Math.ceil(filteredLessonPlans.length / pageSize)}
                          </span>{' '}
                          (Tổng <span className="font-extrabold text-gray-800">{filteredLessonPlans.length}</span> tài liệu)
                        </p>
                      </div>
                      <div>
                        <nav className="relative z-0 inline-flex rounded-xl shadow-sm -space-x-px" aria-label="Pagination">
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className={`relative inline-flex items-center px-3 py-2 rounded-l-xl border border-gray-200 bg-white text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-all ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                          >
                            <span>◀</span>
                          </button>

                          {/* Render page numbers */}
                          {(() => {
                            const totalPages = Math.ceil(filteredLessonPlans.length / pageSize);
                            const pageNumbers = [];
                            for (let i = 1; i <= totalPages; i++) {
                              if (totalPages > 7) {
                                if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
                                  pageNumbers.push(i);
                                } else if (i === currentPage - 3 || i === currentPage + 3) {
                                  pageNumbers.push('...');
                                }
                              } else {
                                pageNumbers.push(i);
                              }
                            }
                            const cleanPages = pageNumbers.filter((v, idx, arr) => v !== '...' || arr[idx - 1] !== '...');

                            return cleanPages.map((pageNum, idx) => {
                              if (pageNum === '...') {
                                return (
                                  <span key={`ellipsis-${idx}`} className="relative inline-flex items-center px-4 py-2 border border-gray-200 bg-white text-sm font-semibold text-gray-400 select-none">
                                    ...
                                  </span>
                                );
                              }
                              return (
                                <button
                                  key={`page-${pageNum}`}
                                  onClick={() => setCurrentPage(Number(pageNum))}
                                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-bold transition-all ${currentPage === pageNum
                                      ? 'z-10 bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100'
                                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600'
                                    }`}
                                >
                                  {pageNum}
                                </button>
                              );
                            });
                          })()}

                          <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredLessonPlans.length / pageSize)))}
                            disabled={currentPage === Math.ceil(filteredLessonPlans.length / pageSize)}
                            className={`relative inline-flex items-center px-3 py-2 rounded-r-xl border border-gray-200 bg-white text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-all ${currentPage === Math.ceil(filteredLessonPlans.length / pageSize) ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                          >
                            <span>▶</span>
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ══ HISTORY TAB ══ */}
            {homeTab === 'history' && currentUser && (() => {
              const myLessons = allLessonPlans
                .filter(l => l.creator?.id === currentUser.id && l.status !== 'LOCAL')
                .filter(l => {
                  const q = debouncedSearchQuery.trim().toLowerCase();
                  if (!q) return true;
                  const qClean = removeAccents(q);
                  const title = (l.title || '').toLowerCase();
                  const desc = (l.description || '').toLowerCase();
                  const content = (l.content_preview || '').toLowerCase();
                  return (
                    title.includes(q) || desc.includes(q) || content.includes(q) ||
                    removeAccents(title).includes(qClean) || removeAccents(desc).includes(qClean) || removeAccents(content).includes(qClean)
                  );
                })
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              return (
                <div>
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Lịch sử đóng góp của tôi</h2>
                      <p className="text-sm text-gray-500 mt-1">Tất cả bài giảng bạn đã đăng tải lên hệ thống</p>
                    </div>
                    <span className="text-sm bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1.5 rounded-full font-semibold">
                      {myLessons.length} bài giảng
                    </span>
                  </div>

                  {myLessons.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                      <div className="text-5xl mb-4">📭</div>
                      <p className="text-gray-500 font-medium">Bạn chưa đăng bài giảng nào.</p>
                      <button onClick={() => setCurrentView('upload')} className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
                        + Đăng bài giảng đầu tiên
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {myLessons.map(lesson => (
                        <div key={lesson.id} className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${lesson.status === 'REJECTED' ? 'border-rose-200 bg-rose-50/20' :
                            lesson.status === 'PENDING' ? 'border-amber-200 bg-amber-50/20' :
                              lesson.status === 'PUBLISHED' ? 'border-emerald-200' : 'border-gray-200'
                          }`}>
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex-grow min-w-0">
                              <h3 className="font-bold text-gray-900 text-base leading-snug">{lesson.title}</h3>
                              <p className="text-xs text-gray-500 mt-1">📅 {new Date(lesson.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            <div className="flex-shrink-0">
                              {lesson.status === 'PUBLISHED' && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">✅ Đã duyệt & xuất bản</span>
                              )}
                              {lesson.status === 'PENDING' && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 border border-amber-200 rounded-full text-xs font-bold animate-pulse">⏳ Đang chờ duyệt</span>
                              )}
                              {lesson.status === 'REJECTED' && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-100 text-rose-700 border border-rose-200 rounded-full text-xs font-bold">❌ Bị từ chối</span>
                              )}
                            </div>
                          </div>

                          {/* Description */}
                          {lesson.description && (
                            <p className="text-sm text-gray-600 line-clamp-2 mb-3">{lesson.description}</p>
                          )}

                          {debouncedSearchQuery.trim() && renderSnippet(lesson.content_preview, debouncedSearchQuery)}

                          {/* Rejection Feedback Box */}
                          {lesson.status === 'REJECTED' && lesson.latest_feedback && (
                            <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                              <p className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-1">💬 Lý do từ chối:</p>
                              <p className="text-sm text-rose-800 leading-relaxed">{lesson.latest_feedback}</p>
                            </div>
                          )}

                          {/* Action Row */}
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 flex-wrap">
                            <button
                              onClick={() => setSelectedLessonForDetail(lesson)}
                              className="px-4 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors"
                            >
                              ↗ Xem chi tiết
                            </button>
                            {useAiRag && (
                              <button
                                onClick={() => {
                                  setFocusLessonIdForChat(lesson.id);
                                  setChatbotOpenTrigger(prev => prev + 1);
                                }}
                                className="px-4 py-1.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-lg text-xs font-bold hover:bg-violet-100 transition-colors flex items-center gap-1 hover:scale-105 active:scale-95 duration-100"
                                title="Hỏi Trợ lý AI về bài học này"
                              >
                                ✨ Hỏi AI
                              </button>
                            )}
                            {/* Resubmit button for rejected lessons */}
                            {lesson.status === 'REJECTED' && (
                              <button
                                onClick={() => openEditModal(lesson)}
                                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm shadow-amber-200"
                              >
                                ✏ Sửa & Gửi duyệt lại
                              </button>
                            )}
                            {/* Edit for non-rejected */}
                            {lesson.status !== 'REJECTED' && (
                              <button
                                onClick={() => openEditModal(lesson)}
                                className="px-4 py-1.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg text-xs font-semibold hover:bg-yellow-100 transition-colors"
                              >
                                ✏ Chỉnh sửa
                              </button>
                            )}
                            {/* PUBLISHED: Retract to personal (remove from public) */}
                            {lesson.status === 'PUBLISHED' && (
                              <button
                                onClick={() => handleWithdrawLesson(lesson.id, 'retract')}
                                title="Thu hồi về thư viện cá nhân — bài sẽ biến mất khỏi thư viện chung"
                                className="px-4 py-1.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-lg text-xs font-semibold hover:bg-violet-100 transition-colors flex items-center gap-1"
                              >
                                ↓ Thu hồi về cá nhân
                              </button>
                            )}
                            {/* PENDING: Cancel submission */}
                            {lesson.status === 'PENDING' && (
                              <button
                                onClick={() => handleWithdrawLesson(lesson.id, 'retract')}
                                title="Hủy gửi duyệt, đưa về thư viện cá nhân"
                                className="px-4 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-xs font-semibold hover:bg-orange-100 transition-colors flex items-center gap-1"
                              >
                                ↩ Hủy chờ duyệt
                              </button>
                            )}

                            {/* Delete permanently — all statuses */}
                            <button
                              onClick={() => handleWithdrawLesson(lesson.id, 'delete')}
                              className="px-4 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors ml-auto"
                            >
                              🗑 Xóa
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
            {/* ══ PERSONAL LIBRARY TAB ══ */}
            {homeTab === 'personal' && currentUser && (() => {
              const personalRootDirs = directories.filter(d => !d.is_public && !d.parent && d.user === currentUser.id);

              // Filter personal lessons
              // 1. Must be created by current user
              // 2. If LOCAL, or belongs to a personal directory
              const myPersonalLessons = allLessonPlans.filter(l => {
                if (l.creator?.id !== currentUser.id) return false;
                if (l.status === 'LOCAL') return true;
                const hasPersonalDir = l.directory_ids?.some(dirId => {
                  const dObj = directories.find(d => d.id === dirId);
                  return dObj && !dObj.is_public && dObj.user === currentUser.id;
                });
                return hasPersonalDir;
              });

              // Filter by selected personal directories
              const dirFilteredPersonalLessons = selectedPersonalDirs.length === 0
                ? myPersonalLessons
                : myPersonalLessons.filter(l =>
                  l.directory_ids?.some(dirId => selectedPersonalDirs.includes(dirId))
                );

              // Apply search query filter
              const searchedPersonalLessons = (() => {
                const q = personalSearchQuery.trim().toLowerCase();
                if (!q) return dirFilteredPersonalLessons;
                const qClean = removeAccents(q);
                return dirFilteredPersonalLessons.filter(l => {
                  const title = (l.title || '').toLowerCase();
                  const desc = (l.description || '').toLowerCase();
                  const content = (l.content_preview || '').toLowerCase();
                  return (
                    title.includes(q) || desc.includes(q) || content.includes(q) ||
                    removeAccents(title).includes(qClean) || removeAccents(desc).includes(qClean) || removeAccents(content).includes(qClean)
                  );
                });
              })();

              // Apply sort
              const sortedPersonalLessons = (() => {
                const list = [...searchedPersonalLessons];
                list.sort((a, b) => {
                  if (personalSortBy === 'date_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                  if (personalSortBy === 'date_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                  if (personalSortBy === 'title_asc') return (a.title || '').localeCompare(b.title || '', 'vi');
                  if (personalSortBy === 'title_desc') return (b.title || '').localeCompare(a.title || '', 'vi');
                  return 0;
                });
                return list;
              })();

              return (
                <div className="flex flex-col lg:flex-row gap-6 min-h-[500px]">
                  {/* Left: Personal Folder Tree */}
                  <div className="w-full lg:w-[260px] border-r border-gray-100 lg:pr-6 flex-shrink-0">
                    <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider font-bold">Cây thư mục cá nhân</h3>
                    <div className="text-sm mt-2 max-h-[45vh] overflow-y-auto pr-1 scrollbar-thin">
                      <div
                        className={`flex items-center gap-2 cursor-pointer py-1.5 px-2 rounded-md transition-colors mb-1 ${selectedPersonalDirs.length === 0 ? 'bg-sky-50 text-sky-700 font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
                        onClick={() => setSelectedPersonalDirs([])}
                      >
                        <span className="w-4"></span>
                        <span className="text-sky-500">📁</span>
                        <span className="flex-grow truncate">Tất cả tài liệu cá nhân</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{myPersonalLessons.length}</span>
                      </div>

                      {personalRootDirs.map(dir => (
                        <DirectoryNode
                          key={dir.id}
                          dir={dir}
                          directories={directories}
                          selectedDirs={selectedPersonalDirs}
                          onToggleDir={(id: number) => {
                            setSelectedPersonalDirs(prev => prev.includes(id) ? prev.filter(d => d !== id) : [id]);
                          }}
                          allLessons={allLessonPlans}
                          currentUser={currentUser}
                          onAddChild={handleAddChildDir}
                          onDelete={handleDeleteDir}
                          onRename={handleRenameDir}
                          onTogglePublic={handleTogglePublicDir}
                          onFileClick={setSelectedLessonForDetail}
                          depth={0}
                        />
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        setDirParentId('');
                        setDirName('');
                        setDirAttrs('{}');
                        setDirIsPublic(false); // Force private for personal folder
                        setShowDirModal(true);
                      }}
                      className="mt-3 w-full flex items-center justify-center gap-2 px-2 py-1.5 rounded-md text-xs text-sky-600 hover:bg-sky-50 transition-colors border border-dashed border-sky-300 font-bold"
                    >
                      <span>+ Thêm thư mục cá nhân gốc</span>
                    </button>
                  </div>

                  {/* Right: Personal Lessons list */}
                  <div className="flex-grow min-w-0">
                    {/* Header: title + count + add button with inline sort */}
                    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">Thư viện cá nhân</h2>
                        <p className="text-sm text-gray-500 mt-1">Tài liệu riêng tư và thư mục cá nhân của bạn.</p>
                      </div>
                      <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
                        {/* Sort Selector */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Sắp xếp:</span>
                          <select
                            value={personalSortBy}
                            onChange={e => setPersonalSortBy(e.target.value)}
                            className="text-xs font-bold bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all hover:bg-slate-50 cursor-pointer"
                          >
                            <option value="date_desc">📅 Mới nhất</option>
                            <option value="date_asc">📅 Cũ nhất</option>
                            <option value="title_asc">🔤 Tên A→Z</option>
                            <option value="title_desc">🔤 Tên Z→A</option>
                          </select>
                        </div>

                        <span className="text-xs bg-sky-50 text-sky-700 border border-sky-100 px-3 py-2 rounded-xl font-bold whitespace-nowrap">{sortedPersonalLessons.length} tài liệu</span>
                        <button
                          onClick={() => {
                            setUploadMode('personal');
                            if (selectedPersonalDirs.length > 0) {
                              setUpDirId(selectedPersonalDirs[0].toString());
                            } else {
                              setUpDirId('');
                            }
                            setCurrentView('upload');
                          }}
                          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors whitespace-nowrap shadow-sm hover:shadow"
                        >
                          + Thêm mới
                        </button>
                      </div>
                    </div>

                    {/* Result info line */}
                    {personalSearchQuery && (
                      <p className="text-xs text-gray-500 mb-3 font-medium">
                        🔍 Tìm thấy <span className="text-sky-600 font-bold">{sortedPersonalLessons.length}</span> tài liệu{selectedPersonalDirs.length > 0 && <span className="text-slate-400"> (trong thư mục đã chọn)</span>}
                      </p>
                    )}

                    {sortedPersonalLessons.length === 0 ? (
                      <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <div className="text-5xl mb-4">💾</div>
                        <p className="text-gray-500 font-medium">{personalSearchQuery ? 'Không tìm thấy tài liệu phù hợp.' : 'Không tìm thấy tài liệu nào.'}</p>
                        <p className="text-sm text-gray-400 mt-1">{personalSearchQuery ? 'Thử từ khóa khác hoặc xóa bộ lọc.' : 'Hãy tải tệp lên hoặc tạo thư mục cá nhân để bắt đầu quản lý.'}</p>
                        {!personalSearchQuery && (
                          <button
                            onClick={() => {
                              setUploadMode('personal');
                              if (selectedPersonalDirs.length > 0) {
                                setUpDirId(selectedPersonalDirs[0].toString());
                              } else {
                                setUpDirId('');
                              }
                              setCurrentView('upload');
                            }}
                            className="mt-4 px-5 py-2 bg-sky-600 text-white rounded-xl text-sm font-semibold hover:bg-sky-700"
                          >
                            + Tải tài liệu lên
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {sortedPersonalLessons.map(lesson => (
                          <div
                            key={lesson.id}
                            onClick={() => setSelectedLessonForDetail(lesson)}
                            className="bg-white rounded-2xl border border-sky-100/60 p-5 shadow-sm hover:shadow-md hover:border-sky-300 transition-all cursor-pointer flex flex-col relative group"
                          >
                            {/* Card Header: Title + hover badge */}
                            <div className="flex justify-between items-start gap-3 mb-3">
                              <h3 className="text-base font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-sky-700 transition-colors flex-grow">{lesson.title}</h3>
                              <span className="text-xs font-semibold text-sky-500 whitespace-nowrap bg-sky-50 px-2.5 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">Xem chi tiết ↗</span>
                            </div>

                            {/* Badges row */}
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {/* Target Student */}
                              {lesson.target_student && (
                                <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-md flex items-center gap-1">📖 {lesson.target_student}</span>
                              )}
                              {/* Status Badge */}
                              {lesson.status === 'LOCAL' ? (
                                <span className="px-2 py-1 bg-sky-50 text-sky-700 border border-sky-100 text-xs font-medium rounded-md">💾 Cá nhân</span>
                              ) : lesson.status === 'PENDING' ? (
                                <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-100 text-xs font-medium rounded-md animate-pulse">⏳ Chờ duyệt</span>
                              ) : lesson.status === 'REJECTED' ? (
                                <span className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-100 text-xs font-medium rounded-md">❌ Bị từ chối</span>
                              ) : (
                                <span className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-medium rounded-md">👥 Công khai</span>
                              )}
                              {/* Rating & Total Comments Badge */}
                              {(lesson.total_ratings > 0 || (lesson.average_rating && lesson.average_rating > 0)) ? (
                                <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold rounded-md flex items-center gap-1">
                                  ⭐ {Number(lesson.average_rating || 0).toFixed(1)} ({lesson.total_ratings} đánh giá)
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-slate-50 text-slate-400 border border-slate-200 text-xs font-medium rounded-md flex items-center gap-1">
                                  ⭐ Chưa có đánh giá
                                </span>
                              )}
                              {/* Directory path badges (Deepest/Leaf paths only to avoid parent redundancy) */}
                              {lesson.directory_ids && lesson.directory_ids.length > 0 ? (
                                (() => {
                                  const leafDirIds = lesson.directory_ids.filter(dirId => {
                                    const hasChildInList = lesson.directory_ids.some(otherId => {
                                      if (otherId === dirId) return false;
                                      const otherDir = directories.find(d => d.id === otherId);
                                      return otherDir && otherDir.parent === dirId;
                                    });
                                    return !hasChildInList;
                                  });
                                  return leafDirIds.map((dirId, i) => (
                                    <span key={i} className="px-2 py-1 bg-violet-50 text-violet-700 border border-violet-100 text-xs font-medium rounded-md flex items-center gap-1 max-w-[220px] truncate" title={getDirectoryFullPath(dirId, directories)}>
                                      📂 {getDirectoryFullPath(dirId, directories)}
                                    </span>
                                  ));
                                })()
                              ) : (
                                <span className="px-2 py-1 bg-gray-50 text-gray-400 border border-gray-100 text-xs font-medium rounded-md">📄 Chưa phân thư mục</span>
                              )}
                            </div>

                            {/* Description */}
                            <p className="text-sm text-gray-600 mb-3 line-clamp-3 flex-grow">{lesson.description || 'Chưa có mô tả.'}</p>

                            {debouncedSearchQuery.trim() && renderSnippet(lesson.content_preview, debouncedSearchQuery)}

                            {/* Rejection feedback */}
                            {lesson.latest_feedback && (
                              <div className="mb-3 p-2 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-700">
                                <strong>💬 Phản hồi duyệt:</strong> {lesson.latest_feedback}
                              </div>
                            )}

                            {/* Footer: date + download */}
                            <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50 text-xs text-gray-400">
                              <div className="flex items-center gap-2">
                                <span>📅 {new Date(lesson.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                {useAiRag && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFocusLessonIdForChat(lesson.id);
                                      setChatbotOpenTrigger(prev => prev + 1);
                                    }}
                                    className="text-blue-600 hover:text-blue-700 font-extrabold flex items-center gap-1 transition-all px-2.5 py-1 bg-blue-50 hover:bg-blue-100 rounded-xl text-[11px] border border-blue-100 shadow-sm shadow-blue-50/50 hover:scale-105 active:scale-95 duration-100"
                                    title="Hỏi Trợ lý AI về bài học này"
                                  >
                                    ✨ Hỏi AI
                                  </button>
                                )}
                                {lesson.file_path || lesson.file_url ? (
                                  <a
                                    href={getLessonFileUrl(lesson)}
                                    download={getFileName(lesson.file_url || lesson.file_path)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 transition-colors"
                                  >
                                    ↓ Tải tài liệu
                                  </a>
                                ) : (
                                  <span className="text-gray-300">Không có file</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      </div>

      {/* Modals from before */}
      {/* Auth Modal */}
      {showAuthModal && !currentUser && (
        <div className="fixed z-50 inset-0 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100 transition-all duration-300">
            {/* Upper brand styling */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 text-center text-white">
              <span className="text-3xl block mb-2">🔐</span>
              <h3 className="text-lg font-bold">Xác thực hệ thống KMS</h3>
              <p className="text-xs text-blue-100/80 mt-1">Cổng đăng nhập và quản lý tài khoản</p>
            </div>
            
            <div className="p-6">
              {authError && (
                <div className={`mb-4 p-3 rounded-xl text-sm ${authError.includes('thành công') ? 'bg-green-50 text-green-800 border border-green-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
                  {authError}
                </div>
              )}
              
              <div className="space-y-4">
                {/* Dynamic Auth Forms based on authMode */}
                <div>
                  {authMode === 'LOGIN' && (
                    <form className="space-y-4" onSubmit={handleLogin}>
                      {/* Local Login Form Fields */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Tên đăng nhập</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-xs">👤</span>
                          <input 
                            type="text" 
                            required 
                            value={username} 
                            onChange={e => setUsername(e.target.value)} 
                            className="w-full border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-slate-50/50 hover:bg-slate-50 transition-all font-medium text-slate-800"
                            placeholder="Tên đăng nhập của bạn..."
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Mật khẩu</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-xs">🔒</span>
                          <input 
                            type={showPassword ? "text" : "password"} 
                            required 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            className="w-full border border-slate-200 rounded-xl py-2 pl-9 pr-10 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-slate-50/50 hover:bg-slate-50 transition-all font-medium text-slate-800"
                            placeholder="Mật khẩu của bạn..."
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            {showPassword ? "👁️" : "🙈"}
                          </button>
                        </div>
                      </div>
                      
                      <div className="pt-2 space-y-4">
                        <button 
                          type="submit" 
                          className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 py-2.5 text-white text-xs font-bold shadow-md shadow-blue-500/10 transition-all duration-150 transform active:scale-[0.98]"
                        >
                          Đăng nhập
                        </button>
                        
                        <div className="flex justify-between items-center text-[11px] font-bold text-blue-600 border-t border-slate-100 pt-3.5">
                          <button type="button" onClick={() => { setAuthMode('REGISTER'); setAuthError(null); }} className="hover:text-blue-800 transition-colors">Đăng ký mới</button>
                          <button type="button" onClick={() => { setAuthMode('FIND_ACCOUNT'); setAuthError(null); setFoundAccount(null); setIdentity(''); }} className="hover:text-blue-800 transition-colors">Tìm tài khoản</button>
                          <button type="button" onClick={() => { setAuthMode('FORGOT_PASSWORD'); setAuthError(null); setResetResult(null); setIdentity(''); }} className="text-rose-600 hover:text-rose-800 transition-colors">Quên mật khẩu?</button>
                        </div>
                      </div>

                      {/* Keycloak Mock/Demo option for developers (Discreetly at the bottom) */}
                      <div className="pt-2 border-t border-slate-50">
                        <button
                          type="button"
                          onClick={() => {
                            setShowKeycloakMockModal(true);
                            setShowAuthModal(false);
                          }}
                          className="w-full text-center text-[9px] font-semibold text-slate-400 hover:text-slate-500 transition-colors"
                        >
                          🧪 Chạy Giả lập Keycloak Offline
                        </button>
                      </div>
                    </form>
                  )}

                  {authMode === 'REGISTER' && (
                    <form className="space-y-3.5" onSubmit={handleRegister}>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Họ và tên</label>
                        <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full border border-gray-200 rounded-lg py-2 px-3 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" placeholder="Nguyễn Văn A" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Email</label>
                        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-gray-200 rounded-lg py-2 px-3 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" placeholder="email@school.edu.vn" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Tên đăng nhập</label>
                        <input type="text" required value={username} onChange={e => setUsername(e.target.value)} className="w-full border border-gray-200 rounded-lg py-2 px-3 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" placeholder="Username đăng nhập..." />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Mật khẩu</label>
                        <div className="relative">
                          <input 
                            type={showRegisterPassword ? "text" : "password"} 
                            required 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            className="w-full border border-gray-200 rounded-lg py-2 pl-3 pr-10 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" 
                            placeholder="Mật khẩu tài khoản..." 
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            {showRegisterPassword ? "👁️" : "🙈"}
                          </button>
                        </div>
                      </div>
                      <div className="pt-2 space-y-2">
                        <button type="submit" className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 py-2.5 text-white text-xs font-semibold shadow-md transition-all">Tạo tài khoản mới</button>
                        <button type="button" onClick={() => { setAuthMode('LOGIN'); setAuthError(null); }} className="w-full text-blue-600 text-xs font-semibold hover:underline text-center">Đã có tài khoản? Đăng nhập</button>
                      </div>
                    </form>
                  )}

                  {authMode === 'FIND_ACCOUNT' && (
                    <form className="space-y-3.5" onSubmit={handleFindAccount}>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Tên đăng nhập, Email hoặc SĐT</label>
                        <input type="text" required value={identity} onChange={e => setIdentity(e.target.value)} className="w-full border border-gray-200 rounded-lg py-2 px-3 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" placeholder="Nhập username, email hoặc SĐT..." />
                      </div>
                      {foundAccount && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-[11px] text-emerald-800 space-y-1">
                          <p className="font-bold text-xs border-b border-emerald-200 pb-1 mb-1">🔍 Kết quả tìm kiếm:</p>
                          <p><strong>Họ tên:</strong> {foundAccount.full_name || 'N/A'}</p>
                          <p><strong>Username:</strong> {foundAccount.username}</p>
                          {foundAccount.email_masked && <p><strong>Email:</strong> {foundAccount.email_masked}</p>}
                          {foundAccount.phone_masked && <p><strong>SĐT:</strong> {foundAccount.phone_masked}</p>}
                          <p><strong>Vai trò:</strong> {foundAccount.role}</p>
                          <p><strong>Trạng thái:</strong> {foundAccount.is_active ? '🔓 Hoạt động' : '🔒 Đã khóa'}</p>
                        </div>
                      )}
                      <div className="pt-2 space-y-2">
                        <button type="submit" className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 py-2.5 text-white text-xs font-semibold shadow-md transition-all">Tìm kiếm tài khoản</button>
                        <button type="button" onClick={() => { setAuthMode('LOGIN'); setAuthError(null); setFoundAccount(null); }} className="w-full text-blue-600 text-xs font-semibold hover:underline text-center">Quay lại Đăng nhập</button>
                      </div>
                    </form>
                  )}

                  {authMode === 'FORGOT_PASSWORD' && (
                    <div className="space-y-3.5">
                      {!resetResult ? (
                        <form className="space-y-3.5" onSubmit={handleForgotPassword}>
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Tên đăng nhập, Email hoặc SĐT</label>
                            <input 
                              type="text" 
                              required 
                              value={identity} 
                              onChange={e => setIdentity(e.target.value)} 
                              className="w-full border border-gray-200 rounded-lg py-2 px-3 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" 
                              placeholder="Nhập username, email hoặc SĐT..." 
                            />
                          </div>
                          <div className="pt-2 space-y-2">
                            <button type="submit" className="w-full rounded-lg bg-rose-600 hover:bg-rose-700 py-2.5 text-white text-xs font-semibold shadow-md transition-all">Gửi mã OTP</button>
                            <button type="button" onClick={() => { setAuthMode('LOGIN'); setAuthError(null); setResetResult(null); }} className="w-full text-blue-600 text-xs font-semibold hover:underline text-center">Quay lại Đăng nhập</button>
                          </div>
                        </form>
                      ) : (
                        <form className="space-y-3.5" onSubmit={handleVerifyOTP}>
                          <div className="bg-blue-50 border border-blue-150 rounded-xl p-3 text-[11px] text-blue-800 space-y-1">
                            <p className="font-bold text-xs border-b border-blue-200 pb-1">✨ {resetResult.message}</p>
                            <p className="leading-relaxed">{resetResult.details}</p>
                            {otpCountdown > 0 ? (
                              <p className="text-[11px] font-extrabold text-blue-700 flex items-center gap-1.5 pt-1.5 mt-1 border-t border-blue-200/50">
                                ⏱️ Mã OTP có hiệu lực trong: <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded font-mono font-bold text-xs">{formatCountdown(otpCountdown)}</span>
                              </p>
                            ) : (
                              <p className="text-[11px] font-extrabold text-rose-700 flex items-center gap-1.5 pt-1.5 mt-1 border-t border-rose-200/50">
                                ⚠️ Mã OTP đã hết hạn! Vui lòng nhấn gửi lại mã mới.
                              </p>
                            )}
                            {(() => {
                              // Log simulated OTP to browser console for developer convenience, hidden from UI
                              if (resetResult.simulation && resetResult.simulation.otp_code) {
                                console.log("\n=======================================================");
                                console.log(`[DEV-SIMULATION] Mã OTP của user ${resetResult.simulation.username} là: ${resetResult.simulation.otp_code}`);
                                console.log("=======================================================\n");
                              }
                              return null;
                            })()}
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Mã xác thực OTP</label>
                            <input 
                              type="text" 
                              required 
                              maxLength={6}
                              autoComplete="one-time-code"
                              value={otpCode} 
                              onChange={e => setOtpCode(e.target.value)} 
                              disabled={otpCountdown <= 0}
                              className="w-full border border-gray-200 rounded-lg py-2 px-3 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-mono text-center tracking-widest text-lg disabled:bg-gray-100 disabled:text-gray-400" 
                              placeholder="------" 
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Mật khẩu mới</label>
                            <div className="relative">
                              <input 
                                type={showOtpNewPassword ? "text" : "password"} 
                                required 
                                autoComplete="new-password"
                                value={otpNewPassword} 
                                onChange={e => setOtpNewPassword(e.target.value)} 
                                disabled={otpCountdown <= 0}
                                className="w-full border border-gray-200 rounded-lg py-2 pl-3 pr-10 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white disabled:bg-gray-100 disabled:text-gray-400" 
                                placeholder="Nhập mật khẩu mới..." 
                              />
                              <button
                                type="button"
                                onClick={() => setShowOtpNewPassword(!showOtpNewPassword)}
                                disabled={otpCountdown <= 0}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
                              >
                                {showOtpNewPassword ? "👁️" : "🙈"}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Xác nhận mật khẩu mới</label>
                            <div className="relative">
                              <input 
                                type={showOtpConfirmPassword ? "text" : "password"} 
                                required 
                                autoComplete="new-password"
                                value={otpConfirmPassword} 
                                onChange={e => setOtpConfirmPassword(e.target.value)} 
                                disabled={otpCountdown <= 0}
                                className="w-full border border-gray-200 rounded-lg py-2 pl-3 pr-10 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white disabled:bg-gray-100 disabled:text-gray-400" 
                                placeholder="Nhập lại mật khẩu mới..." 
                              />
                              <button
                                type="button"
                                onClick={() => setShowOtpConfirmPassword(!showOtpConfirmPassword)}
                                disabled={otpCountdown <= 0}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
                              >
                                {showOtpConfirmPassword ? "👁️" : "🙈"}
                              </button>
                            </div>
                          </div>

                          <div className="pt-2 space-y-2">
                            <button 
                              type="submit" 
                              disabled={otpCountdown <= 0}
                              className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2.5 text-white text-xs font-semibold shadow-md transition-all disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                            >
                              Xác nhận & Đổi mật khẩu
                            </button>
                            <button type="button" onClick={() => { setResetResult(null); setOtpCode(''); setAuthError(null); setOtpCountdown(0); }} className="w-full text-slate-500 text-xs font-semibold hover:underline text-center">Gửi lại mã OTP khác</button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <button type="button" onClick={() => { setShowAuthModal(false); }} className="w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors py-1">Đóng</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keycloak Mock Portal Modal */}
      {showKeycloakMockModal && (
        <div className="fixed z-[100] inset-0 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-slate-950 text-slate-100 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-800 transition-all duration-300">
            {/* Header branding */}
            <div className="bg-gradient-to-r from-blue-800 via-indigo-900 to-slate-900 p-6 text-center relative">
              <div className="absolute top-4 right-4">
                <button
                  type="button"
                  onClick={() => setShowKeycloakMockModal(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="w-16 h-16 bg-blue-600/30 border border-blue-500/50 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/20">
                <span className="text-3xl">🔐</span>
              </div>
              <h3 className="text-xl font-extrabold tracking-tight text-white">
                Keycloak Identity Server
              </h3>
              <p className="text-xs text-slate-300 mt-1 font-mono">
                Unified SSO Portal • Simulation Mode
              </p>
            </div>

            {/* Form */}
            <form className="p-6 space-y-4" onSubmit={handleKeycloakMockLogin}>
              <div className="bg-blue-950/40 border border-blue-800/30 p-3 rounded-lg text-xs text-blue-300">
                💡 <strong>Trình mô phỏng SSO:</strong> Bạn có thể tự chọn thông tin tài khoản và vai trò để mô phỏng quá trình xác thực & đồng bộ tức thì vào CSDL.
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Tên đăng nhập (Username)
                </label>
                <input
                  type="text"
                  required
                  value={kcUsername}
                  onChange={(e) => setKcUsername(e.target.value)}
                  placeholder="Ví dụ: gv_nguyenvana"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Họ và tên
                </label>
                <input
                  type="text"
                  required
                  value={kcFullName}
                  onChange={(e) => setKcFullName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Email nhà trường
                </label>
                <input
                  type="email"
                  required
                  value={kcEmail}
                  onChange={(e) => setKcEmail(e.target.value)}
                  placeholder="nguyenvana@school.edu.vn"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Vai trò hệ thống (SSO Claims Mapping)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'TEACHER', label: '👨‍🏫 Giáo viên', color: 'border-amber-500 text-amber-400 bg-amber-500/10' },
                    { id: 'ADMIN', label: '⚡ Quản trị', color: 'border-red-500 text-red-400 bg-red-500/10' },
                    { id: 'USER', label: '👤 Người dùng', color: 'border-blue-500 text-blue-400 bg-blue-500/10' }
                  ].map((roleOption) => (
                    <button
                      key={roleOption.id}
                      type="button"
                      onClick={() => setKcRole(roleOption.id as any)}
                      className={`py-2 px-1 text-xs font-medium rounded-lg border text-center transition-all ${
                        kcRole === roleOption.id
                          ? `${roleOption.color} ring-2 ring-offset-2 ring-offset-slate-950 ring-blue-500`
                          : 'border-slate-800 text-slate-400 bg-slate-900/50 hover:bg-slate-900 hover:text-slate-200'
                      }`}
                    >
                      {roleOption.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowKeycloakMockModal(false)}
                  className="w-1/3 py-2.5 rounded-lg border border-slate-800 text-xs font-medium text-slate-300 hover:bg-slate-900 hover:text-white transition-all"
                >
                  Quay lại
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transform hover:scale-[1.01] transition-all"
                >
                  Xác thực & Kết nối
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dir Modal */}
      {showDirModal && currentUser && (
        <div className="fixed z-50 inset-0 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Tạo Thư Mục Mới</h3>
            <form onSubmit={handleCreateDir} className="space-y-4">
              <div><label className="block text-sm mb-1">Tên thư mục</label><input type="text" required value={dirName} onChange={e => setDirName(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
              <div>
                <label className="block text-sm mb-1">Thư mục cha</label>
                <select value={dirParentId} onChange={e => setDirParentId(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-mono">
                  <option value="">-- Cấp cao nhất --</option>
                  {getDirectoriesAsTreeOptions(directories).map(d => (
                    <option key={d.id} value={d.id}>
                      {d.visualPrefix}{d.name} {d.is_public ? '👥' : '🔒'}
                    </option>
                  ))}
                </select>
              </div>
              {currentUser.role === 'ADMIN' && (
                <div className="flex items-center gap-2 bg-red-50 p-3 rounded-lg border border-red-100">
                  <input type="checkbox" checked={dirIsPublic} onChange={e => setDirIsPublic(e.target.checked)} id="isPub" className="rounded text-red-600 focus:ring-red-500" />
                  <label htmlFor="isPub" className="text-sm font-medium text-red-700">Thư mục dùng chung (Public)</label>
                </div>
              )}
              <div className="flex gap-2 justify-end mt-6">
                <button type="button" onClick={() => setShowDirModal(false)} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Tạo mới</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && currentUser && (
        <div className="fixed z-50 inset-0 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Tải lên Bài Giảng (Lưu Cục Bộ)</h3>
            <form onSubmit={handleUpload} className="space-y-4">
              <div><label className="block text-sm mb-1">Tên bài giảng</label><input type="text" required value={upTitle} onChange={e => setUpTitle(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
              <div><label className="block text-sm mb-1">Mô tả</label><textarea value={upDesc} onChange={e => setUpDesc(e.target.value)} className="w-full border rounded-lg p-2 text-sm h-20" /></div>
              <div><label className="block text-sm mb-1">Khối lớp / Đối tượng</label><input type="text" value={upGrade} onChange={e => setUpGrade(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
              <div>
                <label className="block text-sm mb-1">Lưu vào thư mục</label>
                <select value={upDirId} onChange={e => setUpDirId(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-mono">
                  <option value="">-- Không chọn --</option>
                  {getDirectoriesAsTreeOptions(directories).map(d => (
                    <option key={d.id} value={d.id}>
                      {d.visualPrefix}{d.name} {d.is_public ? '👥' : '🔒'}
                    </option>
                  ))}
                </select>
              </div>
              <div><label className="block text-sm mb-1">File tài liệu (.docx, .pdf)</label><input type="file" required onChange={e => e.target.files && setUpFile(e.target.files[0])} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" /></div>

              <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowUploadModal(false)} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Tải lên</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Propose Modal */}
      {showProposeModal && lessonToPropose && currentUser && (
        <div className="fixed z-50 inset-0 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">🌐 Đề xuất công khai giáo án</h3>
            <p className="text-sm text-gray-500 mb-4">
              Bạn đang đề xuất công khai tài liệu <strong>"{lessonToPropose.title}"</strong> lên thư viện chung của cộng đồng.
            </p>

            {proposeError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col gap-3 shadow-sm">
                <div className="flex items-start gap-2.5">
                  <span className="text-red-500 mt-0.5 text-base">⚠️</span>
                  <div className="text-xs text-red-700 font-medium leading-relaxed">
                    {proposeError}
                  </div>
                </div>
                {proposeDuplicateId && (
                  <div className="flex gap-2 justify-end mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProposeModal(false);
                        const lessonId = proposeDuplicateId;
                        setLessonToPropose(null);
                        setProposeError(null);
                        setProposeDuplicateId(null);

                        const existing = lessonPlans.find(l => l.id === lessonId);
                        if (existing) {
                          setCurrentView('home');
                          setSelectedLessonForDetail(existing);
                        } else {
                          axios.get(`/api/lesson-plans/${lessonId}/?user_id=${currentUser?.id}`)
                            .then(res => {
                              setCurrentView('home');
                              setSelectedLessonForDetail(res.data);
                            })
                            .catch(err => {
                              console.error("Lỗi khi tải tài liệu trùng lặp:", err);
                              alert("Không thể tải thông tin chi tiết của tài liệu trùng lặp.");
                            });
                        }
                      }}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1"
                    >
                      🔍 Xem tài liệu đã có
                    </button>
                  </div>
                )}
              </div>
            )}

            {!proposeDuplicateId ? (
              <form onSubmit={handleProposePublic} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Chọn thư mục công khai muốn đưa tài liệu vào:
                  </label>
                  <select
                    required
                    value={targetPublicDirId}
                    onChange={e => setTargetPublicDirId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm font-mono focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Chọn thư mục công khai --</option>
                    {getDirectoriesAsTreeOptions(directories, d => d.is_public).map(d => (
                      <option key={d.id} value={d.id}>
                        {d.visualPrefix}{d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => { setShowProposeModal(false); setLessonToPropose(null); }}
                    className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={!targetPublicDirId}
                    className="px-4 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    Gửi đề xuất
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex justify-end mt-6 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { setShowProposeModal(false); setLessonToPropose(null); setProposeError(null); setProposeDuplicateId(null); }}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-750 rounded-lg text-sm font-bold shadow-sm transition-colors"
                >
                  Đóng cửa sổ
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lesson Detail Modal (Xem chi tiết) */}
      {selectedLessonForDetail && (
        <div className="fixed z-50 inset-0 w-screen h-screen bg-slate-900/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white w-screen h-screen flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 flex-shrink-0 bg-white">
              <div className="flex-grow mr-4">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wider border border-blue-100/50">
                    Chi tiết bài giảng
                  </span>
                  {!isInlineEditingDetail ? (
                    selectedLessonForDetail.directory_ids && selectedLessonForDetail.directory_ids.length > 0 && (
                      <span className="text-xs font-semibold text-gray-400 truncate max-w-xs sm:max-w-md block" title={getDirectoryFullPath(selectedLessonForDetail.directory_ids[0], directories)}>
                        / {getDirectoryFullPath(selectedLessonForDetail.directory_ids[0], directories)}
                      </span>
                    )
                  ) : (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-bold text-slate-400">Thư mục:</span>
                      <select
                        value={editDirId}
                        onChange={e => setEditDirId(e.target.value)}
                        className="text-xs font-semibold bg-blue-50/50 border border-blue-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="">-- Chưa phân thư mục --</option>
                        {(() => {
                          const isPublicLesson = selectedLessonForDetail.status === 'PUBLISHED' || (() => {
                            if (selectedLessonForDetail.directory_ids && selectedLessonForDetail.directory_ids.length > 0) {
                              const firstDir = directories.find(d => d.id === selectedLessonForDetail.directory_ids![0]);
                              return firstDir ? firstDir.is_public : false;
                            }
                            return false;
                          })();

                          if (isPublicLesson) {
                            return getDirectoriesAsTreeOptions(directories, d => d.is_public).map(d => (
                              <option key={d.id} value={d.id}>
                                {d.visualPrefix}{d.name} 👥
                              </option>
                            ));
                          } else {
                            return getDirectoriesAsTreeOptions(
                              directories,
                              d => !d.is_public && (currentUser?.role === 'ADMIN' ? true : d.user === currentUser?.id)
                            ).map(d => (
                              <option key={d.id} value={d.id}>
                                {d.visualPrefix}{d.name} 🔒
                              </option>
                            ));
                          }
                        })()}
                      </select>
                      {(() => {
                        if (!editDirId) return null;
                        const targetDir = directories.find(d => d.id.toString() === editDirId);
                        if (targetDir && targetDir.is_public && currentUser && currentUser.role !== 'ADMIN' && targetDir.user !== currentUser.id) {
                          return (
                            <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200" title="Bạn không có quyền quản trị trực tiếp thư mục công khai này. Hành động chuyển thư mục sẽ đưa tài liệu về trạng thái Chờ duyệt.">
                              ⚠️ Cần duyệt
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}
                </div>
                {!isInlineEditingDetail ? (
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{selectedLessonForDetail.title}</h2>
                ) : (
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="w-full border border-blue-300 rounded-xl px-3 py-1.5 text-base sm:text-lg font-bold text-gray-900 leading-tight focus:ring-2 focus:ring-blue-500 bg-blue-50/10 mt-1 shadow-inner focus:outline-none"
                    placeholder="Tên bài giảng..."
                  />
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedLessonForDetail.status !== 'LOCAL' && (
                  <button
                    type="button"
                    onClick={() => setShowComments(!showComments)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 shadow-sm ${
                      showComments 
                        ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' 
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                    title={showComments ? "Ẩn danh mục nhận xét & đánh giá" : "Hiện danh mục nhận xét & đánh giá"}
                  >
                    💬 {showComments ? "Ẩn bình luận" : "Hiện bình luận"}
                  </button>
                )}
                {docHistoryStack.length > 0 && (
                  <button
                    onClick={handleGoBackDoc}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95"
                    title="Quay lại tài liệu trước"
                  >
                    <span className="text-[14px]">←</span>
                    <span>Quay lại ({docHistoryStack.length})</span>
                  </button>
                )}
                <button
                  onClick={() => { setSelectedLessonForDetail(null); setLessonRatings([]); setMyRating(0); setMyComment(''); }}
                  className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors flex items-center justify-center"
                  title="Đóng cửa sổ"
                >
                  <span className="text-xl">✕</span>
                </button>
              </div>
            </div>

            {/* Split Content */}
            <div className="flex-grow flex flex-col lg:flex-row overflow-hidden min-h-0 bg-slate-50/20">
              {/* Left Column - Lesson & Info */}
              <div className={`w-full flex flex-col h-full overflow-y-auto p-6 scrollbar-thin ${
                (selectedLessonForDetail.status === 'LOCAL' || !showComments)
                  ? 'lg:w-full'
                  : 'lg:w-[60%] border-b lg:border-b-0 lg:border-r border-gray-200/80'
              }`}>
                {/* Creator and general info banner */}
                <div className="bg-white border border-gray-150 rounded-2xl p-5 mb-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg font-bold shadow-md shadow-blue-500/10">
                      {(selectedLessonForDetail.creator?.full_name || selectedLessonForDetail.creator?.username || 'A')[0].toUpperCase()}
                    </div>
                    <div>
                      <span className="block text-xs text-gray-400 font-medium">Người đăng tải</span>
                      <span
                        onClick={() => {
                          if (selectedLessonForDetail.creator) {
                            setSelectedCreatorForProfile(selectedLessonForDetail.creator);
                          }
                        }}
                        className="font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                        title="Xem thông tin người đăng"
                      >
                        {selectedLessonForDetail.creator?.full_name || selectedLessonForDetail.creator?.username || 'Không xác định'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="bg-slate-100 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                      <span>📅</span>
                      <span className="font-semibold text-gray-700">{new Date(selectedLessonForDetail.created_at).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>
                </div>

                {/* Storage Path Location Info */}
                <div className="mb-6 bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <span>💾</span> Vị trí tài liệu trong cây thư mục
                    </span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 border border-slate-300/60 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                      Cây Thư Mục
                    </span>
                  </div>
                  <div className="font-mono text-xs bg-white border border-slate-150 p-3 rounded-xl break-all text-slate-600 flex items-center gap-2 select-all shadow-inner leading-relaxed">
                    <span className="text-emerald-500 flex-shrink-0 font-bold font-sans select-none">📁 PATH:</span>
                    {(() => {
                      const hasDir = isInlineEditingDetail
                        ? !!editDirId
                        : (selectedLessonForDetail.directory_ids && selectedLessonForDetail.directory_ids.length > 0);
                      const currentDirId = isInlineEditingDetail
                        ? editDirId
                        : (selectedLessonForDetail.directory_ids ? selectedLessonForDetail.directory_ids[0] : '');
                      const dirPath = hasDir ? getDirectoryFullPath(currentDirId, directories) : 'Thư mục gốc (Root)';
                      const fileName = editFile
                        ? editFile.name
                        : (getFileName(selectedLessonForDetail.file_url || selectedLessonForDetail.file_path) || 'Chưa đính kèm tệp tin');
                      return `${dirPath} / ${fileName}`;
                    })()}
                  </div>
                </div>

                {/* Description */}
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tóm tắt / Mô tả</h4>
                  {!isInlineEditingDetail ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 text-gray-600 leading-relaxed text-sm shadow-sm">
                      {selectedLessonForDetail.description || 'Tài liệu này hiện chưa có mô tả chi tiết trong cơ sở dữ liệu.'}
                    </div>
                  ) : (
                    <textarea
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      className="w-full border border-blue-300 rounded-2xl p-5 text-gray-750 leading-relaxed text-sm focus:ring-2 focus:ring-blue-500 bg-blue-50/10 h-28 focus:outline-none shadow-inner resize-none"
                      placeholder="Nhập mô tả / tóm tắt chi tiết của tài liệu..."
                    />
                  )}
                </div>

                {/* Key Metadata Cards */}
                <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                    <div className="text-2xl">🎓</div>
                    <div className="w-full">
                      <span className="block text-[11px] text-gray-400 font-bold uppercase">Đối tượng / Lớp</span>
                      {!isInlineEditingDetail ? (
                        <span className="font-bold text-gray-800 text-sm">{selectedLessonForDetail.target_student || 'Chung'}</span>
                      ) : (
                        <input
                          type="text"
                          value={editGrade}
                          onChange={e => setEditGrade(e.target.value)}
                          className="border border-blue-300 rounded-lg px-2.5 py-1 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 bg-blue-50/10 w-full mt-1 focus:outline-none"
                          placeholder="Lớp..."
                        />
                      )}
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                    <div className="text-2xl">🌍</div>
                    <div>
                      <span className="block text-[11px] text-gray-400 font-bold uppercase">Trạng thái phát hành</span>
                      <span className={`font-extrabold text-sm flex items-center gap-1 ${selectedLessonForDetail.status === 'PUBLISHED' ? 'text-green-600' :
                          selectedLessonForDetail.status === 'PENDING' ? 'text-amber-600 animate-pulse' :
                            selectedLessonForDetail.status === 'REJECTED' ? 'text-red-600' : 'text-sky-600'
                        }`}>
                        {selectedLessonForDetail.status === 'PUBLISHED' ? 'Đã xuất bản (Public)' :
                          selectedLessonForDetail.status === 'PENDING' ? 'Chờ phê duyệt' :
                            selectedLessonForDetail.status === 'REJECTED' ? 'Bị từ chối' : 'Nội bộ (Local)'}
                      </span>
                    </div>
                  </div>
                  {isInlineEditingDetail && (
                    <div className="bg-white border border-blue-200 rounded-2xl p-4 shadow-sm flex items-center gap-3 animate-in fade-in duration-200">
                      <div className="text-2xl">📍</div>
                      <div className="w-full">
                        <span className="block text-[11px] text-gray-400 font-bold uppercase">Địa điểm / Phòng TB</span>
                        <select
                          value={editLocation}
                          onChange={e => setEditLocation(e.target.value)}
                          className="w-full border border-blue-300 rounded-lg px-2 py-1 text-xs font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 bg-blue-50/10 mt-1 focus:outline-none"
                        >
                          <option value="">-- Địa điểm --</option>
                          {LOCATIONS.map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {isInlineEditingDetail && (
                  <div className="mb-6 bg-amber-50/40 border border-amber-200 rounded-2xl p-5 shadow-sm animate-in fade-in duration-200">
                    <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <span>📂</span> Thay thế tài liệu đính kèm
                    </h4>
                    <p className="text-[11px] text-amber-600 mb-3 leading-normal">
                      Bỏ trống nếu muốn giữ nguyên tệp tin cũ. Bạn có thể chọn file .docx, .md, hoặc .txt mới.
                    </p>
                    <input
                      type="file"
                      onChange={e => e.target.files && setEditFile(e.target.files[0])}
                      className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200 transition-all cursor-pointer bg-white border border-amber-200/60 p-2 rounded-xl shadow-inner"
                    />
                    {editFile && (
                      <p className="text-xs text-emerald-600 font-bold mt-2 flex items-center gap-1">
                        <span>✓</span> Chuẩn bị tải lên: <span className="underline break-all">{editFile.name}</span> ({Math.round(editFile.size / 1024)} KB)
                      </p>
                    )}
                  </div>
                )}

                {/* Additional attributes */}
                {selectedLessonForDetail.attributes && Object.keys(selectedLessonForDetail.attributes).filter(k => k !== 'tien_trinh_day_hoc' && k !== 'knowledge_tags').length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Thông tin bổ sung</h4>
                    <div className="flex flex-wrap gap-2 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                      {Object.entries(selectedLessonForDetail.attributes)
                        .filter(([key]) => key !== 'tien_trinh_day_hoc' && key !== 'knowledge_tags')
                        .map(([key, val]) => (
                          <span key={key} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-sm font-semibold border border-blue-100/50">
                            {key}: {String(val)}
                          </span>
                        ))
                      }
                    </div>
                  </div>
                )}
                {/* Render activities timeline if exists */}
                <LessonActivitiesTimeline activities={selectedLessonForDetail.attributes?.tien_trinh_day_hoc} />

                {/* Modern Workspace Navigation Grid instead of inline viewing */}
                <div className="mb-6 mt-2">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tri thức & Tài liệu bài dạy</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Interactive Mindmap Workspace Button */}
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 border border-indigo-100 hover:border-indigo-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2.5 mb-2">
                          <span className="text-2xl group-hover:scale-110 transition-transform duration-250">🧠</span>
                          <h5 className="font-extrabold text-slate-800 text-sm">Sơ đồ tư duy</h5>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
                          Sơ đồ tư duy dạng cây phân tích mục tiêu kiến thức, năng lực, phẩm chất, tiến trình dạy học. Hỗ trợ kéo thả, phóng thu & xem nhanh nghiệp vụ sư phạm.
                        </p>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => setIsMindmapFullScreen(true)}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-extrabold rounded-xl shadow-sm shadow-indigo-100 hover:shadow-indigo-200 transition-all flex items-center justify-center gap-1.5"
                      >
                        🖥️ Khám phá toàn màn hình
                      </button>
                    </div>

                    {/* Full Document Workspace Button */}
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-100 hover:border-emerald-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2.5 mb-2">
                          <span className="text-2xl group-hover:scale-110 transition-transform duration-250">📄</span>
                          <h5 className="font-extrabold text-slate-800 text-sm">Tài liệu giáo án chi tiết</h5>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
                          Trình đọc tài liệu chuẩn cao cấp. Hỗ trợ đọc bản trích xuất Markdown tinh gọn, xem file Word gốc (.docx) offline hoặc tài liệu PDF trực tuyến.
                        </p>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => setIsDocumentFullScreen(true)}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-extrabold rounded-xl shadow-sm shadow-emerald-100 hover:shadow-emerald-200 transition-all flex items-center justify-center gap-1.5"
                      >
                        📖 Xem tài liệu toàn màn hình
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Ratings & Comments */}
              {selectedLessonForDetail.status !== 'LOCAL' && showComments && (
                <div className="w-full lg:w-[40%] flex flex-col h-full bg-slate-50/50 overflow-y-auto p-6 scrollbar-thin">
                  {/* Rating Summary Card & Stats */}
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50/20 border border-amber-100/60 rounded-2xl p-5 mb-6 shadow-sm">
                    <div className="flex items-center gap-6 mb-4">
                      <div className="text-center bg-white border border-amber-200/60 rounded-2xl px-5 py-4 shadow-sm flex-shrink-0">
                        <div className="text-4xl font-black text-amber-500">{ratingAvg > 0 ? ratingAvg.toFixed(1) : '0.0'}</div>
                        <div className="flex text-amber-400 text-xs my-1.5 justify-center">
                          {[1, 2, 3, 4, 5].map(star => (
                            <span key={star} className="text-lg leading-none">{star <= Math.round(ratingAvg) ? '★' : '☆'}</span>
                          ))}
                        </div>
                        <div className="text-xs text-gray-500 font-bold">{ratingTotal} đánh giá</div>
                      </div>
                      <div>
                        <h4 className="font-extrabold text-gray-900 text-base mb-1">Đánh giá chất lượng</h4>
                        <p className="text-sm text-gray-600 leading-normal text-slate-500">
                          {ratingTotal > 0
                            ? 'Thống kê nhận xét chuyên môn từ hội đồng giáo viên và đồng nghiệp.'
                            : 'Chưa có lượt đánh giá nào. Hãy chia sẻ nhận xét chuyên môn đầu tiên của bạn ở dưới!'}
                        </p>
                      </div>
                    </div>

                    {/* Horizonal Star Progress Bars (Statistics) */}
                    {ratingTotal > 0 && (
                      <div className="border-t border-amber-100/50 pt-4 space-y-2">
                        {[5, 4, 3, 2, 1].map(star => {
                          const percent = starStats.percentages[star as keyof typeof starStats.percentages] || 0;
                          const count = starStats.counts[star as keyof typeof starStats.counts] || 0;
                          return (
                            <div key={star} className="flex items-center gap-3 text-xs">
                              <span className="w-10 font-bold text-gray-600 flex items-center gap-0.5">{star} <span className="text-amber-500">★</span></span>
                              <div className="flex-grow h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
                                  style={{ width: `${percent}%` }}
                                ></div>
                              </div>
                              <span className="w-12 text-right text-gray-400 font-semibold">{percent}% ({count})</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Interactive Star Filter */}
                  {ratingTotal > 0 && (
                    <div className="mb-6 bg-white border border-gray-150 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Lọc theo số sao:</span>
                        {selectedStarFilter !== 'all' && (
                          <button
                            onClick={() => setSelectedStarFilter('all')}
                            className="text-xs text-blue-600 font-bold hover:underline"
                          >
                            Xóa bộ lọc
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => setSelectedStarFilter('all')}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${selectedStarFilter === 'all'
                              ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                              : 'bg-slate-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                          Tất cả ({ratingTotal})
                        </button>
                        {[5, 4, 3, 2, 1].map(star => {
                          const count = starStats.counts[star as keyof typeof starStats.counts] || 0;
                          return (
                            <button
                              key={star}
                              onClick={() => setSelectedStarFilter(String(star))}
                              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1 ${selectedStarFilter === String(star)
                                  ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                                  : 'bg-slate-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                              {star} <span className={selectedStarFilter === String(star) ? 'text-white' : 'text-amber-500'}>★</span> ({count})
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* My Highlighted Review (Nhận xét của bạn) — with integrated inline edit */}
                  {currentUser && lessonRatings.some((r: any) => r.user_id === currentUser.id) && (
                    (() => {
                      const myReview = lessonRatings.find((r: any) => r.user_id === currentUser.id);
                      if (!myReview) return null;
                      return (
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50/20 border border-blue-200/80 rounded-2xl p-5 shadow-sm mb-6">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-extrabold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                              <span>👤</span> Nhận xét của bạn
                            </h4>
                            <button
                              onClick={() => setEditingMyReview(!editingMyReview)}
                              className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 border ${editingMyReview
                                  ? 'text-gray-600 bg-gray-100 hover:bg-gray-200 border-gray-200'
                                  : 'text-blue-700 bg-blue-100 hover:bg-blue-200 border-blue-200/50'
                                }`}
                            >
                              {editingMyReview ? '✕ Đóng chỉnh sửa' : '✏️ Chỉnh sửa lại bình luận'}
                            </button>
                          </div>

                          {/* Display mode */}
                          {!editingMyReview && (
                            <div className="bg-white border border-blue-100 rounded-xl p-4 shadow-sm">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] text-gray-400">📅 {new Date(myReview.created_at).toLocaleDateString('vi-VN')} {new Date(myReview.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                <div className="flex bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                                  {[1, 2, 3, 4, 5].map(s => (
                                    <span key={s} className={`text-sm ${s <= myReview.rating ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                                  ))}
                                </div>
                              </div>
                              {myReview.comment ? (
                                <p className="text-sm text-gray-800 font-medium leading-relaxed whitespace-pre-wrap">{myReview.comment}</p>
                              ) : (
                                <p className="text-sm text-gray-400 italic font-medium">Bạn đã xếp hạng {myReview.rating} sao và không để lại bình luận viết.</p>
                              )}
                            </div>
                          )}

                          {/* Inline edit mode */}
                          {editingMyReview && (
                            <div className="bg-white border border-blue-100 rounded-xl p-4 shadow-sm">
                              <div className="flex items-center gap-2 mb-3">
                                {[1, 2, 3, 4, 5].map(star => (
                                  <button
                                    key={star}
                                    onClick={() => setMyRating(star)}
                                    type="button"
                                    className={`text-2xl transition-all duration-150 transform hover:scale-125 focus:outline-none ${star <= myRating ? 'text-amber-400 scale-110 drop-shadow-sm' : 'text-gray-200 hover:text-amber-200'
                                      }`}
                                  >
                                    ★
                                  </button>
                                ))}
                                {myRating > 0 && (
                                  <span className="ml-2 text-xs font-bold text-amber-700 px-2 py-0.5 bg-amber-50 rounded-lg border border-amber-100">
                                    {['', 'Rất tệ', 'Tệ', 'Bình thường', 'Tốt', 'Xuất sắc'][myRating]}
                                  </span>
                                )}
                              </div>

                              <textarea
                                value={myComment}
                                onChange={e => setMyComment(e.target.value)}
                                placeholder="Hãy đóng góp nhận xét chi tiết về bài giảng..."
                                rows={3}
                                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none bg-slate-50/50 mb-3"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setEditingMyReview(false)}
                                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
                                >
                                  Hủy
                                </button>
                                <button
                                  disabled={myRating === 0 || ratingSubmitting}
                                  onClick={async () => {
                                    if (!currentUser || myRating === 0) return;
                                    setRatingSubmitting(true);
                                    try {
                                      const res = await axios.post(`/api/lesson-plans/${selectedLessonForDetail!.id}/ratings/`, {
                                        user_id: currentUser.id, rating: myRating, comment: myComment
                                      });
                                      setRatingAvg(res.data.average_rating);
                                      setRatingTotal(res.data.total_ratings);
                                      // Update ratings list locally (replace current user entry - no extra GET needed)
                                      const updatedRatings1 = lessonRatings.map((r: any) =>
                                        r.user_id === currentUser.id ? { ...r, rating: myRating, comment: myComment } : r
                                      );
                                      setLessonRatings(updatedRatings1);
                                      const lid1 = selectedLessonForDetail!.id;
                                      setRatingsCache(prev => ({ ...prev, [lid1]: { ratings: updatedRatings1, average_rating: res.data.average_rating, total_ratings: res.data.total_ratings } }));
                                      setAllLessonPlans(prev => prev.map(p => p.id === lid1 ? { ...p, average_rating: res.data.average_rating, total_ratings: res.data.total_ratings } : p));
                                      setUnfilteredLessons(prev => prev.map(p => p.id === lid1 ? { ...p, average_rating: res.data.average_rating, total_ratings: res.data.total_ratings } : p));
                                      setSelectedLessonForDetail(prev => prev ? { ...prev, average_rating: res.data.average_rating, total_ratings: res.data.total_ratings } : null);

                                      setEditingMyReview(false);
                                    } catch { alert('Lỗi khi gửi đánh giá.'); }
                                    finally { setRatingSubmitting(false); }
                                  }}
                                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${myRating === 0 || ratingSubmitting
                                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20'
                                    }`}
                                >
                                  {ratingSubmitting ? '⟳ Đang gửi...' : '💾 Lưu thay đổi'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}

                  {/* New Rating Form — only shown when user has NOT reviewed yet */}
                  {currentUser && !lessonRatings.some((r: any) => r.user_id === currentUser.id) && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm mb-6">
                      <h4 className="text-sm font-extrabold text-gray-900 mb-3 flex items-center gap-1.5">
                        ✍️ Gửi đánh giá & nhận xét
                      </h4>

                      <div className="flex items-center gap-2 mb-3.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            onClick={() => setMyRating(star)}
                            type="button"
                            className={`text-3xl transition-all duration-150 transform hover:scale-125 focus:outline-none ${star <= myRating ? 'text-amber-400 scale-110 drop-shadow-sm' : 'text-gray-200 hover:text-amber-200'
                              }`}
                          >
                            ★
                          </button>
                        ))}
                        {myRating > 0 && (
                          <span className="ml-2 text-xs font-bold text-amber-700 px-2 py-0.5 bg-amber-50 rounded-lg border border-amber-100">
                            {['', 'Rất tệ', 'Tệ', 'Bình thường', 'Tốt', 'Xuất sắc'][myRating]}
                          </span>
                        )}
                      </div>

                      <textarea
                        value={myComment}
                        onChange={e => setMyComment(e.target.value)}
                        placeholder="Hãy đóng góp nhận xét chi tiết về bài giảng (phương pháp giảng dạy, nội dung, kiến thức học tập, cấu trúc bài giảng...)"
                        rows={3}
                        className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none bg-slate-50/50 mb-3"
                      />
                      <div className="flex justify-end">
                        <button
                          disabled={myRating === 0 || ratingSubmitting}
                          onClick={async () => {
                            if (!currentUser || myRating === 0) return;
                            setRatingSubmitting(true);
                            try {
                              const res = await axios.post(`/api/lesson-plans/${selectedLessonForDetail!.id}/ratings/`, {
                                user_id: currentUser.id, rating: myRating, comment: myComment
                              });
                              setRatingAvg(res.data.average_rating);
                              setRatingTotal(res.data.total_ratings);
                              // Append new rating locally (no extra GET needed)
                              const newEntry = { user_id: currentUser.id, user_full_name: currentUser.full_name, user_username: currentUser.username, rating: myRating, comment: myComment, created_at: new Date().toISOString() };
                              const updatedRatings2 = [...lessonRatings, newEntry];
                              setLessonRatings(updatedRatings2);
                              const lid2 = selectedLessonForDetail!.id;
                              setRatingsCache(prev => ({ ...prev, [lid2]: { ratings: updatedRatings2, average_rating: res.data.average_rating, total_ratings: res.data.total_ratings } }));
                              setAllLessonPlans(prev => prev.map(p => p.id === lid2 ? { ...p, average_rating: res.data.average_rating, total_ratings: res.data.total_ratings } : p));
                              setUnfilteredLessons(prev => prev.map(p => p.id === lid2 ? { ...p, average_rating: res.data.average_rating, total_ratings: res.data.total_ratings } : p));
                              setSelectedLessonForDetail(prev => prev ? { ...prev, average_rating: res.data.average_rating, total_ratings: res.data.total_ratings } : null);
                            } catch { alert('Lỗi khi gửi đánh giá.'); }
                            finally { setRatingSubmitting(false); }
                          }}
                          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${myRating === 0 || ratingSubmitting
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 hover:-translate-y-0.5'
                            }`}
                        >
                          {ratingSubmitting ? '⟳ Đang gửi...' : '⭐ Gửi đánh giá'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Comments list */}
                  <div className="flex flex-col flex-grow">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tất cả nhận xét</h4>
                    {ratingLoading ? (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-sm gap-2 bg-white border border-gray-150 rounded-2xl shadow-sm">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span>Đang tải nhận xét...</span>
                      </div>
                    ) : otherReviews.length === 0 ? (
                      <div className="text-center py-12 text-gray-400 text-sm italic bg-white border border-gray-155 rounded-2xl shadow-sm">
                        {selectedStarFilter !== 'all'
                          ? `Không có nhận xét nào đạt ${selectedStarFilter} sao.`
                          : 'Chưa có nhận xét nào khác từ đồng nghiệp.'}
                      </div>
                    ) : (
                      <div className="space-y-4 pr-1 flex-grow">
                        {otherReviews.map((r: any) => (
                          <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm transition-all hover:shadow-md duration-200">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-extrabold shadow-sm flex-shrink-0">
                                  {r.user_avatar_url ? (
                                    <img src={r.user_avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                  ) : (
                                    (r.user_full_name || r.user_username || 'A')[0].toUpperCase()
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                                    {r.user_full_name || r.user_username}
                                  </p>
                                  <p className="text-[10px] text-gray-400">📅 {new Date(r.created_at).toLocaleDateString('vi-VN')} {new Date(r.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                              </div>
                              <div className="flex bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                                {[1, 2, 3, 4, 5].map(s => (
                                  <span key={s} className={`text-sm ${s <= r.rating ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                                ))}
                              </div>
                            </div>
                            {r.comment ? (
                              <p className="text-sm text-gray-700 leading-relaxed ml-12 whitespace-pre-wrap">{r.comment}</p>
                            ) : (
                              <p className="text-sm text-gray-400 italic leading-relaxed ml-12">Đã xếp hạng {r.rating} sao và không để lại nhận xét.</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Bar / Footer */}
            <div className="p-5 border-t border-gray-100 bg-white flex items-center justify-end gap-3 flex-shrink-0">
              {isInlineEditingDetail ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsInlineEditingDetail(false);
                      setEditingLesson(null);
                    }}
                    className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-705 font-bold hover:bg-gray-100 hover:border-gray-400 transition-all mr-auto shadow-sm"
                  >
                    ✕ Hủy chỉnh sửa
                  </button>
                  <button
                    type="button"
                    onClick={async (e) => {
                      await submitEdit(e);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/25 flex items-center justify-center gap-2"
                  >
                    💾 Lưu thay đổi
                  </button>
                </>
              ) : (
                <>
                  {currentUser && (selectedLessonForDetail.creator?.id === currentUser.id || currentUser.role === 'ADMIN') && (
                    <button
                      onClick={() => {
                        const id = selectedLessonForDetail.id;
                        setSelectedLessonForDetail(null);
                        handleDeleteLesson(id);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 font-bold transition-all flex items-center gap-1.5 mr-auto hover:shadow-sm"
                    >
                      🗑️ Xóa tài liệu
                    </button>
                  )}

                  <button
                    onClick={() => { setSelectedLessonForDetail(null); setLessonRatings([]); setMyRating(0); setMyComment(''); }}
                    className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-750 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all hover:shadow-sm"
                  >
                    Đóng
                  </button>

                  {currentUser && (selectedLessonForDetail.creator?.id === currentUser.id || currentUser.role === 'ADMIN') && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          fetchEditHistory(selectedLessonForDetail.id);
                        }}
                        className="px-5 py-2.5 rounded-xl bg-slate-50 text-slate-700 border border-slate-200 font-bold hover:bg-slate-100 transition-all hover:shadow-sm"
                      >
                        📜 Lịch sử chỉnh sửa
                      </button>
                      <button
                        onClick={() => {
                          const l = selectedLessonForDetail;
                          setEditingLesson(l);
                          setEditTitle(l.title);
                          setEditDesc(l.description || '');
                          setEditGrade(l.target_student || '');
                          setEditDirId(l.directory_ids && l.directory_ids.length > 0 ? l.directory_ids[0].toString() : '');
                          setEditAttrs(JSON.stringify(l.attributes || {}));
                          setEditFile(null);
                          const loc = l.attributes && l.attributes['Địa điểm'] ? l.attributes['Địa điểm'] : '';
                          setEditLocation(loc);
                          setIsInlineEditingDetail(true);
                        }}
                        className="px-5 py-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 font-bold hover:bg-amber-100 transition-all hover:shadow-sm"
                      >
                        ✏️ Chỉnh sửa thông tin
                      </button>
                      {(selectedLessonForDetail.status === 'LOCAL' || selectedLessonForDetail.status === 'REJECTED') && (
                        <button
                          onClick={() => {
                            const l = selectedLessonForDetail;
                            setSelectedLessonForDetail(null);
                            openProposeModal(l);
                          }}
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:opacity-95 text-white font-bold transition-all shadow-md shadow-blue-500/10 hover:shadow-blue-500/20"
                        >
                          🌐 Đề xuất công khai
                        </button>
                      )}
                    </>
                  )}

                  {selectedLessonForDetail.file_path || selectedLessonForDetail.file_url ? (
                    <a
                      href={getLessonFileUrl(selectedLessonForDetail)}
                      download={getFileName(selectedLessonForDetail.file_url || selectedLessonForDetail.file_path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold transition-all hover:shadow-md flex items-center justify-center gap-2"
                    >
                      ↓ Tải tài liệu về máy
                    </a>
                  ) : (
                    <button disabled className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-400 font-bold cursor-not-allowed border border-gray-200">
                      Không có file đính kèm
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Creator Profile Modal */}
      {selectedCreatorForProfile && (
        <div className="fixed z-50 inset-0 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-100 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <span>👤</span> Thông tin tài khoản đăng tải
              </h3>
              <button
                onClick={() => setSelectedCreatorForProfile(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Short Profile Intro */}
              <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
                <div className="w-16 h-16 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-2xl font-bold flex-shrink-0">
                  {(selectedCreatorForProfile.full_name || selectedCreatorForProfile.username || 'A')[0].toUpperCase()}
                </div>
                <div className="truncate">
                  <h4 className="text-base font-bold text-gray-900 truncate">
                    {selectedCreatorForProfile.full_name || 'Họ và tên chưa cập nhật'}
                  </h4>
                  <p className="text-sm text-gray-500 truncate">Tên tài khoản: @{selectedCreatorForProfile.username}</p>
                </div>
              </div>

              {/* Information Table/Grid */}
              <div className="space-y-3">
                {/* Email Info */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Địa chỉ Email</label>
                  <p className="text-sm font-semibold text-gray-800 bg-gray-50 px-3.5 py-2 rounded-xl border border-gray-150/60 truncate">
                    {selectedCreatorForProfile.email || 'Chưa cập nhật email'}
                  </p>
                </div>

                {/* Role Info */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Vai trò hệ thống</label>
                  <div>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-sm font-bold ${selectedCreatorForProfile.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                        selectedCreatorForProfile.role === 'TEACHER' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                      <span className={`w-2 h-2 rounded-full ${selectedCreatorForProfile.role === 'ADMIN' ? 'bg-purple-500' :
                          selectedCreatorForProfile.role === 'TEACHER' ? 'bg-blue-500' :
                            'bg-emerald-500'
                        }`}></span>
                      {selectedCreatorForProfile.role === 'ADMIN' ? 'Ban quản trị hệ thống' :
                        selectedCreatorForProfile.role === 'TEACHER' ? 'Giáo viên phụ trách môn' :
                          'Thành viên / Học sinh'}
                    </span>
                  </div>
                </div>

                {/* Statistics Info */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Đóng góp học liệu</label>
                  <p className="text-sm font-bold text-indigo-700 bg-indigo-50/50 px-3.5 py-2 rounded-xl border border-indigo-100 flex items-center gap-1.5">
                    📖 Đã đăng tải <strong>{allLessonPlans.filter(l => l.creator?.id === selectedCreatorForProfile.id).length}</strong> giáo án / tài liệu
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => setSelectedCreatorForProfile(null)}
                className="w-full py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors shadow-sm"
              >
                Đóng hộp thoại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin User Management Modal */}


      {/* Approval Requests Management Modal */}
      {showApprovalModal && currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'TEACHER') && (
        <div className="fixed z-50 inset-0 flex items-center justify-center p-3 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl overflow-hidden border border-gray-100 flex flex-col" style={{ height: '92vh' }}>
            {/* Modal Header */}
            <div className="bg-amber-700 text-white px-6 py-4 flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🛡️</span>
                <div>
                  <h3 className="text-xl font-bold">Xét duyệt bài giảng</h3>
                  <p className="text-amber-200 text-xs mt-0.5">Duyệt hoặc từ chối bài giảng được đăng bởi người dùng</p>
                </div>
              </div>
              <button
                onClick={() => { setShowApprovalModal(false); setSelectedApproval(null); }}
                className="text-white hover:text-amber-100 text-2xl transition-colors font-bold"
              >
                &times;
              </button>
            </div>

            {/* Modal Body — 2 columns */}
            <div className="flex flex-row flex-grow overflow-hidden min-h-0">
              {/* LEFT: Request list */}
              <div className="w-80 flex-shrink-0 border-r border-gray-100 flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                  <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Chờ duyệt ({pendingApprovals.length})
                  </h4>
                </div>
                <div className="overflow-y-auto flex-grow p-3 space-y-2">
                  {pendingApprovals.length === 0 ? (
                    <p className="text-sm text-gray-400 italic py-8 text-center">Không có bài giảng nào đang chờ duyệt.</p>
                  ) : (
                    pendingApprovals.map((req: any) => {
                      const isSelected = selectedApproval && selectedApproval.id === req.id;
                      return (
                        <div
                          key={req.id}
                          onClick={() => { setSelectedApproval(req); setFeedback(req.feedback || ''); }}
                          className={`p-3 rounded-xl border transition-all cursor-pointer ${isSelected
                              ? 'border-amber-500 bg-amber-50 shadow-sm'
                              : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/30'
                            }`}
                        >
                          <p className="font-semibold text-gray-900 text-sm truncate">{req.lesson_plan_title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">👤 {req.requester_name || 'Người dùng'}</p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 text-gray-600 border border-gray-200 rounded text-[10px] font-medium truncate max-w-[140px]">
                              📁 {req.target_directory_name}
                            </span>
                            <span className="text-[10px] text-gray-400 flex-shrink-0">
                              {new Date(req.created_at).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* RIGHT: Detail + Preview */}
              <div className="flex-grow flex flex-col overflow-hidden min-w-0">
                {selectedApproval ? (
                  <>
                    {/* Info section (scrollable) */}
                    <div className="flex-grow overflow-y-auto p-5 space-y-4">
                      {/* Title & meta */}
                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Chi tiết yêu cầu xét duyệt</p>
                        <h5 className="font-bold text-gray-900 text-lg leading-snug">{selectedApproval.lesson_plan_title}</h5>
                        <p className="text-sm text-gray-500 mt-1">
                          Gửi bởi: <strong className="text-gray-700">{selectedApproval.requester_name}</strong>
                          {' '}vào thư mục <strong className="text-gray-700">{selectedApproval.target_directory_name}</strong>
                          {' '}· {new Date(selectedApproval.created_at).toLocaleDateString('vi-VN')}
                        </p>
                      </div>

                      {/* Info grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white border border-gray-100 rounded-xl p-3">
                          <p className="text-xs text-gray-400 font-medium mb-1">Đối tượng giảng dạy</p>
                          <p className="text-sm font-semibold text-gray-800">{selectedApproval.lesson_plan_target_student || 'Không rõ'}</p>
                        </div>
                        <div className="bg-white border border-gray-100 rounded-xl p-3">
                          <p className="text-xs text-gray-400 font-medium mb-1">Ngày gửi duyệt</p>
                          <p className="text-sm font-semibold text-gray-800">{new Date(selectedApproval.created_at).toLocaleString('vi-VN')}</p>
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <h6 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Mô tả bài giảng</h6>
                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100 whitespace-pre-line leading-relaxed">
                          {selectedApproval.lesson_plan_description || 'Không có mô tả.'}
                        </p>
                      </div>

                      {/* Attributes */}
                      {selectedApproval.lesson_plan_attributes && Object.keys(selectedApproval.lesson_plan_attributes).filter(k => k !== 'knowledge_tags').length > 0 && (
                        <div>
                          <h6 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Thông tin bổ sung</h6>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(selectedApproval.lesson_plan_attributes)
                              .filter(([k]) => k !== 'knowledge_tags')
                              .map(([key, val]) => (
                                <span key={key} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-100">
                                  {key}: {String(val)}
                                </span>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Knowledge tags */}
                      {selectedApproval.lesson_plan_attributes?.knowledge_tags?.length > 0 && (
                        <div>
                          <h6 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Kiến thức môn học</h6>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedApproval.lesson_plan_attributes.knowledge_tags.map((tag: string) => (
                              <span key={tag} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium border border-indigo-100">
                                ⚡ {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* File preview */}
                      {selectedApproval.lesson_plan_file_url && (() => {
                        const fileUrl = selectedApproval.lesson_plan_file_url;
                        const isDocx = fileUrl.toLowerCase().endsWith('.docx') || fileUrl.toLowerCase().endsWith('.doc');
                        const isPdf = fileUrl.toLowerCase().endsWith('.pdf');
                        return (
                          <div>
                            <h6 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                              Xem trước tài liệu
                            </h6>
                            {isDocx && <DocxPreview fileUrl={fileUrl} />}
                            {isPdf && (
                              <div className="border border-gray-200 rounded-xl overflow-hidden h-[520px] shadow-inner">
                                <iframe src={fileUrl} className="w-full h-full border-0" title="PDF Preview" />
                              </div>
                            )}
                            {!isDocx && !isPdf && (
                              <div className="flex flex-col items-center justify-center gap-3 p-8 bg-gray-50 border border-gray-200 rounded-xl text-center">
                                <span className="text-5xl">📄</span>
                                <p className="text-sm text-gray-500">Định dạng này không hỗ trợ xem trực tuyến.</p>
                                <a href={fileUrl} download target="_blank" rel="noopener noreferrer"
                                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 flex items-center gap-2">
                                  📥 Tải tài liệu về máy
                                </a>
                              </div>
                            )}
                            <div className="mt-2 flex justify-end">
                              <a href={fileUrl} download target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700 transition-colors shadow-sm">
                                📥 Tải tài liệu về máy
                              </a>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Feedback textarea */}
                      <div>
                        <h6 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Phản hồi / Góp ý (nếu từ chối):</h6>
                        <textarea
                          value={feedback}
                          onChange={e => setFeedback(e.target.value)}
                          placeholder="Nhập lý do từ chối hoặc góp ý chỉnh sửa bài giảng..."
                          className="w-full text-sm border border-gray-200 rounded-xl p-3 h-24 focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
                        />
                      </div>
                    </div>

                    {/* Action footer */}
                    <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 bg-white flex gap-3 justify-end">
                      <button
                        onClick={() => handleActionApproval(selectedApproval.id, 'REJECT', feedback)}
                        className="px-5 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-xl text-sm font-bold transition-colors"
                      >
                        ✕ Từ chối
                      </button>
                      <button
                        onClick={() => handleActionApproval(selectedApproval.id, 'APPROVE')}
                        className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold shadow-md shadow-green-100 transition-all"
                      >
                        Duyệt & Xuất bản
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50 h-full">
                    <div className="text-5xl mb-3 text-amber-200">🛡️</div>
                    <h5 className="font-bold text-gray-700 text-base">Xem chi tiết bài giảng chờ duyệt</h5>
                    <p className="text-sm text-gray-400 mt-1 max-w-xs">
                      Chọn một bài giảng từ danh sách bên trái để phê duyệt xuất bản lên hệ thống.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => { setShowApprovalModal(false); setSelectedApproval(null); }}
                className="px-6 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50 transition-colors text-sm shadow-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit History Modal */}
      {showHistoryModal && (
        <div className="fixed z-50 inset-0 flex items-center justify-center p-4 bg-slate-950/60 overflow-y-auto backdrop-blur-md transition-all">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-100/80 flex flex-col my-8 max-h-[85vh] transform transition-transform scale-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6 relative flex-shrink-0">
              <div className="absolute right-4 top-4">
                <button
                  onClick={() => { setShowHistoryModal(false); setEditHistory([]); }}
                  className="text-white/80 hover:text-white transition-colors text-2xl font-bold p-1 leading-none rounded-full hover:bg-white/10"
                >
                  &times;
                </button>
              </div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                📜 Lịch sử chỉnh sửa tài liệu
              </h3>
              <p className="text-slate-300 text-xs mt-1">
                Hiển thị chi tiết các thay đổi của tài liệu qua từng mốc thời gian.
              </p>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-grow bg-slate-50/50">
              {historyLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-10 h-10 border-4 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-slate-500 text-sm mt-3 font-medium">Đang tải lịch sử chỉnh sửa...</p>
                </div>
              ) : editHistory.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/60">
                  <div className="text-4xl mb-3">📂</div>
                  <p className="text-slate-500 font-semibold">Chưa có lịch sử chỉnh sửa nào</p>
                  <p className="text-slate-400 text-xs mt-1">Tài liệu này vẫn giữ nguyên các thông tin đăng tải ban đầu.</p>
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-200 ml-4 space-y-8 pb-4">
                  {editHistory.map((h, idx) => {
                    const isTitleChanged = h.title_before !== h.title_after;
                    const isDescChanged = h.description_before !== h.description_after;
                    const isStudentChanged = h.target_student_before !== h.target_student_after;
                    const isFileChanged = h.file_name_before !== h.file_name_after;

                    // Diff comparison helper for attributes
                    const beforeAttrs = h.attributes_before || {};
                    const afterAttrs = h.attributes_after || {};
                    const changedAttrs: string[] = [];
                    const allKeys = Array.from(new Set([...Object.keys(beforeAttrs), ...Object.keys(afterAttrs)]));
                    allKeys.forEach(k => {
                      if (JSON.stringify(beforeAttrs[k]) !== JSON.stringify(afterAttrs[k])) {
                        changedAttrs.push(k);
                      }
                    });

                    return (
                      <div key={h.id} className="relative pl-6">
                        {/* Timeline node */}
                        <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-slate-600 border-4 border-white shadow-sm flex items-center justify-center"></div>

                        {/* Card wrapper */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
                          {/* User tag and timestamp */}
                          <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100 flex-wrap">
                            <div className="flex items-center gap-2">
                              {h.edited_by_avatar ? (
                                <img src={h.edited_by_avatar} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-slate-100" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 text-xs font-black">
                                  {(h.edited_by_name || h.edited_by_username || 'U')[0].toUpperCase()}
                                </div>
                              )}
                              <div>
                                <p className="text-xs font-bold text-slate-800">
                                  {h.edited_by_name || h.edited_by_username || 'Người dùng'}
                                </p>
                                <p className="text-[10px] text-slate-400">Người thực hiện chỉnh sửa</p>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                              {new Date(h.edited_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {/* Diff changes list */}
                          <div className="space-y-3">
                            {isTitleChanged && (
                              <div className="text-xs">
                                <span className="font-bold text-slate-600">📝 Tiêu đề:</span>
                                <div className="mt-1 pl-2 border-l-2 border-slate-200 space-y-0.5">
                                  <p className="text-red-500 line-through">Cũ: {h.title_before}</p>
                                  <p className="text-emerald-600 font-medium">Mới: {h.title_after}</p>
                                </div>
                              </div>
                            )}

                            {isDescChanged && (
                              <div className="text-xs">
                                <span className="font-bold text-slate-600">💬 Mô tả:</span>
                                <div className="mt-1 pl-2 border-l-2 border-slate-200 space-y-0.5">
                                  <p className="text-red-500 line-through">Cũ: {h.description_before || '(trống)'}</p>
                                  <p className="text-emerald-600 font-medium">Mới: {h.description_after || '(trống)'}</p>
                                </div>
                              </div>
                            )}

                            {isStudentChanged && (
                              <div className="text-xs">
                                <span className="font-bold text-slate-600">👥 Đối tượng học sinh:</span>
                                <div className="mt-1 pl-2 border-l-2 border-slate-200 space-y-0.5">
                                  <p className="text-red-500 line-through">Cũ: {h.target_student_before}</p>
                                  <p className="text-emerald-600 font-medium">Mới: {h.target_student_after}</p>
                                </div>
                              </div>
                            )}

                            {isFileChanged && (
                              <div className="text-xs">
                                <span className="font-bold text-slate-600">📁 Tệp tin đính kèm:</span>
                                <div className="mt-1 pl-2 border-l-2 border-slate-200 space-y-0.5">
                                  <p className="text-red-500 line-through">Cũ: {h.file_name_before || '(Không có tệp)'}</p>
                                  <p className="text-emerald-600 font-medium">Mới: {h.file_name_after || '(Không có tệp)'}</p>
                                </div>
                              </div>
                            )}

                            {changedAttrs.length > 0 && (
                              <div className="text-xs">
                                <span className="font-bold text-slate-600">⚙️ Thuộc tính:</span>
                                <div className="mt-1 pl-2 border-l-2 border-slate-200 space-y-1">
                                  {changedAttrs.map(k => (
                                    <div key={k} className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                                      <p className="font-semibold text-slate-500 text-[10px]">{k}:</p>
                                      <p className="text-red-500 line-through">Cũ: {JSON.stringify(beforeAttrs[k]) || '(trống)'}</p>
                                      <p className="text-emerald-600 font-medium">Mới: {JSON.stringify(afterAttrs[k]) || '(trống)'}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-100 bg-white flex justify-end flex-shrink-0">
              <button
                onClick={() => { setShowHistoryModal(false); setEditHistory([]); }}
                className="px-5 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition-colors shadow-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Settings Modal */}
      {showProfileModal && currentUser && (
        <div className="fixed z-50 inset-0 flex items-center justify-center p-4 bg-slate-950/60 overflow-y-auto backdrop-blur-md transition-all">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100/80 flex flex-col my-8 transform transition-transform scale-100">
            {/* Header with gradient decoration */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-6 relative">
              <div className="absolute right-4 top-4">
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="text-white/80 hover:text-white transition-colors text-2xl font-bold p-1 leading-none rounded-full hover:bg-white/10"
                >
                  &times;
                </button>
              </div>
              <div className="flex items-center gap-4">
                {/* Visual Avatar display */}
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white flex items-center justify-center text-2xl font-black text-white shadow-md overflow-hidden flex-shrink-0">
                  {currentUser.avatar_url ? (
                    <img src={currentUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    profileFullName ? profileFullName.charAt(0).toUpperCase() : currentUser.username.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight">Hồ sơ cá nhân</h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs text-blue-100 font-semibold">@{currentUser.username}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-white/15 rounded-full font-bold uppercase tracking-wider text-white">
                      {currentUser.role === 'ADMIN' ? 'Quản trị viên' : currentUser.role === 'TEACHER' ? 'Giáo viên' : 'Người dùng'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveProfile} className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
              {profileSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold rounded-2xl flex items-center gap-2 shadow-sm animate-fade-in">
                  <span>✓</span> {profileSuccess}
                </div>
              )}

              {profileError && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold rounded-2xl flex items-center gap-2 shadow-sm">
                  <span>⚠</span> {profileError}
                </div>
              )}

              {/* Personal Info Card Section */}
              <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl space-y-4">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <span>👤</span> Thông tin cơ bản
                </h4>

                {/* Avatar Edit Section */}
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full border-4 border-slate-100 shadow-md overflow-hidden bg-slate-100 flex items-center justify-center text-4xl font-black text-slate-400">
                      {profileAvatarPreview ? (
                        <img src={profileAvatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                      ) : currentUser.avatar_url ? (
                        <img src={currentUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        profileFullName ? profileFullName.charAt(0).toUpperCase() : currentUser.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2.5 cursor-pointer shadow-md transition-colors border-2 border-white flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"></path>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"></path>
                      </svg>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <span className="text-xs text-slate-500 font-semibold">Tải ảnh đại diện mới</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Họ và tên hiển thị</label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      👤
                    </div>
                    <input
                      type="text"
                      required
                      value={profileFullName}
                      onChange={e => setProfileFullName(e.target.value)}
                      placeholder="Nhập họ và tên đầy đủ..."
                      className="block w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-700 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Password Change Card Section */}
              <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl space-y-4">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <span>🔑</span> Đổi mật khẩu bảo mật (Không bắt buộc)
                </h4>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Mật khẩu mới</label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        🔒
                      </div>
                      <input
                        type={showProfileNewPassword ? "text" : "password"}
                        value={profileNewPassword}
                        onChange={e => setProfileNewPassword(e.target.value)}
                        placeholder="Nhập mật khẩu mới (nếu muốn đổi)..."
                        className="block w-full pl-10 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-700 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowProfileNewPassword(!showProfileNewPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showProfileNewPassword ? "👁️" : "🙈"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Xác nhận mật khẩu mới</label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        🔄
                      </div>
                      <input
                        type={showProfileConfirmNewPassword ? "text" : "password"}
                        value={profileConfirmNewPassword}
                        onChange={e => setProfileConfirmNewPassword(e.target.value)}
                        placeholder="Xác nhận lại mật khẩu mới..."
                        className="block w-full pl-10 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-700 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowProfileConfirmNewPassword(!showProfileConfirmNewPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showProfileConfirmNewPassword ? "👁️" : "🙈"}
                      </button>
                    </div>
                  </div>
                </div>

                {profileNewPassword && (
                  <div className="border-t border-slate-200/60 pt-3">
                    <label className="block text-xs font-bold text-rose-600 mb-1.5 flex items-center gap-1">
                      <span>⚠</span> Xác thực mật khẩu cũ để lưu thay đổi
                    </label>
                    <div className="relative rounded-xl shadow-sm animate-pulse">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-rose-400">
                        🔑
                      </div>
                      <input
                        type={showProfileCurrentPassword ? "text" : "password"}
                        required={!!profileNewPassword}
                        value={profileCurrentPassword}
                        onChange={e => setProfileCurrentPassword(e.target.value)}
                        placeholder="Nhập mật khẩu hiện tại..."
                        className="block w-full pl-10 pr-10 py-2.5 text-sm border border-rose-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-medium text-slate-700 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowProfileCurrentPassword(!showProfileCurrentPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-rose-400 hover:text-rose-600 transition-colors"
                      >
                        {showProfileCurrentPassword ? "👁️" : "🙈"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions Footer inside form */}
              <div className="flex gap-3 justify-end border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-600 shadow-sm"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-md transition-all flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-100 ${profileSaving ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                >
                  {profileSaving ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Đang lưu...
                    </>
                  ) : (
                    'Lưu thay đổi'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {currentUser && (
        <ChatbotWorkspace
          useAiRag={useAiRag}
          directories={directories}
          currentUser={currentUser}
          onBack={() => { }}
          onSuccess={() => { fetchLessonPlans(searchQuery); }}
          onRefreshDirs={fetchDirectories}
          lessonPlans={lessonPlans}
          focusLessonId={focusLessonIdForChat}
          setFocusLessonId={setFocusLessonIdForChat}
          chatbotOpenTrigger={chatbotOpenTrigger}
          onSelectDirectory={(dirId) => {
            setSelectedDirs([dirId]);
            setCurrentView('home');
            setHomeTab('library');
          }}
          onViewLessonDetail={(lesson, highlightQuery) => {
            setSelectedLessonForDetail(lesson);
            setLessonHighlightQuery(highlightQuery || '');
            setCurrentView('home');
          }}
          isDetailOpen={!!selectedLessonForDetail}
        />
      )}

      {isMindmapFullScreen && selectedLessonForDetail && (
        <div className="fixed inset-0 w-screen h-screen bg-[#f8fafc] z-[200] flex flex-col transition-all duration-300 animate-in fade-in zoom-in-95">
          {/* Fullscreen Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 text-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-600 border border-indigo-100">
                🧠 Sơ đồ tư duy toàn màn hình
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900">{selectedLessonForDetail.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Cuộn chuột để zoom • Giữ chuột kéo để di chuyển • Click các nút lá để xem chi tiết sư phạm</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden md:flex gap-2 text-slate-600 text-xs font-semibold">
                <span className="px-3 py-1 bg-slate-100 rounded-xl border border-slate-200">🖱️ Kéo thả</span>
                <span className="px-3 py-1 bg-slate-100 rounded-xl border border-slate-200">🔍 Zoom</span>
                <span className="px-3 py-1 bg-slate-100 rounded-xl border border-slate-200">👆 Click lá</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMindmapFullScreen(false)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-rose-200 hover:shadow-rose-350 transition-all flex items-center gap-1.5"
              >
                ✕ Thoát toàn màn hình
              </button>
            </div>
          </div>

          {/* Fullscreen Interactive Canvas */}
          <div className="flex-grow w-full relative bg-[#f8fafc] overflow-hidden">
            <InteractiveLessonMindmap lesson={selectedLessonForDetail} isFullscreen={true} />
          </div>
        </div>
      )}

      {isDocumentFullScreen && selectedLessonForDetail && (
        <div className="fixed inset-0 w-screen h-screen bg-[#f8fafc] z-[200] flex flex-col transition-all duration-300 animate-in fade-in zoom-in-95">
          {/* Fullscreen Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 text-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-600 border border-emerald-100">
                📄 Xem tài liệu toàn màn hình
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900">{selectedLessonForDetail.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Không gian đọc tài liệu tập trung cao độ</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Download Word Button */}
              {(selectedLessonForDetail.file_path || selectedLessonForDetail.file_url) ? (
                <a
                  href={getLessonFileUrl(selectedLessonForDetail)}
                  download={getFileName(selectedLessonForDetail.file_url || selectedLessonForDetail.file_path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-extrabold rounded-xl shadow-md shadow-blue-100 hover:shadow-blue-200 transition-all flex items-center gap-1.5"
                >
                  📥 Tải bản Word (.docx)
                </a>
              ) : null}

              {/* Download Markdown Button */}
              {selectedLessonForDetail.content_preview ? (
                <button
                  type="button"
                  onClick={() => downloadMarkdownFile(selectedLessonForDetail.title, selectedLessonForDetail.content_preview)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-extrabold rounded-xl shadow-md shadow-emerald-100 hover:shadow-emerald-200 transition-all flex items-center gap-1.5"
                >
                  ⚡ Tải bản Markdown (.md)
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setIsDocumentFullScreen(false)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-rose-200 hover:shadow-rose-350 transition-all flex items-center gap-1.5"
              >
                ✕ Thoát chế độ xem
              </button>
            </div>
          </div>

          <div className="flex-grow w-full overflow-y-auto bg-slate-50 p-6 md:p-12">
            <div className="max-w-[95%] mx-auto bg-white rounded-3xl border border-slate-200/80 shadow-2xl p-6 md:p-10">
              {/* Document Preview & Attachment */}
              {((selectedLessonForDetail.file_path || selectedLessonForDetail.file_url) || selectedLessonForDetail.content_preview) && (() => {
                const fileUrl = getLessonFileUrl(selectedLessonForDetail);
                const fileName = getFileName(selectedLessonForDetail.file_url || selectedLessonForDetail.file_path);
                const isPdfFile = fileUrl ? fileUrl.toLowerCase().endsWith('.pdf') : false;

                if (isPdfFile) {
                  return (
                    <div className="mt-8 border-t border-slate-100 pt-8">
                      <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span>🌍</span> Tài liệu PDF trực tuyến
                      </h4>
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm h-[75vh]">
                        <iframe
                          src={fileUrl}
                          className="w-full h-full border-0"
                          title="PDF Preview"
                        />
                      </div>
                    </div>
                  );
                } else {
                  const isMd = fileUrl ? (fileUrl.toLowerCase().endsWith('.md') || fileUrl.toLowerCase().endsWith('.markdown') || fileUrl.toLowerCase().endsWith('.txt')) : !!selectedLessonForDetail.content_preview;
                  const isDocx = fileUrl ? (fileUrl.toLowerCase().endsWith('.docx') || fileUrl.toLowerCase().endsWith('.doc')) : false;
                  if (isMd) {
                    return (
                      <div className="mt-8 border-t border-slate-100 pt-8">
                        <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <span>⚡</span> Nội dung tài liệu Markdown
                        </h4>
                        <MarkdownViewer markdown={selectedLessonForDetail.content_preview} highlightQuery={lessonHighlightQuery} />
                      </div>
                    );
                  } else if (isDocx) {
                    return (
                      <div className="mt-8 border-t border-slate-100 pt-8">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-2 border-b border-slate-100">
                          <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <span>📝</span> Nội dung chi tiết giáo án Word
                          </h4>
                          <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 shadow-sm self-start">
                            <button
                              type="button"
                              onClick={() => setPreviewMode('markdown')}
                              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${previewMode === 'markdown'
                                  ? 'bg-white text-emerald-650 shadow-sm border border-slate-200/50'
                                  : 'text-gray-500 hover:text-gray-900'
                                }`}
                            >
                              ⚡ Bản trích xuất Markdown
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreviewMode('docx')}
                              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${previewMode === 'docx'
                                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50'
                                  : 'text-gray-500 hover:text-gray-900'
                                }`}
                            >
                              📝 Bản Word gốc (Offline)
                            </button>
                          </div>
                        </div>

                        {previewMode === 'docx' ? (
                          <div className="bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
                            <DocxPreview fileUrl={fileUrl} />
                          </div>
                        ) : (
                          <MarkdownViewer markdown={selectedLessonForDetail.content_preview} highlightQuery={lessonHighlightQuery} />
                        )}
                      </div>
                    );
                  }

                  const isPptx = fileUrl.toLowerCase().endsWith('.pptx') || fileUrl.toLowerCase().endsWith('.ppt');
                  const fileTypeLabel = isPptx ? 'Microsoft PowerPoint' : 'Tài liệu';
                  const fileIcon = isPptx ? '📊' : '📄';

                  return (
                    <div className="mt-8 border-t border-slate-100 pt-8">
                      <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-4">Tài liệu đính kèm</h4>
                      <div className="border border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-white shadow-sm">
                        <div className="text-6xl mb-4">{fileIcon}</div>
                        <h5 className="font-bold text-gray-900 text-lg mb-1 leading-snug break-all max-w-lg">{fileName}</h5>
                        <p className="text-sm text-gray-500 mb-6">Định dạng: <span className="font-semibold text-gray-700">{fileTypeLabel}</span></p>

                        <div className="max-w-md bg-blue-50/40 border border-blue-100 rounded-xl p-4 text-left text-sm text-gray-600 mb-6 leading-relaxed">
                          💡 <strong>Hướng dẫn:</strong> Vì bạn đang chạy hệ thống dưới quyền máy chủ nội bộ (Localhost Offline), tài liệu {fileTypeLabel} cần được tải về máy tính để mở bằng Word/PowerPoint (tránh gửi tài liệu ra internet).
                        </div>

                        <a
                          href={fileUrl}
                          download={fileName}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md shadow-blue-200 hover:shadow-blue-300 transition-all flex items-center gap-2 hover:-translate-y-0.5 duration-150"
                        >
                          📥 Tải tài liệu về máy ngay
                        </a>
                      </div>
                    </div>
                  );
                }
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
