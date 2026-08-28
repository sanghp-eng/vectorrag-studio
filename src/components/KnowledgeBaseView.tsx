import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  Sparkles,
  Layers,
  FileText,
  Tag,
  Clock,
  Calendar,
  AlertCircle,
  Eye,
  CheckCircle,
  Search,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { KBDocument, DocumentChunk } from '../types';
import { ChunkInspectorModal } from './ChunkInspectorModal';

interface KnowledgeBaseViewProps {
  documents: KBDocument[];
  chunks: DocumentChunk[];
  isLoading: boolean;
  onRefresh: () => void;
  onOpenDocModal: () => void;
}

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({
  documents,
  chunks,
  isLoading,
  onRefresh,
  onOpenDocModal,
}) => {
  const { authHeader } = useAuth();
  const [selectedDocId, setSelectedDocId] = useState<string | 'all'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedChunk, setSelectedChunk] = useState<DocumentChunk | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  const handleDelete = async (docId: string) => {
    if (!window.confirm('Are you sure you want to delete this document and its associated vector chunks?')) {
      return;
    }
    setIsDeleting(docId);
    try {
      const res = await fetch(`/api/kb/documents/${docId}`, {
        method: 'DELETE',
        headers: authHeader,
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (e) {
      console.error('Delete document error:', e);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSeedPresets = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch('/api/kb/seed-presets', {
        method: 'POST',
        headers: authHeader,
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (e) {
      console.error('Seed presets error:', e);
    } finally {
      setIsSeeding(false);
    }
  };

  const filteredDocs = documents.filter(
    d =>
      d.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      d.category.toLowerCase().includes(searchFilter.toLowerCase()) ||
      d.tags.some(t => t.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  const displayedChunks = chunks.filter(c => {
    if (selectedDocId !== 'all' && c.documentId !== selectedDocId) return false;
    if (searchFilter && !c.content.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-5 text-[#141414] space-y-4">
      {/* Top Banner */}
      <div className="bg-white border border-[#141414] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-none">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#141414] text-white flex items-center justify-center text-xs font-mono font-bold">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-mono font-bold uppercase tracking-wider text-[#141414]">
              VECTOR_INDEX_MANAGER
            </h1>
            <p className="text-[11px] font-mono text-[#666]">
              Document ingestion, semantic chunk partitioning, and embeddings synchronization
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="seed-preset-btn"
            onClick={handleSeedPresets}
            disabled={isSeeding}
            className="px-3 py-1.5 bg-white hover:bg-[#E4E3E0] border border-[#141414] text-[#141414] text-xs font-mono font-bold flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isSeeding ? 'SEEDING...' : 'SEED_PRESETS'}</span>
          </button>

          <button
            id="kb-add-doc-btn"
            onClick={onOpenDocModal}
            className="px-3.5 py-1.5 bg-[#141414] hover:bg-[#333] text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ INGEST_DOCUMENT</span>
          </button>
        </div>
      </div>

      {/* Stats Cards in High Density Monospace */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white border border-[#141414] p-3 font-mono">
          <span className="text-[10px] text-[#666] uppercase block">ACTIVE_DOCUMENTS</span>
          <span className="text-xl font-bold text-[#141414]">{documents.length}</span>
        </div>
        <div className="bg-white border border-[#141414] p-3 font-mono">
          <span className="text-[10px] text-[#666] uppercase block">TOTAL_CHUNKS</span>
          <span className="text-xl font-bold text-blue-600">{chunks.length}</span>
        </div>
        <div className="bg-white border border-[#141414] p-3 font-mono">
          <span className="text-[10px] text-[#666] uppercase block">EMBEDDING_DIMS</span>
          <span className="text-sm font-bold text-[#141414] block mt-1">768D Dense</span>
        </div>
        <div className="bg-white border border-[#141414] p-3 font-mono">
          <span className="text-[10px] text-[#666] uppercase block">INDEX_STATE</span>
          <span className="text-xs font-bold text-emerald-700 block mt-1">● IN_SYNC_ACTIVE</span>
        </div>
      </div>

      {/* Main Content Layout: Documents on Left, Chunks on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Document List (5 cols) */}
        <div className="lg:col-span-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#141414] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              INGESTED_DOCUMENTS ({filteredDocs.length})
            </h3>
            <button
              onClick={onRefresh}
              className="text-xs text-[#666] hover:text-[#141414] p-1 border border-[#141414] bg-white hover:bg-[#E4E3E0]"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Search Documents input */}
          <div className="relative">
            <input
              type="text"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Filter documents or chunks..."
              className="w-full bg-white border border-[#141414] px-3 py-1.5 text-xs font-mono text-[#141414] placeholder-[#888] focus:outline-none"
            />
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {/* Filter All Option */}
            <button
              onClick={() => setSelectedDocId('all')}
              className={`w-full text-left p-2.5 border transition-all text-xs font-mono flex items-center justify-between ${
                selectedDocId === 'all'
                  ? 'bg-[#141414] text-white border-[#141414] font-bold'
                  : 'bg-white border-[#141414] text-[#141414] hover:bg-[#F8F7F4]'
              }`}
            >
              <span>ALL_DOCUMENTS</span>
              <span className={`px-1.5 py-0.2 text-[10px] ${selectedDocId === 'all' ? 'bg-white/20 text-white' : 'bg-[#E4E3E0] text-[#141414]'}`}>
                {chunks.length} chunks
              </span>
            </button>

            {filteredDocs.map(doc => {
              const isSelected = selectedDocId === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className={`p-3 border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#F8F7F4] border-[#141414] ring-1 ring-[#141414]'
                      : 'bg-white border-[#141414] hover:bg-[#F8F7F4]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-mono font-bold text-[#141414] line-clamp-1 uppercase">{doc.title}</h4>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleDelete(doc.id);
                      }}
                      disabled={isDeleting === doc.id}
                      className="text-[#666] hover:text-rose-600 p-0.5 hover:bg-[#E4E3E0] transition-colors"
                      title="Delete document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#E4E3E0] border border-[#141414]/20 text-[#141414]">
                      {doc.category}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#141414] text-white">
                      {doc.chunkCount} Chunks
                    </span>
                    <span className="text-[10px] font-mono text-[#666]">
                      {doc.chunkingStrategy}
                    </span>
                  </div>

                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {doc.tags.map((t, idx) => (
                        <span key={idx} className="text-[9px] font-mono px-1 py-0.2 bg-[#F8F7F4] border border-[#141414]/20 text-[#444]">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 text-[9px] font-mono text-[#666] flex items-center justify-between border-t border-[#141414]/10 pt-1.5">
                    <span>{new Date(doc.createdAt).toLocaleDateString('vi-VN')}</span>
                    <span className="text-emerald-700">● INDEXED</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Chunk Inspector Grid (7 cols) */}
        <div className="lg:col-span-7 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#141414] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              VECTOR_PARTITIONS ({displayedChunks.length})
            </h3>
            <span className="text-[10px] font-mono text-[#666]">
              {selectedDocId === 'all' ? 'ALL_INDICES' : 'FILTERED_DOCUMENT'}
            </span>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {displayedChunks.length === 0 ? (
              <div className="text-center py-12 bg-white border border-[#141414]">
                <FileText className="w-8 h-8 text-[#888] mx-auto mb-2" />
                <p className="text-xs font-mono text-[#666]">NO_CHUNKS_MATCHING_FILTER</p>
              </div>
            ) : (
              displayedChunks.map(chunk => (
                <div
                  key={chunk.id}
                  onClick={() => setSelectedChunk(chunk)}
                  className="bg-white border border-[#141414] hover:bg-[#F8F7F4] p-3 cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.2 bg-[#141414] text-white font-mono font-bold">
                        CHUNK #{chunk.chunkIndex}
                      </span>
                      <span className="text-xs font-mono font-bold text-[#141414] truncate max-w-[220px]">
                        {chunk.documentTitle}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-mono text-[#666]">
                      <span>{chunk.characterCount} chars</span>
                      <span>•</span>
                      <span className="text-blue-600 font-bold">{chunk.embeddingDim || 768}D</span>
                    </div>
                  </div>

                  <p className="text-xs text-[#333] font-mono line-clamp-3 leading-relaxed bg-[#F8F7F4] p-2 border border-[#141414]/20">
                    {chunk.content}
                  </p>

                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-[#666]">
                    <span>UID: {chunk.id}</span>
                    <span className="text-[#141414] font-bold flex items-center gap-1 group-hover:underline">
                      <Eye className="w-3 h-3" />
                      INSPECT
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Chunk Inspector Modal */}
      <ChunkInspectorModal
        chunk={selectedChunk}
        onClose={() => setSelectedChunk(null)}
      />
    </div>
  );
};

