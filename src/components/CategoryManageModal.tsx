import React, { useState } from 'react';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Folder,
  Cpu,
  Server,
  Shield,
  BookOpen,
  FileText,
  Database,
  Terminal,
  Code,
  Sparkles,
  Layers,
  Archive,
  Check,
  AlertCircle,
  FolderPlus,
  Tag,
  Hash,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { KBCategory } from '../types';

interface CategoryManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: KBCategory[];
  onRefresh: () => void;
}

// Icon mapper helper
export const renderCategoryIcon = (iconName?: string, className = 'w-4 h-4') => {
  switch (iconName?.toLowerCase()) {
    case 'cpu':
      return <Cpu className={className} />;
    case 'server':
      return <Server className={className} />;
    case 'shield':
      return <Shield className={className} />;
    case 'bookopen':
    case 'book':
      return <BookOpen className={className} />;
    case 'filetext':
    case 'file':
      return <FileText className={className} />;
    case 'database':
    case 'db':
      return <Database className={className} />;
    case 'terminal':
      return <Terminal className={className} />;
    case 'code':
      return <Code className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
    case 'layers':
      return <Layers className={className} />;
    case 'archive':
      return <Archive className={className} />;
    case 'folder':
    default:
      return <Folder className={className} />;
  }
};

const COLOR_PRESETS = [
  { label: 'Blue', value: '#2563eb', bgClass: 'bg-blue-600' },
  { label: 'Emerald', value: '#059669', bgClass: 'bg-emerald-600' },
  { label: 'Teal', value: '#0d9488', bgClass: 'bg-teal-600' },
  { label: 'Purple', value: '#9333ea', bgClass: 'bg-purple-600' },
  { label: 'Amber', value: '#d97706', bgClass: 'bg-amber-600' },
  { label: 'Red', value: '#dc2626', bgClass: 'bg-rose-600' },
  { label: 'Indigo', value: '#4f46e5', bgClass: 'bg-indigo-600' },
  { label: 'Dark Gray', value: '#374151', bgClass: 'bg-gray-700' },
];

const ICON_OPTIONS = [
  { name: 'Folder', label: 'Thư mục' },
  { name: 'Cpu', label: 'AI / CPU' },
  { name: 'Server', label: 'Máy chủ / Infra' },
  { name: 'Shield', label: 'Bảo mật' },
  { name: 'BookOpen', label: 'Sách / Hướng dẫn' },
  { name: 'FileText', label: 'Tài liệu / Văn bản' },
  { name: 'Database', label: 'Cơ sở dữ liệu' },
  { name: 'Terminal', label: 'Terminal / Lệnh' },
  { name: 'Code', label: 'Mã nguồn' },
  { name: 'Sparkles', label: 'Đặc biệt / AI' },
  { name: 'Layers', label: 'Phân tầng' },
  { name: 'Archive', label: 'Lưu trữ' },
];

