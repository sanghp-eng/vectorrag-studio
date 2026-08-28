import { GoogleGenAI } from '@google/genai';
import { searchVectorStore, StoredChunk, getAiClient } from './vectorStore.js';

export interface CitationSource {
  index: number;
  documentId: string;
  documentTitle: string;
  chunkId: string;
  chunkIndex: number;
  similarity: number;
  preview: string;
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
    topK = 4,
    similarityThreshold = 0.35,
    strictGrounding = true,
    temperature = 0.3,
    categoryFilter,
    customApiKey,
  } = options;

  const startRetrieval = Date.now();
  const searchResult = await searchVectorStore(userId, query, topK, similarityThreshold, categoryFilter, undefined, customApiKey);
  const retrievalTimeMs = Date.now() - startRetrieval;

  const relevantChunks = searchResult.results;
  const topSimilarity = relevantChunks.length > 0 ? relevantChunks[0].similarity : 0;

  // Prepare source citations
  const sources: CitationSource[] = relevantChunks.map((item, idx) => ({
    index: idx + 1,
    documentId: item.chunk.documentId,
    documentTitle: item.chunk.documentTitle,
    chunkId: item.chunk.id,
    chunkIndex: item.chunk.chunkIndex,
    similarity: Math.round(item.similarity * 100) / 100,
    preview: item.chunk.content.substring(0, 180) + (item.chunk.content.length > 180 ? '...' : ''),
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

  // Format context chunks for LLM
  const contextText = relevantChunks
    .map((item, idx) => `[Tài liệu ${idx + 1}: "${item.chunk.documentTitle}" (Đoạn ${item.chunk.chunkIndex}, Danh mục: ${item.chunk.category}, Điểm tương đồng: ${Math.round(item.similarity * 100)}%)]\n${item.chunk.content}`)
    .join('\n\n---\n\n');

  const startGen = Date.now();
  const ai = getAiClient(customApiKey);
  let answer = '';
  let modelName = 'gemini-3.7-flash';

  if (ai) {
    const prompt = `Bạn là trợ lý AI chuyên nghiệp về RAG (Retrieval-Augmented Generation).
Nhiệm vụ của bạn là trả lời câu hỏi của người dùng một cách chính xác, súc tích và hoàn toàn dựa trên các đoạn ngữ cảnh (Context) đã được truy xuất từ Cơ sở dữ liệu Vector dưới đây.

Quy tắc quan trọng:
1. Chỉ sử dụng thông tin có trong ngữ cảnh được cung cấp bên dưới. Không tự suy diễn hoặc bịa đặt thông tin không có cơ sở (Hallucination).
2. Khi trích dẫn thông tin từ một đoạn ngữ cảnh, hãy ghi rõ nguồn tham chiếu ở cuối câu hoặc đoạn bằng định dạng [1], [2],... tương ứng với số thứ tự [Tài liệu X].
3. Nếu ngữ cảnh không đủ thông tin để trả lời đầy đủ, hãy nêu rõ phần nào đã biết theo tài liệu và phần nào còn thiếu.
4. Trình bày câu trả lời rõ ràng bằng tiếng Việt (hoặc ngôn ngữ người dùng hỏi), sử dụng định dạng Markdown hợp lý (bullet points, in đậm các ý chính).

NGỮ CẢNH TRUY XUẤT TỪ VECTOR DATABASE:
"""
${contextText}
"""

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
            systemInstruction: 'Bạn là chuyên gia tư vấn RAG AI thông minh, chính xác, luôn trích dẫn nguồn [1], [2] từ context vector database.',
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
      console.warn('All Gemini models failed, falling back to local grounded synthesizer.');
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
  const summaryPoints = chunks
    .slice(0, 3)
    .map((c, i) => `**Trích đoạn từ ${c.chunk.documentTitle} [${i + 1}]** (Độ tương đồng: ${Math.round(c.similarity * 100)}%):\n> "${c.chunk.content.substring(0, 220)}..."`)
    .join('\n\n');

  return `### Kết quả Tổng hợp Dữ liệu từ Vector Database (RAG):

Dựa trên các khối dữ liệu ngữ nghĩa liên quan nhất trong kho tri thức của bạn:

${summaryPoints}

📌 **Tổng quan câu trả lời**:
Hệ thống đã truy xuất thông tin từ tài liệu **"${top.chunk.documentTitle}"** [1] với độ tương đồng vector đạt **${Math.round(top.similarity * 100)}%**. Dữ liệu trên cung cấp câu trả lời trực tiếp cho yêu cầu: *"${query}"*.`;
}
