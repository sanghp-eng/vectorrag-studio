import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  Settings2,
  Sparkles,
  Check,
  AlertCircle,
  Layers,
  Loader2,
  ScanText,
  CheckCircle2,
  FileType,
  FolderPlus,
  Plus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isPdfFile, parsePdfWithOcr } from '../utils/pdfParser';
import { KBCategory } from '../types';
import { renderCategoryIcon } from './CategoryManageModal';

interface DocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories?: KBCategory[];
}

export const DocumentModal: React.FC<DocumentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  categories: initialCategories = [],
}) => {
  const { authHeader } = useAuth();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Chuyên ngành AI');
  const [isCreatingNewCat, setIsCreatingNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [categoriesList, setCategoriesList] = useState<KBCategory[]>(initialCategories);
  const [tagsInput, setTagsInput] = useState('');
  const [content, setContent] = useState('');
  const [chunkingStrategy, setChunkingStrategy] = useState<'paragraph' | 'fixed_window' | 'semantic_sentence'>('paragraph');
  const [chunkSize, setChunkSize] = useState(350);
  const [chunkOverlap, setChunkOverlap] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch updated categories on open
  useEffect(() => {
    if (isOpen) {
      fetch('/api/kb/categories', { headers: authHeader })
        .then(res => res.json())
        .then(data => {
          if (data.categories && data.categories.length > 0) {
            setCategoriesList(data.categories);
            if (!category || !data.categories.some((c: KBCategory) => c.name === category)) {
              setCategory(data.categories[0].name);
            }
          }
        })
        .catch(err => console.error('Error fetching categories:', err));
    }
  }, [isOpen, authHeader]);

  // PDF OCR states
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string>('');
  const [ocrSuccessInfo, setOcrSuccessInfo] = useState<{
    charCount: number;
    fileName: string;
    notice?: string;
    method?: string;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processFile = async (file: File) => {
    setError(null);
    setOcrSuccessInfo(null);

    const cleanTitle = file.name.replace(/\.[^/.]+$/, '');
    if (!title) {
      setTitle(cleanTitle);
    }

    if (isPdfFile(file)) {
      setIsOcrProcessing(true);
      setOcrStatus('Đang gửi và nhận dạng nội dung tệp PDF (Gemini AI Vision & PDF Extractor)...');
      try {
        const ocrResult = await parsePdfWithOcr(file, authHeader);
        if (!ocrResult.text || !ocrResult.text.trim()) {
          throw new Error('Không nhận dạng được nội dung văn bản từ tệp PDF này.');
        }

        setContent(ocrResult.text);
        setOcrSuccessInfo({
          charCount: ocrResult.characterCount || ocrResult.text.length,
          fileName: file.name,
          notice: ocrResult.notice,
          method: ocrResult.method,
        });

        if (!tagsInput) {
          setTagsInput(ocrResult.method === 'ocr_gemini' ? 'PDF, OCR_Gemini, Knowledge' : 'PDF, PDF_Parser, Knowledge');
        }
      } catch (err: any) {
        console.error('PDF OCR error:', err);
        setError(
          err?.message ||
            'Không thể xử lý tệp PDF. Vui lòng kiểm tra lại tệp hoặc cấu hình API Key trong phần Cài Đặt.'
        );
      } finally {
        setIsOcrProcessing(false);
        setOcrStatus('');
      }
      return;
    }

    // Standard text files
    const reader = new FileReader();
    reader.onload = event => {
      const text = event.target?.result as string;
      setContent(text || '');
      if (!tagsInput) {
        const ext = file.name.split('.').pop()?.toUpperCase() || 'DOC';
        setTagsInput(`${ext}, Import`);
      }
    };
    reader.onerror = () => {
      setError('Không thể đọc nội dung tệp đã chọn.');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const calculateEstimatedChunks = () => {
    if (!content.trim()) return 0;
    if (chunkingStrategy === 'paragraph') {
      return content.split(/\n\s*\n/).filter(Boolean).length || 1;
    }
    if (chunkingStrategy === 'semantic_sentence') {
      const sentences = content.match(/[^.!?\n]+[.!?\n]+/g) || [content];
      return Math.max(1, Math.ceil(sentences.length / 3));
    }
    return Math.max(1, Math.ceil(content.length / (chunkSize - chunkOverlap)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('Vui lòng nhập đầy đủ tiêu đề và nội dung tài liệu.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    try {
      const res = await fetch('/api/kb/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          category: category.trim(),
          tags,
          chunkingStrategy,
          chunkSize,
          chunkOverlap,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi lưu tài liệu');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Không thể tạo vector embeddings');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141414]/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-3xl bg-white border border-[#141414] p-5 shadow-2xl text-[#141414] max-h-[90vh] flex flex-col font-mono">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#141414]">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-[#141414] text-white flex items-center justify-center text-xs font-bold">
              <UploadCloud className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#141414]">
                INGEST_DOCUMENT & OCR AI PIPELINE (PDF / TXT / MD / JSON)
              </h3>
              <p className="text-[10px] text-[#666]">
                Gemini Vision OCR extraction, recursive partition chunking & 768D vectorization
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#666] hover:text-[#141414] p-1 hover:bg-[#E4E3E0] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="my-2.5 p-2.5 bg-rose-50 border border-rose-600 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-3 py-3 pr-1">
          {/* File Upload drag area */}
          <div
            onDragOver={e => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed p-4 text-center cursor-pointer transition-colors relative ${
              isDragOver
                ? 'border-[#141414] bg-[#E4E3E0]'
                : 'border-[#141414] bg-[#F8F7F4] hover:bg-[#EFEFEA]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md,.json,.csv,application/pdf"
              onChange={handleFileInputChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />

            {isOcrProcessing ? (
              <div className="py-2 flex flex-col items-center justify-center space-y-1.5">
                <Loader2 className="w-6 h-6 text-[#141414] animate-spin" />
                <p className="text-xs font-bold text-[#141414] uppercase">
                  {ocrStatus || 'ĐANG THỰC HIỆN OCR QUANG HỌC BẰNG GEMINI VISION...'}
                </p>
                <p className="text-[10px] text-[#666]">
                  Đang nhận dạng toàn bộ văn bản tiếng Việt, bảng biểu, danh sách và chuẩn hóa Markdown
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 mb-1.5">
                  <div className="px-2 py-0.5 bg-[#141414] text-white flex items-center gap-1 text-[10px] font-bold">
                    <ScanText className="w-3.5 h-3.5" />
                    <span>OCR_VISION_ACTIVE</span>
                  </div>
                  <FileText className="w-5 h-5 text-[#141414]" />
                  <FileType className="w-5 h-5 text-[#141414]" />
                </div>
                <p className="text-xs font-bold text-[#141414]">
                  KÉO THẢ TỆP <span className="text-red-700 bg-red-100 px-1.5 py-0.5 font-bold">PDF (SCAN / SỐ)</span> HOẶC TXT, MD VÀO ĐÂY, HOẶC <span className="underline">CHỌN TỆP</span>
                </p>
                <p className="text-[10px] text-[#666] mt-0.5">
                  Hệ thống sử dụng Gemini Multimodal OCR để trích xuất văn bản chuẩn xác 100% kèm bảng biểu
                </p>
              </>
            )}
          </div>

          {ocrSuccessInfo && (
            <div className="bg-emerald-50 border border-emerald-600 p-2.5 text-xs text-emerald-800 flex flex-col gap-1.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-1.5 font-bold text-[11px]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ĐÃ XỬ LÝ & CHUYỂN ĐỔI THÀNH CÔNG TỆP PDF: {ocrSuccessInfo.fileName}
                </span>
                <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 border border-emerald-600">
                  {ocrSuccessInfo.charCount.toLocaleString()} KÝ TỰ (MARKDOWN)
                </span>
              </div>
              {ocrSuccessInfo.notice && (
                <p className="text-[10px] text-emerald-700 font-mono pl-5">
                  {ocrSuccessInfo.notice}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-[#141414] uppercase mb-1">DOCUMENT_TITLE *</label>
              <input
                id="doc-title-input"
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Technical_Spec_RAG_2026.md"
                className="w-full bg-[#F8F7F4] border border-[#141414] px-3 py-1.5 text-xs text-[#141414] placeholder-[#888] focus:outline-none focus:bg-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-bold text-[#141414] uppercase">
                  DANH MỤC PHÂN LOẠI (CATEGORY)
                </label>
                <button
                  type="button"
                  onClick={() => setIsCreatingNewCat(!isCreatingNewCat)}
                  className="text-[10px] text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 underline"
                >
                  {isCreatingNewCat ? 'Chọn có sẵn' : '+ Tạo nhóm mới'}
                </button>
              </div>

              {isCreatingNewCat ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    placeholder="Nhập tên danh mục mới..."
                    className="flex-1 bg-white border border-[#141414] px-2.5 py-1.5 text-xs text-[#141414] placeholder-[#888] focus:outline-none ring-1 ring-[#141414]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newCatName.trim()) {
                        const trimmed = newCatName.trim();
                        setCategory(trimmed);
                        if (!categoriesList.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
                          setCategoriesList(prev => [
                            ...prev,
                            {
                              id: `temp_${Date.now()}`,
                              userId: '',
                              name: trimmed,
                              color: '#2563eb',
                              icon: 'Folder',
                              createdAt: new Date().toISOString(),
                            },
                          ]);
                        }
                        setIsCreatingNewCat(false);
                        setNewCatName('');
                      }
                    }}
                    disabled={!newCatName.trim()}
                    className="px-2.5 py-1.5 bg-[#141414] hover:bg-[#333] disabled:opacity-50 text-white text-xs font-bold"
                  >
                    Dùng
                  </button>
                </div>
              ) : (
                <select
                  value={category}
                  onChange={e => {
                    if (e.target.value === '__NEW__') {
                      setIsCreatingNewCat(true);
                    } else {
                      setCategory(e.target.value);
                    }
                  }}
                  className="w-full bg-[#F8F7F4] border border-[#141414] px-3 py-1.5 text-xs text-[#141414] focus:outline-none focus:bg-white"
                >
                  {categoriesList.map(cat => (
                    <option key={cat.id} value={cat.name}>
                      📁 {cat.name} {cat.documentCount ? `(${cat.documentCount} tài liệu)` : ''}
                    </option>
                  ))}
                  <option value="__NEW__">+ [Tạo danh mục mới...]</option>
                </select>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#141414] uppercase mb-1">METADATA_TAGS (COMMA_SEPARATED)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="RAG, VectorDB, Gemini, Embeddings"
              className="w-full bg-[#F8F7F4] border border-[#141414] px-3 py-1.5 text-xs text-[#141414] placeholder-[#888] focus:outline-none focus:bg-white"
            />
          </div>

          {/* Chunking Strategy Configuration */}
          <div className="bg-[#F8F7F4] border border-[#141414] p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#141414] flex items-center gap-1.5 uppercase">
                <Settings2 className="w-3.5 h-3.5" />
                CHUNKING_STRATEGY_CONFIG
              </span>
              <span className="text-[9px] px-1.5 py-0.2 bg-[#141414] text-white font-bold">
                ~{calculateEstimatedChunks()} CHUNKS ESTIMATED
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setChunkingStrategy('paragraph')}
                className={`p-2 border text-left text-xs transition-all ${
                  chunkingStrategy === 'paragraph'
                    ? 'border-[#141414] bg-[#141414] text-white'
                    : 'border-[#141414] bg-white text-[#141414] hover:bg-[#E4E3E0]'
                }`}
              >
                <div className="font-bold mb-0.5 text-[11px] uppercase">PARAGRAPH</div>
                <p className={`text-[9px] leading-tight ${chunkingStrategy === 'paragraph' ? 'text-[#CCC]' : 'text-[#666]'}`}>
                  Split on double newline boundaries
                </p>
              </button>

              <button
                type="button"
                onClick={() => setChunkingStrategy('semantic_sentence')}
                className={`p-2 border text-left text-xs transition-all ${
                  chunkingStrategy === 'semantic_sentence'
                    ? 'border-[#141414] bg-[#141414] text-white'
                    : 'border-[#141414] bg-white text-[#141414] hover:bg-[#E4E3E0]'
                }`}
              >
                <div className="font-bold mb-0.5 text-[11px] uppercase">SENTENCE</div>
                <p className={`text-[9px] leading-tight ${chunkingStrategy === 'semantic_sentence' ? 'text-[#CCC]' : 'text-[#666]'}`}>
                  Group intact sentences without truncating
                </p>
              </button>

              <button
                type="button"
                onClick={() => setChunkingStrategy('fixed_window')}
                className={`p-2 border text-left text-xs transition-all ${
                  chunkingStrategy === 'fixed_window'
                    ? 'border-[#141414] bg-[#141414] text-white'
                    : 'border-[#141414] bg-white text-[#141414] hover:bg-[#E4E3E0]'
                }`}
              >
                <div className="font-bold mb-0.5 text-[11px] uppercase">SLIDING_WINDOW</div>
                <p className={`text-[9px] leading-tight ${chunkingStrategy === 'fixed_window' ? 'text-[#CCC]' : 'text-[#666]'}`}>
                  Fixed character bounds with overlap
                </p>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex justify-between text-[10px] text-[#666] mb-1">
                  <span>CHUNK_SIZE (CHARS)</span>
                  <span className="font-bold text-[#141414]">{chunkSize}</span>
                </div>
                <input
                  type="range"
                  min="150"
                  max="1200"
                  step="50"
                  value={chunkSize}
                  onChange={e => setChunkSize(Number(e.target.value))}
                  className="w-full accent-[#141414] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-[#666] mb-1">
                  <span>CHUNK_OVERLAP (CHARS)</span>
                  <span className="font-bold text-[#141414]">{chunkOverlap}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  step="10"
                  value={chunkOverlap}
                  onChange={e => setChunkOverlap(Number(e.target.value))}
                  className="w-full accent-[#141414] cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[10px] font-bold text-[#141414] uppercase">
                RAW_DOCUMENT_CONTENT (ĐÃ CHUYỂN ĐỔI SANG MARKDOWN) *
              </label>
              <span className="text-[10px] text-[#666] font-mono">{content.length} CHARS</span>
            </div>
            <textarea
              id="doc-content-textarea"
              rows={7}
              required
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Nội dung tài liệu sẽ tự động được OCR từ file PDF hoặc dán trực tiếp tại đây..."
              className="w-full bg-[#F8F7F4] border border-[#141414] p-3 text-xs text-[#141414] placeholder-[#888] font-mono focus:outline-none focus:bg-white leading-relaxed"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="pt-3 border-t border-[#141414] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-[#141414] bg-white hover:bg-[#E4E3E0] text-[#141414] text-xs font-bold transition-colors uppercase"
          >
            DISCARD
          </button>

          <button
            id="doc-submit-btn"
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || isOcrProcessing || !content.trim() || !title.trim()}
            className="px-4 py-1.5 bg-[#141414] hover:bg-[#333] disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center gap-2 uppercase"
          >
            {isSubmitting ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>COMPUTING_EMBEDDINGS...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>INGEST & VECTORIZE</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};