export const CategoryManageModal: React.FC<CategoryManageModalProps> = ({
  isOpen,
  onClose,
  categories,
  onRefresh,
}) => {
  const { authHeader } = useAuth();
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [icon, setIcon] = useState('Folder');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setEditingCatId(null);
    setName('');
    setDescription('');
    setColor('#2563eb');
    setIcon('Folder');
    setError(null);
    setSuccessMsg(null);
  };

  const handleStartEdit = (cat: KBCategory) => {
    setEditingCatId(cat.id);
    setName(cat.name);
    setDescription(cat.description || '');
    setColor(cat.color || '#2563eb');
    setIcon(cat.icon || 'Folder');
    setError(null);
    setSuccessMsg(null);
  };

  const handleCancelEdit = () => {
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập tên danh mục.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (editingCatId) {
        // Update category
        const res = await fetch(`/api/kb/categories/${editingCatId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...authHeader,
          },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
            color,
            icon,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Lỗi khi cập nhật danh mục');
        setSuccessMsg(`Đã cập nhật danh mục "${name.trim()}" và đồng bộ tài liệu thành công.`);
      } else {
        // Create new category
        const res = await fetch('/api/kb/categories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeader,
          },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
            color,
            icon,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Lỗi khi tạo danh mục mới');
        setSuccessMsg(`Đã tạo mới danh mục "${name.trim()}".`);
      }

      onRefresh();
      resetForm();
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi lưu danh mục.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (cat: KBCategory) => {
    const docNotice = cat.documentCount && cat.documentCount > 0
      ? `\nDanh mục này đang có ${cat.documentCount} tài liệu. Các tài liệu sẽ được tự động chuyển sang nhóm "Tài liệu chung".`
      : '';

    if (!window.confirm(`Bạn có chắc chắn muốn xóa danh mục "${cat.name}"?${docNotice}`)) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/kb/categories/${cat.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify({
          fallbackCategory: 'Tài liệu chung',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi khi xóa danh mục');

      setSuccessMsg(data.message || 'Đã xóa danh mục thành công.');
      onRefresh();
      if (editingCatId === cat.id) {
        resetForm();
      }
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi xóa danh mục.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141414]/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-4xl bg-white border border-[#141414] p-5 shadow-2xl text-[#141414] max-h-[90vh] flex flex-col font-mono">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#141414]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#141414] text-white flex items-center justify-center text-xs font-bold">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#141414]">
                QUẢN LÝ DANH MỤC & PHÂN LOẠI TÀI LIỆU (CATEGORY_TAXONOMY)
              </h3>
              <p className="text-[10px] text-[#666]">
                Tạo nhóm, tùy chỉnh màu sắc, biểu tượng và gom nhóm các nguồn tri thức vector
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

        {/* Notifications */}
        {error && (
          <div className="mt-3 p-2.5 bg-rose-50 border border-rose-600 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-600 text-emerald-800 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-5 py-4 pr-1">
          {/* Left Column: Create / Edit Form (5 cols) */}
          <div className="lg:col-span-5 bg-[#F8F7F4] border border-[#141414] p-3.5 flex flex-col justify-between">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#141414]/20">
                <span className="text-xs font-bold uppercase text-[#141414] flex items-center gap-1.5">
                  {editingCatId ? <Edit2 className="w-3.5 h-3.5 text-blue-600" /> : <Plus className="w-3.5 h-3.5" />}
                  {editingCatId ? 'CHỈNH SỬA DANH MỤC' : 'TẠO DANH MỤC MỚI'}
                </span>
                {editingCatId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="text-[10px] text-[#666] hover:text-[#141414] underline"
                  >
                    HỦY BỎ
                  </button>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#141414] uppercase mb-1">
                  TÊN DANH MỤC *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ví dụ: Tài liệu DevOps, Pháp Lý, API..."
                  className="w-full bg-white border border-[#141414] px-3 py-1.5 text-xs text-[#141414] placeholder-[#888] focus:outline-none focus:ring-1 focus:ring-[#141414]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#141414] uppercase mb-1">
                  MÔ TẢ / MỤC ĐÍCH GOM NHÓM
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Ghi chú phân loại nội dung tài liệu..."
                  className="w-full bg-white border border-[#141414] px-3 py-1.5 text-xs text-[#141414] placeholder-[#888] focus:outline-none focus:ring-1 focus:ring-[#141414]"
                />
              </div>

              {/* Color Presets */}
              <div>
                <label className="block text-[10px] font-bold text-[#141414] uppercase mb-1.5">
                  MÀU NHẬN DIỆN (ACCENT_COLOR)
                </label>
                <div className="flex flex-wrap gap-2 items-center">
                  {COLOR_PRESETS.map(preset => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setColor(preset.value)}
                      className={`w-6 h-6 rounded-full border flex items-center justify-center transition-transform ${
                        color === preset.value
                          ? 'border-[#141414] scale-110 ring-2 ring-[#141414] ring-offset-1'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: preset.value }}
                      title={preset.label}
                    >
                      {color === preset.value && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </button>
                  ))}
                  <input
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    className="w-6 h-6 p-0 border border-[#141414] cursor-pointer rounded-full bg-white"
                    title="Màu tùy chỉnh"
                  />
                </div>
              </div>

              {/* Icon Selector */}
              <div>
                <label className="block text-[10px] font-bold text-[#141414] uppercase mb-1.5">
                  BIỂU TƯỢNG (ICON)
                </label>
                <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto p-1 bg-white border border-[#141414]">
                  {ICON_OPTIONS.map(opt => (
                    <button
                      key={opt.name}
                      type="button"
                      onClick={() => setIcon(opt.name)}
                      className={`p-1.5 text-xs flex flex-col items-center justify-center gap-1 border transition-all ${
                        icon === opt.name
                          ? 'bg-[#141414] text-white border-[#141414]'
                          : 'bg-[#F8F7F4] text-[#444] border-transparent hover:border-[#141414]'
                      }`}
                      title={opt.label}
                    >
                      {renderCategoryIcon(opt.name, 'w-3.5 h-3.5')}
                      <span className="text-[8px] truncate w-full text-center">{opt.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview Badge */}
              <div className="pt-2">
                <span className="text-[9px] text-[#666] uppercase block mb-1">XEM TRƯỚC HIỂN THỊ:</span>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border border-[#141414] bg-white">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span style={{ color }}>{renderCategoryIcon(icon, 'w-3.5 h-3.5')}</span>
                  <span className="font-bold text-[#141414]">{name || 'Tên danh mục...'}</span>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2 bg-[#141414] hover:bg-[#333] text-white text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all shadow-none"
                >
                  {isLoading ? (
                    <span>ĐANG LƯU...</span>
                  ) : editingCatId ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>LƯU THAY ĐỔI</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ TẠO DANH MỤC</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Existing Categories List (7 cols) */}
          <div className="lg:col-span-7 space-y-2.5 flex flex-col">
            <div className="flex items-center justify-between pb-1 border-b border-[#141414]">
              <span className="text-xs font-bold uppercase text-[#141414] flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5" />
                DANH SÁCH DANH MỤC HIỆN CÓ ({categories.length})
              </span>
              <span className="text-[10px] text-[#666]">
                {categories.reduce((acc, c) => acc + (c.documentCount || 0), 0)} tài liệu đã phân loại
              </span>
            </div>

            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1 flex-1">
              {categories.length === 0 ? (
                <div className="text-center py-10 bg-[#F8F7F4] border border-[#141414]">
                  <Folder className="w-8 h-8 text-[#888] mx-auto mb-2" />
                  <p className="text-xs text-[#666]">CHƯA CÓ DANH MỤC NÀO ĐƯỢC TẠO</p>
                </div>
              ) : (
                categories.map(cat => (
                  <div
                    key={cat.id}
                    className={`p-3 bg-white border transition-all ${
                      editingCatId === cat.id
                        ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-600'
                        : 'border-[#141414] hover:bg-[#F8F7F4]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 flex items-center justify-center text-white text-xs border border-[#141414]"
                          style={{ backgroundColor: cat.color || '#2563eb' }}
                        >
                          {renderCategoryIcon(cat.icon, 'w-4 h-4')}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-[#141414] flex items-center gap-2">
                            <span>{cat.name}</span>
                          </h4>
                          {cat.description && (
                            <p className="text-[10px] text-[#666] line-clamp-1 mt-0.5">
                              {cat.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleStartEdit(cat)}
                          className="p-1 text-[#666] hover:text-blue-600 hover:bg-[#E4E3E0] border border-[#141414]/20 transition-colors"
                          title="Chỉnh sửa danh mục"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(cat)}
                          className="p-1 text-[#666] hover:text-rose-600 hover:bg-rose-50 border border-[#141414]/20 transition-colors"
                          title="Xóa danh mục"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-[#141414]/10 flex items-center justify-between text-[10px] text-[#666]">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-[#E4E3E0] border border-[#141414]/20 text-[#141414] font-bold">
                          {cat.documentCount || 0} TÀI LIỆU
                        </span>
                        <span className="px-1.5 py-0.5 bg-[#141414] text-white font-bold">
                          {cat.chunkCount || 0} CHUNKS
                        </span>
                      </div>
                      <span className="text-[9px]">ID: {cat.id.substring(0, 12)}...</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-[#141414] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#141414] hover:bg-[#333] text-white text-xs font-bold"
          >
            ĐÓNG CỬA SỔ
          </button>
        </div>
      </div>
    </div>
  );
};
