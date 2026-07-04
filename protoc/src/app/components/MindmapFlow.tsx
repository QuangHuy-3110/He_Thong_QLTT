import React, { useCallback, useMemo, useState } from 'react';

// ─── Pedagogical tips map (CTGDPT 2018) ──────────────────────────────────────
function getPedagogyTip(cat: string, label: string): string {
  const n = (cat + ' ' + label).toLowerCase();
  if (n.includes('kiến thức')) return '📘 Theo CTGDPT 2018 – Năng lực nhận thức sinh học:\n• Định hướng: Cung cấp kiến thức nền tảng về thế giới sống ở các cấp độ (phân tử, tế bào, cơ thể, quần thể, quần xã, hệ sinh thái).\n• Cấp độ Bloom: Nhận biết, Thông hiểu, Phân tích.\n• Đề xuất phương pháp: Hỏi đáp tìm tòi, dạy học nêu vấn đề, sơ đồ hóa kiến thức, quan sát mẫu vật/mô hình trực quan.\n• Hướng dẫn GV: Tránh truyền đạt một chiều; khuyến khích HS tự rút ra kết luận khoa học qua hệ thống câu hỏi dẫn dắt.';
  if (n.includes('năng lực')) return '⚡ Theo CTGDPT 2018 – Phát triển năng lực sinh học đặc thù và năng lực chung:\n• Năng lực đặc thù: Nhận thức sinh học, tìm hiểu thế giới sống, vận dụng kiến thức và kĩ năng đã học.\n• Năng lực chung: Tự chủ & tự học, Giao tiếp & hợp tác, Giải quyết vấn đề & sáng tạo.\n• Đề xuất phương pháp: Dạy học dựa trên dự án (PBL), dạy học khám phá, thực hành thí nghiệm phòng lab, đóng vai xử lý tình huống.\n• Hướng dẫn GV: Thiết kế hoạt động thực hành, điều tra thực địa để HS làm chủ quy trình khoa học.';
  if (n.includes('phẩm chất')) return '💎 Theo CTGDPT 2018 – Giáo dục 5 phẩm chất chủ yếu:\n• Yêu nước, Nhân ái, Chăm chỉ, Trung thực, Trách nhiệm.\n• Đặc thù môn Sinh: Phát triển tình yêu thiên nhiên, ý thức bảo vệ môi trường, đa dạng sinh học và chăm sóc sức khỏe bản thân/cộng đồng.\n• Đề xuất phương pháp: Tích hợp giáo dục phẩm chất thông qua các nhiệm vụ làm việc nhóm, rèn luyện tính trung thực khi ghi chép kết quả thí nghiệm và tinh thần trách nhiệm với môi trường sống.';
  if (n.includes('giáo viên') || n.includes('học liệu')) return '🛠️ Theo CTGDPT 2018 – Chuẩn bị thiết bị dạy học và học liệu:\n• Yêu cầu học liệu: Đảm bảo tính khoa học, trực quan và an toàn sinh học. Ưu tiên mẫu vật thật (cây, con), tiêu bản hiển vi, mô hình giải phẫu, video tư liệu khoa học chân thực.\n• Ứng dụng công nghệ: Sử dụng mô phỏng số, phòng thí nghiệm ảo khi thiếu trang thiết bị vật lý.\n• Hướng dẫn GV: Chuẩn bị sẵn phiếu học tập định hướng (Task sheet) rõ ràng để giao nhiệm vụ cho từng nhóm.';
  if (n.includes('học sinh')) return '🎒 Theo CTGDPT 2018 – Hoạt động chuẩn bị của học sinh:\n• Chuẩn bị cá nhân: Đọc trước tài liệu sách giáo khoa hoặc xem video kiến thức nền tảng giáo viên cung cấp trước lớp (Flipped Classroom).\n• Thu thập mẫu vật: Sưu tầm các mẫu vật thực tế đơn giản tại địa phương theo hướng dẫn an toàn của giáo viên (ví dụ: lá cây, hoa, mẫu nước ao hồ).\n• Ý thức tự học: Hoàn thành đầy đủ các nhiệm vụ tự học cá nhân trong phiếu chuẩn bị bài.';
  if (n.includes('khởi động') || n.includes('kích hoạt')) return '🚀 Theo CTGDPT 2018 – Pha Khởi động (5-10 phút):\n• Mục tiêu: Kích thích sự tò mò, tạo nhu cầu nhận thức và liên kết với kiến thức nền đã có của học sinh.\n• Kĩ thuật hiệu quả: Đưa ra hiện tượng thực tế mâu thuẫn nhận thức (ví dụ: tại sao cây mọc nghiêng về phía ánh sáng?), trò chơi ô chữ sinh học, xem video ngắn về hành vi động vật.\n• Hướng dẫn GV: Chỉ khơi gợi vấn đề, tuyệt đối không giải thích sâu hay chốt kiến thức mới trong pha này.';
  if (n.includes('khám phá') || n.includes('tìm hiểu')) return '🔍 Theo CTGDPT 2018 – Pha Khám phá / Hình thành kiến thức mới (20-25 phút):\n• Mục tiêu: HS tự lực xây dựng kiến thức thông qua hành động nghiên cứu.\n• Kĩ thuật: Nghiên cứu tài liệu (Jigsaw), quan sát mẫu vật dưới kính hiển vi, thảo luận nhóm để giải quyết câu hỏi trong phiếu học tập.\n• Hướng dẫn GV: Đóng vai trò là người đồng hành, định hướng khi các nhóm gặp bế tắc. Tiến hành chuẩn hóa kiến thức sau khi HS báo cáo kết quả tự học.';
  if (n.includes('luyện tập') || n.includes('thực hành')) return '💪 Theo CTGDPT 2018 – Pha Luyện tập / Thực hành (20-25 phút):\n• Mục tiêu: Khắc sâu kiến thức, phát triển kĩ năng tư duy sinh học thông qua hệ thống câu hỏi, bài tập có tính phân hóa.\n• Hoạt động chính: Giải bài tập di truyền/sinh thái, hoàn thành sơ đồ tư duy hệ thống hóa bài học, thực hiện các thao tác thực hành (ví dụ: làm tiêu bản tế bào).\n• Hướng dẫn GV: Quan sát, hỗ trợ và chỉnh sửa các thao tác thực hành sai sót của học sinh kịp thời.';
  if (n.includes('chia sẻ') || n.includes('báo cáo')) return '🎤 Theo CTGDPT 2018 – Pha Chia sẻ / Báo cáo kết quả (10-15 phút):\n• Mục tiêu: Rèn luyện năng lực ngôn ngữ, kĩ năng giao tiếp khoa học và khả năng thuyết trình trước đám đông.\n• Hoạt động chính: Đại diện nhóm báo cáo kết quả thảo luận hoặc sản phẩm thực hành. Các nhóm khác nhận xét, phản biện lành mạnh.\n• Đánh giá: Áp dụng đánh giá đồng đẳng (Peer assessment) theo tiêu chí (Rubric) được giáo viên thống nhất từ trước.';
  if (n.includes('vận dụng') || n.includes('liên hệ')) return '🌏 Theo CTGDPT 2018 – Pha Vận dụng & Mở rộng (10 phút + tự học ở nhà):\n• Mục tiêu: Chuyển hóa kiến thức lớp học thành hành động thực tế, giải quyết các vấn đề thực tiễn đời sống địa phương.\n• Hoạt động chính: Đề xuất giải pháp bảo vệ môi trường, phòng tránh dịch bệnh, chế biến thực phẩm lên men tại nhà (làm sữa chua, muối dưa), hoặc giải thích các hiện tượng thực tế sinh hoạt.\n• Hướng dẫn GV: Giao nhiệm vụ mở dưới dạng dự án nhỏ, tạo điều kiện cho HS sáng tạo sản phẩm hữu hình.';
  return '📋 Theo CTGDPT 2018 – Định hướng giáo dục phát triển phẩm chất và năng lực:\n• Trọng tâm chuyển dịch: Chuyển từ truyền thụ kiến thức đơn thuần sang hình thành các năng lực khoa học thực tiễn và phẩm chất sống cốt lõi.\n• Học thông qua làm: Đặt học sinh vào trung tâm của mọi hoạt động học tập, khuyến khích tự học và trải nghiệm khám phá thế giới sống.\n• Đánh giá đa dạng: Đánh giá thường xuyên kết hợp đánh giá định kì, coi trọng đánh giá quá trình và sản phẩm thực hành của học sinh.';
}
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import { MarkdownViewer } from '../App';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MindmapData {
  title: string;
  mục_tiêu: { kiến_thức: string[]; năng_lực: string[]; phẩm_chất: string[] };
  học_liệu: { giáo_viên: string[]; học_sinh: string[] };
  tiến_trình: { ten: string; time: string; tom_tat: string }[];
  hoạt_động: { ten: string; muc_tieu: string; thuc_hien: string }[];
}

