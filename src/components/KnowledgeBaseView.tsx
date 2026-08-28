import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  Sparkles,
  Layers,
  FileText,
  Tag,
  AlertCircle,
  Eye,
  CheckCircle,
  Search,
  RefreshCw,
  Folder,
  FolderPlus,
  Grid,
  List,
  ChevronDown,
  ChevronRight,
  Settings,
  ArrowRight,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { KBDocument, DocumentChunk, KBCategory } from '../types';
import { ChunkInspectorModal } from './ChunkInspectorModal';
import { CategoryManageModal, renderCategoryIcon } from './CategoryManageModal';

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
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedChunk, setSelectedChunk] = useState<DocumentChunk | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [categories, setCategories] = useState<KBCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [movingDocId, setMovingDocId] = useState<string | null>(null);
  const [quickCatChangeSuccess, setQuickCatChangeSuccess] = useState<string | null>(null);

  // Fetch categories from backend
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/kb/categories', { headers: authHeader });
      if (res.ok) {
        const data = await res.json();
        const cats = data.categories || [];
        setCategories(cats);

        // Auto-expand all categories by default
        const initExpanded: Record<string, boolean> = {};
        cats.forEach((c: KBCategory) => {
          initExpanded[c.name] = true;
        });
        setExpandedCategories(prev => ({ ...initExpanded, ...prev }));
      }
    } catch (e) {
      console.error('Error fetching categories:', e);
    }
  }, [authHeader]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleRefreshAll = () => {
    onRefresh();
    fetchCategories();
  };

  const handleDelete = async (docId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tài liệu này cùng toàn bộ các vector chunks liên quan?')) {
      return;
    }
    setIsDeleting(docId);
    try {
      const res = await fetch(`/api/kb/documents/${docId}`, {
        method: 'DELETE',
        headers: authHeader,
      });
      if (res.ok) {
        handleRefreshAll();
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
        handleRefreshAll();
      }
    } catch (e) {
      console.error('Seed presets error:', e);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleQuickChangeCategory = async (docId: string, newCategoryName: string) => {
    setMovingDocId(docId);
    setQuickCatChangeSuccess(null);
    try {
      const res = await fetch(`/api/kb/documents/${docId}/category`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify({ category: newCategoryName }),
      });

      if (res.ok) {
        setQuickCatChangeSuccess(docId);
        setTimeout(() => setQuickCatChangeSuccess(null), 2500);
        handleRefreshAll();
      }
    } catch (e) {
      console.error('Quick change category error:', e);
    } finally {
      setMovingDocId(null);
    }
  };

  const toggleCategoryExpand = (catName: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catName]: !prev[catName],
    }));
  };

  // Filter documents by search and category
  const filteredDocs = documents.filter(d => {
    const matchesCategory = selectedCategory === 'all' || (d.category || '').toLowerCase() === selectedCategory.toLowerCase();
    if (!matchesCategory) return false;

    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      d.title.toLowerCase().includes(q) ||
      (d.category || '').toLowerCase().includes(q) ||
      (d.tags || []).some(t => t.toLowerCase().includes(q)) ||
      (d.content || '').toLowerCase().includes(q)
    );
  });

  // Filtered chunks
  const displayedChunks = chunks.filter(c => {
    if (selectedDocId !== 'all' && c.documentId !== selectedDocId) return false;
    if (selectedCategory !== 'all' && (c.category || '').toLowerCase() !== selectedCategory.toLowerCase()) return false;
    if (searchFilter && !c.content.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  });

  // Group documents by category
  const docsByCategory: Record<string, KBDocument[]> = {};
  filteredDocs.forEach(doc => {
    const cat = doc.category || 'Tài liệu chung';
    if (!docsByCategory[cat]) {
      docsByCategory[cat] = [];
    }
    docsByCategory[cat].push(doc);
  });

  // Category list sorted by count or presets
  const activeCategoriesList = categories.length > 0
    ? categories
    : Array.from(new Set(documents.map(d => d.category || 'Tài liệu chung'))).map(name => ({
        id: name,
        userId: '',
        name,
        color: '#2563eb',
        icon: 'Folder',
        createdAt: '',
        documentCount: documents.filter(d => d.category === name).length,
      }));

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
              KHO TRI THỨC & QUẢN LÝ DANH MỤC VECTOR
            </h1>
            <p className="text-[11px] font-mono text-[#666]">
              Phân loại tài liệu, quản lý taxonomy, nạp OCR PDF và đồng bộ hóa vector embeddings
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="kb-manage-categories-btn"
            onClick={() => setIsCatModalOpen(true)}
            className="px-3 py-1.5 bg-white hover:bg-[#E4E3E0] border border-[#141414] text-[#141414] text-xs font-mono font-bold flex items-center gap-1.5 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5 text-blue-700" />
            <span>QUẢN LÝ CATEGORY</span>
          </button>

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
            <span>+ NẠP TÀI LIỆU (INGEST)</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono">
        <div className="bg-white border border-[#141414] p-3">
          <span className="text-[10px] text-[#666] uppercase block">TÀI LIỆU HOẠT ĐỘNG</span>
          <span className="text-xl font-bold text-[#141414]">{documents.length}</span>
        </div>
        <div className="bg-white border border-[#141414] p-3">
          <span className="text-[10px] text-[#666] uppercase block">DANH MỤC PHÂN LOẠI</span>
          <span className="text-xl font-bold text-blue-700">{activeCategoriesList.length}</span>
        </div>
        <div className="bg-white border border-[#141414] p-3">
          <span className="text-[10px] text-[#666] uppercase block">TỔNG PHÂN ĐOẠN (CHUNKS)</span>
          <span className="text-xl font-bold text-[#141414]">{chunks.length}</span>
        </div>
        <div className="bg-white border border-[#141414] p-3">
          <span className="text-[10px] text-[#666] uppercase block">TRẠNG THÁI VECTOR</span>
          <span className="text-xs font-bold text-emerald-700 block mt-1">● EMBEDDINGS_SYNCED</span>
        </div>
      </div>

      {/* Category Filter Pills & Mode Switcher Bar */}
      <div className="bg-white border border-[#141414] p-3 font-mono space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-[#141414] flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5" />
              LỌC THEO DANH MỤC:
            </span>
            <button
              onClick={() => setIsCatModalOpen(true)}
              className="text-[10px] text-blue-700 hover:text-blue-900 font-bold underline flex items-center gap-0.5"
            >
              + Tạo mới
            </button>
          </div>

          {/* View Mode & Search Tools */}
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-[#141414] bg-[#F8F7F4]">
              <button
                onClick={() => setViewMode('grouped')}
                className={`px-2.5 py-1 text-xs font-bold flex items-center gap-1 transition-colors ${
                  viewMode === 'grouped'
                    ? 'bg-[#141414] text-white'
                    : 'text-[#666] hover:text-[#141414]'
                }`}
                title="Gom nhóm theo danh mục"
              >
                <Grid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">GOM NHÓM</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1 text-xs font-bold flex items-center gap-1 transition-colors ${
                  viewMode === 'list'
                    ? 'bg-[#141414] text-white'
                    : 'text-[#666] hover:text-[#141414]'
                }`}
                title="Danh sách phẳng"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">DANH SÁCH</span>
              </button>
            </div>

            <button
              onClick={handleRefreshAll}
              className="p-1 border border-[#141414] bg-white hover:bg-[#E4E3E0] text-[#141414]"
              title="Làm mới"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Category Pills Slider / Wrap */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <button
            onClick={() => {
              setSelectedCategory('all');
              setSelectedDocId('all');
            }}
            className={`px-2.5 py-1 text-xs border transition-all flex items-center gap-1.5 ${
              selectedCategory === 'all'
                ? 'bg-[#141414] text-white border-[#141414] font-bold shadow-sm'
                : 'bg-[#F8F7F4] border-[#141414]/30 text-[#444] hover:bg-white hover:border-[#141414]'
            }`}
          >
            <span>TẤT CẢ DANH MỤC</span>
            <span
              className={`px-1.5 py-0.2 text-[9px] ${
                selectedCategory === 'all' ? 'bg-white/20 text-white' : 'bg-[#E4E3E0] text-[#141414]'
              }`}
            >
              {documents.length}
            </span>
          </button>

          {activeCategoriesList.map(cat => {
            const isSelected = selectedCategory.toLowerCase() === cat.name.toLowerCase();
            const docCount = cat.documentCount !== undefined
              ? cat.documentCount
              : documents.filter(d => (d.category || '').toLowerCase() === cat.name.toLowerCase()).length;

            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(isSelected ? 'all' : cat.name);
                  setSelectedDocId('all');
                }}
                className={`px-2.5 py-1 text-xs border transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'border-[#141414] text-white font-bold shadow-sm'
                    : 'bg-[#F8F7F4] border-[#141414]/30 text-[#333] hover:bg-white hover:border-[#141414]'
                }`}
                style={isSelected ? { backgroundColor: cat.color || '#141414' } : {}}
              >
                <span style={{ color: isSelected ? '#FFF' : cat.color || '#2563eb' }}>
                  {renderCategoryIcon(cat.icon, 'w-3.5 h-3.5')}
                </span>
                <span>{cat.name}</span>
                <span
                  className={`px-1.5 py-0.2 text-[9px] ${
                    isSelected ? 'bg-white/25 text-white' : 'bg-[#E4E3E0] text-[#141414]'
                  }`}
                >
                  {docCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="pt-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#888] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Tìm kiếm tài liệu, từ khóa, tag hoặc phân đoạn vector..."
              className="w-full bg-[#F8F7F4] border border-[#141414] pl-8 pr-3 py-1.5 text-xs text-[#141414] placeholder-[#888] focus:outline-none focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* Main View: Grouped by Category vs Flat List */}
      {viewMode === 'grouped' ? (
        /* ================= GROUPED BY CATEGORY VIEW ================= */
        <div className="space-y-4 font-mono">
          {filteredDocs.length === 0 ? (
            <div className="bg-white border border-[#141414] p-12 text-center">
              <Folder className="w-10 h-10 text-[#888] mx-auto mb-3" />
              <h3 className="text-sm font-bold uppercase text-[#141414]">KHÔNG CÓ TÀI LIỆU NÀO TRONG DANH MỤC NÀY</h3>
              <p className="text-xs text-[#666] mt-1 mb-4">
                Hãy nạp tài liệu mới hoặc tạo thêm phân loại cho cơ sở tri thức của bạn
              </p>
              <button
                onClick={onOpenDocModal}
                className="px-4 py-2 bg-[#141414] text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                + NẠP TÀI LIỆU NGAY
              </button>
            </div>
          ) : (
            Object.entries(docsByCategory).map(([catName, docsInCat]) => {
              const catMeta = categories.find(c => c.name.toLowerCase() === catName.toLowerCase()) || {
                name: catName,
                color: '#2563eb',
                icon: 'Folder',
                description: 'Danh mục tài liệu',
              };
              const isExpanded = expandedCategories[catName] !== false;
              const totalCatChunks = docsInCat.reduce((acc, d) => acc + (d.chunkCount || 0), 0);

              return (
                <div key={catName} className="bg-white border border-[#141414] overflow-hidden shadow-none">
                  {/* Category Folder Header */}
                  <div
                    onClick={() => toggleCategoryExpand(catName)}
                    className="p-3.5 bg-[#F8F7F4] border-b border-[#141414] cursor-pointer hover:bg-[#EFEFEA] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 select-none"
                  >
                    <div className="flex items-center gap-3">
                      <button className="text-[#141414] p-0.5">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>

                      <div
                        className="w-7 h-7 flex items-center justify-center text-white text-xs border border-[#141414]"
                        style={{ backgroundColor: catMeta.color || '#2563eb' }}
                      >
                        {renderCategoryIcon(catMeta.icon, 'w-4 h-4')}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold uppercase text-[#141414]">{catName}</h3>
                          <span className="text-[10px] px-2 py-0.2 bg-[#141414] text-white font-bold">
                            {docsInCat.length} TÀI LIỆU
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-[#E4E3E0] border border-[#141414]/20 text-[#141414]">
                            {totalCatChunks} CHUNKS
                          </span>
                        </div>
                        {catMeta.description && (
                          <p className="text-[10px] text-[#666] line-clamp-1 mt-0.5">{catMeta.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setSelectedCategory(catName);
                          onOpenDocModal();
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-[#E4E3E0] border border-[#141414] text-xs font-bold flex items-center gap-1 text-[#141414]"
                        title={`Thêm tài liệu vào nhóm ${catName}`}
                      >
                        <Plus className="w-3 h-3" />
                        <span>NẠP VÀO NHÓM NÀY</span>
                      </button>
                    </div>
                  </div>

                  {/* Documents Grid inside this Category */}
                  {isExpanded && (
                    <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-[#FCFCFA]">
                      {docsInCat.map(doc => {
                        const isDocMoving = movingDocId === doc.id;
                        const isDocSuccess = quickCatChangeSuccess === doc.id;

                        return (
                          <div
                            key={doc.id}
                            className="p-3 bg-white border border-[#141414] hover:shadow-md transition-all flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="text-xs font-bold text-[#141414] line-clamp-2 uppercase">
                                  {doc.title}
                                </h4>
                                <button
                                  onClick={() => handleDelete(doc.id)}
                                  disabled={isDeleting === doc.id}
                                  className="text-[#888] hover:text-rose-600 p-1 hover:bg-rose-50 transition-colors"
                                  title="Xóa tài liệu"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                <span className="text-[9px] px-1.5 py-0.2 bg-[#141414] text-white font-bold">
                                  {doc.chunkCount} CHUNKS
                                </span>
                                <span className="text-[9px] px-1.5 py-0.2 bg-[#E4E3E0] text-[#141414]">
                                  {doc.chunkingStrategy}
                                </span>
                                <span className="text-[9px] text-emerald-700 font-bold">
                                  ● INDEXED
                                </span>
                              </div>

                              {doc.tags && doc.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {doc.tags.map((t, idx) => (
                                    <span
                                      key={idx}
                                      className="text-[9px] px-1.5 py-0.2 bg-[#F8F7F4] border border-[#141414]/20 text-[#444]"
                                    >
                                      #{t}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Move / Change Category Dropdown */}
                            <div className="mt-3 pt-2 border-t border-[#141414]/15 flex items-center justify-between text-[10px]">
                              <span className="text-[#666] flex items-center gap-1">
                                <Folder className="w-3 h-3" />
                                Đổi nhóm:
                              </span>
                              <div className="relative">
                                <select
                                  disabled={isDocMoving}
                                  value={doc.category}
                                  onChange={e => handleQuickChangeCategory(doc.id, e.target.value)}
                                  className="text-[10px] bg-[#F8F7F4] border border-[#141414] px-1.5 py-0.5 font-bold focus:outline-none cursor-pointer max-w-[130px] truncate"
                                >
                                  {categories.map(c => (
                                    <option key={c.id} value={c.name}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                                {isDocSuccess && (
                                  <span className="absolute -top-6 right-0 bg-emerald-600 text-white text-[8px] px-1.5 py-0.5 shadow">
                                    ĐÃ ĐỔI NHÓM!
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ================= FLAT LIST & CHUNK INSPECTOR VIEW ================= */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 font-mono">
          {/* Left: Document List (5 cols) */}
          <div className="lg:col-span-5 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#141414] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                DANH SÁCH TÀI LIỆU ({filteredDocs.length})
              </h3>
              <span className="text-[10px] text-[#666]">
                {selectedCategory === 'all' ? 'TẤT CẢ' : selectedCategory}
              </span>
            </div>

            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {/* Filter All Option */}
              <button
                onClick={() => setSelectedDocId('all')}
                className={`w-full text-left p-2.5 border transition-all text-xs flex items-center justify-between ${
                  selectedDocId === 'all'
                    ? 'bg-[#141414] text-white border-[#141414] font-bold'
                    : 'bg-white border-[#141414] text-[#141414] hover:bg-[#F8F7F4]'
                }`}
              >
                <span>TẤT CẢ TÀI LIỆU</span>
                <span
                  className={`px-1.5 py-0.2 text-[10px] ${
                    selectedDocId === 'all' ? 'bg-white/20 text-white' : 'bg-[#E4E3E0] text-[#141414]'
                  }`}
                >
                  {chunks.length} chunks
                </span>
              </button>

              {filteredDocs.map(doc => {
                const isSelected = selectedDocId === doc.id;
                const catMeta = categories.find(c => c.name.toLowerCase() === (doc.category || '').toLowerCase());

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
                      <h4 className="text-xs font-bold text-[#141414] line-clamp-1 uppercase">{doc.title}</h4>
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
                      <span
                        className="text-[10px] px-1.5 py-0.2 text-white font-bold flex items-center gap-1"
                        style={{ backgroundColor: catMeta?.color || '#2563eb' }}
                      >
                        {renderCategoryIcon(catMeta?.icon, 'w-3 h-3')}
                        {doc.category}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-[#141414] text-white">
                        {doc.chunkCount} Chunks
                      </span>
                      <span className="text-[10px] text-[#666]">{doc.chunkingStrategy}</span>
                    </div>

                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {doc.tags.map((t, idx) => (
                          <span
                            key={idx}
                            className="text-[9px] px-1 py-0.2 bg-[#F8F7F4] border border-[#141414]/20 text-[#444]"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 text-[9px] text-[#666] flex items-center justify-between border-t border-[#141414]/10 pt-1.5">
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#141414] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                PHÂN ĐOẠN VECTOR (CHUNKS: {displayedChunks.length})
              </h3>
              <span className="text-[10px] text-[#666]">
                {selectedDocId === 'all' ? 'TẤT CẢ PHÂN ĐOẠN' : 'TÀI LIỆU ĐANG CHỌN'}
              </span>
            </div>

            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {displayedChunks.length === 0 ? (
                <div className="text-center py-12 bg-white border border-[#141414]">
                  <FileText className="w-8 h-8 text-[#888] mx-auto mb-2" />
                  <p className="text-xs text-[#666]">KHÔNG CÓ CHUNK NÀO PHÙ HỢP BỘ LỌC</p>
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
                        <span className="text-[10px] px-1.5 py-0.2 bg-[#141414] text-white font-bold">
                          CHUNK #{chunk.chunkIndex}
                        </span>
                        <span className="text-xs font-bold text-[#141414] truncate max-w-[200px]">
                          {chunk.documentTitle}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-[#666]">
                        <span className="px-1.5 py-0.2 bg-[#E4E3E0] text-[#141414] font-bold">
                          {chunk.category}
                        </span>
                        <span>{chunk.characterCount} ký tự</span>
                        <span>•</span>
                        <span className="text-blue-600 font-bold">{chunk.embeddingDim || 768}D</span>
                      </div>
                    </div>

                    <p className="text-xs text-[#333] line-clamp-3 leading-relaxed bg-[#F8F7F4] p-2 border border-[#141414]/20">
                      {chunk.content}
                    </p>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-[#666]">
                      <span>UID: {chunk.id}</span>
                      <span className="text-[#141414] font-bold flex items-center gap-1 group-hover:underline">
                        <Eye className="w-3 h-3" />
                        XEM CHI TIẾT
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      <CategoryManageModal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        categories={categories}
        onRefresh={handleRefreshAll}
      />

      {/* Chunk Inspector Modal */}
      <ChunkInspectorModal
        chunk={selectedChunk}
        onClose={() => setSelectedChunk(null)}
      />
    </div>
  );
};
