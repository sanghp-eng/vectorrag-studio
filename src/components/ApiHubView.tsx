import React, { useState, useEffect } from 'react';
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  Power,
  Terminal,
  Code2,
  Bot,
  Send,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  Activity,
  FileCode,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ExternalApiKey } from '../types';

interface ApiHubViewProps {
  documentCount: number;
  chunkCount: number;
}

type CodeTab = 'zabbix' | 'curl' | 'python' | 'nodejs' | 'langchain';

export const ApiHubView: React.FC<ApiHubViewProps> = ({ documentCount, chunkCount }) => {
  const { authHeader, isAuthenticated } = useAuth();

  // Keys management state
  const [keys, setKeys] = useState<ExternalApiKey[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  // New Key creation form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPerms, setNewKeyPerms] = useState<('read_rag' | 'search_vector' | 'ingest_doc')[]>([
    'read_rag',
    'search_vector',
  ]);
  const [newKeyExpires, setNewKeyExpires] = useState<number | ''>('');
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [newlyCreatedSecret, setNewlyCreatedSecret] = useState<string | null>(null);

  // Copy states
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  // Code Tab selection
  const [activeCodeTab, setActiveCodeTab] = useState<CodeTab>('zabbix');
  const [selectedKeyForSnippet, setSelectedKeyForSnippet] = useState<string>('');

  // Target Host configuration for local & on-premise execution
  const [hostMode, setHostMode] = useState<'localhost' | 'loopback' | 'custom' | 'browser'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('rag_api_host_mode');
      if (saved && ['localhost', 'loopback', 'custom', 'browser'].includes(saved)) {
        return saved as any;
      }
    }
    return 'localhost'; // Default to localhost:3000 for local app execution
  });

  const [customHostUrl, setCustomHostUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rag_api_custom_host') || 'http://192.168.1.100:3000';
    }
    return 'http://192.168.1.100:3000';
  });

  const handleHostModeChange = (mode: 'localhost' | 'loopback' | 'custom' | 'browser') => {
    setHostMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rag_api_host_mode', mode);
    }
  };

  const handleCustomHostChange = (val: string) => {
    setCustomHostUrl(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rag_api_custom_host', val);
    }
  };

  const computeActiveHost = (): string => {
    if (hostMode === 'localhost') return 'http://localhost:3000';
    if (hostMode === 'loopback') return 'http://127.0.0.1:3000';
    if (hostMode === 'custom') return customHostUrl.replace(/\/+$/, '') || 'http://localhost:3000';
    if (hostMode === 'browser' && typeof window !== 'undefined') return window.location.origin;
    return 'http://localhost:3000';
  };

  const effectiveHost = computeActiveHost();

  // Live API Tester state
  const [testEndpoint, setTestEndpoint] = useState<'/api/v1/chat' | '/api/v1/search'>('/api/v1/chat');
  const [testQuery, setTestQuery] = useState(
    'Host srv-db-production cảnh báo: Disk utilization is over 95% on /var/log. Nguyên nhân và các bước xử lý?'
  );
  const [testTopK, setTestTopK] = useState(4);
  const [testThreshold, setTestThreshold] = useState(0.35);
  const [isTesting, setIsTesting] = useState(false);
  const [testResponse, setTestResponse] = useState<any>(null);
  const [testLatency, setTestLatency] = useState<number | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Fetch API Keys
  const fetchKeys = async () => {
    if (!isAuthenticated) return;
    setIsLoadingKeys(true);
    setKeyError(null);
    try {
      const res = await fetch('/api/keys', { headers: authHeader });
      const data = await res.json();
      if (res.ok) {
        setKeys(data.keys || []);
        if (data.keys && data.keys.length > 0 && !selectedKeyForSnippet) {
          setSelectedKeyForSnippet(data.keys[0].keyPrefix);
        }
      } else {
        setKeyError(data.error || 'Không thể tải danh sách API Key');
      }
    } catch (err: any) {
      setKeyError(err.message || 'Lỗi mạng khi tải API Key');
    } finally {
      setIsLoadingKeys(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [isAuthenticated]);

  // Handle create key
  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    setIsCreatingKey(true);
    setKeyError(null);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify({
          name: newKeyName.trim(),
          permissions: newKeyPerms,
          expiresDays: newKeyExpires ? Number(newKeyExpires) : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setNewlyCreatedSecret(data.secretKey);
        setNewKeyName('');
        setNewKeyExpires('');
        fetchKeys();
      } else {
        setKeyError(data.error || 'Lỗi khi tạo API Key');
      }
    } catch (err: any) {
      setKeyError(err.message || 'Lỗi kết nối khi tạo API Key');
    } finally {
      setIsCreatingKey(false);
    }
  };

  // Handle toggle key
  const handleToggleKey = async (keyId: string) => {
    try {
      const res = await fetch(`/api/keys/${keyId}/toggle`, {
        method: 'PATCH',
        headers: authHeader,
      });
      if (res.ok) {
        fetchKeys();
      }
    } catch (err) {
      console.error('Error toggling key:', err);
    }
  };

  // Handle delete key
  const handleDeleteKey = async (keyId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn thu hồi (xóa) API Key này? Tất cả các Client hoặc Chatbot Zabbix đang sử dụng Key này sẽ bị từ chối truy cập ngay lập tức.')) {
      return;
    }
    try {
      const res = await fetch(`/api/keys/${keyId}`, {
        method: 'DELETE',
        headers: authHeader,
      });
      if (res.ok) {
        fetchKeys();
      }
    } catch (err) {
      console.error('Error deleting key:', err);
    }
  };

  // Handle copy text
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  // Execute Live API Sandbox Test
  const handleRunLiveTest = async () => {
    if (!testQuery.trim()) return;
    setIsTesting(true);
    setTestError(null);
    setTestResponse(null);
    setTestLatency(null);

    const t0 = Date.now();
    try {
      const res = await fetch(testEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify({
          query: testQuery.trim(),
          topK: testTopK,
          similarityThreshold: testThreshold,
        }),
      });

      const latency = Date.now() - t0;
      setTestLatency(latency);

      const data = await res.json();
      if (res.ok) {
        setTestResponse(data);
      } else {
        setTestError(`Lỗi HTTP ${res.status}: ${data.error || 'Yêu cầu không thành công'}`);
        setTestResponse(data);
      }
    } catch (err: any) {
      setTestError(err.message || 'Lỗi mạng khi gửi API test');
    } finally {
      setIsTesting(false);
    }
  };

  const displayKey = newlyCreatedSecret || (keys.length > 0 ? keys[0].keyPrefix : 'rag_sk_live_YOUR_API_KEY_HERE');

  // Code snippets generator
  const getSnippet = (tab: CodeTab): string => {
    const keyToUse = displayKey;
    const baseUrl = effectiveHost;

    switch (tab) {
      case 'zabbix':
        return `# ==============================================================================
# SCRIPT TÍCH HỢP CHATBOT / WEBHOOK ZABBIX VỚI RAG KNOWLEDGEBASE (LOCAL / ON-PREM)
# Cung cấp Runbook & Hướng dẫn xử lý sự cố chuẩn xác cho kỹ sư vận hành
# ==============================================================================
import requests
import json

# URL máy chủ RAG chạy Local (Cổng 3000)
RAG_API_URL = "${baseUrl}/api/v1/chat"
API_KEY = "${keyToUse}"

def query_zabbix_remediation(host_name: str, trigger_name: str, severity: str = "High") -> dict:
    """
    Tra cứu SOP/Runbook từ RAG cho sự cố Zabbix
    """
    headers = {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json"
    }
    
    # Định hình câu hỏi ngữ cảnh tự động cho Zabbix Event
    query_text = f"Host {host_name} cảnh báo sự cố: '{trigger_name}' (Mức độ: {severity}). Nguyên nhân cốt lõi và các bước khắc phục chi tiết theo SOP?"
    
    payload = {
        "query": query_text,
        "topK": 4,
        "similarityThreshold": 0.35,
        "temperature": 0.2
    }
    
    try:
        response = requests.post(RAG_API_URL, json=payload, headers=headers, timeout=15)
        if response.status_code == 200:
            data = response.json()
            return {
                "success": True,
                "answer": data.get("answer"),
                "citations": data.get("citations", []),
                "latency_ms": data.get("metrics", {}).get("generationLatencyMs")
            }
        else:
            return {"success": False, "error": f"HTTP {response.status_code}: {response.text}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

# Ví dụ khi Zabbix kích hoạt Webhook/Action:
if __name__ == "__main__":
    result = query_zabbix_remediation("srv-db-production", "MySQL Service Down & Connection Refused", "Disaster")
    if result["success"]:
        print("=== HƯỚNG DẪN XỬ LÝ SỰ CỐ TỪ RAG ===")
        print(result["answer"])
    else:
        print("Lỗi:", result["error"])`;

      case 'curl':
        return `# 1. Hỏi Đáp RAG Trọn Gói (RAG Chat / QA)
curl -X POST "${baseUrl}/api/v1/chat" \\
  -H "X-API-Key: ${keyToUse}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "Quy trình xử lý sự cố server quá tải và các bước kiểm tra log?",
    "topK": 4,
    "similarityThreshold": 0.35
  }'

# 2. Tra cứu Đoạn Văn bản Vector thô (Semantic Vector Search)
curl -X POST "${baseUrl}/api/v1/search" \\
  -H "X-API-Key: ${keyToUse}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "Zabbix trigger: Disk space low on root partition",
    "topK": 3
  }'

# 3. Kiểm tra Trạng thái Kết nối & Dung lượng Kho Tri thức
curl -X GET "${baseUrl}/api/v1/status" \\
  -H "X-API-Key: ${keyToUse}"`;

      case 'python':
        return `import requests

# URL kết nối máy chủ RAG
API_URL = "${baseUrl}/api/v1/chat"
API_KEY = "${keyToUse}"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

payload = {
    "query": "Trình bày 3 bước chính trong quy trình ứng cứu sự cố",
    "topK": 4,
    "similarityThreshold": 0.35,
    "temperature": 0.3
}

response = requests.post(API_URL, json=payload, headers=headers)
data = response.json()

print("Câu trả lời:", data["answer"])
print("Nguồn trích dẫn:", [c["documentTitle"] for c in data.get("citations", [])])`;

      case 'nodejs':
        return `// Tích hợp Node.js / Express / Chatbot Backend
const API_URL = '${baseUrl}/api/v1/chat';
const API_KEY = '${keyToUse}';

async function askRAGKnowledgebase(userQuestion) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: userQuestion,
      topK: 4,
      similarityThreshold: 0.35
    })
  });

  if (!response.ok) {
    throw new Error(\`RAG Request failed with status \${response.status}\`);
  }

  const result = await response.json();
  return result; // { answer, citations, metrics }
}

askRAGKnowledgebase('Cách kiểm tra dung lượng ổ đĩa trên Linux')
  .then(res => console.log(res.answer))
  .catch(console.error);`;

      case 'langchain':
        return `# Tích hợp dưới dạng Tool / Retrieval Function trong LangChain / OpenAI Agent
from langchain.tools import tool
import requests

@tool
def search_internal_rag_knowledgebase(query: str) -> str:
    """Tra cứu kho tài liệu tri thức nội bộ, runbook kỹ thuật và chính sách doanh nghiệp."""
    url = "${baseUrl}/api/v1/chat"
    headers = {"X-API-Key": "${keyToUse}", "Content-Type": "application/json"}
    payload = {"query": query, "topK": 4, "similarityThreshold": 0.35}
    
    res = requests.post(url, json=payload, headers=headers)
    if res.status_code == 200:
        data = res.json()
        return data.get("answer", "Không tìm thấy nội dung liên quan.")
    return f"Lỗi truy xuất tri thức: {res.text}"

# Khởi tạo Agent và gắn tool vào mô hình
# tools = [search_internal_rag_knowledgebase]`;
    }
  };

  const activeKeysCount = keys.filter(k => k.isActive).length;
  const totalRequestsCount = keys.reduce((acc, k) => acc + (k.usageCount || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header Banner */}
      <div className="border border-[#141414] bg-white p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-[#141414] text-white flex items-center justify-center font-mono font-bold flex-shrink-0">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-mono font-bold uppercase tracking-tight text-[#141414]">
                CỔNG API TÍCH HỢP CLIENT NGOÀI & CHATBOT ZABBIX
              </h1>
              <span className="px-2 py-0.5 bg-green-100 border border-green-700 text-green-800 text-[10px] font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></span>
                GATEWAY_ACTIVE
              </span>
            </div>
            <p className="text-xs text-[#666] mt-1 max-w-3xl">
              Cung cấp khóa API Key bảo mật (`rag_sk_live_...`) và endpoint chuẩn hóa RESTful cho phép Chatbot Zabbix,
              DevOps Webhook, Telegram Bot, LangChain Agent và ứng dụng bên ngoài tra cứu trực tiếp kho tri thức RAG.
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="bg-[#F8F7F4] border border-[#141414] px-3 py-1.5 text-center min-w-[90px]">
            <span className="text-[10px] font-mono text-[#666] block uppercase">Active Keys</span>
            <span className="text-sm font-mono font-bold text-[#141414]">{activeKeysCount}</span>
          </div>
          <div className="bg-[#F8F7F4] border border-[#141414] px-3 py-1.5 text-center min-w-[90px]">
            <span className="text-[10px] font-mono text-[#666] block uppercase">Total Calls</span>
            <span className="text-sm font-mono font-bold text-[#141414]">{totalRequestsCount.toLocaleString()}</span>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            id="btn-create-api-key"
            className="px-3.5 py-2 bg-[#141414] hover:bg-[#333] text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all uppercase"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tạo API Key Mới</span>
          </button>
        </div>
      </div>

      {/* Secret Key Alert Box when newly created */}
      {newlyCreatedSecret && (
        <div className="border-2 border-emerald-600 bg-emerald-50 p-4 relative text-[#141414]">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-xs font-mono font-bold text-emerald-900 uppercase tracking-wider">
                API KEY ĐÃ ĐƯỢC TẠO THÀNH CÔNG! HÃY SAO CHÉP NGAY BÂY GIỜ
              </h3>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                Vì lý do bảo mật, bạn sẽ không thể xem lại toàn bộ mã khóa này sau khi đóng thông báo.
              </p>

              <div className="mt-2.5 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={newlyCreatedSecret}
                  className="flex-1 bg-white border border-emerald-600 px-3 py-1.5 text-xs font-mono font-bold text-[#141414] select-all"
                />
                <button
                  onClick={() => handleCopy(newlyCreatedSecret, 'new-secret')}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-mono font-bold flex items-center gap-1"
                >
                  {copiedKeyId === 'new-secret' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKeyId === 'new-secret' ? 'ĐÃ COPY' : 'COPY KEY'}</span>
                </button>
                <button
                  onClick={() => setNewlyCreatedSecret(null)}
                  className="px-2.5 py-1.5 border border-emerald-700 text-emerald-800 hover:bg-emerald-100 text-xs font-mono font-bold"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Keys Manager & Interactive Sandbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: API Keys Table (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="border border-[#141414] bg-white">
            <div className="p-3 bg-[#F8F7F4] border-b border-[#141414] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-[#141414]" />
                <h2 className="text-xs font-mono font-bold uppercase text-[#141414]">
                  DANH SÁCH API KEYS ({keys.length})
                </h2>
              </div>
              <button
                onClick={fetchKeys}
                disabled={isLoadingKeys}
                className="p-1 hover:bg-[#E4E3E0] text-[#666] hover:text-[#141414] transition-colors"
                title="Làm mới danh sách"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingKeys ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {keyError && (
              <div className="p-3 bg-red-50 border-b border-red-200 text-xs text-red-700 flex items-center gap-2 font-mono">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{keyError}</span>
              </div>
            )}

            <div className="divide-y divide-[#E4E3E0] max-h-[420px] overflow-y-auto">
              {isLoadingKeys && keys.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-[#666] flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Đang tải danh sách API Key...</span>
                </div>
              ) : keys.length === 0 ? (
                <div className="p-6 text-center text-xs font-mono text-[#666] space-y-2">
                  <Key className="w-8 h-8 text-[#999] mx-auto" />
                  <p className="font-bold text-[#141414]">Chưa có API Key nào được tạo.</p>
                  <p className="text-[11px]">
                    Hãy tạo một API Key để bắt đầu kết nối Chatbot Zabbix hoặc script bên ngoài.
                  </p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-2 px-3 py-1.5 bg-[#141414] text-white text-xs font-mono font-bold"
                  >
                    + Tạo Khóa Đầu Tiên
                  </button>
                </div>
              ) : (
                keys.map(k => (
                  <div
                    key={k.id}
                    className={`p-3 transition-colors ${
                      k.isActive ? 'hover:bg-[#FDFDFD]' : 'bg-[#F9F9F8] opacity-65'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-[#141414] truncate">{k.name}</span>
                          <span
                            className={`px-1.5 py-0.2 text-[9px] font-mono uppercase font-bold border ${
                              k.isActive
                                ? 'bg-green-50 border-green-600 text-green-800'
                                : 'bg-gray-100 border-gray-400 text-gray-600'
                            }`}
                          >
                            {k.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </div>

                        <div className="mt-1 flex items-center gap-2">
                          <code className="text-[11px] font-mono bg-[#E4E3E0] px-1.5 py-0.5 text-[#141414] border border-[#141414]/20 select-all">
                            {k.keyPrefix}
                          </code>
                          <button
                            onClick={() => handleCopy(k.keyPrefix, k.id)}
                            className="text-[#666] hover:text-[#141414]"
                            title="Sao chép tiền tố key"
                          >
                            {copiedKeyId === k.id ? (
                              <Check className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] font-mono text-[#666]">
                          <span>
                            Gọi: <strong className="text-[#141414]">{k.usageCount || 0}</strong> lần
                          </span>
                          <span>•</span>
                          <span>
                            Tạo:{' '}
                            {new Date(k.createdAt).toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleKey(k.id)}
                          title={k.isActive ? 'Tạm dừng hoạt động' : 'Kích hoạt lại'}
                          className={`p-1.5 border transition-colors ${
                            k.isActive
                              ? 'border-orange-600 text-orange-700 hover:bg-orange-50'
                              : 'border-green-600 text-green-700 hover:bg-green-50'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteKey(k.id)}
                          title="Thu hồi & Xóa vĩnh viễn"
                          className="p-1.5 border border-red-600 text-red-700 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Integration Docs */}
          <div className="border border-[#141414] bg-white p-3.5 space-y-2.5">
            <h3 className="text-xs font-mono font-bold uppercase text-[#141414] flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5" />
              <span>THÔNG SỐ KỸ THUẬT GATEWAY</span>
            </h3>
            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-[#E4E3E0]">
                <span className="text-[#666]">Auth Header:</span>
                <code className="text-[#141414] font-bold">X-API-Key: rag_sk_live_...</code>
              </div>
              <div className="flex flex-col py-1 border-b border-[#E4E3E0] gap-0.5">
                <span className="text-[#666]">Base URL Máy chủ:</span>
                <code className="text-[#141414] font-bold bg-[#F8F7F4] p-1 border border-[#141414]/20 break-all select-all">
                  {effectiveHost}
                </code>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E4E3E0]">
                <span className="text-[#666]">Chat Endpoint:</span>
                <code className="text-[#141414]">POST /api/v1/chat</code>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#666]">Search Endpoint:</span>
                <code className="text-[#141414]">POST /api/v1/search</code>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Code Generator & Live Sandbox (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Server Host URL Selector / Local App Mode */}
          <div className="border border-[#141414] bg-white p-3.5">
            <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-[#141414]">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#141414]" />
                <span className="text-xs font-mono font-bold uppercase text-[#141414]">
                  CẤU HÌNH SERVER URL (CHẠY LOCAL / LAN / ON-PREMISE)
                </span>
              </div>
              <span className="text-[10px] font-mono bg-blue-100 text-blue-900 px-1.5 py-0.2 border border-blue-400 font-bold">
                PORT 3000
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleHostModeChange('localhost')}
                  className={`px-2.5 py-1 text-xs font-mono font-bold border transition-colors ${
                    hostMode === 'localhost'
                      ? 'bg-[#141414] text-white border-[#141414]'
                      : 'bg-[#F8F7F4] text-[#141414] border-[#141414] hover:bg-[#E4E3E0]'
                  }`}
                >
                  http://localhost:3000 (Mặc định)
                </button>
                <button
                  type="button"
                  onClick={() => handleHostModeChange('loopback')}
                  className={`px-2.5 py-1 text-xs font-mono font-bold border transition-colors ${
                    hostMode === 'loopback'
                      ? 'bg-[#141414] text-white border-[#141414]'
                      : 'bg-[#F8F7F4] text-[#141414] border-[#141414] hover:bg-[#E4E3E0]'
                  }`}
                >
                  http://127.0.0.1:3000
                </button>
                <button
                  type="button"
                  onClick={() => handleHostModeChange('custom')}
                  className={`px-2.5 py-1 text-xs font-mono font-bold border transition-colors ${
                    hostMode === 'custom'
                      ? 'bg-[#141414] text-white border-[#141414]'
                      : 'bg-[#F8F7F4] text-[#141414] border-[#141414] hover:bg-[#E4E3E0]'
                  }`}
                >
                  IP LAN / Tên miền riêng...
                </button>
                <button
                  type="button"
                  onClick={() => handleHostModeChange('browser')}
                  className={`px-2.5 py-1 text-xs font-mono font-bold border transition-colors ${
                    hostMode === 'browser'
                      ? 'bg-[#141414] text-white border-[#141414]'
                      : 'bg-[#F8F7F4] text-[#141414] border-[#141414] hover:bg-[#E4E3E0]'
                  }`}
                >
                  Web URL Hiện tại
                </button>
              </div>

              {hostMode === 'custom' && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] font-mono text-[#666] whitespace-nowrap">Nhập Base URL:</span>
                  <input
                    type="text"
                    value={customHostUrl}
                    onChange={e => handleCustomHostChange(e.target.value)}
                    placeholder="http://192.168.1.100:3000 hoặc http://zabbix-rag.internal:3000"
                    className="flex-1 bg-[#F8F7F4] border border-[#141414] px-2.5 py-1 text-xs font-mono text-[#141414] focus:outline-none focus:bg-white"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Code Snippets Box */}
          <div className="border border-[#141414] bg-white">
            <div className="p-3 bg-[#F8F7F4] border-b border-[#141414] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#141414]" />
                <h2 className="text-xs font-mono font-bold uppercase text-[#141414]">
                  MẪU MÃ NGUỒN TÍCH HỢP (READY-TO-USE)
                </h2>
              </div>

              {/* Code tabs */}
              <div className="flex items-center gap-1 flex-wrap">
                {(
                  [
                    { id: 'zabbix', label: 'ZABBIX PYTHON' },
                    { id: 'curl', label: 'CURL BASH' },
                    { id: 'python', label: 'PYTHON' },
                    { id: 'nodejs', label: 'NODE.JS' },
                    { id: 'langchain', label: 'LANGCHAIN TOOL' },
                  ] as const
                ).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveCodeTab(tab.id)}
                    className={`px-2 py-1 text-[10px] font-mono font-bold transition-colors ${
                      activeCodeTab === tab.id
                        ? 'bg-[#141414] text-white'
                        : 'bg-[#E4E3E0] text-[#141414] hover:bg-[#D4D3D0]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-[#1E1E1E] text-[#D4D4D4] relative">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#333] text-[10px] font-mono text-[#888]">
                <span>LANGUAGE: {activeCodeTab.toUpperCase()}</span>
                <button
                  onClick={() => handleCopy(getSnippet(activeCodeTab), 'code-snippet')}
                  className="flex items-center gap-1 bg-[#333] hover:bg-[#444] text-white px-2 py-0.5 text-[10px] font-mono transition-colors"
                >
                  {copiedKeyId === 'code-snippet' ? (
                    <Check className="w-3 h-3 text-green-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedKeyId === 'code-snippet' ? 'ĐÃ SAO CHÉP' : 'SAO CHÉP CODE'}</span>
                </button>
              </div>

              <pre className="text-xs font-mono overflow-x-auto p-1 leading-relaxed max-h-[260px] text-green-400">
                <code>{getSnippet(activeCodeTab)}</code>
              </pre>
            </div>
          </div>

          {/* Live API Tester / Sandbox */}
          <div className="border border-[#141414] bg-white">
            <div className="p-3 bg-[#F8F7F4] border-b border-[#141414] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#141414]" />
                <h2 className="text-xs font-mono font-bold uppercase text-[#141414]">
                  LIVE API SANDBOX (TEST TRỰC TIẾP TRUY VẤN)
                </h2>
              </div>
              <span className="text-[10px] font-mono text-[#666]">HTTP POST SIMULATOR</span>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-[#141414] uppercase mb-1">
                    ENDPOINT
                  </label>
                  <select
                    value={testEndpoint}
                    onChange={e => setTestEndpoint(e.target.value as any)}
                    className="w-full bg-[#F8F7F4] border border-[#141414] px-2 py-1.5 text-xs font-mono text-[#141414] focus:outline-none"
                  >
                    <option value="/api/v1/chat">POST /api/v1/chat (RAG QA)</option>
                    <option value="/api/v1/search">POST /api/v1/search (Vector)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-[#141414] uppercase mb-1">
                    TOP_K CHUNKS
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={testTopK}
                    onChange={e => setTestTopK(Number(e.target.value))}
                    className="w-full bg-[#F8F7F4] border border-[#141414] px-2 py-1.5 text-xs font-mono text-[#141414] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-[#141414] uppercase mb-1">
                    NGƯỠNG SIMILARITY
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={testThreshold}
                    onChange={e => setTestThreshold(Number(e.target.value))}
                    className="w-full bg-[#F8F7F4] border border-[#141414] px-2 py-1.5 text-xs font-mono text-[#141414] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-[#141414] uppercase mb-1">
                  QUERY / CÂU HỎI HOẶC SỰ CỐ ZABBIX TRIGGER
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testQuery}
                    onChange={e => setTestQuery(e.target.value)}
                    placeholder="Nhập thông điệp lỗi hoặc câu hỏi cần RAG giải đáp..."
                    className="flex-1 bg-[#F8F7F4] border border-[#141414] px-3 py-1.5 text-xs font-mono text-[#141414] focus:outline-none focus:bg-white"
                  />
                  <button
                    onClick={handleRunLiveTest}
                    disabled={isTesting || !testQuery.trim()}
                    className="px-4 py-1.5 bg-[#141414] hover:bg-[#333] disabled:opacity-40 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all whitespace-nowrap"
                  >
                    {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>GỬI TEST API</span>
                  </button>
                </div>
              </div>

              {/* Sandbox Response Output */}
              {testLatency !== null && (
                <div className="mt-3 border border-[#141414] bg-[#141414] text-white p-3 font-mono text-xs">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#333] text-[10px]">
                    <div className="flex items-center gap-2">
                      <span className="text-green-400 font-bold">STATUS: 200 OK</span>
                      <span>•</span>
                      <span className="text-gray-300">LATENCY: {testLatency}ms</span>
                    </div>
                    <button
                      onClick={() => handleCopy(JSON.stringify(testResponse, null, 2), 'response-json')}
                      className="text-gray-400 hover:text-white flex items-center gap-1"
                    >
                      {copiedKeyId === 'response-json' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKeyId === 'response-json' ? 'Đã sao chép' : 'Sao chép JSON'}</span>
                    </button>
                  </div>

                  <pre className="text-[11px] text-gray-200 overflow-x-auto max-h-[220px] leading-relaxed whitespace-pre-wrap">
                    {JSON.stringify(testResponse, null, 2)}
                  </pre>
                </div>
              )}

              {testError && (
                <div className="p-3 bg-red-50 border border-red-600 text-red-700 font-mono text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">LỖI THỰC THI API TEST:</span>
                    <p className="mt-0.5">{testError}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Create New API Key */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#141414] w-full max-w-md shadow-[4px_4px_0px_0px_#141414] text-[#141414]">
            <div className="p-4 bg-[#F8F7F4] border-b border-[#141414] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-[#141414]" />
                <h3 className="text-xs font-mono font-bold uppercase text-[#141414]">
                  TẠO API KEY MỚI CHO CLIENT NGOÀI
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#666] hover:text-[#141414] font-mono text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateKey} className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-mono font-bold text-[#141414] uppercase mb-1">
                  TÊN CLIENT / ỨNG DỤNG TÍCH HỢP *
                </label>
                <input
                  type="text"
                  required
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  placeholder="Ví dụ: Zabbix Chatbox Production, Telegram DevOps Bot..."
                  className="w-full bg-[#F8F7F4] border border-[#141414] px-3 py-2 text-xs font-mono text-[#141414] focus:outline-none focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-[#141414] uppercase mb-1">
                  PHÂN QUYỀN TRUY CẬP (PERMISSIONS)
                </label>
                <div className="space-y-1.5 text-xs font-mono">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newKeyPerms.includes('read_rag')}
                      onChange={e => {
                        if (e.target.checked) setNewKeyPerms([...newKeyPerms, 'read_rag']);
                        else setNewKeyPerms(newKeyPerms.filter(p => p !== 'read_rag'));
                      }}
                      className="accent-[#141414]"
                    />
                    <span>Quyền Hỏi Đáp RAG (`/api/v1/chat`)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newKeyPerms.includes('search_vector')}
                      onChange={e => {
                        if (e.target.checked) setNewKeyPerms([...newKeyPerms, 'search_vector']);
                        else setNewKeyPerms(newKeyPerms.filter(p => p !== 'search_vector'));
                      }}
                      className="accent-[#141414]"
                    />
                    <span>Quyền Tra cứu Vector thô (`/api/v1/search`)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newKeyPerms.includes('ingest_doc')}
                      onChange={e => {
                        if (e.target.checked) setNewKeyPerms([...newKeyPerms, 'ingest_doc']);
                        else setNewKeyPerms(newKeyPerms.filter(p => p !== 'ingest_doc'));
                      }}
                      className="accent-[#141414]"
                    />
                    <span>Quyền Tự động nạp tài liệu (`/api/kb/documents`)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-[#141414] uppercase mb-1">
                  HẠN SỬ DỤNG (NGÀY) - TÙY CHỌN
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={newKeyExpires}
                  onChange={e => setNewKeyExpires(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Để trống = Khóa vĩnh viễn không hết hạn"
                  className="w-full bg-[#F8F7F4] border border-[#141414] px-3 py-2 text-xs font-mono text-[#141414] focus:outline-none focus:bg-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 border border-[#141414] text-xs font-mono font-bold"
                >
                  HỦY
                </button>
                <button
                  type="submit"
                  disabled={isCreatingKey || !newKeyName.trim()}
                  className="px-4 py-1.5 bg-[#141414] hover:bg-[#333] disabled:opacity-50 text-white text-xs font-mono font-bold flex items-center gap-1.5"
                >
                  {isCreatingKey && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>TẠO API KEY</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