interface NodeDetailItem {
  title: string;
  category: string;
  details: string;
  tip: string;
  color: string;
}

interface MindmapFlowProps {
  data: MindmapData;
}

// ─── Node color config ────────────────────────────────────────────────────────

const COLORS = {
  root:   { bg: 'linear-gradient(135deg,#6366f1,#8b5cf6)', text: '#fff', border: '#6366f1' },
  b1:     { bg: 'linear-gradient(135deg,#3b82f6,#06b6d4)', text: '#fff', border: '#3b82f6' },
  b2:     { bg: 'linear-gradient(135deg,#10b981,#14b8a6)', text: '#fff', border: '#10b981' },
  b3:     { bg: 'linear-gradient(135deg,#f59e0b,#f97316)', text: '#fff', border: '#f59e0b' },
  b4:     { bg: 'linear-gradient(135deg,#ec4899,#f43f5e)', text: '#fff', border: '#ec4899' },
  leaf:   { bg: '#ffffff', text: '#1e293b', border: '#e2e8f0' },
};

// ─── Custom Node Components ────────────────────────────────────────────────────

const RootNode = ({ data }: NodeProps) => (
  <div
    style={{
      background: COLORS.root.bg,
      color: COLORS.root.text,
      border: `2px solid ${COLORS.root.border}`,
      borderRadius: 20,
      padding: '14px 22px',
      minWidth: 180,
      textAlign: 'center',
      fontWeight: 900,
      fontSize: 13,
      boxShadow: '0 8px 32px rgba(99,102,241,0.35)',
      cursor: 'default',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLElement).style.transform = 'scale(1.12)';
      (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 40px rgba(99,102,241,0.5)';
      (e.currentTarget as HTMLElement).style.zIndex = '50';
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLElement).style.transform = 'none';
      (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(99,102,241,0.35)';
      (e.currentTarget as HTMLElement).style.zIndex = 'auto';
    }}
  >
    <Handle type="source" position={Position.Right} id="right" style={{ opacity: 0 }} />
    <Handle type="source" position={Position.Left} id="left" style={{ opacity: 0 }} />
    <div style={{ fontSize: 24, marginBottom: 4 }}>📚</div>
    <div style={{ fontSize: 9, opacity: 0.8, letterSpacing: 2, marginBottom: 4, textTransform: 'uppercase' }}>Chủ đề gốc</div>
    <div style={{ lineHeight: 1.3 }}>{data.label as string}</div>
  </div>
);

