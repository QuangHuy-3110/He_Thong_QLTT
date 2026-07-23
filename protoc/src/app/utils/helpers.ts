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

export interface MindmapData {
  title: string;
  mục_tiêu: { kiến_thức: string[]; năng_lực: string[]; phẩm_chất: string[] };
  học_liệu: { giáo_viên: string[]; học_sinh: string[] };
  tiến_trình: { ten: string; time: string; tom_tat: string }[];
  hoạt_động: { ten: string; muc_tieu: string; thuc_hien: string }[];
}

export interface FormattedActivity {
  title: string;
  duration?: string;
  summary?: string;
  details: string;
  category: string;
}

export function getLessonMindmapData(lesson: LessonPlan): MindmapData {
  if (!lesson) {
    return {
      title: 'Giáo án chưa có tiêu đề',
      mục_tiêu: { kiến_thức: [], năng_lực: [], phẩm_chất: [] },
      học_liệu: { giáo_viên: [], học_sinh: [] },
      tiến_trình: [],
      hoạt_động: []
    };
  }

  // 1. Try dynamic markdown parser first
  const parsed = parseMarkdownLessonPlan(lesson.content_preview, lesson.title);
  if (parsed) return parsed;

  const norm = (lesson.title || '').toLowerCase();

  // 2. Pre-authored fallback data for special lessons
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
        { ten: 'Hoạt động 1: Trò chơi đoán thực phẩm', time: '10 phút', tom_tat: 'GV giấu các quả củ thật, HS dùng tay chạm đoán tên và phân loại nhóm chất.' },
        { ten: 'Hoạt động 2: Trải nghiệm nhãn dinh dưỡng', time: '20 phút', tom_tat: 'HS nghiên cứu nhãn dinh dưỡng, phân tích 4 nhóm chất thông qua thảo luận.' },
        { ten: 'Hoạt động 3: Thiết kế thực đơn', time: '25 phút', tom_tat: 'Thực hành thiết kế poster thực đơn bữa trưa cân đối calo.' },
        { ten: 'Hoạt động 4: Tọa đàm ẩm thực an toàn', time: '15 phút', tom_tat: 'Trưng bày Poster, thuyết trình và chấm chéo điểm bằng Rubric.' },
        { ten: "Hoạt động 5: Chiến dịch 'Bữa sáng khỏe mạnh'", time: '10 phút', tom_tat: 'Ghi nhật ký dinh dưỡng gia đình, cam kết bữa sáng cân bằng.' },
      ],
      hoạt_động: [
        {
          ten: 'Hoạt động 1: Trò chơi đoán thực phẩm',
          muc_tieu: 'Kích hoạt kiến thức nền và tạo không khí học tập hào hứng.',
          thuc_hien: `| 👨‍🏫 Hoạt động giáo viên | 🎒 Hoạt động học sinh | 📝 Nội dung lưu bảng |\n| :--- | :--- | :--- |\n| GV giấu các quả củ thật vào chiếc giỏ bí mật. Gọi đại diện các nhóm lên bịt mắt chạm đoán tên. | HS dùng tay cảm nhận, phát biểu ý kiến đoán tên thực phẩm và phân chia vào 2 giỏ. | 4 Nhóm chất dinh dưỡng thiết yếu. |\n| GV dẫn dắt vào bài học về tầm quan trọng của dinh dưỡng. | HS lắng nghe và chuẩn bị bài. | Nhận diện vai trò các nhóm chất. |`
        },
        {
          ten: 'Hoạt động 2: Trải nghiệm nhãn dinh dưỡng',
          muc_tieu: 'Nhận diện các thành phần dinh dưỡng và chỉ số có hại.',
          thuc_hien: `| 👨‍🏫 Hoạt động giáo viên | 🎒 Hoạt động học sinh | 📝 Nội dung lưu bảng |\n| :--- | :--- | :--- |\n| GV phát vỏ hộp sữa, lon nước ngọt để HS soi thông số Calories, Đường, Fat. | HS làm việc nhóm phân tích nhãn dinh dưỡng. | Đọc nhãn thực phẩm: Calories, Đường, Chất béo. |\n| GV tổng kết quy tắc lựa chọn thực phẩm an toàn. | HS ghi chép nội dung trọng tâm. | Chọn thực phẩm ít đường, ít chất béo bão hòa. |`
        },
        {
          ten: 'Hoạt động 3: Thiết kế thực đơn',
          muc_tieu: 'Lập thực đơn 1 ngày đạt chuẩn calo cho lứa tuổi học sinh.',
          thuc_hien: `| 👨‍🏫 Hoạt động giáo viên | 🎒 Hoạt động học sinh | 📝 Nội dung lưu bảng |\n| :--- | :--- | :--- |\n| GV hướng dẫn tính toán calo tiêu chuẩn theo công thức BMR. | HS thiết kế poster thực đơn bữa ăn 600-700 kcal trên giấy A1. | Nguyên tắc cân bằng calo: Năng lượng nạp vào = Năng lượng tiêu hao. |\n| Hướng dẫn phối hợp các nhóm thực phẩm. | HS phân công vẽ minh họa và dán thẻ thực phẩm. | Phối hợp đa dạng 4 nhóm thực phẩm. |`
        },
        {
          ten: 'Hoạt động 4: Tọa đàm ẩm thực an toàn',
          muc_tieu: 'Phát triển kỹ năng thuyết trình và phản biện.',
          thuc_hien: `| 👨‍🏫 Hoạt động giáo viên | 🎒 Hoạt động học sinh | 📝 Nội dung lưu bảng |\n| :--- | :--- | :--- |\n| GV tổ chức cho các nhóm đóng vai Chuyên gia dinh dưỡng nhận xét thực đơn. | Đại diện nhóm thuyết trình sản phẩm, phản biện câu hỏi của bạn. | Đánh giá thực đơn theo Rubric tiêu chuẩn. |\n| GV chốt kiến thức và chấm điểm sản phẩm. | HS tiếp thu ý kiến và hoàn thiện sản phẩm. | Hoàn thiện thực đơn dinh dưỡng. |`
        },
        {
          ten: "Hoạt động 5: Chiến dịch 'Bữa sáng khỏe mạnh'",
          muc_tieu: 'Hình thành thói quen ăn uống lành mạnh tại nhà.',
          thuc_hien: `| 👨‍🏫 Hoạt động giáo viên | 🎒 Hoạt động học sinh | 📝 Nội dung lưu bảng |\n| :--- | :--- | :--- |\n| GV giao nhiệm vụ thực hành 7 ngày tự chuẩn bị bữa sáng lành mạnh. | HS cam kết thực hiện và chụp ảnh nhật ký dinh dưỡng. | Kế hoạch 7 ngày ăn sáng lành mạnh. |`
        },
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
        { ten: 'Hoạt động 01: CẢM XÚC CỦA EM HÔM NAY', time: '10 phút', tom_tat: 'Nhận diện và gọi tên được cảm xúc của bản thân.' },
        { ten: 'Hoạt động 02: LỐI SỐNG CỦA EM ĐÃ ĐỦ NĂNG ĐỘNG CHƯA?', time: '20 phút', tom_tat: 'Đánh giá thói quen vận động hàng ngày và phân tích lợi ích.' },
        { ten: 'Hoạt động 03: KHÁM PHÁ CƠ SỞ KHOA HỌC CỦA VIỆC LUYỆN TẬP', time: '20 phút', tom_tat: 'Tích hợp Sinh học phân tích cơ chế vận động cơ thể.' },
        { ten: 'Hoạt động 04: THIẾT KẾ KẾ HOẠCH VẬN ĐỘNG 7 NGÀY', time: '25 phút', tom_tat: 'Xây dựng kế hoạch rèn luyện thể chất cá nhân.' },
      ],
      hoạt_động: [
        {
          ten: 'Hoạt động 01: CẢM XÚC CỦA EM HÔM NAY',
          muc_tieu: '- Nhận diện và gọi tên được cảm xúc của bản thân.\n- Hiểu rằng mỗi người có thể trải qua những cảm xúc khác nhau trong cùng một hoàn cảnh.\n- Hình thành thái độ tôn trọng cảm xúc của bản thân và người khác.',
          thuc_hien: `| 👨‍🏫 Hoạt động giáo viên | 🎒 Hoạt động học sinh | 📝 Nội dung lưu bảng |\n| :--- | :--- | :--- |\n| Giáo viên chiếu lần lượt các hình ảnh hoặc biểu tượng khuôn mặt thể hiện những cảm xúc khác nhau: 😊 Vui vẻ 😢 Buồn 😠 Tức giận 😰 Lo lắng 😍 Hào hứng 😨 Sợ hãi 😌 Bình yên 😕 Bối rối. <br/><br/>**Giáo viên hỏi**: Nếu chỉ được chọn một biểu tượng để mô tả cảm xúc của mình lúc này, em sẽ chọn biểu tượng nào? Vì sao? | Học sinh có thể giơ thẻ màu, sticker hoặc giơ tay theo lựa chọn. | Mỗi người đều có cảm xúc. Cảm xúc giúp chúng ta hiểu chính mình. Nhận diện cảm xúc là bước đầu để quản lý cảm xúc. |\n| Giáo viên phát Phiếu học tập số 1. | HS tiến hành hoàn thành PHT. | Mỗi người đều có cảm xúc. Cảm xúc giúp chúng ta hiểu chính mình. Nhận diện cảm xúc là bước đầu để quản lý cảm xúc. |\n| Yêu cầu học sinh trao đổi với bạn bên cạnh: Em đã chọn cảm xúc nào? Điều gì tạo nên cảm xúc đó? Nếu gặp bạn có cảm xúc giống em, em sẽ nói gì? <br/><br/>*Giáo viên lưu ý*: Học sinh không bắt buộc chia sẻ những vấn đề riêng tư. Có thể chỉ chia sẻ mức độ hoặc tình huống giả định. | HS làm việc nhóm đôi trao đổi, thảo luận. | Mỗi người đều có cảm xúc. Cảm xúc giúp chúng ta hiểu chính mình. Nhận diện cảm xúc là bước đầu để quản lý cảm xúc. |\n| Giáo viên tổng kết: Cảm xúc là phản ứng tự nhiên của con người. Không có cảm xúc nào hoàn toàn "xấu" hay "tốt"; điều quan trọng là cách chúng ta nhận diện và ứng xử với cảm xúc. Mỗi người có thể cảm nhận khác nhau trước cùng một sự việc. | HS lắng nghe và rút ra bài học cá nhân. | Cảm xúc là phản ứng tự nhiên của con người. Nhận diện và ứng xử với cảm xúc tích cực. |`
        },
        {
          ten: 'Hoạt động 02: LỐI SỐNG CỦA EM ĐÃ ĐỦ NĂNG ĐỘNG CHƯA?',
          muc_tieu: '- Phân tích mức độ vận động hàng ngày của bản thân.\n- Đánh giá được ưu điểm và hạn chế trong thói quen sinh hoạt.',
          thuc_hien: `| 👨‍🏫 Hoạt động giáo viên | 🎒 Hoạt động học sinh | 📝 Nội dung lưu bảng |\n| :--- | :--- | :--- |\n| Giáo viên giao bảng tự kiểm tra mức độ vận động thể chất hàng ngày cho học sinh. | Học sinh tích chọn các hoạt động đã thực hiện trong 3 ngày gần nhất. | Lối sống năng động giúp tăng cường sức khỏe thể chất và tinh thần. |\n| Hướng dẫn học sinh tính điểm và thảo luận nhóm về các thói quen tĩnh tại (ngồi lâu, dùng điện thoại). | Học sinh thảo luận nhóm, so sánh chỉ số vận động cá nhân. | Hạn chế thời gian tĩnh tại, duy trì vận động ít nhất 30-60 phút mỗi ngày. |`
        },
        {
          ten: 'Hoạt động 03: KHÁM PHÁ CƠ SỞ KHOA HỌC CỦA VIỆC LUYỆN TẬP',
          muc_tieu: '- Hiểu cơ chế sinh học của hệ cơ, xương, khớp và hô hấp khi vận động.\n- Vận dụng kiến thức để giải thích lý do cần rèn luyện thường xuyên.',
          thuc_hien: `| 👨‍🏫 Hoạt động giáo viên | 🎒 Hoạt động học sinh | 📝 Nội dung lưu bảng |\n| :--- | :--- | :--- |\n| Giáo viên trình chiếu sơ đồ hệ cơ - xương - khớp và sự chuyển hóa năng lượng khi tập thể thao. | Học sinh quan sát, phân tích mối liên hệ giữa vận động và sức khỏe hệ tuần hoàn, hô hấp. | Luyện tập giúp cơ bắp dẻo dai, xương chắc khỏe và tối ưu hóa chuyển hóa năng lượng. |\n| GV đặt câu hỏi tình huống: Tại sao sau khi tập thể dục ta lại cảm thấy tinh thần sảng khoái? | HS phát biểu dựa trên kiến thức tiết hóc Endorphin và trao đổi chất. | Vận dụng Sinh học vào rèn luyện thể chất an toàn và khoa học. |`
        },
        {
          ten: 'Hoạt động 04: THIẾT KẾ KẾ HOẠCH VẬN ĐỘNG 7 NGÀY',
          muc_tieu: '- Xây dựng bản kế hoạch rèn luyện thể thao phù hợp với bản thân.\n- Cam kết duy trì thói quen năng động.',
          thuc_hien: `| 👨‍🏫 Hoạt động giáo viên | 🎒 Hoạt động học sinh | 📝 Nội dung lưu bảng |\n| :--- | :--- | :--- |\n| Giáo viên hướng dẫn các bước lập kế hoạch: Chọn môn thể thao, thời gian, mục tiêu đo lường được. | Học sinh phác thảo kế hoạch 7 ngày vào phiếu bài tập. | Kế hoạch 7 ngày: Cụ thể - Khả thi - Đo lường được. |\n| Tổ chức cho học sinh chia sẻ kế hoạch với bạn cùng tiến để giám sát lẫn nhau. | Học sinh trao đổi, góp ý và ký cam kết đồng hành. | Duy trì cam kết rèn luyện thể chất bền vững. |`
        }
      ],
    };
  }

  // 3. Generic fallback from lesson.attributes or content
  const acts = lesson.attributes?.tien_trinh_day_hoc ?? [];
  const bioIntegrated = lesson.attributes?.['Kiến thức sinh học liên quan'];
  const durationAttr = lesson.attributes?.['Thời gian thực hiện'] || lesson.attributes?.['Thời gian'] || lesson.attributes?.['Số tiết'];
  const trackAttr = lesson.attributes?.['Mạch kiến thức'];
  const topicAttr = lesson.attributes?.['Chủ đề'];

  const dynamicKiensThuc = bioIntegrated
    ? String(bioIntegrated).split(',').map((t, idx) => `KT${idx + 1}: Tích hợp Sinh học - ${t.trim()}`)
    : ['KT1: Tìm hiểu sâu khái niệm chuyên đề', 'KT2: Mở rộng kiến thức thực hành & liên hệ bản thân'];

  if (trackAttr || topicAttr) {
    dynamicKiensThuc.unshift(`Nội dung trọng tâm: ${topicAttr || lesson.title} (${trackAttr || 'Hoạt động trải nghiệm'})`);
  }

  const tienTrinh = acts.map((a: any, idx: number) => ({
    ten: a.ten_hoat_dong || a.title || a.name || `Hoạt động ${idx + 1}`,
    time: a.thoi_gian || a.time || a.duration || `${15 + (idx % 3) * 10} phút`,
    tom_tat: a.tom_tat || a.muc_tieu || a.summary || 'Thực hiện theo kịch bản tổ chức bài học.'
  }));

  const hoatDong = acts.length > 0
    ? acts.map((a: any, idx: number) => ({
        ten: `Hoạt động ${String(idx + 1).padStart(2, '0')}: ${a.ten_hoat_dong || a.title || a.name || 'Hoạt động trải nghiệm'}`,
        muc_tieu: a.muc_tieu || `Phát triển năng lực trải nghiệm pha ${idx + 1}`,
        thuc_hien: `| 👨‍🏫 Hoạt động giáo viên | 🎒 Hoạt động học sinh | 📝 Nội dung lưu bảng |\n| :--- | :--- | :--- |\n| ${a.hoat_dong_gv || 'Hướng dẫn học sinh thực hiện.'} | ${a.hoat_dong_hs || 'Thực hiện theo yêu cầu của GV.'} | ${a.noi_dung_luu_bang || a.tom_tat || 'Ghi nhớ nội dung trọng tâm.'} |`,
      }))
    : [
        {
          ten: 'Hoạt động 01: Khởi động & Tạo bối cảnh',
          muc_tieu: 'Kích hoạt năng lượng lớp học và đặt câu hỏi bối cảnh thực tiễn.',
          thuc_hien: '| 👨‍🏫 Hoạt động giáo viên | 🎒 Hoạt động học sinh | 📝 Nội dung lưu bảng |\n| :--- | :--- | :--- |\n| Giáo viên chiếu video khởi động, nêu câu hỏi tình huống thực tế. | Học sinh theo dõi, phát biểu cảm nghĩ và suy luận cá nhân. | Nhận diện vấn đề thực tiễn của bài học. |'
        },
        {
          ten: 'Hoạt động 02: Khám phá & Hình thành kiến thức',
          muc_tieu: 'Phân tích kiến thức tích hợp qua phiếu học tập và làm việc nhóm.',
          thuc_hien: '| 👨‍🏫 Hoạt động giáo viên | 🎒 Hoạt động học sinh | 📝 Nội dung lưu bảng |\n| :--- | :--- | :--- |\n| Giáo viên giao phiếu học tập, phân công nhiệm vụ thảo luận nhóm. | Học sinh đọc tài liệu, trao đổi nhóm và ghi kết quả vào giấy A1. | Tổng hợp kiến thức cốt lõi. |'
        },
        {
          ten: 'Hoạt động 03: Luyện tập & Vận dụng thực hành',
          muc_tieu: 'Rèn luyện kỹ năng thực tế và đóng vai xử lý tình huống.',
          thuc_hien: '| 👨‍🏫 Hoạt động giáo viên | 🎒 Hoạt động học sinh | 📝 Nội dung lưu bảng |\n| :--- | :--- | :--- |\n| Giáo viên đưa ra tình huống thực tế, tổ chức trò chơi đóng vai. | Học sinh phối hợp giải quyết tình huống, trình bày sản phẩm. | Kỹ năng vận dụng vào đời sống. |'
        },
        {
          ten: 'Hoạt động 04: Báo cáo & Tổng kết đánh giá',
          muc_tieu: 'Đánh giá năng lực thuyết trình và tổng kết bài học.',
          thuc_hien: '| 👨‍🏫 Hoạt động giáo viên | 🎒 Hoạt động học sinh | 📝 Nội dung lưu bảng |\n| :--- | :--- | :--- |\n| Giáo viên nhận xét, định hướng và chốt kiến thức trọng tâm. | Học sinh lắng nghe, chấm điểm đồng đẳng và rút ra bài học. | Khái quát kết luận bài học. |'
        }
      ];

  return {
    title: lesson.title,
    mục_tiêu: {
      kiến_thức: dynamicKiensThuc,
      năng_lực: [
        'NL1: Năng lực thích ứng cuộc sống & nhận diện cảm xúc',
        'NL2: Năng lực thiết kế và tổ chức hoạt động trải nghiệm',
        'NL3: Vận dụng kiến thức Sinh học giải thích hiện tượng thực tế'
      ],
      phẩm_chất: [
        'PC1: Trung thực, trách nhiệm với bản thân và gia đình',
        'PC2: Yêu thiên nhiên, chủ động chăm sóc sức khỏe tinh thần'
      ],
    },
    học_liệu: {
      giáo_viên: [
        `Giáo án Word chi tiết${durationAttr ? ` (${durationAttr})` : ''}`,
        'Slide bài giảng trình chiếu & Thẻ thảo luận nhóm',
        'Phiếu đánh giá Rubric sư phạm'
      ],
      học_sinh: [
        'Sổ tay ghi chép nhật ký học tập',
        'Dụng cụ học tập, bài tập trải nghiệm thực tế'
      ],
    },
    tiến_trình: tienTrinh.length > 0 ? tienTrinh : [
      { ten: 'Hoạt động 01: Khởi động & Tạo bối cảnh', time: '10 phút', tom_tat: 'Kích hoạt năng lượng lớp học, đặt câu hỏi bối cảnh thực tiễn.' },
      { ten: 'Hoạt động 02: Khám phá & Hình thành kiến thức', time: '25 phút', tom_tat: 'Nghiên cứu nội dung chuyên đề, làm việc nhóm tích hợp Sinh học.' },
      { ten: 'Hoạt động 03: Luyện tập & Vận dụng thực hành', time: '30 phút', tom_tat: 'Thực hành giải quyết bài toán tình huống và đóng vai trải nghiệm.' },
      { ten: 'Hoạt động 04: Báo cáo & Tổng kết đánh giá', time: '15 phút', tom_tat: 'Thuyết trình kết quả nhóm và chấm điểm chéo bằng Rubric.' }
    ],
    hoạt_động: hoatDong
  };
}

