import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X } from 'lucide-react';
import axios from 'axios';

interface GraphNode {
  id: string;
  label: string;
  type: 'lesson' | 'directory' | 'tag' | 'user';
  val: number;
  color: string;
  details: string;
  highlighted?: boolean;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
  color: string;
  highlighted?: boolean;
}

interface GraphTabProps {
  widgetSize: { width: number; height: number };
  focusLessonId: number | null;
  focusLesson: any;
  currentUser: any;
  isMobile: boolean;
  setInputMessage: (msg: string) => void;
  setActiveTab: (tab: 'chat' | 'graph' | 'wiki' | 'settings') => void;
  setIsOpen: (open: boolean) => void;
  isDetailOpen?: boolean;
  onSelectDirectory?: (dirId: number) => void;
  onViewLessonDetail?: (lesson: any, highlightQuery?: string) => void;
  lessonPlans: any[];
  obsidianNotes: any[];
  setObsidianNotes: (notes: any[]) => void;
  fetchNoteContent: (note: any, skipPush?: boolean) => void;
  selectedObsidianNote: any;
  pushCurrentViewToHistory: () => void;
  setHistoryStack: React.Dispatch<React.SetStateAction<any[]>>;
  activeRetrievedNodeIds?: string[];
}

export default function GraphTab({
  widgetSize,
  focusLessonId,
  focusLesson,
  currentUser,
  isMobile,
  setInputMessage,
  setActiveTab,
  setIsOpen,
  isDetailOpen = false,
  onSelectDirectory,
  onViewLessonDetail,
  lessonPlans,
  obsidianNotes,
  setObsidianNotes,
  fetchNoteContent,
  selectedObsidianNote,
  pushCurrentViewToHistory,
  setHistoryStack,
  activeRetrievedNodeIds = [],
}: GraphTabProps) {
  // Graph state (Full system graph cached)
  const [fullGraph, setFullGraph] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [clickedNodeId, setClickedNodeId] = useState<string | null>(null);
  const [graphHopDistance, setGraphHopDistance] = useState<number>(2); // Số hop hiển thị
  const [nodePopup, setNodePopup] = useState<{ node: GraphNode; x: number; y: number } | null>(null); // Popup hover node
  const [pinnedPopup, setPinnedPopup] = useState<{
    node: GraphNode;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [visibleNodeTypes, setVisibleNodeTypes] = useState<Record<'lesson' | 'directory' | 'tag' | 'user', boolean>>({
    lesson: true,
    directory: true,
    tag: true,
    user: true
  });
  const [clickHopDepth, setClickHopDepth] = useState<number>(1); // Số hop highlight khi click node

  // BFS từ clickedNodeId → map nodeId → hop distance
  const clickedNodeHopMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!clickedNodeId) return map;
    map.set(clickedNodeId, 0);
    let frontier = [clickedNodeId];
    for (let hop = 1; hop <= clickHopDepth; hop++) {
      const nextFrontier: string[] = [];
      for (const nodeId of frontier) {
        for (const edge of fullGraph.edges) {
          let neighbor: string | null = null;
          if (edge.source === nodeId) neighbor = edge.target;
          else if (edge.target === nodeId) neighbor = edge.source;
          if (neighbor && !map.has(neighbor)) {
            map.set(neighbor, hop);
            nextFrontier.push(neighbor);
          }
        }
      }
      frontier = nextFrontier;
    }
    return map;
  }, [clickedNodeId, clickHopDepth, fullGraph.edges]);

  // Canvas Graph rendering refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphNodesRef = useRef<GraphNode[]>([]);
  const graphEdgesRef = useRef<GraphEdge[]>([]);
  const simulationAlphaRef = useRef(1.0);
  
  // Zoom & Pan state for Graph Canvas
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const [transformTrigger, setTransformTrigger] = useState(0);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const clickStartPos = useRef<{ x: number; y: number } | null>(null);
  const hoveredNodeRef = useRef<GraphNode | null>(null);
  const selectedNodeRef = useRef<GraphNode | null>(null);

  // Popup resize and drag state
  const isResizingPopup = useRef<string | null>(null);
  const isDraggingPopup = useRef<boolean>(false);
  const resizeStartPopup = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const dragStartPopup = useRef({ x: 0, y: 0, px: 0, py: 0 });

  // Fetch graph data
  useEffect(() => {
    setLoadingGraph(true);
    const url = focusLessonId
      ? `/api/chat-graph/?user_id=${currentUser?.id}&lesson_id=${focusLessonId}&hop_depth=${graphHopDistance}`
      : `/api/chat-graph/?user_id=${currentUser?.id}`;
    axios.get(url)
      .then(res => {
        setFullGraph(res.data);
      })
      .catch(err => {
        console.error('Error fetching graph data:', err);
      })
      .finally(() => {
        setLoadingGraph(false);
      });
  }, [focusLessonId, currentUser, graphHopDistance]);

  // Initialize node physics positions when graph data changes
  useEffect(() => {
    const nodes = fullGraph.nodes.map(node => {
      const existing = graphNodesRef.current.find(n => n.id === node.id);
      return {
        ...node,
        x: existing ? existing.x : Math.random() * widgetSize.width,
        y: existing ? existing.y : Math.random() * (widgetSize.height - 120),
        vx: existing ? existing.vx : 0,
        vy: existing ? existing.vy : 0
      };
    });
    graphNodesRef.current = nodes;
    graphEdgesRef.current = fullGraph.edges;
    simulationAlphaRef.current = 1.0;
  }, [fullGraph, widgetSize]);

  // Prevent browser zoom and page scroll when wheeling over the Canvas graph natively
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomIntensity = 0.1;
      const scaleFactor = e.deltaY < 0 ? (1 + zoomIntensity) : (1 - zoomIntensity);
      
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newScale = Math.min(Math.max(transformRef.current.scale * scaleFactor, 0.2), 4.0);
      const graphX = (mouseX - transformRef.current.x) / transformRef.current.scale;
      const graphY = (mouseY - transformRef.current.y) / transformRef.current.scale;

      transformRef.current = {
        scale: newScale,
        x: mouseX - graphX * newScale,
        y: mouseY - graphY * newScale
      };
      setTransformTrigger(p => p + 1);
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [widgetSize]);

  // Force-directed physics loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const targetW = rect.width > 0 ? rect.width : widgetSize.width;
      const targetH = rect.height > 0 ? rect.height : (widgetSize.height - 120);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        simulationAlphaRef.current = 0.25;
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let animationFrameId: number;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const repulsion = 150;
    const attraction = 0.02;
    const gravity = 0.015;
    const friction = 0.78;

    const simulatePhysics = () => {
      resizeCanvas();
      if (simulationAlphaRef.current < 0.005) {
        return;
      }
      if (selectedNodeRef.current) {
        simulationAlphaRef.current = 0.25;
      }

      const nodes = graphNodesRef.current;
      const edges = graphEdgesRef.current;
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dx = n2.x! - n1.x!;
          const dy = n2.y! - n1.y!;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;
          
          if (dist < 280) {
            const clampDist = Math.max(dist, 25);
            const force = (repulsion * repulsion) / (clampDist * clampDist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            n1.vx! -= fx;
            n1.vy! -= fy;
            n2.vx! += fx;
            n2.vy! += fy;
          }
        }
      }

      edges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          if (!visibleNodeTypes[sourceNode.type] || !visibleNodeTypes[targetNode.type]) {
            return;
          }
          const dx = targetNode.x! - sourceNode.x!;
          const dy = targetNode.y! - sourceNode.y!;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;
          
          const force = attraction * (dist - 140);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          
          sourceNode.vx! += fx;
          sourceNode.vy! += fy;
          targetNode.vx! -= fx;
          targetNode.vy! -= fy;
        }
      });

      nodes.forEach(node => {
        node.vx! += (centerX - node.x!) * gravity;
        node.vy! += (centerY - node.y!) * gravity;

        if (node !== selectedNodeRef.current) {
          node.x! += node.vx!;
          node.y! += node.vy!;
          node.vx! *= friction;
          node.vy! *= friction;
        } else {
          node.vx = 0;
          node.vy = 0;
        }
      });

      simulationAlphaRef.current *= 0.975;
    };

    const drawGraph = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.save();
      ctx.translate(transformRef.current.x, transformRef.current.y);
      ctx.scale(transformRef.current.scale, transformRef.current.scale);

      const nodes = graphNodesRef.current;
      const edges = graphEdgesRef.current;

      const hopColors = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#f97316'];

      // Draw Edges
      edges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          if (!visibleNodeTypes[sourceNode.type] || !visibleNodeTypes[targetNode.type]) {
            return;
          }
          ctx.beginPath();
          ctx.moveTo(sourceNode.x!, sourceNode.y!);
          ctx.lineTo(targetNode.x!, targetNode.y!);

          const sourceHop = clickedNodeHopMap.get(edge.source);
          const targetHop = clickedNodeHopMap.get(edge.target);
          const bothInRange = sourceHop !== undefined && targetHop !== undefined;
          
          if (bothInRange) {
            const maxHop = Math.max(sourceHop, targetHop);
            const edgeColor = hopColors[Math.min(maxHop, hopColors.length - 1)];
            ctx.strokeStyle = edgeColor;
            ctx.lineWidth = Math.max(1.5, 3.5 - maxHop * 0.5);
            ctx.shadowColor = edgeColor;
            ctx.shadowBlur = Math.max(3, 10 - maxHop * 2);
          } else if (edge.highlighted || (activeRetrievedNodeIds.includes(edge.source) && activeRetrievedNodeIds.includes(edge.target))) {
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 3.5;
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 10;
          } else {
            ctx.strokeStyle = clickedNodeId ? 'rgba(226, 232, 240, 0.25)' : '#e2e8f0';
            ctx.lineWidth = 1.0;
            ctx.shadowBlur = 0;
          }
          ctx.stroke();
        }
      });
      ctx.shadowBlur = 0;

      // Draw Nodes
      nodes.forEach(node => {
        if (!visibleNodeTypes[node.type]) {
          return;
        }
        const isHighlighted = activeRetrievedNodeIds.includes(node.id);
        const hopDist = clickedNodeHopMap.get(node.id);
        const isInHopRange = hopDist !== undefined;
        const isClicked = hopDist === 0;
        
        const r = node.type === 'lesson' ? 8 : node.type === 'directory' ? 6 : node.type === 'user' ? 5 : 4;
        
        ctx.beginPath();
        
        if (isClicked) {
          ctx.arc(node.x!, node.y!, r + 8 + Math.sin(Date.now() / 150) * 2, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
          ctx.fill();
          ctx.beginPath();
        } else if (isInHopRange) {
          const hColor = hopColors[Math.min(hopDist!, hopColors.length - 1)];
          const pulseR = r + 5 + Math.sin(Date.now() / 250 + hopDist! * 0.5) * 2;
          ctx.arc(node.x!, node.y!, pulseR, 0, 2 * Math.PI);
          ctx.fillStyle = hColor + '30';
          ctx.fill();
          ctx.beginPath();
        } else if (isHighlighted) {
          ctx.arc(node.x!, node.y!, r + 6 + Math.sin(Date.now() / 200) * 3, 0, 2 * Math.PI);
          ctx.fillStyle = `${node.color}33`;
          ctx.fill();
          ctx.beginPath();
        }

        ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI);
        
        if (clickedNodeId && !isInHopRange) {
          ctx.fillStyle = `${node.color}35`;
        } else {
          ctx.fillStyle = node.color;
        }
        ctx.fill();
        
        if (isClicked) {
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#3b82f6';
        } else if (isInHopRange) {
          const hColor = hopColors[Math.min(hopDist!, hopColors.length - 1)];
          ctx.lineWidth = 2;
          ctx.strokeStyle = hColor;
        } else {
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = '#ffffff';
        }
        ctx.stroke();

        const labelIsActive = isClicked || isInHopRange || isHighlighted;
        ctx.font = labelIsActive ? 'bold 11px sans-serif' : '9px sans-serif';
        
        if (clickedNodeId && !isInHopRange) {
          ctx.fillStyle = '#cbd5e1';
        } else if (isClicked) {
          ctx.fillStyle = '#1e293b';
        } else if (isInHopRange) {
          ctx.fillStyle = '#334155';
        } else {
          ctx.fillStyle = isHighlighted ? '#1e293b' : '#64748b';
        }
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        const labelText = node.label.length > 20 ? node.label.slice(0, 18) + '...' : node.label;
        ctx.fillText(labelText, node.x!, node.y! + r + 4);
      });

      if (hoveredNodeRef.current) {
        const node = hoveredNodeRef.current;
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, 12, 0, 2 * Math.PI);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2.0;
        ctx.stroke();
      }

      ctx.restore();

      if (hoveredNodeRef.current) {
        const node = hoveredNodeRef.current;
        const scale = transformRef.current.scale;
        const screenX = node.x! * scale + transformRef.current.x;
        const screenY = node.y! * scale + transformRef.current.y;

        ctx.save();

        const text = node.label;
        ctx.font = 'bold 11px sans-serif';
        const textWidth = ctx.measureText(text).width;
        const paddingX = 10;
        const tooltipW = textWidth + paddingX * 2;
        const tooltipH = 24;
        const r = 6;

        const nodeRadius = (node.type === 'lesson' ? 8 : node.type === 'directory' ? 6 : node.type === 'user' ? 5 : 4) * scale;
        const rectX = screenX - tooltipW / 2;
        const rectY = screenY - nodeRadius - tooltipH - 8;

        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;

        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(rectX, rectY, tooltipW, tooltipH, r);
        } else {
          ctx.rect(rectX, rectY, tooltipW, tooltipH);
        }
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.beginPath();
        ctx.moveTo(screenX - 5, rectY + tooltipH);
        ctx.lineTo(screenX + 5, rectY + tooltipH);
        ctx.lineTo(screenX, rectY + tooltipH + 5);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, screenX, rectY + tooltipH / 2);

        ctx.restore();
      }
    };

    const updateLoop = () => {
      simulatePhysics();
      drawGraph();
      animationFrameId = requestAnimationFrame(updateLoop);
    };

    updateLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [fullGraph, activeRetrievedNodeIds, clickedNodeId, visibleNodeTypes, clickedNodeHopMap, widgetSize]);

  // Mouse & Touch interaction event handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    clickStartPos.current = { x: e.clientX, y: e.clientY };

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const graphX = (clientX - transformRef.current.x) / transformRef.current.scale;
    const graphY = (clientY - transformRef.current.y) / transformRef.current.scale;

    let clickedNode: GraphNode | null = null;
    const nodes = graphNodesRef.current;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (!visibleNodeTypes[n.type]) continue;
      const dx = n.x! - graphX;
      const dy = n.y! - graphY;
      if (Math.sqrt(dx * dx + dy * dy) < 15) {
        clickedNode = n;
        break;
      }
    }

    if (clickedNode) {
      selectedNodeRef.current = clickedNode;
    } else {
      dragStart.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const graphX = (clientX - transformRef.current.x) / transformRef.current.scale;
    const graphY = (clientY - transformRef.current.y) / transformRef.current.scale;

    if (selectedNodeRef.current) {
      selectedNodeRef.current.x = graphX;
      selectedNodeRef.current.y = graphY;
      simulationAlphaRef.current = 0.25;
    } else if (dragStart.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      
      transformRef.current = {
        ...transformRef.current,
        x: transformRef.current.x + dx,
        y: transformRef.current.y + dy
      };
      setTransformTrigger(p => p + 1);
      dragStart.current = { x: e.clientX, y: e.clientY };
    } else {
      let hoveredNode: GraphNode | null = null;
      const nodes = graphNodesRef.current;
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      let minDistance = Infinity;

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (!visibleNodeTypes[n.type]) continue;
        const nodeScreenX = n.x! * transformRef.current.scale + transformRef.current.x;
        const nodeScreenY = n.y! * transformRef.current.scale + transformRef.current.y;
        
        const dx = nodeScreenX - clickX;
        const dy = nodeScreenY - clickY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 20 && dist < minDistance) {
          minDistance = dist;
          hoveredNode = n;
        }
      }

      hoveredNodeRef.current = hoveredNode;
      if (hoveredNode && (!pinnedPopup || pinnedPopup.node.id !== hoveredNode.id)) {
        setNodePopup({
          node: hoveredNode,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      } else {
        setNodePopup(null);
      }
    }
  };

  const handleCanvasMouseUp = () => {
    selectedNodeRef.current = null;
    dragStart.current = null;
  };

  const handleCanvasMouseLeave = () => {
    hoveredNodeRef.current = null;
    setNodePopup(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (clickStartPos.current) {
      const dx = e.clientX - clickStartPos.current.x;
      const dy = e.clientY - clickStartPos.current.y;
      const dragDistance = Math.sqrt(dx * dx + dy * dy);
      if (dragDistance > 6) {
        return;
      }
    }

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const nodes = graphNodesRef.current;
    let clickedNode: GraphNode | null = null;
    let minDistance = Infinity;

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (!visibleNodeTypes[n.type]) continue;
      const nodeScreenX = n.x! * transformRef.current.scale + transformRef.current.x;
      const nodeScreenY = n.y! * transformRef.current.scale + transformRef.current.y;
      
      const dx = nodeScreenX - clickX;
      const dy = nodeScreenY - clickY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 25 && dist < minDistance) {
        minDistance = dist;
        clickedNode = n;
      }
    }

    if (clickedNode) {
      setClickedNodeId(clickedNode.id);
      
      const canvasRect = canvas.getBoundingClientRect();
      const popupW = 300;
      const popupH = clickedNode.type === 'tag' ? 180 : 130;
      
      let popupX = e.clientX - canvasRect.left + 24;
      let popupY = e.clientY - canvasRect.top - popupH / 2;
      
      const cW = canvasRect.width;
      const cH = canvasRect.height;
      if (popupX + popupW > cW) popupX = e.clientX - canvasRect.left - popupW - 24;
      if (popupY < 8) popupY = 8;
      if (popupY + popupH > cH) popupY = cH - popupH - 8;
      
      setPinnedPopup({
        node: clickedNode,
        x: popupX,
        y: popupY,
        width: popupW,
        height: popupH
      });
      setNodePopup(null);
    } else {
      setClickedNodeId(null);
      setPinnedPopup(null);
    }
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const fakeEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      preventDefault: () => {}
    } as any;
    handleCanvasMouseDown(fakeEvent);
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const fakeEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      preventDefault: () => {}
    } as any;
    handleCanvasMouseMove(fakeEvent);
  };

  const handleCanvasTouchEnd = () => {
    handleCanvasMouseUp();
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const nodes = graphNodesRef.current;
    let clickedNode: GraphNode | null = null;
    let minDistance = Infinity;

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (!visibleNodeTypes[n.type]) continue;
      const nodeScreenX = n.x! * transformRef.current.scale + transformRef.current.x;
      const nodeScreenY = n.y! * transformRef.current.scale + transformRef.current.y;
      
      const dx = nodeScreenX - clickX;
      const dy = nodeScreenY - clickY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 25 && dist < minDistance) {
        minDistance = dist;
        clickedNode = n;
      }
    }

    if (clickedNode) {
      setPinnedPopup(null);
      if (clickedNode.type === 'lesson') {
        const lessonId = parseInt(clickedNode.id.split('_')[1]);
        if (isDetailOpen && focusLessonId === lessonId) {
          alert("Bạn đang ở trong tài liệu này rồi!");
          return;
        }
        const targetLesson = lessonPlans.find(lp => lp.id === lessonId);
        if (targetLesson && onViewLessonDetail) {
          onViewLessonDetail(targetLesson);
        } else if (!targetLesson) {
          axios.get(`/api/lesson-plans/${lessonId}/?user_id=${currentUser?.id}`)
            .then(res => {
              if (onViewLessonDetail) {
                onViewLessonDetail(res.data);
              }
            })
            .catch(err => {
              console.error("Lỗi khi tải chi tiết bài giảng từ đồ thị:", err);
              alert("Không thể tải giáo án này.");
            });
        }
      } else if (clickedNode.type === 'tag') {
        const tagLabel = clickedNode.label;
        if (selectedObsidianNote?.title.toLowerCase() === tagLabel.toLowerCase()) {
          alert("Bạn đang xem khái niệm này rồi!");
          setIsOpen(true);
          return;
        }
        
        const currentTab = 'graph';
        setHistoryStack(prev => {
          if (prev.length > 0 && prev[prev.length - 1].type === 'tab' && prev[prev.length - 1].data === currentTab) {
            return prev;
          }
          return [...prev, { type: 'tab', data: currentTab }];
        });

        const targetNote = obsidianNotes.find(n => n.title.toLowerCase() === tagLabel.toLowerCase());
        if (targetNote) {
          fetchNoteContent(targetNote, true);
          setActiveTab('wiki');
          setIsOpen(true);
        } else {
          axios.get('/api/obsidian/notes/')
            .then(res => {
              const notesList = res.data;
              setObsidianNotes(notesList);
              const found = notesList.find((n: any) => n.title.toLowerCase() === tagLabel.toLowerCase());
              if (found) {
                fetchNoteContent(found, true);
                setActiveTab('wiki');
                setIsOpen(true);
              } else {
                alert(`Không tìm thấy ghi chú khái niệm cho "${tagLabel}"`);
              }
            })
            .catch(() => {
              alert(`Không tìm thấy ghi chú khái niệm cho "${tagLabel}"`);
            });
        }
      } else if (clickedNode.type === 'directory') {
        const dirId = parseInt(clickedNode.id.split('_')[1]);
        if (onSelectDirectory) {
          onSelectDirectory(dirId);
        }
      }
    }
  };

  // Popup resize and dragging event handlers
  const handlePopupResizeMouseDown = (e: React.MouseEvent, corner: 'tl' | 'tr' | 'bl' | 'br') => {
    e.stopPropagation();
    e.preventDefault();
    if (!pinnedPopup) return;
    isResizingPopup.current = corner;
    resizeStartPopup.current = {
      x: e.clientX,
      y: e.clientY,
      w: pinnedPopup.width,
      height: pinnedPopup.height || 130
    };
    
    const handleMouseUp = () => {
      isResizingPopup.current = null;
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
    
    const handleMouseMove = (ev: MouseEvent) => {
      if (!isResizingPopup.current) return;
      const dx = ev.clientX - resizeStartPopup.current.x;
      const dy = ev.clientY - resizeStartPopup.current.y;
      
      let newW = resizeStartPopup.current.w;
      let newH = resizeStartPopup.current.height;
      let px = pinnedPopup.x;
      let py = pinnedPopup.y;
      
      const corner = isResizingPopup.current;
      if (corner === 'br') {
        newW = Math.max(160, resizeStartPopup.current.w + dx);
        newH = Math.max(90, resizeStartPopup.current.height + dy);
      } else if (corner === 'bl') {
        newW = Math.max(160, resizeStartPopup.current.w - dx);
        newH = Math.max(90, resizeStartPopup.current.height + dy);
        if (newW > 160) px = px + dx;
      } else if (corner === 'tr') {
        newW = Math.max(160, resizeStartPopup.current.w + dx);
        newH = Math.max(90, resizeStartPopup.current.height - dy);
        if (newH > 90) py = py + dy;
      } else if (corner === 'tl') {
        newW = Math.max(160, resizeStartPopup.current.w - dx);
        newH = Math.max(90, resizeStartPopup.current.height - dy);
        if (newW > 160) px = px + dx;
        if (newH > 90) py = py + dy;
      }
      
      setPinnedPopup({
        ...pinnedPopup,
        x: px,
        y: py,
        width: newW,
        height: newH
      });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handlePopupHeaderMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!pinnedPopup) return;
    isDraggingPopup.current = true;
    dragStartPopup.current = {
      x: e.clientX,
      y: e.clientY,
      px: pinnedPopup.x,
      py: pinnedPopup.y
    };
    
    const handleMouseUp = () => {
      isDraggingPopup.current = false;
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
    
    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingPopup.current) return;
      const dx = ev.clientX - dragStartPopup.current.x;
      const dy = ev.clientY - dragStartPopup.current.y;
      setPinnedPopup({
        ...pinnedPopup,
        x: dragStartPopup.current.px + dx,
        y: dragStartPopup.current.py + dy
      });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={widgetSize.width}
        height={widgetSize.height - 120}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onTouchStart={handleCanvasTouchStart}
        onTouchMove={handleCanvasTouchMove}
        onTouchEnd={handleCanvasTouchEnd}
        onMouseLeave={handleCanvasMouseLeave}
        onDoubleClick={handleCanvasDoubleClick}
        onClick={handleCanvasClick}
        style={{
          width: '100%',
          height: '100%',
          cursor: nodePopup ? 'pointer' : 'grab',
          background: '#f8fafc',
        }}
      />

      {loadingGraph && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(248, 250, 252, 0.75)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          gap: '10px'
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Đang tải đồ thị...</span>
        </div>
      )}

      {/* Interactive Legend with toggle filters */}
      <div style={{
        position: 'absolute', top: '8px', left: '8px',
        background: 'rgba(255,255,255,0.96)', border: '1px solid #e2e8f0',
        borderRadius: '10px', padding: '8px 10px', fontSize: '9px',
        display: 'flex', flexDirection: 'column', gap: '5px',
        zIndex: 20,
        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        cursor: 'default',
        userSelect: 'none',
      }}>
        <p style={{ margin: '0 0 2px 0', fontWeight: 800, fontSize: '8px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.3px' }}>
          Bộ lọc hiển thị
        </p>
        
        {[
          { key: 'lesson' as const, color: '#f59e0b', label: 'Giáo án' },
          { key: 'directory' as const, color: '#3b82f6', label: 'Danh mục' },
          { key: 'tag' as const, color: '#8b5cf6', label: 'Từ khóa' },
        ].map(item => {
          const isVisible = visibleNodeTypes[item.key];
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setVisibleNodeTypes(prev => ({
                  ...prev,
                  [item.key]: !prev[item.key]
                }));
                if (pinnedPopup && pinnedPopup.node.type === item.key) {
                  setPinnedPopup(null);
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                opacity: isVisible ? 1 : 0.45,
                textDecoration: isVisible ? 'none' : 'line-through',
                fontWeight: isVisible ? 700 : 500,
                color: isVisible ? '#1e293b' : '#94a3b8',
                transition: 'all 0.15s'
              }}
              title={`Click để ${isVisible ? 'ẩn' : 'hiển thị'} loại nút này`}
            >
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: item.color,
                display: 'inline-block',
                boxShadow: isVisible ? `0 0 6px ${item.color}80` : 'none',
                transition: 'all 0.15s'
              }} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Hướng dẫn + Hop distance filter */}
      <div style={{
        position: 'absolute', bottom: '8px', left: '8px',
        background: 'rgba(255,255,255,0.95)', border: '1px solid #e2e8f0',
        borderRadius: '8px', padding: '8px', fontSize: '9px', color: '#64748b',
        pointerEvents: 'none',
      }}>
        <p>🖰 Kéo để Pan | 🛞 Cuộn để Zoom</p>
        <p>🖱 Hover để xem thông tin | Click để chọn | Click đúp để mở</p>
      </div>

      {/* Hop Distance Filter + Reset - góc trên phải */}
      <div style={{
        position: 'absolute', top: '8px', right: '8px',
        display: 'flex', gap: '4px', alignItems: 'center',
      }}>
        {focusLessonId && (
          <div style={{
            background: 'rgba(255,255,255,0.97)',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '3px 4px',
            display: 'flex',
            gap: '2px',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: '8px', fontWeight: 700, color: '#94a3b8', paddingRight: '3px' }}>Liên kết:</span>
            {[1, 2, 3].map(hop => (
              <button
                key={hop}
                type="button"
                onClick={() => {
                  setGraphHopDistance(hop);
                }}
                style={{
                  padding: '2px 7px',
                  borderRadius: '5px',
                  border: 'none',
                  fontSize: '9px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: graphHopDistance === hop
                    ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
                    : '#f1f5f9',
                  color: graphHopDistance === hop ? '#fff' : '#64748b',
                  transition: 'all 0.15s',
                }}
              >
                {hop}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => {
            transformRef.current = { x: 0, y: 0, scale: 1.0 };
            setTransformTrigger(p => p + 1);
          }}
          style={{
            fontSize: '10px', background: 'rgba(255,255,255,0.97)', border: '1px solid #e2e8f0',
            padding: '4px 10px', borderRadius: '6px', color: '#475569',
            fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          Reset
        </button>
      </div>

      {/* Node Hover Popup */}
      {nodePopup && (() => {
        const n = nodePopup.node;
        const typeColor = n.type === 'lesson' ? '#f59e0b' : n.type === 'directory' ? '#3b82f6' : n.type === 'user' ? '#10b981' : '#8b5cf6';
        const typeBg = n.type === 'lesson' ? '#fef3c7' : n.type === 'directory' ? '#dbeafe' : n.type === 'user' ? '#d1fae5' : '#ede9fe';
        const typeLabel = n.type === 'lesson' ? '📄 Giáo án' : n.type === 'directory' ? '📁 Danh mục' : n.type === 'user' ? '👤 Người dùng' : '🏷️ Từ khóa';

        const canvas = canvasRef.current;
        const cW = canvas ? canvas.offsetWidth : 400;
        const cH = canvas ? canvas.offsetHeight : 400;
        const popupW = 300;
        const popupH = n.type === 'tag' ? 140 : 100;
        let px = nodePopup.x + 12;
        let py = nodePopup.y - popupH / 2;
        if (px + popupW > cW) px = nodePopup.x - popupW - 12;
        if (py < 4) py = 4;
        if (py + popupH > cH) py = cH - popupH - 4;

        return (
          <div style={{
            position: 'absolute',
            left: px,
            top: py,
            width: popupW,
            background: 'rgba(255,255,255,0.98)',
            border: `1.5px solid ${typeColor}40`,
            borderRadius: '10px',
            padding: '8px 12px',
            boxShadow: `0 4px 20px ${typeColor}20, 0 2px 8px rgba(0,0,0,0.08)`,
            pointerEvents: 'none',
            zIndex: 50,
            backdropFilter: 'blur(4px)',
          }}>
            <span style={{
              display: 'inline-block',
              fontSize: '7px', fontWeight: 800, textTransform: 'uppercase',
              background: typeBg, color: typeColor,
              padding: '1px 5px', borderRadius: '4px', marginBottom: '4px',
              letterSpacing: '0.3px',
            }}>
              {typeLabel}
            </span>
            <p style={{
              margin: 0, fontSize: '11px', fontWeight: 800, color: '#1e293b',
              lineHeight: 1.35, wordBreak: 'break-word',
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {n.label}
            </p>
            {n.details && n.details !== n.label && (
              <p style={{
                margin: '4px 0 0 0', fontSize: '9.5px', color: '#475569',
                lineHeight: 1.45, wordBreak: 'break-word',
                overflow: n.type === 'tag' ? 'visible' : 'hidden',
                display: n.type === 'tag' ? 'block' : '-webkit-box',
                WebkitLineClamp: n.type === 'tag' ? 'none' : 3,
                WebkitBoxOrient: 'vertical',
              }}>
                {n.details}
              </p>
            )}
            <p style={{ margin: '5px 0 0 0', fontSize: '8px', color: '#94a3b8', fontStyle: 'italic' }}>
              🖱 Click đúp để mở {n.type === 'lesson' ? 'giáo án' : n.type === 'tag' ? 'khái niệm' : 'thư mục'}
            </p>
          </div>
        );
      })()}

      {/* Pinned Resizable & Draggable Popup */}
      {pinnedPopup && (() => {
        const n = pinnedPopup.node;
        const typeColor = n.type === 'lesson' ? '#f59e0b' : n.type === 'directory' ? '#3b82f6' : n.type === 'user' ? '#10b981' : '#8b5cf6';
        const typeBg = n.type === 'lesson' ? '#fef3c7' : n.type === 'directory' ? '#dbeafe' : n.type === 'user' ? '#d1fae5' : '#ede9fe';
        const typeLabel = n.type === 'lesson' ? '📄 Giáo án' : n.type === 'directory' ? '📁 Danh mục' : n.type === 'user' ? '👤 Người dùng' : '🏷️ Từ khóa';
        
        const scaleFactor = Math.max(0.6, pinnedPopup.width / 300);

        return (
          <div 
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: pinnedPopup.x,
              top: pinnedPopup.y,
              width: pinnedPopup.width,
              height: pinnedPopup.height,
              background: 'rgba(255,255,255,0.98)',
              border: `2px solid ${typeColor}`,
              borderRadius: `${12 * scaleFactor}px`,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              zIndex: 100,
              backdropFilter: 'blur(12px)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              userSelect: 'none',
            }}
          >
            {/* 4 corner resize handles */}
            <div
              onMouseDown={(e) => handlePopupResizeMouseDown(e, 'tl')}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${12 * scaleFactor}px`,
                height: `${12 * scaleFactor}px`,
                cursor: 'nwse-resize',
                zIndex: 110,
              }}
            />
            <div
              onMouseDown={(e) => handlePopupResizeMouseDown(e, 'tr')}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: `${12 * scaleFactor}px`,
                height: `${12 * scaleFactor}px`,
                cursor: 'nesw-resize',
                zIndex: 110,
              }}
            />
            <div
              onMouseDown={(e) => handlePopupResizeMouseDown(e, 'bl')}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: `${12 * scaleFactor}px`,
                height: `${12 * scaleFactor}px`,
                cursor: 'nesw-resize',
                zIndex: 110,
              }}
            />
            <div
              onMouseDown={(e) => handlePopupResizeMouseDown(e, 'br')}
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: `${16 * scaleFactor}px`,
                height: `${16 * scaleFactor}px`,
                cursor: 'nwse-resize',
                zIndex: 110,
              }}
            />

            {/* Drag Header */}
            <div 
              onMouseDown={handlePopupHeaderMouseDown}
              style={{
                padding: `${6 * scaleFactor}px ${10 * scaleFactor}px`,
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                cursor: 'move',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                userSelect: 'none',
                flexShrink: 0
              }}
            >
              <span style={{
                display: 'inline-block',
                fontSize: `${8 * scaleFactor}px`, fontWeight: 800, textTransform: 'uppercase',
                background: typeBg, color: typeColor,
                padding: `${1 * scaleFactor}px ${6 * scaleFactor}px`, borderRadius: `${4 * scaleFactor}px`,
                letterSpacing: '0.3px',
              }}>
                {typeLabel}
              </span>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: `${4 * scaleFactor}px` }}>
                <button
                  type="button"
                  onClick={() => {
                    setInputMessage(`Hãy giải thích chi tiết cho tôi về ${n.type === 'lesson' ? 'giáo án' : n.type === 'tag' ? 'khái niệm' : 'thư mục'} "${n.label}"`);
                    setActiveTab('chat');
                    setIsOpen(true);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#3b82f6',
                    fontSize: `${9 * scaleFactor}px`,
                    cursor: 'pointer',
                    fontWeight: 700,
                    padding: `${2 * scaleFactor}px ${4 * scaleFactor}px`,
                    borderRadius: `${4 * scaleFactor}px`,
                  }}
                  title="Hỏi AI"
                >
                  🤖 Hỏi AI
                </button>
                
                <button
                  type="button"
                  onClick={() => setPinnedPopup(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X style={{ width: `${14 * scaleFactor}px`, height: `${14 * scaleFactor}px` }} className="hover:text-slate-600" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div style={{
              padding: `${10 * scaleFactor}px`,
              flexGrow: 1,
              overflowY: 'auto',
              fontSize: `${11 * scaleFactor}px`,
              color: '#334155',
              display: 'flex',
              flexDirection: 'column',
              gap: `${6 * scaleFactor}px`,
              position: 'relative'
            }}>
              <h4 style={{
                margin: 0,
                fontSize: `${12 * scaleFactor}px`,
                fontWeight: 800,
                color: '#1e293b',
                lineHeight: 1.3
              }}>
                {n.label}
              </h4>
              
              {n.details && (
                <div style={{
                  fontSize: `${10 * scaleFactor}px`,
                  color: '#475569',
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {n.details}
                </div>
              )}
              
              {/* Hop Depth Selector */}
              <div style={{
                marginTop: `${6 * scaleFactor}px`,
                padding: `${6 * scaleFactor}px ${8 * scaleFactor}px`,
                background: '#f1f5f9',
                borderRadius: `${6 * scaleFactor}px`,
                display: 'flex',
                flexDirection: 'column',
                gap: `${4 * scaleFactor}px`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: `${8 * scaleFactor}px`, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    🔗 Mở rộng liên kết
                  </span>
                  <span style={{ fontSize: `${8 * scaleFactor}px`, color: '#94a3b8' }}>
                    {clickHopDepth} cạnh
                  </span>
                </div>
                <div style={{ display: 'flex', gap: `${3 * scaleFactor}px` }}>
                  {[1, 2, 3, 4].map(hop => {
                    const hopPalette = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#f97316'];
                    const isActive = clickHopDepth >= hop;
                    const hopColor = hopPalette[hop];
                    return (
                      <button
                        key={hop}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setClickHopDepth(hop);
                        }}
                        style={{
                          flex: 1,
                          padding: `${3 * scaleFactor}px 0`,
                          borderRadius: `${4 * scaleFactor}px`,
                          border: 'none',
                          fontSize: `${9 * scaleFactor}px`,
                          fontWeight: 800,
                          cursor: 'pointer',
                          background: isActive
                            ? `linear-gradient(135deg, ${hopColor}, ${hopColor}cc)`
                            : '#e2e8f0',
                          color: isActive ? '#fff' : '#94a3b8',
                          transition: 'all 0.2s',
                          boxShadow: clickHopDepth === hop ? `0 2px 8px ${hopColor}60` : 'none',
                          transform: clickHopDepth === hop ? 'scale(1.08)' : 'scale(1)',
                        }}
                        title={`Hiển thị ${hop} cạnh liên kết`}
                      >
                        {hop}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: `${6 * scaleFactor}px`, flexWrap: 'wrap', marginTop: `${2 * scaleFactor}px` }}>
                  {Array.from({ length: clickHopDepth }, (_, i) => i + 1).map(hop => {
                    const hopPalette = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#f97316'];
                    return (
                      <span key={hop} style={{ display: 'flex', alignItems: 'center', gap: `${2 * scaleFactor}px`, fontSize: `${7 * scaleFactor}px`, color: '#64748b' }}>
                        <span style={{
                          width: `${6 * scaleFactor}px`, height: `${6 * scaleFactor}px`,
                          borderRadius: '50%', background: hopPalette[hop],
                          display: 'inline-block',
                        }} />
                        Cạnh {hop}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: `${4 * scaleFactor}px`, fontSize: `${9 * scaleFactor}px`, color: '#94a3b8', fontStyle: 'italic' }}>
                💡 Click đúp vào nút để mở trực tiếp
              </div>
            </div>

            {/* Resize Handle Graphic at Bottom-Right */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: `${14 * scaleFactor}px`,
                height: `${14 * scaleFactor}px`,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'flex-end',
                padding: '0 2px 2px 0',
                pointerEvents: 'none',
              }}
            >
              <svg width={`${8 * scaleFactor}`} height={`${8 * scaleFactor}`} viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5 }}>
                <path d="M10 0 L0 10 M10 4 L4 10 M10 8 L8 10" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