const BranchNode = ({ data }: NodeProps) => {
  const d = data as any;
  const isLeft = d.side === 'left';
  return (
    <div
      style={{
        background: d.bg,
        color: '#fff',
        borderRadius: 16,
        padding: '10px 18px',
        minWidth: 160,
        textAlign: 'center',
        fontWeight: 800,
        fontSize: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        cursor: 'default',
        border: '2px solid rgba(255,255,255,0.3)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(1.12)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(0,0,0,0.25)';
        (e.currentTarget as HTMLElement).style.zIndex = '50';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = 'none';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
        (e.currentTarget as HTMLElement).style.zIndex = 'auto';
      }}
    >
      <Handle type="target" position={isLeft ? Position.Right : Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={isLeft ? Position.Left : Position.Right} style={{ opacity: 0 }} />
      <div style={{ fontSize: 18, marginBottom: 3 }}>{d.icon}</div>
      <div style={{ fontSize: 9, opacity: 0.85, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 }}>{d.sub}</div>
      <div style={{ lineHeight: 1.3 }}>{d.label as string}</div>
    </div>
  );
};

const LeafNode = ({ data }: NodeProps) => {
  const d = data as any;
  const isLeft = d.side === 'left';
  return (
    <div
      onClick={d.onClick}
      style={{
        background: '#ffffff',
        border: `1.5px solid ${d.accent}33`,
        borderLeft: isLeft ? 'none' : `4px solid ${d.accent}`,
        borderRight: isLeft ? `4px solid ${d.accent}` : 'none',
        borderRadius: 12,
        padding: '8px 12px',
        maxWidth: 220,
        fontSize: 11,
        fontWeight: 600,
        color: '#334155',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(1.15)';
        (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${d.accent}44`;
        (e.currentTarget as HTMLElement).style.zIndex = '50';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = 'none';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)';
        (e.currentTarget as HTMLElement).style.zIndex = 'auto';
      }}
    >
      <Handle type="target" position={isLeft ? Position.Right : Position.Left} style={{ opacity: 0 }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, textAlign: isLeft ? 'right' : 'left', flexDirection: isLeft ? 'row-reverse' : 'row' }}>
        <span style={{ color: d.accent, flexShrink: 0, fontSize: 12 }}>{d.icon}</span>
        <span style={{ lineHeight: 1.4 }}>{d.label as string}</span>
      </div>
      <div style={{ fontSize: 9, color: d.accent, fontWeight: 700, marginTop: 4, textAlign: isLeft ? 'left' : 'right', opacity: 0.8 }}>
        {isLeft ? '‹ Xem chi tiết' : 'Xem chi tiết ›'}
      </div>
    </div>
  );
};

const nodeTypes = { root: RootNode, branch: BranchNode, leaf: LeafNode };

// ─── Layout builder ────────────────────────────────────────────────────────────

function buildGraph(data: MindmapData, onLeafClick: (item: NodeDetailItem) => void) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const isMeaningful = (text: any): boolean => {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('---')) return false;
    const clean = trimmed.replace(/^[-*•—|\s]+$/, '');
    return clean.length > 0 && clean !== '—' && clean !== '-' && clean !== '.' && clean !== '…';
  };

  const addEdge_ = (source: string, target: string, color: string, sourceHandle?: string) => {
    edges.push({
      id: `${source}-${target}`,
      source, target,
      sourceHandle,
      type: 'smoothstep',
      animated: false,
      style: { stroke: color, strokeWidth: 2 },
    });
  };

  // Root
  nodes.push({ id: 'root', type: 'root', position: { x: 0, y: 0 }, data: { label: data.title }, draggable: true });

  // Calculate dynamic heights & offsets to prevent vertical overlap of leaf blocks on the same side
  const b1_leaves_raw = [
    ...data.mục_tiêu.kiến_thức.filter(isMeaningful).map(t => ({ label: t, icon: '📚', cat: 'Mục tiêu – Kiến thức', details: t, tip: getPedagogyTip('kiến thức', t) })),
    ...data.mục_tiêu.năng_lực.filter(isMeaningful).map(t => ({ label: t, icon: '⚡', cat: 'Mục tiêu – Năng lực', details: t, tip: getPedagogyTip('năng lực', t) })),
    ...data.mục_tiêu.phẩm_chất.filter(isMeaningful).map(t => ({ label: t, icon: '💎', cat: 'Mục tiêu – Phẩm chất', details: t, tip: getPedagogyTip('phẩm chất', t) })),
  ];
  const b2_leaves_raw = [
    ...data.học_liệu.giáo_viên.filter(isMeaningful).map(t => ({ label: t, icon: '👨‍🏫', cat: 'Học liệu – Giáo viên', details: t, tip: getPedagogyTip('giáo viên học liệu', t) })),
    ...data.học_liệu.học_sinh.filter(isMeaningful).map(t => ({ label: t, icon: '🎒', cat: 'Học liệu – Học sinh', details: t, tip: getPedagogyTip('học sinh', t) })),
  ];
  const b3_leaves_raw = data.tiến_trình.filter(t => isMeaningful(t.ten)).map(t => ({
    label: `${t.ten} (${t.time})`,
    icon: '▶',
    cat: 'Khung tiến trình',
    details: t.tom_tat,
    tip: getPedagogyTip(t.ten, t.tom_tat),
  }));
  const b4_leaves_raw = data.hoạt_động.filter(t => isMeaningful(t.ten)).map(t => ({
    label: t.ten,
    icon: '🎯',
    cat: 'Hoạt động dạy học',
    details: `### 🎯 Mục tiêu\n${t.muc_tieu || 'Đạt mục tiêu của hoạt động trải nghiệm.'}\n\n### 🚀 Cách thực hiện\n${t.thuc_hien || 'Tiến hành theo kịch bản giáo án.'}`,
    tip: getPedagogyTip(t.ten, t.muc_tieu + ' ' + t.thuc_hien),
  }));

  const leafSpacing = 85; // increased from 68 to 85 for breathing room
  const verticalGap = 120; // safe gap between leaf blocks

  const b1_height = b1_leaves_raw.length * leafSpacing;
  const b2_height = b2_leaves_raw.length * leafSpacing;
  const b1_y = Math.min(-220, - (b1_height / 2 + verticalGap / 2));
  const b2_y = Math.max(220, (b2_height / 2 + verticalGap / 2));

  const b3_height = b3_leaves_raw.length * leafSpacing;
  const b4_height = b4_leaves_raw.length * leafSpacing;
  const b3_y = Math.min(-220, - (b3_height / 2 + verticalGap / 2));
  const b4_y = Math.max(220, (b4_height / 2 + verticalGap / 2));

  const branches = [
    {
      id: 'b1', label: 'MỤC TIÊU DẠY HỌC', icon: '🎯', sub: 'Mục tiêu',
      bg: COLORS.b1.bg, accent: '#3b82f6', y: b1_y, side: 'left', sourceHandle: 'left',
      leaves: b1_leaves_raw,
    },
    {
      id: 'b2', label: 'THIẾT BỊ & HỌC LIỆU', icon: '🛠️', sub: 'Học liệu',
      bg: COLORS.b2.bg, accent: '#10b981', y: b2_y, side: 'left', sourceHandle: 'left',
      leaves: b2_leaves_raw,
    },
    {
      id: 'b3', label: 'KHUNG TIẾN TRÌNH', icon: '⏱️', sub: 'Tiến trình',
      bg: COLORS.b3.bg, accent: '#f59e0b', y: b3_y, side: 'right', sourceHandle: 'right',
      leaves: b3_leaves_raw,
    },
    {
      id: 'b4', label: 'TRẢI NGHIỆM CHI TIẾT', icon: '🤸', sub: 'Hoạt động',
      bg: COLORS.b4.bg, accent: '#ec4899', y: b4_y, side: 'right', sourceHandle: 'right',
      leaves: b4_leaves_raw,
    },
  ];

  branches.forEach(b => {
    const isLeft = b.side === 'left';
    nodes.push({
      id: b.id, type: 'branch',
      position: { x: isLeft ? -350 : 350, y: b.y },
      data: { label: b.label, icon: b.icon, sub: b.sub, bg: b.bg, side: b.side },
      draggable: true,
    });
    addEdge_('root', b.id, b.accent, b.sourceHandle);

    b.leaves.forEach((leaf, i) => {
      const lid = `${b.id}_leaf${i}`;
      const item: NodeDetailItem = {
        title: leaf.label,
        category: leaf.cat,
        details: leaf.details,
        tip: leaf.tip,
        color: b.accent,
      };
      nodes.push({
        id: lid, type: 'leaf',
        position: { x: isLeft ? -720 : 720, y: b.y - ((b.leaves.length - 1) * leafSpacing) / 2 + i * leafSpacing },
        data: {
          label: leaf.label.length > 80 ? leaf.label.slice(0, 78) + '…' : leaf.label,
          icon: leaf.icon,
          accent: b.accent,
          side: b.side,
          onClick: () => onLeafClick(item),
          item: item,
        },
        draggable: true,
      });
      addEdge_(b.id, lid, b.accent + '88');
    });
  });

  return { nodes, edges };
}

// ─── Modal ─────────────────────────────────────────────────────────────────────

const DetailModal = ({ item, onClose }: { item: NodeDetailItem; onClose: () => void }) => (
  <div
    style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}
    onClick={onClose}
  >
    <div
      style={{
        background: '#fff', borderRadius: 24, width: '100%', maxWidth: 1140,
        boxShadow: '0 24px 80px rgba(15,23,42,0.18)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        animation: 'modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        borderTop: `6px solid ${item.color}`,
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{ background: '#ffffff', padding: '22px 28px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', justifySelf: 'stretch', justifyItems: 'stretch', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <span style={{
              display: 'inline-block', padding: '3px 12px', borderRadius: 99,
              background: `${item.color}15`, border: `1px solid ${item.color}33`,
              fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase',
              color: item.color, marginBottom: 8,
            }}>📂 {item.category}</span>
            <div style={{ fontWeight: 900, fontSize: 22, lineHeight: 1.4, color: '#0f172a' }}>
              {item.title.split('\n')[0].replace(/^(Tên:|Mục tiêu:)\s*/i, '')}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9', border: 'none', borderRadius: 99,
              width: 32, height: 32, cursor: 'pointer', color: '#64748b', fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e2e8f0'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; }}
          >✕</button>
        </div>
      </div>

      {/* Body */}
      <div style={{
        padding: '24px 28px',
        maxHeight: '72vh',
        overflowY: 'auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: 24,
        background: '#fafbfc',
      }}>
        {/* Left Column: Description */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>📝 MÔ TẢ NỘI DUNG</div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', flexGrow: 1, overflowX: 'auto', fontSize: 14.5, lineHeight: 1.75 }}>
            <MarkdownViewer markdown={item.details} />
          </div>
        </div>

        {/* Right Column: Pedagogical Tip */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: '#059669', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>💡 ĐỊNH HƯỚNG SƯ PHẠM – CTGDPT 2018</div>
          <div style={{
            background: 'linear-gradient(135deg,#ffffff,#f0fdf4)',
            border: '1.5px solid #a7f3d0',
            borderRadius: 16,
            padding: '20px',
            boxShadow: '0 4px 12px rgba(5,150,105,0.03)',
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 22 }}>🏫</span>
              <span style={{ fontSize: 12, fontWeight: 900, color: '#065f46', letterSpacing: 0.5 }}>Căn cứ: Thông tư 32/2018/TT-BGDĐT – Bộ GD&ĐT</span>
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: '#064e3b', lineHeight: 1.95, whiteSpace: 'pre-line' }}>
              {item.tip}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '16px 28px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', background: '#fff' }}>
        <button
          onClick={onClose}
          style={{
            background: '#0f172a', color: '#fff', border: 'none', borderRadius: 12,
            padding: '10px 28px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        >Đóng cửa sổ</button>
      </div>
    </div>
    <style>{`@keyframes modalIn { from { opacity:0; transform:scale(0.94) } to { opacity:1; transform:scale(1) } }`}</style>
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────

const MindmapFlowInner: React.FC<MindmapFlowProps> = ({ data }) => {
  const [activeItem, setActiveItem] = useState<NodeDetailItem | null>(null);
  const { fitView } = useReactFlow();

  const { nodes: initNodes, edges: initEdges } = useMemo(
    () => buildGraph(data, setActiveItem),
    [data]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge({ ...params, type: 'smoothstep', animated: true }, eds)),
    [setEdges]
  );

  const handleReset = useCallback(() => {
    setNodes(initNodes);
    setEdges(initEdges);
  }, [initNodes, initEdges, setNodes, setEdges]);

  const handleCenter = useCallback(() => {
    fitView({ duration: 800, padding: 0.15 });
  }, [fitView]);

  const handleExport = useCallback(() => {
    const flowEl = document.querySelector('.react-flow') as HTMLElement;
    if (!flowEl) return;

    const controls = flowEl.querySelector('.react-flow__controls') as HTMLElement;
    const minimap = flowEl.querySelector('.react-flow__minimap') as HTMLElement;

    if (controls) controls.style.visibility = 'hidden';
    if (minimap) minimap.style.visibility = 'hidden';

    toPng(flowEl, {
      backgroundColor: '#ffffff',
      cacheBust: true,
    })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `sơ_đồ_tư_duy_${data.title || 'giao_an'}.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error('Không thể xuất ảnh sơ đồ:', err);
      })
      .finally(() => {
        if (controls) controls.style.visibility = 'visible';
        if (minimap) minimap.style.visibility = 'visible';
      });
  }, [data.title]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
        <Controls style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }} />
        <MiniMap
          nodeColor={n => {
            if (n.type === 'root') return '#6366f1';
            if (n.type === 'branch') return (n.data as any).bg?.includes('3b82f6') ? '#3b82f6' : '#10b981';
            return '#e2e8f0';
          }}
          style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
        />
      </ReactFlow>

      {/* Floating hint + Reset button */}
      <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 10, alignItems: 'center' }}>
        <div style={{
          background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
          border: '1px solid #e2e8f0', borderRadius: 99, padding: '6px 16px',
          fontSize: 11, fontWeight: 700, color: '#64748b',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none',
        }}>
          <span>🖱️</span> Kéo node • Scroll zoom • Click lá xem chi tiết
        </div>
        <button
          onClick={handleReset}
          title="Khôi phục sơ đồ về vị trí ban đầu"
          style={{
            background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
            border: '1px solid #e2e8f0', borderRadius: 99, padding: '6px 14px',
            fontSize: 11, fontWeight: 800, color: '#6366f1',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f5f3ff'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.95)'; }}
        >🔄 Reset</button>
        <button
          onClick={handleCenter}
          title="Đưa sơ đồ về trung tâm khung nhìn"
          style={{
            background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
            border: '1px solid #e2e8f0', borderRadius: 99, padding: '6px 14px',
            fontSize: 11, fontWeight: 800, color: '#3b82f6',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#eff6ff'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.95)'; }}
        >🎯 Về giữa</button>
        <button
          onClick={handleExport}
          title="Tải sơ đồ tư duy dạng ảnh PNG"
          style={{
            background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
            border: '1px solid #e2e8f0', borderRadius: 99, padding: '6px 14px',
            fontSize: 11, fontWeight: 800, color: '#059669',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#ecfdf5'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.95)'; }}
        >📸 Tải ảnh</button>
      </div>

      {activeItem && <DetailModal item={activeItem} onClose={() => setActiveItem(null)} />}
    </div>
  );
};

const MindmapFlow: React.FC<MindmapFlowProps> = (props) => (
  <ReactFlowProvider>
    <MindmapFlowInner {...props} />
  </ReactFlowProvider>
);

export default MindmapFlow;
