import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  authMiddleware,
  AuthenticatedRequest,
  registerUser,
  loginUser,
  getDemoCredentials,
  ensureDemoUser,
  seedSampleKnowledgeBase,
  getUserApiKey,
  setUserApiKey,
} from './server/auth.js';
import {
  createExternalApiKey,
  getUserApiKeys,
  revokeApiKey,
  toggleApiKeyStatus,
} from './server/apiKeys.js';
import {
  addDocument,
  getUserDocuments,
  getUserChunks,
  deleteDocument,
  searchVectorStore,
  getAiClient,
} from './server/vectorStore.js';
import { generateRAGAnswer } from './server/ragService.js';

dotenv.config();

function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '****';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

function resolveUserApiKey(req: AuthenticatedRequest): string | undefined {
  const headerKey = req.headers['x-gemini-api-key'] as string | undefined;
  if (headerKey && headerKey.trim()) return headerKey.trim();
  if (req.user?.id) {
    const userCustomKey = getUserApiKey(req.user.id);
    if (userCustomKey) return userCustomKey;
  }
  return process.env.GEMINI_API_KEY;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Ensure default demo user exists
  await ensureDemoUser();

  // ----------------------------------------------------
  // Public Health & Auth Routes
  // ----------------------------------------------------
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiApiKey: !!process.env.GEMINI_API_KEY,
      timestamp: new Date().toISOString(),
    });
  });

  // Auth: Register
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Vui lòng nhập đầy đủ email và mật khẩu.' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
      }
      const result = await registerUser(email, password, name);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Đăng ký thất bại' });
    }
  });

  // Auth: Login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu.' });
      }
      const result = await loginUser(email, password);
      res.json(result);
    } catch (err: any) {
      res.status(401).json({ error: err.message || 'Đăng nhập thất bại' });
    }
  });

  // Auth: Demo Login
  app.post('/api/auth/demo', async (req, res) => {
    try {
      const result = getDemoCredentials();
      if (!result) {
        await ensureDemoUser();
        const retryResult = getDemoCredentials();
        return res.json(retryResult);
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Không thể khởi tạo tài khoản demo' });
    }
  });

  // Auth: Me
  app.get('/api/auth/me', authMiddleware, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.user });
  });

  // ----------------------------------------------------
  // Gemini API Key Management Routes (Protected)
  // ----------------------------------------------------
  app.get('/api/settings/gemini-key', authMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const userCustomKey = getUserApiKey(userId);
      const serverEnvKey = process.env.GEMINI_API_KEY;
      const effectiveKey = userCustomKey || serverEnvKey;

      res.json({
        configured: !!effectiveKey,
        source: userCustomKey ? 'user_custom' : serverEnvKey ? 'server_env' : 'none',
        maskedKey: effectiveKey ? maskApiKey(effectiveKey) : '',
        hasServerEnv: !!serverEnvKey,
        hasCustomKey: !!userCustomKey,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Save / Update user custom Gemini API key (with live verification)
  app.post('/api/settings/gemini-key', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const { apiKey } = req.body;

      if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
        return res.status(400).json({ error: 'Vui lòng cung cấp khóa Gemini API Key hợp lệ.' });
      }

      const cleanKey = apiKey.trim();

      // Live verification: Try calling Gemini embedding to ensure key works
      try {
        const testClient = getAiClient(cleanKey);
        if (!testClient) {
          return res.status(400).json({ error: 'Không thể khởi tạo Gemini AI client với khóa này.' });
        }
        await testClient.models.embedContent({
          model: 'gemini-embedding-2-preview',
          contents: 'test connection ping',
        });
      } catch (verifyErr: any) {
        console.warn('Custom API Key verification test failed:', verifyErr);
        return res.status(400).json({
          error: `Kiểm tra khóa API thất bại: ${verifyErr?.message || 'Khóa không hợp lệ hoặc đã bị khóa/hết hạn'}.`,
        });
      }

      // Save to user profile
      setUserApiKey(userId, cleanKey);

      res.json({
        success: true,
        message: 'Khóa API Gemini đã được kiểm tra và lưu thành công vào phiên làm việc của bạn.',
        source: 'user_custom',
        maskedKey: maskApiKey(cleanKey),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Lỗi khi lưu cấu hình API Key' });
    }
  });

  // Test current or provided API key connectivity
  app.post('/api/settings/gemini-key/test', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { apiKey } = req.body;
      const keyToTest = (typeof apiKey === 'string' && apiKey.trim()) || resolveUserApiKey(req);

      if (!keyToTest) {
        return res.status(400).json({
          valid: false,
          error: 'Chưa có API Key nào được cấu hình để kiểm tra kết nối.',
        });
      }

      const testClient = getAiClient(keyToTest);
      if (!testClient) {
        return res.status(400).json({ valid: false, error: 'Không thể khởi tạo Gemini AI client.' });
      }

      const t0 = Date.now();
      await testClient.models.embedContent({
        model: 'gemini-embedding-2-preview',
        contents: 'test latency and permissions',
      });
      const latencyMs = Date.now() - t0;

      res.json({
        success: true,
        valid: true,
        latencyMs,
        maskedKey: maskApiKey(keyToTest),
        message: `Kết nối Gemini API hoạt động ổn định! Độ trễ phản hồi: ${latencyMs}ms`,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        valid: false,
        error: err?.message || 'Khóa API không hợp lệ hoặc bị lỗi kết nối từ máy chủ Google.',
      });
    }
  });

  // Remove custom API key and fall back to server env
  app.delete('/api/settings/gemini-key', authMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      setUserApiKey(userId, null);
      const serverEnvKey = process.env.GEMINI_API_KEY;

      res.json({
        success: true,
        message: 'Đã xóa khóa tùy chỉnh. Hệ thống sẽ sử dụng khóa máy chủ mặc định (nếu có).',
        source: serverEnvKey ? 'server_env' : 'none',
        maskedKey: serverEnvKey ? maskApiKey(serverEnvKey) : '',
        configured: !!serverEnvKey,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // External API Key Management (For Zabbix, Agents, Scripts)
  // ----------------------------------------------------
  // List all external API keys for current user
  app.get('/api/keys', authMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const keys = getUserApiKeys(userId);
      res.json({ success: true, keys });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Lỗi khi lấy danh sách API Key' });
    }
  });

  // Generate a new external API Key
  app.post('/api/keys', authMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const { name, permissions, expiresDays } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Vui lòng đặt tên gợi nhớ cho API Key (ví dụ: "Zabbix Chatbot").' });
      }

      const result = createExternalApiKey(
        userId,
        name.trim(),
        Array.isArray(permissions) ? permissions : ['read_rag', 'search_vector'],
        expiresDays ? Number(expiresDays) : undefined
      );

      res.json({
        success: true,
        message: 'Đã tạo API Key mới thành công. Hãy sao chép khóa ngay bây giờ vì bạn sẽ không thể nhìn thấy lại toàn bộ khóa này.',
        apiKey: result.apiKey,
        secretKey: result.secretKey, // Returned once
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Lỗi khi tạo API Key' });
    }
  });

  // Revoke / Delete an external API Key
  app.delete('/api/keys/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const deleted = revokeApiKey(userId, id);
      if (!deleted) {
        return res.status(404).json({ error: 'Không tìm thấy API Key hoặc bạn không có quyền thao tác.' });
      }
      res.json({ success: true, message: 'Đã thu hồi và xóa vĩnh viễn API Key.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Lỗi khi thu hồi API Key' });
    }
  });

  // Toggle active status for an API Key
  app.patch('/api/keys/:id/toggle', authMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const updated = toggleApiKeyStatus(userId, id);
      if (!updated) {
        return res.status(404).json({ error: 'Không tìm thấy API Key.' });
      }
      res.json({
        success: true,
        message: updated.isActive ? 'Đã kích hoạt lại API Key.' : 'Đã tạm dừng hoạt động API Key.',
        apiKey: updated,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Lỗi khi cập nhật trạng thái API Key' });
    }
  });

  // ----------------------------------------------------
  // Dedicated v1 External Agent Endpoints (Zabbix, LangChain, n8n, Python)
  // ----------------------------------------------------
  // External Bot Health & Stats Check
  app.get('/api/v1/status', authMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const docs = getUserDocuments(userId);
      const chunks = getUserChunks(userId);
      res.json({
        status: 'ready',
        service: 'Vector RAG Knowledgebase Engine v2.4',
        user: req.user?.name,
        totalDocuments: docs.length,
        totalVectorChunks: chunks.length,
        categories: Array.from(new Set(docs.map(d => d.category))),
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // External Bot RAG Query (Clean endpoint alias with prompt wrapper)
  app.post('/api/v1/chat', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const effectiveApiKey = resolveUserApiKey(req);
      const {
        query,
        topK = 4,
        similarityThreshold = 0.35,
        strictGrounding = true,
        temperature = 0.2,
        categoryFilter,
      } = req.body;

      if (!query || typeof query !== 'string' || !query.trim()) {
        return res.status(400).json({ error: 'Tham số `query` không được để trống.' });
      }

      const result = await generateRAGAnswer(userId, query.trim(), {
        topK: Number(topK),
        similarityThreshold: Number(similarityThreshold),
        strictGrounding: Boolean(strictGrounding),
        temperature: Number(temperature),
        categoryFilter,
        customApiKey: effectiveApiKey,
      });

      res.json({
        success: true,
        query: query.trim(),
        answer: result.answer,
        citations: result.citations,
        metrics: {
          retrievalLatencyMs: result.retrievalLatencyMs,
          generationLatencyMs: result.generationLatencyMs,
          topSimilarity: result.topSimilarity,
          chunksRetrieved: result.relevantChunks.length,
          modelUsed: result.modelUsed,
        },
      });
    } catch (err: any) {
      console.error('v1 Chat error:', err);
      res.status(500).json({ error: err.message || 'Lỗi khi xử lý truy vấn RAG' });
    }
  });

  // External Bot Raw Vector Search
  app.post('/api/v1/search', authMiddleware, async (req: AuthenticatedRequest, res) => {
    const startTime = Date.now();
    try {
      const userId = req.user!.id;
      const effectiveApiKey = resolveUserApiKey(req);
      const { query, topK = 4, similarityThreshold = 0.3, categoryFilter } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Tham số `query` không được để trống.' });
      }

      const searchRes = await searchVectorStore(
        userId,
        query.trim(),
        Number(topK),
        Number(similarityThreshold),
        categoryFilter,
        undefined,
        effectiveApiKey
      );

      const formattedResults = searchRes.results.map(item => ({
        documentTitle: item.chunk.documentTitle,
        category: item.chunk.category,
        chunkIndex: item.chunk.chunkIndex,
        content: item.chunk.content,
        similarity: Math.round(item.similarity * 1000) / 1000,
        characterCount: item.chunk.characterCount,
      }));

      res.json({
        success: true,
        query: query.trim(),
        results: formattedResults,
        totalFound: formattedResults.length,
        executionTimeMs: Date.now() - startTime,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Lỗi khi tìm kiếm vector' });
    }
  });

  // ----------------------------------------------------
  // PDF OCR & Document Understanding Endpoint
  // ----------------------------------------------------
  app.post('/api/pdf/ocr-parse', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const effectiveApiKey = resolveUserApiKey(req);
      const { fileBase64, fileName } = req.body;

      if (!fileBase64 || typeof fileBase64 !== 'string') {
        return res.status(400).json({ error: 'Dữ liệu file PDF (base64) không hợp lệ.' });
      }

      // Extract raw base64 data
      let rawBase64 = fileBase64;
      if (fileBase64.includes(',')) {
        rawBase64 = fileBase64.split(',')[1];
      }

      const ai = getAiClient(effectiveApiKey);
      if (!ai) {
        return res.status(400).json({
          error: 'Chưa có Gemini API Key. Vui lòng vào Cài Đặt để cấu hình API Key của bạn trước khi OCR file PDF.',
        });
      }

      const pdfPart = {
        inlineData: {
          mimeType: 'application/pdf',
          data: rawBase64,
        },
      };

      const promptPart = {
        text: `Bạn là hệ thống trích xuất văn bản và OCR tài liệu PDF chuyên sâu.
Nhiệm vụ: Trích xuất và nhận dạng quang học TOÀN BỘ nội dung trong tệp PDF đính kèm và chuyển đổi thành văn bản Markdown chuẩn đẹp:
1. Đọc và nhận dạng toàn bộ tiêu đề (H1, H2, H3), nội dung đoạn văn, danh sách liệt kê, và các bảng dữ liệu (chuyển đổi thành cú pháp bảng Markdown | col1 | col2 |).
2. Giữ nguyên 100% độ chính xác về ngữ nghĩa, từ ngữ, tiếng Việt có dấu (UTF-8), thuật ngữ kỹ thuật, ngày tháng và số liệu.
3. Chia tách rõ ràng giữa các trang bằng nhãn: "### --- [Trang X] ---" để hệ thống RAG đối chiếu số trang khi trích dẫn.
4. Chỉ trả về duy nhất nội dung văn bản đã được OCR và định dạng Markdown, KHÔNG thêm bất kỳ lời chào, ghi chú bên ngoài hay lời giải thích.`,
      };

      // Multi-model fallback chain to handle 503 high demand spikes
      const candidateModels = ['gemini-2.5-flash', 'gemini-3.7-flash', 'gemini-2.5-pro'];
      let extractedText = '';
      let usedModel = candidateModels[0];
      let lastError: any = null;

      for (const model of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: model,
            contents: [
              {
                role: 'user',
                parts: [pdfPart, promptPart],
              },
            ],
          });

          if (response.text && response.text.trim()) {
            extractedText = response.text.trim();
            usedModel = model;
            break;
          }
        } catch (modelErr: any) {
          lastError = modelErr;
          console.warn(`OCR attempt with model ${model} failed (${modelErr?.message || modelErr}). Trying next candidate...`);
          // Brief pause before trying next candidate
          await new Promise(r => setTimeout(r, 600));
        }
      }

      if (!extractedText) {
        return res.status(503).json({
          error: lastError?.message || 'Các mô hình AI Gemini đang trong thời điểm tải cao (503 High Demand). Vui lòng sử dụng chế độ trích xuất PDF trực tiếp hoặc thử lại sau giây lát.',
          canFallbackToClient: true,
        });
      }

      res.json({
        success: true,
        text: extractedText,
        method: 'ocr_gemini',
        modelUsed: usedModel,
        characterCount: extractedText.length,
        fileName: fileName || 'Document.pdf',
        message: `Đã OCR và trích xuất thành công nội dung PDF bằng mô hình ${usedModel}.`,
      });
    } catch (err: any) {
      console.error('Error during PDF OCR parsing:', err);
      res.status(500).json({
        error: err?.message || 'Lỗi trong quá trình xử lý OCR tài liệu PDF bằng Gemini AI.',
        canFallbackToClient: true,
      });
    }
  });

  // ----------------------------------------------------
  // Protected Knowledge Base Routes
  // ----------------------------------------------------
  // Get all documents for current user
  app.get('/api/kb/documents', authMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const docs = getUserDocuments(userId);
      res.json({ documents: docs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add a new document (chunk and embed into vector store)
  app.post('/api/kb/documents', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const effectiveApiKey = resolveUserApiKey(req);
      const {
        title,
        content,
        category = 'Tài liệu chung',
        tags = [],
        chunkingStrategy = 'paragraph',
        chunkSize = 350,
        chunkOverlap = 50,
      } = req.body;

      if (!title || !content) {
        return res.status(400).json({ error: 'Tiêu đề và nội dung tài liệu không được để trống.' });
      }

      const { document, chunks } = await addDocument(
        userId,
        title,
        content,
        category,
        tags,
        chunkingStrategy,
        chunkSize,
        chunkOverlap,
        effectiveApiKey
      );

      res.json({
        success: true,
        document,
        chunksCount: chunks.length,
        message: `Đã nạp và tạo vector embedding thành công cho ${chunks.length} phân đoạn (chunks).`,
      });
    } catch (err: any) {
      console.error('Error adding document:', err);
      res.status(500).json({ error: err.message || 'Lỗi khi xử lý nạp tài liệu và vector' });
    }
  });

  // Delete a document
  app.delete('/api/kb/documents/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const docId = req.params.id;
      const deleted = deleteDocument(userId, docId);
      if (deleted) {
        res.json({ success: true, message: 'Đã xóa tài liệu và các vector chunks liên quan.' });
      } else {
        res.status(404).json({ error: 'Không tìm thấy tài liệu cần xóa.' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Seed standard sample knowledge bases
  app.post('/api/kb/seed-presets', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      await seedSampleKnowledgeBase(userId);
      const docs = getUserDocuments(userId);
      res.json({ success: true, documents: docs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get user chunks
  app.get('/api/kb/chunks', authMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const documentId = req.query.documentId as string | undefined;
      const chunks = getUserChunks(userId, documentId);
      // Return chunks with embedding dimensions without sending full float arrays to save bandwidth
      const lightChunks = chunks.map(c => ({
        id: c.id,
        documentId: c.documentId,
        documentTitle: c.documentTitle,
        category: c.category,
        chunkIndex: c.chunkIndex,
        content: c.content,
        tokenCount: c.tokenCount,
        characterCount: c.characterCount,
        embeddingDim: c.embedding.length,
        createdAt: c.createdAt,
      }));
      res.json({ chunks: lightChunks, total: lightChunks.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // Protected Semantic Search & Vector Studio Routes
  // ----------------------------------------------------
  app.post('/api/vector/search', authMiddleware, async (req: AuthenticatedRequest, res) => {
    const startTime = Date.now();
    try {
      const userId = req.user!.id;
      const effectiveApiKey = resolveUserApiKey(req);
      const {
        query,
        topK = 4,
        similarityThreshold = 0.3,
        categoryFilter,
        documentIds,
      } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Vui lòng nhập từ khóa hoặc câu truy vấn ngữ nghĩa.' });
      }

      const searchRes = await searchVectorStore(
        userId,
        query,
        Number(topK),
        Number(similarityThreshold),
        categoryFilter,
        documentIds,
        effectiveApiKey
      );

      const executionTimeMs = Date.now() - startTime;

      const formattedResults = searchRes.results.map(item => ({
        chunk: {
          id: item.chunk.id,
          documentId: item.chunk.documentId,
          documentTitle: item.chunk.documentTitle,
          category: item.chunk.category,
          chunkIndex: item.chunk.chunkIndex,
          content: item.chunk.content,
          tokenCount: item.chunk.tokenCount,
          characterCount: item.chunk.characterCount,
          embeddingDim: item.chunk.embedding.length,
          pcaCoords: item.pcaCoords,
          createdAt: item.chunk.createdAt,
        },
        similarity: Math.round(item.similarity * 1000) / 1000,
      }));

      res.json({
        query,
        queryPca: searchRes.queryPca,
        results: formattedResults,
        totalChunksSearched: searchRes.totalChunksSearched,
        executionTimeMs,
        modelUsed: searchRes.modelUsed,
      });
    } catch (err: any) {
      console.error('Vector search error:', err);
      res.status(500).json({ error: err.message || 'Lỗi khi thực hiện tìm kiếm ngữ nghĩa' });
    }
  });

  // ----------------------------------------------------
  // Protected RAG Generation Route
  // ----------------------------------------------------
  app.post('/api/rag/chat', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const effectiveApiKey = resolveUserApiKey(req);
      const {
        query,
        topK = 4,
        similarityThreshold = 0.35,
        strictGrounding = true,
        temperature = 0.3,
        categoryFilter,
      } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Câu hỏi không được để trống.' });
      }

      const result = await generateRAGAnswer(userId, query, {
        topK: Number(topK),
        similarityThreshold: Number(similarityThreshold),
        strictGrounding: Boolean(strictGrounding),
        temperature: Number(temperature),
        categoryFilter,
        customApiKey: effectiveApiKey,
      });

      res.json(result);
    } catch (err: any) {
      console.error('RAG chat error:', err);
      res.status(500).json({ error: err.message || 'Lỗi khi xử lý RAG' });
    }
  });

  // ----------------------------------------------------
  // Vite Integration for Dev / Static for Prod
  // ----------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vector RAG Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
