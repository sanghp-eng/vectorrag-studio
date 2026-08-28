import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Orbit,
  Search,
  Sparkles,
  Layers,
  Zap,
  Info,
  Maximize2,
  Minimize2,
  RotateCcw,
  Target,
  Filter,
  Eye,
  Crosshair,
  Sliders,
  Share2,
  CheckCircle2,
  HelpCircle,
  Compass,
  FileText,
  Tag,
  ZoomIn,
  ZoomOut,
  Move,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DocumentChunk, SearchResponse } from '../types';
import { ChunkInspectorModal } from './ChunkInspectorModal';

interface VectorVisualizerViewProps {
  chunks: DocumentChunk[];
}

// Category color palette for clear semantic clustering
const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; hex: string; lightHex: string }> = {
  'IT & DevOps Runbooks': { bg: 'bg-amber-500', border: 'border-amber-600', text: 'text-amber-400', hex: '#f59e0b', lightHex: 'rgba(245, 158, 11, 0.18)' },
  'AI & Machine Learning': { bg: 'bg-emerald-500', border: 'border-emerald-600', text: 'text-emerald-400', hex: '#10b981', lightHex: 'rgba(16, 185, 129, 0.18)' },
  'Tài liệu chung': { bg: 'bg-blue-500', border: 'border-blue-600', text: 'text-blue-400', hex: '#3b82f6', lightHex: 'rgba(59, 130, 246, 0.18)' },
  'General': { bg: 'bg-blue-500', border: 'border-blue-600', text: 'text-blue-400', hex: '#3b82f6', lightHex: 'rgba(59, 130, 246, 0.18)' },
  'Software Architecture': { bg: 'bg-purple-500', border: 'border-purple-600', text: 'text-purple-400', hex: '#8b5cf6', lightHex: 'rgba(139, 92, 246, 0.18)' },
  'Database & Storage': { bg: 'bg-cyan-500', border: 'border-cyan-600', text: 'text-cyan-400', hex: '#06b6d4', lightHex: 'rgba(6, 182, 212, 0.18)' },
};

const DEFAULT_CATEGORY_COLOR = { bg: 'bg-indigo-500', border: 'border-indigo-600', text: 'text-indigo-400', hex: '#6366f1', lightHex: 'rgba(99, 102, 241, 0.18)' };

