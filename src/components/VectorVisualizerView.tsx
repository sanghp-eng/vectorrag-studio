import React, { useState, useEffect, useRef } from 'react';
import {
  Orbit,
  Search,
  Sparkles,
  Layers,
  Zap,
  Info,
  Maximize2,
  RotateCcw,
  Target,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DocumentChunk, SearchResponse } from '../types';
import { ChunkInspectorModal } from './ChunkInspectorModal';

interface VectorVisualizerViewProps {
  chunks: DocumentChunk[];
}

export const VectorVisualizerView: React.FC<VectorVisualizerViewProps> = ({ chunks }) => {
  const { authHeader } = useAuth();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [selectedChunk, setSelectedChunk] = useState<DocumentChunk | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleProjectQuery = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch('/api/vector/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify({
          query: query.trim(),
          topK: 6,
          similarityThreshold: 0.2,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSearchResponse(data);
      }
    } catch (e) {
      console.error('Vector visualizer search error:', e);
    } finally {
      setIsSearching(false);
    }
  };

  // Generate deterministic 2D coordinates for chunks if not provided by backend
  const chunkCoordinates = React.useMemo(() => {
    return chunks.map((c, i) => {
      if (c.pcaCoords) return { chunk: c, x: c.pcaCoords[0], y: c.pcaCoords[1] };
      // Pseudo-projection based on content hash
      let hashX = 0;
      let hashY = 0;
      for (let j = 0; j < c.content.length; j++) {
        hashX = (hashX * 31 + c.content.charCodeAt(j)) % 160 - 80;
        hashY = (hashY * 37 + c.content.charCodeAt(j)) % 160 - 80;
      }
      return { chunk: c, x: hashX, y: hashY };
    });
  }, [chunks]);

  // Render 2D Vector Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = Math.min(width, height) / 220;

    // Clear background
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, width, height);

    // Draw Grid & Axes
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 1;

    // Concentric similarity rings (0.25, 0.5, 0.75, 1.0)
    [30, 60, 90].forEach(r => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, r * scale, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Query point & connection vectors (if present)
    let queryScreenX = centerX;
    let queryScreenY = centerY;

    if (searchResponse?.queryPca) {
      queryScreenX = centerX + searchResponse.queryPca[0] * scale;
      queryScreenY = centerY + searchResponse.queryPca[1] * scale;
    }

    // Draw Top-K similarity lines if search response exists
    if (searchResponse && searchResponse.results.length > 0) {
      searchResponse.results.forEach(res => {
        const coords = res.chunk.pcaCoords || [0, 0];
        const targetX = centerX + coords[0] * scale;
        const targetY = centerY + coords[1] * scale;

        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(queryScreenX, queryScreenY);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Similarity tag midpoint
        const midX = (queryScreenX + targetX) / 2;
        const midY = (queryScreenY + targetY) / 2;
        ctx.fillStyle = '#141414';
        ctx.fillRect(midX - 18, midY - 9, 36, 18);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(midX - 18, midY - 9, 36, 18);
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.round(res.similarity * 100)}%`, midX, midY);
      });
    }

    // Draw Chunk Nodes
    chunkCoordinates.forEach(({ chunk, x, y }) => {
      const screenX = centerX + x * scale;
      const screenY = centerY + y * scale;

      // Find if this is among search results
      const match = searchResponse?.results.find(r => r.chunk.id === chunk.id);

      ctx.beginPath();
      ctx.arc(screenX, screenY, match ? 6 : 4, 0, Math.PI * 2);

      if (match) {
        ctx.fillStyle = '#3b82f6';
      } else {
        ctx.fillStyle = '#888888';
      }
      ctx.fill();

      // Border ring
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = match ? 2 : 1;
      ctx.stroke();

      // Label chunk number
      ctx.fillStyle = '#aaaaaa';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`#${chunk.chunkIndex}`, screenX, screenY - 8);
    });

    // Draw Query Node (if present)
    if (searchResponse) {
      ctx.beginPath();
      ctx.arc(queryScreenX, queryScreenY, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('QUERY_VECTOR', queryScreenX, queryScreenY - 12);
    }
  }, [chunkCoordinates, searchResponse]);

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-5 text-[#141414] space-y-4">
      {/* Header */}
      <div className="bg-white border border-[#141414] p-4 sm:p-5 shadow-none flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#141414] text-white flex items-center justify-center text-xs font-mono font-bold">
            <Orbit className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-mono font-bold uppercase tracking-wider text-[#141414]">
              VECTOR_SPACE_PCA_PROJECTION
            </h1>
            <p className="text-[11px] font-mono text-[#666]">
              2D Principal Component Analysis (PCA) projection of 768-dimensional semantic embeddings
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 border border-[#141414] px-2 py-1 bg-[#F8F7F4]">
            <span className="w-2.5 h-2.5 bg-[#888888] inline-block"></span>
            <span className="text-[#141414]">CHUNKS ({chunks.length})</span>
          </div>
          <div className="flex items-center gap-1.5 border border-[#141414] px-2 py-1 bg-[#F8F7F4]">
            <span className="w-2.5 h-2.5 bg-white border border-[#141414] inline-block"></span>
            <span className="text-[#141414]">QUERY</span>
          </div>
          <div className="flex items-center gap-1.5 border border-[#141414] px-2 py-1 bg-[#F8F7F4]">
            <span className="w-2.5 h-2.5 bg-blue-600 inline-block"></span>
            <span className="text-[#141414]">TOP_K</span>
          </div>
        </div>
      </div>

      {/* Query Projection Bar */}
      <div className="bg-white border border-[#141414] p-3 shadow-none flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <input
            id="vector-visual-input"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleProjectQuery()}
            placeholder="Enter query string to project onto PCA coordinate space..."
            className="w-full bg-[#F8F7F4] border border-[#141414] px-3.5 py-2 text-xs sm:text-sm font-mono text-[#141414] placeholder-[#888] focus:outline-none focus:bg-white"
          />
        </div>

        <button
          id="vector-project-btn"
          onClick={handleProjectQuery}
          disabled={isSearching || !query.trim()}
          className="px-5 py-2 bg-[#141414] hover:bg-[#333] text-white text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          {isSearching ? (
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          <span>PROJECT_VECTOR</span>
        </button>
      </div>

      {/* Canvas Area */}
      <div className="bg-white border border-[#141414] p-4 shadow-none flex flex-col items-center relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={800}
          height={460}
          className="w-full max-w-[800px] h-[380px] sm:h-[460px] border border-[#141414] cursor-crosshair"
        />

        {/* Floating Instructions HUD */}
        <div className="mt-3 w-full max-w-[800px] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#666] font-mono border-t border-[#141414]/10 pt-2">
          <span>CENTER_COORDINATE: (0, 0) • PCA EIGENVECTORS v1 & v2</span>
          <span>GEOMETRIC_PROXIMITY == HIGHER_COSINE_SIMILARITY</span>
        </div>
      </div>

      {/* Search results under canvas */}
      {searchResponse && (
        <div className="bg-white border border-[#141414] p-4 space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase text-[#141414] flex items-center gap-2">
            <Target className="w-3.5 h-3.5" />
            NEAREST_NEIGHBOR_VECTOR_CHUNKS:
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {searchResponse.results.map((res, i) => (
              <div
                key={res.chunk.id}
                onClick={() => setSelectedChunk(res.chunk)}
                className="bg-[#F8F7F4] border border-[#141414] hover:bg-white p-3 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-mono font-bold text-[#141414] truncate max-w-[150px] uppercase">
                    #{i + 1} {res.chunk.documentTitle}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-[#141414] text-white font-mono font-bold">
                    {(res.similarity).toFixed(3)}
                  </span>
                </div>
                <p className="text-[11px] text-[#444] font-mono line-clamp-2 leading-relaxed">
                  {res.chunk.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <ChunkInspectorModal
        chunk={selectedChunk}
        onClose={() => setSelectedChunk(null)}
      />
    </div>
  );
};

