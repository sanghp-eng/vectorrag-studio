import { GoogleGenAI } from '@google/genai';
import { searchVectorStore, StoredChunk, getAiClient, getExpandedContextChunks } from './vectorStore.js';

export interface CitationSource {
  index: number;
  documentId: string;
  documentTitle: string;
  chunkId: string;
  chunkIndex: number;
  similarity: number;
  preview: string;
  fullContent?: string;
  category: string;
}

export interface RAGAnswerResult {
  answer: string;
  sources: CitationSource[];
  metrics: {
    retrievalTimeMs: number;
    generationTimeMs: number;
    topSimilarity: number;
    chunksRetrieved: number;
    model: string;
  };
}

export async function generateRAGAnswer(
  userId: string,
  query: string,
  options: {
    topK?: number;
    similarityThreshold?: number;
    strictGrounding?: boolean;
    systemPrompt?: string;
    temperature?: number;
    categoryFilter?: string;
    customApiKey?: string;
  } = {}
): Promise<RAGAnswerResult> {
  const {
    topK = 6,
    similarityThreshold = 0.22,
    strictGrounding = true,
    temperature = 0.2,
    categoryFilter,
    customApiKey,
  } = options;

  const startRetrieval = Date.now();
  const searchResult = await searchVectorStore(userId, query, topK, similarityThreshold, categoryFilter, undefined, customApiKey);
  const retrievalTimeMs = Date.now() - startRetrieval;

  const relevantChunks = searchResult.results;
  const topSimilarity = relevantChunks.length > 0 ? relevantChunks[0].similarity : 0;

  // Prepare source citations with full content accessible
  const sources: CitationSource[] = relevantChunks.map((item, idx) => ({
    index: idx + 1,
    documentId: item.chunk.documentId,
    documentTitle: item.chunk.documentTitle,
    chunkId: item.chunk.id,
    chunkIndex: item.chunk.chunkIndex,
    similarity: Math.round(item.similarity * 100) / 100,
    preview: item.chunk.content.substring(0, 220) + (item.chunk.content.length > 220 ? '...' : ''),
    fullContent: item.chunk.content,
    category: item.chunk.category,
  }));

  // Handle case when no relevant context is found
  if (relevantChunks.length === 0 || (strictGrounding && topSimilarity < similarityThreshold)) {
    if (strictGrounding) {
      return {
        answer: `Xin lỗi, hệ thống không tìm thấy tài liệu phù hợp trong cơ sở dữ liệu vector để trả lời câu hỏi của bạn với độ tin cậy yêu cầu (Điểm tương đồng cao nhất: ${Math.round(topSimilarity * 100)}% < Ngưỡng cài đặt: ${Math.round(similarityThreshold * 100)}%).\n\nBạn có thể:\n1. Nạp thêm tài liệu liên quan vào Kho Tri thức (Knowledge Base).\n2. Giảm ngưỡng tương đồng (Similarity Threshold) trong cài đặt RAG.\n3. Thử diễn đạt lại câu hỏi theo cách khác.`,
        sources: [],
        metrics: {
          retrievalTimeMs,
          generationTimeMs: 0,
          topSimilarity,
          chunksRetrieved: 0,
          model: 'grounding-filter-enforced',
        },
      };
    }
  }

  // Get expanded context to ensure steps and boundaries across chunks are complete
  const rawTopChunks = relevantChunks.map(r => r.chunk);
  const expandedChunks = getExpandedContextChunks(userId, rawTopChunks);

  // Format context chunks for LLM with complete text
  const contextText = expandedChunks
    .map((chunk, idx) => {
      const match = relevantChunks.find(r => r.chunk.id === chunk.id);
      const simScore = match ? Math.round(match.similarity * 100) : 75;
      return `[Tài liệu ${idx + 1}: "${chunk.documentTitle}" (Phân đoạn #${chunk.chunkIndex}, Danh mục: ${chunk.category}, Điểm tương đồng: ${simScore}%)]\n${chunk.content}`;
    })
    .join('\n\n---\n\n');

  const startGen = Date.now();
  const ai = getAiClient(customApiKey);
  let answer = '';
  let modelName = 'gemini-3.7-flash';

  if (ai) {
    const prompt = `Bạn là hệ thống Trợ lý Trí tuệ Nhân tạo chuyên sâu về RAG (Retrieval-Augmented Generation & Vector Knowledge Base).
Nhiệm vụ của bạn là đọc kỹ toàn bộ ngữ cảnh (Context) đã được truy xuất từ Vector Database và trả lời câu hỏi của người dùng một cách **ĐẦY ĐỦ, TOÀN DIỆN, CHI TIẾT, RÕ RÀNG VÀ CHUYÊN NGHIỆP NHẤT**.

QUY TẮC PHẢN HỒI QUAN TRỌNG:
1. **TRẢ LỜI ĐẦY ĐỦ & TOÀN DIỆN (Tuyệt đối không tóm tắt quá ngắn hay cắt bớt ý)**:
   - Nếu tài liệu cung cấp các bước thực hiện (Bước 1, Bước 2, Bước 3,...), quy trình SOP, phân tích nguyên nhân - giải pháp, các tiêu chuẩn, hoặc danh sách các mục, bạn PHẢI trình bày đầy đủ TẤT CẢ các bước, nội dung chi tiết và không được bỏ sót bất kỳ bước nào.
   - Nếu trong tài liệu có các câu lệnh (commands như \`df -h\`, \`truncate\`, \`journalctl\`, \`systemctl\`, \`mysqladmin\`,...), cấu hình (\`my.cnf\`, \`innodb_buffer_pool_size\`,...), hoặc thông số kỹ thuật, bạn PHẢI hiển thị chính xác trong các khối mã Markdown (\`\`\`bash hoặc \`\`\`json) và giải thích rõ tác dụng.
   - Giải thích cặn kẽ nguyên nhân gốc rễ và hướng dẫn hành động cụ thể theo từng tình huống nêu trong tài liệu.

2. **ĐỐI CHIẾU VÀ TRÍCH DẪN NGUỒN CHUẨN XÁC**:
   - Khi đưa ra bất kỳ luận điểm hay bước xử lý nào, hãy trích dẫn số thứ tự nguồn tương ứng ở cuối câu hoặc đoạn bằng định dạng [1], [2],... khớp với [Tài liệu X] trong phần ngữ cảnh.

3. **CẤU TRÚC TRÌNH BÀY ĐẸP MẮT & DỄ ĐỌC**:
   - Sử dụng định dạng Markdown phong phú: Tiêu đề rõ ràng (###, ####), in đậm các từ khóa quan trọng, danh sách có thứ tự (1, 2, 3), bảng dữ liệu so sánh nếu có, và ghi chú cảnh báo (Lưu ý/Warning).

4. **TÍNH TRUNG THỰC VÀ CHỐNG ẢO GIÁC (GROUNDING)**:
   - Chỉ sử dụng các sự thật và hướng dẫn có trong ngữ cảnh bên dưới. Không tự sáng tác thông tin sai lệch ngoài tài liệu. Nếu một khía cạnh cụ thể chưa có trong tài liệu, hãy nêu rõ thông tin nào đã có và điểm nào cần bổ sung.

============================================================
NGỮ CẢNH ĐƯỢC TRUY XUẤT TỪ CƠ SỞ DỮ LIỆU VECTOR:
"""
${contextText}
"""
============================================================

CÂU HỎI CỦA NGƯỜI DÙNG:
${query}`;

    const candidateModels = ['gemini-3.7-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'];
    let generationSuccess = false;

    for (const candModel of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: candModel,
          contents: prompt,
          config: {
            temperature,
            maxOutputTokens: 4096,
            systemInstruction: 'Bạn là chuyên gia tư vấn RAG AI cao cấp, luôn cung cấp câu trả lời đầy đủ, chi tiết, chuyên sâu, có cấu trúc rõ ràng và trích dẫn chuẩn [1], [2] từ context vector database.',
          },
        });

        if (response.text && response.text.trim()) {
          answer = response.text.trim();
          modelName = candModel;
          generationSuccess = true;
          break;
        }
      } catch (err: any) {
        console.warn(`Gemini generation error on model ${candModel}:`, err?.message || err);
        // Continue to try next candidate model
      }
    }

    if (!generationSuccess) {
      console.warn('All Gemini models failed, falling back to comprehensive local grounded synthesizer.');
      modelName = 'local-rag-synthesizer';
      answer = synthesizeLocalGroundedAnswer(query, relevantChunks);
    }
  } else {
    modelName = 'local-rag-synthesizer';
    answer = synthesizeLocalGroundedAnswer(query, relevantChunks);
  }

  const generationTimeMs = Date.now() - startGen;

  return {
    answer,
    sources,
    metrics: {
      retrievalTimeMs,
      generationTimeMs,
      topSimilarity,
      chunksRetrieved: relevantChunks.length,
      model: modelName,
    },
  };
}

