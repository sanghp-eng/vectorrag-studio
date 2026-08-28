import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  Clock,
  Zap,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check,
  FileText,
  ShieldCheck,
  ChevronRight,
  HelpCircle,
  Download,
  Info,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { useAuth } from '../context/AuthContext';
import { ChatMessage, CitationSource, DocumentChunk, RAGSettings } from '../types';
import { ChunkInspectorModal } from './ChunkInspectorModal';
import { copyToClipboard } from '../utils/clipboard';

interface RagChatViewProps {
  settings: RAGSettings;
  onOpenDocModal: () => void;
  documentCount: number;
  chunkCount: number;
}

export const RagChatView: React.FC<RagChatViewProps> = ({
  settings,
  onOpenDocModal,
  documentCount,
  chunkCount,
}) => {
  const { authHeader, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: `Xin chào! Tôi là Trợ lý AI được tích hợp trực tiếp với **Cơ sở dữ liệu Vector (Vector Database)** của bạn.

Mọi câu trả lời của tôi đều được **truy xuất ngữ nghĩa (Semantic Retrieval)** và **đối chiếu nguồn gốc chính xác [1], [2]** từ các tài liệu bạn đã nạp vào hệ thống, giúp loại bỏ hoàn toàn hiện tượng ảo giác (hallucination).

Bạn có thể thử đặt câu hỏi về các tài liệu kiến thức có sẵn hoặc nạp thêm tài liệu mới!`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedChunk, setSelectedChunk] = useState<DocumentChunk | null>(null);
  const [selectedSimilarity, setSelectedSimilarity] = useState<number | undefined>(undefined);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sampleQuestions = [
    'Quy trình xử lý sự cố máy chủ và cảnh báo Zabbix (Disk, CPU/OOM, MySQL, 502)?',
    'Quy trình 3 bước hoạt động của hệ thống RAG là gì?',
    'Tiêu chuẩn bảo mật ISO 27001 và Zero Trust cho Vector DB?',
    'Kích thước chunk và overlap tối ưu trong kỹ thuật Chunking?',
  ];

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: 'usr_' + Date.now(),
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    if (!queryText) setInputQuery('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/rag/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify({
          query: textToSend.trim(),
          topK: settings.topK || 6,
          similarityThreshold: settings.similarityThreshold || 0.22,
          strictGrounding: settings.strictGrounding,
          temperature: settings.temperature,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi xử lý RAG chat');
      }

      const botMessage: ChatMessage = {
        id: 'bot_' + Date.now(),
        role: 'assistant',
        content: data.answer,
        timestamp: new Date().toISOString(),
        sources: data.sources,
        metrics: data.metrics,
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: 'err_' + Date.now(),
        role: 'assistant',
        content: `⚠️ **Lỗi kết nối:** ${err.message || 'Không thể truy xuất dữ liệu vector và gọi AI.'}`,
        timestamp: new Date().toISOString(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (id: string, text: string) => {
    if (!text && text !== '') return;
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome-msg-reset',
        role: 'assistant',
        content: 'Đã làm mới phiên hội thoại RAG. Hãy đặt câu hỏi bất kỳ!',
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const handleExportChat = () => {
    const markdown = messages
      .map(
        m =>
          `### ${m.role === 'user' ? 'Người dùng' : 'RAG AI Studio'} (${new Date(m.timestamp).toLocaleTimeString()})\n\n${m.content}\n\n${
            m.sources && m.sources.length > 0
              ? `**Nguồn trích dẫn:**\n${m.sources
                  .map(
                    s =>
                      `- [${s.index}] ${s.documentTitle} (Đoạn ${s.chunkIndex}, Tương đồng: ${Math.round(
                        s.similarity * 100
                      )}%)\n  > ${s.fullContent || s.preview}`
                  )
                  .join('\n')}\n\n`
              : ''
          }`
      )
      .join('---\n\n');

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RAG_Chat_Session_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inspectSource = (src: CitationSource) => {
    const fullText = src.fullContent || src.preview;
    setSelectedChunk({
      id: src.chunkId,
      documentId: src.documentId,
      documentTitle: src.documentTitle,
      category: src.category,
      chunkIndex: src.chunkIndex,
      content: fullText,
      tokenCount: Math.ceil(fullText.split(/\s+/).length * 1.3),
      characterCount: fullText.length,
      createdAt: new Date().toISOString(),
    });
    setSelectedSimilarity(src.similarity);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] max-w-7xl mx-auto p-3 sm:p-5 text-[#141414]">
      {/* Top Banner / Knowledge Base Overview */}
      <div className="bg-white border border-[#141414] p-3 sm:p-4 mb-3 flex flex-wrap items-center justify-between gap-3 shadow-none">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#141414] text-white flex items-center justify-center text-xs font-mono font-bold">
            <Zap className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#141414]">
                RAG_GROUNDED_INFERENCE
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 border border-[#141414] bg-[#E4E3E0] text-[#141414]">
                {settings.strictGrounding ? 'STRICT GROUNDING' : 'FLEXIBLE'}
              </span>
            </div>
            <p className="text-[11px] font-mono text-[#666] mt-0.5">
              Active Index: <strong className="text-[#141414]">{documentCount} Docs</strong> • {chunkCount} Vector Chunks • Top-K: {settings.topK}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleClearChat}
            className="p-1.5 sm:px-2.5 sm:py-1 border border-[#141414] bg-white hover:bg-[#E4E3E0] text-[#141414] text-xs font-mono flex items-center gap-1.5 transition-colors"
            title="Làm mới cuộc trò chuyện"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">RESET</span>
          </button>
          <button
            onClick={handleExportChat}
            className="p-1.5 sm:px-2.5 sm:py-1 border border-[#141414] bg-white hover:bg-[#E4E3E0] text-[#141414] text-xs font-mono flex items-center gap-1.5 transition-colors"
            title="Xuất lịch sử chat Markdown"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">EXPORT .MD</span>
          </button>
          <button
            onClick={onOpenDocModal}
            className="px-3 py-1.5 bg-[#141414] hover:bg-[#333] text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>+ INGEST DOC</span>
          </button>
        </div>
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 sm:pr-2 pb-3">
        {messages.map(message => {
          const isUser = message.role === 'user';
          return (
            <div
              key={message.id}
              className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 flex items-center justify-center flex-shrink-0 text-xs font-mono font-bold border border-[#141414] ${
                  isUser
                    ? 'bg-[#141414] text-white'
                    : 'bg-white text-[#141414]'
                }`}
              >
                {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[88%] sm:max-w-[80%] p-4 border border-[#141414] ${
                  isUser
                    ? 'bg-[#141414] text-white'
                    : 'bg-white text-[#141414]'
                }`}
              >
                {/* Content */}
                <div className={`prose ${isUser ? 'prose-invert text-white' : 'text-[#222]'} prose-sm max-w-none text-xs sm:text-sm leading-relaxed break-words font-sans`}>
                  <Markdown>{message.content}</Markdown>
                </div>

                {/* Sources & Citations (RAG grounding evidence) */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[#141414]/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#141414] flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                        Grounded Retrieval Sources ({message.sources.length}):
                      </span>
                      <span className="text-[10px] font-mono text-[#666]">
                        VERIFIED_GROUNDING
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {message.sources.map(src => (
                        <div
                          key={src.chunkId}
                          onClick={() => inspectSource(src)}
                          className="bg-[#F8F7F4] hover:bg-[#E4E3E0] border border-[#141414] p-2.5 cursor-pointer transition-all flex gap-3 group text-left"
                        >
                          <div className="flex flex-col items-center w-12 shrink-0 border-r border-[#141414] pr-2.5 justify-center">
                            <span className="text-xs font-mono font-bold text-blue-600">
                              {(src.similarity).toFixed(3)}
                            </span>
                            <span className="text-[8px] font-mono uppercase text-[#666] mt-0.5">Score</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[10px] font-mono bg-[#E4E3E0] border border-[#141414]/30 px-1.5 py-0.2 uppercase truncate max-w-[200px] font-bold text-[#141414]">
                                [{src.index}] {src.documentTitle}
                              </span>
                              <span className="text-[10px] font-mono text-[#666]">
                                Chunk #{src.chunkIndex}
                              </span>
                            </div>
                            <p className="text-xs text-[#444] font-mono line-clamp-2 italic">
                              "{src.preview}"
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metrics HUD Bar */}
                {message.metrics && (
                  <div className={`mt-3 pt-2 border-t ${isUser ? 'border-white/20 text-white/70' : 'border-[#141414]/20 text-[#666]'} flex flex-wrap items-center gap-3 text-[10px] font-mono`}>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      RETRIEVAL: {message.metrics.retrievalTimeMs}ms
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-500" />
                      GEN: {message.metrics.generationTimeMs}ms
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3 text-blue-600" />
                      TOP_SIM: {Math.round(message.metrics.topSimilarity * 100)}%
                    </span>
                    <span className="ml-auto text-[10px] font-mono">
                      ENGINE: {message.metrics.model}
                    </span>
                  </div>
                )}

                {/* Bubble Footer */}
                <div className={`mt-2 flex items-center justify-between text-[10px] font-mono pt-1 ${isUser ? 'text-white/60' : 'text-[#888]'}`}>
                  <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <button
                    onClick={() => handleCopy(message.id, message.content)}
                    className="hover:underline flex items-center gap-1 transition-colors"
                  >
                    {copiedId === message.id ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedId === message.id ? 'COPIED' : 'COPY'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start gap-2.5 animate-in fade-in">
            <div className="w-7 h-7 bg-white border border-[#141414] flex items-center justify-center text-[#141414]">
              <Bot className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div className="bg-white border border-[#141414] p-3 max-w-[70%]">
              <div className="flex items-center space-x-2 text-xs font-mono text-[#141414]">
                <div className="w-1.5 h-1.5 bg-[#141414] animate-ping"></div>
                <span>Executing Cosine Retrieval & Grounded Generation...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Sample Suggested Prompts (if chat is short) */}
      {messages.length <= 2 && (
        <div className="mb-2">
          <div className="text-[10px] font-mono uppercase text-[#666] mb-1 flex items-center gap-1 font-bold">
            <Sparkles className="w-3 h-3 text-[#141414]" />
            <span>CÂU HỎI TRUY XUẤT MẪU (GỢI Ý):</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {sampleQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                className="text-left text-xs font-mono p-2 border border-[#141414] bg-white hover:bg-[#E4E3E0] text-[#141414] transition-all flex items-center justify-between group"
              >
                <span className="truncate">{q}</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#888] group-hover:text-[#141414] flex-shrink-0 ml-1" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area (High Density Search Bar) */}
      <div className="bg-white border border-[#141414] p-2 sm:p-2.5">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              id="rag-chat-input"
              type="text"
              value={inputQuery}
              onChange={e => setInputQuery(e.target.value)}
              disabled={isLoading}
              placeholder="Nhập câu hỏi truy xuất từ cơ sở dữ liệu Vector (Ví dụ: Quy trình 3 bước RAG là gì?)..."
              className="w-full bg-[#F8F7F4] border border-[#141414] px-3 py-2 text-xs sm:text-sm font-mono text-[#141414] placeholder-[#888] focus:outline-none focus:bg-white"
            />
          </div>

          <div className="hidden sm:flex items-center gap-1.5">
            <span className="px-2 py-1 bg-[#141414] text-white text-[10px] font-mono">TOP_K: {settings.topK}</span>
            <span className="px-2 py-1 border border-[#141414] text-[10px] font-mono">NGƯỠNG: {settings.similarityThreshold}</span>
          </div>

          <button
            id="rag-send-btn"
            type="submit"
            disabled={isLoading || !inputQuery.trim()}
            className="px-4 py-2 bg-[#141414] hover:bg-[#333] disabled:opacity-40 disabled:hover:bg-[#141414] text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">GỬI CÂU HỎI</span>
          </button>
        </form>
      </div>

      {/* Source Chunk Inspector Modal */}
      <ChunkInspectorModal
        chunk={selectedChunk}
        similarity={selectedSimilarity}
        onClose={() => setSelectedChunk(null)}
      />
    </div>
  );
};