export const VectorVisualizerView: React.FC<VectorVisualizerViewProps> = ({ chunks }) => {
  const { authHeader } = useAuth();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [selectedChunk, setSelectedChunk] = useState<DocumentChunk | null>(null);
  const [hoveredChunk, setHoveredChunk] = useState<DocumentChunk | null>(null);
  const [hoveredQuery, setHoveredQuery] = useState(false);

  // Filters & display toggles
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(0.25);
  const [topK, setTopK] = useState<number>(6);
  const [showClusterHulls, setShowClusterHulls] = useState(true);
  const [showCosineRings, setShowCosineRings] = useState(true);
  const [showVectors, setShowVectors] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Canvas Pan & Zoom Interactive State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    chunks.forEach(c => {
      if (c.category) set.add(c.category);
    });
    return Array.from(set);
  }, [chunks]);

  // Handle Query Search & Projection
  const handleProjectQuery = async (queryText?: string) => {
    const textToSearch = queryText !== undefined ? queryText : query;
    if (!textToSearch.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch('/api/vector/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify({
          query: textToSearch.trim(),
          topK,
          similarityThreshold,
          categoryFilter: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSearchResponse(data);
        if (data.results && data.results.length > 0) {
          setSelectedChunk(data.results[0].chunk);
        }
      }
    } catch (e) {
      console.error('Vector visualizer search error:', e);
    } finally {
      setIsSearching(false);
    }
  };

  // Sample queries quick loader
  const sampleQueries = [
    'Zabbix cảnh báo Disk space đầy và OOM Killer',
    'RAG Retrieval Augmented Generation là gì?',
    'Kiến trúc Chunking và Vector Embedding',
    'Khắc phục MySQL service down cổng 3306',
  ];

  // Normalized chunk coordinates for 2D Canvas
  const chunkCoordinates = useMemo(() => {
    return chunks.map(c => {
      let x = 0;
      let y = 0;
      if (c.pcaCoords && Array.isArray(c.pcaCoords) && c.pcaCoords.length >= 2) {
        x = c.pcaCoords[0];
        y = c.pcaCoords[1];
      } else {
        // Fallback pseudo-projection based on string hash
        let hashX = 0;
        let hashY = 0;
        for (let j = 0; j < c.content.length; j++) {
          hashX = (hashX * 31 + c.content.charCodeAt(j)) % 140 - 70;
          hashY = (hashY * 37 + c.content.charCodeAt(j)) % 140 - 70;
        }
        x = hashX;
        y = hashY;
      }
      return { chunk: c, x, y };
    });
  }, [chunks]);

  // Filtered coordinates based on user category selection
  const visibleChunkCoordinates = useMemo(() => {
    if (selectedCategory === 'ALL') return chunkCoordinates;
    return chunkCoordinates.filter(item => item.chunk.category === selectedCategory);
  }, [chunkCoordinates, selectedCategory]);

  // Reset viewport
  const handleResetViewport = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Convert screen coordinates to world canvas coordinates
  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { worldX: 0, worldY: 0, screenX: 0, screenY: 0 };
      const rect = canvas.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2 + pan.x;
      const centerY = height / 2 + pan.y;
      const scale = (Math.min(width, height) / 220) * zoom;

      const worldX = (screenX - centerX) / scale;
      const worldY = (screenY - centerY) / scale;

      return { worldX, worldY, screenX, screenY };
    },
    [pan, zoom]
  );

  // Mouse interactions on Canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
      return;
    }

    const { worldX, worldY, screenX, screenY } = screenToWorld(e.clientX, e.clientY);
    setCursorPos({ x: screenX, y: screenY });

    // Check hit test on chunks
    const width = canvas.width;
    const height = canvas.height;
    const scale = (Math.min(width, height) / 220) * zoom;
    const hitRadiusWorld = 12 / scale;

    // Check query hit
    let queryHit = false;
    if (searchResponse?.queryPca) {
      const qx = searchResponse.queryPca[0];
      const qy = searchResponse.queryPca[1];
      const distQ = Math.sqrt((worldX - qx) ** 2 + (worldY - qy) ** 2);
      if (distQ <= hitRadiusWorld * 1.5) {
        queryHit = true;
      }
    }
    setHoveredQuery(queryHit);

    if (queryHit) {
      setHoveredChunk(null);
      return;
    }

    let found: DocumentChunk | null = null;
    let minDist = Infinity;

    for (const item of visibleChunkCoordinates) {
      const dist = Math.sqrt((worldX - item.x) ** 2 + (worldY - item.y) ** 2);
      if (dist <= hitRadiusWorld && dist < minDist) {
        minDist = dist;
        found = item.chunk;
      }
    }

    setHoveredChunk(found);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredChunk) {
      setSelectedChunk(hoveredChunk);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
    setZoom(prev => Math.min(Math.max(prev * zoomFactor, 0.4), 4.0));
  };

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2 + pan.x;
    const centerY = height / 2 + pan.y;
    const scale = (Math.min(width, height) / 220) * zoom;

    // 1. Clear & Paint Background Grid
    ctx.fillStyle = '#0f1117'; // Deep dark high-tech background
    ctx.fillRect(0, 0, width, height);

    // Subtle background dot matrix
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    const dotSpacing = 24 * zoom;
    const startX = (centerX % dotSpacing) - dotSpacing;
    const startY = (centerY % dotSpacing) - dotSpacing;
    for (let gx = startX; gx < width + dotSpacing; gx += dotSpacing) {
      for (let gy = startY; gy < height + dotSpacing; gy += dotSpacing) {
        ctx.fillRect(gx, gy, 1.5, 1.5);
      }
    }

    // 2. Concentric Similarity Rings (Cosine Metric Levels)
    if (showCosineRings) {
      ctx.lineWidth = 1;
      const rings = [
        { radius: 25, label: '0.90 Highly Relevant', color: 'rgba(59, 130, 246, 0.25)' },
        { radius: 50, label: '0.70 Relevant', color: 'rgba(59, 130, 246, 0.18)' },
        { radius: 75, label: '0.50 Threshold', color: 'rgba(255, 255, 255, 0.10)' },
        { radius: 100, label: '0.25 Distant Margin', color: 'rgba(255, 255, 255, 0.05)' },
      ];

      rings.forEach(r => {
        ctx.strokeStyle = r.color;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, r.radius * scale, 0, Math.PI * 2);
        ctx.stroke();

        // Ring label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(r.label, centerX + 6, centerY - r.radius * scale + 12);
      });
      ctx.setLineDash([]);
    }

    // 3. Coordinate Axes (PCA Eigenvector 1 & 2)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Axis Labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('PCA_COMPONENT_1 (X)', width - 12, centerY - 6);
    ctx.textAlign = 'left';
    ctx.fillText('PCA_COMPONENT_2 (Y)', centerX + 6, 18);

    // 4. Cluster Hulls / Category Group Regions
    if (showClusterHulls && categories.length > 0) {
      categories.forEach(cat => {
        const catPoints = chunkCoordinates.filter(c => c.chunk.category === cat);
        if (catPoints.length >= 2) {
          // Calculate centroid & bounding circle
          let avgX = 0;
          let avgY = 0;
          catPoints.forEach(p => {
            avgX += p.x;
            avgY += p.y;
          });
          avgX /= catPoints.length;
          avgY /= catPoints.length;

          let maxR = 0;
          catPoints.forEach(p => {
            const dist = Math.sqrt((p.x - avgX) ** 2 + (p.y - avgY) ** 2);
            if (dist > maxR) maxR = dist;
          });
          maxR = Math.max(maxR + 14, 25);

          const screenCentroidX = centerX + avgX * scale;
          const screenCentroidY = centerY + avgY * scale;
          const style = CATEGORY_COLORS[cat] || DEFAULT_CATEGORY_COLOR;

          // Draw hull aura
          const grad = ctx.createRadialGradient(
            screenCentroidX,
            screenCentroidY,
            5,
            screenCentroidX,
            screenCentroidY,
            maxR * scale
          );
          grad.addColorStop(0, style.lightHex);
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(screenCentroidX, screenCentroidY, maxR * scale, 0, Math.PI * 2);
          ctx.fill();

          // Cluster boundary outline
          ctx.strokeStyle = style.hex;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.arc(screenCentroidX, screenCentroidY, maxR * scale, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // Cluster tag badge
          ctx.fillStyle = 'rgba(15, 17, 23, 0.85)';
          const badgeW = cat.length * 6 + 18;
          ctx.fillRect(screenCentroidX - badgeW / 2, screenCentroidY - maxR * scale - 12, badgeW, 16);
          ctx.strokeStyle = style.hex;
          ctx.lineWidth = 1;
          ctx.strokeRect(screenCentroidX - badgeW / 2, screenCentroidY - maxR * scale - 12, badgeW, 16);

          ctx.fillStyle = style.hex;
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(cat.toUpperCase(), screenCentroidX, screenCentroidY - maxR * scale - 4);
        }
      });
    }

    // 5. Query Vector Projection & Cosine Similarity Connection Rays
    let queryScreenX = centerX;
    let queryScreenY = centerY;

    if (searchResponse?.queryPca) {
      queryScreenX = centerX + searchResponse.queryPca[0] * scale;
      queryScreenY = centerY + searchResponse.queryPca[1] * scale;
    }

    // Draw Top-K Connection Lines & Similarity Score Badges
    if (showVectors && searchResponse && searchResponse.results.length > 0) {
      searchResponse.results.forEach((res, rank) => {
        let coords: [number, number] = [0, 0];
        if (res.chunk.pcaCoords && Array.isArray(res.chunk.pcaCoords)) {
          coords = res.chunk.pcaCoords;
        } else {
          const matchCoord = chunkCoordinates.find(c => c.chunk.id === res.chunk.id);
          if (matchCoord) coords = [matchCoord.x, matchCoord.y];
        }

        const targetX = centerX + coords[0] * scale;
        const targetY = centerY + coords[1] * scale;

        // Animated gradient line from query to matched chunk
        const lineGrad = ctx.createLinearGradient(queryScreenX, queryScreenY, targetX, targetY);
        lineGrad.addColorStop(0, '#ffffff');
        lineGrad.addColorStop(0.5, '#3b82f6');
        lineGrad.addColorStop(1, '#60a5fa');

        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = rank === 0 ? 2.5 : 1.5;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(queryScreenX, queryScreenY);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Similarity Badge on midpoint
        const midX = (queryScreenX + targetX) / 2;
        const midY = (queryScreenY + targetY) / 2;
        const scorePercent = `${Math.round(res.similarity * 100)}%`;

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(midX - 22, midY - 9, 44, 18);
        ctx.strokeStyle = rank === 0 ? '#38bdf8' : '#3b82f6';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(midX - 22, midY - 9, 44, 18);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Top${rank + 1}:${scorePercent}`, midX, midY);
      });
    }

    // 6. Draw All Visible Chunk Nodes
    visibleChunkCoordinates.forEach(({ chunk, x, y }) => {
      const screenX = centerX + x * scale;
      const screenY = centerY + y * scale;

      const isTopMatch = searchResponse?.results.some(r => r.chunk.id === chunk.id);
      const isFirstMatch = searchResponse?.results[0]?.chunk.id === chunk.id;
      const isSelected = selectedChunk?.id === chunk.id;
      const isHovered = hoveredChunk?.id === chunk.id;
      const style = CATEGORY_COLORS[chunk.category] || DEFAULT_CATEGORY_COLOR;

      // Glow halo on selected or hover or top match
      if (isSelected || isHovered || isFirstMatch) {
        ctx.beginPath();
        ctx.arc(screenX, screenY, (isFirstMatch ? 18 : 14), 0, Math.PI * 2);
        ctx.fillStyle = isFirstMatch ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255, 255, 255, 0.2)';
        ctx.fill();
      }

      // Draw Main Node Circle
      ctx.beginPath();
      const nodeRadius = isFirstMatch ? 9 : isTopMatch ? 7 : isSelected ? 8 : 5;
      ctx.arc(screenX, screenY, nodeRadius, 0, Math.PI * 2);

      if (isFirstMatch) {
        ctx.fillStyle = '#38bdf8'; // Cyan-Blue for top 1
      } else if (isTopMatch) {
        ctx.fillStyle = '#3b82f6'; // Bright Blue for Top-K
      } else {
        ctx.fillStyle = style.hex; // Category color
      }
      ctx.fill();

      // Node border
      ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = isSelected ? 2.5 : 1.2;
      ctx.stroke();

      // Labels & Metadata
      if (showLabels || isTopMatch || isSelected || isHovered) {
        ctx.fillStyle = isTopMatch ? '#38bdf8' : isSelected ? '#ffffff' : '#cbd5e1';
        ctx.font = isTopMatch || isSelected ? 'bold 10px monospace' : '9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const labelText = `#${chunk.chunkIndex} ${chunk.documentTitle.slice(0, 16)}`;
        ctx.fillText(labelText, screenX, screenY - nodeRadius - 3);
      }
    });

    // 7. Draw Query Vector Hub Node
    if (searchResponse) {
      // Outer pulse ring
      ctx.beginPath();
      ctx.arc(queryScreenX, queryScreenY, 18, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Center Query Node
      ctx.beginPath();
      ctx.arc(queryScreenX, queryScreenY, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Query Label Header
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('🎯 QUERY_VECTOR', queryScreenX, queryScreenY - 22);

      // Subtitle with snippet
      ctx.fillStyle = '#fca5a5';
      ctx.font = '9px monospace';
      ctx.fillText(`"${searchResponse.query.slice(0, 24)}..."`, queryScreenX, queryScreenY - 10);
    }
  }, [
    chunkCoordinates,
    visibleChunkCoordinates,
    searchResponse,
    selectedChunk,
    hoveredChunk,
    pan,
    zoom,
    showClusterHulls,
    showCosineRings,
    showVectors,
    showLabels,
    categories,
  ]);

  return (
    <div
      ref={containerRef}
      className={`max-w-7xl mx-auto p-3 sm:p-5 text-[#141414] space-y-4 ${
        isFullscreen ? 'fixed inset-0 z-50 bg-[#F8F7F4] overflow-y-auto p-4 sm:p-6' : ''
      }`}
    >
      {/* Header & Metric Bar */}
      <div className="bg-white border border-[#141414] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#141414] text-white flex items-center justify-center text-sm font-mono font-bold shadow-sm">
            <Orbit className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-mono font-bold uppercase tracking-wider text-[#141414]">
                KHÔNG GIAN VECTOR 2D (PCA PROJECTION STUDIO)
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-300 font-bold">
                768-D → 2-D REDUCTION
              </span>
            </div>
            <p className="text-xs font-mono text-[#666] mt-0.5">
              Trực quan hóa không gian ngữ nghĩa, phân cụm tài liệu (Semantic Clusters) và khoảng cách Cosine Similarity
            </p>
          </div>
        </div>

        {/* Legend & Stat badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <div className="flex items-center gap-1.5 border border-[#141414] px-2 py-1 bg-[#F8F7F4]">
            <span className="w-2.5 h-2.5 bg-blue-500 inline-block"></span>
            <span className="font-bold text-[#141414]">CHUNKS ({chunks.length})</span>
          </div>
          <div className="flex items-center gap-1.5 border border-[#141414] px-2 py-1 bg-[#F8F7F4]">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full inline-block"></span>
            <span className="font-bold text-[#141414]">QUERY VECTOR</span>
          </div>
          <div className="flex items-center gap-1.5 border border-[#141414] px-2 py-1 bg-[#F8F7F4]">
            <span className="w-2.5 h-2.5 bg-cyan-400 inline-block"></span>
            <span className="font-bold text-[#141414]">TOP-K NGUYÊN BẢN</span>
          </div>
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="border border-[#141414] p-1 bg-[#F8F7F4] hover:bg-[#E4E3E0] transition-colors"
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Query Search & Parameter Controller */}
      <div className="bg-white border border-[#141414] p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              id="vector-visual-input"
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleProjectQuery()}
              placeholder="Nhập câu hỏi hoặc truy vấn để chiếu vector vào không gian 2D (PCA)..."
              className="w-full bg-[#F8F7F4] border border-[#141414] px-3.5 py-2.5 text-xs sm:text-sm font-mono text-[#141414] placeholder-[#888] focus:outline-none focus:bg-white"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-[#888] hover:text-[#141414]"
              >
                XÓA
              </button>
            )}
          </div>

          <button
            id="vector-project-btn"
            onClick={() => handleProjectQuery()}
            disabled={isSearching || !query.trim()}
            className="px-6 py-2.5 bg-[#141414] hover:bg-[#333] text-white text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isSearching ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Sparkles className="w-4 h-4 text-amber-300" />
            )}
            <span>CHIẾU VECTOR & TÌM TOP-K</span>
          </button>
        </div>

        {/* Quick Sample Queries */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-mono text-[#666] flex items-center gap-1">
            <Compass className="w-3 h-3" />
            <span>Mẫu thử nhanh:</span>
          </span>
          {sampleQueries.map((sq, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setQuery(sq);
                handleProjectQuery(sq);
              }}
              className="text-[11px] font-mono bg-[#F8F7F4] border border-[#141414] px-2 py-0.5 hover:bg-[#141414] hover:text-white transition-colors truncate max-w-[280px]"
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {/* Main Interactive Workspace (Canvas + Side Inspector) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left / Center: Interactive 2D Vector Canvas (8 Cols) */}
        <div className="lg:col-span-8 bg-white border border-[#141414] p-3 sm:p-4 flex flex-col relative space-y-3">
          {/* Canvas Toolbar & Toggles */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#141414]">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-mono font-bold uppercase text-[#141414] flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                <span>Lớp hiển thị:</span>
              </span>

              <button
                type="button"
                onClick={() => setShowClusterHulls(!showClusterHulls)}
                className={`px-2 py-1 text-[11px] font-mono font-bold border transition-colors ${
                  showClusterHulls
                    ? 'bg-[#141414] text-white border-[#141414]'
                    : 'bg-[#F8F7F4] text-[#666] border-[#ccc]'
                }`}
              >
                Vùng Phân Cụm
              </button>

              <button
                type="button"
                onClick={() => setShowCosineRings(!showCosineRings)}
                className={`px-2 py-1 text-[11px] font-mono font-bold border transition-colors ${
                  showCosineRings
                    ? 'bg-[#141414] text-white border-[#141414]'
                    : 'bg-[#F8F7F4] text-[#666] border-[#ccc]'
                }`}
              >
                Vòng Tương Đồng
              </button>

              <button
                type="button"
                onClick={() => setShowVectors(!showVectors)}
                className={`px-2 py-1 text-[11px] font-mono font-bold border transition-colors ${
                  showVectors
                    ? 'bg-[#141414] text-white border-[#141414]'
                    : 'bg-[#F8F7F4] text-[#666] border-[#ccc]'
                }`}
              >
                Tia Cosine Top-K
              </button>

              <button
                type="button"
                onClick={() => setShowLabels(!showLabels)}
                className={`px-2 py-1 text-[11px] font-mono font-bold border transition-colors ${
                  showLabels
                    ? 'bg-[#141414] text-white border-[#141414]'
                    : 'bg-[#F8F7F4] text-[#666] border-[#ccc]'
                }`}
              >
                Nhãn Text
              </button>
            </div>

            {/* Viewport Zoom Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setZoom(z => Math.min(z * 1.2, 4.0))}
                className="p-1 border border-[#141414] bg-[#F8F7F4] hover:bg-[#E4E3E0]"
                title="Phóng to"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(z => Math.max(z * 0.8, 0.4))}
                className="p-1 border border-[#141414] bg-[#F8F7F4] hover:bg-[#E4E3E0]"
                title="Thu nhỏ"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetViewport}
                className="px-2 py-1 border border-[#141414] bg-[#F8F7F4] hover:bg-[#E4E3E0] text-[11px] font-mono flex items-center gap-1"
                title="Đặt lại khung nhìn"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{Math.round(zoom * 100)}%</span>
              </button>
            </div>
          </div>

          {/* Canvas Box */}
          <div className="relative border border-[#141414] overflow-hidden bg-[#0f1117]">
            <canvas
              ref={canvasRef}
              width={900}
              height={520}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onClick={handleClick}
              onWheel={handleWheel}
              className={`w-full h-[420px] sm:h-[520px] ${
                isDragging ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            />

            {/* Hover Tooltip Overlay */}
            {hoveredChunk && (
              <div className="absolute bottom-4 left-4 max-w-sm bg-[#141414]/95 text-white border border-[#38bdf8] p-3 shadow-xl pointer-events-none text-xs font-mono">
                <div className="flex items-center justify-between gap-2 border-b border-white/20 pb-1 mb-1.5">
                  <span className="font-bold text-[#38bdf8] truncate">
                    #{hoveredChunk.chunkIndex} {hoveredChunk.documentTitle}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-white/10 text-white">
                    {hoveredChunk.category}
                  </span>
                </div>
                <p className="text-[11px] text-gray-300 line-clamp-3 leading-relaxed">
                  {hoveredChunk.content}
                </p>
                <div className="mt-1.5 pt-1 border-t border-white/10 flex justify-between text-[10px] text-gray-400">
                  <span>Tọa độ PCA: ({hoveredChunk.pcaCoords ? hoveredChunk.pcaCoords.join(', ') : '0, 0'})</span>
                  <span className="text-[#38bdf8]">Click để xem chi tiết</span>
                </div>
              </div>
            )}

            {/* Navigation Tip Bottom Right */}
            <div className="absolute bottom-2 right-2 bg-[#141414]/80 text-gray-300 px-2 py-1 text-[10px] font-mono border border-white/10 pointer-events-none">
              Kéo chuột để Di chuyển • Cuộn để Phóng to/Thu nhỏ
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs font-mono text-[#666] flex items-center gap-1">
              <Filter className="w-3 h-3" />
              <span>Bộ lọc nhóm:</span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-2.5 py-1 text-xs font-mono font-bold border transition-colors ${
                selectedCategory === 'ALL'
                  ? 'bg-[#141414] text-white border-[#141414]'
                  : 'bg-[#F8F7F4] text-[#141414] border-[#ccc] hover:bg-[#E4E3E0]'
              }`}
            >
              Tất Cả ({chunks.length})
            </button>
            {categories.map(cat => {
              const count = chunks.filter(c => c.category === cat).length;
              const style = CATEGORY_COLORS[cat] || DEFAULT_CATEGORY_COLOR;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 text-xs font-mono font-bold border transition-colors flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#141414] text-white border-[#141414]'
                      : 'bg-[#F8F7F4] text-[#141414] border-[#ccc] hover:bg-[#E4E3E0]'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: style.hex }}
                  ></span>
                  <span>{cat}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Chunk Inspector & Search Ranking Panel (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Query Result / Top Nearest Neighbors */}
          {searchResponse ? (
            <div className="bg-white border border-[#141414] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#141414] pb-2">
                <div className="flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-mono font-bold uppercase text-[#141414]">
                    KẾT QUẢ TOP-K GẦN NHẤT ({searchResponse.results.length})
                  </span>
                </div>
                <span className="text-[10px] font-mono bg-green-100 text-green-800 px-1.5 py-0.2 border border-green-300 font-bold">
                  {searchResponse.executionTimeMs}ms
                </span>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {searchResponse.results.map((res, i) => {
                  const isSelected = selectedChunk?.id === res.chunk.id;
                  const catStyle = CATEGORY_COLORS[res.chunk.category] || DEFAULT_CATEGORY_COLOR;
                  return (
                    <div
                      key={res.chunk.id}
                      onClick={() => setSelectedChunk(res.chunk)}
                      className={`p-2.5 border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/80 shadow-sm'
                          : 'border-[#141414] bg-[#F8F7F4] hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 bg-[#141414] text-white">
                            #{i + 1}
                          </span>
                          <span className="text-xs font-mono font-bold text-[#141414] truncate">
                            {res.chunk.documentTitle}
                          </span>
                        </div>
                        <span
                          className="text-[10px] font-mono font-bold px-1.5 py-0.2 text-white"
                          style={{ backgroundColor: res.similarity >= 0.7 ? '#10b981' : '#3b82f6' }}
                        >
                          {Math.round(res.similarity * 100)}% Match
                        </span>
                      </div>

                      <p className="text-[11px] font-mono text-[#444] line-clamp-2 leading-relaxed">
                        {res.chunk.content}
                      </p>

                      <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-[#666]">
                        <span className="truncate">{res.chunk.category}</span>
                        <span>Độ tương đồng: {res.similarity.toFixed(4)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#141414] p-4 text-center space-y-2">
              <Compass className="w-8 h-8 mx-auto text-[#888]" />
              <h3 className="text-xs font-mono font-bold uppercase text-[#141414]">
                CHƯA CÓ TRUY VẤN NÀO ĐƯỢC CHIẾU
              </h3>
              <p className="text-[11px] font-mono text-[#666]">
                Nhập câu hỏi ở ô phía trên hoặc chọn một câu mẫu để xem vector query được chiếu cạnh các tài liệu liên quan như thế nào.
              </p>
            </div>
          )}

          {/* Selected Chunk Inspector Card */}
          {selectedChunk ? (
            <div className="bg-white border border-[#141414] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#141414] pb-2">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#141414]" />
                  <span className="text-xs font-mono font-bold uppercase text-[#141414]">
                    CHI TIẾT PHÂN ĐOẠN ĐANG CHỌN
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-[#141414] text-white">
                  Phần #{selectedChunk.chunkIndex}
                </span>
              </div>

              <div>
                <h4 className="text-xs font-mono font-bold text-[#141414] mb-1">
                  {selectedChunk.documentTitle}
                </h4>
                <div className="flex flex-wrap gap-2 text-[10px] font-mono text-[#666] mb-2">
                  <span className="px-1.5 py-0.2 bg-[#F8F7F4] border border-[#ccc]">
                    Nhóm: {selectedChunk.category}
                  </span>
                  <span className="px-1.5 py-0.2 bg-[#F8F7F4] border border-[#ccc]">
                    Độ dài: {selectedChunk.characterCount} ký tự
                  </span>
                </div>
              </div>

              <div className="bg-[#F8F7F4] border border-[#141414] p-3 max-h-[160px] overflow-y-auto">
                <p className="text-xs font-mono text-[#222] whitespace-pre-wrap leading-relaxed">
                  {selectedChunk.content}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] font-mono text-[#888]">
                  Tọa độ PCA: [{selectedChunk.pcaCoords ? selectedChunk.pcaCoords.join(', ') : '0, 0'}]
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedChunk(null)}
                  className="text-xs font-mono text-blue-600 hover:underline"
                >
                  Đóng
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#141414] p-4 text-center space-y-2">
              <Info className="w-6 h-6 mx-auto text-[#888]" />
              <h4 className="text-xs font-mono font-bold uppercase text-[#141414]">
                HƯỚNG DẪN XEM CHI TIẾT
              </h4>
              <p className="text-[11px] font-mono text-[#666]">
                Click vào bất kỳ điểm nút nào trên đồ thị 2D để xem toàn bộ nội dung phân đoạn và thông số vector.
              </p>
            </div>
          )}

          {/* Mathematical / PCA Principles Box */}
          <div className="bg-white border border-[#141414] p-3.5 space-y-2 text-xs font-mono">
            <h4 className="font-bold uppercase text-[#141414] flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
              <span>NGUYÊN LÝ GIẢM CHIỀU PCA & COSINE</span>
            </h4>
            <ul className="text-[11px] text-[#555] space-y-1.5 list-disc pl-4 leading-relaxed">
              <li>
                <strong>Không gian gốc:</strong> Mỗi đoạn văn bản được nhúng thành vector 768 chiều (Embedding Space).
              </li>
              <li>
                <strong>Giảm chiều PCA 2D:</strong> Sử dụng 2 Eigenvector có phương sai lớn nhất để trực quan hóa mà không làm mất tương quan ngữ nghĩa.
              </li>
              <li>
                <strong>Khoảng cách hình học:</strong> Hai điểm càng nằm gần nhau thì độ tương đồng ngữ nghĩa (Cosine Similarity) càng cao.
              </li>
            </ul>
          </div>
        </div>
      </div>

      <ChunkInspectorModal
        chunk={selectedChunk}
        onClose={() => setSelectedChunk(null)}
      />
    </div>
  );
};
