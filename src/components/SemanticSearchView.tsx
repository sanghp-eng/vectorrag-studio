import React, { useState } from 'react';
import {
  Search,
  Sliders,
  Sparkles,
  Layers,
  Clock,
  Database,
  ExternalLink,
  Filter,
  CheckCircle,
  AlertCircle,
  Eye,
  Tag,
  Hash,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DocumentChunk, SearchResponse, SearchResultItem } from '../types';
import { ChunkInspectorModal } from './ChunkInspectorModal';

interface SemanticSearchViewProps {
  documentCount: number;
  chunkCount: number;
}

export const SemanticSearchView: React.FC<SemanticSearchViewProps> = ({
  documentCount,
  chunkCount,
}) => {
  const { authHeader } = useAuth();
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(5);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.3);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [selectedChunk, setSelectedChunk] = useState<DocumentChunk | null>(null);
  const [selectedSimilarity, setSelectedSimilarity] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const sampleQueries = [
    'Quy trình Ingestion và Chunking',
    'Xác thực người dùng với JWT và bảo mật vector',
    'Ngưỡng tương đồng cosine similarity tối ưu',
    'Khắc phục hiện tượng ảo giác AI hallucination',
  ];

  const handleSearch = async (overrideQuery?: string) => {
    const q = overrideQuery || query;
    if (!q.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      const res = await fetch('/api/vector/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify({
          query: q.trim(),
          topK,
          similarityThreshold,
          categoryFilter: categoryFilter || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi tìm kiếm vector');
      }

      setSearchResponse(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tìm kiếm');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-5 text-[#141414] space-y-4">
      {/* Control Console */}
      <div className="bg-white border border-[#141414] p-4 sm:p-5 shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#141414]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#141414] text-white flex items-center justify-center text-xs font-mono font-bold">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-mono font-bold uppercase tracking-wider text-[#141414]">
                SEMANTIC_VECTOR_QUERY
              </h1>
              <p className="text-[11px] font-mono text-[#666]">
                Cosine distance similarity retrieval across 768-dimensional dense embeddings
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono border border-[#141414] bg-[#F8F7F4] px-2.5 py-1">
              INDEX_CHUNK_POOL: <strong className="text-[#141414]">{chunkCount}</strong>
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                id="semantic-search-input"
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Enter semantic search query (e.g., How does JWT secure vector database access?)..."
                className="w-full bg-[#F8F7F4] border border-[#141414] px-3.5 py-2.5 text-xs sm:text-sm font-mono text-[#141414] placeholder-[#888] focus:outline-none focus:bg-white"
              />
            </div>

            <button
              id="semantic-search-btn"
              onClick={() => handleSearch()}
              disabled={isSearching || !query.trim()}
              className="px-6 py-2.5 bg-[#141414] hover:bg-[#333] disabled:opacity-40 text-white text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all"
            >
              {isSearching ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>COMPUTING...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>EXECUTE QUERY</span>
                </>
              )}
            </button>
          </div>

          {/* Preset queries */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] font-mono text-[#666] uppercase font-bold">Diagnostics:</span>
            {sampleQueries.map((sq, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(sq);
                  handleSearch(sq);
                }}
                className="text-[10px] font-mono px-2 py-1 bg-white hover:bg-[#E4E3E0] border border-[#141414] text-[#141414] transition-colors"
              >
                {sq}
              </button>
            ))}
          </div>
        </div>

        {/* Filter & Tuning Parameters */}
        <div className="mt-4 pt-3 border-t border-[#141414] grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div>
            <div className="flex justify-between text-[#666] mb-1 text-[11px]">
              <span>TOP_K CHUNKS:</span>
              <span className="text-[#141414] font-bold">{topK}</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={topK}
              onChange={e => setTopK(Number(e.target.value))}
              className="w-full accent-[#141414] cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[#666] mb-1 text-[11px]">
              <span>MIN SIMILARITY THRESHOLD:</span>
              <span className="text-[#141414] font-bold">
                {(similarityThreshold).toFixed(2)} ({Math.round(similarityThreshold * 100)}%)
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={similarityThreshold}
              onChange={e => setSimilarityThreshold(Number(e.target.value))}
              className="w-full accent-[#141414] cursor-pointer"
            />
          </div>

          <div>
            <span className="text-[#666] block mb-1 text-[11px]">CATEGORY_FILTER:</span>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full bg-[#F8F7F4] border border-[#141414] p-1.5 text-[#141414] text-xs font-mono focus:outline-none"
            >
              <option value="">ALL_CATEGORIES</option>
              <option value="Chuyên ngành AI">Chuyên ngành AI & RAG</option>
              <option value="Bảo mật & Pháp lý">Bảo mật & Pháp lý</option>
              <option value="Tài liệu Sản phẩm">Tài liệu Sản phẩm</option>
              <option value="Chính sách Công ty">Chính sách Công ty</option>
              <option value="Kỹ thuật & Kiến trúc">Kỹ thuật & Kiến trúc</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-[#F8F7F4] border border-rose-600 text-rose-700 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search Results Display */}
      {searchResponse && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {/* Telemetry Summary Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-white border border-[#141414] text-xs font-mono">
            <div className="flex items-center gap-4">
              <span>
                MATCHES: <strong className="text-[#141414]">{searchResponse.results.length}</strong> / {searchResponse.totalChunksSearched} chunks
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#141414]" />
                LATENCY: {searchResponse.executionTimeMs}ms
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2 py-0.5 border border-[#141414] bg-[#E4E3E0] text-[#141414]">
                EMBEDDING_MODEL: {searchResponse.modelUsed}
              </span>
            </div>
          </div>

          {searchResponse.results.length === 0 ? (
            <div className="text-center py-12 bg-white border border-[#141414]">
              <Database className="w-8 h-8 text-[#888] mx-auto mb-2" />
              <h3 className="text-xs font-mono font-bold uppercase text-[#141414]">NO_VECTORS_ABOVE_THRESHOLD</h3>
              <p className="text-[11px] font-mono text-[#666] mt-1 max-w-md mx-auto">
                Try reducing the similarity threshold or broadening query terminology.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {searchResponse.results.map((item: SearchResultItem, index: number) => {
                return (
                  <div
                    key={item.chunk.id}
                    className="bg-white border border-[#141414] p-3.5 transition-all"
                  >
                    {/* Top Row: Rank, Document Title, Similarity Score */}
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 bg-[#141414] text-white text-xs font-mono font-bold flex items-center justify-center">
                          #{index + 1}
                        </span>
                        <div>
                          <h4 className="text-xs sm:text-sm font-mono font-bold text-[#141414] uppercase">
                            {item.chunk.documentTitle}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-[#666] mt-0.5">
                            <span className="px-1.5 py-0.2 bg-[#E4E3E0] border border-[#141414]/30 text-[#141414]">
                              CHUNK #{item.chunk.chunkIndex}
                            </span>
                            <span>•</span>
                            <span>{item.chunk.category}</span>
                            <span>•</span>
                            <span>{item.chunk.embeddingDim || 768}D DENSE</span>
                          </div>
                        </div>
                      </div>

                      {/* Cosine Similarity Pill */}
                      <div className="flex items-center gap-2">
                        <div className="px-2.5 py-1 border border-[#141414] bg-[#F8F7F4] text-xs font-mono font-bold flex items-center gap-1.5 text-blue-600">
                          <span>COSINE:</span>
                          <span>{(item.similarity).toFixed(4)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Chunk Content Preview */}
                    <div className="bg-[#F8F7F4] border border-[#141414] p-3 text-xs text-[#222] font-mono leading-relaxed whitespace-pre-wrap mt-2">
                      {item.chunk.content}
                    </div>

                    {/* Footer Info & Actions */}
                    <div className="mt-2.5 pt-2 border-t border-[#141414]/20 flex items-center justify-between text-xs font-mono">
                      <span className="text-[10px] text-[#666]">
                        UID: {item.chunk.id} • ~{item.chunk.tokenCount} tokens
                      </span>
                      <button
                        onClick={() => {
                          setSelectedChunk(item.chunk);
                          setSelectedSimilarity(item.similarity);
                        }}
                        className="flex items-center gap-1 text-xs font-mono font-bold text-[#141414] hover:underline"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>INSPECT_VECTOR_CHUNK</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Chunk Inspector Modal */}
      <ChunkInspectorModal
        chunk={selectedChunk}
        similarity={selectedSimilarity}
        onClose={() => setSelectedChunk(null)}
      />
    </div>
  );
};