function synthesizeLocalGroundedAnswer(query: string, chunks: { chunk: StoredChunk; similarity: number }[]): string {
  if (chunks.length === 0) {
    return 'Không tìm thấy ngữ cảnh phù hợp trong cơ sở dữ liệu vector.';
  }

  const top = chunks[0];
  
  // Format each matched chunk completely with full text and highlighted sections
  const chunkDetails = chunks.map((item, idx) => {
    const docTitle = item.chunk.documentTitle;
    const cat = item.chunk.category;
    const score = Math.round(item.similarity * 100);
    const content = item.chunk.content.trim();

    return `### [${idx + 1}] Nguồn: ${docTitle} (Đoạn #${item.chunk.chunkIndex} - ${cat})
*Độ tương đồng ngữ nghĩa: **${score}%***

${content}
`;
  }).join('\n\n---\n\n');

  return `## Tổng hợp Chi tiết Dữ liệu từ Cơ sở dữ liệu Vector (RAG Studio)

Dưới đây là toàn bộ thông tin và hướng dẫn chi tiết được truy xuất từ kho tri thức để giải đáp câu hỏi: **"${query}"**

---

${chunkDetails}

---

### 💡 Tóm lược & Điểm mấu chốt:
- **Tài liệu nguồn chính:** Đã đối chiếu và trích xuất từ **"${top.chunk.documentTitle}"** [1] với độ khớp vector đạt **${Math.round(top.similarity * 100)}%**.
- **Tính xác thực:** Dữ liệu hoàn toàn được lấy từ các phân đoạn đã index trong Vector DB, đảm bảo tính chuẩn xác và không chứa thông tin suy diễn ngoài tài liệu.`;
}
