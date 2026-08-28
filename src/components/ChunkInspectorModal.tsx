import React from 'react';
import { X, FileText, Hash, Layers, ShieldCheck, Activity, Copy, Check } from 'lucide-react';
import { DocumentChunk } from '../types';

interface ChunkInspectorModalProps {
  chunk: DocumentChunk | null;
  similarity?: number;
  onClose: () => void;
}

export const ChunkInspectorModal: React.FC<ChunkInspectorModalProps> = ({
  chunk,
  similarity,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!chunk) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(chunk.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141414]/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-white border border-[#141414] p-5 shadow-2xl text-[#141414] max-h-[90vh] flex flex-col font-mono">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#141414]">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-1.5 py-0.2 bg-[#141414] text-white text-[10px] font-bold">
                CHUNK_#{chunk.chunkIndex}
              </span>
              <span className="px-1.5 py-0.2 bg-[#F8F7F4] border border-[#141414] text-[#141414] text-[10px]">
                {chunk.category || 'General'}
              </span>
              {similarity !== undefined && (
                <span className="px-1.5 py-0.2 bg-emerald-50 border border-emerald-600 text-emerald-800 text-[10px] font-bold">
                  SIMILARITY: {Math.round(similarity * 100)}%
                </span>
              )}
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#141414] mt-1.5 line-clamp-1">
              {chunk.documentTitle}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#666] hover:text-[#141414] p-1 hover:bg-[#E4E3E0] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chunk Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-3">
          <div className="bg-[#F8F7F4] border border-[#141414] p-2">
            <span className="text-[9px] text-[#666] uppercase block">CHARACTERS</span>
            <span className="text-xs font-bold text-[#141414]">{chunk.characterCount || chunk.content.length}</span>
          </div>
          <div className="bg-[#F8F7F4] border border-[#141414] p-2">
            <span className="text-[9px] text-[#666] uppercase block">EST_TOKENS</span>
            <span className="text-xs font-bold text-[#141414]">
              ~{chunk.tokenCount || Math.ceil(chunk.content.split(/\s+/).length * 1.3)}
            </span>
          </div>
          <div className="bg-[#F8F7F4] border border-[#141414] p-2">
            <span className="text-[9px] text-[#666] uppercase block">EMBED_DIMENSIONS</span>
            <span className="text-xs font-bold text-[#141414]">
              {chunk.embeddingDim || 768}D DENSE
            </span>
          </div>
          <div className="bg-[#F8F7F4] border border-[#141414] p-2">
            <span className="text-[9px] text-[#666] uppercase block">PARTITION_ID</span>
            <span className="text-[10px] text-[#666] truncate block">{chunk.id}</span>
          </div>
        </div>

        {/* Content Box */}
        <div className="flex-1 overflow-y-auto min-h-[180px] bg-[#F8F7F4] border border-[#141414] p-3 text-xs text-[#141414] whitespace-pre-wrap leading-relaxed">
          {chunk.content}
        </div>

        {/* Footer Actions */}
        <div className="mt-3 pt-2.5 border-t border-[#141414] flex items-center justify-between">
          <span className="text-[10px] text-[#666]">
            TIMESTAMP: {new Date(chunk.createdAt || Date.now()).toISOString()}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1.5 px-3 py-1 bg-white hover:bg-[#E4E3E0] border border-[#141414] text-[#141414] text-xs font-bold transition-colors uppercase"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'COPIED_TO_CLIPBOARD' : 'COPY_CHUNK_RAW'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

