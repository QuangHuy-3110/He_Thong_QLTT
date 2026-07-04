import React, { useMemo } from 'react';
import MindmapFlow from '../chatbot/MindmapFlow';
import { parseMarkdownLessonPlan } from '../../utils/helpers';
import { LessonPlan } from '../../utils/types';

interface InteractiveLessonMindmapProps {
  lesson: LessonPlan;
  isFullscreen?: boolean;
}

export const InteractiveLessonMindmap: React.FC<InteractiveLessonMindmapProps> = ({ lesson, isFullscreen }) => {
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

export default InteractiveLessonMindmap;
