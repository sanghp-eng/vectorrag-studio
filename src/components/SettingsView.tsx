import React, { useState, useEffect } from 'react';
import {
  Settings,
  Sliders,
  ShieldCheck,
  Cpu,
  Database,
  Lock,
  Layers,
  Sparkles,
  Server,
  Key,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  ExternalLink,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { RAGSettings, GeminiApiKeyStatus } from '../types';
import { useAuth } from '../context/AuthContext';

interface SettingsViewProps {
  settings: RAGSettings;
  setSettings: React.Dispatch<React.SetStateAction<RAGSettings>>;
  documentCount: number;
  chunkCount: number;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  setSettings,
  documentCount,
  chunkCount,
}) => {
  const { user, authHeader } = useAuth();

  // Gemini API Key state
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKeyText, setShowKeyText] = useState(false);
  const [keyStatus, setKeyStatus] = useState<GeminiApiKeyStatus | null>(null);
  const [isLoadingKeyStatus, setIsLoadingKeyStatus] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const fetchKeyStatus = async () => {
    setIsLoadingKeyStatus(true);
    try {
      const res = await fetch('/api/settings/gemini-key', {
        headers: authHeader,
      });
      if (res.ok) {
        const data: GeminiApiKeyStatus = await res.json();
        setKeyStatus(data);
      }
    } catch (err) {
      console.error('Error fetching API key status:', err);
    } finally {
      setIsLoadingKeyStatus(false);
    }
  };

  useEffect(() => {
    fetchKeyStatus();
  }, []);

  const handleSaveApiKey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!apiKeyInput.trim()) {
      setFeedbackMessage({
        type: 'error',
        text: 'Vui lòng nhập API Key trước khi lưu.',
      });
      return;
    }

    setIsSavingKey(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch('/api/settings/gemini-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể lưu khóa API');
      }

      setFeedbackMessage({
        type: 'success',
        text: `Đã xác thực & kích hoạt thành công khóa Gemini API riêng! (${data.maskedKey})`,
      });
      setApiKeyInput('');
      fetchKeyStatus();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Lỗi khi kiểm tra hoặc lưu khóa API.',
      });
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleTestApiKey = async () => {
    setIsTestingKey(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch('/api/settings/gemini-key/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify({ apiKey: apiKeyInput.trim() || undefined }),
      });

      const data = await res.json();
      if (!res.ok || !data.valid) {
        throw new Error(data.error || 'Kiểm tra kết nối thất bại');
      }

      setFeedbackMessage({
        type: 'success',
        text: data.message || `Kết nối thành công! Độ trễ API: ${data.latencyMs}ms`,
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Khóa API không hợp lệ hoặc không có quyền truy cập Gemini API.',
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleRemoveCustomKey = async () => {
    if (!window.confirm('Bạn có chắc muốn xóa khóa API tùy chỉnh và quay lại sử dụng cấu hình mặc định của máy chủ?')) {
      return;
    }

    setIsSavingKey(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch('/api/settings/gemini-key', {
        method: 'DELETE',
        headers: authHeader,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể xóa khóa API');
      }

      setFeedbackMessage({
        type: 'info',
        text: 'Đã xóa khóa tùy chỉnh. Hệ thống đã chuyển về khóa mặc định.',
      });
      setApiKeyInput('');
      fetchKeyStatus();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Lỗi khi xóa khóa API.',
      });
    } finally {
      setIsSavingKey(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-5 text-[#141414] space-y-4 font-mono">
      {/* Header */}
      <div className="bg-white border border-[#141414] p-4 sm:p-5 shadow-none">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#141414] text-white flex items-center justify-center text-xs font-mono font-bold">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-mono font-bold uppercase tracking-wider text-[#141414]">
                RAG_SYSTEM_CONFIGURATION & HYPERPARAMETERS
              </h1>
              <p className="text-[11px] font-mono text-[#666]">
                Gemini API Key configuration, vector database retrieval thresholds, and inference telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-[#F8F7F4] border border-[#141414] px-2 py-1 font-bold">
              DOCS: {documentCount}
            </span>
            <span className="text-[10px] bg-[#141414] text-white px-2 py-1 font-bold">
              VECTORS: {chunkCount}
            </span>
          </div>
        </div>
      </div>

      {/* GEMINI API KEY MANAGEMENT SECTION */}
      <div className="bg-white border border-[#141414] p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#141414] pb-2.5 flex-wrap gap-2">
          <h3 className="text-xs font-mono font-bold uppercase text-[#141414] flex items-center gap-2">
            <Key className="w-3.5 h-3.5" />
            GEMINI_API_KEY_MANAGEMENT (CẤU HÌNH KHÓA API TRÊN GIAO DIỆN)
          </h3>
          <button
            onClick={fetchKeyStatus}
            disabled={isLoadingKeyStatus}
            className="flex items-center gap-1 text-[10px] text-[#666] hover:text-[#141414] transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingKeyStatus ? 'animate-spin' : ''}`} />
            <span>LÀM_MỚI_TRẠNG_THÁI</span>
          </button>
        </div>

        {/* Current API Key Telemetry Badge */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-[#F8F7F4] p-3 border border-[#141414] space-y-1">
            <span className="text-[9px] text-[#666] uppercase block font-bold">KEY_PROVISION_SOURCE:</span>
            <div className="text-xs font-bold text-[#141414] flex items-center gap-1.5">
              {keyStatus?.source === 'user_custom' && (
                <>
                  <span className="w-2 h-2 bg-blue-600 rounded-full animate-ping"></span>
                  <span className="text-blue-700">USER_CUSTOM_OVERRIDE</span>
                </>
              )}
              {keyStatus?.source === 'server_env' && (
                <>
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-emerald-700">SERVER_ENVIRONMENT_KEY</span>
                </>
              )}
              {keyStatus?.source === 'none' && (
                <>
                  <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                  <span className="text-amber-700">FALLBACK_LOCAL_MODE</span>
                </>
              )}
              {!keyStatus && <span className="text-[#888]">CHECKING...</span>}
            </div>
            <p className="text-[10px] text-[#666]">
              {keyStatus?.source === 'user_custom'
                ? 'Đang sử dụng khóa cá nhân được cấu hình trực tiếp từ giao diện.'
                : keyStatus?.source === 'server_env'
                ? 'Đang sử dụng khóa mặc định từ biến môi trường của máy chủ.'
                : 'Chưa có khóa API, hệ thống đang dùng vector fallback 384-dim.'}
            </p>
          </div>

          <div className="bg-[#F8F7F4] p-3 border border-[#141414] space-y-1">
            <span className="text-[9px] text-[#666] uppercase block font-bold">MASKED_KEY_SIGNATURE:</span>
            <div className="text-xs font-mono font-bold text-[#141414]">
              {keyStatus?.maskedKey || 'NO_KEY_CONFIGURED'}
            </div>
            <p className="text-[10px] text-[#666]">
              Khóa API được mã hóa an toàn và chỉ xử lý phía backend (Server-side proxy).
            </p>
          </div>

          <div className="bg-[#F8F7F4] p-3 border border-[#141414] space-y-1">
            <span className="text-[9px] text-[#666] uppercase block font-bold">SUPPORTED_MODELS:</span>
            <div className="text-[11px] font-bold text-[#141414]">
              Embed: <span className="text-indigo-700">gemini-embedding-2-preview</span>
            </div>
            <div className="text-[11px] font-bold text-[#141414]">
              RAG LLM: <span className="text-emerald-700">gemini-3.7-flash</span>
            </div>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMessage && (
          <div
            className={`p-3 border text-xs flex items-start gap-2.5 ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-600 text-emerald-800'
                : feedbackMessage.type === 'error'
                ? 'bg-rose-50 border-rose-600 text-rose-800'
                : 'bg-blue-50 border-blue-600 text-blue-800'
            }`}
          >
            {feedbackMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            {feedbackMessage.type === 'error' && <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            {feedbackMessage.type === 'info' && <Zap className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            <span className="font-semibold">{feedbackMessage.text}</span>
          </div>
        )}

        {/* Input Form for New Key */}
        <form onSubmit={handleSaveApiKey} className="space-y-3 pt-1">
          <div>
            <label className="text-xs font-bold text-[#141414] uppercase block mb-1.5">
              NHẬP HOẶC CẬP NHẬT GEMINI API KEY CỦA BẠN:
            </label>
            <div className="flex items-center border border-[#141414] bg-white">
              <span className="px-3 text-[#666] bg-[#F8F7F4] border-r border-[#141414] py-2 text-xs font-bold">
                KEY
              </span>
              <input
                id="gemini-api-key-input"
                type={showKeyText ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder="Dán khóa API (Bắt đầu bằng AIzaSy...)"
                className="flex-1 px-3 py-2 text-xs font-mono outline-none bg-transparent"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKeyText(!showKeyText)}
                className="px-3 py-2 text-[#666] hover:text-[#141414] border-l border-[#141414] transition-colors"
                title={showKeyText ? 'Ẩn khóa' : 'Hiện khóa'}
              >
                {showKeyText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                id="save-api-key-btn"
                disabled={isSavingKey || !apiKeyInput.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#141414] text-white hover:bg-[#333] disabled:opacity-50 text-xs font-bold uppercase transition-colors"
              >
                {isSavingKey ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>ĐANG_XÁC_THỰC_&_LƯU...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>LƯU_&_KÍCH_HOẠT_KHÓA</span>
                  </>
                )}
              </button>

              <button
                type="button"
                id="test-api-key-btn"
                onClick={handleTestApiKey}
                disabled={isTestingKey}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#141414] hover:bg-[#F0EFEC] disabled:opacity-50 text-xs font-bold uppercase text-[#141414] transition-colors"
              >
                {isTestingKey ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>TESTING_PING...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>KIỂM_TRA_KẾT_NỐI</span>
                  </>
                )}
              </button>

              {keyStatus?.hasCustomKey && (
                <button
                  type="button"
                  id="remove-custom-key-btn"
                  onClick={handleRemoveCustomKey}
                  disabled={isSavingKey}
                  className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 border border-rose-600 hover:bg-rose-100 text-rose-800 text-xs font-bold uppercase transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>XÓA_KHÓA_TÙY_CHỈNH</span>
                </button>
              )}
            </div>

            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-[#141414] hover:underline font-bold"
            >
              <span>LẤY_API_KEY_MIỄN_PHÍ_TẠI_GOOGLE_AI_STUDIO</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </form>
      </div>

      {/* RAG Generation Hyperparameters */}
      <div className="bg-white border border-[#141414] p-4 sm:p-5 space-y-4">
        <h3 className="text-xs font-mono font-bold uppercase text-[#141414] flex items-center gap-2 border-b border-[#141414] pb-2.5">
          <Sliders className="w-3.5 h-3.5" />
          RETRIEVAL_&_GENERATION_PARAMETERS
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top-K */}
          <div className="bg-[#F8F7F4] p-3.5 border border-[#141414] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#141414]">TOP_K_CHUNKS</span>
              <span className="text-xs font-bold text-white bg-[#141414] px-2 py-0.5">
                {settings.topK} CHUNKS
              </span>
            </div>
            <p className="text-[11px] text-[#666]">
              Maximum number of highest-scoring vector partitions injected into Gemini's context window.
            </p>
            <input
              type="range"
              min="1"
              max="10"
              value={settings.topK}
              onChange={e => setSettings(prev => ({ ...prev, topK: Number(e.target.value) }))}
              className="w-full accent-[#141414] cursor-pointer"
            />
          </div>

          {/* Similarity Threshold */}
          <div className="bg-[#F8F7F4] p-3.5 border border-[#141414] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#141414]">MIN_COSINE_SIMILARITY</span>
              <span className="text-xs font-bold text-white bg-[#141414] px-2 py-0.5">
                {Math.round(settings.similarityThreshold * 100)}%
              </span>
            </div>
            <p className="text-[11px] text-[#666]">
              Strict cutoff score for dense embedding cosine distance similarity.
            </p>
            <input
              type="range"
              min="0.1"
              max="0.85"
              step="0.05"
              value={settings.similarityThreshold}
              onChange={e => setSettings(prev => ({ ...prev, similarityThreshold: Number(e.target.value) }))}
              className="w-full accent-[#141414] cursor-pointer"
            />
          </div>

          {/* Temperature */}
          <div className="bg-[#F8F7F4] p-3.5 border border-[#141414] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#141414]">INFERENCE_TEMPERATURE</span>
              <span className="text-xs font-bold text-white bg-[#141414] px-2 py-0.5">
                {settings.temperature}
              </span>
            </div>
            <p className="text-[11px] text-[#666]">
              Low temperature (0.1 - 0.3) enforces strict adherence to grounding context without hallucinatory drift.
            </p>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.1"
              value={settings.temperature}
              onChange={e => setSettings(prev => ({ ...prev, temperature: Number(e.target.value) }))}
              className="w-full accent-[#141414] cursor-pointer"
            />
          </div>

          {/* Strict Grounding Toggle */}
          <div className="bg-[#F8F7F4] p-3.5 border border-[#141414] space-y-2 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#141414] block">STRICT_GROUNDING_MODE</span>
                <p className="text-[11px] text-[#666] mt-0.5">
                  Explicitly reject query if vector similarity does not meet threshold.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettings(prev => ({ ...prev, strictGrounding: !prev.strictGrounding }))}
                className={`w-12 h-6 border border-[#141414] flex items-center p-0.5 transition-colors ${
                  settings.strictGrounding ? 'bg-[#141414]' : 'bg-white'
                }`}
              >
                <div
                  className={`w-4 h-4 transform transition-transform ${
                    settings.strictGrounding ? 'bg-white translate-x-6' : 'bg-[#141414] translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="text-[11px] font-bold text-emerald-700 pt-1">
              {settings.strictGrounding ? '● ANTI_HALLUCINATION_GUARD_ACTIVE' : '○ RELAXED_INFERENCE_ALLOWED'}
            </div>
          </div>
        </div>
      </div>

      {/* Security & Authentication Info */}
      <div className="bg-white border border-[#141414] p-4 sm:p-5 space-y-3">
        <h3 className="text-xs font-mono font-bold uppercase text-[#141414] flex items-center gap-2 border-b border-[#141414] pb-2.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          MULTI_TENANCY_ISOLATION & USER_AUTHENTICATION
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-[#F8F7F4] p-3.5 border border-[#141414] space-y-1.5">
            <span className="text-[10px] text-[#666] uppercase block font-bold">AUTHENTICATED_SESSION:</span>
            <div className="text-xs font-bold text-[#141414] uppercase">{user?.name || 'GUEST_DEVELOPER'}</div>
            <div className="text-[11px] text-[#666]">{user?.email || 'dev@ragstudio.ai'}</div>
            <div className="pt-2 text-[10px] text-emerald-700 flex items-center gap-1.5 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>JWT_BEARER_ACTIVE (SESSION VALID)</span>
            </div>
          </div>

          <div className="bg-[#F8F7F4] p-3.5 border border-[#141414] space-y-1.5">
            <span className="text-[10px] text-[#666] uppercase block font-bold">SECURITY_CONSTRAINTS:</span>
            <ul className="space-y-1 text-[11px] text-[#333]">
              <li className="flex items-start gap-1.5">
                <span className="text-[#141414] font-bold">•</span>
                <span>Vector chunks strictly scoped to authenticated user ID</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#141414] font-bold">•</span>
                <span>Passwords salted with Bcrypt work factor 10</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#141414] font-bold">•</span>
                <span>Gemini API keys securely proxied via server backend</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* RAG Architecture Diagram */}
      <div className="bg-white border border-[#141414] p-4 sm:p-5 space-y-3">
        <h3 className="text-xs font-mono font-bold uppercase text-[#141414] flex items-center gap-2 border-b border-[#141414] pb-2.5">
          <Cpu className="w-3.5 h-3.5" />
          RAG_DATA_PIPELINE_ARCHITECTURE
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-xs">
          <div className="bg-[#F8F7F4] p-3 border border-[#141414] space-y-1">
            <div className="text-[10px] font-bold text-white bg-[#141414] px-1.5 py-0.2 inline-block">
              [STAGE_01]
            </div>
            <div className="font-bold text-[#141414] mt-1">INGEST & CHUNK</div>
            <p className="text-[10px] text-[#666] leading-relaxed">
              Text tokenization, recursive sliding chunk partitions, and metadata tagging.
            </p>
          </div>

          <div className="bg-[#F8F7F4] p-3 border border-[#141414] space-y-1">
            <div className="text-[10px] font-bold text-white bg-[#141414] px-1.5 py-0.2 inline-block">
              [STAGE_02]
            </div>
            <div className="font-bold text-[#141414] mt-1">VECTOR_EMBEDDING</div>
            <p className="text-[10px] text-[#666] leading-relaxed">
              768-dimensional dense vector embeddings generated via Gemini Embedding API.
            </p>
          </div>

          <div className="bg-[#F8F7F4] p-3 border border-[#141414] space-y-1">
            <div className="text-[10px] font-bold text-white bg-[#141414] px-1.5 py-0.2 inline-block">
              [STAGE_03]
            </div>
            <div className="font-bold text-[#141414] mt-1">COSINE_RETRIEVAL</div>
            <p className="text-[10px] text-[#666] leading-relaxed">
              Fast cosine distance similarity search filtered by user tenancy boundaries.
            </p>
          </div>

          <div className="bg-[#F8F7F4] p-3 border border-[#141414] space-y-1">
            <div className="text-[10px] font-bold text-white bg-[#141414] px-1.5 py-0.2 inline-block">
              [STAGE_04]
            </div>
            <div className="font-bold text-[#141414] mt-1">GROUNDED_SYNTHESIS</div>
            <p className="text-[10px] text-[#666] leading-relaxed">
              Gemini model synthesizes factual response with explicit bracketed citations [1], [2].
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};