export function getLessonActivitiesTimeline(data: MindmapData): FormattedActivity[] {
  const result: FormattedActivity[] = [];
  const acts = data.hoạt_động && data.hoạt_động.length > 0 ? data.hoạt_động : [];
  const ttrinh = data.tiến_trình && data.tiến_trình.length > 0 ? data.tiến_trình : [];

  const isMeaningful = (text: any): boolean => {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('---')) return false;
    const clean = trimmed.replace(/^[-*•—|\s]+$/, '');
    return clean.length > 0 && clean !== '—' && clean !== '-' && clean !== '.' && clean !== '…';
  };

  if (acts.length > 0) {
    acts.forEach((act, idx) => {
      if (!isMeaningful(act.ten)) return;
      const matchingTtrinh = ttrinh.find(t => t.ten.toLowerCase().includes(act.ten.toLowerCase()) || act.ten.toLowerCase().includes(t.ten.toLowerCase()));
      const timeStr = (matchingTtrinh && matchingTtrinh.time) ? matchingTtrinh.time : `${10 + (idx % 4) * 5} phút`;
      
      const cleanTitle = act.ten;
      let summaryText = (matchingTtrinh && matchingTtrinh.tom_tat) ? matchingTtrinh.tom_tat : (act.muc_tieu || '');
      if (summaryText && (summaryText.includes('Tiến hành theo kịch bản') || summaryText.includes('Thực hiện theo kịch bản'))) {
        summaryText = '';
      }

      const detailsMarkdown = `### 📌 ${act.ten}${timeStr ? ` — ⏱️ ${timeStr}` : ''}\n\n### 🎯 Mục tiêu hoạt động\n${act.muc_tieu || 'Phát triển năng lực học sinh qua hoạt động trải nghiệm.'}\n\n### 🚀 Tiến trình thực hiện chi tiết\n${act.thuc_hien || (matchingTtrinh ? matchingTtrinh.tom_tat : 'Tiến hành theo kịch bản giáo án.')}`;

      result.push({
        title: cleanTitle,
        duration: timeStr,
        summary: summaryText,
        details: detailsMarkdown,
        category: 'TIẾN TRÌNH & HOẠT ĐỘNG DẠY HỌC'
      });
    });
  } else if (ttrinh.length > 0) {
    ttrinh.forEach((t, idx) => {
      if (!isMeaningful(t.ten)) return;
      const timeStr = t.time || `${10 + (idx % 4) * 5} phút`;
      const detailsMarkdown = `### 📌 ${t.ten} — ⏱️ ${timeStr}\n\n### 🚀 Tiến trình thực hiện\n${t.tom_tat}`;

      let summaryText = t.tom_tat.split('\n')[0] || t.tom_tat;
      if (summaryText && (summaryText.includes('Tiến hành theo kịch bản') || summaryText.includes('Thực hiện theo kịch bản'))) {
        summaryText = '';
      }

      result.push({
        title: t.ten,
        duration: timeStr,
        summary: summaryText,
        details: detailsMarkdown,
        category: 'TIẾN TRÌNH & HOẠT ĐỘNG DẠY HỌC'
      });
    });
  }

  return result;
}
